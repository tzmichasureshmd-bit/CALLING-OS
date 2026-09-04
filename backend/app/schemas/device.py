from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class DeviceRegister(BaseModel):
    device_identifier: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    android_version: Optional[str] = None
    app_version: Optional[str] = None
    sim_phone_number: Optional[str] = None
    sim_carrier: Optional[str] = None


class DeviceHeartbeat(BaseModel):
    battery_level: Optional[int] = None
    is_online: bool = True
    permissions_status: Optional[Dict[str, bool]] = None
    app_version: Optional[str] = None


class SIMOut(BaseModel):
    id: str
    slot: int
    carrier: Optional[str] = None
    phone_number: Optional[str] = None
    status: str
    model_config = {"from_attributes": True}


class DeviceOut(BaseModel):
    id: str
    employee_id: str
    device_identifier: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    android_version: Optional[str] = None
    app_version: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    battery_level: Optional[int] = None
    is_online: bool
    permissions_status: Optional[Dict[str, Any]] = None
    sims: list[SIMOut] = []
    created_at: datetime
    model_config = {"from_attributes": True}
