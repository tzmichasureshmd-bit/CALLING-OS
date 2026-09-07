import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from ..database import get_db, SessionLocal
from ..models import User, Device, Employee, SIM
from ..schemas import DeviceRegister, DeviceHeartbeat, DeviceOut
from ..auth import get_current_user
from ..ws_manager import manager

router = APIRouter(prefix="/devices", tags=["devices"])

OFFLINE_AFTER_SECONDS = 90  # mark offline if no heartbeat for 90s


# ── helpers ───────────────────────────────────────────────────────────────────

def _device_payload(d: Device, employee_name: str | None) -> dict:
    """Serialize a Device ORM object to the dict we broadcast over WS."""
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
        "sims": [
            {"id": s.id, "slot": s.slot, "carrier": s.carrier,
             "phone_number": s.phone_number, "status": "active"}
            for s in sims
        ],
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


# ── background offline watcher ────────────────────────────────────────────────

async def _offline_watcher():
    """
    Runs forever. Every 30s checks for devices whose last_seen_at is older
    than OFFLINE_AFTER_SECONDS and marks them is_online=False, then broadcasts.
    """
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
            pass  # never crash the watcher


def start_offline_watcher():
    asyncio.create_task(_offline_watcher())


# ── REST endpoints ────────────────────────────────────────────────────────────

@router.post("/register", response_model=DeviceOut, status_code=201)
def register_device(
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
    db.flush()

    if body.sim_phone_number:
        sim = db.query(SIM).filter(SIM.device_id == device.id, SIM.slot == 1).first()
        if not sim:
            sim = SIM(id=str(uuid.uuid4()), device_id=device.id, slot=1)
            db.add(sim)
        sim.phone_number = body.sim_phone_number
        sim.carrier      = body.sim_carrier or ""

    db.commit()
    db.refresh(device)
    out = DeviceOut.model_validate(device)
    out.employee_name = emp.name
    return out


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
        device.latitude = body.latitude
        device.longitude = body.longitude
        device.location_accuracy = body.location_accuracy
    if body.wifi_ssid is not None:
        device.wifi_ssid = body.wifi_ssid
    db.commit()
    db.refresh(device)

    emp_name = device.employee.name if device.employee else None
    # Broadcast to all web clients watching this org
    await manager.broadcast(
        user.organization_id,
        {"event": "device_update", "device": _device_payload(device, emp_name)},
    )

    return {"status": "ok", "last_seen": device.last_seen_at}


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


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/{org_id}")
async def device_ws(
    websocket: WebSocket,
    org_id: str,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Web dashboard connects here to receive real-time device updates.
    Auth: ?token=<access_token> query param (browsers can't set WS headers).
    """
    from ..auth.jwt import decode_token

    # Validate token
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001)
        return
    if payload.get("organization_id") != org_id:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    manager.connect(org_id, websocket)

    # Send current snapshot immediately on connect
    devices = (
        db.query(Device)
        .filter(Device.organization_id == org_id)
        .all()
    )
    snapshot = [
        _device_payload(d, d.employee.name if d.employee else None)
        for d in devices
    ]
    import json
    await websocket.send_text(json.dumps({"event": "snapshot", "devices": snapshot}))

    try:
        while True:
            # Keep connection alive — client sends ping every 25s
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(org_id, websocket)
