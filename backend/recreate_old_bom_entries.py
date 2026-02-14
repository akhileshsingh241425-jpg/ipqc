"""
Recreate BOM material entries for existing production records
Run this after table migration to populate BOM materials
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models.database import ProductionRecord, BomMaterial

# 14 Fixed BOM materials
BOM_MATERIALS = [
    'Solar Cell',
    'FRONT GLASS',
    'BACK GLASS',
    'RIBBON (0.26 mm)',
    'RIBBON (4.0X0.4)',
    'RIBBON (6.0X0.4)',
    'FLUX',
    'EPE FRONT',
    'Aluminium Frame LONG',
    'Aluminium Frame SHORT',
    'SEALENT',
    'JB Potting A',
    'JB Potting B',
    'JUNCTION BOX'
]

def recreate_bom_entries():
    try:
        app = create_app()
        with app.app_context():
            # Get all production records
            records = ProductionRecord.query.all()
            print(f"Found {len(records)} production records")
            
            created_count = 0
            for record in records:
                # Check if BOM materials already exist
                existing = BomMaterial.query.filter_by(production_record_id=record.id).count()
                
                if existing == 0:
                    print(f"\nCreating BOM materials for Record ID: {record.id}, Date: {record.date}")
                    
                    # Create BOM materials for both shifts
                    for material_name in BOM_MATERIALS:
                        # Day shift
                        bom_day = BomMaterial(
                            production_record_id=record.id,
                            material_name=material_name,
                            shift='day'
                        )
                        db.session.add(bom_day)
                        
                        # Night shift
                        bom_night = BomMaterial(
                            production_record_id=record.id,
                            material_name=material_name,
                            shift='night'
                        )
                        db.session.add(bom_night)
                        created_count += 2
                    
                    print(f"  ✓ Created 28 BOM entries (14 Day + 14 Night)")
                else:
                    print(f"  ⊗ Record {record.id} already has {existing} BOM entries, skipping")
            
            db.session.commit()
            
            print(f"\n{'='*60}")
            print(f"✅ Migration completed!")
            print(f"Total BOM entries created: {created_count}")
            print(f"{'='*60}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("="*60)
    print("RECREATE BOM ENTRIES FOR EXISTING PRODUCTION RECORDS")
    print("="*60)
    print("\nThis will create empty BOM material entries for all")
    print("existing production records (28 per record: 14 Day + 14 Night)")
    print()
    
    recreate_bom_entries()
