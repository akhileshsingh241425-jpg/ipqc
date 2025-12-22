from flask import Blueprint, request, jsonify
from app.models.database import db
from sqlalchemy import text
from datetime import datetime

ftr_management_bp = Blueprint('ftr_management', __name__)

@ftr_management_bp.route('/ftr/company/<int:company_id>', methods=['GET'])
def get_company_ftr(company_id):
    """Get FTR data for a specific company"""
    try:
        # Check and create tables if they don't exist
        with db.engine.connect() as conn:
            # Create ftr_master_serials table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ftr_master_serials (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    serial_number VARCHAR(100) NOT NULL,
                    status ENUM('available', 'assigned', 'used') DEFAULT 'available',
                    pdi_number VARCHAR(50) DEFAULT NULL,
                    upload_date DATETIME NOT NULL,
                    assigned_date DATETIME DEFAULT NULL,
                    file_name VARCHAR(255) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_serial (company_id, serial_number),
                    INDEX idx_company_status (company_id, status),
                    INDEX idx_pdi (pdi_number)
                )
            """))
            
            # Create ftr_packed_modules table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ftr_packed_modules (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    serial_number VARCHAR(100) NOT NULL,
                    packed_date DATETIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_packed (company_id, serial_number),
                    INDEX idx_company (company_id)
                )
            """))
            conn.commit()
        
        # Get master FTR count
        result = db.session.execute(text("""
            SELECT COUNT(*) as count 
            FROM ftr_master_serials 
            WHERE company_id = :company_id AND status = 'available'
        """), {'company_id': company_id})
        master_result = result.fetchone()
        master_count = master_result[0] if master_result else 0
        master_count = master_result[0] if master_result else 0
        
        # Get PDI assignments
        result = db.session.execute(text("""
            SELECT pdi_number, COUNT(*) as count, MIN(assigned_date) as date
            FROM ftr_master_serials
            WHERE company_id = :company_id AND status = 'assigned'
            GROUP BY pdi_number
            ORDER BY date DESC
        """), {'company_id': company_id})
        pdi_assignments = [{'pdi_number': row[0], 'count': row[1], 'date': row[2]} for row in result.fetchall()]
        
        # Get total assigned count
        total_assigned = sum(p['count'] for p in pdi_assignments)
        
        # Get packed modules count
        result = db.session.execute(text("""
            SELECT COUNT(*) as count 
            FROM ftr_packed_modules 
            WHERE company_id = :company_id
        """), {'company_id': company_id})
        packed_result = result.fetchone()
        packed_count = packed_result[0] if packed_result else 0
        
        return jsonify({
            'success': True,
            'master_count': master_count,
            'total_assigned': total_assigned,
            'packed_count': packed_count,
            'pdi_assignments': pdi_assignments
        })
        
    except Exception as e:
        print(f"Error getting FTR data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@ftr_management_bp.route('/ftr/master', methods=['POST'])
def upload_master_ftr():
    """Upload master FTR serial numbers"""
    try:
        data = request.json
        company_id = data.get('company_id')
        serial_numbers = data.get('serial_numbers', [])
        file_name = data.get('file_name', 'unknown')
        
        if not company_id or not serial_numbers:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        # Insert serial numbers
        upload_date = datetime.now()
        for sn in serial_numbers:
            db.session.execute(text("""
                INSERT IGNORE INTO ftr_master_serials 
                (company_id, serial_number, status, upload_date, file_name)
                VALUES (:company_id, :serial_number, 'available', :upload_date, :file_name)
            """), {
                'company_id': company_id,
                'serial_number': sn,
                'upload_date': upload_date,
                'file_name': file_name
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{len(serial_numbers)} serial numbers uploaded',
            'count': len(serial_numbers)
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error uploading master FTR: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@ftr_management_bp.route('/ftr/assign', methods=['POST'])
def assign_serials_to_pdi():
    """Assign serial numbers to a PDI"""
    try:
        data = request.json
        company_id = data.get('company_id')
        pdi_number = data.get('pdi_number')
        count = data.get('count', 0)
        
        if not company_id or not pdi_number or count <= 0:
            return jsonify({'success': False, 'message': 'Invalid request'}), 400
        
        # Get available serials
        result = db.session.execute(text("""
            SELECT id, serial_number 
            FROM ftr_master_serials 
            WHERE company_id = :company_id AND status = 'available'
            ORDER BY upload_date ASC
            LIMIT :count
        """), {'company_id': company_id, 'count': count})
        
        available = result.fetchall()
        
        if len(available) < count:
            return jsonify({
                'success': False,
                'message': f'Only {len(available)} serials available, but {count} requested'
            }), 400
        
        # Update status to assigned
        assigned_date = datetime.now()
        for row in available:
            db.session.execute(text("""
                UPDATE ftr_master_serials 
                SET status = 'assigned', pdi_number = :pdi_number, assigned_date = :assigned_date
                WHERE id = :id
            """), {'pdi_number': pdi_number, 'assigned_date': assigned_date, 'id': row[0]})
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{count} serials assigned to {pdi_number}'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error assigning serials: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@ftr_management_bp.route('/ftr/assign-excel', methods=['POST'])
def assign_serials_excel():
    """Assign specific serial numbers from Excel to a PDI"""
    try:
        data = request.json
        company_id = data.get('company_id')
        pdi_number = data.get('pdi_number')
        serial_numbers = data.get('serial_numbers', [])
        
        if not company_id or not pdi_number or not serial_numbers:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        assigned_count = 0
        assigned_date = datetime.now()
        
        for sn in serial_numbers:
            # Check if serial exists in master and is available
            result = db.session.execute(text("""
                SELECT id FROM ftr_master_serials 
                WHERE company_id = :company_id 
                AND serial_number = :serial_number 
                AND status = 'available'
            """), {'company_id': company_id, 'serial_number': sn})
            
            serial_row = result.fetchone()
            if serial_row:
                # Update to assigned
                db.session.execute(text("""
                    UPDATE ftr_master_serials 
                    SET status = 'assigned', pdi_number = :pdi_number, assigned_date = :assigned_date
                    WHERE id = :id
                """), {'pdi_number': pdi_number, 'assigned_date': assigned_date, 'id': serial_row[0]})
                assigned_count += 1
        
        db.session.commit()
        
        if assigned_count == 0:
            return jsonify({
                'success': False,
                'message': 'No matching available serial numbers found'
            }), 400
        
        return jsonify({
            'success': True,
            'message': f'{assigned_count} barcodes assigned to {pdi_number}',
            'assigned_count': assigned_count
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error assigning serials from Excel: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@ftr_management_bp.route('/ftr/packed', methods=['POST'])
def upload_packed_modules():
    """Upload actual packed module serial numbers"""
    try:
        data = request.json
        company_id = data.get('company_id')
        serial_numbers = data.get('serial_numbers', [])
        
        if not company_id or not serial_numbers:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        # Insert packed modules
        packed_date = datetime.now()
        for sn in serial_numbers:
            db.session.execute(text("""
                INSERT IGNORE INTO ftr_packed_modules 
                (company_id, serial_number, packed_date)
                VALUES (:company_id, :serial_number, :packed_date)
            """), {
                'company_id': company_id,
                'serial_number': sn,
                'packed_date': packed_date
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{len(serial_numbers)} packed modules uploaded'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error uploading packed modules: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500
