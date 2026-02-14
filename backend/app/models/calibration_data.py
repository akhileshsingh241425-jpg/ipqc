"""
Calibration Data Models
Stores calibration instrument records with tracking for due dates
"""

from datetime import datetime, date
from .database import db

class CalibrationInstrument(db.Model):
    """Calibration instrument tracking"""
    __tablename__ = 'calibration_instruments'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    sr_no = db.Column(db.Integer, nullable=True)  # Sr. No.
    instrument_id = db.Column(db.String(100), nullable=False)  # GSPL/INS/001
    machine_name = db.Column(db.String(200), nullable=False)  # MEASURING TAPE
    make = db.Column(db.String(100), nullable=True)  # Stanlee
    model_name = db.Column(db.String(100), nullable=True)  # NA
    item_sr_no = db.Column(db.String(100), nullable=True)  # Item Sr. No.
    range_capacity = db.Column(db.String(200), nullable=True)  # 0 to 3 Meter
    least_count = db.Column(db.String(100), nullable=True)  # 1 mm
    location = db.Column(db.String(100), nullable=True)  # Quality
    calibration_agency = db.Column(db.String(300), nullable=True)  # Qtech Calibration Laboratory
    date_of_calibration = db.Column(db.Date, nullable=True)  # Date of Cali.
    due_date = db.Column(db.Date, nullable=True)  # Due Date
    inspector = db.Column(db.String(100), nullable=True)  # Inspector name
    calibration_frequency = db.Column(db.String(50), nullable=True)  # 1 Year
    calibration_standards = db.Column(db.String(300), nullable=True)  # CP/M/D/28, IS: 1269
    certificate_no = db.Column(db.String(100), nullable=True)  # QCL/2024/014633
    
    # Status tracking
    status = db.Column(db.String(50), default='valid')  # valid, due_soon, overdue
    notes = db.Column(db.Text, nullable=True)
    
    # Image/Certificate upload
    image_path = db.Column(db.String(500), nullable=True)  # Path to uploaded certificate/image
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'sr_no': self.sr_no,
            'instrument_id': self.instrument_id,
            'machine_name': self.machine_name,
            'make': self.make,
            'model_name': self.model_name,
            'item_sr_no': self.item_sr_no,
            'range_capacity': self.range_capacity,
            'least_count': self.least_count,
            'location': self.location,
            'calibration_agency': self.calibration_agency,
            'date_of_calibration': self.date_of_calibration.isoformat() if self.date_of_calibration else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'inspector': self.inspector,
            'calibration_frequency': self.calibration_frequency,
            'calibration_standards': self.calibration_standards,
            'certificate_no': self.certificate_no,
            'status': self.status,
            'notes': self.notes,
            'image_path': self.image_path,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'days_until_due': self.get_days_until_due()
        }
    
    def get_days_until_due(self):
        """Calculate days until due date"""
        if not self.due_date:
            return None
        today = date.today()
        delta = self.due_date - today
        return delta.days
    
    def update_status(self):
        """Update status based on due date"""
        days_until_due = self.get_days_until_due()
        if days_until_due is None:
            self.status = 'unknown'
        elif days_until_due < 0:
            self.status = 'overdue'
        elif days_until_due <= 30:
            self.status = 'due_soon'
        else:
            self.status = 'valid'
        return self.status


class CalibrationHistory(db.Model):
    """History of calibration updates"""
    __tablename__ = 'calibration_history'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    instrument_id = db.Column(db.Integer, db.ForeignKey('calibration_instruments.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # created, updated, calibrated
    old_values = db.Column(db.Text, nullable=True)  # JSON string of old values
    new_values = db.Column(db.Text, nullable=True)  # JSON string of new values
    changed_by = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'instrument_id': self.instrument_id,
            'action': self.action,
            'old_values': self.old_values,
            'new_values': self.new_values,
            'changed_by': self.changed_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
