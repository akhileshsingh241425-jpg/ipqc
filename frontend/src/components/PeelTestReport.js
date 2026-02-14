import React, { useState } from 'react';
import { getApiUrl } from '../services/apiService';
import '../styles/PeelTestReport.css';

const PeelTestReport = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    stringer_count: 1,  // This represents line count
    shift: 'Day'  // Day or Night shift
  });

  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);



  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateExcelReports = async () => {
    if (!formData.date || !formData.stringer_count) {
      setMessage({ text: 'Please fill all required fields!', type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      return;
    }

    setLoading(true);
    setMessage({ text: '⏳ Generating Excel reports...', type: 'info' });

    try {
      const response = await fetch(getApiUrl('peel-test/generate-excel'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate reports');
      }

      // Get filename from header or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `PeelTest_Reports_${formData.date}.xlsx`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // If multiple stringers, it will be a ZIP file
      if (formData.stringer_count > 1) {
        filename = filename.replace('.xlsx', '.zip');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const reportCount = formData.stringer_count * 2; // 2 shifts per stringer
      setMessage({ 
        text: `✅ Successfully generated ${reportCount} Excel reports! (${formData.stringer_count} stringers × 2 shifts)`, 
        type: 'success' 
      });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
      
    } catch (error) {
      console.error('Error generating Excel reports:', error);
      setMessage({ text: `❌ Error: ${error.message}`, type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="peel-test-container">
      <h1>🧪 Peel Test Report Generator</h1>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="peel-test-form">
        {/* Simple Form */}
        <div className="form-section">
          <h2>📋 Report Configuration</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Report Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Number of Lines *</label>
              <select
                name="stringer_count"
                value={formData.stringer_count}
                onChange={handleChange}
                required
              >
                <option value="1">Line 1</option>
                <option value="2">Line 2</option>
                <option value="3">Line 3</option>
              </select>
            </div>

            <div className="form-group">
              <label>Shift *</label>
              <select
                name="shift"
                value={formData.shift}
                onChange={handleChange}
                required
              >
                <option value="Day">Day Shift</option>
                <option value="Night">Night Shift</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={generateExcelReports} 
            className="btn-generate"
            disabled={loading}
          >
            {loading ? '⏳ Generating...' : '📊 Generate Excel Reports'}
          </button>
        </div>

        <div className="summary-info">
          <p>
            <strong>Line:</strong> Line {formData.stringer_count}
          </p>
          <p>
            <strong>Shift:</strong> {formData.shift} Shift
          </p>
          <p>
            <strong>Sheets per file:</strong> 12 sheets (3 stringers × 2 sides × 2 positions)
          </p>
          <p>
            <strong>Date:</strong> {new Date(formData.date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PeelTestReport;
