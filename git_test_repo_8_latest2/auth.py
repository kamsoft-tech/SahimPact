"""
Seed script: add missing Partner 2, Partner 3, and fix password for Partner 1.
Run this script while the backend is NOT running (or it's fine to run alongside).
"""
import sqlite3
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

conn = sqlite3.connect('iyipl.db')
c = conn.cursor()

partners = [
    ("Partner 1", 40, 20000),
    ("Partner 2", 30, 10000),
    ("Partner 3", 30, 10000),
]

for username, labor, capital in partners:
    c.execute("SELECT id FROM users WHERE username = ?", (username,))
    row = c.fetchone()
    if not row:
        hashed = hash_password("password")
        c.execute(
            "INSERT INTO users (username, hashed_password, role, is_active) VALUES (?, ?, ?, ?)",
            (username, hashed, "PARTNER", 1)
        )
        user_id = c.lastrowid
        print(f"Created user '{username}' with id={user_id}")

        c.execute(
            "INSERT INTO partner_shares (user_id, capital_share_fixed, labor_share_variable, voluntary_charity_percentage) VALUES (?, ?, ?, ?)",
            (user_id, float(capital), float(labor), 0.01)
        )
        print(f"  -> Linked PartnerShare (capital={capital}, labor={labor}%)")
    else:
        user_id = row[0]
        # Update password to be sure
        hashed = hash_password("password")
        c.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (hashed, user_id))
        print(f"Updated password for existing user '{username}' (id={user_id})")

        # Ensure partner_share exists
        c.execute("SELECT id FROM partner_shares WHERE user_id = ?", (user_id,))
        if not c.fetchone():
            c.execute(
                "INSERT INTO partner_shares (user_id, capital_share_fixed, labor_share_variable, voluntary_charity_percentage) VALUES (?, ?, ?, ?)",
                (user_id, float(capital), float(labor), 0.01)
            )
            print(f"  -> Created PartnerShare for '{username}'")

conn.commit()
conn.close()
print("\nDone! All partners seeded.")
