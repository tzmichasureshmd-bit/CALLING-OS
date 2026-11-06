"""
Check TzMicha organization and create login credentials
"""
from dotenv import load_dotenv
load_dotenv(".env.production")

from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
engine = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

print("🔍 Checking TzMicha organization...\n")

with engine.connect() as conn:
    # Find TzMicha organization
    orgs = conn.execute(text("""
        SELECT id, name, created_at 
        FROM organizations 
        ORDER BY created_at
    """)).fetchall()
    
    print("📋 ALL ORGANIZATIONS:")
    print("=" * 60)
    for org in orgs:
        print(f"ID: {org.id}")
        print(f"Name: {org.name}")
        print(f"Created: {org.created_at}")
        print("-" * 60)
    
    # Find all users
    users = conn.execute(text("""
        SELECT u.id, u.email, u.role, u.status, o.name as org_name
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        ORDER BY u.created_at
    """)).fetchall()
    
    print("\n👥 ALL USERS:")
    print("=" * 60)
    for user in users:
        print(f"Email: {user.email}")
        print(f"Organization: {user.org_name}")
        print(f"Role: {user.role}")
        print(f"Status: {user.status}")
        print("-" * 60)
    
    # Check if TzMicha exists
    tzmicha = conn.execute(text("""
        SELECT id, name FROM organizations 
        WHERE LOWER(name) LIKE '%tzmicha%'
        LIMIT 1
    """)).fetchone()
    
    if tzmicha:
        print(f"\n✅ Found TzMicha: {tzmicha.name} (ID: {tzmicha.id})")
        
        # Check for admin user
        admin = conn.execute(text("""
            SELECT email, role FROM users 
            WHERE organization_id = :org_id 
            AND role IN ('ADMIN', 'OWNER')
            LIMIT 1
        """), {"org_id": tzmicha.id}).fetchone()
        
        if admin:
            print(f"✅ Admin exists: {admin.email} ({admin.role})")
        else:
            print("❌ No admin found! Creating one...")
            
            # Create admin
            email = "admin@tzmicha.com"
            password = "TzMicha@2026"
            pw_hash = pwd_ctx.hash(password)
            
            conn.execute(text("""
                INSERT INTO users (organization_id, email, password_hash, role, status)
                VALUES (:org_id, :email, :pw, 'ADMIN', 'active')
            """), {"org_id": tzmicha.id, "email": email, "pw": pw_hash})
            
            print(f"✅ Created admin: {email}")
            print(f"🔑 Password: {password}")
    else:
        print("\n❌ TzMicha organization NOT FOUND!")
        print("Creating TzMicha organization...")
        
        # Create TzMicha org
        result = conn.execute(text("""
            INSERT INTO organizations (name, settings)
            VALUES ('TzMicha', '{}')
            RETURNING id
        """))
        org_id = result.fetchone()[0]
        
        print(f"✅ Created TzMicha organization (ID: {org_id})")
        
        # Create admin
        email = "admin@tzmicha.com"
        password = "TzMicha@2026"
        pw_hash = pwd_ctx.hash(password)
        
        conn.execute(text("""
            INSERT INTO users (organization_id, email, password_hash, role, status)
            VALUES (:org_id, :email, :pw, 'ADMIN', 'active')
        """), {"org_id": org_id, "email": email, "pw": pw_hash})
        
        print(f"✅ Created admin user: {email}")
        print(f"🔑 Password: {password}")
    
    print("\n" + "=" * 60)
    print("🎉 LOGIN CREDENTIALS FOR TZMICHA")
    print("=" * 60)
    print(f"URL:      https://callingos.tzmicha.com/login")
    print(f"Email:    admin@tzmicha.com")
    print(f"Password: TzMicha@2026")
    print("=" * 60)
