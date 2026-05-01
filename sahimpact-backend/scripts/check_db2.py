from app.db.database import SessionLocal
from app.models.models import User

db = SessionLocal()
users = db.query(User).all()

for u in users:
    print(f"ID={u.id}, User={u.username}, Role={u.role}, Type={type(u.role)}")
db.close()
