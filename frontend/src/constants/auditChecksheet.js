// ═══════════════════════════════════════════════════════════════
// Partner Audit Checksheet - Complete Assessment Data
// Based on Industry Standard Initial Assessment Checksheet
// Customized for Solar Panel Manufacturing (Gautam Solar Standard)
// ═══════════════════════════════════════════════════════════════

const AUDIT_CHECKSHEET = [
  {
    id: '1',
    title: 'Quality System',
    questions: [
      {
        id: '1.1',
        text: 'Is there a process defined for incorporating latest change in drawings in the manufacturing processes? Evidences exists for controlling of change management?',
        criteria: [
          'No such system exists',
          'Change management takes place but records are not evident',
          'System / Procedure in place - review & validation of design - change managements',
          'System / Procedure in place - review & validation of design - change managements - records of change management are evident - MOM of reviews/ basis of change are maintained - proof of reviews by CFT team & actions - Availability, maintenance and usage of reference standards',
          'System / Procedure in place - review & validation of design - change managements - records evident - MOM of reviews maintained - proof of reviews by CFT team & actions - Latest drawings / specifications / process instructions in use and legible - Linking and cascading of changes at different processes (drawing, SOPs, WIs, Inspection plan)'
        ],
        whatToLook: 'Verification & Validation Records, Actions taken, Record of Changes implemented and revision control, Proof of reviews by CFT in form of MOMs, MOMs of reviews with customers if required, Customer Approvals'
      },
      {
        id: '1.2',
        text: 'Has the Organization structure available? Are clear responsibilities defined for functional heads and other key positions?',
        criteria: [
          'Organisation Chart not available',
          'Organisation Chart defined but not structured - Responsibilities defined',
          'Organisation Chart available including - Responsibilities - accountabilities',
          'Organisation Chart available including - Responsibilities - accountabilities - All departments covered - Second lead command in the department',
          'Organisation Chart available including - Responsibilities - accountabilities - Effective results & actions defined - Minimal outsourcing - delegation of authorities defined and followed'
        ],
        whatToLook: 'Organization chart, Job Description (critical positions), verification of position vs defined job description (3 positions), Alternate responsibilities (3 alternates), Authorities covering stop of production / stop shipments / Communication of customer issues, Delegation of Authorities (DOA)'
      },
      {
        id: '1.3',
        text: 'Has the Top Management freezed the Key parameters (objectives) for Quality functions to enhance customer satisfaction? Are they reviewed periodically?',
        criteria: [
          'QMS (performance) not clearly defined',
          'QMS Performance partially defined - Quality performance Indicators reviewed for in-process concerns only - Actions not analysed till effectiveness',
          'QMS Performance clearly defined - Quality performance Indicators reviewed for customer, in-process, HR, maintenance, EHS, supply chain at regular interval - Actions not analysed - Review frequency once per year',
          'QMS Performance clearly defined - KPIs reviewed at regular interval - COPQ, Internal Quality rejection%, customer concerns, EHS risk assessment - Target setting basis partially defined - CFT defined, reviewed once per quarter - Actions analysed till effectiveness',
          'QMS Performance clearly defined - KPIs reviewed at regular interval - COPQ, rejection%, customer concerns, EHS, regulatory compliances - Target setting clearly defined with measurable - CFT reviewed once per month - Actions analysed till effectiveness - Horizontal deployment - Special projects assigned with timeline'
        ],
        whatToLook: 'Key Process Indicators available, KPI/KRA/Objectives realistic (Management, Engineering, Dispatch, Customer complaint handling, quality, COPQ, Production), Performance reviewed by top Management, Actions decided and implemented, Effectiveness of actions verified, Review frequency, CFT approach, Realistic measurable time bound targets'
      },
      {
        id: '1.4',
        text: 'Is Quality Manual available covering all the clauses? Does Partner have master list of documents?',
        criteria: [
          'No such system exists',
          'Basic level quality manual designed - WIs not defined - SOPs not defined',
          'Quality manual defined - For each function - SOPs and WIs available',
          'Quality manual defined - For each function - SOPs and WIs available - Implementation adhered in all processes - process verification & control records evident - defined review frequency with CFT team',
          'Quality manual defined - For each function - SOPs and WIs available - Implementation adhered - process verification & control records evident - fixed frequency review (once in a year) - Continuous improvement activities evident - Audit check sheets defined (Process, internal, dock audit)'
        ],
        whatToLook: 'Procedure for D&D covering PDCA approach, PPAP Files available for all parts, Records of D&D like Quality Plans, Verification & Validation Activities, Time Plans, Pilot Lot etc.'
      },
      {
        id: '1.5',
        text: 'Is Internal Audit conducted in the company? Is internal certified Auditor available? Is Internal Audit report and NC closure available?',
        criteria: [
          'Internal audit system is not defined',
          'Internal audit system defined and audit plan defined - Audit plan followed partially',
          'Internal audit system defined and audit plan defined - Audit plan followed - Internal quality auditors list with qualifications - Internal audit report released - Actions partially evident',
          'Internal audit procedure defined and audit plan defined - Audit plan followed - Auditors list with qualifications records - Audit report released - Actions fully evident - Audit check sheet defined for each process',
          'Internal audit procedure defined and audit plan released - Audit plan followed - Auditors qualified with periodic re-training/calibration - Audit report released - Actions fully evident - Actions defined and effectiveness monitored - Audit frequency increased based on score - Continuous improvement based on data analytics'
        ],
        whatToLook: 'Procedure of Internal audit (scope, criteria, qualified auditors, NC closing criteria, timeline), Qualification criteria of auditors (verify 2 auditors), Audit conducted (cross question for correctness with 2 auditors/auditee), Corrective actions against NC (verify root causes and corrective actions min 02), Effectiveness of corrective actions (verify at least 02 cases)'
      }
    ]
  },
  {
    id: '2',
    title: 'Sub Partner Management',
    questions: [
      {
        id: '2.1',
        text: 'Has procedure defined for approving new sub partner through audit methodology? Has new development process followed and controlled?',
        criteria: [
          'No system exists',
          'Sourcing process available but found inadequate - Approved supplier list available but not revised',
          'Sourcing process available and defined - Approved supplier list available but not revised - Evaluation criteria partially defined - Delegation of authority not defined - Supplier performance criteria not robust',
          'Sourcing process available as defined in procedure - Approved supplier list with evaluation criteria - Delegation of authority - Supplier performance monitoring - New product development, PPAP RFT - QCD target - Exceptions clearly defined',
          'Sourcing process as per procedure - Approved supplier list with evaluation criteria - Delegation of authority - Supplier performance monitoring - PPAP RFT - QCD target - Exceptions defined - Techno commercial evaluation - Black listing procedure - Worst supplier tracking - Contingency planning - Code of conduct - Benchmarking'
        ],
        whatToLook: 'Procedure for Sourcing (Selection, Evaluation, Performance Monitoring, Development), Approved Partner List with details, Alternate partners determined, Partner Registration and approval mechanism, Quality/Delivery Performance tracking, Pick 2 recent registered partners and check conformance'
      },
      {
        id: '2.2',
        text: 'Are adequate Receiving inspection records maintained?',
        criteria: [
          'Inspection Records not available',
          'Inspection Records includes - verification / observations',
          'Inspection Records includes - verification / observations',
          'Inspection Records includes - verification / observations - clear judgment on observations - Properly filed',
          'Inspection Records includes - verification / observations - clear judgment on observations - Properly filed - easily retrievable - Well organized'
        ],
        whatToLook: 'Identified area for non inspected material, Clear identification of OK and Not OK Material, Incoming Inspection reports with samples as per sampling Plan, All dimensional and appearance checks as per inspection standard, All materials subjected to inspection or not'
      },
      {
        id: '2.3',
        text: 'In case of Sub Partner rejections are defects analyzed & preventive action initiated?',
        criteria: [
          'No such system exists',
          'Defined as part of general Quality Systems which is partially followed',
          'Defined as part of general Quality Management system - Followed for all customer complaints',
          'SPOC to manage customer complaints defined - Detailed process with steps - CFT formed with representation from relevant departments - Progress regularly reviewed - Use of 7QC tools for CAPA and root causes - Effectiveness tracked for at least 3 months - Client notified for CAPA study',
          'SPOC defined - Detailed process with steps - CFT formed - Progress reviewed - 7QC tools for CAPA - Effectiveness tracked 3 months - Evidence of horizontal deployment - Evidence of PFMEA updates based on quality issues - Client notified for CAPA study'
        ],
        whatToLook: 'Record of CFT team meeting for customer complaints, SPOC appointment and relevant documents, CAPA document/record with CFT team presence and usage of 7 QC tools'
      }
    ]
  },
  {
    id: '3',
    title: 'House Keeping & Material Handling',
    questions: [
      {
        id: '3.1',
        text: 'Are adequate part handling methods like trays, bins, trolleys, pallets used to avoid damage during processing? Are aisle/walkways and workstations clearly marked?',
        criteria: [
          'No such system exists',
          'Material handling not defined. It is random',
          'Partially defined - Trolleys/bins used at few places - Damage bins, spillage',
          'Process defined for material handling - usage of trolleys/bins/pallets in all sections - minimum to and fro movement of material',
          'Process defined for material handling - usage of trolleys/bins/pallets in all sections - minimum to and fro movement - maintenance of trolleys/bins/pallets - UIN for each - Plant Layout-U Shape with dedicated bays - Overhead crane available'
        ],
        whatToLook: 'Process document (WI, procedure) for material handling, Bins available at locations, usage and cleaning frequency defined'
      },
      {
        id: '3.2',
        text: 'Are shelf life for items identified (wherever applicable) & are disposed immediately on expiry date?',
        criteria: [
          'No Shelf life defined and no awareness, No identification & control',
          'Awareness about shelf life but - shelf life not defined - Controlled conditions from Mfr. not adhered',
          'Shelf life requirement partially followed - shelf life defined per manufacturer - Controlled conditions but not calibrated',
          'Strictly followed manufacturer recommendations - shelf life - controlled conditions - NG material quarantined & recorded - Reaction method defined - Disposal criteria defined - FEFO rules displayed and followed',
          'Strictly followed manufacturer recommendations - shelf life - controlled conditions - NG material quarantined & recorded - Reaction method defined - Disposal criteria defined - Proactive trigger mechanism through reviews/ERP - FEFO rules displayed and followed'
        ],
        whatToLook: 'Shelf life identified and displayed on materials, Check MSDS for controlled conditions, Actions for NG materials (quarantined properly), Disposal method of NG materials, Understandable to operators, Review mechanism'
      },
      {
        id: '3.3',
        text: 'Are all frequently used objects sorted, arranged, stored and labelled? Work stations kept clean? Display boards kept clean and tidy?',
        criteria: [
          'No such system exists',
          'Work Instructions displayed - Not visible - Ugly, torn, not readable',
          'Work Instructions displayed - Visible to operators - Non standard in different places. Font size not defined',
          'System defined for work instructions - Common areas and Work station - Font size, format, board size defined - Pictorial WIs - Local language - WIs documented and linked with quality procedure - Quality Alerts clearly displayed',
          'System defined for work instructions - Common areas and Work station - Font size, format, board size defined - Pictorial WIs - Local language - WIs documented and linked with quality procedure - System defined for revision - Quality Alerts clearly displayed'
        ],
        whatToLook: '5S Levels, Status of Parts, Visual displays (Customer complaints, best employee, Production status, ESH status)'
      },
      {
        id: '3.4',
        text: 'Is FIFO process defined and displayed? Is the FIFO system followed?',
        criteria: [
          'No awareness about FIFO',
          'Awareness & little implementation',
          'Awareness & partial implementation - receipt lot wise stickers',
          'Awareness & concept clear at all level - incoming, In-process, FG - receipt lot wise stickers - Colour coding of stickers - Storage layout being used fully - FIFO rules displayed',
          'Awareness & concept clear at all level - incoming, In-process, FG - receipt lot wise stickers - Colour coding of stickers - Poka-Yoke method (In and Out) - Storage layout fully used - FIFO rules displayed & everyone follows'
        ],
        whatToLook: 'Pick samples to check FIFO maintained, Colour coding for different lots and location, FIFO board, Worker awareness about which lot to pick first, FEFO applied for products with expiry date (paint, glue, sealants etc.)'
      }
    ]
  },
  {
    id: '4',
    title: 'In Process Control',
    questions: [
      {
        id: '4.1',
        text: 'Is there a process sheet/drawing for each part? Is identification and approval of process parameters demonstrated, including acceptable operating ranges and critical parameters?',
        criteria: [
          'No such system exists',
          'Approval system defined - Randomly followed in few sections - Parameters not defined',
          'Approval system defined - Partially followed - Parameters partially defined',
          'Approval system defined - properly identified and recorded & demonstrated - acceptable operating ranges (Max/Min) - critical parameter included',
          'Approval system defined - properly identified & demonstrated - acceptable operating ranges (Max/Min) - critical parameter included - Parameters squeezed based on criticality'
        ],
        whatToLook: 'Approval of Quality Plans, SOPs etc., Correct version available and approved by customer, Process parameters defined with min/max value, Check on shop floor if adhered, Actions taken in case of non compliances'
      },
      {
        id: '4.2',
        text: 'Are S.O.P. / Work Instructions prepared & displayed on machines? Are they approved, revised, readable and understandable by operators?',
        criteria: [
          'WIs not available',
          'WIs are made - Displayed inappropriately',
          'WIs are made - Displayed at relevant location - Not covering all sections - Font size not readable',
          'WIs available - Displayed at all sections - Font size appropriate and standardized - operator able to understand - Rework WI available and followed - WI in local language if required',
          'WIs available - Displayed at all sections - Font size appropriate and standardized - operator understands - revision frequency defined - WIs defined in control plan - Size, colour coding, background, display locations defined - WI in local language - Rework WI available and followed'
        ],
        whatToLook: 'WIs available and accessible to operators, Local language understandable to operator, Pictorial WIs if operator cannot read, Safety instructions and acceptance criteria, Correct version at point of use, Interview operators to judge understanding'
      },
      {
        id: '4.3',
        text: 'Are In process quality parameters/Set up approval/In process Inspection well defined, controlled and monitored? Workmanship standards available?',
        criteria: [
          'No such system exists',
          'Basic Quality procedure defined - Implementation not followed',
          'Quality procedure exists - Implemented partially - Documents controlled and linked with procedure',
          'Quality procedure exists - Implemented in all sections - Documents controlled - Sampling plan/tolerances/measuring instruments/disposition/inspection frequency defined - set up approval & in process inspection records maintained',
          'Quality procedure exists - Implemented in all sections - Documents controlled - Sampling plan/tolerances/instruments/disposition/frequency defined - Critical/significant parameters clearly defined - Process capability/Control charts for critical parameters - Periodic revision and updation - set up approval & in process records maintained & reviewed'
        ],
        whatToLook: 'SOPs displayed on shop floor, Correct SOPs as per running Part and Operation, SOPs legible and understandable, Correctness of information as per Quality Plan, SOP contains all process and product monitoring parameters, Verify actual data, Correct revision of SOP'
      },
      {
        id: '4.4',
        text: 'Is there a Preventive maintenance plan & are these implemented? History Cards available? Does breakdown maintenance exists?',
        criteria: [
          'No preventive maintenance schedule available',
          'Breakdown maintenance facility available - Partial Implementation - records evident - B/Down for machine/tools/dies/jigs/fixtures',
          'Preventive maintenance schedule available - Implementation in place - records evident - B/Down & PM planned for machine/tools/dies/jigs/fixtures',
          'Preventive maintenance schedule available - Implementation in place - records evident - B/Down & PM planned - breakdown records available & analysed till CAPA - Effectiveness monitored - Repair validation done after breakdown',
          'Preventive maintenance schedule available - Implementation in place - records evident - B/Down & PM planned - breakdown records analysed till CAPA - Effectiveness monitored - Repair validation done - Trends of breakdown data - MTTR and MTBF data recording & improvement plan - Total productive maintenance (two pillars)'
        ],
        whatToLook: 'Process of maintenance (PDCA approach), Process owner, Measurable targets or KPIs, Current Performance vs targets, Actions if targets not met, PM Plan for all machines/tools/jigs/fixtures/utilities, PM Plan adherence, PM Check sheet with remarks and actions, Actions taken in case of breakdowns, Breakdown records and analysis'
      },
      {
        id: '4.5',
        text: 'Do written procedures / work instructions include Safety requirements, and Environmental precautions for all stages of manufacturing?',
        criteria: [
          'No safety labels utilized other than Fire Extinguishers',
          'No safety labels utilized other than Fire Extinguishers',
          'Safety labels properly utilized - Extinguishers - Aisle Ways',
          'Safety labels properly utilized - Extinguishers - Aisle Ways - Hazard warnings',
          'Safety labels properly utilized - Extinguishers - Aisle Ways - Hazard warnings - Exit/Emergency exits - Emergency Lights - Labels visible in fumes - Labels visible from all angles - Ergonomics considered'
        ],
        whatToLook: 'Safety displays clean and available across shop, Exit route and fire extinguisher locations clearly displayed'
      },
      {
        id: '4.6',
        text: 'Are jigs & fixtures, tooling identified and inspection fixtures stored at designated location and storage condition well maintained?',
        criteria: [
          'No such system exists',
          'Location and storage is random',
          'Proper location defined & storage organized - items kept at defined location only',
          'Proper location defined & storage well organized - items at defined location only - layout of storage is good - Jigs, fixtures and tooling to be marked',
          'Proper location defined & storage well organized - items at defined location - layout of storage good - Storage location conditions part of process audit program and 2S audit - Identification of Jigs/Fixtures'
        ],
        whatToLook: 'Storage condition of tool, jigs, fixtures, Identification of Tooling, Any colour coding system for customers/Parts, Preservation/Storage to prevent dust/dirt/deterioration, Tools easily accessible (Ergonomically placed), 5S followed'
      },
      {
        id: '4.7',
        text: 'What is the identification system for indicating material status as reject, rework or Hold material, next operation & disposal of rejected parts?',
        criteria: [
          'No such system exists',
          'Partial implementation - Tags used in few areas',
          'Proper identification defined & seen - for few specific areas only',
          'Proper identification defined & seen - for all areas & parts only',
          'Proper identification defined & seen for parts & Material in controlled conditions through Tags - Tag should have Part name, part number, material status, next operation, qty'
        ],
        whatToLook: 'Tagging and Identification of Parts at all operations and outside operations. Pick samples to verify correct tagging.'
      }
    ]
  },
  {
    id: '5',
    title: 'Gauges/Instruments Calibration',
    questions: [
      {
        id: '5.1',
        text: 'Is there a master list of gauges, instruments, Jigs and Fixtures? Is calibration done periodically with adequate records? NABL approved lab? Unique identification & next calibration due date?',
        criteria: [
          'No system of calibration exists within the organization',
          'Partial system exists - Partial documentation - Few instruments covered',
          'Calibration system exists - Master list defined - All measuring instruments, jigs, fixtures, equipment (UTM) and gauges - Calibration plan freezed on usage basis - Internal/External calibration not NABL accredited',
          'Calibration system exists - Master list defined - Each instrument has valid identification with historical records - All measuring instruments, jigs, fixtures, equipment - Calibration plan based on usage - Internal/External calibration NABL accredited - NABL scope defined - Drawings available for jigs and fixtures with GD&T',
          'Calibration system exists - Master list defined - Each instrument with valid identification and historical records - All instruments covered - Calibration plan based on usage - NABL accredited - NABL scope defined - Monitoring of NABL scope & accreditation verified - Drawings for jigs/fixtures with GD&T - Instrument drop policy defined/Calibration failure reaction plan'
        ],
        whatToLook: 'List of Instruments and samples not conforming to requirement, Check valid calibration label, Pick random samples and check certificate for validity (Item identity, Date Calibrated, Date due, Initial of person, Calibration frequency, Calibration Standards, NABL Lab scope)'
      }
    ]
  },
  {
    id: '6',
    title: 'Final Stage Inspection & Packing',
    questions: [
      {
        id: '6.1',
        text: 'Is there a separate stage/area for Pre-Dispatch Inspection? Work Instructions with dos and donts displayed? Does Partner follow any sampling plan?',
        criteria: [
          'No such system exists',
          'Inspection conducted before PDI/dispatch - System not defined',
          'Partial records maintained - Occasionally - Reports missed for few inspections',
          'Proper documentation found - For each lot - Inspectors qualified - Checking aids list defined - Tolerances clearly defined - Disposition status defined - Retention period followed - Parts identified post inspection - Dedicated PDI area defined - Inspection platform available - Barricading of PDI area',
          'Inspection performed by QA - inspection completion status marked over 100% product quantity - records maintained - Retention period followed - records easily retrievable at point of inspection - Parts identified post inspection - Dedicated PDI area with Dos Donts displayed, Material identification'
        ],
        whatToLook: 'Inspection records (pick samples), Marking on all Parts for inspection status (verify on shop floor), Retention period of records, Ask for old dated reports, Time taken to retrieve (should be easily retrievable)'
      },
      {
        id: '6.2',
        text: 'Any Packing standard followed? Dos & Donts for packing?',
        criteria: [
          'No such system exists',
          'Random packaging criteria defined - Occasionally packed',
          'Material is packed - No standard defined - Packing is ugly',
          'Specifications/guidelines displayed in local language - Separate area defined - Training documents made - Verification of completeness/BOM - Proper storage of packaging materials - Applicable tools available - Correct methods (Dos) - Incorrect methods (Donts)',
          'Specifications/guidelines displayed - Training documents made - Verification of completeness/BOM - Proper storage of packaging materials - Defined specs of packaging material (3 Ply etc) - packing & packaging processes with latest revision - Customer approved - Correct methods (Dos) and Incorrect methods (Donts)'
        ],
        whatToLook: 'WIs for Packing, Packaging, Preservation, Handling & Marking accessible and displayed, Customer requirements considered, How error proofing is ensured'
      }
    ]
  },
  {
    id: '7',
    title: 'Human Resource Management',
    questions: [
      {
        id: '7.1',
        text: 'Does the organization provide training or take other actions to satisfy competence needs, for permanent and contractual staff? Is Competency matrix available?',
        criteria: [
          'No formal system exists',
          'Partial system exists - Random trainings - No evidences',
          'Training system defined - Training plan made - Needs identified through HOD - Skill matrix defined - Training imparted only to permanent staff',
          'Training system defined - Training plan made - Needs identified through HOD - Skill matrix defined - Training for whole staff (permanent & contractual) - Training Attendance list - Training Records - Minimum safety trainings for all employees',
          'Training system defined - Training plan made - Needs identified through HOD - Skill matrix defined - Training for whole staff (permanent & contractual) - Attendance list - Training Records - Safety trainings for all - Effectiveness monitoring - Special courses from external agencies'
        ],
        whatToLook: 'Training Procedure (Training Need Identification and Skill Evaluation, PDCA approach), Competencies defined for all positions (verify 5 positions), Competency Matrix, Gap Analysis for training needs, Actions taken to fill gaps, Training Calendar (verify 3-4 samples for participation)'
      },
      {
        id: '7.2',
        text: 'Are trainings monitored for effectiveness? And Retraining planned if not effective?',
        criteria: [
          'No system exists',
          'System partially exists - Random analysis of effectiveness',
          'Records available - Effectiveness monitored for few programs - Oral questionnaire - No retraining planned',
          'Records available - Effectiveness monitored for few programs - Written questionnaire - Retraining planned and executed',
          'Records available - Effectiveness monitored for few programs - Written questionnaire - Retraining planned and executed - Linkage established between training executed and performance (5S, PPAP, EHS etc.)'
        ],
        whatToLook: 'Mechanism of training effectiveness evaluation (Exams, Interviews etc.), Check whether training is really effective with 2-3 samples, Pick samples where Training is not effective and check actions, Check for re-training'
      }
    ]
  },
  {
    id: '8',
    title: 'Non Negotiable Requirements',
    questions: [
      {
        id: '8.1',
        text: 'Does Special processes have proper control mechanism established and recorded? (Example - WPS-PQA for Welding, Soldering, Lamination)',
        criteria: [
          'Special Process not identified',
          'Not formally identified - Partial controls implemented',
          'Process controls defined - Operators identified and trained - Set up and in process parameters recorded - Periodic validation carried out - Makes of RM fixed',
          'Process controls defined - Operators identified and trained - Parameters recorded and retained - Periodic validation carried out - Makes of RM fixed - Skill matrix for special processes operators defined and implemented - Qualified experts available on call',
          'Process controls defined - Operators identified and trained - Parameters recorded and retained - Periodic validation carried out - Makes of RM fixed - Skill matrix defined and implemented - Qualified experts available on roll'
        ],
        whatToLook: 'QM/QAP defines and identify special process, Special operators identified and listed, Special process supervisor/head qualification records'
      },
      {
        id: '8.2',
        text: 'Does traceability process exists? Is it possible to trace finished good with respect to Raw Material used, Production processes?',
        criteria: [
          'No Material traceability system',
          'Traceability partial awareness - Implementation missing',
          'Traceability maintained on paper but practical linkage found missing',
          'Material system includes - Job card - pieces manufactured - pieces produced details (date, year, shift) - raw material lot details - Traceability process flow chart',
          'Material system includes - Job card - pieces manufactured - produced details (date, year, shift) - raw material lot details - Traceability process flow chart - FG traceable to raw material & manufacturing - Traceability part of internal audit - Code printed on part if size permits - Robust traceability definition (date code, year code, RM code, Job card, operator code, shift code)'
        ],
        whatToLook: 'Check Traceability of FG to Raw Material (pick samples), System followed for traceability, Any Bar Code system being followed, Mistake Proofing methods to avoid mixing'
      },
      {
        id: '8.3',
        text: 'Is PPE provided, and used, throughout all processes? Are "lost-time" accidents recorded and investigated?',
        criteria: [
          'No awareness about EHS requirements to staff',
          'Basic awareness with staff - No formal evidence of training',
          'Awareness about EHS requirements through training',
          'Awareness about EHS through training - display of benefits (PPEs) - Safety precautions - Dos & Donts - Method of ensuring PPE compliance - Replenishment of PPEs-Stock maintained - Fire Drill on regular basis',
          'Awareness through training - display of benefits (PPEs with proper analysis) - Safety precautions - Dos & Donts - List of Hazardous items - List of MSDSs - Safety Day celebrations - Proper risk analysis for PPEs - Replenishment of PPEs (Branded)-Stock maintained - Fire Drill on regular basis'
        ],
        whatToLook: 'ESH training records involving operator level, Display of ESH policy, dos and donts, PPE, safety hazards'
      },
      {
        id: '8.4',
        text: 'Whether records available for In Process & Customer Complaints? Whether top complaints analyzed to avoid repetition? System for Reworked material identification & quality status?',
        criteria: [
          'No such system exists',
          'NC material analysis procedure defined - Not followed practically - No records',
          'NC material analysis procedure defined - Data available - Actions randomly defined based on criticality',
          'NC material analysis procedure defined - Data available - Actions defined and implemented - Complaints prioritized based on severity, occurrence - NC issues discussed on frequent basis (Daily red bin analysis) - Pareto/why why analysis for field complaints - Corrective actions taken and implemented',
          'NC material analysis procedure defined - Data available - Actions defined and implemented - Complaints prioritized - NC issues discussed frequently - Causes analysed - CAPs defined - Horizontal deployment - Effectiveness monitored to prevent recurrence - Benefits of actions - Evidences available - Field failures considered for improvement'
        ],
        whatToLook: 'CAPA for NC - Who is responsible, Effectiveness of implementation, Daily Red Bin analysis'
      },
      {
        id: '8.5',
        text: 'Is Adequate Checking Facility available for all parameters? Are all instruments stored appropriately?',
        criteria: [
          'Not available',
          'Basic instruments available - Vernier, micrometer',
          'Mostly equipment available inhouse, rest dependent on sub-partner / outside lab',
          'Inhouse instruments available - List identified - Dimensional & mechanical testing - Instruments part of master list - All instruments calibrated - Jigs part of master list - All jigs calibrated',
          'Inhouse instruments available - List of instruments and jigs identified - Dimensional & mechanical testing - Instruments and jigs part of master list - All instruments and jigs calibrated - Back up plan available in case of crisis'
        ],
        whatToLook: 'Any inspection or testing by external party or all done internally, Internal Lab Scope should include tests performed'
      }
    ]
  },
  {
    id: '9',
    title: 'FB / HT Fasteners 8.8',
    optional: true,
    questions: [
      {
        id: '9.1',
        text: 'GI process specifically designed for fasteners/foundation bolt?',
        criteria: [
          'GI with conventional method',
          'GI with conventional method - Few monitoring reports found',
          'Jigs designed for few items - Process monitoring reports found',
          'Jigs/bucket designed for each item (washer, bolt nut) - Process monitoring report maintained - Preventive maintenance plan defined for GI equipments',
          'Jigs/bucket designed for each item - Process monitoring report maintained - Preventive maintenance plan defined for GI equipments - 5S & safety implementation - Improvement plan evident for GI defects'
        ],
        whatToLook: 'GI process for fasteners, Jigs designed, Process monitoring, Preventive maintenance for GI equipments'
      },
      {
        id: '9.2',
        text: 'Does Checking Aids include: MPI test, Straightness Inspection, Torque Testing, Portable Hardness Tester, Ultrasonic Machine at Incoming stage?',
        criteria: [
          'Not available',
          'Few instruments available - Inspection records not found',
          '3/5 instruments available inhouse - Calibration record available',
          'All instruments available inhouse - Inspection records available - Calibration record available',
          'All instruments available inhouse - Inspection records available - Calibration record available - Specific jigs available (Eg. Torque testing)'
        ],
        whatToLook: 'MPI test, Straightness Inspection, Torque Testing, Portable Hardness Tester, Ultrasonic Machine availability and records'
      }
    ]
  },
  {
    id: '10',
    title: 'Rectifier Module',
    optional: true,
    questions: [
      {
        id: '10.1',
        text: 'Does partner have experience in repairing Rectifier Modules? Associated with similar customers?',
        criteria: [
          'Not associated with similar customers/products',
          'Associated with intermittent customers',
          'Repairing similar products for other applications',
          'Repairing rectifier modules - Experience of two years in the same field',
          'Repairing rectifier modules - Experience of five years in the same field'
        ],
        whatToLook: 'Experience in rectifier module repair, Customer references, Years of experience'
      },
      {
        id: '10.2',
        text: 'Is there an inspection monitoring system defined for electronic assemblies before repair?',
        criteria: [
          'No system of incoming inspection',
          'Inspection done on random basis',
          'Inspection done on sampling basis',
          'Inspection done for all assemblies - Proper reports - WI maintained',
          'Inspection done for all assemblies - Proper reports - WI maintained - Skill matrix'
        ],
        whatToLook: 'Inspection system for electronic assemblies, Reports, WI, Skill matrix'
      },
      {
        id: '10.3',
        text: 'Availability of anti static mats and anti static slippers? Is TRC centre properly earthed?',
        criteria: [
          'Non availability of mats',
          'Anti static mat in all areas including repair shop',
          'Anti static mat in all areas - Few people not found wearing anti static slippers',
          'Anti static mat in all areas including repair shop',
          'Anti static mat in all areas including repair shop/testing area - All employees found ESD coat/anti static slipper'
        ],
        whatToLook: 'Anti static mats, Anti static slippers, ESD coat, Earthing of TRC centre'
      },
      {
        id: '10.4',
        text: 'Is system of Warranty Management clearly defined e.g field tracking with billing details?',
        criteria: [
          'No system of warranty tracking',
          'Warranty tracking done for partial complaints (random basis)',
          'Warranty tracking sheet evident - Warranty trend part of MRM',
          'Warranty tracking sheet evident - Warranty trend part of MRM - Warranty failure tracked through ERP',
          'Warranty tracking sheet evident - Warranty trend part of MRM - improvement plan evident - Warranty failure tracked through ERP'
        ],
        whatToLook: 'Warranty tracking system, Field tracking, Billing details, ERP integration'
      },
      {
        id: '10.5',
        text: 'Is process for reverse engineering/software for electronic assemblies defined and implemented?',
        criteria: [
          'No system is defined',
          'Reverse engineering done in few cases by outsource agency',
          'Few people in R&D dept but key activities like drawing development is outsourced',
          'R&D dept established - Development of Engg. Softwares (outsourced) - Validation of Engg. Softwares',
          'R&D dept established - Inhouse development of Engg. Softwares - Validation of Engg. Softwares - Inhouse stage wise drawing creation'
        ],
        whatToLook: 'R&D department, Reverse engineering capability, Software development, Drawing creation'
      }
    ]
  }
];

export default AUDIT_CHECKSHEET;
