import React, { useState, useRef, useEffect } from 'react';
import '../styles/QMSAssistant.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// ═══════════════════════════════════════════════════════════
// QMS AI Document Assistant
// Smart search & guidance for all QMS documents
// ═══════════════════════════════════════════════════════════

// ── Knowledge Base ───────────────────────────────────────
const KNOWLEDGE_BASE = {
  // Process → Required Documents mapping
  processes: {
    'cell sorting': {
      docs: ['Cell Sorting WI', 'Cell Grading WI', 'Cell Visual Inspection WI', 'Solar Cell Spec', 'Cell Incoming Inspection', 'Incoming Inspection Form'],
      answer: 'Cell Sorting process ke liye ye documents chahiye: Cell Sorting WI (work instruction), Cell Grading WI, Visual Inspection criteria, Solar Cell Specification aur Incoming Inspection records.'
    },
    'soldering': {
      docs: ['Cell Soldering WI', 'Stringer Machine Setup WI', 'Ribbon Cutting WI', 'Flux Application WI', 'Soldering Temperature Profile WI', 'String Inspection WI', 'Busbar Soldering WI', 'Ribbon/Busbar Spec', 'Flux Spec', 'Stringer Output Check'],
      answer: 'Soldering/Stringing process ke liye: Cell Soldering WI, Stringer Setup WI, Soldering Temperature Profile, Ribbon/Busbar Specification, Flux Specification, aur String Inspection records maintain karne hote hain.'
    },
    'layup': {
      docs: ['Layup WI', 'Glass Cleaning WI', 'EVA/EPE Cutting WI', 'String Arrangement WI', 'Backsheet Cutting WI', 'Layup Inspection WI', 'EVA/EPE Spec', 'Glass Spec', 'Backsheet Spec', 'Layup Check'],
      answer: 'Layup process documents: Layup WI, Glass Cleaning WI, EVA/EPE Cutting WI, String Arrangement WI, Backsheet Cutting WI. Plus Glass Spec, EVA/EPE Spec, Backsheet Spec aur Layup Inspection check records.'
    },
    'lamination': {
      docs: ['Lamination WI', 'Laminator Setup WI', 'Temperature & Pressure Profile WI', 'Lamination Inspection WI', 'Crosslink Test WI', 'Peel Test WI', 'Lamination Spec', 'Pre-Lamination Check', 'Post-Lamination Check', 'Laminator Thermocouple Calibration'],
      answer: 'Lamination documents: Lamination WI, Laminator Setup WI, Temp & Pressure Profile, Crosslink/Peel Test procedures. Lamination Spec, Pre/Post Lamination inspection checks, aur Laminator Thermocouple Calibration records.'
    },
    'framing': {
      docs: ['Framing WI', 'Frame Cutting WI', 'Sealant Application WI', 'Corner Key Assembly WI', 'Frame Alignment WI', 'Frame Torque WI', 'Frame (Al Profile) Spec', 'Sealant/Silicone Spec', 'Corner Key Spec', 'Framing Torque Spec', 'Framing Check', 'Torque Wrench Calibration'],
      answer: 'Framing process ke liye: Framing WI, Sealant Application WI, Corner Key Assembly WI, Frame Torque WI. Specifications - Frame Al Profile Spec, Sealant Spec, Corner Key Spec. Plus Framing Check records aur Torque Wrench Calibration.'
    },
    'junction box': {
      docs: ['Junction Box Attach WI', 'J-Box Wiring WI', 'Diode Testing WI', 'Potting WI', 'J-Box Adhesive Application WI', 'Cable & Connector Attach WI', 'Junction Box Spec', 'Connector Spec', 'Cable Spec', 'Potting Material Spec', 'JBox Fitment Check', 'JBox Incoming Inspection'],
      answer: 'Junction Box process: JBox Attach WI, Wiring WI, Diode Testing WI, Potting WI, Cable/Connector Attach WI. Specs - JBox Spec, Connector Spec, Cable Spec, Potting Material Spec. JBox Fitment Check aur Incoming Inspection records.'
    },
    'testing': {
      docs: ['Flash Testing WI', 'EL Testing WI', 'Hi-Pot Testing WI', 'Visual Inspection WI', 'IV Curve Analysis WI', 'Flash Test Record', 'Hi-Pot Record', 'EL Inspection', 'Flash Simulator Calibration', 'EL Camera Calibration', 'Hi-Pot Tester Calibration'],
      answer: 'Testing & QC documents: Flash Testing WI, EL Testing WI, Hi-Pot Testing WI, Visual Inspection WI, IV Curve Analysis WI. Records - Flash Test, Hi-Pot, EL results. Calibration - Flash Simulator, EL Camera, Hi-Pot Tester calibration certificates.'
    },
    'packing': {
      docs: ['Packing WI', 'Label Printing WI', 'Palletizing WI', 'Strapping WI', 'Loading WI', 'PDI Inspection WI', 'Dispatch Documentation WI', 'Packaging Spec', 'Pallet Spec', 'Carton Spec', 'Label Placement Spec', 'Packing Inspection', 'Pre-Dispatch Inspection', 'Dispatch Challan'],
      answer: 'Packing & Dispatch documents: Packing WI, Palletizing WI, Label Printing WI, Loading WI, PDI Inspection WI. Specs - Packaging Spec, Pallet Spec, Carton Spec, Label Placement Spec. Records - Packing Inspection, PDI Report, Dispatch Challan.'
    },
    'dispatch': {
      docs: ['Dispatch SOP', 'Dispatch Documentation WI', 'Loading WI', 'PDI Inspection WI', 'Dispatch Challan', 'Pre-Dispatch Inspection', 'Customer Specific Inspection', 'Loading Inspection', 'Label Verification'],
      answer: 'Dispatch related: Dispatch SOP, Loading WI, PDI Inspection WI, Dispatch Documentation WI. Records - Pre-Dispatch Inspection, Customer Specific Inspection, Loading Inspection, Dispatch Challan, Label Verification.'
    },
    'incoming inspection': {
      docs: ['Incoming Inspection SOP', 'Incoming Inspection Form', 'Material Receiving Form', 'GRN Format', 'Incoming Rejection Form', 'COA Verification Form', 'Cell Incoming Inspection', 'Glass Incoming Inspection', 'EVA/EPE Incoming Inspection', 'Raw Material COA'],
      answer: 'Incoming Inspection documents: Incoming Inspection SOP, material-wise inspection forms (Cell, Glass, EVA, Backsheet, Frame, JBox, Ribbon), GRN Format, COA Verification Form, Incoming Rejection Form. Supplier ke COA/test certificates bhi chahiye.'
    },
    'maintenance': {
      docs: ['Preventive Maintenance SOP', 'Breakdown Maintenance SOP', 'PM Checklist', 'Breakdown Report', 'Machine History Card', 'Spare Request Form', 'Daily Machine Check WI', 'Laminator Maintenance WI', 'Stringer Maintenance WI'],
      answer: 'Maintenance documents: PM SOP, Breakdown SOP, PM Checklist (machine-wise), Breakdown Report, Machine History Card, Spare Parts Request. Machine-specific WIs for Laminator, Stringer, Framing Machine, Simulator maintenance.'
    },
    'calibration': {
      docs: ['Calibration SOP', 'Calibration Certificates', 'Calibration Schedule', 'MSA Study Reports', 'GR&R Reports', 'Flash Simulator Calibration', 'EL Camera Calibration', 'Multimeter Calibration', 'Hi-Pot Tester Calibration'],
      answer: 'Calibration documents: Calibration SOP, Master Calibration Schedule, instrument-wise Calibration Certificates, MSA/GR&R study reports. Production instruments (Flash Simulator, Laminator Thermocouple, Stringer Temp) aur QC instruments (Multimeter, Megger, Hi-Pot Tester, Vernier) sab ka record chahiye.'
    },
    'training': {
      docs: ['Training SOP', 'Annual Training Plan', 'Training Needs Identification', 'Training Record', 'Competency Matrix', 'Skill Matrix Template', 'Training Effectiveness Evaluation', 'Operator Skill Training', 'QMS Awareness Training'],
      answer: 'Training documents: Training SOP, Annual Training Plan, Training Need Identification, individual Training Records, Competency/Skill Matrix, Training Effectiveness Evaluation. Department-wise: QMS Awareness (Quality), Operator Skill (Production), Machine Operation, Safety Training records.'
    }
  },

  // Audit / Compliance topics
  compliance: {
    'iso 9001': {
      answer: 'ISO 9001:2015 ke liye ye mandatory documents chahiye:\n• Quality Manual (Clause 4.2.2)\n• Document Control Procedure (4.2.3)\n• Record Control Procedure (4.2.4)\n• Internal Audit Procedure (8.2.2)\n• Corrective Action Procedure (8.5.2)\n• Preventive Action Procedure (8.5.3)\n• Control of Nonconforming Product (8.3)\n• Management Review Minutes (5.6)\n• Training Records with Competency Evidence (6.2)\n• Calibration Records (7.6)\n• Customer Complaint Records\n• Supplier Evaluation Records',
      docs: ['Quality Manual', 'Document Control SOP', 'Record Control SOP', 'Internal Audit SOP', 'Corrective Action SOP', 'Preventive Action SOP', 'Nonconformance SOP', 'MRM Minutes', 'Training Record', 'Calibration Certificates']
    },
    'customer audit': {
      answer: 'Customer Audit preparation ke liye ensure karein:\n• Quality Manual updated hai\n• All SOPs latest revision mein hain\n• Calibration certificates valid hain\n• Training records up-to-date hain\n• CAPA log maintained hai\n• Internal audit findings closed hain\n• MRM minutes available hain\n• Process control plans available hain\n• Inspection records pichle 6 months ke\n• Supplier evaluation records\nPartner Audit tab mein self-assessment kar sakte hain.',
      docs: ['Quality Manual', 'All SOPs', 'Calibration Certificates', 'Training Records', 'CAPA Log', 'Internal Audit Reports', 'MRM Minutes', 'Control Plan', 'Inspection Records']
    },
    'bis audit': {
      answer: 'BIS Audit ke liye required documents:\n• BIS License copy\n• Type Test Reports (IEC 61215 / IEC 61730)\n• Production records last 3 months\n• Flash test records with serial numbers\n• Calibration records of all test equipment\n• Raw material test certificates\n• Process control documents\n• Final inspection records\n• Customer complaint register\n• NCR/CAPA records',
      docs: ['BIS Certificate', 'IEC 61215 Report', 'IEC 61730 Report', 'Flash Test Reports', 'Calibration Certificates', 'Raw Material COA', 'Control Plan', 'NCR Form']
    },
    'almm': {
      answer: 'ALMM (Approved List of Models and Manufacturers) ke liye:\n• ALMM Certificate\n• Type Test Reports from NABL accredited lab\n• Factory Inspection Report\n• Production capacity proof\n• Quality system certificates (ISO 9001)\n• BIS certificate\n• Test equipment calibration\n• Last 3 months production data',
      docs: ['ALMM Certificate', 'IEC 61215 Certificate', 'IEC 61730 Certificate', 'ISO 9001:2015 Certificate', 'BIS Certificate', 'Flash Test Reports']
    }
  },

  // Department queries
  departments: {
    'quality': 'Quality department ke documents: Document Control SOP, Internal Audit SOP, CAPA SOP, Inspection SOPs, IPQC/PDI/FTR Forms, NCR Forms, Audit Checklists, Calibration SOP, Sampling Plans.',
    'production': 'Production department: Production Control SOP, Shift Handover SOP, Line Clearance SOP, Machine Startup/Shutdown SOPs, Daily Report, Shift Report, Rework Form, Downtime Log, Output Register.',
    'engineering': 'Engineering department: Design Control SOP, New Product Development SOP, Engineering Change SOP, BOM Management SOP, Process Flow Chart, Control Plan, FMEA documents.',
    'procurement': 'Procurement/Purchase: Purchasing SOP, Supplier Evaluation SOP, Incoming Inspection SOP, Approved Supplier List, PO Management, Vendor Development Plan, Rate Contracts.',
    'hr': 'HR department: Training SOP, Competency Assessment SOP, Induction SOP, Training Records, Skill Matrix, Annual Training Plan, Attendance, Performance Review records.',
    'warehouse': 'Warehouse/Store: Material Storage SOP, FIFO SOP, Inventory Control SOP, Dispatch SOP, Stock Register, GRN, Material Issue Slip, Dispatch Challan.',
    'maintenance': 'Maintenance: Preventive Maintenance SOP, Breakdown SOP, PM Checklists (machine-wise), Breakdown Reports, Machine History Cards, Spare Parts register, TPM records.',
    'ehs': 'EHS department: Safety Policy, Safety Manual, HIRA Register, JSA, PPE Matrix, Accident/Incident Reports, Emergency Plan, Fire Drill Records, Waste Management Plan, Environmental Monitoring.'
  },

  // Quick answers
  quick: {
    'document number': 'Document numbering format: GSPL-[Category Code]-[Dept]-[Serial]-[Rev]\nExample: GSPL-SOP-QA-001-R01\nSystem automatically generates document numbers when you create a new document.',
    'revision': 'Document revision control: Jab bhi document update ho, revision number badhao (R00 → R01 → R02). Purani revision Obsolete mark karo. Revision history maintain karo with date, changes, approved by.',
    'approval': 'Document approval workflow:\n1. Draft → Author creates\n2. Under Review → Reviewer checks\n3. Approved → Authorizer approves\n4. Obsolete → When superseded\nHar stage mein date aur signature chahiye.',
    'master list': 'Document Master List mein ye info honi chahiye: Document No., Title, Category, Department, Current Revision, Effective Date, Controlled Copy holders, Location.',
    'controlled copy': 'Controlled Copy: Numbered copies jo specific locations/persons ko distribute hote hain. Stamp lagao "CONTROLLED COPY". Jab naya revision aaye, purani copy replace karo. Uncontrolled copies pe "UNCONTROLLED" stamp lagao.'
  }
};

