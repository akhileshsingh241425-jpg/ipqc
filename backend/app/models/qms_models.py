from app.models.database import db
from datetime import datetime


class QMSDocument(db.Model):
    __tablename__ = 'qms_documents'
    
    id = db.Column(db.Integer, primary_key=True)
    doc_number = db.Column(db.String(50), unique=True, nullable=False)
    title = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    sub_category = db.Column(db.String(100))
    description = db.Column(db.Text)
    version = db.Column(db.String(20), default='1.0')
    status = db.Column(db.String(30), default='Draft')  # Draft, Under Review, Approved, Obsolete
    department = db.Column(db.String(100))
    prepared_by = db.Column(db.String(100))
    reviewed_by = db.Column(db.String(100))
    approved_by = db.Column(db.String(100))
    effective_date = db.Column(db.String(20))
    review_date = db.Column(db.String(20))
    expiry_date = db.Column(db.String(20))
    file_path = db.Column(db.String(500))
    file_name = db.Column(db.String(300))
    file_size = db.Column(db.Integer)
    file_type = db.Column(db.String(50))
    tags = db.Column(db.Text)  # comma-separated tags
    iso_clause = db.Column(db.String(50))  # ISO 9001 clause reference
    revision_history = db.Column(db.Text)  # JSON string of revisions
    is_controlled = db.Column(db.Boolean, default=True)
    access_level = db.Column(db.String(30), default='All')  # All, Management, QA, Production
    extracted_text = db.Column(db.Text)  # Full extracted text content from file
    text_extracted_at = db.Column(db.DateTime)  # When text was last extracted
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'doc_number': self.doc_number,
            'title': self.title,
            'category': self.category,
            'sub_category': self.sub_category,
            'description': self.description,
            'version': self.version,
            'status': self.status,
            'department': self.department,
            'prepared_by': self.prepared_by,
            'reviewed_by': self.reviewed_by,
            'approved_by': self.approved_by,
            'effective_date': self.effective_date,
            'review_date': self.review_date,
            'expiry_date': self.expiry_date,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'tags': self.tags,
            'iso_clause': self.iso_clause,
            'revision_history': self.revision_history,
            'is_controlled': self.is_controlled,
            'access_level': self.access_level,
            'has_extracted_text': bool(self.extracted_text),
            'text_length': len(self.extracted_text) if self.extracted_text else 0,
            'text_extracted_at': self.text_extracted_at.isoformat() if self.text_extracted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class QMSPartnerAudit(db.Model):
    __tablename__ = 'qms_partner_audits'
    
    id = db.Column(db.Integer, primary_key=True)
    audit_name = db.Column(db.String(300), nullable=False)
    audit_type = db.Column(db.String(50), default='Initial Assessment')
    partner_name = db.Column(db.String(200))
    partner_location = db.Column(db.String(300))
    auditor_name = db.Column(db.String(100))
    auditor_designation = db.Column(db.String(100))
    audit_date = db.Column(db.String(20))
    scores_json = db.Column(db.Text)
    total_score = db.Column(db.Float, default=0)
    max_score = db.Column(db.Float, default=0)
    percentage = db.Column(db.Float, default=0)
    overall_rating = db.Column(db.String(30))
    summary = db.Column(db.Text)
    status = db.Column(db.String(30), default='In Progress')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'audit_name': self.audit_name,
            'audit_type': self.audit_type,
            'partner_name': self.partner_name,
            'partner_location': self.partner_location,
            'auditor_name': self.auditor_name,
            'auditor_designation': self.auditor_designation,
            'audit_date': self.audit_date,
            'scores_json': self.scores_json,
            'total_score': self.total_score,
            'max_score': self.max_score,
            'percentage': self.percentage,
            'overall_rating': self.overall_rating,
            'summary': self.summary,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class QMSActionPlan(db.Model):
    __tablename__ = 'qms_action_plans'
    
    id = db.Column(db.Integer, primary_key=True)
    audit_id = db.Column(db.Integer, db.ForeignKey('qms_partner_audits.id'))
    section_id = db.Column(db.String(10))
    question_id = db.Column(db.String(10))
    question_text = db.Column(db.Text)
    current_score = db.Column(db.Integer, default=0)
    target_score = db.Column(db.Integer, default=4)
    gap_description = db.Column(db.Text)
    action_plan = db.Column(db.Text)
    responsible = db.Column(db.String(100))
    target_date = db.Column(db.String(20))
    completion_date = db.Column(db.String(20))
    status = db.Column(db.String(30), default='Open')
    evidence = db.Column(db.Text)
    remarks = db.Column(db.Text)
    priority = db.Column(db.String(20), default='Medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'audit_id': self.audit_id,
            'section_id': self.section_id,
            'question_id': self.question_id,
            'question_text': self.question_text,
            'current_score': self.current_score,
            'target_score': self.target_score,
            'gap_description': self.gap_description,
            'action_plan': self.action_plan,
            'responsible': self.responsible,
            'target_date': self.target_date,
            'completion_date': self.completion_date,
            'status': self.status,
            'evidence': self.evidence,
            'remarks': self.remarks,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class QMSAuditLog(db.Model):
    __tablename__ = 'qms_audit_log'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('qms_documents.id'))
    action = db.Column(db.String(50))
    performed_by = db.Column(db.String(100))
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'action': self.action,
            'performed_by': self.performed_by,
            'details': self.details,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
