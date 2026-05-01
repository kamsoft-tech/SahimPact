import sqlite3

def normalize_roles():
    conn = sqlite3.connect('sahimpact.db')
    cursor = conn.cursor()
    
    # Update to uppercase member names to satisfy SQLAlchemy Enum validation
    cursor.execute("UPDATE users SET role = 'SUPER_ADMIN' WHERE role = 'super_admin'")
    cursor.execute("UPDATE users SET role = 'COMPANY_ADMIN' WHERE role = 'company_admin'")
    cursor.execute("UPDATE users SET role = 'PARTNER' WHERE role = 'partner'")
    
    conn.commit()
    print("Roles normalized to uppercase member names.")
    conn.close()

if __name__ == "__main__":
    normalize_roles()
