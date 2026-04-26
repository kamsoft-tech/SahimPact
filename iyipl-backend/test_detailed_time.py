from app.db.database import SessionLocal
from app.models.models import TimeEntry, PartnerShare, User
from datetime import datetime, timedelta

db = SessionLocal()

def run_test():
    print("--- Detailed Time Logging Test ---")
    
    # 1. Clear existing for clean test
    db.query(TimeEntry).delete()
    db.commit()
    
    # 2. Setup Partners
    partners = db.query(User).filter(User.username.in_(["Partner 1", "Partner 2", "Partner 3"])).all()
    if len(partners) < 2:
        print("Not enough partners found. Ensure seeding is done.")
        return
        
    p1 = next(p for p in partners if p.username == "Partner 1")
    p2 = next(p for p in partners if p.username == "Partner 2")
    
    # 3. Add Time Entries with start/end
    # Partner 1: 4 hours
    now = datetime.now()
    t1 = TimeEntry(
        user_id=p1.id, 
        start_time=now, 
        end_time=now + timedelta(hours=4),
        hours=4.0, # Manually set for now as if by API
        description="P1 Shift"
    )
    
    # Partner 2: 12 hours
    t2 = TimeEntry(
        user_id=p2.id, 
        start_time=now, 
        end_time=now + timedelta(hours=12),
        hours=12.0,
        description="P2 Shift"
    )
    
    db.add_all([t1, t2])
    db.commit()
    
    # 4. Total Hours calculation (Verification)
    open_entries = db.query(TimeEntry).filter(TimeEntry.is_closed == False).all()
    total_hours = sum(e.hours for e in open_entries)
    print(f"Total Open Hours: {total_hours}")
    
    # 5. Dynamic Share Calculation (Verification)
    p1_hours = sum(e.hours for e in open_entries if e.user_id == p1.id)
    p2_hours = sum(e.hours for e in open_entries if e.user_id == p2.id)
    
    p1_share = (p1_hours / total_hours) * 100 if total_hours > 0 else 0
    p2_share = (p2_hours / total_hours) * 100 if total_hours > 0 else 0
    
    print(f"Partner 1: {p1_hours} hrs -> {p1_share:.2f}%")
    print(f"Partner 2: {p2_hours} hrs -> {p2_share:.2f}%")
    
    # 6. Test an "Edit" (Admin simulation)
    # Change P1 shift to 8 hours
    t1.end_time = t1.start_time + timedelta(hours=8)
    t1.hours = 8.0 # Recalculated by logic usually, here we simulate
    db.commit()
    
    # Recalculate
    open_entries = db.query(TimeEntry).filter(TimeEntry.is_closed == False).all()
    total_hours = sum(e.hours for e in open_entries)
    p1_hours = sum(e.hours for e in open_entries if e.user_id == p1.id)
    p1_share = (p1_hours / total_hours) * 100 if total_hours > 0 else 0
    
    print(f"After Admin Edit (P1 now 8h, P2 12h):")
    print(f"Total Open Hours: {total_hours}")
    print(f"Partner 1: {p1_hours} hrs -> {p1_share:.2f}%")

    db.close()

if __name__ == "__main__":
    run_test()
