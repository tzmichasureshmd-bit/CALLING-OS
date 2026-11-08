import math
import re
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, BackgroundTasks
from sqlalchemy.exc import IntegrityError
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
from ..phone import normalize_phone

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


def _has_supported_audio_signature(header: bytes, extension: str) -> bool:
    """Conservative magic-byte check before private storage upload."""
    if extension in {"mp4", "m4a", "3gp"}:
        return len(header) >= 12 and header[4:8] == b"ftyp"
    if extension == "wav":
        return header.startswith(b"RIFF") and header[8:12] == b"WAVE"
    if extension == "ogg":
        return header.startswith(b"OggS")
    if extension == "webm":
        return header.startswith(b"\x1aE\xdf\xa3")
    if extension == "amr":
        return header.startswith((b"#!AMR\n", b"#!AMR-WB\n"))
    if extension == "mp3":
        return header.startswith(b"ID3") or (
            len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0
        )
    if extension == "aac":
        return len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xF6) == 0xF0
    return False


# ── helpers ───────────────────────────────────────────────────────────────────


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
    
    try:
        # 1. Verify device belongs to this org
        device = db.query(Device).filter(
            Device.id == body.device_id,
            Device.organization_id == user.organization_id,
        ).first()
        if not device:
            logger.error("[SYNC] Device not found: device_id=%s org=%s", body.device_id, user.organization_id)
            raise HTTPException(status_code=400, detail="Device not found in your organization")

        # An employee may only upload calls through their own registered device.
        # Organization scope alone is insufficient because it would allow call
        # attribution to another employee in the same company.
        if (user.role or "").upper() == "EMPLOYEE":
            employee = db.query(Employee).filter(
                Employee.user_id == user.id,
                Employee.organization_id == user.organization_id,
                Employee.status == "active",
            ).first()
            if not employee or device.employee_id != employee.id:
                raise HTTPException(status_code=403, detail="Device is not assigned to this employee")

        accepted = duplicates = failed = 0
        new_call_ids: list[str] = []
        results: list[CallSyncItemResult] = []
        now_utc = datetime.now(timezone.utc)

        for item in body.calls:
            # 2. Idempotency check
            exists = db.query(Call).filter(
                Call.organization_id == user.organization_id,
                Call.device_id == device.id,
                Call.client_event_id == item.client_event_id,
            ).first()
            if exists:
                duplicates += 1
                exists.sync_confirmed_at = now_utc
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

            # 6. INSERT inside a savepoint. The database unique index is the
            # concurrency authority; if another request commits the same
            # device event first, convert that race into a duplicate ACK.
            call_id = "tzm-cal-" + uuid.uuid4().hex[:12]
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
                sync_confirmed_at=now_utc,
                updated_at=now_utc,
            )
            try:
                with db.begin_nested():
                    db.add(call)
                    db.flush()
            except IntegrityError:
                exists = db.query(Call).filter(
                    Call.organization_id == user.organization_id,
                    Call.device_id == device.id,
                    Call.client_event_id == item.client_event_id,
                ).first()
                if exists:
                    duplicates += 1
                    exists.sync_confirmed_at = now_utc
                    results.append(CallSyncItemResult(
                        client_event_id=item.client_event_id,
                        call_id=exists.id,
                        status="duplicate",
                        sync_status="synced",
                        recording_status="uploaded" if exists.recording_available else "not_available",
                        transcript_status=exists.transcript_status,
                    ))
                else:
                    failed += 1
                    logger.exception("[SYNC] insert rejected for event=%s", item.client_event_id)
                    results.append(CallSyncItemResult(
                        client_event_id=item.client_event_id,
                        status="failed",
                        sync_status="failed",
                        error="database_rejected",
                    ))
                continue

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
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[SYNC] Unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Call synchronization failed")


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
        emp = db.query(Employee).filter(
            Employee.user_id == user.id,
            Employee.organization_id == user.organization_id,
            Employee.status == "active",
        ).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Call not found")
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

    # Organization admins may upload any organization call. Other roles must
    # own the call through an active employee profile.
    if (user.role or "").upper() not in {"ADMIN", "SUPER_ADMIN"}:
        emp = db.query(Employee).filter(
            Employee.user_id == user.id,
            Employee.organization_id == user.organization_id,
            Employee.status == "active",
        ).first()
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

    # Validate size without retaining the entire recording in memory.
    file_size = 0
    header = b""
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        if len(header) < 16:
            header = (header + chunk)[:16]
        file_size += len(chunk)
        if file_size > MAX_RECORDING_BYTES:
            raise HTTPException(status_code=413, detail="Recording file exceeds 200 MB limit")
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Recording file is empty")
    if not _has_supported_audio_signature(header, ext):
        raise HTTPException(status_code=400, detail="File content does not match a supported recording format")
    await file.seek(0)

    logger.info("[RECORDING_UPLOAD_STARTED] call_id=%s size=%d ext=%s org=%s",
                call_id, file_size, ext, user.organization_id)

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

    async def recording_chunks():
        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            yield chunk

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            storage_url,
            content=recording_chunks(),
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": content_type or "audio/mp4",
                "Content-Length": str(file_size),
                "x-upsert": "true",
            },
        )
    if resp.status_code not in (200, 201):
        logger.error("Supabase upload failed with status %s", resp.status_code)
        raise HTTPException(status_code=502, detail="Storage upload failed")

    # Re-read and lock only for the short DB state transition. This prevents two
    # concurrent uploads from both scheduling transcription.
    db.expire_all()
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).with_for_update().first()
    if not call:
        await _delete_recording_object(storage_path)
        raise HTTPException(status_code=404, detail="Call not found")

    old_storage_path = call.recording_url
    already_uploaded = call.recording_available
    should_transcribe = call.transcript_status not in ("processing", "completed")
    now = datetime.now(timezone.utc)

    call.recording_url           = storage_path
    call.recording_available     = True
    call.recording_status        = RECORDING_STATUS_UPLOADED
    call.recording_size_bytes    = file_size
    call.recording_mime_type     = content_type or "audio/mp4"
    call.recording_uploaded_at   = now
    call.recording_error         = None
    if should_transcribe:
        call.transcript_status = "processing"
        call.transcription_started_at = now
        call.transcript_error = None

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.RECORDING_UPLOAD,
        actor=user,
        resource="call",
        resource_id=call_id,
        metadata={"size_bytes": file_size, "ext": ext, "duplicate": already_uploaded},
        request=request,
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        if not already_uploaded:
            await _delete_recording_object(storage_path)
        raise

    logger.info(
        "[RECORDING_UPLOAD_CONFIRMED] call_id=%s size=%d ext=%s duplicate=%s",
        call_id, file_size, ext, already_uploaded,
    )

    if old_storage_path and old_storage_path != storage_path:
        if not await _delete_recording_object(old_storage_path):
            logger.warning("Old recording object cleanup failed for call_id=%s", call_id)

    if should_transcribe:
        from .transcripts import _run_whisper_sync
        background_tasks.add_task(_run_whisper_sync, call_id, storage_path, user.organization_id)

    try:
        await manager.broadcast(
            user.organization_id,
            {"event": "recording_uploaded", "call_id": call_id,
             "recording_status": "uploaded", "transcript_status": call.transcript_status},
        )
    except Exception:
        logger.warning("Recording dashboard broadcast failed for call_id=%s", call_id)

    return {
        "status": "uploaded",
        "call_id": call_id,
        "recording_available": True,
        "recording_status": "uploaded",
        "transcript_status": call.transcript_status,
        "size_bytes": file_size,
    }


