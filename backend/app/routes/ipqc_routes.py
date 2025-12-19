"""
IPQC API Routes
"""
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename
import os
import json
import zipfile
from datetime import datetime

from app.services.form_generator import IPQCFormGenerator
from app.services.pdf_generator import IPQCPDFGenerator, SerialNumberGenerator
from app.services.excel_generator import generate_ipqc_excel
from app.models.ipqc_data import BOMData

ipqc_bp = Blueprint('ipqc', __name__)

# Initialize services
form_generator = IPQCFormGenerator()


@ipqc_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "IPQC Automation API is running",
        "timestamp": datetime.now().isoformat()
    })


@ipqc_bp.route('/data', methods=['GET'])
def get_ipqc_data():
    """Get all IPQC data/records"""
    try:
        from app.models.database import db
        from sqlalchemy import text
        
        # Get query parameters
        company_id = request.args.get('company_id')
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        # Build query
        query = "SELECT * FROM production_records WHERE 1=1"
        params = {}
        
        if company_id:
            query += " AND company_id = :company_id"
            params['company_id'] = company_id
        
        if from_date:
            query += " AND production_date >= :from_date"
            params['from_date'] = from_date
        
        if to_date:
            query += " AND production_date <= :to_date"
            params['to_date'] = to_date
        
        query += " ORDER BY production_date DESC LIMIT 100"
        
        result = db.session.execute(text(query), params).fetchall()
        
        # Convert to dict
        data = []
        for row in result:
            data.append(dict(row._mapping))
        
        return jsonify({
            "success": True,
            "data": data,
            "count": len(data)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e),
            "data": []
        }), 200


