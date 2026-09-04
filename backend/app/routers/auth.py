from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..database import get_db
from ..models import User, Organization, Employee
from ..schemas import LoginRequest, TokenResponse, RefreshRequest, MeResponse
from ..schemas.auth import RegisterRequest, EmployeeRegisterRequest
from ..auth import create_access_token, create_refresh_token, decode_token, verify_password, get_current_user
from ..auth.password import hash_password
from pydantic import BaseModel
import re, random, string
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
import os

router = APIRouter(prefix="/auth", tags=["auth"])

# Init Firebase Admin — only if service account file exists
_SA_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "firebase-service-account.json")
)
if not firebase_admin._apps:
    if os.path.exists(_SA_PATH):
        cred = credentials.Certificate(_SA_PATH)
        firebase_admin.initialize_app(cred)
    else:
        import logging as _log
        _log.getLogger("callnexa").warning("firebase-service-account.json not found — Google/OTP login disabled")


class GoogleAuthRequest(BaseModel):
    credential: str


def _verify_firebase_token(id_token: str) -> dict:
    if not firebase_admin._apps:
        raise HTTPException(status_code=503, detail="Firebase not configured on this server")
    try:
        return firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")


def _issue_tokens(user: User, db: Session) -> TokenResponse:
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    token_data = {"sub": user.id, "org": user.organization_id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        organization_id=user.organization_id,
    )


def _make_prefix(name: str) -> str:
    """Extract 3-char lowercase prefix from company name."""
    letters = re.sub(r'[^a-zA-Z]', '', name)
    return letters[:3].lower().ljust(3, 'x')


