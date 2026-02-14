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


class QMSPartnerAudit(db.Model):
    __tablename__ = 'qms_partner_audits'
    
    id = db.Column(db.Integer, primary_key=True)
    audit_name = db.Column(db.String(300), nullable=False)
    audit_type = db.Column(db.String(50), default='Initial Assessment')  # Initial, Surveillance, Re-audit
    partner_name = db.Column(db.String(200))
    partner_location = db.Column(db.String(300))
    auditor_name = db.Column(db.String(100))
    auditor_designation = db.Column(db.String(100))
    audit_date = db.Column(db.String(20))
    scores_json = db.Column(db.Text)  # JSON: {section_id: {question_id: {score, observation, action, responsible, target_date, action_status}}}
    total_score = db.Column(db.Float, default=0)
    max_score = db.Column(db.Float, default=0)
    percentage = db.Column(db.Float, default=0)
    overall_rating = db.Column(db.String(30))  # Critical, Needs Improvement, Acceptable, Good, Excellent
    summary = db.Column(db.Text)
    status = db.Column(db.String(30), default='In Progress')  # In Progress, Completed, Closed
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
    status = db.Column(db.String(30), default='Open')  # Open, In Progress, Completed, Verified
    evidence = db.Column(db.Text)
    remarks = db.Column(db.Text)
    priority = db.Column(db.String(20), default='Medium')  # Critical, High, Medium, Low
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
