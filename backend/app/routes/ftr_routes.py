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

        # ====================================================
        # Process data using SAME logic as ai_assistant_routes
        # MRP API returns FLAT data:
        #   barcode, pallet_no, dispatch_party, running_order
        # Status logic (from ai_assistant_routes.py):
        #   - has dispatch_party → DISPATCHED
        #   - has pallet_no but no dispatch_party → PACKED
        #   - neither → PENDING (not in MRP / not packed yet)
        # ====================================================
        dispatched = 0
        packed = 0
        pending = 0
        pallet_map = {}   # group by pallet_no
        dispatch_party_map = {}  # group by dispatch_party

        # Log first item to debug structure
        if mrp_data:
            sample = mrp_data[0]
            print(f"[Dispatch Tracking] Sample record keys: {list(sample.keys())}")
            print(f"[Dispatch Tracking] Sample record: barcode={sample.get('barcode','?')}, pallet_no={sample.get('pallet_no','?')}, dispatch_party={sample.get('dispatch_party','?')}")

        for item in mrp_data:
            barcode = item.get('barcode', '')
            pallet_no = item.get('pallet_no', '')
            dispatch_party = item.get('dispatch_party', '')
            running_order = item.get('running_order', '')

            if dispatch_party:
                # DISPATCHED - has dispatch_party
                dispatched += 1

                # Group by dispatch_party (acts like vehicle/shipment group)
                if dispatch_party not in dispatch_party_map:
                    dispatch_party_map[dispatch_party] = {
                        'dispatch_party': dispatch_party,
                        'module_count': 0,
                        'pallets': set(),
                        'serials': []
                    }
                dispatch_party_map[dispatch_party]['module_count'] += 1
                if pallet_no:
                    dispatch_party_map[dispatch_party]['pallets'].add(pallet_no)
                if len(dispatch_party_map[dispatch_party]['serials']) < 50:
                    dispatch_party_map[dispatch_party]['serials'].append(barcode)

            elif pallet_no:
                # PACKED - has pallet_no but no dispatch_party
                packed += 1

                # Group by pallet
                if pallet_no not in pallet_map:
                    pallet_map[pallet_no] = {
                        'pallet_no': pallet_no,
                        'module_count': 0,
                        'serials': []
                    }
                pallet_map[pallet_no]['module_count'] += 1
                if len(pallet_map[pallet_no]['serials']) < 20:
                    pallet_map[pallet_no]['serials'].append(barcode)
            else:
                # PENDING - not packed, not dispatched
                pending += 1

        # Calculate percentages
        packed_percent = round((packed / total) * 100) if total > 0 else 0
        dispatched_percent = round((dispatched / total) * 100) if total > 0 else 0
        pending_percent = round((pending / total) * 100) if total > 0 else 0

        # Build pallet groups (packed pallets)
        pallet_groups = sorted(pallet_map.values(), key=lambda x: str(x['pallet_no']))

        # Build dispatch groups
        dispatch_groups = []
        for dp_name, dp_data in dispatch_party_map.items():
            dispatch_groups.append({
                'dispatch_party': dp_name,
                'module_count': dp_data['module_count'],
                'pallet_count': len(dp_data['pallets']),
                'pallets': sorted(list(dp_data['pallets'])),
                'serials': dp_data['serials']
            })
        dispatch_groups.sort(key=lambda x: x['module_count'], reverse=True)

        print(f"[Dispatch Tracking] Result: dispatched={dispatched}, packed={packed}, pending={pending}")

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


@ftr_bp.route('/dispatch-tracking-pdi/<int:company_id>', methods=['GET'])
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

        # Step 4: Fetch MRP data for this company (same as AI assistant)
        mrp_data, mrp_party_name = fetch_mrp_barcode_data(company_name)
        print(f"[PDI Dispatch] MRP records fetched: {len(mrp_data)}")

        # Step 5: Build MRP lookup — barcode → {status, pallet_no, dispatch_party}
        mrp_lookup = {}
        for b in mrp_data:
            barcode = b.get('barcode', '')
            if barcode:
                mrp_lookup[barcode] = {
                    'pallet_no': b.get('pallet_no', ''),
                    'dispatch_party': b.get('dispatch_party', ''),
                    'status': 'Dispatched' if b.get('dispatch_party') else 'Packed'
                }

        print(f"[PDI Dispatch] MRP lookup size: {len(mrp_lookup)}")

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

            for serial in serials:
                if serial in mrp_lookup:
                    info = mrp_lookup[serial]
                    if info['status'] == 'Dispatched':
                        dispatched += 1
                        dp = info['dispatch_party']
                        if dp not in dispatch_parties:
                            dispatch_parties[dp] = 0
                        dispatch_parties[dp] += 1
                    else:
                        packed += 1
                else:
                    pending += 1

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
                'dispatch_parties': [{'party': k, 'count': v} for k, v in sorted(dispatch_parties.items(), key=lambda x: x[1], reverse=True)]
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
