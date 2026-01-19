import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

function WitnessReport() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [pdiList, setPdiList] = useState([]);
  const [selectedPdi, setSelectedPdi] = useState('');
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [manualSerials, setManualSerials] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadMode, setUploadMode] = useState('pdi'); // 'pdi' or 'excel' or 'manual'
  const [partyName, setPartyName] = useState('NTPC');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadCompanies();
  }, []);

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
        setSerialNumbers(response.data.serials);
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
        alert(`✅ Loaded ${serials.length} serial numbers from Excel`);
      } catch (error) {
        console.error('Error reading Excel:', error);
        alert('❌ Failed to read Excel file');
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
    alert(`✅ Loaded ${serials.length} serial numbers`);
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
          total_qty: serialNumbers.length
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

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
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
          Generate complete PDI Witness Report with all inspection sheets
        </p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '350px 1fr', gap: '25px'}}>
        {/* Left Panel - Configuration */}
        <div style={{
          background: 'white',
          borderRadius: '15px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{margin: '0 0 20px', color: '#333', borderBottom: '2px solid #667eea', paddingBottom: '10px'}}>
            ⚙️ Configuration
          </h3>

          {/* Company Select */}
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555'}}>
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
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Select Company --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Party Name */}
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555'}}>
              🏭 Party Name
            </label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g., NTPC, L&T, Rays Power"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Report Date */}
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555'}}>
              📅 Report Date
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #e0e0e0',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Input Mode Selection */}
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', fontWeight: '600', marginBottom: '10px', color: '#555'}}>
              📊 Serial Numbers Source
            </label>
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
              {[
                { id: 'pdi', label: '📋 From PDI', icon: '📋' },
                { id: 'excel', label: '📊 Excel Upload', icon: '📊' },
                { id: 'manual', label: '✍️ Manual Entry', icon: '✍️' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setUploadMode(mode.id)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: uploadMode === mode.id ? '2px solid #667eea' : '2px solid #e0e0e0',
                    background: uploadMode === mode.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                    color: uploadMode === mode.id ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: '12px',
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
            <div style={{marginBottom: '20px'}}>
              <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555'}}>
                📋 Select PDI Number
              </label>
              <select
                value={selectedPdi}
                onChange={(e) => handlePdiSelect(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontSize: '14px',
                  cursor: 'pointer'
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
            <div style={{marginBottom: '20px'}}>
              <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555'}}>
                📊 Upload Serial Numbers Excel
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px dashed #667eea',
                  fontSize: '14px',
                  cursor: 'pointer',
                  background: '#f8f9ff'
                }}
              />
              <p style={{fontSize: '11px', color: '#666', marginTop: '5px'}}>
                First column should contain serial numbers
              </p>
            </div>
          )}

          {/* Manual Entry */}
          {uploadMode === 'manual' && (
            <div style={{marginBottom: '20px'}}>
              <label style={{display: 'block', fontWeight: '600', marginBottom: '8px', color: '#555'}}>
                ✍️ Enter Serial Numbers
              </label>
              <textarea
                value={manualSerials}
                onChange={(e) => setManualSerials(e.target.value)}
                placeholder="Enter serial numbers (one per line or comma separated)"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  fontSize: '13px',
                  minHeight: '120px',
                  resize: 'vertical'
                }}
              />
              <button
                onClick={handleManualInput}
                style={{
                  marginTop: '8px',
                  padding: '8px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                ✅ Load Serials
              </button>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={generating || serialNumbers.length === 0}
            style={{
              width: '100%',
              padding: '15px',
              background: generating || serialNumbers.length === 0 
                ? '#ccc' 
                : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: generating || serialNumbers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              boxShadow: generating || serialNumbers.length === 0 ? 'none' : '0 4px 15px rgba(76,175,80,0.4)',
              marginTop: '10px'
            }}
          >
            {generating ? `⏳ Generating... ${progress}%` : '📥 Generate Witness Report'}
          </button>

          {/* Progress Bar */}
          {generating && (
            <div style={{marginTop: '15px'}}>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#e0e0e0',
                borderRadius: '4px',
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
          <h3 style={{margin: '0 0 20px', color: '#333', borderBottom: '2px solid #4CAF50', paddingBottom: '10px'}}>
            📋 Report Preview ({serialNumbers.length.toLocaleString()} serials)
          </h3>

          {/* Report Sheets Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
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
                padding: '15px',
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${sheet.color}15 0%, ${sheet.color}05 100%)`,
                border: `2px solid ${sheet.color}30`
              }}>
                <div style={{fontSize: '24px', marginBottom: '8px'}}>{sheet.icon}</div>
                <div style={{fontWeight: '600', fontSize: '13px', color: sheet.color}}>{sheet.name}</div>
                <div style={{fontSize: '11px', color: '#666', marginTop: '4px'}}>{sheet.desc}</div>
              </div>
            ))}
          </div>

          {/* Serial Numbers List */}
          <div style={{
            background: '#f8f9fa',
            borderRadius: '10px',
            padding: '15px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <h4 style={{margin: '0 0 12px', color: '#555', fontSize: '14px'}}>
              🔢 Serial Numbers ({serialNumbers.length.toLocaleString()})
            </h4>
            {serialNumbers.length === 0 ? (
              <p style={{color: '#999', textAlign: 'center', padding: '30px'}}>
                No serial numbers loaded yet.<br/>
                Select a PDI or upload Excel file.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '6px',
                fontSize: '12px'
              }}>
                {serialNumbers.slice(0, 100).map((serial, idx) => (
                  <div key={idx} style={{
                    padding: '6px 10px',
                    background: 'white',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                    fontFamily: 'monospace'
                  }}>
                    {idx + 1}. {serial}
                  </div>
                ))}
                {serialNumbers.length > 100 && (
                  <div style={{
                    padding: '10px',
                    background: '#fff3e0',
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#e65100',
                    fontWeight: '600',
                    gridColumn: '1 / -1'
                  }}>
                    ... and {(serialNumbers.length - 100).toLocaleString()} more serials
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
