from flask import Blueprint, request, jsonify, send_file
from app.models.database import db
from datetime import datetime
from werkzeug.utils import secure_filename
import os
import uuid

qms_bp = Blueprint('qms', __name__, url_prefix='/api/qms')

# ═══════════════════════════════════════════════
# QMS Database Models
# ═══════════════════════════════════════════════

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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class QMSAuditLog(db.Model):
    __tablename__ = 'qms_audit_log'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('qms_documents.id'))
    action = db.Column(db.String(50))  # Created, Updated, Downloaded, Reviewed, Approved, Deleted
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


# ═══════════════════════════════════════════════
# Helper: QMS Document Categories for Solar Panel Mfg
# ═══════════════════════════════════════════════
QMS_CATEGORIES = {
    'Quality Manual': {
        'iso_clause': '4.2.2',
        'sub_categories': ['Quality Policy', 'Quality Objectives', 'Organization Chart', 'Process Interaction']
    },
    'Procedures (SOP)': {
        'iso_clause': '4.2.1',
        'sub_categories': ['Document Control', 'Record Control', 'Internal Audit', 'Corrective Action', 
                          'Preventive Action', 'Management Review', 'Training', 'Purchasing',
                          'Customer Communication', 'Design Control', 'Production Control',
                          'Inspection & Testing', 'Calibration', 'Nonconformance', 'CAPA']
    },
    'Work Instructions': {
        'iso_clause': '7.5.1',
        'sub_categories': ['Cell Sorting', 'Cell Soldering', 'Layup', 'Lamination', 'Framing',
                          'Junction Box', 'Flash Testing', 'EL Testing', 'Visual Inspection',
                          'Packing', 'Hi-Pot Testing', 'Label Printing']
    },
    'Forms & Templates': {
        'iso_clause': '4.2.4',
        'sub_categories': ['IPQC Forms', 'PDI Forms', 'FTR Forms', 'Incoming Inspection',
                          'Process Control', 'Final Inspection', 'NCR Form', 'CAPA Form',
                          'Training Record', 'Audit Checklist', 'MRM Minutes']
    },
    'Specifications': {
        'iso_clause': '7.1',
        'sub_categories': ['Raw Material Specs', 'In-Process Specs', 'Finished Goods Specs',
                          'Packaging Specs', 'BOM Specifications', 'Module Specifications']
    },
    'Test Reports': {
        'iso_clause': '8.2.4',
        'sub_categories': ['IEC Certificates', 'BIS Certificates', 'Type Test Reports',
                          'Reliability Test', 'Salt Mist Test', 'Ammonia Test', 'PID Test',
                          'Mechanical Load Test', 'Hail Test', 'Hot Spot Test']
    },
    'Inspection Records': {
        'iso_clause': '8.2.4',
        'sub_categories': ['Incoming Inspection', 'In-Process Inspection', 'Final Inspection',
                          'Customer Inspection', 'Third Party Inspection']
    },
    'Calibration Records': {
        'iso_clause': '7.6',
        'sub_categories': ['Calibration Certificates', 'Calibration Schedule', 'MSA Reports']
    },
    'Audit Reports': {
        'iso_clause': '8.2.2',
        'sub_categories': ['Internal Audit', 'External Audit', 'Supplier Audit',
                          'Customer Audit', 'Surveillance Audit']
    },
    'CAPA & NCR': {
        'iso_clause': '8.5',
        'sub_categories': ['Customer Complaints', 'Internal NCR', 'Supplier NCR',
                          'Corrective Actions', 'Preventive Actions', 'Root Cause Analysis']
    },
    'Training Records': {
        'iso_clause': '6.2',
        'sub_categories': ['Training Matrix', 'Competency Records', 'Training Plans',
                          'Training Certificates', 'Skill Assessment']
    },
    'Supplier Documents': {
        'iso_clause': '7.4',
        'sub_categories': ['Approved Supplier List', 'Supplier Evaluation', 'Supplier Certificates',
                          'Raw Material COA', 'MSDS/SDS']
    },
    'Management Review': {
        'iso_clause': '5.6',
        'sub_categories': ['MRM Minutes', 'MRM Presentations', 'KPI Reports',
                          'Quality Objectives Review', 'Action Items']
    },
    'Process Documents': {
        'iso_clause': '7.5',
        'sub_categories': ['Process Flow Chart', 'Control Plan', 'FMEA',
                          'Process Validation', 'Production Layout']
    },
    'Certificates & Licenses': {
        'iso_clause': '',
        'sub_categories': ['ISO 9001 Certificate', 'ISO 14001 Certificate', 'ISO 45001 Certificate',
                          'IEC 61215', 'IEC 61730', 'BIS Certificate', 'ALMM Certificate',
                          'Factory License', 'Pollution Certificate', 'Fire NOC']
    }
}

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'txt', 'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_upload_folder():
    folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'qms_documents')
    os.makedirs(folder, exist_ok=True)
    return folder

