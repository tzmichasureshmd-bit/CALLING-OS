import bcrypt
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").replace("postgresql+psycopg://", "postgresql+psycopg2://")

engine = create_engine(DATABASE_URL)
new_hash = bcrypt.hashpw(b"harika@123", bcrypt.gensalt()).decode()

with engine.begin() as conn:
    result = conn.execute(
        text("UPDATE users SET password_hash = :h WHERE email = :e RETURNING id, email"),
        {"h": new_hash, "e": "harikakolanu67@gmail.com"}
    )
    row = result.fetchone()
    if row:
        print("OK: password reset for " + row.email)
    else:
        print("NOT FOUND - listing users:")
        r2 = conn.execute(text("SELECT email FROM users LIMIT 10"))
        for u in r2.fetchall():
            print("  " + u.email)
