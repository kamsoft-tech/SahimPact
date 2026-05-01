import sqlite3

def check_users():
    conn = sqlite3.connect('partnersystem.db')
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, company_id, role FROM users")
        rows = cursor.fetchall()
        print("ID | Username | Company ID | Role")
        print("-" * 40)
        for row in rows:
            print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_users()
