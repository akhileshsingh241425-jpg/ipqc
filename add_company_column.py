import sys
sys.path.insert(0, r'c:\Users\hp\Desktop\PDI\pdi_complete\backend')

from app import create_app
from app.models.database import db

app = create_app()

with app.app_context():
    try:
        # Add company column to bom_materials table
        db.session.execute("""
            ALTER TABLE bom_materials 
            ADD COLUMN company VARCHAR(200) AFTER material_name
        """)
        db.session.commit()
        print("✅ Successfully added 'company' column to bom_materials table!")
    except Exception as e:
        print(f"Error: {e}")
        print("Column may already exist or there's a database issue.")
        db.session.rollback()
