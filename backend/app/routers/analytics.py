from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timezone, timedelta
from typing import Optional
from ..database import get_db
from ..models import User, Call, Employee, Device, Lead
from ..schemas.analytics import DashboardAnalytics, KPIs, DailyPoint, OutcomePoint, DurationBucket, EmployeeStat
from ..auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

DURATION_COLORS = {
    "0-1 min": "#14b8a6",
    "1-3 min": "#8b5cf6",
    "3-5 min": "#22d3ee",
    "5+ min": "#f59e0b",
}


def _employee_scope(user: User, db: Session) -> Optional[str]:
    if (user.role or "").upper() != "EMPLOYEE":
        return None
    employee = db.query(Employee).filter(
        Employee.user_id == user.id,
        Employee.organization_id == user.organization_id,
        Employee.status == "active",
    ).first()
    return employee.id if employee else "__no_employee__"


def _scoped_calls(db: Session, user: User, start=None, end=None):
    query = db.query(Call).filter(Call.organization_id == user.organization_id)
    employee_id = _employee_scope(user, db)
    if employee_id:
        query = query.filter(Call.employee_id == employee_id)
    if start is not None:
        query = query.filter(Call.start_time >= start)
    if end is not None:
        query = query.filter(Call.start_time <= end)
    return query.all()


