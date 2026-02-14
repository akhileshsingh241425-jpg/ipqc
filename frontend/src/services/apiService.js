/**
 * API Service for IPQC Backend
 * Production: Uses /api (same domain, no port conflicts)
 * Development: Uses localhost:5003
 */
import axios from 'axios';

// Smart API URL detection
const API_BASE_URL = (process.env.REACT_APP_API_URL || 
                     (window.location.hostname === 'localhost' 
                      ? 'http://localhost:5003/api' 
                      : '/api')).trim();

console.log('API_BASE_URL:', API_BASE_URL);

/**
 * Get the full API URL for fetch requests
 * @param {string} path - API endpoint path (e.g., '/master/orders')
 * @returns {string} Full API URL
 */
export const getApiUrl = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If API_BASE_URL is relative (starts with /), use it directly
  if (API_BASE_URL.startsWith('/')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  // Otherwise use the full URL
  return `${API_BASE_URL}/${cleanPath}`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const ipqcService = {
  /**
   * Health check
   */
  healthCheck: async () => {
    try {
      const response = await apiClient.get('/ipqc/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  /**
   * Generate IPQC form
   */
  generateForm: async (formData) => {
    try {
      const response = await apiClient.post('/ipqc/generate-ipqc', formData);
      return response.data;
    } catch (error) {
      console.error('Form generation failed:', error);
      throw error;
    }
  },

  /**
   * Generate and download PDF only
   */
  generatePDF: async (formData) => {
    try {
      console.log('Sending PDF request with data:', formData);
      const response = await apiClient.post('/ipqc/generate-pdf-only', formData, {
        responseType: 'blob',
      });
      
      console.log('PDF response received:', response);
      
      // Check if response is actually an error (JSON) instead of PDF
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || errorData.message || 'Unknown error');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IPQC_Report_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      console.error('PDF generation failed:', error);
      console.error('Error response:', error.response);
      
      // If error response is a blob, try to read it as JSON
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || errorData.message || 'PDF generation failed');
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
      }
      
      throw error;
    }
  },

  /**
   * Generate and download Excel only
   */
  generateExcel: async (formData) => {
    try {
      console.log('Sending Excel request with data:', formData);
      const response = await apiClient.post('/ipqc/generate-excel-only', formData, {
        responseType: 'blob',
      });
      
      console.log('Excel response received:', response);
      
      // Check if response is actually an error (JSON)
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || errorData.message || 'Unknown error');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IPQC_Report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Excel downloaded successfully' };
    } catch (error) {
      console.error('Excel generation failed:', error);
      
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || errorData.message || 'Excel generation failed');
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
      }
      
      throw error;
    }
  },

  /**
   * Generate and download both PDF and Excel as ZIP
   */
  generateBoth: async (formData) => {
    try {
      console.log('Sending request for both PDF and Excel:', formData);
      const response = await apiClient.post('/ipqc/generate-complete', formData, {
        responseType: 'blob',
      });
      
      console.log('ZIP response received:', response);
      
      // Check if response is actually an error (JSON)
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || errorData.message || 'Unknown error');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IPQC_Report_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Reports downloaded successfully' };
    } catch (error) {
      console.error('Report generation failed:', error);
      
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || errorData.message || 'Report generation failed');
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
      }
      
      throw error;
    }
  },

  /**
   * Upload BOM
   */
  uploadBOM: async (customerId, bomData) => {
    try {
      const response = await apiClient.post('/ipqc/upload-bom', {
        customer_id: customerId,
        bom_data: bomData,
      });
      return response.data;
    } catch (error) {
      console.error('BOM upload failed:', error);
      throw error;
    }
  },

  /**
   * Get BOM for customer
   */
  getBOM: async (customerId) => {
    try {
      const response = await apiClient.get(`/ipqc/get-bom/${customerId}`);
      return response.data;
    } catch (error) {
      console.error('BOM fetch failed:', error);
      throw error;
    }
  },

  /**
   * List all customers
   */
  listCustomers: async () => {
    try {
      const response = await apiClient.get('/ipqc/list-customers');
      return response.data;
    } catch (error) {
      console.error('Customer list fetch failed:', error);
      throw error;
    }
  },

  /**
   * Generate serial numbers
   */
  generateSerials: async (startNumber, count, prefix = '', padding = 5) => {
    try {
      const response = await apiClient.post('/ipqc/generate-serials', {
        start_number: startNumber,
        count: count,
        prefix: prefix,
        padding: padding,
      });
      return response.data;
    } catch (error) {
      console.error('Serial generation failed:', error);
      throw error;
    }
  },

  /**
   * Get template information
   */
  getTemplateInfo: async () => {
    try {
      const response = await apiClient.get('/ipqc/template-info');
      return response.data;
    } catch (error) {
      console.error('Template info fetch failed:', error);
      throw error;
    }
  },
};

