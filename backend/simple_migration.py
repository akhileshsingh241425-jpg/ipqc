"""
Simple migration to add day_ipqc_pdf and night_ipqc_pdf columns
Run with: python simple_migration.py
"""
import pymysql
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'rohit'),
    'password': os.getenv('DB_PASSWORD', 'rohit0101'),
    'database': os.getenv('DB_NAME', 'pdi_database'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def migrate():
    print("🔄 Starting migration...")
    print(f"   Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}")
    
    try:
        # Connect to database
        connection = pymysql.connect(**DB_CONFIG)
        
        with connection.cursor() as cursor:
            # Check if columns exist
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = %s
                AND table_name = 'production_records' 
                AND column_name IN ('day_ipqc_pdf', 'night_ipqc_pdf')
            """, (DB_CONFIG['database'],))
            
            existing_columns = [row['column_name'] if isinstance(row, dict) else row[0] for row in cursor.fetchall()]
            
            # Add day_ipqc_pdf if not exists
            if 'day_ipqc_pdf' not in existing_columns:
                print("  ➕ Adding day_ipqc_pdf column...")
                cursor.execute("ALTER TABLE production_records ADD COLUMN day_ipqc_pdf VARCHAR(500)")
                connection.commit()
                print("  ✅ day_ipqc_pdf column added")
            else:
                print("  ⏭️  day_ipqc_pdf already exists")
            
            # Add night_ipqc_pdf if not exists
            if 'night_ipqc_pdf' not in existing_columns:
                print("  ➕ Adding night_ipqc_pdf column...")
                cursor.execute("ALTER TABLE production_records ADD COLUMN night_ipqc_pdf VARCHAR(500)")
                connection.commit()
                print("  ✅ night_ipqc_pdf column added")
            else:
                print("  ⏭️  night_ipqc_pdf already exists")
            
            # Migrate existing data from ipqc_pdf to day_ipqc_pdf
            print("  🔄 Migrating existing ipqc_pdf data to day_ipqc_pdf...")
            cursor.execute("""
                UPDATE production_records 
                SET day_ipqc_pdf = ipqc_pdf 
                WHERE ipqc_pdf IS NOT NULL 
                AND ipqc_pdf != '' 
                AND day_ipqc_pdf IS NULL
            """)
            connection.commit()
            print(f"  ✅ Migrated {cursor.rowcount} records")
        
        connection.close()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    migrate()
