from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE devices ADD COLUMN IF NOT EXISTS reconnect_requested_at TIMESTAMPTZ"))
    conn.commit()

print("Migration 006 applied: reconnect_requested_at column added to devices table")
