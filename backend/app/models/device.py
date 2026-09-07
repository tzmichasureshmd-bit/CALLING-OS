from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, SmallInteger, Index, text, Float
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
                                 nullable=False, index=True)
    device_identifier   = Column(String(200), nullable=False)
    manufacturer        = Column(String(100))
    model               = Column(String(100))
    android_version     = Column(String(20))
    app_version         = Column(String(20))
    last_seen_at        = Column(DateTime, nullable=True)
    battery_level       = Column(SmallInteger, nullable=True)
    is_online           = Column(Boolean, default=False)
    permissions_status  = Column(JSONB, default=dict)
    latitude            = Column(Float, nullable=True)
    longitude           = Column(Float, nullable=True)
    location_accuracy   = Column(Float, nullable=True)
    wifi_ssid           = Column(String(100), nullable=True)
    created_at          = Column(DateTime, default=lambda: datetime.now(timezone.utc))
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

    id           = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','sim')"))
    device_id    = Column(String(50), ForeignKey("devices.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    slot         = Column(SmallInteger, default=1)
    carrier      = Column(String(100))
    phone_number = Column(String(30))
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    device = relationship("Device", back_populates="sims")
