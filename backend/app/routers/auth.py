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
import pyotp, qrcode, qrcode.image.svg, io, base64
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
    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email, User.status == "active").first()
        if user:
            user.google_id = google_id
        else:
            raise HTTPException(
                status_code=403,
                detail="No account found for this Google email. Please register first."
            )

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
        raise HTTPException(status_code=403, detail="No account found for this phone number.")

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


@router.patch("/me")
def update_me(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's name and/or email."""
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if "name" in body and body["name"].strip():
        if emp:
            emp.name = body["name"].strip()
    if "email" in body and body["email"].strip():
        # Check uniqueness
        existing = db.query(User).filter(User.email == body["email"], User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = body["email"].strip()
        if emp:
            emp.email = body["email"].strip()
    db.commit()
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        organization_id=user.organization_id,
        organization_name=org.name if org else "",
        organization_code=org.code if org else "",
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
        totp_enabled=bool(user.totp_enabled),
    )


# ── 2FA endpoints ─────────────────────────────────────────────────────────────

@router.post("/2fa/setup")
def setup_2fa(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a new TOTP secret + QR code URI for Google Authenticator."""
    secret = pyotp.random_base32()
    user.totp_secret = secret
    db.commit()
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    label = f"CallNexa:{user.email}"
    issuer = org.name if org else "CallNexa"
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)
    # Build QR as base64 PNG
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    return {"secret": secret, "uri": uri, "qr": f"data:image/png;base64,{qr_b64}"}


class TotpVerifyRequest(BaseModel):
    code: str


@router.post("/2fa/verify")
def verify_2fa(body: TotpVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Verify the 6-digit code and enable 2FA."""
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Call /2fa/setup first.")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")
    user.totp_enabled = True
    db.commit()
    return {"enabled": True}


@router.post("/2fa/disable")
def disable_2fa(body: TotpVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Disable 2FA after confirming with current code."""
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code.")
    user.totp_enabled = False
    user.totp_secret = None
    db.commit()
    return {"enabled": False}
