import sys
sys.path.insert(0, r'c:\Users\hp\Desktop\PDI\pdi_complete\backend')

from app import create_app
from app.models.database import BomMaterial, db

app = create_app()

with app.app_context():
    # Find all BOM materials with EVA
    eva_materials = BomMaterial.query.filter(
        (BomMaterial.material_name == 'EVA') |
        (BomMaterial.material_name == 'EVA Front') |
        (BomMaterial.material_name == 'EVA Back')
    ).all()
    
    print(f"Found {len(eva_materials)} EVA materials to replace with EPE FRONT\n")
    
    if len(eva_materials) > 0:
        updated_count = 0
        for material in eva_materials:
            print(f"Updating ID {material.id}: {material.material_name} -> EPE FRONT")
            material.material_name = 'EPE FRONT'
            updated_count += 1
        
        db.session.commit()
        print(f"\n✅ Successfully updated {updated_count} records!")
        print("All EVA materials are now EPE FRONT")
    else:
        print("No EVA materials found!")
