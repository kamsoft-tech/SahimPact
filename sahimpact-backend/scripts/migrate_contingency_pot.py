import sqlite3
import os

DB_PATH = "sahimpact.db"

def migrate():
    print(f"Connecting to {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE global_settings ADD COLUMN contingency_pot_minimum FLOAT DEFAULT 10000.0")
        print("Added contingency_pot_minimum.")
    except sqlite3.OperationalError as e:
        print(f"Skipping contingency_pot_minimum: {e}")

    cursor.execute("UPDATE global_settings SET contingency_pot_minimum = 10000.0 WHERE contingency_pot_minimum IS NULL")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
