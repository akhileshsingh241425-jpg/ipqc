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
      
      console.log('Loading dispatch data for company:', company.companyName);
      
      // Use external MRP API to get barcode tracking data
      const response = await fetch('https://umanmrp.in/api/get_barcode_tracking.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          party_name: company.companyName
        })
      });
      
      const result = await response.json();
      console.log('MRP API response:', result);
      
      if (result.success && result.data) {
        const mrpData = result.data;
        
        // Process data to extract dispatch, packing, production info
        const processedData = {
          summary: {
            total_assigned: mrpData.length,
            packed: 0,
            dispatched: 0,
            pending: 0,
            packed_percent: 0,
            dispatched_percent: 0,
            pending_percent: 0
          },
          details: {
            packed: [],
            dispatched: [],
            pending: []
          }
        };
        
        // Process each barcode
        mrpData.forEach(item => {
          const barcodeData = {
            serial: item.barcode_no,
            pdi: item.pdi_number || 'N/A',
          };
          
          // Check dispatch status
          if (item.dispatch && item.dispatch.dispatch_date) {
            processedData.summary.dispatched++;
            processedData.details.dispatched.push({
              ...barcodeData,
              dispatch_date: item.dispatch.dispatch_date,
              vehicle_no: item.dispatch.vehicle_no || '',
              party: item.dispatch.party_name || company.companyName
            });
          }
          // Check packing status
          else if (item.packing && item.packing.packing_date) {
            processedData.summary.packed++;
            processedData.details.packed.push({
              ...barcodeData,
              packing_date: item.packing.packing_date,
              box_no: item.packing.box_no || ''
            });
          }
          // Otherwise it's pending
          else {
            processedData.summary.pending++;
            processedData.details.pending.push(barcodeData);
          }
        });
        
        // Calculate percentages
        const total = processedData.summary.total_assigned;
        if (total > 0) {
          processedData.summary.packed_percent = Math.round((processedData.summary.packed / total) * 100);
          processedData.summary.dispatched_percent = Math.round((processedData.summary.dispatched / total) * 100);
          processedData.summary.pending_percent = Math.round((processedData.summary.pending / total) * 100);
        }
        
        setDispatchData({ success: true, ...processedData });
      } else {
        setError('No data found for this company');
        setDispatchData({
          success: true,
          summary: {
            total_assigned: 0,
            packed: 0,
            dispatched: 0,
            pending: 0,
            packed_percent: 0,
            dispatched_percent: 0,
            pending_percent: 0
          },
          details: { packed: [], dispatched: [], pending: [] }
        });
      }
    } catch (err) {
      setError('Error connecting to MRP system');
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
  const dispatchedItems = dispatchData?.details?.dispatched || [];
  const packedItems = dispatchData?.details?.packed || [];
  const pendingItems = dispatchData?.details?.pending || [];

  // Group by PDI number
  const groupByPDI = (items) => {
    const grouped = {};
    items.forEach(item => {
      const pdiKey = item.pdi || 'Unknown';
      if (!grouped[pdiKey]) {
        grouped[pdiKey] = {
          pdi: pdiKey,
          dispatched: 0,
          vehicle_nos: [],
          dispatch_dates: []
        };
      }
      grouped[pdiKey].dispatched += 1;
      if (item.vehicle_no && !grouped[pdiKey].vehicle_nos.includes(item.vehicle_no)) {
        grouped[pdiKey].vehicle_nos.push(item.vehicle_no);
      }
      if (item.dispatch_date && !grouped[pdiKey].dispatch_dates.includes(item.dispatch_date)) {
        grouped[pdiKey].dispatch_dates.push(item.dispatch_date);
      }
    });
    return Object.values(grouped).sort((a, b) => {
      // Sort PDI numbers naturally
      const pdiA = a.pdi.replace('PDI-', '');
      const pdiB = b.pdi.replace('PDI-', '');
      return pdiA.localeCompare(pdiB, undefined, { numeric: true });
    });
  };

  // Group dispatched items by vehicle (pallet proxy)
  const groupByVehicle = (items) => {
    const grouped = {};
    items.forEach(item => {
      const vehicleKey = item.vehicle_no || 'Unknown';
      if (!grouped[vehicleKey]) {
        grouped[vehicleKey] = {
          vehicle_no: vehicleKey,
          dispatch_date: item.dispatch_date,
          party: item.party,
          modules: []
        };
      }
      grouped[vehicleKey].modules.push(item);
    });
    return Object.values(grouped);
  };

  const pdiGroups = groupByPDI(dispatchedItems);
  const pallets = groupByVehicle(dispatchedItems);
  const totalPallets = pallets.length;
  const dispatchedModules = dispatchedItems.length;
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
                          <th>Dispatched Modules</th>
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
                              <span className="badge">{pdi.dispatched}</span> modules
                            </td>
                            <td>
                              {pdi.vehicle_nos.length > 0 
                                ? pdi.vehicle_nos.join(', ') 
                                : '—'}
                            </td>
                            <td>
                              {pdi.dispatch_dates.length > 0 
                                ? pdi.dispatch_dates.join(', ') 
                                : '—'}
                            </td>
                            <td>
                              <span className="status-badge dispatched">✓ Dispatched</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pallet-wise Dispatch Table */}
              {pallets.length > 0 && (
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
                        {pallets.map((pallet, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td className="vehicle-no">
                              {pallet.vehicle_no !== 'Unknown' ? pallet.vehicle_no : '—'}
                            </td>
                            <td>{pallet.dispatch_date || '—'}</td>
                            <td>{pallet.party || '—'}</td>
                            <td className="module-count">
                              <span className="badge">{pallet.modules.length}</span> modules
                            </td>
                            <td>
                              <button 
                                className="view-details-btn"
                                onClick={() => {
                                  // Show modal with all serial numbers in this pallet
                                  alert(`Modules in this shipment:\n\n${pallet.modules.map(m => m.serial).join('\n')}`);
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
              {packedItems.length > 0 && (
                <div className="section">
                  <h3>📦 Packed Stock (Ready for Dispatch)</h3>
                  <div className="packed-summary">
                    <div className="packed-count">{packedItems.length} modules packed</div>
                    <p>These modules are packed and ready for dispatch</p>
                  </div>
                </div>
              )}

              {/* Pending Production */}
              {pendingItems.length > 0 && (
                <div className="section">
                  <h3>⏳ Pending (In Production)</h3>
                  <div className="pending-summary">
                    <div className="pending-count">{pendingItems.length} modules</div>
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
