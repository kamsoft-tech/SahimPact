import sqlite3

conn = sqlite3.connect("iyipl.db")
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(global_settings)")
existing_cols = [row[1] for row in cursor.fetchall()]

if "partnership_mode" not in existing_cols:
    cursor.execute("ALTER TABLE global_settings ADD COLUMN partnership_mode VARCHAR DEFAULT 'both'")
    print("Added partnership_mode to global_settings.")

if "labour_share_mode" not in existing_cols:
    cursor.execute("ALTER TABLE global_settings ADD COLUMN labour_share_mode VARCHAR DEFAULT 'time'")
    print("Added labour_share_mode to global_settings.")

conn.commit()
conn.close()

print("Migration for global_settings complete.")
