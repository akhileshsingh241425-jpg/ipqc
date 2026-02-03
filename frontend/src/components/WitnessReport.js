import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// Module Database with FTR specs
const moduleDatabase = {
  "G2B510": { name: "G2B510-HAD", power: 510, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    specs: { pmax: 510.0, vpm: 39.5, ipm: 12.9, isc: 13.5, voc: 47.8, ff: 77.5, eff: 19.8 }
  },
  "G2B520": { name: "G2B520-HAD", power: 520, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    specs: { pmax: 520.0, vpm: 39.8, ipm: 13.1, isc: 13.7, voc: 48.1, ff: 77.8, eff: 20.1 }
  },
  "G2B530": { name: "G2B530-HAD", power: 530, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    specs: { pmax: 530.0, vpm: 40.1, ipm: 13.2, isc: 13.8, voc: 48.3, ff: 78.0, eff: 20.5 }
  },
  "G2B540": { name: "G2B540-HAD", power: 540, cells: 144, size: "2278x1134x35", series: "Mono PERC G2B",
    specs: { pmax: 540.0, vpm: 40.4, ipm: 13.4, isc: 14.0, voc: 48.5, ff: 78.2, eff: 20.9 }
  },
  "G2X550": { name: "G2X550-HAD", power: 550, cells: 144, size: "2278x1134x35", series: "Mono PERC G2X",
    specs: { pmax: 550.1, vpm: 40.68, ipm: 12.82, isc: 13.63, voc: 48.80, ff: 78.5, eff: 21.3 }
  },
  "G2X560": { name: "G2X560-HAD", power: 560, cells: 144, size: "2278x1134x35", series: "Mono PERC G2X",
    specs: { pmax: 560.0, vpm: 40.9, ipm: 13.7, isc: 14.3, voc: 49.0, ff: 78.8, eff: 21.7 }
  },
  "G2G570": { name: "G2G1570-HAD", power: 570, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 570.0, vpm: 41.2, ipm: 13.8, isc: 14.4, voc: 49.5, ff: 79.0, eff: 22.0 }
  },
  "G2G575": { name: "G2G1725-HAD", power: 575, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 575.0, vpm: 41.4, ipm: 13.9, isc: 14.5, voc: 49.7, ff: 79.2, eff: 22.2 }
  },
  "G2G580": { name: "G2G1740-HAD", power: 580, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 590.0, vpm: 42.14, ipm: 14.09, isc: 14.58, voc: 50.90, ff: 79.5, eff: 22.8 }
  },
  "G2G585": { name: "G2G1755-HAD", power: 585, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 585.0, vpm: 41.65, ipm: 14.0, isc: 14.54, voc: 50.67, ff: 79.3, eff: 22.6 }
  },
  "G2G590": { name: "G2G1770-HAD", power: 590, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 596.42, vpm: 42.94, ipm: 13.89, isc: 14.64, voc: 51.68, ff: 79.8, eff: 23.0 }
  },
  "G2G595": { name: "G2G1785-HAD", power: 595, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 595.0, vpm: 42.8, ipm: 13.85, isc: 14.65, voc: 51.45, ff: 79.6, eff: 23.0 }
  },
  "G2G600": { name: "G2G1800-HAD", power: 600, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 600.0, vpm: 42.6, ipm: 14.1, isc: 14.8, voc: 51.0, ff: 80.0, eff: 23.2 }
  },
  "G2G605": { name: "G2G1815-HAD", power: 605, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 605.0, vpm: 42.8, ipm: 14.1, isc: 14.9, voc: 51.2, ff: 80.2, eff: 23.4 }
  },
  "G2G610": { name: "G2G1830-HAD", power: 610, cells: 144, size: "2278x1134x30", series: "TOPCon G2G",
    specs: { pmax: 610.0, vpm: 43.0, ipm: 14.2, isc: 15.0, voc: 51.4, ff: 80.5, eff: 23.6 }
  },
  "G3G615": { name: "G3G1845K-UHAB", power: 615, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 615.0, vpm: 44.8, ipm: 13.7, isc: 14.4, voc: 53.2, ff: 80.8, eff: 22.8 }
  },
  "G3G620": { name: "G3G1860K-UHAB", power: 620, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 620.0, vpm: 45.0, ipm: 13.8, isc: 14.5, voc: 53.4, ff: 81.0, eff: 23.0 }
  },
  "G3G625": { name: "G3G1875K-UHAB", power: 625, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 625.0, vpm: 45.2, ipm: 13.8, isc: 14.6, voc: 53.6, ff: 81.2, eff: 23.2 }
  },
  "G3G630": { name: "G3G1890K-UHAB", power: 630, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 630.0, vpm: 45.4, ipm: 13.9, isc: 14.7, voc: 53.8, ff: 81.5, eff: 23.4 }
  },
  "G3G635": { name: "G3G1905K-UHAB", power: 635, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 635.0, vpm: 45.6, ipm: 13.9, isc: 14.8, voc: 54.0, ff: 81.8, eff: 23.6 }
  },
  "G3G640": { name: "G3G1920K-UHAB", power: 640, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 640.0, vpm: 45.8, ipm: 14.0, isc: 14.9, voc: 54.2, ff: 82.0, eff: 23.8 }
  },
  "G3G645": { name: "G3G1935K-UHAB", power: 645, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 645.0, vpm: 46.0, ipm: 14.0, isc: 15.0, voc: 54.4, ff: 82.2, eff: 24.0 }
  },
  "G3G650": { name: "G3G1950K-UHAB", power: 650, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 650.0, vpm: 46.2, ipm: 14.1, isc: 15.1, voc: 54.6, ff: 82.5, eff: 24.2 }
  },
  "G3G655": { name: "G3G1965K-UHAB", power: 655, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 655.0, vpm: 46.4, ipm: 14.1, isc: 15.2, voc: 54.8, ff: 82.8, eff: 24.4 }
  },
  "G3G660": { name: "G3G1980K-UHAB", power: 660, cells: 132, size: "2382x1134x30", series: "TOPCon G2G-G12R",
    specs: { pmax: 660.0, vpm: 46.6, ipm: 14.2, isc: 15.3, voc: 55.0, ff: 83.0, eff: 24.6 }
  }
};

