"""
Add separate day_ipqc_pdf and night_ipqc_pdf columns to production_records table
"""
from app import create_app
from app.models.database import db
from sqlalchemy import text

def migrate_ipqc_columns():
    app = create_app()
    with app.app_context():
        try:
            print("🔄 Starting migration: Adding day_ipqc_pdf and night_ipqc_pdf columns...")
            
            # Add new columns
            with db.engine.connect() as conn:
                # Check if columns already exist
                result = conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='production_records' 
                    AND column_name IN ('day_ipqc_pdf', 'night_ipqc_pdf')
                """))
                existing_columns = [row[0] for row in result]
                
                if 'day_ipqc_pdf' not in existing_columns:
                    print("  ➕ Adding day_ipqc_pdf column...")
                    conn.execute(text("ALTER TABLE production_records ADD COLUMN day_ipqc_pdf VARCHAR(500)"))
                    conn.commit()
                    print("  ✅ day_ipqc_pdf column added")
                else:
                    print("  ⏭️ day_ipqc_pdf already exists")
                
                if 'night_ipqc_pdf' not in existing_columns:
                    print("  ➕ Adding night_ipqc_pdf column...")
                    conn.execute(text("ALTER TABLE production_records ADD COLUMN night_ipqc_pdf VARCHAR(500)"))
                    conn.commit()
                    print("  ✅ night_ipqc_pdf column added")
                else:
                    print("  ⏭️ night_ipqc_pdf already exists")
                
                # Migrate existing data from ipqc_pdf to day_ipqc_pdf (assume existing data is for day shift)
                print("  🔄 Migrating existing ipqc_pdf data to day_ipqc_pdf...")
                result = conn.execute(text("""
                    UPDATE production_records 
                    SET day_ipqc_pdf = ipqc_pdf 
                    WHERE ipqc_pdf IS NOT NULL AND ipqc_pdf != '' 
                    AND day_ipqc_pdf IS NULL
                """))
                conn.commit()
                print(f"  ✅ Migrated {result.rowcount} records")
                
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_ipqc_columns()
