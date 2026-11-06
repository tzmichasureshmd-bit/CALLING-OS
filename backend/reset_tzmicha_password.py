"""
Reset password for TzMicha user
"""
from dotenv import load_dotenv
load_dotenv(".env.production")

from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
engine = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

EMAIL = "danievens@tzmicha.com"
NEW_PASSWORD = "TzMicha@2026"

print(f"🔄 Resetting password for {EMAIL}...")

with engine.connect() as conn:
    pw_hash = pwd_ctx.hash(NEW_PASSWORD)
    
    conn.execute(text("""
        UPDATE users 
        SET password_hash = :pw, status = 'active'
        WHERE email = :email
    """), {"pw": pw_hash, "email": EMAIL})
    
    print("✅ Password reset successfully!")
    print()
    print("=" * 60)
    print("🎉 TZMICHA LOGIN CREDENTIALS")
    print("=" * 60)
    print(f"URL:      https://callingos.tzmicha.com/login")
    print(f"Email:    {EMAIL}")
    print(f"Password: {NEW_PASSWORD}")
    print("=" * 60)
