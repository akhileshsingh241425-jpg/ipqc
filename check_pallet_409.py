import requests
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

# Database
DB_URI = os.getenv('DATABASE_URL', 'mysql+pymysql://root:@localhost/pdi_ipqc')
engine = create_engine(DB_URI)

# MRP API
BARCODE_TRACKING_API = "https://umanmrp.in/api/barcode_tracking.php"

print("=" * 60)
print("CHECKING PALLET 409 - DETAILED ANALYSIS")
print("=" * 60)

# Get MRP data for Rays Power
print("\n1. Fetching MRP data for Rays Power...")
response = requests.post(BARCODE_TRACKING_API, json={'party_name': 'Rays Power'}, timeout=30)

if response.status_code == 200:
    data = response.json()
    all_barcodes = data.get('data', [])
    
    # Filter pallet 409
    pallet_409 = [b for b in all_barcodes if b.get('pallet_no') == '409']
    
    print(f"   Found {len(pallet_409)} barcodes in Pallet 409 from MRP")
    
    if pallet_409:
        print("\n2. Barcodes in Pallet 409 (from MRP):")
        for idx, b in enumerate(pallet_409[:10], 1):
            print(f"   {idx}. {b.get('barcode')} - R-O: {b.get('running_order')}")
        
        if len(pallet_409) > 10:
            print(f"   ... and {len(pallet_409) - 10} more")
        
        # Get company ID
        print("\n3. Checking Master FTR database...")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id FROM companies WHERE company_name LIKE '%Rays%'"))
            company_row = result.fetchone()
            
            if company_row:
                company_id = company_row[0]
                print(f"   Company ID: {company_id}")
                
                # Get all barcodes from pallet 409
                all_serials = [b.get('barcode') for b in pallet_409 if b.get('barcode')]
                
                # Fetch from Master FTR
                result = conn.execute(text("""
                    SELECT serial_number, binning, class_status 
                    FROM ftr_master_serials 
                    WHERE company_id = :cid 
                    AND serial_number IN :serials
                """), {'cid': company_id, 'serials': tuple(all_serials)})
                
                db_data = result.fetchall()
                print(f"\n4. Master FTR Database Results:")
                print(f"   Found {len(db_data)} barcodes in Master FTR database")
                
                if db_data:
                    print("\n   Binning breakdown:")
                    binning_count = {}
                    for row in db_data:
                        binning = row[1] if row[1] else 'Unknown'
                        binning_count[binning] = binning_count.get(binning, 0) + 1
                        
                    for binning, count in sorted(binning_count.items()):
                        print(f"      {binning}: {count} modules")
                    
                    print("\n   Sample records:")
                    for idx, row in enumerate(db_data[:10], 1):
                        print(f"      {idx}. {row[0]} → Binning: {row[1]}, Class: {row[2]}")
                    
                    # Check if mix packing
                    unique_binnings = set([row[1] for row in db_data if row[1] and row[1] != 'Unknown'])
                    
                    print(f"\n5. MIX PACKING CHECK:")
                    print(f"   Unique binning types found: {len(unique_binnings)}")
                    print(f"   Binnings: {', '.join(sorted(unique_binnings))}")
                    
                    if len(unique_binnings) > 1:
                        print(f"   ⚠️ MIX PACKING DETECTED!")
                    else:
                        print(f"   ✅ NO MIX PACKING - All modules have same binning")
                else:
                    print("   ❌ NO BARCODES FOUND in Master FTR database!")
                    print("   This is why pallet 409 is not showing in mix packing report")
            else:
                print("   ❌ Company not found in database")
    else:
        print("   ❌ Pallet 409 not found in MRP data")
else:
    print(f"   ❌ MRP API failed: {response.status_code}")

print("\n" + "=" * 60)
