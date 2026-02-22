"""
COC Management Routes
"""
from flask import Blueprint, request, jsonify
from app.services.coc_service import COCService
from sqlalchemy import text
from app.models.database import db

coc_bp = Blueprint('coc', __name__)

@coc_bp.route('/sync', methods=['POST'])
def sync_coc_data():
    """Sync COC data from external API"""
    try:
        data = request.get_json() or {}
        from_date = data.get('from_date')
        to_date = data.get('to_date')
        
        result = COCService.fetch_and_sync_coc_data(from_date, to_date)
        return jsonify(result), 200 if result['success'] else 500
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/list', methods=['GET'])
def list_coc_documents():
    """List all COC documents from real external API"""
    try:
        import requests
        from datetime import datetime, timedelta
        
        # Get query parameters
        invoice_no = request.args.get('invoice_no')
        
        # Real COC API endpoint
        COC_API_URL = 'https://umanmrp.in/api/coc_api.php'
        
        # Get date range (default: last 6 months to today)
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        # Prepare POST data
        post_data = {
            'from': from_date,
            'to': to_date
        }
        
        # Fetch from real COC API
        response = requests.post(COC_API_URL, json=post_data, timeout=10)
        
        if response.status_code == 200:
            coc_data = response.json()
            
            # Transform data to match frontend expectations
            transformed_data = []
            
            # Handle different response structures
            if isinstance(coc_data, dict):
                if 'data' in coc_data:
                    coc_documents = coc_data['data']
                elif 'documents' in coc_data:
                    coc_documents = coc_data['documents']
                elif 'coc_data' in coc_data:
                    coc_documents = coc_data['coc_data']
                else:
                    coc_documents = [coc_data]
            elif isinstance(coc_data, list):
                coc_documents = coc_data
            else:
                coc_documents = []
            
            for doc in coc_documents:
                transformed_item = {
                    'id': doc.get('id'),
                    'invoice_no': doc.get('invoice_no'),
                    'material_name': doc.get('material_name'),
                    'brand': doc.get('brand'),
                    'lot_batch_no': doc.get('lot_batch_no'),
                    'coc_qty': doc.get('coc_qty'),
                    'invoice_qty': doc.get('invoice_qty'),
                    'invoice_date': doc.get('invoice_date'),
                    'entry_date': doc.get('entry_date'),
                    'coc_document_url': doc.get('coc_document_url'),
                    'iqc_document_url': doc.get('iqc_document_url'),
                    'store_name': doc.get('store_name'),
                    'product_type': doc.get('product_type')
                }
                
                # Filter by invoice number if provided
                if invoice_no:
                    if transformed_item['invoice_no'] and invoice_no.lower() in str(transformed_item['invoice_no']).lower():
                        transformed_data.append(transformed_item)
                else:
                    transformed_data.append(transformed_item)
            
            return jsonify({
                'success': True,
                'coc_data': transformed_data,
                'count': len(transformed_data),
                'source': 'Real API (umanmrp.in)',
                'date_range': {'from': from_date, 'to': to_date}
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': f'COC API returned status {response.status_code}',
                'coc_data': []
            }), 500
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            'success': False,
            'error': 'Cannot connect to COC API (umanmrp.in). Please check internet connection.',
            'coc_data': []
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'COC API request timeout',
            'coc_data': []
        }), 504
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'coc_data': []
        }), 500


