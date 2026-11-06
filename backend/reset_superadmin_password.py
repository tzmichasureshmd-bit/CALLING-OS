"""
Reset superadmin password - Run this to reset the password
"""
from dotenv import load_dotenv
load_dotenv(".env.production")  # Load production env

from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
engine = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

# Credentials
SUPER_EMAIL = "superadmin@callnexa.com"
NEW_PASSWORD = "SuperAdmin@2026"

print("🔄 Resetting superadmin password...")
print(f"📧 Email: {SUPER_EMAIL}")
print(f"🔑 Password: {NEW_PASSWORD}")

with engine.connect() as conn:
    # Check if user exists
    user = conn.execute(
        text("SELECT id, email, role FROM users WHERE email = :email"),
        {"email": SUPER_EMAIL}
    ).fetchone()
    
    if user:
        print(f"✅ User found: {user.email} (role: {user.role})")
        
        # Hash new password
        new_hash = pwd_ctx.hash(NEW_PASSWORD)
        
        # Update password and ensure role is SUPER_ADMIN
        conn.execute(
            text("""
                UPDATE users 
                SET password_hash = :pw, 
                    role = 'SUPER_ADMIN',
                    status = 'active'
                WHERE email = :email
            """),
            {"pw": new_hash, "email": SUPER_EMAIL}
        )
        
        print("✅ Password reset successfully!")
        print()
        print("=" * 50)
        print("🎉 SUPERADMIN LOGIN CREDENTIALS")
        print("=" * 50)
        print(f"URL:      https://callingos.tzmicha.com/superadmin/login")
        print(f"Email:    {SUPER_EMAIL}")
        print(f"Password: {NEW_PASSWORD}")
        print("=" * 50)
        
    else:
        print("❌ User not found! Creating new superadmin...")
        
        # Get first org
        org = conn.execute(text("SELECT id FROM organizations LIMIT 1")).fetchone()
        
        if not org:
            print("❌ ERROR: No organizations found!")
            print("Run: python backend/app/seed.py")
            exit(1)
        
        # Create user
        pw_hash = pwd_ctx.hash(NEW_PASSWORD)
        conn.execute(
            text("""
                INSERT INTO users (organization_id, email, password_hash, role, status)
                VALUES (:org_id, :email, :pw, 'SUPER_ADMIN', 'active')
            """),
            {"org_id": org.id, "email": SUPER_EMAIL, "pw": pw_hash}
        )
        
        print("✅ Superadmin created successfully!")
        print()
        print("=" * 50)
        print("🎉 SUPERADMIN LOGIN CREDENTIALS")
        print("=" * 50)
        print(f"URL:      https://callingos.tzmicha.com/superadmin/login")
        print(f"Email:    {SUPER_EMAIL}")
        print(f"Password: {NEW_PASSWORD}")
        print("=" * 50)
