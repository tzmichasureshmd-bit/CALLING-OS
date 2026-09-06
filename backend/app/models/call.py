from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, BigInteger, SmallInteger, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Call(Base):
    __tablename__ = "calls"

    id                      = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','cal')"))
    client_event_id         = Column(String(100), nullable=True)
    organization_id         = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                                     nullable=False, index=True)
    employee_id             = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"),
                                     nullable=True, index=True)
    device_id               = Column(String(50), ForeignKey("devices.id", ondelete="SET NULL"),
                                     nullable=True, index=True)
    phone_number            = Column(String(30), nullable=False, index=True)
    phone_number_normalized = Column(String(30), index=True)
    contact_name            = Column(String(200))
    call_type               = Column(String(20), nullable=False, index=True)
    call_status             = Column(String(20), default="unknown")
    start_time              = Column(DateTime, nullable=False, index=True)
    end_time                = Column(DateTime, nullable=True)
    duration_seconds        = Column(Integer, default=0)
    sim_slot                = Column(SmallInteger, default=1)
    source                  = Column(String(30))
    recording_available     = Column(Boolean, default=False)
    recording_url           = Column(String(500), nullable=True)
    recording_size_bytes    = Column(BigInteger, nullable=True)
    transcript_status       = Column(String(20), nullable=True)  # pending | processing | completed | failed
    transcript_text         = Column(String, nullable=True)
    sync_status             = Column(String(20), default="synced")
    created_at              = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="calls")
    employee     = relationship("Employee",     back_populates="calls")
    device       = relationship("Device",       back_populates="calls")

    __table_args__ = (
        Index("ix_calls_org_event_id", "organization_id", "client_event_id", unique=True),
    )
