"""
Create New Client Organization
Quick script to onboard a new client
"""
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from app.auth.password import get_password_hash
import os
import secrets

# Client details - EDIT THESE
CLIENT_NAME = "Tech Sales Corp"  # Change this
CLIENT_EMAIL = "admin@techsales.com"  # Change this
CLIENT_PHONE = "+91 9876543210"  # Change this
CLIENT_ADMIN_PASSWORD = "TechSales@2026"  # Change this - client will change on first login
EMPLOYEE_COUNT = 5000  # Change this

print("="*70)
print("CREATE NEW CLIENT ORGANIZATION")
print("="*70)

# Connect to database
db_url = os.environ['DATABASE_URL']
engine = create_engine(db_url, isolation_level="AUTOCOMMIT")
conn = engine.connect()

print(f"\n📋 Client Details:")
print(f"   Name: {CLIENT_NAME}")
print(f"   Email: {CLIENT_EMAIL}")
print(f"   Employees: {EMPLOYEE_COUNT}")

# Generate unique code
code = f'CLI-2026-{secrets.randbelow(9000) + 1000}'
slug = CLIENT_NAME.lower().replace(' ', '-').replace('.', '')
slug = ''.join(c for c in slug if c.isalnum() or c == '-')

print(f"\n🔑 Generated Code: {code}")

# Create organization
try:
    org_result = conn.execute(text("""
        INSERT INTO organizations (
            tenant_prefix, name, slug, code, email, phone,
            industry, team_size, timezone, plan, status
        ) VALUES (
            'cli', :name, :slug, :code, :email, :phone,
            'Sales', :team_size, 'Asia/Kolkata', 'enterprise', 'active'
        )
        RETURNING id, name, code
    """), {
        'name': CLIENT_NAME,
        'slug': slug,
        'code': code,
        'email': CLIENT_EMAIL,
        'phone': CLIENT_PHONE,
        'team_size': EMPLOYEE_COUNT
    })
    
    org = org_result.fetchone()
    org_id = org[0]
    
    print(f"\n✅ Organization Created!")
    print(f"   ID: {org_id}")
    print(f"   Code: {org[2]}")
    
except Exception as e:
    print(f"\n❌ Error creating organization: {e}")
    conn.close()
    exit(1)

# Create admin user
try:
    pw_hash = get_password_hash(CLIENT_ADMIN_PASSWORD)
    
    user_result = conn.execute(text("""
        INSERT INTO users (
            organization_id, email, password_hash, role, status
        ) VALUES (
            :org_id, :email, :pw_hash, 'ADMIN', 'active'
        )
        RETURNING id, email
    """), {
        'org_id': org_id,
        'email': CLIENT_EMAIL,
        'pw_hash': pw_hash
    })
    
    user = user_result.fetchone()
    
    print(f"\n✅ Admin User Created!")
    print(f"   ID: {user[0]}")
    print(f"   Email: {user[1]}")
    
except Exception as e:
    print(f"\n❌ Error creating admin user: {e}")
    conn.close()
    exit(1)

# Success summary
print("\n" + "="*70)
print("🎉 CLIENT ONBOARDING COMPLETE!")
print("="*70)

print(f"\n📧 SEND THESE CREDENTIALS TO CLIENT:")
print(f"")
print(f"   Dashboard URL: https://callingos.tzmicha.com")
print(f"   Company Code: {code}")
print(f"   Admin Email: {CLIENT_EMAIL}")
print(f"   Admin Password: {CLIENT_ADMIN_PASSWORD}")
print(f"")
print(f"   ⚠️  Please ask client to change password on first login")

print(f"\n📱 MOBILE APP SETUP:")
print(f"   1. Download APK from [your link]")
print(f"   2. Install on Android device")
print(f"   3. Enter company code: {code}")
print(f"   4. Create employee accounts")
print(f"   5. Grant permissions")
print(f"   6. Start syncing!")

print(f"\n💰 BILLING:")
print(f"   Employees: {EMPLOYEE_COUNT}")
print(f"   Rate: ₹50 per employee/month")
print(f"   Monthly: ₹{EMPLOYEE_COUNT * 50:,}")
print(f"   Annual: ₹{EMPLOYEE_COUNT * 50 * 12:,}")
print(f"   Setup Fee: ₹8,00,000 (one-time)")

print(f"\n✅ Next Steps:")
print(f"   1. Send credentials to client")
print(f"   2. Schedule training session")
print(f"   3. Import employee list")
print(f"   4. Distribute mobile app")
print(f"   5. Monitor first week")
print(f"   6. Collect payment!")

print("\n" + "="*70)
conn.close()
