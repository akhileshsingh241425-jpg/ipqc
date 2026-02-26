"""
Check total serial numbers from MRP API - All pages (1 to 1000)
"""
import requests
import json

PARTY_IDS = {
    'Rays Power': '931db2c5-b016-4914-b378-69e9f22562a7',
    'L&T': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'Sterling': '141b81a0-2bab-4790-b825-3c8734d41484'
}

def fetch_all_serials(party_name, party_id):
    """Fetch all serial numbers from MRP API for a party - Loop pages 1 to 1000"""
    print(f"\n{'='*50}")
    print(f"Fetching: {party_name}")
    print(f"Party ID: {party_id}")
    print(f"{'='*50}")
    
    all_serials = []
    limit = 100
    empty_pages = 0
    max_empty = 3  # Stop after 3 consecutive empty pages
    
    for page in range(1, 1001):  # Loop 1 to 1000
        payload = {
            "party_id": party_id,
            "from_date": "2025-01-01",
            "to_date": "2026-02-26",
            "page": page,
            "limit": limit
        }
        
        try:
            response = requests.post(
                "https://umanmrp.in/api/party-dispatch-history.php",
                json=payload,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"Error on page {page}: HTTP {response.status_code}")
                break
            
            data = response.json()
            dispatch_summary = data.get('dispatch_summary', [])
            
            if not dispatch_summary:
                empty_pages += 1
                if empty_pages >= max_empty:
                    print(f"Page {page}: Empty - stopping (3 consecutive empty pages)")
                    break
                continue
            else:
                empty_pages = 0  # Reset counter
            
            page_serials = 0
            for item in dispatch_summary:
                pallet_nos = item.get('pallet_nos', {})
                if isinstance(pallet_nos, dict):
                    for pallet_no, serials_str in pallet_nos.items():
                        if serials_str and isinstance(serials_str, str):
                            serials = serials_str.strip().split()
                            for serial in serials:
                                serial = serial.strip()
                                if serial:
                                    all_serials.append(serial)
                                    page_serials += 1
            
            print(f"Page {page}: {len(dispatch_summary)} dispatches, {page_serials} serials (Total so far: {len(all_serials)})")
            
        except Exception as e:
            print(f"Error on page {page}: {e}")
            break
    
    # Remove duplicates
    unique_serials = list(set(all_serials))
    
    print(f"\n--- SUMMARY for {party_name} ---")
    print(f"Total Serials (with duplicates): {len(all_serials)}")
    print(f"Unique Serials: {len(unique_serials)}")
    print(f"Sample serials: {unique_serials[:5]}")
    
    return unique_serials

if __name__ == "__main__":
    print("="*60)
    print("MRP API - Total Serials Check (Last 1 Year) - ALL PAGES")
    print("="*60)
    
    all_company_serials = {}
    
    for party_name, party_id in PARTY_IDS.items():
        serials = fetch_all_serials(party_name, party_id)
        all_company_serials[party_name] = serials
    
    print("\n" + "="*60)
    print("FINAL SUMMARY")
    print("="*60)
    for company, serials in all_company_serials.items():
        print(f"{company}: {len(serials)} unique serials")
    
    total_all = sum(len(s) for s in all_company_serials.values())
    print(f"\nGRAND TOTAL: {total_all} serials")
