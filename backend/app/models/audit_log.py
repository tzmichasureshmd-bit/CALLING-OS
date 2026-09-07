from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone
from ..database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id              = Column(String(50), primary_key=True)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    actor_id        = Column(String(50), nullable=True)   # user who performed the action
    actor_email     = Column(String(200), nullable=True)
    actor_role      = Column(String(30), nullable=True)
    action          = Column(String(100), nullable=False, index=True)
    resource        = Column(String(100), nullable=True)  # e.g. "call", "employee", "recording"
    resource_id     = Column(String(100), nullable=True)
    ip_address      = Column(String(50), nullable=True)
    user_agent      = Column(String(500), nullable=True)
    extra_data      = Column(JSONB, default=dict)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index("ix_audit_org_action", "organization_id", "action"),
        Index("ix_audit_org_created", "organization_id", "created_at"),
    )
