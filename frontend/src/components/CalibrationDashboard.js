/**
 * Calibration Management Component
 * Manage calibration instruments with Excel upload and image support
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../services/apiService';
import '../styles/CalibrationDashboard.css';

const CalibrationDashboard = () => {
  const [instruments, setInstruments] = useState([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, due_soon: 0, overdue: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [locations, setLocations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificatePreview, setCertificatePreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [formData, setFormData] = useState({
    sr_no: '',
    instrument_id: '',
    machine_name: '',
    make: '',
    model_name: '',
    item_sr_no: '',
    range_capacity: '',
    least_count: '',
    location: '',
    calibration_agency: '',
    date_of_calibration: '',
    due_date: '',
    inspector: '',
    calibration_frequency: '1 Year',
    calibration_standards: '',
    certificate_no: '',
    notes: ''
  });

  const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5003' 
    : '';

  // Fetch instruments
  const fetchInstruments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (locationFilter !== 'all') params.append('location', locationFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(getApiUrl(`calibration/instruments?${params}`));
      const data = await response.json();

      if (data.success) {
        setInstruments(data.data);
        setStats(data.summary);
        setLocations(data.locations || []);
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to fetch instruments' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, locationFilter, searchTerm]);

  useEffect(() => {
    fetchInstruments();
  }, [fetchInstruments]);

  // Handle Excel file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(getApiUrl('calibration/upload-excel'), {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `✅ ${data.message}` });
        fetchInstruments();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Upload failed: ' + error.message });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // Handle image upload for instrument
  const handleImageUpload = async (instrumentId, file) => {
    if (!file) return;
    
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(getApiUrl(`calibration/upload-image/${instrumentId}`), {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '✅ Image uploaded successfully!' });
        fetchInstruments();
        if (selectedInstrument && selectedInstrument.id === instrumentId) {
          setSelectedInstrument(prev => ({ ...prev, image_path: data.image_path }));
        }
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Image upload failed' });
    } finally {
      setUploadingImage(false);
    }
  };

  // Delete image
  const handleDeleteImage = async (instrumentId) => {
    if (!window.confirm('Delete this image?')) return;

    try {
      const response = await fetch(getApiUrl(`calibration/delete-image/${instrumentId}`), {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '✅ Image deleted' });
        fetchInstruments();
        if (selectedInstrument && selectedInstrument.id === instrumentId) {
          setSelectedInstrument(prev => ({ ...prev, image_path: null }));
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  // Scan Certificate with OCR
  const handleScanCertificate = async (file) => {
    if (!file) return;
    
    setScanning(true);
    setMessage({ type: '', text: '' });
    setScanResult(null);
    
    const formDataUpload = new FormData();
    formDataUpload.append('certificate', file);
    
    try {
      const response = await fetch(getApiUrl('calibration/scan-certificate'), {
        method: 'POST',
        body: formDataUpload
      });
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Server returned HTML error page
        const errorText = await response.text();
        console.error('Non-JSON response:', errorText.substring(0, 200));
        
        if (response.status === 500) {
          setMessage({ type: 'error', text: '⚙️ Server error - Azure OCR/Groq AI may not be configured. Contact admin.' });
        } else if (response.status === 404) {
          setMessage({ type: 'error', text: '❌ API endpoint not found. Server may need restart.' });
        } else {
          setMessage({ type: 'error', text: `Server error (${response.status}). Check server configuration.` });
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setScanResult(data);
        
        // Auto-fill form with extracted data
        const extracted = data.data || {};
        const fieldsCount = Object.keys(extracted).length;
        
        setFormData(prev => ({
          ...prev,
          instrument_id: extracted.instrument_id || prev.instrument_id,
          machine_name: extracted.machine_name || prev.machine_name,
          make: extracted.make || prev.make,
          model_name: extracted.model_name || prev.model_name,
          item_sr_no: extracted.item_sr_no || prev.item_sr_no,
          range_capacity: extracted.range_capacity || prev.range_capacity,
          least_count: extracted.least_count || prev.least_count,
          location: extracted.location || prev.location,
          calibration_agency: extracted.calibration_agency || prev.calibration_agency,
          date_of_calibration: formatDateForInput(extracted.date_of_calibration) || prev.date_of_calibration,
          due_date: formatDateForInput(extracted.due_date) || prev.due_date,
          inspector: extracted.inspector || prev.inspector,
          calibration_frequency: extracted.calibration_frequency || prev.calibration_frequency,
          calibration_standards: extracted.calibration_standards || prev.calibration_standards,
          certificate_no: extracted.certificate_no || prev.certificate_no,
        }));
        
        // Set the certificate file for upload
        setCertificateFile(file);
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => setCertificatePreview(e.target.result);
          reader.readAsDataURL(file);
        } else {
          setCertificatePreview('pdf');
        }
        
        if (fieldsCount > 0) {
          setMessage({ type: 'success', text: `✅ Certificate scanned! ${fieldsCount} fields extracted. Please verify and save.` });
        } else {
          setMessage({ type: 'warning', text: '⚠️ OCR done but no fields extracted. Please fill manually.' });
        }
      } else {
        // API returned error
        if (data.error_type === 'config_error') {
          setMessage({ type: 'error', text: `⚙️ ${data.message}` });
        } else {
          setMessage({ type: 'error', text: data.message || 'Scan failed' });
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      if (error.message.includes('Unexpected token')) {
        setMessage({ type: 'error', text: '⚙️ Server configuration error. Azure OCR/Groq AI keys not set on server.' });
      } else {
        setMessage({ type: 'error', text: 'Scan failed: ' + error.message });
      }
    } finally {
      setScanning(false);
    }
  };
  
  // Format date string for input field
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      // Try parsing various formats
      const formats = [
        /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/,  // DD/MM/YYYY or DD-MM-YYYY
        /(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{4})/,  // DD/Mon/YYYY
        /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/,  // DD Month YYYY
      ];
      
      for (const regex of formats) {
        const match = dateStr.match(regex);
        if (match) {
          let day = match[1];
          let month = match[2];
          let year = match[3];
          
          // Convert month name to number
          const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          if (isNaN(month)) {
            const idx = monthNames.findIndex(m => month.toLowerCase().startsWith(m));
            if (idx >= 0) month = String(idx + 1).padStart(2, '0');
          }
          
          // Format as YYYY-MM-DD for input
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    } catch (e) {
      console.log('Date parse error:', e);
    }
    return '';
  };

  // Handle export
  const handleExport = async () => {
    try {
      const response = await fetch(getApiUrl('calibration/export'));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Calibration_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '✅ Export successful!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  // Download Calibration Report PDF
  const handleDownloadPDF = async () => {
    try {
      setMessage({ type: '', text: '' });
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (locationFilter !== 'all') params.append('location', locationFilter);

      const response = await fetch(getApiUrl(`calibration/generate-report?${params}`));
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        setMessage({ type: 'error', text: errData?.message || 'PDF generation failed' });
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Calibration_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '✅ Calibration Report PDF downloaded!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'PDF download failed: ' + error.message });
    }
  };

  // Handle form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle certificate file selection
  const handleCertificateSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCertificateFile(file);
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setCertificatePreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setCertificatePreview(null);
      }
    }
  };

  // Clear certificate selection
  const clearCertificate = () => {
    setCertificateFile(null);
    setCertificatePreview(null);
  };

  // Open form for new instrument
  const handleAddNew = () => {
    setEditingInstrument(null);
    setCertificateFile(null);
    setCertificatePreview(null);
    setScanResult(null);
    setFormData({
      sr_no: '',
      instrument_id: '',
      machine_name: '',
      make: '',
      model_name: '',
      item_sr_no: '',
      range_capacity: '',
      least_count: '',
      location: '',
      calibration_agency: '',
      date_of_calibration: '',
      due_date: '',
      inspector: '',
      calibration_frequency: '1 Year',
      calibration_standards: '',
      certificate_no: '',
      notes: ''
    });
    setShowForm(true);
  };

  // Open form for editing
  const handleEdit = (instrument) => {
    setEditingInstrument(instrument);
    setCertificateFile(null);
    setCertificatePreview(instrument.image_path ? `${API_BASE}/uploads/${instrument.image_path}` : null);
    setFormData({
      sr_no: instrument.sr_no || '',
      instrument_id: instrument.instrument_id || '',
      machine_name: instrument.machine_name || '',
      make: instrument.make || '',
      model_name: instrument.model_name || '',
      item_sr_no: instrument.item_sr_no || '',
      range_capacity: instrument.range_capacity || '',
      least_count: instrument.least_count || '',
      location: instrument.location || '',
      calibration_agency: instrument.calibration_agency || '',
      date_of_calibration: instrument.date_of_calibration || '',
      due_date: instrument.due_date || '',
      inspector: instrument.inspector || '',
      calibration_frequency: instrument.calibration_frequency || '1 Year',
      calibration_standards: instrument.calibration_standards || '',
      certificate_no: instrument.certificate_no || '',
      notes: instrument.notes || ''
    });
    setShowForm(true);
  };

  // Save instrument
  const handleSave = async () => {
    if (!formData.instrument_id || !formData.machine_name) {
      setMessage({ type: 'error', text: 'Instrument ID and Machine Name are required' });
      return;
    }

    setLoading(true);
    try {
      const url = editingInstrument 
        ? getApiUrl(`calibration/instruments/${editingInstrument.id}`)
        : getApiUrl('calibration/instruments');
      
      const response = await fetch(url, {
        method: editingInstrument ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (data.success) {
        // Upload certificate if selected
        if (certificateFile) {
          const instrumentId = editingInstrument ? editingInstrument.id : data.data.id;
          const uploadForm = new FormData();
          uploadForm.append('image', certificateFile);
          
          try {
            await fetch(getApiUrl(`calibration/upload-image/${instrumentId}`), {
              method: 'POST',
              body: uploadForm
            });
          } catch (uploadErr) {
            console.log('Certificate upload failed:', uploadErr);
          }
        }
        
        setMessage({ type: 'success', text: `✅ ${data.message}` });
        setShowForm(false);
        setCertificateFile(null);
        setCertificatePreview(null);
        fetchInstruments();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Save failed: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete instrument
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this instrument?')) return;

    try {
      const response = await fetch(getApiUrl(`calibration/instruments/${id}`), {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '✅ Instrument deleted' });
        fetchInstruments();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Delete failed' });
    }
  };

  // View instrument details
  const handleViewDetails = (instrument) => {
    setSelectedInstrument(instrument);
    setShowImageModal(true);
  };

  // Get status badge
  const getStatusBadge = (status, daysUntilDue) => {
    const statusConfig = {
      valid: { class: 'status-valid', label: 'Valid', icon: '✅' },
      due_soon: { class: 'status-due-soon', label: 'Due Soon', icon: '⚠️' },
      overdue: { class: 'status-overdue', label: 'Overdue', icon: '❌' },
      unknown: { class: 'status-unknown', label: 'No Date', icon: '❓' }
    };
    const config = statusConfig[status] || statusConfig.unknown;
    return (
      <span className={`cal-status-badge ${config.class}`}>
        {config.icon} {config.label}
        {daysUntilDue !== null && status !== 'unknown' && (
          <span className="cal-days-badge">
            {daysUntilDue > 0 ? `${daysUntilDue}d` : `${Math.abs(daysUntilDue)}d ago`}
          </span>
        )}
      </span>
    );
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="cal-dashboard">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <div className="cal-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div>
            <h1>Calibration Management</h1>
            <p>Track and manage instrument calibration records</p>
          </div>
        </div>
        <div className="cal-header-right">
          <label className="cal-btn cal-btn-ai">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> {scanning ? 'Scanning...' : 'AI Scan'}
            <input 
              type="file" 
              accept="image/*,.pdf" 
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setShowForm(true);
                  setEditingInstrument(null);
                  setFormData({
                    sr_no: '',
                    instrument_id: '',
                    machine_name: '',
                    make: '',
                    model_name: '',
                    item_sr_no: '',
                    range_capacity: '',
                    least_count: '',
                    location: '',
                    calibration_agency: '',
                    date_of_calibration: '',
                    due_date: '',
                    inspector: '',
                    calibration_frequency: '1 Year',
                    calibration_standards: '',
                    certificate_no: '',
                    notes: ''
                  });
                  handleScanCertificate(file);
                }
                e.target.value = '';
              }} 
              hidden 
              disabled={scanning}
            />
          </label>
          <label className="cal-btn cal-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} hidden />
          </label>
          <button className="cal-btn cal-btn-secondary" onClick={handleExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export
          </button>
          <button className="cal-btn cal-btn-danger" onClick={handleDownloadPDF}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> PDF Report
          </button>
          <button className="cal-btn cal-btn-success" onClick={handleAddNew}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add New
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="cal-stats-grid">
        <div className="cal-stat-card total">
          <div className="cal-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <div className="cal-stat-info">
            <span className="cal-stat-number">{stats.total}</span>
            <span className="cal-stat-label">Total Instruments</span>
          </div>
        </div>
        <div className="cal-stat-card valid">
          <div className="cal-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div className="cal-stat-info">
            <span className="cal-stat-number">{stats.valid}</span>
            <span className="cal-stat-label">Valid</span>
          </div>
        </div>
        <div className="cal-stat-card due-soon">
          <div className="cal-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <div className="cal-stat-info">
            <span className="cal-stat-number">{stats.due_soon}</span>
            <span className="cal-stat-label">Due Soon (30 days)</span>
          </div>
        </div>
        <div className="cal-stat-card overdue">
          <div className="cal-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="cal-stat-info">
            <span className="cal-stat-number">{stats.overdue}</span>
            <span className="cal-stat-label">Overdue</span>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`cal-alert cal-alert-${message.type}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="cal-toolbar">
        <div className="cal-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'10px',flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search by ID, Name, Make, Certificate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && <button onClick={() => setSearchTerm('')}>×</button>}
        </div>
        <div className="cal-filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="valid">Valid</option>
            <option value="due_soon">Due Soon</option>
            <option value="overdue">Overdue</option>
          </select>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="all">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <div className="cal-view-btns">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>≡</button>
            <button className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>▦</button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="cal-loading">
          <div className="cal-spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {/* Table View */}
      {!loading && viewMode === 'table' && (
        <div className="cal-table-container">
          <table className="cal-table">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Instrument ID</th>
                <th>Machine Name</th>
                <th>Make</th>
                <th>Range/Capacity</th>
                <th>Location</th>
                <th>Cal. Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Certificate</th>
                <th>Photo</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map(inst => (
                <tr key={inst.id} className={`row-${inst.status}`}>
                  <td>{inst.sr_no || '-'}</td>
                  <td><strong className="cal-id">{inst.instrument_id}</strong></td>
                  <td>{inst.machine_name}</td>
                  <td>{inst.make || '-'}</td>
                  <td>{inst.range_capacity || '-'}</td>
                  <td><span className="cal-tag">{inst.location || '-'}</span></td>
                  <td>{formatDate(inst.date_of_calibration)}</td>
                  <td>{formatDate(inst.due_date)}</td>
                  <td>{getStatusBadge(inst.status, inst.days_until_due)}</td>
                  <td>
                    {inst.image_path ? (
                      <a 
                        href={`${window.location.hostname === 'localhost' ? 'http://localhost:5003' : ''}/uploads/${inst.image_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cal-cert-link"
                        title="Click to download certificate"
                      >
                        {inst.certificate_no || 'Download'}
                      </a>
                    ) : (
                      <span className="cal-cert">{inst.certificate_no || '-'}</span>
                    )}
                  </td>
                  <td>
                    {inst.image_path ? (
                      <div className="cal-photo-actions">
                        <button className="cal-photo-btn has-photo" onClick={() => handleViewDetails(inst)} title="View Certificate">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </button>
                        <a 
                          href={`${window.location.hostname === 'localhost' ? 'http://localhost:5003' : ''}/uploads/${inst.image_path}`}
                          download
                          className="cal-photo-btn download-btn"
                          title="Download Certificate"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </a>
                        <button className="cal-photo-btn delete-photo" onClick={() => handleDeleteImage(inst.id)} title="Delete Certificate">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    ) : (
                      <label className="cal-photo-btn no-photo" title="Upload Certificate">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleImageUpload(inst.id, e.target.files[0])} hidden />
                      </label>
                    )}
                  </td>
                  <td className="cal-actions">
                    <button className="cal-action-btn view" onClick={() => handleViewDetails(inst)} title="View"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button className="cal-action-btn edit" onClick={() => handleEdit(inst)} title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button className="cal-action-btn delete" onClick={() => handleDelete(inst.id)} title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                  </td>
                </tr>
              ))}
              {instruments.length === 0 && (
                <tr>
                  <td colSpan="12" className="cal-empty">
                    <div className="cal-empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{margin:'0 auto 12px',display:'block'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                      <h3>No instruments found</h3>
                      <p>Upload an Excel file or add manually</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Cards View */}
      {!loading && viewMode === 'cards' && (
        <div className="cal-cards-grid">
          {instruments.map(inst => (
            <div key={inst.id} className={`cal-card status-${inst.status}`}>
              <div className="cal-card-top">
                <span className="cal-card-id">{inst.instrument_id}</span>
                {getStatusBadge(inst.status, inst.days_until_due)}
              </div>
              
              {inst.image_path ? (
                <div className="cal-card-img" onClick={() => handleViewDetails(inst)}>
                  <img src={`${API_BASE}/uploads/${inst.image_path}`} alt={inst.machine_name} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              ) : (
                <div className="cal-card-no-img">
                  <label>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p>Add Photo</p>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => handleImageUpload(inst.id, e.target.files[0])} hidden />
                  </label>
                </div>
              )}
              
              <div className="cal-card-content">
                <h3>{inst.machine_name}</h3>
                <div className="cal-card-details">
                  <div><span>Make:</span><strong>{inst.make || 'N/A'}</strong></div>
                  <div><span>Range:</span><strong>{inst.range_capacity || 'N/A'}</strong></div>
                  <div><span>Location:</span><strong>{inst.location || 'N/A'}</strong></div>
                  <div><span>Due:</span><strong>{formatDate(inst.due_date)}</strong></div>
                  <div><span>Certificate:</span><strong>{inst.certificate_no || 'N/A'}</strong></div>
                </div>
              </div>
              
              <div className="cal-card-actions">
                <button onClick={() => handleEdit(inst)}>Edit</button>
                <button onClick={() => handleViewDetails(inst)}>View</button>
                <button className="delete" onClick={() => handleDelete(inst.id)}>Delete</button>
              </div>
            </div>
          ))}
          {instruments.length === 0 && (
            <div className="cal-empty-cards">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{margin:'0 auto 12px',display:'block'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              <h3>No instruments found</h3>
              <p>Upload an Excel file or add manually</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="cal-modal-bg" onClick={() => setShowForm(false)}>
          <div className="cal-modal cal-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="cal-modal-head">
              <h2>{editingInstrument ? 'Edit Instrument' : 'Add New Instrument'}</h2>
              <button onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="cal-modal-body">
              {/* AI Scan Certificate Section */}
              {!editingInstrument && (
                <div className="cal-scan-section">
                  <div className="cal-scan-header">
                    <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
                    <div>
                      <h3>AI Certificate Scanner</h3>
                      <p>Upload certificate image to auto-fill all fields using AI</p>
                    </div>
                  </div>
                  <div className="cal-scan-upload">
                    <label className={`cal-scan-btn ${scanning ? 'scanning' : ''}`}>
                      {scanning ? (
                        <>
                          <div className="cal-scan-spinner"></div>
                          <span>Azure OCR + Groq AI Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>�</span>
                          <span>Scan Certificate with AI</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        onChange={(e) => handleScanCertificate(e.target.files[0])} 
                        hidden 
                        disabled={scanning}
                      />
                    </label>
                    <p className="cal-scan-hint">Supports: PNG, JPG, JPEG, PDF - Azure OCR + Groq AI extracts all data automatically!</p>
                  </div>
                  {scanResult && (
                    <div className={`cal-scan-result ${Object.keys(scanResult.data || {}).length > 0 ? 'success' : 'partial'}`}>
                      <div className="cal-scan-result-header">
                        <span>{Object.keys(scanResult.data || {}).length > 0 ? '✓' : '!'}</span>
                        <span>
                          {Object.keys(scanResult.data || {}).length > 0 
                            ? `${Object.keys(scanResult.data || {}).length} fields extracted - verify & save`
                            : 'No fields extracted - please fill manually'}
                        </span>
                      </div>
                      {Object.keys(scanResult.data || {}).length > 0 && (
                        <div className="cal-scan-fields">
                          {Object.keys(scanResult.data).map(key => (
                            <span key={key} className="cal-scan-field-tag">
                              {key.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="cal-form">
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Sr. No.</label>
                    <input type="number" name="sr_no" value={formData.sr_no} onChange={handleInputChange} />
                  </div>
                  <div className="cal-form-field">
                    <label>Instrument ID <span>*</span></label>
                    <input type="text" name="instrument_id" value={formData.instrument_id} onChange={handleInputChange} placeholder="GSPL/INS/001" required />
                  </div>
                </div>
                <div className="cal-form-row full">
                  <div className="cal-form-field">
                    <label>Machine Name <span>*</span></label>
                    <input type="text" name="machine_name" value={formData.machine_name} onChange={handleInputChange} placeholder="MEASURING TAPE" required />
                  </div>
                </div>
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Make</label>
                    <input type="text" name="make" value={formData.make} onChange={handleInputChange} placeholder="Stanlee" />
                  </div>
                  <div className="cal-form-field">
                    <label>Model Name</label>
                    <input type="text" name="model_name" value={formData.model_name} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Item Sr. No.</label>
                    <input type="text" name="item_sr_no" value={formData.item_sr_no} onChange={handleInputChange} />
                  </div>
                  <div className="cal-form-field">
                    <label>Range / Capacity</label>
                    <input type="text" name="range_capacity" value={formData.range_capacity} onChange={handleInputChange} placeholder="0 to 3 Meter" />
                  </div>
                </div>
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Least Count</label>
                    <input type="text" name="least_count" value={formData.least_count} onChange={handleInputChange} placeholder="1 mm" />
                  </div>
                  <div className="cal-form-field">
                    <label>Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="Quality" />
                  </div>
                </div>
                <div className="cal-form-row full">
                  <div className="cal-form-field">
                    <label>Calibration Agency</label>
                    <input type="text" name="calibration_agency" value={formData.calibration_agency} onChange={handleInputChange} placeholder="Qtech Calibration Laboratory" />
                  </div>
                </div>
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Calibration Date</label>
                    <input type="date" name="date_of_calibration" value={formData.date_of_calibration} onChange={handleInputChange} />
                  </div>
                  <div className="cal-form-field">
                    <label>Due Date</label>
                    <input type="date" name="due_date" value={formData.due_date} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Inspector</label>
                    <input type="text" name="inspector" value={formData.inspector} onChange={handleInputChange} placeholder="Amit Kumar" />
                  </div>
                  <div className="cal-form-field">
                    <label>Frequency</label>
                    <select name="calibration_frequency" value={formData.calibration_frequency} onChange={handleInputChange}>
                      <option value="3 Months">3 Months</option>
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                    </select>
                  </div>
                </div>
                <div className="cal-form-row full">
                  <div className="cal-form-field">
                    <label>Calibration Standards</label>
                    <input type="text" name="calibration_standards" value={formData.calibration_standards} onChange={handleInputChange} placeholder="CP/M/D/28, IS: 1269" />
                  </div>
                </div>
                <div className="cal-form-row">
                  <div className="cal-form-field">
                    <label>Certificate No.</label>
                    <input type="text" name="certificate_no" value={formData.certificate_no} onChange={handleInputChange} placeholder="QCL/2024/014633" />
                  </div>
                </div>
                <div className="cal-form-row full">
                  <div className="cal-form-field">
                    <label>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="2" />
                  </div>
                </div>

                {/* Certificate Upload Section */}
                <div className="cal-form-row full">
                  <div className="cal-form-field">
                    <label>📄 Calibration Certificate (Image/PDF)</label>
                    <div className="cal-certificate-upload">
                      {certificatePreview ? (
                        <div className="cal-cert-preview">
                          {certificateFile?.type === 'application/pdf' || (!certificateFile && certificatePreview) ? (
                            <div className="cal-cert-preview-file">
                              {certificateFile ? (
                                <>📄 {certificateFile.name}</>
                              ) : (
                                <img src={certificatePreview} alt="Certificate" className="cal-cert-thumb" />
                              )}
                            </div>
                          ) : (
                            <img src={certificatePreview} alt="Certificate Preview" className="cal-cert-thumb" />
                          )}
                          <button type="button" className="cal-cert-remove" onClick={clearCertificate}>
                            ❌ Remove
                          </button>
                        </div>
                      ) : (
                        <label className="cal-cert-dropzone">
                          <input 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={handleCertificateSelect}
                            hidden 
                          />
                          <div className="cal-cert-placeholder">
                            <span>📁</span>
                            <p>Click to upload certificate</p>
                            <small>PNG, JPG, PDF supported</small>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="cal-modal-foot">
              <button className="cal-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="cal-btn-save" onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : (editingInstrument ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image/Details Modal */}
      {showImageModal && selectedInstrument && (
        <div className="cal-modal-bg" onClick={() => setShowImageModal(false)}>
          <div className="cal-modal cal-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="cal-modal-head">
              <h2>📋 {selectedInstrument.machine_name}</h2>
              <button onClick={() => setShowImageModal(false)}>×</button>
            </div>
            <div className="cal-modal-body">
              <div className="cal-detail-layout">
                <div className="cal-detail-left">
                  {selectedInstrument.image_path ? (
                    <div className="cal-detail-img">
                      <img 
                        src={`${API_BASE}/uploads/${selectedInstrument.image_path}`} 
                        alt={selectedInstrument.machine_name}
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f0f0f0" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="60">📷</text></svg>'; }}
                      />
                      <div className="cal-img-btns">
                        <label className="cal-img-btn change">
                          🔄 Change
                          <input type="file" accept="image/*,.pdf" onChange={(e) => handleImageUpload(selectedInstrument.id, e.target.files[0])} hidden />
                        </label>
                        <button className="cal-img-btn delete" onClick={() => handleDeleteImage(selectedInstrument.id)}>🗑️ Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div className="cal-detail-no-img">
                      <span>📷</span>
                      <p>No image uploaded</p>
                      <label className="cal-upload-btn">
                        Upload Certificate/Image
                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleImageUpload(selectedInstrument.id, e.target.files[0])} hidden />
                      </label>
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="cal-upload-loading">
                      <div className="cal-spinner"></div>
                      <p>Uploading...</p>
                    </div>
                  )}
                </div>
                <div className="cal-detail-right">
                  <div className="cal-detail-item"><span>Instrument ID</span><strong>{selectedInstrument.instrument_id}</strong></div>
                  <div className="cal-detail-item"><span>Make</span><strong>{selectedInstrument.make || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Model</span><strong>{selectedInstrument.model_name || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Range/Capacity</span><strong>{selectedInstrument.range_capacity || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Least Count</span><strong>{selectedInstrument.least_count || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Location</span><strong>{selectedInstrument.location || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Agency</span><strong>{selectedInstrument.calibration_agency || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Calibration Date</span><strong>{formatDate(selectedInstrument.date_of_calibration)}</strong></div>
                  <div className="cal-detail-item"><span>Due Date</span><strong>{formatDate(selectedInstrument.due_date)}</strong></div>
                  <div className="cal-detail-item"><span>Status</span>{getStatusBadge(selectedInstrument.status, selectedInstrument.days_until_due)}</div>
                  <div className="cal-detail-item"><span>Certificate No.</span><strong>{selectedInstrument.certificate_no || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Inspector</span><strong>{selectedInstrument.inspector || 'N/A'}</strong></div>
                  <div className="cal-detail-item"><span>Frequency</span><strong>{selectedInstrument.calibration_frequency || 'N/A'}</strong></div>
                  <div className="cal-detail-item full"><span>Standards</span><strong>{selectedInstrument.calibration_standards || 'N/A'}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="cal-help">
        <span>💡</span>
        <div>
          <strong>Excel Upload Format:</strong> Sr. No., Instrument ID, Machine Name, Make, Model Name, Item Sr. No., Range / Capacity, Least Count, Location, Calibration Agency, Date of Cali., Due Date, Inspector, Cali. Fre., Calibration Standards, Certificate No.
        </div>
      </div>
    </div>
  );
};

export default CalibrationDashboard;
