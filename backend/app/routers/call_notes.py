from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import User, Employee

router = APIRouter(prefix="/call-notes", tags=["call-notes"])


class NoteUpsert(BaseModel):
    phone_number: str
    call_id: Optional[str] = None
    status: Optional[str] = None   # interested|asked_details|follow_up|callback|proposal_sent|converted|not_interested
    notes: Optional[str] = None


VALID_STATUSES = {
    "interested", "asked_details", "follow_up", "callback",
    "proposal_sent", "converted", "not_interested", None,
}


@router.post("")
def upsert_note(
    body: NoteUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Employee saves call progress from mobile. Upserts by org+employee+phone."""
    if body.status and body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")

    # Resolve employee_id
    emp = db.execute(
        text("SELECT id FROM employees WHERE user_id = :uid AND organization_id = :oid LIMIT 1"),
        {"uid": user.id, "oid": user.organization_id},
    ).fetchone()
    employee_id = emp[0] if emp else None

    now = datetime.now(timezone.utc)

    db.execute(text("""
        INSERT INTO call_notes (id, organization_id, employee_id, call_id, phone_number, status, notes, created_at, updated_at)
        VALUES (gen_random_uuid()::text, :org_id, :emp_id, :call_id, :phone, :status, :notes, :now, :now)
        ON CONFLICT (organization_id, employee_id, phone_number)
        DO UPDATE SET
            status     = EXCLUDED.status,
            notes      = EXCLUDED.notes,
            call_id    = COALESCE(EXCLUDED.call_id, call_notes.call_id),
            updated_at = EXCLUDED.updated_at
    """), {
        "org_id":   user.organization_id,
        "emp_id":   employee_id,
        "call_id":  body.call_id,
        "phone":    body.phone_number,
        "status":   body.status,
        "notes":    body.notes,
        "now":      now,
    })
    db.commit()
    return {"saved": True}


@router.get("")
def list_notes(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """Admin reads all call progress notes for the org — shown on web dashboard."""
    rows = db.execute(text("""
        SELECT
            cn.id, cn.phone_number, cn.status, cn.notes,
            cn.call_id, cn.updated_at,
            e.name AS employee_name
        FROM call_notes cn
        LEFT JOIN employees e ON e.id = cn.employee_id
        WHERE cn.organization_id = :org_id
        ORDER BY cn.updated_at DESC
    """), {"org_id": user.organization_id}).fetchall()

    return {"items": [
        {
            "id":            r[0],
            "phone_number":  r[1],
            "status":        r[2],
            "notes":         r[3],
            "call_id":       r[4],
            "updated_at":    r[5],
            "employee_name": r[6],
        }
        for r in rows
    ]}


@router.get("/by-phone/{phone_number}")
def get_note_by_phone(
    phone_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN")),
):
    """Get the latest note for a specific phone number."""
    row = db.execute(text("""
        SELECT cn.id, cn.phone_number, cn.status, cn.notes,
               cn.call_id, cn.updated_at, e.name AS employee_name
        FROM call_notes cn
        LEFT JOIN employees e ON e.id = cn.employee_id
        WHERE cn.organization_id = :org_id AND cn.phone_number = :phone
        ORDER BY cn.updated_at DESC
        LIMIT 1
    """), {"org_id": user.organization_id, "phone": phone_number}).fetchone()

    if not row:
        return {"note": None}
    return {"note": {
        "id":            row[0],
        "phone_number":  row[1],
        "status":        row[2],
        "notes":         row[3],
        "call_id":       row[4],
        "updated_at":    row[5],
        "employee_name": row[6],
    }}
