"""
Production COC Validation Routes - Check material availability before production
"""
from flask import Blueprint, request, jsonify
from app.services.coc_service import COCService
from app.models.database import db, Company
from sqlalchemy import text

production_validation_bp = Blueprint('production_validation', __name__)

@production_validation_bp.route('/api/production/validate-materials', methods=['POST'])
def validate_materials_for_production():
    """
    Validate if sufficient COC materials available for production
    Returns warnings if materials not available
    """
    try:
        data = request.get_json()
        company_id = data.get('company_id')
        day_production = int(data.get('day_production', 0))
        night_production = int(data.get('night_production', 0))
        
        total_production = day_production + night_production
        
        if total_production == 0:
            return jsonify({
                'success': True,
                'valid': True,
                'message': 'No production quantity entered'
            })
        
        # Get company details
        company = Company.query.get(company_id)
        if not company:
            return jsonify({'error': 'Company not found'}), 404
        
        # Calculate material requirements
        material_requirements = {
            'Solar Cell': total_production * company.cells_per_module,
            'Glass': total_production * 2,
            'Aluminium Frame': total_production * 4,
            'Ribbon': total_production * 0.5,
            'EVA': total_production * 2,
            'EPE': total_production * 2
        }
        
        # Get current stock for each material
        stock_details = []
        warnings = []
        has_insufficient = False
        
        for material_name, required_qty in material_requirements.items():
            query = text("""
                SELECT 
                    SUM(available_qty) as available,
                    SUM(coc_qty) as total_received,
                    SUM(consumed_qty) as total_consumed,
                    COUNT(*) as coc_count
                FROM coc_documents
                WHERE material_name = :material
                AND is_active = 1
                AND available_qty > 0
            """)
            
            result = db.session.execute(query, {'material': material_name}).fetchone()
            
            available = float(result[0]) if result[0] else 0
            total_received = float(result[1]) if result[1] else 0
            total_consumed = float(result[2]) if result[2] else 0
            coc_count = int(result[3]) if result[3] else 0
            
            is_sufficient = available >= required_qty
            
            material_info = {
                'material': material_name,
                'required': required_qty,
                'available': available,
                'total_received': total_received,
                'total_consumed': total_consumed,
                'remaining_after': available - required_qty if is_sufficient else 0,
                'coc_count': coc_count,
                'is_sufficient': is_sufficient,
                'shortage': required_qty - available if not is_sufficient else 0
            }
            
            stock_details.append(material_info)
            
            if not is_sufficient:
                has_insufficient = True
                if coc_count == 0:
                    warnings.append({
                        'type': 'NO_COC',
                        'material': material_name,
                        'message': f'⚠️ No COC available for {material_name}. Please add COC first!'
                    })
                else:
                    warnings.append({
                        'type': 'INSUFFICIENT',
                        'material': material_name,
                        'message': f'⚠️ Insufficient {material_name}: Need {required_qty:,.0f}, Only {available:,.0f} available (Shortage: {required_qty - available:,.0f})'
                    })
        
        return jsonify({
            'success': True,
            'valid': not has_insufficient,
            'can_proceed': not has_insufficient,
            'total_production': total_production,
            'materials': stock_details,
            'warnings': warnings,
            'message': 'All materials available' if not has_insufficient else f'{len(warnings)} material(s) unavailable or insufficient'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@production_validation_bp.route('/api/production/material-summary', methods=['GET'])
def get_material_consumption_summary():
    """
    Get material consumption summary for a production record
    """
    try:
        record_id = request.args.get('record_id')
        
        if not record_id:
            return jsonify({'error': 'record_id required'}), 400
        
        query = text("""
            SELECT 
                mc.material_type,
                mc.consumed_quantity,
                mc.lot_number,
                cd.invoice_no,
                cd.brand,
                mc.production_date
            FROM material_consumption mc
            LEFT JOIN coc_documents cd ON mc.coc_id = cd.id
            WHERE mc.production_date = (
                SELECT date FROM production_records WHERE id = :record_id
            )
            ORDER BY mc.material_type, mc.id
        """)
        
        result = db.session.execute(query, {'record_id': record_id}).fetchall()
        
        consumption_data = []
        for row in result:
            consumption_data.append({
                'material': row[0],
                'consumed': float(row[1]),
                'lot': row[2],
                'invoice': row[3],
                'brand': row[4],
                'date': str(row[5])
            })
        
        return jsonify({
            'success': True,
            'data': consumption_data
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
