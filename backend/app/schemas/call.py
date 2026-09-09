from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CallSyncItem(BaseModel):
    """A single call record uploaded from the mobile app."""
    client_event_id: str
    phone_number: str
    contact_name: Optional[str] = "Unknown"
    call_type: str                # incoming | outgoing | missed | rejected
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int = 0
    sim_slot: Optional[int] = None          # 1 or 2, NULL if unknown
    subscription_id: Optional[str] = None   # Android subscription ID
    source: Optional[str] = None            # "SIM 1" | "SIM 2" | "UNKNOWN"
    recording_available: bool = False
    recording_path: Optional[str] = None    # local device path, used by mobile upload queue


class CallSyncRequest(BaseModel):
    device_id: str
    calls: List[CallSyncItem]


class CallSyncItemResult(BaseModel):
    """Per-call result returned in the sync response."""
    client_event_id: str
    call_id: Optional[str] = None          # server-assigned ID (None if duplicate/failed)
    status: str                             # accepted | duplicate | failed
    sync_status: str = "synced"            # synced | failed
    recording_status: str = "not_available" # not_available | pending
    transcript_status: Optional[str] = None
    error: Optional[str] = None            # populated on failed inserts for diagnostics


class CallSyncResponse(BaseModel):
    accepted: int
    duplicates: int
    failed: int
    total: int
    results: list[CallSyncItemResult] = []  # per-call detail


class CallOut(BaseModel):
    id: str
    client_event_id: str
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
    recording_url: Optional[str] = None
    recording_size_bytes: Optional[int] = None
    recording_mime_type: Optional[str] = None
    transcript_status: Optional[str] = None
    created_at: datetime
    # Joined fields
    employee_name: Optional[str] = None
    device_model: Optional[str] = None
    model_config = {"from_attributes": True}


class PaginatedCalls(BaseModel):
    items: list[CallOut]
    total: int
    page: int
    page_size: int
    total_pages: int
