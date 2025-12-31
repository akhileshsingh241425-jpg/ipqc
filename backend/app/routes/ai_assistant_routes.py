from flask import Blueprint, request, jsonify
from app.models.database import db
from sqlalchemy import text
import requests
import os
import json

ai_assistant_bp = Blueprint('ai_assistant', __name__)

# Groq API Configuration
# Set GROQ_API_KEY environment variable on server
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

# External Barcode Tracking API
BARCODE_TRACKING_API = 'https://umanmrp.in/api/get_barcode_tracking.php'

# Company Name Mapping (Database name -> MRP API name)
# EXACT names from production server
COMPANY_NAME_MAPPING = {
    # Rays Power (Production Server Name)
    'Rays Power': 'RAYS POWER INFRA PRIVATE LIMITED',
    'rays power': 'RAYS POWER INFRA PRIVATE LIMITED',
    'Rays power': 'RAYS POWER INFRA PRIVATE LIMITED',
    'RAYS POWER': 'RAYS POWER INFRA PRIVATE LIMITED',
    
    # Larsen & Toubro (Production Server Name)
    'Larsen & Toubro': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'larsen & toubro': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'LARSEN & TOUBRO': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    'L&T': 'LARSEN & TOUBRO LIMITED, CONSTRUCTION',
    
    # Sterlin and Wilson (Production Server Name - Note: "Sterlin" not "Sterling")
    'Sterlin and Wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'sterlin and wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'STERLIN AND WILSON': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
    'Sterling and Wilson': 'STERLING AND WILSON RENEWABLE ENERGY LIMITED',
}

def get_mrp_party_name(db_company_name):
    """Get the MRP API party name from database company name"""
    # Try exact match first
    if db_company_name in COMPANY_NAME_MAPPING:
        return COMPANY_NAME_MAPPING[db_company_name]
    # Try lowercase match
    lower_name = db_company_name.lower()
    for key, value in COMPANY_NAME_MAPPING.items():
        if key.lower() == lower_name:
            return value
    # Return original if no mapping found
    return db_company_name

