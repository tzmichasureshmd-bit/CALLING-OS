from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Call, Customer, Employee, FollowUp, Lead, Opportunity, User

router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])


class FollowUpCreate(BaseModel):
    title: str
    description: Optional[str] = None
    follow_up_type: str = "call"
    due_at: datetime
    call_id: Optional[str] = None
    lead_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    employee_id: Optional[str] = None
    customer_id: Optional[str] = None
    idempotency_key: Optional[str] = None


class FollowUpUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    follow_up_type: Optional[str] = None
    due_at: Optional[datetime] = None
    status: Optional[str] = None
    employee_id: Optional[str] = None
    customer_id: Optional[str] = None


def _employee_for_user(db: Session, user: User):
    return db.query(Employee).filter(
        Employee.user_id == user.id,
        Employee.organization_id == user.organization_id,
        Employee.status == "active",
    ).first()


def _scope_employee_id(db: Session, user: User, requested: Optional[str] = None):
    if (user.role or "").upper() == "EMPLOYEE":
        employee = _employee_for_user(db, user)
        if not employee:
            raise HTTPException(status_code=403, detail="Active employee profile required")
        if requested and requested != employee.id:
            raise HTTPException(status_code=403, detail="Follow-up belongs to another employee")
        return employee.id
    if requested and not db.query(Employee).filter(
        Employee.id == requested,
        Employee.organization_id == user.organization_id,
        Employee.status == "active",
    ).first():
        raise HTTPException(status_code=404, detail="Employee not found")
    return requested


def _scope_customer(db: Session, user: User, customer_id: Optional[str]):
    if not customer_id:
        return None
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.organization_id == user.organization_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if (user.role or "").upper() == "EMPLOYEE":
        employee = _employee_for_user(db, user)
        if not employee or customer.employee_id not in (None, employee.id):
            raise HTTPException(status_code=403, detail="Customer belongs to another employee")
    return customer_id


def _item(item: FollowUp, db: Session = None):
    employee = item.employee if item.employee and item.employee.organization_id == item.organization_id else None
    customer = item.customer if item.customer and item.customer.organization_id == item.organization_id else None

    # Fetch linked call for contact name + phone
    call = None
    if item.call_id and db:
        call = db.query(Call).filter(Call.id == item.call_id).first()

    # Resolve who created it — employee name OR creator user name
    creator_name = None
    if not employee and item.created_by and db:
        creator = db.query(User).filter(User.id == item.created_by).first()
        if creator:
            # Try to get their employee profile name first
            emp_profile = db.query(Employee).filter(
                Employee.user_id == creator.id,
                Employee.organization_id == item.organization_id,
            ).first()
            creator_name = emp_profile.name if emp_profile else (creator.email or "Admin")

    contact_name  = (customer.name  if customer else None) or (call.contact_name  if call else None)
    contact_phone = (customer.phone if customer else None) or (call.phone_number  if call else None)

    return {
        "id": item.id,
        "organization_id": item.organization_id,
        "employee_id": item.employee_id,
        "employee_name": (employee.name if employee else None) or creator_name,
        "created_by_name": creator_name,
        "customer_id": customer.id if customer else None,
        "contact_name":  contact_name,
        "contact_phone": contact_phone,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "company": customer.company,
        } if customer else None,
        "call_id": item.call_id,
        "call_info": {
            "contact_name": call.contact_name,
            "phone_number": call.phone_number,
            "call_type":    call.call_type,
        } if call else None,
        "lead_id": item.lead_id,
        "opportunity_id": item.opportunity_id,
        "title": item.title,
        "description": item.description,
        "follow_up_type": item.follow_up_type,
        "due_at": item.due_at,
        "status": item.status,
        "completed_at": item.completed_at,
        "cancelled_at": item.cancelled_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.get("")
def list_follow_ups(
    status: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee_id = _scope_employee_id(db, user, employee_id)
    query = db.query(FollowUp).filter(FollowUp.organization_id == user.organization_id)
    if employee_id:
        query = query.filter(FollowUp.employee_id == employee_id)
    if status:
        query = query.filter(FollowUp.status == status)
    items = query.order_by(FollowUp.due_at.asc()).limit(500).all()
    return {"items": [_item(item, db) for item in items], "total": len(items)}


@router.post("", status_code=201)
def create_follow_up(
    body: FollowUpCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee_id = _scope_employee_id(db, user, body.employee_id)
    customer_id = _scope_customer(db, user, body.customer_id)
    if body.idempotency_key:
        existing = db.query(FollowUp).filter(
            FollowUp.organization_id == user.organization_id,
            FollowUp.idempotency_key == body.idempotency_key,
        ).first()
        if existing:
            _scope_customer(db, user, existing.customer_id)
            return _item(existing, db)
    for model, record_id, label in ((Call, body.call_id, "Call"), (Lead, body.lead_id, "Lead"), (Opportunity, body.opportunity_id, "Opportunity")):
        if record_id and not db.query(model).filter(model.id == record_id, model.organization_id == user.organization_id).first():
            raise HTTPException(status_code=404, detail=f"{label} not found")
    item = FollowUp(
        organization_id=user.organization_id,
        employee_id=employee_id,
        created_by=user.id,
        title=body.title.strip(),
        description=body.description,
        follow_up_type=body.follow_up_type,
        due_at=body.due_at,
        call_id=body.call_id,
        lead_id=body.lead_id,
        opportunity_id=body.opportunity_id,
        customer_id=customer_id,
        idempotency_key=body.idempotency_key,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item(item, db)


@router.patch("/{follow_up_id}")
def update_follow_up(
    follow_up_id: str,
    body: FollowUpUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(FollowUp).filter(FollowUp.id == follow_up_id, FollowUp.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    _scope_employee_id(db, user, item.employee_id)
    if item.customer_id:
        _scope_customer(db, user, item.customer_id)
    values = body.model_dump(exclude_none=True)
    if "employee_id" in values:
        values["employee_id"] = _scope_employee_id(db, user, values["employee_id"])
    if "customer_id" in values:
        values["customer_id"] = _scope_customer(db, user, values["customer_id"])
    for field, value in values.items():
        setattr(item, field, value)
    if item.status == "completed" and not item.completed_at:
        item.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _item(item, db)


@router.post("/{follow_up_id}/complete")
def complete_follow_up(
    follow_up_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.query(FollowUp).filter(FollowUp.id == follow_up_id, FollowUp.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    _scope_employee_id(db, user, item.employee_id)
    if item.customer_id:
        _scope_customer(db, user, item.customer_id)
    item.status = "completed"
    item.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _item(item, db)
