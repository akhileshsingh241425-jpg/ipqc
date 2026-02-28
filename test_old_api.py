import requests
from datetime import datetime, timedelta
import time

to_d = datetime.now().strftime('%Y-%m-%d')
from_d = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')

# Check OLD API with high limit 
r = requests.post('https://umanmrp.in/api/party-dispatch-history.php', json={
    'party_id': '141b81a0-2bab-4790-b825-3c8734d41484',
    'from_date': from_d, 'to_date': to_d, 'page': 1, 'limit': 10000
}, timeout=180)
d = r.json()
ds = d.get('dispatch_summary', [])
print(f'Entries: {len(ds)}')
print(f'Response keys: {list(d.keys())}')

if ds:
    dates = [x.get('dispatch_date', '') for x in ds]
    print(f'Latest: {dates[0]}')
    print(f'Oldest: {dates[-1]}')
    
    total = 0
    pallet_count = 0
    all_serials = set()
    for item in ds:
        pn = item.get('pallet_nos', {})
        if isinstance(pn, dict):
            for k, v in pn.items():
                pallet_count += 1
                if isinstance(v, str):
                    serials = v.strip().split()
                    total += len(serials)
                    for s in serials:
                        all_serials.add(s.strip().upper())
    
    print(f'Total pallets: {pallet_count}')
    print(f'Total serials (raw): {total}')
    print(f'Total unique serials: {len(all_serials)}')
    
    # First entry details
    item = ds[0]
    print(f'\nFirst entry keys: {list(item.keys())}')
    pn = item.get('pallet_nos', {})
    pallet_list = list(pn.keys())[:3]
    print(f'Sample pallets: {pallet_list}')
    
    # Check if OLD API has MORE pages
    total_pages = d.get('total_pages', 0)
    total_dispatches = d.get('total_dispatches', 0) 
    print(f'\ntotal_dispatches: {total_dispatches}')
    print(f'total_pages: {total_pages}')
    
    # Check: are all 134 entries from different dates or dispatches?
    date_counts = {}
    for item in ds:
        dt = item.get('dispatch_date', 'unknown')
        date_counts[dt] = date_counts.get(dt, 0) + 1
    print(f'\nDispatches by date (last 10):')
    for dt in sorted(date_counts.keys(), reverse=True)[:10]:
        print(f'  {dt}: {date_counts[dt]} dispatches')
