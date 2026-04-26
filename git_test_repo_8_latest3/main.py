from app.db.database import SessionLocal
from app.models.models import User, RoleEnum
from app.core.security import get_password_hash

def seed():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin"),
                role=RoleEnum.ADMIN
            )
            db.add(admin)
            db.commit()
            print("Admin created successfully")
        else:
            print("Admin already exists")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
