import math
import re
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import User, Call, Device, Employee, SIM
from ..schemas import CallSyncRequest, CallSyncResponse, CallOut, PaginatedCalls
from ..schemas.call import CallSyncItemResult
from ..auth import get_current_user, require_role
from ..config import settings
from ..ws_manager import manager
from .. import audit
from ..models.call import RECORDING_STATUS_NOT_AVAILABLE, RECORDING_STATUS_UPLOADED

logger = logging.getLogger("callnexa.calls")

router = APIRouter(prefix="/calls", tags=["calls"])

# ── constants ─────────────────────────────────────────────────────────────────
ALLOWED_AUDIO_MIME = {
    "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav",
    "audio/aac", "audio/webm", "audio/x-m4a", "audio/3gpp",
    "audio/amr", "video/mp4",   # some recorders save as video/mp4
}
ALLOWED_AUDIO_EXT = {"mp4", "mp3", "ogg", "wav", "aac", "webm", "m4a", "3gp", "amr"}
MAX_RECORDING_BYTES = 200 * 1024 * 1024   # 200 MB hard limit

VALID_CALL_TYPES = {"incoming", "outgoing", "missed", "rejected"}


# ── helpers ───────────────────────────────────────────────────────────────────

def normalize_phone(phone: str) -> str:
    """Normalize to +91XXXXXXXXXX. Returns original if pattern unrecognised."""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())[:16]
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    return f"+{digits}" if not phone.startswith("+") else cleaned


def _call_out(c: Call) -> CallOut:
    out = CallOut.model_validate(c)
    out.employee_name = c.employee.name if c.employee else None
    out.device_model  = c.device.model  if c.device  else None
    return out


def _resolve_sim_id(db: Session, device_id: str, sim_slot: int | None, subscription_id: str | None) -> str | None:
    """
    Resolve the SIM database record ID from slot or subscription_id.
    Prefers subscription_id match (more reliable), falls back to slot.
    Returns None if no match found.
    """
    if not device_id:
        return None
    if subscription_id:
        sim = db.query(SIM).filter(
            SIM.device_id == device_id,
            SIM.subscription_id == subscription_id,
        ).first()
        if sim:
            return sim.id
    if sim_slot is not None:
        sim = db.query(SIM).filter(
            SIM.device_id == device_id,
            SIM.slot == sim_slot,
        ).first()
        if sim:
            return sim.id
    return None


async def _get_signed_url(storage_path: str) -> str | None:
    """Generate a short-lived signed URL from Supabase Storage (60 min)."""
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
                # signedURL may be relative — make absolute
                if signed.startswith("/"):
                    return f"{settings.SUPABASE_URL}{signed}"
                return signed
    except Exception as exc:
        logger.warning("Signed URL generation failed for %s: %s", storage_path, exc)
    return None


# ── sync ──────────────────────────────────────────────────────────────────────

