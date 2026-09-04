from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class EmployeeCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    employee_code: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None


class EmployeeOut(BaseModel):
    id: str
    organization_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    employee_code: Optional[str] = None
    status: str
    last_active_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEmployees(BaseModel):
    items: list[EmployeeOut]
    total: int
    page: int
    page_size: int
    total_pages: int
