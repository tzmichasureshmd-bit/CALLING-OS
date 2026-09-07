"""
recreate_admin.py
Recreates the ADMIN user for each organization.
Run: python recreate_admin.py
"""
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy import create_engine, text
from passlib.context import CryptContext
import os, sys

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

e = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

with e.connect() as c:
    orgs = c.execute(text("SELECT id, name, code, email FROM organizations")).fetchall()
    sys.stdout.write(f"Found {len(orgs)} organizations:\n")
    for o in orgs:
        sys.stdout.write(f"  [{o[1]}] code={o[2]} email={o[3]}\n")
    sys.stdout.flush()

# Admin credentials to create
ADMINS = [
    # (org_code, admin_email, admin_password)
    ("TZM-2026-4667", "admin@tzmicha.com",    "Admin@123"),
    ("MAN-2026-8167", "admin@mangalayam.com", "Admin@123"),
    ("SVG-2026-5437", "admin@svg.com",        "Admin@123"),
]

with e.connect() as c:
    for org_code, email, password in ADMINS:
        # Find org
        org = c.execute(text("SELECT id, name FROM organizations WHERE code = :code"), {"code": org_code}).fetchone()
        if not org:
            sys.stdout.write(f"ORG NOT FOUND: {org_code}\n")
            continue

        # Check if user already exists
        existing = c.execute(text(
            "SELECT id FROM users WHERE organization_id = :oid AND email = :email"
        ), {"oid": org[0], "email": email}).fetchone()

        if existing:
            sys.stdout.write(f"ALREADY EXISTS: {email}\n")
            continue

        pw_hash = pwd_ctx.hash(password)
        c.execute(text("""
            INSERT INTO users (organization_id, email, password_hash, role, status)
            VALUES (:oid, :email, :pw, 'ADMIN', 'active')
        """), {"oid": org[0], "email": email, "pw": pw_hash})

        sys.stdout.write(f"CREATED ADMIN: {email} for [{org[1]}]\n")
        sys.stdout.flush()

sys.stdout.write("\nDone. Login with the credentials above on web dashboard.\n")
sys.stdout.flush()
