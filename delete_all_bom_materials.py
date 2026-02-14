import sys
sys.path.insert(0, r'c:\Users\hp\Desktop\PDI\pdi_complete\backend')

from app import create_app
from app.models.database import BomMaterial, db

app = create_app()

with app.app_context():
    # Count total BOM materials
    total = BomMaterial.query.count()
    
    print(f"Found {total} BOM materials in database")
    
    if total > 0:
        confirm = input(f"⚠️  DELETE all {total} BOM materials? Type 'DELETE' to confirm: ")
        
        if confirm == 'DELETE':
            BomMaterial.query.delete()
            db.session.commit()
            print(f"\n✅ Successfully deleted {total} BOM materials!")
            print("Database is now clean.")
        else:
            print("Operation cancelled")
    else:
        print("No BOM materials to delete")
