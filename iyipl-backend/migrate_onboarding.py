import sqlite3
import os

def migrate():
    db_path = "iyipl.db"
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(global_settings)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "is_setup_complete" not in columns:
            print("Adding is_setup_complete column to global_settings table...")
            cursor.execute("ALTER TABLE global_settings ADD COLUMN is_setup_complete BOOLEAN DEFAULT 0")
            # Update existing to true if they have settings already? 
            # Actually, user wants to be asked, so let's keep it false for existing too if they need to confirm.
            # But usually existing users might want it true. Let's set it true for now if charity_percentage > 0
            cursor.execute("UPDATE global_settings SET is_setup_complete = 1 WHERE charity_percentage > 0")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column is_setup_complete already exists.")

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