// Function to generate FTR data based on module type
const generateFTRData = (moduleType, serialNumber) => {
  let moduleSpecs = moduleDatabase[moduleType]?.specs || moduleDatabase['G2G580'].specs;
  
  // Generate realistic variations (±0.5%)
  const variation = () => (Math.random() - 0.5) * 0.01;
  
  return {
    pmax: (moduleSpecs.pmax * (1 + variation())).toFixed(2),
    isc: (moduleSpecs.isc * (1 + variation())).toFixed(2),
    voc: (moduleSpecs.voc * (1 + variation())).toFixed(2),
    ipm: (moduleSpecs.ipm * (1 + variation())).toFixed(2),
    vpm: (moduleSpecs.vpm * (1 + variation())).toFixed(2),
    ff: (moduleSpecs.ff * (1 + variation())).toFixed(2),
    efficiency: (moduleSpecs.eff * (1 + variation())).toFixed(2)
  };
};

function WitnessReport() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [pdiList, setPdiList] = useState([]);
  const [selectedPdi, setSelectedPdi] = useState('');
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [manualSerials, setManualSerials] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadMode, setUploadMode] = useState('excel'); // Default to Excel
  const [partyName, setPartyName] = useState('NTPC');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [progress, setProgress] = useState(0);
  
  // Step 1: After Excel upload, show configuration modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configStep, setConfigStep] = useState(1); // 1: Module Type, 2: EL+Hipot, 3: RFID, 4: FTR Deviation
  
  // Module Type for FTR generation
  const [selectedModuleType, setSelectedModuleType] = useState('G2G580');
  
  // EL + Hipot Dimension Settings
  const [elHipotData, setElHipotData] = useState({
    length: '2278',
    width: '1134',
    thickness: '30',
    hipotVoltage: '3800',
    hipotDuration: '3',
    elResult: 'OK'
  });
  
  // RFID Data
  const [rfidSerials, setRfidSerials] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [rfidFile, setRfidFile] = useState(null);
  
  // FTR Deviation Data
  const [hasDeviationData, setHasDeviationData] = useState(false);
  const [deviationSerials, setDeviationSerials] = useState({}); // {serial: {pmax, isc, voc, ...}}
  // eslint-disable-next-line no-unused-vars
  const [deviationFile, setDeviationFile] = useState(null);
  
  // Generated FTR data
  const [generatedFTRData, setGeneratedFTRData] = useState({});

  useEffect(() => {
    loadCompanies();
  }, []);

  // Generate FTR data when config is complete
  useEffect(() => {
    if (serialNumbers.length > 0 && selectedModuleType && !showConfigModal) {
      const newFTRData = {};
      serialNumbers.forEach(serial => {
        // Check if deviation data exists for this serial
        if (hasDeviationData && deviationSerials[serial]) {
          newFTRData[serial] = deviationSerials[serial];
        } else {
          newFTRData[serial] = generateFTRData(selectedModuleType, serial);
        }
      });
      setGeneratedFTRData(newFTRData);
    }
  }, [serialNumbers, selectedModuleType, showConfigModal, hasDeviationData, deviationSerials]);

  const loadCompanies = async () => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/witness/companies`);
      if (response.data.success) {
        setCompanies(response.data.companies);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadPdiList = async (companyId) => {
    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/witness/pdi-list/${companyId}`);
      if (response.data.success) {
        setPdiList(response.data.pdis);
      }
    } catch (error) {
      console.error('Failed to load PDI list:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSerialsForPdi = async (pdiNumber) => {
    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/witness/serials/${selectedCompany.id}/${pdiNumber}`);
      if (response.data.success) {
        const serials = response.data.serials;
        setSerialNumbers(serials);
        // Show config modal after loading serials
        setShowConfigModal(true);
        setConfigStep(1);
      }
    } catch (error) {
      console.error('Failed to load serials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    setSelectedPdi('');
    setSerialNumbers([]);
    loadPdiList(company.id);
  };

  const handlePdiSelect = (pdi) => {
    setSelectedPdi(pdi);
    loadSerialsForPdi(pdi);
  };

  // Handle main Excel upload (Serial Numbers)
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        const serials = [];
        for (let i = 0; i < jsonData.length; i++) {
          if (jsonData[i][0]) {
            const serial = String(jsonData[i][0]).trim();
            if (serial && serial.length > 5) {
              serials.push(serial);
            }
          }
        }
        setSerialNumbers(serials);
        
        // Show configuration modal
        setShowConfigModal(true);
        setConfigStep(1);
        
      } catch (error) {
        console.error('Error reading Excel:', error);
        alert('❌ Failed to read Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle RFID Excel upload
  const handleRFIDExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRfidFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        const rfids = [];
        for (let i = 0; i < jsonData.length; i++) {
          if (jsonData[i][0]) {
            const serial = String(jsonData[i][0]).trim();
            if (serial && serial.length > 5) {
              rfids.push(serial);
            }
          }
        }
        setRfidSerials(rfids);
        alert(`✅ Loaded ${rfids.length} RFID serial numbers`);
      } catch (error) {
        console.error('Error reading RFID Excel:', error);
        alert('❌ Failed to read RFID Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Deviation Excel upload (FTR data with deviations)
  const handleDeviationExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDeviationFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const deviations = {};
        jsonData.forEach(row => {
          // Expected columns: Serial, Pmax, Isc, Voc, Ipm, Vpm, FF, Efficiency
          const serial = String(row['Serial'] || row['serial'] || row['Serial Number'] || row['SERIAL'] || '').trim();
          if (serial && serial.length > 5) {
            deviations[serial] = {
              pmax: row['Pmax'] || row['PMAX'] || row['pmax'] || '0',
              isc: row['Isc'] || row['ISC'] || row['isc'] || '0',
              voc: row['Voc'] || row['VOC'] || row['voc'] || '0',
              ipm: row['Ipm'] || row['IPM'] || row['ipm'] || '0',
              vpm: row['Vpm'] || row['VPM'] || row['vpm'] || '0',
              ff: row['FF'] || row['ff'] || '0',
              efficiency: row['Efficiency'] || row['Eff'] || row['eff'] || row['EFFICIENCY'] || '0'
            };
          }
        });
        
        setDeviationSerials(deviations);
        setHasDeviationData(true);
        alert(`✅ Loaded deviation data for ${Object.keys(deviations).length} modules`);
      } catch (error) {
        console.error('Error reading Deviation Excel:', error);
        alert('❌ Failed to read Deviation Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleManualInput = () => {
    const serials = manualSerials
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    setSerialNumbers(serials);
    
    // Show configuration modal
    setShowConfigModal(true);
    setConfigStep(1);
  };

  // Navigate through config steps
  const nextStep = () => {
    if (configStep < 4) {
      setConfigStep(configStep + 1);
    } else {
      // Close modal and generate data
      setShowConfigModal(false);
    }
  };

  const prevStep = () => {
    if (configStep > 1) {
      setConfigStep(configStep - 1);
    }
  };

  const skipToEnd = () => {
    setShowConfigModal(false);
  };

  const generateReport = async () => {
    if (!selectedCompany) {
      alert('❌ Please select a company');
      return;
    }
    if (serialNumbers.length === 0) {
      alert('❌ No serial numbers loaded');
      return;
    }

    try {
      setGenerating(true);
      setProgress(10);

      const API_BASE_URL = getAPIBaseURL();
      setProgress(30);

      const response = await axios.post(
        `${API_BASE_URL}/api/witness/generate`,
        {
          company_id: selectedCompany.id,
          company_name: selectedCompany.name,
          party_name: partyName,
          pdi_number: selectedPdi || 'Custom',
          serial_numbers: serialNumbers,
          report_date: new Date(reportDate).toLocaleDateString('en-IN'),
          total_qty: serialNumbers.length,
          // Module type
          module_type: selectedModuleType,
          module_name: moduleDatabase[selectedModuleType]?.name || selectedModuleType,
          // EL + Hipot data
          el_hipot_data: elHipotData,
          // RFID serials
          rfid_serials: rfidSerials,
          // FTR data (auto-generated or with deviations)
          generated_ftr_data: generatedFTRData,
          has_deviation_data: hasDeviationData
        },
        { responseType: 'blob' }
      );

      setProgress(90);

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Witness_Report_${selectedPdi || 'Custom'}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setProgress(100);
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        alert('✅ Witness Report generated successfully!');
      }, 500);

    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('❌ Failed to generate witness report');
      setGenerating(false);
      setProgress(0);
    }
  };

  // Configuration Modal
  const renderConfigModal = () => {
    if (!showConfigModal) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '30px',
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          {/* Step Indicator */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '25px'
          }}>
            {[1, 2, 3, 4].map(step => (
              <div key={step} style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: configStep === step ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : configStep > step ? '#4CAF50' : '#e0e0e0',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '14px'
              }}>
                {configStep > step ? '✓' : step}
              </div>
            ))}
          </div>

          {/* Step 1: Module Type */}
          {configStep === 1 && (
            <div>
              <h2 style={{margin: '0 0 20px', textAlign: 'center', color: '#333'}}>
                ⚡ Step 1: Select Module Type
              </h2>
              <p style={{color: '#666', textAlign: 'center', marginBottom: '20px'}}>
                Loaded {serialNumbers.length} modules. Select the module type for FTR generation.
              </p>
              
              <select
                value={selectedModuleType}
                onChange={(e) => setSelectedModuleType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '10px',
                  border: '2px solid #667eea',
                  fontSize: '15px',
                  marginBottom: '15px'
                }}
              >
                <optgroup label="Mono PERC G2B (510W-540W)">
                  {Object.entries(moduleDatabase).filter(([k, m]) => m.series === 'Mono PERC G2B').map(([key, mod]) => (
                    <option key={key} value={key}>{mod.name} - {mod.power}W</option>
                  ))}
                </optgroup>
                <optgroup label="Mono PERC G2X (550W-560W)">
                  {Object.entries(moduleDatabase).filter(([k, m]) => m.series === 'Mono PERC G2X').map(([key, mod]) => (
                    <option key={key} value={key}>{mod.name} - {mod.power}W</option>
                  ))}
                </optgroup>
                <optgroup label="TOPCon G2G (570W-610W)">
                  {Object.entries(moduleDatabase).filter(([k, m]) => m.series === 'TOPCon G2G').map(([key, mod]) => (
                    <option key={key} value={key}>{mod.name} - {mod.power}W</option>
                  ))}
                </optgroup>
                <optgroup label="TOPCon G2G-G12R (615W-660W)">
                  {Object.entries(moduleDatabase).filter(([k, m]) => m.series === 'TOPCon G2G-G12R').map(([key, mod]) => (
                    <option key={key} value={key}>{mod.name} - {mod.power}W</option>
                  ))}
                </optgroup>
              </select>

              {selectedModuleType && moduleDatabase[selectedModuleType] && (
                <div style={{
                  padding: '15px',
                  background: '#f5f5f5',
                  borderRadius: '10px',
                  fontSize: '13px'
                }}>
                  <strong>Selected Module Specs:</strong><br />
                  Pmax: {moduleDatabase[selectedModuleType].specs.pmax}W | 
                  Voc: {moduleDatabase[selectedModuleType].specs.voc}V | 
                  Isc: {moduleDatabase[selectedModuleType].specs.isc}A | 
                  FF: {moduleDatabase[selectedModuleType].specs.ff}% |
                  Size: {moduleDatabase[selectedModuleType].size}mm
                </div>
              )}
            </div>
          )}

          {/* Step 2: EL + Hipot Dimension */}
          {configStep === 2 && (
            <div>
              <h2 style={{margin: '0 0 20px', textAlign: 'center', color: '#333'}}>
                📐 Step 2: EL & Hipot Dimension
              </h2>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px'}}>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '5px', fontSize: '13px'}}>
                    Length (mm)
                  </label>
                  <input
                    type="text"
                    value={elHipotData.length}
                    onChange={(e) => setElHipotData({...elHipotData, length: e.target.value})}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '5px', fontSize: '13px'}}>
                    Width (mm)
                  </label>
                  <input
                    type="text"
                    value={elHipotData.width}
                    onChange={(e) => setElHipotData({...elHipotData, width: e.target.value})}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '5px', fontSize: '13px'}}>
                    Thickness (mm)
                  </label>
                  <input
                    type="text"
                    value={elHipotData.thickness}
                    onChange={(e) => setElHipotData({...elHipotData, thickness: e.target.value})}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                  />
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px'}}>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '5px', fontSize: '13px'}}>
                    Hipot Voltage (V)
                  </label>
                  <input
                    type="text"
                    value={elHipotData.hipotVoltage}
                    onChange={(e) => setElHipotData({...elHipotData, hipotVoltage: e.target.value})}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '5px', fontSize: '13px'}}>
                    Duration (sec)
                  </label>
                  <input
                    type="text"
                    value={elHipotData.hipotDuration}
                    onChange={(e) => setElHipotData({...elHipotData, hipotDuration: e.target.value})}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontWeight: '600', marginBottom: '5px', fontSize: '13px'}}>
                    EL Result
                  </label>
                  <select
                    value={elHipotData.elResult}
                    onChange={(e) => setElHipotData({...elHipotData, elResult: e.target.value})}
                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0'}}
                  >
                    <option value="OK">OK / Pass</option>
                    <option value="NG">NG / Fail</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: RFID Upload */}
          {configStep === 3 && (
            <div>
              <h2 style={{margin: '0 0 20px', textAlign: 'center', color: '#333'}}>
                📡 Step 3: RFID Modules Excel
              </h2>
              <p style={{color: '#666', textAlign: 'center', marginBottom: '20px'}}>
                Upload Excel with serial numbers of modules that have RFID tags. Skip if not applicable.
              </p>
              
              <div style={{
                padding: '30px',
                border: '3px dashed #667eea',
                borderRadius: '15px',
                textAlign: 'center',
                background: '#f8f9ff',
                marginBottom: '20px'
              }}>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleRFIDExcelUpload}
                  style={{display: 'none'}}
                  id="rfid-upload"
                />
                <label htmlFor="rfid-upload" style={{cursor: 'pointer'}}>
                  <div style={{fontSize: '40px', marginBottom: '10px'}}>📡</div>
                  <div style={{fontWeight: '600', color: '#667eea'}}>
                    Click to Upload RFID Excel
                  </div>
                  <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                    Excel with Serial Number column
                  </div>
                </label>
              </div>

              {rfidSerials.length > 0 && (
                <div style={{
                  padding: '15px',
                  background: '#e8f5e9',
                  borderRadius: '10px',
                  border: '2px solid #4CAF50'
                }}>
                  <div style={{fontWeight: '600', color: '#2e7d32', marginBottom: '10px'}}>
                    ✅ Loaded {rfidSerials.length} RFID Serials
                  </div>
                  <div style={{fontSize: '12px', color: '#666', maxHeight: '100px', overflowY: 'auto'}}>
                    {rfidSerials.slice(0, 10).join(', ')}
                    {rfidSerials.length > 10 && ` ... and ${rfidSerials.length - 10} more`}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: FTR Deviation */}
          {configStep === 4 && (
            <div>
              <h2 style={{margin: '0 0 20px', textAlign: 'center', color: '#333'}}>
                ⚡ Step 4: FTR Data - Deviation?
              </h2>
              <p style={{color: '#666', textAlign: 'center', marginBottom: '20px'}}>
                Total {serialNumbers.length} modules. Do you have FTR data for specific modules (deviation)?
              </p>
              
              <div style={{display: 'flex', gap: '15px', marginBottom: '20px'}}>
                <button
                  onClick={() => setHasDeviationData(false)}
                  style={{
                    flex: 1,
                    padding: '20px',
                    borderRadius: '12px',
                    border: !hasDeviationData ? '3px solid #4CAF50' : '2px solid #e0e0e0',
                    background: !hasDeviationData ? '#e8f5e9' : 'white',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{fontSize: '30px', marginBottom: '8px'}}>🤖</div>
                  <div style={{fontWeight: '700', color: '#2e7d32'}}>Auto Generate All</div>
                  <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                    Generate FTR data for all {serialNumbers.length} modules based on module type
                  </div>
                </button>
                
                <button
                  onClick={() => setHasDeviationData(true)}
                  style={{
                    flex: 1,
                    padding: '20px',
                    borderRadius: '12px',
                    border: hasDeviationData ? '3px solid #ff9800' : '2px solid #e0e0e0',
                    background: hasDeviationData ? '#fff3e0' : 'white',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{fontSize: '30px', marginBottom: '8px'}}>📊</div>
                  <div style={{fontWeight: '700', color: '#e65100'}}>Upload Deviation Excel</div>
                  <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                    Upload custom FTR data for specific modules
                  </div>
                </button>
              </div>

              {hasDeviationData && (
                <div style={{
                  padding: '20px',
                  border: '3px dashed #ff9800',
                  borderRadius: '15px',
                  textAlign: 'center',
                  background: '#fff8e1',
                  marginBottom: '15px'
                }}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleDeviationExcelUpload}
                    style={{display: 'none'}}
                    id="deviation-upload"
                  />
                  <label htmlFor="deviation-upload" style={{cursor: 'pointer'}}>
                    <div style={{fontSize: '35px', marginBottom: '8px'}}>📈</div>
                    <div style={{fontWeight: '600', color: '#e65100'}}>
                      Click to Upload Deviation Excel
                    </div>
                    <div style={{fontSize: '11px', color: '#666', marginTop: '5px'}}>
                      Columns: Serial, Pmax, Isc, Voc, Ipm, Vpm, FF, Efficiency
                    </div>
                  </label>
                </div>
              )}

              {hasDeviationData && Object.keys(deviationSerials).length > 0 && (
                <div style={{
                  padding: '15px',
                  background: '#e8f5e9',
                  borderRadius: '10px',
                  border: '2px solid #4CAF50'
                }}>
                  <div style={{fontWeight: '600', color: '#2e7d32', marginBottom: '5px'}}>
                    ✅ Loaded deviation data for {Object.keys(deviationSerials).length} modules
                  </div>
                  <div style={{fontSize: '12px', color: '#666'}}>
                    Remaining {serialNumbers.length - Object.keys(deviationSerials).length} modules will be auto-generated
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '25px'}}>
            <button
              onClick={prevStep}
              disabled={configStep === 1}
              style={{
                padding: '12px 25px',
                borderRadius: '8px',
                border: 'none',
                background: configStep === 1 ? '#e0e0e0' : '#667eea',
                color: 'white',
                cursor: configStep === 1 ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              ← Previous
            </button>
            
            <button
              onClick={skipToEnd}
              style={{
                padding: '12px 25px',
                borderRadius: '8px',
                border: '2px solid #999',
                background: 'white',
                color: '#666',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Skip All →
            </button>
            
            <button
              onClick={nextStep}
              style={{
                padding: '12px 25px',
                borderRadius: '8px',
                border: 'none',
                background: configStep === 4 ? '#4CAF50' : '#667eea',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {configStep === 4 ? '✓ Done' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1500px',
      margin: '0 auto',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      {/* Config Modal */}
      {renderConfigModal()}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '25px 30px',
        borderRadius: '15px',
        marginBottom: '25px',
        boxShadow: '0 10px 40px rgba(102,126,234,0.3)'
      }}>
        <h1 style={{margin: 0, color: 'white', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px'}}>
          📋 Witness Report Generator
        </h1>
        <p style={{margin: '8px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '14px'}}>
          Generate PDI Witness Report - Upload Excel → Configure Module Type, EL/Hipot, RFID, FTR
        </p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '380px 1fr', gap: '25px'}}>
        {/* Left Panel - Configuration */}
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }}>
          <h3 style={{margin: '0 0 20px', color: '#333', borderBottom: '2px solid #667eea', paddingBottom: '10px'}}>
            ⚙️ Configuration
          </h3>

          {/* Company Select */}
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '6px', color: '#555', fontSize: '13px'}}>
              🏢 Select Company
            </label>
            <select
              value={selectedCompany?.id || ''}
              onChange={(e) => {
                const company = companies.find(c => c.id === parseInt(e.target.value));
                if (company) handleCompanySelect(company);
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '13px'
              }}
            >
              <option value="">-- Select Company --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Party Name */}
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '6px', color: '#555', fontSize: '13px'}}>
              🏭 Party Name
            </label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g., NTPC, L&T, Rays Power"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Report Date */}
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '6px', color: '#555', fontSize: '13px'}}>
              📅 Report Date
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Input Mode Selection */}
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555', fontSize: '13px'}}>
              📊 Serial Numbers Source
            </label>
            <div style={{display: 'flex', gap: '6px'}}>
              {[
                { id: 'pdi', label: '📋 PDI' },
                { id: 'excel', label: '📊 Excel' },
                { id: 'manual', label: '✍️ Manual' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setUploadMode(mode.id)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: uploadMode === mode.id ? '2px solid #667eea' : '2px solid #e0e0e0',
                    background: uploadMode === mode.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                    color: uploadMode === mode.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* PDI Selection */}
          {uploadMode === 'pdi' && selectedCompany && (
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', fontWeight: '600', marginBottom: '6px', color: '#555', fontSize: '13px'}}>
                📋 Select PDI Number
              </label>
              <select
                value={selectedPdi}
                onChange={(e) => handlePdiSelect(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontSize: '13px'
                }}
              >
                <option value="">-- Select PDI --</option>
                {pdiList.map(p => (
                  <option key={p.pdi_number} value={p.pdi_number}>
                    {p.pdi_number} ({p.count.toLocaleString()} serials)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Excel Upload */}
          {uploadMode === 'excel' && (
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', fontWeight: '600', marginBottom: '6px', color: '#555', fontSize: '13px'}}>
                📊 Upload Serial Numbers Excel
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px dashed #667eea',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: '#f8f9ff'
                }}
              />
              <p style={{fontSize: '11px', color: '#666', marginTop: '5px'}}>
                ℹ️ After upload, you'll configure Module Type, EL/Hipot, RFID & FTR data
              </p>
            </div>
          )}

          {/* Manual Entry */}
          {uploadMode === 'manual' && (
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', fontWeight: '600', marginBottom: '6px', color: '#555', fontSize: '13px'}}>
                ✍️ Enter Serial Numbers
              </label>
              <textarea
                value={manualSerials}
                onChange={(e) => setManualSerials(e.target.value)}
                placeholder="Enter serial numbers (one per line)"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontSize: '12px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
              <button
                onClick={handleManualInput}
                style={{
                  marginTop: '6px',
                  padding: '6px 12px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✅ Load & Configure
              </button>
            </div>
          )}

          {/* Current Config Summary */}
          {serialNumbers.length > 0 && !showConfigModal && (
            <div style={{
              marginBottom: '15px',
              padding: '12px',
              background: '#e8f5e9',
              borderRadius: '10px',
              border: '2px solid #4CAF50',
              fontSize: '12px'
            }}>
              <div style={{fontWeight: '700', color: '#2e7d32', marginBottom: '8px'}}>✅ Configuration Complete</div>
              <div><strong>Module:</strong> {moduleDatabase[selectedModuleType]?.name || selectedModuleType}</div>
              <div><strong>Size:</strong> {elHipotData.length} x {elHipotData.width} x {elHipotData.thickness} mm</div>
              <div><strong>RFID Modules:</strong> {rfidSerials.length}</div>
              <div><strong>FTR:</strong> {hasDeviationData ? `${Object.keys(deviationSerials).length} deviation + auto` : 'All auto-generated'}</div>
              <button
                onClick={() => { setShowConfigModal(true); setConfigStep(1); }}
                style={{
                  marginTop: '8px',
                  padding: '5px 10px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🔄 Re-Configure
              </button>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={generating || serialNumbers.length === 0}
            style={{
              width: '100%',
              padding: '14px',
              background: generating || serialNumbers.length === 0 
                ? '#ccc' 
                : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: generating || serialNumbers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: '700',
              boxShadow: generating || serialNumbers.length === 0 ? 'none' : '0 4px 15px rgba(76,175,80,0.4)',
              marginTop: '10px'
            }}
          >
            {generating ? `⏳ Generating... ${progress}%` : '📥 Generate Witness Report'}
          </button>

          {/* Progress Bar */}
          {generating && (
            <div style={{marginTop: '12px'}}>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#e0e0e0',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{padding: '15px', background: '#e3f2fd', borderRadius: '10px', textAlign: 'center'}}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#1565c0'}}>{serialNumbers.length}</div>
              <div style={{fontSize: '11px', color: '#666'}}>Total Modules</div>
            </div>
            <div style={{padding: '15px', background: '#e8f5e9', borderRadius: '10px', textAlign: 'center'}}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#2e7d32'}}>{rfidSerials.length}</div>
              <div style={{fontSize: '11px', color: '#666'}}>RFID Modules</div>
            </div>
            <div style={{padding: '15px', background: '#fff3e0', borderRadius: '10px', textAlign: 'center'}}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#e65100'}}>{Object.keys(deviationSerials).length}</div>
              <div style={{fontSize: '11px', color: '#666'}}>Deviation FTR</div>
            </div>
            <div style={{padding: '15px', background: '#fce4ec', borderRadius: '10px', textAlign: 'center'}}>
              <div style={{fontSize: '18px', fontWeight: '700', color: '#c2185b'}}>{moduleDatabase[selectedModuleType]?.power || 580}W</div>
              <div style={{fontSize: '11px', color: '#666'}}>Module Power</div>
            </div>
          </div>

          <h3 style={{margin: '0 0 15px', color: '#333', borderBottom: '2px solid #4CAF50', paddingBottom: '10px'}}>
            📋 Report Sheets Preview
          </h3>

          {/* Report Sheets Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '10px',
            marginBottom: '20px'
          }}>
            {[
              { name: 'FTR (Inspection)', icon: '⚡', color: '#1976d2', desc: 'Flasher Test Data' },
              { name: 'Bifaciality', icon: '🔄', color: '#ff9800', desc: 'Front & Rear Side' },
              { name: 'Visual Inspection', icon: '👁️', color: '#9c27b0', desc: 'Defects Check' },
              { name: 'EL Inspection', icon: '💡', color: '#e91e63', desc: 'Electroluminescence' },
              { name: 'IR/HV/GD/Wet', icon: '🔌', color: '#00bcd4', desc: 'Safety Tests' },
              { name: 'Dimension', icon: '📐', color: '#795548', desc: 'Physical Measurements' },
              { name: 'RFID', icon: '📡', color: '#607d8b', desc: 'Tag Data' }
            ].map(sheet => (
              <div key={sheet.name} style={{
                padding: '12px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${sheet.color}15 0%, ${sheet.color}05 100%)`,
                border: `2px solid ${sheet.color}30`
              }}>
                <div style={{fontSize: '20px', marginBottom: '5px'}}>{sheet.icon}</div>
                <div style={{fontWeight: '600', fontSize: '12px', color: sheet.color}}>{sheet.name}</div>
                <div style={{fontSize: '10px', color: '#666', marginTop: '3px'}}>{sheet.desc}</div>
              </div>
            ))}
          </div>

          {/* FTR Preview */}
          {serialNumbers.length > 0 && Object.keys(generatedFTRData).length > 0 && (
            <div style={{marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '10px'}}>
              <h4 style={{margin: '0 0 10px', fontSize: '14px', color: '#333'}}>
                ⚡ FTR Data Preview ({moduleDatabase[selectedModuleType]?.name})
              </h4>
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '11px'}}>
                  <thead>
                    <tr style={{background: '#1565c0', color: 'white'}}>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Sr.No</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Serial Number</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Pmax</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Isc</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Voc</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Ipm</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Vpm</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>FF</th>
                      <th style={{padding: '8px', border: '1px solid #ddd'}}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serialNumbers.slice(0, 5).map((serial, idx) => {
                      const ftr = generatedFTRData[serial] || {};
                      const isDeviation = hasDeviationData && deviationSerials[serial];
                      return (
                        <tr key={idx} style={{background: isDeviation ? '#fff3e0' : (idx % 2 === 0 ? 'white' : '#f9f9f9')}}>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{idx + 1}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', fontFamily: 'monospace'}}>{serial}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{ftr.pmax}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{ftr.isc}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{ftr.voc}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{ftr.ipm}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{ftr.vpm}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center'}}>{ftr.ff}</td>
                          <td style={{padding: '6px', border: '1px solid #ddd', textAlign: 'center', fontSize: '10px'}}>
                            {isDeviation ? '📊 Dev' : '🤖 Auto'}
                          </td>
                        </tr>
                      );
                    })}
                    {serialNumbers.length > 5 && (
                      <tr>
                        <td colSpan="9" style={{padding: '8px', textAlign: 'center', color: '#666', fontStyle: 'italic'}}>
                          ... and {serialNumbers.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Serial Numbers List */}
          <div style={{
            background: '#f8f9fa',
            borderRadius: '10px',
            padding: '15px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <h4 style={{margin: '0 0 10px', color: '#555', fontSize: '13px'}}>
              🔢 Serial Numbers ({serialNumbers.length.toLocaleString()} total)
            </h4>
            {serialNumbers.length === 0 ? (
              <p style={{color: '#999', textAlign: 'center', padding: '20px'}}>
                Upload Excel to load serial numbers. Configuration wizard will open.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '5px',
                fontSize: '11px'
              }}>
                {serialNumbers.slice(0, 50).map((serial, idx) => (
                  <div key={idx} style={{
                    padding: '5px 8px',
                    background: rfidSerials.includes(serial) ? '#e3f2fd' : 'white',
                    borderRadius: '4px',
                    border: rfidSerials.includes(serial) ? '1px solid #2196f3' : '1px solid #e0e0e0',
                    fontFamily: 'monospace'
                  }}>
                    {idx + 1}. {serial} {rfidSerials.includes(serial) && '📡'}
                  </div>
                ))}
                {serialNumbers.length > 50 && (
                  <div style={{
                    padding: '8px',
                    background: '#fff3e0',
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#e65100',
                    fontWeight: '600',
                    gridColumn: '1 / -1'
                  }}>
                    ... and {(serialNumbers.length - 50).toLocaleString()} more serials
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WitnessReport;