def _date_range(range_str: str, start_date: str | None = None, end_date: str | None = None):
    now = datetime.utcnow()  # naive UTC — matches DateTime columns in DB
    if range_str == "custom" and start_date and end_date:
        try:
            start = datetime.fromisoformat(start_date.split("T")[0])  # naive, date only
            end   = datetime.fromisoformat(end_date.split("T")[0]).replace(hour=23, minute=59, second=59)
            if (end - start).days > 90:
                start = end - timedelta(days=90)
        except ValueError:
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end   = now
    elif range_str == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = start.replace(hour=23, minute=59, second=59)
    elif range_str == "7d":
        start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    elif range_str == "30d":
        start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    elif range_str == "90d":
        start = (now - timedelta(days=90)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    else:  # today
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    return start, end


def _build_kpis(calls) -> KPIs:
    total = len(calls)
    connected = sum(1 for c in calls if c.duration_seconds > 0 and c.call_type != "missed")
    missed = sum(1 for c in calls if c.call_type == "missed")
    rejected = sum(1 for c in calls if c.call_type == "rejected")
    incoming = sum(1 for c in calls if c.call_type == "incoming")
    outgoing = sum(1 for c in calls if c.call_type == "outgoing")
    talk_time = sum(c.duration_seconds for c in calls)
    avg = talk_time / connected if connected else 0
    return KPIs(
        total_calls=total,
        connected=connected,
        connected_pct=round(connected / total * 100, 1) if total else 0,
        missed=missed,
        rejected=rejected,
        incoming=incoming,
        outgoing=outgoing,
        talk_time_seconds=talk_time,
        avg_duration_seconds=round(avg, 1),
    )


def _build_daily(calls, days: int, start=None) -> list[DailyPoint]:
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    base = start.date() if start else (datetime.utcnow() - timedelta(days=days - 1)).date()
    result = []
    for i in range(days):
        d = base + timedelta(days=i)
        day_calls = [c for c in calls if c.start_time.date() == d]
        result.append(DailyPoint(
            day=day_names[d.weekday()],
            total=len(day_calls),
            connected=sum(1 for c in day_calls if c.duration_seconds > 0 and c.call_type != "missed"),
            missed=sum(1 for c in day_calls if c.call_type == "missed"),
        ))
    return result


def _build_outcome(calls, days: int, start=None) -> list[OutcomePoint]:
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    base = start.date() if start else (datetime.utcnow() - timedelta(days=days - 1)).date()
    result = []
    for i in range(days):
        d = base + timedelta(days=i)
        day_calls = [c for c in calls if c.start_time.date() == d]
        result.append(OutcomePoint(
            day=day_names[d.weekday()],
            incoming=sum(1 for c in day_calls if c.call_type == "incoming"),
            outgoing=sum(1 for c in day_calls if c.call_type == "outgoing"),
            missed=sum(1 for c in day_calls if c.call_type == "missed"),
        ))
    return result


def _build_duration(calls) -> list[DurationBucket]:
    buckets = {"0-1 min": 0, "1-3 min": 0, "3-5 min": 0, "5+ min": 0}
    for c in calls:
        s = c.duration_seconds
        if s < 60:
            buckets["0-1 min"] += 1
        elif s < 180:
            buckets["1-3 min"] += 1
        elif s < 300:
            buckets["3-5 min"] += 1
        else:
            buckets["5+ min"] += 1
    return [DurationBucket(name=k, value=v, color=DURATION_COLORS[k]) for k, v in buckets.items()]


def _build_leaderboard(db: Session, org_id: str, calls) -> list[EmployeeStat]:
    # Group calls by employee
    emp_stats: dict[str, dict] = {}
    for c in calls:
        if not c.employee_id:
            continue
        s = emp_stats.setdefault(c.employee_id, {"calls": 0, "connected": 0, "missed": 0, "talk": 0})
        s["calls"] += 1
        if c.duration_seconds > 0 and c.call_type != "missed":
            s["connected"] += 1
            s["talk"] += c.duration_seconds
        if c.call_type == "missed":
            s["missed"] += 1

    employees = {e.id: e for e in db.query(Employee).filter(Employee.organization_id == org_id).all()}
    stats = []
    for emp_id, s in emp_stats.items():
        emp = employees.get(emp_id)
        if not emp:
            continue
        pct = round(s["connected"] / s["calls"] * 100, 1) if s["calls"] else 0
        stats.append(EmployeeStat(
            id=emp_id, name=emp.name,
            calls=s["calls"], connected=s["connected"],
            connected_pct=pct, missed=s["missed"],
            talk_time_seconds=s["talk"],
        ))
    stats.sort(key=lambda x: x.calls, reverse=True)
    for i, s in enumerate(stats):
        s.rank = i + 1
    return stats


@router.get("/dashboard", response_model=DashboardAnalytics)
def dashboard_analytics(
    range: str = Query("today", pattern="^(today|yesterday|7d|30d|90d|custom)$"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _date_range(range, start_date, end_date)
    calls = _scoped_calls(db, user, start, end)

    hot_leads_query = db.query(Lead).filter(
        Lead.organization_id == user.organization_id,
        Lead.status.in_(["hot", "interested", "follow_up"]),
    )
    employee_id = _employee_scope(user, db)
    if employee_id:
        hot_leads_query = hot_leads_query.filter(Lead.employee_id == employee_id)
    hot_leads = hot_leads_query.count()

    # days = actual span so charts align with the selected range
    if range in ("today", "yesterday"):
        days = 1
    elif range == "custom" and start_date and end_date:
        try:
            days = max(1, (end.date() - start.date()).days + 1)
        except Exception:
            days = 7
    elif range == "30d":
        days = 30
    elif range == "90d":
        days = 90
    else:
        days = 7

    kpis = _build_kpis(calls)
    kpis.hot_leads = hot_leads
    return DashboardAnalytics(
        kpis=kpis,
        daily_metrics=_build_daily(calls, days, start),
        outcome_breakdown=_build_outcome(calls, days, start),
        duration_distribution=_build_duration(calls),
        leaderboard=_build_leaderboard(db, user.organization_id, calls),
        range=range,
    )


@router.get("/employees")
def employee_analytics(
    range: str = Query("7d"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _date_range(range)
    calls = _scoped_calls(db, user, start, end)
    return {"leaderboard": _build_leaderboard(db, user.organization_id, calls)}


@router.get("/employees/{employee_id}")
def employee_overview(
    employee_id: str,
    range: str = Query("7d", pattern="^(today|yesterday|7d|30d)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a scoped employee profile, metrics, and device overview."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == user.organization_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    team_roles = {"TEAM_LEAD", "MANAGER", "ADMIN", "SUPER_ADMIN"}
    if (user.role or "").upper() not in team_roles and employee.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only view your own employee profile")

    start, end = _date_range(range)
    calls = db.query(Call).filter(
        Call.organization_id == user.organization_id,
        Call.employee_id == employee_id,
        Call.start_time >= start,
        Call.start_time <= end,
    ).order_by(Call.start_time.desc()).all()
    days = 30 if range == "30d" else 7 if range == "7d" else 1
    devices = db.query(Device).filter(
        Device.organization_id == user.organization_id,
        Device.employee_id == employee_id,
    ).order_by(Device.last_seen_at.desc()).all()

    return {
        "employee": {
            "id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "phone": employee.phone,
            "employee_code": employee.employee_code,
            "status": employee.status,
            "created_at": employee.created_at,
            "last_active_at": employee.last_active_at,
        },
        "range": range,
        "kpis": _build_kpis(calls).model_dump(),
        "daily_metrics": [point.model_dump() for point in _build_daily(calls, days)],
        "outcome_breakdown": [point.model_dump() for point in _build_outcome(calls, days)],
        "duration_distribution": [bucket.model_dump() for bucket in _build_duration(calls)],
        "devices": [
            {
                "id": device.id,
                "model": device.model,
                "manufacturer": device.manufacturer,
                "android_version": device.android_version,
                "app_version": device.app_version,
                "battery_level": device.battery_level,
                "is_online": device.is_online,
                "last_seen_at": device.last_seen_at,
                "network_type": device.network_type,
                "permissions_status": device.permissions_status or {},
            }
            for device in devices
        ],
    }


@router.get("/team", response_model=DashboardAnalytics)
def team_analytics(
    range: str = Query("7d", pattern="^(today|yesterday|7d|30d|90d|custom)$"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Team-wide analytics used by the web analytics view."""
    return dashboard_analytics(range=range, start_date=start_date, end_date=end_date, db=db, user=user)


@router.get("/calls")
def call_analytics(
    range: str = Query("7d", pattern="^(today|yesterday|7d|30d)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A compact call-performance summary for reports and future integrations."""
    start, end = _date_range(range)
    calls = _scoped_calls(db, user, start, end)
    return {"kpis": _build_kpis(calls), "range": range}


@router.get("/needs-attention")
def needs_attention(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Items that require manager action: offline devices, missed call spikes, permission issues."""
    items = []
    if (user.role or "").upper() == "EMPLOYEE":
        return {"items": []}
    now = datetime.now(timezone.utc)

    # One alert per employee — keep only the most recently seen device per employee
    all_devices = db.query(Device).filter(Device.organization_id == user.organization_id).all()
    emp_device: dict[str, Device] = {}
    for d in all_devices:
        if not d.employee_id:
            continue
        existing = emp_device.get(d.employee_id)
        if existing is None:
            emp_device[d.employee_id] = d
        else:
            existing_ts = existing.last_seen_at.timestamp() if existing.last_seen_at else 0
            new_ts = d.last_seen_at.timestamp() if d.last_seen_at else 0
            if new_ts > existing_ts:
                emp_device[d.employee_id] = d

    employees = {e.id: e for e in db.query(Employee).filter(Employee.organization_id == user.organization_id).all()}

    for emp_id, d in emp_device.items():
        name = employees[emp_id].name if emp_id in employees else "Unknown"

        if d.last_seen_at and (now - d.last_seen_at).total_seconds() > 7200:
            items.append({
                "id": f"offline-{emp_id}",
                "title": f"{name}'s device is offline",
                "detail": f"Last seen {int((now - d.last_seen_at).total_seconds() / 3600)}h ago · {d.model or 'Unknown device'}",
                "severity": "high",
                "to": "/device-health",
            })

        perms = d.permissions_status or {}
        missing = [k for k in ["callLog", "phoneState"] if not perms.get(k)]
        if missing and d.is_online:
            items.append({
                "id": f"perms-{emp_id}",
                "title": f"{name} has missing permissions",
                "detail": f"Missing: {', '.join(missing)}",
                "severity": "medium",
                "to": "/device-health",
            })

    # Missed call spike today vs yesterday
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    today_missed = db.query(Call).filter(
        Call.organization_id == user.organization_id,
        Call.call_type == "missed",
        Call.start_time >= today_start,
    ).count()
    yesterday_missed = db.query(Call).filter(
        Call.organization_id == user.organization_id,
        Call.call_type == "missed",
        Call.start_time >= yesterday_start,
        Call.start_time < today_start,
    ).count()
    if yesterday_missed > 0 and today_missed > yesterday_missed * 1.5:
        items.append({
            "id": "missed-spike",
            "title": "Missed call spike today",
            "detail": f"{today_missed} missed today vs {yesterday_missed} yesterday",
            "severity": "medium",
            "to": "/call-logs",
        })

    return {"items": items}


@router.get("/live-pulse")
def live_pulse(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Last 20 call events for the live pulse feed on the dashboard."""
    query = db.query(Call).filter(Call.organization_id == user.organization_id)
    employee_id = _employee_scope(user, db)
    if employee_id:
        query = query.filter(Call.employee_id == employee_id)
    calls = query.order_by(Call.start_time.desc()).limit(20).all()
    now = datetime.now(timezone.utc)
    items = []
    for c in calls:
        diff = int((now - c.start_time).total_seconds() / 60)
        if diff < 1:
            time_str = "just now"
        elif diff < 60:
            time_str = f"{diff}m ago"
        else:
            time_str = f"{diff // 60}h ago"

        tone = "success" if c.call_type == "incoming" and c.duration_seconds > 0 else \
               "info" if c.call_type == "outgoing" and c.duration_seconds > 0 else "danger"
        emp = db.query(Employee).filter(Employee.id == c.employee_id).first()
        items.append({
            "id": c.id,
            "time": time_str,
            "text": f"{c.call_type.capitalize()} · {c.contact_name or c.phone_number} · {c.duration_seconds // 60}m {c.duration_seconds % 60}s",
            "employee": emp.name if emp else "Unknown",
            "tone": tone,
        })
    return {"items": items}
