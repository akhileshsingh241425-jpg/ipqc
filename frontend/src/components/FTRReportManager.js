import React, { useState } from 'react';
import axios from 'axios';
import '../styles/FTRReportManager.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

function FTRReportManager() {
  // eslint-disable-next-line no-unused-vars
  const [excelFile, setExcelFile] = useState(null);
  const [flashData, setFlashData] = useState([]);
  const [pdiNumber, setPdiNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setExcelFile(file);
    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/coc/ftr/upload-flash-data`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setFlashData(response.data.data || []);
        setMessage(`✅ Uploaded ${response.data.count} records successfully`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const generateFlashReport = async () => {
    if (flashData.length === 0) {
      setMessage('⚠️ Please upload flash test data first');
      return;
    }

    if (!pdiNumber) {
      setMessage('⚠️ Please enter PDI Number');
      return;
    }

    setGenerating(true);
    setMessage('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/coc/ftr/generate-flash-report`,
        {
          flash_data: flashData,
          pdi_number: pdiNumber,
          order_number: orderNumber
        },
        { responseType: 'blob' }
      );

      // Download the PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Flash_Test_Report_${pdiNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage(`✅ Flash Test Report generated successfully`);
    } catch (error) {
      setMessage(`❌ Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="ftr-report-manager">
      <div className="header">
        <h1>⚡ Flash Test Report Generator</h1>
        <p>Generate IV Curve / Sun Simulator Flash Test Reports</p>
      </div>

      <div className="upload-section">
        <div className="card">
          <h3>📁 Step 1: Upload Flash Test Data (Excel)</h3>
          <p className="hint">Upload Excel file with columns: SN, ID, Pmax, Isc, Voc, Ipm, Vpm, FF, Rs, Eff</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="file-input"
          />
          {uploading && <div className="loading-small">⏳ Uploading...</div>}
          {flashData.length > 0 && (
            <div className="success-badge">
              ✅ {flashData.length} records loaded
            </div>
          )}
        </div>

        <div className="card">
          <h3>📝 Step 2: Enter Report Details</h3>
          <div className="form-group">
            <label>PDI Number *</label>
            <input
              type="text"
              value={pdiNumber}
              onChange={(e) => setPdiNumber(e.target.value)}
              placeholder="e.g., PDI-2025-001"
              className="text-input"
            />
          </div>
          <div className="form-group">
            <label>Order Number (Optional)</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g., ORD-12345"
              className="text-input"
            />
          </div>
        </div>

        <div className="card">
          <h3>📄 Step 3: Generate Report</h3>
          <button
            onClick={generateFlashReport}
            disabled={generating || flashData.length === 0}
            className="btn-generate-large"
          >
            {generating ? '⏳ Generating PDF...' : '📥 Generate Flash Test Report'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {flashData.length > 0 && (
        <div className="preview-section">
          <h3>📊 Data Preview ({flashData.length} modules)</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Serial Number</th>
                  <th>Module Type</th>
                  <th>Producer</th>
                  <th>Pmax (W)</th>
                  <th>Voc (V)</th>
                  <th>Isc (A)</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flashData.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.sn || idx + 1}</td>
                    <td>{row.serial_number || row.id || '-'}</td>
                    <td>{row.module_type || '-'}</td>
                    <td>{row.producer || '-'}</td>
                    <td>{row.pmax?.toFixed ? row.pmax.toFixed(2) : row.pmax}</td>
                    <td>{row.voc?.toFixed ? row.voc.toFixed(2) : row.voc}</td>
                    <td>{row.isc?.toFixed ? row.isc.toFixed(2) : row.isc}</td>
                    <td>{row.date || '-'}</td>
                    <td>
                      <button className="btn-edit" title="Edit">✏️</button>
                      <button className="btn-delete" title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {flashData.length > 10 && (
              <p className="preview-note">... and {flashData.length - 10} more modules</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FTRReportManager;
