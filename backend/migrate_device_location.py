"""
Migration: add latitude, longitude, location_accuracy, wifi_ssid to devices table.
Safe to run multiple times (uses IF NOT EXISTS).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

COLUMNS = [
    ("latitude",          "DOUBLE PRECISION"),
    ("longitude",         "DOUBLE PRECISION"),
    ("location_accuracy", "DOUBLE PRECISION"),
    ("wifi_ssid",         "VARCHAR(100)"),
]

def run():
    with engine.connect() as conn:
        for col, typ in COLUMNS:
            conn.execute(text(
                f"ALTER TABLE devices ADD COLUMN IF NOT EXISTS {col} {typ}"
            ))
        conn.commit()
    print("Migration complete: location columns added to devices.")

if __name__ == "__main__":
    run()
