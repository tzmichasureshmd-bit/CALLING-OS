"""Run migration 005 — sim_change_history + platform_alerts tables."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv; load_dotenv()
from app.database import engine
from sqlalchemy import text

SQL = open(os.path.join(os.path.dirname(__file__), "migrations", "005_superadmin_tables.sql")).read()

with engine.connect() as conn:
    conn.execute(text(SQL))
    conn.commit()
print("Migration 005 complete.")
