import React, { useState, useEffect, useCallback } from 'react';
import QMSAuditTool from './QMSAuditTool';
import QMSAssistant from './QMSAssistant';
import '../styles/QMSDashboard.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// ═══════════════════════════════════════════════
// SVG Icons
// ═══════════════════════════════════════════════
const Icons = {
  folder: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  file: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  list: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  award: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  history: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
  filter: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
};

// ═══════════════════════════════════════════════
// Default categories for solar panel QMS
// ═══════════════════════════════════════════════
const DEFAULT_CATEGORIES = {
  'Quality Manual': {
    iso_clause: '4.2.2',
    sub_categories: ['Quality Policy', 'Quality Objectives', 'Organization Chart', 'Process Interaction', 'Scope of QMS', 'Exclusions', 'Management Commitment', 'Customer Focus Policy']
  },
  'Procedures (SOP)': {
    iso_clause: '4.2.1',
    departments: {
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
    sub_categories: ['Document Control', 'Record Control', 'Internal Audit', 'Corrective Action', 'Preventive Action', 'Management Review', 'Training', 'Purchasing', 'Customer Communication', 'Design Control', 'Production Control', 'Inspection & Testing', 'Calibration', 'Nonconformance', 'CAPA']
  },
  'Work Instructions': {
    iso_clause: '7.5.1',
    departments: {
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
    sub_categories: ['Cell Sorting', 'Cell Soldering', 'Layup', 'Lamination', 'Framing', 'Junction Box', 'Flash Testing', 'EL Testing', 'Visual Inspection', 'Packing', 'Hi-Pot Testing', 'Label Printing']
  },
  'Forms & Templates': {
    iso_clause: '4.2.4',
    departments: {
      'Quality': ['IPQC Forms', 'PDI Forms', 'FTR Forms', 'Final Inspection Form', 'NCR Form', 'CAPA Form', 'Audit Checklist', 'Hold Tag', 'Rejection Tag', 'COC Template', 'Deviation Report Form', 'Sampling Inspection Form'],
      'Production': ['Production Daily Report', 'Shift Report Form', 'Line Clearance Form', 'Rework Form', 'Downtime Log', 'Output Register', 'Process Deviation Form', 'Batch Record Form'],
      'Incoming QC': ['Incoming Inspection Form', 'Material Receiving Form', 'GRN Format', 'Incoming Rejection Form', 'Supplier Rating Form', 'COA Verification Form'],
      'Warehouse': ['Stock Register', 'Dispatch Challan', 'Material Issue Slip', 'GRN Format', 'Inventory Count Sheet', 'FIFO Register'],
      'HR': ['Training Record', 'Training Need Form', 'Skill Matrix Template', 'Attendance Register', 'Induction Checklist'],
      'Maintenance': ['PM Checklist', 'Breakdown Report', 'Spare Request Form', 'Equipment Log', 'Machine History Card'],
      'Management': ['MRM Minutes Template', 'Action Items Tracker', 'KPI Template', 'Risk Register Template']
    },
    sub_categories: ['IPQC Forms', 'PDI Forms', 'FTR Forms', 'Incoming Inspection', 'Process Control', 'Final Inspection', 'NCR Form', 'CAPA Form', 'Training Record', 'Audit Checklist', 'MRM Minutes']
  },
  'Specifications': {
    iso_clause: '7.1',
    departments: {
      'Raw Materials': ['Solar Cell Spec', 'EVA/EPE Spec', 'Backsheet Spec', 'Glass Spec', 'Frame (Al Profile) Spec', 'Junction Box Spec', 'Ribbon/Busbar Spec', 'Sealant/Silicone Spec', 'Flux Spec', 'Label Spec', 'Connector Spec', 'Cable Spec', 'Corner Key Spec', 'Potting Material Spec'],
      'In-Process': ['Soldering Spec', 'Lamination Spec', 'Framing Torque Spec', 'EL Criteria Spec', 'Flash Test Limits', 'Hi-Pot Limits', 'Visual Inspection Criteria'],
      'Finished Goods': ['Module Datasheet (Mono/Poly)', 'Module Datasheet (Bifacial)', 'Module Datasheet (TopCon)', 'Module Datasheet (HJT)', 'Power Tolerance Spec', 'Dimension Spec'],
      'Packaging': ['Packaging Spec', 'Pallet Spec', 'Carton Spec', 'Strapping Spec', 'Label Placement Spec', 'Corner Protector Spec']
    },
    sub_categories: ['Raw Material Specs', 'In-Process Specs', 'Finished Goods Specs', 'Packaging Specs', 'BOM Specifications', 'Module Specifications']
  },
  'Test Reports': {
    iso_clause: '8.2.4',
    departments: {
      'Type Testing': ['IEC 61215 Report', 'IEC 61730 Report', 'IEC 62804 (PID) Report', 'IEC 62716 (Ammonia) Report', 'IEC 61701 (Salt Mist) Report', 'UL 61730 Report'],
      'Reliability Testing': ['Thermal Cycling Report', 'Humidity Freeze Report', 'Damp Heat Report', 'UV Exposure Report', 'Mechanical Load Report', 'Hail Impact Report', 'Hot Spot Report', 'Bypass Diode Report'],
      'Performance Testing': ['Flash Test Reports', 'EL Test Reports', 'IV Curve Reports', 'Temperature Coefficient Report', 'NOCT Report', 'Module Efficiency Report'],
      'Safety Testing': ['Hi-Pot Test Reports', 'Insulation Resistance Reports', 'Wet Leakage Reports', 'Ground Continuity Reports', 'Fire Classification Report'],
      'Certification': ['BIS Certificate', 'ALMM Certificate', 'TUV Certificate', 'UL Certificate', 'MCS Certificate', 'CE Certificate']
    },
    sub_categories: ['IEC Certificates', 'BIS Certificates', 'Type Test Reports', 'Reliability Test', 'Salt Mist Test', 'Ammonia Test', 'PID Test', 'Mechanical Load Test', 'Hail Test', 'Hot Spot Test']
  },
  'Inspection Records': {
    iso_clause: '8.2.4',
    departments: {
      'Incoming QC': ['Cell Incoming Inspection', 'Glass Incoming Inspection', 'EVA/EPE Incoming Inspection', 'Backsheet Incoming Inspection', 'Frame Incoming Inspection', 'JBox Incoming Inspection', 'Ribbon Incoming Inspection', 'Chemical/Flux Incoming Inspection', 'Packaging Material Inspection'],
      'In-Process QC (IPQC)': ['Stringer Output Check', 'Layup Check', 'Pre-Lamination Check', 'Post-Lamination Check', 'Trimming Check', 'Framing Check', 'JBox Fitment Check', 'Cleaning Check', 'EL Inspection', 'Visual Inspection'],
      'Final QC': ['Flash Test Record', 'Hi-Pot Record', 'Final Visual Record', 'Label Verification', 'Dimension Check Record', 'Packing Inspection'],
      'PDI': ['Pre-Dispatch Inspection', 'Customer Specific Inspection', 'Loading Inspection'],
      'Third Party': ['Customer Inspection Record', 'Third Party Lab Report', 'Bureau Veritas Report', 'TUV Inspection Report']
    },
    sub_categories: ['Incoming Inspection', 'In-Process Inspection', 'Final Inspection', 'Customer Inspection', 'Third Party Inspection']
  },
  'Calibration Records': {
    iso_clause: '7.6',
    departments: {
      'Production Instruments': ['Flash Simulator Calibration', 'EL Camera Calibration', 'Laminator Thermocouple Calibration', 'Stringer Temperature Calibration', 'Torque Wrench Calibration', 'Weighing Scale Calibration'],
      'QC Instruments': ['Multimeter Calibration', 'Megger Calibration', 'Hi-Pot Tester Calibration', 'IR Thermometer Calibration', 'Vernier Caliper Calibration', 'Measuring Tape Calibration', 'Peel Tester Calibration', 'Surface Roughness Tester'],
      'Lab Instruments': ['UV-Vis Spectrophotometer', 'Cross-link Tester', 'Gel Content Tester', 'Shore Hardness Tester', 'Thickness Gauge'],
      'Environmental': ['Temperature Logger Calibration', 'Humidity Logger Calibration', 'Lux Meter Calibration'],
      'MSA': ['MSA Study Reports', 'GR&R Reports', 'Bias Study', 'Linearity Study', 'Stability Study']
    },
    sub_categories: ['Calibration Certificates', 'Calibration Schedule', 'MSA Reports']
  },
  'Audit Reports': {
    iso_clause: '8.2.2',
    departments: {
      'Internal': ['Quality System Audit', 'Process Audit', 'Product Audit', 'Layered Process Audit', '5S Audit', 'EHS Audit'],
      'External': ['ISO 9001 Surveillance Audit', 'ISO 14001 Audit', 'ISO 45001 Audit', 'BIS Audit', 'ALMM Audit'],
      'Customer': ['Customer Quality Audit', 'Customer Process Audit', 'Partner Assessment Audit', 'Second Party Audit'],
      'Supplier': ['Supplier Quality Audit', 'Supplier Process Audit', 'Supplier Development Audit', 'New Supplier Audit']
    },
    sub_categories: ['Internal Audit', 'External Audit', 'Supplier Audit', 'Customer Audit', 'Surveillance Audit']
  },
  'CAPA & NCR': {
    iso_clause: '8.5',
    departments: {
      'Customer Related': ['Customer Complaints', 'Warranty Claims', 'Field Failures', 'Customer Returns', 'Customer Feedback'],
      'Internal': ['Internal NCR', 'Process NCR', 'Product NCR', 'Rework NCR', 'Scrap NCR'],
      'Supplier Related': ['Supplier NCR', 'Incoming Rejection', 'Supplier Corrective Action'],
      'Analysis': ['Root Cause Analysis (8D)', 'Why-Why Analysis', 'Fishbone Analysis', 'Pareto Analysis', 'Trend Analysis'],
      'Actions': ['Corrective Actions', 'Preventive Actions', 'Containment Actions', 'Effectiveness Verification']
    },
    sub_categories: ['Customer Complaints', 'Internal NCR', 'Supplier NCR', 'Corrective Actions', 'Preventive Actions', 'Root Cause Analysis']
  },
  'Training Records': {
    iso_clause: '6.2',
    departments: {
      'Quality': ['QMS Awareness Training', 'Internal Auditor Training', 'Statistical Techniques', 'Inspection Techniques', 'Calibration Training'],
      'Production': ['Operator Skill Training', 'Machine Operation Training', 'Soldering Training', 'Lamination Training', 'Safety Training', 'New Joinee OJT'],
      'Engineering': ['New Product Training', 'Design Tools Training', 'Process Engineering Training'],
      'HR/Admin': ['Induction Training', 'Competency Matrix', 'Training Needs Identification', 'Training Effectiveness Evaluation', 'Annual Training Plan'],
      'Maintenance': ['Equipment Handling Training', 'TPM Training', 'Electrical Safety Training'],
      'EHS': ['Fire Safety Training', 'First Aid Training', 'Chemical Handling Training', 'Emergency Drill Record']
    },
    sub_categories: ['Training Matrix', 'Competency Records', 'Training Plans', 'Training Certificates', 'Skill Assessment']
  },
  'Supplier Documents': {
    iso_clause: '7.4',
    departments: {
      'Supplier Management': ['Approved Supplier List', 'Supplier Evaluation Report', 'Supplier Score Card', 'Supplier Audit Report', 'Supplier Development Plan'],
      'Supplier Certificates': ['ISO Certificate (Supplier)', 'Test Reports (Supplier)', 'IEC Certificate (Supplier)', 'BIS Certificate (Supplier)', 'RoHS/REACH Certificate'],
      'Material Documents': ['Raw Material COA', 'Material Test Certificate', 'MSDS/SDS', 'Batch Certificate', 'Material Datasheet'],
      'Commercial': ['Purchase Orders', 'Rate Contract', 'Supplier Agreement', 'Quality Agreement', 'NDA']
    },
    sub_categories: ['Approved Supplier List', 'Supplier Evaluation', 'Supplier Certificates', 'Raw Material COA', 'MSDS/SDS']
  },
  'Management Review': {
    iso_clause: '5.6',
    departments: {
      'MRM': ['MRM Minutes', 'MRM Presentations', 'MRM Action Items', 'MRM Attendance'],
      'KPIs': ['Quality KPI Report', 'Production KPI Report', 'Delivery KPI Report', 'Customer Satisfaction KPI', 'Supplier KPI Report', 'EHS KPI Report'],
      'Objectives': ['Quality Objectives Review', 'Department Objectives', 'Annual Targets', 'Objective Achievement Report'],
      'Analysis': ['Trend Analysis Report', 'Cost of Quality Report', 'Continual Improvement Report', 'Risk & Opportunity Review']
    },
    sub_categories: ['MRM Minutes', 'MRM Presentations', 'KPI Reports', 'Quality Objectives Review', 'Action Items']
  },
  'Process Documents': {
    iso_clause: '7.5',
    departments: {
      'Process Planning': ['Process Flow Chart', 'Control Plan', 'FMEA (Process)', 'FMEA (Design)', 'Process Validation Report'],
      'Production Layout': ['Plant Layout', 'Line Layout', 'Material Flow Diagram', 'Operator Station Layout'],
      'Process Control': ['SPC Charts', 'Process Capability Study (Cpk)', 'Run Charts', 'Control Charts', 'Process Parameter Sheet'],
      'Improvement': ['Kaizen Reports', 'Poka-Yoke Register', 'Value Stream Map', 'OEE Reports', '5S Implementation']
    },
    sub_categories: ['Process Flow Chart', 'Control Plan', 'FMEA', 'Process Validation', 'Production Layout']
  },
  'Certificates & Licenses': {
    iso_clause: '',
    departments: {
      'Quality Certificates': ['ISO 9001:2015 Certificate', 'ISO 14001:2015 Certificate', 'ISO 45001:2018 Certificate', 'IATF 16949 Certificate'],
      'Product Certificates': ['IEC 61215 Certificate', 'IEC 61730 Certificate', 'BIS Certificate', 'ALMM Certificate', 'TUV Certificate', 'UL Certificate', 'MCS Certificate', 'CE Marking'],
      'Statutory Licenses': ['Factory License', 'Pollution Certificate (CTO/CTE)', 'Fire NOC', 'Electrical Inspector License', 'Boiler License', 'Trade License', 'FSSAI (Canteen)', 'Contract Labour License'],
      'Company': ['Company Registration', 'GST Certificate', 'PAN Card', 'MSME/Udyam Certificate', 'Import-Export Code (IEC)', 'Insurance Policies']
    },
    sub_categories: ['ISO 9001 Certificate', 'ISO 14001 Certificate', 'ISO 45001 Certificate', 'IEC 61215', 'IEC 61730', 'BIS Certificate', 'ALMM Certificate', 'Factory License', 'Pollution Certificate', 'Fire NOC']
  },
  'EHS Documents': {
    iso_clause: '6.4',
    departments: {
      'Safety': ['Safety Policy', 'Safety Manual', 'HIRA Register', 'JSA (Job Safety Analysis)', 'PPE Matrix', 'Safety Induction Record', 'Accident/Incident Report', 'Near Miss Report'],
      'Environment': ['EMS Manual', 'Aspect-Impact Register', 'Waste Management Plan', 'Pollution Control Records', 'Environmental Monitoring Report'],
      'Health': ['Health Checkup Records', 'First Aid Register', 'Occupational Health Report'],
      'Emergency': ['Emergency Preparedness Plan', 'Evacuation Plan', 'Fire Drill Record', 'Mock Drill Record', 'Emergency Contact List']
    },
    sub_categories: ['Safety Policy', 'HIRA Register', 'PPE Matrix', 'Accident Report', 'Waste Management', 'Emergency Plan', 'Mock Drill Record']
  }
};

const STATUS_OPTIONS = ['Draft', 'Under Review', 'Approved', 'Obsolete'];
const DEPARTMENT_OPTIONS = ['Quality', 'Production', 'Engineering', 'Procurement', 'Incoming QC', 'IPQC', 'Final QC', 'PDI', 'HR', 'Admin', 'Maintenance', 'Warehouse', 'Sales', 'Management', 'EHS', 'R&D', 'Lab'];

const FILE_TYPE_ICONS = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📽️', pptx: '📽️', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
  txt: '📃', csv: '📊'
};

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}


