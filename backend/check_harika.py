import bcrypt
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("postgresql+psycopg://", "postgresql+psycopg2://")
engine = create_engine(DATABASE_URL)

EMAIL = "harikakolanu67@gmail.com"
PASSWORD = "harika@123"

with engine.begin() as conn:
    row = conn.execute(
        text("SELECT id, email, password_hash FROM users WHERE email = :e LIMIT 1"),
        {"e": EMAIL}
    ).fetchone()

    if not row:
        print("NOT FOUND:", EMAIL)
    else:
        # Check if current password already matches
        current_hash = row.password_hash or ""
        try:
            matches = bcrypt.checkpw(PASSWORD.encode(), current_hash.encode())
        except Exception:
            matches = False

        if matches:
            print("Password already correct - no reset needed for", EMAIL)
        else:
            print("Password mismatch - resetting for", EMAIL)
            new_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
            conn.execute(
                text("UPDATE users SET password_hash = :h WHERE email = :e"),
                {"h": new_hash, "e": EMAIL}
            )
            print("OK: password reset to harika@123 for", EMAIL)
