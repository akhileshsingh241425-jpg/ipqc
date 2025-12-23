import sys
sys.path.insert(0, r'c:\Users\hp\Desktop\PDI\pdi_complete\backend')

from app import create_app
from app.models.database import BomMaterial, ProductionRecord, Company, db

app = create_app()

with app.app_context():
    # Find all BOM materials with invoice zjaxsm20250444a
    materials = BomMaterial.query.filter_by(lot_number='zjaxsm20250444a').all()
    
    print(f"Found {len(materials)} BOM materials with invoice zjaxsm20250444a\n")
    
    for m in materials:
        pr = ProductionRecord.query.get(m.production_record_id)
        company = Company.query.get(pr.company_id) if pr else None
        
        print(f"ID: {m.id}")
        print(f"Material: {m.material_name}")
        print(f"COC Qty: {m.coc_qty}")
        print(f"Invoice Qty: {m.invoice_qty}")
        print(f"Production Record ID: {m.production_record_id}")
        print(f"PDI: {pr.pdi if pr else 'N/A'}")
        print(f"Company: {company.company_name if company else 'N/A'}")
        print(f"Date: {pr.production_date if pr else 'N/A'}")
        print("-" * 60)
