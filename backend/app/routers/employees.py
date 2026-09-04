import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Employee
from ..schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut, PaginatedEmployees
from ..auth import get_current_user, require_role
import math

router = APIRouter(prefix="/employees", tags=["employees"])


def _org_scope(user: User) -> str:
    return user.organization_id


@router.get("", response_model=PaginatedEmployees)
def list_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None),
    status: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Employee).filter(Employee.organization_id == _org_scope(user))
    if status:
        query = query.filter(Employee.status == status)
    if q:
        query = query.filter(Employee.name.ilike(f"%{q}%"))
    total = query.count()
    items = query.order_by(Employee.name).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedEmployees(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(
    body: EmployeeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    emp = Employee(
        organization_id=_org_scope(user),
        **body.model_dump(),
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == _org_scope(user),
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == _org_scope(user),
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(emp, field, val)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    emp = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.organization_id == _org_scope(user),
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.status = "trashed"
    db.commit()
