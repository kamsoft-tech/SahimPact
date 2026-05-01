from app.db.database import SessionLocal
from app.models.models import TimeEntry, PartnerShare, User

db = SessionLocal()

# 1. Clear any existing time entries for testing
db.query(TimeEntry).delete()
db.commit()

# 2. Add some test time entries
partners = db.query(User).filter(User.username.in_(["Partner 1", "Partner 2", "Partner 3"])).all()
p1 = next(p for p in partners if p.username == "Partner 1")
p2 = next(p for p in partners if p.username == "Partner 2")

t1 = TimeEntry(user_id=p1.id, hours=10.0, description="Shift 1")
t2 = TimeEntry(user_id=p2.id, hours=30.0, description="Shift 2")
db.add_all([t1, t2])
db.commit()

# 3. Simulate the /shares endpoint logic
open_entries = db.query(TimeEntry).filter(TimeEntry.is_closed == False).all()
total_hours = sum(e.hours for e in open_entries)

partner_hours = {}
for entry in open_entries:
    partner_hours[entry.user_id] = partner_hours.get(entry.user_id, 0.0) + entry.hours

shares = db.query(PartnerShare).all()
print(f"Total Hours Logged: {total_hours}")
for share in shares:
    user = db.query(User).filter(User.id == share.user_id).first()
    if total_hours > 0:
        hrs = partner_hours.get(share.user_id, 0.0)
        dynamic_share = (hrs / total_hours) * 100
        print(f"{user.username}: {dynamic_share}% (Logged {hrs} hours)")
    else:
        print(f"{user.username}: 0.0% (No hours logged total)")

db.close()
