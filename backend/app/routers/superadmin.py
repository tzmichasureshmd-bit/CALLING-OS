from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, text, distinct
from datetime import datetime, timezone
from ..database import get_db
from ..models import User, Organization, Employee, Call, Device, SIM, AuditLog
from ..auth import get_current_user
from ..auth.password import hash_password
from pydantic import BaseModel
from typing import Optional
import re, random, string, httpx, os

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


def _require_super(user: User = Depends(get_current_user)):
    if user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


# ── Platform stats ─────────────────────────────────────────────────────────────

@router.get("/stats")
def platform_stats(db: Session = Depends(get_db), user: User = Depends(_require_super)):
    try:
        return {
            "total_organizations": db.query(Organization).filter(Organization.status == "active").count(),
            "total_employees":     db.query(Employee).filter(Employee.status == "active").count(),
            "total_calls":         db.query(Call).count(),
            "total_devices":       db.query(Device).count(),
            "total_users":         db.query(User).filter(User.status == "active").count(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── List all organizations ─────────────────────────────────────────────────────

@router.get("/organizations")
def list_all_organizations(
    q: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        query = db.query(Organization)
        if q:
            query = query.filter(Organization.name.ilike(f"%{q}%"))
        if status:
            query = query.filter(Organization.status == status)
        total = query.count()
        orgs  = query.order_by(Organization.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        items = []
        for org in orgs:
            emp_count    = db.query(Employee).filter(Employee.organization_id == org.id).count()
            call_count   = db.query(Call).filter(Call.organization_id == org.id).count()
            device_count = db.query(Device).filter(Device.organization_id == org.id).count()
            admin_user   = db.query(User).filter(User.organization_id == org.id, User.role == "ADMIN").first()
            items.append({
                "id": org.id, "name": org.name, "code": org.code,
                "email": org.email, "phone": org.phone,
                "plan": org.plan, "status": org.status,
                "created_at": org.created_at.isoformat() if org.created_at else None,
                "employees": emp_count, "calls": call_count, "devices": device_count,
                "admin_email": admin_user.email if admin_user else None,
            })
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Org detail ─────────────────────────────────────────────────────────────────

@router.get("/organizations/{org_id}")
def get_organization_detail(
    org_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        org = db.get(Organization, org_id)
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        employees = db.query(Employee).filter(Employee.organization_id == org_id).all()
        calls     = db.query(Call).filter(Call.organization_id == org_id).order_by(Call.start_time.desc()).limit(100).all()
        devices   = db.query(Device).filter(Device.organization_id == org_id).all()
        users     = db.query(User).filter(User.organization_id == org_id).all()

        return {
            "organization": {
                "id": org.id, "name": org.name, "code": org.code,
                "email": org.email, "phone": org.phone,
                "plan": org.plan, "status": org.status,
                "created_at": org.created_at.isoformat() if org.created_at else None,
            },
            "stats": {
                "employees": len(employees),
                "calls": len(calls),
                "devices": len(devices),
                "users": len(users),
            },
            "employees": [
                {"id": e.id, "name": e.name, "email": e.email,
                 "phone": e.phone, "status": e.status,
                 "employee_code": e.employee_code,
                 "created_at": e.created_at.isoformat() if e.created_at else None}
                for e in employees
            ],
            "calls": [
                {"id": c.id, "contact": c.contact_name, "phone": c.phone_number,
                 "type": c.call_type, "status": c.call_status,
                 "duration": c.duration_seconds,
                 "date": c.start_time.isoformat() if c.start_time else None,
                 "employee_id": c.employee_id}
                for c in calls
            ],
            "devices": [
                {"id": d.id, "model": d.model, "manufacturer": d.manufacturer,
                 "android_version": d.android_version,
                 "employee_id": d.employee_id,
                 "is_online": d.is_online,
                 "battery": d.battery_level,
                 "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None}
                for d in devices
            ],
            "users": [
                {"id": u.id, "email": u.email, "role": u.role,
                 "status": u.status,
                 "created_at": u.created_at.isoformat() if u.created_at else None}
                for u in users
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Toggle org status ──────────────────────────────────────────────────────────

@router.patch("/organizations/{org_id}/status")
def toggle_org_status(
    org_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    new_status = "suspended" if org.status == "active" else "active"
    db.execute(
        text("UPDATE organizations SET status = :s WHERE id = :id"),
        {"s": new_status, "id": org_id}
    )
    db.commit()
    return {"id": org_id, "status": new_status}


# ── Reset org admin password ───────────────────────────────────────────────────

class ResetPasswordBody(BaseModel):
    new_password: str

@router.post("/organizations/{org_id}/reset-password")
def reset_org_admin_password(
    org_id: str,
    body: ResetPasswordBody,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    admin = db.query(User).filter(
        User.organization_id == org_id,
        User.role == "ADMIN"
    ).first()
    if not admin:
        raise HTTPException(status_code=404, detail="No admin user found for this organization")
    admin.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password reset successfully", "email": admin.email}


# ── Delete organization ────────────────────────────────────────────────────────

@router.delete("/organizations/{org_id}")
def delete_organization(
    org_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    name = org.name
    # Use raw SQL so Postgres handles all CASCADE deletes natively
    # without SQLAlchemy ORM loading relationships and hitting unique constraints
    db.execute(text("DELETE FROM organizations WHERE id = :id"), {"id": org_id})
    db.commit()
    return {"message": f"Organization {name} deleted"}


# ── Create organization ────────────────────────────────────────────────────────

class CreateOrgBody(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    admin_password: str = "Admin@123"

def _make_prefix(name: str) -> str:
    letters = re.sub(r'[^a-zA-Z]', '', name)
    return letters[:3].lower().ljust(3, 'x')

def _make_slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def _make_org_code(prefix: str, db: Session) -> str:
    year = datetime.now().year
    for _ in range(20):
        suffix = ''.join(random.choices(string.digits, k=4))
        code = f"{prefix.upper()}-{year}-{suffix}"
        if not db.query(Organization).filter(Organization.code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique org code")

@router.post("/organizations")
def create_organization(
    body: CreateOrgBody,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    prefix = _make_prefix(body.name)
    slug   = _make_slug(body.name)
    code   = _make_org_code(prefix, db)

    base_slug, n = slug, 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{n}"; n += 1

    org = Organization(
        tenant_prefix=prefix, name=body.name, slug=slug,
        code=code, email=body.email, phone=body.phone, status="active",
    )
    db.add(org)
    db.flush()

    admin = User(
        organization_id=org.id, email=body.email,
        password_hash=hash_password(body.admin_password),
        role="ADMIN", status="active",
    )
    db.add(admin)
    db.flush()

    emp = Employee(
        organization_id=org.id, user_id=admin.id,
        name=body.name, email=body.email,
        employee_code="EMP001", status="active",
    )
    db.add(emp)
    db.commit()

    return {
        "id": org.id, "name": org.name, "code": org.code,
        "admin_email": body.email, "admin_password": body.admin_password,
        "message": "Organization created successfully",
    }


# ── List all calls across all orgs ─────────────────────────────────────────────

@router.get("/calls")
def list_all_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    org_id: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        query = db.query(Call)
        if org_id:
            query = query.filter(Call.organization_id == org_id)
        total = query.count()
        calls = query.order_by(Call.start_time.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [
                {"id": c.id, "org_id": c.organization_id,
                 "contact": c.contact_name, "phone": c.phone_number,
                 "type": c.call_type, "status": c.call_status,
                 "duration": c.duration_seconds,
                 "date": c.start_time.isoformat() if c.start_time else None,
                 "employee_id": c.employee_id}
                for c in calls
            ],
            "total": total, "page": page, "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── List all devices across all orgs ──────────────────────────────────────────

@router.get("/devices")
def list_all_devices(
    org_id: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        query = db.query(Device)
        if org_id:
            query = query.filter(Device.organization_id == org_id)
        devices = query.order_by(Device.last_seen_at.desc()).all()
        return {
            "items": [
                {"id": d.id, "org_id": d.organization_id,
                 "model": d.model, "manufacturer": d.manufacturer,
                 "android_version": d.android_version,
                 "app_version": d.app_version,
                 "is_online": d.is_online, "battery": d.battery_level,
                 "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None,
                 "employee_id": d.employee_id,
                 "network_type": d.network_type,
                 "background_sync_status": d.background_sync_status,
                 "permissions": d.permissions_status or {}}
                for d in devices
            ],
            "total": len(devices),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Device detail drill-down ───────────────────────────────────────────────────

@router.get("/devices/{device_id}")
def get_device_detail(
    device_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    d = db.get(Device, device_id)
    if not d:
        raise HTTPException(status_code=404, detail="Device not found")
    emp = db.get(Employee, d.employee_id) if d.employee_id else None
    sims = db.query(SIM).filter(SIM.device_id == device_id).all()
    recent_calls = db.query(Call).filter(Call.device_id == device_id).order_by(Call.start_time.desc()).limit(20).all()
    return {
        "device": {
            "id": d.id, "org_id": d.organization_id,
            "model": d.model, "manufacturer": d.manufacturer,
            "android_version": d.android_version, "app_version": d.app_version,
            "is_online": d.is_online, "battery": d.battery_level,
            "network_type": d.network_type,
            "background_sync_status": d.background_sync_status,
            "permissions": d.permissions_status or {},
            "wifi_ssid": d.wifi_ssid,
            "latitude": d.latitude, "longitude": d.longitude,
            "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        },
        "employee": {"id": emp.id, "name": emp.name, "email": emp.email} if emp else None,
        "sims": [
            {"id": s.id, "slot": s.slot, "carrier": s.carrier,
             "phone_number": s.phone_number, "network_type": s.network_type,
             "subscription_id": s.subscription_id, "is_active": s.is_active,
             "last_detected": s.last_detected_at.isoformat() if s.last_detected_at else None}
            for s in sims
        ],
        "recent_calls": [
            {"id": c.id, "type": c.call_type, "status": c.call_status,
             "duration": c.duration_seconds, "phone": c.phone_number,
             "date": c.start_time.isoformat() if c.start_time else None}
            for c in recent_calls
        ],
    }


# ── SIM Management ─────────────────────────────────────────────────────────────

@router.get("/sims")
def list_all_sims(
    org_id: str = Query(None),
    carrier: str = Query(None),
    network_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        query = db.query(SIM, Device).join(Device, SIM.device_id == Device.id)
        if org_id:
            query = query.filter(Device.organization_id == org_id)
        if carrier:
            query = query.filter(SIM.carrier.ilike(f"%{carrier}%"))
        if network_type:
            query = query.filter(SIM.network_type == network_type)
        total = query.count()
        rows = query.order_by(SIM.last_detected_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [
                {"id": s.id, "device_id": s.device_id,
                 "org_id": d.organization_id,
                 "slot": s.slot, "carrier": s.carrier,
                 "phone_number": s.phone_number,
                 "network_type": s.network_type,
                 "subscription_id": s.subscription_id,
                 "is_active": s.is_active,
                 "device_model": f"{d.manufacturer} {d.model}".strip(),
                 "last_detected": s.last_detected_at.isoformat() if s.last_detected_at else None,
                 "first_detected": s.first_detected_at.isoformat() if s.first_detected_at else None}
                for s, d in rows
            ],
            "total": total, "page": page, "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sims/changes")
def list_sim_changes(
    org_id: str = Query(None),
    change_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        q = "SELECT * FROM sim_change_history WHERE 1=1"
        params = {}
        if org_id:
            q += " AND organization_id = :org_id"; params["org_id"] = org_id
        if change_type:
            q += " AND change_type = :change_type"; params["change_type"] = change_type
        count_q = q.replace("SELECT *", "SELECT COUNT(*)")
        total = db.execute(text(count_q), params).scalar()
        q += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size; params["offset"] = (page - 1) * page_size
        rows = db.execute(text(q), params).mappings().all()
        return {
            "items": [dict(r) for r in rows],
            "total": total, "page": page, "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Sync Health ────────────────────────────────────────────────────────────────

@router.get("/sync-health")
def sync_health(
    org_id: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        q = db.query(Call)
        if org_id:
            q = q.filter(Call.organization_id == org_id)
        by_status = (
            q.with_entities(Call.sync_status, func.count(Call.id))
            .group_by(Call.sync_status)
            .all()
        )
        status_map = {s: c for s, c in by_status}

        # Failed calls with device/employee context (last 100)
        failed_q = db.query(Call, Employee, Device).outerjoin(
            Employee, Call.employee_id == Employee.id
        ).outerjoin(Device, Call.device_id == Device.id).filter(
            Call.sync_status == "sync_failed"
        )
        if org_id:
            failed_q = failed_q.filter(Call.organization_id == org_id)
        failed = failed_q.order_by(Call.start_time.desc()).limit(100).all()

        return {
            "summary": {
                "synced":      status_map.get("synced", 0),
                "sync_queued": status_map.get("sync_queued", 0),
                "syncing":     status_map.get("syncing", 0),
                "sync_failed": status_map.get("sync_failed", 0),
                "detected":    status_map.get("detected", 0),
            },
            "failed_calls": [
                {"id": c.id, "org_id": c.organization_id,
                 "phone": c.phone_number, "type": c.call_type,
                 "date": c.start_time.isoformat() if c.start_time else None,
                 "employee": e.name if e else None,
                 "device": f"{d.manufacturer} {d.model}".strip() if d else None,
                 "client_event_id": c.client_event_id}
                for c, e, d in failed
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Audit Logs ─────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def list_audit_logs(
    org_id: str = Query(None),
    action: str = Query(None),
    actor_email: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        q = db.query(AuditLog)
        if org_id:
            q = q.filter(AuditLog.organization_id == org_id)
        if action:
            q = q.filter(AuditLog.action.ilike(f"%{action}%"))
        if actor_email:
            q = q.filter(AuditLog.actor_email.ilike(f"%{actor_email}%"))
        if date_from:
            q = q.filter(AuditLog.created_at >= date_from)
        if date_to:
            q = q.filter(AuditLog.created_at <= date_to)
        total = q.count()
        logs = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": [
                {"id": l.id, "org_id": l.organization_id,
                 "actor_email": l.actor_email, "actor_role": l.actor_role,
                 "action": l.action, "resource": l.resource,
                 "resource_id": l.resource_id, "ip_address": l.ip_address,
                 "extra_data": l.extra_data,
                 "created_at": l.created_at.isoformat() if l.created_at else None}
                for l in logs
            ],
            "total": total, "page": page, "page_size": page_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── System Health ──────────────────────────────────────────────────────────────

@router.get("/system-health")
async def system_health(
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    from ..config import settings
    from ..ws_manager import manager as ws_manager

    # DB check
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"error: {e}"

    # Storage check
    storage_configured = bool(
        getattr(settings, "SUPABASE_URL", None) and
        getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
    )

    # WS connections
    ws_count = sum(len(conns) for conns in ws_manager.active_connections.values()) if hasattr(ws_manager, "active_connections") else 0

    # Platform-level counts
    total_orgs    = db.query(Organization).count()
    online_devices = db.query(Device).filter(Device.is_online == True).count()
    total_devices  = db.query(Device).count()
    pending_syncs  = db.query(Call).filter(Call.sync_status == "sync_queued").count()
    failed_syncs   = db.query(Call).filter(Call.sync_status == "sync_failed").count()

    return {
        "database":        {"status": db_status},
        "storage":         {"status": "configured" if storage_configured else "not_configured"},
        "websockets":      {"active_connections": ws_count},
        "organizations":   {"total": total_orgs},
        "devices":         {"total": total_devices, "online": online_devices, "offline": total_devices - online_devices},
        "sync":            {"pending": pending_syncs, "failed": failed_syncs},
    }


# ── App Versions ───────────────────────────────────────────────────────────────

@router.get("/app-versions")
def app_versions(
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        rows = (
            db.query(Device.app_version, func.count(Device.id).label("count"))
            .group_by(Device.app_version)
            .order_by(func.count(Device.id).desc())
            .all()
        )
        versions = [
            {"version": r.app_version or "unknown", "count": r.count}
            for r in rows
        ]
        latest = max((v["version"] for v in versions if v["version"] != "unknown"), default=None, key=lambda v: v)
        for v in versions:
            v["is_latest"] = v["version"] == latest
        return {"versions": versions, "latest": latest, "total_devices": sum(v["count"] for v in versions)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Global Search ──────────────────────────────────────────────────────────────

@router.get("/search")
def global_search(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        like = f"%{q}%"
        orgs = db.query(Organization).filter(
            Organization.name.ilike(like) | Organization.code.ilike(like) | Organization.email.ilike(like)
        ).limit(10).all()
        emps = db.query(Employee).filter(
            Employee.name.ilike(like) | Employee.email.ilike(like) | Employee.phone.ilike(like)
        ).limit(10).all()
        devices = db.query(Device).filter(
            Device.model.ilike(like) | Device.manufacturer.ilike(like) | Device.device_identifier.ilike(like)
        ).limit(10).all()
        return {
            "organizations": [
                {"id": o.id, "name": o.name, "code": o.code, "status": o.status, "type": "organization"}
                for o in orgs
            ],
            "employees": [
                {"id": e.id, "name": e.name, "email": e.email,
                 "org_id": e.organization_id, "status": e.status, "type": "employee"}
                for e in emps
            ],
            "devices": [
                {"id": d.id, "model": f"{d.manufacturer} {d.model}".strip(),
                 "org_id": d.organization_id, "is_online": d.is_online, "type": "device"}
                for d in devices
            ],
            "total": len(orgs) + len(emps) + len(devices),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Employee actions (SuperAdmin) ──────────────────────────────────────────────

@router.patch("/employees/{employee_id}/status")
def toggle_employee_status(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.status = "inactive" if emp.status == "active" else "active"
    db.commit()
    return {"id": emp.id, "status": emp.status}


@router.post("/employees/{employee_id}/reset-password")
def reset_employee_password(
    employee_id: str,
    body: ResetPasswordBody,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    u = db.query(User).filter(User.id == emp.user_id).first() if emp.user_id else None
    if not u:
        raise HTTPException(status_code=404, detail="No user account for this employee")
    u.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password reset", "email": u.email}


@router.post("/employees/{employee_id}/force-logout")
def force_logout_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    u = db.query(User).filter(User.id == emp.user_id).first() if emp.user_id else None
    if u:
        # Invalidate by rotating a token_version counter if present, else just mark
        if hasattr(u, "token_version"):
            u.token_version = (u.token_version or 0) + 1
        db.commit()
    return {"message": "Force logout issued", "employee_id": employee_id}


# ── Platform Alerts ────────────────────────────────────────────────────────────

@router.get("/alerts")
def list_alerts(
    resolved: bool = Query(False),
    severity: str = Query(None),
    org_id: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        q = "SELECT * FROM platform_alerts WHERE resolved = :resolved"
        params: dict = {"resolved": resolved}
        if severity:
            q += " AND severity = :severity"; params["severity"] = severity
        if org_id:
            q += " AND organization_id = :org_id"; params["org_id"] = org_id
        count_q = q.replace("SELECT *", "SELECT COUNT(*)")
        total = db.execute(text(count_q), params).scalar()
        q += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size; params["offset"] = (page - 1) * page_size
        rows = db.execute(text(q), params).mappings().all()
        return {"items": [dict(r) for r in rows], "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_require_super),
):
    try:
        db.execute(
            text("UPDATE platform_alerts SET resolved=TRUE, resolved_at=NOW() WHERE id=:id"),
            {"id": alert_id}
        )
        db.commit()
        return {"message": "Alert resolved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
