"""
Complete System Audit - Check Everything
"""
from dotenv import load_dotenv
load_dotenv()

import os
from sqlalchemy import create_engine, text
from datetime import datetime

print("="*60)
print("CALL OS - COMPLETE SYSTEM AUDIT")
print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("="*60)

# Database connection
try:
    db_url = os.environ['DATABASE_URL']
    print(f"\n✓ Environment loaded")
    print(f"✓ Database: {db_url.split('@')[1].split('/')[0]}")
    
    engine = create_engine(db_url)
    conn = engine.connect()
    print("✓ Database connected")
except Exception as e:
    print(f"✗ Database connection failed: {e}")
    exit(1)

# 1. Check all tables
print("\n" + "="*60)
print("1. DATABASE TABLES")
print("="*60)
tables = conn.execute(text("""
    SELECT tablename FROM pg_tables 
    WHERE schemaname='public' 
    ORDER BY tablename
""")).fetchall()

for t in tables:
    print(f"  ✓ {t[0]}")
print(f"\nTotal tables: {len(tables)}")

# 2. Check organizations
print("\n" + "="*60)
print("2. ORGANIZATIONS")
print("="*60)
orgs = conn.execute(text("""
    SELECT id, name, code, email, status, created_at
    FROM organizations
    ORDER BY created_at DESC
""")).fetchall()

if not orgs:
    print("  ⚠ No organizations found!")
else:
    for o in orgs:
        status = "🟢 ACTIVE" if o[4] == 'active' else "🔴 INACTIVE"
        print(f"\n  {status}")
        print(f"  Name: {o[1]}")
        print(f"  Code: {o[2]}")
        print(f"  Email: {o[3]}")
        print(f"  Status: {o[4]}")
        print(f"  Created: {o[5]}")
        print(f"  ID: {o[0]}")

print(f"\nTotal organizations: {len(orgs)}")

# 3. Check users
print("\n" + "="*60)
print("3. USERS & ACCESS")
print("="*60)
users = conn.execute(text("""
    SELECT u.email, u.role, u.status, o.name as org_name, u.created_at
    FROM users u
    LEFT JOIN organizations o ON u.organization_id = o.id
    ORDER BY u.role, u.email
""")).fetchall()

if not users:
    print("  ⚠ No users found!")
else:
    super_admins = [u for u in users if u[1] == 'SUPER_ADMIN']
    admins = [u for u in users if u[1] == 'ADMIN']
    managers = [u for u in users if u[1] == 'MANAGER']
    regular = [u for u in users if u[1] not in ['SUPER_ADMIN', 'ADMIN', 'MANAGER']]
    
    if super_admins:
        print("\n  👑 SUPER ADMINS (Platform Access):")
        for u in super_admins:
            print(f"    • {u[0]} ({u[2]})")
    
    if admins:
        print("\n  🔑 ADMINS (Organization Access):")
        for u in admins:
            print(f"    • {u[0]} - {u[3]} ({u[2]})")
    
    if managers:
        print("\n  👥 MANAGERS:")
        for u in managers:
            print(f"    • {u[0]} - {u[3]} ({u[2]})")
    
    if regular:
        print("\n  👤 REGULAR USERS:")
        for u in regular[:5]:  # Show first 5
            print(f"    • {u[0]} - {u[3]} ({u[2]})")
        if len(regular) > 5:
            print(f"    ... and {len(regular)-5} more")

print(f"\nTotal users: {len(users)}")

# 4. Check employees
print("\n" + "="*60)
print("4. EMPLOYEES")
print("="*60)
emp_stats = conn.execute(text("""
    SELECT 
        o.name as org,
        COUNT(*) as total,
        SUM(CASE WHEN e.is_active THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN NOT e.is_active THEN 1 ELSE 0 END) as inactive
    FROM employees e
    JOIN organizations o ON e.organization_id = o.id
    GROUP BY o.name
""")).fetchall()

if not emp_stats:
    print("  ⚠ No employees found!")
else:
    for stat in emp_stats:
        print(f"\n  {stat[0]}:")
        print(f"    Total: {stat[1]}")
        print(f"    Active: {stat[2]} 🟢")
        print(f"    Inactive: {stat[3]} 🔴")

total_emps = conn.execute(text("SELECT COUNT(*) FROM employees")).fetchone()[0]
print(f"\nTotal employees across all orgs: {total_emps}")

# 5. Check devices
print("\n" + "="*60)
print("5. DEVICES")
print("="*60)
device_stats = conn.execute(text("""
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_online THEN 1 ELSE 0 END) as online,
        SUM(CASE WHEN NOT is_online THEN 1 ELSE 0 END) as offline,
        SUM(CASE WHEN assigned_employee_id IS NOT NULL THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN assigned_employee_id IS NULL THEN 1 ELSE 0 END) as unassigned
    FROM devices
""")).fetchone()

