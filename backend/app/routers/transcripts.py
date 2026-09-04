from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import Call, User

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


@router.get("")
def list_recorded_calls(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    calls = db.query(Call).options(joinedload(Call.employee)).filter(Call.organization_id == user.organization_id, Call.recording_available.is_(True)).order_by(Call.start_time.desc()).all()
    return {"items": [{"id": call.id, "contact": call.contact_name, "phone": call.phone_number, "employee": call.employee.name if call.employee else None, "date": call.start_time, "duration_seconds": call.duration_seconds, "recording_url": call.recording_url, "transcript_status": "pending"} for call in calls], "total": len(calls)}
