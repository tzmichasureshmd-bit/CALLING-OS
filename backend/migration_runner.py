"""
migration_runner.py
Run CallNexa database migrations against Supabase PostgreSQL.
Usage: python migration_runner.py
"""
import sys
import psycopg

CONN_STR = (
    "postgresql://postgres:TzMicha%40123"
    "@db.gjfohkxocurrzbdpybuu.supabase.co:5432/postgres"
)

MIGRATIONS = [
    "migrations/001_expand_sims.sql",
    "migrations/002_expand_calls_recording.sql",
]


def run_migration(cur, fname):
    print(f"\n=== {fname} ===")
    with open(fname) as f:
        sql = f.read()

    # Split on semicolons; skip blank/comment-only chunks
    raw_stmts = sql.split(";")
    stmts = []
    for s in raw_stmts:
        cleaned = "\n".join(
            line for line in s.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ).strip()
        if cleaned:
            stmts.append(cleaned)

    ok = skipped = errors = 0
    for stmt in stmts:
        preview = stmt.replace("\n", " ")[:80]
        try:
            cur.execute(stmt)
            print(f"  OK    : {preview}")
            ok += 1
        except Exception as e:
            msg = str(e).strip()
            if any(x in msg.lower() for x in ["already exists", "duplicate", "does not exist"]):
                print(f"  SKIP  : {preview}")
                print(f"          ({msg[:100]})")
                skipped += 1
            else:
                print(f"  ERROR : {preview}")
                print(f"          {msg[:200]}")
                errors += 1

    print(f"\n  Result: {ok} OK, {skipped} skipped, {errors} errors")
    return errors


def main():
    print("Connecting to Supabase PostgreSQL...")
    try:
        conn = psycopg.connect(
            CONN_STR,
            connect_timeout=30,
            options="-c statement_timeout=60000",
        )
        conn.autocommit = True
        cur = conn.cursor()
        print("Connected.\n")
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    total_errors = 0
    for fname in MIGRATIONS:
        total_errors += run_migration(cur, fname)

    cur.close()
    conn.close()

    print("\n" + "=" * 50)
    if total_errors == 0:
        print("All migrations completed successfully.")
    else:
        print(f"Completed with {total_errors} error(s). Review output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
