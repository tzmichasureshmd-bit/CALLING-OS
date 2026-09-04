from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..auth.jwt import create_access_token, create_refresh_token
from ..database import get_db
from ..models import Organization, User
from ..schemas import TokenResponse

router = APIRouter(prefix="/organizations", tags=["organizations"])


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    timezone: Optional[str] = None


@router.get("/current")
def current_organization(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


class AddOrgRequest(BaseModel):
    name: str
    company_name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None


@router.get("/")
def list_organizations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all orgs this user has access to (their own org only for now)."""
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"items": [{
        "id": org.id,
        "name": org.name,
        "company_code": org.code,
        "status": org.status,
    }]}


@router.post("/switch/{org_id}")
def switch_organization(org_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Switch active org — only valid if user belongs to that org."""
    if user.organization_id != org_id:
        raise HTTPException(status_code=403, detail="You do not have access to this organization")
    token_data = {"sub": user.id, "org": user.organization_id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        organization_id=user.organization_id,
    )


@router.patch("/current")
def update_current_organization(
    body: OrganizationUpdate,
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org