def get_external_packed_dispatch_data(party_name):
    """Fetch packed and dispatch data from external API"""
    try:
        # Get the MRP API party name
        mrp_party_name = get_mrp_party_name(party_name)
        
        response = requests.post(
            BARCODE_TRACKING_API,
            json={'party_name': mrp_party_name},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                barcodes = data.get('data', [])
                
                # Count packed and dispatched
                packed_count = 0
                dispatched_count = 0
                packed_barcodes = []
                dispatched_barcodes = []
                
                for item in barcodes:
                    if item.get('status') == 'packed':
                        packed_count += 1
                        packed_barcodes.append(item.get('barcode'))
                    if item.get('dispatch_party') or item.get('status') == 'dispatched':
                        dispatched_count += 1
                        dispatched_barcodes.append(item.get('barcode'))
                
                return {
                    'success': True,
                    'party': party_name,
                    'total_count': data.get('count', len(barcodes)),
                    'packed_count': packed_count,
                    'dispatched_count': dispatched_count,
                    'pending_dispatch': packed_count - dispatched_count,
                    'sample_packed': packed_barcodes[:10],
                    'sample_dispatched': dispatched_barcodes[:10]
                }
        
        return {'success': False, 'error': 'API call failed'}
        
    except Exception as e:
        print(f"Error fetching external data: {str(e)}")
        return {'success': False, 'error': str(e)}

def get_all_ftr_data():
    """Get all FTR data from database for AI context"""
    try:
        data = {
            'companies': [],
            'summary': {},
            'pending_serials': {},  # Store pending serial numbers
            'external_tracking': {}  # Store external API data
        }
        
        # Get all companies
        result = db.session.execute(text("""
            SELECT id, company_name, module_wattage FROM companies
        """))
        companies = result.fetchall()
        
        total_master = 0
        total_assigned = 0
        total_packed = 0
        total_rejected = 0
        total_ext_packed = 0
        total_ext_dispatched = 0
        
        for company in companies:
            company_id = company[0]
            company_name = company[1]
            module_wattage = company[2]
            
            # Get master FTR count (total)
            result = db.session.execute(text("""
                SELECT COUNT(*) FROM ftr_master_serials 
                WHERE company_id = :cid
            """), {'cid': company_id})
            master_total = result.fetchone()[0] or 0
            
            # Get rejected count
            result = db.session.execute(text("""
                SELECT COUNT(*) FROM ftr_master_serials 
                WHERE company_id = :cid AND class_status = 'REJECTED'
            """), {'cid': company_id})
            rejected = result.fetchone()[0] or 0
            
            # Get available count (OK and available)
            result = db.session.execute(text("""
                SELECT COUNT(*) FROM ftr_master_serials 
                WHERE company_id = :cid AND status = 'available' AND (class_status = 'OK' OR class_status IS NULL)
            """), {'cid': company_id})
            available = result.fetchone()[0] or 0
            
            # Get assigned count (OK only)
            result = db.session.execute(text("""
                SELECT COUNT(*) FROM ftr_master_serials 
                WHERE company_id = :cid AND status = 'assigned' AND (class_status = 'OK' OR class_status IS NULL)
            """), {'cid': company_id})
            assigned = result.fetchone()[0] or 0
            
            # Get packed count
            result = db.session.execute(text("""
                SELECT COUNT(*) FROM ftr_packed_modules 
                WHERE company_id = :cid
            """), {'cid': company_id})
            packed = result.fetchone()[0] or 0
            
            # Get BINNING breakdown (only OK modules)
            result = db.session.execute(text("""
                SELECT binning, COUNT(*) as count
                FROM ftr_master_serials
                WHERE company_id = :cid AND (class_status = 'OK' OR class_status IS NULL)
                GROUP BY binning
                ORDER BY binning
            """), {'cid': company_id})
            binning_breakdown = [{'binning': row[0] or 'Unknown', 'count': row[1]} for row in result.fetchall()]
            
            # Get PDI-wise breakdown
            result = db.session.execute(text("""
                SELECT pdi_number, COUNT(*) as count
                FROM ftr_master_serials
                WHERE company_id = :cid AND status = 'assigned' AND pdi_number IS NOT NULL
                GROUP BY pdi_number
                ORDER BY count DESC
            """), {'cid': company_id})
            pdi_breakdown = [{'pdi': row[0], 'count': row[1]} for row in result.fetchall()]
            
            # Get PENDING serial numbers with binning (assigned but not packed, OK only)
            result = db.session.execute(text("""
                SELECT m.serial_number, m.pdi_number, m.binning
                FROM ftr_master_serials m
                LEFT JOIN ftr_packed_modules p ON m.serial_number = p.serial_number AND m.company_id = p.company_id
                WHERE m.company_id = :cid AND m.status = 'assigned' AND p.id IS NULL
                AND (m.class_status = 'OK' OR m.class_status IS NULL)
                ORDER BY m.binning, m.pdi_number, m.serial_number
                LIMIT 50
            """), {'cid': company_id})
            pending_serials = [{'serial': row[0], 'pdi': row[1], 'binning': row[2]} for row in result.fetchall()]
            
            # Store pending serials by company
            data['pending_serials'][company_name] = pending_serials
            
            company_data = {
                'id': company_id,
                'name': company_name,
                'wattage': module_wattage,
                'master_total': master_total,
                'rejected': rejected,
                'ok_total': master_total - rejected,
                'available': available,
                'assigned': assigned,
                'packed': packed,
                'pending_pack': assigned - packed if assigned > packed else 0,
                'binning_breakdown': binning_breakdown,
                'pdi_breakdown': pdi_breakdown,
                'sample_pending_serials': pending_serials[:10]  # First 10 for quick reference
            }
            
            # Fetch external tracking data for this company
            ext_data = get_external_packed_dispatch_data(company_name)
            if ext_data.get('success'):
                company_data['ext_packed'] = ext_data.get('packed_count', 0)
                company_data['ext_dispatched'] = ext_data.get('dispatched_count', 0)
                company_data['ext_pending_dispatch'] = ext_data.get('pending_dispatch', 0)
                data['external_tracking'][company_name] = ext_data
                total_ext_packed += ext_data.get('packed_count', 0)
                total_ext_dispatched += ext_data.get('dispatched_count', 0)
            
            data['companies'].append(company_data)
            total_master += master_total
            total_assigned += assigned
            total_packed += packed
            total_rejected += rejected
        
        data['summary'] = {
            'total_companies': len(companies),
            'total_master_ftr': total_master,
            'total_rejected': total_rejected,
            'total_ok': total_master - total_rejected,
            'total_assigned': total_assigned,
            'total_packed': total_packed,
            'total_available': total_master - total_assigned - total_rejected,
            'total_pending_pack': total_assigned - total_packed,
            # External API data
            'ext_total_packed': total_ext_packed,
            'ext_total_dispatched': total_ext_dispatched,
            'ext_pending_dispatch': total_ext_packed - total_ext_dispatched
        }
        
        return data
        
    except Exception as e:
        print(f"Error getting FTR data: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def create_system_prompt(ftr_data):
    """Create system prompt with FTR data context"""
    
    companies_info = ""
    pending_serials_info = ""
    external_tracking_info = ""
    
    for c in ftr_data['companies']:
        pdi_info = ", ".join([f"{p['pdi']}: {p['count']}" for p in c['pdi_breakdown'][:5]]) if c['pdi_breakdown'] else "None"
        
        # Binning breakdown
        binning_info = ", ".join([f"{b['binning']}: {b['count']}" for b in c.get('binning_breakdown', [])]) if c.get('binning_breakdown') else "No binning data"
        
        # External tracking data
        ext_packed = c.get('ext_packed', 0)
        ext_dispatched = c.get('ext_dispatched', 0)
        ext_pending = c.get('ext_pending_dispatch', 0)
        
        # Add sample pending serials for this company
        sample_serials = c.get('sample_pending_serials', [])
        if sample_serials:
            serial_list = ", ".join([f"{s['serial']}({s.get('binning', '?')})" for s in sample_serials[:5]])
            pending_info = f"Sample Pending Barcodes: {serial_list}{'...' if len(sample_serials) > 5 else ''}"
        else:
            pending_info = "No pending barcodes"
        
        companies_info += f"""
Company: {c['name']} ({c['wattage']})
- Master FTR Total: {c['master_total']:,}
- ❌ REJECTED (Do NOT Pack): {c.get('rejected', 0):,}
- ✅ OK Modules: {c.get('ok_total', c['master_total']):,}
- Available (Not Assigned): {c['available']:,}
- Assigned to PDI: {c['assigned']:,}
- 📦 ACTUALLY PACKED (Real-time from MRP): {ext_packed:,}
- 🚚 DISPATCHED (Real-time from MRP): {ext_dispatched:,}
- ⏳ PENDING DISPATCH (Packed but not sent): {ext_pending:,}
- 📊 BINNING Breakdown: {binning_info}
- PDI Breakdown: {pdi_info}
- {pending_info}
"""
    
    # Create detailed pending serials section with binning
    for company_name, serials in ftr_data.get('pending_serials', {}).items():
        if serials:
            pending_serials_info += f"\n{company_name} - Pending Barcodes to Pack:\n"
            # Group by Binning first, then PDI
            binning_groups = {}
            for s in serials:
                binning = s.get('binning') or 'Unknown'
                pdi = s['pdi'] or 'Unknown'
                key = f"{binning}"
                if key not in binning_groups:
                    binning_groups[key] = {'serials': [], 'pdi': pdi}
                binning_groups[key]['serials'].append(s['serial'])
            
            for binning, data in binning_groups.items():
                serial_list = data['serials']
                pending_serials_info += f"  [{binning}]: {', '.join(serial_list[:10])}{'...' if len(serial_list) > 10 else ''} ({len(serial_list)} total)\n"
    
    # External tracking summary
    for company_name, ext_data in ftr_data.get('external_tracking', {}).items():
        if ext_data.get('success'):
            external_tracking_info += f"\n{company_name} (From MRP System):\n"
            external_tracking_info += f"  📦 Packed: {ext_data.get('packed_count', 0):,}\n"
            external_tracking_info += f"  🚚 Dispatched: {ext_data.get('dispatched_count', 0):,}\n"
            external_tracking_info += f"  ⏳ Pending Dispatch: {ext_data.get('pending_dispatch', 0):,}\n"
    
    summary = ftr_data['summary']
    
    system_prompt = f"""You are an AI assistant for FTR (Final Test Report) Management System at a solar panel manufacturing company.

CURRENT DATA (Real-time from database + MRP System):

=== OVERALL SUMMARY ===
Total Companies: {summary['total_companies']}
Total Master FTR: {summary['total_master_ftr']:,}
❌ Total REJECTED: {summary.get('total_rejected', 0):,} (NEVER PACK THESE!)
✅ Total OK: {summary.get('total_ok', summary['total_master_ftr']):,}
Total Assigned to PDI: {summary['total_assigned']:,}

=== REAL-TIME PRODUCTION STATUS (From MRP System) ===
📦 Total Actually PACKED: {summary.get('ext_total_packed', 0):,}
🚚 Total DISPATCHED: {summary.get('ext_total_dispatched', 0):,}
⏳ PENDING DISPATCH (Packed but not sent): {summary.get('ext_pending_dispatch', 0):,}

=== COMPANY-WISE DATA ===
{companies_info}

=== EXTERNAL TRACKING (Real-time from MRP) ===
{external_tracking_info if external_tracking_info else "No external tracking data available."}

=== PENDING BARCODES TO PACK (Sample) ===
{pending_serials_info if pending_serials_info else "No pending barcodes found."}

INSTRUCTIONS:
1. Answer questions about FTR, production, packing, and dispatch status
2. Use the above real data to answer accurately - PACKED and DISPATCHED data is REAL-TIME from MRP system
3. If asked about a specific company, provide detailed info including packed/dispatch status
4. Be helpful and concise
5. Use numbers with commas for readability
6. If data is 0 or not available, mention that clearly
7. Respond in Hindi-English mix (Hinglish) if user asks in Hindi
8. Always be accurate - don't make up numbers
9. When asked "konse barcode pack karne hai" or "which barcodes to pack", show the PENDING BARCODES list with BINNING
10. If user asks for specific barcode numbers, provide from the pending list above
11. ⚠️ CRITICAL: REJECTED modules should NEVER be packed! Always warn if someone asks about rejected barcodes
12. When giving pending barcodes, always mention their BINNING (I1, I2, I3) so correct binning can be packed
13. If asked "kitna aur banana hai", show pending count with BINNING breakdown
14. When asked about dispatch status, use the REAL-TIME data from MRP system
15. "Pending Dispatch" means modules are packed but not yet sent to customer

TERMINOLOGY:
- Master FTR = Total serial numbers uploaded for a company
- Assigned = Serial numbers given to specific PDI orders
- Packed = Actually packed modules (from MRP system - real production data)
- Dispatched = Modules sent to customer (from MRP system)
- Pending Dispatch = Packed but not yet dispatched
- Available = Master FTR minus Assigned (can be used for new PDIs)
- Pending Pack = Assigned but not yet packed (THESE BARCODES NEED TO BE PACKED)
- REJECTED = Failed modules that should NEVER be packed ❌
- Binning = Current classification (I1, I2, I3) - Pack according to binning only!
- I1, I2, I3 = Different current bins - modules must be packed matching their bin
"""
    
    return system_prompt

def query_groq(user_message, ftr_data):
    """Query Groq API with FTR context"""
    
    if not GROQ_API_KEY:
        return {
            'success': False,
            'error': 'Groq API key not configured. Please set GROQ_API_KEY environment variable.'
        }
    
    system_prompt = create_system_prompt(ftr_data)
    
    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.1-8b-instant',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_message}
                ],
                'temperature': 0.3,
                'max_tokens': 1000
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result['choices'][0]['message']['content']
            return {
                'success': True,
                'response': ai_response
            }
        else:
            return {
                'success': False,
                'error': f'Groq API error: {response.status_code} - {response.text}'
            }
            
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': 'Request timeout. Please try again.'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@ai_assistant_bp.route('/ai/chat', methods=['POST'])
def ai_chat():
    """Main AI chat endpoint"""
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({'success': False, 'error': 'Message is required'}), 400
        
        # Get fresh FTR data
        ftr_data = get_all_ftr_data()
        
        if not ftr_data:
            return jsonify({
                'success': False,
                'error': 'Failed to fetch FTR data from database'
            }), 500
        
        # Query Groq AI
        result = query_groq(user_message, ftr_data)
        
        if result['success']:
            return jsonify({
                'success': True,
                'response': result['response'],
                'data_summary': ftr_data['summary']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
            
    except Exception as e:
        print(f"AI Chat Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@ai_assistant_bp.route('/ai/data', methods=['GET'])
def get_ai_data():
    """Get raw FTR data for display"""
    try:
        ftr_data = get_all_ftr_data()
        if ftr_data:
            return jsonify({'success': True, 'data': ftr_data})
        else:
            return jsonify({'success': False, 'error': 'Failed to fetch data'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@ai_assistant_bp.route('/ai/config', methods=['POST'])
def set_api_key():
    """Set Groq API key (for runtime configuration)"""
    global GROQ_API_KEY
    try:
        data = request.json
        api_key = data.get('api_key', '').strip()
        
        if not api_key:
            return jsonify({'success': False, 'error': 'API key is required'}), 400
        
        GROQ_API_KEY = api_key
        
        return jsonify({
            'success': True,
            'message': 'API key configured successfully'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@ai_assistant_bp.route('/ai/config', methods=['GET'])
def get_config_status():
    """Check if API key is configured"""
    return jsonify({
        'success': True,
        'configured': bool(GROQ_API_KEY),
        'key_preview': f"{GROQ_API_KEY[:8]}..." if GROQ_API_KEY else None
    })

@ai_assistant_bp.route('/ai/pending-barcodes', methods=['GET'])
def get_pending_barcodes():
    """Get list of pending barcodes (assigned but not packed)"""
    try:
        company_id = request.args.get('company_id')
        pdi_number = request.args.get('pdi_number')
        limit = request.args.get('limit', 100, type=int)
        
        query = """
            SELECT m.serial_number, m.pdi_number, c.company_name
            FROM ftr_master_serials m
            JOIN companies c ON m.company_id = c.id
            LEFT JOIN ftr_packed_modules p ON m.serial_number = p.serial_number AND m.company_id = p.company_id
            WHERE m.status = 'assigned' AND p.id IS NULL
        """
        params = {}
        
        if company_id:
            query += " AND m.company_id = :company_id"
            params['company_id'] = company_id
        
        if pdi_number:
            query += " AND m.pdi_number = :pdi_number"
            params['pdi_number'] = pdi_number
        
        query += " ORDER BY m.company_id, m.pdi_number, m.serial_number LIMIT :limit"
        params['limit'] = limit
        
        result = db.session.execute(text(query), params)
        pending = [{'serial': row[0], 'pdi': row[1], 'company': row[2]} for row in result.fetchall()]
        
        # Get total count
        count_query = """
            SELECT COUNT(*)
            FROM ftr_master_serials m
            LEFT JOIN ftr_packed_modules p ON m.serial_number = p.serial_number AND m.company_id = p.company_id
            WHERE m.status = 'assigned' AND p.id IS NULL
        """
        if company_id:
            count_query += f" AND m.company_id = {company_id}"
        if pdi_number:
            count_query += f" AND m.pdi_number = '{pdi_number}'"
        
        count_result = db.session.execute(text(count_query))
        total_count = count_result.fetchone()[0]
        
        return jsonify({
            'success': True,
            'pending_barcodes': pending,
            'total_pending': total_count,
            'showing': len(pending)
        })
        
    except Exception as e:
        print(f"Error getting pending barcodes: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@ai_assistant_bp.route('/ai/tracking', methods=['POST'])
def get_tracking_data():
    """Get real-time packed/dispatch tracking from external MRP API"""
    try:
        data = request.json
        party_name = data.get('party_name', '').strip()
        
        if not party_name:
            return jsonify({'success': False, 'error': 'Party name is required'}), 400
        
        result = get_external_packed_dispatch_data(party_name)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@ai_assistant_bp.route('/ai/tracking/all', methods=['GET'])
def get_all_tracking_data():
    """Get tracking data for all companies"""
    try:
        # Get all company names
        result = db.session.execute(text("SELECT company_name FROM companies"))
        companies = [row[0] for row in result.fetchall()]
        
        tracking_data = {}
        total_packed = 0
        total_dispatched = 0
        
        for company_name in companies:
            ext_data = get_external_packed_dispatch_data(company_name)
            if ext_data.get('success'):
                tracking_data[company_name] = {
                    'packed': ext_data.get('packed_count', 0),
                    'dispatched': ext_data.get('dispatched_count', 0),
                    'pending_dispatch': ext_data.get('pending_dispatch', 0)
                }
                total_packed += ext_data.get('packed_count', 0)
                total_dispatched += ext_data.get('dispatched_count', 0)
        
        return jsonify({
            'success': True,
            'companies': tracking_data,
            'summary': {
                'total_packed': total_packed,
                'total_dispatched': total_dispatched,
                'total_pending_dispatch': total_packed - total_dispatched
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
