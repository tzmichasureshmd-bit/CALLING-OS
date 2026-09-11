import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Employee, Lead, Opportunity, User

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


class OpportunityCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    customer: Optional[str] = None
    employee_id: Optional[str] = None
    lead_id: Optional[str] = None
    stage: str = "New"
    value: float = 0
    probability: float = 0
    close_date: Optional[datetime] = None
    next_action: Optional[str] = None
    notes: Optional[str] = None


class OpportunityUpdate(OpportunityCreate):
    name: Optional[str] = None


def _item(opportunity: Opportunity):
    return {
        "id": opportunity.id, "lead": opportunity.name, "name": opportunity.name,
        "phone": opportunity.phone, "customer": opportunity.customer,
        "employee_id": opportunity.employee_id,
        "employee": opportunity.employee.name if opportunity.employee else None,
        "lead_id": opportunity.lead_id, "stage": opportunity.stage, "value": opportunity.value,
        "probability": opportunity.probability, "close_date": opportunity.close_date,
        "next_action": opportunity.next_action, "notes": opportunity.notes,
        "is_closed": opportunity.is_closed, "closed_at": opportunity.closed_at,
    }


def _validate_references(body, user, db):
    if body.employee_id and not db.query(Employee).filter(Employee.id == body.employee_id, Employee.organization_id == user.organization_id).first():
        raise HTTPException(status_code=400, detail="Employee not found in your organization")
    if body.lead_id and not db.query(Lead).filter(Lead.id == body.lead_id, Lead.organization_id == user.organization_id).first():
        raise HTTPException(status_code=400, detail="Lead not found in your organization")


@router.get("")
def list_opportunities(closed: Optional[bool] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Opportunity).options(joinedload(Opportunity.employee)).filter(Opportunity.organization_id == user.organization_id)
    if closed is True:
        query = query.filter(Opportunity.is_closed.in_(("won", "lost")))
    elif closed is False:
        query = query.filter(Opportunity.is_closed == "open")
    items = query.order_by(Opportunity.updated_at.desc()).all()
    return {"items": [_item(item) for item in items], "total": len(items)}


@router.post("", status_code=201)
def create_opportunity(body: OpportunityCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    _validate_references(body, user, db)
    item = Opportunity(id=str(uuid.uuid4()), organization_id=user.organization_id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item(item)


@router.patch("/{opportunity_id}")
def update_opportunity(opportunity_id: str, body: OpportunityUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    item = db.query(Opportunity).filter(Opportunity.id == opportunity_id, Opportunity.organization_id == user.organization_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    _validate_references(body, user, db)
    values = body.model_dump(exclude_none=True)
    for field, value in values.items():
        setattr(item, field, value)
    if values.get("stage") in {"Won", "Lost"}:
        item.is_closed = values["stage"].lower()
        item.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _item(item)
