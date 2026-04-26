import sqlite3

def migrate():
    conn = sqlite3.connect("iyipl.db")
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE time_entries ADD COLUMN start_time DATETIME;")
        print("start_time column added.")
    except sqlite3.OperationalError as e:
        print(f"start_time column already exists or error: {e}")

    try:
        cursor.execute("ALTER TABLE time_entries ADD COLUMN end_time DATETIME;")
        print("end_time column added.")
    except sqlite3.OperationalError as e:
        print(f"end_time column already exists or error: {e}")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
