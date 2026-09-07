import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import User, AuditLog

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("")
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    query = (
        db.query(AuditLog)
        .filter(AuditLog.organization_id == user.organization_id)
    )
    if action:
        query = query.filter(AuditLog.action == action)

    total = query.count()
    items = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "actor_email": a.actor_email,
                "actor_role": a.actor_role,
                "action": a.action,
                "resource": a.resource,
                "resource_id": a.resource_id,
                "extra_data": a.extra_data,
                "ip_address": a.ip_address,
                "created_at": a.created_at,
            }
            for a in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 1,
    }
