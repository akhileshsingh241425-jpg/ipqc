from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.database import db, Company, ProductionRecord, RejectedModule, BomMaterial
from app.models.coc_tracking import COCUsageTracking

company_bp = Blueprint('company', __name__)

# BOM Materials list - Aligned with MRP API material names
# API endpoint: https://umanmrp.in/a/get_assigned_coc_records.php
BOM_MATERIALS = [
    "Solar Cell",       # material_id: 1
    "EVA",              # material_id: 2 (added - was missing)
    "Glass",            # material_id: 11 (renamed from FRONT/BACK GLASS)
    "FRONT GLASS",      # kept for backward compatibility
    "BACK GLASS",       # kept for backward compatibility
    "Ribbon",           # material_id: 5 (simplified)
    "RIBBON",           # kept for backward compatibility
    "RIBBON (0.26 mm)", # kept for backward compatibility
    "RIBBON (4.0X0.4)", # kept for backward compatibility
    "RIBBON (6.0X0.4)", # kept for backward compatibility
    "Ribbon(BUSBAR) 4mm",
    "Ribbon(BUSBAR) 6mm",
    "Flux",             # material_id: 7 (case normalized)
    "FLUX",             # kept for backward compatibility
    "EPE",              # material_id: 14
    "EPE FRONT",        # kept for backward compatibility
    "Aluminium Frame",  # material_id: 12
    "Aluminium Frame LONG",  # Frontend variant
    "Aluminium Frame SHORT", # Frontend variant
    "Sealent",          # material_id: 6 (case normalized)
    "SEALENT",          # kept for backward compatibility
    "JB Potting",       # material_id: 10 (simplified from "JB Potting (A and B)")
    "JB Potting (A and B)", # kept for backward compatibility
    "JB Potting A",     # Frontend variant - Part A
    "JB Potting B",     # Frontend variant - Part B
    "Junction Box",     # material_id: 9 (case normalized)
    "JUNCTION BOX",     # kept for backward compatibility
    "RFID"              # material_id: 8 (added - was missing)
]

# MRP API Material Name Mapping (API name -> normalized names for matching)
MRP_MATERIAL_MAPPING = {
    'solar cell': ['solar cell'],
    'eva': ['eva'],
    'glass': ['glass', 'front glass', 'back glass'],
    'ribbon': ['ribbon', 'ribbon (0.26 mm)', 'ribbon (4.0x0.4)', 'ribbon (6.0x0.4)', 'ribbon(busbar) 4mm', 'ribbon(busbar) 6mm'],
    'flux': ['flux'],
    'epe': ['epe', 'epe front'],
    'aluminium frame': ['aluminium frame', 'aluminum frame'],
    'sealent': ['sealent', 'sealant'],
    'jb potting': ['jb potting', 'jb potting (a and b)'],
    'junction box': ['junction box'],
    'rfid': ['rfid']
}

def normalize_material_name(material_name):
    """Normalize material name for matching with MRP API"""
    if not material_name:
        return None
    
    name_lower = material_name.lower().strip()
    
    # Find matching MRP category
    for mrp_name, variations in MRP_MATERIAL_MAPPING.items():
        if name_lower in variations or mrp_name in name_lower:
            return mrp_name
    
    return name_lower

