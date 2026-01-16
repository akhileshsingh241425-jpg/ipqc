"""
COC Management Routes - Track COC usage per PDI and provide FIFO suggestions
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app.models.database import db
from app.models.coc_tracking import COCUsageTracking
from app.models.database import ProductionRecord, Company
import requests

coc_mgmt_bp = Blueprint('coc_management', __name__)

COC_API_URL = 'https://umanmrp.in/api/coc_api.php'


@coc_mgmt_bp.route('/api/coc-management/usage-by-pdi', methods=['GET'])
def get_coc_usage_by_pdi():
    """Get COC usage grouped by PDI"""
    try:
        company_id = request.args.get('company_id', type=int)
        
        query = db.session.query(COCUsageTracking)
        if company_id:
            query = query.filter_by(company_id=company_id)
        
        usages = query.order_by(COCUsageTracking.usage_date.desc()).all()
        
        # Group by PDI
        pdi_groups = {}
        for usage in usages:
            pdi = usage.pdi_number or 'No PDI'
            if pdi not in pdi_groups:
                pdi_groups[pdi] = {
                    'pdiNumber': pdi,
                    'materials': [],
                    'totalCocs': 0,
                    'usageDate': usage.usage_date
                }
            
            pdi_groups[pdi]['materials'].append(usage.to_dict())
            pdi_groups[pdi]['totalCocs'] += 1
        
        result = list(pdi_groups.values())
        result.sort(key=lambda x: x['usageDate'] if x['usageDate'] else datetime.min, reverse=True)
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@coc_mgmt_bp.route('/api/coc-management/fifo-suggestions', methods=['POST'])
def get_fifo_suggestions():
    """
    Get FIFO-based COC suggestions for materials
    Request body: {
        "company_id": 1,
        "pdi_number": "PDI-2025-001", 
        "material_names": ["Solar Cell", "EVA", "Glass"],
        "shift": "day"
    }
    """
    try:
        data = request.get_json()
        company_id = data.get('company_id')
        pdi_number = data.get('pdi_number', '')  # PDI number for filtering
        material_names = data.get('material_names', [])
        shift = data.get('shift', 'day')
        
        # Get company name from database
        from app.models.database import Company
        company = Company.query.get(company_id)
        if not company:
            return jsonify({'success': False, 'error': 'Company not found'}), 404
        
        company_name = company.companyName.strip()
        
        # Company name mapping for API matching (API uses assigned_to field)
        COMPANY_NAME_MAPPING = {
            'Rays Power': 'Rays Power',
            'Larsen & Toubro': 'L&T',
            'Sterlin and Wilson': 'S&W'
        }
        
        # Get API company name
        api_company_name = COMPANY_NAME_MAPPING.get(company_name)
        
        if not api_company_name:
            return jsonify({
                'success': False, 
                'error': f'Company mapping not found for: {company_name}. Available: {list(COMPANY_NAME_MAPPING.keys())}'
            }), 400
        
        # Fetch COC data from API
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        post_data = {'from': from_date, 'to': to_date}
        response = requests.post(COC_API_URL, json=post_data, timeout=10)
        
        if response.status_code != 200:
            return jsonify({'success': False, 'error': 'Failed to fetch COC data'}), 500
        
        coc_data = response.json()
        # API returns array directly
        coc_documents = coc_data if isinstance(coc_data, list) else coc_data.get('data', [])
        
        # Filter COC documents for this company AND PDI
        company_coc_documents = []
        for doc in coc_documents:
            if not isinstance(doc, dict):
                continue
            doc_company = (doc.get('assigned_to', '') or '').strip()
            doc_pdi = (doc.get('pdi_no', '') or '').strip()
            
            # Match both company AND PDI
            company_match = doc_company == api_company_name
            pdi_match = (not pdi_number) or (doc_pdi == pdi_number)  # If no PDI provided, show all
            
            if company_match and pdi_match:
                company_coc_documents.append(doc)
        
        suggestions = {}
        
        for material_name in material_names:
            # Get brands that were previously used for this material in this company
            previously_used_brands = db.session.query(COCUsageTracking.coc_brand)\
                .filter_by(company_id=company_id, material_name=material_name)\
                .distinct()\
                .all()
            
            used_brand_list = [b[0] for b in previously_used_brands if b[0]]
            
            # Filter COCs for this material
            material_cocs_used_brands = []  # COCs from previously used brands
            material_cocs_new_brands = []   # COCs from new brands
            
            for doc in company_coc_documents:
                if not isinstance(doc, dict):
                    continue
                
                doc_material = (doc.get('material_name', '') or '').lower()
                search_material = material_name.lower()
                
                # Material matching logic
                is_match = False
                if search_material in doc_material or doc_material in search_material:
                    is_match = True
                elif 'cell' in search_material and 'cell' in doc_material:
                    is_match = True
                elif 'eva' in search_material and 'eva' in doc_material:
                    is_match = True
                elif 'glass' in search_material and 'glass' in doc_material:
                    is_match = True
                elif 'ribbon' in search_material and 'ribbon' in doc_material:
                    is_match = True
                elif 'frame' in search_material and 'frame' in doc_material:
                    is_match = True
                elif 'jb' in search_material and ('jb' in doc_material or 'junction' in doc_material):
                    is_match = True
                
                if is_match:
                    invoice_no = doc.get('invoice_no', '')
                    lot_batch_no = doc.get('lot_batch_no', '')
                    pdi_no = doc.get('pdi_no', '')
                    remaining_qty = float(doc.get('remaining_qty', 0))
                    
                    # Only show COC if has remaining quantity from API
                    if remaining_qty > 0:
                        # Check if this invoice was previously used by this company
                        previously_used = db.session.query(COCUsageTracking)\
                            .filter_by(
                                company_id=company_id,
                                coc_invoice_number=invoice_no, 
                                material_name=material_name
                            )\
                            .first()
                        
                        coc_item = {
                            'invoiceNo': invoice_no,
                            'lotBatchNo': lot_batch_no,
                            'pdiNo': pdi_no,
                            'materialName': doc.get('material_name', ''),
                            'assignedTo': doc.get('assigned_to', ''),
                            'remainingQty': remaining_qty,
                            'isPreviouslyUsed': previously_used is not None,
                            'fifoRank': invoice_no  # Can use ID or invoice for sorting
                        }
                        
                        # Add to list (prioritize previously used ones)
                        if previously_used:
                            material_cocs_used_brands.append(coc_item)
                        else:
                            material_cocs_new_brands.append(coc_item)
            
            # Sort by invoice number/ID (FIFO)
            material_cocs_used_brands.sort(key=lambda x: x['invoiceNo'])
            material_cocs_new_brands.sort(key=lambda x: x['invoiceNo'])
            
            # Combine: Previously used first, then new ones
            material_cocs = material_cocs_used_brands + material_cocs_new_brands
            
            suggestions[material_name] = {
                'materialName': material_name,
                'availableCocs': material_cocs[:10],  # Top 10 COCs
                'recommendedCoc': material_cocs[0] if material_cocs else None,
                'totalAvailable': len(material_cocs),
                'usedCount': len(material_cocs_used_brands),
                'newCount': len(material_cocs_new_brands)
            }
        
        return jsonify({
            'success': True,
            'shift': shift,
            'suggestions': suggestions
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@coc_mgmt_bp.route('/api/coc-management/record-usage', methods=['POST'])
def record_coc_usage():
    """
    Record COC usage for a material
    Request body: {
        "production_record_id": 123,
        "pdi_number": "PDI-1",
        "company_id": 1,
        "shift": "day",
        "material_name": "Solar Cell",
        "coc_invoice_number": "INV001",
        "coc_brand": "Brand A",
        "coc_qty_used": 100,
        "coc_remaining_gap": 50
    }
    """
    try:
        data = request.get_json()
        
        # Check if already exists - update if yes
        existing = COCUsageTracking.query.filter_by(
            production_record_id=data['production_record_id'],
            shift=data['shift'],
            material_name=data['material_name']
        ).first()
        
        if existing:
            existing.coc_invoice_number = data.get('coc_invoice_number')
            existing.coc_brand = data.get('coc_brand')
            existing.coc_qty_used = data.get('coc_qty_used', 0)
            existing.coc_remaining_gap = data.get('coc_remaining_gap', 0)
            existing.updated_at = datetime.utcnow()
        else:
            usage = COCUsageTracking(
                production_record_id=data['production_record_id'],
                pdi_number=data.get('pdi_number'),
                company_id=data['company_id'],
                shift=data['shift'],
                material_name=data['material_name'],
                coc_invoice_number=data.get('coc_invoice_number'),
                coc_brand=data.get('coc_brand'),
                coc_qty_used=data.get('coc_qty_used', 0),
                coc_remaining_gap=data.get('coc_remaining_gap', 0),
                usage_date=datetime.now().date()
            )
            db.session.add(usage)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'COC usage recorded successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@coc_mgmt_bp.route('/api/coc-management/material-stats', methods=['GET'])
def get_material_stats():
    """Get COC usage statistics by material"""
    try:
        company_id = request.args.get('company_id', type=int)
        
        query = db.session.query(
            COCUsageTracking.material_name,
            db.func.count(db.distinct(COCUsageTracking.coc_invoice_number)).label('unique_cocs'),
            db.func.sum(COCUsageTracking.coc_qty_used).label('total_used')
        )
        
        if company_id:
            query = query.filter_by(company_id=company_id)
        
        stats = query.group_by(COCUsageTracking.material_name).all()
        
        result = [{
            'materialName': stat.material_name,
            'uniqueCocs': stat.unique_cocs,
            'totalUsed': stat.total_used or 0
        } for stat in stats]
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
