"""
FTR (Field Test Report) Routes
"""

from flask import Blueprint, request, jsonify, send_file
from app.services.ftr_pdf_generator import create_ftr_report
from config import Config
import os
import pymysql
import requests as http_requests
from datetime import datetime

ftr_bp = Blueprint('ftr', __name__, url_prefix='/api/ftr')


def get_db_connection():
    """Get database connection using Config"""
    return pymysql.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DB,
        cursorclass=pymysql.cursors.DictCursor
    )


@ftr_bp.route('/generate-report', methods=['POST'])
def generate_ftr_report():
    """
    Generate FTR PDF report from test data
    
    Expected JSON payload:
    {
        "producer": "Gautam Solar",
        "moduleType": "630W",
        "serialNumber": "GS04890KG2582504241",
        "testDate": "2025/12/19",
        "testTime": "15:34:39",
        "irradiance": 1001.09,
        "moduleTemp": 24.88,
        "ambientTemp": 23.62,
        "moduleArea": 2.70,
        "modulePower": 630,
        "results": {
            "pmax": 629.96,
            "vpm": 45.39,
            "ipm": 13.90,
            "voc": 53.82,
            "isc": 14.70,
            "fillFactor": 79.60,
            "rs": 0.12,
            "rsh": 2461.33,
            "efficiency": 23.32
        }
    }
    """
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Get template path
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        template_path = os.path.join(backend_dir, '..', 'frontend', 'public', 'IV curve template.pdf')
        
        if not os.path.exists(template_path):
            return jsonify({"error": "Template PDF not found"}), 404
        
        # Get graph image path based on module power
        module_power = data.get('modulePower')
        graph_image_path = None
        
        if module_power:
            graph_image_path = os.path.join(
                backend_dir, '..', 'frontend', 'public', 'iv_curves', 
                f'{module_power}.png'
            )
            
            # Check if graph exists
            if not os.path.exists(graph_image_path):
                print(f"Graph image not found: {graph_image_path}")
                graph_image_path = None
        
        # Generate PDF
        pdf_output = create_ftr_report(template_path, data, graph_image_path)
        
        # Generate filename
        serial_number = data.get('serialNumber', 'unknown')
        filename = f"FTR_Report_{serial_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        # Send file
        return send_file(
            pdf_output,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Error generating FTR report: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@ftr_bp.route('/test', methods=['GET'])
def test_ftr():
    """Test endpoint to verify FTR routes are working"""
    return jsonify({
        "status": "ok",
        "message": "FTR routes are working"
    })


@ftr_bp.route('/available-serial-numbers', methods=['GET'])
def get_available_serial_numbers():
    """
    Get all serial numbers from Master FTR that are not yet assigned to any PDI batch
    Returns list of available serial numbers
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get all serial numbers from master_ftr
        cursor.execute("""
            SELECT 
                serial_number as serialNumber,
                module_wattage as wattage,
                created_at as uploadDate
            FROM master_ftr
            WHERE serial_number NOT IN (
                SELECT DISTINCT serial_number 
                FROM pdi_serial_numbers 
                WHERE serial_number IS NOT NULL
            )
            ORDER BY created_at DESC
        """)
        
        available_serials = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "available_serials": available_serials,
            "count": len(available_serials)
        })
        
    except Exception as e:
        print(f"Error fetching available serial numbers: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@ftr_bp.route('/upload-master-ftr', methods=['POST'])
def upload_master_ftr():
    """
    Upload Master FTR serial numbers to database (Company-level, not PDI-specific)
    
    Expected JSON payload:
    {
        "serialNumbers": [
            {"serialNumber": "GS123", "wattage": "625"},
            ...
        ],
        "companyId": 1
    }
    """
    try:
        data = request.json
        serial_numbers = data.get('serialNumbers', [])
        company_id = data.get('companyId')
        
        print(f"Received {len(serial_numbers)} serial numbers for company {company_id}")
        
        if not serial_numbers:
            return jsonify({"success": False, "error": "No serial numbers provided"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        inserted_count = 0
        duplicate_count = 0
        
        for serial in serial_numbers:
            serial_number = serial.get('serialNumber')
            wattage = serial.get('wattage')
            
            if not serial_number:
                continue
            
            try:
                # Check if serial number already exists
                cursor.execute("""
                    SELECT COUNT(*) as count FROM master_ftr 
                    WHERE serial_number = %s
                """, (serial_number,))
                
                result = cursor.fetchone()
                if result[0] > 0:
                    duplicate_count += 1
                    continue
                
                # Insert new serial number (Company-level, not PDI-specific)
                cursor.execute("""
                    INSERT INTO master_ftr 
                    (serial_number, module_wattage, company_id, created_at)
                    VALUES (%s, %s, %s, NOW())
                """, (serial_number, wattage, company_id))
                
                inserted_count += 1
                print(f"Inserted: {serial_number}")
                
            except Exception as e:
                print(f"Error inserting serial {serial_number}: {e}")
                continue
        
        conn.commit()
        cursor.close()
        conn.close()
        
        message = f"Uploaded {inserted_count} serial numbers"
        if duplicate_count > 0:
            message += f" ({duplicate_count} duplicates skipped)"
        
        print(f"Upload complete: {message}")
        
        return jsonify({
            "success": True,
            "count": inserted_count,
            "duplicates": duplicate_count,
            "message": message
        })
    
    except Exception as e:
        print(f"Error uploading Master FTR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@ftr_bp.route('/assign-pdi-serials', methods=['POST'])
def assign_pdi_serials():
    """
    Assign serial numbers to a specific PDI batch
    This marks these serials as "used" for this PDI
    
    Expected JSON payload:
    {
        "serialNumbers": [
            {"serialNumber": "GS123", "wattage": "625"},
            ...
        ],
        "companyId": 1,
        "pdiNumber": "PDI-1"
    }
    """
    try:
        data = request.json
        serial_numbers = data.get('serialNumbers', [])
        company_id = data.get('companyId')
        pdi_number = data.get('pdiNumber')
        
        print(f"Assigning {len(serial_numbers)} serials to {pdi_number}")
        
        if not serial_numbers or not pdi_number:
            return jsonify({"success": False, "error": "Serial numbers and PDI number required"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        inserted_count = 0
        duplicate_count = 0
        
        for serial in serial_numbers:
            serial_number = serial.get('serialNumber')
            
            if not serial_number:
                continue
            
            try:
                # Check if already assigned to this or another PDI
                cursor.execute("""
                    SELECT pdi_number FROM pdi_serial_numbers 
                    WHERE serial_number = %s
                """, (serial_number,))
                
                result = cursor.fetchone()
                if result:
                    duplicate_count += 1
                    print(f"Serial {serial_number} already assigned to {result[0]}")
                    continue
                
                # Insert into pdi_serial_numbers
                cursor.execute("""
                    INSERT INTO pdi_serial_numbers 
                    (pdi_number, serial_number, company_id, created_at)
                    VALUES (%s, %s, %s, NOW())
                """, (pdi_number, serial_number, company_id))
                
                inserted_count += 1
                print(f"Assigned: {serial_number} to {pdi_number}")
                
            except Exception as e:
                print(f"Error assigning serial {serial_number}: {e}")
                continue
        
        # Update PDI records ftr_uploaded flag
        if inserted_count > 0:
            try:
                cursor.execute("""
                    UPDATE production_records
                    SET ftr_uploaded = TRUE
                    WHERE pdi = %s AND company_id = %s
                """, (pdi_number, company_id))
            except Exception as e:
                print(f"Error updating ftr_uploaded flag: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        message = f"Assigned {inserted_count} serial numbers to {pdi_number}"
        if duplicate_count > 0:
            message += f" ({duplicate_count} already assigned)"
        
        print(f"Assignment complete: {message}")
        
        return jsonify({
            "success": True,
            "count": inserted_count,
            "duplicates": duplicate_count,
            "message": message
        })
        
    except Exception as e:
        print(f"Error assigning PDI serials: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@ftr_bp.route('/pdi-dashboard/<company_id>', methods=['GET'])
def get_pdi_dashboard(company_id):
    """
    Get PDI Dashboard data - shows barcode tracking status
    - Total assigned barcodes
    - Packed (in stock)
    - Dispatched
    - Remaining
    """
    import requests
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if table exists FIRST
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = %s AND table_name = 'pdi_serial_numbers'
        """, (Config.MYSQL_DB,))
        
        table_check = cursor.fetchone()
        if not table_check or table_check['count'] == 0:
            # Table doesn't exist, create it
            print("Creating pdi_serial_numbers table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pdi_serial_numbers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    pdi_number VARCHAR(50) NOT NULL,
                    serial_number VARCHAR(100) NOT NULL,
                    company_id INT,
                    production_record_id INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_pdi (pdi_number),
                    INDEX idx_serial (serial_number),
                    INDEX idx_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            print("✅ pdi_serial_numbers table created successfully")
            
            # Return empty data since table was just created
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "summary": {
                    "total_assigned": 0,
                    "total_tracked": 0,
                    "packed": 0,
                    "dispatched": 0,
                    "pending": 0,
                    "unknown": 0,
                    "packed_percent": 0,
                    "dispatched_percent": 0,
                    "pending_percent": 0
                },
                "details": {
                    "packed": [],
                    "dispatched": [],
                    "pending": []
                },
                "message": "PDI tracking initialized. No serial numbers assigned yet."
            }), 200
        
        # Get all PDI numbers and their serial counts for this company
        cursor.execute("""
            SELECT 
                pdi_number,
                COUNT(*) as serial_count,
                MIN(created_at) as assigned_date
            FROM pdi_serial_numbers 
            WHERE company_id = %s
            GROUP BY pdi_number
            ORDER BY MIN(created_at) DESC
        """, (company_id,))
        
        pdi_summary = cursor.fetchall()
        
        # Get all serial numbers for this company
        cursor.execute("""
            SELECT serial_number, pdi_number, created_at
            FROM pdi_serial_numbers 
            WHERE company_id = %s
            ORDER BY created_at DESC
        """, (company_id,))
        
        all_serials = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # If no serials assigned yet, return empty data
        if not all_serials or len(all_serials) == 0:
            return jsonify({
                "success": True,
                "summary": {
                    "total_assigned": 0,
                    "total_tracked": 0,
                    "packed": 0,
                    "dispatched": 0,
                    "pending": 0,
                    "unknown": 0,
                    "packed_percent": 0,
                    "dispatched_percent": 0,
                    "pending_percent": 0
                },
                "details": {
                    "packed": [],
                    "dispatched": [],
                    "pending": []
                },
                "pdi_wise": [],
                "recent_dispatched": [],
                "recent_packed": [],
                "recent_pending": [],
                "message": "No serial numbers assigned to this company yet."
            }), 200
        
        # Now track each serial using external API
        BARCODE_TRACKING_API = 'https://umanmrp.in/api/get_barcode_tracking.php'
        
        total_assigned = len(all_serials)
        packed_count = 0
        dispatched_count = 0
        pending_count = 0
        unknown_count = 0
        
        packed_serials = []
        dispatched_serials = []
        pending_serials = []
        
        # Track status for each serial (limit to avoid timeout)
        serials_to_track = all_serials[:500]  # Limit to 500 for performance
        
        for serial_data in serials_to_track:
            serial = serial_data['serial_number']
            try:
                response = requests.post(
                    BARCODE_TRACKING_API,
                    data={'barcode': serial},
                    timeout=5
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get('success') and data.get('data'):
                        tracking_data = data['data']
                        
                        # Check dispatch status
                        dispatch_info = tracking_data.get('dispatch', {})
                        packing_info = tracking_data.get('packing', {})
                        
                        if dispatch_info.get('dispatch_date'):
                            dispatched_count += 1
                            dispatched_serials.append({
                                'serial': serial,
                                'pdi': serial_data['pdi_number'],
                                'dispatch_date': dispatch_info.get('dispatch_date'),
                                'vehicle_no': dispatch_info.get('vehicle_no', ''),
                                'party': dispatch_info.get('party_name', '')
                            })
                        elif packing_info.get('packing_date'):
                            packed_count += 1
                            packed_serials.append({
                                'serial': serial,
                                'pdi': serial_data['pdi_number'],
                                'packing_date': packing_info.get('packing_date'),
                                'box_no': packing_info.get('box_no', '')
                            })
                        else:
                            pending_count += 1
                            pending_serials.append({
                                'serial': serial,
                                'pdi': serial_data['pdi_number']
                            })
                    else:
                        pending_count += 1
                        pending_serials.append({
                            'serial': serial,
                            'pdi': serial_data['pdi_number']
                        })
                else:
                    unknown_count += 1
                    
            except Exception as e:
                unknown_count += 1
                continue
        
        # Calculate percentages
        tracked_total = packed_count + dispatched_count + pending_count
        
        return jsonify({
            "success": True,
            "summary": {
                "total_assigned": total_assigned,
                "total_tracked": len(serials_to_track),
                "packed": packed_count,
                "dispatched": dispatched_count,
                "pending": pending_count,
                "unknown": unknown_count,
                "packed_percent": round((packed_count / tracked_total * 100), 1) if tracked_total > 0 else 0,
                "dispatched_percent": round((dispatched_count / tracked_total * 100), 1) if tracked_total > 0 else 0,
                "pending_percent": round((pending_count / tracked_total * 100), 1) if tracked_total > 0 else 0
            },
            "details": {
                "packed": packed_serials,
                "dispatched": dispatched_serials,
                "pending": pending_serials
            },
            "pdi_wise": pdi_summary,
            "recent_dispatched": dispatched_serials[:20],
            "recent_packed": packed_serials[:20],
            "recent_pending": pending_serials[:20]
        })
        
    except Exception as e:
        print(f"Error getting PDI dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@ftr_bp.route('/pdi-dashboard-quick/<company_id>', methods=['GET'])
def get_pdi_dashboard_quick(company_id):
    """
    Quick PDI Dashboard - just database counts without external API calls
    For fast loading
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get total assigned
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM pdi_serial_numbers 
            WHERE company_id = %s
        """, (company_id,))
        total = cursor.fetchone()['total']
        
        # Get PDI wise summary
        cursor.execute("""
            SELECT 
                pdi_number,
                COUNT(*) as serial_count,
                DATE(MIN(created_at)) as assigned_date
            FROM pdi_serial_numbers 
            WHERE company_id = %s
            GROUP BY pdi_number
            ORDER BY MIN(created_at) DESC
            LIMIT 50
        """, (company_id,))
        
        pdi_summary = cursor.fetchall()
        
        # Get recent serials
        cursor.execute("""
            SELECT serial_number, pdi_number, created_at
            FROM pdi_serial_numbers 
            WHERE company_id = %s
            ORDER BY created_at DESC
            LIMIT 100
        """, (company_id,))
        
        recent_serials = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "summary": {
                "total_assigned": total,
                "pdi_count": len(pdi_summary)
            },
            "pdi_wise": pdi_summary,
            "recent_serials": recent_serials
        })
        
    except Exception as e:
        print(f"Error getting quick PDI dashboard: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ===== COMPANY NAME MAPPING (Local → MRP) - Copied from ai_assistant_routes =====
COMPANY_NAME_MAP = {
    'Rays Power': 'RAYS POWER INFRA LIMITED',
    'rays power': 'RAYS POWER INFRA LIMITED',
    'RAYS POWER': 'RAYS POWER INFRA LIMITED',
    
    'Larsen & Toubro': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'larsen & toubro': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'LARSEN & TOUBRO': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'L&T': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'l&t': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    
    'Sterlin and Wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'sterlin and wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'STERLIN AND WILSON': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'Sterling and Wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'sterling and wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'S&W': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    's&w': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    
    'KPI Green Energy': 'KPI GREEN ENERGY LIMITED',
    'KPI GREEN ENERGY': 'KPI GREEN ENERGY LIMITED',
    'kpi green energy': 'KPI GREEN ENERGY LIMITED',
    'KPI': 'KPI GREEN ENERGY LIMITED',
}

# Party IDs for dispatch history API - exact mapping from MRP system
PARTY_IDS = {
    # Rays Power
    'rays power': '931db2c5-b016-4914-b378-69e9f22562a7',
    'rays power infra': '931db2c5-b016-4914-b378-69e9f22562a7',
    'rays power infra limited': '931db2c5-b016-4914-b378-69e9f22562a7',
    'rays': '931db2c5-b016-4914-b378-69e9f22562a7',
    # Larsen & Toubro
    'larsen & toubro': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'larsen and toubro': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'larsen & toubro limited': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'l&t': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'lnt': 'a005562f-568a-46e9-bf2e-700affb171e8',
    # Sterling and Wilson
    'sterling and wilson': '141b81a0-2bab-4790-b825-3c8734d41484',
    'sterlin and wilson': '141b81a0-2bab-4790-b825-3c8734d41484',
    'sterling & wilson': '141b81a0-2bab-4790-b825-3c8734d41484',
    'sterling and wilson renewable energy limited': '141b81a0-2bab-4790-b825-3c8734d41484',
    's&w': '141b81a0-2bab-4790-b825-3c8734d41484',
    'sw': '141b81a0-2bab-4790-b825-3c8734d41484',
    # KPI Green Energy
    'kpi green energy': 'kpi-green-energy-party-id',
    'kpi': 'kpi-green-energy-party-id',
}


def get_mrp_party_name_ftr(local_name):
    """Map local company name to MRP full party name"""
    if local_name in COMPANY_NAME_MAP:
        return COMPANY_NAME_MAP[local_name]
    lower_name = local_name.strip().lower()
    for key, value in COMPANY_NAME_MAP.items():
        if key.lower() == lower_name:
            return value
    return local_name


def normalize_company_name(name):
    """Normalize company name for matching - remove special chars, extra spaces"""
    import re
    name = name.strip().lower()
    # Replace & with 'and' and also keep original
    name = re.sub(r'[&]+', ' and ', name)
    # Remove special characters
    name = re.sub(r'[^a-z0-9\s]', '', name)
    # Normalize whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def fetch_dispatch_history(company_name):
    """
    Fetch dispatch history from NEW MRP API - party-dispatch-history.php
    Returns mrp_lookup dict: barcode → {status, pallet_no, dispatch_date, vehicle_no, invoice_no, factory_name}
    Handles pagination automatically (fetches ALL pages).
    """
    mrp_party_name = get_mrp_party_name_ftr(company_name)
    lower_name = company_name.strip().lower()
    normalized_name = normalize_company_name(company_name)
    
    print(f"[Dispatch History] Company: {company_name}")
    print(f"[Dispatch History] lower_name: {lower_name}, normalized: {normalized_name}")
    print(f"[Dispatch History] Available PARTY_IDS keys: {list(PARTY_IDS.keys())}")
    
    # Get party_id from mapping - try multiple matching strategies
    party_id = None
    
    # Strategy 1: Exact match on lowercase
    if lower_name in PARTY_IDS:
        party_id = PARTY_IDS[lower_name]
        print(f"[Dispatch History] Exact match found for: {lower_name}")
    
    # Strategy 2: Partial match
    if not party_id:
        for key, pid in PARTY_IDS.items():
            if key in lower_name or lower_name in key:
                print(f"[Dispatch History] Partial match: key={key}, lower_name={lower_name}")
                party_id = pid
                break
    
    # Strategy 3: Normalized name match
    if not party_id:
        for key, pid in PARTY_IDS.items():
            normalized_key = normalize_company_name(key)
            if normalized_key in normalized_name or normalized_name in normalized_key:
                print(f"[Dispatch History] Normalized match: key={key}, normalized_key={normalized_key}")
                party_id = pid
                break
    
    # Strategy 4: Check for key words (rays, larsen, sterling, kpi)
    if not party_id:
        if 'rays' in lower_name:
            party_id = '931db2c5-b016-4914-b378-69e9f22562a7'
            print(f"[Dispatch History] Keyword match: rays")
        elif 'larsen' in lower_name or 'l&t' in lower_name or 'lnt' in lower_name:
            party_id = 'a005562f-568a-46e9-bf2e-700affb171e8'
            print(f"[Dispatch History] Keyword match: larsen/l&t")
        elif 'sterling' in lower_name or 's&w' in lower_name:
            party_id = '141b81a0-2bab-4790-b825-3c8734d41484'
            print(f"[Dispatch History] Keyword match: sterling/s&w")
        elif 'kpi' in lower_name:
            party_id = 'kpi-green-energy-party-id'
            print(f"[Dispatch History] Keyword match: kpi")
    
    if not party_id:
        print(f"[Dispatch History] No party_id found for: {company_name}")
        return {}, mrp_party_name, None
    
    print(f"[Dispatch History] Fetching for {company_name}, party_id: {party_id}")
    
    mrp_lookup = {}
    all_dispatches = []  # Store raw dispatch data for grouping
    page = 1
    limit = 50
    total_barcodes = 0
    api_debug = {'pages_fetched': 0, 'total_dispatches': 0, 'api_errors': []}
    
    # Use wide date range to get all dispatch history
    from datetime import datetime, timedelta
    today = datetime.now().strftime('%Y-%m-%d')
    from_date = '2024-01-01'  # Start from beginning of 2024
    
    while True:
        try:
            payload = {
                'party_id': party_id,
                'from_date': from_date,
                'to_date': today,
                'page': page,
                'limit': limit
            }
            print(f"[Dispatch History] Calling API - payload: {payload}")
            response = http_requests.post(
                'https://umanmrp.in/api/party-dispatch-history.php',
                json=payload,
                timeout=60
            )
            print(f"[Dispatch History] API Response Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"[Dispatch History] API Response: status={data.get('status')}, dispatch_count={len(data.get('dispatch_summary', []))}")
                if data.get('status') == 'success':
                    dispatch_summary = data.get('dispatch_summary', [])
                    pagination = data.get('pagination', {})
                    
                    for dispatch in dispatch_summary:
                        dispatch_date = dispatch.get('dispatch_date', '')
                        vehicle_no = dispatch.get('vehicle_no', '')
                        invoice_no = dispatch.get('invoice_no', '')
                        factory_name = dispatch.get('factory_name', '')
                        dispatch_id = dispatch.get('dispatch_id', '')
                        total_qty = dispatch.get('total_qty', 0)
                        pallet_nos = dispatch.get('pallet_nos', {})
                        
                        # Store raw dispatch for grouping
                        all_dispatches.append(dispatch)
                        
                        if isinstance(pallet_nos, dict):
                            for pallet_no, barcodes_str in pallet_nos.items():
                                if isinstance(barcodes_str, str):
                                    barcodes = barcodes_str.strip().split()
                                    for barcode in barcodes:
                                        barcode = barcode.strip().upper()
                                        if barcode:
                                            dispatch_info = {
                                                'status': 'Dispatched',
                                                'pallet_no': str(pallet_no),
                                                'dispatch_party': vehicle_no,
                                                'packed_party': '',
                                                'running_order': '',
                                                'date': dispatch_date,
                                                'dispatch_date': dispatch_date,
                                                'vehicle_no': vehicle_no,
                                                'invoice_no': invoice_no,
                                                'factory_name': factory_name,
                                                'dispatch_id': dispatch_id
                                            }
                                            # Store with original barcode
                                            mrp_lookup[barcode] = dispatch_info
                                            # Also store without GS prefix if present
                                            if barcode.startswith('GS'):
                                                mrp_lookup[barcode[2:]] = dispatch_info
                                            # Also store just the numeric part (last 10 digits as serial)
                                            if len(barcode) >= 10:
                                                mrp_lookup[barcode[-10:]] = dispatch_info
                                            total_barcodes += 1
                    
                    print(f"  Page {page}: {len(dispatch_summary)} dispatches, running total: {total_barcodes} barcodes")
                    
                    has_next = pagination.get('has_next_page', False)
                    if has_next:
                        page += 1
                    else:
                        break
                else:
                    print(f"  API returned status: {data.get('status')}")
                    break
            else:
                print(f"  API returned HTTP {response.status_code}")
                break
        except Exception as e:
            print(f"  Error fetching page {page}: {str(e)}")
            break
    
    print(f"[Dispatch History] Total dispatched barcodes: {len(mrp_lookup)}, Total dispatches: {len(all_dispatches)}")
    return mrp_lookup, mrp_party_name, party_id


@ftr_bp.route('/dispatch-tracking/<company_id>', methods=['GET'])
def get_dispatch_tracking(company_id):
    """
    Proxy endpoint to fetch dispatch tracking data from MRP API.
    Solves CORS issues and adds company name mapping.
    Uses same logic as ai_assistant_routes.py get_all_mrp_data().
    """
    try:
        # Get company from database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
        company = cursor.fetchone()
        cursor.close()
        conn.close()

        if not company:
            return jsonify({"success": False, "error": "Company not found"}), 404

        company_name = company.get('company_name') or company.get('companyName', '')
        
        print(f"\n[Dispatch Tracking] Company ID: {company_id}, Name: {company_name}")

        # Fetch dispatch history from new MRP API
        mrp_lookup, mrp_party_name, _ = fetch_dispatch_history(company_name)

        print(f"[Dispatch Tracking] Dispatch barcodes found: {len(mrp_lookup)}")

        if not mrp_lookup:
            return jsonify({
                "success": True,
                "company_name": company_name,
                "mrp_party_name": mrp_party_name,
                "summary": {
                    "total_assigned": 0,
                    "packed": 0,
                    "dispatched": 0,
                    "pending": 0,
                    "packed_percent": 0,
                    "dispatched_percent": 0,
                    "pending_percent": 0
                },
                "pdi_groups": [],
                "vehicle_groups": [],
                "dispatch_groups": [],
                "message": "No dispatch data found in MRP system"
            })

        # All barcodes in dispatch history are dispatched
        total = len(mrp_lookup)
        dispatched = total
        packed = 0
        pending = 0

        # Group by vehicle_no (dispatch_party)
        vehicle_map = {}
        pallet_map = {}

        for barcode, info in mrp_lookup.items():
            vehicle = info.get('vehicle_no', '') or info.get('dispatch_party', '') or 'Unknown'
            pallet_no = info.get('pallet_no', '')
            dispatch_date = info.get('dispatch_date', '') or info.get('date', '')
            invoice_no = info.get('invoice_no', '')
            factory_name = info.get('factory_name', '')

            # Group by vehicle
            if vehicle not in vehicle_map:
                vehicle_map[vehicle] = {
                    'dispatch_party': vehicle,
                    'vehicle_no': vehicle,
                    'dispatch_date': dispatch_date,
                    'invoice_no': invoice_no,
                    'factory_name': factory_name,
                    'module_count': 0,
                    'pallets': set(),
                    'serials': []
                }
            vehicle_map[vehicle]['module_count'] += 1
            if pallet_no:
                vehicle_map[vehicle]['pallets'].add(pallet_no)
            if len(vehicle_map[vehicle]['serials']) < 50:
                vehicle_map[vehicle]['serials'].append(barcode)

            # Group by pallet
            if pallet_no:
                if pallet_no not in pallet_map:
                    pallet_map[pallet_no] = {
                        'pallet_no': pallet_no,
                        'module_count': 0,
                        'vehicle_no': vehicle,
                        'dispatch_date': dispatch_date,
                        'serials': []
                    }
                pallet_map[pallet_no]['module_count'] += 1
                if len(pallet_map[pallet_no]['serials']) < 20:
                    pallet_map[pallet_no]['serials'].append(barcode)

        # Build dispatch groups
        dispatch_groups = []
        for v_name, v_data in vehicle_map.items():
            dispatch_groups.append({
                'dispatch_party': v_name,
                'vehicle_no': v_data['vehicle_no'],
                'dispatch_date': v_data['dispatch_date'],
                'invoice_no': v_data['invoice_no'],
                'factory_name': v_data['factory_name'],
                'module_count': v_data['module_count'],
                'pallet_count': len(v_data['pallets']),
                'pallets': sorted(list(v_data['pallets'])),
                'serials': v_data['serials']
            })
        dispatch_groups.sort(key=lambda x: x['module_count'], reverse=True)

        pallet_groups = sorted(pallet_map.values(), key=lambda x: str(x['pallet_no']))

        print(f"[Dispatch Tracking] Result: dispatched={dispatched}, vehicles={len(vehicle_map)}, pallets={len(pallet_map)}")

        return jsonify({
            "success": True,
            "company_name": company_name,
            "mrp_party_name": mrp_party_name,
            "summary": {
                "total_assigned": total,
                "packed": packed,
                "dispatched": dispatched,
                "pending": pending,
                "packed_percent": 0,
                "dispatched_percent": 100 if total > 0 else 0,
                "pending_percent": 0
            },
            "pallet_groups": pallet_groups,
            "dispatch_groups": dispatch_groups
        })

    except http_requests.exceptions.Timeout:
        print(f"[Dispatch Tracking] MRP API timeout for company_id={company_id}")
        return jsonify({
            "success": False,
            "error": "MRP API timed out. Please try again."
        }), 504

    except Exception as e:
        print(f"[Dispatch Tracking] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@ftr_bp.route('/dispatch-tracking-pdi/<company_id>', methods=['GET'])
def get_dispatch_tracking_pdi_wise(company_id):
    """
    PDI-wise dispatch tracking — cross-references ftr_master_serials with MRP data.
    Same logic as ai_assistant_routes.py check_pdi_dispatch_status().
    
    1. Gets all PDI assignments from ftr_master_serials
    2. Fetches MRP barcode data for the company
    3. Cross-references each serial to classify: Dispatched / Packed / Pending
    4. Returns PDI-wise breakdown
    """
    try:
        # Step 1: Get company info
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
        company = cursor.fetchone()

        if not company:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "error": "Company not found"}), 404

        company_name = company.get('company_name') or company.get('companyName', '')

        # Step 2: Get all PDI assignments from ftr_master_serials
        cursor.execute("""
            SELECT pdi_number, COUNT(*) as total, MIN(assigned_date) as assigned_date
            FROM ftr_master_serials
            WHERE company_id = %s AND status = 'assigned' AND pdi_number IS NOT NULL
            GROUP BY pdi_number
            ORDER BY assigned_date DESC
        """, (company_id,))
        pdi_assignments = cursor.fetchall()

        if not pdi_assignments:
            cursor.close()
            conn.close()
            return jsonify({
                "success": True,
                "company_name": company_name,
                "message": "No PDI assignments found for this company",
                "summary": {"total": 0, "dispatched": 0, "packed": 0, "pending": 0},
                "pdi_wise": []
            })

        # Step 3: Get ALL serials for this company from ftr_master_serials
        cursor.execute("""
            SELECT serial_number, pdi_number
            FROM ftr_master_serials
            WHERE company_id = %s AND status = 'assigned' AND pdi_number IS NOT NULL
        """, (company_id,))
        all_serials_rows = cursor.fetchall()
        cursor.close()
        conn.close()

        # Build PDI → serials mapping
        pdi_serials_map = {}
        for row in all_serials_rows:
            serial = row['serial_number']
            pdi = row['pdi_number']
            if pdi not in pdi_serials_map:
                pdi_serials_map[pdi] = []
            pdi_serials_map[pdi].append(serial)

        print(f"\n[PDI Dispatch] Company: {company_name}, PDIs: {list(pdi_serials_map.keys())}, Total serials: {len(all_serials_rows)}")

        # Step 4: Fetch dispatch history from new MRP API
        mrp_lookup, mrp_party_name, _ = fetch_dispatch_history(company_name)
        print(f"[PDI Dispatch] Dispatch lookup built: {len(mrp_lookup)} barcodes")

        # Step 6: Cross-reference each PDI's serials with MRP data
        overall_dispatched = 0
        overall_packed = 0
        overall_pending = 0
        overall_total = 0
        pdi_wise_results = []

        for pdi_info in pdi_assignments:
            pdi_number = pdi_info['pdi_number']
            pdi_total = pdi_info['total']
            assigned_date = pdi_info['assigned_date']
            serials = pdi_serials_map.get(pdi_number, [])

            dispatched = 0
            packed = 0
            pending = 0
            dispatch_parties = {}

            # Collect serial details for click-through
            dispatched_serials = []
            packed_serials = []
            pending_serials = []

            for serial in serials:
                if serial in mrp_lookup:
                    info = mrp_lookup[serial]
                    if info['status'] == 'Dispatched':
                        dispatched += 1
                        dp = info['dispatch_party']
                        if dp not in dispatch_parties:
                            dispatch_parties[dp] = 0
                        dispatch_parties[dp] += 1
                        if len(dispatched_serials) < 500:
                            dispatched_serials.append({
                                'serial': serial,
                                'pallet_no': info['pallet_no'],
                                'dispatch_party': info['dispatch_party']
                            })
                    elif info['status'] == 'Packed':
                        packed += 1
                        if len(packed_serials) < 500:
                            packed_serials.append({
                                'serial': serial,
                                'pallet_no': info['pallet_no']
                            })
                    else:
                        pending += 1
                        if len(pending_serials) < 200:
                            pending_serials.append({'serial': serial})
                else:
                    pending += 1
                    if len(pending_serials) < 200:
                        pending_serials.append({'serial': serial})

            total = dispatched + packed + pending
            overall_dispatched += dispatched
            overall_packed += packed
            overall_pending += pending
            overall_total += total

            pdi_wise_results.append({
                'pdi_number': pdi_number,
                'total': total,
                'dispatched': dispatched,
                'packed': packed,
                'pending': pending,
                'dispatched_percent': round((dispatched / total) * 100) if total > 0 else 0,
                'packed_percent': round((packed / total) * 100) if total > 0 else 0,
                'pending_percent': round((pending / total) * 100) if total > 0 else 0,
                'assigned_date': str(assigned_date) if assigned_date else '',
                'dispatch_parties': [{'party': k, 'count': v} for k, v in sorted(dispatch_parties.items(), key=lambda x: x[1], reverse=True)],
                'dispatched_serials': dispatched_serials,
                'packed_serials': packed_serials,
                'pending_serials': pending_serials
            })

        # Calculate overall percentages
        overall_dispatched_pct = round((overall_dispatched / overall_total) * 100) if overall_total > 0 else 0
        overall_packed_pct = round((overall_packed / overall_total) * 100) if overall_total > 0 else 0
        overall_pending_pct = round((overall_pending / overall_total) * 100) if overall_total > 0 else 0

        print(f"[PDI Dispatch] Result: total={overall_total}, dispatched={overall_dispatched}, packed={overall_packed}, pending={overall_pending}")

        return jsonify({
            "success": True,
            "company_name": company_name,
            "mrp_party_name": mrp_party_name,
            "summary": {
                "total": overall_total,
                "dispatched": overall_dispatched,
                "packed": overall_packed,
                "pending": overall_pending,
                "dispatched_percent": overall_dispatched_pct,
                "packed_percent": overall_packed_pct,
                "pending_percent": overall_pending_pct
            },
            "pdi_wise": pdi_wise_results
        })

    except http_requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "MRP API timed out. Please try again."}), 504
    except Exception as e:
        print(f"[PDI Dispatch] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# PDI Production Status — kitne ban gaye, kitne pending
# ============================================================
@ftr_bp.route('/pdi-production-status/<company_id>', methods=['GET'])
def get_pdi_production_status(company_id):
    """
    Returns PDI-wise production status for a company:
    - FTR tested serials per PDI (from ftr_master_serials)
    - Production output per PDI (from production_records)
    - Planned qty per PDI (from pdi_batches + master_orders)
    - Pending = planned - produced
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Get company info
        cursor.execute("SELECT id, company_name FROM companies WHERE id = %s", (company_id,))
        company = cursor.fetchone()
        if not company:
            conn.close()
            return jsonify({"success": False, "error": "Company not found"}), 404

        # 2. FTR Master Serials — PDI-wise count (modules FTR tested & assigned)
        ftr_pdi_counts = {}
        try:
            cursor.execute("""
                SELECT pdi_number, COUNT(*) as count, MIN(assigned_date) as assigned_date
                FROM ftr_master_serials
                WHERE company_id = %s AND status = 'assigned' AND pdi_number IS NOT NULL
                GROUP BY pdi_number
                ORDER BY pdi_number
            """, (company_id,))
            for row in cursor.fetchall():
                ftr_pdi_counts[row['pdi_number']] = {
                    'ftr_count': row['count'],
                    'assigned_date': str(row['assigned_date']) if row['assigned_date'] else None
                }
        except Exception as e:
            print(f"[PDI Production] ftr_master_serials query error: {e}")

        # 3. Production Records — PDI-wise total production (day + night)
        production_pdi_counts = {}
        try:
            cursor.execute("""
                SELECT pdi, 
                       SUM(COALESCE(day_production, 0) + COALESCE(night_production, 0)) as total_production,
                       COUNT(*) as record_count,
                       MIN(date) as start_date,
                       MAX(date) as last_date
                FROM production_records
                WHERE company_id = %s AND pdi IS NOT NULL AND pdi != ''
                GROUP BY pdi
                ORDER BY pdi
            """, (company_id,))
            for row in cursor.fetchall():
                production_pdi_counts[row['pdi']] = {
                    'total_production': int(row['total_production'] or 0),
                    'record_count': row['record_count'],
                    'start_date': str(row['start_date']) if row['start_date'] else None,
                    'last_date': str(row['last_date']) if row['last_date'] else None
                }
        except Exception as e:
            print(f"[PDI Production] production_records query error: {e}")

        # 4. PDI Batches — planned modules per PDI (from master_orders)
        planned_pdi = {}
        total_order_qty = 0
        order_number = None
        try:
            cursor.execute("""
                SELECT mo.id as order_id, mo.order_number, mo.total_modules,
                       pb.pdi_number, pb.planned_modules, pb.actual_modules, pb.status as batch_status
                FROM master_orders mo
                JOIN pdi_batches pb ON pb.order_id = mo.id
                WHERE mo.company_id = %s
                ORDER BY pb.batch_sequence
            """, (company_id,))
            rows = cursor.fetchall()
            for row in rows:
                total_order_qty = row['total_modules'] or 0
                order_number = row['order_number']
                planned_pdi[row['pdi_number']] = {
                    'planned_modules': row['planned_modules'] or 0,
                    'actual_modules': row['actual_modules'] or 0,
                    'batch_status': row['batch_status']
                }
        except Exception as e:
            print(f"[PDI Production] pdi_batches query error (table may not exist): {e}")

        # 5. Total FTR count (all serials, including available)
        total_ftr = 0
        total_ftr_ok = 0
        total_rejected = 0
        total_available = 0
        try:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN class_status = 'OK' OR class_status IS NULL THEN 1 ELSE 0 END) as ok_count,
                    SUM(CASE WHEN class_status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available
                FROM ftr_master_serials
                WHERE company_id = %s
            """, (company_id,))
            row = cursor.fetchone()
            if row:
                total_ftr = row['total'] or 0
                total_ftr_ok = row['ok_count'] or 0
                total_rejected = row['rejected'] or 0
                total_available = row['available'] or 0
        except Exception as e:
            print(f"[PDI Production] total FTR query error: {e}")

        # 6. Get ALL assigned serials per PDI for dispatch cross-reference
        pdi_serials_map = {}
        try:
            cursor.execute("""
                SELECT serial_number, pdi_number
                FROM ftr_master_serials
                WHERE company_id = %s AND status = 'assigned' AND pdi_number IS NOT NULL
            """, (company_id,))
            for row in cursor.fetchall():
                pdi = row['pdi_number']
                if pdi not in pdi_serials_map:
                    pdi_serials_map[pdi] = []
                pdi_serials_map[pdi].append(row['serial_number'])
        except Exception as e:
            print(f"[PDI Production] serial fetch error: {e}")

        conn.close()

        # 7. Fetch dispatch history from NEW MRP API (party-dispatch-history.php)
        company_name = company['company_name']
        mrp_lookup = {}
        mrp_error = None
        debug_info = {}
        used_party_id = None
        try:
            mrp_lookup, mrp_party_name, used_party_id = fetch_dispatch_history(company_name)
            print(f"[PDI Production] Dispatch lookup built: {len(mrp_lookup)} barcodes for party: {mrp_party_name}, party_id: {used_party_id}")
            
            # DEBUG: Log sample barcodes from MRP
            sample_mrp_barcodes = list(mrp_lookup.keys())[:5]
            print(f"[PDI Production] Sample MRP barcodes: {sample_mrp_barcodes}")
            
            # DEBUG: Collect all serials from ftr_master_serials for this company
            all_local_serials = []
            for pdi, serials in pdi_serials_map.items():
                all_local_serials.extend(serials)
            sample_local_serials = all_local_serials[:5]
            print(f"[PDI Production] Sample LOCAL serials: {sample_local_serials}")
            
            # DEBUG: Check if any match (with normalized lookup)
            def debug_find_match(serial_num):
                """Check if serial matches any MRP barcode"""
                serial_upper = serial_num.strip().upper()
                if serial_upper in mrp_lookup:
                    return True
                if ('GS' + serial_upper) in mrp_lookup:
                    return True
                if serial_upper.startswith('GS') and serial_upper[2:] in mrp_lookup:
                    return True
                if len(serial_upper) >= 10 and serial_upper[-10:] in mrp_lookup:
                    return True
                return False
            
            matches = [s for s in all_local_serials if debug_find_match(s)]
            print(f"[PDI Production] MATCHES: {len(matches)} out of {len(all_local_serials)} local serials")
            
            debug_info = {
                'sample_mrp_barcodes': sample_mrp_barcodes,
                'sample_local_serials': sample_local_serials,
                'total_mrp_barcodes': len(mrp_lookup),
                'total_local_serials': len(all_local_serials),
                'matches_found': len(matches),
                'party_id_used': used_party_id,
                'company_name': company_name
            }
        except Exception as e:
            mrp_error = str(e)
            print(f"[PDI Production] Dispatch fetch error: {e}")

        # 8. Build combined PDI-wise results
        all_pdis = sorted(set(
            list(ftr_pdi_counts.keys()) +
            list(production_pdi_counts.keys()) +
            list(planned_pdi.keys())
        ))

        pdi_wise = []
        grand_produced = 0
        grand_planned = 0
        grand_ftr = 0
        grand_dispatched = 0
        grand_packed = 0
        grand_disp_pending = 0

        for pdi in all_pdis:
            ftr_info = ftr_pdi_counts.get(pdi, {})
            prod_info = production_pdi_counts.get(pdi, {})
            plan_info = planned_pdi.get(pdi, {})

            ftr_count = ftr_info.get('ftr_count', 0)
            produced = prod_info.get('total_production', 0)
            planned = plan_info.get('planned_modules', 0)

            # "Ban gaye" = produced from production records; if zero, fall back to FTR count
            ban_gaye = produced if produced > 0 else ftr_count
            # Pending = planned - produced (if planned exists)
            pending = max(0, planned - ban_gaye) if planned > 0 else 0
            # Progress %
            progress = round((ban_gaye / planned) * 100, 1) if planned > 0 else (100 if ban_gaye > 0 else 0)

            grand_produced += ban_gaye
            grand_planned += planned
            grand_ftr += ftr_count

            # Cross-reference serials with MRP for dispatch status
            dispatched = 0
            packed = 0
            disp_pending = 0
            dispatch_parties = {}
            dispatched_serials = []
            packed_serials = []
            pending_serials = []
            
            # Pallet-wise grouping
            pallet_groups = {}  # pallet_no -> {serials:[], status:'Dispatched'/'Packed', dispatch_party:'', date:''}

            # Helper function to find serial in mrp_lookup with different formats
            def find_in_mrp_lookup(serial_num):
                """Try multiple formats to find serial in MRP lookup"""
                serial_upper = serial_num.strip().upper()
                # Try exact match first
                if serial_upper in mrp_lookup:
                    return mrp_lookup[serial_upper]
                # Try with GS prefix
                if ('GS' + serial_upper) in mrp_lookup:
                    return mrp_lookup['GS' + serial_upper]
                # Try without GS prefix
                if serial_upper.startswith('GS') and serial_upper[2:] in mrp_lookup:
                    return mrp_lookup[serial_upper[2:]]
                # Try last 10 digits
                if len(serial_upper) >= 10 and serial_upper[-10:] in mrp_lookup:
                    return mrp_lookup[serial_upper[-10:]]
                return None

            serials = pdi_serials_map.get(pdi, [])
            for serial in serials:
                info = find_in_mrp_lookup(serial)
                if info:
                    pallet_key = info['pallet_no'] or 'No Pallet'
                    
                    # Group by pallet
                    if pallet_key not in pallet_groups:
                        pallet_groups[pallet_key] = {
                            'pallet_no': pallet_key,
                            'status': info['status'],
                            'dispatch_party': info['dispatch_party'],
                            'date': info['date'],
                            'running_order': info['running_order'],
                            'serials': [],
                            'count': 0
                        }
                    pallet_groups[pallet_key]['serials'].append(serial)
                    pallet_groups[pallet_key]['count'] += 1
                    
                    if info['status'] == 'Dispatched':
                        dispatched += 1
                        dp = info['dispatch_party']
                        dispatch_parties[dp] = dispatch_parties.get(dp, 0) + 1
                        if len(dispatched_serials) < 500:
                            dispatched_serials.append({
                                'serial': serial,
                                'pallet_no': info['pallet_no'],
                                'dispatch_party': info['dispatch_party'],
                                'date': info['date']
                            })
                    elif info['status'] == 'Packed':
                        packed += 1
                        if len(packed_serials) < 500:
                            packed_serials.append({
                                'serial': serial,
                                'pallet_no': info['pallet_no'],
                                'date': info['date']
                            })
                    else:
                        disp_pending += 1
                        if len(pending_serials) < 200:
                            pending_serials.append({'serial': serial})
                else:
                    disp_pending += 1
                    if len(pending_serials) < 200:
                        pending_serials.append({'serial': serial})

            # Build pallet list sorted by pallet_no
            pallet_list = sorted(pallet_groups.values(), key=lambda x: str(x['pallet_no']))
            # Limit serials per pallet to 50 for response size
            for p in pallet_list:
                if len(p['serials']) > 50:
                    p['serials'] = p['serials'][:50]

            grand_dispatched += dispatched
            grand_packed += packed
            grand_disp_pending += disp_pending

            pdi_wise.append({
                'pdi_number': pdi,
                'produced': ban_gaye,
                'ftr_tested': ftr_count,
                'planned': planned,
                'pending': pending,
                'progress': progress,
                'production_days': prod_info.get('record_count', 0),
                'start_date': prod_info.get('start_date'),
                'last_date': prod_info.get('last_date'),
                'assigned_date': ftr_info.get('assigned_date'),
                'batch_status': plan_info.get('batch_status', 'N/A'),
                'dispatched': dispatched,
                'packed': packed,
                'dispatch_pending': disp_pending,
                'dispatch_parties': [{'party': k, 'count': v} for k, v in sorted(dispatch_parties.items(), key=lambda x: x[1], reverse=True)],
                'dispatched_serials': dispatched_serials,
                'packed_serials': packed_serials,
                'pending_serials': pending_serials,
                'pallet_groups': pallet_list
            })

        grand_pending = max(0, grand_planned - grand_produced) if grand_planned > 0 else 0
        grand_progress = round((grand_produced / grand_planned) * 100, 1) if grand_planned > 0 else (100 if grand_produced > 0 else 0)

        return jsonify({
            "success": True,
            "company": company['company_name'],
            "order_number": order_number,
            "total_order_qty": total_order_qty,
            "total_ftr": total_ftr,
            "total_ftr_ok": total_ftr_ok,
            "total_rejected": total_rejected,
            "total_available": total_available,
            "mrp_lookup_size": len(mrp_lookup),
            "mrp_error": mrp_error,
            "debug_info": debug_info,
            "summary": {
                "total_produced": grand_produced,
                "total_planned": grand_planned,
                "total_pending": grand_pending,
                "total_ftr_assigned": grand_ftr,
                "progress": grand_progress,
                "total_dispatched": grand_dispatched,
                "total_packed": grand_packed,
                "total_dispatch_pending": grand_disp_pending
            },
            "pdi_wise": pdi_wise
        })

    except Exception as e:
        print(f"[PDI Production] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
