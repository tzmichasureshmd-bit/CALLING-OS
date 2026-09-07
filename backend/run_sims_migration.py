import psycopg, sys

CONN = "postgresql://postgres:TzMicha%40123@db.gjfohkxocurrzbdpybuu.supabase.co:5432/postgres"

STMTS = [
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS mcc VARCHAR(10)",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS mnc VARCHAR(10)",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS country_iso VARCHAR(5)",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(50)",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS network_type VARCHAR(20)",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMPTZ",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS last_detected_at TIMESTAMPTZ",
    "ALTER TABLE sims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()",
    "UPDATE sims SET first_detected_at = created_at WHERE first_detected_at IS NULL",
    "UPDATE sims SET last_detected_at = created_at WHERE last_detected_at IS NULL",
    "ALTER TABLE sims DROP CONSTRAINT IF EXISTS uq_sims_device_slot",
    "ALTER TABLE sims ADD CONSTRAINT uq_sims_device_slot UNIQUE (device_id, slot)",
    "CREATE INDEX IF NOT EXISTS ix_sims_subscription_id ON sims (subscription_id)",
    "CREATE INDEX IF NOT EXISTS ix_sims_last_detected ON sims (device_id, last_detected_at)",
]

print("Connecting...")
conn = psycopg.connect(CONN, connect_timeout=20)
conn.autocommit = True
cur = conn.cursor()
# Disable statement timeout for DDL migrations
cur.execute("SET statement_timeout = 0")
print("Connected.\n")

ok = err = 0
for s in STMTS:
    try:
        cur.execute(s)
        print(f"OK    : {s[:70]}")
        ok += 1
    except Exception as e:
        msg = str(e).strip()
        if "already exists" in msg or "does not exist" in msg:
            print(f"SKIP  : {s[:70]}")
            ok += 1
        else:
            print(f"ERROR : {s[:70]}")
            print(f"        {msg[:120]}")
            err += 1

conn.close()
print(f"\nDone. OK={ok} ERR={err}")
sys.exit(err)
