import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "sahimpact.db")

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Adding favicon_url to global_settings...")
        cursor.execute("ALTER TABLE global_settings ADD COLUMN favicon_url TEXT")
        conn.commit()
        print("Migration successful!")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column favicon_url already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
