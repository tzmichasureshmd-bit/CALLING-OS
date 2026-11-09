import uuid
import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
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
def create_lead(body: LeadCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    if body.employee_id and not db.query(Employee).filter(Employee.id == body.employee_id, Employee.organization_id == user.organization_id).first():
        raise HTTPException(status_code=400, detail="Employee not found in your organization")
    lead = Lead(organization_id=user.organization_id, **body.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _lead_item(lead)


@router.patch("/{lead_id}")
def update_lead(lead_id: str, body: LeadUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.organization_id == user.organization_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return _lead_item(lead)


@router.post("/bulk/upload", status_code=201)
async def bulk_upload_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """
    Bulk upload leads from CSV file.
    Expected columns: name, phone, source (optional), employee_id (optional), priority (optional)
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")
    
    if not file.filename.lower().endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    # Read file
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")
    
    try:
        # Decode content
        text_content = content.decode('utf-8-sig')  # Handle BOM
        csv_reader = csv.DictReader(io.StringIO(text_content))
        
        if not csv_reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV file is empty or malformed")
        
        # Required columns (case-insensitive)
        fieldnames_lower = [f.lower().strip() for f in csv_reader.fieldnames]
        
        if 'name' not in fieldnames_lower or 'phone' not in fieldnames_lower:
            raise HTTPException(
                status_code=400,
                detail="CSV must contain 'name' and 'phone' columns"
            )
        
        # Map original fieldnames to lowercase for easier access
        field_mapping = {f.lower().strip(): f for f in csv_reader.fieldnames}
        
        created_leads = []
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # start=2 because row 1 is header
            try:
                # Extract and clean data
                name = (row.get(field_mapping.get('name', 'name')) or "").strip()
                phone = (row.get(field_mapping.get('phone', 'phone')) or "").strip()
                source = (row.get(field_mapping.get('source', 'source')) or "").strip() or "Bulk Upload"
                priority = (row.get(field_mapping.get('priority', 'priority')) or "").strip() or "Medium"
                employee_id = (row.get(field_mapping.get('employee_id', 'employee_id')) or "").strip() or None
                notes = (row.get(field_mapping.get('notes', 'notes')) or "").strip() or None
                
                # Validate required fields
                if not name:
                    errors.append(f"Row {row_num}: Name is required")
                    continue
                
                if not phone:
                    errors.append(f"Row {row_num}: Phone is required")
                    continue
                
                # Validate employee if provided
                if employee_id:
                    emp = db.query(Employee).filter(
                        Employee.id == employee_id,
                        Employee.organization_id == user.organization_id
                    ).first()
                    if not emp:
                        errors.append(f"Row {row_num}: Employee ID '{employee_id}' not found")
                        continue
                
                # Create lead
                lead = Lead(
                    organization_id=user.organization_id,
                    name=name,
                    phone=phone,
                    source=source,
                    priority=priority,
                    employee_id=employee_id,
                    notes=notes,
                    status="new",
                )
                db.add(lead)
                created_leads.append(lead)
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        if not created_leads and errors:
            raise HTTPException(status_code=400, detail=f"No leads created. Errors: {'; '.join(errors[:5])}")
        
        db.commit()
        
        # Refresh to get final data
        for lead in created_leads:
            db.refresh(lead)
        
        return {
            "created": len(created_leads),
            "errors": errors,
            "leads": [_lead_item(lead) for lead in created_leads],
            "message": f"Successfully created {len(created_leads)} leads" + (f". {len(errors)} errors encountered." if errors else ".")
        }
    
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File encoding error. Please ensure the file is UTF-8 encoded.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")
