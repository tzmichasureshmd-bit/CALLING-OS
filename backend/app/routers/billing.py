from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Employee, Invoice, Organization, User

router = APIRouter(tags=["billing"])

VALID_COUPONS = {
    "CALLOS20": {"discount_pct": 20, "description": "20% off your first month"},
    "LAUNCH50": {"discount_pct": 50, "description": "50% off — Launch offer"},
    "TZMICHA":  {"discount_pct": 100, "description": "Full discount — internal use"},
}


@router.get("/subscriptions/current")
def current_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    employees = db.query(Employee).filter(
        Employee.organization_id == user.organization_id,
        Employee.status == "active",
    ).count()
    # Normalise plan — free/trial/null all treated as starter
    raw_plan = org.plan or "starter"
    plan = raw_plan if raw_plan in ("starter", "growth") else "starter"
    per_user = 500 if plan == "growth" else 100
    monthly_total = per_user if plan == "growth" else employees * per_user
    return {
        "status": "active",
        "plan": plan,
        "users": employees,
        "per_user": per_user,
        "monthly_total": monthly_total,
        "billing_cycle": "monthly",
        "currency": "INR",
        "max_employees": 100 if plan == "starter" else None,
    }


class SelectPlanBody(BaseModel):
    plan: str
    billing_cycle: str = "monthly"


@router.post("/subscriptions/select-plan")
def select_plan(body: SelectPlanBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.plan not in ("starter", "growth"):
        raise HTTPException(400, "Invalid plan. Choose 'starter' or 'growth'.")
    if body.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(400, "Invalid billing_cycle. Choose 'monthly' or 'yearly'.")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    org.plan = body.plan
    db.commit()
    trial_days = 4 if body.billing_cycle == "yearly" else 0
    return {"ok": True, "plan": body.plan, "billing_cycle": body.billing_cycle, "trial_days": trial_days}


class CouponBody(BaseModel):
    code: str


@router.post("/subscriptions/apply-coupon")
def apply_coupon(body: CouponBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    code = body.code.strip().upper()
    if code not in VALID_COUPONS:
        raise HTTPException(400, "Invalid or expired coupon code.")
    info = VALID_COUPONS[code]
    return {"ok": True, "code": code, "discount_pct": info["discount_pct"], "message": f"✓ {info['description']}"}


@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = (
        db.query(Invoice)
        .filter(Invoice.organization_id == user.organization_id)
        .order_by(Invoice.issued_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": item.invoice_number,
                "invoice_id": item.id,
                "period": item.period,
                "users": item.users,
                "per_user": float(item.per_user),
                "amount": item.amount,
                "currency": item.currency,
                "status": item.status,
                "date": item.issued_at,
            }
            for item in items
        ],
        "total": len(items),
    }
