import os
import json
import tempfile
import logging
import math
from datetime import datetime, timezone
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

# ── Whisper model — loaded once at startup ────────────────────────────────────
_whisper_model = None
try:
    from faster_whisper import WhisperModel
    _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    logger.info("faster-whisper model loaded successfully")
except Exception as exc:
    logger.warning("faster-whisper not available: %s", exc)


# ── Row serializer — fixes Bug 14: was returning 'recording_path' key ─────────
def _row(call: Call) -> dict:
    return {
        "id":                        call.id,
        "contact":                   call.contact_name or "Unknown",
        "phone":                     call.phone_number,
        "employee":                  call.employee.name if call.employee else None,
        "date":                      call.start_time,
        "duration_seconds":          call.duration_seconds,
        "call_type":                 call.call_type,
        "call_status":               call.call_status,
        "source":                    call.source,
        "sim_slot":                  call.sim_slot,
        # recording_url is a private storage path — NEVER expose to the frontend
        # Frontend must call GET /calls/{id}/recording-url to get a signed URL
        "recording_available":       call.recording_available,
        "recording_status":          call.recording_status or "not_available",
        "recording_size_bytes":      call.recording_size_bytes,
        "recording_mime_type":       call.recording_mime_type,
        "recording_uploaded_at":     call.recording_uploaded_at,
        # transcript
        "transcript_status":         call.transcript_status or ("pending" if call.recording_available else None),
        "transcript_text":           call.transcript_text,
        "transcript_error":          call.transcript_error,
        "transcription_started_at":  call.transcription_started_at,
        "transcription_completed_at": call.transcription_completed_at,
        # summary
        "summary_status":            call.summary_status,
        "summary_text":              call.summary_text,
        "summary_data":              call.summary_data,
        # privacy
        "call_privacy":              getattr(call, "call_privacy", "unclassified") or "unclassified",
    }


