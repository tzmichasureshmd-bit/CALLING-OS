from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from .. import audit
from ..auth import get_current_user, require_role
from ..config import settings
from ..database import get_db
from ..models import (
    Employee,
    Invoice,
    Organization,
    OrganizationSubscription,
    Payment,
    Plan,
    PlanPrice,
    User,
)
from ..billing_service import (
    ACTIVE_SUBSCRIPTION_STATES,
    DURATION_MONTHS,
    activate_verified_payment,
    add_months,
    active_member_count,
    current_subscription,
    enforce_member_limit,
    money,
    normalize_duration,
    price_quote,
    serialize_plan,
    utc_now,
)

router = APIRouter(tags=["billing"])


class CheckoutRequest(BaseModel):
    plan_id: Optional[str] = None
    plan: Optional[str] = None
    duration: str = "1_month"
    idempotency_key: Optional[str] = Field(default=None, max_length=150)


class PaymentVerifyRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str


class RenewRequest(BaseModel):
    duration: Optional[str] = None
    idempotency_key: Optional[str] = Field(default=None, max_length=150)


class ChangePlanRequest(BaseModel):
    plan_id: str
    duration: str = "1_month"
    idempotency_key: Optional[str] = Field(default=None, max_length=150)


class CouponBody(BaseModel):
    code: str


class PlanCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    member_limit: int = Field(gt=0, le=100000)
    application_access: dict[str, bool] = {"desktop": True, "mobile": True}
    is_active: bool = True


class PlanUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    member_limit: Optional[int] = Field(default=None, gt=0, le=100000)
    application_access: Optional[dict[str, bool]] = None
    is_active: Optional[bool] = None


class PlanPriceUpdateRequest(BaseModel):
    regular_price: Optional[float] = Field(default=None, ge=0)
    selling_price: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=10)
    tax_configuration: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class ExtendSubscriptionRequest(BaseModel):
    months: int = Field(gt=0, le=120)
    reason: str = Field(min_length=3, max_length=500)


class SuspendSubscriptionRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


VALID_COUPONS = {
    "CALLOS20": {"discount_pct": 20, "description": "20% off your first month"},
    "LAUNCH50": {"discount_pct": 50, "description": "50% off — Launch offer"},
    "TZMICHA": {"discount_pct": 100, "description": "Full discount — internal use"},
}


def _require_billing_admin(user: User = Depends(require_role("ADMIN"))) -> User:
    return user


def _require_super(user: User = Depends(get_current_user)) -> User:
    if (user.role or "").upper() != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


def _plan_query(db: Session, plan_ref: Optional[str], *, active_only: bool = True) -> Plan:
    if not plan_ref:
        raise HTTPException(status_code=400, detail="plan_id or plan is required")
    query = db.query(Plan).options(joinedload(Plan.prices))
    if plan_ref in {"Starter", "Growth", "Professional", "Business", "starter", "growth", "professional", "business"}:
        query = query.filter(Plan.name.ilike(plan_ref))
    else:
        query = query.filter(Plan.id == plan_ref)
    if active_only:
        query = query.filter(Plan.is_active.is_(True))
    plan = query.first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return plan


def _price_for(db: Session, plan: Plan, duration: str) -> PlanPrice:
    normalized = normalize_duration(duration)
    now = utc_now()
    price = db.query(PlanPrice).filter(
        PlanPrice.plan_id == plan.id,
        PlanPrice.duration == normalized,
        PlanPrice.is_active.is_(True),
        PlanPrice.effective_from <= now,
        (PlanPrice.effective_until.is_(None) | (PlanPrice.effective_until > now)),
    ).order_by(PlanPrice.effective_from.desc()).first()
    if not price:
        raise HTTPException(status_code=404, detail="No active price is configured for this plan and duration")
    return price


