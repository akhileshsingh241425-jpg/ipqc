import React, { useState, useEffect } from 'react';
import { companyService } from '../services/apiService';
import '../styles/DispatchTracker.css';
import * as XLSX from 'xlsx';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5003/api' 
  : '/api';

const DispatchTracker = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [productionData, setProductionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedPdi, setExpandedPdi] = useState(null);
  const [serialModal, setSerialModal] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [newCompanyData, setNewCompanyData] = useState({
    companyName: '',
    moduleWattage: '',
    cellsPerModule: ''
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await companyService.getAllCompanies();
      setCompanies(data || []);
    } catch (err) {
      console.error('Error loading companies:', err);
      setCompanies([]);
    }
  };

  const loadProductionData = async (company) => {
    try {
      setLoading(true);
      setError(null);
      setExpandedPdi(null);
      
      const res = await fetch(`${API_BASE_URL}/ftr/pdi-production-status/${company.id}`);
      const result = await res.json();
      console.log('PDI Production + Dispatch Status:', result);
      
      if (result.success) {
        setProductionData(result);
      } else {
        setError(result.error || 'No data found');
        setProductionData(null);
      }
    } catch (err) {
      setError('Error connecting to server. Please try again.');
      console.error('Error loading production data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (companyId) => {
    if (!companyId) {
      setSelectedCompany(null);
      setProductionData(null);
      return;
    }
    const company = companies.find(c => String(c.id) === String(companyId));
    if (company) {
      setSelectedCompany(company);
      loadProductionData(company);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await companyService.createCompany(newCompanyData);
      alert('Company created successfully!');
      setShowNewCompanyModal(false);
      setNewCompanyData({ companyName: '', moduleWattage: '', cellsPerModule: '' });
      await loadCompanies();
    } catch (err) {
      console.error('Error creating company:', err);
      alert('Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  // Search serial number across all PDIs
  const handleSerialSearch = () => {
    if (!serialSearch.trim() || !productionData?.pdi_wise) {
      setSearchResult(null);
      return;
    }
    const searchTerm = serialSearch.trim().toUpperCase();
    let found = null;
    
    for (const pdi of productionData.pdi_wise) {
      // Check dispatched
      const dispSerial = (pdi.dispatched_serials || []).find(s => s.serial?.toUpperCase().includes(searchTerm));
      if (dispSerial) {
        found = { pdi: pdi.pdi_number, serial: dispSerial.serial, status: 'Dispatched', pallet: dispSerial.pallet_no, color: '#22c55e' };
        break;
      }
      // Check packed
      const packSerial = (pdi.packed_serials || []).find(s => s.serial?.toUpperCase().includes(searchTerm));
      if (packSerial) {
        found = { pdi: pdi.pdi_number, serial: packSerial.serial, status: 'Packed', pallet: packSerial.pallet_no, color: '#f59e0b' };
        break;
      }
      // Check not packed
      const notPackSerial = (pdi.not_packed_serials || []).find(s => s.serial?.toUpperCase().includes(searchTerm));
      if (notPackSerial) {
        found = { pdi: pdi.pdi_number, serial: notPackSerial.serial, status: 'Not Packed', pallet: '—', color: '#ef4444' };
        break;
      }
    }
    setSearchResult(found);
  };

  // Export serials to Excel
  const exportToExcel = (type) => {
    if (!productionData?.pdi_wise) return;
    
    let allSerials = [];
    const companyName = selectedCompany?.companyName || 'Company';
    
    productionData.pdi_wise.forEach(pdi => {
      if (type === 'dispatched' || type === 'all') {
        (pdi.dispatched_serials || []).forEach(s => {
          allSerials.push({
            'PDI Number': pdi.pdi_number,
            'Serial Number': s.serial,
            'Status': 'Dispatched',
            'Pallet No': s.pallet_no || '',
            'Dispatch Party': s.dispatch_party || '',
            'Date': s.date || ''
          });
        });
      }
      if (type === 'packed' || type === 'all') {
        (pdi.packed_serials || []).forEach(s => {
          allSerials.push({
            'PDI Number': pdi.pdi_number,
            'Serial Number': s.serial,
            'Status': 'Packed',
            'Pallet No': s.pallet_no || '',
            'Dispatch Party': '',
            'Date': s.date || ''
          });
        });
      }
      if (type === 'not_packed' || type === 'all') {
        (pdi.not_packed_serials || []).forEach(s => {
          allSerials.push({
            'PDI Number': pdi.pdi_number,
            'Serial Number': s.serial,
            'Status': 'Not Packed',
            'Pallet No': '',
            'Dispatch Party': '',
            'Date': ''
          });
        });
      }
    });
    
    if (allSerials.length === 0) {
      alert('No serials to export!');
      return;
    }
    
    const ws = XLSX.utils.json_to_sheet(allSerials);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Serials');
    
    const typeLabel = type === 'all' ? 'All' : type === 'dispatched' ? 'Dispatched' : type === 'packed' ? 'Packed' : 'NotPacked';
    XLSX.writeFile(wb, `${companyName}_${typeLabel}_Serials_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const togglePdiExpand = (pdiNumber) => {
    setExpandedPdi(expandedPdi === pdiNumber ? null : pdiNumber);
  };

  const summary = productionData?.summary || {};
  const pdiWise = productionData?.pdi_wise || [];
  const totalProduced = summary.total_produced || 0;
  const totalPlanned = summary.total_planned || 0;
  const totalPending = summary.total_pending || 0;
  const totalFtrAssigned = summary.total_ftr_assigned || 0;
  const totalDispatched = summary.total_dispatched || 0;
  const totalPacked = summary.total_packed || 0;
  const totalDispPending = summary.total_dispatch_pending || 0;

  return (
    <div className="dispatch-tracker">
      {/* Header */}
      <div className="dispatch-header">
        <div>
          <h1>📊 PDI Production & Dispatch Report</h1>
          <p>Complete PDI-wise production, packing, pallet &amp; dispatch status</p>
        </div>
      </div>

      {/* Company Dropdown */}
      <div className="company-dropdown-container">
        <div className="dropdown-header">
          <label htmlFor="company-select">Select Company:</label>
          <div className="dropdown-actions">
            <button onClick={loadCompanies} className="refresh-companies-btn" title="Refresh">🔄 Refresh</button>
            <button onClick={() => setShowNewCompanyModal(true)} className="add-company-btn">➕ Add Company</button>
          </div>
        </div>
        <select
          id="company-select"
          value={selectedCompany?.id || ''}
          onChange={(e) => handleCompanySelect(e.target.value)}
          className="company-dropdown"
        >
          <option value="">-- Choose a Company --</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.companyName} ({company.moduleWattage}W • {company.cellsPerModule} cells)
            </option>
          ))}
        </select>
      </div>

      <div className="dispatch-content">
        <div className="dispatch-details-panel">
          {!selectedCompany ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>Select a Company</h3>
              <p>Choose a company to view complete PDI-wise dispatch report</p>
            </div>
          ) : loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading production &amp; dispatch data from MRP...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">❌</div>
              <h3>Error Loading Data</h3>
              <p>{error}</p>
              <button onClick={() => loadProductionData(selectedCompany)}>Retry</button>
            </div>
          ) : (
            <>
              {/* Company Header */}
              <div className="company-header">
                <h2>{selectedCompany.companyName}</h2>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  {productionData?.order_number && (
                    <span style={{fontSize: '13px', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px'}}>
                      Order: {productionData.order_number}
                    </span>
                  )}
                  <span style={{fontSize: '12px', color: '#94a3b8', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px'}}>
                    MRP Records: {(productionData?.mrp_lookup_size || 0).toLocaleString()}
                  </span>
                  <button onClick={() => loadProductionData(selectedCompany)} className="refresh-btn">🔄 Refresh</button>
                </div>
              </div>

              {/* MRP Warning */}
              {productionData?.mrp_error && (
                <div style={{background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e'}}>
                  ⚠️ MRP API Error: {productionData.mrp_error} — Dispatch data may not be available
                </div>
              )}
              {productionData?.mrp_lookup_size === 0 && !productionData?.mrp_error && (
                <div style={{background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e'}}>
                  ⚠️ MRP returned 0 records — Company name may not match MRP party name
                </div>
              )}

              {/* DEBUG INFO - Serial Matching Status */}
              {productionData?.debug_info && (
                <div style={{background: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#0369a1'}}>
                  <strong>🔍 Debug Info (Serial Matching):</strong>
                  <div style={{marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px'}}>
                    <div>MRP Barcodes: <strong>{productionData.debug_info.total_mrp_barcodes}</strong></div>
                    <div>Local Serials: <strong>{productionData.debug_info.total_local_serials}</strong></div>
                    <div style={{color: productionData.debug_info.matches_found > 0 ? '#16a34a' : '#dc2626'}}>
                      Matches: <strong>{productionData.debug_info.matches_found}</strong>
                    </div>
                  </div>
                  {productionData.debug_info.sample_mrp_barcodes?.length > 0 && (
                    <div style={{marginTop: '8px'}}>
                      <div>Sample MRP: <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'}}>{productionData.debug_info.sample_mrp_barcodes[0]}</code></div>
                      <div>Sample Local: <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'}}>{productionData.debug_info.sample_local_serials?.[0] || 'N/A'}</code></div>
                    </div>
                  )}
                </div>
              )}

              {/* Summary Cards */}
              <div className="summary-grid">
                <div className="stat-card" style={{borderLeft: '4px solid #2563eb'}}>
                  <div className="stat-icon">🏭</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Produced</div>
                    <div className="stat-value">{totalProduced.toLocaleString()}</div>
                    {totalPlanned > 0 && <div className="stat-sub">of {totalPlanned.toLocaleString()} planned</div>}
                  </div>
                </div>
                <div className="stat-card" style={{borderLeft: '4px solid #8b5cf6'}}>
                  <div className="stat-icon">🔬</div>
                  <div className="stat-content">
                    <div className="stat-label">FTR Tested</div>
                    <div className="stat-value">{(productionData?.total_ftr_ok || 0).toLocaleString()}</div>
                    <div className="stat-sub">OK: {(productionData?.total_ftr_ok || 0).toLocaleString()} | Rej: {(productionData?.total_rejected || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="stat-card" style={{borderLeft: '4px solid #22c55e'}}>
                  <div className="stat-icon">🚚</div>
                  <div className="stat-content">
                    <div className="stat-label">Dispatched</div>
                    <div className="stat-value" style={{color: '#16a34a'}}>{totalDispatched.toLocaleString()}</div>
                    <div className="stat-sub">{totalFtrAssigned > 0 ? `${Math.round((totalDispatched/totalFtrAssigned)*100)}% of assigned` : ''}</div>
                  </div>
                </div>
                <div className="stat-card" style={{borderLeft: '4px solid #f59e0b'}}>
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <div className="stat-label">Packed (Not Dispatched)</div>
                    <div className="stat-value" style={{color: '#d97706'}}>{totalPacked.toLocaleString()}</div>
                    <div className="stat-sub">Awaiting dispatch</div>
                  </div>
                </div>
                <div className="stat-card" style={{borderLeft: '4px solid #ef4444'}}>
                  <div className="stat-icon">⏳</div>
                  <div className="stat-content">
                    <div className="stat-label">Not Packed Yet</div>
                    <div className="stat-value" style={{color: '#dc2626'}}>{totalDispPending.toLocaleString()}</div>
                    <div className="stat-sub">Produced but not packed</div>
                  </div>
                </div>
                {totalPending > 0 && (
                  <div className="stat-card" style={{borderLeft: '4px solid #6b7280'}}>
                    <div className="stat-icon">📋</div>
                    <div className="stat-content">
                      <div className="stat-label">Production Pending</div>
                      <div className="stat-value" style={{color: '#6b7280'}}>{totalPending.toLocaleString()}</div>
                      <div className="stat-sub">Not yet produced</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Search Serial & Export Section */}
              <div style={{background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #e2e8f0'}}>
                <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start'}}>
                  {/* Serial Search */}
                  <div style={{flex: '1 1 300px'}}>
                    <label style={{fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block'}}>🔍 Search Serial Number</label>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <input 
                        type="text"
                        value={serialSearch}
                        onChange={(e) => setSerialSearch(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSerialSearch()}
                        placeholder="Enter serial number..."
                        style={{flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px'}}
                      />
                      <button onClick={handleSerialSearch} style={{padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600}}>
                        Search
                      </button>
                    </div>
                    {searchResult && (
                      <div style={{marginTop: '10px', padding: '12px', background: '#fff', borderRadius: '8px', border: `2px solid ${searchResult.color}`}}>
                        <div style={{fontWeight: 600, color: '#334155'}}>✅ Found: <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'}}>{searchResult.serial}</code></div>
                        <div style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}>
                          PDI: <strong>{searchResult.pdi}</strong> | Status: <span style={{color: searchResult.color, fontWeight: 600}}>{searchResult.status}</span> | Pallet: {searchResult.pallet}
                        </div>
                      </div>
                    )}
                    {serialSearch && searchResult === null && (
                      <div style={{marginTop: '10px', padding: '10px', background: '#fef2f2', borderRadius: '8px', color: '#991b1b', fontSize: '13px'}}>
                        ❌ Serial not found in current data
                      </div>
                    )}
                  </div>
                  
                  {/* Excel Export Buttons */}
                  <div style={{flex: '0 0 auto'}}>
                    <label style={{fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block'}}>📥 Export to Excel</label>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      <button onClick={() => exportToExcel('all')} style={{padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600}}>
                        📥 All Data
                      </button>
                      <button onClick={() => exportToExcel('dispatched')} style={{padding: '8px 12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600}}>
                        🚚 Dispatched
                      </button>
                      <button onClick={() => exportToExcel('packed')} style={{padding: '8px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600}}>
                        📦 Packed
                      </button>
                      <button onClick={() => exportToExcel('not_packed')} style={{padding: '8px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600}}>
                        ⏳ Not Packed
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Dispatch Progress Bar */}
              {totalFtrAssigned > 0 && (
                <div className="section" style={{marginBottom: '20px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <span style={{fontSize: '14px', fontWeight: 600, color: '#334155'}}>Dispatch Progress</span>
                    <span style={{fontSize: '14px', fontWeight: 600, color: '#2563eb'}}>
                      {Math.round(((totalDispatched + totalPacked) / totalFtrAssigned) * 100)}%
                    </span>
                  </div>
                  <div style={{height: '24px', borderRadius: '12px', background: '#f1f5f9', overflow: 'hidden', display: 'flex'}}>
                    {totalDispatched > 0 && (
                      <div style={{
                        width: `${(totalDispatched / totalFtrAssigned) * 100}%`,
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '11px', fontWeight: 600,
                        minWidth: '40px'
                      }}>{totalDispatched.toLocaleString()}</div>
                    )}
                    {totalPacked > 0 && (
                      <div style={{
                        width: `${(totalPacked / totalFtrAssigned) * 100}%`,
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '11px', fontWeight: 600,
                        minWidth: '40px'
                      }}>{totalPacked.toLocaleString()}</div>
                    )}
                    {totalDispPending > 0 && (
                      <div style={{
                        width: `${(totalDispPending / totalFtrAssigned) * 100}%`,
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '11px', fontWeight: 600,
                        minWidth: '40px'
                      }}>{totalDispPending.toLocaleString()}</div>
                    )}
                  </div>
                  <div style={{display: 'flex', gap: '20px', marginTop: '6px', fontSize: '12px'}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span style={{width: '12px', height: '12px', borderRadius: '3px', background: '#22c55e', display: 'inline-block'}}></span>
                      Dispatched ({totalDispatched.toLocaleString()})
                    </span>
                    <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span style={{width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b', display: 'inline-block'}}></span>
                      Packed ({totalPacked.toLocaleString()})
                    </span>
                    <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span style={{width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444', display: 'inline-block'}}></span>
                      Not Packed ({totalDispPending.toLocaleString()})
                    </span>
                  </div>
                </div>
              )}

              {/* Tab Switcher */}
              <div className="tab-switcher" style={{marginBottom: '16px'}}>
                <button 
                  className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                  onClick={() => setActiveTab('summary')}
                >
                  📋 PDI Summary
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'pallets' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pallets')}
                >
                  📦 Pallet-wise Report
                </button>
              </div>

              {/* ==================== TAB 1: PDI Summary ==================== */}
              {activeTab === 'summary' && pdiWise.length > 0 && (
                <div className="section">
                  <h3>📋 PDI-wise Complete Status</h3>
                  <div className="pallet-table-container">
                    <table className="pallet-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>PDI Number</th>
                          <th>Produced</th>
                          <th>FTR Assigned</th>
                          <th style={{background: '#dcfce7', color: '#166534'}}>Dispatched</th>
                          <th style={{background: '#fef9c3', color: '#854d0e'}}>Packed</th>
                          <th style={{background: '#fee2e2', color: '#991b1b'}}>Not Packed</th>
                          <th>Pallets</th>
                          <th>Dispatch %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdiWise.map((pdi, index) => {
                          const totalAssigned = (pdi.dispatched || 0) + (pdi.packed || 0) + (pdi.dispatch_pending || 0);
                          const dispatchPct = totalAssigned > 0 ? Math.round(((pdi.dispatched || 0) / totalAssigned) * 100) : 0;
                          const palletCount = (pdi.pallet_groups || []).length;
                          
                          return (
                            <React.Fragment key={index}>
                              <tr className={expandedPdi === pdi.pdi_number ? 'expanded-row' : ''}>
                                <td>{index + 1}</td>
                                <td className="pdi-number">
                                  <strong>{pdi.pdi_number}</strong>
                                  {pdi.start_date && <div style={{fontSize: '10px', color: '#94a3b8'}}>{pdi.start_date} → {pdi.last_date}</div>}
                                </td>
                                <td className="module-count">
                                  <span className="badge">{pdi.produced.toLocaleString()}</span>
                                </td>
                                <td className="module-count">
                                  <span className="badge" style={{background:'#ede9fe', color:'#6d28d9'}}>{pdi.ftr_tested.toLocaleString()}</span>
                                </td>
                                <td className="module-count">
                                  {(pdi.dispatched || 0) > 0
                                    ? <span className="badge clickable-badge" style={{background:'#dcfce7', color:'#166534'}} onClick={() => setSerialModal({
                                        title: `${pdi.pdi_number} — Dispatched (${pdi.dispatched.toLocaleString()})`,
                                        serials: pdi.dispatched_serials || [],
                                        type: 'dispatched'
                                      })}>{pdi.dispatched.toLocaleString()}</span>
                                    : <span style={{color: '#ccc'}}>0</span>
                                  }
                                </td>
                                <td className="module-count">
                                  {(pdi.packed || 0) > 0
                                    ? <span className="badge clickable-badge" style={{background:'#fef9c3', color:'#854d0e'}} onClick={() => setSerialModal({
                                        title: `${pdi.pdi_number} — Packed (${pdi.packed.toLocaleString()})`,
                                        serials: pdi.packed_serials || [],
                                        type: 'packed'
                                      })}>{pdi.packed.toLocaleString()}</span>
                                    : <span style={{color: '#ccc'}}>0</span>
                                  }
                                </td>
                                <td className="module-count">
                                  {(pdi.dispatch_pending || pdi.not_packed || 0) > 0 
                                    ? <span className="badge clickable-badge" style={{background:'#fee2e2', color:'#991b1b'}} onClick={() => setSerialModal({
                                        title: `${pdi.pdi_number} — Not Packed (${(pdi.not_packed || pdi.dispatch_pending || 0).toLocaleString()})`,
                                        serials: pdi.not_packed_serials || [],
                                        type: 'not_packed'
                                      })}>{(pdi.not_packed || pdi.dispatch_pending || 0).toLocaleString()}</span>
                                    : <span style={{color: '#22c55e', fontWeight: 600}}>✓</span>
                                  }
                                </td>
                                <td>
                                  {palletCount > 0 ? (
                                    <span 
                                      className="badge clickable-badge" 
                                      style={{background:'#e0e7ff', color:'#3730a3', cursor:'pointer'}}
                                      onClick={() => togglePdiExpand(pdi.pdi_number)}
                                    >
                                      {palletCount} pallets {expandedPdi === pdi.pdi_number ? '▲' : '▼'}
                                    </span>
                                  ) : <span style={{color:'#ccc'}}>—</span>}
                                </td>
                                <td>
                                  <div className="progress-bar-container">
                                    <div style={{height: '10px', borderRadius: '5px', background: '#f1f5f9', overflow: 'hidden', display: 'flex', width: '80px'}}>
                                      <div style={{width: `${dispatchPct}%`, background: '#22c55e', transition: 'width 0.3s'}}></div>
                                      <div style={{width: `${totalAssigned > 0 ? Math.round(((pdi.packed || 0) / totalAssigned) * 100) : 0}%`, background: '#f59e0b', transition: 'width 0.3s'}}></div>
                                    </div>
                                    <span className="progress-text" style={{fontSize:'11px'}}>{dispatchPct}%</span>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Pallet Detail Row */}
                              {expandedPdi === pdi.pdi_number && (pdi.pallet_groups || []).length > 0 && (
                                <tr>
                                  <td colSpan="9" style={{padding: 0, background: '#f8fafc'}}>
                                    <div style={{padding: '12px 20px'}}>
                                      <h4 style={{margin: '0 0 10px', fontSize: '13px', color: '#334155'}}>
                                        📦 Pallet Details — {pdi.pdi_number} ({(pdi.pallet_groups || []).length} pallets)
                                      </h4>
                                      <table className="pallet-table" style={{fontSize: '12px', margin: 0}}>
                                        <thead>
                                          <tr>
                                            <th>#</th>
                                            <th>Pallet No</th>
                                            <th>Status</th>
                                            <th>Modules</th>
                                            <th>Vehicle No</th>
                                            <th>Dispatch Date</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(pdi.pallet_groups || []).map((pg, pi) => (
                                            <tr key={pi}>
                                              <td>{pi + 1}</td>
                                              <td><strong>{pg.pallet_no}</strong></td>
                                              <td>
                                                <span className="badge" style={{
                                                  background: pg.status === 'Dispatched' ? '#dcfce7' : pg.status === 'Packed' ? '#fef9c3' : '#fee2e2',
                                                  color: pg.status === 'Dispatched' ? '#166534' : pg.status === 'Packed' ? '#854d0e' : '#991b1b',
                                                  fontSize: '11px'
                                                }}>
                                                  {pg.status === 'Dispatched' ? '🚚' : pg.status === 'Packed' ? '📦' : '⏳'} {pg.status}
                                                </span>
                                              </td>
                                              <td><strong>{pg.count}</strong></td>
                                              <td style={{fontSize: '11px'}}>{pg.dispatch_party || pg.vehicle_no || '—'}</td>
                                              <td style={{fontSize: '11px'}}>{pg.date || pg.dispatch_date || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {/* Total Row */}
                        <tr style={{fontWeight: 'bold', background: '#f0f7ff', borderTop: '2px solid #2563eb'}}>
                          <td></td>
                          <td>TOTAL</td>
                          <td><span className="badge">{totalProduced.toLocaleString()}</span></td>
                          <td><span className="badge" style={{background:'#ede9fe', color:'#6d28d9'}}>{totalFtrAssigned.toLocaleString()}</span></td>
                          <td><span className="badge" style={{background:'#dcfce7', color:'#166534'}}>{totalDispatched.toLocaleString()}</span></td>
                          <td><span className="badge" style={{background:'#fef9c3', color:'#854d0e'}}>{totalPacked.toLocaleString()}</span></td>
                          <td>{totalDispPending > 0 ? <span className="badge" style={{background:'#fee2e2', color:'#991b1b'}}>{totalDispPending.toLocaleString()}</span> : <span style={{color: '#22c55e'}}>✓</span>}</td>
                          <td></td>
                          <td>
                            <span style={{fontSize: '13px', color: '#2563eb', fontWeight: 700}}>
                              {totalFtrAssigned > 0 ? Math.round((totalDispatched / totalFtrAssigned) * 100) : 0}%
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ==================== TAB 2: Pallet-wise Report ==================== */}
              {activeTab === 'pallets' && (
                <div className="section">
                  <h3>📦 Pallet-wise Dispatch Report</h3>
                  {pdiWise.map((pdi, pdiIdx) => {
                    const pallets = pdi.pallet_groups || [];
                    const dispPallets = pallets.filter(p => p.status === 'Dispatched');
                    const packPallets = pallets.filter(p => p.status === 'Packed');
                    
                    if (pallets.length === 0 && (pdi.dispatched || 0) === 0 && (pdi.packed || 0) === 0) return null;

                    return (
                      <div key={pdiIdx} style={{marginBottom: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden'}}>
                        {/* PDI Header */}
                        <div style={{
                          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                          color: '#fff', padding: '14px 20px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <div>
                            <h4 style={{margin: 0, fontSize: '16px'}}>{pdi.pdi_number}</h4>
                            <div style={{fontSize: '12px', opacity: 0.85, marginTop: '4px'}}>
                              FTR Assigned: {pdi.ftr_tested.toLocaleString()} | 
                              Produced: {pdi.produced.toLocaleString()}
                            </div>
                          </div>
                          <div style={{display: 'flex', gap: '12px', fontSize: '13px'}}>
                            <span style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px'}}>
                              🚚 {(pdi.dispatched || 0).toLocaleString()}
                            </span>
                            <span style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px'}}>
                              📦 {(pdi.packed || 0).toLocaleString()}
                            </span>
                            <span style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px'}}>
                              ⏳ {(pdi.dispatch_pending || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Dispatched Pallets */}
                        {dispPallets.length > 0 && (
                          <div style={{padding: '12px 16px'}}>
                            <h5 style={{margin: '0 0 8px', fontSize: '13px', color: '#166534', display:'flex', alignItems:'center', gap:'6px'}}>
                              <span style={{width:'10px', height:'10px', borderRadius:'2px', background:'#22c55e', display:'inline-block'}}></span>
                              Dispatched Pallets ({dispPallets.length})
                            </h5>
                            <div className="pallet-table-container">
                              <table className="pallet-table" style={{fontSize: '12px'}}>
                                <thead>
                                  <tr style={{background: '#dcfce7'}}>
                                    <th>Pallet No</th>
                                    <th>Modules</th>
                                    <th>Vehicle No</th>
                                    <th>Dispatch Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dispPallets.map((pg, i) => (
                                    <tr key={i}>
                                      <td><strong>{pg.pallet_no}</strong></td>
                                      <td>{pg.count}</td>
                                      <td style={{fontSize: '11px'}}>{pg.dispatch_party || pg.vehicle_no || '—'}</td>
                                      <td>{pg.date || pg.dispatch_date || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Packed Pallets */}
                        {packPallets.length > 0 && (
                          <div style={{padding: '12px 16px', borderTop: dispPallets.length > 0 ? '1px solid #e2e8f0' : 'none'}}>
                            <h5 style={{margin: '0 0 8px', fontSize: '13px', color: '#854d0e', display:'flex', alignItems:'center', gap:'6px'}}>
                              <span style={{width:'10px', height:'10px', borderRadius:'2px', background:'#f59e0b', display:'inline-block'}}></span>
                              Packed Pallets — Awaiting Dispatch ({packPallets.length})
                            </h5>
                            <div className="pallet-table-container">
                              <table className="pallet-table" style={{fontSize: '12px'}}>
                                <thead>
                                  <tr style={{background: '#fef9c3'}}>
                                    <th>Pallet No</th>
                                    <th>Modules</th>
                                    <th>Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {packPallets.map((pg, i) => (
                                    <tr key={i}>
                                      <td><strong>{pg.pallet_no}</strong></td>
                                      <td>{pg.count}</td>
                                      <td>{pg.date || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Not Packed */}
                        {(pdi.dispatch_pending || 0) > 0 && (
                          <div style={{padding: '10px 16px', background: '#fef2f2', borderTop: '1px solid #fecaca', fontSize: '13px', color: '#991b1b'}}>
                            ⏳ <strong>{pdi.dispatch_pending.toLocaleString()}</strong> modules not packed yet
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {pdiWise.length === 0 && (
                <div className="section">
                  <div className="pending-summary">
                    <div className="pending-count">No PDI data found</div>
                    <p>No production records or FTR assignments found for this company</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Serial Detail Modal */}
      {serialModal && (
        <div className="modal-overlay" onClick={() => setSerialModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px', maxHeight: '80vh', overflow: 'auto'}}>
            <div className="modal-header">
              <h2>{serialModal.title}</h2>
              <button className="close-btn" onClick={() => setSerialModal(null)}>✕</button>
            </div>
            <div style={{padding: '16px'}}>
              {/* Export button in modal */}
              <div style={{marginBottom: '12px', display: 'flex', justifyContent: 'flex-end'}}>
                <button 
                  onClick={() => {
                    const data = serialModal.serials.map((s, i) => ({
                      'S.No': i + 1,
                      'Serial Number': s.serial,
                      'Pallet No': s.pallet_no || '',
                      'Status': serialModal.type === 'dispatched' ? 'Dispatched' : serialModal.type === 'packed' ? 'Packed' : 'Not Packed'
                    }));
                    const ws = XLSX.utils.json_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Serials');
                    XLSX.writeFile(wb, `${serialModal.title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
                  }}
                  style={{padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600}}
                >
                  📥 Export to Excel
                </button>
              </div>
              {serialModal.serials.length > 0 ? (
                <table className="pallet-table" style={{fontSize: '12px'}}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Barcode / Serial</th>
                      <th>Pallet No</th>
                      {serialModal.type === 'dispatched' && <th>Vehicle No</th>}
                      {serialModal.type !== 'not_packed' && <th>Date</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {serialModal.serials.map((s, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td style={{fontFamily: 'monospace', fontSize: '11px'}}>{s.serial}</td>
                        <td><span className="badge" style={{background:'#e0e7ff', color:'#3730a3', fontSize:'10px'}}>{s.pallet_no || '—'}</span></td>
                        {serialModal.type === 'dispatched' && <td style={{fontSize: '11px'}}>{s.dispatch_party || '—'}</td>}
                        {serialModal.type !== 'not_packed' && <td style={{fontSize: '11px'}}>{s.date || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{textAlign: 'center', color: '#999'}}>No serial details available</p>
              )}
              {serialModal.serials.length >= 500 && (
                <p style={{textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '10px'}}>
                  Showing first 500 of total serials
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Company Modal */}
      {showNewCompanyModal && (
        <div className="modal-overlay" onClick={() => setShowNewCompanyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add New Company</h2>
              <button className="close-btn" onClick={() => setShowNewCompanyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCompany}>
              <div className="form-group">
                <label>Company Name *</label>
                <input type="text" value={newCompanyData.companyName} onChange={(e) => setNewCompanyData({...newCompanyData, companyName: e.target.value})} placeholder="e.g., Larsen & Toubro" required />
              </div>
              <div className="form-group">
                <label>Module Wattage (W) *</label>
                <input type="number" value={newCompanyData.moduleWattage} onChange={(e) => setNewCompanyData({...newCompanyData, moduleWattage: e.target.value})} placeholder="e.g., 630" required />
              </div>
              <div className="form-group">
                <label>Cells per Module *</label>
                <input type="number" value={newCompanyData.cellsPerModule} onChange={(e) => setNewCompanyData({...newCompanyData, cellsPerModule: e.target.value})} placeholder="e.g., 66" required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowNewCompanyModal(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Creating...' : 'Create Company'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchTracker;
