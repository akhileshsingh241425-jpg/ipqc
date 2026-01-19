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
            # Create ftr_master_serials table with binning and rejection
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ftr_master_serials (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    serial_number VARCHAR(100) NOT NULL,
                    pmax DECIMAL(10,3) DEFAULT NULL,
                    binning VARCHAR(20) DEFAULT NULL,
                    class_status VARCHAR(20) DEFAULT 'OK',
                    status ENUM('available', 'assigned', 'used') DEFAULT 'available',
                    pdi_number VARCHAR(50) DEFAULT NULL,
                    upload_date DATETIME NOT NULL,
                    assigned_date DATETIME DEFAULT NULL,
                    file_name VARCHAR(255) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_serial (company_id, serial_number),
                    INDEX idx_company_status (company_id, status),
                    INDEX idx_pdi (pdi_number),
                    INDEX idx_binning (binning),
                    INDEX idx_class (class_status)
                )
            """))
            
            # Add new columns if they don't exist
            try:
                conn.execute(text("ALTER TABLE ftr_master_serials ADD COLUMN pmax DECIMAL(10,3) DEFAULT NULL"))
            except:
                pass
            try:
                conn.execute(text("ALTER TABLE ftr_master_serials ADD COLUMN binning VARCHAR(20) DEFAULT NULL"))
            except:
                pass
            try:
                conn.execute(text("ALTER TABLE ftr_master_serials ADD COLUMN class_status VARCHAR(20) DEFAULT 'OK'"))
            except:
                pass
            
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
        
        # Get TOTAL master FTR count (ALL records for this company, excluding rejected)
        result = db.session.execute(text("""
            SELECT COUNT(*) as count 
            FROM ftr_master_serials 
            WHERE company_id = :company_id AND (class_status = 'OK' OR class_status IS NULL)
        """), {'company_id': company_id})
        master_result = result.fetchone()
        master_count = master_result[0] if master_result else 0
        
        # Get available count (not assigned, OK only)
        result = db.session.execute(text("""
            SELECT COUNT(*) as count 
            FROM ftr_master_serials 
            WHERE company_id = :company_id AND status = 'available' AND (class_status = 'OK' OR class_status IS NULL)
        """), {'company_id': company_id})
        available_result = result.fetchone()
        available_count = available_result[0] if available_result else 0
        
        # Get rejected count
        result = db.session.execute(text("""
            SELECT COUNT(*) as count 
            FROM ftr_master_serials 
            WHERE company_id = :company_id AND class_status = 'REJECTED'
        """), {'company_id': company_id})
        rejected_result = result.fetchone()
        rejected_count = rejected_result[0] if rejected_result else 0
        
        # Get binning breakdown
        result = db.session.execute(text("""
            SELECT binning, COUNT(*) as count 
            FROM ftr_master_serials 
            WHERE company_id = :company_id AND (class_status = 'OK' OR class_status IS NULL)
            GROUP BY binning
            ORDER BY binning
        """), {'company_id': company_id})
        binning_breakdown = [{'binning': row[0] or 'Unknown', 'count': row[1]} for row in result.fetchall()]
        
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
            'available_count': available_count,
            'rejected_count': rejected_count,
            'binning_breakdown': binning_breakdown,
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
    """Upload master FTR serial numbers with binning and class data"""
    try:
        data = request.json
        company_id = data.get('company_id')
        serial_numbers = data.get('serial_numbers', [])  # Can be list of strings or list of objects
        file_name = data.get('file_name', 'unknown')
        
        if not company_id or not serial_numbers:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        # Insert serial numbers
        upload_date = datetime.now()
        ok_count = 0
        rejected_count = 0
        
        for sn in serial_numbers:
            # Handle both simple string and object with details
            if isinstance(sn, dict):
                serial = sn.get('serial_number') or sn.get('id') or sn.get('ID')
                pmax = sn.get('pmax') or sn.get('Pmax')
                binning = sn.get('binning') or sn.get('Binning')
                class_status = sn.get('class_status') or sn.get('Class') or 'OK'
            else:
                serial = sn
                pmax = None
                binning = None
                class_status = 'OK'
            
            if not serial:
                continue
                
            # Normalize class_status
            class_status = str(class_status).upper().strip()
            if class_status in ['REJECTED', 'REJECT', 'REJ', 'NG', 'FAIL']:
                class_status = 'REJECTED'
                rejected_count += 1
            else:
                class_status = 'OK'
                ok_count += 1
            
            db.session.execute(text("""
                INSERT INTO ftr_master_serials 
                (company_id, serial_number, pmax, binning, class_status, status, upload_date, file_name)
                VALUES (:company_id, :serial_number, :pmax, :binning, :class_status, 'available', :upload_date, :file_name)
                ON DUPLICATE KEY UPDATE 
                pmax = VALUES(pmax), binning = VALUES(binning), class_status = VALUES(class_status)
            """), {
                'company_id': company_id,
                'serial_number': serial,
                'pmax': pmax,
                'binning': binning,
                'class_status': class_status,
                'upload_date': upload_date,
                'file_name': file_name
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{len(serial_numbers)} serial numbers uploaded ({ok_count} OK, {rejected_count} Rejected)',
            'count': len(serial_numbers),
            'ok_count': ok_count,
            'rejected_count': rejected_count
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error uploading master FTR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@ftr_management_bp.route('/ftr/rejection', methods=['POST'])
def upload_rejection_data():
    """Upload rejection data separately - marks barcodes as REJECTED"""
    try:
        data = request.json
        company_id = data.get('company_id')
        serial_numbers = data.get('serial_numbers', [])  # List of rejected barcodes
        file_name = data.get('file_name', 'rejection_upload')
        
        if not company_id or not serial_numbers:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        updated_count = 0
        not_found_count = 0
        already_rejected = 0
        
        for sn in serial_numbers:
            # Handle both simple string and object
            if isinstance(sn, dict):
                serial = sn.get('serial_number') or sn.get('id') or sn.get('ID') or sn.get('barcode') or sn.get('Barcode')
            else:
                serial = sn
            
            if not serial:
                continue
            
            serial = str(serial).strip()
            
            # Check if barcode exists
            result = db.session.execute(text("""
                SELECT id, class_status FROM ftr_master_serials 
                WHERE company_id = :company_id AND serial_number = :serial_number
            """), {'company_id': company_id, 'serial_number': serial})
            
            existing = result.fetchone()
            
            if existing:
                if existing[1] == 'REJECTED':
                    already_rejected += 1
                else:
                    # Update to REJECTED
                    db.session.execute(text("""
                        UPDATE ftr_master_serials 
                        SET class_status = 'REJECTED'
                        WHERE company_id = :company_id AND serial_number = :serial_number
                    """), {'company_id': company_id, 'serial_number': serial})
                    updated_count += 1
            else:
                # Barcode not found in master - insert as REJECTED
                db.session.execute(text("""
                    INSERT INTO ftr_master_serials 
                    (company_id, serial_number, class_status, status, upload_date, file_name)
                    VALUES (:company_id, :serial_number, 'REJECTED', 'available', NOW(), :file_name)
                """), {'company_id': company_id, 'serial_number': serial, 'file_name': file_name})
                not_found_count += 1
                updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{updated_count} barcodes marked as REJECTED',
            'updated_count': updated_count,
            'already_rejected': already_rejected,
            'new_entries': not_found_count
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error uploading rejection data: {str(e)}")
        import traceback
        traceback.print_exc()
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


@ftr_management_bp.route('/ftr/master-serials/<int:company_id>', methods=['GET'])
def get_master_serials(company_id):
    """Get all master FTR serial numbers for a company with search"""
    try:
        search = request.args.get('search', '').strip()
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 100))

        base_query = "FROM ftr_master_serials WHERE company_id = :company_id"
        params = {'company_id': company_id}
        if search:
            base_query += " AND serial_number LIKE :search"
            params['search'] = f'%{search}%'

        # Get total count
        count_result = db.session.execute(text(f"SELECT COUNT(*) {base_query}"), params)
        total = count_result.scalar() or 0

        # Get paginated data
        offset = (page - 1) * page_size
        data_query = f"SELECT serial_number, pmax, binning, class_status, status, pdi_number, upload_date, file_name {base_query} ORDER BY upload_date DESC LIMIT :limit OFFSET :offset"
        params.update({'limit': page_size, 'offset': offset})
        result = db.session.execute(text(data_query), params).fetchall()

        serials = []
        for row in result:
            serials.append({
                'serial_number': row[0],
                'pmax': float(row[1]) if row[1] else None,
                'binning': row[2],
                'class_status': row[3],
                'status': row[4],
                'pdi_number': row[5],
                'upload_date': row[6].strftime('%Y-%m-%d %H:%M:%S') if row[6] else None,
                'file_name': row[7]
            })

        return jsonify({
            'success': True,
            'serials': serials,
            'total': total,
            'page': page,
            'page_size': page_size
        })
        
    except Exception as e:
        print(f"Error fetching master serials: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@ftr_management_bp.route('/ftr/rejection-serials/<int:company_id>', methods=['GET'])
def get_rejection_serials(company_id):
    """Get all rejection serial numbers for a company with search"""
    try:
        search = request.args.get('search', '').strip()
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 100))

        base_query = "FROM ftr_master_serials WHERE company_id = :company_id AND class_status IN ('REJECTED', 'REJECT', 'REJ', 'NG', 'FAIL')"
        params = {'company_id': company_id}
        if search:
            base_query += " AND serial_number LIKE :search"
            params['search'] = f'%{search}%'

        # Get total count
        count_result = db.session.execute(text(f"SELECT COUNT(*) {base_query}"), params)
        total = count_result.scalar() or 0

        # Get paginated data
        offset = (page - 1) * page_size
        data_query = f"SELECT serial_number, pmax, binning, class_status, status, pdi_number, upload_date, file_name {base_query} ORDER BY upload_date DESC LIMIT :limit OFFSET :offset"
        params.update({'limit': page_size, 'offset': offset})
        result = db.session.execute(text(data_query), params).fetchall()

        serials = []
        for row in result:
            serials.append({
                'serial_number': row[0],
                'pmax': float(row[1]) if row[1] else None,
                'binning': row[2],
                'class_status': row[3],
                'status': row[4],
                'pdi_number': row[5],
                'upload_date': row[6].strftime('%Y-%m-%d %H:%M:%S') if row[6] else None,
                'file_name': row[7]
            })

        return jsonify({
            'success': True,
            'serials': serials,
            'total': total,
            'page': page,
            'page_size': page_size
        })
        
    except Exception as e:
        print(f"Error fetching rejection serials: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


@ftr_management_bp.route('/ftr/pdi-serials/<int:company_id>/<pdi_number>', methods=['GET'])
def get_pdi_serials(company_id, pdi_number):
    """Get all serial numbers assigned to a specific PDI with pagination"""
    try:
        search = request.args.get('search', '').strip()
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 100))

        base_query = "FROM ftr_master_serials WHERE company_id = :company_id AND pdi_number = :pdi_number"
        params = {'company_id': company_id, 'pdi_number': pdi_number}
        if search:
            base_query += " AND serial_number LIKE :search"
            params['search'] = f'%{search}%'

        # Get total count
        count_result = db.session.execute(text(f"SELECT COUNT(*) {base_query}"), params)
        total = count_result.scalar() or 0

        # Get paginated data
        offset = (page - 1) * page_size
        data_query = f"SELECT serial_number, pmax, binning, class_status, status, pdi_number, upload_date, assigned_date {base_query} ORDER BY assigned_date DESC LIMIT :limit OFFSET :offset"
        params.update({'limit': page_size, 'offset': offset})
        result = db.session.execute(text(data_query), params).fetchall()

        serials = []
        for row in result:
            serials.append({
                'serial_number': row[0],
                'pmax': float(row[1]) if row[1] else None,
                'binning': row[2],
                'class_status': row[3],
                'status': row[4],
                'pdi_number': row[5],
                'upload_date': row[6].strftime('%Y-%m-%d %H:%M:%S') if row[6] else None,
                'assigned_date': row[7].strftime('%Y-%m-%d %H:%M:%S') if row[7] else None
            })

        return jsonify({
            'success': True,
            'serials': serials,
            'total': total,
            'page': page,
            'page_size': page_size,
            'pdi_number': pdi_number
        })
        
    except Exception as e:
        print(f"Error fetching PDI serials: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500
