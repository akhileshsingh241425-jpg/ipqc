import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5003/api' 
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// MASTER ORDERS API
// ============================================================================

export const orderAPI = {
  // Get all orders
  getAll: (companyId = null) => {
    const params = companyId ? { company_id: companyId } : {};
    return api.get('/orders', { params });
  },

  // Get single order
  getById: (orderId) => api.get(`/orders/${orderId}`),

  // Create order
  create: (orderData) => api.post('/orders', orderData),

  // Update order
  update: (orderId, orderData) => api.put(`/orders/${orderId}`, orderData),

  // Delete order
  delete: (orderId) => api.delete(`/orders/${orderId}`),

  // Get order statistics
  getStats: (orderId) => api.get(`/orders/${orderId}/stats`),
};

// ============================================================================
// PDI BATCHES API
// ============================================================================

export const pdiBatchAPI = {
  // Get all PDI batches
  getAll: (orderId = null) => {
    const params = orderId ? { order_id: orderId } : {};
    return api.get('/pdi-batches', { params });
  },

  // Get single PDI batch
  getById: (batchId) => api.get(`/pdi-batches/${batchId}`),

  // Create PDI batch
  create: (batchData) => api.post('/pdi-batches', batchData),

  // Update PDI batch
  update: (batchId, batchData) => api.put(`/pdi-batches/${batchId}`, batchData),

  // Link COC to PDI
  linkCOC: (batchId, cocData) => api.post(`/pdi-batches/${batchId}/link-coc`, cocData),

  // Close PDI batch
  close: (batchId) => api.post(`/pdi-batches/${batchId}/close`),

  // Get serial numbers
  getSerials: (batchId) => api.get(`/pdi-batches/${batchId}/serials`),
};

// ============================================================================
// COC DOCUMENTS API
// ============================================================================

export const cocAPI = {
  // Get all COC documents
  getAll: (orderId = null, status = null) => {
    const params = {};
    if (orderId) params.order_id = orderId;
    if (status) params.status = status;
    return api.get('/coc-documents', { params });
  },

  // Get single COC
  getById: (cocId) => api.get(`/coc-documents/${cocId}`),

  // Create COC
  create: (cocData) => api.post('/coc-documents', cocData),

  // Update COC
  update: (cocId, cocData) => api.put(`/coc-documents/${cocId}`, cocData),

  // Delete COC
  delete: (cocId) => api.delete(`/coc-documents/${cocId}`),

  // Get COC usage history
  getUsage: (cocId) => api.get(`/coc-documents/${cocId}/usage`),

  // Get available COCs for order
  getAvailableForOrder: (orderId) => api.get(`/orders/${orderId}/available-cocs`),
};

// ============================================================================
// SERIAL NUMBERS API
// ============================================================================

export const serialAPI = {
  // Update serial status
  update: (serialId, statusData) => api.put(`/serials/${serialId}`, statusData),
};

export default api;