# Get all companies
@company_bp.route('/api/companies', methods=['GET'])
def get_companies():
    try:
        companies = Company.query.all()
        return jsonify([company.to_dict() for company in companies]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get unique supplier/company names from BOM materials
@company_bp.route('/api/bom-suppliers', methods=['GET'])
def get_bom_suppliers():
    try:
        import requests
        from datetime import datetime, timedelta
        
        # Get material name filter from query params
        material_filter = request.args.get('material', '').lower()
        print(f"🔍 BOM Suppliers Request - Material Filter: {material_filter}")
        
        # Fetch COC data from API to get company names
        COC_API_URL = 'https://umanmrp.in/api/coc_api.php'
        
        # Get last 6 months data
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        
        post_data = {
            'from': from_date,
            'to': to_date
        }
        
        print(f"🌐 Calling COC API: {COC_API_URL}")
        print(f"📅 Date Range: {from_date} to {to_date}")
        
        # Fetch from COC API
        response = requests.post(COC_API_URL, json=post_data, timeout=10)
        print(f"✅ COC API Status: {response.status_code}")
        
        suppliers = []
        
        if response.status_code == 200:
            coc_data = response.json()
            print(f"📦 COC API Response Type: {type(coc_data)}")
            print(f"📋 COC API Keys: {coc_data.keys() if isinstance(coc_data, dict) else 'Not a dict'}")
            
            # Extract COC documents with date info for FIFO
            coc_documents_list = []
            
            if isinstance(coc_data, dict) and 'data' in coc_data:
                coc_documents = coc_data['data']
                print(f"✅ Using coc_data['data'] - {len(coc_documents)} documents")
            elif isinstance(coc_data, list):
                coc_documents = coc_data
                print(f"✅ Using coc_data directly - {len(coc_documents)} documents")
            else:
                coc_documents = []
                print("❌ COC data format not recognized")
            
            # Collect COC documents with brand and date for FIFO sorting
            matched_count = 0
            for doc in coc_documents:
                if isinstance(doc, dict) and doc.get('brand'):
                    # COC API uses 'material_name' not 'specification'
                    material_name = doc.get('material_name', '').lower()
                    brand = doc.get('brand')
                    invoice_date = doc.get('invoice_date', '')
                    
                    # Filter by material type if provided using normalized matching
                    should_include = False
                    if material_filter:
                        # Use normalized material matching
                        normalized_api_material = normalize_material_name(material_name)
                        normalized_filter = normalize_material_name(material_filter)
                        
                        if normalized_api_material and normalized_filter:
                            if normalized_api_material == normalized_filter:
                                should_include = True
                        
                        # Fallback: Check if material_name matches filter directly
                        if not should_include:
                            if material_filter in material_name or material_name in material_filter:
                                should_include = True
                            # Special cases for common materials
                            elif 'cell' in material_filter and 'cell' in material_name:
                                should_include = True
                            elif 'glass' in material_filter and 'glass' in material_name:
                                should_include = True
                            elif 'ribbon' in material_filter and 'ribbon' in material_name:
                                should_include = True
                            elif 'eva' in material_filter and 'eva' in material_name:
                                should_include = True
                            elif 'flux' in material_filter and 'flux' in material_name:
                                should_include = True
                            elif 'bus' in material_filter and 'bus' in material_name:
                                should_include = True
                            elif 'frame' in material_filter and 'frame' in material_name:
                                should_include = True
                            elif 'sealent' in material_filter and 'sealent' in material_name:
                                should_include = True
                            elif 'jb' in material_filter and 'jb' in material_name:
                                should_include = True
                            elif 'potting' in material_filter and 'potting' in material_name:
                                should_include = True
                            elif 'junction' in material_filter and 'junction' in material_name:
                                should_include = True
                            elif 'rfid' in material_filter and 'rfid' in material_name:
                                should_include = True
                    else:
                        # No filter - add all
                        should_include = True
                    
                    if should_include:
                        coc_documents_list.append({
                            'brand': brand,
                            'invoice_date': invoice_date
                        })
                        matched_count += 1
            
            print(f"🎯 Matched {matched_count} companies for filter '{material_filter}'")
            
            # FIFO sorting - oldest invoice first
            try:
                from datetime import datetime
                coc_documents_list.sort(key=lambda x: datetime.strptime(x['invoice_date'], '%Y-%m-%d') if x['invoice_date'] else datetime.min)
                print(f"📅 FIFO Sorted by invoice date (oldest first)")
            except Exception as e:
                print(f"⚠️ Could not sort by date: {e}")
            
            # Extract unique brands while maintaining FIFO order
            seen_brands = set()
            suppliers = []
            for doc in coc_documents_list:
                brand = doc['brand']
                if brand not in seen_brands:
                    seen_brands.add(brand)
                    suppliers.append(brand)
            
            print(f"✅ Returning {len(suppliers)} suppliers (FIFO ordered): {suppliers[:5]}...")
        else:
            print(f"❌ COC API failed with status: {response.status_code}")
        
        return jsonify({'suppliers': suppliers}), 200
    except Exception as e:
        print(f"Error fetching COC suppliers: {str(e)}")
        # Fallback to empty list if API fails
        return jsonify({'suppliers': []}), 200

# Get single company
@company_bp.route('/api/companies/<int:company_id>', methods=['GET'])
def get_company(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        return jsonify(company.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 404

# Create company
@company_bp.route('/api/companies', methods=['POST'])
def create_company():
    try:
        data = request.get_json()
        
        company = Company(
            company_name=data.get('companyName'),
            module_wattage=int(data.get('moduleWattage', 625)),
            module_type=data.get('moduleType', 'Topcon'),
            cells_per_module=int(data.get('cellsPerModule', 132)),
            cells_received_qty=int(data.get('cellsReceivedQty')) if data.get('cellsReceivedQty') else None,
            cells_received_mw=float(data.get('cellsReceivedMW')) if data.get('cellsReceivedMW') else None
        )
        
        db.session.add(company)
        db.session.commit()
        
        return jsonify(company.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update company
@company_bp.route('/api/companies/<int:company_id>', methods=['PUT'])
def update_company(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        data = request.get_json()
        
        company.company_name = data.get('companyName', company.company_name)
        company.module_wattage = int(data.get('moduleWattage', company.module_wattage))
        company.module_type = data.get('moduleType', company.module_type)
        company.cells_per_module = int(data.get('cellsPerModule', company.cells_per_module))
        company.cells_received_qty = int(data.get('cellsReceivedQty')) if data.get('cellsReceivedQty') else None
        company.cells_received_mw = float(data.get('cellsReceivedMW')) if data.get('cellsReceivedMW') else None
        
        # Update cell efficiency received (JSON)
        if 'cellEfficiencyReceived' in data:
            import json
            company.cell_efficiency_received = json.dumps(data.get('cellEfficiencyReceived', {}))
        
        db.session.commit()
        
        return jsonify(company.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete company
@company_bp.route('/api/companies/<int:company_id>', methods=['DELETE'])
def delete_company(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        db.session.delete(company)
        db.session.commit()
        
        return jsonify({'message': 'Company deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Add production record
@company_bp.route('/api/companies/<int:company_id>/production', methods=['POST'])
def add_production_record(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        data = request.get_json()
        
        # Validate PDI Number and Running Order
        pdi = data.get('pdi', '').strip()
        running_order = data.get('runningOrder', '').strip()
        
        if not pdi:
            return jsonify({'error': 'PDI Number is mandatory'}), 400
        
        if not running_order:
            return jsonify({'error': 'Running Order is mandatory'}), 400
        
        # Get total production quantity
        total_production = int(data.get('dayProduction', 0)) + int(data.get('nightProduction', 0))
        
        # Validate raw material availability only if production > 0
        if total_production > 0:
            from app.services.coc_service import COCService
            material_requirements = {
                'Solar Cell': total_production * company.cells_per_module,
                'Glass': total_production * 2,  # Front + Back
                'Aluminium Frame': total_production * 4,  # 4 pieces per module
                'Ribbon': total_production * 0.5,  # Approximate
                'EPE': total_production * 2  # Packaging
            }
            
            validation = COCService.validate_production(company.company_name, material_requirements)
            if not validation.get('valid'):
                return jsonify({
                    'error': 'Insufficient raw material for production',
                    'message': 'Production cannot proceed due to insufficient raw materials',
                    'details': validation.get('insufficient', []),
                    'required_materials': material_requirements
                }), 400
        
        record = ProductionRecord(
            company_id=company_id,
            date=datetime.strptime(data.get('date'), '%Y-%m-%d').date(),
            day_production=int(data.get('dayProduction', 0)),
            night_production=int(data.get('nightProduction', 0)),
            pdi=pdi,
            running_order=running_order,
            pdi_approved=data.get('pdiApproved', False),
            cell_efficiency=float(data.get('cellEfficiency')) if data.get('cellEfficiency') else None,
            day_cell_efficiency=float(data.get('dayCellEfficiency')) if data.get('dayCellEfficiency') else None,
            night_cell_efficiency=float(data.get('nightCellEfficiency')) if data.get('nightCellEfficiency') else None,
            cell_rejection_percent=float(data.get('cellRejectionPercent', 0.0)),
            module_rejection_percent=float(data.get('moduleRejectionPercent', 0.0)),
            cell_supplier=data.get('cellSupplier'),  # Cell supplier for inventory tracking
            is_closed=False
        )
        
        db.session.add(record)
        db.session.commit()
        
        # Auto-consume materials only if production > 0
        if total_production > 0:
            from app.services.coc_service import COCService
            for material_name, quantity in material_requirements.items():
                COCService.consume_material(
                    company.company_name,
                    material_name,
                    quantity,
                    record.date,
                    pdi  # Use PDI number instead of lot number
                )
        
        # Initialize BOM materials for this record (14 fixed materials for both shifts)
        for material_name in BOM_MATERIALS:
            # Create Day shift entry
            bom_material_day = BomMaterial(
                production_record_id=record.id,
                material_name=material_name,
                shift='day'
            )
            db.session.add(bom_material_day)
            
            # Create Night shift entry
            bom_material_night = BomMaterial(
                production_record_id=record.id,
                material_name=material_name,
                shift='night'
            )
            db.session.add(bom_material_night)
        
        db.session.commit()
        
        return jsonify({'record': record.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Update production record
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>', methods=['PUT'])
def update_production_record(company_id, record_id):
    try:
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        
        # Check if record is closed/locked
        if record.is_closed:
            return jsonify({'error': 'This production record is closed and cannot be edited'}), 403
        
        data = request.get_json()
        
        if data.get('date'):
            record.date = datetime.strptime(data.get('date'), '%Y-%m-%d').date()
        if 'runningOrder' in data:
            record.running_order = data.get('runningOrder')
        record.day_production = int(data.get('dayProduction', record.day_production))
        record.night_production = int(data.get('nightProduction', record.night_production))
        record.pdi = data.get('pdi', record.pdi)
        if 'pdiApproved' in data:
            record.pdi_approved = data.get('pdiApproved')
        record.serial_number_start = data.get('serialNumberStart', record.serial_number_start)
        record.serial_number_end = data.get('serialNumberEnd', record.serial_number_end)
        record.serial_count = int(data.get('serialCount', record.serial_count or 0))
        record.cell_rejection_percent = float(data.get('cellRejectionPercent', record.cell_rejection_percent))
        record.module_rejection_percent = float(data.get('moduleRejectionPercent', record.module_rejection_percent))
        if 'cellEfficiency' in data:
            record.cell_efficiency = float(data.get('cellEfficiency')) if data.get('cellEfficiency') else None
        if 'dayCellEfficiency' in data:
            record.day_cell_efficiency = float(data.get('dayCellEfficiency')) if data.get('dayCellEfficiency') else None
        if 'nightCellEfficiency' in data:
            record.night_cell_efficiency = float(data.get('nightCellEfficiency')) if data.get('nightCellEfficiency') else None
        
        # Update new fields
        if 'lotNumber' in data:
            record.lot_number = data.get('lotNumber')
        if 'bomImage' in data:
            record.bom_image = data.get('bomImage')
        if 'cellSupplier' in data:
            record.cell_supplier = data.get('cellSupplier')  # Cell supplier for inventory tracking
        
        # Update COC materials (separate from BOM materials - for customer documentation)
        if 'cocMaterials' in data:
            import json
            coc_materials_data = data.get('cocMaterials', [])
            record.coc_materials = json.dumps(coc_materials_data)
        
        # Update BOM materials (daily production usage tracking)
        if 'bomMaterials' in data:
            # Update BomMaterial records (new simplified structure)
            import json
            bom_data = data.get('bomMaterials', [])
            for bom_item in bom_data:
                if 'id' in bom_item:
                    # Find and update existing BomMaterial
                    bom_material = BomMaterial.query.get(bom_item['id'])
                    if bom_material and bom_material.production_record_id == record.id:
                        # Update fields
                        if 'company' in bom_item:
                            bom_material.company = bom_item['company']
                        if 'lotBatchNo' in bom_item:
                            bom_material.lot_batch_no = bom_item['lotBatchNo']
                        if 'imagePaths' in bom_item:
                            # Convert array to JSON string
                            bom_material.image_paths = json.dumps(bom_item['imagePaths'])
                        if 'shift' in bom_item:
                            bom_material.shift = bom_item['shift']
        
        db.session.commit()
        
        return jsonify(record.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete production record
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>', methods=['DELETE'])
def delete_production_record(company_id, record_id):
    try:
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({'message': 'Production record deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Add rejected module
@company_bp.route('/api/companies/<int:company_id>/rejections', methods=['POST'])
def add_rejected_module(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        data = request.get_json()
        
        rejection = RejectedModule(
            company_id=company_id,
            serial_number=data.get('serialNumber'),
            rejection_date=datetime.strptime(data.get('rejectionDate'), '%Y-%m-%d').date(),
            reason=data.get('reason', ''),
            stage=data.get('stage', 'Visual Inspection')
        )
        
        db.session.add(rejection)
        db.session.commit()
        
        return jsonify(rejection.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Bulk add rejected modules (Excel upload)
@company_bp.route('/api/companies/<int:company_id>/rejections/bulk', methods=['POST'])
def bulk_add_rejections(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        data = request.get_json()
        rejections_data = data.get('rejections', [])
        
        rejections = []
        for rej_data in rejections_data:
            rejection = RejectedModule(
                company_id=company_id,
                serial_number=rej_data.get('serialNumber'),
                rejection_date=datetime.strptime(rej_data.get('rejectionDate'), '%Y-%m-%d').date(),
                reason=rej_data.get('reason', ''),
                stage=rej_data.get('stage', 'Visual Inspection')
            )
            rejections.append(rejection)
        
        db.session.add_all(rejections)
        db.session.commit()
        
        return jsonify({'message': f'{len(rejections)} rejections added successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete rejected module
@company_bp.route('/api/companies/<int:company_id>/rejections/<int:rejection_id>', methods=['DELETE'])
def delete_rejected_module(company_id, rejection_id):
    try:
        rejection = RejectedModule.query.filter_by(id=rejection_id, company_id=company_id).first_or_404()
        db.session.delete(rejection)
        db.session.commit()
        
        return jsonify({'message': 'Rejection deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Delete all rejected modules for a company
@company_bp.route('/api/companies/<int:company_id>/rejections', methods=['DELETE'])
def delete_all_rejections(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        RejectedModule.query.filter_by(company_id=company_id).delete()
        db.session.commit()
        
        return jsonify({'message': 'All rejections deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Upload BOM material image and lot number
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>/bom-material', methods=['POST'])
def upload_bom_material(company_id, record_id):
    try:
        from flask import current_app
        from werkzeug.utils import secure_filename
        import os
        import json
        
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        
        # Check if record is closed
        if record.is_closed:
            return jsonify({'error': 'This production record is closed'}), 403
        
        material_name = request.form.get('materialName')
        lot_batch_no = request.form.get('lotBatchNo', '')
        company = request.form.get('company', '')
        shift = request.form.get('shift', 'day')  # day or night
        cell_efficiency = request.form.get('cellEfficiency', '')  # Cell efficiency for Solar Cell
        
        # Debug logging
        print(f"[BOM DEBUG] Received material: '{material_name}', lot: '{lot_batch_no}', company: '{company}', shift: '{shift}', efficiency: '{cell_efficiency}'")
        
        if not material_name or material_name not in BOM_MATERIALS:
            print(f"[BOM DEBUG] Material validation failed - material_name: '{material_name}', in list: {material_name in BOM_MATERIALS if material_name else 'N/A'}")
            return jsonify({'error': f'Invalid material name: {material_name}'}), 400
        
        # Find or create BOM material record
        bom_material = BomMaterial.query.filter_by(
            production_record_id=record_id,
            material_name=material_name,
            shift=shift
        ).first()
        
        if not bom_material:
            bom_material = BomMaterial(
                production_record_id=record_id,
                material_name=material_name,
                shift=shift
            )
            db.session.add(bom_material)
        
        # Update fields ONLY if new value is provided (don't overwrite with empty)
        if lot_batch_no and lot_batch_no.strip():
            bom_material.lot_batch_no = lot_batch_no
        if company and company.strip():
            bom_material.company = company
        
        # Update cell efficiency for Solar Cell
        if cell_efficiency and cell_efficiency.strip():
            try:
                bom_material.cell_efficiency = float(cell_efficiency)
            except ValueError:
                pass  # Invalid efficiency value, skip
        
        # Handle multiple image uploads
        uploaded_images = []
        if 'images' in request.files:
            files = request.files.getlist('images')
            
            # Create uploads/bom_materials directory
            upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'bom_materials')
            os.makedirs(upload_folder, exist_ok=True)
            
            ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}
            
            for file in files:
                if file.filename != '':
                    if '.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS:
                        # Generate unique filename
                        safe_material_name = material_name.replace(' ', '_').replace('(', '').replace(')', '').lower()
                        filename = secure_filename(
                            f"{company_id}_{record_id}_{safe_material_name}_{shift}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.{file.filename.rsplit('.', 1)[1].lower()}"
                        )
                        filepath = os.path.join(upload_folder, filename)
                        
                        # Save file
                        file.save(filepath)
                        
                        # Store relative path
                        uploaded_images.append(f"uploads/bom_materials/{filename}")
        
        # Update image_paths JSON array
        if uploaded_images:
            # Load existing paths if any
            existing_paths = []
            if bom_material.image_paths:
                try:
                    existing_paths = json.loads(bom_material.image_paths)
                except:
                    existing_paths = []
            
            # Only append images that don't already exist (prevent duplicates)
            for new_image in uploaded_images:
                # Extract just the filename for comparison (not the full path)
                new_filename = new_image.split('/')[-1]
                # Check if any existing path contains this filename
                if not any(new_filename in existing_path for existing_path in existing_paths):
                    existing_paths.append(new_image)
            
            bom_material.image_paths = json.dumps(existing_paths)
        
        # Track COC usage (if COC data is provided)
        coc_invoice = request.form.get('cocInvoice', '')
        coc_batch = request.form.get('cocBatch', '')
        coc_qty_used = request.form.get('cocQtyUsed', '')
        
        if coc_invoice and coc_batch:
            # Check if this COC usage already exists
            existing_tracking = COCUsageTracking.query.filter_by(
                company_id=company_id,
                pdi_number=record.pdi_number,
                shift=shift,
                material_name=material_name,
                coc_invoice_number=coc_invoice
            ).first()
            
            if not existing_tracking:
                # Create new COC tracking entry
                coc_tracking = COCUsageTracking(
                    company_id=company_id,
                    pdi_number=record.pdi_number,
                    shift=shift,
                    material_name=material_name,
                    coc_invoice_number=coc_invoice,
                    coc_brand=coc_batch,  # Using batch as brand identifier
                    coc_qty_used=float(coc_qty_used) if coc_qty_used else 0.0,
                    coc_remaining_gap=0.0,  # Can be calculated from API
                    usage_date=datetime.now()
                )
                db.session.add(coc_tracking)
                print(f"[COC TRACKING] Added: {material_name} - Invoice: {coc_invoice} - PDI: {record.pdi_number}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'BOM material updated successfully',
            'bomMaterial': bom_material.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error uploading BOM material: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Upload IPQC PDF for production record (with shift support)
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>/ipqc-pdf', methods=['POST'])
def upload_ipqc_pdf(company_id, record_id):
    try:
        from flask import current_app
        from werkzeug.utils import secure_filename
        import os
        
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        
        # Check if record is closed
        if record.is_closed:
            return jsonify({'error': 'This production record is closed'}), 403
        
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # Check file extension
        if not (file.filename.lower().endswith('.pdf')):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Get shift parameter (default to 'day' for backward compatibility)
        shift = request.form.get('shift', 'day').lower()
        if shift not in ['day', 'night']:
            return jsonify({'error': 'Invalid shift. Must be "day" or "night"'}), 400
        
        # Create uploads/ipqc_pdfs directory
        upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'ipqc_pdfs')
        os.makedirs(upload_folder, exist_ok=True)
        
        # Generate unique filename with shift
        filename = secure_filename(f"{company_id}_{record_id}_{shift}_ipqc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
        filepath = os.path.join(upload_folder, filename)
        
        # Save file
        file.save(filepath)
        
        # Update record - store relative path from backend directory based on shift
        relative_path = f"uploads/ipqc_pdfs/{filename}"
        if shift == 'day':
            record.day_ipqc_pdf = relative_path
        else:  # night
            record.night_ipqc_pdf = relative_path
        
        # Keep backward compatibility - set ipqc_pdf to day shift if this is day shift
        if shift == 'day':
            record.ipqc_pdf = relative_path
        
        db.session.commit()
        
        return jsonify({
            'message': f'IPQC PDF uploaded successfully for {shift} shift',
            'shift': shift,
            'dayIpqcPdf': record.day_ipqc_pdf,
            'nightIpqcPdf': record.night_ipqc_pdf,
            'ipqcPdf': record.ipqc_pdf  # Deprecated but kept for compatibility
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Upload FTR document for production record
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>/ftr-document', methods=['POST'])
def upload_ftr_document(company_id, record_id):
    try:
        from flask import current_app
        from werkzeug.utils import secure_filename
        import os
        
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        
        # Check if record is closed
        if record.is_closed:
            return jsonify({'error': 'This production record is closed'}), 403
        
        if 'document' not in request.files:
            return jsonify({'error': 'No document file provided'}), 400
        
        file = request.files['document']
        
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # Allowed extensions for FTR
        ALLOWED_EXTENSIONS = {'pdf', 'xlsx', 'xls', 'doc', 'docx'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Create uploads/ftr_documents directory
        upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'ftr_documents')
        os.makedirs(upload_folder, exist_ok=True)
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = secure_filename(f"{company_id}_{record_id}_ftr_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}")
        filepath = os.path.join(upload_folder, filename)
        
        # Save file
        file.save(filepath)
        
        # Update record - store relative path from backend directory
        record.ftr_document = f"uploads/ftr_documents/{filename}"
        db.session.commit()
        
        return jsonify({
            'message': 'FTR document uploaded successfully',
            'ftrDocument': record.ftr_document
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Close/Lock production record (after PDF generation)
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>/close', methods=['POST'])
def close_production_record(company_id, record_id):
    try:
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        
        # Mark as closed
        record.is_closed = True
        db.session.commit()
        
        return jsonify({
            'message': 'Production record closed successfully',
            'record': record.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Reopen production record (admin function)
@company_bp.route('/api/companies/<int:company_id>/production/<int:record_id>/reopen', methods=['POST'])
def reopen_production_record(company_id, record_id):
    try:
        record = ProductionRecord.query.filter_by(id=record_id, company_id=company_id).first_or_404()
        
        # Mark as open
        record.is_closed = False
        db.session.commit()
        
        return jsonify({
            'message': 'Production record reopened successfully',
            'record': record.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Download COC PDF from URL and save to server
@company_bp.route('/api/companies/download-coc-pdf', methods=['POST'])
def download_coc_pdf():
    """Download COC PDF from external URL and save to server"""
    try:
        import requests
        import os
        from flask import current_app
        from werkzeug.utils import secure_filename
        from datetime import datetime
        
        data = request.get_json()
        pdf_url = data.get('pdf_url')
        material_name = data.get('material_name', 'COC')
        invoice_no = data.get('invoice_no', 'unknown')
        
        if not pdf_url:
            return jsonify({'error': 'PDF URL is required'}), 400
        
        # Create bom_materials directory if not exists
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        bom_folder = os.path.join(upload_folder, 'bom_materials')
        os.makedirs(bom_folder, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_material = secure_filename(material_name.replace(' ', '_'))
        safe_invoice = secure_filename(invoice_no.replace(' ', '_'))
        filename = f"COC_{safe_material}_{safe_invoice}_{timestamp}.pdf"
        filepath = os.path.join(bom_folder, filename)
        
        # Download PDF from URL
        print(f"Downloading COC PDF from: {pdf_url}")
        response = requests.get(pdf_url, timeout=30)
        response.raise_for_status()
        
        # Save PDF
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        # Return relative path
        relative_path = os.path.join('bom_materials', filename).replace('\\', '/')
        
        print(f"✓ COC PDF saved successfully: {relative_path}")
        
        return jsonify({
            'success': True,
            'image_path': relative_path,
            'filename': filename
        }), 200
        
    except requests.exceptions.RequestException as e:
        print(f"✗ Error downloading PDF: {str(e)}")
        return jsonify({'error': f'Failed to download PDF: {str(e)}'}), 500
    except Exception as e:
        print(f"✗ Error saving PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500
