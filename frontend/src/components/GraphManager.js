import React, { useState, useEffect } from 'react';
import '../styles/GraphManager.css';

const GraphManager = () => {
  const [uploadedGraphs, setUploadedGraphs] = useState({});
  const [isUploading, setIsUploading] = useState(false);

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

  // Handle multiple graph uploads
  const handleGraphUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    const newGraphs = { ...uploadedGraphs };
    let loadedCount = 0;

    files.forEach(file => {
      // Extract power from filename (e.g., 510.png, 630W.png, 650_watt.png)
      const match = file.name.match(/(\d+)(?:W|_watt|w)?\.png/i);
      if (match) {
        const power = match[1];
        const reader = new FileReader();
        reader.onload = (event) => {
          newGraphs[power] = event.target.result;
          loadedCount++;
          if (loadedCount === files.length) {
            setUploadedGraphs(newGraphs);
            setIsUploading(false);
            alert(`✓ ${files.length} graph(s) uploaded successfully!`);
          }
        };
        reader.readAsDataURL(file);
      } else {
        loadedCount++;
        console.warn(`Skipped file: ${file.name} (invalid format)`);
        if (loadedCount === files.length) {
          setUploadedGraphs(newGraphs);
          setIsUploading(false);
        }
      }
    });
  };

  // Delete a specific graph
  const deleteGraph = (power) => {
    const newGraphs = { ...uploadedGraphs };
    delete newGraphs[power];
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
            <p>• Naming convention: <code>510.png</code>, <code>630.png</code>, <code>650.png</code> (power rating in filename)</p>
            <p>• You can upload multiple files at once</p>
            <p>• Already uploaded graphs will be replaced if same power rating is uploaded again</p>
          </div>
        </div>
        
        <div className="upload-box-graph">
          <label htmlFor="graph-upload" className="upload-label">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              {isUploading ? 'Uploading...' : 'Click to select graph images'}
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
          <h3>📈 Uploaded Graphs ({sortedPowers.length})</h3>
          <div className="graphs-grid">
            {sortedPowers.map(power => (
              <div key={power} className="graph-card">
                <div className="graph-card-header">
                  <span className="power-badge">{power}W</span>
                  {isSuperAdmin() && (
                    <button 
                      onClick={() => deleteGraph(power)}
                      className="btn-delete"
                      title="Delete this graph"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="graph-preview">
                  <img 
                    src={uploadedGraphs[power]} 
                    alt={`${power}W I-V Curve`}
                    className="graph-image"
                  />
                </div>
                <div className="graph-card-footer">
                  <span className="graph-status">✓ Ready to use</span>
                </div>
              </div>
            ))}
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
          <li>Upload all your I-V curve graphs here once</li>
          <li>Graphs are stored in your browser (persists across sessions)</li>
          <li>When generating FTR reports (from Test Report or PDI section), the system will automatically match and use the appropriate graph based on module power rating</li>
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

export default GraphManager;
