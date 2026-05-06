from app.db.database import SessionLocal
from app.models.models import TimeEntry, User
import json

db = SessionLocal()
try:
    entries = db.query(TimeEntry).all()
    print(f"Total entries in DB: {len(entries)}")
    for e in entries:
        print(f"ID: {e.id}, User: {e.user_id}, Company: {e.company_id}, Hours: {e.hours}, Date: {e.date}, Start: {e.start_time}, Closed: {e.is_closed}")
        
    users = db.query(User).all()
    print(f"\nUsers in DB: {len(users)}")
    for u in users:
        print(f"ID: {u.id}, Username: {u.username}, Company: {u.company_id}")
finally:
    db.close()
