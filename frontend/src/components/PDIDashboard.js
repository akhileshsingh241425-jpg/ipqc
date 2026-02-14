import React, { useState, useEffect } from 'react';

// Smart API URL helper
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

const PDIDashboard = ({ companyId, companyName }) => {
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [quickData, setQuickData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  // Load quick data first (fast)
  useEffect(() => {
    if (companyId) {
      loadQuickData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadQuickData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/ftr/pdi-dashboard-quick/${companyId}`);
      const data = await response.json();
      
      if (data.success) {
        setQuickData(data);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFullTracking = async () => {
    try {
      setTrackingLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/ftr/pdi-dashboard/${companyId}`);
      const data = await response.json();
      
      if (data.success) {
        setFullData(data);
      } else {
        setError(data.error || 'Failed to load tracking data');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '300px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '15px' }}>📊</div>
          <div style={{ fontSize: '18px' }}>Loading PDI Dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '30px', 
        background: '#ffebee', 
        borderRadius: '15px',
        border: '2px solid #f44336',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '15px' }}>❌</div>
        <div style={{ color: '#c62828', fontSize: '16px' }}>{error}</div>
        <button 
          onClick={loadQuickData}
          style={{
            marginTop: '15px',
            padding: '10px 25px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = fullData?.summary || quickData?.summary || {};
  const pdiList = quickData?.pdi_wise || [];

  return (
    <div style={{ 
      background: 'white',
      borderRadius: '20px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      marginBottom: '30px'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '25px 30px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>📦</span>
              PDI Barcode Dashboard
            </h2>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              {companyName} - Track packed, dispatched & remaining modules
            </p>
          </div>
          <button
            onClick={loadFullTracking}
            disabled={trackingLoading}
            style={{
              padding: '12px 25px',
              background: trackingLoading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '2px solid white',
              borderRadius: '10px',
              cursor: trackingLoading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s'
            }}
          >
            {trackingLoading ? '⏳ Tracking...' : '🔄 Load Live Tracking'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ padding: '25px 30px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Total Assigned */}
          <div style={{
            background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
            borderRadius: '15px',
            padding: '25px',
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 5px 20px rgba(52, 152, 219, 0.3)'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: '600' }}>
              📋 TOTAL ASSIGNED
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700' }}>
              {(summary.total_assigned || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
              Modules in PDI
            </div>
          </div>

          {/* Packed */}
          {fullData && (
            <div style={{
              background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
              borderRadius: '15px',
              padding: '25px',
              color: 'white',
              textAlign: 'center',
              boxShadow: '0 5px 20px rgba(243, 156, 18, 0.3)'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: '600' }}>
                📦 PACKED
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700' }}>
                {(summary.packed || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                {summary.packed_percent || 0}% of tracked
              </div>
            </div>
          )}

          {/* Dispatched */}
          {fullData && (
            <div style={{
              background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
              borderRadius: '15px',
              padding: '25px',
              color: 'white',
              textAlign: 'center',
              boxShadow: '0 5px 20px rgba(39, 174, 96, 0.3)'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: '600' }}>
                🚚 DISPATCHED
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700' }}>
                {(summary.dispatched || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                {summary.dispatched_percent || 0}% of tracked
              </div>
            </div>
          )}

          {/* Pending/Remaining */}
          {fullData && (
            <div style={{
              background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
              borderRadius: '15px',
              padding: '25px',
              color: 'white',
              textAlign: 'center',
              boxShadow: '0 5px 20px rgba(231, 76, 60, 0.3)'
            }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: '600' }}>
                ⏳ REMAINING
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700' }}>
                {(summary.pending || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                {summary.pending_percent || 0}% of tracked
              </div>
            </div>
          )}

          {/* PDI Count */}
          <div style={{
            background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
            borderRadius: '15px',
            padding: '25px',
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 5px 20px rgba(155, 89, 182, 0.3)'
          }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px', fontWeight: '600' }}>
              📑 PDI BATCHES
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700' }}>
              {summary.pdi_count || pdiList.length}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
              Total PDI Numbers
            </div>
          </div>
        </div>

        {/* Progress Bar (if full data loaded) */}
        {fullData && (
          <div style={{ marginBottom: '30px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              <span>📊 Tracking Progress</span>
              <span>{summary.total_tracked || 0} / {summary.total_assigned || 0} tracked</span>
            </div>
            <div style={{
              height: '25px',
              background: '#f0f0f0',
              borderRadius: '15px',
              overflow: 'hidden',
              display: 'flex'
            }}>
              {/* Dispatched */}
              <div style={{
                width: `${summary.dispatched_percent || 0}%`,
                background: 'linear-gradient(90deg, #27ae60, #2ecc71)',
                transition: 'width 0.5s'
              }} title={`Dispatched: ${summary.dispatched || 0}`}></div>
              
              {/* Packed */}
              <div style={{
                width: `${summary.packed_percent || 0}%`,
                background: 'linear-gradient(90deg, #f39c12, #e67e22)',
                transition: 'width 0.5s'
              }} title={`Packed: ${summary.packed || 0}`}></div>
              
              {/* Pending */}
              <div style={{
                width: `${summary.pending_percent || 0}%`,
                background: 'linear-gradient(90deg, #e74c3c, #c0392b)',
                transition: 'width 0.5s'
              }} title={`Pending: ${summary.pending || 0}`}></div>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '30px', 
              marginTop: '12px',
              fontSize: '12px'
            }}>
              <span><span style={{ color: '#27ae60' }}>●</span> Dispatched</span>
              <span><span style={{ color: '#f39c12' }}>●</span> Packed</span>
              <span><span style={{ color: '#e74c3c' }}>●</span> Remaining</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px',
          borderBottom: '2px solid #eee',
          paddingBottom: '10px'
        }}>
          {['summary', 'pdi-list', 'dispatched', 'packed', 'pending'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f5f5f5',
                color: activeTab === tab ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.3s'
              }}
            >
              {tab === 'summary' && '📊 Summary'}
              {tab === 'pdi-list' && '📑 PDI List'}
              {tab === 'dispatched' && '🚚 Dispatched'}
              {tab === 'packed' && '📦 Packed'}
              {tab === 'pending' && '⏳ Pending'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: '300px' }}>
          {/* PDI List Tab */}
          {activeTab === 'pdi-list' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left', fontWeight: '600' }}>#</th>
                    <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left', fontWeight: '600' }}>PDI Number</th>
                    <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center', fontWeight: '600' }}>Serial Count</th>
                    <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center', fontWeight: '600' }}>Assigned Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pdiList.map((pdi, idx) => (
                    <tr key={idx} style={{ 
                      background: idx % 2 === 0 ? '#f9f9f9' : 'white',
                      borderBottom: '1px solid #eee'
                    }}>
                      <td style={{ padding: '12px 15px', fontWeight: '500' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 15px', fontWeight: '600', color: '#667eea' }}>{pdi.pdi_number}</td>
                      <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                        <span style={{
                          background: '#e3f2fd',
                          color: '#1976d2',
                          padding: '5px 15px',
                          borderRadius: '20px',
                          fontWeight: '600'
                        }}>
                          {pdi.serial_count}
                        </span>
                      </td>
                      <td style={{ padding: '12px 15px', textAlign: 'center', color: '#666' }}>
                        {pdi.assigned_date ? new Date(pdi.assigned_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pdiList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                  <div style={{ fontSize: '40px', marginBottom: '15px' }}>📋</div>
                  <div>No PDI records found</div>
                </div>
              )}
            </div>
          )}

          {/* Dispatched Tab */}
          {activeTab === 'dispatched' && (
            <div>
              {!fullData ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                  <div style={{ fontSize: '40px', marginBottom: '15px' }}>🔄</div>
                  <div>Click "Load Live Tracking" to see dispatched modules</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)' }}>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>Serial Number</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>PDI</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center' }}>Dispatch Date</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center' }}>Vehicle No</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>Party</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fullData.recent_dispatched || []).map((item, idx) => (
                        <tr key={idx} style={{ 
                          background: idx % 2 === 0 ? '#f0fff4' : 'white',
                          borderBottom: '1px solid #e8f5e9'
                        }}>
                          <td style={{ padding: '12px 15px' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 15px', fontFamily: 'monospace', fontSize: '13px' }}>{item.serial}</td>
                          <td style={{ padding: '12px 15px', fontWeight: '600', color: '#667eea' }}>{item.pdi}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>{item.dispatch_date || '-'}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: '600' }}>{item.vehicle_no || '-'}</td>
                          <td style={{ padding: '12px 15px' }}>{item.party || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(fullData.recent_dispatched || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                      <div style={{ fontSize: '40px', marginBottom: '15px' }}>🚚</div>
                      <div>No dispatched modules found</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Packed Tab */}
          {activeTab === 'packed' && (
            <div>
              {!fullData ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                  <div style={{ fontSize: '40px', marginBottom: '15px' }}>🔄</div>
                  <div>Click "Load Live Tracking" to see packed modules</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)' }}>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>Serial Number</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>PDI</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center' }}>Packing Date</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center' }}>Box No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fullData.recent_packed || []).map((item, idx) => (
                        <tr key={idx} style={{ 
                          background: idx % 2 === 0 ? '#fff8e1' : 'white',
                          borderBottom: '1px solid #ffecb3'
                        }}>
                          <td style={{ padding: '12px 15px' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 15px', fontFamily: 'monospace', fontSize: '13px' }}>{item.serial}</td>
                          <td style={{ padding: '12px 15px', fontWeight: '600', color: '#667eea' }}>{item.pdi}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>{item.packing_date || '-'}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: '600' }}>{item.box_no || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(fullData.recent_packed || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                      <div style={{ fontSize: '40px', marginBottom: '15px' }}>📦</div>
                      <div>No packed modules found</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <div>
              {!fullData ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                  <div style={{ fontSize: '40px', marginBottom: '15px' }}>🔄</div>
                  <div>Click "Load Live Tracking" to see pending modules</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' }}>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>Serial Number</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'left' }}>PDI</th>
                        <th style={{ padding: '12px 15px', color: 'white', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(fullData.recent_pending || []).map((item, idx) => (
                        <tr key={idx} style={{ 
                          background: idx % 2 === 0 ? '#ffebee' : 'white',
                          borderBottom: '1px solid #ffcdd2'
                        }}>
                          <td style={{ padding: '12px 15px' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 15px', fontFamily: 'monospace', fontSize: '13px' }}>{item.serial}</td>
                          <td style={{ padding: '12px 15px', fontWeight: '600', color: '#667eea' }}>{item.pdi}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <span style={{
                              background: '#ffcdd2',
                              color: '#c62828',
                              padding: '5px 15px',
                              borderRadius: '20px',
                              fontWeight: '600',
                              fontSize: '12px'
                            }}>
                              ⏳ Pending
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(fullData.recent_pending || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                      <div style={{ fontSize: '40px', marginBottom: '15px' }}>✅</div>
                      <div>All modules are packed or dispatched!</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div>
              {!fullData ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '60px', 
                  background: '#f5f5f5',
                  borderRadius: '15px'
                }}>
                  <div style={{ fontSize: '60px', marginBottom: '20px' }}>📊</div>
                  <h3 style={{ color: '#333', marginBottom: '10px' }}>Load Live Tracking Data</h3>
                  <p style={{ color: '#666', marginBottom: '25px' }}>
                    Click the button above to track packed, dispatched & pending modules from external system
                  </p>
                  <button
                    onClick={loadFullTracking}
                    disabled={trackingLoading}
                    style={{
                      padding: '15px 40px',
                      background: trackingLoading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: trackingLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}
                  >
                    {trackingLoading ? '⏳ Loading...' : '🔄 Load Live Tracking'}
                  </button>
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: '20px' 
                }}>
                  {/* Dispatched Info */}
                  <div style={{
                    background: '#e8f5e9',
                    borderRadius: '15px',
                    padding: '25px',
                    border: '2px solid #4caf50'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      🚚 Dispatched Modules
                    </h4>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#1b5e20' }}>
                      {(summary.dispatched || 0).toLocaleString()}
                    </div>
                    <div style={{ color: '#388e3c', marginTop: '10px' }}>
                      {summary.dispatched_percent || 0}% of tracked modules
                    </div>
                  </div>

                  {/* Packed Info */}
                  <div style={{
                    background: '#fff3e0',
                    borderRadius: '15px',
                    padding: '25px',
                    border: '2px solid #ff9800'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      📦 Packed (In Stock)
                    </h4>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#ef6c00' }}>
                      {(summary.packed || 0).toLocaleString()}
                    </div>
                    <div style={{ color: '#f57c00', marginTop: '10px' }}>
                      {summary.packed_percent || 0}% of tracked modules
                    </div>
                  </div>

                  {/* Pending Info */}
                  <div style={{
                    background: '#ffebee',
                    borderRadius: '15px',
                    padding: '25px',
                    border: '2px solid #f44336'
                  }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#c62828', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      ⏳ Remaining (Not Packed)
                    </h4>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#b71c1c' }}>
                      {(summary.pending || 0).toLocaleString()}
                    </div>
                    <div style={{ color: '#d32f2f', marginTop: '10px' }}>
                      {summary.pending_percent || 0}% of tracked modules
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDIDashboard;
