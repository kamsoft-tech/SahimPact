from app.db.database import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()
admin = db.query(User).filter(User.username == 'admin').first()
if admin:
    admin.hashed_password = get_password_hash('admin')
    db.commit()
    print('Admin password reset to admin')
else:
    print('Admin not found')
