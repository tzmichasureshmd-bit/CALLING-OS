from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, SmallInteger, Index, text, Float, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Device(Base):
    __tablename__ = "devices"

    id                  = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','dev')"))
    organization_id     = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                                 nullable=False, index=True)
    employee_id         = Column(String(50), ForeignKey("employees.id", ondelete="CASCADE"),
                                 nullable=True, index=True)
    device_identifier   = Column(String(200), nullable=False)
    manufacturer        = Column(String(100))
    model               = Column(String(100))
    android_version     = Column(String(20))
    app_version         = Column(String(20))
    last_seen_at        = Column(DateTime, nullable=True)
    battery_level       = Column(SmallInteger, nullable=True)
    is_online           = Column(Boolean, default=False)
    network_type        = Column(String(20), nullable=True)   # wifi | mobile | none | unknown
    background_sync_status = Column(String(50), nullable=True) # limited | restricted | unknown
    permissions_status  = Column(JSONB, default=dict)
    latitude            = Column(Float, nullable=True)
    longitude           = Column(Float, nullable=True)
    location_accuracy   = Column(Float, nullable=True)
    wifi_ssid               = Column(String(100), nullable=True)
    reconnect_requested_at  = Column(DateTime, nullable=True)   # set by manager "Connect" button
    created_at              = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at          = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                                 onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="devices")
    employee     = relationship("Employee",     back_populates="devices")
    sims         = relationship("SIM",          back_populates="device", lazy="selectin")
    calls        = relationship("Call",         back_populates="device",  lazy="dynamic")

    __table_args__ = (
        Index("ix_devices_org_identifier", "organization_id", "device_identifier", unique=True),
    )


class SIM(Base):
    __tablename__ = "sims"

    id                 = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','sim')"))
    device_id          = Column(String(50), ForeignKey("devices.id", ondelete="CASCADE"),
                                nullable=False, index=True)
    slot               = Column(SmallInteger, nullable=False)   # 1-indexed (SIM 1, SIM 2)
    carrier            = Column(String(100))
    display_name       = Column(String(100))                     # operator display name
    phone_number       = Column(String(30))
    mcc                = Column(String(10))
    mnc                = Column(String(10))
    country_iso        = Column(String(5))
    subscription_id    = Column(String(50))                     # Android subscription ID where available
    network_type       = Column(String(20))                     # 2G | 3G | 4G | 5G | UNKNOWN
    is_active          = Column(Boolean, default=True)
    first_detected_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_detected_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                                onupdate=lambda: datetime.now(timezone.utc))

    device = relationship("Device", back_populates="sims")

    __table_args__ = (
        UniqueConstraint("device_id", "slot", name="uq_sims_device_slot"),
        Index("ix_sims_subscription_id", "subscription_id"),
        Index("ix_sims_last_detected", "device_id", "last_detected_at"),
    )
