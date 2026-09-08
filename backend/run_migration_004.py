"""
Run migration 004 — adds all missing columns and audit_logs table.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv; load_dotenv()
from app.database import engine
from sqlalchemy import text

SQL = open(os.path.join(os.path.dirname(__file__), "migrations", "004_missing_columns.sql")).read()

with engine.connect() as conn:
    for stmt in [s.strip() for s in SQL.split(";") if s.strip() and not s.strip().startswith("--")]:
        try:
            conn.execute(text(stmt))
            print(f"OK: {stmt[:80].replace(chr(10),' ')}")
        except Exception as e:
            print(f"SKIP/ERR: {e}")
    conn.commit()

print("\nMigration 004 complete.")
