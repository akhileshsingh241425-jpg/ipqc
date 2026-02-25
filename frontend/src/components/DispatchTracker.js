import React, { useState, useEffect } from 'react';
import '../styles/DispatchTracker.css';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

const DispatchTracker = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [dispatchData, setDispatchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load companies on mount
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/companies`);
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  };

  const loadDispatchData = async (companyId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/ftr/pdi-dashboard/${companyId}`);
      const data = await response.json();
      
      if (data.success) {
        setDispatchData(data);
      } else {
        setError(data.error || 'Failed to load dispatch data');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    loadDispatchData(company.id);
  };

  const filteredCompanies = companies.filter(company =>
    company.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const summary = dispatchData?.summary || {};
  const dispatchedItems = dispatchData?.details?.dispatched || [];
  const packedItems = dispatchData?.details?.packed || [];
  const pendingItems = dispatchData?.details?.pending || [];

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
          <p>Track pallet-wise dispatch status, remaining stock & delivery details</p>
        </div>
      </div>

      <div className="dispatch-content">
        {/* Company Selector */}
        <div className="company-selector-panel">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="company-list">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className={`company-card ${selectedCompany?.id === company.id ? 'active' : ''}`}
                onClick={() => handleCompanySelect(company)}
              >
                <div className="company-name">{company.company_name}</div>
                <div className="company-meta">
                  {company.module_wattage}W • {company.cells_per_module} cells
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dispatch Details */}
        <div className="dispatch-details-panel">
          {!selectedCompany ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>Select a Company</h3>
              <p>Choose a company from the left panel to view dispatch tracking</p>
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
              <button onClick={() => loadDispatchData(selectedCompany.id)}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Company Header */}
              <div className="company-header">
                <h2>{selectedCompany.company_name}</h2>
                <button 
                  onClick={() => loadDispatchData(selectedCompany.id)}
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
    </div>
  );
};

export default DispatchTracker;
