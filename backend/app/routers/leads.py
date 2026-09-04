import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Employee, Lead, User

router = APIRouter(prefix="/leads", tags=["leads"])


class LeadCreate(BaseModel):
    name: str
    phone: str
    employee_id: Optional[str] = None
    source: Optional[str] = None
    status: str = "new"
    priority: str = "Medium"
    expected_value: Optional[str] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    expected_value: Optional[str] = None
    next_follow_up: Optional[datetime] = None
    notes: Optional[str] = None


def _lead_item(lead: Lead):
    return {
        "id": lead.id, "name": lead.name, "phone": lead.phone, "source": lead.source,
        "employee_id": lead.employee_id, "employee": lead.employee.name if lead.employee else None,
        "status": lead.status, "priority": lead.priority, "expected_value": lead.expected_value,
        "next_follow_up": lead.next_follow_up, "last_contact_at": lead.last_contact_at,
        "notes": lead.notes, "created_at": lead.created_at, "updated_at": lead.updated_at,
    }


@router.get("")
def list_leads(
    status: Optional[str] = None, q: Optional[str] = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    query = db.query(Lead).options(joinedload(Lead.employee)).filter(Lead.organization_id == user.organization_id)
    if status:
        query = query.filter(Lead.status == status)
    if q:
        query = query.filter((Lead.name.ilike(f"%{q}%")) | (Lead.phone.ilike(f"%{q}%")))
    items = query.order_by(Lead.updated_at.desc()).all()
    return {"items": [_lead_item(lead) for lead in items], "total": len(items)}


@router.post("", status_code=201)
def create_lead(body: LeadCreate, db: Session = Depends(get_db), user: User = Depends(require_role("TEAM_LEAD"))):
    if body.employee_id and not db.query(Employee).filter(Employee.id == body.employee_id, Employee.organization_id == user.organization_id).first():
        raise HTTPException(status_code=400, detail="Employee not found in your organization")
    lead = Lead(organization_id=user.organization_id, **body.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_item(lead)


@router.patch("/{lead_id}")
def update_lead(lead_id: str, body: LeadUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("TEAM_LEAD"))):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return _lead_item(lead)
