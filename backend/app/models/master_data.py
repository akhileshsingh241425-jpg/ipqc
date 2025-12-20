"""
Master Data Models for Pre-loaded Production Data
Stores 100,000 modules data with pre-defined rejections
"""

from datetime import datetime
from .database import db

class MasterOrder(db.Model):
    """Master order with pre-generated module data"""
    __tablename__ = 'master_orders_old'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), nullable=False)
    order_number = db.Column(db.String(100), unique=True, nullable=False)
    total_modules = db.Column(db.Integer, nullable=False)  # e.g., 100000
    rejection_percentage = db.Column(db.Float, default=1.8)  # 1.8%
    serial_prefix = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships - commented out to avoid conflicts with new pdi_models
    # modules = db.relationship('MasterModule', backref='order', lazy=True, cascade='all, delete-orphan')

class MasterModule(db.Model):
    """Pre-generated module data with FTR/Rejection status"""
    __tablename__ = 'master_modules'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('master_orders_old.id'), nullable=False)
    
    # Excel data columns (from RFID FTR format)
    date = db.Column(db.String(50), nullable=True)
    serial_number = db.Column(db.String(100), nullable=False)  # ID column
    pmax = db.Column(db.Float, nullable=True)
    isc = db.Column(db.Float, nullable=True)
    voc = db.Column(db.Float, nullable=True)
    ipm = db.Column(db.Float, nullable=True)
    vpm = db.Column(db.Float, nullable=True)
    ff = db.Column(db.Float, nullable=True)
    rs = db.Column(db.Float, nullable=True)
    rsh = db.Column(db.Float, nullable=True)
    eff = db.Column(db.Float, nullable=True)
    t_object = db.Column(db.Float, nullable=True)
    t_target = db.Column(db.Float, nullable=True)
    irr_target = db.Column(db.Float, nullable=True)
    class_grade = db.Column(db.String(20), nullable=True)
    sweep_time = db.Column(db.Float, nullable=True)
    irr_monitor = db.Column(db.Float, nullable=True)
    isc_monitor = db.Column(db.Float, nullable=True)
    t_monitor = db.Column(db.Float, nullable=True)
    cell_temp = db.Column(db.Float, nullable=True)
    t_ambient = db.Column(db.Float, nullable=True)
    binning = db.Column(db.String(20), nullable=True)
    
    sequence_number = db.Column(db.Integer, nullable=False)
    
    # Status
    is_rejected = db.Column(db.Boolean, default=False)
    rejection_reason = db.Column(db.String(200), nullable=True)
    is_delivered = db.Column(db.Boolean, default=False)  # FTR already delivered to customer
    delivered_date = db.Column(db.Date, nullable=True)
    
    # Daily production assignment
    is_produced = db.Column(db.Boolean, default=False)
    production_date = db.Column(db.Date, nullable=True)
    production_shift = db.Column(db.String(10), nullable=True)  # A, B, C
    line_number = db.Column(db.Integer, nullable=True)  # 1, 2, 3
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.Index('idx_order_sequence', 'order_id', 'sequence_number'),
        db.Index('idx_serial', 'serial_number'),
        db.Index('idx_production', 'production_date', 'production_shift'),
    )

class DailyProduction(db.Model):
    """Daily production tracking"""
    __tablename__ = 'daily_production'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('master_orders.id'), nullable=False)
    production_date = db.Column(db.Date, nullable=False)
    shift = db.Column(db.String(10), nullable=False)
    line_number = db.Column(db.Integer, nullable=False)
    
    modules_produced = db.Column(db.Integer, nullable=False)
    ftr_count = db.Column(db.Integer, nullable=False)
    rejection_count = db.Column(db.Integer, nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.Index('idx_daily_prod', 'order_id', 'production_date', 'shift', 'line_number'),
    )
