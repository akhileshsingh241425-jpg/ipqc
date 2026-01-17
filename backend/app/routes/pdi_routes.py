"""
PDI Batch Management API Routes
"""
from flask import Blueprint, request, jsonify, send_file
from datetime import datetime
from app.models.database import db, ProductionRecord, BomMaterial, Company
from app.models.pdi_models import PDIBatch, ModuleSerialNumber, MasterOrder, COCDocument, PDICOCUsage
from io import BytesIO
import os
import requests

pdi_bp = Blueprint('pdi', __name__)

# ============================================
# WHATSAPP NOTIFICATION CONFIG (for PDI alerts)
# ============================================
WHATSAPP_API_URL = 'https://wb.omni.tatatelebusiness.com/whatsapp-cloud/messages'
WHATSAPP_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwaG9uZU51bWJlciI6Iis5MTg1MjcyODg5MzgiLCJwaG9uZU51bWJlcklkIjoiNDgwNTg4MDkxNzk5NDkwIiwiaWF0IjoxNzI4NTU3MDQ3fQ.jOY6HSv88KZja3dsml3EaUQWrepRDhezsSMZ5IfcUZo'

# Default notification numbers (add your numbers here)
PDI_ALERT_NUMBERS = ['9773983859']  # Add more numbers as needed

