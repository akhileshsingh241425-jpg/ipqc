"""
Sync ALL MRP dispatch data to local cache - Uses config for DB credentials
"""
import requests
import pymysql
import sys
sys.path.insert(0, '/root/ipqc/backend')
from config import Config

PARTY_IDS = {
    'Rays Power': '931db2c5-b016-4914-b378-69e9f22562a7',
    'L&T': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'Sterling': '141b81a0-2bab-4790-b825-3c8734d41484'
}

def sync_all():
    print("Connecting to database...")
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
        print(f"\n{'='*50}")
        print(f"Syncing {company}...")
        print(f"{'='*50}")
        
        company_count = 0
        empty_pages = 0
        
        for page in range(1, 1001):
            try:
                r = requests.post(
                    'https://umanmrp.in/api/party-dispatch-history.php',
                    json={
                        'party_id': party_id,
                        'from_date': '2025-01-01',
                        'to_date': '2026-02-26',
                        'page': page,
                        'limit': 100
                    },
                    timeout=60
                )
                
                data = r.json().get('dispatch_summary', [])
                
                if not data:
                    empty_pages += 1
                    if empty_pages >= 3:
                        print(f"{company}: Done at page {page} (3 empty pages)")
                        break
                    continue
                else:
                    empty_pages = 0
                
                page_count = 0
                for item in data:
                    pallet_nos = item.get('pallet_nos', {})
                    status = item.get('status', 'Dispatched')
                    dispatch_party = item.get('dispatch_party', '')
                    vehicle_no = item.get('vehicle_no', '')
                    dispatch_date = item.get('dispatch_date') or item.get('date', '')
                    
                    if isinstance(pallet_nos, dict):
                        for pallet, serials in pallet_nos.items():
                            if serials and isinstance(serials, str):
                                for s in serials.split():
                                    s = s.strip().upper()
                                    if s:
                                        try:
                                            cursor.execute('''
                                                INSERT INTO mrp_dispatch_cache 
                                                (serial_number, pallet_no, status, dispatch_party, vehicle_no, dispatch_date, company, party_id, synced_at)
                                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                                                ON DUPLICATE KEY UPDATE
                                                pallet_no = VALUES(pallet_no),
                                                status = VALUES(status),
                                                synced_at = NOW()
                                            ''', (s, pallet, status, dispatch_party, vehicle_no, dispatch_date if dispatch_date else None, company, party_id))
                                            page_count += 1
                                        except Exception as e:
                                            pass
                
                company_count += page_count
                
                if page % 20 == 0:
                    conn.commit()
                    print(f"Page {page}: +{page_count} serials (Total: {company_count})")
                    
            except Exception as e:
                print(f"Error on page {page}: {e}")
                continue
        
        conn.commit()
        total_inserted += company_count
        print(f"\n{company}: {company_count} serials synced")
    
    # Final count
    cursor.execute("SELECT company, COUNT(*) FROM mrp_dispatch_cache GROUP BY company")
    print(f"\n{'='*50}")
    print("FINAL CACHE COUNTS:")
    print("="*50)
    for row in cursor.fetchall():
        print(f"{row[0]}: {row[1]} serials")
    
    cursor.execute("SELECT COUNT(*) FROM mrp_dispatch_cache")
    total = cursor.fetchone()[0]
    print(f"\nTOTAL: {total} serials")
    
    conn.close()
    print("\nDone!")

if __name__ == "__main__":
    sync_all()
