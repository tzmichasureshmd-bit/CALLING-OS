import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..database import get_db
from ..models import User, Device, Employee, SIM
from ..schemas import DeviceRegister, DeviceHeartbeat, DeviceOut
from ..auth import get_current_user

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/register", response_model=DeviceOut, status_code=201)
def register_device(
    body: DeviceRegister,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Find the employee linked to this user
    from ..models import Employee
    emp = db.query(Employee).filter(
        Employee.user_id == user.id,
        Employee.organization_id == user.organization_id,
    ).first()
    if not emp:
        raise HTTPException(status_code=400, detail="No employee profile linked to this user")

    # Upsert by device_identifier within the org
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

    device.manufacturer = body.manufacturer
    device.model = body.model
    device.android_version = body.android_version
    device.app_version = body.app_version
    device.last_seen_at = datetime.now(timezone.utc)
    device.is_online = True

    db.flush()

    # Create SIM entry if phone number provided
    if body.sim_phone_number:
        sim = db.query(SIM).filter(SIM.device_id == device.id, SIM.slot == 1).first()
        if not sim:
            sim = SIM(id=str(uuid.uuid4()), device_id=device.id, slot=1)
            db.add(sim)
        sim.phone_number = body.sim_phone_number
        sim.carrier = body.sim_carrier or ""

    db.commit()
    db.refresh(device)
    return device


@router.post("/{device_id}/heartbeat")
def heartbeat(
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
    device.is_online = body.is_online
    if body.battery_level is not None:
        device.battery_level = body.battery_level
    if body.permissions_status:
        device.permissions_status = body.permissions_status
    if body.app_version:
        device.app_version = body.app_version
    db.commit()
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
    devices = query.all()
    result = []
    for d in devices:
        out = DeviceOut.model_validate(d)
        out.employee_name = d.employee.name if d.employee else None
        result.append(out)
    return result