// Company Management APIs
export const companyService = {
  /**
   * Get all companies
   */
  getAllCompanies: async () => {
    try {
      const response = await apiClient.get('/companies');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      throw error;
    }
  },

  /**
   * Get single company
   */
  getCompany: async (companyId) => {
    try {
      const response = await apiClient.get(`/companies/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch company:', error);
      throw error;
    }
  },

  /**
   * Create new company
   */
  createCompany: async (companyData) => {
    try {
      const response = await apiClient.post('/companies', companyData);
      return response.data;
    } catch (error) {
      console.error('Failed to create company:', error);
      throw error;
    }
  },

  /**
   * Update company
   */
  updateCompany: async (companyId, companyData) => {
    try {
      const response = await apiClient.put(`/companies/${companyId}`, companyData);
      return response.data;
    } catch (error) {
      console.error('Failed to update company:', error);
      throw error;
    }
  },

  /**
   * Delete company
   */
  deleteCompany: async (companyId) => {
    try {
      const response = await apiClient.delete(`/companies/${companyId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete company:', error);
      throw error;
    }
  },

  /**
   * Add production record
   */
  addProductionRecord: async (companyId, recordData) => {
    try {
      const response = await apiClient.post(`/companies/${companyId}/production`, recordData);
      return response.data;
    } catch (error) {
      console.error('Failed to add production record:', error);
      throw error;
    }
  },

  /**
   * Update production record
   */
  updateProductionRecord: async (companyId, recordId, recordData) => {
    try {
      const response = await apiClient.put(`/companies/${companyId}/production/${recordId}`, recordData);
      return response.data;
    } catch (error) {
      console.error('Failed to update production record:', error);
      throw error;
    }
  },

  /**
   * Delete production record
   */
  deleteProductionRecord: async (companyId, recordId) => {
    try {
      const response = await apiClient.delete(`/companies/${companyId}/production/${recordId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete production record:', error);
      throw error;
    }
  },

  /**
   * Add rejected module
   */
  addRejection: async (companyId, rejectionData) => {
    try {
      const response = await apiClient.post(`/companies/${companyId}/rejections`, rejectionData);
      return response.data;
    } catch (error) {
      console.error('Failed to add rejection:', error);
      throw error;
    }
  },

  /**
   * Bulk add rejections (Excel upload)
   */
  bulkAddRejections: async (companyId, rejections) => {
    try {
      const response = await apiClient.post(`/companies/${companyId}/rejections/bulk`, { rejections });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk add rejections:', error);
      throw error;
    }
  },

  /**
   * Delete rejected module
   */
  deleteRejection: async (companyId, rejectionId) => {
    try {
      const response = await apiClient.delete(`/companies/${companyId}/rejections/${rejectionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete rejection:', error);
      throw error;
    }
  },

  /**
   * Delete all rejections
   */
  deleteAllRejections: async (companyId) => {
    try {
      const response = await apiClient.delete(`/companies/${companyId}/rejections`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete all rejections:', error);
      throw error;
    }
  },
};

export default ipqcService;
