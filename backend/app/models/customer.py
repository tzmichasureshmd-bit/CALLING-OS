from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','cus')"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(String(50), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String(200), nullable=False)
    phone = Column(String(30), nullable=False)
    phone_normalized = Column(String(30), nullable=False)
    email = Column(String(200), nullable=True)
    company = Column(String(200), nullable=True)
    status = Column(String(30), nullable=False, default="new")
    tags = Column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    last_contact_at = Column(DateTime, nullable=True)
    next_follow_up = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    employee = relationship("Employee")
    activities = relationship("CustomerActivity", back_populates="customer", lazy="dynamic")
    follow_ups = relationship("FollowUp", back_populates="customer", lazy="dynamic")

    __table_args__ = (
        Index("uq_customers_org_phone_normalized", "organization_id", "phone_normalized", unique=True),
        Index("ix_customers_org_status", "organization_id", "status"),
        Index("ix_customers_org_employee", "organization_id", "employee_id"),
        Index("ix_customers_org_last_contact", "organization_id", "last_contact_at"),
    )
