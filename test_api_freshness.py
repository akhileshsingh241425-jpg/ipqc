import requests
from datetime import datetime, timedelta
import time

to_d = datetime.now().strftime('%Y-%m-%d')
from_d = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')

# Test 1: NEW API (barcodes_only)
print("Testing NEW API (barcodes_only)...")
t1 = time.time()
r1 = requests.post('https://umanmrp.in/api/party-dispatch-history1.php', json={
    'party_id': '141b81a0-2bab-4790-b825-3c8734d41484',
    'from_date': from_d, 'to_date': to_d, 'barcodes_only': True
}, timeout=120, headers={'Cache-Control': 'no-cache', 'Pragma': 'no-cache'})
d1 = r1.json()
b1 = d1.get('barcodes', [])
c1 = sum(len(e.strip().split()) for e in b1 if e and isinstance(e, str))
print(f"NEW API: {c1} serials, {len(b1)} entries, {time.time()-t1:.1f}s")

# Test 2: OLD API (paginated) - just page 1 for comparison
print("\nTesting OLD API page 1...")
t2 = time.time()
r2 = requests.post('https://umanmrp.in/api/party-dispatch-history.php', json={
    'party_id': '141b81a0-2bab-4790-b825-3c8734d41484',
    'from_date': from_d, 'to_date': to_d, 'page': 1, 'limit': 50
}, timeout=120)
d2 = r2.json()
total_dispatches = d2.get('total_dispatches', 0)
total_pages = d2.get('total_pages', 0)
print(f"OLD API: total_dispatches={total_dispatches}, total_pages={total_pages}, {time.time()-t2:.1f}s")

ds = d2.get('dispatch_summary', [])
dates = [x.get('dispatch_date', '') for x in ds[:5]]
print(f"Latest dispatch dates: {dates}")

# Count serials from OLD API page 1
old_serial_count = 0
for item in ds[:3]:
    pn = item.get('pallet_nos', {})
    if isinstance(pn, dict):
        for k, v in pn.items():
            if isinstance(v, str):
                old_serial_count += len(v.strip().split())
print(f"OLD API first 3 dispatches: {old_serial_count} serials")

# Test 3: OLD API with NO limit to get total count via full pagination
print("\nTesting OLD API with limit=10000 (for total count)...")
t3 = time.time()
r3 = requests.post('https://umanmrp.in/api/party-dispatch-history.php', json={
    'party_id': '141b81a0-2bab-4790-b825-3c8734d41484',
    'from_date': from_d, 'to_date': to_d, 'page': 1, 'limit': 10000
}, timeout=180)
d3 = r3.json()
ds3 = d3.get('dispatch_summary', [])
total_old = 0
for item in ds3:
    pn = item.get('pallet_nos', {})
    if isinstance(pn, dict):
        for k, v in pn.items():
            if isinstance(v, str):
                total_old += len(v.strip().split())
print(f"OLD API all dispatches: {len(ds3)} entries, {total_old} serials, {time.time()-t3:.1f}s")
print(f"Latest dates: {[x.get('dispatch_date','') for x in ds3[:3]]}")

print(f"\n=== COMPARISON ===")
print(f"NEW API (barcodes_only): {c1} serials")
print(f"OLD API (full):          {total_old} serials")
print(f"Difference:              {total_old - c1} serials")
