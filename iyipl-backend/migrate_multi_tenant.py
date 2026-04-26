import sqlite3
import datetime

DB_FILE = "iyipl.db"

def add_column_if_not_exists(cursor, table, column_def):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")
        print(f"Added {column_def} to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"Column {column_def.split()[0]} already exists in {table}")
        else:
            print(f"Error adding to {table}: {e}")

def migrate():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Create companies table if it doesn't exist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR NOT NULL UNIQUE,
        created_at DATETIME,
        is_active BOOLEAN
    )
    """)
    conn.commit()

    # Create Default Company
    cursor.execute("SELECT id FROM companies WHERE name = 'Default Company'")
    default_company = cursor.fetchone()
    
    if not default_company:
        now = datetime.datetime.utcnow().isoformat()
        cursor.execute("INSERT INTO companies (name, created_at, is_active) VALUES (?, ?, ?)", 
                       ("Default Company", now, True))
        conn.commit()
        company_id = cursor.lastrowid
        print(f"Created 'Default Company' with ID: {company_id}")
    else:
        company_id = default_company[0]
        print(f"'Default Company' already exists with ID: {company_id}")

    # Add company_id to tables
    tables_to_update = [
        "users",
        "partner_shares",
        "time_entries",
        "accounts",
        "transactions",
        "global_settings",
        "monthly_reports"
    ]

    for table in tables_to_update:
        # Check if table exists
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
        if cursor.fetchone():
            add_column_if_not_exists(cursor, table, "company_id INTEGER REFERENCES companies(id)")
            # Assign existing records to the Default Company
            cursor.execute(f"UPDATE {table} SET company_id = ? WHERE company_id IS NULL", (company_id,))
            conn.commit()
            print(f"Migrated existing records in '{table}' to company_id={company_id}")

    # Upgrade the old admin to super_admin so they can manage companies
    cursor.execute("UPDATE users SET role = 'super_admin' WHERE username = 'admin'")
    conn.commit()
    print("Upgraded 'admin' to 'super_admin' role.")

    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