@router.post("/sync", response_model=CallSyncResponse)
async def sync_calls(
    body: CallSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import timedelta
    from sqlalchemy import text as sa_text

    # 1. Verify device belongs to this org
    device = db.query(Device).filter(
        Device.id == body.device_id,
        Device.organization_id == user.organization_id,
    ).first()
    if not device:
        raise HTTPException(status_code=400, detail="Device not found in your organization")

    accepted = duplicates = failed = 0
    new_call_ids: list[str] = []
    results: list[CallSyncItemResult] = []
    now_utc = datetime.now(timezone.utc)

    for item in body.calls:
        # 2. Idempotency check
        exists = db.query(Call).filter(
            Call.organization_id == user.organization_id,
            Call.client_event_id == item.client_event_id,
        ).first()
        if exists:
            duplicates += 1
            results.append(CallSyncItemResult(
                client_event_id=item.client_event_id,
                call_id=exists.id,
                status="duplicate",
                sync_status="synced",
                recording_status="uploaded" if exists.recording_available else "not_available",
                transcript_status=exists.transcript_status,
            ))
            continue

        # 3. Sanitize
        call_type = item.call_type if item.call_type in VALID_CALL_TYPES else "incoming"
        duration = max(0, item.duration_seconds or 0)

        if call_type == "missed":             call_status = "missed"
        elif call_type == "rejected":         call_status = "rejected"
        elif call_type == "outgoing" and duration == 0: call_status = "no_answer"
        elif duration > 0:                    call_status = "connected"
        else:                                 call_status = "unknown"

        # 4. Timestamps
        start = item.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        end = item.end_time
        if end and end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        if start > now_utc + timedelta(minutes=5):
            logger.warning("[SYNC] %s rejected: future timestamp", item.client_event_id)
            failed += 1
            results.append(CallSyncItemResult(
                client_event_id=item.client_event_id,
                status="failed", sync_status="failed",
                recording_status="not_available", error="future_timestamp",
            ))
            continue

        # 5. Resolve SIM + source
        resolved_sim_id = _resolve_sim_id(db, device.id, item.sim_slot, item.subscription_id)
        source = item.source or (f"SIM {item.sim_slot}" if item.sim_slot else "UNKNOWN")

        # 6. INSERT using ORM — generate ID explicitly to avoid server_default issues
        call_id = db.execute(sa_text("SELECT generate_prefixed_id('tzm','cal')")).scalar()
        call = Call(
            id=call_id,
            client_event_id=item.client_event_id,
            organization_id=user.organization_id,
            employee_id=device.employee_id,
            device_id=device.id,
            sim_id=resolved_sim_id,
            phone_number=item.phone_number or "unknown",
            phone_number_normalized=normalize_phone(item.phone_number or ""),
            contact_name=item.contact_name or "Unknown",
            call_type=call_type,
            call_status=call_status,
            start_time=start,
            end_time=end,
            duration_seconds=duration,
            sim_slot=item.sim_slot,
            subscription_id=item.subscription_id,
            source=source,
            recording_available=False,
            recording_status=RECORDING_STATUS_NOT_AVAILABLE,
            sync_status="synced",
        )
        db.add(call)
        new_call_ids.append(call_id)
        accepted += 1
        logger.info("[SYNC] queued %s -> %s", item.client_event_id, call_id)
        results.append(CallSyncItemResult(
            client_event_id=item.client_event_id,
            call_id=call_id,
            status="accepted",
            sync_status="synced",
            recording_status=RECORDING_STATUS_NOT_AVAILABLE,
        ))

    # 7. Update device + audit + commit everything at once
    device.last_seen_at = datetime.now(timezone.utc)
    device.is_online = True

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.CALL_SYNC,
        actor=user,
        resource="call",
        metadata={"accepted": accepted, "duplicates": duplicates, "failed": failed,
                  "device_id": body.device_id},
        request=request,
    )

    db.commit()
    logger.info("[SYNC] committed: accepted=%d dup=%d failed=%d", accepted, duplicates, failed)

    # 8. Broadcast to web dashboard
    if accepted > 0:
        try:
            await manager.broadcast(
                user.organization_id,
                {"event": "calls_synced", "accepted": accepted,
                 "device_id": body.device_id, "employee_id": device.employee_id},
            )
        except Exception as exc:
            logger.warning("[SYNC] WS broadcast failed: %s", exc)

    return CallSyncResponse(
        accepted=accepted, duplicates=duplicates, failed=failed,
        total=len(body.calls), results=results,
    )


