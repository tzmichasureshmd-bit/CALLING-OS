"""
Run once to add transcript columns to the calls table:
  python add_transcript_columns.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE calls
        ADD COLUMN IF NOT EXISTS transcript_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS transcript_text TEXT;
    """))
    conn.commit()
    print("✅ transcript_status and transcript_text columns added to calls table")