# ── Signed URL helper ─────────────────────────────────────────────────────────
def _get_signed_url_sync(storage_path: str) -> str | None:
    """Generate a 1-hour signed URL from Supabase Storage (synchronous)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    import httpx
    url = (
        f"{settings.SUPABASE_URL}/storage/v1/object/sign"
        f"/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"
    )
    try:
        resp = httpx.post(
            url,
            json={"expiresIn": 3600},
            headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"},
            timeout=10,
        )
        if resp.status_code == 200:
            signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
            if signed:
                return f"{settings.SUPABASE_URL}{signed}" if signed.startswith("/") else signed
    except Exception as exc:
        logger.warning("Signed URL generation failed: %s", exc)
    return None


# ── List all calls (with recording/transcript status) ─────────────────────────
# Fix Bug 15: was filtering recording_available=True only — now returns all calls
@router.get("")
def list_calls_with_status(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    recording_status: str = Query(None),
    transcript_status: str = Query(None),
    employee_id: str = Query(None),
    q: str = Query(None),
    recorded_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    query = (
        db.query(Call)
        .options(joinedload(Call.employee))
        .filter(Call.organization_id == user.organization_id)
        .order_by(Call.start_time.desc())
    )
    if recorded_only:
        query = query.filter(Call.recording_available.is_(True))
    if recording_status:
        query = query.filter(Call.recording_status == recording_status)
    if transcript_status:
        query = query.filter(Call.transcript_status == transcript_status)
    if employee_id:
        query = query.filter(Call.employee_id == employee_id)
    if q:
        query = query.filter(
            (Call.phone_number.ilike(f"%{q}%")) |
            (Call.contact_name.ilike(f"%{q}%"))
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


# ── Get single call transcript status ────────────────────────────────────────
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


# ── Whisper background worker ─────────────────────────────────────────────────
def _run_whisper_sync(call_id: str, storage_path: str, org_id: str) -> None:
    """
    Synchronous background task — runs in FastAPI threadpool.
    Downloads audio via signed URL, transcribes with faster-whisper, saves result.
    """
    import asyncio
    import httpx

    db: Session = SessionLocal()
    try:
        call = db.query(Call).filter(
            Call.id == call_id,
            Call.organization_id == org_id,
        ).first()
        if not call:
            return

        # Mark the automatic and manual paths consistently before work begins.
        call.transcript_status = "processing"
        call.transcription_started_at = datetime.now(timezone.utc)
        call.transcript_error = None
        db.commit()

        # ── Generate signed URL ───────────────────────────────────────────────
        signed_url = _get_signed_url_sync(storage_path)
        if not signed_url:
            call.transcript_status = "failed"
            call.transcript_error = "Could not generate download URL for recording"
            db.commit()
            return

        # ── Stream audio to a bounded temporary file ──────────────────────────
        MAX_BYTES = 500 * 1024 * 1024
        safe_exts = {".m4a", ".ogg", ".wav", ".aac", ".mp4", ".webm", ".mp3", ".3gp", ".amr"}
        suffix = ".mp4"
        path_lower = storage_path.lower().split("?")[0]
        for ext in safe_exts:
            if path_lower.endswith(ext):
                suffix = ext
                break

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=suffix, dir=tempfile.gettempdir()
            ) as tmp:
                tmp_path = tmp.name
                total = 0
                with httpx.stream("GET", signed_url, timeout=120, follow_redirects=True) as response:
                    if response.status_code != 200:
                        raise RuntimeError(f"Download failed with HTTP {response.status_code}")
                    for chunk in response.iter_bytes(chunk_size=65536):
                        total += len(chunk)
                        if total > MAX_BYTES:
                            raise RuntimeError("Recording exceeds transcription size limit")
                        tmp.write(chunk)

            if total == 0:
                raise RuntimeError("Downloaded recording is empty")
            if _whisper_model is None:
                raise RuntimeError("Transcription engine unavailable")

            segments, _ = _whisper_model.transcribe(tmp_path, beam_size=5)
            transcript = " ".join(seg.text.strip() for seg in segments).strip()

            # The file was accepted for this organization, so persist Whisper's
            # result even if an optional call label changed while it ran.
            db.refresh(call)
            call.transcript_text = transcript or "(no speech detected)"
            call.transcript_status = "completed"
            call.transcript_error = None
            call.transcription_completed_at = datetime.now(timezone.utc)
            logger.info("Transcription completed for call %s (%d chars)", call_id, len(transcript))
        except Exception as exc:
            call.transcript_status = "failed"
            call.transcript_error = "Transcription processing failed"
            logger.warning("Transcription failed for call %s: %s", call_id, exc)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    logger.warning("Could not remove transcription temp file for call %s", call_id)

        db.commit()

        # Broadcast transcript status update
        try:
            asyncio.run(
                manager.broadcast(
                    org_id,
                    {
                        "event": "transcript_updated",
                        "call_id": call_id,
                        "transcript_status": call.transcript_status,
                        "recording_status": "uploaded",
                    },
                )
            )
        except Exception:
            pass

        # Auto-trigger AI summary if transcription succeeded
        if call.transcript_status == "completed" and call.transcript_text:
            _run_ai_summary_sync(call_id, org_id)

    except Exception as exc:
        logger.exception("Unexpected transcription error for call %s: %s", call_id, exc)
        try:
            call = db.query(Call).filter(Call.id == call_id).first()
            if call:
                call.transcript_status = "failed"
                call.transcript_error = "Unexpected error during transcription"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Trigger transcription ─────────────────────────────────────────────────────
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
    ).with_for_update().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_url or not call.recording_available:
        raise HTTPException(status_code=400, detail="No recording available for this call")
    if call.transcript_status == "completed":
        return {"status": "completed", "transcript": call.transcript_text}
    if call.transcript_status == "processing":
        return {"status": "processing", "message": "Already in progress. Check back shortly."}

    call.transcript_status = "processing"
    call.transcription_started_at = datetime.now(timezone.utc)
    call.transcript_error = None

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

    background_tasks.add_task(
        _run_whisper_sync,
        call_id,
        call.recording_url,
        user.organization_id,
    )
    return {"status": "processing", "message": "Transcription started. Refresh in a few seconds."}


# ── Retry failed transcription ────────────────────────────────────────────────
@router.post("/{call_id}/transcribe/retry")
def retry_transcription(
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
    if call.transcript_status not in ("failed", None, "pending"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry — current status is '{call.transcript_status}'",
        )
    if not call.recording_url or not call.recording_available:
        raise HTTPException(status_code=400, detail="No recording available")

    call.transcript_status = "processing"
    call.transcript_text = None
    call.transcript_error = None
    call.transcription_started_at = datetime.now(timezone.utc)
    call.transcription_completed_at = None
    db.commit()

    background_tasks.add_task(
        _run_whisper_sync,
        call_id,
        call.recording_url,
        user.organization_id,
    )
    return {"status": "processing", "message": "Retry started."}


# ── AI Summary ────────────────────────────────────────────────────────────────

def _run_ai_summary_sync(call_id: str, org_id: str) -> None:
    """
    Generate an AI summary from the completed transcript.
    Uses OpenAI if configured, otherwise produces a rule-based summary.
    Runs in the same background thread as transcription.
    """
    import asyncio

    db: Session = SessionLocal()
    try:
        call = db.query(Call).filter(
            Call.id == call_id,
            Call.organization_id == org_id,
        ).first()
        if not call or not call.transcript_text:
            return
        if call.summary_status == "completed":
            return

        call.summary_status = "processing"
        db.commit()

        transcript = call.transcript_text.strip()
        if not transcript or transcript == "(no speech detected)":
            call.summary_status = "failed"
            call.summary_error = "No speech detected in recording — cannot summarize"
            db.commit()
            return

        summary_data = _generate_summary(transcript)

        # The call label is informational, so retain the generated summary.
        db.refresh(call)
        call.summary_status = "completed"
        call.summary_text = summary_data.get("summary", "")
        call.summary_data = summary_data
        call.summary_error = None
        db.commit()

        logger.info("AI summary completed for call %s", call_id)

        try:
            asyncio.run(
                manager.broadcast(
                    org_id,
                    {
                        "event": "summary_updated",
                        "call_id": call_id,
                        "summary_status": "completed",
                    },
                )
            )
        except Exception:
            pass

    except Exception as exc:
        logger.warning("AI summary failed for call %s: %s", call_id, exc)
        try:
            call = db.query(Call).filter(Call.id == call_id).first()
            if call:
                call.summary_status = "failed"
                call.summary_error = "Summary generation failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _generate_summary(transcript: str) -> dict:
    """
    Generate structured summary. Uses OpenAI GPT if available, otherwise
    returns a minimal rule-based structure so the field is never empty.
    Never invents details not present in the transcript.
    """
    # Try OpenAI
    try:
        import openai
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        if openai_key:
            client = openai.OpenAI(api_key=openai_key)
            prompt = (
                "You are a sales call analyst. Analyze the following call transcript and return "
                "a JSON object with these exact keys:\n"
                "- summary: 2-3 sentence summary of the call\n"
                "- discussion_points: list of main topics discussed\n"
                "- customer_requirements: list of customer needs mentioned\n"
                "- questions_asked: list of questions the customer asked\n"
                "- follow_up_actions: list of agreed next steps\n"
                "- suggested_next_step: single recommended action\n"
                "- sentiment: one of positive | neutral | negative\n"
                "- lead_quality: one of hot | warm | cold | not_a_lead\n"
                "- keywords: list of important keywords\n\n"
                "Only include information explicitly present in the transcript. "
                "Return valid JSON only.\n\n"
                f"TRANSCRIPT:\n{transcript[:4000]}"
            )
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=800,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw)
            data["ai_generated"] = True
            data["model"] = "gpt-3.5-turbo"
            return data
    except Exception as exc:
        logger.warning("OpenAI summary failed, using rule-based fallback: %s", exc)

    # Deterministic extractive fallback. It leaves analytical judgments empty
    # rather than fabricating sentiment, lead quality, or next actions.
    words = transcript.split()
    sentences = [s.strip() for s in transcript.replace("?", "?.").split(".") if s.strip()]
    questions = [s for s in sentences if "?" in s]
    summary = " ".join(sentences[:2]) if sentences else transcript[:200]
    keywords = sorted({
        "".join(ch for ch in word.lower() if ch.isalnum())
        for word in words
        if len(word) > 5
    } - {""})[:10]

    return {
        "summary": summary,
        "discussion_points": [],
        "customer_requirements": [],
        "questions_asked": questions[:5],
        "follow_up_actions": [],
        "suggested_next_step": None,
        "sentiment": None,
        "lead_quality": None,
        "keywords": keywords,
        "ai_generated": False,
        "model": "rule_based_extractive",
        "word_count": len(words),
        "analysis_limited": True,
    }


# ── Trigger AI summary manually ───────────────────────────────────────────────
@router.post("/{call_id}/summarize")
def summarize_call(
    call_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).with_for_update().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if call.transcript_status != "completed" or not call.transcript_text:
        raise HTTPException(status_code=400, detail="Transcription must be completed before summarizing")
    if call.summary_status == "processing":
        return {"status": "processing", "message": "Summary already in progress"}
    if call.summary_status == "completed":
        return {"status": "completed", "summary": call.summary_text}

    call.summary_status = "processing"
    call.summary_error = None
    db.commit()

    background_tasks.add_task(_run_ai_summary_sync, call_id, user.organization_id)
    return {"status": "processing", "message": "Summary generation started"}


# ── Retry AI summary ──────────────────────────────────────────────────────────
@router.post("/{call_id}/summarize/retry")
def retry_summary(
    call_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).with_for_update().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if call.summary_status not in ("failed", None):
        raise HTTPException(status_code=400, detail=f"Cannot retry — status is '{call.summary_status}'")
    if call.transcript_status != "completed":
        raise HTTPException(status_code=400, detail="Transcription must be completed first")

    call.summary_status = "processing"
    call.summary_text = None
    call.summary_data = None
    call.summary_error = None
    db.commit()

    background_tasks.add_task(_run_ai_summary_sync, call_id, user.organization_id)
    return {"status": "processing", "message": "Summary retry started"}
