from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Employee, Invoice, Organization, User

router = APIRouter(tags=["billing"])

TRIAL_DAYS = 14
TRIAL_MAX_EMPLOYEES = 10
VALID_COUPONS = {
    "CALLOS20": {"discount_pct": 20, "description": "20% off your first month"},
    "LAUNCH50": {"discount_pct": 50, "description": "50% off — Launch offer"},
    "TZMICHA":  {"discount_pct": 100, "description": "Full discount — internal use"},
}


def _trial_info(org: Organization):
    created = org.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    trial_end = created + timedelta(days=TRIAL_DAYS)
    now = datetime.now(timezone.utc)
    days_left = max(0, (trial_end - now).days)
    is_trial = org.plan in (None, "free", "trial") and now < trial_end
    return is_trial, days_left, trial_end.strftime("%B %d, %Y")


@router.get("/subscriptions/current")
def current_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    employees = db.query(Employee).filter(
        Employee.organization_id == user.organization_id,
        Employee.status == "active",
    ).count()
    is_trial, days_left, trial_ends_on = _trial_info(org)
    plan = org.plan or "trial"
    per_user = 500 if plan == "growth" else 100
    return {
        "status": "active",
        "plan": plan,
        "is_trial": is_trial,
        "trial_days_left": days_left,
        "trial_ends_on": trial_ends_on,
        "trial_max_employees": TRIAL_MAX_EMPLOYEES,
        "users": employees,
        "per_user": per_user,
        "billing_cycle": "monthly",
        "currency": "INR",
        "max_employees": TRIAL_MAX_EMPLOYEES if is_trial else (100 if plan == "starter" else None),
    }


class SelectPlanBody(BaseModel):
    plan: str


@router.post("/subscriptions/select-plan")
def select_plan(body: SelectPlanBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.plan not in ("starter", "growth"):
        raise HTTPException(400, "Invalid plan. Choose 'starter' or 'growth'.")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    org.plan = body.plan
    db.commit()
    return {"ok": True, "plan": body.plan}


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