def _subscription_item(item: OrganizationSubscription, db: Session) -> dict:
    members = active_member_count(db, item.organization_id)
    expiry = item.expiry_date
    days_remaining = max((expiry - utc_now()).days, 0) if expiry else None
    status_value = item.subscription_status
    if status_value == "active" and days_remaining is not None and days_remaining <= 7:
        status_value = "expiring_soon"
    quote = price_quote(item.plan_price)
    return {
        "id": item.id,
        "plan": serialize_plan(item.plan, include_prices=False),
        "plan_price": {"id": item.plan_price.id, "duration": item.plan_price.duration, **{k: float(v) if hasattr(v, "as_tuple") else v for k, v in quote.items()}},
        "status": status_value,
        "subscription_status": status_value,
        "member_limit": item.member_limit,
        "active_members": members,
        "available_seats": max(item.member_limit - members, 0),
        "start_date": item.start_date,
        "expiry_date": item.expiry_date,
        "days_remaining": days_remaining,
        "auto_renew": item.auto_renew,
        "payment_status": item.payment_status,
        "cancel_at_period_end": item.cancel_at_period_end,
    }


def _invoice_item(item: Invoice) -> dict:
    return {
        "id": item.invoice_number,
        "invoice_id": item.id,
        "organization_id": item.organization_id,
        "period": item.period,
        "users": item.users,
        "per_user": float(item.per_user or 0),
        "amount": float(item.total_amount if item.total_amount is not None else item.amount),
        "currency": item.currency,
        "status": item.invoice_status or item.status or "paid",
        "invoice_status": item.invoice_status or item.status or "paid",
        "date": item.issued_at,
        "invoice_date": item.issued_at,
        "due_date": item.due_date,
        "plan_name": item.plan_name,
        "duration": item.duration,
        "regular_price": float(item.regular_price or 0),
        "selling_price": float(item.selling_price or 0),
        "subtotal": float(item.subtotal if item.subtotal is not None else item.amount),
        "tax_amount": float(item.tax_amount or 0),
        "discount_amount": float(item.discount_amount or 0),
        "total_amount": float(item.total_amount if item.total_amount is not None else item.amount),
        "payment_reference": item.payment_reference,
        "subscription_start_date": item.subscription_start_date,
        "subscription_expiry_date": item.subscription_expiry_date,
    }


def _payment_item(item: Payment) -> dict:
    return {
        "id": item.id,
        "subscription_id": item.subscription_id,
        "provider": item.payment_provider,
        "provider_order_id": item.provider_order_id,
        "provider_payment_id": item.provider_payment_id,
        "amount": float(item.amount),
        "currency": item.currency,
        "status": item.payment_status,
        "verified_at": item.verified_at,
        "created_at": item.created_at,
    }


def _provider_ready() -> bool:
    return settings.PAYMENT_TEST_MODE or settings.PAYMENT_PROVIDER.lower() not in {"", "unconfigured", "none"}