def generate_doc_number(category):
    """Generate document number like GSPL/QMS/WI/001"""
    prefix_map = {
        'Quality Manual': 'QM',
        'Procedures (SOP)': 'SOP',
        'Work Instructions': 'WI',
        'Forms & Templates': 'FRM',
        'Specifications': 'SPEC',
        'Test Reports': 'TR',
        'Inspection Records': 'IR',
        'Calibration Records': 'CAL',
        'Audit Reports': 'AUD',
        'CAPA & NCR': 'CAPA',
        'Training Records': 'TRN',
        'Supplier Documents': 'SUP',
        'Management Review': 'MRM',
        'Process Documents': 'PD',
        'Certificates & Licenses': 'CERT'
    }
    prefix = prefix_map.get(category, 'DOC')
    
    # Find next number
    last_doc = QMSDocument.query.filter(
        QMSDocument.doc_number.like(f'GSPL/QMS/{prefix}/%')
    ).order_by(QMSDocument.id.desc()).first()
    
    if last_doc:
        try:
            last_num = int(last_doc.doc_number.split('/')[-1])
            next_num = last_num + 1
        except ValueError:
            next_num = 1
    else:
        next_num = 1
    
    return f'GSPL/QMS/{prefix}/{next_num:03d}'


# ═══════════════════════════════════════════════
# API Routes
# ═══════════════════════════════════════════════

