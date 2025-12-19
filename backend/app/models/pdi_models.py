"""
Extended Database Models for PDI System
"""
from datetime import datetime
from app.models.database import db

class MasterOrder(db.Model):
    __tablename__ = 'master_orders'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    order_number = db.Column(db.String(100), unique=True, nullable=False)
    customer_po = db.Column(db.String(200))
    total_modules = db.Column(db.Integer, nullable=False)
    module_wattage = db.Column(db.Integer, default=630)
    cells_per_module = db.Column(db.Integer, default=66)
    total_cells_required = db.Column(db.Integer)
    order_date = db.Column(db.Date)
    target_completion_date = db.Column(db.Date)
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pdi_batches = db.relationship('PDIBatch', backref='order', lazy=True, cascade='all, delete-orphan')
    coc_documents = db.relationship('COCDocument', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'companyId': self.company_id,
            'orderNumber': self.order_number,
            'customerPO': self.customer_po,
            'totalModules': self.total_modules,
            'moduleWattage': self.module_wattage,
            'cellsPerModule': self.cells_per_module,
            'totalCellsRequired': self.total_cells_required,
            'orderDate': self.order_date.strftime('%Y-%m-%d') if self.order_date else None,
            'targetCompletionDate': self.target_completion_date.strftime('%Y-%m-%d') if self.target_completion_date else None,
            'status': self.status,
            'pdiBatches': [batch.to_dict() for batch in self.pdi_batches],
            'cocDocuments': [coc.to_dict() for coc in self.coc_documents]
        }


class PDIBatch(db.Model):
    __tablename__ = 'pdi_batches'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('master_orders.id'), nullable=False)
    pdi_number = db.Column(db.String(100), nullable=False)
    batch_sequence = db.Column(db.Integer, nullable=False)
    planned_modules = db.Column(db.Integer, nullable=False)
    actual_modules = db.Column(db.Integer, default=0)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    serial_prefix = db.Column(db.String(50))
    serial_start = db.Column(db.Integer)
    serial_end = db.Column(db.Integer)
    status = db.Column(db.String(50), default='planned')
    reports_generated = db.Column(db.Boolean, default=False)
    ipqc_report_path = db.Column(db.String(500))
    ftr_report_path = db.Column(db.String(500))
    coc_report_path = db.Column(db.String(500))
    traceability_report_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    serial_numbers = db.relationship('ModuleSerialNumber', backref='pdi_batch', lazy=True, cascade='all, delete-orphan')
    raw_materials = db.relationship('PDIRawMaterial', backref='pdi_batch', lazy=True, cascade='all, delete-orphan')
    coc_usage = db.relationship('PDICOCUsage', backref='pdi_batch', lazy=True, cascade='all, delete-orphan')
    # production_records relationship removed - can be queried separately
    
    def to_dict(self):
        return {
            'id': self.id,
            'orderId': self.order_id,
            'pdiNumber': self.pdi_number,
            'batchSequence': self.batch_sequence,
            'plannedModules': self.planned_modules,
            'actualModules': self.actual_modules,
            'startDate': self.start_date.strftime('%Y-%m-%d') if self.start_date else None,
            'endDate': self.end_date.strftime('%Y-%m-%d') if self.end_date else None,
            'serialPrefix': self.serial_prefix,
            'serialStart': self.serial_start,
            'serialEnd': self.serial_end,
            'status': self.status,
            'reportsGenerated': self.reports_generated,
            'ipqcReportPath': self.ipqc_report_path,
            'ftrReportPath': self.ftr_report_path,
            'cocReportPath': self.coc_report_path,
            'traceabilityReportPath': self.traceability_report_path,
            'serialNumbers': [sn.to_dict() for sn in self.serial_numbers],
            'rawMaterials': [rm.to_dict() for rm in self.raw_materials],
            'cocUsage': [cu.to_dict() for cu in self.coc_usage]
        }


