"""
Deep analysis: Find the root cause of 500-600 serial mismatch
"""
import requests
from datetime import datetime, timedelta
import time

to_d = datetime.now().strftime('%Y-%m-%d')
from_d = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
party_id = '141b81a0-2bab-4790-b825-3c8734d41484'

print("=" * 60)
print("DEEP MISMATCH ANALYSIS")
print("=" * 60)

# 1. Get OLD API data (LIVE, detailed)
print("\n1. OLD API (party-dispatch-history.php, limit=10000)...")
t1 = time.time()
r1 = requests.post('https://umanmrp.in/api/party-dispatch-history.php', json={
    'party_id': party_id, 'from_date': from_d, 'to_date': to_d,
    'page': 1, 'limit': 10000
}, timeout=180)
d1 = r1.json()
old_serials = set()
ds = d1.get('dispatch_summary', [])
for item in ds:
    pn = item.get('pallet_nos', {})
    if isinstance(pn, dict):
        for k, v in pn.items():
            if isinstance(v, str):
                for s in v.strip().split():
                    old_serials.add(s.strip().upper())
print(f"   Entries: {len(ds)}, Serials: {len(old_serials)}, Time: {time.time()-t1:.1f}s")

# 2. Get NEW API data (barcodes_only, historical)
print("\n2. NEW API (party-dispatch-history1.php, barcodes_only)...")
t2 = time.time()
r2 = requests.post('https://umanmrp.in/api/party-dispatch-history1.php', json={
    'party_id': party_id, 'from_date': from_d, 'to_date': to_d,
    'barcodes_only': True
}, timeout=300)
d2 = r2.json()
new_serials = set()
for entry in d2.get('barcodes', []):
    if entry and isinstance(entry, str):
        for s in entry.strip().split():
            new_serials.add(s.strip().upper())
print(f"   Entries: {len(d2.get('barcodes', []))}, Serials: {len(new_serials)}, Time: {time.time()-t2:.1f}s")

# 3. Compare
combined = old_serials | new_serials
only_old = old_serials - new_serials
only_new = new_serials - old_serials
both = old_serials & new_serials

print(f"\n{'='*60}")
print(f"COMPARISON:")
print(f"  OLD API only:     {len(only_old)} serials")
print(f"  NEW API only:     {len(only_new)} serials")
print(f"  In BOTH:          {len(both)} serials")
print(f"  Combined total:   {len(combined)} serials")
print(f"{'='*60}")

if only_old:
    print(f"\n  Sample OLD-only: {list(only_old)[:5]}")
if only_new:
    print(f"  Sample NEW-only: {list(only_new)[:5]}")

# 4. Call AGAIN to check if counts change (stability test)
print(f"\n3. STABILITY TEST - calling APIs again...")
time.sleep(2)

r3 = requests.post('https://umanmrp.in/api/party-dispatch-history1.php', json={
    'party_id': party_id, 'from_date': from_d, 'to_date': to_d,
    'barcodes_only': True
}, timeout=300)
d3 = r3.json()
new_serials_2 = set()
for entry in d3.get('barcodes', []):
    if entry and isinstance(entry, str):
        for s in entry.strip().split():
            new_serials_2.add(s.strip().upper())

diff = new_serials.symmetric_difference(new_serials_2)
print(f"   NEW API call 1: {len(new_serials)} serials")
print(f"   NEW API call 2: {len(new_serials_2)} serials")
print(f"   Difference between calls: {len(diff)} serials")
if diff:
    print(f"   Changed serials: {list(diff)[:10]}")

r4 = requests.post('https://umanmrp.in/api/party-dispatch-history.php', json={
    'party_id': party_id, 'from_date': from_d, 'to_date': to_d,
    'page': 1, 'limit': 10000
}, timeout=180)
d4 = r4.json()
old_serials_2 = set()
for item in d4.get('dispatch_summary', []):
    pn = item.get('pallet_nos', {})
    if isinstance(pn, dict):
        for k, v in pn.items():
            if isinstance(v, str):
                for s in v.strip().split():
                    old_serials_2.add(s.strip().upper())

diff_old = old_serials.symmetric_difference(old_serials_2)
print(f"\n   OLD API call 1: {len(old_serials)} serials")
print(f"   OLD API call 2: {len(old_serials_2)} serials")
print(f"   Difference between calls: {len(diff_old)} serials")
if diff_old:
    print(f"   Changed serials: {list(diff_old)[:10]}")

# 5. Check for pagination issues with OLD API
print(f"\n4. PAGINATION CHECK - OLD API...")
page_counts = []
for page in range(1, 4):
    r = requests.post('https://umanmrp.in/api/party-dispatch-history.php', json={
        'party_id': party_id, 'from_date': from_d, 'to_date': to_d,
        'page': page, 'limit': 10000
    }, timeout=180)
    d = r.json()
    ds_page = d.get('dispatch_summary', [])
    page_serial_count = 0
    for item in ds_page:
        pn = item.get('pallet_nos', {})
        if isinstance(pn, dict):
            for k, v in pn.items():
                if isinstance(v, str):
                    page_serial_count += len(v.strip().split())
    page_counts.append((page, len(ds_page), page_serial_count))
    print(f"   Page {page}: {len(ds_page)} entries, {page_serial_count} serials")
    if len(ds_page) == 0:
        break

print(f"\n{'='*60}")
print(f"CONCLUSION:")
total_old_all_pages = sum(c[2] for c in page_counts)
print(f"  OLD API total (all pages): {total_old_all_pages}")
print(f"  NEW API total: {len(new_serials)}")
print(f"  Combined (no duplicates): {len(combined)}")
print(f"{'='*60}")