@coc_bp.route('/assigned', methods=['GET'])
def get_assigned_coc_records():
    """
    Get COC records assigned to PDIs from MRP system
    API: https://umanmrp.in/a/get_assigned_coc_records.php
    Returns: material assignments with remaining qty per company/PDI
    """
    try:
        import requests
        
        # Company filter (optional)
        company_filter = request.args.get('company', '').lower()
        pdi_filter = request.args.get('pdi', '').lower()
        material_filter = request.args.get('material', '').lower()
        
        # Fetch from MRP assigned COC API
        ASSIGNED_COC_API = 'https://umanmrp.in/a/get_assigned_coc_records.php'
        
        print(f"🌐 Fetching assigned COC records from: {ASSIGNED_COC_API}")
        response = requests.get(ASSIGNED_COC_API, timeout=15)
        
        if response.status_code != 200:
            return jsonify({
                'success': False,
                'error': f'API returned status {response.status_code}',
                'data': []
            }), 500
        
        api_data = response.json()
        
        if api_data.get('status') != 'success':
            return jsonify({
                'success': False,
                'error': 'API returned unsuccessful status',
                'data': []
            }), 500
        
        records = api_data.get('data', [])
        
        # Company name mapping (API -> Full name)
        COMPANY_MAP = {
            's&w': 'Sterlin and Wilson',
            'l&t': 'Larsen & Toubro',
            'rays power': 'Rays Power',
            'rays': 'Rays Power'
        }
        
        # PDI number mapping (Lot 1 -> PDI-1)
        def normalize_pdi(pdi_str):
            if not pdi_str:
                return None
            pdi_lower = pdi_str.lower().strip()
            # Handle "Lot 1", "Lot 2", etc.
            if 'lot' in pdi_lower:
                import re
                match = re.search(r'lot\s*(\d+)', pdi_lower)
                if match:
                    return f"PDI-{match.group(1)}"
            # Handle "PDI-1", "PDI1", etc.
            if 'pdi' in pdi_lower:
                import re
                match = re.search(r'pdi[- ]?(\d+)', pdi_lower)
                if match:
                    return f"PDI-{match.group(1)}"
            return pdi_str
        
        # Transform and filter data
        transformed_records = []
        for record in records:
            assigned_to = (record.get('assigned_to') or '').lower().strip()
            pdi_no = record.get('pdi_no', '')
            material_name = record.get('material_name', '')
            
            # Get full company name
            company_full = COMPANY_MAP.get(assigned_to, record.get('assigned_to', ''))
            
            # Normalize PDI number
            pdi_normalized = normalize_pdi(pdi_no)
            
            # Apply filters
            if company_filter and company_filter not in assigned_to and company_filter not in company_full.lower():
                continue
            if pdi_filter and pdi_filter not in (pdi_normalized or '').lower():
                continue
            if material_filter and material_filter not in material_name.lower():
                continue
            
            # Parse remaining qty
            remaining_qty = record.get('remaining_qty')
            try:
                remaining_qty = float(remaining_qty) if remaining_qty else 0
            except:
                remaining_qty = 0
            
            transformed_records.append({
                'id': record.get('id'),
                'material_name': material_name,
                'material_id': record.get('material_id'),
                'company': company_full,
                'company_short': record.get('assigned_to'),
                'pdi_no': pdi_normalized,
                'pdi_original': pdi_no,
                'lot_batch_no': record.get('lot_batch_no'),
                'invoice_no': record.get('invoice_no'),
                'invoice_date': record.get('invoice_date') or record.get('entry_date') or '',
                'invoice_qty': record.get('invoice_qty') or record.get('coc_qty') or 0,
                'brand': record.get('brand') or record.get('store_name') or '',
                'coc_qty': record.get('coc_qty') or 0,
                'consumed_qty': record.get('consumed_qty') or 0,
                'remaining_qty': remaining_qty,
                'product_type': record.get('product_type') or '',
                'coc_document_url': record.get('coc_document_url') or '',
                'iqc_document_url': record.get('iqc_document_url') or '',
                'is_exhausted': remaining_qty <= 0
            })
        
        # Group by material and company for summary
        summary_by_material = {}
        for rec in transformed_records:
            mat = rec['material_name']
            if mat not in summary_by_material:
                summary_by_material[mat] = {
                    'total_remaining': 0,
                    'companies': {},
                    'pdis': {}
                }
            summary_by_material[mat]['total_remaining'] += rec['remaining_qty']
            
            # By company
            comp = rec['company']
            if comp not in summary_by_material[mat]['companies']:
                summary_by_material[mat]['companies'][comp] = 0
            summary_by_material[mat]['companies'][comp] += rec['remaining_qty']
            
            # By PDI
            pdi = rec['pdi_no']
            if pdi:
                if pdi not in summary_by_material[mat]['pdis']:
                    summary_by_material[mat]['pdis'][pdi] = 0
                summary_by_material[mat]['pdis'][pdi] += rec['remaining_qty']
        
        return jsonify({
            'success': True,
            'data': transformed_records,
            'count': len(transformed_records),
            'summary': summary_by_material,
            'source': 'MRP API (get_assigned_coc_records.php)'
        }), 200
        
    except requests.exceptions.ConnectionError:
        return jsonify({
            'success': False,
            'error': 'Cannot connect to MRP API. Please check internet connection.',
            'data': []
        }), 503
    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'MRP API request timeout',
            'data': []
        }), 504
    except Exception as e:
        print(f"❌ Error fetching assigned COC records: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'data': []
        }), 500
        
        coc_list = []
        for row in result:
            coc_list.append({
                'id': row[0],
                'company': row[2],
                'material': row[3],
                'brand': row[4],
                'lot_batch_no': row[6],
                'coc_qty': float(row[7]),
                'invoice_no': row[8],
                'invoice_date': str(row[10]) if row[10] else None,
                'consumed_qty': float(row[15]) if row[15] else 0,
                'available_qty': float(row[16]) if row[16] else 0,
                'coc_document_url': row[13],
                'iqc_document_url': row[14]
            })
        
        return jsonify({"success": True, "data": coc_list}), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/stock', methods=['GET'])
