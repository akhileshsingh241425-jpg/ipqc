import React from 'react';
import '../styles/FTRTemplate.css';

const FTRTemplate = ({ testData, graphImage }) => {
  return (
    <div className="ftr-template-page">
      {/* Header with Logo */}
      <div className="ftr-header">
        <img src="/gautam-solar-logo.jpg" alt="Gautam Solar" className="ftr-logo" />
        <div className="ftr-title">Production Testing Report</div>
      </div>

      {/* Blue bar - Top */}
      <div className="ftr-blue-bar"></div>

      {/* Main Content Grid */}
      <div className="ftr-content">
        {/* Left Column */}
        <div className="ftr-left-column">
          {/* Module Identification */}
          <div className="ftr-section">
            <div className="ftr-section-title">Module identification</div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Producer:</span>
              <span className="ftr-value">{testData.producer}</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Module type:</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label"></span>
              <span className="ftr-value">{testData.moduleType}</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">S/N:</span>
              <span className="ftr-value">{testData.serialNumber}</span>
            </div>
          </div>

          {/* Test Conditions */}
          <div className="ftr-section">
            <div className="ftr-section-title">Test conditions</div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Date:</span>
              <span className="ftr-value">{testData.testDate.replace(/-/g, '/')}</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Time:</span>
              <span className="ftr-value">{testData.testTime}</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Irradiance:</span>
              <span className="ftr-value">{testData.irradiance.toFixed(2)} W/m²</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Module temperature:</span>
              <span className="ftr-value">{testData.moduleTemp.toFixed(2)} °C</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Ambient temperature:</span>
              <span className="ftr-value">{testData.ambientTemp.toFixed(2)} °C</span>
            </div>
          </div>

          {/* Test Results */}
          <div className="ftr-section">
            <div className="ftr-section-title">Test results</div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Pmax:</span>
              <span className="ftr-value">{testData.results.pmax.toFixed(2)} W</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Vpm:</span>
              <span className="ftr-value">{testData.results.vpm.toFixed(2)} V</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Ipm:</span>
              <span className="ftr-value">{testData.results.ipm.toFixed(2)} A</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Voc:</span>
              <span className="ftr-value">{testData.results.voc.toFixed(2)} V</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Isc:</span>
              <span className="ftr-value">{testData.results.isc.toFixed(2)} A</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Fill factor:</span>
              <span className="ftr-value">{testData.results.fillFactor.toFixed(2)} %</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Rs:</span>
              <span className="ftr-value">{testData.results.rs.toFixed(2)} Ω</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Rsh:</span>
              <span className="ftr-value">{testData.results.rsh.toFixed(2)} Ω</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Module Efficiency:</span>
              <span className="ftr-value">{testData.results.efficiency.toFixed(2)} %</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="ftr-right-column">
          {/* Graph */}
          <div className="ftr-graph-container">
            {graphImage ? (
              <img src={graphImage} alt="I-V Curve" className="ftr-graph-image" />
            ) : (
              <div className="ftr-graph-placeholder">Graph not available</div>
            )}
          </div>

          {/* Reference Conditions */}
          <div className="ftr-reference-section">
            <div className="ftr-section-title">Plot & Results reference conditions</div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Irradiance:</span>
              <span className="ftr-value">1000.00 W/m²</span>
            </div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Temperature:</span>
              <span className="ftr-value">25.00 °C</span>
            </div>
          </div>

          {/* Other Info */}
          <div className="ftr-other-info">
            <div className="ftr-section-title">Other info</div>
            
            <div className="ftr-field-row">
              <span className="ftr-label">Module Area:</span>
              <span className="ftr-value">{testData.moduleArea} m²</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Blue bar - Bottom */}
      <div className="ftr-blue-bar-bottom"></div>
    </div>
  );
};

export default FTRTemplate;
