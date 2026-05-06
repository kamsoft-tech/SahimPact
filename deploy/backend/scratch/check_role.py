import sqlite3
conn = sqlite3.connect('sahimpact.db')
cursor = conn.cursor()
cursor.execute('SELECT role FROM users LIMIT 1;')
print(cursor.fetchone()[0])
conn.close()
