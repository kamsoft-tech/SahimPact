from app.db.database import SessionLocal
from app.models.models import Account, Company
import os

os.environ["DATABASE_URL"] = "sqlite:///./partnersystem.db"

db = SessionLocal()
accs = db.query(Account).all()
print("ACCOUNTS IN DB:")
for a in accs:
    print(f"ID: {a.id}, Name: {a.name}, Type: {a.type}, Company: {a.company_id}")

cos = db.query(Company).all()
print("\nCOMPANIES IN DB:")
for c in cos:
    print(f"ID: {c.id}, Name: {c.name}")
db.close()
