import sqlite3

def check():
    conn = sqlite3.connect('sahimpact.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Columns in users: {columns}")
    
    cursor.execute("PRAGMA table_info(global_settings)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Columns in global_settings: {columns}")
    
    conn.close()

if __name__ == "__main__":
    check()