// ── Greeting messages ────────────────────────────────────
const GREETINGS = [
  'Namaste! 🙏 Main aapka QMS Document Assistant hoon. Koi bhi document, process ya compliance related sawaal poochiye.',
  'Hello! Main QMS documents mein help kar sakta hoon. Process ka naam batayein ya poochiye kaunse documents chahiye.',
  'Welcome! Solar panel manufacturing QMS ke baare mein kuch bhi poochiye — documents, SOPs, forms, specifications, audit preparation, kuch bhi!'
];

// ── Smart Search Function ────────────────────────────────
const findBestAnswer = (query) => {
  const q = query.toLowerCase().trim();
  const results = { answer: '', docs: [], category: '', suggestions: [] };

  // Check processes
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE.processes)) {
    if (q.includes(key) || key.split(' ').some(w => w.length > 3 && q.includes(w))) {
      results.answer = val.answer;
      results.docs = val.docs;
      results.category = 'process';
      return results;
    }
  }

  // Check compliance
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE.compliance)) {
    if (q.includes(key) || key.split(' ').some(w => w.length > 3 && q.includes(w))) {
      results.answer = val.answer;
      results.docs = val.docs;
      results.category = 'compliance';
      return results;
    }
  }

  // Check departments
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE.departments)) {
    if (q.includes(key)) {
      results.answer = val;
      results.category = 'department';
      return results;
    }
  }

  // Check quick answers
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE.quick)) {
    if (q.includes(key) || key.split(' ').some(w => w.length > 3 && q.includes(w))) {
      results.answer = val;
      results.category = 'quick';
      return results;
    }
  }

  // Keyword matching fallback
  const keywords = {
    'sop': { answer: 'SOPs (Standard Operating Procedures) ke liye "Procedures (SOP)" category mein jayein. Department-wise SOPs available hain — Quality, Production, Engineering, Procurement, HR, Warehouse, Maintenance, Management, EHS.', category: 'general' },
    'form': { answer: 'Forms & Templates category mein department-wise forms milenge: Quality (IPQC, PDI, NCR, CAPA), Production (Daily Report, Shift Report, Rework), Incoming QC (GRN, Incoming Inspection), Warehouse (Stock Register, Dispatch Challan), HR (Training Records), Maintenance (PM Checklist).', category: 'general' },
    'specification': { answer: 'Specifications category mein: Raw Materials (Cell, EVA, Glass, Frame etc.), In-Process (Soldering, Lamination specs), Finished Goods (Module Datasheets), Packaging specs available hain.', category: 'general' },
    'certificate': { answer: 'Certificates & Licenses category mein: Quality Certs (ISO 9001, 14001, 45001), Product Certs (IEC 61215, IEC 61730, BIS, ALMM, TUV), Statutory Licenses (Factory, Pollution, Fire NOC) sab manage kar sakte hain.', category: 'general' },
    'ncr': { answer: 'NCR (Non-Conformance Report) ke liye "CAPA & NCR" category use karein. Customer Related, Internal, Supplier Related NCRs alag-alag track hote hain. Root Cause Analysis tools bhi available hain — 8D, Why-Why, Fishbone, Pareto.', category: 'general' },
    'capa': { answer: 'CAPA (Corrective & Preventive Action) manage karne ke liye "CAPA & NCR" category mein jayein. Corrective Actions, Preventive Actions, Containment Actions aur Effectiveness Verification sab track hota hai.', category: 'general' },
    'audit': { answer: 'Audit documents ke liye "Audit Reports" category use karein. Internal (Quality System, Process, Product, 5S, EHS Audits), External (ISO, BIS, ALMM), Customer Audits aur Supplier Audits sab manage hote hain. Partner Audit tab se self-assessment bhi kar sakte hain.', category: 'general' },
    'wi': { answer: 'Work Instructions (WI) category mein process-wise WIs hain: Cell Preparation (6), Stringing/Soldering (8), Layup (7), Lamination (6), Trimming (4), Framing (6), Junction Box (6), Testing & QC (9), Packing & Dispatch (7), Maintenance (6) = Total 65+ WIs.', category: 'general' },
    'safety': { answer: 'Safety/EHS documents ke liye "EHS Documents" category dekhen. Safety Policy, HIRA Register, JSA, PPE Matrix, Accident Reports, Emergency Plan, Fire Drill Records, Environmental Monitoring sab ek jagah manage hota hai.', category: 'general' },
    'supplier': { answer: 'Supplier related documents "Supplier Documents" category mein: Approved Supplier List, Supplier Evaluation, Supplier Certificates, Raw Material COA, MSDS/SDS, Purchase Orders, Quality Agreements sab manage karein.', category: 'general' },
    'mrm': { answer: 'Management Review Meeting (MRM) documents: MRM Minutes, Presentations, Action Items, KPI Reports (Quality, Production, Delivery, Customer Satisfaction, Supplier, EHS), Quality Objectives Review, Trend Analysis sab "Management Review" category mein.', category: 'general' },
    'kpi': { answer: 'KPI Reports "Management Review" category mein manage hote hain: Quality KPI, Production KPI, Delivery KPI, Customer Satisfaction KPI, Supplier KPI, EHS KPI. Monthly/quarterly track karein aur MRM mein present karein.', category: 'general' },
    'fmea': { answer: 'FMEA (Failure Mode & Effect Analysis) "Process Documents" category mein hai. Process FMEA aur Design FMEA dono maintain karein. Control Plan ke saath link karein. Risk Priority Number (RPN) calculate karke top risks address karein.', category: 'general' },
    'control plan': { answer: 'Control Plan "Process Documents" category mein hai. Process-wise control parameters, inspection frequency, measurement method, reaction plan include karein. FMEA ke saath aligned hona chahiye.', category: 'general' },
  };

  for (const [key, val] of Object.entries(keywords)) {
    if (q.includes(key)) {
      results.answer = val.answer;
      results.category = val.category;
      return results;
    }
  }

  // Generic help
  results.answer = 'Main in topics mein help kar sakta hoon:\n\n📋 **Processes** — cell sorting, soldering, layup, lamination, framing, junction box, testing, packing, dispatch\n\n📁 **Document Types** — SOP, WI, forms, specifications, certificates, NCR, CAPA\n\n🏢 **Departments** — quality, production, engineering, procurement, HR, warehouse, maintenance, EHS\n\n✅ **Compliance** — ISO 9001, customer audit, BIS audit, ALMM\n\n📝 **General** — document numbering, revision control, approval workflow\n\nKoi specific process ya topic batayein!';
  results.category = 'help';
  return results;
};

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════
const QMSAssistant = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)], time: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // Fetch uploaded documents
      fetchDocs();
    }
  }, [isOpen]);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/documents`);
      const data = await res.json();
      setUploadedDocs(data.documents || []);
    } catch { /* ignore */ }
  };

  // Search uploaded documents
  const searchUploadedDocs = (query) => {
    const q = query.toLowerCase();
    return uploadedDocs.filter(doc => {
      const searchStr = `${doc.title} ${doc.category} ${doc.sub_category} ${doc.department} ${doc.description} ${doc.doc_number}`.toLowerCase();
      return q.split(' ').some(word => word.length > 2 && searchStr.includes(word));
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    // Add user message
    const userMsg = { id: Date.now(), type: 'user', text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSearching(true);

    // Small delay for natural feel
    await new Promise(r => setTimeout(r, 400));

    // Get AI response
    const result = findBestAnswer(text);

    // Search uploaded documents
    const matchedDocs = searchUploadedDocs(text);

    let botResponse = result.answer;

    // Add matched uploaded docs info
    if (matchedDocs.length > 0) {
      botResponse += `\n\n📂 **Uploaded Documents Found (${matchedDocs.length}):**`;
      matchedDocs.slice(0, 5).forEach(doc => {
        botResponse += `\n• **${doc.title}** (${doc.category}) — ${doc.status} — Rev ${doc.revision || '00'}`;
      });
      if (matchedDocs.length > 5) {
        botResponse += `\n_...aur ${matchedDocs.length - 5} more documents_`;
      }
    }

    // Add suggested docs to create if not yet uploaded
    if (result.docs && result.docs.length > 0) {
      const existing = uploadedDocs.map(d => d.title?.toLowerCase());
      const missing = result.docs.filter(d => !existing.some(e => e?.includes(d.toLowerCase().substring(0, 10))));
      if (missing.length > 0) {
        botResponse += `\n\n⚠️ **Missing Documents (not yet uploaded):**`;
        missing.slice(0, 8).forEach(d => {
          botResponse += `\n• ${d}`;
        });
        botResponse += `\n\n_"Documents" tab mein jaake ye documents create/upload karein._`;
      }
    }

    const botMsg = { id: Date.now() + 1, type: 'bot', text: botResponse, time: new Date(), docs: matchedDocs.slice(0, 5) };
    setMessages(prev => [...prev, botMsg]);
    setIsSearching(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: '📋 Packing & Dispatch', query: 'packing and dispatch' },
    { label: '🔍 Customer Audit Prep', query: 'customer audit' },
    { label: '🏭 All SOPs List', query: 'sop' },
    { label: '📊 Testing Documents', query: 'testing' },
    { label: '📝 Required Forms', query: 'form' },
    { label: '🔧 Calibration', query: 'calibration' },
    { label: '⚠️ NCR/CAPA', query: 'ncr capa' },
    { label: '🏢 ISO 9001', query: 'iso 9001' },
  ];

  const handleQuickAction = (query) => {
    setInput(query);
    setTimeout(() => {
      const text = query;
      const userMsg = { id: Date.now(), type: 'user', text, time: new Date() };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsSearching(true);

      setTimeout(async () => {
        const result = findBestAnswer(text);
        const matchedDocs = searchUploadedDocs(text);
        let botResponse = result.answer;
        if (matchedDocs.length > 0) {
          botResponse += `\n\n📂 **Uploaded Documents Found (${matchedDocs.length}):**`;
          matchedDocs.slice(0, 5).forEach(doc => {
            botResponse += `\n• **${doc.title}** (${doc.category}) — ${doc.status}`;
          });
        }
        if (result.docs && result.docs.length > 0) {
          const existing = uploadedDocs.map(d => d.title?.toLowerCase());
          const missing = result.docs.filter(d => !existing.some(e => e?.includes(d.toLowerCase().substring(0, 10))));
          if (missing.length > 0) {
            botResponse += `\n\n⚠️ **Missing Documents:**`;
            missing.slice(0, 8).forEach(d => { botResponse += `\n• ${d}`; });
            botResponse += `\n\n_Documents tab se create/upload karein._`;
          }
        }
        const botMsg = { id: Date.now() + 1, type: 'bot', text: botResponse, time: new Date() };
        setMessages(prev => [...prev, botMsg]);
        setIsSearching(false);
      }, 400);
    }, 50);
  };

  // Format message text with markdown-lite
  const formatText = (text) => {
    if (!text) return '';
    return text
      .split('\n')
      .map((line, i) => {
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        line = line.replace(/_(.*?)_/g, '<em>$1</em>');
        // Bullet
        if (line.startsWith('• ')) {
          return `<div class="qa-bullet" key="${i}">${line}</div>`;
        }
        return `<div key="${i}">${line || '<br/>'}</div>`;
      })
      .join('');
  };

  if (!isOpen) return null;

  return (
    <div className="qms-assistant-overlay">
      <div className="qms-assistant">
        {/* Header */}
        <div className="qa-header">
          <div className="qa-header-left">
            <div className="qa-avatar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a5 5 0 0 0-5 5 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 5 5 0 0 0-5-5z"/></svg>
            </div>
            <div>
              <h3>QMS Document Assistant</h3>
              <span className="qa-status">
                <span className="qa-dot" /> Online • {uploadedDocs.length} documents loaded
              </span>
            </div>
          </div>
          <button className="qa-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="qa-quick-actions">
          {quickActions.map((a, i) => (
            <button key={i} className="qa-quick-btn" onClick={() => handleQuickAction(a.query)}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <div className="qa-chat">
          {messages.map(msg => (
            <div key={msg.id} className={`qa-msg ${msg.type}`}>
              {msg.type === 'bot' && (
                <div className="qa-msg-avatar">🤖</div>
              )}
              <div className="qa-msg-bubble">
                <div className="qa-msg-text" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
                <span className="qa-msg-time">
                  {msg.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {isSearching && (
            <div className="qa-msg bot">
              <div className="qa-msg-avatar">🤖</div>
              <div className="qa-msg-bubble qa-typing">
                <span className="qa-typing-dot" />
                <span className="qa-typing-dot" />
                <span className="qa-typing-dot" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="qa-input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Poochiye koi bhi document ya process ke baare mein..."
            rows="1"
          />
          <button className="qa-send" onClick={handleSend} disabled={!input.trim() || isSearching}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QMSAssistant;
