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


@ftr_bp.route('/pdi-dashboard/<int:company_id>', methods=['GET'])
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


@ftr_bp.route('/pdi-dashboard-quick/<int:company_id>', methods=['GET'])
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
    'Rays Power': 'RAYS POWER INFRA PRIVATE LIMITED',
    'rays power': 'RAYS POWER INFRA PRIVATE LIMITED',
    'RAYS POWER': 'RAYS POWER INFRA PRIVATE LIMITED',
    
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

# Party IDs for dispatch history API
PARTY_IDS = {
    'rays power': '931db2c5-b016-4914-b378-69e9f22562a7',
    'larsen & toubro': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'l&t': 'a005562f-568a-46e9-bf2e-700affb171e8',
    'sterlin and wilson': '141b81a0-2bab-4790-b825-3c8734d41484',
    'sterling and wilson': '141b81a0-2bab-4790-b825-3c8734d41484',
    's&w': '141b81a0-2bab-4790-b825-3c8734d41484',
    'kpi green energy': 'kpi-green-energy-party-id',
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


def fetch_mrp_barcode_data(company_name):
    """
    Fetch barcode tracking data from MRP API - same logic as ai_assistant_routes.
    For Sterling and Wilson, fetches from TWO party names.
    Returns combined data list.
    """
    mrp_party_name = get_mrp_party_name_ftr(company_name)
    lower_name = company_name.lower()
    
    # Check if Sterling and Wilson - need dual fetch
    is_sterling = 'sterling' in mrp_party_name.lower() or 'sterlin' in lower_name or 's&w' in lower_name
    
    party_names = [mrp_party_name]
    if is_sterling:
        party_names = ['STERLING AND WILSON RENEWABLE ENERGY LIMITED', 'S&W']
    
    all_data = []
    for party_name in party_names:
        try:
            response = http_requests.post(
                'https://umanmrp.in/api/get_barcode_tracking.php',
                json={'party_name': party_name},
                timeout=60
            )
            if response.status_code == 200:
                data = response.json()
                # MRP API returns 'status': 'success', NOT 'success': true
                if data.get('status') == 'success':
                    party_data = data.get('data', [])
                    all_data.extend(party_data)
                    print(f"  ✅ Fetched {len(party_data)} records from party: {party_name}")
                else:
                    print(f"  ⚠️ API returned status: {data.get('status')} for {party_name}")
        except Exception as e:
            print(f"  ⚠️ Error fetching from {party_name}: {str(e)}")
            continue
    
    return all_data, mrp_party_name


@ftr_bp.route('/dispatch-tracking/<int:company_id>', methods=['GET'])
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

        # Fetch data using same method as AI assistant
        mrp_data, mrp_party_name = fetch_mrp_barcode_data(company_name)

        print(f"[Dispatch Tracking] Total records fetched: {len(mrp_data)}")

        if not mrp_data:
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
                "message": "No data found in MRP system"
            })
        total = len(mrp_data)

        # Process data server-side for speed
        dispatched = 0
        packed = 0
        pending = 0
        pdi_map = {}
        vehicle_map = {}

        for item in mrp_data:
            barcode = item.get('barcode_no', '')
            pdi_number = item.get('pdi_number', 'N/A')

            dispatch_info = item.get('dispatch', {}) or {}
            packing_info = item.get('packing', {}) or {}

            has_dispatch = bool(dispatch_info.get('dispatch_date'))
            has_packing = bool(packing_info.get('packing_date'))

            if has_dispatch:
                dispatched += 1
                dispatch_date = dispatch_info.get('dispatch_date', '')
                vehicle_no = dispatch_info.get('vehicle_no', 'Unknown')
                party = dispatch_info.get('party_name', company_name)

                # Group by PDI
                if pdi_number not in pdi_map:
                    pdi_map[pdi_number] = {
                        'pdi': pdi_number,
                        'dispatched': 0,
                        'packed': 0,
                        'pending': 0,
                        'vehicle_nos': [],
                        'dispatch_dates': []
                    }
                pdi_map[pdi_number]['dispatched'] += 1
                if vehicle_no and vehicle_no not in pdi_map[pdi_number]['vehicle_nos']:
                    pdi_map[pdi_number]['vehicle_nos'].append(vehicle_no)
                if dispatch_date and dispatch_date not in pdi_map[pdi_number]['dispatch_dates']:
                    pdi_map[pdi_number]['dispatch_dates'].append(dispatch_date)

                # Group by vehicle
                if vehicle_no not in vehicle_map:
                    vehicle_map[vehicle_no] = {
                        'vehicle_no': vehicle_no,
                        'dispatch_date': dispatch_date,
                        'party': party,
                        'module_count': 0,
                        'serials': []
                    }
                vehicle_map[vehicle_no]['module_count'] += 1
                # Only store first 50 serials per vehicle to limit response size
                if len(vehicle_map[vehicle_no]['serials']) < 50:
                    vehicle_map[vehicle_no]['serials'].append(barcode)

            elif has_packing:
                packed += 1
                # Track packed in PDI groups too
                if pdi_number not in pdi_map:
                    pdi_map[pdi_number] = {
                        'pdi': pdi_number,
                        'dispatched': 0,
                        'packed': 0,
                        'pending': 0,
                        'vehicle_nos': [],
                        'dispatch_dates': []
                    }
                pdi_map[pdi_number]['packed'] += 1
            else:
                pending += 1
                if pdi_number not in pdi_map:
                    pdi_map[pdi_number] = {
                        'pdi': pdi_number,
                        'dispatched': 0,
                        'packed': 0,
                        'pending': 0,
                        'vehicle_nos': [],
                        'dispatch_dates': []
                    }
                pdi_map[pdi_number]['pending'] += 1

        # Calculate percentages
        packed_percent = round((packed / total) * 100) if total > 0 else 0
        dispatched_percent = round((dispatched / total) * 100) if total > 0 else 0
        pending_percent = round((pending / total) * 100) if total > 0 else 0

        # Sort PDI groups naturally
        pdi_groups = sorted(pdi_map.values(), key=lambda x: x['pdi'])
        vehicle_groups = sorted(vehicle_map.values(), key=lambda x: x.get('dispatch_date', ''), reverse=True)

        return jsonify({
            "success": True,
            "company_name": company_name,
            "mrp_party_name": mrp_party_name,
            "summary": {
                "total_assigned": total,
                "packed": packed,
                "dispatched": dispatched,
                "pending": pending,
                "packed_percent": packed_percent,
                "dispatched_percent": dispatched_percent,
                "pending_percent": pending_percent
            },
            "pdi_groups": pdi_groups,
            "vehicle_groups": vehicle_groups
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
