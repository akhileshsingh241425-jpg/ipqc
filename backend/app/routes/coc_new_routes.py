"""
COC Document Management API Routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.database import db
from app.models.pdi_models import COCDocument, MasterOrder

coc_new_bp = Blueprint('coc_new', __name__)

# Get all COC documents
@coc_new_bp.route('/api/coc-documents', methods=['GET'])
def get_coc_documents():
    try:
        order_id = request.args.get('order_id')
        status = request.args.get('status')
        
        query = COCDocument.query
        if order_id:
            query = query.filter_by(order_id=order_id)
        if status:
            query = query.filter_by(status=status)
        
        documents = query.order_by(COCDocument.created_at.desc()).all()
        return jsonify([doc.to_dict() for doc in documents]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get single COC document
@coc_new_bp.route('/api/coc-documents/<int:coc_id>', methods=['GET'])
def get_coc_document(coc_id):
    try:
        coc = COCDocument.query.get_or_404(coc_id)
        return jsonify(coc.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 404

# Create COC document
@coc_new_bp.route('/api/coc-documents', methods=['POST'])
def create_coc_document():
    try:
        data = request.get_json()
        
        order_id = int(data.get('orderId'))
        total_cells = int(data.get('totalCellsQty'))
        
        # Verify order exists
        order = MasterOrder.query.get_or_404(order_id)
        
        coc = COCDocument(
            order_id=order_id,
            invoice_number=data.get('invoiceNumber'),
            coc_number=data.get('cocNumber'),
            total_cells_qty=total_cells,
            cells_used=0,
            cells_remaining=total_cells,
            cell_batch_number=data.get('cellBatchNumber'),
            supplier_name=data.get('supplierName'),
            received_date=datetime.strptime(data.get('receivedDate'), '%Y-%m-%d').date() if data.get('receivedDate') else None,
            document_path=data.get('documentPath'),
            status='active',
            notes=data.get('notes')
        )
        
        db.session.add(coc)
        db.session.commit()
        
        return jsonify(coc.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update COC document
@coc_new_bp.route('/api/coc-documents/<int:coc_id>', methods=['PUT'])
def update_coc_document(coc_id):
    try:
        coc = COCDocument.query.get_or_404(coc_id)
        data = request.get_json()
        
        if 'invoiceNumber' in data:
            coc.invoice_number = data['invoiceNumber']
        if 'cocNumber' in data:
            coc.coc_number = data['cocNumber']
        if 'totalCellsQty' in data:
            old_total = coc.total_cells_qty
            new_total = int(data['totalCellsQty'])
            coc.total_cells_qty = new_total
            coc.cells_remaining = new_total - coc.cells_used
        if 'cellBatchNumber' in data:
            coc.cell_batch_number = data['cellBatchNumber']
        if 'supplierName' in data:
            coc.supplier_name = data['supplierName']
        if 'receivedDate' in data:
            coc.received_date = datetime.strptime(data['receivedDate'], '%Y-%m-%d').date()
        if 'documentPath' in data:
            coc.document_path = data['documentPath']
        if 'status' in data:
            coc.status = data['status']
        if 'notes' in data:
            coc.notes = data['notes']
        
        coc.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(coc.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete COC document
@coc_new_bp.route('/api/coc-documents/<int:coc_id>', methods=['DELETE'])
def delete_coc_document(coc_id):
    try:
        coc = COCDocument.query.get_or_404(coc_id)
        
        # Check if COC is being used
        if coc.cells_used > 0:
            return jsonify({'error': 'Cannot delete COC that has been used in PDI batches'}), 400
        
        db.session.delete(coc)
        db.session.commit()
        
        return jsonify({'message': 'COC document deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Get COC usage history
@coc_new_bp.route('/api/coc-documents/<int:coc_id>/usage', methods=['GET'])
def get_coc_usage(coc_id):
    try:
        coc = COCDocument.query.get_or_404(coc_id)
        
        usage_data = {
            'cocNumber': coc.coc_number,
            'invoiceNumber': coc.invoice_number,
            'totalCellsQty': coc.total_cells_qty,
            'cellsUsed': coc.cells_used,
            'cellsRemaining': coc.cells_remaining,
            'utilizationPercent': round((coc.cells_used / coc.total_cells_qty) * 100, 2) if coc.total_cells_qty > 0 else 0,
            'status': coc.status,
            'usageHistory': [usage.to_dict() for usage in coc.pdi_usage]
        }
        
        return jsonify(usage_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get available COCs for an order
@coc_new_bp.route('/api/orders/<int:order_id>/available-cocs', methods=['GET'])
def get_available_cocs(order_id):
    try:
        # Get COCs with remaining cells
        cocs = COCDocument.query.filter(
            COCDocument.order_id == order_id,
            COCDocument.status == 'active',
            COCDocument.cells_remaining > 0
        ).all()
        
        return jsonify([{
            'id': coc.id,
            'invoiceNumber': coc.invoice_number,
            'cocNumber': coc.coc_number,
            'cellsRemaining': coc.cells_remaining,
            'totalCellsQty': coc.total_cells_qty,
            'utilizationPercent': round((coc.cells_used / coc.total_cells_qty) * 100, 2)
        } for coc in cocs]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
