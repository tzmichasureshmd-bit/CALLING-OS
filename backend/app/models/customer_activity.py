from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class CustomerActivity(Base):
    __tablename__ = "customer_activities"

    id = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','act')"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    call_id = Column(String(50), ForeignKey("calls.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(String(36), ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    follow_up_id = Column(String(50), ForeignKey("follow_ups.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type = Column(String(60), nullable=False)
    description = Column(Text, nullable=True)
    payload = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    event_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    idempotency_key = Column(String(160), nullable=True)

    customer = relationship("Customer", back_populates="activities")
    employee = relationship("Employee")

    __table_args__ = (
        Index("uq_customer_activities_org_idempotency", "organization_id", "idempotency_key", unique=True),
        Index("ix_customer_activities_org_customer_event", "organization_id", "customer_id", "event_at"),
    )