def _expected_signature(order_id: str, payment_id: str, status_value: str = "succeeded") -> str:
    secret = settings.PAYMENT_WEBHOOK_SECRET or settings.JWT_SECRET_KEY
    payload = f"{order_id}|{payment_id}|{status_value}".encode()
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def _checkout(db: Session, body: CheckoutRequest, user: User) -> dict:
    plan = _plan_query(db, body.plan_id or body.plan)
    price = _price_for(db, plan, body.duration)
    if body.idempotency_key:
        existing = db.query(Payment).filter(Payment.idempotency_key == body.idempotency_key, Payment.organization_id == user.organization_id).first()
        if existing:
            subscription = db.query(OrganizationSubscription).filter(OrganizationSubscription.id == existing.subscription_id).first()
            return {"status": "existing", "payment": _payment_item(existing), "subscription": _subscription_item(subscription, db)}

    active_members = active_member_count(db, user.organization_id)
    if active_members > plan.member_limit:
        raise HTTPException(status_code=409, detail=f"This organization already has {active_members} active members; the selected package allows {plan.member_limit}.")

    quote = price_quote(price)
    subscription = OrganizationSubscription(
        id=str(uuid.uuid4()), organization_id=user.organization_id, plan_id=plan.id,
        plan_price_id=price.id, subscription_status="pending", member_limit=plan.member_limit,
        payment_status="pending", auto_renew=False,
    )
    db.add(subscription)
    db.flush()
    payment = Payment(
        id=str(uuid.uuid4()), organization_id=user.organization_id, subscription_id=subscription.id,
        payment_provider=settings.PAYMENT_PROVIDER or "unconfigured",
        provider_order_id=f"CNX-ORDER-{uuid.uuid4().hex.upper()}", amount=quote["total_amount"],
        currency=quote["currency"], payment_status="pending", idempotency_key=body.idempotency_key,
    )
    db.add(payment)
    audit.log(db, organization_id=user.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="subscription", resource_id=subscription.id, metadata={"action": "checkout_created", "plan": plan.name, "duration": price.duration, "amount": str(quote["total_amount"])})
    db.commit()
    return {
        "status": "pending" if _provider_ready() else "payment_provider_unconfigured",
        "payment_required": True,
        "provider_configured": _provider_ready(),
        "payment": _payment_item(payment),
        "subscription": _subscription_item(subscription, db),
        "order_summary": {"plan": plan.name, "member_limit": plan.member_limit, "duration": price.duration, **{k: float(v) if hasattr(v, "as_tuple") else v for k, v in quote.items()}},
    }


