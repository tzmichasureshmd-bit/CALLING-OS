from dotenv import load_dotenv; load_dotenv()
from app.database import SessionLocal
from app.models import Organization, Employee, Call, Device, User
db = SessionLocal()
try:
    print('orgs:', db.query(Organization).count())
    print('employees:', db.query(Employee).count())
    print('calls:', db.query(Call).count())
    print('devices:', db.query(Device).count())
    print('users:', db.query(User).filter(User.status=='active').count())
    devs = db.query(Device).limit(1).all()
    for d in devs:
        print('device sample:', d.id, d.model, d.permissions_status, d.latitude)
    print('ALL QUERIES OK')
finally:
    db.close()
