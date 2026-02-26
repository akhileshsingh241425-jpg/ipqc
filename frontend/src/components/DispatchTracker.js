import React, { useState, useEffect } from 'react';
import { companyService } from '../services/apiService';
import '../styles/DispatchTracker.css';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5003/api' 
  : '/api';

const DispatchTracker = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [productionData, setProductionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
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
      
      const res = await fetch(`${API_BASE_URL}/ftr/pdi-production-status/${company.id}`);
      const result = await res.json();
      console.log('PDI Production Status:', result);
      
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

  const handleCompanySelect = (companyId) => {
    if (!companyId) {
      setSelectedCompany(null);
      setProductionData(null);
      return;
    }
    const company = companies.find(c => c.id === parseInt(companyId));
    if (company) {
      setSelectedCompany(company);
      loadProductionData(company);
    }
  };

  const summary = productionData?.summary || {};
  const pdiWise = productionData?.pdi_wise || [];
  const totalProduced = summary.total_produced || 0;
  const totalPlanned = summary.total_planned || 0;
  const totalPending = summary.total_pending || 0;
  const totalFtrAssigned = summary.total_ftr_assigned || 0;

  return (
    <div className="dispatch-tracker">
      {/* Header */}
      <div className="dispatch-header">
        <div>
          <h1>🏭 PDI Production Dashboard</h1>
          <p>PDI-wise production status — kitne ban gaye, kitne pending</p>
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
              <div className="empty-icon">🏭</div>
              <h3>Select a Company</h3>
              <p>Choose a company to view PDI-wise production status</p>
            </div>
          ) : loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading production data...</p>
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
                  <button onClick={() => loadProductionData(selectedCompany)} className="refresh-btn">🔄 Refresh</button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="summary-grid">
                <div className="stat-card dispatched">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Produced</div>
                    <div className="stat-value">{totalProduced.toLocaleString()}</div>
                    <div className="stat-percent">{summary.progress || 0}% complete</div>
                  </div>
                </div>
                <div className="stat-card pallets">
                  <div className="stat-icon">🔬</div>
                  <div className="stat-content">
                    <div className="stat-label">FTR Tested</div>
                    <div className="stat-value">{(productionData?.total_ftr_ok || 0).toLocaleString()}</div>
                    <div className="stat-sub">OK: {(productionData?.total_ftr_ok || 0).toLocaleString()} | Rejected: {(productionData?.total_rejected || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="stat-card remaining">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-content">
                    <div className="stat-label">Pending</div>
                    <div className="stat-value">{totalPending.toLocaleString()}</div>
                    <div className="stat-sub">{totalPlanned > 0 ? `of ${totalPlanned.toLocaleString()} planned` : 'No planned qty set'}</div>
                  </div>
                </div>
                <div className="stat-card total">
                  <div className="stat-icon">📋</div>
                  <div className="stat-content">
                    <div className="stat-label">{totalPlanned > 0 ? 'Total Order Qty' : 'FTR Assigned'}</div>
                    <div className="stat-value">{(totalPlanned > 0 ? totalPlanned : totalFtrAssigned).toLocaleString()}</div>
                    <div className="stat-sub">
                      {productionData?.total_available > 0 
                        ? `${productionData.total_available.toLocaleString()} available (unassigned)` 
                        : 'All assigned to PDIs'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Progress Bar */}
              {totalPlanned > 0 && (
                <div className="section" style={{marginBottom: '20px'}}>
                  <div className="progress-bar-container" style={{maxWidth: '100%'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                      <span style={{fontSize: '13px', fontWeight: 600, color: '#334155'}}>Overall Progress</span>
                      <span style={{fontSize: '13px', fontWeight: 600, color: '#2563eb'}}>{summary.progress || 0}%</span>
                    </div>
                    <div className="progress-bar" style={{height: '16px', borderRadius: '8px'}}>
                      <div className="progress-dispatched" style={{width: `${summary.progress || 0}%`, borderRadius: '8px'}}></div>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: '#64748b'}}>
                      <span>{totalProduced.toLocaleString()} produced</span>
                      <span>{totalPending.toLocaleString()} remaining</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PDI-wise Production Table */}
              {pdiWise.length > 0 ? (
                <div className="section">
                  <h3>📋 PDI-wise Production Status</h3>
                  <div className="pallet-table-container">
                    <table className="pallet-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>PDI Number</th>
                          <th>Produced</th>
                          <th>FTR Tested</th>
                          <th>{totalPlanned > 0 ? 'Planned' : '—'}</th>
                          <th>Pending</th>
                          <th>Progress</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdiWise.map((pdi, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td className="pdi-number"><strong>{pdi.pdi_number}</strong></td>
                            <td className="module-count">
                              <span className="badge">{pdi.produced.toLocaleString()}</span>
                            </td>
                            <td className="module-count">
                              <span className="badge packed-badge">{pdi.ftr_tested.toLocaleString()}</span>
                            </td>
                            <td>
                              {pdi.planned > 0 
                                ? <strong>{pdi.planned.toLocaleString()}</strong>
                                : <span style={{color: '#999'}}>—</span>
                              }
                            </td>
                            <td className="module-count">
                              {pdi.pending > 0 
                                ? <span className="badge pending-badge">{pdi.pending.toLocaleString()}</span>
                                : <span style={{color: '#22c55e', fontWeight: 600}}>✓ Done</span>
                              }
                            </td>
                            <td>
                              <div className="progress-bar-container">
                                <div className="progress-bar">
                                  <div className="progress-dispatched" style={{width: `${pdi.progress}%`}}></div>
                                </div>
                                <span className="progress-text">{pdi.progress}%</span>
                              </div>
                            </td>
                            <td style={{fontSize: '11px', color: '#64748b'}}>
                              {pdi.start_date && pdi.last_date ? (
                                <>
                                  <div>{pdi.start_date}</div>
                                  <div>→ {pdi.last_date}</div>
                                  <div style={{color: '#94a3b8'}}>{pdi.production_days} days</div>
                                </>
                              ) : pdi.assigned_date ? (
                                <div>Assigned: {pdi.assigned_date}</div>
                              ) : (
                                <span style={{color: '#999'}}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {/* Total Row */}
                        <tr style={{fontWeight: 'bold', background: '#f0f7ff'}}>
                          <td></td>
                          <td>TOTAL</td>
                          <td><span className="badge">{totalProduced.toLocaleString()}</span></td>
                          <td><span className="badge packed-badge">{totalFtrAssigned.toLocaleString()}</span></td>
                          <td>{totalPlanned > 0 ? <strong>{totalPlanned.toLocaleString()}</strong> : '—'}</td>
                          <td>{totalPending > 0 ? <span className="badge pending-badge">{totalPending.toLocaleString()}</span> : <span style={{color: '#22c55e'}}>✓</span>}</td>
                          <td>
                            <div className="progress-bar-container">
                              <div className="progress-bar">
                                <div className="progress-dispatched" style={{width: `${summary.progress || 0}%`}}></div>
                              </div>
                              <span className="progress-text">{summary.progress || 0}%</span>
                            </div>
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
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

      {/* New Company Modal */}
      {showNewCompanyModal && (
        <div className="modal-overlay" onClick={() => setShowNewCompanyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add New Company</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowNewCompanyModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCompany}>
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  value={newCompanyData.companyName}
                  onChange={(e) => setNewCompanyData({
                    ...newCompanyData,
                    companyName: e.target.value
                  })}
                  placeholder="e.g., Larsen & Toubro"
                  required
                />
              </div>
              <div className="form-group">
                <label>Module Wattage (W) *</label>
                <input
                  type="number"
                  value={newCompanyData.moduleWattage}
                  onChange={(e) => setNewCompanyData({
                    ...newCompanyData,
                    moduleWattage: e.target.value
                  })}
                  placeholder="e.g., 630"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cells per Module *</label>
                <input
                  type="number"
                  value={newCompanyData.cellsPerModule}
                  onChange={(e) => setNewCompanyData({
                    ...newCompanyData,
                    cellsPerModule: e.target.value
                  })}
                  placeholder="e.g., 66"
                  required
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowNewCompanyModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchTracker;
