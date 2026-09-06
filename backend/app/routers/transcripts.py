import httpx
import tempfile
import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import SessionLocal, get_db
from ..models import Call, User
from ..config import settings

router = APIRouter(prefix="/transcripts", tags=["transcripts"])

# Load model once at module import — cached in memory for all subsequent calls
# First run downloads ~150MB to ~/.cache/huggingface (free, one-time)
try:
    from faster_whisper import WhisperModel
    _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
except Exception:
    _whisper_model = None


def _row(call: Call) -> dict:
    return {
        "id": call.id,
        "contact": call.contact_name,
        "phone": call.phone_number,
        "employee": call.employee.name if call.employee else None,
        "date": call.start_time,
        "duration_seconds": call.duration_seconds,
        "recording_url": call.recording_url,
        "transcript_status": call.transcript_status or "pending",
        "transcript_text": call.transcript_text,
    }


@router.get("")
def list_recorded_calls(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    calls = (
        db.query(Call)
        .options(joinedload(Call.employee))
        .filter(Call.organization_id == user.organization_id, Call.recording_available.is_(True))
        .order_by(Call.start_time.desc())
        .all()
    )
    return {"items": [_row(c) for c in calls], "total": len(calls)}


@router.get("/{call_id}")
def get_transcript(call_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    call = (
        db.query(Call)
        .options(joinedload(Call.employee))
        .filter(Call.id == call_id, Call.organization_id == user.organization_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return _row(call)


def _run_whisper_sync(call_id: str, recording_url: str):
    """Sync wrapper — BackgroundTasks runs in threadpool, so we use asyncio.run."""
    asyncio.run(_run_whisper(call_id, recording_url))


async def _run_whisper(call_id: str, recording_url: str):
    """Background task: download audio → Whisper → save to DB."""
    db: Session = SessionLocal()
    try:
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            return

        # 1. Download the audio file into a temp file
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(recording_url)
            if resp.status_code != 200:
                call.transcript_status = "failed"
                db.commit()
                return

        # Safe temp file — suffix is hardcoded, not from user input
        suffix = ".mp3"
        safe_exts = [".m4a", ".ogg", ".wav", ".aac", ".mp4", ".webm", ".mp3"]
        url_lower = recording_url.lower().split("?")[0]  # strip query params
        for ext in safe_exts:
            if url_lower.endswith(ext):
                suffix = ext
                break

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=tempfile.gettempdir()) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        # 2. Transcribe with faster-whisper (free, local, no API key)
        try:
            if _whisper_model is None:
                raise RuntimeError("faster-whisper not installed. Run: pip install faster-whisper==1.0.3")
            segments, _ = _whisper_model.transcribe(tmp_path, beam_size=5)
            transcript = " ".join(seg.text.strip() for seg in segments)
            call.transcript_text = transcript
            call.transcript_status = "completed"
        except Exception as e:
            call.transcript_status = "failed"
            call.transcript_text = f"Transcription failed: {str(e)}"
        finally:
            os.unlink(tmp_path)

        db.commit()
    except Exception:
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
async def transcribe_call(
    call_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    call = db.query(Call).filter(Call.id == call_id, Call.organization_id == user.organization_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_url:
        raise HTTPException(status_code=400, detail="No recording available for this call")
    if call.transcript_status == "completed":
        return {"status": "completed", "transcript": call.transcript_text}
    if call.transcript_status == "processing":
        return {"status": "processing", "message": "Already in progress. Check back shortly."}

    # Mark processing immediately so double-clicks don't double-queue
    call.transcript_status = "processing"
    db.commit()

    background_tasks.add_task(_run_whisper_sync, call_id, call.recording_url)
    return {"status": "processing", "message": "Transcription started. Refresh in a few seconds."}