print(f"  Total devices: {device_stats[0]}")
print(f"  Online: {device_stats[1]} 🟢")
print(f"  Offline: {device_stats[2]} 🔴")
print(f"  Assigned: {device_stats[3]}")
print(f"  Unassigned: {device_stats[4]}")

# 6. Check calls
print("\n" + "="*60)
print("6. CALLS DATA")
print("="*60)
call_stats = conn.execute(text("""
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN call_type = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
        SUM(CASE WHEN call_type = 'incoming' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN call_type = 'missed' THEN 1 ELSE 0 END) as missed,
        SUM(CASE WHEN recording_url IS NOT NULL THEN 1 ELSE 0 END) as with_recording,
        SUM(CASE WHEN transcript IS NOT NULL THEN 1 ELSE 0 END) as with_transcript
    FROM calls
""")).fetchone()

print(f"  Total calls: {call_stats[0]}")
print(f"  Outgoing: {call_stats[1]}")
print(f"  Incoming: {call_stats[2]}")
print(f"  Missed: {call_stats[3]}")
print(f"  With recordings: {call_stats[4]}")
print(f"  With transcripts: {call_stats[5]}")

# Recent calls
recent = conn.execute(text("""
    SELECT timestamp, call_type, phone_number, duration
    FROM calls
    ORDER BY timestamp DESC
    LIMIT 5
""")).fetchall()

if recent:
    print("\n  Recent calls:")
    for r in recent:
        print(f"    • {r[0]} - {r[1]} - {r[2]} ({r[3]}s)")

# 7. Check leads
print("\n" + "="*60)
print("7. LEADS & OPPORTUNITIES")
print("="*60)
lead_count = conn.execute(text("SELECT COUNT(*) FROM leads")).fetchone()[0]
opp_count = conn.execute(text("SELECT COUNT(*) FROM opportunities")).fetchone()[0]
print(f"  Total leads: {lead_count}")
print(f"  Total opportunities: {opp_count}")

# 8. Check excluded numbers
print("\n" + "="*60)
print("8. EXCLUDED NUMBERS (DNC)")
print("="*60)
excluded_count = conn.execute(text("SELECT COUNT(*) FROM excluded_numbers")).fetchone()[0]
print(f"  Total excluded numbers: {excluded_count}")

# 9. System configuration
print("\n" + "="*60)
print("9. ENVIRONMENT CONFIGURATION")
print("="*60)
print(f"  APP_ENV: {os.environ.get('APP_ENV', 'not set')}")
print(f"  APP_DEBUG: {os.environ.get('APP_DEBUG', 'not set')}")
print(f"  CORS_ORIGINS: {os.environ.get('CORS_ORIGINS', 'not set')}")
print(f"  JWT configured: {'✓' if os.environ.get('JWT_SECRET_KEY') else '✗'}")
print(f"  Supabase configured: {'✓' if os.environ.get('SUPABASE_URL') else '✗'}")
print(f"  OpenAI configured: {'✓' if os.environ.get('OPENAI_API_KEY') else '✗'}")

# 10. Security audit
print("\n" + "="*60)
print("10. SECURITY AUDIT")
print("="*60)

# Check for users without passwords
no_pass = conn.execute(text("""
    SELECT email FROM users WHERE password_hash IS NULL
""")).fetchall()
if no_pass:
    print(f"  ⚠ {len(no_pass)} users without password:")
    for u in no_pass[:3]:
        print(f"    • {u[0]}")
else:
    print("  ✓ All users have passwords")

# Check for inactive admins
inactive_admins = conn.execute(text("""
    SELECT email FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN') AND status != 'active'
""")).fetchall()
if inactive_admins:
    print(f"  ⚠ {len(inactive_admins)} inactive admin accounts")
else:
    print("  ✓ All admin accounts are active")

# Check for unassigned devices
unassigned_dev = conn.execute(text("""
    SELECT COUNT(*) FROM devices WHERE assigned_employee_id IS NULL
""")).fetchone()[0]
if unassigned_dev > 0:
    print(f"  ⚠ {unassigned_dev} devices not assigned to employees")
else:
    print("  ✓ All devices are assigned")

print("\n" + "="*60)
print("AUDIT COMPLETE")
print("="*60)
print(f"\n✅ System Status: {'HEALTHY' if orgs and users else 'NEEDS SETUP'}")
print(f"✅ Total Organizations: {len(orgs)}")
print(f"✅ Total Users: {len(users)}")
print(f"✅ Total Employees: {total_emps}")
print(f"✅ Total Devices: {device_stats[0]}")
print(f"✅ Total Calls: {call_stats[0]}")

print("\n" + "="*60)
conn.close()
