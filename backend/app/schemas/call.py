from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CallSyncItem(BaseModel):
    """A single call record uploaded from the mobile app."""
    client_event_id: str          # deterministic ID from device (prevents duplicates)
    phone_number: str
    contact_name: Optional[str] = "Unknown"
    call_type: str                # incoming | outgoing | missed | blocked | rejected
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int = 0
    sim_slot: int = 1
    source: Optional[str] = "SIM 1"
    recording_available: bool = False


class CallSyncRequest(BaseModel):
    device_id: str
    calls: List[CallSyncItem]


class CallSyncResponse(BaseModel):
    accepted: int
    duplicates: int
    failed: int
    total: int


class CallOut(BaseModel):
    id: str
    client_event_id: str
    organization_id: str
    employee_id: Optional[str] = None
    device_id: Optional[str] = None
    phone_number: str
    contact_name: Optional[str] = None
    call_type: str
    call_status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int
    sim_slot: int
    source: Optional[str] = None
    recording_available: bool
    recording_url: Optional[str] = None
    created_at: datetime
    # Joined fields (from employee)
    employee_name: Optional[str] = None
    device_model: Optional[str] = None
    model_config = {"from_attributes": True}


class PaginatedCalls(BaseModel):
    items: list[CallOut]
    total: int
    page: int
    page_size: int
    total_pages: int
