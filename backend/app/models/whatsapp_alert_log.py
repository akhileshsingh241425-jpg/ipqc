from app.models.database import db
from datetime import datetime

class WhatsAppAlertLog(db.Model):
    __tablename__ = 'whatsapp_alert_log'
    id = db.Column(db.Integer, primary_key=True)
    serial_number = db.Column(db.String(100), nullable=False, index=True)
    alert_type = db.Column(db.String(50), nullable=False, index=True)  # e.g. 'rejection', 'mix_binning', etc
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<WhatsAppAlertLog {self.serial_number} {self.alert_type}>'
