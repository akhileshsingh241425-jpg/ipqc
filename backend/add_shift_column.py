"""
Add shift column to bom_materials table
Run this on the server to add shift column for Day/Night separation
"""

from app import create_app
from app.models.database import db

app = create_app()

with app.app_context():
    try:
        # Add shift column after material_name
        db.engine.execute("""
            ALTER TABLE bom_materials 
            ADD COLUMN shift VARCHAR(10) AFTER material_name
        """)
        print("✓ Successfully added 'shift' column to bom_materials table")
        
        # Set default 'day' for existing records
        db.engine.execute("""
            UPDATE bom_materials 
            SET shift = 'day' 
            WHERE shift IS NULL
        """)
        print("✓ Set default shift='day' for existing records")
        
    except Exception as e:
        print(f"Error: {e}")
        print("\nIf column already exists, you can ignore this error.")

print("\nMigration complete!")
