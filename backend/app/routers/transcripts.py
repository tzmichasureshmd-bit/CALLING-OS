import os
import tempfile
import logging
import math
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Request
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_role
from ..database import SessionLocal, get_db
from ..models import Call, User
from ..config import settings
from ..ws_manager import manager
from .. import audit

logger = logging.getLogger("callnexa.transcripts")

router = APIRouter(prefix="/transcripts", tags=["transcripts"])

# Load Whisper model once at import — cached for all requests
_whisper_model = None
try:
    from faster_whisper import WhisperModel
    _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    logger.info("faster-whisper model loaded successfully")
except Exception as exc:
    logger.warning("faster-whisper not available: %s", exc)


def _row(call: Call) -> dict:
    return {
        "id": call.id,
        "contact": call.contact_name,
        "phone": call.phone_number,
        "employee": call.employee.name if call.employee else None,
        "date": call.start_time,
        "duration_seconds": call.duration_seconds,
        "recording_path": call.recording_url,   # storage path, not public URL
        "transcript_status": call.transcript_status or "pending",
        "transcript_text": call.transcript_text,
    }


async def _get_signed_url(storage_path: str) -> str | None:
    """Generate a short-lived signed URL for internal download."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    import httpx
    url = (
        f"{settings.SUPABASE_URL}/storage/v1/object/sign"
        f"/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                json={"expiresIn": 3600},
                headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"},
            )
        if resp.status_code == 200:
            signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
            if signed:
                return f"{settings.SUPABASE_URL}{signed}" if signed.startswith("/") else signed
    except Exception as exc:
        logger.warning("Signed URL for transcription failed: %s", exc)
    return None


@router.get("")
def list_recorded_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    query = (
        db.query(Call)
        .options(joinedload(Call.employee))
        .filter(
            Call.organization_id == user.organization_id,
            Call.recording_available.is_(True),
        )
        .order_by(Call.start_time.desc())
    )
    total = query.count()
    calls = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [_row(c) for c in calls],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 1,
    }


@router.get("/{call_id}")
def get_transcript(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    call = (
        db.query(Call)
        .options(joinedload(Call.employee))
        .filter(Call.id == call_id, Call.organization_id == user.organization_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return _row(call)


def _run_whisper_sync(call_id: str, storage_path: str, org_id: str) -> None:
    """
    Fully synchronous background task — runs in FastAPI threadpool.
    Downloads audio via signed URL, transcribes with faster-whisper, saves result.
    """
    import asyncio
    import httpx

    db: Session = SessionLocal()
    try:
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            return

        # ── Generate signed URL synchronously ────────────────────────────────
        signed_url = None
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            sign_endpoint = (
                f"{settings.SUPABASE_URL}/storage/v1/object/sign"
                f"/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"
            )
            try:
                resp = httpx.post(
                    sign_endpoint,
                    json={"expiresIn": 3600},
                    headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"},
                    timeout=15,
                )
                if resp.status_code == 200:
                    s = resp.json().get("signedURL") or resp.json().get("signedUrl")
                    signed_url = f"{settings.SUPABASE_URL}{s}" if s and s.startswith("/") else s
            except Exception as exc:
                logger.warning("Signed URL for transcription failed: %s", exc)

        if not signed_url:
            call.transcript_status = "failed"
            call.transcript_text = "Transcription failed: could not generate download URL"
            db.commit()
            return

        # ── Download audio with size limit ────────────────────────────────────
        MAX_BYTES = 500 * 1024 * 1024  # 500 MB
        try:
            with httpx.stream("GET", signed_url, timeout=120, follow_redirects=True) as r:
                if r.status_code != 200:
                    raise RuntimeError(f"Download failed: HTTP {r.status_code}")
                chunks = []
                total = 0
                for chunk in r.iter_bytes(chunk_size=65536):
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise RuntimeError("Recording too large for transcription (>500MB)")
                    chunks.append(chunk)
            audio_bytes = b"".join(chunks)
        except Exception as exc:
            call.transcript_status = "failed"
            call.transcript_text = f"Download failed: {exc}"
            db.commit()
            return

        # ── Determine safe extension ──────────────────────────────────────────
        safe_exts = {".m4a", ".ogg", ".wav", ".aac", ".mp4", ".webm", ".mp3", ".3gp", ".amr"}
        suffix = ".mp4"
        path_lower = storage_path.lower().split("?")[0]
        for ext in safe_exts:
            if path_lower.endswith(ext):
                suffix = ext
                break

        # ── Transcribe ────────────────────────────────────────────────────────
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=suffix, dir=tempfile.gettempdir()
            ) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            if _whisper_model is None:
                raise RuntimeError(
                    "faster-whisper not installed. Run: pip install faster-whisper==1.0.3"
                )
            segments, _ = _whisper_model.transcribe(tmp_path, beam_size=5)
            transcript = " ".join(seg.text.strip() for seg in segments).strip()
            call.transcript_text = transcript or "(no speech detected)"
            call.transcript_status = "completed"
            logger.info("Transcription completed for call %s (%d chars)", call_id, len(transcript))
        except Exception as exc:
            call.transcript_status = "failed"
            call.transcript_text = f"Transcription failed: {exc}"
            logger.warning("Transcription failed for call %s: %s", call_id, exc)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        db.commit()

        # Broadcast transcript status update
        try:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                manager.broadcast(
                    org_id,
                    {
                        "event": "transcript_updated",
                        "call_id": call_id,
                        "status": call.transcript_status,
                        "transcript_status": call.transcript_status,
                        "recording_status": "uploaded",
                    },
                )
            )
            loop.close()
        except Exception:
            pass

    except Exception as exc:
        logger.exception("Unexpected transcription error for call %s: %s", call_id, exc)
        try:
            call = db.query(Call).filter(Call.id == call_id).first()
            if call:
                call.transcript_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/{call_id}/transcribe")
def transcribe_call(
    call_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_url or not call.recording_available:
        raise HTTPException(status_code=400, detail="No recording available for this call")
    if call.transcript_status == "completed":
        return {"status": "completed", "transcript": call.transcript_text}
    if call.transcript_status == "processing":
        return {"status": "processing", "message": "Already in progress. Check back shortly."}

    # Mark processing immediately — prevents double-queue on rapid clicks
    call.transcript_status = "processing"

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.TRANSCRIPT_START,
        actor=user,
        resource="call",
        resource_id=call_id,
        request=request,
    )
    db.commit()

    # Run fully synchronous in threadpool — no asyncio.run() nesting
    background_tasks.add_task(
        _run_whisper_sync,
        call_id,
        call.recording_url,   # storage path
        user.organization_id,
    )
    return {"status": "processing", "message": "Transcription started. Refresh in a few seconds."}


@router.post("/{call_id}/transcribe/retry")
def retry_transcription(
    call_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """Retry a failed transcription."""
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if call.transcript_status not in ("failed", None):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry — current status is '{call.transcript_status}'",
        )
    if not call.recording_url or not call.recording_available:
        raise HTTPException(status_code=400, detail="No recording available")

    call.transcript_status = "processing"
    call.transcript_text = None
    db.commit()

    background_tasks.add_task(
        _run_whisper_sync,
        call_id,
        call.recording_url,
        user.organization_id,
    )
    return {"status": "processing", "message": "Retry started."}
