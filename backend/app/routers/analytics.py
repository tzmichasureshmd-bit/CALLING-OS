from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timezone, timedelta
from typing import Optional
from ..database import get_db
from ..models import User, Call, Employee
from ..schemas.analytics import DashboardAnalytics, KPIs, DailyPoint, OutcomePoint, DurationBucket, EmployeeStat
from ..auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

DURATION_COLORS = {
    "0-1 min": "#14b8a6",
    "1-3 min": "#8b5cf6",
    "3-5 min": "#22d3ee",
    "5+ min": "#f59e0b",
}


def _date_range(range_str: str):
    now = datetime.now(timezone.utc)
    if range_str == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(hour=23, minute=59, second=59)
    elif range_str == "7d":
        start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif range_str == "30d":
        start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    else:  # today
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
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


def _build_daily(calls, days: int) -> list[DailyPoint]:
    now = datetime.now(timezone.utc)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    result = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).date()
        day_calls = [c for c in calls if c.start_time.date() == d]
        total = len(day_calls)
        conn = sum(1 for c in day_calls if c.duration_seconds > 0 and c.call_type != "missed")
        miss = sum(1 for c in day_calls if c.call_type == "missed")
        result.append(DailyPoint(day=day_names[d.weekday()], total=total, connected=conn, missed=miss))
    return result


def _build_outcome(calls, days: int) -> list[OutcomePoint]:
    now = datetime.now(timezone.utc)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    result = []
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).date()
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
    range: str = Query("today", regex="^(today|yesterday|7d|30d)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = _date_range(range)
    calls = db.query(Call).filter(
        Call.organization_id == user.organization_id,
        Call.start_time >= start,
        Call.start_time <= end,
    ).all()

    days = 30 if range == "30d" else 7
    return DashboardAnalytics(
        kpis=_build_kpis(calls),
        daily_metrics=_build_daily(calls, days),
        outcome_breakdown=_build_outcome(calls, days),
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
    calls = db.query(Call).filter(
        Call.organization_id == user.organization_id,
        Call.start_time >= start,
        Call.start_time <= end,
    ).all()
    return {"leaderboard": _build_leaderboard(db, user.organization_id, calls)}


@router.get("/team", response_model=DashboardAnalytics)
def team_analytics(
    range: str = Query("7d", pattern="^(today|yesterday|7d|30d)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Team-wide analytics used by the web analytics view."""
    return dashboard_analytics(range=range, db=db, user=user)


@router.get("/calls")
def call_analytics(
    range: str = Query("7d", pattern="^(today|yesterday|7d|30d)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """A compact call-performance summary for reports and future integrations."""
    start, end = _date_range(range)
    calls = db.query(Call).filter(
        Call.organization_id == user.organization_id,
        Call.start_time >= start,
        Call.start_time <= end,
    ).all()
    return {"kpis": _build_kpis(calls), "range": range}
