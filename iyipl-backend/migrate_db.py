"""
One-time migration: Add missing columns to the SQLite database
to match the current SQLAlchemy models.
"""
import sqlite3

conn = sqlite3.connect("iyipl.db")
cursor = conn.cursor()

# Get existing columns in the transactions table
cursor.execute("PRAGMA table_info(transactions)")
existing_cols = [row[1] for row in cursor.fetchall()]
print(f"Existing columns: {existing_cols}")

# Add is_closed if missing
if "is_closed" not in existing_cols:
    cursor.execute("ALTER TABLE transactions ADD COLUMN is_closed BOOLEAN DEFAULT 0")
    print("Added 'is_closed' column to transactions.")
else:
    print("'is_closed' already exists.")

# Check monthly_reports table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_reports'")
if not cursor.fetchone():
    print("Table 'monthly_reports' is missing — this will be created by SQLAlchemy on next startup.")
else:
    print("'monthly_reports' table exists.")

conn.commit()
conn.close()

print("Migration complete.")