# ── privacy classification ───────────────────────────────────────────────────

from pydantic import BaseModel as _PydanticBase

VALID_PRIVACY_VALUES = {"unclassified", "business", "personal"}


async def _delete_recording_object(storage_path: str) -> bool:
    """Delete one private storage object; never log the private path or credentials."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return False
    import httpx

    url = (
        f"{settings.SUPABASE_URL}/storage/v1/object"
        f"/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"
    )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(
                url,
                headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"},
            )
        return response.status_code in (200, 204, 404)
    except Exception:
        logger.exception("Recording storage deletion failed")
        return False


def _clear_recording_and_ai(call: Call, *, clear_storage_path: bool) -> None:
    if clear_storage_path:
        call.recording_url = None
    call.recording_available = False
    call.recording_status = RECORDING_STATUS_NOT_AVAILABLE
    call.recording_size_bytes = None
    call.recording_mime_type = None
    call.recording_uploaded_at = None
    call.recording_error = None
    call.transcript_status = None
    call.transcript_text = None
    call.transcript_error = None
    call.transcription_started_at = None
    call.transcription_completed_at = None
    call.summary_status = None
    call.summary_text = None
    call.summary_data = None
    call.summary_error = None


class _PrivacyBody(_PydanticBase):
    call_privacy: str


@router.patch("/{call_id}/privacy")
async def set_call_privacy(
    call_id: str,
    body: _PrivacyBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Set an optional dashboard label for a call.

    Labels are informational only. The explicit mobile Call Recording setting
    controls capture; changing a label never removes an uploaded recording,
    transcript, or summary.
    """
    if body.call_privacy not in VALID_PRIVACY_VALUES:
        raise HTTPException(status_code=422, detail=f"call_privacy must be one of: {', '.join(sorted(VALID_PRIVACY_VALUES))}")

    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).with_for_update().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Employees may only classify their own calls
    if user.role == "EMPLOYEE":
        emp = db.query(Employee).filter(Employee.user_id == user.id).first()
        if not emp or call.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Not authorized to classify this call")

    old_privacy = call.call_privacy
    call.call_privacy = body.call_privacy
    call.updated_at = datetime.now(timezone.utc)
    cleanup_state = "not_applicable"

    audit.log(
        db,
        organization_id=user.organization_id,
        action="call.privacy_set",
        actor=user,
        resource="call",
        resource_id=call_id,
        metadata={"old": old_privacy, "new": body.call_privacy, "recording_cleanup": cleanup_state},
        request=request,
    )
    db.commit()
    logger.info("[PRIVACY_SET] call_id=%s old=%s new=%s cleanup=%s org=%s", call_id, old_privacy, body.call_privacy, cleanup_state, user.organization_id)
    return {
        "call_id": call_id,
        "call_privacy": call.call_privacy,
        "recording_cleanup": cleanup_state,
    }


