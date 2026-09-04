from sqlalchemy import Column, String, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Employee(Base):
    __tablename__ = "employees"

    id              = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','emp')"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    user_id         = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name            = Column(String(200), nullable=False)
    email           = Column(String(200))
    phone           = Column(String(30))
    employee_code   = Column(String(50))
    status          = Column(String(20), default="active")
    joining_date    = Column(DateTime, nullable=True)
    last_active_at  = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    organization  = relationship("Organization", back_populates="employees")
    user          = relationship("User",         back_populates="employee")
    devices       = relationship("Device",       back_populates="employee", lazy="dynamic")
    calls         = relationship("Call",         back_populates="employee", lazy="dynamic")
    leads         = relationship("Lead",         back_populates="employee", lazy="dynamic")
    opportunities = relationship("Opportunity",  back_populates="employee", lazy="dynamic")

    __table_args__ = (
        Index("ix_employees_org_code", "organization_id", "employee_code", unique=True),
    )
