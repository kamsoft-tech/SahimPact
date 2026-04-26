import sqlite3
import os

db_path = r'c:\Users\NaumanBaig\Desktop\IYI PL\iyipl-backend\iyipl.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(partner_shares)")
    columns = cursor.fetchall()
    print("Columns in partner_shares:")
    for col in columns:
        print(col)
    conn.close()
