from sqlalchemy import Column, String, SmallInteger, DateTime, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id              = Column(String(50),  primary_key=True, server_default=text("generate_prefixed_id('tzm','org')"))
    tenant_prefix   = Column(String(3),   nullable=False)
    name            = Column(String(200), nullable=False)
    slug            = Column(String(200), unique=True, nullable=False)
    code            = Column(String(50),  unique=True, nullable=False, index=True)
    email           = Column(String(200))
    phone           = Column(String(30))
    industry        = Column(String(100))
    team_size       = Column(SmallInteger)
    timezone        = Column(String(60),  default="Asia/Kolkata")
    plan            = Column(String(30),  default="free")
    status          = Column(String(20),  default="active")
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    users            = relationship("User",           back_populates="organization", lazy="dynamic")
    employees        = relationship("Employee",       back_populates="organization", lazy="dynamic")
    devices          = relationship("Device",         back_populates="organization", lazy="dynamic")
    calls            = relationship("Call",           back_populates="organization", lazy="dynamic")
    leads            = relationship("Lead",           back_populates="organization", lazy="dynamic")
    opportunities    = relationship("Opportunity",    back_populates="organization", lazy="dynamic")
    excluded_numbers = relationship("ExcludedNumber", back_populates="organization", lazy="dynamic")
    invoices         = relationship("Invoice",        back_populates="organization", lazy="dynamic")
