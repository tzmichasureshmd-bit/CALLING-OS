from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, BigInteger, SmallInteger, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


# Recording status values — mirrors mobile STATUS constants
RECORDING_STATUS_NOT_AVAILABLE = "not_available"
RECORDING_STATUS_DISCOVERED     = "discovered"
RECORDING_STATUS_QUEUED         = "queued"
RECORDING_STATUS_UPLOADING      = "uploading"
RECORDING_STATUS_UPLOADED       = "uploaded"
RECORDING_STATUS_FAILED         = "failed"


class Call(Base):
    __tablename__ = "calls"

    id                          = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','cal')"))
    client_event_id             = Column(String(100), nullable=True)
    organization_id             = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                                         nullable=False, index=True)
    employee_id                 = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"),
                                         nullable=True, index=True)
    device_id                   = Column(String(50), ForeignKey("devices.id", ondelete="SET NULL"),
                                         nullable=True, index=True)
    sim_id                      = Column(String(50), ForeignKey("sims.id", ondelete="SET NULL"),
                                         nullable=True, index=True)

    # Call identification
    phone_number                = Column(String(30), nullable=False, index=True)
    phone_number_normalized     = Column(String(30), index=True)
    contact_name                = Column(String(200))
    call_type                   = Column(String(20), nullable=False, index=True)
    call_status                 = Column(String(20), default="unknown")

    # Timing
    start_time                  = Column(DateTime, nullable=False, index=True)
    end_time                    = Column(DateTime, nullable=True)
    duration_seconds            = Column(Integer, default=0)

    # SIM / subscription
    sim_slot                    = Column(SmallInteger, nullable=True)   # 1 or 2, NULL if unknown
    subscription_id             = Column(String(50), nullable=True)     # Android subscription ID
    source                      = Column(String(30))                    # "SIM 1" | "SIM 2" | "UNKNOWN"

    # Recording — state machine
    recording_available         = Column(Boolean, default=False)        # legacy boolean, kept for compat
    recording_status            = Column(String(30), default=RECORDING_STATUS_NOT_AVAILABLE)
    recording_url               = Column(String(500), nullable=True)    # private storage path (not public URL)
    recording_size_bytes        = Column(BigInteger, nullable=True)
    recording_mime_type         = Column(String(100), nullable=True)
    recording_duration_seconds  = Column(Integer, nullable=True)
    recording_uploaded_at       = Column(DateTime, nullable=True)
    recording_error             = Column(String(500), nullable=True)

    # Transcription
    transcript_status           = Column(String(20), nullable=True)
    transcript_text             = Column(String, nullable=True)

    # Sync
    sync_status                 = Column(String(20), default="synced")
    created_at                  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="calls")
    employee     = relationship("Employee",     back_populates="calls")
    device       = relationship("Device",       back_populates="calls")

    __table_args__ = (
        Index("ix_calls_org_event_id",      "organization_id", "client_event_id", unique=True),
        Index("ix_calls_org_start",         "organization_id", "start_time"),
        Index("ix_calls_org_emp_start",     "organization_id", "employee_id", "start_time"),
        Index("ix_calls_recording_status",  "organization_id", "recording_status"),
        Index("ix_calls_subscription_id",   "subscription_id"),
        Index("ix_calls_sim_id",            "sim_id"),
    )
