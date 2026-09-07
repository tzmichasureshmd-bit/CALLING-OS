"""
Audit logging service.
Call audit.log(...) from any router to record an action.
Never raises — audit failures must not break the main request.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Request

from .models.audit_log import AuditLog
from .models.user import User

logger = logging.getLogger("callnexa.audit")

# ── Action constants ──────────────────────────────────────────────────────────
LOGIN                   = "auth.login"
LOGOUT                  = "auth.logout"
REGISTER_ORG            = "auth.register_org"
REGISTER_EMPLOYEE       = "auth.register_employee"
REGEN_COMPANY_CODE      = "org.regen_company_code"
UPDATE_ORG              = "org.update"
EMPLOYEE_CREATE         = "employee.create"
EMPLOYEE_UPDATE         = "employee.update"
EMPLOYEE_DEACTIVATE     = "employee.deactivate"
EMPLOYEE_DELETE         = "employee.delete"
DEVICE_REGISTER         = "device.register"
DEVICE_HEARTBEAT        = "device.heartbeat"
CALL_SYNC               = "call.sync"
CALL_VIEW               = "call.view"
RECORDING_UPLOAD        = "recording.upload"
RECORDING_ACCESS        = "recording.access"
TRANSCRIPT_START        = "transcript.start"
TRANSCRIPT_COMPLETE     = "transcript.complete"
SETTINGS_CHANGE         = "settings.change"
SUBSCRIPTION_CHANGE     = "subscription.change"
TWO_FA_ENABLE           = "auth.2fa_enable"
TWO_FA_DISABLE          = "auth.2fa_disable"
SUPERADMIN_ORG_STATUS   = "superadmin.org_status"


def log(
    db: Session,
    *,
    organization_id: str,
    action: str,
    actor: Optional[User] = None,
    resource: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Write one audit log entry. Never raises.
    """
    try:
        ip = None
        ua = None
        if request:
            forwarded = request.headers.get("x-forwarded-for")
            ip = forwarded.split(",")[0].strip() if forwarded else (
                request.client.host if request.client else None
            )
            ua = request.headers.get("user-agent", "")[:500]

        entry = AuditLog(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else None,
            actor_role=actor.role if actor else None,
            action=action,
            resource=resource,
            resource_id=resource_id,
            ip_address=ip,
            user_agent=ua,
            extra_data=metadata or {},
            created_at=datetime.now(timezone.utc),
        )
        db.add(entry)
        db.flush()   # write in same transaction as the main operation
    except Exception as exc:
        logger.warning("Audit log write failed: %s", exc)
