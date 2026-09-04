from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, Index, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(String(36), primary_key=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(36), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(200), nullable=False)       # contact / client name
    phone = Column(String(30))
    customer = Column(String(200))                   # company / role
    stage = Column(String(50), default="New")        # New | Qualified | Proposal | Negotiation | Won | Lost
    value = Column(Float, default=0)                 # numeric value in INR
    probability = Column(Float, default=0.0)         # 0.0 – 1.0
    close_date = Column(DateTime, nullable=True)
    next_action = Column(String(300))
    notes = Column(Text)

    connects = Column(Integer, default=1)
    talk_time_seconds = Column(Integer, default=0)
    last_contact_at = Column(DateTime, nullable=True)

    is_closed = Column(String(10), default="open")   # open | won | lost
    closed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="opportunities")
    employee = relationship("Employee", back_populates="opportunities")

    __table_args__ = (
        Index("ix_opp_org_stage", "organization_id", "stage"),
    )
