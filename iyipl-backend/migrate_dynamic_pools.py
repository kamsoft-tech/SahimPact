import sqlite3
import os

DB_PATH = "iyipl.db"

def migrate():
    print(f"Connecting to {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE global_settings ADD COLUMN capital_pool_percentage FLOAT DEFAULT 0.50")
        print("Added capital_pool_percentage.")
    except sqlite3.OperationalError as e:
        print(f"Skipping capital_pool_percentage: {e}")

    try:
        cursor.execute("ALTER TABLE global_settings ADD COLUMN labour_pool_percentage FLOAT DEFAULT 0.50")
        print("Added labour_pool_percentage.")
    except sqlite3.OperationalError as e:
        print(f"Skipping labour_pool_percentage: {e}")

    # Also update any existing rows to 0.50 instead of null if somehow needed
    cursor.execute("UPDATE global_settings SET capital_pool_percentage = 0.50 WHERE capital_pool_percentage IS NULL")
    cursor.execute("UPDATE global_settings SET labour_pool_percentage = 0.50 WHERE labour_pool_percentage IS NULL")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
