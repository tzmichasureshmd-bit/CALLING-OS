from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Employee, Invoice, Organization, OrganizationSubscription, Plan, PlanPrice, Payment, User

DURATION_MONTHS = {"1_month": 1, "6_months": 6, "1_year": 12}
ACTIVE_SUBSCRIPTION_STATES = {"trial", "active", "expiring_soon", "payment_failed"}
MONEY = Decimal("0.01")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_duration(value: str) -> str:
    aliases = {
        "monthly": "1_month",
        "month": "1_month",
        "1_month": "1_month",
        "6_months": "6_months",
        "six_months": "6_months",
        "6-months": "6_months",
        "yearly": "1_year",
        "annual": "1_year",
        "1_year": "1_year",
    }
    normalized = aliases.get((value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=400, detail="Duration must be 1_month, 6_months, or 1_year")
    return normalized


def add_months(value: datetime, months: int) -> datetime:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def current_subscription(db: Session, organization_id: str, *, for_update: bool = False) -> Optional[OrganizationSubscription]:
    query = (
        db.query(OrganizationSubscription)
        .filter(
            OrganizationSubscription.organization_id == organization_id,
            OrganizationSubscription.subscription_status.in_(ACTIVE_SUBSCRIPTION_STATES | {"pending"}),
        )
        .order_by(OrganizationSubscription.created_at.desc())
    )
    if for_update:
        query = query.with_for_update()
    return query.first()


def active_member_count(db: Session, organization_id: str) -> int:
    rows = (
        db.query(Employee, User)
        .outerjoin(User, User.id == Employee.user_id)
        .filter(Employee.organization_id == organization_id, Employee.status == "active")
        .all()
    )
    return sum(1 for employee, user in rows if (user.role if user else "EMPLOYEE").upper() != "SUPER_ADMIN")


def enforce_member_limit(db: Session, organization_id: str, *, additional_members: int = 1) -> None:
    # Serialize seat admission for this organization so concurrent signups do
    # not both pass the same seat check.
    db.query(Organization).filter(Organization.id == organization_id).with_for_update().one_or_none()
    subscription = current_subscription(db, organization_id)
    if not subscription or subscription.subscription_status == "pending":
        # Existing organizations created before billing remains legacy/unrestricted
        # until an administrator purchases one of the configured packages.
        return
    active_members = active_member_count(db, organization_id)
    if active_members + additional_members > subscription.member_limit:
        available = max(subscription.member_limit - active_members, 0)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "MEMBER_LIMIT_REACHED",
                "message": f"This subscription allows {subscription.member_limit} active members.",
                "active_members": active_members,
                "member_limit": subscription.member_limit,
                "available_seats": available,
            },
        )


def price_quote(plan_price: PlanPrice) -> dict:
    regular = money(plan_price.regular_price)
    selling = money(plan_price.selling_price)
    tax_config = plan_price.tax_configuration or {}
    tax_rate = money(tax_config.get("rate_percent", 0))
    tax = (selling * tax_rate / Decimal("100")).quantize(MONEY, rounding=ROUND_HALF_UP)
    discount = max(regular - selling, Decimal("0.00"))
    return {
        "regular_price": regular,
        "selling_price": selling,
        "subtotal": selling,
        "discount_amount": discount,
        "tax_amount": tax,
        "total_amount": selling + tax,
        "currency": plan_price.currency,
        "tax_rate_percent": tax_rate,
    }


def serialize_plan(plan: Plan, *, include_prices: bool = True) -> dict:
    result = {
        "id": plan.id,
        "name": plan.name,
        "member_limit": plan.member_limit,
        "application_access": plan.application_access or {"desktop": True, "mobile": True},
        "is_active": plan.is_active,
    }
    if include_prices:
        result["prices"] = [
            {
                "id": price.id,
                "duration": price.duration,
                "regular_price": float(price.regular_price),
                "selling_price": float(price.selling_price),
                "currency": price.currency,
                "tax_configuration": price.tax_configuration or {},
                "is_active": price.is_active,
            }
            for price in sorted(plan.prices or [], key=lambda item: (item.duration, item.effective_from))
            if price.is_active
        ]
    return result


def create_invoice(db: Session, subscription: OrganizationSubscription, payment: Payment, now: datetime) -> Invoice:
    quote = price_quote(subscription.plan_price)
    invoice = Invoice(
        id=str(uuid.uuid4()),
        invoice_number=f"CNX-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
        organization_id=subscription.organization_id,
        subscription_id=subscription.id,
        period=subscription.plan_price.duration,
        users=subscription.member_limit,
        per_user=quote["selling_price"],
        amount=quote["total_amount"],
        currency=quote["currency"],
        status="Paid",
        issued_at=now,
        paid_at=now,
        plan_name=subscription.plan.name,
        duration=subscription.plan_price.duration,
        regular_price=quote["regular_price"],
        selling_price=quote["selling_price"],
        subtotal=quote["subtotal"],
        tax_amount=quote["tax_amount"],
        discount_amount=quote["discount_amount"],
        total_amount=quote["total_amount"],
        invoice_status="paid",
        payment_reference=payment.provider_payment_id or payment.provider_order_id,
        subscription_start_date=subscription.start_date,
        subscription_expiry_date=subscription.expiry_date,
        billing_details={"currency": quote["currency"], "tax_rate_percent": float(quote["tax_rate_percent"])},
    )
    db.add(invoice)
    return invoice


def activate_verified_payment(db: Session, payment: Payment, *, provider_payment_id: str, raw_payload: Optional[dict] = None) -> tuple[Payment, OrganizationSubscription, Optional[Invoice]]:
    payment = db.query(Payment).filter(Payment.id == payment.id).with_for_update().one()
    if payment.payment_status == "succeeded":
        subscription = db.query(OrganizationSubscription).filter(OrganizationSubscription.id == payment.subscription_id).one()
        invoice = db.query(Invoice).filter(Invoice.payment_reference == payment.provider_payment_id).first()
        return payment, subscription, invoice

    subscription = (
        db.query(OrganizationSubscription)
        .filter(OrganizationSubscription.id == payment.subscription_id)
        .with_for_update()
        .one_or_none()
    )
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription order not found")
    old_subscriptions = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == subscription.organization_id,
        OrganizationSubscription.id != subscription.id,
        OrganizationSubscription.subscription_status.in_(ACTIVE_SUBSCRIPTION_STATES),
    ).with_for_update().all()
    now = utc_now()
    for old in old_subscriptions:
        old.subscription_status = "cancelled"
        old.cancel_at_period_end = False

    subscription.start_date = now
    subscription.expiry_date = add_months(now, DURATION_MONTHS[subscription.plan_price.duration])
    subscription.subscription_status = "active"
    subscription.payment_status = "paid"
    payment.provider_payment_id = provider_payment_id
    payment.payment_status = "succeeded"
    payment.verified_at = now
    if raw_payload is not None:
        payment.raw_payload = raw_payload
    invoice = create_invoice(db, subscription, payment, now)
    return payment, subscription, invoice