def _make_slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def _make_org_code(prefix: str, db: Session) -> str:
    """Generate unique org code like TZM-2026-5823."""
    year = datetime.now().year
    for _ in range(20):
        suffix = ''.join(random.choices(string.digits, k=4))
        code = f"{prefix.upper()}-{year}-{suffix}"
        if not db.query(Organization).filter(Organization.code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique org code")


@router.post("/google", response_model=TokenResponse)
def google_login(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    info = _verify_firebase_token(body.credential)
    google_id = info.get("uid")
    email = info.get("email")
    name = info.get("name") or email.split("@")[0]
    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
        else:
            # Auto-register new organization via Google
            prefix = _make_prefix(name)
            slug = _make_slug(name)
            code = _make_org_code(prefix, db)
            base_slug, n = slug, 1
            while db.query(Organization).filter(Organization.slug == slug).first():
                slug = f"{base_slug}-{n}"
                n += 1
            org = Organization(
                tenant_prefix=prefix, name=name, slug=slug, code=code,
                email=email, status="active",
            )
            db.add(org)
            db.flush()
            user = User(
                organization_id=org.id, email=email,
                password_hash=hash_password(google_id),
                google_id=google_id, role="ADMIN", status="active",
            )
            db.add(user)
            db.flush()
            emp = Employee(
                organization_id=org.id, user_id=user.id, name=name,
                email=email, employee_code="EMP001", status="active",
            )
            db.add(emp)
            db.commit()

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account suspended")
    return _issue_tokens(user, db)


@router.post("/otp", response_model=TokenResponse)
def otp_login(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    info = _verify_firebase_token(body.credential)
    phone = info.get("phone_number")
    firebase_uid = info.get("uid")
    if not phone or not firebase_uid:
        raise HTTPException(status_code=401, detail="Invalid OTP token payload")

    user = db.query(User).filter(User.google_id == firebase_uid).first()
    if not user:
        emp = db.query(Employee).filter(
            Employee.phone == phone.replace("+91", "").strip()
        ).first()
        if emp:
            user = db.query(User).filter(User.id == emp.user_id).first()
            if user:
                user.google_id = firebase_uid
    if not user:
        # Auto-register new user via phone OTP
        name = phone
        prefix = "usr"
        slug = _make_slug(phone.replace("+", ""))
        code = _make_org_code(prefix, db)
        base_slug, n = slug, 1
        while db.query(Organization).filter(Organization.slug == slug).first():
            slug = f"{base_slug}-{n}"
            n += 1
        org = Organization(
            tenant_prefix=prefix, name=f"Org {phone[-4:]}", slug=slug,
            code=code, phone=phone, status="active",
        )
        db.add(org)
        db.flush()
        email = f"{phone.replace('+', '')}@phone.callingos.com"
        user = User(
            organization_id=org.id, email=email,
            password_hash=hash_password(firebase_uid),
            google_id=firebase_uid, role="ADMIN", status="active",
        )
        db.add(user)
        db.flush()
        emp = Employee(
            organization_id=org.id, user_id=user.id, name=name,
            email=email, phone=phone, employee_code="EMP001", status="active",
        )
        db.add(emp)
        db.commit()

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account suspended")
    return _issue_tokens(user, db)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.status == "active").first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    token_data = {"sub": user.id, "org": user.organization_id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        organization_id=user.organization_id,
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    prefix = _make_prefix(body.company_name)
    slug   = _make_slug(body.company_name)
    code   = _make_org_code(prefix, db)

    # Ensure slug is unique
    base_slug, n = slug, 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{n}"
        n += 1

    # DB trigger auto-generates org.id = "{prefix}_org_{ulid}"
    org = Organization(
        tenant_prefix=prefix,
        name=body.company_name,
        slug=slug,
        code=code,
        email=body.email,
        phone=body.phone,
        industry=getattr(body, 'industry', None),
        team_size=None,  # ignore string labels like "1-5"
        status="active",
    )
    db.add(org)
    db.flush()  # org.id is now set by DB trigger

    # DB trigger auto-generates user.id = "{prefix}_usr_{ulid}"
    user = User(
        organization_id=org.id,
        email=body.email,
        password_hash=hash_password(body.password),
        role="ADMIN",
        status="active",
    )
    db.add(user)
    db.flush()  # user.id is now set

    # DB trigger auto-generates emp.id = "{prefix}_emp_{ulid}"
    emp = Employee(
        organization_id=org.id,
        user_id=user.id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        employee_code="EMP001",
        status="active",
    )
    db.add(emp)
    db.commit()

    token_data = {"sub": user.id, "org": org.id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        organization_id=org.id,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == payload.get("sub"), User.status == "active").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    token_data = {"sub": user.id, "org": user.organization_id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        organization_id=user.organization_id,
    )


@router.post("/register/employee", response_model=TokenResponse, status_code=201)
def register_employee(body: EmployeeRegisterRequest, db: Session = Depends(get_db)):
    """Mobile employee self-registration via company code."""
    org = db.query(Organization).filter(
        Organization.code == body.company_code.strip().upper(),
        Organization.status == "active",
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Invalid company code. Ask your manager for the correct code.")

    # Email must be unique within the org
    if db.query(User).filter(User.email == body.email, User.organization_id == org.id).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists in this organization.")

    # Generate employee code
    emp_count = db.query(Employee).filter(Employee.organization_id == org.id).count()
    emp_code = f"EMP{str(emp_count + 1).zfill(3)}"

    user = User(
        organization_id=org.id,
        email=body.email,
        password_hash=hash_password(body.password),
        role="EMPLOYEE",
        status="active",
    )
    db.add(user)
    db.flush()

    emp = Employee(
        organization_id=org.id,
        user_id=user.id,
        name=body.name,
        email=body.email,
        employee_code=emp_code,
        status="active",
    )
    db.add(emp)
    db.commit()

    token_data = {"sub": user.id, "org": org.id, "role": user.role}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        role=user.role,
        organization_id=org.id,
    )


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        organization_id=user.organization_id,
        organization_name=org.name if org else "",
        organization_code=org.code if org else "",
    )
