import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def reset_admin():
    conn = sqlite3.connect('sahimpact.db')
    cursor = conn.cursor()
    
    hashed_password = pwd_context.hash("ChangeMe_OnFirstLogin!")
    
    # Update admin
    cursor.execute("UPDATE users SET hashed_password = ?, role = 'super_admin' WHERE username = 'admin'", (hashed_password,))
    
    # Update partners to lowercase role values
    cursor.execute("UPDATE users SET role = 'partner' WHERE role = 'PARTNER'")
    
    conn.commit()
    print("Admin password reset and roles normalized.")
    conn.close()

if __name__ == "__main__":
    reset_admin()
