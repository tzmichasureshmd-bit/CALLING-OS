from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from ..database import Base


class Plan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(50), primary_key=True, server_default=text("gen_random_uuid()::text"))
    name = Column(String(80), nullable=False, unique=True)
    member_limit = Column(Integer, nullable=False)
    application_access = Column(JSON, nullable=False, default=lambda: {"desktop": True, "mobile": True})
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    prices = relationship("PlanPrice", back_populates="plan", lazy="selectin")
    subscriptions = relationship("OrganizationSubscription", back_populates="plan")


class PlanPrice(Base):
    __tablename__ = "subscription_plan_prices"

    id = Column(String(50), primary_key=True, server_default=text("gen_random_uuid()::text"))
    plan_id = Column(String(50), ForeignKey("subscription_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    duration = Column(String(20), nullable=False)
    regular_price = Column(Numeric(12, 2), nullable=False)
    selling_price = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    tax_configuration = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
    effective_from = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    effective_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    plan = relationship("Plan", back_populates="prices")
    subscriptions = relationship("OrganizationSubscription", back_populates="plan_price")

    __table_args__ = (
        UniqueConstraint("plan_id", "duration", name="uq_subscription_plan_price_duration"),
        Index("ix_subscription_plan_prices_active", "is_active", "effective_from"),
    )


class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"

    id = Column(String(50), primary_key=True, server_default=text("gen_random_uuid()::text"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(String(50), ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False)
    plan_price_id = Column(String(50), ForeignKey("subscription_plan_prices.id", ondelete="RESTRICT"), nullable=False)
    subscription_status = Column(String(30), nullable=False, default="pending", index=True)
    member_limit = Column(Integer, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    auto_renew = Column(Boolean, nullable=False, default=False)
    payment_status = Column(String(30), nullable=False, default="pending")
    provider_subscription_id = Column(String(150), nullable=True, unique=True)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="subscriptions")
    plan = relationship("Plan", back_populates="subscriptions")
    plan_price = relationship("PlanPrice", back_populates="subscriptions")
    payments = relationship("Payment", back_populates="subscription")

    __table_args__ = (
        Index("ix_org_subscriptions_current", "organization_id", "subscription_status"),
    )


class Payment(Base):
    __tablename__ = "subscription_payments"

    id = Column(String(50), primary_key=True, server_default=text("gen_random_uuid()::text"))
    organization_id = Column(String(50), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(String(50), ForeignKey("organization_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_provider = Column(String(40), nullable=False, default="unconfigured")
    provider_order_id = Column(String(150), nullable=False, unique=True)
    provider_payment_id = Column(String(150), nullable=True, unique=True)
    provider_event_id = Column(String(150), nullable=True, unique=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    payment_status = Column(String(30), nullable=False, default="pending", index=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    raw_payload = Column(JSON, nullable=False, default=dict)
    idempotency_key = Column(String(150), nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization")
    subscription = relationship("OrganizationSubscription", back_populates="payments")

    __table_args__ = (
        Index("ix_subscription_payments_org_status", "organization_id", "payment_status"),
    )