class ModuleSerialNumber(db.Model):
    __tablename__ = 'module_serial_numbers'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    pdi_batch_id = db.Column(db.Integer, db.ForeignKey('pdi_batches.id'), nullable=False)
    serial_number = db.Column(db.String(100), unique=True, nullable=False)
    production_date = db.Column(db.Date)
    qc_status = db.Column(db.String(50), default='pending')
    rejection_reason = db.Column(db.String(500))
    dispatched = db.Column(db.Boolean, default=False)
    dispatch_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'pdiBatchId': self.pdi_batch_id,
            'serialNumber': self.serial_number,
            'productionDate': self.production_date.strftime('%Y-%m-%d') if self.production_date else None,
            'qcStatus': self.qc_status,
            'rejectionReason': self.rejection_reason,
            'dispatched': self.dispatched,
            'dispatchDate': self.dispatch_date.strftime('%Y-%m-%d') if self.dispatch_date else None
        }


class COCDocument(db.Model):
    __tablename__ = 'coc_documents'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('master_orders.id'), nullable=False)
    invoice_number = db.Column(db.String(200), unique=True, nullable=False)
    coc_number = db.Column(db.String(200))
    total_cells_qty = db.Column(db.Integer, nullable=False)
    cells_used = db.Column(db.Integer, default=0)
    cells_remaining = db.Column(db.Integer)
    cell_batch_number = db.Column(db.String(200))
    supplier_name = db.Column(db.String(200))
    received_date = db.Column(db.Date)
    document_path = db.Column(db.String(500))
    status = db.Column(db.String(50), default='active')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pdi_usage = db.relationship('PDICOCUsage', backref='coc_document', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'orderId': self.order_id,
            'invoiceNumber': self.invoice_number,
            'cocNumber': self.coc_number,
            'totalCellsQty': self.total_cells_qty,
            'cellsUsed': self.cells_used,
            'cellsRemaining': self.cells_remaining,
            'cellBatchNumber': self.cell_batch_number,
            'supplierName': self.supplier_name,
            'receivedDate': self.received_date.strftime('%Y-%m-%d') if self.received_date else None,
            'documentPath': self.document_path,
            'status': self.status,
            'notes': self.notes,
            'pdiUsage': [pu.to_dict() for pu in self.pdi_usage]
        }


class PDICOCUsage(db.Model):
    __tablename__ = 'pdi_coc_usage'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    pdi_batch_id = db.Column(db.Integer, db.ForeignKey('pdi_batches.id'), nullable=False)
    coc_document_id = db.Column(db.Integer, db.ForeignKey('coc_documents.id'), nullable=False)
    cells_used = db.Column(db.Integer, nullable=False)
    usage_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'pdiBatchId': self.pdi_batch_id,
            'cocDocumentId': self.coc_document_id,
            'cellsUsed': self.cells_used,
            'usageDate': self.usage_date.strftime('%Y-%m-%d') if self.usage_date else None
        }


class PDIRawMaterial(db.Model):
    __tablename__ = 'pdi_raw_materials'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    pdi_batch_id = db.Column(db.Integer, db.ForeignKey('pdi_batches.id'), nullable=False)
    material_name = db.Column(db.String(200), nullable=False)
    lot_number = db.Column(db.String(200))
    quantity_used = db.Column(db.Numeric(10, 2))
    unit = db.Column(db.String(50))
    supplier = db.Column(db.String(200))
    batch_image_path = db.Column(db.String(500))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'pdiBatchId': self.pdi_batch_id,
            'materialName': self.material_name,
            'lotNumber': self.lot_number,
            'quantityUsed': float(self.quantity_used) if self.quantity_used else None,
            'unit': self.unit,
            'supplier': self.supplier,
            'batchImagePath': self.batch_image_path,
            'notes': self.notes
        }


class MasterFTRTemplate(db.Model):
    __tablename__ = 'master_ftr_templates'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    template_name = db.Column(db.String(200))
    module_type = db.Column(db.String(100))
    module_wattage = db.Column(db.Integer)
    test_parameters = db.Column(db.JSON)
    document_path = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'companyId': self.company_id,
            'templateName': self.template_name,
            'moduleType': self.module_type,
            'moduleWattage': self.module_wattage,
            'testParameters': self.test_parameters,
            'documentPath': self.document_path,
            'isActive': self.is_active
        }
