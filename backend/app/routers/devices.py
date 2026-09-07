import uuid
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from ..database import get_db, SessionLocal
from ..models import User, Device, Employee, SIM
from ..schemas import DeviceRegister, DeviceHeartbeat, DeviceOut
from ..schemas.device import SIMSyncItem, SIMOut, SIMChangeEvent
from ..auth import get_current_user
from ..ws_manager import manager

logger = logging.getLogger("callnexa.devices")

router = APIRouter(prefix="/devices", tags=["devices"])

OFFLINE_AFTER_SECONDS = 90


# ── SIM serializer ────────────────────────────────────────────────────────────

def _sim_dict(s: SIM) -> dict:
    return {
        "id":              s.id,
        "slot":            s.slot,
        "carrier":         s.carrier,
        "phone_number":    s.phone_number,
        "mcc":             s.mcc,
        "mnc":             s.mnc,
        "country_iso":     s.country_iso,
        "subscription_id": s.subscription_id,
        "network_type":    s.network_type,
        "is_active":       s.is_active,
        "last_detected_at": s.last_detected_at.isoformat() if s.last_detected_at else None,
    }


# ── Device payload for WebSocket ──────────────────────────────────────────────

def _device_payload(d: Device, employee_name: str | None) -> dict:
    sims = getattr(d, "sims", []) or []
    return {
        "id":                 d.id,
        "employee_id":        d.employee_id,
        "employee_name":      employee_name,
        "device_identifier":  d.device_identifier,
        "manufacturer":       d.manufacturer,
        "model":              d.model,
        "android_version":    d.android_version,
        "app_version":        d.app_version,
        "last_seen_at":       d.last_seen_at.isoformat() if d.last_seen_at else None,
        "battery_level":      d.battery_level,
        "is_online":          d.is_online,
        "permissions_status": d.permissions_status or {},
        "latitude":           d.latitude,
        "longitude":          d.longitude,
        "location_accuracy":  d.location_accuracy,
        "wifi_ssid":          d.wifi_ssid,
        "sims":               [_sim_dict(s) for s in sims],
        "created_at":         d.created_at.isoformat() if d.created_at else None,
    }


# ── SIM upsert helper ─────────────────────────────────────────────────────────

def _upsert_sims(
    db: Session,
    device: Device,
    sim_items: list[SIMSyncItem],
    org_id: str,
) -> list[dict]:
    """
    Upsert SIM records for a device.
    Returns a list of change events (empty if nothing changed).
    Uniqueness: device_id + slot.
    """
    now = datetime.now(timezone.utc)
    changes = []

    for item in sim_items:
        existing = db.query(SIM).filter(
            SIM.device_id == device.id,
            SIM.slot == item.slot,
        ).first()

        if existing:
            # Detect changes
            carrier_changed = (
                item.carrier and existing.carrier and
                item.carrier.strip() != existing.carrier.strip()
            )
            sub_changed = (
                item.subscription_id and existing.subscription_id and
                item.subscription_id != existing.subscription_id
            )

            if carrier_changed or sub_changed:
                change_type = "REPLACED" if sub_changed else "CARRIER_CHANGED"
                changes.append({
                    "device_id":                device.id,
                    "slot":                     item.slot,
                    "change_type":              change_type,
                    "previous_carrier":         existing.carrier,
                    "new_carrier":              item.carrier,
                    "previous_subscription_id": existing.subscription_id,
                    "new_subscription_id":      item.subscription_id,
                    "timestamp":                now.isoformat(),
                })
                logger.info(
                    "SIM change detected device=%s slot=%d type=%s %s→%s",
                    device.id, item.slot, change_type,
                    existing.carrier, item.carrier,
                )

            # Update all fields
            if item.carrier        is not None: existing.carrier         = item.carrier
            if item.phone_number   is not None: existing.phone_number    = item.phone_number
            if item.mcc            is not None: existing.mcc             = item.mcc
            if item.mnc            is not None: existing.mnc             = item.mnc
            if item.country_iso    is not None: existing.country_iso     = item.country_iso
            if item.subscription_id is not None: existing.subscription_id = item.subscription_id
            if item.network_type   is not None: existing.network_type    = item.network_type
            existing.is_active       = item.is_active
            existing.last_detected_at = now
            existing.updated_at      = now

        else:
            # New SIM slot
            sim = SIM(
                id=str(uuid.uuid4()),
                device_id=device.id,
                slot=item.slot,
                carrier=item.carrier,
                phone_number=item.phone_number,
                mcc=item.mcc,
                mnc=item.mnc,
                country_iso=item.country_iso,
                subscription_id=item.subscription_id,
                network_type=item.network_type,
                is_active=item.is_active,
                first_detected_at=now,
                last_detected_at=now,
            )
            db.add(sim)
            changes.append({
                "device_id":    device.id,
                "slot":         item.slot,
                "change_type":  "INSERTED",
                "new_carrier":  item.carrier,
                "new_subscription_id": item.subscription_id,
                "timestamp":    now.isoformat(),
            })

    # Mark SIMs not in the current inventory as inactive
    current_slots = {item.slot for item in sim_items}
    for existing_sim in (getattr(device, "sims", []) or []):
        if existing_sim.slot not in current_slots and existing_sim.is_active:
            existing_sim.is_active = False
            existing_sim.updated_at = now
            changes.append({
                "device_id":   device.id,
                "slot":        existing_sim.slot,
                "change_type": "REMOVED",
                "previous_carrier": existing_sim.carrier,
                "timestamp":   now.isoformat(),
            })

    return changes


