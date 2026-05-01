import sqlite3
from app.db.database import Base, engine
from app.models.models import *

def sync_schema():
    conn = sqlite3.connect('partnersystem.db')
    cursor = conn.cursor()
    
    # Get all tables from Base.metadata
    for table_name, table in Base.metadata.tables.items():
        print(f"Checking table: {table_name}")
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_columns = {row[1]: row[2] for row in cursor.fetchall()}
        
        for column in table.columns:
            if column.name not in existing_columns:
                print(f"Adding column {column.name} to {table_name}")
                col_type = str(column.type)
                if 'VARCHAR' in col_type:
                    type_str = 'VARCHAR'
                elif 'INTEGER' in col_type:
                    type_str = 'INTEGER'
                elif 'FLOAT' in col_type:
                    type_str = 'FLOAT'
                elif 'BOOLEAN' in col_type:
                    type_str = 'BOOLEAN'
                elif 'DATETIME' in col_type:
                    type_str = 'DATETIME'
                elif 'JSON' in col_type:
                    type_str = 'JSON'
                else:
                    type_str = 'VARCHAR' # Fallback
                
                default_clause = ""
                if column.default is not None and hasattr(column.default, 'arg'):
                    if not callable(column.default.arg):
                        default_clause = f" DEFAULT {column.default.arg}"
                
                try:
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {type_str}{default_clause}")
                except Exception as e:
                    print(f"Error adding column {column.name}: {e}")
    
    conn.commit()
    conn.close()
    print("Schema sync complete.")

if __name__ == "__main__":
    sync_schema()