@qms_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all QMS document categories and sub-categories"""
    return jsonify(QMS_CATEGORIES)


@qms_bp.route('/generate-doc-number', methods=['GET'])
def get_doc_number():
    """Generate next document number for a category"""
    category = request.args.get('category', 'Quality Manual')
    doc_number = generate_doc_number(category)
    return jsonify({'doc_number': doc_number})


@qms_bp.route('/documents', methods=['GET'])
def get_documents():
    """Get all documents with filters"""
    try:
        category = request.args.get('category', 'all')
        status = request.args.get('status', 'all')
        search = request.args.get('search', '')
        department = request.args.get('department', 'all')
        
        query = QMSDocument.query
        
        if category != 'all':
            query = query.filter_by(category=category)
        if status != 'all':
            query = query.filter_by(status=status)
        if department != 'all':
            query = query.filter_by(department=department)
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    QMSDocument.title.ilike(search_term),
                    QMSDocument.doc_number.ilike(search_term),
                    QMSDocument.description.ilike(search_term),
                    QMSDocument.tags.ilike(search_term),
                    QMSDocument.prepared_by.ilike(search_term)
                )
            )
        
        documents = query.order_by(QMSDocument.updated_at.desc()).all()
        
        # Stats
        total = QMSDocument.query.count()
        approved = QMSDocument.query.filter_by(status='Approved').count()
        draft = QMSDocument.query.filter_by(status='Draft').count()
        under_review = QMSDocument.query.filter_by(status='Under Review').count()
        obsolete = QMSDocument.query.filter_by(status='Obsolete').count()
        
        # Category counts
        category_counts = {}
        for cat in QMS_CATEGORIES:
            category_counts[cat] = QMSDocument.query.filter_by(category=cat).count()
        
        return jsonify({
            'documents': [d.to_dict() for d in documents],
            'stats': {
                'total': total,
                'approved': approved,
                'draft': draft,
                'under_review': under_review,
                'obsolete': obsolete
            },
            'category_counts': category_counts
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents', methods=['POST'])
def create_document():
    """Create a new QMS document"""
    try:
        # Handle both form data (with file) and JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            file = request.files.get('file')
        else:
            data = request.json
            file = None
        
        # Generate doc number if not provided
        if not data.get('doc_number'):
            data['doc_number'] = generate_doc_number(data.get('category', 'Quality Manual'))
        
        doc = QMSDocument(
            doc_number=data.get('doc_number'),
            title=data.get('title', ''),
            category=data.get('category', 'Quality Manual'),
            sub_category=data.get('sub_category', ''),
            description=data.get('description', ''),
            version=data.get('version', '1.0'),
            status=data.get('status', 'Draft'),
            department=data.get('department', ''),
            prepared_by=data.get('prepared_by', ''),
            reviewed_by=data.get('reviewed_by', ''),
            approved_by=data.get('approved_by', ''),
            effective_date=data.get('effective_date', ''),
            review_date=data.get('review_date', ''),
            expiry_date=data.get('expiry_date', ''),
            tags=data.get('tags', ''),
            iso_clause=data.get('iso_clause', ''),
            is_controlled=data.get('is_controlled', 'true') in ['true', 'True', True, '1'],
            access_level=data.get('access_level', 'All')
        )
        
        # Handle file upload
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            upload_folder = get_upload_folder()
            filepath = os.path.join(upload_folder, unique_name)
            file.save(filepath)
            
            doc.file_path = f"qms_documents/{unique_name}"
            doc.file_name = filename
            doc.file_size = os.path.getsize(filepath)
            doc.file_type = filename.rsplit('.', 1)[1].lower()
        
        db.session.add(doc)
        db.session.commit()
        
        # Log
        log = QMSAuditLog(
            document_id=doc.id,
            action='Created',
            performed_by=data.get('prepared_by', 'System'),
            details=f'Document {doc.doc_number} created'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'message': 'Document created successfully', 'document': doc.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>', methods=['PUT'])
def update_document(doc_id):
    """Update an existing document"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            file = request.files.get('file')
        else:
            data = request.json
            file = None
        
        # Update fields
        for field in ['title', 'category', 'sub_category', 'description', 'version',
                      'status', 'department', 'prepared_by', 'reviewed_by', 'approved_by',
                      'effective_date', 'review_date', 'expiry_date', 'tags', 
                      'iso_clause', 'access_level']:
            if field in data:
                setattr(doc, field, data[field])
        
        if 'is_controlled' in data:
            doc.is_controlled = data['is_controlled'] in ['true', 'True', True, '1']
        
        # Handle new file
        if file and allowed_file(file.filename):
            # Delete old file if exists
            if doc.file_path:
                old_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', doc.file_path)
                if os.path.exists(old_path):
                    os.remove(old_path)
            
            filename = secure_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            upload_folder = get_upload_folder()
            filepath = os.path.join(upload_folder, unique_name)
            file.save(filepath)
            
            doc.file_path = f"qms_documents/{unique_name}"
            doc.file_name = filename
            doc.file_size = os.path.getsize(filepath)
            doc.file_type = filename.rsplit('.', 1)[1].lower()
        
        doc.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Log
        log = QMSAuditLog(
            document_id=doc.id,
            action='Updated',
            performed_by=data.get('prepared_by', 'System'),
            details=f'Document {doc.doc_number} updated'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'message': 'Document updated', 'document': doc.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete a document"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        
        # Delete file
        if doc.file_path:
            filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', doc.file_path)
            if os.path.exists(filepath):
                os.remove(filepath)
        
        # Delete audit logs
        QMSAuditLog.query.filter_by(document_id=doc_id).delete()
        
        db.session.delete(doc)
        db.session.commit()
        
        return jsonify({'message': 'Document deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/download', methods=['GET'])
def download_document(doc_id):
    """Download a document file"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        
        if not doc.file_path:
            return jsonify({'error': 'No file attached'}), 404
        
        filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', doc.file_path)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Log download
        log = QMSAuditLog(
            document_id=doc.id,
            action='Downloaded',
            performed_by=request.args.get('user', 'Unknown'),
            details=f'Document {doc.doc_number} downloaded'
        )
        db.session.add(log)
        db.session.commit()
        
        return send_file(filepath, download_name=doc.file_name, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/status', methods=['PUT'])
def update_status(doc_id):
    """Update document status (workflow)"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        data = request.json
        
        old_status = doc.status
        doc.status = data.get('status', doc.status)
        
        if data.get('reviewed_by'):
            doc.reviewed_by = data['reviewed_by']
        if data.get('approved_by'):
            doc.approved_by = data['approved_by']
        
        doc.updated_at = datetime.utcnow()
        db.session.commit()
        
        log = QMSAuditLog(
            document_id=doc.id,
            action=f'Status Changed: {old_status} → {doc.status}',
            performed_by=data.get('performed_by', 'System'),
            details=f'Document {doc.doc_number} status changed from {old_status} to {doc.status}'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'message': 'Status updated', 'document': doc.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/audit-log', methods=['GET'])
def get_audit_log(doc_id):
    """Get audit trail for a document"""
    try:
        logs = QMSAuditLog.query.filter_by(document_id=doc_id).order_by(QMSAuditLog.timestamp.desc()).all()
        return jsonify({'logs': [l.to_dict() for l in logs]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/dashboard-stats', methods=['GET'])
def dashboard_stats():
    """Get QMS dashboard statistics"""
    try:
        total = QMSDocument.query.count()
        approved = QMSDocument.query.filter_by(status='Approved').count()
        draft = QMSDocument.query.filter_by(status='Draft').count()
        under_review = QMSDocument.query.filter_by(status='Under Review').count()
        obsolete = QMSDocument.query.filter_by(status='Obsolete').count()
        
        # Category counts
        category_counts = {}
        for cat in QMS_CATEGORIES:
            category_counts[cat] = QMSDocument.query.filter_by(category=cat).count()
        
        # Recent activity
        recent_logs = QMSAuditLog.query.order_by(QMSAuditLog.timestamp.desc()).limit(10).all()
        
        # Departments
        departments = db.session.query(QMSDocument.department).distinct().all()
        departments = [d[0] for d in departments if d[0]]
        
        return jsonify({
            'stats': {
                'total': total,
                'approved': approved,
                'draft': draft,
                'under_review': under_review,
                'obsolete': obsolete
            },
            'category_counts': category_counts,
            'recent_activity': [l.to_dict() for l in recent_logs],
            'departments': departments
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
