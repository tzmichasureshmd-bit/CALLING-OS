"""
run_migration_010.py — run only migration 010 against Supabase.
"""
import sys
import psycopg

CONN_STR = (
    "postgresql://postgres:TzMicha%40123"
    "@db.gjfohkxocurrzbdpybuu.supabase.co:5432/postgres"
)

SQL = """
ALTER TABLE calls ADD COLUMN IF NOT EXISTS notes             TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sync_confirmed_at TIMESTAMPTZ;
UPDATE calls SET updated_at = created_at WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_calls_org_updated ON calls (organization_id, updated_at DESC);
"""

def main():
    print("Connecting...")
    conn = psycopg.connect(CONN_STR, connect_timeout=30, options="-c statement_timeout=30000")
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected.\n")

    stmts = [s.strip() for s in SQL.split(";") if s.strip() and not s.strip().startswith("--")]
    for stmt in stmts:
        preview = stmt.replace("\n", " ")[:90]
        try:
            cur.execute(stmt)
            print(f"  OK    : {preview}")
        except Exception as e:
            msg = str(e).strip()
            if any(x in msg.lower() for x in ["already exists", "duplicate"]):
                print(f"  SKIP  : {preview}")
            else:
                print(f"  ERROR : {preview}\n          {msg[:200]}")

    cur.close()
    conn.close()
    print("\nDone.")

if __name__ == "__main__":
    main()
