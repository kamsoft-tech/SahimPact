import sqlite3
import os

db_path = r'c:\Users\akamr\projects\SahimPact\sahimpact-backend\partnersystem.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Time Entries ---")
cursor.execute("SELECT id, user_id, start_time, end_time, hours, description, is_closed FROM time_entries ORDER BY id DESC LIMIT 10")
for row in cursor.fetchall():
    print(row)

conn.close()
