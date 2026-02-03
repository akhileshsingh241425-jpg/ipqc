import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/GraphManager.css';

const getApiEndpoint = (path) => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003';
  return API_BASE_URL.endsWith('/api') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/api${path}`;
};

const GraphManager = () => {
  const [uploadedGraphs, setUploadedGraphs] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWattage, setSelectedWattage] = useState('630');
  const [selectedModuleType, setSelectedModuleType] = useState('monofacial'); // 'monofacial' or 'bifacial'

  // Common wattages list
  const wattageOptions = ['510', '520', '530', '540', '550', '560', '580', '590', '600', '610', '625', '630', '650', '655'];
  
  // Module types
  const moduleTypeOptions = [
    { value: 'monofacial', label: 'Monofacial' },
    { value: 'bifacial', label: 'Bifacial' }
  ];

  // Check if user is super admin
  const isSuperAdmin = () => {
    return localStorage.getItem('userRole') === 'super_admin';
  };

  // Load graphs from backend on mount
  useEffect(() => {
    loadGraphsFromServer();
  }, []);

  const loadGraphsFromServer = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(getApiEndpoint('/ftr/graphs'));
      if (response.data.success) {
        setUploadedGraphs(response.data.graphs || {});
      }
    } catch (error) {
      console.error('Failed to load graphs from server:', error);
      // Fallback to localStorage for backward compatibility
      const storedGraphs = localStorage.getItem('ftr_graphs');
      if (storedGraphs) {
        try {
          setUploadedGraphs(JSON.parse(storedGraphs));
        } catch (e) {
          console.error('Failed to parse localStorage graphs:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle multiple graph uploads to server
  const handleGraphUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    
    // Create key with wattage and module type: e.g., "630_bifacial" or "630_monofacial"
    const graphKey = `${selectedWattage}_${selectedModuleType}`;
    
    try {
      const formData = new FormData();
      formData.append('wattage', graphKey); // Send combined key
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await axios.post(getApiEndpoint('/ftr/graphs/upload'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const typeLabel = selectedModuleType === 'bifacial' ? 'Bifacial' : 'Monofacial';
        alert(`✓ ${files.length} graph(s) uploaded successfully for ${selectedWattage}W (${typeLabel})!`);
        // Reload graphs from server
        await loadGraphsFromServer();
      } else {
        alert('Upload failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Delete all graphs for a wattage
  const deleteGraph = async (power) => {
    if (!window.confirm(`Delete all graphs for ${power}W?`)) return;
    
    try {
      const response = await axios.delete(getApiEndpoint(`/ftr/graphs/${power}`));
      if (response.data.success) {
        alert(response.data.message);
        await loadGraphsFromServer();
      }
    } catch (error) {
      alert('Delete failed: ' + (error.response?.data?.error || error.message));
    }
  };

  // Clear all graphs
  const clearAllGraphs = async () => {
    if (!window.confirm('Are you sure you want to delete ALL graphs?')) return;
    
    try {
      const response = await axios.delete(getApiEndpoint('/ftr/graphs/clear'));
      if (response.data.success) {
        alert(response.data.message);
        setUploadedGraphs({});
        localStorage.removeItem('ftr_graphs');
      }
    } catch (error) {
      alert('Clear failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const sortedPowers = Object.keys(uploadedGraphs).sort((a, b) => parseInt(a) - parseInt(b));

  if (isLoading) {
    return (
      <div className="graph-manager">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h3>Loading graphs...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-manager">
      <div className="graph-manager-header">
        <div>
          <h2>📊 I-V Curve Graph Manager</h2>
          <p className="subtitle">Upload and manage I-V curve graphs for all power ratings. These graphs will be automatically used in FTR report generation.</p>
        </div>
        {sortedPowers.length > 0 && isSuperAdmin() && (
          <button onClick={clearAllGraphs} className="btn-clear-all">
            🗑️ Clear All
          </button>
        )}
      </div>

      {/* Upload Section */}
      <div className="upload-section-graph">
        <div className="upload-instructions">
          <h3>📤 Upload Graph Images</h3>
          <div className="instruction-list">
            <p>• File format: PNG/JPG images</p>
            <p>• Select wattage from dropdown below</p>
            <p>• You can upload multiple files at once</p>
            <p>• Upload same wattage multiple times to add more graphs</p>
            <p>• Example: Select 630W and upload 50 different graph images</p>
            <p>• <strong>Graphs are stored on server (no storage limit!)</strong></p>
          </div>
        </div>
        
        <div className="upload-box-graph">
          <div className="wattage-selector">
            <label htmlFor="wattage-select" style={{fontSize: '16px', fontWeight: '600', color: '#1e3a8a', marginBottom: '12px', display: 'block'}}>
              Select Module Wattage:
            </label>
            <select 
              id="wattage-select"
              value={selectedWattage}
              onChange={(e) => setSelectedWattage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid #1e3a8a',
                borderRadius: '6px',
                marginBottom: '15px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {wattageOptions.map(watt => (
                <option key={watt} value={watt}>{watt}W</option>
              ))}
            </select>
            
            {/* Module Type Selection */}
            <label style={{fontSize: '16px', fontWeight: '600', color: '#1e3a8a', marginBottom: '12px', display: 'block'}}>
              Select Module Type:
            </label>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              {moduleTypeOptions.map(opt => (
                <label 
                  key={opt.value}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer',
                    padding: '10px 20px',
                    border: selectedModuleType === opt.value ? '2px solid #1565C0' : '2px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: selectedModuleType === opt.value ? '#E3F2FD' : '#fff',
                    flex: 1,
                    justifyContent: 'center'
                  }}
                >
                  <input 
                    type="radio"
                    name="moduleType"
                    value={opt.value}
                    checked={selectedModuleType === opt.value}
                    onChange={(e) => setSelectedModuleType(e.target.value)}
                  />
                  <span style={{ fontWeight: '600' }}>
                    {opt.value === 'bifacial' ? '🔄' : '◻️'} {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          <label htmlFor="graph-upload" className="upload-label">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              {isUploading ? 'Uploading...' : `Click to select graph images for ${selectedWattage}W (${selectedModuleType === 'bifacial' ? 'Bifacial' : 'Monofacial'})`}
            </div>
            <div className="upload-hint">or drag and drop here</div>
          </label>
          <input 
            id="graph-upload"
            type="file" 
            accept=".png,.jpg,.jpeg" 
            multiple 
            onChange={handleGraphUpload}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Graphs Display */}
      {sortedPowers.length > 0 ? (
        <div className="graphs-display">
          <h3>📈 Uploaded Graphs ({sortedPowers.length} configurations)</h3>
          <div className="graphs-grid">
            {sortedPowers.map(power => {
              const graphs = uploadedGraphs[power];
              const graphList = Array.isArray(graphs) ? graphs : [graphs];
              
              // Parse power key (e.g., "630_bifacial" or just "630")
              const [wattage, moduleType] = power.includes('_') ? power.split('_') : [power, 'monofacial'];
              const typeLabel = moduleType === 'bifacial' ? '🔄 Bifacial' : '◻️ Monofacial';
              
              return (
                <div key={power} className="graph-card">
                  <div className="graph-card-header">
                    <span className="power-badge">
                      {wattage}W - {typeLabel}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>({graphList.length} graphs)</span>
                    {isSuperAdmin() && (
                      <button 
                        onClick={() => deleteGraph(power)}
                        className="btn-delete"
                        title="Delete all graphs for this configuration"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="graph-preview">
                    {graphList.slice(0, 3).map((graphSrc, idx) => (
                      <div key={idx} className="graph-item">
                        <img 
                          src={graphSrc} 
                          alt={`${power}W I-V Curve #${idx + 1}`}
                          className="graph-image"
                        />
                      </div>
                    ))}
                    {graphList.length > 3 && (
                      <div className="more-graphs">+{graphList.length - 3} more</div>
                    )}
                  </div>
                  <div className="graph-card-footer">
                    <span className="graph-status">✓ Ready to use (random selection)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state-graph">
          <div className="empty-icon">📊</div>
          <h3>No Graphs Uploaded Yet</h3>
          <p>Upload I-V curve graph images to use them in FTR report generation</p>
        </div>
      )}

      {/* Usage Info */}
      <div className="usage-info">
        <h4>ℹ️ How it works</h4>
        <ul>
          <li>Upload multiple graphs for the same wattage (e.g., 50+ graphs for 630W)</li>
          <li>When generating reports, one graph will be randomly selected from the available graphs for that wattage</li>
          <li>Graphs are stored on server (no storage limit like browser!)</li>
          <li>No need to upload graphs again for each report generation</li>
        </ul>
      </div>
    </div>
  );
};

