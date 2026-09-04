from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Index, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    call_id = Column(String(36), ForeignKey("calls.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=False)
    source = Column(String(100))          # Inbound call | Referral | Campaign | Cold call
    status = Column(String(30), default="new")  # new | contacted | interested | follow_up | hot | qualified | converted | lost
    priority = Column(String(20), default="Medium")  # High | Medium | Low
    expected_value = Column(String(50))   # stored as string e.g. "₹1,20,000"
    next_follow_up = Column(DateTime, nullable=True)
    last_contact_at = Column(DateTime, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="leads")
    employee = relationship("Employee", back_populates="leads")

    __table_args__ = (
        Index("ix_leads_org_status", "organization_id", "status"),
    )
