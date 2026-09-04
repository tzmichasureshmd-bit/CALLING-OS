from sqlalchemy import Column, String, DateTime, ForeignKey, SmallInteger, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id              = Column(String(50), primary_key=True)
    invoice_number  = Column(String(50), unique=True, nullable=False)
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    period          = Column(String(30))
    users           = Column(SmallInteger, default=1)
    per_user        = Column(Numeric(8, 2), default=99)
    amount          = Column(Numeric(10, 2), nullable=False)
    currency        = Column(String(10), default="INR")
    status          = Column(String(20), default="Paid")
    issued_at       = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    paid_at         = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="invoices")
