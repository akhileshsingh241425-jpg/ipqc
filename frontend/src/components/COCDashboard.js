import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PasswordModal from './PasswordModal';
import { getApiUrl } from '../services/apiService';
import '../styles/COCDashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

function COCDashboard() {
  // Get current month's first and last date
  const getCurrentMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      first: firstDay.toISOString().split('T')[0],
      last: lastDay.toISOString().split('T')[0]
    };
  };

  const defaultDates = getCurrentMonthDates();
  
  const [cocData, setCocData] = useState([]);
  const [filteredCocData, setFilteredCocData] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState(defaultDates.first);
  const [toDate, setToDate] = useState(defaultDates.last);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [showPdiDetails, setShowPdiDetails] = useState(false);
  const [editingUsed, setEditingUsed] = useState(null);
  const [editUsedValue, setEditUsedValue] = useState('');

  // Initial load
  useEffect(() => {
    loadCompanies();
    loadStockData();
    loadCOCData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on filters change
  useEffect(() => {
    loadCOCData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, showPdiDetails]);

  // Reload on company change
  useEffect(() => {
    loadCOCData();
    loadStockData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  const loadCompanies = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/coc/companies`);
      if (response.data.success) {
        const companyData = response.data.data || [];
        setCompanies(Array.isArray(companyData) ? companyData : []);
        if (companyData.length > 0) {
          setSelectedCompany(companyData[0]);
        }
      } else {
        setCompanies([]);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
    }
  };

  const loadCOCData = async () => {
    setLoading(true);
    try {
      // Choose endpoint based on showPdiDetails toggle
      const endpoint = showPdiDetails ? '/coc/coc-with-pdi-details' : '/coc/list';
      
      const params = { 
        company: selectedCompany || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      };
      
      const response = await axios.get(`${API_BASE_URL}${endpoint}`, { params });
      if (response.data.success) {
        // Handle different response formats
        const data = response.data.data || response.data.coc_data || [];
        setCocData(Array.isArray(data) ? data : []);
        setFilteredCocData(Array.isArray(data) ? data : []);
        
        // Show message if using PDI details endpoint but no data
        if (showPdiDetails && data.length === 0 && response.data.message) {
          setMessage(`ℹ️ ${response.data.message}`);
        }
      } else {
        setCocData([]);
        setFilteredCocData([]);
      }
    } catch (error) {
      console.error('Error loading COC data:', error);
      setCocData([]);
      setFilteredCocData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredCocData(cocData);
      return;
    }
    
    const filtered = cocData.filter(coc => {
      // Handle both API formats
      const invoice = coc.invoice_no || coc.invoiceNumber || '';
      const lot = coc.lot_batch_no || coc.cellBatchNumber || '';
      const material = coc.material || coc.cocNumber || '';
      const brand = coc.brand || coc.supplierName || '';
      const orderNum = coc.orderNumber || '';
      const pdiNum = coc.pdiUsageDetails?.map(p => p.pdiNumber).join(' ') || '';
      
      return invoice.toLowerCase().includes(term.toLowerCase()) ||
             lot.toLowerCase().includes(term.toLowerCase()) ||
             material.toLowerCase().includes(term.toLowerCase()) ||
             brand.toLowerCase().includes(term.toLowerCase()) ||
             orderNum.toLowerCase().includes(term.toLowerCase()) ||
             pdiNum.toLowerCase().includes(term.toLowerCase());
    });
    setFilteredCocData(filtered);
  };

  const loadStockData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/coc/stock`, {
        params: { company: selectedCompany || undefined }
      });
      if (response.data.success) {
        const stockDataResponse = response.data.data || [];
        setStockData(Array.isArray(stockDataResponse) ? stockDataResponse : []);
      } else {
        setStockData([]);
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
      setStockData([]);
    }
  };

  // Password verification handler
  const handlePasswordVerification = (verified) => {
    setShowPasswordModal(false);
    
    if (verified) {
      setIsPasswordVerified(true);
      
      // Execute pending action
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      
      // Auto-lock after 5 minutes
      setTimeout(() => {
        setIsPasswordVerified(false);
      }, 5 * 60 * 1000);
    } else {
      setPendingAction(null);
    }
  };

  // Check password before action
  const checkPasswordAndExecute = (action) => {
    if (isPasswordVerified) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPasswordModal(true);
    }
  };

  const syncCOCData = async () => {
    // Check password before syncing COC data
    checkPasswordAndExecute(async () => {
      await performSyncCOC();
    });
  };

  const performSyncCOC = async () => {
    if (!fromDate || !toDate) {
      setMessage('⚠️ Please select From Date and To Date');
      return;
    }
    
    setSyncing(true);
    setMessage('');
    try {
      const response = await axios.post(`${API_BASE_URL}/coc/sync`, {
        from_date: fromDate,
        to_date: toDate
      });
      
      if (response.data.success) {
        setMessage(`✅ Synced: ${response.data.synced} new, ${response.data.updated} updated (${fromDate} to ${toDate})`);
        loadCOCData();
        loadStockData();
        loadCompanies();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const generateConsolidatedReport = async () => {
    if (!selectedCompany) {
      alert('Please select a company');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/generate-consolidated-report`,
        {
          company_name: selectedCompany,
          from_date: '2025-11-01',
          to_date: '2025-11-30'
        },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Consolidated_Report_${selectedCompany}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Error generating report: ' + (error.response?.data?.message || error.message));
    }
  };

  const toggleRowExpansion = (cocId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(cocId)) {
      newExpanded.delete(cocId);
    } else {
      newExpanded.add(cocId);
    }
    setExpandedRows(newExpanded);
  };

  const startEditUsed = (coc) => {
    setEditingUsed(coc.id);
    setEditUsedValue(coc.cellsUsed || coc.consumed_qty || 0);
  };

  const saveEditUsed = async (cocId) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/coc/${cocId}/update-used`, {
        consumed_qty: parseInt(editUsedValue)
      });
      
      if (response.data.success) {
        setMessage('✅ Used quantity updated successfully!');
        loadCOCData();
        loadStockData();
        setEditingUsed(null);
        setEditUsedValue('');
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.response?.data?.message || error.message}`);
    }
  };

  const cancelEditUsed = () => {
    setEditingUsed(null);
    setEditUsedValue('');
  };

  return (
    <div className="coc-dashboard">
      <div className="dashboard-header">
        <h1>📋 COC & Raw Material Dashboard</h1>
        <div className="header-actions">
          <div className="date-filters">
            <label>
              From Date:
              <input 
                type="date" 
                value={fromDate} 
                onChange={(e) => setFromDate(e.target.value)}
                className="date-input"
              />
            </label>
            <label>
              To Date:
              <input 
                type="date" 
                value={toDate} 
                onChange={(e) => setToDate(e.target.value)}
                className="date-input"
              />
            </label>
          </div>
          <select 
            value={selectedCompany} 
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="company-select"
          >
            <option value="">All Companies</option>
            {Array.isArray(companies) && companies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
          <button onClick={syncCOCData} disabled={syncing} className="btn-sync">
            {syncing ? '⏳ Syncing...' : '🔄 Sync COC Data'}
          </button>
          <button onClick={generateConsolidatedReport} className="btn-report">
            📄 Generate Report
          </button>
        </div>
      </div>

      <div className="info-banner">
        <div>
          <span>📅 <strong>Showing COC documents:</strong> {fromDate} to {toDate}</span>
          {selectedCompany && <span style={{marginLeft: '15px'}}>| 🏢 <strong>Company:</strong> {selectedCompany}</span>}
        </div>
        <div style={{fontSize: '12px', opacity: 0.8, marginTop: '5px'}}>
          💡 Change dates to filter records | Click "Sync COC Data" to fetch new data from API
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Material Stock Summary */}
      <div className="section">
        <h2>📦 Raw Material Stock</h2>
        <div className="stock-grid">
          {Array.isArray(stockData) && stockData.map((item, index) => (
            <div key={index} className="stock-card">
              <h3>{item.material}</h3>
              <div className="stock-info">
                <div className="stock-item">
                  <span className="label">Make:</span>
                  <span className="value make">{item.make || 'N/A'}</span>
                </div>
                <div className="stock-item">
                  <span className="label">Received:</span>
                  <span className="value">{item.total_received.toLocaleString()}</span>
                </div>
                <div className="stock-item">
                  <span className="label">Consumed:</span>
                  <span className="value consumed">{item.total_consumed.toLocaleString()}</span>
                </div>
                <div className="stock-item highlight">
                  <span className="label">Available:</span>
                  <span className={`value ${item.available < 1000 ? 'low-stock' : ''}`}>
                    {item.available.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="stock-bar">
                <div 
                  className="stock-progress"
                  style={{width: `${(item.available / item.total_received) * 100}%`}}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COC Documents List */}
      <div className="section">
        <div className="section-header">
          <h2>📄 COC Documents {showPdiDetails && '& PDI Usage Details'}</h2>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer'}}>
              <input 
                type="checkbox" 
                checked={showPdiDetails}
                onChange={(e) => setShowPdiDetails(e.target.checked)}
              />
              <span>Show PDI Details</span>
            </label>
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Search by Invoice, Lot, Material, Order, PDI..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button onClick={() => handleSearch('')} className="clear-btn">✕</button>
              )}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <div className="results-info">
              Showing {Array.isArray(filteredCocData) ? filteredCocData.length : 0} of {Array.isArray(cocData) ? cocData.length : 0} records
            </div>
            <div className="coc-table-container">
              <table className="coc-table">
                <thead>
                  <tr>
                    {showPdiDetails && <th style={{width: '40px'}}></th>}
                    <th>Invoice No</th>
                    {showPdiDetails && <th>Order No</th>}
                    {showPdiDetails && <th>COC No</th>}
                    <th>Cell Batch</th>
                    <th>Supplier</th>
                    <th>Received Date</th>
                    <th>Total Cells</th>
                    <th>Used</th>
                    <th>Remaining</th>
                    {showPdiDetails && <th>Usage %</th>}
                    {showPdiDetails && <th>PDI Batches</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(filteredCocData) && filteredCocData.map((coc) => (
                    <React.Fragment key={coc.id}>
                      <tr>
                        {showPdiDetails && (
                          <td style={{textAlign: 'center', cursor: 'pointer'}} 
                              onClick={() => (coc.totalPdiBatches || 0) > 0 && toggleRowExpansion(coc.id)}>
                            {(coc.totalPdiBatches || 0) > 0 && (
                              <span style={{fontSize: '18px'}}>
                                {expandedRows.has(coc.id) ? '▼' : '▶'}
                              </span>
                            )}
                          </td>
                        )}
                        <td>{coc.invoiceNumber || coc.invoice_no}</td>
                        {showPdiDetails && <td>{coc.orderNumber || 'N/A'}</td>}
                        {showPdiDetails && <td>{coc.cocNumber || 'N/A'}</td>}
                        <td>{coc.cellBatchNumber || coc.lot_batch_no}</td>
                        <td>{coc.supplierName || coc.brand || 'N/A'}</td>
                        <td>{coc.receivedDate || coc.invoice_date}</td>
                        <td className="number">{(coc.totalCellsQty || coc.coc_qty || 0).toLocaleString()}</td>
                        <td className="number consumed">
                          {editingUsed === coc.id ? (
                            <div style={{display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center'}}>
                              <input
                                type="number"
                                value={editUsedValue}
                                onChange={(e) => setEditUsedValue(e.target.value)}
                                style={{
                                  width: '100px',
                                  padding: '4px 8px',
                                  border: '2px solid #2196f3',
                                  borderRadius: '4px',
                                  fontSize: '13px'
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => saveEditUsed(coc.id)}
                                style={{
                                  padding: '4px 8px',
                                  background: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}
                                title="Save"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditUsed}
                                style={{
                                  padding: '4px 8px',
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center'}}>
                              <span>{(coc.cellsUsed || coc.consumed_qty || 0).toLocaleString()}</span>
                              <button
                                onClick={() => startEditUsed(coc)}
                                style={{
                                  padding: '3px 6px',
                                  background: '#2196f3',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '11px'
                                }}
                                title="Edit used quantity"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td className={`number ${(coc.cellsRemaining || coc.available_qty || 0) < 100 ? 'low-stock' : ''}`}>
                          {(coc.cellsRemaining || coc.available_qty || 0).toLocaleString()}
                        </td>
                        {showPdiDetails && (
                          <td className="number">
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: (coc.utilizationPercent || 0) >= 80 ? '#ffebee' : 
                                             (coc.utilizationPercent || 0) >= 50 ? '#fff3e0' : '#e8f5e9',
                              color: (coc.utilizationPercent || 0) >= 80 ? '#c62828' :
                                    (coc.utilizationPercent || 0) >= 50 ? '#e65100' : '#2e7d32'
                            }}>
                              {coc.utilizationPercent || 0}%
                            </span>
                          </td>
                        )}
                        {showPdiDetails && (
                          <td className="number">
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2',
                              fontWeight: 'bold'
                            }}>
                              {coc.totalPdiBatches || 0}
                            </span>
                          </td>
                        )}
                        <td>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: coc.status === 'active' ? '#e8f5e9' : '#fafafa',
                            color: coc.status === 'active' ? '#2e7d32' : '#757575'
                          }}>
                            {coc.status || 'active'}
                          </span>
                        </td>
                      </tr>
                      {showPdiDetails && expandedRows.has(coc.id) && coc.pdiUsageDetails && coc.pdiUsageDetails.length > 0 && (
                        <tr>
                          <td colSpan={showPdiDetails ? 13 : 10} style={{padding: '0', backgroundColor: '#f5f5f5'}}>
                            <div style={{padding: '20px', margin: '10px'}}>
                              <h4 style={{marginTop: 0, color: '#1976d2'}}>📊 PDI Usage Details</h4>
                              <table style={{width: '100%', backgroundColor: 'white', borderCollapse: 'collapse'}}>
                                <thead>
                                  <tr style={{backgroundColor: '#e3f2fd'}}>
                                    <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>PDI Number</th>
                                    <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Batch Seq</th>
                                    <th style={{padding: '10px', textAlign: 'right', border: '1px solid #ddd'}}>Cells Used</th>
                                    <th style={{padding: '10px', textAlign: 'right', border: '1px solid #ddd'}}>Planned Modules</th>
                                    <th style={{padding: '10px', textAlign: 'right', border: '1px solid #ddd'}}>Actual Modules</th>
                                    <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Start Date</th>
                                    <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>End Date</th>
                                    <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Serial Range</th>
                                    <th style={{padding: '10px', textAlign: 'left', border: '1px solid #ddd'}}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.isArray(coc.pdiUsageDetails) && coc.pdiUsageDetails.map((pdi, idx) => (
                                    <tr key={idx}>
                                      <td style={{padding: '10px', border: '1px solid #ddd', fontWeight: 'bold'}}>{pdi.pdiNumber}</td>
                                      <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'center'}}>Batch #{pdi.batchSequence}</td>
                                      <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right', color: '#d32f2f', fontWeight: 'bold'}}>
                                        {pdi.cellsUsed.toLocaleString()}
                                      </td>
                                      <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right'}}>{pdi.plannedModules}</td>
                                      <td style={{padding: '10px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold'}}>
                                        {pdi.actualModules}
                                      </td>
                                      <td style={{padding: '10px', border: '1px solid #ddd'}}>{pdi.startDate || 'N/A'}</td>
                                      <td style={{padding: '10px', border: '1px solid #ddd'}}>{pdi.endDate || 'N/A'}</td>
                                      <td style={{padding: '10px', border: '1px solid #ddd', fontFamily: 'monospace'}}>
                                        {pdi.serialPrefix && pdi.serialStart && pdi.serialEnd 
                                          ? `${pdi.serialPrefix}${pdi.serialStart} - ${pdi.serialPrefix}${pdi.serialEnd}`
                                          : 'N/A'}
                                      </td>
                                      <td style={{padding: '10px', border: '1px solid #ddd'}}>
                                        <span style={{
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          backgroundColor: pdi.status === 'completed' ? '#e8f5e9' : 
                                                         pdi.status === 'in_progress' ? '#fff3e0' : '#f5f5f5',
                                          color: pdi.status === 'completed' ? '#2e7d32' :
                                                pdi.status === 'in_progress' ? '#e65100' : '#757575'
                                        }}>
                                          {pdi.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {coc.notes && (
                                <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#fffde7', borderLeft: '4px solid #fbc02d'}}>
                                  <strong>Notes:</strong> {coc.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {(!Array.isArray(filteredCocData) || filteredCocData.length === 0) && (
                    <tr>
                      <td colSpan={showPdiDetails ? 13 : 10} style={{textAlign: 'center', padding: '20px', color: '#999'}}>
                        {searchTerm ? `No results found for "${searchTerm}"` : 'No COC documents available'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Password Modal */}
      <PasswordModal 
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingAction(null);
        }}
        onVerify={handlePasswordVerification}
        title="🔒 Password Required"
        message="Enter password to sync COC data. Access will remain active for 5 minutes."
      />
    </div>
  );
}

export default COCDashboard;
