"""
db_check.py — verify live Supabase database has all required columns.
Run: python db_check.py
"""
import sys
import psycopg

CONN = "postgresql://postgres:TzMicha%40123@db.gjfohkxocurrzbdpybuu.supabase.co:5432/postgres"

REQUIRED_SIM_COLS  = ["id","device_id","slot","carrier","phone_number","mcc","mnc",
                       "country_iso","subscription_id","network_type","is_active",
                       "first_detected_at","last_detected_at","created_at","updated_at"]

REQUIRED_CALL_COLS = ["id","client_event_id","organization_id","employee_id","device_id",
                       "sim_id","phone_number","phone_number_normalized","contact_name",
                       "call_type","call_status","start_time","end_time","duration_seconds",
                       "sim_slot","subscription_id","source","recording_available",
                       "recording_status","recording_url","recording_size_bytes",
                       "recording_mime_type","recording_duration_seconds",
                       "recording_uploaded_at","recording_error",
                       "transcript_status","transcript_text","sync_status","created_at"]

def check():
    print("Connecting to Supabase...")
    try:
        conn = psycopg.connect(CONN, connect_timeout=15, options="-c statement_timeout=10000")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)

    cur = conn.cursor()
    errors = 0

    def check_table(table, required):
        nonlocal errors
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position",
            (table,)
        )
        existing = {r[0] for r in cur.fetchall()}
        print(f"\n=== {table} ({len(existing)} columns) ===")
        for col in required:
            ok = col in existing
            print(f"  {'OK    ' if ok else 'MISSING'} {col}")
            if not ok:
                errors += 1

    check_table("sims",  REQUIRED_SIM_COLS)
    check_table("calls", REQUIRED_CALL_COLS)

    # Check unique constraint on sims
    cur.execute(
        "SELECT conname FROM pg_constraint WHERE conname='uq_sims_device_slot'"
    )
    has_constraint = cur.fetchone() is not None
    print(f"\n=== CONSTRAINTS ===")
    print(f"  {'OK    ' if has_constraint else 'MISSING'} uq_sims_device_slot")
    if not has_constraint:
        errors += 1

    conn.close()
    print(f"\n{'ALL OK' if errors == 0 else f'{errors} ISSUES FOUND'}")
    return errors

if __name__ == "__main__":
    sys.exit(check())
