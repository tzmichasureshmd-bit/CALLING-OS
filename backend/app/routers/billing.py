from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Employee, Invoice, User

router = APIRouter(tags=["billing"])


@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.query(Invoice).filter(Invoice.organization_id == user.organization_id).order_by(Invoice.issued_at.desc()).all()
    return {"items": [{"id": item.invoice_number, "invoice_id": item.id, "period": item.period, "users": item.users, "per_user": item.per_user, "amount": item.amount, "currency": item.currency, "status": item.status, "date": item.issued_at} for item in items], "total": len(items)}


@router.get("/subscriptions/current")
def current_subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    users = db.query(Employee).filter(Employee.organization_id == user.organization_id, Employee.status == "active").count()
    return {"status": "active", "plan": "CallNexa", "users": users, "per_user": 99, "billing_cycle": "monthly", "currency": "INR"}
