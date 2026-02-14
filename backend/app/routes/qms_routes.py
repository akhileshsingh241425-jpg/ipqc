from flask import Blueprint, request, jsonify, send_file
from app.models.database import db
from app.models.qms_models import QMSDocument, QMSPartnerAudit, QMSActionPlan, QMSAuditLog, QMSDocumentVersion
from datetime import datetime
from werkzeug.utils import secure_filename
import os
import uuid
import logging
import json

logger = logging.getLogger(__name__)

qms_bp = Blueprint('qms', __name__, url_prefix='/api/qms')


# ═══════════════════════════════════════════════
# Helper: QMS Document Categories for Solar Panel Mfg
# ═══════════════════════════════════════════════
QMS_CATEGORIES = {
    'Quality Manual': {
        'iso_clause': '4.2.2',
        'sub_categories': ['Quality Policy', 'Quality Objectives', 'Organization Chart', 'Process Interaction', 'Scope of QMS', 'Exclusions', 'Management Commitment', 'Customer Focus Policy']
    },
    'Procedures (SOP)': {
        'iso_clause': '4.2.1',
        'departments': {
            'Quality': ['Document Control SOP', 'Record Control SOP', 'Internal Audit SOP', 'Corrective Action SOP', 'Preventive Action SOP', 'Nonconformance SOP', 'CAPA SOP', 'Inspection & Testing SOP', 'Calibration SOP', 'Customer Complaint SOP', 'Sampling Plan SOP'],
            'Production': ['Production Control SOP', 'Process Change SOP', 'Rework & Repair SOP', 'Line Clearance SOP', 'Shift Handover SOP', 'Machine Startup SOP', 'Machine Shutdown SOP', 'Production Planning SOP', 'Output Recording SOP'],
            'Engineering': ['Design Control SOP', 'New Product Development SOP', 'Engineering Change SOP', 'BOM Management SOP', 'Drawing Control SOP', 'R&D Testing SOP'],
            'Procurement': ['Purchasing SOP', 'Supplier Evaluation SOP', 'Incoming Inspection SOP', 'Vendor Development SOP', 'PO Management SOP', 'Material Approval SOP'],
            'HR': ['Training SOP', 'Competency Assessment SOP', 'Induction SOP', 'Performance Review SOP'],
            'Warehouse': ['Material Storage SOP', 'FIFO/FEFO SOP', 'Inventory Control SOP', 'Dispatch SOP', 'Packaging SOP', 'Material Handling SOP'],
            'Maintenance': ['Preventive Maintenance SOP', 'Breakdown Maintenance SOP', 'Spare Parts SOP', 'TPM SOP', 'Equipment Validation SOP'],
            'Management': ['Management Review SOP', 'Risk Assessment SOP', 'Customer Communication SOP', 'Continual Improvement SOP'],
            'EHS': ['Safety SOP', 'Emergency Response SOP', 'Waste Disposal SOP', 'PPE Usage SOP', 'Fire Safety SOP', 'First Aid SOP']
        },
        'sub_categories': ['Document Control', 'Record Control', 'Internal Audit', 'Corrective Action',
                          'Preventive Action', 'Management Review', 'Training', 'Purchasing',
                          'Customer Communication', 'Design Control', 'Production Control',
                          'Inspection & Testing', 'Calibration', 'Nonconformance', 'CAPA']
    },
    'Work Instructions': {
        'iso_clause': '7.5.1',
        'departments': {
            'Cell Preparation': ['Cell Sorting WI', 'Cell Grading WI', 'Cell Visual Inspection WI', 'Cell Handling WI', 'Cell Storage WI', 'Cell Inventory WI'],
            'Stringing / Soldering': ['Cell Soldering WI', 'Stringer Machine Setup WI', 'Ribbon Cutting WI', 'Flux Application WI', 'Soldering Temperature Profile WI', 'String Inspection WI', 'Busbar Soldering WI', 'Lead Wire Soldering WI'],
            'Layup': ['Layup WI', 'Glass Cleaning WI', 'EVA/EPE Cutting WI', 'String Arrangement WI', 'Backsheet Cutting WI', 'Layup Inspection WI', 'Interconnection WI'],
            'Lamination': ['Lamination WI', 'Laminator Setup WI', 'Temperature & Pressure Profile WI', 'Lamination Inspection WI', 'Crosslink Test WI', 'Peel Test WI'],
            'Trimming & Finishing': ['Trimming WI', 'Edge Cleaning WI', 'Module Cleaning WI', 'Visual Check Post-Lamination WI'],
            'Framing': ['Framing WI', 'Frame Cutting WI', 'Sealant Application WI', 'Corner Key Assembly WI', 'Frame Alignment WI', 'Frame Torque WI'],
            'Junction Box': ['Junction Box Attach WI', 'J-Box Wiring WI', 'Diode Testing WI', 'Potting WI', 'J-Box Adhesive Application WI', 'Cable & Connector Attach WI'],
            'Testing & QC': ['Flash Testing WI', 'EL Testing WI', 'Hi-Pot Testing WI', 'Insulation Resistance WI', 'Visual Inspection WI', 'IV Curve Analysis WI', 'Leakage Current Test WI', 'Wet Leakage Test WI', 'Ground Continuity Test WI'],
            'Packing & Dispatch': ['Packing WI', 'Label Printing WI', 'Palletizing WI', 'Strapping WI', 'Loading WI', 'PDI Inspection WI', 'Dispatch Documentation WI'],
            'Maintenance Dept': ['Daily Machine Check WI', 'Laminator Maintenance WI', 'Stringer Maintenance WI', 'Framing Machine Maintenance WI', 'Simulator Maintenance WI', 'Compressor Maintenance WI']
        },
        'sub_categories': ['Cell Sorting', 'Cell Soldering', 'Layup', 'Lamination', 'Framing',
                          'Junction Box', 'Flash Testing', 'EL Testing', 'Visual Inspection',
                          'Packing', 'Hi-Pot Testing', 'Label Printing']
    },
    'Forms & Templates': {
        'iso_clause': '4.2.4',
        'departments': {
            'Quality': ['IPQC Forms', 'PDI Forms', 'FTR Forms', 'Final Inspection Form', 'NCR Form', 'CAPA Form', 'Audit Checklist', 'Hold Tag', 'Rejection Tag', 'COC Template', 'Deviation Report Form', 'Sampling Inspection Form'],
            'Production': ['Production Daily Report', 'Shift Report Form', 'Line Clearance Form', 'Rework Form', 'Downtime Log', 'Output Register', 'Process Deviation Form', 'Batch Record Form'],
            'Incoming QC': ['Incoming Inspection Form', 'Material Receiving Form', 'GRN Format', 'Incoming Rejection Form', 'Supplier Rating Form', 'COA Verification Form'],
            'Warehouse': ['Stock Register', 'Dispatch Challan', 'Material Issue Slip', 'GRN Format', 'Inventory Count Sheet', 'FIFO Register'],
            'HR': ['Training Record', 'Training Need Form', 'Skill Matrix Template', 'Attendance Register', 'Induction Checklist'],
            'Maintenance': ['PM Checklist', 'Breakdown Report', 'Spare Request Form', 'Equipment Log', 'Machine History Card'],
            'Management': ['MRM Minutes Template', 'Action Items Tracker', 'KPI Template', 'Risk Register Template']
        },
        'sub_categories': ['IPQC Forms', 'PDI Forms', 'FTR Forms', 'Incoming Inspection',
                          'Process Control', 'Final Inspection', 'NCR Form', 'CAPA Form',
                          'Training Record', 'Audit Checklist', 'MRM Minutes']
    },
    'Specifications': {
        'iso_clause': '7.1',
        'departments': {
            'Raw Materials': ['Solar Cell Spec', 'EVA/EPE Spec', 'Backsheet Spec', 'Glass Spec', 'Frame (Al Profile) Spec', 'Junction Box Spec', 'Ribbon/Busbar Spec', 'Sealant/Silicone Spec', 'Flux Spec', 'Label Spec', 'Connector Spec', 'Cable Spec', 'Corner Key Spec', 'Potting Material Spec'],
            'In-Process': ['Soldering Spec', 'Lamination Spec', 'Framing Torque Spec', 'EL Criteria Spec', 'Flash Test Limits', 'Hi-Pot Limits', 'Visual Inspection Criteria'],
            'Finished Goods': ['Module Datasheet (Mono/Poly)', 'Module Datasheet (Bifacial)', 'Module Datasheet (TopCon)', 'Module Datasheet (HJT)', 'Power Tolerance Spec', 'Dimension Spec'],
            'Packaging': ['Packaging Spec', 'Pallet Spec', 'Carton Spec', 'Strapping Spec', 'Label Placement Spec', 'Corner Protector Spec']
        },
        'sub_categories': ['Raw Material Specs', 'In-Process Specs', 'Finished Goods Specs',
                          'Packaging Specs', 'BOM Specifications', 'Module Specifications']
    },
    'Test Reports': {
        'iso_clause': '8.2.4',
        'departments': {
            'Type Testing': ['IEC 61215 Report', 'IEC 61730 Report', 'IEC 62804 (PID) Report', 'IEC 62716 (Ammonia) Report', 'IEC 61701 (Salt Mist) Report', 'UL 61730 Report'],
            'Reliability Testing': ['Thermal Cycling Report', 'Humidity Freeze Report', 'Damp Heat Report', 'UV Exposure Report', 'Mechanical Load Report', 'Hail Impact Report', 'Hot Spot Report', 'Bypass Diode Report'],
            'Performance Testing': ['Flash Test Reports', 'EL Test Reports', 'IV Curve Reports', 'Temperature Coefficient Report', 'NOCT Report', 'Module Efficiency Report'],
            'Safety Testing': ['Hi-Pot Test Reports', 'Insulation Resistance Reports', 'Wet Leakage Reports', 'Ground Continuity Reports', 'Fire Classification Report'],
            'Certification': ['BIS Certificate', 'ALMM Certificate', 'TUV Certificate', 'UL Certificate', 'MCS Certificate', 'CE Certificate']
        },
        'sub_categories': ['IEC Certificates', 'BIS Certificates', 'Type Test Reports',
                          'Reliability Test', 'Salt Mist Test', 'Ammonia Test', 'PID Test',
                          'Mechanical Load Test', 'Hail Test', 'Hot Spot Test']
    },
    'Inspection Records': {
        'iso_clause': '8.2.4',
        'departments': {
            'Incoming QC': ['Cell Incoming Inspection', 'Glass Incoming Inspection', 'EVA/EPE Incoming Inspection', 'Backsheet Incoming Inspection', 'Frame Incoming Inspection', 'JBox Incoming Inspection', 'Ribbon Incoming Inspection', 'Chemical/Flux Incoming Inspection', 'Packaging Material Inspection'],
            'In-Process QC (IPQC)': ['Stringer Output Check', 'Layup Check', 'Pre-Lamination Check', 'Post-Lamination Check', 'Trimming Check', 'Framing Check', 'JBox Fitment Check', 'Cleaning Check', 'EL Inspection', 'Visual Inspection'],
            'Final QC': ['Flash Test Record', 'Hi-Pot Record', 'Final Visual Record', 'Label Verification', 'Dimension Check Record', 'Packing Inspection'],
            'PDI': ['Pre-Dispatch Inspection', 'Customer Specific Inspection', 'Loading Inspection'],
            'Third Party': ['Customer Inspection Record', 'Third Party Lab Report', 'Bureau Veritas Report', 'TUV Inspection Report']
        },
        'sub_categories': ['Incoming Inspection', 'In-Process Inspection', 'Final Inspection',
                          'Customer Inspection', 'Third Party Inspection']
    },
    'Calibration Records': {
        'iso_clause': '7.6',
        'departments': {
            'Production Instruments': ['Flash Simulator Calibration', 'EL Camera Calibration', 'Laminator Thermocouple Calibration', 'Stringer Temperature Calibration', 'Torque Wrench Calibration', 'Weighing Scale Calibration'],
            'QC Instruments': ['Multimeter Calibration', 'Megger Calibration', 'Hi-Pot Tester Calibration', 'IR Thermometer Calibration', 'Vernier Caliper Calibration', 'Measuring Tape Calibration', 'Peel Tester Calibration', 'Surface Roughness Tester'],
            'Lab Instruments': ['UV-Vis Spectrophotometer', 'Cross-link Tester', 'Gel Content Tester', 'Shore Hardness Tester', 'Thickness Gauge'],
            'Environmental': ['Temperature Logger Calibration', 'Humidity Logger Calibration', 'Lux Meter Calibration'],
            'MSA': ['MSA Study Reports', 'GR&R Reports', 'Bias Study', 'Linearity Study', 'Stability Study']
        },
        'sub_categories': ['Calibration Certificates', 'Calibration Schedule', 'MSA Reports']
    },
    'Audit Reports': {
        'iso_clause': '8.2.2',
        'departments': {
            'Internal': ['Quality System Audit', 'Process Audit', 'Product Audit', 'Layered Process Audit', '5S Audit', 'EHS Audit'],
            'External': ['ISO 9001 Surveillance Audit', 'ISO 14001 Audit', 'ISO 45001 Audit', 'BIS Audit', 'ALMM Audit'],
            'Customer': ['Customer Quality Audit', 'Customer Process Audit', 'Partner Assessment Audit', 'Second Party Audit'],
            'Supplier': ['Supplier Quality Audit', 'Supplier Process Audit', 'Supplier Development Audit', 'New Supplier Audit']
        },
        'sub_categories': ['Internal Audit', 'External Audit', 'Supplier Audit',
                          'Customer Audit', 'Surveillance Audit']
    },
    'CAPA & NCR': {
        'iso_clause': '8.5',
        'departments': {
            'Customer Related': ['Customer Complaints', 'Warranty Claims', 'Field Failures', 'Customer Returns', 'Customer Feedback'],
            'Internal': ['Internal NCR', 'Process NCR', 'Product NCR', 'Rework NCR', 'Scrap NCR'],
            'Supplier Related': ['Supplier NCR', 'Incoming Rejection', 'Supplier Corrective Action'],
            'Analysis': ['Root Cause Analysis (8D)', 'Why-Why Analysis', 'Fishbone Analysis', 'Pareto Analysis', 'Trend Analysis'],
            'Actions': ['Corrective Actions', 'Preventive Actions', 'Containment Actions', 'Effectiveness Verification']
        },
        'sub_categories': ['Customer Complaints', 'Internal NCR', 'Supplier NCR',
                          'Corrective Actions', 'Preventive Actions', 'Root Cause Analysis']
    },
    'Training Records': {
        'iso_clause': '6.2',
        'departments': {
            'Quality': ['QMS Awareness Training', 'Internal Auditor Training', 'Statistical Techniques', 'Inspection Techniques', 'Calibration Training'],
            'Production': ['Operator Skill Training', 'Machine Operation Training', 'Soldering Training', 'Lamination Training', 'Safety Training', 'New Joinee OJT'],
            'Engineering': ['New Product Training', 'Design Tools Training', 'Process Engineering Training'],
            'HR/Admin': ['Induction Training', 'Competency Matrix', 'Training Needs Identification', 'Training Effectiveness Evaluation', 'Annual Training Plan'],
            'Maintenance': ['Equipment Handling Training', 'TPM Training', 'Electrical Safety Training'],
            'EHS': ['Fire Safety Training', 'First Aid Training', 'Chemical Handling Training', 'Emergency Drill Record']
        },
        'sub_categories': ['Training Matrix', 'Competency Records', 'Training Plans',
                          'Training Certificates', 'Skill Assessment']
    },
    'Supplier Documents': {
        'iso_clause': '7.4',
        'departments': {
            'Supplier Management': ['Approved Supplier List', 'Supplier Evaluation Report', 'Supplier Score Card', 'Supplier Audit Report', 'Supplier Development Plan'],
            'Supplier Certificates': ['ISO Certificate (Supplier)', 'Test Reports (Supplier)', 'IEC Certificate (Supplier)', 'BIS Certificate (Supplier)', 'RoHS/REACH Certificate'],
            'Material Documents': ['Raw Material COA', 'Material Test Certificate', 'MSDS/SDS', 'Batch Certificate', 'Material Datasheet'],
            'Commercial': ['Purchase Orders', 'Rate Contract', 'Supplier Agreement', 'Quality Agreement', 'NDA']
        },
        'sub_categories': ['Approved Supplier List', 'Supplier Evaluation', 'Supplier Certificates',
                          'Raw Material COA', 'MSDS/SDS']
    },
    'Management Review': {
        'iso_clause': '5.6',
        'departments': {
            'MRM': ['MRM Minutes', 'MRM Presentations', 'MRM Action Items', 'MRM Attendance'],
            'KPIs': ['Quality KPI Report', 'Production KPI Report', 'Delivery KPI Report', 'Customer Satisfaction KPI', 'Supplier KPI Report', 'EHS KPI Report'],
            'Objectives': ['Quality Objectives Review', 'Department Objectives', 'Annual Targets', 'Objective Achievement Report'],
            'Analysis': ['Trend Analysis Report', 'Cost of Quality Report', 'Continual Improvement Report', 'Risk & Opportunity Review']
        },
        'sub_categories': ['MRM Minutes', 'MRM Presentations', 'KPI Reports',
                          'Quality Objectives Review', 'Action Items']
    },
    'Process Documents': {
        'iso_clause': '7.5',
        'departments': {
            'Process Planning': ['Process Flow Chart', 'Control Plan', 'FMEA (Process)', 'FMEA (Design)', 'Process Validation Report'],
            'Production Layout': ['Plant Layout', 'Line Layout', 'Material Flow Diagram', 'Operator Station Layout'],
            'Process Control': ['SPC Charts', 'Process Capability Study (Cpk)', 'Run Charts', 'Control Charts', 'Process Parameter Sheet'],
            'Improvement': ['Kaizen Reports', 'Poka-Yoke Register', 'Value Stream Map', 'OEE Reports', '5S Implementation']
        },
        'sub_categories': ['Process Flow Chart', 'Control Plan', 'FMEA',
                          'Process Validation', 'Production Layout']
    },
    'Certificates & Licenses': {
        'iso_clause': '',
        'departments': {
            'Quality Certificates': ['ISO 9001:2015 Certificate', 'ISO 14001:2015 Certificate', 'ISO 45001:2018 Certificate', 'IATF 16949 Certificate'],
            'Product Certificates': ['IEC 61215 Certificate', 'IEC 61730 Certificate', 'BIS Certificate', 'ALMM Certificate', 'TUV Certificate', 'UL Certificate', 'MCS Certificate', 'CE Marking'],
            'Statutory Licenses': ['Factory License', 'Pollution Certificate (CTO/CTE)', 'Fire NOC', 'Electrical Inspector License', 'Boiler License', 'Trade License', 'FSSAI (Canteen)', 'Contract Labour License'],
            'Company': ['Company Registration', 'GST Certificate', 'PAN Card', 'MSME/Udyam Certificate', 'Import-Export Code (IEC)', 'Insurance Policies']
        },
        'sub_categories': ['ISO 9001 Certificate', 'ISO 14001 Certificate', 'ISO 45001 Certificate',
                          'IEC 61215', 'IEC 61730', 'BIS Certificate', 'ALMM Certificate',
                          'Factory License', 'Pollution Certificate', 'Fire NOC']
    },
    'EHS Documents': {
        'iso_clause': '6.4',
        'departments': {
            'Safety': ['Safety Policy', 'Safety Manual', 'HIRA Register', 'JSA (Job Safety Analysis)', 'PPE Matrix', 'Safety Induction Record', 'Accident/Incident Report', 'Near Miss Report'],
            'Environment': ['EMS Manual', 'Aspect-Impact Register', 'Waste Management Plan', 'Pollution Control Records', 'Environmental Monitoring Report'],
            'Health': ['Health Checkup Records', 'First Aid Register', 'Occupational Health Report'],
            'Emergency': ['Emergency Preparedness Plan', 'Evacuation Plan', 'Fire Drill Record', 'Mock Drill Record', 'Emergency Contact List']
        },
        'sub_categories': ['Safety Policy', 'HIRA Register', 'PPE Matrix', 'Accident Report', 'Waste Management', 'Emergency Plan', 'Mock Drill Record']
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
            
            # Auto-extract text for AI search
            try:
                from app.services.document_search import extract_text_from_file
                extracted = extract_text_from_file(filepath)
                if extracted:
                    doc.extracted_text = extracted
                    doc.text_extracted_at = datetime.utcnow()
            except Exception as ex:
                logger.warning(f'Text extraction failed: {ex}')
        
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
            # Keep old file for version history (don't delete)
            
            filename = secure_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            upload_folder = get_upload_folder()
            filepath = os.path.join(upload_folder, unique_name)
            file.save(filepath)
            
            doc.file_path = f"qms_documents/{unique_name}"
            doc.file_name = filename
            doc.file_size = os.path.getsize(filepath)
            doc.file_type = filename.rsplit('.', 1)[1].lower()
            
            # Auto-extract text for AI search
            try:
                from app.services.document_search import extract_text_from_file
                extracted = extract_text_from_file(filepath)
                if extracted:
                    doc.extracted_text = extracted
                    doc.text_extracted_at = datetime.utcnow()
            except Exception as ex:
                logger.warning(f'Text extraction failed on update: {ex}')
        
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


# ═══════════════════════════════════════════════
# DOCUMENT VERSION CONTROL ROUTES (Git-like)
# ═══════════════════════════════════════════════

@qms_bp.route('/documents/<int:doc_id>/checkout', methods=['POST'])
def checkout_document(doc_id):
    """Check out a document for editing - locks it and provides Word download"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        data = request.json or {}
        user = data.get('user', 'Unknown')
        
        if doc.is_locked and doc.checked_out_by != user:
            return jsonify({
                'error': f'Document is already checked out by {doc.checked_out_by}',
                'checked_out_by': doc.checked_out_by,
                'checked_out_at': doc.checked_out_at.isoformat() if doc.checked_out_at else None
            }), 409
        
        # Lock the document
        doc.is_locked = True
        doc.checked_out_by = user
        doc.checked_out_at = datetime.utcnow()
        db.session.commit()
        
        # Log the checkout
        log = QMSAuditLog(
            document_id=doc.id,
            action='Checked Out',
            performed_by=user,
            details=f'Document {doc.doc_number} v{doc.version} checked out for editing'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': f'Document checked out successfully by {user}',
            'document': doc.to_dict(),
            'download_url': f'/api/qms/documents/{doc_id}/download'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/checkin', methods=['POST'])
def checkin_document(doc_id):
    """Check in a document with new version - like Git commit"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
            file = request.files.get('file')
        else:
            data = request.json or {}
            file = None
        
        user = data.get('user', 'Unknown')
        commit_message = data.get('commit_message', '')
        change_type = data.get('change_type', 'Update')
        new_version = data.get('new_version', '')
        
        if not commit_message:
            return jsonify({'error': 'Commit message is required'}), 400
        
        # Save current version as a snapshot before updating
        version_snapshot = QMSDocumentVersion(
            document_id=doc.id,
            version_number=doc.version,
            commit_message=f'[Auto-snapshot] Before v{new_version or "update"}: {doc.version}',
            changed_by='System',
            change_type='Snapshot',
            file_path=doc.file_path,
            file_name=doc.file_name,
            file_size=doc.file_size,
            file_type=doc.file_type,
            title_snapshot=doc.title,
            status_snapshot=doc.status
        )
        
        # Only save snapshot if there's no existing version record for current version
        existing = QMSDocumentVersion.query.filter_by(
            document_id=doc.id, version_number=doc.version
        ).first()
        if not existing:
            db.session.add(version_snapshot)
        
        # Handle new file upload
        if file and allowed_file(file.filename):
            # Keep old file (don't delete - it's our version history)
            filename = secure_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            upload_folder = get_upload_folder()
            filepath = os.path.join(upload_folder, unique_name)
            file.save(filepath)
            
            doc.file_path = f"qms_documents/{unique_name}"
            doc.file_name = filename
            doc.file_size = os.path.getsize(filepath)
            doc.file_type = filename.rsplit('.', 1)[1].lower()
            
            # Auto-extract text
            try:
                from app.services.document_search import extract_text_from_file
                extracted = extract_text_from_file(filepath)
                if extracted:
                    doc.extracted_text = extracted
                    doc.text_extracted_at = datetime.utcnow()
            except Exception as ex:
                logger.warning(f'Text extraction failed on checkin: {ex}')
        
        # Auto-increment version if not provided
        if new_version:
            doc.version = new_version
        else:
            try:
                parts = doc.version.split('.')
                if change_type in ['Major Revision', 'Major']:
                    doc.version = f"{int(parts[0]) + 1}.0"
                else:
                    doc.version = f"{parts[0]}.{int(parts[1]) + 1}"
            except (ValueError, IndexError):
                doc.version = '1.1'
        
        # Unlock the document
        doc.is_locked = False
        doc.checked_out_by = None
        doc.checked_out_at = None
        doc.updated_at = datetime.utcnow()
        
        # Create new version record (the commit)
        new_version_record = QMSDocumentVersion(
            document_id=doc.id,
            version_number=doc.version,
            commit_message=commit_message,
            changed_by=user,
            change_type=change_type,
            file_path=doc.file_path,
            file_name=doc.file_name,
            file_size=doc.file_size,
            file_type=doc.file_type,
            title_snapshot=doc.title,
            status_snapshot=doc.status
        )
        db.session.add(new_version_record)
        db.session.commit()
        
        # Audit log
        log = QMSAuditLog(
            document_id=doc.id,
            action='Checked In (New Version)',
            performed_by=user,
            details=f'Document {doc.doc_number} updated to v{doc.version}. Commit: {commit_message}'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': f'Document checked in as v{doc.version}',
            'document': doc.to_dict(),
            'version': new_version_record.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/cancel-checkout', methods=['POST'])
def cancel_checkout(doc_id):
    """Cancel checkout without changes - unlock the document"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        data = request.json or {}
        user = data.get('user', 'Unknown')
        
        doc.is_locked = False
        doc.checked_out_by = None
        doc.checked_out_at = None
        db.session.commit()
        
        log = QMSAuditLog(
            document_id=doc.id,
            action='Checkout Cancelled',
            performed_by=user,
            details=f'Document {doc.doc_number} checkout cancelled, no changes made'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({'message': 'Checkout cancelled', 'document': doc.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/versions', methods=['GET'])
def get_versions(doc_id):
    """Get version history - like Git log"""
    try:
        versions = QMSDocumentVersion.query.filter_by(
            document_id=doc_id
        ).order_by(QMSDocumentVersion.created_at.desc()).all()
        
        return jsonify({
            'versions': [v.to_dict() for v in versions],
            'total': len(versions)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/versions/<int:version_id>/download', methods=['GET'])
def download_version(doc_id, version_id):
    """Download a specific version's file"""
    try:
        version = QMSDocumentVersion.query.get_or_404(version_id)
        
        if version.document_id != doc_id:
            return jsonify({'error': 'Version does not belong to this document'}), 400
        
        if not version.file_path:
            return jsonify({'error': 'No file for this version'}), 404
        
        filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', version.file_path)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'Version file not found on disk'}), 404
        
        download_name = f"v{version.version_number}_{version.file_name}" if version.file_name else f"v{version.version_number}"
        return send_file(filepath, download_name=download_name, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/documents/<int:doc_id>/revert/<int:version_id>', methods=['POST'])
def revert_to_version(doc_id, version_id):
    """Revert document to a previous version - like Git revert"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        version = QMSDocumentVersion.query.get_or_404(version_id)
        data = request.json or {}
        user = data.get('user', 'Unknown')
        
        if version.document_id != doc_id:
            return jsonify({'error': 'Version does not belong to this document'}), 400
        
        if doc.is_locked:
            return jsonify({'error': f'Document is checked out by {doc.checked_out_by}. Cancel checkout first.'}), 409
        
        # Save current state as version before reverting
        current_snapshot = QMSDocumentVersion(
            document_id=doc.id,
            version_number=doc.version,
            commit_message=f'[Auto-snapshot] Before revert to v{version.version_number}',
            changed_by='System',
            change_type='Snapshot',
            file_path=doc.file_path,
            file_name=doc.file_name,
            file_size=doc.file_size,
            file_type=doc.file_type,
            title_snapshot=doc.title,
            status_snapshot=doc.status
        )
        db.session.add(current_snapshot)
        
        # Revert document to old version
        old_version = doc.version
        doc.file_path = version.file_path
        doc.file_name = version.file_name
        doc.file_size = version.file_size
        doc.file_type = version.file_type
        
        # Increment version number
        try:
            parts = doc.version.split('.')
            doc.version = f"{int(parts[0]) + 1}.0"
        except (ValueError, IndexError):
            doc.version = '2.0'
        
        doc.updated_at = datetime.utcnow()
        
        # Create revert version record
        revert_record = QMSDocumentVersion(
            document_id=doc.id,
            version_number=doc.version,
            commit_message=f'Reverted from v{old_version} to v{version.version_number}',
            changed_by=user,
            change_type='Revert',
            file_path=doc.file_path,
            file_name=doc.file_name,
            file_size=doc.file_size,
            file_type=doc.file_type,
            title_snapshot=doc.title,
            status_snapshot=doc.status
        )
        db.session.add(revert_record)
        db.session.commit()
        
        # Audit log
        log = QMSAuditLog(
            document_id=doc.id,
            action='Reverted',
            performed_by=user,
            details=f'Document {doc.doc_number} reverted from v{old_version} to v{version.version_number} (now v{doc.version})'
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': f'Document reverted to v{version.version_number} (new version: v{doc.version})',
            'document': doc.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════
# PARTNER AUDIT ROUTES
# ═══════════════════════════════════════════════

@qms_bp.route('/audits', methods=['GET'])
def get_audits():
    """Get all partner audits"""
    try:
        audits = QMSPartnerAudit.query.order_by(QMSPartnerAudit.updated_at.desc()).all()
        return jsonify({'audits': [a.to_dict() for a in audits]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits', methods=['POST'])
def create_audit():
    """Create a new partner audit"""
    try:
        data = request.json
        audit = QMSPartnerAudit(
            audit_name=data.get('audit_name', ''),
            audit_type=data.get('audit_type', 'Initial Assessment'),
            partner_name=data.get('partner_name', ''),
            partner_location=data.get('partner_location', ''),
            auditor_name=data.get('auditor_name', ''),
            auditor_designation=data.get('auditor_designation', ''),
            audit_date=data.get('audit_date', ''),
            scores_json=data.get('scores_json', '{}'),
            total_score=data.get('total_score', 0),
            max_score=data.get('max_score', 0),
            percentage=data.get('percentage', 0),
            overall_rating=data.get('overall_rating', ''),
            summary=data.get('summary', ''),
            status=data.get('status', 'In Progress')
        )
        db.session.add(audit)
        db.session.commit()
        return jsonify({'message': 'Audit created', 'audit': audit.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits/<int:audit_id>', methods=['GET'])
def get_audit(audit_id):
    """Get a single audit with scores and action plans"""
    try:
        audit = QMSPartnerAudit.query.get_or_404(audit_id)
        actions = QMSActionPlan.query.filter_by(audit_id=audit_id).order_by(QMSActionPlan.priority.desc()).all()
        return jsonify({
            'audit': audit.to_dict(),
            'action_plans': [a.to_dict() for a in actions]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits/<int:audit_id>', methods=['PUT'])
def update_audit(audit_id):
    """Update audit scores"""
    try:
        audit = QMSPartnerAudit.query.get_or_404(audit_id)
        data = request.json
        
        for field in ['audit_name', 'audit_type', 'partner_name', 'partner_location',
                      'auditor_name', 'auditor_designation', 'audit_date', 'scores_json',
                      'summary', 'status', 'overall_rating']:
            if field in data:
                setattr(audit, field, data[field])
        
        if 'total_score' in data: audit.total_score = data['total_score']
        if 'max_score' in data: audit.max_score = data['max_score']
        if 'percentage' in data: audit.percentage = data['percentage']
        
        audit.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Audit updated', 'audit': audit.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits/<int:audit_id>', methods=['DELETE'])
def delete_audit(audit_id):
    """Delete an audit"""
    try:
        audit = QMSPartnerAudit.query.get_or_404(audit_id)
        QMSActionPlan.query.filter_by(audit_id=audit_id).delete()
        db.session.delete(audit)
        db.session.commit()
        return jsonify({'message': 'Audit deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits/<int:audit_id>/action-plans', methods=['GET'])
def get_action_plans(audit_id):
    """Get action plans for an audit"""
    try:
        actions = QMSActionPlan.query.filter_by(audit_id=audit_id).order_by(QMSActionPlan.id).all()
        return jsonify({'action_plans': [a.to_dict() for a in actions]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits/<int:audit_id>/action-plans', methods=['POST'])
def create_action_plan(audit_id):
    """Create action plan for gap items"""
    try:
        data = request.json
        action = QMSActionPlan(
            audit_id=audit_id,
            section_id=data.get('section_id', ''),
            question_id=data.get('question_id', ''),
            question_text=data.get('question_text', ''),
            current_score=data.get('current_score', 0),
            target_score=data.get('target_score', 4),
            gap_description=data.get('gap_description', ''),
            action_plan=data.get('action_plan', ''),
            responsible=data.get('responsible', ''),
            target_date=data.get('target_date', ''),
            status=data.get('status', 'Open'),
            priority=data.get('priority', 'Medium'),
            remarks=data.get('remarks', '')
        )
        db.session.add(action)
        db.session.commit()
        return jsonify({'message': 'Action plan created', 'action_plan': action.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/action-plans/<int:action_id>', methods=['PUT'])
def update_action_plan(action_id):
    """Update action plan status"""
    try:
        action = QMSActionPlan.query.get_or_404(action_id)
        data = request.json
        for field in ['action_plan', 'responsible', 'target_date', 'completion_date',
                      'status', 'evidence', 'remarks', 'priority']:
            if field in data:
                setattr(action, field, data[field])
        db.session.commit()
        return jsonify({'message': 'Action plan updated', 'action_plan': action.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/action-plans/<int:action_id>', methods=['DELETE'])
def delete_action_plan(action_id):
    """Delete action plan"""
    try:
        action = QMSActionPlan.query.get_or_404(action_id)
        db.session.delete(action)
        db.session.commit()
        return jsonify({'message': 'Action plan deleted'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/audits/<int:audit_id>/generate-actions', methods=['POST'])
def generate_action_plans(audit_id):
    """Auto-generate action plans for all items scoring below threshold"""
    try:
        import json
        audit = QMSPartnerAudit.query.get_or_404(audit_id)
        data = request.json
        threshold = data.get('threshold', 3)  # Generate actions for scores < threshold
        scores = json.loads(audit.scores_json) if audit.scores_json else {}
        
        # Delete existing auto-generated actions
        QMSActionPlan.query.filter_by(audit_id=audit_id).delete()
        
        created = 0
        for section_id, questions in scores.items():
            if isinstance(questions, dict):
                for q_id, q_data in questions.items():
                    if isinstance(q_data, dict):
                        score = q_data.get('score', -1)
                        if score >= 0 and score < threshold:
                            priority = 'Critical' if score <= 1 else ('High' if score == 2 else 'Medium')
                            action = QMSActionPlan(
                                audit_id=audit_id,
                                section_id=section_id,
                                question_id=q_id,
                                question_text=q_data.get('question_text', ''),
                                current_score=score,
                                target_score=4,
                                gap_description=q_data.get('observation', ''),
                                action_plan=q_data.get('action', ''),
                                responsible=q_data.get('responsible', ''),
                                target_date=q_data.get('target_date', ''),
                                status='Open',
                                priority=priority
                            )
                            db.session.add(action)
                            created += 1
        
        db.session.commit()
        actions = QMSActionPlan.query.filter_by(audit_id=audit_id).order_by(QMSActionPlan.priority.desc()).all()
        return jsonify({
            'message': f'{created} action plans generated',
            'action_plans': [a.to_dict() for a in actions]
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════
# AI DOCUMENT ASSISTANT ROUTES
# RAG-Powered: TF-IDF Search + Groq LLM for intelligent answers
# ═══════════════════════════════════════════════════════════════

import os as _os
GROQ_API_KEY = _os.environ.get('GROQ_API_KEY', '')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

# Conversation memory (per-session, last N messages)
_conversation_history = []
MAX_HISTORY = 10


def _call_groq_llm(system_prompt, user_message, temperature=0.4, max_tokens=1500):
    """Call Groq LLM API"""
    import requests as _requests
    global GROQ_API_KEY
    if not GROQ_API_KEY:
        GROQ_API_KEY = _os.environ.get('GROQ_API_KEY', '')
    if not GROQ_API_KEY:
        return None

    try:
        headers = {
            'Authorization': f'Bearer {GROQ_API_KEY}',
            'Content-Type': 'application/json'
        }

        # Build messages with conversation history
        messages = [{'role': 'system', 'content': system_prompt}]

        # Add recent conversation history for context
        for h in _conversation_history[-MAX_HISTORY:]:
            messages.append(h)

        messages.append({'role': 'user', 'content': user_message})

        payload = {
            'model': 'llama-3.1-8b-instant',
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'stream': False
        }

        resp = _requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            answer = data['choices'][0]['message']['content']

            # Save to conversation history
            _conversation_history.append({'role': 'user', 'content': user_message[:500]})
            _conversation_history.append({'role': 'assistant', 'content': answer[:500]})

            # Trim history
            while len(_conversation_history) > MAX_HISTORY * 2:
                _conversation_history.pop(0)

            return answer
        else:
            logger.error(f"Groq API error {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.error(f"Groq LLM call failed: {e}")
        return None


QMS_SYSTEM_PROMPT = """You are an expert QMS (Quality Management System) AI Assistant for a Solar Panel Manufacturing company (GSPL - Green Solar Power Limited).

Your expertise covers:
- ISO 9001:2015 Quality Management Systems
- Solar panel manufacturing processes (Cell sorting, Stringing, Layup, Lamination, Trimming, Framing, J-Box, Flash Testing, EL Inspection, Hi-Pot, Packing, PDI)
- IEC 61215 / IEC 61730 standards for PV modules
- BIS certification and ALMM compliance
- Document control procedures (SOPs, Work Instructions, Quality Plans, Inspection Checklists)
- NCR (Non-Conformance Reports), CAPA (Corrective & Preventive Actions)
- Internal & External Audits
- Calibration management
- Supplier quality management
- Training & Competency management

RESPONSE GUIDELINES:
1. Answer in Hindi-English mix (Hinglish) naturally - the way Indian quality professionals speak
2. Be specific and technical - give exact parameters, temperatures, specifications when you know them
3. Reference document sources when available
4. Use bullet points and structured formatting
5. If document context is provided, ALWAYS prioritize information from the documents
6. Add practical insights from solar manufacturing domain knowledge
7. If you don't know something, say so honestly
8. Use emojis sparingly for better readability (📋, ✅, ⚠️, 📊, etc.)
9. Keep answers comprehensive but not overly long
10. Suggest follow-up questions when relevant

When document context is provided between [DOCUMENT CONTEXT START] and [DOCUMENT CONTEXT END], 
use that information as the PRIMARY source for your answer. Cite the document title and number."""


@qms_bp.route('/assistant/query', methods=['POST'])
def assistant_query():
    """
    AI Document Assistant - RAG-powered Query endpoint
    Step 1: Search documents with TF-IDF
    Step 2: Send relevant context to Groq LLM for intelligent answer
    Fallback: TF-IDF answer if LLM unavailable
    """
    try:
        from app.services.document_search import search_documents, answer_question

        data = request.json
        query = data.get('query', '').strip()
        mode = data.get('mode', 'auto')  # auto, ai, search

        if not query:
            return jsonify({'error': 'Query is required'}), 400

        # Get all documents with extracted text
        all_docs = QMSDocument.query.all()
        all_docs_count = len(all_docs)

        # Prepare documents for search
        doc_list = []
        indexed_count = 0
        for doc in all_docs:
            doc_dict = {
                'id': doc.id,
                'doc_number': doc.doc_number,
                'title': doc.title,
                'category': doc.category,
                'department': doc.department,
                'status': doc.status,
                'file_name': doc.file_name,
                'description': doc.description or '',
                'tags': doc.tags or '',
                'extracted_text': doc.extracted_text or ''
            }
            if doc.extracted_text:
                indexed_count += 1
            doc_list.append(doc_dict)

        # Step 1: TF-IDF Search for relevant documents
        search_results = search_documents(query, doc_list, top_k=8)

        # Step 2: Try RAG with Groq LLM
        ai_answer = None
        ai_used = False

        if mode != 'search':
            # Build context from search results
            context_parts = []
            for i, result in enumerate(search_results[:5]):
                passage = result.get('passage', '')
                title = result.get('title', '')
                doc_num = result.get('doc_number', '')
                context_parts.append(f"Document: {title} ({doc_num})\n{passage}")

            if context_parts:
                doc_context = "\n\n---\n\n".join(context_parts)
                user_msg = f"""[DOCUMENT CONTEXT START]
{doc_context}
[DOCUMENT CONTEXT END]

User Question: {query}

Answer based on the document context above. If the context doesn't fully answer the question, 
supplement with your QMS/Solar manufacturing expertise. Always mention which document the information came from."""
            else:
                user_msg = f"""No documents found matching this query. 
                
User Question: {query}

Answer using your QMS and Solar Panel Manufacturing expertise. 
Mention that no specific documents were found but provide expert guidance."""

            ai_answer = _call_groq_llm(QMS_SYSTEM_PROMPT, user_msg)
            if ai_answer:
                ai_used = True

        # Build response
        if ai_used:
            # Determine confidence from search results
            confidence = 'low'
            if search_results:
                top_score = search_results[0].get('score', 0)
                top_coverage = search_results[0].get('coverage', 0)
                if top_score > 1.0 and top_coverage > 60:
                    confidence = 'high'
                elif top_score > 0.3:
                    confidence = 'medium'

            sources = []
            for result in search_results[:5]:
                sources.append({
                    'id': result['doc_id'],
                    'title': result['title'],
                    'doc_number': result['doc_number'],
                    'category': result['category'],
                    'score': result['score'],
                    'coverage': result['coverage'],
                    'matched_terms': result['matched_terms']
                })

            response = {
                'answer': ai_answer,
                'sources': sources,
                'total_docs': all_docs_count,
                'indexed_docs': indexed_count,
                'results_count': len(search_results),
                'confidence': confidence if search_results else 'ai',
                'ai_powered': True,
                'suggestions': _generate_smart_suggestions(query, search_results)
            }
        else:
            # Fallback to TF-IDF answer
            response = answer_question(query, search_results, all_docs_count, indexed_count)
            response['ai_powered'] = False

        return jsonify(response)
    except Exception as e:
        logger.error(f"Assistant query error: {e}")
        return jsonify({'error': str(e)}), 500


def _generate_smart_suggestions(query, search_results):
    """Generate intelligent follow-up suggestions"""
    query_lower = query.lower()
    suggestions = []

    # Based on what was found
    if search_results:
        categories = set(r.get('category', '') for r in search_results[:3])
        for cat in categories:
            if cat and cat.lower() not in query_lower:
                suggestions.append(f"{cat} ke related procedures kya hain?")

    # Domain-specific suggestions
    topic_suggestions = {
        'lamination': ['Lamination temperature profile kya hona chahiye?', 'Crosslink test procedure', 'EVA/EPE gel content specification'],
        'solder': ['Stringer machine parameters', 'Ribbon soldering temperature', 'Cell breakage analysis'],
        'testing': ['Flash test parameters for different wattages', 'EL inspection criteria', 'Hi-pot test voltage specification'],
        'packing': ['Packing SOP checklist', 'Pallet specification', 'Dispatch documentation'],
        'calibr': ['Calibration schedule', 'Measurement uncertainty calculation', 'Calibration certificate requirements'],
        'audit': ['Internal audit checklist', 'Audit non-conformance categories', 'Management review inputs'],
        'ncr': ['NCR categorization', 'Root cause analysis methods', 'CAPA effectiveness verification'],
        'iso': ['ISO 9001:2015 clause requirements', 'Quality objectives monitoring', 'Document control procedure'],
        'inspect': ['Incoming inspection criteria', 'In-process inspection checklist', 'Final inspection parameters'],
        'train': ['Training needs identification', 'Competency matrix', 'Training effectiveness evaluation'],
    }

    for key, suggs in topic_suggestions.items():
        if key in query_lower:
            suggestions.extend(suggs[:2])
            break

    if not suggestions:
        suggestions = [
            'Quality Manual ka scope kya hai?',
            'ISO 9001 compliance status',
            'Latest audit findings kya hain?'
        ]

    return suggestions[:4]


@qms_bp.route('/assistant/chat-history', methods=['DELETE'])
def clear_chat_history():
    """Clear conversation history"""
    global _conversation_history
    _conversation_history = []
    return jsonify({'message': 'Chat history cleared'})


@qms_bp.route('/assistant/ai-status', methods=['GET'])
def ai_status():
    """Check if AI (Groq) is configured and available"""
    global GROQ_API_KEY
    if not GROQ_API_KEY:
        GROQ_API_KEY = _os.environ.get('GROQ_API_KEY', '')
    return jsonify({
        'ai_available': bool(GROQ_API_KEY),
        'model': 'llama-3.1-8b-instant',
        'provider': 'Groq',
        'history_length': len(_conversation_history) // 2
    })


@qms_bp.route('/assistant/extract/<int:doc_id>', methods=['POST'])
def extract_document_text(doc_id):
    """Extract text from a single document and save it"""
    try:
        from app.services.document_search import extract_text_from_file
        
        doc = QMSDocument.query.get_or_404(doc_id)
        
        if not doc.file_path:
            return jsonify({'error': 'No file attached to this document'}), 400
        
        filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', doc.file_path)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found on disk'}), 404
        
        extracted = extract_text_from_file(filepath)
        
        if extracted:
            doc.extracted_text = extracted
            doc.text_extracted_at = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'message': f'Text extracted successfully ({len(extracted)} characters)',
                'doc_id': doc.id,
                'title': doc.title,
                'text_length': len(extracted),
                'preview': extracted[:500] + ('...' if len(extracted) > 500 else ''),
                'extracted_at': doc.text_extracted_at.isoformat()
            })
        else:
            return jsonify({
                'message': 'Could not extract text from this file',
                'doc_id': doc.id,
                'text_length': 0
            })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Text extraction error for doc {doc_id}: {e}")
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/assistant/extract-all', methods=['POST'])
def extract_all_documents():
    """Extract text from ALL uploaded documents that haven't been processed yet"""
    try:
        from app.services.document_search import extract_text_from_file
        
        force = request.json.get('force', False) if request.json else False
        
        if force:
            docs = QMSDocument.query.filter(QMSDocument.file_path.isnot(None)).all()
        else:
            docs = QMSDocument.query.filter(
                QMSDocument.file_path.isnot(None),
                QMSDocument.extracted_text.is_(None)
            ).all()
        
        results = {
            'total': len(docs),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'details': []
        }
        
        for doc in docs:
            filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', doc.file_path)
            
            if not os.path.exists(filepath):
                results['skipped'] += 1
                results['details'].append({
                    'id': doc.id, 'title': doc.title, 'status': 'skipped', 'reason': 'File not found'
                })
                continue
            
            try:
                extracted = extract_text_from_file(filepath)
                if extracted:
                    doc.extracted_text = extracted
                    doc.text_extracted_at = datetime.utcnow()
                    results['success'] += 1
                    results['details'].append({
                        'id': doc.id, 'title': doc.title, 'status': 'success',
                        'text_length': len(extracted)
                    })
                else:
                    results['failed'] += 1
                    results['details'].append({
                        'id': doc.id, 'title': doc.title, 'status': 'failed',
                        'reason': 'No text extracted'
                    })
            except Exception as ex:
                results['failed'] += 1
                results['details'].append({
                    'id': doc.id, 'title': doc.title, 'status': 'failed',
                    'reason': str(ex)
                })
        
        db.session.commit()
        
        return jsonify({
            'message': f"Extraction complete: {results['success']}/{results['total']} successful",
            'results': results
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Bulk extraction error: {e}")
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/assistant/index-stats', methods=['GET'])
def assistant_index_stats():
    """Get statistics about indexed documents for AI assistant"""
    try:
        total_docs = QMSDocument.query.count()
        with_files = QMSDocument.query.filter(QMSDocument.file_path.isnot(None)).count()
        indexed = QMSDocument.query.filter(QMSDocument.extracted_text.isnot(None)).count()
        pending = with_files - indexed
        
        # Category breakdown of indexed docs
        category_stats = {}
        cat_results = db.session.query(
            QMSDocument.category,
            db.func.count(QMSDocument.id),
            db.func.sum(db.case((QMSDocument.extracted_text.isnot(None), 1), else_=0))
        ).group_by(QMSDocument.category).all()
        
        for cat, total, idx in cat_results:
            category_stats[cat] = {'total': total, 'indexed': int(idx or 0)}
        
        # Total text size
        text_sizes = db.session.query(
            db.func.sum(db.func.length(QMSDocument.extracted_text))
        ).filter(QMSDocument.extracted_text.isnot(None)).scalar()
        
        return jsonify({
            'total_documents': total_docs,
            'with_files': with_files,
            'indexed': indexed,
            'pending': pending,
            'total_text_size': text_sizes or 0,
            'category_stats': category_stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@qms_bp.route('/assistant/document-content/<int:doc_id>', methods=['GET'])
def get_document_content(doc_id):
    """Get the extracted text content of a specific document"""
    try:
        doc = QMSDocument.query.get_or_404(doc_id)
        
        return jsonify({
            'id': doc.id,
            'title': doc.title,
            'doc_number': doc.doc_number,
            'category': doc.category,
            'has_text': bool(doc.extracted_text),
            'text_length': len(doc.extracted_text) if doc.extracted_text else 0,
            'content': doc.extracted_text or '',
            'extracted_at': doc.text_extracted_at.isoformat() if doc.text_extracted_at else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
