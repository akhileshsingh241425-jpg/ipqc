"""
Master Orders API Routes
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.database import db
from app.models.pdi_models import MasterOrder

orders_bp = Blueprint('orders', __name__)

# Get all orders
@orders_bp.route('/api/orders', methods=['GET'])
def get_orders():
    try:
        company_id = request.args.get('company_id')
        
        query = MasterOrder.query
        if company_id:
            query = query.filter_by(company_id=company_id)
        
        orders = query.order_by(MasterOrder.created_at.desc()).all()
        return jsonify([order.to_dict() for order in orders]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get single order
@orders_bp.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order(order_id):
    try:
        order = MasterOrder.query.get_or_404(order_id)
        return jsonify(order.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 404

# Create order
@orders_bp.route('/api/orders', methods=['POST'])
def create_order():
    try:
        data = request.get_json()
        
        # Calculate total cells required
        total_modules = int(data.get('totalModules'))
        cells_per_module = int(data.get('cellsPerModule', 66))
        total_cells = total_modules * cells_per_module
        
        order = MasterOrder(
            company_id=int(data.get('companyId')),
            order_number=data.get('orderNumber'),
            customer_po=data.get('customerPO'),
            total_modules=total_modules,
            module_wattage=int(data.get('moduleWattage', 630)),
            cells_per_module=cells_per_module,
            total_cells_required=total_cells,
            order_date=datetime.strptime(data.get('orderDate'), '%Y-%m-%d').date() if data.get('orderDate') else None,
            target_completion_date=datetime.strptime(data.get('targetCompletionDate'), '%Y-%m-%d').date() if data.get('targetCompletionDate') else None,
            status=data.get('status', 'pending')
        )
        
        db.session.add(order)
        db.session.commit()
        
        return jsonify(order.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update order
@orders_bp.route('/api/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    try:
        order = MasterOrder.query.get_or_404(order_id)
        data = request.get_json()
        
        if 'orderNumber' in data:
            order.order_number = data['orderNumber']
        if 'customerPO' in data:
            order.customer_po = data['customerPO']
        if 'totalModules' in data:
            order.total_modules = int(data['totalModules'])
            order.total_cells_required = order.total_modules * order.cells_per_module
        if 'moduleWattage' in data:
            order.module_wattage = int(data['moduleWattage'])
        if 'cellsPerModule' in data:
            order.cells_per_module = int(data['cellsPerModule'])
            order.total_cells_required = order.total_modules * order.cells_per_module
        if 'orderDate' in data:
            order.order_date = datetime.strptime(data['orderDate'], '%Y-%m-%d').date()
        if 'targetCompletionDate' in data:
            order.target_completion_date = datetime.strptime(data['targetCompletionDate'], '%Y-%m-%d').date()
        if 'status' in data:
            order.status = data['status']
        
        order.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(order.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete order
@orders_bp.route('/api/orders/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    try:
        order = MasterOrder.query.get_or_404(order_id)
        db.session.delete(order)
        db.session.commit()
        
        return jsonify({'message': 'Order deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Get order statistics
@orders_bp.route('/api/orders/<int:order_id>/stats', methods=['GET'])
def get_order_stats(order_id):
    try:
        order = MasterOrder.query.get_or_404(order_id)
        
        # Calculate stats from PDI batches
        total_planned = sum([batch.planned_modules for batch in order.pdi_batches])
        total_produced = sum([batch.actual_modules for batch in order.pdi_batches])
        completed_batches = len([b for b in order.pdi_batches if b.status == 'completed'])
        
        # COC stats
        total_cells_available = sum([coc.total_cells_qty for coc in order.coc_documents])
        total_cells_used = sum([coc.cells_used for coc in order.coc_documents])
        
        stats = {
            'orderNumber': order.order_number,
            'totalModules': order.total_modules,
            'totalCellsRequired': order.total_cells_required,
            'totalPlanned': total_planned,
            'totalProduced': total_produced,
            'remaining': order.total_modules - total_produced,
            'progressPercent': round((total_produced / order.total_modules) * 100, 2) if order.total_modules > 0 else 0,
            'totalBatches': len(order.pdi_batches),
            'completedBatches': completed_batches,
            'totalCellsAvailable': total_cells_available,
            'totalCellsUsed': total_cells_used,
            'cellsRemaining': total_cells_available - total_cells_used,
            'status': order.status
        }
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
