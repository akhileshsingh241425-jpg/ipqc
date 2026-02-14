"""
Peel Test Data Model
Separate module for Solar Cell Peel Test Reports
"""

from .database import db
from datetime import datetime

class PeelTestReport(db.Model):
    """Model for Peel Test Reports"""
    __tablename__ = 'peel_test_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=False)
    report_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    shift = db.Column(db.String(20), nullable=False)  # Day/Night
    operator_name = db.Column(db.String(100))
    supervisor_name = db.Column(db.String(100))
    
    # Test Equipment Details
    equipment_id = db.Column(db.String(50))
    calibration_date = db.Column(db.Date)
    
    # Peel Test Results
    test_results = db.relationship('PeelTestResult', backref='report', lazy=True, cascade='all, delete-orphan')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'company_id': self.company_id,
            'report_date': self.report_date.isoformat() if self.report_date else None,
            'shift': self.shift,
            'operator_name': self.operator_name,
            'supervisor_name': self.supervisor_name,
            'equipment_id': self.equipment_id,
            'calibration_date': self.calibration_date.isoformat() if self.calibration_date else None,
            'test_results': [result.to_dict() for result in self.test_results],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PeelTestResult(db.Model):
    """Individual Peel Test Result"""
    __tablename__ = 'peel_test_results'
    
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('peel_test_reports.id'), nullable=False)
    
    # Sample Information
    sample_id = db.Column(db.String(100), nullable=False)
    batch_number = db.Column(db.String(100))
    test_time = db.Column(db.String(10))  # HH:MM format
    
    # Test Type
    test_type = db.Column(db.String(100), nullable=False)  
    # Options: EVA to Glass, EVA to Backsheet, Cell to EVA, Ribbon to Busbar, etc.
    
    # Test Conditions
    temperature = db.Column(db.Float)  # Celsius
    humidity = db.Column(db.Float)  # %RH
    peel_speed = db.Column(db.Float)  # mm/min
    peel_angle = db.Column(db.Float)  # degrees (usually 90° or 180°)
    
    # Test Results
    peel_strength = db.Column(db.Float, nullable=False)  # N/cm or N/mm
    unit = db.Column(db.String(10), default='N/cm')  # N/cm or N/mm
    
    # Acceptance Criteria
    min_requirement = db.Column(db.Float)  # Minimum acceptable value
    max_requirement = db.Column(db.Float)  # Maximum acceptable value (if applicable)
    result_status = db.Column(db.String(20))  # OK/NG
    
    # Failure Mode (if NG)
    failure_mode = db.Column(db.String(200))
    # Options: Adhesive failure, Cohesive failure, Interfacial failure, Mixed mode, etc.
    
    # Additional Observations
    remarks = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'sample_id': self.sample_id,
            'batch_number': self.batch_number,
            'test_time': self.test_time,
            'test_type': self.test_type,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'peel_speed': self.peel_speed,
            'peel_angle': self.peel_angle,
            'peel_strength': self.peel_strength,
            'unit': self.unit,
            'min_requirement': self.min_requirement,
            'max_requirement': self.max_requirement,
            'result_status': self.result_status,
            'failure_mode': self.failure_mode,
            'remarks': self.remarks
        }