def get_material_stock():
    """Get raw material stock levels"""
    try:
        # Return empty stock data for now
        return jsonify({"success": True, "data": []}), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/validate', methods=['POST'])
def validate_production():
    """Validate if production can proceed based on material availability"""
    try:
        data = request.get_json()
        company = data.get('company_name')
        materials = data.get('materials', {})
        
        result = COCService.validate_production(company, materials)
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/companies', methods=['GET'])
def get_companies():
    """Get list of all companies"""
    try:
        # For now, return empty list since coc_documents table doesn't exist
        # Will be populated when COC sync is implemented
        return jsonify({"success": True, "data": []}), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/<int:coc_id>/update-used', methods=['PUT'])
def update_coc_used_quantity(coc_id):
    """Update the consumed_qty (used quantity) for a COC document"""
    try:
        from app.models.pdi_models import COCDocument
        data = request.get_json()
        consumed_qty = data.get('consumed_qty')
        
        if consumed_qty is None:
            return jsonify({"success": False, "message": "consumed_qty is required"}), 400
        
        # Get COC document
        coc = COCDocument.query.get(coc_id)
        if not coc:
            return jsonify({"success": False, "message": "COC document not found"}), 404
        
        # Update consumed quantity
        coc.consumed_qty = int(consumed_qty)
        
        # Recalculate available quantity
        coc.available_qty = coc.coc_qty - coc.consumed_qty
        
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Used quantity updated successfully",
            "data": {
                "consumed_qty": coc.consumed_qty,
                "available_qty": coc.available_qty
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/coc-with-pdi-details', methods=['GET'])
def get_coc_with_pdi_details():
    """Get COC documents with detailed PDI usage information"""
    try:
        from app.models.pdi_models import COCDocument, PDICOCUsage, PDIBatch, MasterOrder
        from datetime import datetime, timedelta
        
        # Get query parameters
        company = request.args.get('company')
        from_date_str = request.args.get('from_date')
        to_date_str = request.args.get('to_date')
        
        # Build query
        query = COCDocument.query
        
        if company:
            # Filter by company through order relationship
            query = query.join(MasterOrder).join(db.Model.metadata.tables['companies']).filter(
                text("companies.company_name = :company")
            ).params(company=company)
        
        # Date filtering if provided
        if from_date_str:
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            query = query.filter(COCDocument.received_date >= from_date)
        
        if to_date_str:
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            query = query.filter(COCDocument.received_date <= to_date)
        
        coc_documents = query.order_by(COCDocument.received_date.desc()).all()
        
        # If no internal COC documents found, return message
        if not coc_documents:
            return jsonify({
                'success': True,
                'data': [],
                'count': 0,
                'message': 'No COC documents in internal database. Uncheck "Show PDI Details" to see external API data, or create orders and link COC documents first.'
            }), 200
        
        # Build detailed response with PDI usage
        result = []
        for coc in coc_documents:
            # Get order details
            order = MasterOrder.query.get(coc.order_id)
            
            # Get all PDI usages for this COC with batch details
            pdi_usage_details = []
            for usage in coc.pdi_usage:
                pdi_batch = PDIBatch.query.get(usage.pdi_batch_id)
                if pdi_batch:
                    pdi_usage_details.append({
                        'pdiNumber': pdi_batch.pdi_number,
                        'batchSequence': pdi_batch.batch_sequence,
                        'cellsUsed': usage.cells_used,
                        'usageDate': usage.usage_date.strftime('%Y-%m-%d') if usage.usage_date else None,
                        'plannedModules': pdi_batch.planned_modules,
                        'actualModules': pdi_batch.actual_modules,
                        'startDate': pdi_batch.start_date.strftime('%Y-%m-%d') if pdi_batch.start_date else None,
                        'endDate': pdi_batch.end_date.strftime('%Y-%m-%d') if pdi_batch.end_date else None,
                        'status': pdi_batch.status,
                        'serialPrefix': pdi_batch.serial_prefix,
                        'serialStart': pdi_batch.serial_start,
                        'serialEnd': pdi_batch.serial_end
                    })
            
            coc_data = {
                'id': coc.id,
                'invoiceNumber': coc.invoice_number,
                'cocNumber': coc.coc_number,
                'totalCellsQty': coc.total_cells_qty,
                'cellsUsed': coc.cells_used,
                'cellsRemaining': coc.cells_remaining,
                'utilizationPercent': round((coc.cells_used / coc.total_cells_qty * 100), 2) if coc.total_cells_qty > 0 else 0,
                'cellBatchNumber': coc.cell_batch_number,
                'supplierName': coc.supplier_name,
                'receivedDate': coc.received_date.strftime('%Y-%m-%d') if coc.received_date else None,
                'status': coc.status,
                'notes': coc.notes,
                'orderNumber': order.order_number if order else None,
                'customerPO': order.customer_po if order else None,
                'moduleWattage': order.module_wattage if order else None,
                'cellsPerModule': order.cells_per_module if order else None,
                'pdiUsageDetails': pdi_usage_details,
                'totalPdiBatches': len(pdi_usage_details)
            }
            
            result.append(coc_data)
        
        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/materials', methods=['GET'])
def get_materials():
    """Get list of all materials"""
    try:
        company = request.args.get('company')
        query = "SELECT DISTINCT material_name FROM coc_documents WHERE is_active = 1"
        params = {}
        
        if company:
            query += " AND company_name = :company"
            params['company'] = company
        
        query += " ORDER BY material_name"
        
        result = db.session.execute(text(query), params).fetchall()
        materials = [row[0] for row in result]
        
        return jsonify({"success": True, "data": materials}), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@coc_bp.route('/generate-pdi-report', methods=['POST'])
def generate_pdi_coc_report():
    """Generate consolidated COC report with PDFs for a PDI batch"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from io import BytesIO
        from datetime import datetime
        import requests
        from flask import send_file
        from PyPDF2 import PdfMerger
        import os
        import tempfile
        
        data = request.get_json()
        pdi_number = data.get('pdi_number')
        company_id = data.get('company_id')
        invoice_numbers = data.get('invoice_numbers', [])
        include_pdfs = data.get('include_pdfs', True)
        
        if not pdi_number or not invoice_numbers:
            return jsonify({'error': 'PDI number and invoice numbers required'}), 400
        
        # Get company name
        from app.models.database import Company
        company = Company.query.get(company_id)
        company_name = company.company_name if company else "Unknown Company"
        
        # Fetch COC data from API
        COC_API_URL = 'https://umanmrp.in/api/coc_api.php'
        from datetime import timedelta
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        response = requests.post(COC_API_URL, json={'from': from_date, 'to': to_date}, timeout=10)
        all_coc_data = []
        
        if response.status_code == 200:
            coc_response = response.json()
            if isinstance(coc_response, dict) and 'data' in coc_response:
                all_coc_data = coc_response['data']
            elif isinstance(coc_response, list):
                all_coc_data = coc_response
        
        # Filter COCs matching invoice numbers
        matched_cocs = [coc for coc in all_coc_data if coc.get('invoice_no') in invoice_numbers]
        
        # Create PDF report
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                               topMargin=15*mm, bottomMargin=15*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, 
                                     textColor=colors.HexColor('#1976d2'), alignment=TA_CENTER, spaceAfter=10)
        
        story = []
        
        # Title Page
        story.append(Spacer(1, 30*mm))
        story.append(Paragraph(f"<b>COC REPORT</b>", title_style))
        story.append(Paragraph(f"<b>{pdi_number}</b>", title_style))
        story.append(Spacer(1, 10*mm))
        story.append(Paragraph(f"Company: {company_name}", styles['Normal']))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        story.append(Paragraph(f"Total COC Documents: {len(matched_cocs)}", styles['Normal']))
        story.append(PageBreak())
        
        # Index Page
        story.append(Paragraph("<b>INDEX - COC Documents</b>", styles['Heading2']))
        story.append(Spacer(1, 5*mm))
        
        index_data = [['Sr.', 'Invoice No', 'Material', 'Brand', 'Lot/Batch', 'Qty', 'Date', 'COC', 'IQC']]
        for idx, coc in enumerate(matched_cocs, 1):
            has_coc = '✓' if coc.get('coc_document_url') else '✗'
            has_iqc = '✓' if coc.get('iqc_document_url') else '✗'
            index_data.append([
                str(idx),
                coc.get('invoice_no', '-')[:15],
                coc.get('material_name', '-')[:20],
                coc.get('brand', '-')[:15],
                coc.get('lot_batch_no', '-')[:15],
                str(coc.get('coc_qty', '-')),
                coc.get('invoice_date', '-')[:10],
                has_coc,
                has_iqc
            ])
        
        index_table = Table(index_data, colWidths=[12*mm, 30*mm, 30*mm, 22*mm, 22*mm, 18*mm, 22*mm, 12*mm, 12*mm])
        index_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2196F3')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E3F2FD')])
        ]))
        story.append(index_table)
        
        doc.build(story)
        
        # If include_pdfs is True, merge with actual COC PDFs
        if include_pdfs and matched_cocs:
            merger = PdfMerger()
            
            # Add main report
            buffer.seek(0)
            merger.append(buffer)
            
            # Try to fetch and add COC PDFs and IQC PDFs
            for idx, coc in enumerate(matched_cocs, 1):
                # Add COC PDF
                coc_url = coc.get('coc_document_url')
                if coc_url:
                    try:
                        pdf_response = requests.get(coc_url, timeout=10)
                        if pdf_response.status_code == 200:
                            pdf_buffer = BytesIO(pdf_response.content)
                            merger.append(pdf_buffer)
                    except Exception as e:
                        print(f"Failed to fetch COC PDF for invoice {coc.get('invoice_no')}: {e}")
                
                # Add IQC PDF
                iqc_url = coc.get('iqc_document_url')
                if iqc_url:
                    try:
                        iqc_response = requests.get(iqc_url, timeout=10)
                        if iqc_response.status_code == 200:
                            iqc_buffer = BytesIO(iqc_response.content)
                            merger.append(iqc_buffer)
                    except Exception as e:
                        print(f"Failed to fetch IQC PDF for invoice {coc.get('invoice_no')}: {e}")
            
            # Write merged PDF
            final_buffer = BytesIO()
            merger.write(final_buffer)
            merger.close()
            final_buffer.seek(0)
            
            return send_file(
                final_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'COC_Report_{pdi_number}_{datetime.now().strftime("%Y%m%d")}.pdf'
            )
        else:
            buffer.seek(0)
            return send_file(
                buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'COC_Report_{pdi_number}_{datetime.now().strftime("%Y%m%d")}.pdf'
            )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@coc_bp.route('/ftr/list', methods=['GET'])
def list_ftr_documents():
    """List FTR documents with flash test data"""
    try:
        from app.models.master_data import Production
        from datetime import datetime
        
        # Get query parameters
        from_date_str = request.args.get('from_date')
        to_date_str = request.args.get('to_date')
        
        # Build query
        query = Production.query
        
        # Date filtering
        if from_date_str:
            from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            query = query.filter(Production.production_date >= from_date)
        
        if to_date_str:
            to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            query = query.filter(Production.production_date <= to_date)
        
        productions = query.order_by(Production.production_date.desc()).all()
        
        # Build FTR list
        ftr_list = []
        for prod in productions:
            ftr_list.append({
                'id': prod.id,
                'serial_number': prod.serial_number,
                'pdi_number': prod.pdi_number,
                'order_number': prod.order_number,
                'production_date': prod.production_date.strftime('%Y-%m-%d') if prod.production_date else None,
                'status': 'pass' if not prod.is_rejected else 'fail',
                'ftr_document_url': prod.ftr_document_path if hasattr(prod, 'ftr_document_path') else None,
                'flash_document_url': prod.flash_document_path if hasattr(prod, 'flash_document_path') else None,
                'ftr_count': prod.ftr_count if hasattr(prod, 'ftr_count') else 0
            })
        
        return jsonify({
            'success': True,
            'data': ftr_list,
            'count': len(ftr_list)
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500


@coc_bp.route('/ftr/generate-merged-report', methods=['POST'])
def generate_ftr_merged_report():
    """Generate merged FTR + Flash report PDF"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from io import BytesIO
        from datetime import datetime
        import requests
        from flask import send_file
        from PyPDF2 import PdfMerger
        from app.models.master_data import Production
        
        data = request.get_json()
        ftr_ids = data.get('ftr_ids', [])
        include_flash = data.get('include_flash', True)
        
        if not ftr_ids:
            return jsonify({'error': 'FTR IDs required'}), 400
        
        # Get production records
        productions = Production.query.filter(Production.id.in_(ftr_ids)).all()
        
        if not productions:
            return jsonify({'error': 'No FTR records found'}), 404
        
        # Create PDF report
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                               topMargin=15*mm, bottomMargin=15*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, 
                                     textColor=colors.HexColor('#667eea'), alignment=TA_CENTER, spaceAfter=10)
        
        story = []
        
        # Title Page
        story.append(Spacer(1, 30*mm))
        story.append(Paragraph(f"<b>FTR & FLASH TEST REPORT</b>", title_style))
        story.append(Spacer(1, 10*mm))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        story.append(Paragraph(f"Total Modules: {len(productions)}", styles['Normal']))
        story.append(PageBreak())
        
        # Index Page
        story.append(Paragraph("<b>INDEX - Module Serial Numbers</b>", styles['Heading2']))
        story.append(Spacer(1, 5*mm))
        
        index_data = [['Sr.', 'Serial Number', 'PDI Number', 'Production Date', 'Status', 'FTR', 'Flash']]
        for idx, prod in enumerate(productions, 1):
            has_ftr = '✓' if (hasattr(prod, 'ftr_document_path') and prod.ftr_document_path) else '✗'
            has_flash = '✓' if (hasattr(prod, 'flash_document_path') and prod.flash_document_path) else '✗'
            status = 'PASS' if not prod.is_rejected else 'FAIL'
            
            index_data.append([
                str(idx),
                prod.serial_number,
                prod.pdi_number or 'N/A',
                prod.production_date.strftime('%Y-%m-%d') if prod.production_date else 'N/A',
                status,
                has_ftr,
                has_flash
            ])
        
        index_table = Table(index_data, colWidths=[12*mm, 40*mm, 35*mm, 30*mm, 20*mm, 15*mm, 15*mm])
        index_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3e5f5')])
        ]))
        story.append(index_table)
        
        doc.build(story)
        
        # If include_flash is True, merge with actual FTR and Flash PDFs
        if include_flash:
            merger = PdfMerger()
            
            # Add main report
            buffer.seek(0)
            merger.append(buffer)
            
            # Try to fetch and add FTR and Flash PDFs
            for prod in productions:
                # Add FTR PDF
                if hasattr(prod, 'ftr_document_path') and prod.ftr_document_path:
                    ftr_path = prod.ftr_document_path
                    # If it's a URL, fetch it
                    if ftr_path.startswith('http'):
                        try:
                            ftr_response = requests.get(ftr_path, timeout=10)
                            if ftr_response.status_code == 200:
                                ftr_buffer = BytesIO(ftr_response.content)
                                merger.append(ftr_buffer)
                        except Exception as e:
                            print(f"Failed to fetch FTR PDF for {prod.serial_number}: {e}")
                    # If it's a local path
                    else:
                        try:
                            import os
                            if os.path.exists(ftr_path):
                                merger.append(ftr_path)
                        except Exception as e:
                            print(f"Failed to load FTR PDF for {prod.serial_number}: {e}")
                
                # Add Flash PDF
                if hasattr(prod, 'flash_document_path') and prod.flash_document_path:
                    flash_path = prod.flash_document_path
                    # If it's a URL, fetch it
                    if flash_path.startswith('http'):
                        try:
                            flash_response = requests.get(flash_path, timeout=10)
                            if flash_response.status_code == 200:
                                flash_buffer = BytesIO(flash_response.content)
                                merger.append(flash_buffer)
                        except Exception as e:
                            print(f"Failed to fetch Flash PDF for {prod.serial_number}: {e}")
                    # If it's a local path
                    else:
                        try:
                            import os
                            if os.path.exists(flash_path):
                                merger.append(flash_path)
                        except Exception as e:
                            print(f"Failed to load Flash PDF for {prod.serial_number}: {e}")
            
            # Write merged PDF
            final_buffer = BytesIO()
            merger.write(final_buffer)
            merger.close()
            final_buffer.seek(0)
            
            return send_file(
                final_buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'FTR_Flash_Report_{datetime.now().strftime("%Y%m%d")}.pdf'
            )
        else:
            buffer.seek(0)
            return send_file(
                buffer,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'FTR_Flash_Report_{datetime.now().strftime("%Y%m%d")}.pdf'
            )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@coc_bp.route('/ftr/upload-flash-data', methods=['POST'])
