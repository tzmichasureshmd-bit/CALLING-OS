from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


# ── SIM schemas ───────────────────────────────────────────────────────────────

class SIMSyncItem(BaseModel):
    """One SIM subscription sent from the mobile app."""
    slot:            int                        # 1-indexed
    carrier:         Optional[str] = None
    phone_number:    Optional[str] = None
    mcc:             Optional[str] = None
    mnc:             Optional[str] = None
    country_iso:     Optional[str] = None
    subscription_id: Optional[str] = None       # Android subscription ID where available
    network_type:    Optional[str] = None       # 2G | 3G | 4G | 5G | UNKNOWN
    is_active:       bool = True
    is_selected:     bool = False               # True = user chose this SIM in SIM Configuration


class SIMOut(BaseModel):
    id:              str
    slot:            int
    carrier:         Optional[str] = None
    phone_number:    Optional[str] = None
    mcc:             Optional[str] = None
    mnc:             Optional[str] = None
    country_iso:     Optional[str] = None
    subscription_id: Optional[str] = None
    network_type:    Optional[str] = None
    is_active:       bool
    last_detected_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class SIMChangeEvent(BaseModel):
    """Emitted when a SIM change is detected."""
    device_id:        str
    slot:             int
    change_type:      str           # INSERTED | REMOVED | REPLACED | CARRIER_CHANGED
    previous_carrier: Optional[str] = None
    new_carrier:      Optional[str] = None
    previous_subscription_id: Optional[str] = None
    new_subscription_id:      Optional[str] = None
    timestamp:        str


# ── Device schemas ────────────────────────────────────────────────────────────

class DeviceRegister(BaseModel):
    device_identifier: str
    manufacturer:      Optional[str] = None
    model:             Optional[str] = None
    android_version:   Optional[str] = None
    app_version:       Optional[str] = None
    # Legacy single-SIM fields — kept for backward compat
    sim_phone_number:  Optional[str] = None
    sim_carrier:       Optional[str] = None
    # Full SIM inventory (preferred)
    sims:              List[SIMSyncItem] = []


class DeviceHeartbeat(BaseModel):
    battery_level:          Optional[int] = None
    is_online:              bool = True
    permissions_status:     Optional[Dict[str, Any]] = None
    app_version:            Optional[str] = None
    network_type:           Optional[str] = None   # wifi | mobile | none | unknown
    background_sync_status: Optional[str] = None   # limited | restricted | unknown
    latitude:               Optional[float] = None
    longitude:              Optional[float] = None
    location_accuracy:      Optional[float] = None
    wifi_ssid:              Optional[str] = None
    # Optional SIM update on heartbeat
    sims:                   List[SIMSyncItem] = []


class DeviceOut(BaseModel):
    id:                 str
    employee_id:        str
    employee_name:      Optional[str] = None
    device_identifier:  str
    manufacturer:       Optional[str] = None
    model:              Optional[str] = None
    android_version:    Optional[str] = None
    app_version:        Optional[str] = None
    last_seen_at:       Optional[datetime] = None
    battery_level:      Optional[int] = None
    is_online:          bool
    network_type:       Optional[str] = None
    background_sync_status: Optional[str] = None
    permissions_status: Optional[Dict[str, Any]] = None
    latitude:           Optional[float] = None
    longitude:          Optional[float] = None
    location_accuracy:  Optional[float] = None
    wifi_ssid:          Optional[str] = None
    sims:               List[SIMOut] = []
    created_at:         datetime
    model_config = {"from_attributes": True}
