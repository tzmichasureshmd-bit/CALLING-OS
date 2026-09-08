from dotenv import load_dotenv; load_dotenv()
from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='devices' ORDER BY ordinal_position"))
    print('DEVICES:', [row[0] for row in r])
    r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='calls' ORDER BY ordinal_position"))
    print('CALLS:', [row[0] for row in r])
    r = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name='audit_logs'"))
    print('AUDIT_LOGS table:', r.fetchone())
