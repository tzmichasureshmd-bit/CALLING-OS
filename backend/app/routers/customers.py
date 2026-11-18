from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Customer, CustomerActivity, Employee, User
from ..phone import normalize_phone
from ..schemas.customer import CustomerCreate, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


def _employee_for_user(db: Session, user: User) -> Employee | None:
    return db.query(Employee).filter(
        Employee.user_id == user.id,
        Employee.organization_id == user.organization_id,
        Employee.status == "active",
    ).first()


def _validate_employee(db: Session, user: User, employee_id: str | None) -> str | None:
    if (user.role or "").upper() == "EMPLOYEE":
        employee = _employee_for_user(db, user)
        if not employee:
            raise HTTPException(status_code=403, detail="Active employee profile required")
        if employee_id and employee_id != employee.id:
            raise HTTPException(status_code=403, detail="Customer belongs to another employee")
        return employee.id
    if employee_id:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.organization_id == user.organization_id,
            Employee.status == "active",
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
    return employee_id


def _assert_customer_access(db: Session, user: User, customer: Customer) -> Employee | None:
    if (user.role or "").upper() != "EMPLOYEE":
        return None
    employee = _employee_for_user(db, user)
    if not employee:
        raise HTTPException(status_code=403, detail="Active employee profile required")
    if customer.employee_id not in (None, employee.id):
        raise HTTPException(status_code=404, detail="Customer not found")
    return employee


def _item(customer: Customer) -> dict:
    employee = customer.employee if customer.employee and customer.employee.organization_id == customer.organization_id else None
    return {
        "id": customer.id,
        "organization_id": customer.organization_id,
        "employee_id": customer.employee_id,
        "employee_name": employee.name if employee else None,
        "name": customer.name,
        "phone": customer.phone,
        "phone_normalized": customer.phone_normalized,
        "email": customer.email,
        "company": customer.company,
        "status": customer.status,
        "tags": customer.tags or [],
        "notes": customer.notes,
        "created_at": customer.created_at,
        "last_contact_at": customer.last_contact_at,
        "next_follow_up": customer.next_follow_up,
        "updated_at": customer.updated_at,
    }


def _activity_item(activity: CustomerActivity) -> dict:
    employee = activity.employee if activity.employee and activity.employee.organization_id == activity.organization_id else None
    return {
        "id": activity.id,
        "event_type": activity.event_type,
        "description": activity.description,
        "payload": activity.payload or {},
        "event_at": activity.event_at,
        "idempotency_key": activity.idempotency_key,
        "call_id": activity.call_id,
        "lead_id": activity.lead_id,
        "opportunity_id": activity.opportunity_id,
        "follow_up_id": activity.follow_up_id,
        "actor_id": activity.actor_id,
        "employee_id": activity.employee_id,
        "employee_name": employee.name if employee else None,
    }


@router.get("")
def list_customers(
    status: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee_id = _validate_employee(db, user, employee_id)
    query = db.query(Customer).filter(Customer.organization_id == user.organization_id)
    if (user.role or "").upper() == "EMPLOYEE":
        employee = _employee_for_user(db, user)
        query = query.filter(or_(Customer.employee_id == employee.id, Customer.employee_id.is_(None)))
    elif employee_id:
        query = query.filter(Customer.employee_id == employee_id)
    if status:
        query = query.filter(Customer.status == status)
    if phone:
        query = query.filter(Customer.phone_normalized == normalize_phone(phone))
    items = query.order_by(Customer.updated_at.desc(), Customer.id.desc()).offset(offset).limit(limit).all()
    return {"items": [_item(customer) for customer in items], "total": len(items), "limit": limit, "offset": offset}


@router.post("", status_code=201)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    employee_id = _validate_employee(db, user, body.employee_id)
    normalized = normalize_phone(body.phone)
    if not normalized:
        raise HTTPException(status_code=422, detail="A valid phone number is required")
    existing = db.query(Customer).filter(
        Customer.organization_id == user.organization_id,
        Customer.phone_normalized == normalized,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A customer with this phone already exists")
    customer = Customer(
        organization_id=user.organization_id,
        employee_id=employee_id,
        name=body.name.strip(),
        phone=body.phone.strip(),
        phone_normalized=normalized,
        email=body.email,
        company=body.company,
        status=body.status,
        tags=body.tags,
        notes=body.notes,
        next_follow_up=body.next_follow_up,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _item(customer)


@router.get("/{customer_id}")
def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.organization_id == user.organization_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    _assert_customer_access(db, user, customer)
    return _item(customer)


@router.patch("/{customer_id}")
def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.organization_id == user.organization_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    employee = _assert_customer_access(db, user, customer)
    values = body.model_dump(exclude_unset=True)
    if "employee_id" in values:
        values["employee_id"] = _validate_employee(db, user, values["employee_id"])
    if "phone" in values:
        normalized = normalize_phone(values["phone"])
        if not normalized:
            raise HTTPException(status_code=422, detail="A valid phone number is required")
        duplicate = db.query(Customer).filter(
            Customer.organization_id == user.organization_id,
            Customer.phone_normalized == normalized,
            Customer.id != customer.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="A customer with this phone already exists")
        customer.phone_normalized = normalized
        values["phone"] = values["phone"].strip()
    for field, value in values.items():
        setattr(customer, field, value)
    customer.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(customer)
    return _item(customer)


@router.get("/{customer_id}/timeline")
def get_customer_timeline(
    customer_id: str,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.organization_id == user.organization_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    _assert_customer_access(db, user, customer)
    items = db.query(CustomerActivity).filter(
        CustomerActivity.organization_id == user.organization_id,
        CustomerActivity.customer_id == customer.id,
    ).order_by(CustomerActivity.event_at.desc(), CustomerActivity.id.desc()).offset(offset).limit(limit).all()
    return {"items": [_activity_item(item) for item in items], "total": len(items), "limit": limit, "offset": offset}