@ipqc_bp.route('/generate-ipqc', methods=['POST'])
def generate_ipqc():
    """
    Generate IPQC form based on inputs
    
    Expected JSON:
    {
        "date": "2024-01-15",
        "shift": "A",
        "customer_id": "GSPL/IPQC/IPC/003",
        "po_number": "PO12345",
        "serial_start": 10001,
        "module_count": 1
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['date', 'shift', 'customer_id', 'po_number']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "error": f"Missing required field: {field}"
                }), 400
        
        # Extract parameters
        date = data.get('date')
        shift = data.get('shift')
        customer_id = data.get('customer_id')
        po_number = data.get('po_number')
        serial_prefix = data.get('serial_prefix', 'GS04875KG302250')
        serial_start = data.get('serial_start', 1)
        module_count = data.get('module_count', 1)
        cell_manufacturer = data.get('cell_manufacturer', 'Solar Space')
        cell_efficiency = data.get('cell_efficiency', 25.7)
        jb_cable_length = data.get('jb_cable_length', 1200)
        golden_module_number = data.get('golden_module_number', 'GM-2024-001')
        
        # Generate IPQC form
        ipqc_form = form_generator.generate_form(
            date=date,
            shift=shift,
            customer_id=customer_id,
            po_number=po_number,
            serial_prefix=serial_prefix,
            serial_start=serial_start,
            module_count=module_count,
            cell_manufacturer=cell_manufacturer,
            cell_efficiency=cell_efficiency,
            jb_cable_length=jb_cable_length,
            golden_module_number=golden_module_number
        )
        
        return jsonify({
            "success": True,
            "message": "IPQC form generated successfully",
            "data": ipqc_form
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to generate IPQC form"
        }), 500


@ipqc_bp.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    """
    Generate PDF from IPQC form data
    
    Expected JSON:
    {
        "ipqc_data": {...},  // Complete IPQC form data
        "filename": "optional_custom_name.pdf"
    }
    """
    try:
        data = request.get_json()
        
        if 'ipqc_data' not in data:
            return jsonify({
                "error": "Missing ipqc_data in request"
            }), 400
        
        ipqc_data = data['ipqc_data']
        
        # Initialize PDF generator
        pdf_folder = current_app.config['PDF_FOLDER']
        pdf_generator = IPQCPDFGenerator(pdf_folder)
        
        # Generate PDF
        pdf_path = pdf_generator.generate_ipqc_pdf(
            ipqc_data=ipqc_data.get('stages', []),
            bom_data=ipqc_data.get('bom', {}),
            metadata=ipqc_data.get('metadata', {})
        )
        
        # Return PDF file
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=os.path.basename(pdf_path)
        )
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to generate PDF"
        }), 500


@ipqc_bp.route('/generate-pdf-only', methods=['POST'])
def generate_pdf_only():
    """
    Generate IPQC PDF only
    """
    try:
        data = request.get_json()
        
        customer = data.get('customer_id') or data.get('customer') or 'Boeing'
        po_number = data.get('po_number') or f"PO-{data.get('date', '20240115').replace('-', '')}"
        serial_prefix = data.get('serial_prefix', 'GS04875KG302250')
        cell_manufacturer = data.get('cell_manufacturer', 'Solar Space')
        cell_efficiency = data.get('cell_efficiency', 25.7)
        jb_cable_length = data.get('jb_cable_length', 1200)
        golden_module_number = data.get('golden_module_number', 'GM-2024-001')
        
        # Generate IPQC form
        ipqc_form = form_generator.generate_form(
            date=data.get('date'),
            shift=data.get('shift'),
            customer_id=customer,
            po_number=po_number,
            serial_prefix=serial_prefix,
            serial_start=data.get('serial_start', 1),
            module_count=data.get('module_count', 1),
            cell_manufacturer=cell_manufacturer,
            cell_efficiency=cell_efficiency,
            jb_cable_length=jb_cable_length,
            golden_module_number=golden_module_number
        )
        
        # Generate PDF only
        pdf_folder = current_app.config['PDF_FOLDER']
        pdf_generator = IPQCPDFGenerator(pdf_folder)
        
        pdf_path = pdf_generator.generate_ipqc_pdf(
            ipqc_data=ipqc_form.get('stages', []),
            bom_data=ipqc_form.get('bom', {}),
            metadata=ipqc_form.get('metadata', {})
        )
        
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=os.path.basename(pdf_path)
        )
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to generate PDF report"
        }), 500


@ipqc_bp.route('/generate-excel-only', methods=['POST'])
def generate_excel_only():
    """
    Generate IPQC Excel only
    """
    try:
        data = request.get_json()
        
        customer = data.get('customer_id') or data.get('customer') or 'Boeing'
        po_number = data.get('po_number') or f"PO-{data.get('date', '20240115').replace('-', '')}"
        serial_prefix = data.get('serial_prefix', 'GS04875KG302250')
        cell_manufacturer = data.get('cell_manufacturer', 'Solar Space')
        cell_efficiency = data.get('cell_efficiency', 25.7)
        jb_cable_length = data.get('jb_cable_length', 1200)
        golden_module_number = data.get('golden_module_number', 'GM-2024-001')
        
        # Generate IPQC form
        ipqc_form = form_generator.generate_form(
            date=data.get('date'),
            shift=data.get('shift'),
            customer_id=customer,
            po_number=po_number,
            serial_prefix=serial_prefix,
            serial_start=data.get('serial_start', 1),
            module_count=data.get('module_count', 1),
            cell_manufacturer=cell_manufacturer,
            cell_efficiency=cell_efficiency,
            jb_cable_length=jb_cable_length,
            golden_module_number=golden_module_number
        )
        
        # Generate Excel only
        excel_path = generate_ipqc_excel(
            ipqc_data=ipqc_form.get('stages', []),
            bom_data=ipqc_form.get('bom', {}),
            metadata=ipqc_form.get('metadata', {})
        )
        
        return send_file(
            excel_path,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=os.path.basename(excel_path)
        )
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to generate Excel report"
        }), 500


@ipqc_bp.route('/generate-complete', methods=['POST'])
def generate_complete():
    """
    Complete workflow: Generate IPQC form and return ZIP with both PDF and Excel
    
    Expected JSON:
    {
        "date": "2024-01-15",
        "shift": "A",
        "customer_id": "GSPL/IPQC/IPC/003",
        "po_number": "PO12345",
        "serial_start": 10001,
        "module_count": 1
    }
    """
    try:
        data = request.get_json()
        
        # Support both 'customer' and 'customer_id' parameter names
        customer = data.get('customer_id') or data.get('customer') or 'Boeing'
        po_number = data.get('po_number') or f"PO-{data.get('date', '20240115').replace('-', '')}"
        serial_prefix = data.get('serial_prefix', 'GS04875KG302250')
        cell_manufacturer = data.get('cell_manufacturer', 'Solar Space')
        cell_efficiency = data.get('cell_efficiency', 25.7)
        jb_cable_length = data.get('jb_cable_length', 1200)
        golden_module_number = data.get('golden_module_number', 'GM-2024-001')
        
        # Generate IPQC form
        ipqc_form = form_generator.generate_form(
            date=data.get('date'),
            shift=data.get('shift'),
            customer_id=customer,
            po_number=po_number,
            serial_prefix=serial_prefix,
            serial_start=data.get('serial_start', 1),
            module_count=data.get('module_count', 1),
            cell_manufacturer=cell_manufacturer,
            cell_efficiency=cell_efficiency,
            jb_cable_length=jb_cable_length,
            golden_module_number=golden_module_number
        )
        
        # Generate PDF
        pdf_folder = current_app.config['PDF_FOLDER']
        pdf_generator = IPQCPDFGenerator(pdf_folder)
        
        pdf_path = pdf_generator.generate_ipqc_pdf(
            ipqc_data=ipqc_form.get('stages', []),
            bom_data=ipqc_form.get('bom', {}),
            metadata=ipqc_form.get('metadata', {})
        )
        
        # Generate Excel
        excel_path = generate_ipqc_excel(
            ipqc_data=ipqc_form.get('stages', []),
            bom_data=ipqc_form.get('bom', {}),
            metadata=ipqc_form.get('metadata', {})
        )
        
        # Create ZIP file with both PDF and Excel
        zip_filename = f"IPQC_Report_{customer.replace('/', '_')}_{data.get('date', '').replace('-', '')}.zip"
        zip_path = os.path.join(pdf_folder, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(pdf_path, os.path.basename(pdf_path))
            zipf.write(excel_path, os.path.basename(excel_path))
        
        # Return ZIP file
        return send_file(
            zip_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to generate complete IPQC report"
        }), 500


@ipqc_bp.route('/upload-bom', methods=['POST'])
def upload_bom():
    """
    Upload customer BOM data
    
    Expected JSON:
    {
        "customer_id": "CUST001",
        "bom_data": {
            "customer_name": "...",
            "module_type": "...",
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        if 'customer_id' not in data or 'bom_data' not in data:
            return jsonify({
                "error": "Missing customer_id or bom_data"
            }), 400
        
        customer_id = data['customer_id']
        bom_data = data['bom_data']
        
        # Store BOM
        success = form_generator.upload_bom(customer_id, bom_data)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"BOM uploaded successfully for customer: {customer_id}"
            }), 200
        else:
            return jsonify({
                "error": "Failed to upload BOM"
            }), 500
            
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to upload BOM"
        }), 500