// API helper for external use
const getApiEndpointExternal = (path) => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003';
  return API_BASE_URL.endsWith('/api') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/api${path}`;
};

// Export utility function to get graphs from server
export const getStoredGraphs = async () => {
  try {
    const response = await axios.get(getApiEndpointExternal('/ftr/graphs'));
    if (response.data.success) {
      return response.data.graphs || {};
    }
    return {};
  } catch (error) {
    console.error('Failed to get graphs from server:', error);
    return {};
  }
};

// Export utility function to get random graph for a specific power and module type (returns base64 directly from server)
export const getRandomGraphForPower = async (power, moduleType = 'monofacial') => {
  const graphs = await getStoredGraphs();
  
  // Try with module type first (e.g., "630_bifacial")
  const keyWithType = `${power}_${moduleType}`;
  let powerGraphs = graphs[keyWithType];
  
  // Fallback to just wattage if module type specific not found
  if (!powerGraphs) {
    powerGraphs = graphs[power];
  }
  
  // Also try the old format without type for backward compatibility
  if (!powerGraphs) {
    // Try to find any key starting with the power
    const matchingKey = Object.keys(graphs).find(k => k.startsWith(power));
    if (matchingKey) {
      powerGraphs = graphs[matchingKey];
    }
  }
  
  if (!powerGraphs) {
    console.log('No graphs found for power:', power, 'type:', moduleType);
    return null;
  }
  
  // Handle both old format (single string) and new format (array)
  // Server now returns base64 data URLs directly
  if (typeof powerGraphs === 'string') {
    return powerGraphs;
  } else if (Array.isArray(powerGraphs) && powerGraphs.length > 0) {
    // Return random graph from array
    const randomIndex = Math.floor(Math.random() * powerGraphs.length);
    console.log(`Selected graph ${randomIndex + 1} of ${powerGraphs.length} for ${power}W (${moduleType})`);
    return powerGraphs[randomIndex];
  }
  
  return null;
};

export default GraphManager;
