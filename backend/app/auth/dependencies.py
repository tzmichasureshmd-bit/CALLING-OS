from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Organization
from .jwt import decode_token

bearer_scheme = HTTPBearer(auto_error=False)

# Role hierarchy
ROLE_LEVELS = {
    "SUPER_ADMIN": 5,
    "ADMIN": 4,
    "MANAGER": 3,
    "TEAM_LEAD": 2,
    "EMPLOYEE": 1,
}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise exc
    user_id = payload.get("sub")
    if not user_id:
        raise exc
    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not user:
        raise exc
    return user


def require_role(minimum_role: str):
    """Dependency factory — raises 403 if user's role is below the minimum."""
    def _check(user: User = Depends(get_current_user)):
        if ROLE_LEVELS.get(user.role, 0) < ROLE_LEVELS.get(minimum_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum_role} role or higher",
            )
        return user
    return _check
