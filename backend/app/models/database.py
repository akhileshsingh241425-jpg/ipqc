from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import json

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
    cell_efficiency_received = db.Column(db.Text, nullable=True)  # JSON: efficiency grade wise received cells
    iqc_data = db.Column(db.Text, nullable=True)  # JSON: IQC tracker data (pdiOffers, bomOverrides, cocMapping)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    production_records = db.relationship('ProductionRecord', backref='company', lazy=True, cascade='all, delete-orphan')
    rejected_modules = db.relationship('RejectedModule', backref='company', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        # Parse cell efficiency received JSON
        cell_eff_received = {}
        if self.cell_efficiency_received:
            try:
                cell_eff_received = json.loads(self.cell_efficiency_received)
            except:
                cell_eff_received = {}
        
        # Parse IQC data JSON
        iqc_data = {}
        if self.iqc_data:
            try:
                iqc_data = json.loads(self.iqc_data)
            except:
                iqc_data = {}
        
        return {
            'id': self.id,
            'companyName': self.company_name,
            'moduleWattage': self.module_wattage,
            'moduleType': self.module_type,
            'cellsPerModule': self.cells_per_module,
            'currentRunningOrder': self.current_running_order,
            'cellsReceivedQty': self.cells_received_qty,
            'cellsReceivedMW': self.cells_received_mw,
            'cellEfficiencyReceived': cell_eff_received,  # Efficiency grade wise received cells
            'iqcData': iqc_data,  # IQC tracker data
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
    coc_invoice_numbers = db.Column(db.Text, nullable=True)  # Deprecated - use coc_materials
    coc_materials = db.Column(db.Text, nullable=True)  # JSON array for COC linking (customer docs)
    cell_efficiency = db.Column(db.Float, nullable=True)  # Deprecated - use day/night cell efficiency
    day_cell_efficiency = db.Column(db.Float, nullable=True)  # Cell efficiency % for day shift
    night_cell_efficiency = db.Column(db.Float, nullable=True)  # Cell efficiency % for night shift
    cell_rejection_percent = db.Column(db.Float, default=0.0)
    module_rejection_percent = db.Column(db.Float, default=0.0)
    ipqc_pdf = db.Column(db.String(500), nullable=True)  # Deprecated - use day_ipqc_pdf / night_ipqc_pdf
    day_ipqc_pdf = db.Column(db.String(500), nullable=True)  # IPQC PDF for day shift
    night_ipqc_pdf = db.Column(db.String(500), nullable=True)  # IPQC PDF for night shift
    ftr_document = db.Column(db.String(500), nullable=True)
    ftr_uploaded = db.Column(db.Boolean, default=False)  # Track if FTR has been uploaded
    is_closed = db.Column(db.Boolean, default=False)
    cell_supplier = db.Column(db.String(100), nullable=True)  # Cell supplier name for inventory tracking
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to BOM materials
    bom_materials = db.relationship('BomMaterial', backref='production_record', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        import json
        
        # Parse COC materials JSON if exists
        coc_materials_list = []
        if self.coc_materials:
            try:
                coc_materials_list = json.loads(self.coc_materials)
            except:
                coc_materials_list = []
        
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
            'cocMaterials': coc_materials_list,  # COC linking data (separate from BOM)
            'cellEfficiency': self.cell_efficiency,  # Deprecated - kept for backward compatibility
            'dayCellEfficiency': self.day_cell_efficiency,  # Day shift cell efficiency
            'nightCellEfficiency': self.night_cell_efficiency,  # Night shift cell efficiency
            'cellRejectionPercent': self.cell_rejection_percent,
            'moduleRejectionPercent': self.module_rejection_percent,
            'ipqcPdf': self.ipqc_pdf,  # Deprecated - kept for backward compatibility
            'dayIpqcPdf': self.day_ipqc_pdf,
            'nightIpqcPdf': self.night_ipqc_pdf,
            'ftrDocument': self.ftr_document,
            'ftrUploaded': self.ftr_uploaded,
            'isClosed': self.is_closed,
            'cellSupplier': self.cell_supplier,  # Cell supplier for inventory tracking
            'bomMaterials': [bm.to_dict() for bm in self.bom_materials]  # BOM data (separate from COC)
        }


class BomMaterial(db.Model):
    __tablename__ = 'bom_materials'
    
    id = db.Column(db.Integer, primary_key=True)
    production_record_id = db.Column(db.Integer, db.ForeignKey('production_records.id'), nullable=False)
    material_name = db.Column(db.String(100), nullable=False)  # Fixed from 14-item list
    shift = db.Column(db.String(10), nullable=False)  # 'day' or 'night'
    company = db.Column(db.String(200), nullable=True)  # Supplier/Brand name
    lot_batch_no = db.Column(db.String(200), nullable=True)  # Lot/Batch number
    cell_efficiency = db.Column(db.Float, nullable=True)  # Cell efficiency % (for Solar Cell only)
    image_paths = db.Column(db.Text, nullable=True)  # JSON array of image paths
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        import json
        # Parse image paths from JSON
        images = []
        if self.image_paths:
            try:
                images = json.loads(self.image_paths)
            except:
                images = []
        
        return {
            'id': self.id,
            'materialName': self.material_name,
            'shift': self.shift,
            'company': self.company,
            'lotBatchNo': self.lot_batch_no,
            'cellEfficiency': self.cell_efficiency,  # Cell efficiency for Solar Cell
            'imagePaths': images  # Array of image paths
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
