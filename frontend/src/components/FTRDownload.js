import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../services/apiService';
import '../styles/FTRDownload.css';

const FTRDownload = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [downloadMethod, setDownloadMethod] = useState('quantity'); // 'range', 'quantity' or 'upload'
  const [serialRange, setSerialRange] = useState({ start: '', end: '' });
  const [quantityInput, setQuantityInput] = useState({ startSerial: '', quantity: '' });
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch(getApiUrl('master/orders'));
      const result = await response.json();
      if (response.ok) {
        setOrders(result.orders);
        if (result.orders.length > 0) {
          setSelectedOrder(result.orders[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const downloadFTRByQuantity = async () => {
    if (!selectedOrder || !quantityInput.startSerial || !quantityInput.quantity) {
      setMessage({ text: 'Please fill all fields!', type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      return;
    }

    setLoading(true);
    setMessage({ text: '⏳ Downloading FTR data...', type: 'info' });

    try {
      const response = await fetch(getApiUrl('master/download-ftr-by-quantity'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: parseInt(selectedOrder),
          start_serial: quantityInput.startSerial,
          quantity: parseInt(quantityInput.quantity)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download FTR data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FTR_Data_${quantityInput.quantity}_modules.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ text: `✅ Downloaded ${quantityInput.quantity} modules FTR data!`, type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);

    } catch (error) {
      console.error('Error downloading FTR:', error);
      setMessage({ text: `❌ Error: ${error.message}`, type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } finally {
      setLoading(false);
    }
  };

  const downloadFTRByRange = async () => {
    if (!selectedOrder || !serialRange.start || !serialRange.end) {
      setMessage({ text: 'Please fill all fields!', type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      return;
    }

    setLoading(true);
    setMessage({ text: '⏳ Downloading FTR data...', type: 'info' });

    try {
      const response = await fetch(getApiUrl('master/download-ftr-by-serials'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: parseInt(selectedOrder),
          serial_range: serialRange
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download FTR data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FTR_Data_${serialRange.start}_to_${serialRange.end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ text: '✅ FTR data downloaded successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);

    } catch (error) {
      console.error('Error downloading FTR:', error);
      setMessage({ text: `❌ Error: ${error.message}`, type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } finally {
      setLoading(false);
    }
  };

  const downloadFTRByFile = async () => {
    if (!selectedOrder || !file) {
      setMessage({ text: 'Please select order and upload file!', type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      return;
    }

    setLoading(true);
    setMessage({ text: '⏳ Reading serial numbers and downloading...', type: 'info' });

    try {
      // Read Excel file
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Extract serial numbers (assuming they're in first column)
          const serialNumbers = jsonData
            .slice(1) // Skip header
            .map(row => row[0])
            .filter(serial => serial && serial.toString().trim() !== '');

          if (serialNumbers.length === 0) {
            throw new Error('No serial numbers found in Excel file');
          }

          // Download FTR data
          const response = await fetch(getApiUrl('master/download-ftr-by-serials'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: parseInt(selectedOrder),
              serial_numbers: serialNumbers
            })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to download FTR data');
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `FTR_Data_${serialNumbers.length}_modules.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          setMessage({ 
            text: `✅ Downloaded FTR data for ${serialNumbers.length} modules!`, 
            type: 'success' 
          });
          setTimeout(() => setMessage({ text: '', type: '' }), 5000);

        } catch (error) {
          throw error;
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error('Error:', error);
      setMessage({ text: `❌ Error: ${error.message}`, type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ftr-download-container">
      <h1>📥 Download FTR Data</h1>
      <p className="subtitle">Download FTR data for customer shipment</p>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="download-section">
        <div className="form-group">
          <label>Select Order *</label>
          <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)}>
            <option value="">-- Select Order --</option>
            {orders.map(order => (
              <option key={order.id} value={order.id}>
                {order.company_name} - {order.order_number} ({order.total_modules.toLocaleString()} modules)
              </option>
            ))}
          </select>
        </div>

        <div className="method-selector">
          <label>
            <input
              type="radio"
              value="quantity"
              checked={downloadMethod === 'quantity'}
              onChange={(e) => setDownloadMethod(e.target.value)}
            />
            Starting Serial + Quantity
          </label>
          <label>
            <input
              type="radio"
              value="range"
              checked={downloadMethod === 'range'}
              onChange={(e) => setDownloadMethod(e.target.value)}
            />
            Serial Number Range
          </label>
          <label>
            <input
              type="radio"
              value="upload"
              checked={downloadMethod === 'upload'}
              onChange={(e) => setDownloadMethod(e.target.value)}
            />
            Upload Serial Numbers Excel
          </label>
        </div>

        {downloadMethod === 'quantity' ? (
          <div className="quantity-section">
            <h3>📊 Start Serial + Quantity</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Starting Serial Number *</label>
                <input
                  type="text"
                  value={quantityInput.startSerial}
                  onChange={(e) => setQuantityInput({ ...quantityInput, startSerial: e.target.value })}
                  placeholder="e.g., GS04890TG3002500001"
                />
              </div>
              <div className="form-group">
                <label>Quantity (How many modules) *</label>
                <input
                  type="number"
                  value={quantityInput.quantity}
                  onChange={(e) => setQuantityInput({ ...quantityInput, quantity: e.target.value })}
                  placeholder="e.g., 2832"
                  min="1"
                />
              </div>
            </div>
            <div className="info-box">
              <p>💡 <strong>Example:</strong> Starting from GS04890TG3002500001, if you enter quantity 2832, system will download 2832 modules starting from that serial.</p>
              <p>✅ Only non-rejected modules will be included</p>
            </div>
            <button onClick={downloadFTRByQuantity} className="btn-download" disabled={loading}>
              {loading ? '⏳ Downloading...' : '📥 Download FTR Data'}
            </button>
          </div>
        ) : downloadMethod === 'range' ? (
          <div className="range-section">
            <h3>📍 Serial Number Range</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Start Serial *</label>
                <input
                  type="text"
                  value={serialRange.start}
                  onChange={(e) => setSerialRange({ ...serialRange, start: e.target.value })}
                  placeholder="e.g., GS04890TG3002500001"
                />
              </div>
              <div className="form-group">
                <label>End Serial *</label>
                <input
                  type="text"
                  value={serialRange.end}
                  onChange={(e) => setSerialRange({ ...serialRange, end: e.target.value })}
                  placeholder="e.g., GS04890TG3002500100"
                />
              </div>
            </div>
            <button onClick={downloadFTRByRange} className="btn-download" disabled={loading}>
              {loading ? '⏳ Downloading...' : '📥 Download FTR Data'}
            </button>
          </div>
        ) : (
          <div className="upload-section">
            <h3>📤 Upload Serial Numbers Excel</h3>
            <div className="info-box">
              <p>📋 Excel should have serial numbers in <strong>Column A</strong></p>
              <p>Example: First row header, then serial numbers starting from row 2</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
            />
            {file && <p className="file-name">Selected: {file.name}</p>}
            <button onClick={downloadFTRByFile} className="btn-download" disabled={loading}>
              {loading ? '⏳ Processing...' : '📥 Download FTR Data'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FTRDownload;
