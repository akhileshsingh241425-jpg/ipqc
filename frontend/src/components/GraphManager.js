import React, { useState, useEffect } from 'react';
import '../styles/GraphManager.css';

const GraphManager = () => {
  const [uploadedGraphs, setUploadedGraphs] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [selectedWattage, setSelectedWattage] = useState('630');

  // Common wattages list
  const wattageOptions = ['510', '520', '530', '540', '550', '560', '580', '590', '600', '610', '625', '630', '650', '655'];

  // Check if user is super admin
  const isSuperAdmin = () => {
    return localStorage.getItem('userRole') === 'super_admin';
  };

  // Load graphs from localStorage on mount
  useEffect(() => {
    const storedGraphs = localStorage.getItem('ftr_graphs');
    if (storedGraphs) {
      try {
        setUploadedGraphs(JSON.parse(storedGraphs));
      } catch (error) {
        console.error('Failed to load stored graphs:', error);
      }
    }
  }, []);

  // Save graphs to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(uploadedGraphs).length > 0) {
      localStorage.setItem('ftr_graphs', JSON.stringify(uploadedGraphs));
    }
  }, [uploadedGraphs]);

  // Handle multiple graph uploads - NOW SUPPORTS MULTIPLE GRAPHS PER WATTAGE
  const handleGraphUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const newGraphs = { ...uploadedGraphs };
    let loadedCount = 0;

    files.forEach(file => {
      // Use selected wattage from dropdown
      const power = selectedWattage;
      const reader = new FileReader();
      reader.onload = (event) => {
        // Store as array to support multiple graphs per wattage
        if (!newGraphs[power]) {
          newGraphs[power] = [];
        }
        // If it's a single string (old format), convert to array
        if (typeof newGraphs[power] === 'string') {
          newGraphs[power] = [newGraphs[power]];
        }
        // Add new graph to the array
        newGraphs[power].push(event.target.result);
        
        loadedCount++;
        if (loadedCount === files.length) {
          setUploadedGraphs(newGraphs);
          setIsUploading(false);
          alert(`✓ ${files.length} graph(s) uploaded successfully for ${power}W!`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Delete a specific graph
  const deleteGraph = (power, index = null) => {
    const newGraphs = { ...uploadedGraphs };
    
    if (index !== null && Array.isArray(newGraphs[power])) {
      // Delete specific graph from array
      newGraphs[power].splice(index, 1);
      if (newGraphs[power].length === 0) {
        delete newGraphs[power];
      }
    } else {
      // Delete all graphs for this power
      delete newGraphs[power];
    }
    
    setUploadedGraphs(newGraphs);
    localStorage.setItem('ftr_graphs', JSON.stringify(newGraphs));
  };

  // Clear all graphs
  const clearAllGraphs = () => {
    if (window.confirm('Are you sure you want to delete all graphs?')) {
      setUploadedGraphs({});
      localStorage.removeItem('ftr_graphs');
      alert('All graphs cleared!');
    }
  };

  const sortedPowers = Object.keys(uploadedGraphs).sort((a, b) => parseInt(a) - parseInt(b));

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
            <p>• File format: PNG images only</p>
            <p>• Select wattage from dropdown below</p>
            <p>• You can upload multiple files at once</p>
            <p>• Upload same wattage multiple times to add more graphs</p>
            <p>• Example: Select 630W and upload 50 different graph images</p>
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
                marginBottom: '20px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {wattageOptions.map(watt => (
                <option key={watt} value={watt}>{watt}W</option>
              ))}
            </select>
          </div>
          
          <label htmlFor="graph-upload" className="upload-label">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              {isUploading ? 'Uploading...' : `Click to select graph images for ${selectedWattage}W`}
            </div>
            <div className="upload-hint">or drag and drop here</div>
          </label>
          <input 
            id="graph-upload"
            type="file" 
            accept=".png" 
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
          <h3>📈 Uploaded Graphs ({sortedPowers.length} wattages)</h3>
          <div className="graphs-grid">
            {sortedPowers.map(power => {
              const graphs = uploadedGraphs[power];
              const isArray = Array.isArray(graphs);
              const graphList = isArray ? graphs : [graphs];
              
              return (
                <div key={power} className="graph-card">
                  <div className="graph-card-header">
                    <span className="power-badge">
                      {power}W {isArray && `(${graphList.length} graphs)`}
                    </span>
                    {isSuperAdmin() && (
                      <button 
                        onClick={() => deleteGraph(power)}
                        className="btn-delete"
                        title="Delete all graphs for this wattage"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="graph-preview">
                    {graphList.map((graphSrc, idx) => (
                      <div key={idx} className="graph-item">
                        <img 
                          src={graphSrc} 
                          alt={`${power}W I-V Curve #${idx + 1}`}
                          className="graph-image"
                        />
                        {isSuperAdmin() && graphList.length > 1 && (
                          <button 
                            onClick={() => deleteGraph(power, idx)}
                            className="btn-delete-single"
                            title={`Delete graph #${idx + 1}`}
                          >
                            🗑️ #{idx + 1}
                          </button>
                        )}
                      </div>
                    ))}
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
          <li>Graphs are stored in your browser (persists across sessions)</li>
          <li>Upload graphs with same filename (e.g., 630.png) multiple times to add more variations</li>
          <li>No need to upload graphs again for each report generation</li>
        </ul>
      </div>
    </div>
  );
};

// Export utility function to get graphs from localStorage
export const getStoredGraphs = () => {
  try {
    const storedGraphs = localStorage.getItem('ftr_graphs');
    return storedGraphs ? JSON.parse(storedGraphs) : {};
  } catch (error) {
    console.error('Failed to get stored graphs:', error);
    return {};
  }
};

// Export utility function to get random graph for a specific power
export const getRandomGraphForPower = (power) => {
  const graphs = getStoredGraphs();
  const powerGraphs = graphs[power];
  
  if (!powerGraphs) return null;
  
  // Handle both old format (single string) and new format (array)
  if (typeof powerGraphs === 'string') {
    return powerGraphs;
  }
  
  if (Array.isArray(powerGraphs) && powerGraphs.length > 0) {
    // Return random graph from array
    const randomIndex = Math.floor(Math.random() * powerGraphs.length);
    return powerGraphs[randomIndex];
  }
  
  return null;
};

export default GraphManager;
