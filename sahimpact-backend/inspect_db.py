import sqlite3
import os

db_path = r'c:\Users\akamr\projects\SahimPact\sahimpact-backend\partnersystem.db'

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Transactions ---")
cursor.execute("SELECT id, company_id, date, description, is_closed FROM transactions ORDER BY id DESC LIMIT 10")
for row in cursor.fetchall():
    print(row)

print("\n--- Journal Entries ---")
cursor.execute("SELECT id, transaction_id, account_id, amount, type FROM journal_entries ORDER BY id DESC LIMIT 20")
for row in cursor.fetchall():
    print(row)

print("\n--- Accounts ---")
cursor.execute("SELECT id, company_id, name, type FROM accounts")
for row in cursor.fetchall():
    print(row)

conn.close()