def _build_sim_items_from_legacy(body: DeviceRegister) -> list[SIMSyncItem]:
    """Convert legacy sim_phone_number/sim_carrier fields to SIMSyncItem list."""
    if body.sims:
        return body.sims
    if body.sim_phone_number or body.sim_carrier:
        return [SIMSyncItem(
            slot=1,
            carrier=body.sim_carrier,
            phone_number=body.sim_phone_number,
            is_active=True,
        )]
    return []


# ── Background offline watcher ────────────────────────────────────────────────

async def _offline_watcher():
    while True:
        await asyncio.sleep(30)
        try:
            db: Session = SessionLocal()
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=OFFLINE_AFTER_SECONDS)
            stale = (
                db.query(Device)
                .filter(Device.is_online == True, Device.last_seen_at < cutoff)
                .all()
            )
            for d in stale:
                d.is_online = False
            if stale:
                db.commit()
                for d in stale:
                    db.refresh(d)
                    emp_name = d.employee.name if d.employee else None
                    await manager.broadcast(
                        d.organization_id,
                        {"event": "device_update", "device": _device_payload(d, emp_name)},
                    )
            db.close()
        except Exception:
            pass


def start_offline_watcher():
    asyncio.create_task(_offline_watcher())


# ── Register device ───────────────────────────────────────────────────────────

