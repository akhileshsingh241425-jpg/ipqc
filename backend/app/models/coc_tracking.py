"""
COC Usage Tracking Model
"""
from datetime import datetime
from app.models.database import db

class COCUsageTracking(db.Model):
    __tablename__ = 'coc_usage_tracking'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    production_record_id = db.Column(db.Integer, db.ForeignKey('production_records.id'), nullable=False)
    pdi_number = db.Column(db.String(200))
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    shift = db.Column(db.String(10), nullable=False)  # 'day' or 'night'
    material_name = db.Column(db.String(100), nullable=False)
    coc_invoice_number = db.Column(db.String(200))
    coc_brand = db.Column(db.String(200))
    coc_qty_used = db.Column(db.Integer, default=0)
    coc_remaining_gap = db.Column(db.Integer, default=0)
    usage_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'productionRecordId': self.production_record_id,
            'pdiNumber': self.pdi_number,
            'companyId': self.company_id,
            'shift': self.shift,
            'materialName': self.material_name,
            'cocInvoiceNumber': self.coc_invoice_number,
            'cocBrand': self.coc_brand,
            'cocQtyUsed': self.coc_qty_used,
            'cocRemainingGap': self.coc_remaining_gap,
            'usageDate': self.usage_date.strftime('%Y-%m-%d') if self.usage_date else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }
