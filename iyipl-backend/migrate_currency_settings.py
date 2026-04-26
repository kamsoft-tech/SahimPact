import sqlite3
import os

def migrate():
    db_path = r'c:\Users\NaumanBaig\Desktop\IYI PL\iyipl-backend\iyipl.db'
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(global_settings)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'currency_symbol' not in columns:
            print("Adding currency_symbol to global_settings...")
            cursor.execute("ALTER TABLE global_settings ADD COLUMN currency_symbol VARCHAR DEFAULT '£'")
            print("Successfully added currency_symbol.")
        else:
            print("currency_symbol already exists in global_settings.")

        conn.commit()
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
