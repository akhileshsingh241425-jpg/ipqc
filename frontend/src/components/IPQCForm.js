/**
 * Main IPQC Form Component
 */
import React, { useState, useEffect } from 'react';
import ipqcService from '../services/apiService';
import '../styles/IPQCForm.css';

const IPQCForm = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    shift: 'A',
    customer_id: 'GSPL/IPQC/IPC/003',
    po_number: '',
    serial_prefix: 'GS04875KG302250',
    serial_start: 1,
    module_count: 1,
    cell_manufacturer: 'Solar Space',
    cell_efficiency: '25.7',
    jb_cable_length: '1200',
    golden_module_number: 'GM-2024-001',
  });

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  // eslint-disable-next-line no-unused-vars
  const [templateInfo, setTemplateInfo] = useState(null);

  useEffect(() => {
    loadCustomers();
    loadTemplateInfo();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await ipqcService.listCustomers();
      if (response.success) {
        setCustomers(response.customers);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadTemplateInfo = async () => {
    try {
      const response = await ipqcService.getTemplateInfo();
      if (response.success) {
        setTemplateInfo(response);
      }
    } catch (error) {
      console.error('Failed to load template info:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    // Convert number inputs to integers
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? '' : parseInt(value, 10);
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleGenerateForm = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Ensure numeric fields are integers
      const requestData = {
        ...formData,
        serial_start: parseInt(formData.serial_start, 10),
        module_count: parseInt(formData.module_count, 10),
        cell_efficiency: parseFloat(formData.cell_efficiency),
        jb_cable_length: parseInt(formData.jb_cable_length, 10),
      };
      
      const response = await ipqcService.generateForm(requestData);
      if (response.success) {
        setMessage({
          type: 'success',
          text: `✅ IPQC form generated successfully! ${response.data.total_stages} stages, ${response.data.total_checkpoints} checkpoints.`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ Failed to generate form: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const requestData = {
        ...formData,
        serial_start: parseInt(formData.serial_start, 10),
        module_count: parseInt(formData.module_count, 10),
        cell_efficiency: parseFloat(formData.cell_efficiency),
        jb_cable_length: parseInt(formData.jb_cable_length, 10),
      };
      
      console.log('Generating PDF only:', requestData);
      await ipqcService.generatePDF(requestData);
      setMessage({
        type: 'success',
        text: '✅ PDF generated and downloaded successfully!',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      setMessage({
        type: 'error',
        text: `❌ Failed to generate PDF: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExcel = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const requestData = {
        ...formData,
        serial_start: parseInt(formData.serial_start, 10),
        module_count: parseInt(formData.module_count, 10),
        cell_efficiency: parseFloat(formData.cell_efficiency),
        jb_cable_length: parseInt(formData.jb_cable_length, 10),
      };
      
      console.log('Generating Excel only:', requestData);
      await ipqcService.generateExcel(requestData);
      setMessage({
        type: 'success',
        text: '✅ Excel report generated and downloaded successfully!',
      });
    } catch (error) {
      console.error('Excel generation error:', error);
      setMessage({
        type: 'error',
        text: `❌ Failed to generate Excel: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBoth = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const requestData = {
        ...formData,
        serial_start: parseInt(formData.serial_start, 10),
        module_count: parseInt(formData.module_count, 10),
        cell_efficiency: parseFloat(formData.cell_efficiency),
        jb_cable_length: parseInt(formData.jb_cable_length, 10),
      };
      
      console.log('Generating both PDF and Excel:', requestData);
      await ipqcService.generateBoth(requestData);
      setMessage({
        type: 'success',
        text: '✅ PDF and Excel reports downloaded successfully as ZIP!',
      });
    } catch (error) {
      console.error('Report generation error:', error);
      setMessage({
        type: 'error',
        text: `❌ Failed to generate reports: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ipqc-container">
      <div className="header">
        <div className="logo">
          <h1>GAUTAM</h1>
          <p>SOLAR</p>
        </div>
        <div className="title">
          <h2>IPQC Automation System</h2>
          <p>Automatic In-Process Quality Check Report Generator</p>
        </div>
      </div>



      <div className="form-card">
        <h3>Generate IPQC Report</h3>
        
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="date">
              📅 Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="shift">
              🕐 Shift <span className="required">*</span>
            </label>
            <select
              id="shift"
              name="shift"
              value={formData.shift}
              onChange={handleInputChange}
              required
            >
              <option value="A">Shift A</option>
              <option value="B">Shift B</option>
              <option value="C">Shift C</option>
            </select>
          </div>

          <div className="form-group full-width">
            <label htmlFor="customer_id">
              🏢 Customer / Document ID <span className="required">*</span>
            </label>
            <select
              id="customer_id"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleInputChange}
              required
            >
              {customers.map((customer) => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group full-width">
            <label htmlFor="po_number">
              📄 PO Number (Optional)
            </label>
            <input
              type="text"
              id="po_number"
              name="po_number"
              value={formData.po_number}
              onChange={handleInputChange}
              placeholder="Enter Purchase Order Number (Optional)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cell_manufacturer">
              🔬 Cell Manufacturer
            </label>
            <select
              id="cell_manufacturer"
              name="cell_manufacturer"
              value={formData.cell_manufacturer}
              onChange={handleInputChange}
            >
              <option value="Solar Space">Solar Space</option>
              <option value="Longi Solar">Longi Solar</option>
              <option value="Trina Solar">Trina Solar</option>
              <option value="JA Solar">JA Solar</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="cell_efficiency">
              ⚡ Cell Efficiency (%)
            </label>
            <input
              type="number"
              id="cell_efficiency"
              name="cell_efficiency"
              value={formData.cell_efficiency}
              onChange={handleInputChange}
              step="0.1"
              min="20"
              max="30"
            />
          </div>

          <div className="form-group">
            <label htmlFor="jb_cable_length">
              📏 JB Cable Length (mm)
            </label>
            <input
              type="number"
              id="jb_cable_length"
              name="jb_cable_length"
              value={formData.jb_cable_length}
              onChange={handleInputChange}
              min="800"
              max="1500"
            />
          </div>

          <div className="form-group">
            <label htmlFor="golden_module_number">
              🏅 Golden Module Number
            </label>
            <input
              type="text"
              id="golden_module_number"
              name="golden_module_number"
              value={formData.golden_module_number}
              onChange={handleInputChange}
              placeholder="GM-2024-001"
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="serial_prefix">
              🏷️ Serial Number Prefix (14 Digits) <span className="required">*</span>
            </label>
            <input
              type="text"
              id="serial_prefix"
              name="serial_prefix"
              value={formData.serial_prefix}
              onChange={handleInputChange}
              placeholder="GS04875KG302250"
              maxLength="14"
              required
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Fixed 14-digit prefix for serial numbers (e.g., GS04875KG302250)</small>
          </div>

          <div className="form-group">
            <label htmlFor="serial_start">
              🔢 Starting Counter (Last 5 Digits)
            </label>
            <input
              type="number"
              id="serial_start"
              name="serial_start"
              value={formData.serial_start}
              onChange={handleInputChange}
              min="1"
              max="99999"
            />
            <small style={{ color: '#666', fontSize: '12px' }}>Counter: 00001 to 99999</small>
          </div>

          <div className="form-group">
            <label htmlFor="module_count">
              📦 Module Count
            </label>
            <input
              type="number"
              id="module_count"
              name="module_count"
              value={formData.module_count}
              onChange={handleInputChange}
              min="1"
            />
          </div>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="button-group">
          <button
            className="btn btn-secondary"
            onClick={handleGenerateForm}
            disabled={loading || !formData.serial_prefix}
          >
            {loading ? '⏳ Generating...' : '📋 Preview Form'}
          </button>
          
          <button
            className="btn btn-primary"
            onClick={handleGeneratePDF}
            disabled={loading || !formData.serial_prefix}
          >
            {loading ? '⏳ Generating...' : '📄 Download PDF'}
          </button>

          <button
            className="btn btn-success"
            onClick={handleGenerateExcel}
            disabled={loading || !formData.serial_prefix}
          >
            {loading ? '⏳ Generating...' : '📊 Download Excel'}
          </button>

          <button
            className="btn btn-info"
            onClick={handleGenerateBoth}
            disabled={loading || !formData.serial_prefix}
          >
            {loading ? '⏳ Generating...' : '📦 Download Both (ZIP)'}
          </button>
        </div>
      </div>

      <footer className="footer">
        <p>© 2024 Gautam Solar Private Limited | IPQC Automation System v1.0</p>
      </footer>
    </div>
  );
};

export default IPQCForm;
