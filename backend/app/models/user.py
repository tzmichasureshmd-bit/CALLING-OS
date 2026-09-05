from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(String(50), primary_key=True, server_default=text("generate_prefixed_id('tzm','usr')"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    email           = Column(String(200), nullable=False)
    password_hash   = Column(String(200), nullable=True)
    google_id       = Column(String(200), nullable=True, unique=True)
    role            = Column(String(30),  default="EMPLOYEE")
    status          = Column(String(20),  default="active")
    totp_secret     = Column(String(64),  nullable=True)
    totp_enabled    = Column(Boolean,     default=False)
    last_login_at   = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="users")
    employee     = relationship("Employee", back_populates="user", uselist=False)

    __table_args__ = (
        Index("ix_users_org_email", "organization_id", "email", unique=True),
    )
