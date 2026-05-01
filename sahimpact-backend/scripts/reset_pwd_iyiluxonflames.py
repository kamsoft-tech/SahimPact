from app.db.database import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()
admin = db.query(User).filter(User.company_id == 3, User.role == 'ADMIN').first()
if admin:
    print("Admin Username:", admin.username)
    admin.hashed_password = get_password_hash('password123')
    db.commit()
    print("Password reset to: password123")
else:
    print("Admin not found for company 3")