@router.get("/subscription/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(Plan).options(joinedload(Plan.prices)).filter(Plan.is_active.is_(True)).order_by(Plan.member_limit.asc()).all()
    return {"items": [serialize_plan(plan) for plan in plans]}


@router.get("/subscription/plans/{plan_id}")
def get_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = _plan_query(db, plan_id)
    return serialize_plan(plan)


@router.get("/subscription/current")
@router.get("/subscriptions/current")
def get_current_subscription(db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    item = current_subscription(db, user.organization_id)
    if not item or item.subscription_status == "pending":
        return {"status": "not_configured", "plan": None, "users": active_member_count(db, user.organization_id), "active_members": active_member_count(db, user.organization_id), "available_seats": None, "member_limit": None, "currency": settings.PAYMENT_CURRENCY}
    return _subscription_item(item, db)


@router.post("/subscription/checkout")
def create_checkout(body: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    return _checkout(db, body, user)


@router.post("/subscriptions/select-plan")
def select_plan_compat(body: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    return _checkout(db, body, user)


@router.post("/subscription/payment/verify")
def verify_payment(body: PaymentVerifyRequest, db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    if not _provider_ready():
        raise HTTPException(status_code=503, detail="Payment provider is not configured. No payment was activated.")
    payment = db.query(Payment).filter(Payment.provider_order_id == body.order_id, Payment.organization_id == user.organization_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found")
    expected = _expected_signature(body.order_id, body.payment_id)
    if not hmac.compare_digest(expected, body.signature):
        payment.payment_status = "verification_failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Payment signature verification failed")
    payment, subscription, invoice = activate_verified_payment(db, payment, provider_payment_id=body.payment_id, raw_payload={"source": "verify"})
    audit.log(db, organization_id=user.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="subscription", resource_id=subscription.id, metadata={"action": "payment_verified", "payment_id": body.payment_id})
    db.commit()
    return {"status": "active", "subscription": _subscription_item(subscription, db), "invoice": _invoice_item(invoice) if invoice else None}


@router.post("/subscription/webhook")
def payment_webhook(payload: dict, request: Request, db: Session = Depends(get_db)):
    if not _provider_ready():
        raise HTTPException(status_code=503, detail="Payment provider is not configured")
    order_id = str(payload.get("order_id") or "")
    payment_id = str(payload.get("payment_id") or "")
    status_value = str(payload.get("status") or "pending").lower()
    signature = request.headers.get("x-callnexa-signature") or str(payload.get("signature") or "")
    event_id = str(payload.get("event_id") or "") or None
    if not order_id or not payment_id or not signature or not hmac.compare_digest(_expected_signature(order_id, payment_id, status_value), signature):
        raise HTTPException(status_code=400, detail="Invalid payment webhook signature")
    payment = db.query(Payment).filter(Payment.provider_order_id == order_id).with_for_update().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment order not found")
    if event_id and payment.provider_event_id == event_id:
        return {"status": "already_processed"}
    if payment.payment_status == "succeeded":
        return {"status": "already_processed"}
    payment.provider_event_id = event_id
    if status_value in {"failed", "cancelled", "canceled"}:
        payment.payment_status = "failed" if status_value == "failed" else "cancelled"
        subscription = db.query(OrganizationSubscription).filter(OrganizationSubscription.id == payment.subscription_id).first()
        if subscription:
            subscription.subscription_status = "payment_failed"
            subscription.payment_status = payment.payment_status
        db.commit()
        return {"status": payment.payment_status}
    if status_value != "succeeded":
        payment.payment_status = "pending"
        db.commit()
        return {"status": "pending"}
    payment, subscription, invoice = activate_verified_payment(db, payment, provider_payment_id=payment_id, raw_payload=payload)
    audit.log(db, organization_id=payment.organization_id, action=audit.SUBSCRIPTION_CHANGE, resource="subscription", resource_id=subscription.id, metadata={"action": "webhook_verified", "event_id": event_id})
    db.commit()
    return {"status": "active", "subscription_id": subscription.id, "invoice_id": invoice.id if invoice else None}


@router.get("/subscription/payments")
def list_payments(db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    items = db.query(Payment).filter(Payment.organization_id == user.organization_id).order_by(Payment.created_at.desc()).all()
    return {"items": [_payment_item(item) for item in items], "total": len(items)}


@router.post("/subscription/renew")
def renew_subscription(body: RenewRequest, db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    current = current_subscription(db, user.organization_id)
    if not current:
        raise HTTPException(status_code=404, detail="No subscription to renew")
    return _checkout(db, CheckoutRequest(plan_id=current.plan_id, duration=body.duration or current.plan_price.duration, idempotency_key=body.idempotency_key), user)


@router.post("/subscription/change-plan")
def change_plan(body: ChangePlanRequest, db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    return _checkout(db, CheckoutRequest(plan_id=body.plan_id, duration=body.duration, idempotency_key=body.idempotency_key), user)


@router.get("/subscription/usage")
def subscription_usage(db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    current = current_subscription(db, user.organization_id)
    active = active_member_count(db, user.organization_id)
    return {"active_members": active, "member_limit": current.member_limit if current else None, "available_seats": max(current.member_limit - active, 0) if current else None, "subscription_status": current.subscription_status if current else "not_configured"}


@router.post("/subscriptions/apply-coupon")
def apply_coupon(body: CouponBody, user: User = Depends(_require_billing_admin)):
    code = body.code.strip().upper()
    if code not in VALID_COUPONS:
        raise HTTPException(status_code=400, detail="Invalid or expired coupon code.")
    info = VALID_COUPONS[code]
    return {"ok": True, "code": code, "discount_pct": info["discount_pct"], "message": f"✓ {info['description']}"}


@router.get("/subscription/invoices")
@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    items = db.query(Invoice).filter(Invoice.organization_id == user.organization_id).order_by(Invoice.issued_at.desc()).all()
    return {"items": [_invoice_item(item) for item in items], "total": len(items)}


@router.get("/subscription/invoices/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db), user: User = Depends(_require_billing_admin)):
    item = db.query(Invoice).filter(Invoice.organization_id == user.organization_id, (Invoice.id == invoice_id) | (Invoice.invoice_number == invoice_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _invoice_item(item)


# ── Super Admin billing management ────────────────────────────────────────────

@router.get("/admin/plans")
def admin_list_plans(db: Session = Depends(get_db), user: User = Depends(_require_super)):
    plans = db.query(Plan).options(joinedload(Plan.prices)).order_by(Plan.member_limit.asc()).all()
    return {"items": [serialize_plan(plan) for plan in plans]}


@router.post("/admin/plans")
def admin_create_plan(body: PlanCreateRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(_require_super)):
    if db.query(Plan).filter(Plan.name.ilike(body.name.strip())).first():
        raise HTTPException(status_code=409, detail="Plan name already exists")
    plan = Plan(name=body.name.strip(), member_limit=body.member_limit, application_access=body.application_access, is_active=body.is_active)
    db.add(plan)
    db.flush()
    audit.log(db, organization_id=user.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="plan", resource_id=plan.id, metadata={"action": "plan_created", "name": plan.name}, request=request)
    db.commit()
    return serialize_plan(plan)


@router.patch("/admin/plans/{plan_id}")
def admin_update_plan(plan_id: str, body: PlanUpdateRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(_require_super)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    audit.log(db, organization_id=user.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="plan", resource_id=plan.id, metadata={"action": "plan_updated", "changes": body.model_dump(exclude_none=True)}, request=request)
    db.commit()
    return serialize_plan(plan)


@router.patch("/admin/plan-prices/{price_id}")
def admin_update_price(price_id: str, body: PlanPriceUpdateRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(_require_super)):
    price = db.query(PlanPrice).filter(PlanPrice.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Plan price not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(price, field, money(value) if field in {"regular_price", "selling_price"} else value)
    audit.log(db, organization_id=user.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="plan_price", resource_id=price.id, metadata={"action": "price_updated", "changes": body.model_dump(exclude_none=True)}, request=request)
    db.commit()
    return {"id": price.id, "plan_id": price.plan_id, "duration": price.duration, "regular_price": float(price.regular_price), "selling_price": float(price.selling_price), "currency": price.currency, "is_active": price.is_active}


@router.get("/admin/subscriptions")
def admin_list_subscriptions(db: Session = Depends(get_db), user: User = Depends(_require_super)):
    items = db.query(OrganizationSubscription).options(joinedload(OrganizationSubscription.plan), joinedload(OrganizationSubscription.plan_price)).order_by(OrganizationSubscription.created_at.desc()).all()
    return {"items": [{**_subscription_item(item, db), "organization_id": item.organization_id} for item in items], "total": len(items)}


@router.post("/admin/subscriptions/{subscription_id}/extend")
def admin_extend_subscription(subscription_id: str, body: ExtendSubscriptionRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(_require_super)):
    item = db.query(OrganizationSubscription).filter(OrganizationSubscription.id == subscription_id).with_for_update().first()
    if not item:
        raise HTTPException(status_code=404, detail="Subscription not found")
    base = item.expiry_date or utc_now()
    item.expiry_date = add_months(base, body.months)
    if item.subscription_status in {"expired", "suspended", "payment_failed"}:
        item.subscription_status = "active"
    item.payment_status = "paid"
    audit.log(db, organization_id=item.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="subscription", resource_id=item.id, metadata={"action": "subscription_extended", "months": body.months, "reason": body.reason}, request=request)
    db.commit()
    return _subscription_item(item, db)


@router.post("/admin/subscriptions/{subscription_id}/suspend")
def admin_suspend_subscription(subscription_id: str, body: SuspendSubscriptionRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(_require_super)):
    item = db.query(OrganizationSubscription).filter(OrganizationSubscription.id == subscription_id).with_for_update().first()
    if not item:
        raise HTTPException(status_code=404, detail="Subscription not found")
    item.subscription_status = "suspended"
    item.payment_status = "suspended"
    audit.log(db, organization_id=item.organization_id, action=audit.SUBSCRIPTION_CHANGE, actor=user, resource="subscription", resource_id=item.id, metadata={"action": "subscription_suspended", "reason": body.reason}, request=request)
    db.commit()
    return _subscription_item(item, db)
