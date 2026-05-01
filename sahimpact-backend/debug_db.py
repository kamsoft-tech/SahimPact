import sqlite3
import os

DB_PATH = "/app/data/partnersystem.db"

def debug():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n--- Companies ---")
    cursor.execute("SELECT * FROM companies")
    for row in cursor.fetchall():
        print(row)

    print("\n--- Global Settings ---")
    cursor.execute("PRAGMA table_info(global_settings)")
    print("Columns:", [c[1] for c in cursor.fetchall()])
    
    cursor.execute("SELECT * FROM global_settings")
    for row in cursor.fetchall():
        print(row)

    print("\n--- Users ---")
    cursor.execute("SELECT id, username, company_id, role FROM users")
    for row in cursor.fetchall():
        print(row)

    conn.close()

if __name__ == "__main__":
    debug()
