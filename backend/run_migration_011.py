"""
run_migration_011.py — run only migration 011 against Supabase.
"""
import psycopg

CONN_STR = (
    "postgresql://postgres:TzMicha%40123"
    "@db.gjfohkxocurrzbdpybuu.supabase.co:5432/postgres"
)

SQL = "ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_size_bytes BIGINT;"

def main():
    print("Connecting...")
    conn = psycopg.connect(CONN_STR, connect_timeout=30, options="-c statement_timeout=30000")
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected.\n")
    try:
        cur.execute(SQL)
        print(f"  OK    : {SQL}")
    except Exception as e:
        msg = str(e).strip()
        if "already exists" in msg.lower():
            print(f"  SKIP  : {SQL}")
        else:
            print(f"  ERROR : {msg}")
    cur.close()
    conn.close()
    print("\nDone.")

if __name__ == "__main__":
    main()
