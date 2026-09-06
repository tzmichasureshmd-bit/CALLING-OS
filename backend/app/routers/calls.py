import uuid
import math
import re
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from datetime import datetime, timezone
from ..database import get_db
from ..models import User, Call, Device, Employee
from ..schemas import CallSyncRequest, CallSyncResponse, CallOut, PaginatedCalls
from ..auth import get_current_user
from ..config import settings

router = APIRouter(prefix="/calls", tags=["calls"])


def normalize_phone(phone: str) -> str:
    """Normalize to +91XXXXXXXXXX format. Strips all non-digit chars first."""
    # Only allow digits and leading +
    cleaned = re.sub(r"[^\d+]", "", phone.strip())[:15]  # E.164 max 15 digits
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    return f"+{digits}" if not phone.startswith("+") else cleaned


@router.post("/sync", response_model=CallSyncResponse)
def sync_calls(
    body: CallSyncRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify device belongs to this org
    device = db.query(Device).filter(
        Device.id == body.device_id,
        Device.organization_id == user.organization_id,
    ).first()
    if not device:
        raise HTTPException(status_code=400, detail="Device not found in your organization")

    accepted = duplicates = failed = 0

    for item in body.calls:
        # Idempotency check
        exists = db.query(Call).filter(
            Call.organization_id == user.organization_id,
            Call.client_event_id == item.client_event_id,
        ).first()
        if exists:
            duplicates += 1
            continue

        try:
            call = Call(
                client_event_id=item.client_event_id,
                organization_id=user.organization_id,
                employee_id=device.employee_id,
                device_id=device.id,
                phone_number=item.phone_number,
                phone_number_normalized=normalize_phone(item.phone_number),
                contact_name=item.contact_name or "Unknown",
                call_type=item.call_type,
                call_status="connected" if item.duration_seconds > 0 else "missed",
                start_time=item.start_time,
                end_time=item.end_time,
                duration_seconds=item.duration_seconds,
                sim_slot=item.sim_slot,
                source=item.source,
                recording_available=item.recording_available,
                sync_status="synced",
            )
            db.add(call)
            accepted += 1
        except Exception:
            failed += 1

    # Update device heartbeat
    device.last_seen_at = datetime.now(timezone.utc)
    device.is_online = True

    db.commit()
    return CallSyncResponse(accepted=accepted, duplicates=duplicates, failed=failed, total=len(body.calls))


@router.get("", response_model=PaginatedCalls)
def list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    employee_id: str = Query(None),
    device_id: str = Query(None),
    call_type: str = Query(None),
    q: str = Query(None),                     # search phone or contact
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
    calls = query.order_by(Call.start_time.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for c in calls:
        out = CallOut.model_validate(c)
        out.employee_name = c.employee.name if c.employee else None
        out.device_model = c.device.model if c.device else None
        items.append(out)

    return PaginatedCalls(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.post("/{call_id}/recording")
async def upload_recording(
    call_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Upload to Supabase Storage
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Storage not configured")

    import httpx
    content = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "mp4"
    storage_path = f"{user.organization_id}/{call_id}.{ext}"
    storage_url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            storage_url,
            content=content,
            headers={
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": file.content_type or "audio/mp4",
                "x-upsert": "true",
            },
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {resp.text}")

    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_RECORDINGS_BUCKET}/{storage_path}"
    call.recording_url = public_url
    call.recording_available = True
    call.recording_size_bytes = len(content)
    db.commit()
    return {"recording_url": public_url, "size_bytes": len(content)}


@router.get("/{call_id}", response_model=CallOut)
def get_call(
    call_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    call = db.query(Call).filter(
        Call.id == call_id,
        Call.organization_id == user.organization_id,
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    out = CallOut.model_validate(call)
    out.employee_name = call.employee.name if call.employee else None
    out.device_model = call.device.model if call.device else None
    return out
