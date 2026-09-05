from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    company_name: str
    email: EmailStr
    phone: Optional[str] = None
    team_size: Optional[str] = None
    industry: Optional[str] = None
    password: str


class EmployeeRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_code: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    organization_id: str


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: str
    email: str
    role: str
    organization_id: str
    organization_name: str
    organization_code: str
    totp_enabled: bool = False

    model_config = {"from_attributes": True}