@router.post("/register", response_model=DeviceOut, status_code=201)
async def register_device(
    body: DeviceRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(
        Employee.user_id == user.id,
        Employee.organization_id == user.organization_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile linked to this user")

    device = db.query(Device).filter(
        Device.organization_id == user.organization_id,
        Device.device_identifier == body.device_identifier,
    ).first()

    if not device:
        device = Device(
            id=str(uuid.uuid4()),
            organization_id=user.organization_id,
            employee_id=emp.id,
            device_identifier=body.device_identifier,
        )
        db.add(device)

    device.manufacturer    = body.manufacturer
    device.model           = body.model
    device.android_version = body.android_version
    device.app_version     = body.app_version
    device.last_seen_at    = datetime.now(timezone.utc)
    device.is_online       = True
    db.flush()  # ensure device.id is set before SIM upsert

    # Upsert full SIM inventory
    sim_items = _build_sim_items_from_legacy(body)
    changes = []
    if sim_items:
        changes = _upsert_sims(db, device, sim_items, user.organization_id)

    db.commit()
    db.refresh(device)

    # Broadcast device update + any SIM changes
    emp_name = emp.name
    await manager.broadcast(
        user.organization_id,
        {"event": "device_update", "device": _device_payload(device, emp_name)},
    )
    for change in changes:
        await manager.broadcast(
            user.organization_id,
            {"event": "sim_changed", **change},
        )

    out = DeviceOut.model_validate(device)
    out.employee_name = emp_name
    return out


# ── Heartbeat ─────────────────────────────────────────────────────────────────

@router.post("/{device_id}/heartbeat")
async def heartbeat(
    device_id: str,
    body: DeviceHeartbeat,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == user.organization_id,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.last_seen_at = datetime.now(timezone.utc)
    device.is_online    = body.is_online
    if body.battery_level is not None:
        device.battery_level = body.battery_level
    if body.permissions_status:
        device.permissions_status = body.permissions_status
    if body.app_version:
        device.app_version = body.app_version
    if body.latitude is not None:
        device.latitude          = body.latitude
        device.longitude         = body.longitude
        device.location_accuracy = body.location_accuracy
    if body.wifi_ssid is not None:
        device.wifi_ssid = body.wifi_ssid

    # Update SIM inventory if provided
    changes = []
    if body.sims:
        changes = _upsert_sims(db, device, body.sims, user.organization_id)

    db.commit()
    db.refresh(device)

    emp_name = device.employee.name if device.employee else None
    await manager.broadcast(
        user.organization_id,
        {"event": "device_update", "device": _device_payload(device, emp_name)},
    )
    for change in changes:
        await manager.broadcast(
            user.organization_id,
            {"event": "sim_changed", **change},
        )

    return {"status": "ok", "last_seen": device.last_seen_at}


# ── Dedicated SIM sync endpoint ───────────────────────────────────────────────

@router.post("/{device_id}/sims/sync")
async def sync_sims(
    device_id: str,
    sims: list[SIMSyncItem],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for SIM inventory synchronization.
    Called when SIM change is detected on the mobile app.
    """
    device = db.query(Device).filter(
        Device.id == device_id,
        Device.organization_id == user.organization_id,
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    changes = _upsert_sims(db, device, sims, user.organization_id)
    db.commit()
    db.refresh(device)

    emp_name = device.employee.name if device.employee else None
    await manager.broadcast(
        user.organization_id,
        {"event": "device_update", "device": _device_payload(device, emp_name)},
    )
    for change in changes:
        await manager.broadcast(
            user.organization_id,
            {"event": "sim_changed", **change},
        )

    return {
        "status": "ok",
        "changes": len(changes),
        "sims": [_sim_dict(s) for s in (getattr(device, "sims", []) or [])],
    }


# ── List devices ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[DeviceOut])
def list_devices(
    employee_id: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import joinedload
    query = (
        db.query(Device)
        .options(joinedload(Device.employee))
        .filter(Device.organization_id == user.organization_id)
    )
    if employee_id:
        query = query.filter(Device.employee_id == employee_id)
    result = []
    for d in query.all():
        out = DeviceOut.model_validate(d)
        out.employee_name = d.employee.name if d.employee else None
        result.append(out)
    return result


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/{org_id}")
async def device_ws(
    websocket: WebSocket,
    org_id: str,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    from ..auth.jwt import decode_token
    import json

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return
    if payload.get("org") != org_id:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    manager.connect(org_id, websocket)

    devices = db.query(Device).filter(Device.organization_id == org_id).all()
    snapshot = [_device_payload(d, d.employee.name if d.employee else None) for d in devices]
    await websocket.send_text(json.dumps({"event": "snapshot", "devices": snapshot}))

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(org_id, websocket)


# ── SSE fallback ──────────────────────────────────────────────────────────────

@router.get("/sse/{org_id}")
async def device_sse(
    org_id: str,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    import json
    from ..auth.jwt import decode_token

    payload = decode_token(token)
    if not payload or payload.get("org") != org_id:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    queue: asyncio.Queue = asyncio.Queue()

    class QueueAdapter:
        async def send_text(self, text: str):
            await queue.put(text)
        async def close(self, code=None):
            await queue.put(None)

    adapter = QueueAdapter()
    manager.connect(org_id, adapter)

    devices_snap = db.query(Device).filter(Device.organization_id == org_id).all()
    snapshot_data = json.dumps({"event": "snapshot", "devices": [
        _device_payload(d, d.employee.name if d.employee else None)
        for d in devices_snap
    ]})

    async def event_stream():
        yield f"data: {snapshot_data}\n\n"
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=25)
                    if msg is None:
                        break
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            manager.disconnect(org_id, adapter)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
