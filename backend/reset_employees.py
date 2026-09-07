"""
reset_employees.py
Wipes all data except organizations using DELETE (no timeout issues).
Run: python reset_employees.py
"""
from dotenv import load_dotenv; load_dotenv()
from sqlalchemy import create_engine, text
import os

e = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")

# DELETE in correct FK order — no cascade timeout issues
STATEMENTS = [
    "DELETE FROM calls",
    "DELETE FROM sims",
    "DELETE FROM devices",
    "DELETE FROM employees",
    "DELETE FROM users",
    "DELETE FROM audit_logs",
    "DELETE FROM leads",
    "DELETE FROM opportunities",
    "DELETE FROM excluded_numbers",
    "DELETE FROM invoices",
]

print("Deleting rows one by one...")
for sql in STATEMENTS:
    table = sql.split()[-1]
    try:
        with e.connect() as c:
            result = c.execute(text(sql))
        print(f"  OK {table}")
    except Exception as ex:
        print(f"  FAIL {table}: {ex}")

print("\nVerify:")
for table in ["calls","sims","devices","employees","users","organizations"]:
    with e.connect() as c:
        n = c.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
        print(f"  {table}: {n}")

print("\nDone. Organizations kept.")
