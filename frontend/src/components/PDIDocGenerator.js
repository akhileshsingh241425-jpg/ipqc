import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Same URL pattern as FTRManagement, DispatchTracker, WitnessReport
const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// v3 - uses existing /api/companies, /api/ftr/company, /api/ftr/pdi-serials 
console.log('[PDI Docs v3] Loaded. API Base:', getAPIBaseURL() || '(empty - production)');

// Module types available
const MODULE_TYPES = {
  "G2G570": { name: "G2G1740-HAD 570W", cells: 144, size: "2278x1134x30" },
  "G2G575": { name: "G2G1740-HAD 575W", cells: 144, size: "2278x1134x30" },
  "G2G580": { name: "G2G1740-HAD 580W", cells: 144, size: "2278x1134x30" },
  "G2G585": { name: "G2G1740-HAD 585W", cells: 144, size: "2278x1134x30" },
  "G2G590": { name: "G2G1740-HAD 590W", cells: 144, size: "2278x1134x30" },
  "G2G595": { name: "G2G1740-HAD 595W", cells: 144, size: "2278x1134x30" },
  "G2G600": { name: "G2G1740-HAD 600W", cells: 144, size: "2278x1134x30" },
  "G2G605": { name: "G2G1740-HAD 605W", cells: 144, size: "2278x1134x30" },
  "G2G610": { name: "G2G1740-HAD 610W", cells: 144, size: "2278x1134x30" },
  "G3G615": { name: "G3G2340-HAD 615W", cells: 132, size: "2382x1134x30" },
  "G3G620": { name: "G3G2340-HAD 620W", cells: 132, size: "2382x1134x30" },
  "G3G625": { name: "G3G2340-HAD 625W", cells: 132, size: "2382x1134x30" },
  "G3G630": { name: "G3G2340-HAD 630W", cells: 132, size: "2382x1134x30" },
  "G3G635": { name: "G3G2340-HAD 635W", cells: 132, size: "2382x1134x30" },
  "G3G640": { name: "G3G2340-HAD 640W", cells: 132, size: "2382x1134x30" },
};

