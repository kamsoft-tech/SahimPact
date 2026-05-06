import sqlite3

def migrate():
    conn = sqlite3.connect('sahimpact.db')
    cursor = conn.cursor()
    
    try:
        # Add email to users
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
        print("Added email column to users table.")
    except sqlite3.OperationalError:
        print("email column already exists in users table.")

    try:
        # Add white-labeling to global_settings
        cursor.execute("ALTER TABLE global_settings ADD COLUMN logo_url TEXT")
        cursor.execute("ALTER TABLE global_settings ADD COLUMN primary_color TEXT DEFAULT '#94d4ad'")
        cursor.execute("ALTER TABLE global_settings ADD COLUMN secondary_color TEXT DEFAULT '#bfc1ff'")
        print("Added white-labeling columns to global_settings table.")
    except sqlite3.OperationalError:
        print("White-labeling columns already exist in global_settings table.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
