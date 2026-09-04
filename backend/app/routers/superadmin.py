from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import User, Organization, Employee, Call, Device
from ..auth import get_current_user, require_role

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


def _require_super(user: User = Depends(get_current_user)):
    if user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db), user: User = Depends(_require_super)):
    return {
        "total_organizations": db.query(Organization).filter(Organization.status == "active").count(),
        "total_employees": db.query(Employee).filter(Employee.status == "active").count(),
        "total_calls": db.query(Call).count(),
        "total_devices": db.query(Device).count(),
        "total_users": db.query(User).filter(User.status == "active").count(),
    }


@router.get("/organizations")
def list_all_organizations(
    q: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    query = db.query(Organization)
    if q:
        query = query.filter(Organization.name.ilike(f"%{q}%"))
    total = query.count()
    orgs = query.order_by(Organization.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for org in orgs:
        emp_count = db.query(Employee).filter(Employee.organization_id == org.id, Employee.status == "active").count()
        call_count = db.query(Call).filter(Call.organization_id == org.id).count()
        device_count = db.query(Device).filter(Device.organization_id == org.id).count()
        items.append({
            "id": org.id, "name": org.name, "code": org.code,
            "email": org.email, "phone": org.phone,
            "status": org.status, "created_at": org.created_at,
            "employees": emp_count, "calls": call_count, "devices": device_count,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/organizations/{org_id}")
def get_organization_detail(
    org_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    employees = db.query(Employee).filter(Employee.organization_id == org_id).all()
    calls = db.query(Call).filter(Call.organization_id == org_id).order_by(Call.start_time.desc()).limit(50).all()
    devices = db.query(Device).filter(Device.organization_id == org_id).all()

    return {
        "organization": {
            "id": org.id, "name": org.name, "code": org.code,
            "email": org.email, "phone": org.phone,
            "status": org.status, "created_at": org.created_at,
        },
        "employees": [{"id": e.id, "name": e.name, "email": e.email, "phone": e.phone, "status": e.status, "employee_code": e.employee_code, "created_at": e.created_at} for e in employees],
        "calls": [{"id": c.id, "contact": c.contact_name, "phone": c.phone_number, "type": c.call_type, "duration": c.duration_seconds, "date": c.start_time, "employee_id": c.employee_id} for c in calls],
        "devices": [{"id": d.id, "model": d.model, "employee_id": d.employee_id, "is_online": d.is_online, "battery": d.battery_level, "last_seen": d.last_seen_at} for d in devices],
    }


@router.patch("/organizations/{org_id}/status")
def toggle_org_status(
    org_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "suspended" if org.status == "active" else "active"
    db.commit()
    return {"id": org.id, "status": org.status}
