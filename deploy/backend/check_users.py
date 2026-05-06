import sqlite3

def check_users():
    conn = sqlite3.connect('sahimpact.db')
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM users")
    users = cursor.fetchall()
    print("Existing users and roles:")
    for user in users:
        print(f"- {user[0]}: {user[1]}")
    conn.close()

if __name__ == "__main__":
    check_users()
