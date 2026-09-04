from pydantic import BaseModel
from typing import List, Optional


class KPIs(BaseModel):
    total_calls: int
    connected: int
    connected_pct: float
    missed: int
    rejected: int
    incoming: int
    outgoing: int
    talk_time_seconds: int
    avg_duration_seconds: float
    hot_leads: int = 0


class DailyPoint(BaseModel):
    day: str
    total: int
    connected: int
    missed: int


class OutcomePoint(BaseModel):
    day: str
    incoming: int
    outgoing: int
    missed: int


class DurationBucket(BaseModel):
    name: str
    value: int
    color: str


class EmployeeStat(BaseModel):
    id: str
    name: str
    calls: int
    connected: int
    connected_pct: float
    missed: int
    talk_time_seconds: int
    rank: int = 0


class DashboardAnalytics(BaseModel):
    kpis: KPIs
    daily_metrics: List[DailyPoint]
    outcome_breakdown: List[OutcomePoint]
    duration_distribution: List[DurationBucket]
    leaderboard: List[EmployeeStat]
    range: str = "today"
