from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql+psycopg://postgres.gjfohkxocurrzbdpybuu:TzMicha%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Mark recent call as business
session.execute(text("""
    UPDATE calls
    SET call_privacy = 'business'
    WHERE id = 'tzm-cal-f6a8434a800a'
"""))
session.commit()

print("✅ Call marked as business!")
session.close()