def upload_flash_data():
    """Upload Excel file with flash test data"""
    try:
        import pandas as pd
        from werkzeug.utils import secure_filename
        import os
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read Excel file
        df = pd.read_excel(file)
        
        # Normalize column names
        df.columns = df.columns.str.strip().str.lower()
        
        # Convert to list of dicts with flexible column mapping
        flash_data = []
        for idx, row in df.iterrows():
            # Get serial number (try multiple column names)
            serial = str(row.get('id', '') or row.get('serial_number', '') or row.get('serialnumber', '') or row.get('s/n', '') or row.get('barcode', '') or '')
            
            # Get date (try multiple formats)
            date_val = row.get('date', '') or row.get('test_date', '') or row.get('testdate', '') or ''
            if pd.notna(date_val) and date_val != '':
                try:
                    if isinstance(date_val, (int, float)):
                        # Julian date format - convert to date string
                        date_str = str(int(date_val))
                    else:
                        date_str = str(date_val)
                except:
                    date_str = ''
            else:
                date_str = ''
            
            # Get module type
            module_type = str(row.get('module_type', '') or row.get('moduletype', '') or row.get('module type', '') or row.get('type', '') or '')
            
            # Get producer
            producer = str(row.get('producer', '') or row.get('manufacturer', '') or 'Gautam Solar')
            
            flash_data.append({
                'sn': int(row.get('sn', idx + 1)) if pd.notna(row.get('sn', None)) else idx + 1,
                'id': serial,
                'serial_number': serial,
                'module_type': module_type,
                'producer': producer,
                'date': date_str,
                'pmax': float(row.get('pmax', 0)) if pd.notna(row.get('pmax', None)) else 0,
                'isc': float(row.get('isc', 0)) if pd.notna(row.get('isc', None)) else 0,
                'voc': float(row.get('voc', 0)) if pd.notna(row.get('voc', None)) else 0,
                'ipm': float(row.get('ipm', 0)) if pd.notna(row.get('ipm', None)) else 0,
                'vpm': float(row.get('vpm', 0)) if pd.notna(row.get('vpm', None)) else 0,
                'ff': float(row.get('ff', 0)) if pd.notna(row.get('ff', None)) else 0,
                'rs': float(row.get('rs', 0)) if pd.notna(row.get('rs', None)) else 0,
                'rsh': float(row.get('rsh', 0)) if pd.notna(row.get('rsh', None)) else 0,
                'eff': float(row.get('eff', 0) or row.get('efficiency', 0)) if pd.notna(row.get('eff', None) or row.get('efficiency', None)) else 0,
                'module_temp': float(row.get('t_object', 0) or row.get('module_temp', 0) or row.get('moduletemp', 0) or row.get('cel_t', 0)) if pd.notna(row.get('t_object', None) or row.get('module_temp', None)) else 25,
                'ambient_temp': float(row.get('ambient', 0) or row.get('ambient_temp', 0) or row.get('ambienttemp', 0) or row.get('t_ambient', 0)) if pd.notna(row.get('ambient', None) or row.get('ambient_temp', None)) else 25,
                'irradiance': float(row.get('irr_target', 0) or row.get('irradiance', 0) or row.get('irr', 0)) if pd.notna(row.get('irr_target', None) or row.get('irradiance', None)) else 1000,
                'class': str(row.get('class', '') or row.get('irr_target class', '') or '')
            })
        
        return jsonify({
            'success': True,
            'data': flash_data,
            'count': len(flash_data)
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@coc_bp.route('/ftr/generate-flash-report', methods=['POST'])
def generate_flash_report():
    """Generate Flash Test Report PDF from data"""
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from io import BytesIO
        from datetime import datetime
        from flask import send_file
        
        data = request.get_json()
        flash_data = data.get('flash_data', [])
        pdi_number = data.get('pdi_number', 'PDI-UNKNOWN')
        order_number = data.get('order_number', '')
        
        if not flash_data:
            return jsonify({'error': 'Flash test data required'}), 400
        
        # Create PDF (landscape for better table fit)
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), 
                               rightMargin=10*mm, leftMargin=10*mm,
                               topMargin=15*mm, bottomMargin=15*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, 
                                     textColor=colors.HexColor('#1976d2'), 
                                     alignment=TA_CENTER, spaceAfter=10)
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, 
                                       alignment=TA_CENTER, spaceAfter=15)
        
        story = []
        
        # Title Page
        story.append(Spacer(1, 30*mm))
        story.append(Paragraph(f"<b>FLASH TEST REPORT</b>", title_style))
        story.append(Paragraph(f"<b>(IV Curve / Sun Simulator Test)</b>", subtitle_style))
        story.append(Spacer(1, 10*mm))
        story.append(Paragraph(f"PDI Number: <b>{pdi_number}</b>", styles['Normal']))
        if order_number:
            story.append(Paragraph(f"Order Number: <b>{order_number}</b>", styles['Normal']))
        story.append(Paragraph(f"Test Date: {datetime.now().strftime('%Y-%m-%d')}", styles['Normal']))
        story.append(Paragraph(f"Total Modules Tested: <b>{len(flash_data)}</b>", styles['Normal']))
        story.append(PageBreak())
        
        # Data Table - Split into pages if needed
        rows_per_page = 25
        for page_num in range(0, len(flash_data), rows_per_page):
            page_data = flash_data[page_num:page_num + rows_per_page]
            
            story.append(Paragraph(f"<b>Flash Test Results - Page {page_num//rows_per_page + 1}</b>", styles['Heading2']))
            story.append(Spacer(1, 3*mm))
            
            # Table header
            table_data = [['SN', 'Module ID / Serial Number', 'Pmax\n(W)', 'Isc\n(A)', 
                          'Voc\n(V)', 'Ipm\n(A)', 'Vpm\n(V)', 'FF\n(%)', 'Rs\n(Ω)', 'Eff\n(%)']]
            
            # Add data rows
            for row in page_data:
                table_data.append([
                    str(row.get('sn', '')),
                    str(row.get('id', row.get('serial_number', ''))),
                    f"{row.get('pmax', 0):.3f}",
                    f"{row.get('isc', 0):.3f}",
                    f"{row.get('voc', 0):.3f}",
                    f"{row.get('ipm', 0):.3f}",
                    f"{row.get('vpm', 0):.3f}",
                    f"{row.get('ff', 0):.3f}",
                    f"{row.get('rs', 0):.6f}",
                    f"{row.get('eff', 0):.3f}"
                ])
            
            # Create table
            col_widths = [15*mm, 55*mm, 20*mm, 18*mm, 18*mm, 18*mm, 18*mm, 18*mm, 22*mm, 18*mm]
            data_table = Table(table_data, colWidths=col_widths, repeatRows=1)
            data_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')])
            ]))
            story.append(data_table)
            
            if page_num + rows_per_page < len(flash_data):
                story.append(PageBreak())
        
        # Summary Page
        story.append(PageBreak())
        story.append(Paragraph("<b>SUMMARY STATISTICS</b>", styles['Heading2']))
        story.append(Spacer(1, 5*mm))
        
        # Calculate statistics
        pmax_values = [r.get('pmax', 0) for r in flash_data]
        eff_values = [r.get('eff', 0) for r in flash_data]
        ff_values = [r.get('ff', 0) for r in flash_data]
        
        summary_data = [
            ['Parameter', 'Minimum', 'Maximum', 'Average'],
            ['Pmax (W)', f"{min(pmax_values):.3f}", f"{max(pmax_values):.3f}", f"{sum(pmax_values)/len(pmax_values):.3f}"],
            ['Efficiency (%)', f"{min(eff_values):.3f}", f"{max(eff_values):.3f}", f"{sum(eff_values)/len(eff_values):.3f}"],
            ['Fill Factor (%)', f"{min(ff_values):.3f}", f"{max(ff_values):.3f}", f"{sum(ff_values)/len(ff_values):.3f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[60*mm, 40*mm, 40*mm, 40*mm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2196F3')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E3F2FD')])
        ]))
        story.append(summary_table)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Flash_Test_Report_{pdi_number}_{datetime.now().strftime("%Y%m%d")}.pdf'
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@coc_bp.route('/manual-entry', methods=['POST'])
def manual_coc_entry():
    """Add COC entry manually with PDF uploads"""
    try:
        from werkzeug.utils import secure_filename
        from flask import current_app
        import os
        from datetime import datetime
        
        # Get form data
        material_name = request.form.get('material_name')
        invoice_no = request.form.get('invoice_no')
        brand = request.form.get('brand', '')
        lot_batch_no = request.form.get('lot_batch_no', '')
        coc_qty = request.form.get('coc_qty')
        invoice_qty = request.form.get('invoice_qty', '')
        invoice_date = request.form.get('invoice_date')
        
        # Validate required fields
        if not all([material_name, invoice_no, coc_qty, invoice_date]):
            return jsonify({'error': 'Material name, invoice number, COC qty, and invoice date are required'}), 400
        
        # Handle file uploads
        coc_pdf = request.files.get('coc_pdf')
        iqc_pdf = request.files.get('iqc_pdf')
        
        coc_pdf_path = None
        iqc_pdf_path = None
        
        # Create uploads directory
        upload_base = os.path.join(current_app.config.get('UPLOAD_FOLDER', 'uploads'), 'coc_documents')
        os.makedirs(upload_base, exist_ok=True)
        
        # Save COC PDF
        if coc_pdf and coc_pdf.filename:
            filename = secure_filename(f"COC_{invoice_no}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
            filepath = os.path.join(upload_base, filename)
            coc_pdf.save(filepath)
            coc_pdf_path = f"/uploads/coc_documents/{filename}"
        
        # Save IQC PDF
        if iqc_pdf and iqc_pdf.filename:
            filename = secure_filename(f"IQC_{invoice_no}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
            filepath = os.path.join(upload_base, filename)
            iqc_pdf.save(filepath)
            iqc_pdf_path = f"/uploads/coc_documents/{filename}"
        
        # Return COC data in API format
        coc_data = {
            'id': f'manual_{datetime.now().timestamp()}',
            'invoice_no': invoice_no,
            'material_name': material_name,
            'brand': brand,
            'lot_batch_no': lot_batch_no,
            'coc_qty': coc_qty,
            'invoice_qty': invoice_qty,
            'invoice_date': invoice_date,
            'entry_date': datetime.now().strftime('%Y-%m-%d'),
            'coc_document_url': f"http://localhost:5003{coc_pdf_path}" if coc_pdf_path else None,
            'iqc_document_url': f"http://localhost:5003{iqc_pdf_path}" if iqc_pdf_path else None,
            'store_name': 'Manual Entry',
            'product_type': material_name,
            'is_manual': True
        }
        
        return jsonify({
            'success': True,
            'message': 'Manual COC entry added successfully',
            'coc_data': coc_data
        }), 201
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
