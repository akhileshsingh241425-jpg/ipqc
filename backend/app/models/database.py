from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Company(db.Model):
    __tablename__ = 'companies'
    
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), nullable=False)
    module_wattage = db.Column(db.Integer, default=625)
    module_type = db.Column(db.String(50), default='Topcon')
    cells_per_module = db.Column(db.Integer, default=132)
    cells_received_qty = db.Column(db.Integer, nullable=True)
    cells_received_mw = db.Column(db.Float, nullable=True)
    current_running_order = db.Column(db.String(200), nullable=True)  # Current running order number
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    production_records = db.relationship('ProductionRecord', backref='company', lazy=True, cascade='all, delete-orphan')
    rejected_modules = db.relationship('RejectedModule', backref='company', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'companyName': self.company_name,
            'moduleWattage': self.module_wattage,
            'moduleType': self.module_type,
            'cellsPerModule': self.cells_per_module,
            'currentRunningOrder': self.current_running_order,
            'cellsReceivedQty': self.cells_received_qty,
            'cellsReceivedMW': self.cells_received_mw,
            'createdDate': self.created_date.strftime('%Y-%m-%d') if self.created_date else None,
            'productionRecords': [pr.to_dict() for pr in self.production_records],
            'rejectedModules': [rm.to_dict() for rm in self.rejected_modules]
        }


class ProductionRecord(db.Model):
    __tablename__ = 'production_records'
    
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    running_order = db.Column(db.String(200), nullable=True)
    date = db.Column(db.Date, nullable=False)
    lot_number = db.Column(db.String(200), nullable=True)  # Optional lot number
    day_production = db.Column(db.Integer, default=0)
    night_production = db.Column(db.Integer, default=0)
    pdi = db.Column(db.String(200), default='')
    pdi_approved = db.Column(db.Boolean, default=False)  # Admin approval for PDI
    serial_number_start = db.Column(db.String(100), nullable=True)
    serial_number_end = db.Column(db.String(100), nullable=True)
    serial_count = db.Column(db.Integer, default=0)
    pdi_batch_id = db.Column(db.Integer, nullable=True)
    coc_invoice_numbers = db.Column(db.Text, nullable=True)
    cell_rejection_percent = db.Column(db.Float, default=0.0)
    module_rejection_percent = db.Column(db.Float, default=0.0)
    ipqc_pdf = db.Column(db.String(500), nullable=True)
    ftr_document = db.Column(db.String(500), nullable=True)
    ftr_uploaded = db.Column(db.Boolean, default=False)  # Track if FTR has been uploaded
    is_closed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to BOM materials
    bom_materials = db.relationship('BomMaterial', backref='production_record', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'runningOrder': self.running_order,
            'date': self.date.strftime('%Y-%m-%d') if self.date else None,
            'lotNumber': self.lot_number,
            'dayProduction': self.day_production,
            'nightProduction': self.night_production,
            'pdi': self.pdi,
            'pdiApproved': self.pdi_approved,
            'serialNumberStart': self.serial_number_start,
            'serialNumberEnd': self.serial_number_end,
            'serialCount': self.serial_count,
            'pdiBatchId': self.pdi_batch_id,
            'cocInvoiceNumbers': self.coc_invoice_numbers,
            'cellRejectionPercent': self.cell_rejection_percent,
            'moduleRejectionPercent': self.module_rejection_percent,
            'ipqcPdf': self.ipqc_pdf,
            'ftrDocument': self.ftr_document,
            'ftrUploaded': self.ftr_uploaded,
            'isClosed': self.is_closed,
            'bomMaterials': [bm.to_dict() for bm in self.bom_materials]
        }


class BomMaterial(db.Model):
    __tablename__ = 'bom_materials'
    
    id = db.Column(db.Integer, primary_key=True)
    production_record_id = db.Column(db.Integer, db.ForeignKey('production_records.id'), nullable=False)
    material_name = db.Column(db.String(100), nullable=False)  # Cell, EVA Front, EVA Back, etc.
    shift = db.Column(db.String(10), nullable=True)  # 'day' or 'night'
    company = db.Column(db.String(200), nullable=True)  # Company/Brand name
    image_path = db.Column(db.String(500), nullable=True)
    lot_number = db.Column(db.String(200), nullable=True)  # Invoice number from COC
    coc_qty = db.Column(db.String(50), nullable=True)  # COC quantity
    invoice_qty = db.Column(db.String(50), nullable=True)  # Invoice quantity
    lot_batch_no = db.Column(db.String(200), nullable=True)  # Lot/Batch number
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        # Find all PDI batches using this COC invoice number
        used_in_pdis = []
        if self.lot_number:  # lot_number is the invoice number from COC
            # Query all BomMaterials with same invoice number but different PDI
            other_materials = BomMaterial.query.filter_by(
                lot_number=self.lot_number,
                material_name=self.material_name
            ).all()
            
            # Get unique PDI numbers with company names
            pdi_map = {}
            for mat in other_materials:
                if mat.production_record and mat.production_record.pdi:
                    pdi = mat.production_record.pdi
                    company_name = mat.production_record.company.company_name if mat.production_record.company else 'Unknown'
                    pdi_map[pdi] = company_name
            
            # Format as "PDI-1 (Company Name)"
            used_in_pdis = [f"{pdi} ({company})" for pdi, company in sorted(pdi_map.items())]
        
        return {
            'id': self.id,
            'materialName': self.material_name,
            'company': self.company,
            'imagePath': self.image_path,
            'lotNumber': self.lot_number,
            'cocQty': self.coc_qty,
            'invoiceQty': self.invoice_qty,
            'lotBatchNo': self.lot_batch_no,
            'usedInPdis': used_in_pdis  # New field: list with "PDI (Company)" format
        }


class RejectedModule(db.Model):
    __tablename__ = 'rejected_modules'
    
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    serial_number = db.Column(db.String(100), nullable=False)
    rejection_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(200), default='')
    stage = db.Column(db.String(100), default='Visual Inspection')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'serialNumber': self.serial_number,
            'rejectionDate': self.rejection_date.strftime('%Y-%m-%d') if self.rejection_date else None,
            'reason': self.reason,
            'stage': self.stage
        }
