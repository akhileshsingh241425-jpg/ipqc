import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/FTRDashboard.css';

const FTRDashboard = () => {
  const [ftrData, setFtrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(null);

  // Same API base logic as AIAssistant
  const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

  const loadFTRData = useCallback(async () => {
    try {
      setError(null);
      const API_BASE = getAPIBaseURL();
      console.log('Loading FTR data from:', `${API_BASE}/api/ai/data`);
      const response = await axios.get(`${API_BASE}/api/ai/data`);
      console.log('FTR API Response:', response.data);
      if (response.data.success) {
        setFtrData(response.data.data);
        setLastUpdated(new Date());
        console.log('FTR Data loaded:', response.data.data);
      } else {
        setError(response.data.error || 'Failed to load data');
        console.error('API returned error:', response.data.error);
      }
    } catch (error) {
      console.error('Error loading FTR data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFTRData();
  }, [loadFTRData]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadFTRData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadFTRData]);

  // Calculate MW for a company
  const calculateMW = (modules, wattage) => {
    if (!modules || !wattage) return 0;
    return ((modules * wattage) / 1000000).toFixed(2);
  };

  // Calculate percentage
  const calcPercent = (value, total) => {
    if (!total || total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="ftr-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ftr-dashboard">
        <div className="dashboard-header">
          <div className="header-left">
            <h1>📊 FTR Analytics Dashboard</h1>
          </div>
          <div className="header-right">
            <button className="btn-refresh" onClick={loadFTRData}>
              🔄 Retry
            </button>
          </div>
        </div>
        <div className="error-message" style={{background: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', margin: '20px'}}>
          <h3 style={{color: '#e74c3c'}}>⚠️ Error Loading Data</h3>
          <p>{error}</p>
          <p style={{color: '#888', fontSize: '12px'}}>Check browser console for details (F12)</p>
        </div>
      </div>
    );
  }

  const summary = ftrData?.summary || {};
  const companies = ftrData?.companies || [];

  // Calculate total MW
  const totalMW = companies.reduce((sum, c) => {
    return sum + parseFloat(calculateMW(c.master_total, c.wattage));
  }, 0).toFixed(2);

  const packedMW = companies.reduce((sum, c) => {
    return sum + parseFloat(calculateMW(c.packed, c.wattage));
  }, 0).toFixed(2);

  const dispatchedMW = companies.reduce((sum, c) => {
    return sum + parseFloat(calculateMW(c.ext_dispatched || 0, c.wattage));
  }, 0).toFixed(2);

  return (
    <div className="ftr-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>📊 FTR Analytics Dashboard</h1>
        </div>
        <div className="header-right">
          <span className="last-updated">
            🕐 {lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}
          </span>
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>
          <button className="btn-refresh" onClick={loadFTRData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="summary-row">
        <div className="summary-card total">
          <div className="card-icon">📦</div>
          <div className="card-content">
            <span className="card-value">{summary.total_master_ftr?.toLocaleString() || 0}</span>
            <span className="card-label">Total Modules</span>
            <span className="card-sub">{totalMW} MW</span>
          </div>
        </div>

        <div className="summary-card assigned">
          <div className="card-icon">📋</div>
          <div className="card-content">
            <span className="card-value">{summary.total_assigned?.toLocaleString() || 0}</span>
            <span className="card-label">PDI Assigned</span>
            <span className="card-sub">{calcPercent(summary.total_assigned, summary.total_master_ftr)}%</span>
          </div>
        </div>

        <div className="summary-card packed">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <span className="card-value">{summary.total_packed?.toLocaleString() || 0}</span>
            <span className="card-label">Packed</span>
            <span className="card-sub">{packedMW} MW</span>
          </div>
        </div>

        <div className="summary-card dispatched">
          <div className="card-icon">🚚</div>
          <div className="card-content">
            <span className="card-value">{summary.ext_total_dispatched?.toLocaleString() || 0}</span>
            <span className="card-label">Dispatched</span>
            <span className="card-sub">{dispatchedMW} MW</span>
          </div>
        </div>

        <div className="summary-card pending">
          <div className="card-icon">⏳</div>
          <div className="card-content">
            <span className="card-value">{summary.total_pending_pack?.toLocaleString() || 0}</span>
            <span className="card-label">Pending Pack</span>
            <span className="card-sub">{calcPercent(summary.total_pending_pack, summary.total_assigned)}% of assigned</span>
          </div>
        </div>

        <div className="summary-card available">
          <div className="card-icon">🆓</div>
          <div className="card-content">
            <span className="card-value">{summary.total_available?.toLocaleString() || 0}</span>
            <span className="card-label">Available</span>
            <span className="card-sub">Ready for PDI</span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="progress-section">
        <h3>📈 Overall Progress</h3>
        <div className="progress-bars">
          <div className="progress-item">
            <div className="progress-label">
              <span>PDI Assigned</span>
              <span>{calcPercent(summary.total_assigned, summary.total_master_ftr)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill assigned" 
                style={{ width: `${calcPercent(summary.total_assigned, summary.total_master_ftr)}%` }}
              ></div>
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>Packed</span>
              <span>{calcPercent(summary.total_packed, summary.total_assigned)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill packed" 
                style={{ width: `${calcPercent(summary.total_packed, summary.total_assigned)}%` }}
              ></div>
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-label">
              <span>Dispatched</span>
              <span>{calcPercent(summary.ext_total_dispatched, summary.total_packed)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill dispatched" 
                style={{ width: `${calcPercent(summary.ext_total_dispatched, summary.total_packed)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Company Cards */}
      <div className="companies-section">
        <h3>🏭 Company-wise Analysis</h3>
        <div className="company-cards">
          {companies.map((company, idx) => {
            const companyMW = calculateMW(company.master_total, company.wattage);
            const packedMWCompany = calculateMW(company.packed, company.wattage);
            const dispatchedMWCompany = calculateMW(company.ext_dispatched || 0, company.wattage);
            const packProgress = calcPercent(company.packed, company.assigned);
            const dispatchProgress = calcPercent(company.ext_dispatched || 0, company.packed);
            
            return (
              <div 
                key={idx} 
                className={`company-card ${selectedCompany === company.name ? 'selected' : ''}`}
                onClick={() => setSelectedCompany(selectedCompany === company.name ? null : company.name)}
              >
                <div className="company-header">
                  <h4>{company.name}</h4>
                  <span className="company-wattage">{company.wattage}W</span>
                </div>

                <div className="company-metrics">
                  <div className="metric">
                    <span className="metric-icon">📦</span>
                    <div className="metric-content">
                      <span className="metric-value">{company.master_total?.toLocaleString()}</span>
                      <span className="metric-label">Total ({companyMW} MW)</span>
                    </div>
                  </div>

                  <div className="metric">
                    <span className="metric-icon">📋</span>
                    <div className="metric-content">
                      <span className="metric-value">{company.assigned?.toLocaleString()}</span>
                      <span className="metric-label">PDI Assigned</span>
                    </div>
                  </div>

                  <div className="metric highlight-green">
                    <span className="metric-icon">✅</span>
                    <div className="metric-content">
                      <span className="metric-value">{company.packed?.toLocaleString()}</span>
                      <span className="metric-label">Packed ({packedMWCompany} MW)</span>
                    </div>
                  </div>

                  <div className="metric highlight-blue">
                    <span className="metric-icon">🚚</span>
                    <div className="metric-content">
                      <span className="metric-value">{(company.ext_dispatched || 0).toLocaleString()}</span>
                      <span className="metric-label">Dispatched ({dispatchedMWCompany} MW)</span>
                    </div>
                  </div>

                  <div className="metric highlight-orange">
                    <span className="metric-icon">⏳</span>
                    <div className="metric-content">
                      <span className="metric-value">{company.pending_pack?.toLocaleString()}</span>
                      <span className="metric-label">Pending Pack</span>
                    </div>
                  </div>

                  <div className="metric highlight-purple">
                    <span className="metric-icon">🆓</span>
                    <div className="metric-content">
                      <span className="metric-value">{company.available?.toLocaleString()}</span>
                      <span className="metric-label">Available</span>
                    </div>
                  </div>
                </div>

                {/* Mini Progress Bars */}
                <div className="company-progress">
                  <div className="mini-progress">
                    <span>Pack: {packProgress}%</span>
                    <div className="mini-bar">
                      <div className="mini-fill green" style={{ width: `${packProgress}%` }}></div>
                    </div>
                  </div>
                  <div className="mini-progress">
                    <span>Dispatch: {dispatchProgress}%</span>
                    <div className="mini-bar">
                      <div className="mini-fill blue" style={{ width: `${dispatchProgress}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Expanded PDI Details */}
                {selectedCompany === company.name && company.pdi_breakdown && (
                  <div className="pdi-breakdown">
                    <h5>📑 PDI Breakdown</h5>
                    <div className="pdi-list">
                      {company.pdi_breakdown.slice(0, 10).map((pdi, pIdx) => (
                        <div key={pIdx} className="pdi-item">
                          <span className="pdi-name">{pdi.pdi}</span>
                          <span className="pdi-count">{pdi.count?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {company.binning_breakdown && (
                      <>
                        <h5>🏷️ Binning</h5>
                        <div className="binning-list">
                          {company.binning_breakdown.map((bin, bIdx) => (
                            <span key={bIdx} className="binning-tag">
                              {bin.binning}: {bin.count?.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra Packed Alert Section */}
      {summary.total_extra_packed > 0 && (
        <div className="alerts-section">
          <h3>⚠️ Alerts</h3>
          <div className="alert-card danger">
            <span className="alert-icon">🔴</span>
            <div className="alert-content">
              <span className="alert-title">Extra Packed Modules</span>
              <span className="alert-value">{summary.total_extra_packed?.toLocaleString()}</span>
              <span className="alert-desc">Modules packed but not in any PDI</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Table */}
      <div className="stats-table-section">
        <h3>📋 Quick Comparison</h3>
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Wattage</th>
                <th>Total</th>
                <th>MW</th>
                <th>PDI Assigned</th>
                <th>Packed</th>
                <th>Packed MW</th>
                <th>Dispatched</th>
                <th>Pending</th>
                <th>Pack %</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, idx) => (
                <tr key={idx}>
                  <td className="company-name-cell">{c.name}</td>
                  <td>{c.wattage}W</td>
                  <td>{c.master_total?.toLocaleString()}</td>
                  <td>{calculateMW(c.master_total, c.wattage)}</td>
                  <td>{c.assigned?.toLocaleString()}</td>
                  <td className="highlight-green">{c.packed?.toLocaleString()}</td>
                  <td>{calculateMW(c.packed, c.wattage)}</td>
                  <td className="highlight-blue">{(c.ext_dispatched || 0).toLocaleString()}</td>
                  <td className="highlight-orange">{c.pending_pack?.toLocaleString()}</td>
                  <td>
                    <span className={`percent-badge ${parseFloat(calcPercent(c.packed, c.assigned)) > 80 ? 'good' : parseFloat(calcPercent(c.packed, c.assigned)) > 50 ? 'medium' : 'low'}`}>
                      {calcPercent(c.packed, c.assigned)}%
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>TOTAL</strong></td>
                <td>-</td>
                <td><strong>{summary.total_master_ftr?.toLocaleString()}</strong></td>
                <td><strong>{totalMW}</strong></td>
                <td><strong>{summary.total_assigned?.toLocaleString()}</strong></td>
                <td className="highlight-green"><strong>{summary.total_packed?.toLocaleString()}</strong></td>
                <td><strong>{packedMW}</strong></td>
                <td className="highlight-blue"><strong>{summary.ext_total_dispatched?.toLocaleString()}</strong></td>
                <td className="highlight-orange"><strong>{summary.total_pending_pack?.toLocaleString()}</strong></td>
                <td>
                  <span className="percent-badge">
                    {calcPercent(summary.total_packed, summary.total_assigned)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <p>Data refreshes every 30 seconds • Click on company card for details</p>
      </div>
    </div>
  );
};

export default FTRDashboard;
