import React, { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import FTRTemplate from './FTRTemplate';
import BulkFTRGenerator from './BulkFTRGenerator';
import '../styles/TestReport.css';

const TestReport = ({ moduleDatabase }) => {
  const reportRef = useRef();
  
  const [testData, setTestData] = useState({
    moduleType: "",
    serialNumber: "",
    producer: "Gautam Solar",
    testDate: new Date().toLocaleDateString('en-CA'), // YYYY/MM/DD format
    testTime: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    irradiance: 1001.09,
    moduleTemp: 24.88,
    ambientTemp: 23.62,
    moduleArea: 2.70,
    results: {
      pmax: 570.03,
      vpm: 42.72,
      ipm: 13.34,
      voc: 50.84,
      isc: 14.49,
      fillFactor: 77.33,
      rs: 0.44,
      rsh: 210.25,
      efficiency: 22.06
    }
  });

  const [selectedModule, setSelectedModule] = useState("");

  // Get graph image based on power rating
  const getGraphImagePath = (power) => {
    if (!power) return null;
    
    // Graph images should be stored in public/iv_curves/ folder
    // Named as: 510.png, 520.png, 630.png etc.
    return `/iv_curves/${power}.png`;
  }

  // Handle module selection and auto-populate test data
  const handleModuleSelection = (moduleCode) => {
    setSelectedModule(moduleCode);
    
    if (moduleCode && moduleDatabase[moduleCode]) {
      const module = moduleDatabase[moduleCode];
      const specs = module.market;
      const dimensions = module.size.split('x');
      const area = (parseInt(dimensions[0]) * parseInt(dimensions[1])) / 1000000;
      
      // Generate serial number matching reference format GS04890KG2582504241
      const today = new Date();
      const year = today.getFullYear().toString().slice(-2);
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const random5 = Math.floor(Math.random() * 90000 + 10000); // 5 digits
      const cleanCode = moduleCode.substring(0, 6).replace(/[^A-Z0-9]/g, ''); // Clean module code
      const serialNo = `GS${month}${day}${random5}${cleanCode}G2${year}${month}${day}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`.substring(0, 20);
      
      // Generate realistic test parameters with minimal variations
      const actualPmax = specs.pmax.exact + (Math.random() - 0.5) * 0.2;
      const actualVpm = specs.vmax.exact + (Math.random() - 0.5) * 0.02;
      const actualIpm = specs.imax.exact + (Math.random() - 0.5) * 0.01;
      const actualVoc = specs.voc.exact + (Math.random() - 0.5) * 0.05;
      const actualIsc = specs.isc.exact + (Math.random() - 0.5) * 0.01;
      
      const actualFF = (actualPmax / (actualVoc * actualIsc)) * 100;
      
      let baseRs, baseRsh;
      
      if (module.power <= 540) {
        baseRs = 0.15 + Math.random() * 0.08;
        baseRsh = 2000 + Math.random() * 500;
      } else if (module.power <= 560) {
        baseRs = 0.13 + Math.random() * 0.06;
        baseRsh = 2100 + Math.random() * 500;
      } else if (module.power <= 610) {
        baseRs = 0.10 + Math.random() * 0.06;
        baseRsh = 2200 + Math.random() * 500;
      } else if (module.power <= 640) {
        baseRs = 0.08 + Math.random() * 0.05;
        baseRsh = 2300 + Math.random() * 500;
      } else {
        baseRs = 0.06 + Math.random() * 0.04;
        baseRsh = 2400 + Math.random() * 600;
      }
      
      setTestData(prev => ({
        ...prev,
        moduleType: `${module.power}W`,
        serialNumber: serialNo,
        moduleArea: area.toFixed(2),
        results: {
          pmax: actualPmax,
          vpm: actualVpm,
          ipm: actualIpm,
          voc: actualVoc,
          isc: actualIsc,
          fillFactor: actualFF,
          rs: baseRs,
          rsh: baseRsh,
          efficiency: (actualPmax / (area * 1000)) * 100
        }
      }));
    }
  };

  // Image-based Chart Component - displays pre-generated graph based on power rating
  // eslint-disable-next-line no-unused-vars
  const IVCurveChart = ({ power }) => {
    if (!power) {
      return (
        <div className="svg-chart-container">
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            Select a module to view I-V curve
          </div>
        </div>
      );
    }
    
    const graphImagePath = getGraphImagePath(power);
    
    return (
      <div className="svg-chart-container">
        <img 
          src={graphImagePath} 
          alt={`I-V Curve for ${power}W module`}
          className="iv-curve-image"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        <div style={{ display: 'none', padding: '20px', textAlign: 'center', color: '#666' }}>
          Graph image not found for {power}W module.<br/>
          Please upload graph image to: /public/iv_curves/graph_{power}.png
        </div>
      </div>
    );
  };

  // Export report as PDF using html2pdf
  const exportToPDF = () => {
    if (!selectedModule || !moduleDatabase[selectedModule]) {
      alert('Please select a module first');
      return;
    }

    const element = reportRef.current;
    const opt = {
      margin: 0,
      filename: `FTR_Report_${testData.serialNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: { 
        orientation: 'portrait', 
        unit: 'mm', 
        format: 'a4',
        compress: true
      }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="test-report-container">
      {/* Bulk Generator Section */}
      <BulkFTRGenerator moduleDatabase={moduleDatabase} />
      
      <hr style={{ margin: '40px 0', border: '1px solid #ddd' }} />
      
      {/* Single Report Generator */}
      <div className="test-controls">
        <h2>Single Module Testing Report Generator</h2>
        <div className="control-panel">
          <div className="form-group">
            <label>Select Module for Testing:</label>
            <select 
              value={selectedModule} 
              onChange={(e) => handleModuleSelection(e.target.value)}
              className="module-dropdown"
            >
              <option value="">-- Select Module for Testing --</option>
              {Object.entries(moduleDatabase).map(([key, module]) => (
                <option key={key} value={key}>
                  {module.name} - {module.power}W
                </option>
              ))}
            </select>
          </div>
          <button onClick={exportToPDF} className="export-pdf-btn">
            Export Report as PDF
          </button>
        </div>
      </div>

      <div ref={reportRef}>
        <FTRTemplate 
          testData={testData}
          graphImage={selectedModule && moduleDatabase[selectedModule] 
            ? getGraphImagePath(moduleDatabase[selectedModule].power) 
            : null}
        />
      </div>
    </div>
  );
};

export default TestReport;
