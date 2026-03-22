import React, { useState, useEffect } from 'react';
import { companyService } from '../services/apiService';
import '../styles/DispatchTracker.css';
import * as XLSX from 'xlsx';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5003/api' 
  : '/api';

// Main party groups — each main party has sub-parties in MRP
const MAIN_PARTY_GROUPS = {
  'RAYS POWER INFRA PRIVATE LIMITED': {
    label: 'Rays Power',
    subParties: ['RAYS POWER INFRA PRIVATE LIMITED', 'Rays', 'Rays-NTPC', 'Rays-NTPC-Barethi']
  },
  'STERLING AND WILSON RENEWABLE ENERGY LIMITED': {
    label: 'Sterling & Wilson',
    subParties: ['STERLING AND WILSON RENEWABLE ENERGY LIMITED', 'S&W - NTPC', 'S&W']
  },
  'LARSEN & TOUBRO LIMITED, CONSTRUCTION': {
    label: 'Larsen & Toubro',
    subParties: ['LARSEN & TOUBRO LIMITED, CONSTRUCTION', 'L&T']
  }
};

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
  const [selectedMainParty, setSelectedMainParty] = useState('all');
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
      
      // Add timestamp to prevent browser caching
      const timestamp = Date.now();
      const url = `${API_BASE_URL}/ftr/pdi-production-status/${company.id}?t=${timestamp}`;
      
      console.log('Fetching URL:', url);
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
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
    
    // PDI-wise serials
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

    // Extra Packed — packed but not in any PDI
    if (type === 'packed' || type === 'all') {
      const ep = productionData?.extra_packed || {};
      (ep.serials || []).forEach(s => {
        allSerials.push({
          'PDI Number': 'Extra (No PDI)',
          'Serial Number': s.serial,
          'Status': 'Extra Packed',
          'Pallet No': s.pallet_no || '',
          'Dispatch Party': s.party_name || s.sub_party || '',
          'Date': ''
        });
      });
    }

    // Extra Dispatched — dispatched but not in any PDI
    if (type === 'dispatched' || type === 'all') {
      const ed = productionData?.extra_dispatched || {};
      (ed.serials || []).forEach(s => {
        allSerials.push({
          'PDI Number': 'Extra (No PDI)',
          'Serial Number': s.serial,
          'Status': 'Extra Dispatched',
          'Pallet No': s.pallet_no || '',
          'Dispatch Party': s.dispatch_party || s.sub_party || '',
          'Date': s.date || ''
        });
      });
    }
    
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
  const extraDispatched = productionData?.extra_dispatched || { count: 0, serials: [], pallet_groups: [] };
  const extraPacked = productionData?.extra_packed || { count: 0, serials: [], pallet_groups: [] };

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

              {/* Last Refresh Time Indicator */}
              {productionData?.debug_info?.last_refresh_time && (
                <div style={{
                  background: '#dcfce7', 
                  border: '1px solid #22c55e',
                  borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <span style={{marginRight: '8px'}}>🕐</span>
                    <strong>Data Refresh:</strong> {productionData.debug_info.server_current_time || productionData.debug_info.last_refresh_time}
                    <span style={{marginLeft: '8px', color: '#16a34a', fontWeight: 600}}>— LIVE Data</span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <span style={{fontSize: '11px', color: '#16a34a'}}>✅ LIVE API</span>
                    <button
                      onClick={() => loadProductionData(selectedCompany)}
                      disabled={loading}
                      style={{
                        padding: '6px 12px', 
                        background: '#2563eb', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      🔄 Refresh Now
                    </button>
                  </div>
                </div>
              )}

              {/* DEBUG INFO - Serial Matching Status */}
              {productionData?.debug_info && (
                <div style={{background: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#0369a1'}}>
                  <strong>🔍 Debug Info (Serial Matching):</strong>
                  <div style={{marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px'}}>
                    <div>MRP Barcodes: <strong>{productionData.debug_info.mrp_barcodes_total || productionData.debug_info.live_dispatch_count || 0}</strong></div>
                    <div>Local Serials: <strong>{productionData.debug_info.local_serials_total || 0}</strong></div>
                    <div style={{color: (productionData.debug_info.dispatch_matches || 0) > 0 ? '#16a34a' : '#dc2626'}}>
                      Matches: <strong>{productionData.debug_info.dispatch_matches || 0}</strong>
                    </div>
                  </div>
                  {(productionData.debug_info.sample_mrp_barcodes?.length > 0 || productionData.debug_info.sample_local_serials?.length > 0) && (
                    <div style={{marginTop: '8px'}}>
                      <div>Sample MRP: <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'}}>{productionData.debug_info.sample_mrp_barcodes?.[0] || 'N/A'}</code></div>
                      <div>Sample Local: <code style={{background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'}}>{productionData.debug_info.sample_local_serials?.[0] || 'N/A'}</code></div>
                    </div>
                  )}
                  <div style={{marginTop: '8px', color: '#6b7280', fontSize: '11px'}}>
                    Packed API: <strong>{productionData.debug_info.live_packed_count || 0}</strong> | 
                    Packed Matches: <strong>{productionData.debug_info.packed_matches || 0}</strong>
                  </div>
                  {productionData.debug_info.party_fetch_counts && Object.keys(productionData.debug_info.party_fetch_counts).length > 0 && (
                    <div style={{marginTop: '8px', borderTop: '1px solid #bae6fd', paddingTop: '8px'}}>
                      <strong style={{color: '#0369a1'}}>📋 Party-wise Packing Data:</strong>
                      <div style={{marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                        {Object.entries(productionData.debug_info.party_fetch_counts).map(([party, count]) => (
                          <span key={party} style={{background: count > 0 ? '#dcfce7' : '#fee2e2', border: `1px solid ${count > 0 ? '#86efac' : '#fca5a5'}`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', color: count > 0 ? '#166534' : '#991b1b'}}>
                            {party}: <strong>{count.toLocaleString()}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Party-wise Data Breakdown */}
              {(() => {
                const packingParties = {};
                const dispatchParties = {};
                pdiWise.forEach(pdi => {
                  (pdi.packed_serials || []).forEach(s => {
                    const name = s.sub_party || s.party_name || 'Unknown';
                    packingParties[name] = (packingParties[name] || 0) + 1;
                  });
                  (pdi.dispatched_serials || []).forEach(s => {
                    const name = s.dispatch_party || s.sub_party || s.party_name || 'Unknown';
                    dispatchParties[name] = (dispatchParties[name] || 0) + 1;
                  });
                });
                (extraPacked?.serials || []).forEach(s => {
                  const name = s.sub_party || s.party_name || 'Unknown';
                  packingParties[name] = (packingParties[name] || 0) + 1;
                });
                (extraDispatched?.serials || []).forEach(s => {
                  const name = s.dispatch_party || s.sub_party || s.party_name || 'Unknown';
                  dispatchParties[name] = (dispatchParties[name] || 0) + 1;
                });

                const hasPackingData = Object.keys(packingParties).length > 0;
                const hasDispatchData = Object.keys(dispatchParties).length > 0;

                if (!hasPackingData && !hasDispatchData) return null;

                return (
                  <div style={{background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px'}}>
                    <strong style={{color: '#166534'}}>📊 Data kis party se aa raha hai:</strong>
                    <div style={{display: 'grid', gridTemplateColumns: hasPackingData && hasDispatchData ? '1fr 1fr' : '1fr', gap: '16px', marginTop: '10px'}}>
                      {hasPackingData && (
                        <div>
                          <div style={{fontWeight: 600, color: '#854d0e', marginBottom: '6px', fontSize: '12px'}}>📦 Packing Data:</div>
                          {Object.entries(packingParties).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                            <div key={name} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', marginBottom: '3px', background: '#fefce8', borderRadius: '6px', border: '1px solid #fde68a'}}>
                              <span style={{fontSize: '11px', color: '#78350f'}}>{name}</span>
                              <span style={{fontWeight: 700, color: '#d97706', fontSize: '12px'}}>{count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasDispatchData && (
                        <div>
                          <div style={{fontWeight: 600, color: '#166534', marginBottom: '6px', fontSize: '12px'}}>🚚 Dispatch Data:</div>
                          {Object.entries(dispatchParties).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                            <div key={name} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', marginBottom: '3px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0'}}>
                              <span style={{fontSize: '11px', color: '#065f46'}}>{name}</span>
                              <span style={{fontWeight: 700, color: '#16a34a', fontSize: '12px'}}>{count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                    <div className="stat-label">FTR Assigned</div>
                    <div className="stat-value">{totalFtrAssigned.toLocaleString()}</div>
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
                {extraDispatched.count > 0 && (
                  <div className="stat-card" style={{borderLeft: '4px solid #d946ef', cursor: 'pointer'}} onClick={() => setSerialModal({
                    title: `Extra Dispatched — Not in any PDI (${extraDispatched.count.toLocaleString()})`,
                    serials: extraDispatched.serials || [],
                    type: 'dispatched'
                  })}>
                    <div className="stat-icon">🔀</div>
                    <div className="stat-content">
                      <div className="stat-label">Extra Dispatched</div>
                      <div className="stat-value" style={{color: '#d946ef'}}>{extraDispatched.count.toLocaleString()}</div>
                      <div className="stat-sub">Dispatched but not in any PDI</div>
                    </div>
                  </div>
                )}
                {extraPacked.count > 0 && (
                  <div className="stat-card" style={{borderLeft: '4px solid #06b6d4', cursor: 'pointer'}} onClick={() => setSerialModal({
                    title: `Extra Packed — Not in any PDI (${extraPacked.count.toLocaleString()})`,
                    serials: extraPacked.serials || [],
                    type: 'packed'
                  })}>
                    <div className="stat-icon">📦</div>
                    <div className="stat-content">
                      <div className="stat-label">Extra Packed</div>
                      <div className="stat-value" style={{color: '#06b6d4'}}>{extraPacked.count.toLocaleString()}</div>
                      <div className="stat-sub">Packed but not in any PDI</div>
                    </div>
                  </div>
                )}
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
                <button 
                  className={`tab-btn ${activeTab === 'modulepack' ? 'active' : ''}`}
                  onClick={() => setActiveTab('modulepack')}
                >
                  📦 Module Pack
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
                        {/* Extra Dispatched Row */}
                        {extraDispatched.count > 0 && (
                          <tr style={{background: '#fdf4ff', borderTop: '2px dashed #d946ef'}}>
                            <td style={{color: '#d946ef', fontWeight: 700}}>🔀</td>
                            <td style={{fontWeight: 700, color: '#a21caf'}}>EXTRA DISPATCHED</td>
                            <td colSpan="2" style={{fontSize: '11px', color: '#a21caf'}}>Not in any PDI</td>
                            <td>
                              <span className="badge clickable-badge" style={{background:'#f5d0fe', color:'#86198f', cursor: 'pointer', fontWeight: 700}} onClick={() => setSerialModal({
                                title: `Extra Dispatched — Not in any PDI (${extraDispatched.count.toLocaleString()})`,
                                serials: extraDispatched.serials || [],
                                type: 'dispatched'
                              })}>{extraDispatched.count.toLocaleString()}</span>
                            </td>
                            <td colSpan="2" style={{fontSize: '11px', color: '#a21caf'}}>
                              {(extraDispatched.pallet_groups || []).length} pallets
                            </td>
                            <td>
                              {(extraDispatched.pallet_groups || []).length > 0 ? (
                                <span className="badge clickable-badge" style={{background:'#f5d0fe', color:'#86198f', cursor:'pointer'}} onClick={() => togglePdiExpand('__extra__')}>
                                  {(extraDispatched.pallet_groups || []).length} pallets {expandedPdi === '__extra__' ? '▲' : '▼'}
                                </span>
                              ) : <span style={{color:'#ccc'}}>—</span>}
                            </td>
                            <td></td>
                          </tr>
                        )}
                        {/* Expanded Extra Dispatched Pallet Detail */}
                        {expandedPdi === '__extra__' && (extraDispatched.pallet_groups || []).length > 0 && (
                          <tr>
                            <td colSpan="9" style={{padding: 0, background: '#fdf4ff'}}>
                              <div style={{padding: '12px 20px'}}>
                                <h4 style={{margin: '0 0 10px', fontSize: '13px', color: '#86198f'}}>
                                  🔀 Extra Dispatched Pallet Details ({(extraDispatched.pallet_groups || []).length} pallets, {extraDispatched.count.toLocaleString()} serials)
                                </h4>
                                <table className="pallet-table" style={{fontSize: '12px', margin: 0}}>
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Pallet No</th>
                                      <th>Status</th>
                                      <th>Modules</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(extraDispatched.pallet_groups || []).map((pg, pi) => (
                                      <tr key={pi}>
                                        <td>{pi + 1}</td>
                                        <td><strong>{pg.pallet_no}</strong></td>
                                        <td>
                                          <span className="badge" style={{background: '#f5d0fe', color: '#86198f', fontSize: '11px'}}>
                                            🔀 Extra Dispatched
                                          </span>
                                        </td>
                                        <td><strong>{pg.count}</strong></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Extra Packed Row */}
                        {extraPacked.count > 0 && (
                          <tr style={{background: '#ecfeff', borderTop: '2px dashed #06b6d4'}}>
                            <td style={{color: '#06b6d4', fontWeight: 700}}>📦</td>
                            <td style={{fontWeight: 700, color: '#0e7490'}}>EXTRA PACKED</td>
                            <td colSpan="2" style={{fontSize: '11px', color: '#0e7490'}}>Not in any PDI</td>
                            <td></td>
                            <td>
                              <span className="badge clickable-badge" style={{background:'#a5f3fc', color:'#0e7490', cursor: 'pointer', fontWeight: 700}} onClick={() => setSerialModal({
                                title: `Extra Packed — Not in any PDI (${extraPacked.count.toLocaleString()})`,
                                serials: extraPacked.serials || [],
                                type: 'packed'
                              })}>{extraPacked.count.toLocaleString()}</span>
                            </td>
                            <td colSpan="1" style={{fontSize: '11px', color: '#0e7490'}}>
                              {(extraPacked.pallet_groups || []).length} pallets
                            </td>
                            <td>
                              {(extraPacked.pallet_groups || []).length > 0 ? (
                                <span className="badge clickable-badge" style={{background:'#a5f3fc', color:'#0e7490', cursor:'pointer'}} onClick={() => togglePdiExpand('__extra_packed__')}>
                                  {(extraPacked.pallet_groups || []).length} pallets {expandedPdi === '__extra_packed__' ? '▲' : '▼'}
                                </span>
                              ) : <span style={{color:'#ccc'}}>—</span>}
                            </td>
                            <td></td>
                          </tr>
                        )}
                        {/* Expanded Extra Packed Pallet Detail */}
                        {expandedPdi === '__extra_packed__' && (extraPacked.pallet_groups || []).length > 0 && (
                          <tr>
                            <td colSpan="9" style={{padding: 0, background: '#ecfeff'}}>
                              <div style={{padding: '12px 20px'}}>
                                <h4 style={{margin: '0 0 10px', fontSize: '13px', color: '#0e7490'}}>
                                  📦 Extra Packed Pallet Details ({(extraPacked.pallet_groups || []).length} pallets, {extraPacked.count.toLocaleString()} serials)
                                </h4>
                                <table className="pallet-table" style={{fontSize: '12px', margin: 0}}>
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Pallet No</th>
                                      <th>Status</th>
                                      <th>Modules</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(extraPacked.pallet_groups || []).map((pg, pi) => (
                                      <tr key={pi}>
                                        <td>{pi + 1}</td>
                                        <td><strong>{pg.pallet_no}</strong></td>
                                        <td>
                                          <span className="badge" style={{background: '#a5f3fc', color: '#0e7490', fontSize: '11px'}}>
                                            📦 Extra Packed
                                          </span>
                                        </td>
                                        <td><strong>{pg.count}</strong></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
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

              {/* ==================== TAB 3: Module Pack ==================== */}
              {activeTab === 'modulepack' && (() => {
                // Detect which main parties have data (from sub_party field)
                const detectedMainParties = new Set();
                pdiWise.forEach(pdi => {
                  [...(pdi.dispatched_serials || []), ...(pdi.packed_serials || [])].forEach(s => {
                    const sp = s.sub_party || s.party_name || '';
                    if (sp) {
                      for (const [mainKey, group] of Object.entries(MAIN_PARTY_GROUPS)) {
                        if (group.subParties.some(sub => sub.toLowerCase() === sp.toLowerCase())) {
                          detectedMainParties.add(mainKey);
                        }
                      }
                    }
                  });
                });

                // Filter helper: check if a sub_party belongs to selected main party
                const matchesMainParty = (subParty) => {
                  if (selectedMainParty === 'all') return true;
                  const group = MAIN_PARTY_GROUPS[selectedMainParty];
                  if (!group) return true;
                  return group.subParties.some(sub => sub.toLowerCase() === (subParty || '').toLowerCase());
                };

                // Consolidate all packing data across PDIs
                const allPallets = {}; // pallet_no -> {pdi, count, serials, status, dispatch_party, vehicle_no, date}
                const pdiPackSummary = []; // [{pdi_number, total_packed, total_dispatched, total_not_packed, pallets}]

                pdiWise.forEach(pdi => {
                  let pdiPacked = 0;
                  let pdiDispatched = 0;
                  let pdiNotPacked = 0;
                  const pdiPalletSet = new Set();

                  // From dispatched serials (packed + dispatched)
                  (pdi.dispatched_serials || []).forEach(s => {
                    if (!matchesMainParty(s.sub_party)) return;
                    pdiDispatched++;
                    const palletNo = s.pallet_no || 'Unknown';
                    pdiPalletSet.add(palletNo);
                    if (!allPallets[palletNo]) {
                      allPallets[palletNo] = { pallet_no: palletNo, pdi_list: new Set(), count: 0, serials: [], status: 'Dispatched', dispatch_party: s.dispatch_party || '', vehicle_no: s.vehicle_no || '', date: s.date || '', sub_party: s.sub_party || '' };
                    }
                    allPallets[palletNo].pdi_list.add(pdi.pdi_number);
                    allPallets[palletNo].count++;
                    if (allPallets[palletNo].serials.length < 20) allPallets[palletNo].serials.push(s.serial);
                    if (allPallets[palletNo].status !== 'Dispatched') allPallets[palletNo].status = 'Dispatched';
                    if (!allPallets[palletNo].dispatch_party && s.dispatch_party) allPallets[palletNo].dispatch_party = s.dispatch_party;
                    if (!allPallets[palletNo].vehicle_no && s.vehicle_no) allPallets[palletNo].vehicle_no = s.vehicle_no;
                    if (!allPallets[palletNo].date && s.date) allPallets[palletNo].date = s.date;
                    if (!allPallets[palletNo].sub_party && s.sub_party) allPallets[palletNo].sub_party = s.sub_party;
                  });

                  // From packed serials (packed only, not dispatched)
                  (pdi.packed_serials || []).forEach(s => {
                    if (!matchesMainParty(s.sub_party || s.party_name)) return;
                    pdiPacked++;
                    const palletNo = s.pallet_no || 'Unknown';
                    pdiPalletSet.add(palletNo);
                    if (!allPallets[palletNo]) {
                      allPallets[palletNo] = { pallet_no: palletNo, pdi_list: new Set(), count: 0, serials: [], status: 'Packed', dispatch_party: '', vehicle_no: '', date: '', sub_party: s.sub_party || s.party_name || '' };
                    }
                    allPallets[palletNo].pdi_list.add(pdi.pdi_number);
                    allPallets[palletNo].count++;
                    if (allPallets[palletNo].serials.length < 20) allPallets[palletNo].serials.push(s.serial);
                  });

                  // Not packed count
                  pdiNotPacked = pdi.not_packed || pdi.dispatch_pending || 0;

                  pdiPackSummary.push({
                    pdi_number: pdi.pdi_number,
                    total_packed: pdiPacked,
                    total_dispatched: pdiDispatched,
                    total_not_packed: pdiNotPacked,
                    total_modules: pdiPacked + pdiDispatched + pdiNotPacked,
                    pallets: pdiPalletSet.size
                  });
                });

                // Convert to sorted array
                const palletList = Object.values(allPallets).map(p => ({ ...p, pdi_list: Array.from(p.pdi_list) }));
                palletList.sort((a, b) => {
                  const aNum = parseInt(a.pallet_no) || 0;
                  const bNum = parseInt(b.pallet_no) || 0;
                  return aNum - bNum || a.pallet_no.localeCompare(b.pallet_no);
                });

                const totalAllPacked = palletList.filter(p => p.status === 'Packed').reduce((sum, p) => sum + p.count, 0);
                const totalAllDispatched = palletList.filter(p => p.status === 'Dispatched').reduce((sum, p) => sum + p.count, 0);
                const totalAllModules = palletList.reduce((sum, p) => sum + p.count, 0);
                const dispatchedPallets = palletList.filter(p => p.status === 'Dispatched');
                const packedPallets = palletList.filter(p => p.status === 'Packed');

                return (
                  <div className="section">
                    <h3>📦 Module Pack — Consolidated View</h3>
                    <p style={{fontSize: '13px', color: '#64748b', marginBottom: '8px'}}>All PDI packing & dispatch data in one place</p>

                    {/* Main Party Filter Dropdown */}
                    {detectedMainParties.size > 0 && (
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0'}}>
                        <label style={{fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap'}}>🏢 Main Party:</label>
                        <select
                          value={selectedMainParty}
                          onChange={(e) => setSelectedMainParty(e.target.value)}
                          style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 500, background: '#fff', cursor: 'pointer', minWidth: '220px'}}
                        >
                          <option value="all">All Parties (Combined)</option>
                          {Array.from(detectedMainParties).map(mainKey => (
                            <option key={mainKey} value={mainKey}>
                              {MAIN_PARTY_GROUPS[mainKey].label} — ({MAIN_PARTY_GROUPS[mainKey].subParties.join(', ')})
                            </option>
                          ))}
                        </select>
                        {selectedMainParty !== 'all' && (
                          <span style={{fontSize: '11px', color: '#6366f1', background: '#eef2ff', padding: '3px 8px', borderRadius: '6px', fontWeight: 500}}>
                            Showing: {MAIN_PARTY_GROUPS[selectedMainParty]?.subParties.join(' + ')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Module Pack Summary Cards */}
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px'}}>
                      <div style={{background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px', textAlign: 'center'}}>
                        <div style={{fontSize: '12px', color: '#166534', fontWeight: 600}}>Total Modules in Pallets</div>
                        <div style={{fontSize: '28px', fontWeight: 700, color: '#15803d'}}>{totalAllModules.toLocaleString()}</div>
                      </div>
                      <div style={{background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px', textAlign: 'center'}}>
                        <div style={{fontSize: '12px', color: '#1e40af', fontWeight: 600}}>Total Pallets</div>
                        <div style={{fontSize: '28px', fontWeight: 700, color: '#2563eb'}}>{palletList.length}</div>
                      </div>
                      <div style={{background: '#dcfce7', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 16px', textAlign: 'center'}}>
                        <div style={{fontSize: '12px', color: '#166534', fontWeight: 600}}>🚚 Dispatched</div>
                        <div style={{fontSize: '28px', fontWeight: 700, color: '#16a34a'}}>{totalAllDispatched.toLocaleString()}</div>
                        <div style={{fontSize: '11px', color: '#15803d'}}>{dispatchedPallets.length} pallets</div>
                      </div>
                      <div style={{background: '#fef9c3', border: '1px solid #fde047', borderRadius: '10px', padding: '14px 16px', textAlign: 'center'}}>
                        <div style={{fontSize: '12px', color: '#854d0e', fontWeight: 600}}>📦 Packed Only</div>
                        <div style={{fontSize: '28px', fontWeight: 700, color: '#d97706'}}>{totalAllPacked.toLocaleString()}</div>
                        <div style={{fontSize: '11px', color: '#92400e'}}>{packedPallets.length} pallets</div>
                      </div>
                      <div style={{background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '14px 16px', textAlign: 'center'}}>
                        <div style={{fontSize: '12px', color: '#991b1b', fontWeight: 600}}>⏳ Not Packed</div>
                        <div style={{fontSize: '28px', fontWeight: 700, color: '#dc2626'}}>{totalDispPending.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* PDI-wise Packing Summary */}
                    <div style={{marginBottom: '24px'}}>
                      <h4 style={{fontSize: '14px', color: '#334155', marginBottom: '10px'}}>📋 PDI-wise Packing Summary</h4>
                      <div className="pallet-table-container">
                        <table className="pallet-table" style={{fontSize: '12px'}}>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>PDI Number</th>
                              <th>Total Modules</th>
                              <th style={{background: '#dcfce7', color: '#166534'}}>Dispatched</th>
                              <th style={{background: '#fef9c3', color: '#854d0e'}}>Packed</th>
                              <th style={{background: '#fee2e2', color: '#991b1b'}}>Not Packed</th>
                              <th>Pallets</th>
                              <th>Pack %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pdiPackSummary.map((pdi, idx) => {
                              const packPct = pdi.total_modules > 0 ? Math.round(((pdi.total_dispatched + pdi.total_packed) / pdi.total_modules) * 100) : 0;
                              return (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td><strong>{pdi.pdi_number}</strong></td>
                                  <td><span className="badge">{pdi.total_modules.toLocaleString()}</span></td>
                                  <td>
                                    {pdi.total_dispatched > 0
                                      ? <span className="badge" style={{background:'#dcfce7', color:'#166534'}}>{pdi.total_dispatched.toLocaleString()}</span>
                                      : <span style={{color: '#ccc'}}>0</span>
                                    }
                                  </td>
                                  <td>
                                    {pdi.total_packed > 0
                                      ? <span className="badge" style={{background:'#fef9c3', color:'#854d0e'}}>{pdi.total_packed.toLocaleString()}</span>
                                      : <span style={{color: '#ccc'}}>0</span>
                                    }
                                  </td>
                                  <td>
                                    {pdi.total_not_packed > 0
                                      ? <span className="badge" style={{background:'#fee2e2', color:'#991b1b'}}>{pdi.total_not_packed.toLocaleString()}</span>
                                      : <span style={{color: '#22c55e', fontWeight: 600}}>✓</span>
                                    }
                                  </td>
                                  <td><span className="badge" style={{background:'#e0e7ff', color:'#3730a3'}}>{pdi.pallets}</span></td>
                                  <td>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                      <div style={{height: '8px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden', display: 'flex', width: '60px'}}>
                                        <div style={{width: `${packPct}%`, background: packPct === 100 ? '#22c55e' : '#f59e0b', transition: 'width 0.3s'}}></div>
                                      </div>
                                      <span style={{fontSize:'11px', fontWeight: 600, color: packPct === 100 ? '#16a34a' : '#d97706'}}>{packPct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Total Row */}
                            <tr style={{fontWeight: 'bold', background: '#f0f7ff', borderTop: '2px solid #2563eb'}}>
                              <td></td>
                              <td>TOTAL</td>
                              <td><span className="badge">{(totalAllDispatched + totalAllPacked + totalDispPending).toLocaleString()}</span></td>
                              <td><span className="badge" style={{background:'#dcfce7', color:'#166534'}}>{totalAllDispatched.toLocaleString()}</span></td>
                              <td><span className="badge" style={{background:'#fef9c3', color:'#854d0e'}}>{totalAllPacked.toLocaleString()}</span></td>
                              <td>{totalDispPending > 0 ? <span className="badge" style={{background:'#fee2e2', color:'#991b1b'}}>{totalDispPending.toLocaleString()}</span> : <span style={{color:'#22c55e'}}>✓</span>}</td>
                              <td><span className="badge" style={{background:'#e0e7ff', color:'#3730a3'}}>{palletList.length}</span></td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Full Pallet Listing */}
                    <div style={{marginBottom: '24px'}}>
                      <h4 style={{fontSize: '14px', color: '#334155', marginBottom: '10px'}}>📦 All Pallets — Complete Listing ({palletList.length} pallets, {totalAllModules.toLocaleString()} modules)</h4>
                      
                      {/* Dispatched Pallets Section */}
                      {dispatchedPallets.length > 0 && (
                        <div style={{marginBottom: '16px'}}>
                          <h5 style={{margin: '0 0 8px', fontSize: '13px', color: '#166534', display:'flex', alignItems:'center', gap:'6px'}}>
                            <span style={{width:'10px', height:'10px', borderRadius:'2px', background:'#22c55e', display:'inline-block'}}></span>
                            🚚 Dispatched Pallets ({dispatchedPallets.length} pallets, {totalAllDispatched.toLocaleString()} modules)
                          </h5>
                          <div className="pallet-table-container">
                            <table className="pallet-table" style={{fontSize: '12px'}}>
                              <thead>
                                <tr style={{background: '#dcfce7'}}>
                                  <th>#</th>
                                  <th>Pallet No</th>
                                  <th>Modules</th>
                                  <th>PDI(s)</th>
                                  <th>Sub Party</th>
                                  <th>Vehicle / Party</th>
                                  <th>Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dispatchedPallets.map((p, i) => (
                                  <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td><strong>{p.pallet_no}</strong></td>
                                    <td><span className="badge" style={{background:'#dcfce7', color:'#166534'}}>{p.count}</span></td>
                                    <td style={{fontSize: '11px'}}>{p.pdi_list.join(', ')}</td>
                                    <td><span className="badge" style={{background: p.sub_party?.includes('NTPC') ? '#fef3c7' : '#e0e7ff', color: p.sub_party?.includes('NTPC') ? '#92400e' : '#3730a3', fontSize: '10px'}}>{p.sub_party || '—'}</span></td>
                                    <td style={{fontSize: '11px'}}>{p.dispatch_party || p.vehicle_no || '—'}</td>
                                    <td style={{fontSize: '11px'}}>{p.date || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Packed Only Pallets Section */}
                      {packedPallets.length > 0 && (
                        <div style={{marginBottom: '16px'}}>
                          <h5 style={{margin: '0 0 8px', fontSize: '13px', color: '#854d0e', display:'flex', alignItems:'center', gap:'6px'}}>
                            <span style={{width:'10px', height:'10px', borderRadius:'2px', background:'#f59e0b', display:'inline-block'}}></span>
                            📦 Packed — Awaiting Dispatch ({packedPallets.length} pallets, {totalAllPacked.toLocaleString()} modules)
                          </h5>
                          <div className="pallet-table-container">
                            <table className="pallet-table" style={{fontSize: '12px'}}>
                              <thead>
                                <tr style={{background: '#fef9c3'}}>
                                  <th>#</th>
                                  <th>Pallet No</th>
                                  <th>Modules</th>
                                  <th>PDI(s)</th>
                                  <th>Sub Party</th>
                                </tr>
                              </thead>
                              <tbody>
                                {packedPallets.map((p, i) => (
                                  <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td><strong>{p.pallet_no}</strong></td>
                                    <td><span className="badge" style={{background:'#fef9c3', color:'#854d0e'}}>{p.count}</span></td>
                                    <td style={{fontSize: '11px'}}>{p.pdi_list.join(', ')}</td>
                                    <td><span className="badge" style={{background: p.sub_party?.includes('NTPC') ? '#fef3c7' : '#e0e7ff', color: p.sub_party?.includes('NTPC') ? '#92400e' : '#3730a3', fontSize: '10px'}}>{p.sub_party || '—'}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Not Packed Summary */}
                      {totalDispPending > 0 && (
                        <div style={{padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '13px', color: '#991b1b'}}>
                          ⏳ <strong>{totalDispPending.toLocaleString()}</strong> modules across all PDIs are not yet packed
                        </div>
                      )}
                    </div>

                    {/* Extra Packed in Module Pack view */}
                    {extraPacked.count > 0 && (
                      <div style={{marginBottom: '16px', border: '2px dashed #06b6d4', borderRadius: '12px', padding: '16px'}}>
                        <h5 style={{margin: '0 0 10px', fontSize: '13px', color: '#0e7490', display:'flex', alignItems:'center', gap:'6px'}}>
                          📦 Extra Packed — Not in any PDI ({extraPacked.count.toLocaleString()} modules, {(extraPacked.pallet_groups || []).length} pallets)
                        </h5>
                        {(extraPacked.pallet_groups || []).length > 0 && (
                          <div className="pallet-table-container">
                            <table className="pallet-table" style={{fontSize: '12px'}}>
                              <thead>
                                <tr style={{background: '#ecfeff'}}>
                                  <th>#</th>
                                  <th>Pallet No</th>
                                  <th>Modules</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(extraPacked.pallet_groups || []).map((pg, i) => (
                                  <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td><strong>{pg.pallet_no}</strong></td>
                                    <td><span className="badge" style={{background:'#a5f3fc', color:'#0e7490'}}>{pg.count}</span></td>
                                    <td><span className="badge" style={{background:'#a5f3fc', color:'#0e7490', fontSize:'11px'}}>📦 Extra Packed</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Extra Dispatched in Module Pack view */}
                    {extraDispatched.count > 0 && (
                      <div style={{marginBottom: '16px', border: '2px dashed #d946ef', borderRadius: '12px', padding: '16px'}}>
                        <h5 style={{margin: '0 0 10px', fontSize: '13px', color: '#a21caf', display:'flex', alignItems:'center', gap:'6px'}}>
                          🔀 Extra Dispatched — Not in any PDI ({extraDispatched.count.toLocaleString()} modules, {(extraDispatched.pallet_groups || []).length} pallets)
                        </h5>
                        {(extraDispatched.pallet_groups || []).length > 0 && (
                          <div className="pallet-table-container">
                            <table className="pallet-table" style={{fontSize: '12px'}}>
                              <thead>
                                <tr style={{background: '#fdf4ff'}}>
                                  <th>#</th>
                                  <th>Pallet No</th>
                                  <th>Modules</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(extraDispatched.pallet_groups || []).map((pg, i) => (
                                  <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td><strong>{pg.pallet_no}</strong></td>
                                    <td><span className="badge" style={{background:'#f5d0fe', color:'#86198f'}}>{pg.count}</span></td>
                                    <td><span className="badge" style={{background:'#f5d0fe', color:'#86198f', fontSize:'11px'}}>🔀 Extra Dispatched</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

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
                    const data = serialModal.serials.map((s, i) => {
                      const row = {
                        'S.No': i + 1,
                        'Serial Number': s.serial,
                        'Pallet No': s.pallet_no || ''
                      };
                      if (serialModal.type === 'dispatched') {
                        row['Vehicle No'] = s.vehicle_no || '';
                        row['Dispatch Party'] = s.dispatch_party || '';
                      }
                      if (serialModal.type === 'packed') {
                        row['Party'] = s.party_name || '';
                      }
                      row['Status'] = serialModal.type === 'dispatched' ? 'Dispatched' : serialModal.type === 'packed' ? 'Packed' : 'Not Packed';
                      if (s.sub_party || s.party_name) {
                        row['Sub Party'] = s.sub_party || s.party_name || '';
                      }
                      if (s.date && serialModal.type !== 'not_packed') {
                        row['Date'] = s.date;
                      }
                      return row;
                    });
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
                      {serialModal.type === 'packed' && <th>Party</th>}
                      {serialModal.type !== 'not_packed' && <th>Sub Party</th>}
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
                        {serialModal.type === 'packed' && <td style={{fontSize: '11px'}}>{s.party_name || '—'}</td>}
                        {serialModal.type !== 'not_packed' && <td><span className="badge" style={{background: (s.sub_party || s.party_name || '')?.includes('NTPC') ? '#fef3c7' : '#e0e7ff', color: (s.sub_party || s.party_name || '')?.includes('NTPC') ? '#92400e' : '#3730a3', fontSize:'10px'}}>{s.sub_party || s.party_name || '—'}</span></td>}
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
