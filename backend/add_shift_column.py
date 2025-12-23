"""
Add shift and company columns to bom_materials table
Run this to fix database schema
"""

from app import create_app
from app.models.database import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        # Add company column if not exists
        try:
            with db.engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE bom_materials 
                    ADD COLUMN company VARCHAR(200) AFTER material_name
                """))
                conn.commit()
            print("✓ Added 'company' column")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("✓ 'company' column already exists")
            else:
                print(f"Error adding company: {e}")
        
        # Add shift column if not exists
        try:
            with db.engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE bom_materials 
                    ADD COLUMN shift VARCHAR(10) AFTER material_name
                """))
                conn.commit()
            print("✓ Added 'shift' column")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("✓ 'shift' column already exists")
            else:
                print(f"Error adding shift: {e}")
        
        # Set defaults
        try:
            with db.engine.connect() as conn:
                conn.execute(text("""
                    UPDATE bom_materials 
                    SET shift = 'day' 
                    WHERE shift IS NULL
                """))
                conn.commit()
            print("✓ Set default shift='day' for existing records")
        except Exception as e:
            print(f"Error setting defaults: {e}")
        
        print("\n✅ Migration complete! Restart the backend server.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
