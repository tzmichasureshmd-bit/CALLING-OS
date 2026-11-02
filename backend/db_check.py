"""Read-only database connectivity and schema check."""

from sqlalchemy import inspect, text

from app.database import engine


with engine.connect() as conn:
    conn.execute(text("SELECT 1"))
    tables = inspect(conn).get_table_names()

print("Database connection: OK")
print(f"Public tables discovered: {len(tables)}")
