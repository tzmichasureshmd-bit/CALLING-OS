from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    employee_id: str | None = None
    status: str = Field(default="new", max_length=30)
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None
    next_follow_up: datetime | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, min_length=1, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    employee_id: str | None = None
    status: str | None = Field(default=None, max_length=30)
    tags: list[str] | None = None
    notes: str | None = None
    next_follow_up: datetime | None = None


class CustomerActivityOut(BaseModel):
    id: str
    event_type: str
    description: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    event_at: datetime
    idempotency_key: str | None = None
    call_id: str | None = None
    lead_id: str | None = None
    opportunity_id: str | None = None
    follow_up_id: str | None = None
    actor_id: str | None = None
    employee_id: str | None = None
    employee_name: str | None = None
