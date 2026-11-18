from sqlalchemy import Column, String, DateTime, ForeignKey, SmallInteger, Numeric, JSON
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
    subscription_id = Column(String(50), ForeignKey("organization_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    plan_name       = Column(String(80), nullable=True)
    duration        = Column(String(20), nullable=True)
    regular_price   = Column(Numeric(12, 2), nullable=True)
    selling_price   = Column(Numeric(12, 2), nullable=True)
    subtotal        = Column(Numeric(12, 2), nullable=True)
    tax_amount      = Column(Numeric(12, 2), nullable=True)
    discount_amount = Column(Numeric(12, 2), nullable=True)
    total_amount    = Column(Numeric(12, 2), nullable=True)
    invoice_status  = Column(String(30), nullable=True)
    due_date        = Column(DateTime, nullable=True)
    payment_reference = Column(String(150), nullable=True)
    subscription_start_date = Column(DateTime, nullable=True)
    subscription_expiry_date = Column(DateTime, nullable=True)
    billing_details = Column(JSON, nullable=False, default=dict)

    organization = relationship("Organization", back_populates="invoices")
