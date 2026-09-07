import random
import re
import string
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..auth.jwt import create_access_token, create_refresh_token
from ..database import get_db
from ..models import Organization, User
from ..schemas import TokenResponse
from .. import audit

router = APIRouter(prefix="/organizations", tags=["organizations"])


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    timezone: Optional[str] = None


def _make_org_code(prefix: str, db: Session) -> str:
    """Generate unique org code like TZM-2026-5823."""
    year = __import__("datetime").datetime.now().year
    for _ in range(20):
        suffix = "".join(random.choices(string.digits, k=4))
        code = f"{prefix.upper()}-{year}-{suffix}"
        if not db.query(Organization).filter(Organization.code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique org code")


@router.get("/current")
def current_organization(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/")
def list_organizations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
def switch_organization(
    org_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
    request: Request,
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    changes = body.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(org, field, value)
    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.UPDATE_ORG,
        actor=user,
        resource="organization",
        resource_id=org.id,
        metadata={"changed_fields": list(changes.keys())},
        request=request,
    )
    db.commit()
    db.refresh(org)
    return org


@router.post("/current/regenerate-code")
def regenerate_company_code(
    request: Request,
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Generate a new unique company code for the organization.
    The old code is immediately invalidated — employees with the old code
    cannot register new accounts.
    """
    org = db.get(Organization, user.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    old_code = org.code
    new_code = _make_org_code(org.tenant_prefix, db)
    org.code = new_code

    audit.log(
        db,
        organization_id=user.organization_id,
        action=audit.REGEN_COMPANY_CODE,
        actor=user,
        resource="organization",
        resource_id=org.id,
        metadata={"old_code_prefix": old_code[:3] if old_code else None},
        request=request,
    )
    db.commit()
    return {"code": new_code, "message": "Company code regenerated. Share the new code with employees."}
