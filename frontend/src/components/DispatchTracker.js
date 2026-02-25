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
  const pdiGroups = dispatchData?.pdi_groups || [];
  const vehicleGroups = dispatchData?.vehicle_groups || [];
  const totalPallets = vehicleGroups.length;
  const dispatchedModules = summary.dispatched || 0;
  const remainingModules = (summary.total_assigned || 0) - dispatchedModules;

  return (
    <div className="dispatch-tracker">
      {/* Header */}
      <div className="dispatch-header">
        <div>
          <h1>🚚 Dispatch Tracking Dashboard</h1>
          <p>Track PDI-wise and pallet-wise dispatch status</p>
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
              <p>Loading dispatch data...</p>
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
                    <div className="stat-label">Dispatched Modules</div>
                    <div className="stat-value">{dispatchedModules.toLocaleString()}</div>
                    <div className="stat-percent">
                      {summary.dispatched_percent || 0}% of total
                    </div>
                  </div>
                </div>

                <div className="stat-card pallets">
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Pallets/Vehicles</div>
                    <div className="stat-value">{totalPallets}</div>
                    <div className="stat-sub">Dispatched shipments</div>
                  </div>
                </div>

                <div className="stat-card remaining">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-content">
                    <div className="stat-label">Remaining Stock</div>
                    <div className="stat-value">{remainingModules.toLocaleString()}</div>
                    <div className="stat-sub">
                      {(summary.packed || 0).toLocaleString()} packed, {' '}
                      {(summary.pending || 0).toLocaleString()} pending
                    </div>
                  </div>
                </div>

                <div className="stat-card total">
                  <div className="stat-icon">📋</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Assigned</div>
                    <div className="stat-value">{(summary.total_assigned || 0).toLocaleString()}</div>
                    <div className="stat-sub">All modules in PDI</div>
                  </div>
                </div>
              </div>

              {/* PDI-wise Status Table */}
              {pdiGroups.length > 0 && (
                <div className="section">
                  <h3>📋 PDI-wise Dispatch Status</h3>
                  <div className="pallet-table-container">
                    <table className="pallet-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>PDI Number</th>
                          <th>Dispatched</th>
                          <th>Packed</th>
                          <th>Pending</th>
                          <th>Pallets/Vehicles</th>
                          <th>Dispatch Dates</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdiGroups.map((pdi, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td className="pdi-number">
                              <strong>{pdi.pdi}</strong>
                            </td>
                            <td className="module-count">
                              <span className="badge">{pdi.dispatched}</span>
                            </td>
                            <td className="module-count">
                              <span className="badge packed-badge">{pdi.packed || 0}</span>
                            </td>
                            <td className="module-count">
                              <span className="badge pending-badge">{pdi.pending || 0}</span>
                            </td>
                            <td>
                              {pdi.vehicle_nos && pdi.vehicle_nos.length > 0 
                                ? pdi.vehicle_nos.join(', ') 
                                : '—'}
                            </td>
                            <td>
                              {pdi.dispatch_dates && pdi.dispatch_dates.length > 0 
                                ? pdi.dispatch_dates.join(', ') 
                                : '—'}
                            </td>
                            <td>
                              {pdi.dispatched > 0 
                                ? <span className="status-badge dispatched">✓ Dispatched</span>
                                : pdi.packed > 0 
                                  ? <span className="status-badge packed">📦 Packed</span>
                                  : <span className="status-badge pending">⏳ Pending</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pallet-wise Dispatch Table */}
              {vehicleGroups.length > 0 && (
                <div className="section">
                  <h3>🚛 Pallet/Vehicle-wise Dispatch Details</h3>
                  <div className="pallet-table-container">
                    <table className="pallet-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Vehicle Number</th>
                          <th>Dispatch Date</th>
                          <th>Party/Customer</th>
                          <th>Modules Count</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicleGroups.map((vehicle, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td className="vehicle-no">
                              {vehicle.vehicle_no !== 'Unknown' ? vehicle.vehicle_no : '—'}
                            </td>
                            <td>{vehicle.dispatch_date || '—'}</td>
                            <td>{vehicle.party || '—'}</td>
                            <td className="module-count">
                              <span className="badge">{vehicle.module_count}</span> modules
                            </td>
                            <td>
                              <button 
                                className="view-details-btn"
                                onClick={() => {
                                  const serials = vehicle.serials || [];
                                  const msg = serials.length > 0 
                                    ? `Modules in this shipment (showing ${serials.length}):\n\n${serials.join('\n')}`
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

              {/* Packed Stock */}
              {(summary.packed || 0) > 0 && (
                <div className="section">
                  <h3>📦 Packed Stock (Ready for Dispatch)</h3>
                  <div className="packed-summary">
                    <div className="packed-count">{(summary.packed || 0).toLocaleString()} modules packed</div>
                    <p>These modules are packed and ready for dispatch</p>
                  </div>
                </div>
              )}

              {/* Pending Production */}
              {(summary.pending || 0) > 0 && (
                <div className="section">
                  <h3>⏳ Pending (In Production)</h3>
                  <div className="pending-summary">
                    <div className="pending-count">{(summary.pending || 0).toLocaleString()} modules</div>
                    <p>These modules are still in production/packing stage</p>
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
