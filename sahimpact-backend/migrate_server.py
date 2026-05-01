import sqlite3
import os

# Path in Docker container
DB_PATH = "/app/data/partnersystem.db"

def add_column_if_not_exists(cursor, table, column_def):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")
        print(f"✅ Added {column_def} to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"ℹ️ Column {column_def.split()[0]} already exists in {table}")
        else:
            print(f"❌ Error adding to {table}: {e}")

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return

    print(f"🚀 Starting migration on {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Ensure companies table exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR NOT NULL UNIQUE,
        created_at DATETIME,
        is_active BOOLEAN
    )
    """)
    
    # Create Default Company if none
    cursor.execute("SELECT id FROM companies WHERE name = 'Default Company'")
    default_company = cursor.fetchone()
    if not default_company:
        cursor.execute("INSERT INTO companies (name, is_active) VALUES (?, ?)", ("Default Company", True))
        company_id = cursor.lastrowid
        print(f"✅ Created Default Company (ID: {company_id})")
    else:
        company_id = default_company[0]

    # Tables that need company_id
    tables = ["users", "partner_shares", "time_entries", "accounts", "transactions", "global_settings", "monthly_reports"]

    for table in tables:
        add_column_if_not_exists(cursor, table, "company_id INTEGER REFERENCES companies(id)")
        
        # General conflict resolution for unique constraints
        if table == "global_settings":
            # Add white-labeling columns if missing
            add_column_if_not_exists(cursor, table, "logo_url TEXT")
            add_column_if_not_exists(cursor, table, "favicon_url TEXT")
            add_column_if_not_exists(cursor, table, "primary_color TEXT DEFAULT '#94d4ad'")
            add_column_if_not_exists(cursor, table, "secondary_color TEXT DEFAULT '#bfc1ff'")

            cursor.execute("SELECT id FROM global_settings WHERE company_id = ?", (company_id,))
            if cursor.fetchone():
                print(f"⚠️ Default company already has settings. Deleting orphans to avoid UNIQUE constraint conflict...")
                cursor.execute("DELETE FROM global_settings WHERE company_id IS NULL")
        
        if table == "users":
            # Add missing columns for security/white-labeling
            add_column_if_not_exists(cursor, table, "email TEXT")
            add_column_if_not_exists(cursor, table, "mfa_secret TEXT")
        
        if table == "partner_shares":
            # Delete orphans where a record already exists for that user in the default company
            cursor.execute("""
                DELETE FROM partner_shares 
                WHERE company_id IS NULL 
                AND user_id IN (SELECT user_id FROM partner_shares WHERE company_id = ?)
            """, (company_id,))
            print(f"🧹 Cleaned up duplicate partner_shares orphans")

        # Assign orphans to default company
        cursor.execute(f"UPDATE {table} SET company_id = ? WHERE company_id IS NULL", (company_id,))
        print(f"✅ Updated orphans in {table}")

    # Ensure every user has a PartnerShare record
    cursor.execute("SELECT id FROM users WHERE company_id = ?", (company_id,))
    user_ids = [r[0] for r in cursor.fetchall()]
    for u_id in user_ids:
        cursor.execute("SELECT id FROM partner_shares WHERE user_id = ?", (u_id,))
        if not cursor.fetchone():
            print(f"➕ Creating missing PartnerShare for User ID: {u_id}")
            cursor.execute("INSERT INTO partner_shares (user_id, company_id, capital_share_fixed, labor_share_variable, voluntary_charity_percentage) VALUES (?, ?, 0, 0, 0)", (u_id, company_id))

    # Fix NULL is_closed values
    for table in ["transactions", "time_entries"]:
        cursor.execute(f"UPDATE {table} SET is_closed = 0 WHERE is_closed IS NULL")
        print(f"✅ Fixed NULL is_closed in {table}")

    conn.commit()
    conn.close()
    print("🏁 Migration complete!")

if __name__ == "__main__":
    run_migration()