const PDIDocGenerator = () => {
  // State
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [pdiList, setPdiList] = useState([]);
  const [selectedPdi, setSelectedPdi] = useState('');
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(1); // 1: Select, 2: Configure, 3: Production Days, 4: Generate
  
  // Config state
  const [moduleType, setModuleType] = useState('G2G580');
  const [partyName, setPartyName] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorDesignation, setInspectorDesignation] = useState('QC Engineer');
  const [manufacturerRep, setManufacturerRep] = useState('');
  const [manufacturerDesignation, setManufacturerDesignation] = useState('QA Manager');
  const [cellManufacturer, setCellManufacturer] = useState('Solar Space');
  const [cellEfficiency, setCellEfficiency] = useState('25.7');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Production days
  const [productionDays, setProductionDays] = useState([]);
  const [autoSplitPerDay, setAutoSplitPerDay] = useState(500); // modules per day default

  // Load companies - using existing /api/companies endpoint (same as FTR Management)
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${getAPIBaseURL()}/api/companies`);
      // /api/companies returns array directly
      const data = Array.isArray(response.data) ? response.data : (response.data.companies || []);
      setCompanies(data);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const handleCompanySelect = async (companyId) => {
    if (!companyId) return;
    const company = companies.find(c => c.id === parseInt(companyId));
    setSelectedCompany(company);
    setSelectedPdi('');
    setSerials([]);
    setPdiList([]);
    
    try {
      setLoading(true);
      // Use existing FTR company API to get PDI assignments
      const response = await axios.get(`${getAPIBaseURL()}/api/ftr/company/${companyId}`);
      if (response.data.pdi_assignments) {
        setPdiList(response.data.pdi_assignments.map(p => ({
          pdi_number: p.pdi_number,
          count: p.count
        })));
      }
    } catch (error) {
      console.error('Error loading PDIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePdiSelect = async (pdiNumber) => {
    setSelectedPdi(pdiNumber);
    if (!pdiNumber || !selectedCompany) return;
    
    try {
      setLoading(true);
      // Use existing FTR pdi-serials API - fetch all serials (large page_size)
      const response = await axios.get(
        `${getAPIBaseURL()}/api/ftr/pdi-serials/${selectedCompany.id}/${encodeURIComponent(pdiNumber)}?page=1&page_size=100000`
      );
      if (response.data.success && response.data.serials) {
        const serialNumbers = response.data.serials.map(s => s.serial_number);
        setSerials(serialNumbers);
        // Auto-generate production days
        autoGenerateProductionDays(serialNumbers.length);
      }
    } catch (error) {
      console.error('Error loading serials:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateProductionDays = useCallback((totalSerials) => {
    const perDay = autoSplitPerDay || 500;
    const numDays = Math.ceil(totalSerials / perDay);
    const days = [];
    let remaining = totalSerials;
    const baseDate = new Date(reportDate);
    
    for (let i = 0; i < numDays; i++) {
      const dayDate = new Date(baseDate);
      dayDate.setDate(dayDate.getDate() - (numDays - 1 - i));
      const dayProduction = Math.min(remaining, perDay);
      // Split 60/40 day/night
      const dayShift = Math.round(dayProduction * 0.6);
      const nightShift = dayProduction - dayShift;
      
      days.push({
        date: dayDate.toISOString().slice(0, 10),
        day_production: dayShift,
        night_production: nightShift
      });
      remaining -= dayProduction;
    }
    setProductionDays(days);
  }, [autoSplitPerDay, reportDate]);

  const updateProductionDay = (index, field, value) => {
    const updated = [...productionDays];
    updated[index][field] = field === 'date' ? value : parseInt(value) || 0;
    setProductionDays(updated);
  };

  const addProductionDay = () => {
    const lastDate = productionDays.length > 0 
      ? new Date(productionDays[productionDays.length - 1].date) 
      : new Date(reportDate);
    lastDate.setDate(lastDate.getDate() + 1);
    
    setProductionDays([...productionDays, {
      date: lastDate.toISOString().slice(0, 10),
      day_production: 0,
      night_production: 0
    }]);
  };

  const removeProductionDay = (index) => {
    setProductionDays(productionDays.filter((_, i) => i !== index));
  };

  const totalProductionDaysQty = productionDays.reduce((sum, d) => sum + (d.day_production || 0) + (d.night_production || 0), 0);

  const handleGenerate = async () => {
    if (!selectedCompany || !selectedPdi || serials.length === 0) {
      alert('Please select a company and PDI with serials first.');
      return;
    }
    
    setGenerating(true);
    try {
      const payload = {
        company_id: selectedCompany.id,
        company_name: selectedCompany.companyName || selectedCompany.name || 'Gautam Solar Private Limited',
        party_name: partyName,
        pdi_number: selectedPdi,
        module_type: moduleType,
        serial_numbers: serials,
        report_date: new Date(reportDate).toLocaleDateString('en-GB'),
        inspector_name: inspectorName,
        inspector_designation: inspectorDesignation,
        manufacturer_rep: manufacturerRep,
        manufacturer_designation: manufacturerDesignation,
        cell_manufacturer: cellManufacturer,
        cell_efficiency: cellEfficiency,
        production_days: productionDays
      };

      const response = await axios.post(`${getAPIBaseURL()}/api/pdi-docs/generate`, payload, {
        responseType: 'blob'
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PDI_Documentation_${selectedPdi}_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Generation error:', error);
      alert('Error generating documentation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ==================== RENDER ====================
  return (
    <div style={{maxWidth: '1000px', margin: '0 auto', padding: '20px'}}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0D47A1, #1565C0, #1976D2)',
        borderRadius: '16px', padding: '24px 30px', marginBottom: '24px', color: '#fff'
      }}>
        <h1 style={{margin: 0, fontSize: '24px', fontWeight: 700}}>📋 PDI Documentation Generator</h1>
        <p style={{margin: '6px 0 0', opacity: 0.9, fontSize: '14px'}}>
          Auto-generate complete PDI package — IPQC, Witness Report, Calibration, Sampling Plan & MOM
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px', background: '#f8fafc',
        borderRadius: '12px', padding: '8px', border: '1px solid #e2e8f0'
      }}>
        {[
          {num: 1, label: 'Select PDI', icon: '🎯'},
          {num: 2, label: 'Configure', icon: '⚙️'},
          {num: 3, label: 'Production Days', icon: '📅'},
          {num: 4, label: 'Generate', icon: '📥'}
        ].map(s => (
          <button key={s.num} onClick={() => {
            if (s.num <= 1 || (s.num === 2 && serials.length > 0) || (s.num >= 2 && serials.length > 0)) setStep(s.num);
          }}
            style={{
              flex: 1, padding: '12px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: step === s.num ? '#1565C0' : 'transparent',
              color: step === s.num ? '#fff' : '#64748b',
              fontWeight: step === s.num ? 700 : 500, fontSize: '13px',
              transition: 'all 0.2s'
            }}>
            <div style={{fontSize: '18px'}}>{s.icon}</div>
            <div>{s.label}</div>
          </button>
        ))}
      </div>

      {/* ==================== STEP 1: Select Company & PDI ==================== */}
      {step === 1 && (
        <div style={{background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0'}}>
          <h2 style={{margin: '0 0 16px', fontSize: '18px', color: '#1e293b'}}>🎯 Select Company & PDI</h2>
          
          {/* Company Select */}
          <div style={{marginBottom: '16px'}}>
            <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Company</label>
            <select value={selectedCompany?.id || ''} onChange={(e) => handleCompanySelect(e.target.value)}
              style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px'}}>
              <option value="">-- Select Company --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.companyName || c.name} ({c.moduleWattage || c.wattage}W • {c.cellsPerModule || c.cells} cells)</option>
              ))}
            </select>
          </div>

          {/* PDI Select */}
          {pdiList.length > 0 && (
            <div style={{marginBottom: '16px'}}>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>PDI Number</label>
              <select value={selectedPdi} onChange={(e) => handlePdiSelect(e.target.value)}
                style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px'}}>
                <option value="">-- Select PDI --</option>
                {pdiList.map(p => (
                  <option key={p.pdi_number} value={p.pdi_number}>{p.pdi_number} — {p.count.toLocaleString()} serials</option>
                ))}
              </select>
            </div>
          )}

          {loading && <div style={{textAlign: 'center', padding: '20px', color: '#64748b'}}>Loading...</div>}

          {/* Serials Summary */}
          {serials.length > 0 && (
            <div style={{
              background: '#ecfdf5', borderRadius: '10px', padding: '16px', border: '1px solid #a7f3d0',
              marginTop: '16px'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontWeight: 700, color: '#065f46', fontSize: '16px'}}>
                    ✅ {serials.length.toLocaleString()} Serial Numbers Loaded
                  </div>
                  <div style={{fontSize: '12px', color: '#047857', marginTop: '4px'}}>
                    {serials[0]} → {serials[serials.length - 1]}
                  </div>
                </div>
                <button onClick={() => setStep(2)} style={{
                  padding: '10px 24px', background: '#059669', color: '#fff', border: 'none',
                  borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px'
                }}>
                  Next: Configure →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== STEP 2: Configuration ==================== */}
      {step === 2 && (
        <div style={{background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0'}}>
          <h2 style={{margin: '0 0 16px', fontSize: '18px', color: '#1e293b'}}>⚙️ Configuration</h2>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            {/* Module Type */}
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Module Type</label>
              <select value={moduleType} onChange={(e) => setModuleType(e.target.value)}
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px'}}>
                {Object.entries(MODULE_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.name} ({val.cells} cells)</option>
                ))}
              </select>
            </div>

            {/* Party Name */}
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Party / Customer Name</label>
              <input type="text" value={partyName} onChange={(e) => setPartyName(e.target.value)}
                placeholder="e.g., Sterling & Wilson, NTPC"
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>

            {/* Report Date */}
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Report Date</label>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>

            {/* Cell Manufacturer */}
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Cell Manufacturer</label>
              <input type="text" value={cellManufacturer} onChange={(e) => setCellManufacturer(e.target.value)}
                placeholder="e.g., Solar Space"
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>

            {/* Cell Efficiency */}
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Cell Efficiency (%)</label>
              <input type="text" value={cellEfficiency} onChange={(e) => setCellEfficiency(e.target.value)}
                placeholder="e.g., 25.7"
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>
          </div>

          {/* Separator */}
          <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}} />
          <h3 style={{fontSize: '15px', color: '#334155', margin: '0 0 12px'}}>👤 Inspector & Manufacturer Details (for MOM)</h3>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Inspector Name</label>
              <input type="text" value={inspectorName} onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Customer inspector name"
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Inspector Designation</label>
              <input type="text" value={inspectorDesignation} onChange={(e) => setInspectorDesignation(e.target.value)}
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Manufacturer Representative</label>
              <input type="text" value={manufacturerRep} onChange={(e) => setManufacturerRep(e.target.value)}
                placeholder="Manufacturer QA person"
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>
            <div>
              <label style={{display: 'block', fontWeight: 600, fontSize: '13px', color: '#475569', marginBottom: '6px'}}>Manufacturer Designation</label>
              <input type="text" value={manufacturerDesignation} onChange={(e) => setManufacturerDesignation(e.target.value)}
                style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box'}} />
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}>
            <button onClick={() => setStep(1)} style={{
              padding: '10px 24px', background: '#f1f5f9', color: '#475569', border: '1px solid #d1d5db',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
            }}>← Back</button>
            <button onClick={() => { autoGenerateProductionDays(serials.length); setStep(3); }} style={{
              padding: '10px 24px', background: '#1565C0', color: '#fff', border: 'none',
              borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px'
            }}>Next: Production Days →</button>
          </div>
        </div>
      )}

      {/* ==================== STEP 3: Production Days ==================== */}
      {step === 3 && (
        <div style={{background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0'}}>
          <h2 style={{margin: '0 0 8px', fontSize: '18px', color: '#1e293b'}}>📅 Production Days Breakdown</h2>
          <p style={{color: '#64748b', fontSize: '13px', margin: '0 0 16px'}}>
            Total serials: <strong>{serials.length.toLocaleString()}</strong> | 
            Days planned: <strong>{productionDays.length}</strong> | 
            Allocated: <strong style={{color: totalProductionDaysQty === serials.length ? '#059669' : '#dc2626'}}>
              {totalProductionDaysQty.toLocaleString()}
            </strong>
            {totalProductionDaysQty !== serials.length && (
              <span style={{color: '#dc2626', fontWeight: 600}}> (Mismatch! Should be {serials.length})</span>
            )}
          </p>

          {/* Auto-split control */}
          <div style={{
            background: '#f0f9ff', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
            border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <span style={{fontSize: '13px', fontWeight: 600, color: '#0369a1'}}>Auto-split:</span>
            <input type="number" value={autoSplitPerDay} onChange={(e) => setAutoSplitPerDay(parseInt(e.target.value) || 500)}
              style={{width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px'}} />
            <span style={{fontSize: '12px', color: '#64748b'}}>modules per day</span>
            <button onClick={() => autoGenerateProductionDays(serials.length)} style={{
              padding: '6px 14px', background: '#0284c7', color: '#fff', border: 'none',
              borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>Recalculate</button>
          </div>

          {/* Days Table */}
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
            <thead>
              <tr style={{background: '#f1f5f9'}}>
                <th style={{padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0'}}>Day</th>
                <th style={{padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0'}}>Date</th>
                <th style={{padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0'}}>Day Shift</th>
                <th style={{padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0'}}>Night Shift</th>
                <th style={{padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0'}}>Total</th>
                <th style={{padding: '10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0'}}></th>
              </tr>
            </thead>
            <tbody>
              {productionDays.map((day, idx) => {
                const dayTotal = (day.day_production || 0) + (day.night_production || 0);
                return (
                  <tr key={idx} style={{borderBottom: '1px solid #f1f5f9'}}>
                    <td style={{padding: '8px', textAlign: 'center', fontWeight: 600}}>{idx + 1}</td>
                    <td style={{padding: '8px', textAlign: 'center'}}>
                      <input type="date" value={day.date} onChange={(e) => updateProductionDay(idx, 'date', e.target.value)}
                        style={{padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px'}} />
                    </td>
                    <td style={{padding: '8px', textAlign: 'center'}}>
                      <input type="number" value={day.day_production} onChange={(e) => updateProductionDay(idx, 'day_production', e.target.value)}
                        style={{width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '13px'}} />
                    </td>
                    <td style={{padding: '8px', textAlign: 'center'}}>
                      <input type="number" value={day.night_production} onChange={(e) => updateProductionDay(idx, 'night_production', e.target.value)}
                        style={{width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '13px'}} />
                    </td>
                    <td style={{padding: '8px', textAlign: 'center', fontWeight: 700, color: '#1565C0'}}>{dayTotal}</td>
                    <td style={{padding: '8px', textAlign: 'center'}}>
                      <button onClick={() => removeProductionDay(idx)} style={{
                        background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px'
                      }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background: '#ecfdf5', fontWeight: 700}}>
                <td colSpan="2" style={{padding: '10px', textAlign: 'right'}}>TOTAL:</td>
                <td style={{padding: '10px', textAlign: 'center'}}>
                  {productionDays.reduce((s, d) => s + (d.day_production || 0), 0)}
                </td>
                <td style={{padding: '10px', textAlign: 'center'}}>
                  {productionDays.reduce((s, d) => s + (d.night_production || 0), 0)}
                </td>
                <td style={{padding: '10px', textAlign: 'center', color: '#059669', fontSize: '16px'}}>
                  {totalProductionDaysQty}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <button onClick={addProductionDay} style={{
            marginTop: '12px', padding: '8px 16px', background: '#f1f5f9', color: '#475569',
            border: '1px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', width: '100%'
          }}>+ Add Day</button>

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '20px'}}>
            <button onClick={() => setStep(2)} style={{
              padding: '10px 24px', background: '#f1f5f9', color: '#475569', border: '1px solid #d1d5db',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
            }}>← Back</button>
            <button onClick={() => setStep(4)} style={{
              padding: '10px 24px', background: '#1565C0', color: '#fff', border: 'none',
              borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '14px'
            }}>Next: Review & Generate →</button>
          </div>
        </div>
      )}

      {/* ==================== STEP 4: Review & Generate ==================== */}
      {step === 4 && (
        <div style={{background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0'}}>
          <h2 style={{margin: '0 0 16px', fontSize: '18px', color: '#1e293b'}}>📥 Review & Generate</h2>
          
          {/* Summary */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px'
          }}>
            {[
              {label: 'Company', value: selectedCompany?.companyName || selectedCompany?.name, icon: '🏢'},
              {label: 'PDI Number', value: selectedPdi, icon: '📋'},
              {label: 'Party', value: partyName || '—', icon: '🤝'},
              {label: 'Module', value: MODULE_TYPES[moduleType]?.name, icon: '☀️'},
              {label: 'Total Serials', value: serials.length.toLocaleString(), icon: '🔢'},
              {label: 'Production Days', value: productionDays.length, icon: '📅'},
              {label: 'Date', value: new Date(reportDate).toLocaleDateString('en-GB'), icon: '📆'},
              {label: 'Inspector', value: inspectorName || '—', icon: '👤'},
            ].map((item, idx) => (
              <div key={idx} style={{
                background: '#f8fafc', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0'
              }}>
                <div style={{fontSize: '18px'}}>{item.icon}</div>
                <div style={{fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px'}}>{item.label}</div>
                <div style={{fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '2px'}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* What will be generated */}
          <div style={{
            background: '#eff6ff', borderRadius: '10px', padding: '16px', border: '1px solid #bfdbfe', marginBottom: '20px'
          }}>
            <h3 style={{margin: '0 0 10px', fontSize: '14px', color: '#1e40af'}}>📑 Sheets that will be generated:</h3>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px'}}>
              {[
                '✅ IPQC Checksheet (per production day)',
                '✅ FTR Report (Flash Test)',
                '✅ Bifaciality Test',
                '✅ Visual Inspection',
                '✅ EL Inspection',
                '✅ Safety Tests (IR/HV/GC/Wet)',
                '✅ Dimension Measurement',
                '✅ RFID Verification',
                '✅ Sampling Plan (AQL)',
                '✅ Calibration Index',
                '✅ MOM (Completion Summary)',
              ].map((item, idx) => (
                <div key={idx} style={{color: '#1e40af'}}>{item}</div>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <button onClick={() => setStep(3)} style={{
              padding: '10px 24px', background: '#f1f5f9', color: '#475569', border: '1px solid #d1d5db',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
            }}>← Back</button>
            
            <button onClick={handleGenerate} disabled={generating} style={{
              padding: '14px 40px', 
              background: generating ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)',
              color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: '16px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
            }}>
              {generating ? '⏳ Generating...' : '📥 Generate Complete PDI Documentation'}
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div style={{
        marginTop: '20px', background: '#fffbeb', borderRadius: '10px', padding: '14px 18px',
        border: '1px solid #fcd34d', fontSize: '12px', color: '#92400e'
      }}>
        <strong>💡 How it works:</strong> Select company → PDI → Configure details → Set production days → 
        Click Generate. System auto-fills all IPQC checkpoints with realistic values, picks random serial samples (AQL sampling), 
        generates FTR/test data from database, includes calibration instruments, and creates MOM with complete summary. 
        <strong> Zero manual work — one click, complete documentation!</strong>
      </div>
    </div>
  );
};

export default PDIDocGenerator;
