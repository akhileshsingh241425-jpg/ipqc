import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/COCManagement.css';

const COCManagementDashboard = () => {
  const [activeTab, setActiveTab] = useState('pdi-usage'); // 'pdi-usage' | 'fifo-suggestions' | 'stats'
  const [pdiUsageData, setPdiUsageData] = useState([]);
  const [materialStats, setMaterialStats] = useState([]);
  const [fifoSuggestions, setFifoSuggestions] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedPDI, setSelectedPDI] = useState(null);
  const [searchMaterial, setSearchMaterial] = useState('');
  const [searchPDI, setSearchPDI] = useState('');  // For PDI-specific search
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const getAPIBase = () => {
    if (window.location.hostname === 'pdi.gspl.cloud') {
      return 'https://pdi.gspl.cloud/api';
    }
    return 'http://localhost:5000/api';
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany && activeTab === 'pdi-usage') {
      loadPDIUsage();
    } else if (selectedCompany && activeTab === 'stats') {
      loadMaterialStats();
    }
  }, [selectedCompany, activeTab]);

  const loadCompanies = async () => {
    try {
      const API_BASE = getAPIBase();
      const response = await axios.get(`${API_BASE}/companies`);
      setCompanies(response.data || []);
      if (response.data && response.data.length > 0) {
        setSelectedCompany(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadPDIUsage = async () => {
    try {
      setLoading(true);
      const API_BASE = getAPIBase();
      const response = await axios.get(`${API_BASE}/coc-management/usage-by-pdi`, {
        params: { company_id: selectedCompany.id }
      });
      setPdiUsageData(response.data.data || []);
    } catch (error) {
      console.error('Failed to load PDI usage:', error);
      alert('Failed to load COC usage data');
    } finally {
      setLoading(false);
    }
  };

  const loadMaterialStats = async () => {
    try {
      setLoading(true);
      const API_BASE = getAPIBase();
      const response = await axios.get(`${API_BASE}/coc-management/material-stats`, {
        params: { company_id: selectedCompany.id }
      });
      setMaterialStats(response.data.data || []);
    } catch (error) {
      console.error('Failed to load material stats:', error);
      alert('Failed to load material statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadFIFOSuggestions = async (materialNames, pdiNumber = '') => {
    try {
      setLoading(true);
      const API_BASE = getAPIBase();
      const response = await axios.post(`${API_BASE}/coc-management/fifo-suggestions`, {
        company_id: selectedCompany.id,
        pdi_number: pdiNumber,  // Add PDI filter
        material_names: materialNames,
        shift: 'day'
      });
      setFifoSuggestions(response.data.suggestions || {});
    } catch (error) {
      console.error('Failed to load FIFO suggestions:', error);
      alert('Failed to load FIFO suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFIFO = () => {
    if (searchMaterial.trim()) {
      loadFIFOSuggestions([searchMaterial.trim()], searchPDI.trim());
    }
  };

  if (!selectedCompany) {
    return (
      <div style={{padding: '40px', textAlign: 'center', color: '#999'}}>
        <h3>📋 COC Management Dashboard</h3>
        <p>Loading companies...</p>
      </div>
    );
  }

  return (
    <div className="coc-management-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>📋 COC Management & Tracking</h2>
          <p style={{fontSize: '14px', color: '#666', marginTop: '5px'}}>
            Track COC usage and get FIFO suggestions for raw materials
          </p>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <label style={{fontSize: '14px', color: '#666'}}>Company:</label>
          <select 
            value={selectedCompany?.id || ''} 
            onChange={(e) => {
              const company = companies.find(c => c.id === parseInt(e.target.value));
              setSelectedCompany(company);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px',
              minWidth: '150px'
            }}
          >
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={activeTab === 'pdi-usage' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('pdi-usage')}
        >
          📦 PDI-wise Usage
        </button>
        <button
          className={activeTab === 'fifo-suggestions' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('fifo-suggestions')}
        >
          🎯 FIFO Suggestions
        </button>
        <button
          className={activeTab === 'stats' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('stats')}
        >
          📊 Material Stats
        </button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {loading && (
          <div style={{textAlign: 'center', padding: '40px'}}>
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        )}

        {/* PDI-wise Usage Tab */}
        {activeTab === 'pdi-usage' && !loading && (
          <div className="pdi-usage-section">
            <div style={{marginBottom: '20px'}}>
              <h3>COC Usage by PDI</h3>
              <p style={{color: '#666', fontSize: '14px'}}>
                View which COCs were used in each PDI across different materials and shifts
              </p>
            </div>

            {pdiUsageData.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <p>📭 No COC usage data recorded yet</p>
              </div>
            ) : (
              <div className="pdi-usage-list">
                {pdiUsageData.map((pdi, idx) => (
                  <div key={idx} className="pdi-usage-card">
                    <div 
                      className="pdi-header"
                      onClick={() => setSelectedPDI(selectedPDI === pdi.pdiNumber ? null : pdi.pdiNumber)}
                      style={{cursor: 'pointer'}}
                    >
                      <div>
                        <h4>{pdi.pdiNumber}</h4>
                        <p style={{fontSize: '12px', color: '#666', margin: '5px 0'}}>
                          {pdi.usageDate} • {pdi.totalCocs} COCs used
                        </p>
                      </div>
                      <span style={{fontSize: '20px'}}>
                        {selectedPDI === pdi.pdiNumber ? '▼' : '▶'}
                      </span>
                    </div>

                    {selectedPDI === pdi.pdiNumber && (
                      <div className="pdi-materials">
                        <table className="materials-table">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th>Shift</th>
                              <th>COC Invoice</th>
                              <th>Brand</th>
                              <th>Qty Used</th>
                              <th>Gap</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pdi.materials.map((mat, midx) => (
                              <tr key={midx}>
                                <td>{mat.materialName}</td>
                                <td>
                                  <span className={`shift-badge ${mat.shift}`}>
                                    {mat.shift === 'day' ? '🌞 Day' : '🌙 Night'}
                                  </span>
                                </td>
                                <td style={{fontWeight: '500'}}>{mat.cocInvoiceNumber || '-'}</td>
                                <td>{mat.cocBrand || '-'}</td>
                                <td>{mat.cocQtyUsed || 0}</td>
                                <td style={{
                                  color: mat.cocRemainingGap === 0 ? '#28a745' : '#ffc107',
                                  fontWeight: 'bold'
                                }}>
                                  {mat.cocRemainingGap}
                                  {mat.cocRemainingGap === 0 && ' ✓'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FIFO Suggestions Tab */}
        {activeTab === 'fifo-suggestions' && !loading && (
          <div className="fifo-section">
            <h3>🎯 FIFO-Based COC Suggestions</h3>
            <p style={{color: '#666', fontSize: '14px', marginBottom: '20px'}}>
              Get next available COC based on First-In-First-Out (FIFO) principle
            </p>

            <div className="search-box" style={{marginBottom: '20px', display: 'flex', gap: '10px'}}>
              <input
                type="text"
                placeholder="PDI Number (e.g., Lot 1, Lot 2)"
                value={searchPDI}
                onChange={(e) => setSearchPDI(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchFIFO()}
                style={{
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #28a745',
                  borderRadius: '5px',
                  width: '250px'
                }}
              />
              <input
                type="text"
                placeholder="Material name (e.g., Solar Cell, Glass)"
                value={searchMaterial}
                onChange={(e) => setSearchMaterial(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchFIFO()}
                style={{
                  padding: '12px',
                  fontSize: '14px',
                  border: '2px solid #007bff',
                  borderRadius: '5px',
                  width: '300px'
                }}
              />
              <button 
                onClick={handleSearchFIFO}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔍 Search
              </button>
            </div>

            {Object.keys(fifoSuggestions).length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <p>👆 Enter a material name to get FIFO suggestions</p>
              </div>
            ) : (
              <div className="fifo-results">
                {Object.values(fifoSuggestions).map((suggestion, idx) => (
                  <div key={idx} className="fifo-material-card">
                    <h4>{suggestion.materialName}</h4>
                    
                    {/* Show previously used brands info */}
                    {suggestion.previouslyUsedBrands && suggestion.previouslyUsedBrands.length > 0 && (
                      <div style={{
                        padding: '10px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '5px',
                        marginBottom: '15px',
                        fontSize: '13px'
                      }}>
                        <strong>📊 Previously Used Brands:</strong>{' '}
                        {suggestion.previouslyUsedBrands.join(', ')}
                        <br />
                        <span style={{color: '#666', fontSize: '12px'}}>
                          ({suggestion.usedBrandsCount} COCs from these brands, {suggestion.newBrandsCount} from new brands)
                        </span>
                      </div>
                    )}
                    
                    {suggestion.recommendedCoc ? (
                      <div className="recommended-coc">
                        <div style={{
                          padding: '15px',
                          backgroundColor: suggestion.recommendedCoc.isPreviouslyUsed ? '#d4edda' : '#fff3cd',
                          border: `2px solid ${suggestion.recommendedCoc.isPreviouslyUsed ? '#28a745' : '#ffc107'}`,
                          borderRadius: '8px',
                          marginBottom: '15px'
                        }}>
                          <h5 style={{
                            margin: '0 0 10px 0', 
                            color: suggestion.recommendedCoc.isPreviouslyUsed ? '#155724' : '#856404'
                          }}>
                            {suggestion.recommendedCoc.isPreviouslyUsed 
                              ? '⭐ Recommended (Previously Used Brand - FIFO):' 
                              : '🆕 Recommended (New Brand - FIFO):'}
                          </h5>
                          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                            <div>
                              <strong>Invoice:</strong> {suggestion.recommendedCoc.invoiceNo}
                            </div>
                            <div>
                              <strong>Brand:</strong> {suggestion.recommendedCoc.brand}
                              {suggestion.recommendedCoc.isPreviouslyUsed && ' ✅'}
                            </div>
                            <div>
                              <strong>Date:</strong> {suggestion.recommendedCoc.invoiceDate}
                            </div>
                            <div>
                              <strong>Remaining:</strong> {suggestion.recommendedCoc.remainingQty}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{padding: '15px', backgroundColor: '#f8d7da', borderRadius: '8px'}}>
                        <p style={{margin: 0, color: '#721c24'}}>❌ No available COCs for this material</p>
                      </div>
                    )}

                    {suggestion.availableCocs && suggestion.availableCocs.length > 1 && (
                      <div className="other-cocs">
                        <h5 style={{margin: '15px 0 10px 0'}}>
                          Other Available COCs ({suggestion.availableCocs.length - 1}):
                        </h5>
                        <table className="cocs-table">
                          <thead>
                            <tr>
                              <th>Invoice No</th>
                              <th>Brand</th>
                              <th>Date</th>
                              <th>Remaining Qty</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {suggestion.availableCocs.slice(1).map((coc, cidx) => (
                              <tr key={cidx} style={{
                                backgroundColor: coc.isPreviouslyUsed ? '#f0f8f0' : 'transparent'
                              }}>
                                <td>{coc.invoiceNo}</td>
                                <td>{coc.brand}</td>
                                <td>{coc.invoiceDate}</td>
                                <td>{coc.remainingQty}</td>
                                <td>
                                  {coc.isPreviouslyUsed ? (
                                    <span style={{
                                      color: '#28a745',
                                      fontSize: '11px',
                                      fontWeight: 'bold'
                                    }}>✅ Used</span>
                                  ) : (
                                    <span style={{
                                      color: '#6c757d',
                                      fontSize: '11px'
                                    }}>🆕 New</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Material Stats Tab */}
        {activeTab === 'stats' && !loading && (
          <div className="stats-section">
            <h3>📊 Material-wise COC Usage Statistics</h3>
            
            {materialStats.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <p>📭 No statistics available yet</p>
              </div>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Material Name</th>
                    <th>Unique COCs Used</th>
                    <th>Total Quantity Used</th>
                  </tr>
                </thead>
                <tbody>
                  {materialStats.map((stat, idx) => (
                    <tr key={idx}>
                      <td style={{fontWeight: '500'}}>{stat.materialName}</td>
                      <td>{stat.uniqueCocs}</td>
                      <td>{stat.totalUsed.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default COCManagementDashboard;