# ── delete recording (authorized, user-requested removal) ───────────────────

@router.delete("/{call_id}/recording", status_code=204)
async def delete_recording(
    call_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """
    Delete a recording from storage and clear all associated transcript/summary data.
    Only ADMINs of the owning organization may delete.
    """
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_url:
        raise HTTPException(status_code=404, detail="No recording to delete")

    storage_path = call.recording_url
    if not await _delete_recording_object(storage_path):
        # Keep the private pointer so deletion can be retried. Never claim
        # success or erase evidence while the storage object may still exist.
        raise HTTPException(status_code=502, detail="Recording deletion failed; retry required")

    _clear_recording_and_ai(call, clear_storage_path=True)
    call.updated_at = datetime.now(timezone.utc)

    audit.log(
        db,
        organization_id=user.organization_id,
        action="recording.delete",
        actor=user,
        resource="call",
        resource_id=call_id,
        metadata={"call_privacy": call.call_privacy},
        request=request,
    )
    db.commit()
    logger.info("[RECORDING_DELETED] call_id=%s org=%s", call_id, user.organization_id)
    from fastapi import Response as _Resp
    return _Resp(status_code=204)


# ── note / progress update ───────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel
from fastapi import BackgroundTasks as _BG

VALID_PROGRESS_STATUSES = {
    "interested", "asked_details", "follow_up", "callback",
    "proposal_sent", "converted", "not_interested",
    # call-derived statuses (set by sync, not by user)
    "connected", "missed", "rejected", "no_answer", "unknown",
}
MAX_NOTES_LENGTH = 2000


class _NoteBody(_BaseModel):
    call_status: str | None = None
    notes: str | None = None


@router.patch("/{call_id}/note")
async def update_call_note(
    call_id: str,
    body: _NoteBody,
    background_tasks: _BG,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Save salesperson progress (status + notes) on the call row."""
    logger.info("[BACKEND_NOTE_UPDATE] call_id=%s org=%s", call_id, user.organization_id)

    # Validate status
    if body.call_status is not None and body.call_status not in VALID_PROGRESS_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status: {body.call_status}")

    # Validate notes length
    if body.notes is not None and len(body.notes) > MAX_NOTES_LENGTH:
        raise HTTPException(status_code=422, detail=f"Notes must be {MAX_NOTES_LENGTH} characters or fewer")

    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if (user.role or "").upper() == "EMPLOYEE":
        emp = db.query(Employee).filter(
            Employee.user_id == user.id,
            Employee.organization_id == user.organization_id,
            Employee.status == "active",
        ).first()
        if not emp or call.employee_id != emp.id:
            raise HTTPException(status_code=404, detail="Call not found")

    if body.call_status is not None:
        call.call_status = body.call_status
    if body.notes is not None:
        call.notes = body.notes
    now = datetime.now(timezone.utc)
    call.updated_at = now

    # Commit BEFORE broadcasting — WebSocket event only fires after DB success
    db.commit()
    logger.info("[BACKEND_NOTE_UPDATE_CONFIRMED] call_id=%s status=%s ts=%s",
                call_id, call.call_status, now.isoformat())

    org_id  = user.organization_id
    payload = {
        "event":       "call_updated",
        "call_id":     call_id,
        "call_status": call.call_status,
        "notes":       call.notes,
        "updated_at":  now.isoformat(),
    }
    background_tasks.add_task(manager.broadcast, org_id, payload)

    return {
        "status": "success",
        "call": {
            "id":          call_id,
            "call_status": call.call_status,
            "notes":       call.notes,
            "updated_at":  now.isoformat(),
        },
    }


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