// ═══════════════════════════════════════════════
// Main QMS Dashboard Component
// ═══════════════════════════════════════════════
const QMSDashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [stats, setStats] = useState({ total: 0, approved: 0, draft: 0, under_review: 0, obsolete: 0 });
  const [categoryCounts, setCategoryCounts] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View state
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, documents, create, edit, detail
  const [viewMode, setViewMode] = useState('list'); // list, grid
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create, edit
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  
  // Version Control state
  const [versionHistory, setVersionHistory] = useState([]);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinData, setCheckinData] = useState({ commit_message: '', change_type: 'Update', user: '', new_version: '' });
  const [checkinFile, setCheckinFile] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    doc_number: '', title: '', category: 'Quality Manual', sub_category: '', description: '',
    version: '1.0', status: 'Draft', department: 'Quality',
    prepared_by: '', reviewed_by: '', approved_by: '',
    effective_date: '', review_date: '', expiry_date: '',
    tags: '', iso_clause: '', is_controlled: true, access_level: 'All'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  // ─── Data Fetching ──────────────────────────
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`${API_BASE}/api/qms/documents?${params}`);
      const data = await res.json();
      setDocuments(data.documents || []);
      setStats(data.stats || { total: 0, approved: 0, draft: 0, under_review: 0, obsolete: 0 });
      setCategoryCounts(data.category_counts || {});
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  }, [selectedCategory, selectedStatus, searchQuery]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/dashboard-stats`);
      const data = await res.json();
      setStats(data.stats || {});
      setCategoryCounts(data.category_counts || {});
      setRecentActivity(data.recent_activity || []);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    // Always use DEFAULT_CATEGORIES (has department-wise structure)
    // No backend override needed
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDocuments(), fetchDashboardStats(), fetchCategories()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDocuments, fetchDashboardStats, fetchCategories]);

  // ─── Handlers ───────────────────────────────
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const resetForm = () => {
    setFormData({
      doc_number: '', title: '', category: 'Quality Manual', sub_category: '', description: '',
      version: '1.0', status: 'Draft', department: 'Quality',
      prepared_by: '', reviewed_by: '', approved_by: '',
      effective_date: '', review_date: '', expiry_date: '',
      tags: '', iso_clause: '', is_controlled: true, access_level: 'All'
    });
    setSelectedFile(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  const openEditModal = (doc) => {
    setFormData({
      doc_number: doc.doc_number || '', title: doc.title || '', category: doc.category || 'Quality Manual',
      sub_category: doc.sub_category || '', description: doc.description || '',
      version: doc.version || '1.0', status: doc.status || 'Draft',
      department: doc.department || '', prepared_by: doc.prepared_by || '',
      reviewed_by: doc.reviewed_by || '', approved_by: doc.approved_by || '',
      effective_date: doc.effective_date || '', review_date: doc.review_date || '',
      expiry_date: doc.expiry_date || '', tags: doc.tags || '',
      iso_clause: doc.iso_clause || '', is_controlled: doc.is_controlled !== false,
      access_level: doc.access_level || 'All'
    });
    setSelectedDoc(doc);
    setSelectedFile(null);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.keys(formData).forEach(key => {
        fd.append(key, formData[key]);
      });
      if (selectedFile) fd.append('file', selectedFile);

      const url = modalMode === 'create'
        ? `${API_BASE}/api/qms/documents`
        : `${API_BASE}/api/qms/documents/${selectedDoc.id}`;
      
      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        body: fd
      });
      const data = await res.json();
      
      if (res.ok) {
        showMessage(data.message || 'Document saved successfully');
        setShowModal(false);
        resetForm();
        fetchDocuments();
        fetchDashboardStats();
      } else {
        showMessage(data.error || 'Error saving document', 'error');
      }
    } catch (err) {
      showMessage('Error: ' + err.message, 'error');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Document deleted');
        fetchDocuments();
        fetchDashboardStats();
        if (activeView === 'detail') setActiveView('documents');
      }
    } catch (err) {
      showMessage('Error deleting: ' + err.message, 'error');
    }
  };

  const handleDownload = async (doc) => {
    try {
      window.open(`${API_BASE}/api/qms/documents/${doc.id}/download`, '_blank');
    } catch (err) {
      showMessage('Download error: ' + err.message, 'error');
    }
  };

  const handleStatusChange = async (doc, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${doc.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, performed_by: 'System' })
      });
      if (res.ok) {
        showMessage(`Status updated to ${newStatus}`);
        fetchDocuments();
        fetchDashboardStats();
      }
    } catch (err) {
      showMessage('Error: ' + err.message, 'error');
    }
  };

  const viewAuditLog = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${docId}/audit-log`);
      const data = await res.json();
      setAuditLogs(data.logs || []);
      setShowAuditModal(true);
    } catch (err) {
      showMessage('Error loading audit log', 'error');
    }
  };

  // ─── Version Control Functions ──────────────────────────
  const handleCheckout = async (doc) => {
    const user = prompt('Your name (for checkout):');
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${doc.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Document checked out. Downloading for editing...`);
        // Auto-download the file
        if (doc.file_name) {
          window.open(`${API_BASE}/api/qms/documents/${doc.id}/download`, '_blank');
        }
        fetchDocuments();
        if (selectedDoc?.id === doc.id) setSelectedDoc({ ...doc, is_locked: true, checked_out_by: user });
      } else {
        showMessage(data.error || 'Checkout failed', 'error');
      }
    } catch (err) {
      showMessage('Error: ' + err.message, 'error');
    }
  };

  const handleCancelCheckout = async (doc) => {
    if (!window.confirm('Cancel checkout? No changes will be saved.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${doc.id}/cancel-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: doc.checked_out_by || 'System' })
      });
      if (res.ok) {
        showMessage('Checkout cancelled');
        fetchDocuments();
        if (selectedDoc?.id === doc.id) setSelectedDoc({ ...doc, is_locked: false, checked_out_by: null });
      }
    } catch (err) {
      showMessage('Error: ' + err.message, 'error');
    }
  };

  const openCheckinModal = (doc) => {
    setSelectedDoc(doc);
    setCheckinData({ commit_message: '', change_type: 'Update', user: doc.checked_out_by || '', new_version: '' });
    setCheckinFile(null);
    setShowCheckinModal(true);
  };

  const handleCheckin = async (e) => {
    e.preventDefault();
    if (!checkinData.commit_message) { showMessage('Commit message is required', 'error'); return; }
    try {
      const fd = new FormData();
      fd.append('commit_message', checkinData.commit_message);
      fd.append('change_type', checkinData.change_type);
      fd.append('user', checkinData.user);
      if (checkinData.new_version) fd.append('new_version', checkinData.new_version);
      if (checkinFile) fd.append('file', checkinFile);

      const res = await fetch(`${API_BASE}/api/qms/documents/${selectedDoc.id}/checkin`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(data.message || 'Document checked in successfully');
        setShowCheckinModal(false);
        fetchDocuments();
        fetchDashboardStats();
        if (selectedDoc) setSelectedDoc(data.document);
      } else {
        showMessage(data.error || 'Check-in failed', 'error');
      }
    } catch (err) {
      showMessage('Error: ' + err.message, 'error');
    }
  };

  const viewVersionHistory = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${docId}/versions`);
      const data = await res.json();
      setVersionHistory(data.versions || []);
      setShowVersionModal(true);
    } catch (err) {
      showMessage('Error loading version history', 'error');
    }
  };

  const handleRevert = async (doc, versionId, versionNum) => {
    if (!window.confirm(`Revert document to version ${versionNum}? This will create a new version.`)) return;
    const user = prompt('Your name (for revert):');
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents/${doc.id}/revert/${versionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(data.message || 'Document reverted successfully');
        fetchDocuments();
        fetchDashboardStats();
        setShowVersionModal(false);
        if (selectedDoc) setSelectedDoc(data.document);
      } else {
        showMessage(data.error || 'Revert failed', 'error');
      }
    } catch (err) {
      showMessage('Error: ' + err.message, 'error');
    }
  };

  const downloadVersion = (docId, versionId) => {
    window.open(`${API_BASE}/api/qms/documents/${docId}/versions/${versionId}/download`, '_blank');
  };

  const viewDocDetail = (doc) => {
    setSelectedDoc(doc);
    setActiveView('detail');
  };

  // ─── Status Badge ──────────────────────────
  const StatusBadge = ({ status }) => {
    const cls = status ? status.toLowerCase().replace(/\s/g, '-') : 'draft';
    return <span className={`qms-status-badge status-${cls}`}>{status || 'Draft'}</span>;
  };

  // ═══════════════════════════════════════════════
  // Dashboard View
  // ═══════════════════════════════════════════════
  const renderDashboard = () => (
    <div className="qms-dashboard-view">
      {/* Stats Cards */}
      <div className="qms-stats-grid">
        <div className="qms-stat-card stat-total" onClick={() => { setSelectedCategory('all'); setSelectedStatus('all'); setActiveView('documents'); }}>
          <div className="stat-icon">{Icons.file}</div>
          <div className="stat-info">
            <span className="stat-number">{stats.total || 0}</span>
            <span className="stat-label">Total Documents</span>
          </div>
        </div>
        <div className="qms-stat-card stat-approved" onClick={() => { setSelectedStatus('Approved'); setSelectedCategory('all'); setActiveView('documents'); }}>
          <div className="stat-icon">{Icons.check}</div>
          <div className="stat-info">
            <span className="stat-number">{stats.approved || 0}</span>
            <span className="stat-label">Approved</span>
          </div>
        </div>
        <div className="qms-stat-card stat-review" onClick={() => { setSelectedStatus('Under Review'); setSelectedCategory('all'); setActiveView('documents'); }}>
          <div className="stat-icon">{Icons.clock}</div>
          <div className="stat-info">
            <span className="stat-number">{stats.under_review || 0}</span>
            <span className="stat-label">Under Review</span>
          </div>
        </div>
        <div className="qms-stat-card stat-draft" onClick={() => { setSelectedStatus('Draft'); setSelectedCategory('all'); setActiveView('documents'); }}>
          <div className="stat-icon">{Icons.edit}</div>
          <div className="stat-info">
            <span className="stat-number">{stats.draft || 0}</span>
            <span className="stat-label">Draft</span>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="qms-section">
        <div className="qms-section-header">
          <h2>{Icons.folder} Document Categories</h2>
          <span className="qms-section-subtitle">Click any category to view documents</span>
        </div>
        <div className="qms-category-grid">
          {Object.keys(categories).map(cat => {
            const catData = categories[cat] || {};
            const deptNames = catData.departments ? Object.keys(catData.departments) : [];
            const totalItems = catData.departments
              ? Object.values(catData.departments).reduce((s, arr) => s + arr.length, 0)
              : (catData.sub_categories || []).length;
            return (
            <div key={cat} className="qms-category-card" onClick={() => { setSelectedCategory(cat); setSelectedStatus('all'); setActiveView('documents'); }}>
              <div className="category-header">
                <span className="category-icon">{Icons.folder}</span>
                <span className="category-count">{categoryCounts[cat] || 0}</span>
              </div>
              <h3 className="category-name">{cat}</h3>
              <p className="category-clause">{catData.iso_clause ? `ISO ${catData.iso_clause}` : ''}</p>
              {deptNames.length > 0 ? (
                <div className="category-subs">
                  {deptNames.slice(0, 3).map(d => (
                    <span key={d} className="sub-tag dept-tag">{d}</span>
                  ))}
                  {deptNames.length > 3 && 
                    <span className="sub-tag more">+{deptNames.length - 3} more</span>
                  }
                  <span className="sub-tag total-tag">{totalItems} items</span>
                </div>
              ) : (
                <div className="category-subs">
                  {(catData.sub_categories || []).slice(0, 3).map(s => (
                    <span key={s} className="sub-tag">{s}</span>
                  ))}
                  {(catData.sub_categories || []).length > 3 && 
                    <span className="sub-tag more">+{catData.sub_categories.length - 3} more</span>
                  }
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="qms-section">
        <div className="qms-section-header">
          <h2>{Icons.history} Recent Activity</h2>
        </div>
        {recentActivity.length > 0 ? (
          <div className="qms-activity-list">
            {recentActivity.map(log => (
              <div key={log.id} className="activity-item">
                <div className="activity-dot" />
                <div className="activity-content">
                  <span className="activity-action">{log.action}</span>
                  <span className="activity-detail">{log.details}</span>
                  <span className="activity-time">{formatDate(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="qms-empty-state">
            <span className="empty-icon">{Icons.history}</span>
            <p>No recent activity yet. Start by creating your first document.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  // Documents List View
  // ═══════════════════════════════════════════════
  const renderDocuments = () => (
    <div className="qms-documents-view">
      {/* Toolbar */}
      <div className="qms-toolbar">
        <div className="toolbar-left">
          <div className="qms-search-box">
            {Icons.search}
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="qms-select">
            <option value="all">All Categories</option>
            {Object.keys(categories).map(cat => (
              <option key={cat} value={cat}>{cat} ({categoryCounts[cat] || 0})</option>
            ))}
          </select>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="qms-select">
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <div className="view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>{Icons.list}</button>
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>{Icons.grid}</button>
          </div>
          <button className="qms-btn-primary" onClick={openCreateModal}>
            {Icons.plus} New Document
          </button>
        </div>
      </div>

      {/* Documents */}
      {documents.length === 0 ? (
        <div className="qms-empty-state">
          <span className="empty-icon">{Icons.file}</span>
          <h3>No Documents Found</h3>
          <p>{searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' 
            ? 'Try adjusting your filters or search query.' 
            : 'Start by creating your first QMS document.'}
          </p>
          <button className="qms-btn-primary" onClick={openCreateModal}>{Icons.plus} Create Document</button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="qms-table-wrap">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Doc Number</th>
                <th>Title</th>
                <th>Category</th>
                <th>Version</th>
                <th>Status</th>
                <th>Department</th>
                <th>Effective Date</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id}>
                  <td className="doc-number" onClick={() => viewDocDetail(doc)}>{doc.doc_number}</td>
                  <td className="doc-title" onClick={() => viewDocDetail(doc)}>{doc.title}</td>
                  <td><span className="cat-label">{doc.category}</span></td>
                  <td className="doc-version">v{doc.version}</td>
                  <td><StatusBadge status={doc.status} /></td>
                  <td>{doc.department || '—'}</td>
                  <td>{doc.effective_date || '—'}</td>
                  <td>
                    {doc.file_name ? (
                      <span className="file-indicator" title={doc.file_name}>
                        {FILE_TYPE_ICONS[doc.file_type] || '📎'} {formatFileSize(doc.file_size)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <div className="qms-actions">
                      <button className="act-btn" title="View" onClick={() => viewDocDetail(doc)}>{Icons.eye}</button>
                      <button className="act-btn" title="Edit" onClick={() => openEditModal(doc)}>{Icons.edit}</button>
                      {doc.file_name && <button className="act-btn" title="Download" onClick={() => handleDownload(doc)}>{Icons.download}</button>}
                      <button className="act-btn act-delete" title="Delete" onClick={() => handleDelete(doc.id)}>{Icons.trash}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="qms-docs-grid">
          {documents.map(doc => (
            <div key={doc.id} className="qms-doc-card">
              <div className="doc-card-header">
                <span className="doc-card-number">{doc.doc_number}</span>
                <StatusBadge status={doc.status} />
              </div>
              <h4 className="doc-card-title" onClick={() => viewDocDetail(doc)}>{doc.title}</h4>
              <p className="doc-card-category">{doc.category}{doc.sub_category ? ` / ${doc.sub_category}` : ''}</p>
              <div className="doc-card-meta">
                <span>v{doc.version}</span>
                <span>{doc.department || '—'}</span>
              </div>
              {doc.file_name && (
                <div className="doc-card-file">
                  {FILE_TYPE_ICONS[doc.file_type] || '📎'} {doc.file_name}
                </div>
              )}
              <div className="doc-card-actions">
                <button className="act-btn" onClick={() => viewDocDetail(doc)}>{Icons.eye}</button>
                <button className="act-btn" onClick={() => openEditModal(doc)}>{Icons.edit}</button>
                {doc.file_name && <button className="act-btn" onClick={() => handleDownload(doc)}>{Icons.download}</button>}
                <button className="act-btn act-delete" onClick={() => handleDelete(doc.id)}>{Icons.trash}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════
  // Document Detail View
  // ═══════════════════════════════════════════════
  const renderDocDetail = () => {
    if (!selectedDoc) return null;
    const doc = selectedDoc;
    return (
      <div className="qms-detail-view">
        <div className="detail-header">
          <button className="qms-btn-ghost" onClick={() => setActiveView('documents')}>← Back to Documents</button>
          <div className="detail-actions-top">
            <button className="qms-btn-secondary" onClick={() => openEditModal(doc)}>{Icons.edit} Edit</button>
            {doc.file_name && <button className="qms-btn-secondary" onClick={() => handleDownload(doc)}>{Icons.download} Download</button>}
            {/* Version Control Buttons */}
            {doc.file_name && !doc.is_locked && (
              <button className="qms-btn-secondary" onClick={() => handleCheckout(doc)} style={{background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7'}}>
                🔓 Check Out (Edit)
              </button>
            )}
            {doc.is_locked && doc.checked_out_by && (
              <>
                <button className="qms-btn-primary" onClick={() => openCheckinModal(doc)} style={{background: '#1565c0'}}>
                  📥 Check In (Commit)
                </button>
                <button className="qms-btn-secondary" onClick={() => handleCancelCheckout(doc)} style={{background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80'}}>
                  ✕ Cancel Checkout
                </button>
              </>
            )}
            <button className="qms-btn-secondary" onClick={() => viewVersionHistory(doc.id)} style={{background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9'}}>
              📋 Version History
            </button>
            <button className="qms-btn-secondary" onClick={() => viewAuditLog(doc.id)}>{Icons.history} Audit Log</button>
          </div>
        </div>
        
        {/* Checkout Warning Banner */}
        {doc.is_locked && (
          <div style={{background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{fontSize: '20px'}}>🔒</span>
            <div>
              <strong>Document Checked Out</strong>
              <span style={{marginLeft: '8px', color: '#666'}}>by {doc.checked_out_by} • {doc.checked_out_at ? new Date(doc.checked_out_at).toLocaleString() : ''}</span>
            </div>
          </div>
        )}
        
        <div className="detail-main">
          <div className="detail-top">
            <div className="detail-title-block">
              <span className="detail-doc-number">{doc.doc_number}</span>
              <h2>{doc.title}</h2>
              <div className="detail-badges">
                <StatusBadge status={doc.status} />
                <span className="version-badge">Version {doc.version}</span>
                {doc.is_controlled && <span className="controlled-badge">{Icons.shield} Controlled</span>}
                {doc.is_locked && <span className="version-badge" style={{background: '#fff3e0', color: '#e65100'}}>🔒 Checked Out</span>}
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-section">
              <h3>Document Information</h3>
              <div className="detail-fields">
                <div className="detail-field"><label>Category</label><span>{doc.category}</span></div>
                <div className="detail-field"><label>Sub-Category</label><span>{doc.sub_category || '—'}</span></div>
                <div className="detail-field"><label>Department</label><span>{doc.department || '—'}</span></div>
                <div className="detail-field"><label>ISO Clause</label><span>{doc.iso_clause || '—'}</span></div>
                <div className="detail-field"><label>Access Level</label><span>{doc.access_level || 'All'}</span></div>
                <div className="detail-field"><label>Tags</label><span>{doc.tags || '—'}</span></div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Responsibility</h3>
              <div className="detail-fields">
                <div className="detail-field"><label>Prepared By</label><span>{doc.prepared_by || '—'}</span></div>
                <div className="detail-field"><label>Reviewed By</label><span>{doc.reviewed_by || '—'}</span></div>
                <div className="detail-field"><label>Approved By</label><span>{doc.approved_by || '—'}</span></div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Dates</h3>
              <div className="detail-fields">
                <div className="detail-field"><label>Effective Date</label><span>{doc.effective_date || '—'}</span></div>
                <div className="detail-field"><label>Review Date</label><span>{doc.review_date || '—'}</span></div>
                <div className="detail-field"><label>Expiry Date</label><span>{doc.expiry_date || '—'}</span></div>
                <div className="detail-field"><label>Created</label><span>{formatDate(doc.created_at)}</span></div>
                <div className="detail-field"><label>Last Updated</label><span>{formatDate(doc.updated_at)}</span></div>
              </div>
            </div>

            {doc.file_name && (
              <div className="detail-section">
                <h3>Attached File</h3>
                <div className="detail-file-card">
                  <span className="file-icon-large">{FILE_TYPE_ICONS[doc.file_type] || '📎'}</span>
                  <div className="file-details">
                    <span className="file-name-detail">{doc.file_name}</span>
                    <span className="file-size-detail">{formatFileSize(doc.file_size)}</span>
                  </div>
                  <button className="qms-btn-primary" onClick={() => handleDownload(doc)}>{Icons.download} Download</button>
                </div>
              </div>
            )}

            {doc.description && (
              <div className="detail-section full-width">
                <h3>Description</h3>
                <p className="detail-description">{doc.description}</p>
              </div>
            )}
          </div>

          {/* Status Workflow */}
          <div className="detail-section full-width">
            <h3>Document Workflow</h3>
            <div className="workflow-steps">
              {STATUS_OPTIONS.map((s, i) => (
                <div key={s} className={`workflow-step ${doc.status === s ? 'active' : ''} ${STATUS_OPTIONS.indexOf(doc.status) > i ? 'completed' : ''}`}>
                  <div className="step-circle" onClick={() => handleStatusChange(doc, s)}>
                    {STATUS_OPTIONS.indexOf(doc.status) > i ? Icons.check : i + 1}
                  </div>
                  <span className="step-label">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  // Create/Edit Modal
  // ═══════════════════════════════════════════════
  const renderModal = () => (
    <div className="qms-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="qms-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{modalMode === 'create' ? 'Create New Document' : 'Edit Document'}</h2>
          <button className="modal-close" onClick={() => setShowModal(false)}>{Icons.close}</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Document Number *</label>
              <input type="text" value={formData.doc_number} onChange={e => setFormData({...formData, doc_number: e.target.value})} required placeholder="e.g., GSPL/QMS/SOP/001" />
            </div>
            <div className="form-group">
              <label>Document Title *</label>
              <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required placeholder="e.g., SOP for Cell Soldering Process" />
            </div>
            
            <div className="form-group">
              <label>Category *</label>
              <select value={formData.category} onChange={e => { 
                setFormData({...formData, category: e.target.value, sub_category: '', iso_clause: categories[e.target.value]?.iso_clause || ''});
              }}>
                {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>Sub-Category / Document Type</label>
              <select value={formData.sub_category} onChange={e => setFormData({...formData, sub_category: e.target.value})}>
                <option value="">Select Sub-Category</option>
                {categories[formData.category]?.departments ? (
                  Object.entries(categories[formData.category].departments).map(([dept, items]) => (
                    <optgroup key={dept} label={`📁 ${dept}`}>
                      {items.map(item => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))
                ) : (
                  (categories[formData.category]?.sub_categories || []).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))
                )}
              </select>
            </div>
            
            <div className="form-group">
              <label>Department</label>
              <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="">Select Department</option>
                {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>Version</label>
              <input type="text" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} placeholder="1.0" />
            </div>
            
            <div className="form-group">
              <label>Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label>ISO Clause</label>
              <input type="text" value={formData.iso_clause} onChange={e => setFormData({...formData, iso_clause: e.target.value})} placeholder="e.g., 7.5.1" />
            </div>
            
            <div className="form-group">
              <label>Prepared By</label>
              <input type="text" value={formData.prepared_by} onChange={e => setFormData({...formData, prepared_by: e.target.value})} placeholder="Name" />
            </div>
            
            <div className="form-group">
              <label>Reviewed By</label>
              <input type="text" value={formData.reviewed_by} onChange={e => setFormData({...formData, reviewed_by: e.target.value})} placeholder="Name" />
            </div>
            
            <div className="form-group">
              <label>Approved By</label>
              <input type="text" value={formData.approved_by} onChange={e => setFormData({...formData, approved_by: e.target.value})} placeholder="Name" />
            </div>
            
            <div className="form-group">
              <label>Access Level</label>
              <select value={formData.access_level} onChange={e => setFormData({...formData, access_level: e.target.value})}>
                <option value="All">All</option>
                <option value="Management">Management</option>
                <option value="QA">QA</option>
                <option value="Production">Production</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Effective Date</label>
              <input type="date" value={formData.effective_date} onChange={e => setFormData({...formData, effective_date: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label>Review Date</label>
              <input type="date" value={formData.review_date} onChange={e => setFormData({...formData, review_date: e.target.value})} />
            </div>
            
            <div className="form-group">
              <label>Expiry Date</label>
              <input type="date" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} />
            </div>

            <div className="form-group">
              <label>Tags</label>
              <input type="text" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="Comma-separated tags" />
            </div>
            
            <div className="form-group full-width">
              <label>Description</label>
              <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Brief description of the document..." />
            </div>
            
            <div className="form-group full-width">
              <label>Attach File</label>
              <div className="file-upload-zone">
                <input type="file" id="qms-file-input" onChange={e => setSelectedFile(e.target.files[0])} 
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv" />
                <label htmlFor="qms-file-input" className="file-upload-label">
                  {Icons.upload}
                  <span>{selectedFile ? selectedFile.name : 'Click to upload or drag & drop'}</span>
                  <small>PDF, DOC, XLS, PPT, Images (Max 500MB)</small>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={formData.is_controlled} onChange={e => setFormData({...formData, is_controlled: e.target.checked})} />
                Controlled Document
              </label>
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="qms-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="qms-btn-primary">
              {modalMode === 'create' ? 'Create Document' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  // Check-In Modal (Git Commit-style)
  // ═══════════════════════════════════════════════
  const renderCheckinModal = () => (
    <div className="qms-modal-overlay" onClick={() => setShowCheckinModal(false)}>
      <div className="qms-modal qms-modal-sm" onClick={e => e.stopPropagation()} style={{maxWidth: '550px'}}>
        <div className="modal-header" style={{background: 'linear-gradient(135deg, #1565c0, #1976d2)'}}>
          <h2>📥 Check In Document</h2>
          <button className="modal-close" onClick={() => setShowCheckinModal(false)}>{Icons.close}</button>
        </div>
        <form onSubmit={handleCheckin} style={{padding: '20px'}}>
          <div style={{marginBottom: '16px'}}>
            <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333'}}>Commit Message *</label>
            <textarea
              rows="3"
              value={checkinData.commit_message}
              onChange={e => setCheckinData({...checkinData, commit_message: e.target.value})}
              required
              placeholder="Describe what you changed... (e.g., Updated inspection criteria in Section 3.2)"
              style={{width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box'}}
            />
          </div>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px'}}>
            <div>
              <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333'}}>Change Type</label>
              <select
                value={checkinData.change_type}
                onChange={e => setCheckinData({...checkinData, change_type: e.target.value})}
                style={{width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px'}}
              >
                <option value="Minor Edit">Minor Edit (v1.0 → v1.1)</option>
                <option value="Update">Update (v1.0 → v1.1)</option>
                <option value="Major Revision">Major Revision (v1.x → v2.0)</option>
              </select>
            </div>
            <div>
              <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333'}}>Your Name *</label>
              <input
                type="text"
                value={checkinData.user}
                onChange={e => setCheckinData({...checkinData, user: e.target.value})}
                required
                placeholder="Name"
                style={{width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px'}}
              />
            </div>
          </div>

          <div style={{marginBottom: '16px'}}>
            <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333'}}>New Version (optional)</label>
            <input
              type="text"
              value={checkinData.new_version}
              onChange={e => setCheckinData({...checkinData, new_version: e.target.value})}
              placeholder="Auto-calculated if empty (e.g., 1.2)"
              style={{width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px'}}
            />
          </div>

          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontWeight: 600, marginBottom: '6px', color: '#333'}}>Upload Updated File *</label>
            <div style={{border: '2px dashed #1565c0', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#e3f2fd'}}
              onClick={() => document.getElementById('checkin-file-input').click()}>
              <input id="checkin-file-input" type="file" style={{display: 'none'}}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                onChange={e => setCheckinFile(e.target.files[0])} />
              {checkinFile ? (
                <div>📄 <strong>{checkinFile.name}</strong> <span style={{color: '#666'}}>({(checkinFile.size / 1024).toFixed(1)} KB)</span></div>
              ) : (
                <div>
                  <span style={{fontSize: '24px'}}>📤</span>
                  <p style={{margin: '8px 0 0', color: '#1565c0'}}>Click to select the updated document</p>
                </div>
              )}
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
            <button type="button" className="qms-btn-secondary" onClick={() => setShowCheckinModal(false)}>Cancel</button>
            <button type="submit" className="qms-btn-primary" style={{background: '#1565c0'}}>
              📥 Commit & Check In
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  // Version History Modal (Git Log-style)
  // ═══════════════════════════════════════════════
  const renderVersionModal = () => (
    <div className="qms-modal-overlay" onClick={() => setShowVersionModal(false)}>
      <div className="qms-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '700px'}}>
        <div className="modal-header" style={{background: 'linear-gradient(135deg, #1565c0, #42a5f5)'}}>
          <h2>📋 Version History</h2>
          <button className="modal-close" onClick={() => setShowVersionModal(false)}>{Icons.close}</button>
        </div>
        <div style={{padding: '20px', maxHeight: '500px', overflowY: 'auto'}}>
          {versionHistory.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
              <span style={{fontSize: '40px'}}>📄</span>
              <p>No version history yet. Check in a new version to start tracking changes.</p>
            </div>
          ) : (
            <div style={{position: 'relative'}}>
              {/* Git-like timeline line */}
              <div style={{position: 'absolute', left: '18px', top: '0', bottom: '0', width: '3px', background: '#e0e0e0', zIndex: 0}} />
              
              {versionHistory.map((ver, idx) => (
                <div key={ver.id} style={{display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative', zIndex: 1}}>
                  {/* Commit dot */}
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                    background: ver.change_type === 'Revert' ? '#ff9800' : ver.change_type === 'Major Revision' ? '#d32f2f' : ver.change_type === 'Snapshot' ? '#9e9e9e' : '#1565c0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 700
                  }}>
                    {ver.change_type === 'Revert' ? '↩' : ver.change_type === 'Snapshot' ? '📸' : `v${ver.version_number?.split('.')[0] || ''}`}
                  </div>
                  
                  {/* Commit info */}
                  <div style={{
                    flex: 1, background: idx === 0 ? '#e3f2fd' : '#f5f5f5', borderRadius: '10px', padding: '14px 16px',
                    border: idx === 0 ? '2px solid #90caf9' : '1px solid #e0e0e0'
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                      <strong style={{color: '#1565c0', fontSize: '15px'}}>v{ver.version_number}</strong>
                      <span style={{
                        background: ver.change_type === 'Revert' ? '#fff3e0' : ver.change_type === 'Major Revision' ? '#fce4ec' : ver.change_type === 'Snapshot' ? '#f5f5f5' : '#e8f5e9',
                        color: ver.change_type === 'Revert' ? '#e65100' : ver.change_type === 'Major Revision' ? '#c62828' : ver.change_type === 'Snapshot' ? '#757575' : '#2e7d32',
                        padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
                      }}>{ver.change_type}</span>
                    </div>
                    <p style={{margin: '0 0 8px', color: '#333', fontSize: '14px'}}>{ver.commit_message}</p>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#777'}}>
                      <span>👤 {ver.changed_by} • 📅 {ver.created_at ? new Date(ver.created_at).toLocaleString() : ''}</span>
                      <div style={{display: 'flex', gap: '8px'}}>
                        {ver.file_path && (
                          <button type="button" onClick={() => downloadVersion(selectedDoc?.id, ver.id)}
                            style={{background: 'none', border: '1px solid #90caf9', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: '#1565c0', fontSize: '12px'}}>
                            ↓ Download
                          </button>
                        )}
                        {ver.change_type !== 'Snapshot' && idx > 0 && selectedDoc && (
                          <button type="button" onClick={() => handleRevert(selectedDoc, ver.id, ver.version_number)}
                            style={{background: 'none', border: '1px solid #ffcc80', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', color: '#e65100', fontSize: '12px'}}>
                            ↩ Revert
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════
  // Audit Log Modal
  // ═══════════════════════════════════════════════
  const renderAuditModal = () => (
    <div className="qms-modal-overlay" onClick={() => setShowAuditModal(false)}>
      <div className="qms-modal qms-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{Icons.history} Audit Trail</h2>
          <button className="modal-close" onClick={() => setShowAuditModal(false)}>{Icons.close}</button>
        </div>
        <div className="audit-log-content">
          {auditLogs.length === 0 ? (
            <p className="empty-audit">No audit records found.</p>
          ) : (
            <div className="audit-timeline">
              {auditLogs.map(log => (
                <div key={log.id} className="audit-entry">
                  <div className="audit-dot" />
                  <div className="audit-info">
                    <span className="audit-action">{log.action}</span>
                    <span className="audit-detail">{log.details}</span>
                    <div className="audit-meta">
                      <span>{log.performed_by}</span>
                      <span>{formatDate(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );


  // ═══════════════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════════════
  if (loading) {
    return (
      <div className="qms-container">
        <div className="qms-loading">
          <div className="loading-spinner" />
          <p>Loading QMS Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qms-container">
      {/* Header */}
      <div className="qms-header">
        <div className="qms-header-left">
          <div className="qms-logo">{Icons.shield}</div>
          <div>
            <h1>Quality Management System</h1>
            <p className="qms-subtitle">Solar Panel Manufacturing | ISO 9001:2015 Document Control</p>
          </div>
        </div>
        <div className="qms-header-right">
          <button className="qms-btn-primary" onClick={openCreateModal}>
            {Icons.plus} New Document
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="qms-nav-tabs">
        <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => { setActiveView('dashboard'); setSelectedCategory('all'); setSelectedStatus('all'); }}>
          {Icons.bar} Dashboard
        </button>
        <button className={activeView === 'documents' || activeView === 'detail' ? 'active' : ''} onClick={() => setActiveView('documents')}>
          {Icons.file} Documents
        </button>
        <button className={activeView === 'audit' ? 'active' : ''} onClick={() => setActiveView('audit')}>
          {Icons.award} Partner Audit
        </button>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`qms-message ${message.type}`}>
          {message.type === 'error' ? Icons.alert : Icons.check}
          {message.text}
        </div>
      )}

      {/* Content */}
      <div className="qms-content">
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'documents' && renderDocuments()}
        {activeView === 'detail' && renderDocDetail()}
        {activeView === 'audit' && <QMSAuditTool />}
      </div>

      {/* Modals */}
      {showModal && renderModal()}
      {showAuditModal && renderAuditModal()}
      {showCheckinModal && renderCheckinModal()}
      {showVersionModal && renderVersionModal()}

      {/* AI Document Assistant */}
      <QMSAssistant isOpen={showAssistant} onClose={() => setShowAssistant(false)} />

      {/* Floating Chat Button */}
      <button
        className={`qms-fab-chat ${showAssistant ? 'active' : ''}`}
        onClick={() => setShowAssistant(!showAssistant)}
        title="QMS Document Assistant"
      >
        <span className="fab-icon">
          {showAssistant ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a5 5 0 0 0-5 5 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 5 5 0 0 0-5-5z"/></svg>
          )}
        </span>
        {!showAssistant && <span className="qms-fab-badge">AI</span>}
      </button>
    </div>
  );
};

export default QMSDashboard;
