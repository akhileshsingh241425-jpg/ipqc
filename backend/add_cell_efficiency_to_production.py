"""
Migration script to add cell_efficiency column to production_records table
Run this on server: python add_cell_efficiency_to_production.py
"""
import sqlite3
import os

def add_cell_efficiency_column():
    # Get the database path
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'pdi_database.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(production_records)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'cell_efficiency' in columns:
            print("cell_efficiency column already exists in production_records table")
        else:
            # Add the column
            cursor.execute("ALTER TABLE production_records ADD COLUMN cell_efficiency REAL")
            conn.commit()
            print("Successfully added cell_efficiency column to production_records table")
        
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    add_cell_efficiency_column()
