import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../services/apiService';

const FTRDeliveredUpload = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch(getApiUrl('master/orders'));
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const uploadDeliveredFTR = async () => {
    if (!selectedOrder || !file) {
      setMessage({ text: '⚠️ Please select order and Excel file', type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      return;
    }

    setUploading(true);
    setMessage({ text: '⏳ Uploading delivered FTR serials...', type: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('order_id', selectedOrder);

      const response = await fetch(getApiUrl('master/upload-delivered-ftr'), {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      let successMsg = `✅ ${data.message}`;
      if (data.warning) {
        successMsg += `\n⚠️ ${data.warning}`;
      }
      if (data.rejected_warning) {
        successMsg += `\n⚠️ ${data.rejected_warning}`;
      }

      setMessage({ text: successMsg, type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 8000);
      
      // Reset form
      setFile(null);
      document.getElementById('ftr-file-input').value = '';
      
      // Refresh orders
      fetchOrders();
      
    } catch (error) {
      console.error('Error uploading:', error);
      setMessage({ text: `❌ Error: ${error.message}`, type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    } finally {
      setUploading(false);
    }
  };

  const getOrderStats = (order) => {
    const deliveredCount = order.delivered_modules || 0;
    const rejectedCount = order.total_modules - order.remaining_modules - deliveredCount;
    const availableCount = order.remaining_modules - rejectedCount;
    
    return {
      delivered: deliveredCount,
      rejected: rejectedCount,
      available: availableCount
    };
  };

  return (
    <div className="rejection-container">
      <h1>📤 FTR Delivered Upload</h1>
      <p className="subtitle">Mark modules whose FTR has already been delivered to customer</p>

      {message.text && (
        <div className={`message ${message.type}`} style={{ whiteSpace: 'pre-line' }}>
          {message.text}
        </div>
      )}

      <div className="rejection-upload-section">
        <h2>Upload Delivered FTR Excel</h2>
        
        <div className="form-group">
          <label>Select Order *</label>
          <select 
            value={selectedOrder} 
            onChange={(e) => setSelectedOrder(e.target.value)}
            disabled={uploading}
          >
            <option value="">-- Select Order --</option>
            {orders.map(order => (
              <option key={order.id} value={order.id}>
                {order.company_name} - {order.order_number} ({order.remaining_modules.toLocaleString()} remaining)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Excel File *</label>
          <input
            id="ftr-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {file && <p className="file-name">Selected: {file.name}</p>}
        </div>

        <div className="info-box">
          <h3>📋 Excel Format:</h3>
          <ul>
            <li><strong>Column A:</strong> Serial Number (required)</li>
          </ul>
          <p><em>Example:</em></p>
          <table style={{ marginTop: '10px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ border: '1px solid #dee2e6', padding: '8px' }}>A</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>Serial Number</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>GS04890TG3002500001</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>GS04890TG3002500002</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: '10px' }}><em>✅ These serials will NOT appear in future FTR downloads</em></p>
          <p><em>⚠️ Already rejected serials will be automatically skipped</em></p>
        </div>

        <button 
          onClick={uploadDeliveredFTR} 
          className="btn-upload"
          disabled={uploading || !selectedOrder || !file}
        >
          {uploading ? '⏳ Uploading...' : '📤 Upload Delivered FTR'}
        </button>
      </div>

      <div className="orders-section">
        <h2>📦 Orders Summary</h2>
        
        {orders.length === 0 ? (
          <p className="no-data">No orders found</p>
        ) : (
          <div className="orders-grid">
            {orders.map(order => {
              const stats = getOrderStats(order);
              return (
                <div key={order.id} className="rejection-card">
                  <h3>{order.company_name}</h3>
                  <p><strong>Order #:</strong> {order.order_number}</p>
                  <p><strong>Total Modules:</strong> {order.total_modules.toLocaleString()}</p>
                  <div className="stats-grid">
                    <div className="stat-item delivered">
                      <span className="stat-label">📤 Delivered</span>
                      <span className="stat-value">{stats.delivered.toLocaleString()}</span>
                    </div>
                    <div className="stat-item rejected">
                      <span className="stat-label">🚫 Rejected</span>
                      <span className="stat-value">{stats.rejected.toLocaleString()}</span>
                    </div>
                    <div className="stat-item available">
                      <span className="stat-label">✅ Available</span>
                      <span className="stat-value">{stats.available.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="created-date">Created: {new Date(order.created_at).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FTRDeliveredUpload;
