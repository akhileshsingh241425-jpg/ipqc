"""
FAST Sync MRP dispatch data - Uses NEW optimized API (party-dispatch-history1.php)
Uses barcodes_only mode for maximum speed
"""
import requests
import pymysql
import sys
import time
sys.path.insert(0, '/root/ipqc/backend')
from config import Config

# NEW API endpoint
API_URL = 'https://umanmrp.in/api/party-dispatch-history1.php'

PARTY_IDS = {
    'Rays Power': '931db2c5-b016-4914-b378-69e9f22562a7',
    'L&T': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'Sterling': '141b81a0-2bab-4790-b825-3c8734d41484'
}

def sync_fast():
    """Fast sync using barcodes_only mode - Single request per party"""
    start_time = time.time()
    
    print("="*60)
    print("FAST SYNC - Using NEW API (barcodes_only mode)")
    print("="*60)
    
    print("\nConnecting to database...")
    conn = pymysql.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB
    )
    cursor = conn.cursor()
    
    # Check current count
    cursor.execute("SELECT company, COUNT(*) FROM mrp_dispatch_cache GROUP BY company")
    print("Current cache:", cursor.fetchall())
    
    total_inserted = 0
    
    for company, party_id in PARTY_IDS.items():
        company_start = time.time()
        print(f"\n{'='*50}")
        print(f"Syncing {company}...")
        print(f"{'='*50}")
        
        try:
            # Single request with barcodes_only = true
            print(f"Fetching ALL barcodes in single request...")
            
            r = requests.post(
                API_URL,
                json={
                    'party_id': party_id,
                    'from_date': '2024-01-01',
                    'to_date': '2026-12-31',
                    'barcodes_only': True  # FAST MODE
                },
                timeout=300  # 5 min timeout for large data
            )
            
            data = r.json()
            
            if data.get('status') != 'success':
                print(f"API Error: {data.get('message', 'Unknown error')}")
                continue
            
            barcodes = data.get('barcodes', [])
            total_barcodes = data.get('total_barcodes', len(barcodes))
            
            print(f"Received {total_barcodes} barcodes")
            
            # Insert barcodes
            inserted = 0
            for barcode in barcodes:
                barcode = barcode.strip().upper() if barcode else ''
                if barcode:
                    try:
                        cursor.execute('''
                            INSERT INTO mrp_dispatch_cache 
                            (serial_number, pallet_no, status, dispatch_party, vehicle_no, dispatch_date, company, party_id, synced_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON DUPLICATE KEY UPDATE
                            synced_at = NOW()
                        ''', (barcode, '', 'Dispatched', '', '', None, company, party_id))
                        inserted += 1
                    except Exception as e:
                        pass
                
                # Commit every 10000
                if inserted % 10000 == 0:
                    conn.commit()
                    print(f"  Inserted {inserted}/{total_barcodes}...")
            
            conn.commit()
            company_time = time.time() - company_start
            print(f"{company}: {inserted} barcodes in {company_time:.1f}s")
            total_inserted += inserted
            
        except Exception as e:
            print(f"Error syncing {company}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    # Final count
    cursor.execute("SELECT company, COUNT(*) FROM mrp_dispatch_cache GROUP BY company")
    print(f"\n{'='*60}")
    print("FINAL CACHE COUNTS:")
    print("="*60)
    for row in cursor.fetchall():
        print(f"{row[0]}: {row[1]} serials")
    
    cursor.execute("SELECT COUNT(*) FROM mrp_dispatch_cache")
    total = cursor.fetchone()[0]
    
    total_time = time.time() - start_time
    print(f"\nTOTAL: {total} serials")
    print(f"\n{'='*60}")
    print(f"COMPLETED IN: {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
    print("="*60)
    
    conn.close()


def sync_with_details():
    """Sync with full dispatch details (slower but complete data)"""
    start_time = time.time()
    
    print("="*60)
    print("DETAILED SYNC - Using NEW API (high limit mode)")
    print("="*60)
    
    print("\nConnecting to database...")
    conn = pymysql.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB
    )
    cursor = conn.cursor()
    
    total_inserted = 0
    
    for company, party_id in PARTY_IDS.items():
        company_start = time.time()
        print(f"\n{'='*50}")
        print(f"Syncing {company} with details...")
        print(f"{'='*50}")
        
        company_count = 0
        page = 1
        
        while True:
            try:
                # Use high limit (10000)
                r = requests.post(
                    API_URL,
                    json={
                        'party_id': party_id,
                        'from_date': '2024-01-01',
                        'to_date': '2026-12-31',
                        'page': page,
                        'limit': 10000,  # HIGH LIMIT
                        'skip_count': True
                    },
                    timeout=120
                )
                
                data = r.json()
                
                if data.get('status') != 'success':
                    print(f"API Error: {data.get('message', 'Unknown error')}")
                    break
                
                # Use all_barcodes if available (pre-parsed)
                all_barcodes = data.get('all_barcodes', [])
                dispatches = data.get('dispatch_summary', [])
                
                if all_barcodes:
                    # Fast path - use pre-parsed barcodes
                    for barcode in all_barcodes:
                        barcode = barcode.strip().upper() if barcode else ''
                        if barcode:
                            try:
                                cursor.execute('''
                                    INSERT INTO mrp_dispatch_cache 
                                    (serial_number, company, party_id, synced_at)
                                    VALUES (%s, %s, %s, NOW())
                                    ON DUPLICATE KEY UPDATE synced_at = NOW()
                                ''', (barcode, company, party_id))
                                company_count += 1
                            except:
                                pass
                
                elif dispatches:
                    # Parse from dispatch_summary
                    for item in dispatches:
                        pallet_nos = item.get('pallet_nos', {})
                        vehicle_no = item.get('vehicle_no', '')
                        dispatch_date = item.get('dispatch_date', '')
                        
                        if isinstance(pallet_nos, dict):
                            for pallet, serials in pallet_nos.items():
                                if isinstance(serials, list):
                                    # Array format
                                    for s in serials:
                                        s = s.strip().upper() if s else ''
                                        if s:
                                            cursor.execute('''
                                                INSERT INTO mrp_dispatch_cache 
                                                (serial_number, pallet_no, vehicle_no, dispatch_date, company, party_id, synced_at)
                                                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                                                ON DUPLICATE KEY UPDATE synced_at = NOW()
                                            ''', (s, pallet, vehicle_no, dispatch_date or None, company, party_id))
                                            company_count += 1
                                elif isinstance(serials, str):
                                    # Space-separated format
                                    for s in serials.split():
                                        s = s.strip().upper()
                                        if s:
                                            cursor.execute('''
                                                INSERT INTO mrp_dispatch_cache 
                                                (serial_number, pallet_no, vehicle_no, dispatch_date, company, party_id, synced_at)
                                                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                                                ON DUPLICATE KEY UPDATE synced_at = NOW()
                                            ''', (s, pallet, vehicle_no, dispatch_date or None, company, party_id))
                                            company_count += 1
                else:
                    print(f"No more data at page {page}")
                    break
                
                conn.commit()
                print(f"Page {page}: Total {company_count} barcodes")
                
                # Check if more pages
                pagination = data.get('pagination', {})
                if not pagination.get('has_next_page', False):
                    break
                
                page += 1
                
            except Exception as e:
                print(f"Error on page {page}: {e}")
                break
        
        company_time = time.time() - company_start
        print(f"{company}: {company_count} barcodes in {company_time:.1f}s")
        total_inserted += company_count
    
    # Final count
    cursor.execute("SELECT COUNT(*) FROM mrp_dispatch_cache")
    total = cursor.fetchone()[0]
    
    total_time = time.time() - start_time
    print(f"\nTOTAL: {total} serials in {total_time:.1f} seconds")
    
    conn.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Fast MRP Sync')
    parser.add_argument('--mode', choices=['fast', 'detailed'], default='fast',
                       help='fast=barcodes_only, detailed=full dispatch info')
    args = parser.parse_args()
    
    if args.mode == 'fast':
        sync_fast()
    else:
        sync_with_details()
