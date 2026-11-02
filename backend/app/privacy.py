"""Authoritative recording/transcription eligibility checks."""

from sqlalchemy.orm import Session

from .models import Call, ExcludedNumber
from .phone import normalize_phone


def recording_denial_reason(db: Session, call: Call) -> str | None:
    """Return a stable denial code, or None when processing is allowed."""
    privacy = (getattr(call, "call_privacy", None) or "unclassified").lower()
    if privacy != "business":
        return "personal_call" if privacy == "personal" else "not_business"

    normalized = call.phone_number_normalized or normalize_phone(call.phone_number)
    values = {value for value in (normalized, call.phone_number) if value}
    if values and db.query(ExcludedNumber).filter(
        ExcludedNumber.organization_id == call.organization_id,
        ExcludedNumber.number.in_(values),
    ).first():
        return "excluded_number"
    return None
