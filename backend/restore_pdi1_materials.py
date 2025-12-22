"""
Restore missing BOM materials for PDI-1 (Rays Power)
"""
from app.models.database import db, ProductionRecord, BomMaterial, Company
from app import create_app

app = create_app()

with app.app_context():
    # Find Rays Power company
    company = Company.query.filter_by(company_name='Rays Power').first()
    if not company:
        print("Rays Power company not found!")
        exit(1)
    
    print(f"Found company: {company.company_name} (ID: {company.id})")
    
    # Find PDI-1 production records
    pdi_records = ProductionRecord.query.filter_by(
        company_id=company.id,
        pdi='PDI-1'
    ).all()
    
    if not pdi_records:
        print("No PDI-1 records found!")
        exit(1)
    
    print(f"Found {len(pdi_records)} production records for PDI-1")
    
    # Check existing BOM materials
    for record in pdi_records:
        existing_materials = BomMaterial.query.filter_by(
            production_record_id=record.id
        ).all()
        
        print(f"\nRecord ID {record.id} ({record.date}):")
        print(f"  Existing materials: {[m.material_name for m in existing_materials]}")
    
    # Define complete BOM materials list that should be in each record
    complete_bom = [
        'Solar Cell',
        'EVA',
        'FRONT GLASS',
        'BACK GLASS',
        'RIBBON (0.26 mm)',
        'Aluminium Frame LONG',
        'Aluminium Frame SHORT',
        'JUNCTION BOX',
        'FLUX',
        'JB Potting (A and B)',
        'RIBBON (6.0X0.4)',
        'RIBBON (4.0X0.4)',
        'SEALENT'
    ]
    
    print("\n\nAdding missing materials to each record...")
    
    added_count = 0
    for record in pdi_records:
        # Get existing material names for this record
        existing = BomMaterial.query.filter_by(
            production_record_id=record.id
        ).all()
        existing_names = {m.material_name for m in existing}
        
        # Add missing materials
        for material_name in complete_bom:
            if material_name not in existing_names:
                new_material = BomMaterial(
                    production_record_id=record.id,
                    material_name=material_name,
                    image_path=None,
                    lot_number=None,
                    coc_qty=None,
                    invoice_qty=None,
                    lot_batch_no=None
                )
                db.session.add(new_material)
                added_count += 1
                print(f"  Added {material_name} to record {record.id}")
    
    db.session.commit()
    print(f"\n✅ Successfully added {added_count} missing materials!")
