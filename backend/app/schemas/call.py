from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class CallSyncItem(BaseModel):
    """One bounded, validated call-log record uploaded by the mobile app."""

    client_event_id: str = Field(min_length=1, max_length=100)
    phone_number: str = Field(min_length=1, max_length=30)
    contact_name: Optional[str] = Field(default="Unknown", max_length=200)
    call_type: Literal["incoming", "outgoing", "missed", "rejected"]
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int = Field(default=0, ge=0, le=604_800)
    sim_slot: Optional[int] = Field(default=None, ge=1, le=4)
    subscription_id: Optional[str] = Field(default=None, max_length=50)
    source: Optional[str] = Field(default=None, max_length=30)
    recording_available: bool = False

    @model_validator(mode="after")
    def validate_time_order(self):
        if self.end_time is not None and self.end_time < self.start_time:
            raise ValueError("end_time must not be before start_time")
        return self


class CallSyncRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=200)
    calls: list[CallSyncItem] = Field(min_length=1, max_length=100)


class CallSyncItemResult(BaseModel):
    """Per-call result returned in the sync response."""

    client_event_id: str
    call_id: Optional[str] = None
    status: Literal["accepted", "duplicate", "failed"]
    sync_status: Literal["synced", "failed"] = "synced"
    recording_status: str = "not_available"
    transcript_status: Optional[str] = None
    error: Optional[str] = None


class CallSyncResponse(BaseModel):
    accepted: int
    duplicates: int
    failed: int
    total: int
    results: list[CallSyncItemResult] = Field(default_factory=list)


class CallOut(BaseModel):
    id: str
    client_event_id: Optional[str] = None
    organization_id: str
    employee_id: Optional[str] = None
    device_id: Optional[str] = None
    sim_id: Optional[str] = None
    phone_number: str
    contact_name: Optional[str] = None
    call_type: str
    call_status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int
    sim_slot: Optional[int] = None
    subscription_id: Optional[str] = None
    source: Optional[str] = None
    recording_available: bool
    recording_status: str = "not_available"
    recording_size_bytes: Optional[int] = None
    recording_mime_type: Optional[str] = None
    transcript_status: Optional[str] = None
    transcript_text: Optional[str] = None
    transcript_error: Optional[str] = None
    transcription_started_at: Optional[datetime] = None
    transcription_completed_at: Optional[datetime] = None
    summary_status: Optional[str] = None
    summary_text: Optional[str] = None
    summary_data: Optional[dict | str] = None
    sync_status: str = "synced"
    sync_confirmed_at: Optional[datetime] = None
    notes: Optional[str] = None
    call_privacy: str = "unclassified"
    created_at: datetime
    updated_at: Optional[datetime] = None
    employee_name: Optional[str] = None
    device_model: Optional[str] = None
    model_config = {"from_attributes": True}


class PaginatedCalls(BaseModel):
    items: list[CallOut]
    total: int
    page: int
    page_size: int
    total_pages: int
