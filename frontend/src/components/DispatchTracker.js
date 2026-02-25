import React, { useState, useEffect } from 'react';
import { companyService } from '../services/apiService';
import '../styles/DispatchTracker.css';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5003/api' 
  : '/api';

const DispatchTracker = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [dispatchData, setDispatchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    companyName: '',
    moduleWattage: '',
    cellsPerModule: ''
  });

  // Load companies on mount
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await companyService.getAllCompanies();
      console.log('Companies loaded:', data);
      setCompanies(data || []);
    } catch (err) {
      console.error('Error loading companies:', err);
      setCompanies([]);
    }
  };

  const loadDispatchData = async (company) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading dispatch data for company:', company.companyName, 'ID:', company.id);
      
      // Use backend proxy to avoid CORS and get proper company name mapping
      const response = await fetch(`${API_BASE_URL}/ftr/dispatch-tracking/${company.id}`);
      
      const result = await response.json();
      console.log('Dispatch API response:', result);
      
      if (result.success) {
        setDispatchData(result);
      } else {
        setError(result.error || 'No data found for this company');
        setDispatchData(null);
      }
    } catch (err) {
      setError('Error connecting to server. Please try again.');
      console.error('Error loading dispatch data:', err);
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
      setNewCompanyData({
        companyName: '',
        moduleWattage: '',
        cellsPerModule: ''
      });
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
      setDispatchData(null);
      return;
    }
    
    const company = companies.find(c => c.id === parseInt(companyId));
    if (company) {
      setSelectedCompany(company);
      loadDispatchData(company);
    }
  };

  const summary = dispatchData?.summary || {};
  const palletGroups = dispatchData?.pallet_groups || [];
  const dispatchGroups = dispatchData?.dispatch_groups || [];
  const dispatchedModules = summary.dispatched || 0;
  const packedModules = summary.packed || 0;
  const pendingModules = summary.pending || 0;
  const totalModules = summary.total_assigned || 0;

  return (
    <div className="dispatch-tracker">
      {/* Header */}
      <div className="dispatch-header">
        <div>
          <h1>🚚 Dispatch Tracking Dashboard</h1>
          <p>Track packing and dispatch status from MRP</p>
        </div>
      </div>

      {/* Company Dropdown */}
      <div className="company-dropdown-container">
        <div className="dropdown-header">
          <label htmlFor="company-select">Select Company:</label>
          <div className="dropdown-actions">
            <button 
              onClick={loadCompanies} 
              className="refresh-companies-btn"
              title="Refresh companies list"
            >
              🔄 Refresh
            </button>
            <button 
              onClick={() => setShowNewCompanyModal(true)} 
              className="add-company-btn"
            >
              ➕ Add Company
            </button>
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
        {/* Dispatch Details */}
        <div className="dispatch-details-panel">
          {!selectedCompany ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>Select a Company</h3>
              <p>Choose a company from the dropdown above to view dispatch tracking</p>
            </div>
          ) : loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading dispatch data from MRP...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <div className="error-icon">❌</div>
              <h3>Error Loading Data</h3>
              <p>{error}</p>
              <button onClick={() => loadDispatchData(selectedCompany)}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Company Header */}
              <div className="company-header">
                <h2>{selectedCompany.companyName}</h2>
                <button 
                  onClick={() => loadDispatchData(selectedCompany)}
                  className="refresh-btn"
                >
                  🔄 Refresh
                </button>
              </div>

              {/* Summary Cards */}
              <div className="summary-grid">
                <div className="stat-card dispatched">
                  <div className="stat-icon">🚚</div>
                  <div className="stat-content">
                    <div className="stat-label">Dispatched</div>
                    <div className="stat-value">{dispatchedModules.toLocaleString()}</div>
                    <div className="stat-percent">
                      {summary.dispatched_percent || 0}% of total
                    </div>
                  </div>
                </div>

                <div className="stat-card pallets">
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <div className="stat-label">Packed (Ready)</div>
                    <div className="stat-value">{packedModules.toLocaleString()}</div>
                    <div className="stat-percent">
                      {summary.packed_percent || 0}% of total
                    </div>
                  </div>
                </div>

                <div className="stat-card remaining">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-content">
                    <div className="stat-label">Pending</div>
                    <div className="stat-value">{pendingModules.toLocaleString()}</div>
                    <div className="stat-percent">
                      {summary.pending_percent || 0}% of total
                    </div>
                  </div>
                </div>

                <div className="stat-card total">
                  <div className="stat-icon">📋</div>
                  <div className="stat-content">
                    <div className="stat-label">Total in MRP</div>
                    <div className="stat-value">{totalModules.toLocaleString()}</div>
                    <div className="stat-sub">All barcodes assigned</div>
                  </div>
                </div>
              </div>

              {/* Dispatch Party Groups Table */}
              {dispatchGroups.length > 0 && (
                <div className="section">
                  <h3>🚚 Dispatched Modules ({dispatchedModules.toLocaleString()})</h3>
                  <div className="pallet-table-container">
                    <table className="pallet-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Dispatch Party</th>
                          <th>Modules</th>
                          <th>Pallets</th>
                          <th>Pallet Numbers</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchGroups.map((group, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td><strong>{group.dispatch_party}</strong></td>
                            <td className="module-count">
                              <span className="badge">{group.module_count.toLocaleString()}</span>
                            </td>
                            <td className="module-count">
                              <span className="badge packed-badge">{group.pallet_count}</span>
                            </td>
                            <td>
                              {group.pallets && group.pallets.length > 0
                                ? group.pallets.slice(0, 10).join(', ') + (group.pallets.length > 10 ? ` +${group.pallets.length - 10} more` : '')
                                : '—'}
                            </td>
                            <td>
                              <button 
                                className="view-details-btn"
                                onClick={() => {
                                  const serials = group.serials || [];
                                  const msg = serials.length > 0 
                                    ? `Serials dispatched to ${group.dispatch_party} (showing ${serials.length}):\n\n${serials.join('\n')}`
                                    : 'No serial details available';
                                  alert(msg);
                                }}
                              >
                                View Serials
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Packed Pallets Table */}
              {palletGroups.length > 0 && (
                <div className="section">
                  <h3>📦 Packed Pallets - Ready for Dispatch ({packedModules.toLocaleString()} modules in {palletGroups.length} pallets)</h3>
                  <div className="pallet-table-container">
                    <table className="pallet-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Pallet Number</th>
                          <th>Modules</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {palletGroups.slice(0, 100).map((pallet, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td className="pdi-number">
                              <strong>{pallet.pallet_no}</strong>
                            </td>
                            <td className="module-count">
                              <span className="badge packed-badge">{pallet.module_count}</span>
                            </td>
                            <td>
                              <span className="status-badge packed">📦 Packed</span>
                            </td>
                            <td>
                              <button 
                                className="view-details-btn"
                                onClick={() => {
                                  const serials = pallet.serials || [];
                                  const msg = serials.length > 0 
                                    ? `Serials in Pallet ${pallet.pallet_no} (showing ${serials.length}):\n\n${serials.join('\n')}`
                                    : 'No serial details available';
                                  alert(msg);
                                }}
                              >
                                View Serials
                              </button>
                            </td>
                          </tr>
                        ))}
                        {palletGroups.length > 100 && (
                          <tr>
                            <td colSpan="5" style={{textAlign: 'center', fontStyle: 'italic', color: '#666'}}>
                              Showing 100 of {palletGroups.length} pallets
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pending Summary */}
              {pendingModules > 0 && (
                <div className="section">
                  <h3>⏳ Pending (Not Yet Packed)</h3>
                  <div className="pending-summary">
                    <div className="pending-count">{pendingModules.toLocaleString()} modules</div>
                    <p>These barcodes are in MRP but not yet packed into pallets</p>
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
