import traceback
from app.database import SessionLocal
from sqlalchemy import text
from app.models.call import Call
from datetime import datetime, timezone

db = SessionLocal()
try:
    call_id = db.execute(text("SELECT generate_prefixed_id('tzm','cal')")).scalar()
    print("call_id:", call_id)
    c = Call(
        id=call_id,
        client_event_id="py-test-001",
        organization_id="tzm_org_zzv78xyk5g954rc5y3np",
        employee_id="tzm_emp_3mrfn2pe109sxbs3b578",
        device_id="bbcfbdeb-e8ad-45d7-bf0b-bd4d1659449a",
        phone_number="+919876543210",
        call_type="outgoing",
        call_status="connected",
        start_time=datetime(2026, 9, 8, 20, 0, 0, tzinfo=timezone.utc),
        duration_seconds=45,
        recording_available=False,
        recording_status="not_available",
        sync_status="synced",
    )
    db.add(c)
    db.flush()
    print("FLUSH OK:", c.id)
    db.commit()
    print("COMMIT OK - CALL SAVED TO DB")
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
