"""
COC API Data Checker - Check all material quantities and units
"""

import requests
from datetime import datetime, timedelta
from collections import defaultdict
import json

COC_API_URL = 'https://umanmrp.in/api/coc_api.php'

def check_coc_units():
    try:
        print('🔍 Fetching COC data from API...\n')
        
        # Get last 6 months data
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        response = requests.post(COC_API_URL, json={
            'from': from_date,
            'to': to_date
        }, timeout=30)
        
        coc_data = []
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'data' in data:
                coc_data = data['data']
            elif isinstance(data, list):
                coc_data = data
        
        print(f'✅ Fetched {len(coc_data)} COC records\n')
        print('='*80)
        print('📊 MATERIAL WISE QUANTITY ANALYSIS\n')
        print('='*80)
        
        # Group by material name
        material_groups = defaultdict(lambda: {
            'count': 0,
            'quantities': [],
            'units': set(),
            'samples': []
        })
        
        for coc in coc_data:
            material = coc.get('material_name', 'Unknown')
            
            material_groups[material]['count'] += 1
            
            # Store quantity info
            if coc.get('coc_qty'):
                try:
                    qty = float(coc['coc_qty'])
                    material_groups[material]['quantities'].append(qty)
                except:
                    pass
            
            # Try to detect unit from product name
            if coc.get('product_name'):
                material_groups[material]['units'].add(coc['product_name'])
            
            # Store sample data (max 3 samples per material)
            if len(material_groups[material]['samples']) < 3:
                material_groups[material]['samples'].append({
                    'invoice': coc.get('invoice_no', 'N/A'),
                    'qty': coc.get('coc_qty', 'N/A'),
                    'invoice_qty': coc.get('invoice_qty', 'N/A'),
                    'product': coc.get('product_name', 'N/A'),
                    'brand': coc.get('brand', 'N/A')
                })
        
        # Print material-wise summary
        sorted_materials = sorted(material_groups.keys())
        
        for material in sorted_materials:
            data = material_groups[material]
            
            if data['quantities']:
                avg_qty = sum(data['quantities']) / len(data['quantities'])
                min_qty = min(data['quantities'])
                max_qty = max(data['quantities'])
                
                print(f'\n📦 {material}')
                print(f'   Records: {data["count"]}')
                print(f'   Qty Range: {min_qty:.2f} - {max_qty:.2f} (Avg: {avg_qty:.2f})')
                
                print(f'   Sample Entries:')
                for idx, sample in enumerate(data['samples'], 1):
                    print(f'      {idx}. Invoice: {sample["invoice"]}, COC Qty: {sample["qty"]}, Invoice Qty: {sample["invoice_qty"]}')
                    print(f'         Product: {sample["product"]}, Brand: {sample["brand"]}')
        
        print('\n' + '='*80)
        print('✅ Analysis Complete!')
        print('='*80)
        
    except Exception as error:
        print(f'❌ Error: {str(error)}')

if __name__ == '__main__':
    check_coc_units()