# ── list calls ────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedCalls)
def list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    employee_id: str = Query(None),
    device_id: str = Query(None),
    call_type: str = Query(None),
    q: str = Query(None),
    from_date: datetime = Query(None),
    to_date: datetime = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        db.query(Call)
        .options(joinedload(Call.employee), joinedload(Call.device))
        .filter(Call.organization_id == user.organization_id)
    )

    # RBAC: employees only see their own calls
    if user.role == "EMPLOYEE":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if emp:
            query = query.filter(Call.employee_id == emp.id)
        else:
            return PaginatedCalls(items=[], total=0, page=page, page_size=page_size, total_pages=1)

    if employee_id:
        query = query.filter(Call.employee_id == employee_id)
    if device_id:
        query = query.filter(Call.device_id == device_id)
    if call_type:
        query = query.filter(Call.call_type == call_type)
    if q:
        query = query.filter(
            (Call.phone_number.ilike(f"%{q}%")) |
            (Call.contact_name.ilike(f"%{q}%"))
        )
    if from_date:
        query = query.filter(Call.start_time >= from_date)
    if to_date:
        query = query.filter(Call.start_time <= to_date)

    total = query.count()
    calls = (
        query.order_by(Call.start_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedCalls(
        items=[_call_out(c) for c in calls],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ── get single call ───────────────────────────────────────────────────────────

@router.get("/{call_id}", response_model=CallOut)
def get_call(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Call).options(
        joinedload(Call.employee), joinedload(Call.device)
    ).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    )
    # Employees can only view their own calls
    if user.role == "EMPLOYEE":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if emp:
            q = q.filter(Call.employee_id == emp.id)
    call = q.first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.CALL_VIEW,
        actor=user,
        resource="call",
        resource_id=call_id,
        request=request,
    )
    db.commit()
    return _call_out(call)


# ── recording upload ──────────────────────────────────────────────────────────

@router.post("/{call_id}/recording")
async def upload_recording(
    call_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Only ADMINs or the employee who owns the call may upload
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # If EMPLOYEE, verify they own this call
    if user.role == "EMPLOYEE":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not emp or call.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Not authorized to upload recording for this call")

    # ── File validation ───────────────────────────────────────────────────────
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in ALLOWED_AUDIO_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    raw_ext = ""
    if file.filename and "." in file.filename:
        raw_ext = file.filename.rsplit(".", 1)[-1].lower()
    if raw_ext and raw_ext not in ALLOWED_AUDIO_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {raw_ext}")

    ext = raw_ext if raw_ext in ALLOWED_AUDIO_EXT else "mp4"

    # Read with size limit
    content = await file.read(MAX_RECORDING_BYTES + 1)
    if len(content) > MAX_RECORDING_BYTES:
        raise HTTPException(status_code=413, detail="Recording file exceeds 200 MB limit")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Recording file is empty")

    # ── Storage ───────────────────────────────────────────────────────────────
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Storage not configured")

    import httpx
    # Path: org_id/call_id.ext  — no user-controlled path components
    storage_path = f"{user.organization_id}/{call_id}.{ext}"
    storage_url = (
        f"{settings.SUPABASE_URL}/storage/v1/object"
        f"/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"
    )

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            storage_url,
            content=content,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": content_type or "audio/mp4",
                "x-upsert": "true",
            },
        )
    if resp.status_code not in (200, 201):
        logger.error("Supabase upload failed %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Storage upload failed")

    # Store path only — NOT a public URL
    call.recording_url           = storage_path
    call.recording_available     = True
    call.recording_status        = RECORDING_STATUS_UPLOADED
    call.recording_size_bytes    = len(content)
    call.recording_mime_type     = content_type or "audio/mp4"
    call.recording_uploaded_at   = datetime.now(timezone.utc)
    call.recording_error         = None
    # Auto-queue transcription — do not require manual trigger
    if call.transcript_status not in ("processing", "completed"):
        call.transcript_status = "pending"

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.RECORDING_UPLOAD,
        actor=user,
        resource="call",
        resource_id=call_id,
        metadata={"size_bytes": len(content), "ext": ext},
        request=request,
    )
    db.commit()

    # Auto-trigger transcription in background — no manual button needed
    from .transcripts import _run_whisper_sync
    background_tasks.add_task(_run_whisper_sync, call_id, storage_path, user.organization_id)

    # Broadcast recording available event
    try:
        await manager.broadcast(
            user.organization_id,
            {"event": "recording_uploaded", "call_id": call_id,
             "recording_status": "uploaded", "transcript_status": "processing"},
        )
    except Exception:
        pass

    return {"status": "uploaded", "size_bytes": len(content)}


# ── signed playback URL ───────────────────────────────────────────────────────

@router.get("/{call_id}/recording-url")
async def get_recording_url(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """
    Generate a short-lived signed URL for recording playback.
    Only ADMINs of the owning organization may access.
    """
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_available or not call.recording_url:
        raise HTTPException(status_code=404, detail="No recording available for this call")

    signed = await _get_signed_url(call.recording_url)
    if not signed:
        raise HTTPException(status_code=503, detail="Could not generate playback URL")

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.RECORDING_ACCESS,
        actor=user,
        resource="call",
        resource_id=call_id,
        request=request,
    )
    db.commit()

    return {"signed_url": signed, "expires_in": 3600}
