import sys
sys.stdout.reconfigure(line_buffering=True)

from dotenv import load_dotenv
load_dotenv()

from app.database import engine
from sqlalchemy import text

print("Connecting to database...")
with engine.connect() as conn:
    print("Connected. Running migration...")
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64)"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.commit()
    print("Migration done. Verifying...")
    r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('totp_secret','totp_enabled')"))
    cols = [row[0] for row in r.fetchall()]
    print("Columns present:", cols)

print("All done!")
