import React, { useState, useEffect, useCallback } from 'react';
import '../styles/PDIDocGenerator.css';

// Smart API URL detection (same pattern as apiService.js)
const API_BASE_URL = (process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:5003/api' 
    : '/api')).trim();

const PDIDocGenerator = () => {
  // State
  const [step, setStep] = useState(1);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [pdis, setPdis] = useState([]);
  const [selectedPdi, setSelectedPdi] = useState(null);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [productionDays, setProductionDays] = useState(3);
  const [moduleType, setModuleType] = useState('G2G580');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDocs, setSelectedDocs] = useState(['ipqc', 'witness', 'calibration', 'sampling', 'mom']);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(null);
  const [templateInfo, setTemplateInfo] = useState(null);

  // Document types
  const docTypes = [
    { id: 'ipqc', name: 'IPQC Report', icon: '📋', desc: '33 stages, 200+ checkpoints auto-filled' },
    { id: 'witness', name: 'Witness Report', icon: '👁️', desc: 'FTR, Visual, EL, Safety tests' },
    { id: 'calibration', name: 'Calibration List', icon: '🔧', desc: 'All instruments with validity status' },
    { id: 'sampling', name: 'Sampling Plan', icon: '📊', desc: 'IS 2500 / ISO 2859 based AQL sampling' },
    { id: 'mom', name: 'MOM', icon: '📝', desc: 'Minutes of Meeting with FTR summary' },
  ];

  // Module types
  const moduleTypes = [
    'G2B510', 'G2B520', 'G2B530', 'G2B540', 'G2X550', 'G2X560',
    'G2G570', 'G2G575', 'G2G580', 'G2G585', 'G2G590', 'G2G595', 'G2G600', 'G2G605', 'G2G610',
    'G3G615', 'G3G620', 'G3G625', 'G3G630', 'G3G635', 'G3G640',
    'G12R622', 'G12R652'
  ];

  // Health check
  const checkBackend = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/pdi-docs/health`);
      if (res.ok) {
        setBackendReady(true);
        return true;
      }
      setBackendReady(false);
      return false;
    } catch {
      setBackendReady(false);
      return false;
    }
  }, []);

  // Load companies
  const loadCompanies = useCallback(async () => {
    try {
      // Try PDI docs endpoint first
      let res = await fetch(`${API_BASE_URL}/pdi-docs/companies`);
      if (res.ok) {
        const data = await res.json();
        if (data.companies && data.companies.length > 0) {
          setCompanies(data.companies);
          return;
        }
      }
      // Fallback to /api/companies
      res = await fetch(`${API_BASE_URL}/companies`);
      if (res.ok) {
        const data = await res.json();
        const list = data.companies || data.data || [];
        setCompanies(list.map(c => ({
          id: c.id || c.company_id || c.name,
          name: c.name || c.company_name || c.id
        })));
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  }, []);

  // Load PDIs for company
  const loadPdis = async (companyId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pdi-docs/pdis/${encodeURIComponent(companyId)}`);
      if (res.ok) {
        const data = await res.json();
        setPdis(data.pdis || []);
      }
    } catch (err) {
      console.error('Failed to load PDIs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load serials for PDI
  const loadSerials = async (pdiId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pdi-docs/serials/${pdiId}`);
      if (res.ok) {
        const data = await res.json();
        setSerialNumbers(data.serials || []);
      }
    } catch (err) {
      console.error('Failed to load serials:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load template info
  const loadTemplateInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/pdi-docs/template-info`);
      if (res.ok) {
        const data = await res.json();
        setTemplateInfo(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkBackend();
    loadCompanies();
    loadTemplateInfo();
  }, [checkBackend, loadCompanies, loadTemplateInfo]);

  // Company selected
  const handleCompanySelect = (companyId) => {
    setSelectedCompany(companyId);
    setSelectedPdi(null);
    setSerialNumbers([]);
    if (companyId) {
      loadPdis(companyId);
    } else {
      setPdis([]);
    }
  };

  // PDI selected
  const handlePdiSelect = (pdiId) => {
    const pdi = pdis.find(p => p.id === parseInt(pdiId));
    setSelectedPdi(pdi);
    if (pdiId) {
      loadSerials(pdiId);
    } else {
      setSerialNumbers([]);
    }
  };

  // Toggle document selection
  const toggleDoc = (docId) => {
    setSelectedDocs(prev => 
      prev.includes(docId) ? prev.filter(d => d !== docId) : [...prev, docId]
    );
  };

  // Format date for display
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Generate documents
  const handleGenerate = async () => {
    if (!selectedCompany || !selectedPdi || serialNumbers.length === 0) {
      setError('Please select company, PDI and ensure serials are loaded');
      return;
    }
    if (selectedDocs.length === 0) {
      setError('Please select at least one document to generate');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/pdi-docs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: selectedCompany,
          company_name: companies.find(c => c.id === selectedCompany)?.name || selectedCompany,
          pdi_id: selectedPdi.id,
          pdi_number: selectedPdi.pdi_number,
          serial_numbers: serialNumbers,
          production_days: productionDays,
          report_date: formatDisplayDate(reportDate),
          module_type: moduleType,
          documents: selectedDocs
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PDI_Documentation_${selectedPdi.pdi_number}_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess(`✅ PDI Documentation package generated successfully! ${selectedDocs.length} documents in ZIP.`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(`Server error ${res.status}: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Steps config
  const steps = [
    { num: 1, label: 'Select PDI', icon: '🎯' },
    { num: 2, label: 'Configure', icon: '⚙️' },
    { num: 3, label: 'Production Days', icon: '📅' },
    { num: 4, label: 'Generate', icon: '🚀' },
  ];

  const canProceed = () => {
    switch (step) {
      case 1: return selectedCompany && selectedPdi && serialNumbers.length > 0;
      case 2: return moduleType && reportDate;
      case 3: return productionDays > 0;
      default: return true;
    }
  };

  return (
    <div className="pdi-doc-generator">
      {/* Header */}
      <div className="pdg-header">
        <div className="pdg-header-content">
          <div>
            <h1>📄 PDI Documentation Generator</h1>
            <p>Auto-generate complete PDI package — IPQC, Witness Report, Calibration, Sampling Plan & MOM</p>
          </div>
          <div className="pdg-header-badges">
            <span className="pdg-version">v4</span>
            <span className={`pdg-status ${backendReady ? 'ready' : 'not-ready'}`}>
              {backendReady === null ? '⏳ Checking...' : backendReady ? '✅ Backend Ready' : '❌ Backend Not Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Backend warning */}
      {backendReady === false && (
        <div className="pdg-warning">
          ⚠️ Backend PDI Docs endpoint not available. 
          Run on server: <code>pm2 restart pdi-backend</code>
          <button onClick={checkBackend} className="pdg-retry-btn">Retry</button>
        </div>
      )}

      {/* Step indicator */}
      <div className="pdg-steps">
        {steps.map(s => (
          <div 
            key={s.num}
            className={`pdg-step ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}
            onClick={() => s.num <= step && setStep(s.num)}
          >
            <span className="pdg-step-icon">{step > s.num ? '✓' : s.icon}</span>
            <span className="pdg-step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Error / Success messages */}
      {error && <div className="pdg-error">{error}</div>}
      {success && <div className="pdg-success">{success}</div>}

      {/* Step Content */}
      <div className="pdg-content">
        {/* STEP 1: Select Company & PDI */}
        {step === 1 && (
          <div className="pdg-step-content">
            <h2>🎯 Select Company & PDI</h2>

            <div className="pdg-form-group">
              <label>Company ({companies.length} found)</label>
              <select 
                value={selectedCompany} 
                onChange={(e) => handleCompanySelect(e.target.value)}
              >
                <option value="">-- Select Company ({companies.length} available) --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedCompany && (
              <div className="pdg-form-group">
                <label>PDI Batch {loading ? '(loading...)' : `(${pdis.length} found)`}</label>
                <select 
                  value={selectedPdi?.id || ''} 
                  onChange={(e) => handlePdiSelect(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- Select PDI --</option>
                  {pdis.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.pdi_number} ({p.total_modules} modules)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedPdi && (
              <div className="pdg-serial-info">
                <div className="pdg-info-card">
                  <span className="pdg-info-label">📦 Serials Loaded</span>
                  <span className="pdg-info-value">{serialNumbers.length}</span>
                </div>
                <div className="pdg-info-card">
                  <span className="pdg-info-label">📋 PDI Number</span>
                  <span className="pdg-info-value">{selectedPdi.pdi_number}</span>
                </div>
                {templateInfo && (
                  <div className="pdg-info-card">
                    <span className="pdg-info-label">🔍 IPQC Checkpoints</span>
                    <span className="pdg-info-value">{templateInfo.total_stages} stages / {templateInfo.total_checkpoints} checks</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Configure */}
        {step === 2 && (
          <div className="pdg-step-content">
            <h2>⚙️ Configuration</h2>

            <div className="pdg-form-row">
              <div className="pdg-form-group">
                <label>Module Type</label>
                <select value={moduleType} onChange={(e) => setModuleType(e.target.value)}>
                  {moduleTypes.map(mt => (
                    <option key={mt} value={mt}>{mt}</option>
                  ))}
                </select>
              </div>

              <div className="pdg-form-group">
                <label>Report Date</label>
                <input 
                  type="date" 
                  value={reportDate} 
                  onChange={(e) => setReportDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="pdg-docs-selection">
              <h3>📑 Documents to Generate</h3>
              <div className="pdg-doc-grid">
                {docTypes.map(doc => (
                  <div 
                    key={doc.id}
                    className={`pdg-doc-card ${selectedDocs.includes(doc.id) ? 'selected' : ''}`}
                    onClick={() => toggleDoc(doc.id)}
                  >
                    <div className="pdg-doc-checkbox">
                      {selectedDocs.includes(doc.id) ? '☑' : '☐'}
                    </div>
                    <div className="pdg-doc-icon">{doc.icon}</div>
                    <div className="pdg-doc-name">{doc.name}</div>
                    <div className="pdg-doc-desc">{doc.desc}</div>
                  </div>
                ))}
              </div>
              <p className="pdg-doc-count">{selectedDocs.length} of {docTypes.length} documents selected</p>
            </div>
          </div>
        )}

        {/* STEP 3: Production Days */}
        {step === 3 && (
          <div className="pdg-step-content">
            <h2>📅 Production Days</h2>
            <p>How many production days did this PDI batch take?</p>

            <div className="pdg-days-selector">
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <button 
                  key={d}
                  className={`pdg-day-btn ${productionDays === d ? 'active' : ''}`}
                  onClick={() => setProductionDays(d)}
                >
                  {d} {d === 1 ? 'Day' : 'Days'}
                </button>
              ))}
            </div>

            <div className="pdg-summary-preview">
              <h3>📋 Generation Summary</h3>
              <table className="pdg-summary-table">
                <tbody>
                  <tr><td>Company</td><td>{companies.find(c => c.id === selectedCompany)?.name}</td></tr>
                  <tr><td>PDI</td><td>{selectedPdi?.pdi_number}</td></tr>
                  <tr><td>Modules</td><td>{serialNumbers.length}</td></tr>
                  <tr><td>Module Type</td><td>{moduleType}</td></tr>
                  <tr><td>Production Days</td><td>{productionDays}</td></tr>
                  <tr><td>Report Date</td><td>{formatDisplayDate(reportDate)}</td></tr>
                  <tr><td>Documents</td><td>{selectedDocs.length} selected</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 4: Generate */}
        {step === 4 && (
          <div className="pdg-step-content">
            <h2>🚀 Generate PDI Documentation</h2>

            <div className="pdg-final-summary">
              <div className="pdg-summary-grid">
                <div className="pdg-summary-item">
                  <span className="pdg-summary-icon">🏢</span>
                  <div>
                    <div className="pdg-summary-label">Company</div>
                    <div className="pdg-summary-value">{companies.find(c => c.id === selectedCompany)?.name}</div>
                  </div>
                </div>
                <div className="pdg-summary-item">
                  <span className="pdg-summary-icon">📋</span>
                  <div>
                    <div className="pdg-summary-label">PDI</div>
                    <div className="pdg-summary-value">{selectedPdi?.pdi_number}</div>
                  </div>
                </div>
                <div className="pdg-summary-item">
                  <span className="pdg-summary-icon">📦</span>
                  <div>
                    <div className="pdg-summary-label">Modules</div>
                    <div className="pdg-summary-value">{serialNumbers.length}</div>
                  </div>
                </div>
                <div className="pdg-summary-item">
                  <span className="pdg-summary-icon">📑</span>
                  <div>
                    <div className="pdg-summary-label">Documents</div>
                    <div className="pdg-summary-value">{selectedDocs.length} files in ZIP</div>
                  </div>
                </div>
              </div>

              <div className="pdg-doc-list">
                <h3>Files that will be generated:</h3>
                <ul>
                  {docTypes.filter(d => selectedDocs.includes(d.id)).map((doc, i) => (
                    <li key={doc.id}>
                      {doc.icon} {`0${i + 1}`}_{doc.name.replace(/ /g, '_')}_{selectedPdi?.pdi_number}.xlsx
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                className="pdg-generate-btn"
                onClick={handleGenerate}
                disabled={generating || !backendReady}
              >
                {generating ? (
                  <><span className="pdg-spinner"></span> Generating... Please wait</>
                ) : (
                  <>🚀 Generate & Download ZIP</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="pdg-navigation">
        {step > 1 && (
          <button className="pdg-nav-btn prev" onClick={() => setStep(step - 1)}>
            ← Previous
          </button>
        )}
        <div className="pdg-nav-spacer"></div>
        {step < 4 && (
          <button 
            className="pdg-nav-btn next" 
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Next →
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="pdg-howto">
        <h4>💡 How it works:</h4>
        <p>
          Select company → PDI → Configure details → Set production days → Click Generate.
          System auto-fills all IPQC checkpoints with realistic values, picks random serial samples (AQL sampling),
          generates FTR/test data from database, includes calibration instruments, and creates MOM with complete
          summary. <strong>Zero manual work — one click, complete documentation!</strong>
        </p>
      </div>
    </div>
  );
};

export default PDIDocGenerator;
