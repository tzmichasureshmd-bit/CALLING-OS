import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
raw = os.getenv("DATABASE_URL")
url = raw.replace("postgresql+psycopg://", "postgresql://").replace("%40", "@")

conn = psycopg2.connect(url)
cur = conn.cursor()

# Check all tables
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
print("Tables:", [r[0] for r in cur.fetchall()])

# Check users table columns
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' AND table_schema='public' ORDER BY ordinal_position")
cols = cur.fetchall()
print("\nusers columns:", [(c[0], c[1]) for c in cols])

# Find danievens
cur.execute("SELECT * FROM users WHERE email LIKE '%danievens%' LIMIT 1")
row = cur.fetchone()
col_names = [desc[0] for desc in cur.description]
if row:
    for i, val in enumerate(row):
        if col_names[i] not in ('password_hash', 'encrypted_password', 'totp_secret'):
            print(f"  {col_names[i]}: {val}")
        else:
            print(f"  {col_names[i]}: [HIDDEN]")
else:
    print("User not found!")

cur.close()
conn.close()
