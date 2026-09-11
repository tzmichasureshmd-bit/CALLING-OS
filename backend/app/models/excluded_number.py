from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class ExcludedNumber(Base):
    __tablename__ = "excluded_numbers"

    id              = Column(String(50), primary_key=True, default=lambda: str(__import__("uuid").uuid4()))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    added_by_id     = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    number          = Column(String(30), nullable=False)
    reason          = Column(String(200))
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="excluded_numbers")

    __table_args__ = (
        Index("ix_excluded_org_number", "organization_id", "number", unique=True),
    )
