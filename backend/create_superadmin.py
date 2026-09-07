"""
create_superadmin.py
Creates the platform-level SUPER_ADMIN user.
This user can see ALL organizations, ALL employees, ALL calls.
Run: python create_superadmin.py
"""
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os, sys

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
e = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

# Super admin credentials — change password after first login
SUPER_EMAIL    = "superadmin@callnexa.com"
SUPER_PASSWORD = "SuperAdmin@2026"

with e.connect() as c:
    # Use the first org as the "platform" org for the super admin user
    org = c.execute(text("SELECT id, name FROM organizations LIMIT 1")).fetchone()
    if not org:
        sys.stdout.write("ERROR: No organizations found. Run recreate_admin.py first.\n")
        sys.exit(1)

    # Check if already exists
    existing = c.execute(text(
        "SELECT id, role FROM users WHERE email = :email"
    ), {"email": SUPER_EMAIL}).fetchone()

    if existing:
        # Update role to SUPER_ADMIN if needed
        if existing[1] != "SUPER_ADMIN":
            c.execute(text("UPDATE users SET role = 'SUPER_ADMIN' WHERE email = :email"), {"email": SUPER_EMAIL})
            sys.stdout.write(f"UPDATED role to SUPER_ADMIN for {SUPER_EMAIL}\n")
        else:
            sys.stdout.write(f"ALREADY EXISTS: {SUPER_EMAIL} (SUPER_ADMIN)\n")
    else:
        pw_hash = pwd_ctx.hash(SUPER_PASSWORD)
        c.execute(text("""
            INSERT INTO users (organization_id, email, password_hash, role, status)
            VALUES (:oid, :email, :pw, 'SUPER_ADMIN', 'active')
        """), {"oid": org[0], "email": SUPER_EMAIL, "pw": pw_hash})
        sys.stdout.write(f"CREATED SUPER_ADMIN: {SUPER_EMAIL}\n")

    sys.stdout.write(f"\n=== SUPER ADMIN LOGIN ===\n")
    sys.stdout.write(f"URL:      callingos.tzmicha.com\n")
    sys.stdout.write(f"Email:    {SUPER_EMAIL}\n")
    sys.stdout.write(f"Password: {SUPER_PASSWORD}\n")
    sys.stdout.write(f"Access:   /superadmin — sees ALL organizations\n")
    sys.stdout.flush()
