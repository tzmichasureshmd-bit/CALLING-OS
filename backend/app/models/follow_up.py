from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import relationship
from ..database import Base


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','fup')"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    call_id = Column(String(50), ForeignKey("calls.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    follow_up_type = Column(String(40), default="call", nullable=False)
    due_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String(160), nullable=True, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    customer = relationship("Customer", back_populates="follow_ups")
    employee = relationship("Employee")

    __table_args__ = (
        Index("ix_followups_org_due", "organization_id", "due_at"),
        Index("ix_followups_employee_status", "employee_id", "status"),
    )
