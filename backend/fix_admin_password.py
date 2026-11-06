"""Fix admin password"""
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
e = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

# New password
NEW_PASSWORD = "Admin@2026"

with e.connect() as c:
    # Get organization
    org = c.execute(text("SELECT id, name FROM organizations LIMIT 1")).fetchone()
    if not org:
        print("ERROR: No organization found")
        exit(1)
    
    print(f"Found organization: {org[1]}")
    
    # Check for existing admin
    admin = c.execute(text("""
        SELECT id, email FROM users 
        WHERE organization_id = :oid AND email LIKE '%admin%' OR email LIKE '%tzmicha%'
    """), {"oid": org[0]}).fetchone()
    
    if admin:
        # Update password
        pw_hash = pwd_ctx.hash(NEW_PASSWORD)
        c.execute(text("""
            UPDATE users SET password_hash = :pw, role = 'ADMIN', status = 'active'
            WHERE id = :uid
        """), {"pw": pw_hash, "uid": admin[0]})
        print(f"\n✅ UPDATED ADMIN PASSWORD")
        print(f"Email: {admin[1]}")
        print(f"Password: {NEW_PASSWORD}")
    else:
        # Create new admin
        pw_hash = pwd_ctx.hash(NEW_PASSWORD)
        email = "admin@tzmicha.com"
        c.execute(text("""
            INSERT INTO users (organization_id, email, password_hash, role, status)
            VALUES (:oid, :email, :pw, 'ADMIN', 'active')
        """), {"oid": org[0], "email": email, "pw": pw_hash})
        print(f"\n✅ CREATED NEW ADMIN")
        print(f"Email: {email}")
        print(f"Password: {NEW_PASSWORD}")
    
    print(f"\n🌐 LOGIN AT: http://localhost:5174")
    print(f"📧 Email: admin@tzmicha.com")
    print(f"🔑 Password: {NEW_PASSWORD}")