def send_pdi_whatsapp_alert(caution, party_name, module_no, pallet_no, rejection_reason):
    """Send WhatsApp alert for PDI issues"""
    try:
        results = []
        for number in PDI_ALERT_NUMBERS:
            recipient = '91' + number.replace('+91', '').replace(' ', '')
            
            payload = {
                "to": recipient,
                "type": "template",
                "source": "external",
                "template": {
                    "name": "pack_dispatch",
                    "language": {"code": "en"},
                    "components": [
                        {
                            "type": "header",
                            "parameters": [
                                {"type": "text", "text": str(caution)}
                            ]
                        },
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": str(party_name)},
                                {"type": "text", "text": str(module_no)},
                                {"type": "text", "text": str(pallet_no)},
                                {"type": "text", "text": str(rejection_reason)}
                            ]
                        }
                    ]
                }
            }
            
            headers = {
                "Authorization": WHATSAPP_AUTH_TOKEN,
                "Content-Type": "application/json"
            }
            
            response = requests.post(WHATSAPP_API_URL, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                print(f"✅ PDI WhatsApp alert sent to {recipient}")
                results.append({'recipient': recipient, 'success': True})
            else:
                print(f"❌ PDI WhatsApp failed for {recipient}: {response.text}")
                results.append({'recipient': recipient, 'success': False, 'error': response.text})
        
        return results
    except Exception as e:
        print(f"❌ PDI WhatsApp error: {str(e)}")
        return []

# Get all PDI batches
@pdi_bp.route('/api/pdi-batches', methods=['GET'])
def get_pdi_batches():
    try:
        order_id = request.args.get('order_id')
        
        query = PDIBatch.query
        if order_id:
            query = query.filter_by(order_id=order_id)
        
        batches = query.order_by(PDIBatch.batch_sequence).all()
        return jsonify([batch.to_dict() for batch in batches]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get single PDI batch
@pdi_bp.route('/api/pdi-batches/<int:batch_id>', methods=['GET'])
def get_pdi_batch(batch_id):
    try:
        batch = PDIBatch.query.get_or_404(batch_id)
        return jsonify(batch.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 404

# Create PDI batch
@pdi_bp.route('/api/pdi-batches', methods=['POST'])
def create_pdi_batch():
    try:
        data = request.get_json()
        
        order_id = int(data.get('orderId'))
        order = MasterOrder.query.get_or_404(order_id)
        
        # Get next sequence number
        existing_batches = PDIBatch.query.filter_by(order_id=order_id).count()
        batch_sequence = existing_batches + 1
        
        # Generate PDI number
        pdi_number = f"PDI-{batch_sequence}"
        if data.get('pdiNumber'):
            pdi_number = data['pdiNumber']
        
        # Calculate serial number range
        planned_modules = int(data.get('plannedModules'))
        serial_prefix = data.get('serialPrefix', order.order_number[:10])
        
        # Get last serial end from previous batches
        last_batch = PDIBatch.query.filter_by(order_id=order_id).order_by(PDIBatch.batch_sequence.desc()).first()
        serial_start = 1
        if last_batch and last_batch.serial_end:
            serial_start = last_batch.serial_end + 1
        
        serial_end = serial_start + planned_modules - 1
        
        batch = PDIBatch(
            order_id=order_id,
            pdi_number=pdi_number,
            batch_sequence=batch_sequence,
            planned_modules=planned_modules,
            start_date=datetime.strptime(data.get('startDate'), '%Y-%m-%d').date() if data.get('startDate') else None,
            end_date=datetime.strptime(data.get('endDate'), '%Y-%m-%d').date() if data.get('endDate') else None,
            serial_prefix=serial_prefix,
            serial_start=serial_start,
            serial_end=serial_end,
            status=data.get('status', 'planned')
        )
        
        db.session.add(batch)
        db.session.commit()
        
        # Auto-generate serial numbers
        generate_serial_numbers(batch.id, serial_prefix, serial_start, serial_end)
        
        return jsonify(batch.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Generate serial numbers for batch
def generate_serial_numbers(batch_id, prefix, start, end):
    try:
        serials = []
        for i in range(start, end + 1):
            serial_number = f"{prefix}-{i:06d}"
            serial = ModuleSerialNumber(
                pdi_batch_id=batch_id,
                serial_number=serial_number,
                qc_status='pending'
            )
            serials.append(serial)
        
        db.session.bulk_save_objects(serials)
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Error generating serials: {e}")
        return False

# Update PDI batch
@pdi_bp.route('/api/pdi-batches/<int:batch_id>', methods=['PUT'])
def update_pdi_batch(batch_id):
    try:
        batch = PDIBatch.query.get_or_404(batch_id)
        data = request.get_json()
        
        if 'plannedModules' in data:
            batch.planned_modules = int(data['plannedModules'])
        if 'actualModules' in data:
            batch.actual_modules = int(data['actualModules'])
        if 'startDate' in data:
            batch.start_date = datetime.strptime(data['startDate'], '%Y-%m-%d').date()
        if 'endDate' in data:
            batch.end_date = datetime.strptime(data['endDate'], '%Y-%m-%d').date()
        if 'status' in data:
            batch.status = data['status']
        
        batch.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(batch.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Link COC to PDI batch
@pdi_bp.route('/api/pdi-batches/<int:batch_id>/link-coc', methods=['POST'])
def link_coc_to_pdi(batch_id):
    try:
        batch = PDIBatch.query.get_or_404(batch_id)
        data = request.get_json()
        
        coc_id = int(data.get('cocId'))
        cells_to_use = int(data.get('cellsUsed'))
        
        coc = COCDocument.query.get_or_404(coc_id)
        
        # Check if enough cells available
        cells_available = coc.total_cells_qty - coc.cells_used
        if cells_to_use > cells_available:
            return jsonify({'error': f'Not enough cells. Available: {cells_available}'}), 400
        
        # Create usage record
        usage = PDICOCUsage(
            pdi_batch_id=batch_id,
            coc_document_id=coc_id,
            cells_used=cells_to_use,
            usage_date=datetime.utcnow().date()
        )
        
        # Update COC cells used
        coc.cells_used += cells_to_use
        coc.cells_remaining = coc.total_cells_qty - coc.cells_used
        
        if coc.cells_remaining <= 0:
            coc.status = 'exhausted'
        
        db.session.add(usage)
        db.session.commit()
        
        return jsonify({
            'message': 'COC linked successfully',
            'usage': usage.to_dict(),
            'cocRemaining': coc.cells_remaining
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Close PDI batch and generate reports
@pdi_bp.route('/api/pdi-batches/<int:batch_id>/close', methods=['POST'])
def close_pdi_batch(batch_id):
    try:
        batch = PDIBatch.query.get_or_404(batch_id)
        
        if batch.status == 'completed':
            return jsonify({'error': 'Batch already closed'}), 400
        
        # Update batch status
        batch.status = 'completed'
        batch.end_date = datetime.utcnow().date()
        
        # TODO: Generate all reports here
        # - IPQC Report
        # - FTR Report  
        # - COC Report
        # - Traceability Report
        
        batch.reports_generated = True
        db.session.commit()
        
        return jsonify({
            'message': 'PDI batch closed successfully',
            'batch': batch.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Get batch serial numbers
@pdi_bp.route('/api/pdi-batches/<int:batch_id>/serials', methods=['GET'])
def get_batch_serials(batch_id):
    try:
        batch = PDIBatch.query.get_or_404(batch_id)
        serials = ModuleSerialNumber.query.filter_by(pdi_batch_id=batch_id).all()
        
        return jsonify({
            'batchId': batch_id,
            'pdiNumber': batch.pdi_number,
            'totalSerials': len(serials),
            'serials': [s.to_dict() for s in serials]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Update serial number status
@pdi_bp.route('/api/serials/<int:serial_id>', methods=['PUT'])
def update_serial(serial_id):
    try:
        serial = ModuleSerialNumber.query.get_or_404(serial_id)
        data = request.get_json()
        
        # Get PDI batch and party info for WhatsApp alerts
        pdi_batch = PDIBatch.query.get(serial.pdi_batch_id)
        party_name = "Unknown"
        pallet_no = data.get('palletNo', 'N/A')
        
        if pdi_batch:
            order = MasterOrder.query.get(pdi_batch.order_id)
            if order:
                company = Company.query.get(order.company_id)
                if company:
                    party_name = company.name
        
        # Check if rejection is being uploaded
        if 'rejectionReason' in data and data['rejectionReason']:
            serial.rejection_reason = data['rejectionReason']
            
            # 🔔 ALERT: Rejection uploaded - Send WhatsApp
            print(f"⚠️ REJECTION DETECTED: Module {serial.serial_number} - {data['rejectionReason']}")
            
            send_pdi_whatsapp_alert(
                caution="⚠️ REJECTION ALERT",
                party_name=party_name,
                module_no=serial.serial_number,
                pallet_no=pallet_no,
                rejection_reason=data['rejectionReason']
            )
        
        if 'qcStatus' in data:
            serial.qc_status = data['qcStatus']
            
        if 'dispatched' in data:
            serial.dispatched = data['dispatched']
            if data['dispatched']:
                serial.dispatch_date = datetime.utcnow().date()
                
                # 🔔 CHECK: If rejected module is being dispatched - ALERT!
                if serial.rejection_reason:
                    print(f"🚨 CRITICAL: Rejected module {serial.serial_number} being dispatched!")
                    
                    send_pdi_whatsapp_alert(
                        caution="🚨 CRITICAL - REJECTED MODULE DISPATCH",
                        party_name=party_name,
                        module_no=serial.serial_number,
                        pallet_no=pallet_no,
                        rejection_reason=f"REJECTED: {serial.rejection_reason} - BUT BEING DISPATCHED!"
                    )
        
        db.session.commit()
        return jsonify(serial.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Download complete PDI report (COC + IPQC + FTR + Production Data)
@pdi_bp.route('/api/pdi/download-complete-report', methods=['POST'])
def download_complete_report():
    """Generate and download complete PDI report with all documents"""
    try:
        data = request.get_json()
        pdi_number = data.get('pdi_number')
        company_name = data.get('company_name')
        
        print(f"\n=== DOWNLOAD COMPLETE REPORT REQUEST ===")
        print(f"PDI: {pdi_number}")
        print(f"Company: {company_name}")
        
        if not pdi_number or not company_name:
            print("ERROR: Missing PDI number or company name")
            return jsonify({'error': 'PDI number and company name are required'}), 400
        
        # Import here to avoid circular imports
        from app.services.pdi_report_generator import PDIReportGenerator
        
        print("Generating complete report...")
        # Generate complete report
        generator = PDIReportGenerator()
        pdf_buffer = generator.generate_complete_report(pdi_number, company_name)
        
        if not pdf_buffer:
            print("ERROR: generate_complete_report returned None")
            return jsonify({'error': 'Failed to generate report - no data found'}), 500
        
        # Send file
        pdf_buffer.seek(0)
        filename = f"Complete_Report_{pdi_number}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        print(f"Sending file: {filename}")
        print("=== REPORT GENERATION COMPLETE ===\n")
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"ERROR generating complete report: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Unassign COC from BOM material in PDI
@pdi_bp.route('/api/pdi/delete-bom-material', methods=['POST'])
def delete_bom_material():
    try:
        data = request.get_json()
        pdi_number = data.get('pdi')
        company_name = data.get('companyName')
        material_name = data.get('materialName')
        lot_number = data.get('lotNumber', '')
        
        print(f"\n=== UNASSIGN COC FROM BOM MATERIAL ===")
        print(f"PDI: {pdi_number}")
        print(f"Company: {company_name}")
        print(f"Material: {material_name}")
        print(f"Lot Number: {lot_number}")
        
        if not pdi_number or not company_name or not material_name:
            return jsonify({'error': 'PDI number, company name, and material name are required'}), 400
        
        # Find the company
        company = Company.query.filter_by(company_name=company_name).first()
        if not company:
            print(f"Company '{company_name}' not found!")
            return jsonify({'error': 'Company not found'}), 404
        
        print(f"Found company ID: {company.id}")
        
        # Find production records with this PDI
        production_records = ProductionRecord.query.filter_by(
            company_id=company.id,
            pdi=pdi_number
        ).all()
        
        if not production_records:
            print(f"No production records found for PDI {pdi_number}")
            return jsonify({'error': 'PDI not found'}), 404
        
        print(f"Found {len(production_records)} production record(s)")
        
        # Find and unassign COC from all matching BomMaterial records
        updated_count = 0
        for record in production_records:
            print(f"Checking production record ID: {record.id}")
            
            query = BomMaterial.query.filter_by(
                production_record_id=record.id,
                material_name=material_name
            )
            
            if lot_number:
                query = query.filter_by(lot_number=lot_number)
            
            bom_materials = query.all()
            print(f"Found {len(bom_materials)} BOM material(s) matching criteria")
            
            for bom_material in bom_materials:
                print(f"Unassigning COC from BOM material ID {bom_material.id}: {bom_material.material_name}")
                # Clear COC-related fields but keep the material
                bom_material.lot_number = None
                bom_material.coc_qty = None
                bom_material.invoice_qty = None
                bom_material.lot_batch_no = None
                bom_material.image_path = None
                updated_count += 1
        
        if updated_count == 0:
            print("No BOM materials found to unassign!")
            return jsonify({'error': 'BOM material not found'}), 404
        
        db.session.commit()
        print(f"Successfully unassigned COC from {updated_count} BOM material(s)")
        print("=== UNASSIGN COMPLETE ===\n")
        
        return jsonify({'success': True, 'message': f'COC unassigned from {updated_count} material(s)'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error unassigning COC: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================
# PDI ALERT SETTINGS
# ============================================

@pdi_bp.route('/api/pdi/alert-numbers', methods=['GET'])
def get_alert_numbers():
    """Get list of WhatsApp alert numbers"""
    return jsonify({
        'numbers': PDI_ALERT_NUMBERS,
        'count': len(PDI_ALERT_NUMBERS)
    }), 200


@pdi_bp.route('/api/pdi/alert-numbers', methods=['POST'])
def update_alert_numbers():
    """Update WhatsApp alert numbers"""
    global PDI_ALERT_NUMBERS
    try:
        data = request.get_json()
        numbers = data.get('numbers', [])
        
        if not numbers:
            return jsonify({'error': 'At least one number is required'}), 400
        
        # Clean numbers
        cleaned = []
        for num in numbers:
            num = str(num).replace('+91', '').replace(' ', '').replace('-', '')
            if len(num) == 10 and num.isdigit():
                cleaned.append(num)
        
        if not cleaned:
            return jsonify({'error': 'No valid numbers provided'}), 400
        
        PDI_ALERT_NUMBERS = cleaned
        
        return jsonify({
            'success': True,
            'numbers': PDI_ALERT_NUMBERS,
            'message': f'Updated {len(PDI_ALERT_NUMBERS)} alert number(s)'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdi_bp.route('/api/pdi/test-alert', methods=['POST'])
def test_pdi_alert():
    """Send a test WhatsApp alert"""
    try:
        data = request.get_json()
        
        results = send_pdi_whatsapp_alert(
            caution="🧪 TEST ALERT",
            party_name=data.get('party_name', 'Test Party'),
            module_no=data.get('module_no', 'TEST-MODULE-001'),
            pallet_no=data.get('pallet_no', 'TEST-PLT-001'),
            rejection_reason=data.get('rejection_reason', 'This is a test alert')
        )
        
        return jsonify({
            'success': True,
            'results': results,
            'message': f'Test alert sent to {len(PDI_ALERT_NUMBERS)} number(s)'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
