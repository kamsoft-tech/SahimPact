from app.core.security import verify_password, get_password_hash
from app.db.database import SessionLocal
from app.models.models import User

def test_login():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "Partner 1").first()
        if not user:
            print("User 'Partner 1' not found")
            return
            
        print(f"User found: {user.username}")
        print(f"Hashed password: {user.hashed_password}")
        
        # Test hashing a new password
        try:
            new_hash = get_password_hash("testpassword")
            print(f"New hash: {new_hash}")
        except Exception as e:
            print(f"Error hashing password: {e}")
            
        # Test verification
        try:
            # Let's see if the existing one can be verified
            # We assume it was hashed with 'password' if seeded
            is_valid = verify_password("password", user.hashed_password)
            print(f"Verification result: {is_valid}")
        except Exception as e:
            print(f"Error verifying password: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_login()
