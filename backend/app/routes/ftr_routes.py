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
import time

ftr_bp = Blueprint('ftr', __name__, url_prefix='/api/ftr')

# Global cache for dispatch data (per party_id)
# Structure: {party_id: {'data': {serial: details}, 'set': set(), 'timestamp': time}}
DISPATCH_CACHE = {}
DISPATCH_CACHE_TTL = 600  # 10 minutes


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
    name = re.sub(r'[&]+', ' and ', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


# Party Dispatch History API
DISPATCH_HISTORY_API = 'https://umanmrp.in/api/party-dispatch-history.php'


def auto_sync_mrp_cache(matched_company, party_id):
    """
    Automatically sync MRP dispatch data to local cache.
    Loops through pages 1-1000 to fetch ALL data.
    Called when cache is empty or stale (older than 1 hour).
    """
    from datetime import datetime, timedelta
    
    print(f"[Auto Sync] Starting sync for {matched_company}...")
    
    # Date range - last 1 year
    to_date = datetime.now().strftime('%Y-%m-%d')
    from_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    
    all_barcodes = []
    limit = 100
    empty_pages = 0
    max_empty = 3  # Stop after 3 consecutive empty pages
    
    for page in range(1, 1001):  # Loop pages 1 to 1000
        try:
            payload = {
                "party_id": party_id,
                "from_date": from_date,
                "to_date": to_date,
                "page": page,
                "limit": limit
            }
            
            response = http_requests.post(
                "https://umanmrp.in/api/party-dispatch-history.php",
                json=payload,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"[Auto Sync] API error on page {page}: {response.status_code}")
                break
                
            result = response.json()
            dispatch_summary = result.get('dispatch_summary', [])
            
            if not dispatch_summary:
                empty_pages += 1
                if empty_pages >= max_empty:
                    print(f"[Auto Sync] Page {page}: Empty - stopping (3 consecutive empty)")
                    break
                continue
            else:
                empty_pages = 0
            
            page_count = 0
            for item in dispatch_summary:
                pallet_nos = item.get('pallet_nos', {})
                status = item.get('status', 'Packed')
                dispatch_party = item.get('dispatch_party', '')
                vehicle_no = item.get('vehicle_no', '')
                dispatch_date = item.get('dispatch_date') or item.get('date', '')
                invoice_no = item.get('invoice_no', '')
                
                if isinstance(pallet_nos, dict):
                    for pallet_no, serials_str in pallet_nos.items():
                        if serials_str and isinstance(serials_str, str):
                            serials = serials_str.strip().split()
                            for serial in serials:
                                serial = serial.strip()
                                if serial:
                                    all_barcodes.append({
                                        'serial_number': serial.upper(),
                                        'pallet_no': pallet_no,
                                        'status': status,
                                        'dispatch_party': dispatch_party,
                                        'vehicle_no': vehicle_no,
                                        'dispatch_date': dispatch_date,
                                        'invoice_no': invoice_no,
                                        'company': matched_company,
                                        'party_id': party_id
                                    })
                                    page_count += 1
            
            print(f"[Auto Sync] Page {page}: {len(dispatch_summary)} dispatches, {page_count} serials (Total: {len(all_barcodes)})")
            
        except Exception as e:
            print(f"[Auto Sync] Error on page {page}: {e}")
            break
    
    print(f"[Auto Sync] Fetched {len(all_barcodes)} barcodes from MRP API")
    
    # Save to database
    if all_barcodes:
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                for barcode in all_barcodes:
                    cursor.execute("""
                        INSERT INTO mrp_dispatch_cache 
                        (serial_number, pallet_no, status, dispatch_party, vehicle_no, dispatch_date, invoice_no, company, party_id, synced_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE
                        pallet_no = VALUES(pallet_no),
                        status = VALUES(status),
                        dispatch_party = VALUES(dispatch_party),
                        vehicle_no = VALUES(vehicle_no),
                        dispatch_date = VALUES(dispatch_date),
                        invoice_no = VALUES(invoice_no),
                        synced_at = NOW()
                    """, (
                        barcode['serial_number'],
                        barcode['pallet_no'],
                        barcode['status'],
                        barcode['dispatch_party'],
                        barcode['vehicle_no'],
                        barcode['dispatch_date'] if barcode['dispatch_date'] else None,
                        barcode['invoice_no'],
                        barcode['company'],
                        barcode['party_id']
                    ))
                conn.commit()
            conn.close()
            print(f"[Auto Sync] Saved {len(all_barcodes)} barcodes to local cache")
        except Exception as e:
            print(f"[Auto Sync] DB save error: {e}")
    
    return len(all_barcodes)


def fetch_dispatch_history(company_name):
    """
    Fetch dispatch history from LOCAL CACHE (mrp_dispatch_cache table)
    Auto-syncs from MRP API if cache is empty or older than 1 hour.
    Returns mrp_lookup dict: barcode → {status, pallet_no, dispatch_date, vehicle_no, etc.}
    """
    from datetime import datetime, timedelta
    
    mrp_party_name = get_mrp_party_name_ftr(company_name)
    lower_name = company_name.strip().lower()
    
    print(f"[Dispatch History] Company: {company_name}, lower_name: {lower_name}")
    
    # Get party_id - keyword based matching
    party_id = None
    matched_company = None
    if 'rays' in lower_name:
        party_id = '931db2c5-b016-4914-b378-69e9f22562a7'
        matched_company = 'Rays Power'
        print(f"[Dispatch History] Matched: Rays Power")
    elif 'larsen' in lower_name or 'l&t' in lower_name or 'lnt' in lower_name:
        party_id = 'a005562f-568a-46e9-bf2e-700affb171e8'
        matched_company = 'L&T'
        print(f"[Dispatch History] Matched: Larsen & Toubro")
    elif 'sterling' in lower_name or 'sterlin' in lower_name or 's&w' in lower_name:
        party_id = '141b81a0-2bab-4790-b825-3c8734d41484'
        matched_company = 'Sterling'
        print(f"[Dispatch History] Matched: Sterling and Wilson")
    elif 'kpi' in lower_name:
        party_id = 'kpi-green-energy-party-id'
        matched_company = 'KPI'
        print(f"[Dispatch History] Matched: KPI Green Energy")
    
    if not party_id:
        print(f"[Dispatch History] No party_id found for: {company_name}")
        return {}, mrp_party_name, None
    
    print(f"[Dispatch History] Using party_id: {party_id}, matched_company: {matched_company}")
    
    mrp_lookup = {}
    
    # ===== Check if cache needs refresh (empty or older than 1 hour) =====
    needs_sync = False
    cache_count = 0
    last_sync = None
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check cache count and last sync time
            cursor.execute("""
                SELECT COUNT(*) as cnt, MAX(synced_at) as last_sync 
                FROM mrp_dispatch_cache 
                WHERE company = %s
            """, (matched_company,))
            result = cursor.fetchone()
            cache_count = result['cnt'] or 0
            last_sync = result['last_sync']
        conn.close()
        
        if cache_count == 0:
            needs_sync = True
            print(f"[Dispatch History] Cache EMPTY - will sync")
        elif last_sync:
            # Check if older than 1 hour
            time_diff = datetime.now() - last_sync
            if time_diff > timedelta(hours=1):
                needs_sync = True
                print(f"[Dispatch History] Cache STALE ({time_diff}) - will sync")
            else:
                print(f"[Dispatch History] Cache FRESH (synced {time_diff} ago)")
        else:
            needs_sync = True
            
    except Exception as e:
        print(f"[Dispatch History] Cache check error: {e}")
        needs_sync = True
    
    # ===== Auto sync if needed =====
    if needs_sync:
        auto_sync_mrp_cache(matched_company, party_id)
    
    # ===== Fetch from local cache =====
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT serial_number, pallet_no, status, dispatch_party, vehicle_no, 
                       dispatch_date, invoice_no
                FROM mrp_dispatch_cache 
                WHERE company = %s
            """, (matched_company,))
            cache_rows = cursor.fetchall()
        conn.close()
        
        print(f"[Dispatch History] LOCAL CACHE: Found {len(cache_rows)} serials for {matched_company}")
        
        for row in cache_rows:
            barcode = row['serial_number'].strip().upper()
            mrp_lookup[barcode] = {
                'status': row['status'] or 'Dispatched',
                'pallet_no': row['pallet_no'] or '',
                'dispatch_party': row['dispatch_party'] or '',
                'vehicle_no': row['vehicle_no'] or '',
                'dispatch_date': str(row['dispatch_date']) if row['dispatch_date'] else '',
                'invoice_no': row['invoice_no'] or '',
                'date': str(row['dispatch_date']) if row['dispatch_date'] else ''
            }
        
        print(f"[Dispatch History] Returning {len(mrp_lookup)} barcodes from cache")
        return mrp_lookup, mrp_party_name, party_id
            
    except Exception as e:
        print(f"[Dispatch History] Cache read error: {e}")
    
    # ===== FALLBACK: Direct fetch from MRP API =====
    print(f"[Dispatch History] Fallback to direct MRP API fetch...")
    
    page = 1
    limit = 50
    total_barcodes = 0
    total_dispatches = 0
    
    # Date range - 1 year back to today
    today = datetime.now().strftime('%Y-%m-%d')
    from_date = '2025-01-01'  # Start from 2025
    
    while True:
        try:
            payload = {
                'party_id': party_id,
                'from_date': from_date,
                'to_date': today,
                'page': page,
                'limit': limit
            }
            print(f"[Dispatch History] API call page {page}: {payload}")
            
            response = http_requests.post(
                DISPATCH_HISTORY_API,
                json=payload,
                timeout=60
            )
            
            print(f"[Dispatch History] Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') == 'success':
                    dispatch_summary = data.get('dispatch_summary', [])
                    pagination = data.get('pagination', {})
                    
                    print(f"[Dispatch History] Page {page}: {len(dispatch_summary)} dispatches, pagination: {pagination}")
                    
                    for dispatch in dispatch_summary:
                        dispatch_id = dispatch.get('dispatch_id', '')
                        dispatch_date = dispatch.get('dispatch_date', '')
                        vehicle_no = dispatch.get('vehicle_no', '')
                        invoice_no = dispatch.get('invoice_no', '')
                        factory_name = dispatch.get('factory_name', '')
                        pallet_nos = dispatch.get('pallet_nos', {})
                        
                        total_dispatches += 1
                        
                        # Parse pallet_nos - each pallet has space-separated serial numbers
                        if isinstance(pallet_nos, dict):
                            for pallet_no, barcodes_str in pallet_nos.items():
                                if isinstance(barcodes_str, str):
                                    # Split by space to get individual barcodes
                                    barcodes = barcodes_str.strip().split()
                                    for barcode in barcodes:
                                        barcode = barcode.strip().upper()
                                        if barcode:
                                            mrp_lookup[barcode] = {
                                                'status': 'Dispatched',
                                                'pallet_no': str(pallet_no),
                                                'dispatch_party': factory_name,
                                                'vehicle_no': vehicle_no,
                                                'dispatch_date': dispatch_date,
                                                'invoice_no': invoice_no,
                                                'dispatch_id': dispatch_id,
                                                'date': dispatch_date
                                            }
                                            total_barcodes += 1
                    
                    print(f"[Dispatch History] Running total: {total_barcodes} barcodes from {total_dispatches} dispatches")
                    
                    # Check for next page
                    has_next = pagination.get('has_next_page', False)
                    if has_next:
                        page += 1
                    else:
                        break
                else:
                    print(f"[Dispatch History] API status not success: {data.get('status')}, message: {data.get('message', 'N/A')}")
                    break
            else:
                print(f"[Dispatch History] HTTP error: {response.status_code}")
                break
                
        except Exception as e:
            print(f"[Dispatch History] Error on page {page}: {str(e)}")
            import traceback
            traceback.print_exc()
            break
    
    print(f"[Dispatch History] FINAL: {len(mrp_lookup)} unique barcodes from {total_dispatches} dispatches")
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
    
    Query params:
    - force_refresh=true: Bypass cache and fetch fresh data
    """
    # Check if force refresh requested
    force_refresh = request.args.get('force_refresh', '').lower() == 'true'
    print(f"[PDI Production] === API CALLED === force_refresh={force_refresh}, time={datetime.now().strftime('%H:%M:%S')}")
    
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

        # 6. Get ALL serials per PDI for dispatch cross-reference (no status filter)
        pdi_serials_map = {}
        try:
            cursor.execute("""
                SELECT serial_number, pdi_number
                FROM ftr_master_serials
                WHERE company_id = %s AND pdi_number IS NOT NULL AND serial_number IS NOT NULL
            """, (company_id,))
            for row in cursor.fetchall():
                pdi = row['pdi_number']
                serial = row['serial_number']
                if pdi and serial and not serial.strip().startswith('20'):
                    if pdi not in pdi_serials_map:
                        pdi_serials_map[pdi] = []
                    pdi_serials_map[pdi].append(serial.strip())
            print(f"[PDI Production] Total serials from FTR: {sum(len(s) for s in pdi_serials_map.values())} across {len(pdi_serials_map)} PDIs")
            # Print sample serial for debug
            if pdi_serials_map:
                first_pdi = list(pdi_serials_map.keys())[0]
                if pdi_serials_map[first_pdi]:
                    print(f"[PDI Production] Sample local serial: {pdi_serials_map[first_pdi][0]}")
        except Exception as e:
            print(f"[PDI Production] serial fetch error: {e}")

        # 6b. Get Packing API data (get_barcode_tracking.php)
        company_name = company['company_name']
        lower_name = company_name.strip().lower()
        
        # Map to MRP party name for packing API
        packing_party_names = []
        if 'rays' in lower_name:
            packing_party_names = ['RAYS POWER INFRA PRIVATE LIMITED']
        elif 'larsen' in lower_name or 'l&t' in lower_name or 'lnt' in lower_name:
            packing_party_names = ['LARSEN & TOUBRO LIMITED', 'LARSEN & TOUBRO LIMITED, CONSTRUCTION', 'LARSEN AND TOUBRO']
        elif 'sterling' in lower_name or 'sterlin' in lower_name or 's&w' in lower_name:
            packing_party_names = ['STERLING AND WILSON RENEWABLE ENERGY LIMITED', 'STERLING AND WILSON', 'S&W']
        
        # Fetch packed serials from packing API
        packed_lookup = {}  # serial -> {pallet_no, running_order, ...}
        print(f"[PDI Production] Fetching packing data for: {packing_party_names}")
        
        for party_name in packing_party_names:
            try:
                response = http_requests.post(
                    'https://umanmrp.in/api/get_barcode_tracking.php',
                    json={'party_name': party_name},
                    timeout=120
                )
                print(f"[PDI Production] Packing API response for {party_name}: status={response.status_code}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"[PDI Production] Packing API data: status={data.get('status')}, count={len(data.get('data', []))}")
                    if data.get('status') == 'success' or data.get('data'):
                        items = data.get('data', [])
                        for item in items:
                            barcode = item.get('barcode', '').strip().upper()
                            if barcode:
                                packed_lookup[barcode] = {
                                    'pallet_no': item.get('pallet_no', ''),
                                    'running_order': item.get('running_order', ''),
                                    'party_name': party_name,
                                    'status': 'Packed'
                                }
                        if items:
                            print(f"[PDI Production] Sample MRP barcode: {items[0].get('barcode', 'N/A')}")
            except Exception as e:
                print(f"[PDI Production] Packing API error ({party_name}): {e}")
        
        print(f"[PDI Production] Total packed serials: {len(packed_lookup)}")

        # 6c. Get LIVE dispatch data from MRP Dispatch API (party-dispatch-history.php)
        pdi_dispatch_data = {}  # pdi -> {dispatched: count, packed: count, serials: [...]}
        
        # Party ID mapping for dispatch API
        PARTY_IDS = {
            'rays': '931db2c5-b016-4914-b378-69e9f22562a7',
            'l&t': 'a005562f-568a-46e9-bf2e-700affb171e8',
            'larsen': 'a005562f-568a-46e9-bf2e-700affb171e8',
            'lnt': 'a005562f-568a-46e9-bf2e-700affb171e8',
            'sterling': '141b81a0-2bab-4790-b825-3c8734d41484',
            'sterlin': '141b81a0-2bab-4790-b825-3c8734d41484',
            's&w': '141b81a0-2bab-4790-b825-3c8734d41484'
        }
        
        # Find party_id for this company
        party_id = None
        matched_company = None
        for key, pid in PARTY_IDS.items():
            if key in lower_name:
                party_id = pid
                matched_company = key.upper()
                break
        
        # Fetch LIVE dispatched serials from Dispatch API (with caching)
        dispatched_serials_set = set()
        dispatched_details = {}  # serial -> {pallet_no, dispatch_party, vehicle_no, date}
        cache_used = False
        db_cache_time = None
        
        if party_id:
            # FIRST: Try to get from DATABASE cache (mrp_dispatch_cache) - this is fast
            try:
                # Get MAX sync time first
                cursor.execute("""
                    SELECT MAX(synced_at) as max_sync FROM mrp_dispatch_cache WHERE party_id = %s
                """, (party_id,))
                max_sync_row = cursor.fetchone()
                if max_sync_row and max_sync_row['max_sync']:
                    db_cache_time = max_sync_row['max_sync']
                
                cursor.execute("""
                    SELECT serial_number, pallet_no, dispatch_party, vehicle_no, dispatch_date
                    FROM mrp_dispatch_cache 
                    WHERE party_id = %s
                """, (party_id,))
                db_cache_rows = cursor.fetchall()
                
                if db_cache_rows:
                    print(f"[PDI Production] Using DB cache: {len(db_cache_rows)} dispatch records")
                    for row in db_cache_rows:
                        serial = row['serial_number'].strip().upper() if row['serial_number'] else ''
                        if serial:
                            dispatched_serials_set.add(serial)
                            dispatched_details[serial] = {
                                'pallet_no': row['pallet_no'] or '',
                                'dispatch_party': row['dispatch_party'] or '',
                                'vehicle_no': row['vehicle_no'] or '',
                                'date': str(row['dispatch_date']) if row['dispatch_date'] else ''
                            }
                    cache_used = True
                    print(f"[PDI Production] DB cache loaded: {len(dispatched_serials_set)} unique serials, synced: {db_cache_time}")
            except Exception as db_err:
                print(f"[PDI Production] DB cache error: {db_err}")
            
            # FALLBACK: If DB cache empty and force_refresh, try live API (but this is slow)
            if not dispatched_serials_set and force_refresh:
                try:
                    from datetime import timedelta
                    to_date = datetime.now().strftime('%Y-%m-%d')
                    from_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')  # Last 2 years
                    
                    print(f"[PDI Production] DB cache empty, fetching FRESH from API: party_id={party_id}")
                    
                    # Loop through pages to get ALL dispatch data
                    limit = 100
                    empty_count = 0
                    max_empty = 3  # Reduced to speed up
                    total_fetched = 0
                    error_count = 0
                    max_errors = 5
                    
                    for page in range(1, 2001):  # Max 2000 pages
                        try:
                            payload = {
                                "party_id": party_id,
                                "from_date": from_date,
                                "to_date": to_date,
                                "page": page,
                                "limit": limit
                            }
                            
                            response = http_requests.post(
                                "https://umanmrp.in/api/party-dispatch-history.php",
                                json=payload,
                                timeout=30  # Reduced timeout per page
                            )
                            
                            if response.status_code != 200:
                                print(f"[PDI Production] Dispatch API error page {page}: {response.status_code}")
                                error_count += 1
                                if error_count >= max_errors:
                                    print(f"[PDI Production] Too many errors, stopping at page {page}")
                                    break
                                continue
                            
                            data = response.json()
                            
                            # Log response structure on first page
                            if page == 1:
                                print(f"[PDI Production] Dispatch API response keys: {list(data.keys())}")
                            
                            # CORRECT FORMAT: dispatch_summary array with pallet_nos dict
                            items = data.get('dispatch_summary', [])
                        
                            if not items:
                                empty_count += 1
                                if empty_count >= max_empty:
                                    break
                                continue
                            
                            empty_count = 0
                            page_serial_count = 0
                            
                            for item in items:
                                dispatch_party = item.get('dispatch_party', '')
                                vehicle_no = item.get('vehicle_no', '')
                                dispatch_date = item.get('dispatch_date') or item.get('date', '')
                                pallet_nos = item.get('pallet_nos', {})
                                
                                # pallet_nos is dict: {pallet_no: "SERIAL1 SERIAL2 SERIAL3"}
                                if isinstance(pallet_nos, dict):
                                    for pallet, serials_str in pallet_nos.items():
                                        if serials_str and isinstance(serials_str, str):
                                            # Serials are space-separated
                                            for serial in serials_str.split():
                                                serial = serial.strip().upper()
                                                if serial:
                                                    dispatched_serials_set.add(serial)
                                                    dispatched_details[serial] = {
                                                        'pallet_no': pallet,
                                                        'dispatch_party': dispatch_party,
                                                        'vehicle_no': vehicle_no,
                                                        'date': dispatch_date
                                                    }
                                                    page_serial_count += 1
                            
                            total_fetched += page_serial_count
                            
                            # Print progress every 50 pages
                            if page % 50 == 0:
                                print(f"[PDI Production] Dispatch API: page {page}, fetched {total_fetched} serials so far")
                        
                        except Exception as page_err:
                            print(f"[PDI Production] Dispatch API page {page} error: {page_err}")
                            error_count += 1
                            if error_count >= max_errors:
                                print(f"[PDI Production] Too many errors, stopping")
                                break
                            continue
                    
                    print(f"[PDI Production] FRESH Dispatch: Total {len(dispatched_serials_set)} dispatched serials fetched")
                    
                    # Save to cache
                    DISPATCH_CACHE[party_id] = {
                        'set': dispatched_serials_set.copy(),
                        'data': dispatched_details.copy(),
                        'timestamp': time.time()
                    }
                    print(f"[PDI Production] Dispatch data cached for 10 minutes")
                    
                except Exception as e:
                    print(f"[PDI Production] Dispatch API error: {e}")
                    import traceback
                    traceback.print_exc()
        
        # 6d. Now categorize each PDI's serials into 3 categories
        for pdi, serials in pdi_serials_map.items():
            pdi_dispatch_data[pdi] = {
                'dispatched': 0,
                'packed': 0,
                'not_packed': 0,
                'dispatched_serials': [],
                'packed_serials': [],
                'not_packed_serials': [],
                'pallet_groups': {}
            }
            
            for serial in serials:
                serial_upper = serial.strip().upper()
                
                if serial_upper in dispatched_serials_set:
                    # DISPATCHED - in live dispatch API
                    pdi_dispatch_data[pdi]['dispatched'] += 1
                    dispatch_info = dispatched_details.get(serial_upper, {})
                    packing_info = packed_lookup.get(serial_upper, {})
                    pallet_no = dispatch_info.get('pallet_no') or packing_info.get('pallet_no') or ''
                    pdi_dispatch_data[pdi]['dispatched_serials'].append({
                        'serial': serial,
                        'pallet_no': pallet_no,
                        'dispatch_party': dispatch_info.get('dispatch_party', ''),
                        'vehicle_no': dispatch_info.get('vehicle_no', ''),
                        'date': dispatch_info.get('date', ''),
                        'status': 'Dispatched'
                    })
                    # Add to pallet group
                    pallet_key = pallet_no or 'Unknown'
                    if pallet_key not in pdi_dispatch_data[pdi]['pallet_groups']:
                        pdi_dispatch_data[pdi]['pallet_groups'][pallet_key] = {
                            'pallet_no': pallet_key, 'status': 'Dispatched', 'count': 0, 'serials': []
                        }
                    pdi_dispatch_data[pdi]['pallet_groups'][pallet_key]['count'] += 1
                    if len(pdi_dispatch_data[pdi]['pallet_groups'][pallet_no]['serials']) < 50:
                        pdi_dispatch_data[pdi]['pallet_groups'][pallet_no]['serials'].append(serial)
                        
                elif serial_upper in packed_lookup:
                    # PACKED (NOT DISPATCHED) - in packing API but not dispatch cache
                    pdi_dispatch_data[pdi]['packed'] += 1
                    packing_info = packed_lookup[serial_upper]
                    pdi_dispatch_data[pdi]['packed_serials'].append({
                        'serial': serial,
                        'pallet_no': packing_info.get('pallet_no', ''),
                        'party_name': packing_info.get('party_name', ''),
                        'status': 'Packed'
                    })
                    # Add to pallet group
                    pallet_no = packing_info.get('pallet_no') or 'Unknown'
                    if pallet_no not in pdi_dispatch_data[pdi]['pallet_groups']:
                        pdi_dispatch_data[pdi]['pallet_groups'][pallet_no] = {
                            'pallet_no': pallet_no, 'status': 'Packed', 'count': 0, 'serials': []
                        }
                    pdi_dispatch_data[pdi]['pallet_groups'][pallet_no]['count'] += 1
                    if len(pdi_dispatch_data[pdi]['pallet_groups'][pallet_no]['serials']) < 50:
                        pdi_dispatch_data[pdi]['pallet_groups'][pallet_no]['serials'].append(serial)
                        
                else:
                    # NOT PACKED - not in packing API at all
                    pdi_dispatch_data[pdi]['not_packed'] += 1
                    pdi_dispatch_data[pdi]['not_packed_serials'].append({
                        'serial': serial,
                        'pallet_no': '',
                        'status': 'Not Packed'
                    })
        
        total_dispatched = sum(d['dispatched'] for d in pdi_dispatch_data.values())
        total_packed = sum(d['packed'] for d in pdi_dispatch_data.values())
        total_not_packed = sum(d['not_packed'] for d in pdi_dispatch_data.values())
        print(f"[PDI Production] Final: Dispatched={total_dispatched}, Packed={total_packed}, Not Packed={total_not_packed}")

        conn.close()

        # 7. Build debug info
        total_dispatched_in_result = sum(d.get('dispatched', 0) + d.get('packed', 0) for d in pdi_dispatch_data.values())
        mrp_error = None
        
        # Get last refresh timestamp
        current_time_stamp = time.time()
        server_current_time = datetime.fromtimestamp(current_time_stamp).strftime('%Y-%m-%d %H:%M:%S')
        
        # Use db_cache_time if available (from mrp_dispatch_cache)
        if db_cache_time:
            last_refresh_time = str(db_cache_time)
            # Calculate age from db_cache_time
            try:
                cache_age_seconds = int((datetime.now() - db_cache_time).total_seconds())
            except:
                cache_age_seconds = 0
        else:
            last_refresh_time = server_current_time
            cache_age_seconds = 0
        
        print(f"[PDI Production] Debug: cache_used={cache_used}, cache_age={cache_age_seconds}s, last_refresh={last_refresh_time}, server_time={server_current_time}")
        
        # Collect sample serials for debugging format mismatches
        all_local_serials = []
        for pdi, serials in pdi_serials_map.items():
            all_local_serials.extend([s.strip().upper() for s in serials])
        
        sample_mrp_barcodes = list(dispatched_serials_set)[:5] if dispatched_serials_set else []
        sample_packed_barcodes = list(packed_lookup.keys())[:5] if packed_lookup else []
        sample_local_serials = all_local_serials[:5] if all_local_serials else []
        
        # Count exact matches
        local_set = set(all_local_serials)
        dispatch_matches = len(local_set.intersection(dispatched_serials_set))
        packed_matches = len(local_set.intersection(set(packed_lookup.keys())))
        
        debug_info = {
            'matched_company': matched_company,
            'total_pdi_with_dispatch': len(pdi_dispatch_data),
            'total_dispatched_serials': total_dispatched_in_result,
            'company_name': company_name,
            'using_live_api': True,
            'using_cache': cache_used,
            'cache_age_seconds': cache_age_seconds,
            'last_refresh_time': last_refresh_time,
            'server_current_time': server_current_time,
            'live_dispatch_count': len(dispatched_serials_set),
            'live_packed_count': len(packed_lookup),
            # NEW diagnostic fields
            'mrp_barcodes_total': len(dispatched_serials_set),
            'packed_barcodes_total': len(packed_lookup),
            'local_serials_total': len(all_local_serials),
            'dispatch_matches': dispatch_matches,
            'packed_matches': packed_matches,
            'sample_mrp_barcodes': sample_mrp_barcodes,
            'sample_packed_barcodes': sample_packed_barcodes,
            'sample_local_serials': sample_local_serials
        }

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

            # Get dispatch data from 3-category classification
            dispatch_data = pdi_dispatch_data.get(pdi, {})
            dispatched = dispatch_data.get('dispatched', 0)
            packed = dispatch_data.get('packed', 0)
            not_packed = dispatch_data.get('not_packed', 0)
            dispatched_serials = dispatch_data.get('dispatched_serials', [])
            packed_serials = dispatch_data.get('packed_serials', [])
            not_packed_serials = dispatch_data.get('not_packed_serials', [])
            
            # Get pallet groups 
            pallet_groups_dict = dispatch_data.get('pallet_groups', {})
            pallet_list = sorted(pallet_groups_dict.values(), key=lambda x: str(x['pallet_no']))
            # Limit serials per pallet to 50 for response size
            for p in pallet_list:
                if len(p['serials']) > 50:
                    p['serials'] = p['serials'][:50]
            
            # Build dispatch parties summary
            dispatch_parties = {}
            for ds in dispatched_serials:
                dp = ds.get('dispatch_party', '')
                dispatch_parties[dp] = dispatch_parties.get(dp, 0) + 1

            grand_dispatched += dispatched
            grand_packed += packed
            grand_disp_pending += not_packed  # Not packed = dispatch pending

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
                'not_packed': not_packed,
                'dispatch_pending': not_packed,  # Not packed = dispatch pending
                'dispatch_parties': [{'party': k, 'count': v} for k, v in sorted(dispatch_parties.items(), key=lambda x: x[1], reverse=True)],
                'dispatched_serials': dispatched_serials,
                'packed_serials': packed_serials,
                'not_packed_serials': not_packed_serials,
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
            "dispatch_matches": debug_info.get('total_dispatched_serials', 0),
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
                "total_not_packed": grand_disp_pending,
                "total_dispatch_pending": grand_disp_pending
            },
            "pdi_wise": pdi_wise
        })

    except Exception as e:
        print(f"[PDI Production] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@ftr_bp.route('/export-not-packed-serials/<int:company_id>', methods=['GET'])
def export_not_packed_serials(company_id):
    """
    Export Not Packed serials to Excel for a company.
    Returns Excel file with serial numbers grouped by PDI.
    """
    try:
        import io
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        from flask import send_file
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get company info
        cursor.execute("SELECT * FROM companies WHERE id = %s", (company_id,))
        company = cursor.fetchone()
        if not company:
            return jsonify({"success": False, "error": "Company not found"}), 404
        
        company_name = company.get('company_name', '')
        lower_name = company_name.lower()
        
        # Get all FTR serials for this company grouped by PDI
        cursor.execute("""
            SELECT pdi_number, serial_number FROM ftr_master_serials 
            WHERE company_id = %s AND pdi_number IS NOT NULL AND serial_number IS NOT NULL
        """, (company_id,))
        
        pdi_serials_map = {}
        for row in cursor.fetchall():
            pdi = row['pdi_number']
            serial = row['serial_number']
            if pdi and serial and not serial.strip().startswith('20'):
                if pdi not in pdi_serials_map:
                    pdi_serials_map[pdi] = []
                pdi_serials_map[pdi].append(serial.strip())
        
        # Map company name to packing API party name
        PACKING_PARTY_NAMES = {
            'rays': 'RAYS POWER INFRA PRIVATE LIMITED',
            'l&t': 'LARSEN & TOUBRO LIMITED CONSTRUCTION',
            'larsen': 'LARSEN & TOUBRO LIMITED CONSTRUCTION',
            'lnt': 'LARSEN & TOUBRO LIMITED CONSTRUCTION',
            'sterling': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
            's&w': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED'
        }
        
        # Find matching party names
        matching_party_names = []
        for key, party_name in PACKING_PARTY_NAMES.items():
            if key in lower_name:
                if party_name not in matching_party_names:
                    matching_party_names.append(party_name)
        
        # Fetch from Packing API
        packed_serials_set = set()
        for party_name in matching_party_names:
            try:
                payload = {"party_name": party_name}
                response = http_requests.post(
                    "https://umanmrp.in/api/get_barcode_tracking.php",
                    json=payload,
                    timeout=120
                )
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get('data', []):
                        barcode = item.get('barcode', '').strip().upper()
                        if barcode:
                            packed_serials_set.add(barcode)
            except Exception as e:
                print(f"[Export] Packing API error ({party_name}): {e}")
        
        # Build not packed list grouped by PDI
        not_packed_by_pdi = {}
        for pdi, serials in pdi_serials_map.items():
            not_packed_list = []
            for serial in serials:
                if serial.strip().upper() not in packed_serials_set:
                    not_packed_list.append(serial)
            if not_packed_list:
                not_packed_by_pdi[pdi] = not_packed_list
        
        conn.close()
        
        # Create Excel workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Not Packed Serials"
        
        # Styles
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Headers
        headers = ["S.No", "PDI Number", "Serial Number", "Status"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center')
            cell.border = thin_border
        
        # Data
        row_num = 2
        serial_no = 1
        for pdi in sorted(not_packed_by_pdi.keys()):
            for serial in not_packed_by_pdi[pdi]:
                ws.cell(row=row_num, column=1, value=serial_no).border = thin_border
                ws.cell(row=row_num, column=2, value=pdi).border = thin_border
                ws.cell(row=row_num, column=3, value=serial).border = thin_border
                ws.cell(row=row_num, column=4, value="Not Packed").border = thin_border
                row_num += 1
                serial_no += 1
        
        # Adjust column widths
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 15
        ws.column_dimensions['C'].width = 30
        ws.column_dimensions['D'].width = 12
        
        # Summary sheet
        ws2 = wb.create_sheet("Summary")
        ws2.cell(row=1, column=1, value="Company").font = Font(bold=True)
        ws2.cell(row=1, column=2, value=company_name)
        ws2.cell(row=2, column=1, value="Total PDIs").font = Font(bold=True)
        ws2.cell(row=2, column=2, value=len(not_packed_by_pdi))
        ws2.cell(row=3, column=1, value="Total Not Packed").font = Font(bold=True)
        ws2.cell(row=3, column=2, value=serial_no - 1)
        ws2.cell(row=4, column=1, value="Export Date").font = Font(bold=True)
        ws2.cell(row=4, column=2, value=datetime.now().strftime('%Y-%m-%d %H:%M'))
        
        # PDI-wise summary
        ws2.cell(row=6, column=1, value="PDI Number").font = Font(bold=True)
        ws2.cell(row=6, column=2, value="Not Packed Count").font = Font(bold=True)
        row = 7
        for pdi in sorted(not_packed_by_pdi.keys()):
            ws2.cell(row=row, column=1, value=pdi)
            ws2.cell(row=row, column=2, value=len(not_packed_by_pdi[pdi]))
            row += 1
        
        # Save to buffer
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        
        filename = f"not_packed_serials_{company_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return send_file(
            buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"[Export] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ============ MRP DISPATCH CACHE ENDPOINTS ============

@ftr_bp.route('/sync-mrp-dispatch', methods=['POST'])
def sync_mrp_dispatch():
    """
    Sync dispatch data from MRP API to local cache table.
    Fetches last 1 year of data for specified company.
    Loops through pages 1-1000 to get ALL data.
    """
    try:
        data = request.get_json() or {}
        company_name = data.get('company', '')
        
        # Party ID mapping
        PARTY_IDS = {
            'Rays Power': '931db2c5-b016-4914-b378-69e9f22562a7',
            'L&T': 'a005562f-568a-46e9-bf2e-700affb171e8', 
            'Sterling': '141b81a0-2bab-4790-b825-3c8734d41484'
        }
        
        # Find party_id for company
        party_id = None
        matched_company = None
        for name, pid in PARTY_IDS.items():
            if name.lower() in company_name.lower() or company_name.lower() in name.lower():
                party_id = pid
                matched_company = name
                break
        
        if not party_id:
            return jsonify({
                "success": False, 
                "error": f"No party ID found for company: {company_name}",
                "available_companies": list(PARTY_IDS.keys())
            }), 400
        
        # Date range - last 1 year
        from datetime import datetime, timedelta
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        
        print(f"[MRP Sync] Company: {company_name}, Party ID: {party_id}")
        print(f"[MRP Sync] Date range: {from_date} to {to_date}")
        
        # Fetch from MRP API - Loop pages 1 to 1000
        all_barcodes = []
        limit = 100
        empty_pages = 0
        max_empty = 3
        
        for page in range(1, 1001):
            payload = {
                "party_id": party_id,
                "from_date": from_date,
                "to_date": to_date,
                "page": page,
                "limit": limit
            }
            
            response = http_requests.post(
                "https://umanmrp.in/api/party-dispatch-history.php",
                json=payload,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"[MRP Sync] API error on page {page}: {response.status_code}")
                break
                
            result = response.json()
            dispatch_summary = result.get('dispatch_summary', [])
            
            if not dispatch_summary:
                empty_pages += 1
                if empty_pages >= max_empty:
                    print(f"[MRP Sync] Page {page}: Empty - stopping (3 consecutive empty)")
                    break
                continue
            else:
                empty_pages = 0
            
            page_count = 0
            for item in dispatch_summary:
                pallet_nos = item.get('pallet_nos', {})
                status = item.get('status', 'Packed')
                dispatch_party = item.get('dispatch_party', '')
                vehicle_no = item.get('vehicle_no', '')
                dispatch_date = item.get('dispatch_date') or item.get('date', '')
                invoice_no = item.get('invoice_no', '')
                
                # Parse pallet_nos - each key is pallet number, value is space-separated serials
                if isinstance(pallet_nos, dict):
                    for pallet_no, serials_str in pallet_nos.items():
                        if serials_str and isinstance(serials_str, str):
                            serials = serials_str.strip().split()
                            for serial in serials:
                                serial = serial.strip()
                                if serial:
                                    all_barcodes.append({
                                        'serial_number': serial.upper(),
                                        'pallet_no': pallet_no,
                                        'status': status,
                                        'dispatch_party': dispatch_party,
                                        'vehicle_no': vehicle_no,
                                        'dispatch_date': dispatch_date,
                                        'invoice_no': invoice_no,
                                        'company': matched_company,
                                        'party_id': party_id
                                    })
                                    page_count += 1
            
            print(f"[MRP Sync] Page {page}: {len(dispatch_summary)} dispatches, {page_count} serials (Total: {len(all_barcodes)})")
        
        print(f"[MRP Sync] Total barcodes fetched: {len(all_barcodes)}")
        
        # Save to local database
        conn = get_db_connection()
        inserted = 0
        updated = 0
        
        try:
            with conn.cursor() as cursor:
                for barcode in all_barcodes:
                    # Use INSERT ... ON DUPLICATE KEY UPDATE
                    cursor.execute("""
                        INSERT INTO mrp_dispatch_cache 
                        (serial_number, pallet_no, status, dispatch_party, vehicle_no, dispatch_date, invoice_no, company, party_id, synced_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE
                        pallet_no = VALUES(pallet_no),
                        status = VALUES(status),
                        dispatch_party = VALUES(dispatch_party),
                        vehicle_no = VALUES(vehicle_no),
                        dispatch_date = VALUES(dispatch_date),
                        invoice_no = VALUES(invoice_no),
                        company = VALUES(company),
                        party_id = VALUES(party_id),
                        synced_at = NOW()
                    """, (
                        barcode['serial_number'],
                        barcode['pallet_no'],
                        barcode['status'],
                        barcode['dispatch_party'],
                        barcode['vehicle_no'],
                        barcode['dispatch_date'] if barcode['dispatch_date'] else None,
                        barcode['invoice_no'],
                        barcode['company'],
                        barcode['party_id']
                    ))
                    
                    if cursor.rowcount == 1:
                        inserted += 1
                    elif cursor.rowcount == 2:
                        updated += 1
                
                conn.commit()
                
                # Get total count
                cursor.execute("SELECT COUNT(*) as total FROM mrp_dispatch_cache WHERE company = %s", (matched_company,))
                total_in_db = cursor.fetchone()['total']
                
        finally:
            conn.close()
        
        return jsonify({
            "success": True,
            "company": matched_company,
            "party_id": party_id,
            "date_range": {"from": from_date, "to": to_date},
            "fetched_from_api": len(all_barcodes),
            "inserted": inserted,
            "updated": updated,
            "total_in_cache": total_in_db
        })
        
    except Exception as e:
        print(f"[MRP Sync] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@ftr_bp.route('/mrp-cache-stats', methods=['GET'])
def mrp_cache_stats():
    """Get statistics about MRP dispatch cache"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Get stats by company
            cursor.execute("""
                SELECT 
                    company,
                    COUNT(*) as total_serials,
                    COUNT(DISTINCT pallet_no) as total_pallets,
                    SUM(CASE WHEN status = 'Dispatched' THEN 1 ELSE 0 END) as dispatched,
                    SUM(CASE WHEN status = 'Packed' THEN 1 ELSE 0 END) as packed,
                    MIN(synced_at) as first_sync,
                    MAX(synced_at) as last_sync
                FROM mrp_dispatch_cache
                GROUP BY company
            """)
            stats = cursor.fetchall()
            
            # Get total
            cursor.execute("SELECT COUNT(*) as total FROM mrp_dispatch_cache")
            total = cursor.fetchone()['total']
            
        conn.close()
        
        return jsonify({
            "success": True,
            "total_cached": total,
            "by_company": stats
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@ftr_bp.route('/mrp-cache-search', methods=['GET'])
def mrp_cache_search():
    """Search serials in MRP cache"""
    try:
        serial = request.args.get('serial', '').strip().upper()
        company = request.args.get('company', '')
        pallet = request.args.get('pallet', '')
        limit = int(request.args.get('limit', 100))
        
        conn = get_db_connection()
        with conn.cursor() as cursor:
            query = "SELECT * FROM mrp_dispatch_cache WHERE 1=1"
            params = []
            
            if serial:
                query += " AND serial_number LIKE %s"
                params.append(f"%{serial}%")
            if company:
                query += " AND company LIKE %s"
                params.append(f"%{company}%")
            if pallet:
                query += " AND pallet_no LIKE %s"
                params.append(f"%{pallet}%")
            
            query += " ORDER BY synced_at DESC LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
        conn.close()
        
        # Convert dates to strings
        for r in results:
            if r.get('dispatch_date'):
                r['dispatch_date'] = str(r['dispatch_date'])
            if r.get('synced_at'):
                r['synced_at'] = str(r['synced_at'])
        
        return jsonify({
            "success": True,
            "count": len(results),
            "results": results
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500