@ipqc_bp.route('/get-bom/<customer_id>', methods=['GET'])
def get_bom(customer_id):
    """Get BOM for specific customer"""
    try:
        bom = BOMData.get_bom(customer_id)
        
        if bom:
            return jsonify({
                "success": True,
                "customer_id": customer_id,
                "bom": bom
            }), 200
        else:
            return jsonify({
                "error": "BOM not found for this customer"
            }), 404
            
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to retrieve BOM"
        }), 500


@ipqc_bp.route('/list-customers', methods=['GET'])
def list_customers():
    """List all available customers"""
    try:
        customers = list(BOMData.CUSTOMER_BOMS.keys())
        return jsonify({
            "success": True,
            "customers": customers,
            "count": len(customers)
        }), 200
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@ipqc_bp.route('/generate-serials', methods=['POST'])
def generate_serials():
    """
    Generate serial numbers
    
    Expected JSON:
    {
        "start_number": 10001,
        "count": 100,
        "prefix": "GSPL",
        "padding": 5
    }
    """
    try:
        data = request.get_json()
        
        start_number = data.get('start_number', 10001)
        count = data.get('count', 1)
        prefix = data.get('prefix', '')
        padding = data.get('padding', 5)
        
        # Generate serial numbers
        serials = SerialNumberGenerator.generate_serial_numbers(start_number, count)
        
        # Format if prefix provided
        if prefix:
            serials = [
                SerialNumberGenerator.format_serial_number(s, prefix=prefix, padding=padding)
                for s in serials
            ]
        
        return jsonify({
            "success": True,
            "serial_numbers": serials,
            "count": len(serials)
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@ipqc_bp.route('/template-info', methods=['GET'])
def template_info():
    """Get information about IPQC template"""
    try:
        from app.models.ipqc_data import IPQCTemplate
        
        return jsonify({
            "success": True,
            "total_stages": IPQCTemplate.get_stage_count(),
            "total_checkpoints": IPQCTemplate.get_checkpoint_count(),
            "stages": [
                {
                    "sr_no": stage.get("sr_no"),
                    "stage": stage.get("stage"),
                    "checkpoint_count": len(stage.get("checkpoints", []))
                }
                for stage in IPQCTemplate.get_template()
            ]
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@ipqc_bp.route('/rejections/bulk', methods=['POST'])
def add_bulk_rejections():
    """
    Add multiple rejections from Excel upload (unique serials only)
    
    Expected JSON:
    {
        "company_id": 1,
        "rejections": [
            {
                "rejection_date": "2024-01-15",
                "serial_number": "12345",
                "rejection_reason": "...",
                "stage": "...",
                "defect_type": "Minor"
            },
            ...
        ]
    }
    """
    try:
        from app.models.database import get_db_connection
        
        data = request.get_json()
        
        if 'company_id' not in data or 'rejections' not in data:
            return jsonify({
                "error": "Missing company_id or rejections"
            }), 400
        
        company_id = data['company_id']
        rejections = data['rejections']
        
        if not rejections or len(rejections) == 0:
            return jsonify({
                "error": "No rejections provided"
            }), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get existing serial numbers for this company to prevent duplicates
        cursor.execute("""
            SELECT serial_number 
            FROM rejected_modules 
            WHERE company_id = %s
        """, (company_id,))
        
        existing_serials = set(row[0] for row in cursor.fetchall())
        
        # Filter unique rejections
        unique_rejections = [
            r for r in rejections 
            if r.get('serial_number') not in existing_serials
        ]
        
        if not unique_rejections:
            conn.close()
            return jsonify({
                "success": True,
                "message": "All serial numbers already exist",
                "added": 0,
                "skipped": len(rejections)
            }), 200
        
        # Insert unique rejections
        added_count = 0
        for rejection in unique_rejections:
            cursor.execute("""
                INSERT INTO rejected_modules 
                (company_id, rejection_date, serial_number, rejection_reason, stage, defect_type)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                company_id,
                rejection.get('rejection_date'),
                rejection.get('serial_number'),
                rejection.get('rejection_reason'),
                rejection.get('stage', 'Not Specified'),
                rejection.get('defect_type', 'Minor')
            ))
            added_count += 1
        
        conn.commit()
        conn.close()
        
        skipped_count = len(rejections) - added_count
        
        return jsonify({
            "success": True,
            "message": f"Successfully added {added_count} rejection(s)",
            "added": added_count,
            "skipped": skipped_count,
            "total_received": len(rejections)
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Failed to add bulk rejections"
        }), 500
