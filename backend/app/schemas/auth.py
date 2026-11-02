from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    team_size: Optional[str] = Field(default=None, max_length=30)
    industry: Optional[str] = Field(default=None, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class EmployeeRegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    company_code: str = Field(min_length=1, max_length=50)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    organization_id: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class MeResponse(BaseModel):
    id: str
    name: Optional[str] = None
    email: str
    role: str
    organization_id: str
    organization_name: str
    organization_code: str
    totp_enabled: bool = False

    model_config = {"from_attributes": True}
