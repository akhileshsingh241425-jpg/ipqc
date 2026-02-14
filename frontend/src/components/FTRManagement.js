import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import '../styles/FTRManagement.css';

const FTRManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [ftrData, setFtrData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Master FTR upload
  const [uploadingMasterFTR, setUploadingMasterFTR] = useState(false);
  const [showMasterFTRModal, setShowMasterFTRModal] = useState(false);
  const [selectedMasterFile, setSelectedMasterFile] = useState(null);
  
  // View Master FTR Serials
  const [showMasterViewModal, setShowMasterViewModal] = useState(false);
  const [masterSerials, setMasterSerials] = useState([]);
  const [masterSearchTerm, setMasterSearchTerm] = useState('');
  const [loadingMasterView, setLoadingMasterView] = useState(false);
  const [masterPage, setMasterPage] = useState(1);
  const [masterTotalPages, setMasterTotalPages] = useState(1);
  const [masterTotal, setMasterTotal] = useState(0);
  const PAGE_SIZE = 100;
  
  // Rejection upload (NEW)
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [uploadingRejection, setUploadingRejection] = useState(false);
  const [selectedRejectionFile, setSelectedRejectionFile] = useState(null);
  const [rejectionType, setRejectionType] = useState('normal'); // 'normal' or 'special'
  const [specialRejectionReason, setSpecialRejectionReason] = useState('');
  const [specialRejectionStage, setSpecialRejectionStage] = useState('Visual Inspection');
  const [specialRejectionRemarks, setSpecialRejectionRemarks] = useState('');
  
  // View Rejection Serials
  const [showRejectionViewModal, setShowRejectionViewModal] = useState(false);
  const [rejectionSerials, setRejectionSerials] = useState([]);
  const [rejectionSearchTerm, setRejectionSearchTerm] = useState('');
  const [loadingRejectionView, setLoadingRejectionView] = useState(false);
  const [rejectionPage, setRejectionPage] = useState(1);
  const [rejectionTotalPages, setRejectionTotalPages] = useState(1);
  const [rejectionTotal, setRejectionTotal] = useState(0);
  
  // PDI serial assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPdiForAssign, setSelectedPdiForAssign] = useState(null);
  const [serialsToAssign, setSerialsToAssign] = useState('');
  const [uploadingPdiSerials, setUploadingPdiSerials] = useState(false);
  const [selectedPdiFile, setSelectedPdiFile] = useState(null);
  const [pdiUploadProgress, setPdiUploadProgress] = useState(0);
  const [pdiUploadStatus, setPdiUploadStatus] = useState('');
  
  // Actual packed modules upload
  const [showPackedModal, setShowPackedModal] = useState(false);
  const [uploadingPacked, setUploadingPacked] = useState(false);
  const [selectedPackedFile, setSelectedPackedFile] = useState(null);

  // View PDI Assigned Serials
  const [showPdiSerialsModal, setShowPdiSerialsModal] = useState(false);
  const [pdiSerials, setPdiSerials] = useState([]);
  const [selectedPdiNumber, setSelectedPdiNumber] = useState('');
  const [loadingPdiSerials, setLoadingPdiSerials] = useState(false);
  const [pdiSerialsPage, setPdiSerialsPage] = useState(1);
  const [pdiSerialsTotal, setPdiSerialsTotal] = useState(0);
  const [pdiSerialsTotalPages, setPdiSerialsTotalPages] = useState(1);
  const [pdiSerialsSearch, setPdiSerialsSearch] = useState('');

  const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/companies`);
      setCompanies(response.data || []);
    } catch (error) {
      console.error('Failed to load companies:', error);
      alert('❌ Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const loadFTRData = async (companyId) => {
    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/ftr/company/${companyId}`);
      setFtrData(response.data);
      setSelectedCompany(companies.find(c => c.id === companyId));
    } catch (error) {
      console.error('Failed to load FTR data:', error);
      setFtrData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMasterFTRFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedMasterFile(file);
    }
  };

  const handleMasterFTRUpload = async () => {
    if (!selectedMasterFile) return;

    try {
      setUploadingMasterFTR(true);
      const file = selectedMasterFile;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Get header row to find column indices
          const headers = jsonData[0] || [];
          const headerLower = headers.map(h => String(h || '').toLowerCase().trim());
          
          // Find column indices
          const idCol = headerLower.findIndex(h => h === 'id' || h === 'serial' || h === 'serial_number' || h === 'barcode');
          const pmaxCol = headerLower.findIndex(h => h === 'pmax' || h === 'power' || h === 'watt');
          const binningCol = headerLower.findIndex(h => h === 'binning' || h === 'bin' || h === 'current_bin');
          const classCol = headerLower.findIndex(h => h === 'class' || h === 'status' || h === 'class_status' || h === 'result');
          
          // Extract serial numbers with details
          const serialNumbers = [];
          let okCount = 0;
          let rejectedCount = 0;
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const serialNum = idCol >= 0 ? row[idCol] : row[0];
            
            if (serialNum) {
              const classStatus = classCol >= 0 ? String(row[classCol] || 'OK').toUpperCase().trim() : 'OK';
              const isRejected = ['REJECTED', 'REJECT', 'REJ', 'NG', 'FAIL'].includes(classStatus);
              
              if (isRejected) rejectedCount++;
              else okCount++;
              
              serialNumbers.push({
                serial_number: String(serialNum).trim(),
                pmax: pmaxCol >= 0 ? parseFloat(row[pmaxCol]) || null : null,
                binning: binningCol >= 0 ? String(row[binningCol] || '').trim() : null,
                class_status: isRejected ? 'REJECTED' : 'OK'
              });
            }
          }
          
          if (serialNumbers.length === 0) {
            alert('❌ No serial numbers found in Excel file');
            return;
          }
          
          // Show confirmation with breakdown
          const confirmMsg = `Upload Summary:\n\n✅ OK: ${okCount}\n❌ Rejected: ${rejectedCount}\n📊 Total: ${serialNumbers.length}\n\nProceed with upload?`;
          if (!window.confirm(confirmMsg)) {
            setUploadingMasterFTR(false);
            return;
          }
          
          // Upload to backend
          const API_BASE_URL = getAPIBaseURL();
          const response = await axios.post(`${API_BASE_URL}/api/ftr/master`, {
            company_id: selectedCompany.id,
            serial_numbers: serialNumbers,
            file_name: file.name
          });
          
          if (response.data.success) {
            alert(`✅ Master FTR uploaded!\n\n📊 Total: ${response.data.count}\n✅ OK: ${response.data.ok_count}\n❌ Rejected: ${response.data.rejected_count}`);
            loadFTRData(selectedCompany.id);
            setShowMasterFTRModal(false);
            setSelectedMasterFile(null);
          }
        } catch (error) {
          console.error('Failed to process Excel:', error);
          alert('❌ Failed to process Master FTR Excel file');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Failed to upload Master FTR:', error);
      alert('❌ Failed to upload Master FTR');
    } finally {
      setUploadingMasterFTR(false);
    }
  };

  // Rejection Upload Handler
  const handleRejectionFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedRejectionFile(file);
    }
  };

  const handleRejectionUpload = async () => {
    if (!selectedRejectionFile) return;
    
    // Special rejection requires reason
    if (rejectionType === 'special' && !specialRejectionReason.trim()) {
      alert('❌ Special Rejection requires a reason!');
      return;
    }

    try {
      setUploadingRejection(true);
      const file = selectedRejectionFile;
      const API_BASE_URL = getAPIBaseURL();
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Get header row to find column indices
          const headers = jsonData[0] || [];
          const headerLower = headers.map(h => String(h || '').toLowerCase().trim());
          
          // Find ID/Barcode column
          const idCol = headerLower.findIndex(h => 
            h === 'id' || h === 'serial' || h === 'serial_number' || h === 'barcode' || 
            h === 'module_id' || h === 'sr' || h === 'sr.no' || h === 'sn'
          );
          
          if (idCol === -1) {
            alert('❌ No ID/Barcode column found!\n\nPlease ensure your Excel has one of these columns:\nID, Serial, Serial_Number, Barcode');
            return;
          }
          
          // Extract serial numbers
          const serialNumbers = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row[idCol]) {
              serialNumbers.push(String(row[idCol]).trim());
            }
          }
          
          if (serialNumbers.length === 0) {
            alert('❌ No barcodes found in the file!');
            return;
          }
          
          // Build request data based on rejection type
          const requestData = {
            company_id: selectedCompany.id,
            serial_numbers: serialNumbers,
            file_name: file.name,
            rejection_type: rejectionType
          };
          
          // Add special rejection details
          if (rejectionType === 'special') {
            requestData.reason = specialRejectionReason;
            requestData.stage = specialRejectionStage;
            requestData.remarks = specialRejectionRemarks;
          }
          
          // Upload to rejection API
          const response = await axios.post(`${API_BASE_URL}/api/ftr/rejection`, requestData);
          
          if (response.data.success) {
            const typeLabel = rejectionType === 'special' ? '🔴 SPECIAL' : '⚪ Normal';
            alert(`✅ ${typeLabel} Rejection Uploaded!\n\n❌ Marked as REJECTED: ${response.data.updated_count}\n⚠️ Already Rejected: ${response.data.already_rejected}\n🆕 New Entries: ${response.data.new_entries}`);
            loadFTRData(selectedCompany.id);
            setShowRejectionModal(false);
            setSelectedRejectionFile(null);
            // Reset special rejection fields
            setRejectionType('normal');
            setSpecialRejectionReason('');
            setSpecialRejectionStage('Visual Inspection');
            setSpecialRejectionRemarks('');
          }
        } catch (error) {
          console.error('Failed to process Rejection Excel:', error);
          alert('❌ Failed to process Rejection Excel file');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Failed to upload Rejection data:', error);
      alert('❌ Failed to upload Rejection data');
    } finally {
      setUploadingRejection(false);
    }
  };


  // Load Master FTR Serials
  const loadMasterSerials = async (search = '', page = 1) => {
    if (!selectedCompany) return;
    
    try {
      setLoadingMasterView(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(
        `${API_BASE_URL}/api/ftr/master-serials/${selectedCompany.id}?search=${encodeURIComponent(search)}&page=${page}&page_size=${PAGE_SIZE}`
      );
      
      if (response.data.success) {
        setMasterSerials(response.data.serials);
        setMasterTotal(response.data.total);
        setMasterPage(response.data.page);
        setMasterTotalPages(Math.ceil(response.data.total / PAGE_SIZE));
      }
    } catch (error) {
      console.error('Failed to load master serials:', error);
      alert('❌ Failed to load master serials');
    } finally {
      setLoadingMasterView(false);
    }
  };

  // Load PDI Assigned Serials
  const loadPdiSerials = async (pdiNumber, search = '', page = 1) => {
    if (!selectedCompany || !pdiNumber) return;
    
    try {
      setLoadingPdiSerials(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(
        `${API_BASE_URL}/api/ftr/pdi-serials/${selectedCompany.id}/${encodeURIComponent(pdiNumber)}?search=${encodeURIComponent(search)}&page=${page}&page_size=${PAGE_SIZE}`
      );
      
      if (response.data.success) {
        setPdiSerials(response.data.serials);
        setPdiSerialsTotal(response.data.total);
        setPdiSerialsPage(response.data.page);
        setPdiSerialsTotalPages(Math.ceil(response.data.total / PAGE_SIZE));
      }
    } catch (error) {
      console.error('Failed to load PDI serials:', error);
      alert('❌ Failed to load PDI serials');
    } finally {
      setLoadingPdiSerials(false);
    }
  };

  // Load Rejection Serials
  const loadRejectionSerials = async (search = '', page = 1) => {
    if (!selectedCompany) return;
    
    try {
      setLoadingRejectionView(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(
        `${API_BASE_URL}/api/ftr/rejection-serials/${selectedCompany.id}?search=${encodeURIComponent(search)}&page=${page}&page_size=${PAGE_SIZE}`
      );
      
      if (response.data.success) {
        setRejectionSerials(response.data.serials);
        setRejectionTotal(response.data.total);
        setRejectionPage(response.data.page);
        setRejectionTotalPages(Math.ceil(response.data.total / PAGE_SIZE));
      }
    } catch (error) {
      console.error('Failed to load rejection serials:', error);
      alert('❌ Failed to load rejection serials');
    } finally {
      setLoadingRejectionView(false);
    }
  };

  const handleAssignSerials = async () => {
    if (!selectedPdiForAssign || !serialsToAssign) {
      alert('❌ Please enter number of serials to assign');
      return;
    }

    const count = parseInt(serialsToAssign);
    if (isNaN(count) || count <= 0) {
      alert('❌ Invalid number');
      return;
    }

    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ftr/assign`, {
        company_id: selectedCompany.id,
        pdi_number: selectedPdiForAssign,
        count: count
      });
      
      if (response.data.success) {
        alert(`✅ ${count} serial numbers assigned to ${selectedPdiForAssign}`);
        loadFTRData(selectedCompany.id);
        setShowAssignModal(false);
        setSerialsToAssign('');
        setSelectedPdiForAssign(null);
      } else {
        alert(`❌ ${response.data.message || 'Failed to assign serials'}`);
      }
    } catch (error) {
      console.error('Failed to assign serials:', error);
      alert('❌ Failed to assign serial numbers');
    } finally {
      setLoading(false);
    }
  };

  const handlePdiSerialsFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPdiFile(file);
    }
  };

  const handlePdiSerialsUpload = async () => {
    if (!selectedPdiFile || !selectedPdiForAssign) return;

    try {
      setUploadingPdiSerials(true);
      setPdiUploadProgress(0);
      setPdiUploadStatus('📖 Reading Excel file...');
      const file = selectedPdiFile;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setPdiUploadProgress(10);
          setPdiUploadStatus('📊 Parsing Excel data...');
          
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          setPdiUploadProgress(20);
          setPdiUploadStatus('🔍 Extracting barcodes...');
          
          // Extract serial numbers (first column)
          const serialNumbers = [];
          for (let i = 1; i < jsonData.length; i++) {
            if (jsonData[i][0]) {
              serialNumbers.push(String(jsonData[i][0]).trim());
            }
          }
          
          if (serialNumbers.length === 0) {
            alert('❌ No serial numbers found in Excel');
            setUploadingPdiSerials(false);
            setPdiUploadProgress(0);
            setPdiUploadStatus('');
            return;
          }
          
          setPdiUploadProgress(30);
          setPdiUploadStatus(`📤 Uploading ${serialNumbers.length} barcodes...`);
          
          // Upload to backend in batches for progress tracking
          const API_BASE_URL = getAPIBaseURL();
          const BATCH_SIZE = 500;
          const totalBatches = Math.ceil(serialNumbers.length / BATCH_SIZE);
          let uploadedCount = 0;
          let failedCount = 0;
          
          for (let i = 0; i < totalBatches; i++) {
            const batch = serialNumbers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
            const progress = 30 + Math.floor((i / totalBatches) * 60);
            setPdiUploadProgress(progress);
            setPdiUploadStatus(`📤 Uploading batch ${i + 1}/${totalBatches} (${uploadedCount}/${serialNumbers.length})...`);
            
            try {
              const response = await axios.post(`${API_BASE_URL}/api/ftr/assign-excel`, {
                company_id: selectedCompany.id,
                pdi_number: selectedPdiForAssign,
                serial_numbers: batch
              });
              
              if (response.data.success) {
                uploadedCount += batch.length;
              } else {
                failedCount += batch.length;
              }
            } catch (batchError) {
              console.error(`Batch ${i + 1} failed:`, batchError);
              failedCount += batch.length;
            }
          }
          
          setPdiUploadProgress(95);
          setPdiUploadStatus('✅ Finalizing...');
          
          setTimeout(() => {
            setPdiUploadProgress(100);
            setPdiUploadStatus('🎉 Complete!');
            
            if (failedCount === 0) {
              alert(`✅ ${uploadedCount} barcodes assigned to ${selectedPdiForAssign}`);
            } else {
              alert(`⚠️ Uploaded: ${uploadedCount}, Failed: ${failedCount}`);
            }
            
            loadFTRData(selectedCompany.id);
            setShowAssignModal(false);
            setSelectedPdiForAssign(null);
            setSelectedPdiFile(null);
            setPdiUploadProgress(0);
            setPdiUploadStatus('');
            setUploadingPdiSerials(false);
          }, 500);
          
        } catch (error) {
          console.error('Failed to process Excel:', error);
          alert('❌ Failed to process barcode Excel file');
          setPdiUploadProgress(0);
          setPdiUploadStatus('');
          setUploadingPdiSerials(false);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Failed to upload PDI barcodes:', error);
      alert('❌ Failed to upload PDI barcodes');
      setPdiUploadProgress(0);
      setPdiUploadStatus('');
      setUploadingPdiSerials(false);
    }
  };

  const handlePackedFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPackedFile(file);
    }
  };

  const handlePackedUpload = async () => {
    if (!selectedPackedFile) return;

    try {
      setUploadingPacked(true);
      const file = selectedPackedFile;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          const packedSerials = [];
          for (let i = 1; i < jsonData.length; i++) {
            if (jsonData[i][0]) {
              packedSerials.push(String(jsonData[i][0]).trim());
            }
          }
          
          if (packedSerials.length === 0) {
            alert('❌ No serial numbers found');
            return;
          }
          
          const API_BASE_URL = getAPIBaseURL();
          const response = await axios.post(`${API_BASE_URL}/api/ftr/packed`, {
            company_id: selectedCompany.id,
            serial_numbers: packedSerials
          });
          
          if (response.data.success) {
            alert(`✅ Packed modules uploaded: ${packedSerials.length} serials`);
            loadFTRData(selectedCompany.id);
            setShowPackedModal(false);
            setSelectedPackedFile(null);
          }
        } catch (error) {
          console.error('Failed to process packed Excel:', error);
          alert('❌ Failed to process packed modules Excel');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Failed to upload packed modules:', error);
      alert('❌ Failed to upload packed modules');
    } finally {
      setUploadingPacked(false);
    }
  };

  const renderDashboard = () => {
    if (!ftrData) return null;

    const totalMaster = ftrData.master_count || 0;
    const totalAssigned = ftrData.total_assigned || 0;
    const totalPacked = ftrData.packed_count || 0;
    // Use backend's available_count if provided, else calculate
    const available = ftrData.available_count !== undefined ? ftrData.available_count : (totalMaster - totalAssigned);
    const unpackedAssigned = totalAssigned - totalPacked;

    return (
      <div className="ftr-dashboard">
        <div className="ftr-stat-card master">
          <h3>Master FTR</h3>
          <div className="stat-number">{totalMaster.toLocaleString()}</div>
          <p>Total Serial Numbers</p>
        </div>
        
        <div className="ftr-stat-card assigned">
          <h3>Assigned to PDIs</h3>
          <div className="stat-number">{totalAssigned.toLocaleString()}</div>
          <p>Used in {ftrData.pdi_assignments?.length || 0} PDIs</p>
        </div>
        
        <div className="ftr-stat-card packed">
          <h3>Actually Packed</h3>
          <div className="stat-number">{totalPacked.toLocaleString()}</div>
          <p>Modules Packed</p>
        </div>
        
        <div className="ftr-stat-card available">
          <h3>Available</h3>
          <div className="stat-number">{available.toLocaleString()}</div>
          <p>For Next PDI</p>
        </div>
        
        <div className="ftr-stat-card unpacked">
          <h3>Unpacked Assigned</h3>
          <div className="stat-number">{unpackedAssigned.toLocaleString()}</div>
          <p>Assigned but Not Packed</p>
        </div>
      </div>
    );
  };

  const renderPDITable = () => {
    if (!ftrData || !ftrData.pdi_assignments) return null;

    return (
      <div className="pdi-table-container">
        <h3>PDI-wise Serial Number Assignment</h3>
        <table className="pdi-table">
          <thead>
            <tr>
              <th>PDI Number</th>
              <th>Assigned Serials</th>
              <th>Date Assigned</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ftrData.pdi_assignments.map((pdi, idx) => (
              <tr key={idx}>
                <td>{pdi.pdi_number}</td>
                <td>{pdi.count.toLocaleString()}</td>
                <td>{new Date(pdi.date).toLocaleDateString()}</td>
                <td>
                  <button 
                    className="btn-view"
                    onClick={() => {
                      setSelectedPdiNumber(pdi.pdi_number);
                      setPdiSerialsSearch('');
                      setPdiSerialsPage(1);
                      setShowPdiSerialsModal(true);
                      loadPdiSerials(pdi.pdi_number, '', 1);
                    }}
                  >
                    View Serials
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="ftr-management-container">
      <div className="ftr-header">
        <h1>🏭 FTR Management System</h1>
        <button className="btn-back" onClick={() => window.location.href = '/'}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Company Selection */}
      <div className="company-selection">
        <h2>Select Company</h2>
        <div className="company-grid">
          {companies.map(company => {
            // Get unique PDI count
            const uniquePDIs = company.productionRecords 
              ? [...new Set(company.productionRecords.map(r => r.pdi))].filter(Boolean).length 
              : 0;
            
            return (
              <div 
                key={company.id}
                className={`company-card ${selectedCompany?.id === company.id ? 'active' : ''}`}
                onClick={() => loadFTRData(company.id)}
              >
                <h3>{company.companyName}</h3>
                <p>{company.moduleWattage}</p>
                <p style={{fontSize: '12px', marginTop: '5px', opacity: 0.9}}>
                  📋 {uniquePDIs} PDI{uniquePDIs !== 1 ? 's' : ''}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FTR Dashboard */}
      {selectedCompany && (
        <>
          <div className="ftr-actions">
            <button 
              className="btn-upload-master"
              onClick={() => setShowMasterFTRModal(true)}
            >
              📤 Upload Master FTR
            </button>
            
            <button 
              className="btn-view-master"
              onClick={() => {
                setShowMasterViewModal(true);
                loadMasterSerials();
              }}
              style={{ background: 'linear-gradient(135deg, #17a2b8, #138496)' }}
            >
              👁️ View Master Serials
            </button>
            
            <button 
              className="btn-rejection"
              onClick={() => setShowRejectionModal(true)}
              style={{ background: 'linear-gradient(135deg, #dc3545, #c82333)' }}
            >
              ❌ Upload Rejection
            </button>
            
            <button 
              className="btn-view-rejection"
              onClick={() => {
                setShowRejectionViewModal(true);
                loadRejectionSerials();
              }}
              style={{ background: 'linear-gradient(135deg, #fd7e14, #e66a00)' }}
            >
              🔍 View Rejections
            </button>
            
            <button 
              className="btn-assign"
              onClick={() => setShowAssignModal(true)}
            >
              📋 Assign to PDI
            </button>
            
            <button 
              className="btn-packed"
              onClick={() => setShowPackedModal(true)}
            >
              📦 Upload Packed Modules
            </button>
          </div>

          {renderDashboard()}
          {renderPDITable()}
        </>
      )}

      {/* Master FTR Upload Modal */}
      {showMasterFTRModal && (
        <div className="modal-overlay" onClick={() => setShowMasterFTRModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#667eea',
              marginBottom: '10px'
            }}>
              📤 Upload Master FTR
            </h2>
            <p style={{color: '#666', fontSize: '14px', marginBottom: '20px'}}>
              Upload Excel file with serial numbers in first column
            </p>
            
            <div style={{
              border: '3px dashed #667eea',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              marginBottom: '20px',
              transition: 'all 0.3s'
            }}>
              <div style={{fontSize: '48px', marginBottom: '15px'}}>📊</div>
              <p style={{fontWeight: '600', fontSize: '16px', marginBottom: '10px', color: '#333'}}>
                {selectedMasterFile ? '✅ File Selected' : 'Choose Excel File'}
              </p>
              {selectedMasterFile && (
                <p style={{fontSize: '13px', color: '#667eea', marginBottom: '15px', fontWeight: '600'}}>
                  📄 {selectedMasterFile.name}
                </p>
              )}
              <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
                Column A should contain serial numbers
              </p>
              <input 
                type="file" 
                accept=".xlsx,.xls"
                onChange={handleMasterFTRFileSelect}
                disabled={uploadingMasterFTR}
                style={{
                  display: 'block',
                  margin: '0 auto',
                  padding: '10px 20px',
                  background: 'white',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              />
            </div>

            {uploadingMasterFTR && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                background: '#f0f4ff',
                borderRadius: '8px'
              }}>
                <p style={{color: '#667eea', fontWeight: '600', marginBottom: '10px', textAlign: 'center'}}>
                  ⏳ Uploading Master FTR...
                </p>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#e0e0e0',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    animation: 'loading 1.5s infinite'
                  }}></div>
                </div>
              </div>
            )}
            
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                onClick={handleMasterFTRUpload}
                disabled={!selectedMasterFile || uploadingMasterFTR}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: (!selectedMasterFile || uploadingMasterFTR) ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!selectedMasterFile || uploadingMasterFTR) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {uploadingMasterFTR ? '⏳ Uploading...' : '📤 Upload'}
              </button>
              <button 
                onClick={() => {
                  setShowMasterFTRModal(false);
                  setSelectedMasterFile(null);
                }}
                disabled={uploadingMasterFTR}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploadingMasterFTR ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Upload Modal */}
      {showRejectionModal && (
        <div className="modal-overlay" onClick={() => setShowRejectionModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '550px'}}>
            <h2 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#dc3545',
              marginBottom: '10px'
            }}>
              ❌ Upload Rejection Data
            </h2>
            <p style={{ color: '#999', marginBottom: '20px', fontSize: '14px' }}>
              Company: <strong style={{color: '#dc3545'}}>{selectedCompany?.companyName}</strong>
            </p>
            
            {/* Rejection Type Selector */}
            <div style={{marginBottom: '20px', display: 'flex', gap: '10px'}}>
              <button
                onClick={() => setRejectionType('normal')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: rejectionType === 'normal' ? 'linear-gradient(135deg, #6c757d, #5a6268)' : '#f5f5f5',
                  color: rejectionType === 'normal' ? 'white' : '#333',
                  border: rejectionType === 'normal' ? 'none' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                ⚪ Normal Rejection
              </button>
              <button
                onClick={() => setRejectionType('special')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: rejectionType === 'special' ? 'linear-gradient(135deg, #dc3545, #c82333)' : '#f5f5f5',
                  color: rejectionType === 'special' ? 'white' : '#333',
                  border: rejectionType === 'special' ? 'none' : '2px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                🔴 Special Rejection
              </button>
            </div>
            
            {/* Special Rejection Details */}
            {rejectionType === 'special' && (
              <div style={{
                background: '#fff5f5',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '20px',
                border: '2px solid #dc3545'
              }}>
                <h4 style={{color: '#dc3545', marginBottom: '12px', fontSize: '14px'}}>🔴 Special Rejection Details</h4>
                
                <div style={{marginBottom: '12px'}}>
                  <label style={{display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px'}}>
                    Reason <span style={{color: 'red'}}>*</span>
                  </label>
                  <select
                    value={specialRejectionReason}
                    onChange={(e) => setSpecialRejectionReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">-- Select Reason --</option>
                    <option value="Cell Crack">Cell Crack</option>
                    <option value="Micro Crack">Micro Crack</option>
                    <option value="Hot Spot">Hot Spot</option>
                    <option value="Broken Glass">Broken Glass</option>
                    <option value="Junction Box Issue">Junction Box Issue</option>
                    <option value="Frame Damage">Frame Damage</option>
                    <option value="EVA Yellowing">EVA Yellowing</option>
                    <option value="Backsheet Damage">Backsheet Damage</option>
                    <option value="Visual Defect">Visual Defect</option>
                    <option value="EL Test Failed">EL Test Failed</option>
                    <option value="IV Test Failed">IV Test Failed</option>
                    <option value="Insulation Test Failed">Insulation Test Failed</option>
                    <option value="Low Power Output">Low Power Output</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div style={{marginBottom: '12px'}}>
                  <label style={{display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px'}}>
                    Stage
                  </label>
                  <select
                    value={specialRejectionStage}
                    onChange={(e) => setSpecialRejectionStage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      fontSize: '13px'
                    }}
                  >
                    <option value="Visual Inspection">Visual Inspection</option>
                    <option value="EL Test">EL Test</option>
                    <option value="IV Test">IV Test</option>
                    <option value="Insulation Test">Insulation Test</option>
                    <option value="Final QC">Final QC</option>
                    <option value="Packing">Packing</option>
                    <option value="Customer Return">Customer Return</option>
                  </select>
                </div>
                
                <div>
                  <label style={{display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px'}}>
                    Remarks (Optional)
                  </label>
                  <textarea
                    value={specialRejectionRemarks}
                    onChange={(e) => setSpecialRejectionRemarks(e.target.value)}
                    placeholder="Additional notes..."
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      fontSize: '13px',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
            )}
            
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid rgba(220, 53, 69, 0.3)'
            }}>
              <p style={{color: '#ffcccc', marginBottom: '15px', fontSize: '14px', textAlign: 'center'}}>
                📋 Upload Excel with REJECTED barcodes<br/>
                <small style={{color: '#999'}}>Column: ID / Barcode / Serial_Number</small>
              </p>
              <input 
                type="file" 
                accept=".xlsx,.xls"
                onChange={handleRejectionFileSelect}
                disabled={uploadingRejection}
                style={{
                  display: 'block',
                  margin: '0 auto',
                  padding: '10px 20px',
                  background: 'white',
                  border: '2px solid #dc3545',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              />
            </div>

            {selectedRejectionFile && (
              <div style={{
                marginBottom: '20px',
                padding: '10px 15px',
                background: 'rgba(220, 53, 69, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(220, 53, 69, 0.3)'
              }}>
                <p style={{color: '#dc3545', fontSize: '14px', margin: 0}}>
                  📁 Selected: <strong>{selectedRejectionFile.name}</strong>
                </p>
              </div>
            )}

            {uploadingRejection && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                background: '#fff5f5',
                borderRadius: '8px'
              }}>
                <p style={{color: '#dc3545', fontWeight: '600', marginBottom: '10px', textAlign: 'center'}}>
                  ⏳ Uploading Rejection Data...
                </p>
              </div>
            )}

            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                onClick={handleRejectionUpload}
                disabled={uploadingRejection || !selectedRejectionFile || (rejectionType === 'special' && !specialRejectionReason)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: (!selectedRejectionFile || (rejectionType === 'special' && !specialRejectionReason)) ? '#ccc' : 'linear-gradient(135deg, #dc3545, #c82333)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: (!selectedRejectionFile || (rejectionType === 'special' && !specialRejectionReason)) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {uploadingRejection ? '⏳ Uploading...' : (rejectionType === 'special' ? '🔴 Upload Special Rejection' : '⚪ Upload Normal Rejection')}
              </button>
              <button 
                onClick={() => {
                  setShowRejectionModal(false);
                  setSelectedRejectionFile(null);
                  setRejectionType('normal');
                  setSpecialRejectionReason('');
                  setSpecialRejectionStage('Visual Inspection');
                  setSpecialRejectionRemarks('');
                }}
                disabled={uploadingRejection}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploadingRejection ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Serials Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#f687b3',
              marginBottom: '10px'
            }}>
              🏷️ Assign Barcodes to PDI
            </h2>
            <p style={{color: '#666', fontSize: '14px', marginBottom: '20px'}}>
              Assign serial numbers to a specific PDI number
            </p>

            {/* PDI Selector */}
            <div style={{marginBottom: '25px'}}>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#333',
                fontSize: '14px'
              }}>
                📋 Select PDI Number
              </label>
              <select
                value={selectedPdiForAssign || ''}
                onChange={e => setSelectedPdiForAssign(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #f687b3',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="">-- Select PDI Number --</option>
                {selectedCompany && selectedCompany.productionRecords && 
                  [...new Set(selectedCompany.productionRecords.map(r => r.pdi))].filter(Boolean).map(pdi => (
                    <option key={pdi} value={pdi}>{pdi}</option>
                  ))
                }
              </select>
            </div>

            {/* Two Assignment Methods */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px',
              marginBottom: '25px'
            }}>
              {/* Method 1: Excel Upload */}
              <div style={{
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                textAlign: 'center'
              }}>
                <div style={{fontSize: '36px', marginBottom: '10px'}}>📊</div>
                <h3 style={{fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#333'}}>
                  Upload Excel
                </h3>
                <p style={{fontSize: '11px', color: '#666', marginBottom: '12px'}}>
                  Upload specific serial numbers
                </p>
                {selectedPdiFile && !uploadingPdiSerials && (
                  <p style={{fontSize: '11px', color: '#f687b3', marginBottom: '8px', fontWeight: '600', wordBreak: 'break-all'}}>
                    📄 {selectedPdiFile.name}
                  </p>
                )}
                
                {/* Progress Bar */}
                {uploadingPdiSerials && (
                  <div style={{marginBottom: '12px'}}>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#e0e0e0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        width: `${pdiUploadProgress}%`,
                        height: '100%',
                        backgroundColor: pdiUploadProgress === 100 ? '#4caf50' : '#f687b3',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <p style={{fontSize: '11px', color: '#333', fontWeight: '600', margin: 0}}>
                      {pdiUploadStatus}
                    </p>
                    <p style={{fontSize: '10px', color: '#666', margin: '4px 0 0 0'}}>
                      {pdiUploadProgress}% Complete
                    </p>
                  </div>
                )}
                
                <input 
                  type="file" 
                  accept=".xlsx,.xls"
                  onChange={handlePdiSerialsFileSelect}
                  disabled={uploadingPdiSerials || !selectedPdiForAssign}
                  style={{
                    fontSize: '11px',
                    padding: '8px',
                    background: 'white',
                    border: '2px solid #f687b3',
                    borderRadius: '6px',
                    cursor: selectedPdiForAssign ? 'pointer' : 'not-allowed',
                    width: '100%',
                    marginBottom: '8px',
                    display: uploadingPdiSerials ? 'none' : 'block'
                  }}
                />
                <button
                  onClick={handlePdiSerialsUpload}
                  disabled={!selectedPdiFile || uploadingPdiSerials || !selectedPdiForAssign}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: (!selectedPdiFile || uploadingPdiSerials || !selectedPdiForAssign) ? '#ccc' : 'linear-gradient(135deg, #f687b3 0%, #e056a0 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (!selectedPdiFile || uploadingPdiSerials || !selectedPdiForAssign) ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: uploadingPdiSerials ? 'none' : 'block'
                  }}
                >
                  {uploadingPdiSerials ? '⏳ Uploading...' : '📤 Upload'}
                </button>
              </div>

              {/* Method 2: Auto Assign */}
              <div style={{
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                textAlign: 'center'
              }}>
                <div style={{fontSize: '36px', marginBottom: '10px'}}>🔢</div>
                <h3 style={{fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#333'}}>
                  Auto Assign
                </h3>
                <p style={{fontSize: '11px', color: '#666', marginBottom: '12px'}}>
                  Enter quantity to auto-assign
                </p>
                <input 
                  type="number"
                  placeholder="Quantity"
                  value={serialsToAssign}
                  onChange={e => setSerialsToAssign(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #4299e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    marginBottom: '8px'
                  }}
                />
                <button 
                  onClick={handleAssignSerials}
                  disabled={loading || !selectedPdiForAssign || !serialsToAssign}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: (loading || !selectedPdiForAssign || !serialsToAssign) ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (loading || !selectedPdiForAssign || !serialsToAssign) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  {loading ? '⏳ Assigning...' : 'Auto Assign'}
                </button>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploadingPdiSerials && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                background: '#fff5f7',
                borderRadius: '8px'
              }}>
                <p style={{color: '#f687b3', fontWeight: '600', marginBottom: '10px', textAlign: 'center'}}>
                  ⏳ Assigning Barcodes to PDI...
                </p>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#e0e0e0',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #f687b3, #e056a0)',
                    animation: 'loading 1.5s infinite'
                  }}></div>
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                setShowAssignModal(false);
                setSelectedPdiForAssign(null);
                setSerialsToAssign('');
                setSelectedPdiFile(null);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: '#f5f5f5',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                color: '#666'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Packed Modules Upload Modal */}
      {showPackedModal && (
        <div className="modal-overlay" onClick={() => setShowPackedModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#48bb78',
              marginBottom: '10px'
            }}>
              📦 Upload Packed Modules
            </h2>
            <p style={{color: '#666', fontSize: '14px', marginBottom: '20px'}}>
              Upload Excel file with packed module serial numbers
            </p>
            
            <div style={{
              border: '3px dashed #48bb78',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
              marginBottom: '20px'
            }}>
              <div style={{fontSize: '48px', marginBottom: '15px'}}>📦</div>
              <p style={{fontWeight: '600', fontSize: '16px', marginBottom: '10px', color: '#333'}}>
                {selectedPackedFile ? '✅ File Selected' : 'Choose Packed Modules Excel'}
              </p>
              {selectedPackedFile && (
                <p style={{fontSize: '13px', color: '#48bb78', marginBottom: '15px', fontWeight: '600'}}>
                  📄 {selectedPackedFile.name}
                </p>
              )}
              <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
                Column A should contain serial numbers that were actually packed
              </p>
              <input 
                type="file" 
                accept=".xlsx,.xls"
                onChange={handlePackedFileSelect}
                disabled={uploadingPacked}
                style={{
                  display: 'block',
                  margin: '0 auto',
                  padding: '10px 20px',
                  background: 'white',
                  border: '2px solid #48bb78',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              />
            </div>

            {uploadingPacked && (
              <div style={{
                marginBottom: '20px',
                padding: '15px',
                background: '#f0fff4',
                borderRadius: '8px'
              }}>
                <p style={{color: '#48bb78', fontWeight: '600', marginBottom: '10px', textAlign: 'center'}}>
                  ⏳ Processing Packed Modules...
                </p>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#e0e0e0',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #48bb78, #38a169)',
                    animation: 'loading 1.5s infinite'
                  }}></div>
                </div>
              </div>
            )}
            
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                onClick={handlePackedUpload}
                disabled={!selectedPackedFile || uploadingPacked}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: (!selectedPackedFile || uploadingPacked) ? '#ccc' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!selectedPackedFile || uploadingPacked) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {uploadingPacked ? '⏳ Uploading...' : '📤 Upload'}
              </button>
              <button 
                onClick={() => {
                  setShowPackedModal(false);
                  setSelectedPackedFile(null);
                }}
                disabled={uploadingPacked}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploadingPacked ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Master Serials Modal */}
      {showMasterViewModal && (
        <div className="modal-overlay" onClick={() => setShowMasterViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '95%', width: '1400px', maxHeight: '90vh', height: '85vh'}}>
            <h2 style={{marginBottom: '20px', fontSize: '24px'}}>👁️ Master FTR Serial Numbers - {selectedCompany?.companyName}</h2>
            
            {/* Search Bar */}
            <div style={{marginBottom: '15px'}}>
              <input 
                type="text"
                placeholder="🔍 Search serial number..."
                value={masterSearchTerm}
                onChange={(e) => {
                  setMasterSearchTerm(e.target.value);
                  setMasterPage(1);
                  loadMasterSerials(e.target.value, 1);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {loadingMasterView ? (
              <div>
                <p style={{textAlign: 'center', padding: '20px'}}>⏳ Loading...</p>
                <button 
                  onClick={() => setShowMasterViewModal(false)}
                  style={{
                    marginTop: '15px',
                    width: '100%',
                    padding: '12px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div>
                <div style={{display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap'}}>
                  <div style={{flex: 1, padding: '12px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#2e7d32'}}>{masterTotal.toLocaleString()}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Total Serials</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#e3f2fd', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#1565c0'}}>{masterSerials.filter(s => s.status === 'available').length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Available (Page)</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#fff3e0', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#e65100'}}>{masterSerials.filter(s => s.status === 'assigned').length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Assigned (Page)</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#ffebee', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#c62828'}}>{masterSerials.filter(s => s.status === 'used').length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Used (Page)</div>
                  </div>
                </div>
                
                <div style={{maxHeight: 'calc(85vh - 280px)', overflowY: 'auto', border: '2px solid #ddd', borderRadius: '8px'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                    <thead style={{position: 'sticky', top: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', zIndex: 1}}>
                      <tr>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>#</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Serial Number</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Pmax (W)</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Binning</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Status</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Class</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>PDI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterSerials.map((serial, idx) => (
                        <tr key={idx} style={{borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#f8f9fa' : 'white'}}>
                          <td style={{padding: '10px'}}>{idx + 1}</td>
                          <td style={{padding: '10px', fontFamily: 'monospace', fontWeight: '500'}}>{serial.serial_number}</td>
                          <td style={{padding: '10px'}}>{serial.pmax ? serial.pmax.toFixed(2) : '-'}</td>
                          <td style={{padding: '10px', fontWeight: '500'}}>{serial.binning || '-'}</td>
                          <td style={{padding: '10px'}}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: serial.status === 'available' ? '#d4edda' : serial.status === 'assigned' ? '#fff3cd' : '#f8d7da',
                              color: serial.status === 'available' ? '#155724' : serial.status === 'assigned' ? '#856404' : '#721c24'
                            }}>
                              {serial.status}
                            </span>
                          </td>
                          <td style={{padding: '10px'}}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: serial.class_status === 'OK' ? '#d4edda' : '#f8d7da',
                              color: serial.class_status === 'OK' ? '#155724' : '#721c24'
                            }}>
                              {serial.class_status}
                            </span>
                          </td>
                          <td style={{padding: '10px', fontWeight: '500'}}>{serial.pdi_number || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '8px'}}>
                  <div style={{fontSize: '14px', color: '#666'}}>
                    Showing {((masterPage - 1) * PAGE_SIZE) + 1} - {Math.min(masterPage * PAGE_SIZE, masterTotal)} of {masterTotal.toLocaleString()} serials
                  </div>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                      onClick={() => { setMasterPage(p => p - 1); loadMasterSerials(masterSearchTerm, masterPage - 1); }}
                      disabled={masterPage <= 1}
                      style={{
                        padding: '8px 16px',
                        background: masterPage <= 1 ? '#ccc' : '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: masterPage <= 1 ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ◀ Prev
                    </button>
                    <span style={{fontWeight: '600', color: '#333'}}>Page {masterPage} of {masterTotalPages}</span>
                    <button 
                      onClick={() => { setMasterPage(p => p + 1); loadMasterSerials(masterSearchTerm, masterPage + 1); }}
                      disabled={masterPage >= masterTotalPages}
                      style={{
                        padding: '8px 16px',
                        background: masterPage >= masterTotalPages ? '#ccc' : '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: masterPage >= masterTotalPages ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowMasterViewModal(false)}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '12px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Rejection Serials Modal */}
      {showRejectionViewModal && (
        <div className="modal-overlay" onClick={() => setShowRejectionViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '95%', width: '1400px', maxHeight: '90vh', height: '85vh'}}>
            <h2 style={{marginBottom: '20px', fontSize: '24px', color: '#dc3545'}}>🔍 Rejected Serial Numbers - {selectedCompany?.companyName}</h2>
            
            {/* Search Bar */}
            <div style={{marginBottom: '15px'}}>
              <input 
                type="text"
                placeholder="🔍 Search rejected serial number..."
                value={rejectionSearchTerm}
                onChange={(e) => {
                  setRejectionSearchTerm(e.target.value);
                  setRejectionPage(1);
                  loadRejectionSerials(e.target.value, 1);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #dc3545',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {loadingRejectionView ? (
              <div>
                <p style={{textAlign: 'center', padding: '20px'}}>⏳ Loading...</p>
                <button 
                  onClick={() => setShowRejectionViewModal(false)}
                  style={{
                    marginTop: '15px',
                    width: '100%',
                    padding: '12px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div>
                <div style={{display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap'}}>
                  <div style={{flex: 1, padding: '12px', background: '#ffebee', borderRadius: '8px', textAlign: 'center', border: '2px solid #dc3545'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#c62828'}}>{rejectionTotal.toLocaleString()}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Total Rejections</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#fff3e0', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#e65100'}}>{[...new Set(rejectionSerials.map(s => s.pdi_number).filter(p => p && p !== '-'))].length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Assigned (Page)</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#e3f2fd', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#1565c0'}}>{rejectionSerials.filter(s => !s.pdi_number || s.pdi_number === '-').length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Not Assigned (Page)</div>
                  </div>
                </div>
                
                <div style={{maxHeight: 'calc(85vh - 280px)', overflowY: 'auto', border: '2px solid #dc3545', borderRadius: '8px'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                    <thead style={{position: 'sticky', top: 0, background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)', zIndex: 1}}>
                      <tr>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>#</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Serial Number</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Pmax (W)</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Binning</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Status</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Class</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>PDI</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Upload Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rejectionSerials.map((serial, idx) => (
                        <tr key={idx} style={{borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#fff5f5' : 'white'}}>
                          <td style={{padding: '10px'}}>{idx + 1}</td>
                          <td style={{padding: '10px', fontFamily: 'monospace', fontWeight: '500'}}>{serial.serial_number}</td>
                          <td style={{padding: '10px'}}>{serial.pmax ? serial.pmax.toFixed(2) : '-'}</td>
                          <td style={{padding: '10px'}}>{serial.binning || '-'}</td>
                          <td style={{padding: '10px'}}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              background: '#f8d7da',
                              color: '#721c24',
                              fontWeight: '600'
                            }}>
                              {serial.status}
                            </span>
                          </td>
                          <td style={{padding: '10px'}}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              background: '#f8d7da',
                              color: '#721c24',
                              fontWeight: 'bold'
                            }}>
                              {serial.class_status}
                            </span>
                          </td>
                          <td style={{padding: '10px'}}>{serial.pdi_number || '-'}</td>
                          <td style={{padding: '10px', fontSize: '11px', color: '#666'}}>{serial.upload_date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', padding: '10px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #dc3545'}}>
                  <div style={{fontSize: '14px', color: '#666'}}>
                    Showing {((rejectionPage - 1) * PAGE_SIZE) + 1} - {Math.min(rejectionPage * PAGE_SIZE, rejectionTotal)} of {rejectionTotal.toLocaleString()} rejections
                  </div>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                      onClick={() => { setRejectionPage(p => p - 1); loadRejectionSerials(rejectionSearchTerm, rejectionPage - 1); }}
                      disabled={rejectionPage <= 1}
                      style={{
                        padding: '8px 16px',
                        background: rejectionPage <= 1 ? '#ccc' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: rejectionPage <= 1 ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ◀ Prev
                    </button>
                    <span style={{fontWeight: '600', color: '#333'}}>Page {rejectionPage} of {rejectionTotalPages}</span>
                    <button 
                      onClick={() => { setRejectionPage(p => p + 1); loadRejectionSerials(rejectionSearchTerm, rejectionPage + 1); }}
                      disabled={rejectionPage >= rejectionTotalPages}
                      style={{
                        padding: '8px 16px',
                        background: rejectionPage >= rejectionTotalPages ? '#ccc' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: rejectionPage >= rejectionTotalPages ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowRejectionViewModal(false)}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '12px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View PDI Assigned Serials Modal */}
      {showPdiSerialsModal && (
        <div className="modal-overlay" onClick={() => setShowPdiSerialsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '95%', width: '1400px', maxHeight: '90vh', height: '85vh'}}>
            <h2 style={{marginBottom: '20px', fontSize: '24px', color: '#17a2b8'}}>📋 PDI Assigned Serials - {selectedPdiNumber}</h2>
            
            {/* Search Bar */}
            <div style={{marginBottom: '15px'}}>
              <input 
                type="text"
                placeholder="🔍 Search serial number..."
                value={pdiSerialsSearch}
                onChange={(e) => {
                  setPdiSerialsSearch(e.target.value);
                  setPdiSerialsPage(1);
                  loadPdiSerials(selectedPdiNumber, e.target.value, 1);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #17a2b8',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            {loadingPdiSerials ? (
              <div>
                <p style={{textAlign: 'center', padding: '20px'}}>⏳ Loading...</p>
                <button 
                  onClick={() => setShowPdiSerialsModal(false)}
                  style={{
                    marginTop: '15px',
                    width: '100%',
                    padding: '12px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <div>
                <div style={{display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap'}}>
                  <div style={{flex: 1, padding: '12px', background: '#d1ecf1', borderRadius: '8px', textAlign: 'center', border: '2px solid #17a2b8'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#0c5460'}}>{pdiSerialsTotal.toLocaleString()}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Total Assigned</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#2e7d32'}}>{pdiSerials.filter(s => s.class_status === 'OK').length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>OK (Page)</div>
                  </div>
                  <div style={{flex: 1, padding: '12px', background: '#ffebee', borderRadius: '8px', textAlign: 'center'}}>
                    <div style={{fontSize: '24px', fontWeight: 'bold', color: '#c62828'}}>{pdiSerials.filter(s => s.class_status !== 'OK').length}</div>
                    <div style={{fontSize: '12px', color: '#555'}}>Rejected (Page)</div>
                  </div>
                </div>
                
                <div style={{maxHeight: 'calc(85vh - 320px)', overflowY: 'auto', border: '2px solid #17a2b8', borderRadius: '8px'}}>
                  <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                    <thead style={{position: 'sticky', top: 0, background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)', zIndex: 1}}>
                      <tr>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>#</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Serial Number</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Pmax (W)</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Binning</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Class</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Status</th>
                        <th style={{padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'left', color: 'white', fontWeight: '600'}}>Assigned Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdiSerials.map((serial, idx) => (
                        <tr key={idx} style={{borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#f0f9ff' : 'white'}}>
                          <td style={{padding: '10px'}}>{((pdiSerialsPage - 1) * PAGE_SIZE) + idx + 1}</td>
                          <td style={{padding: '10px', fontFamily: 'monospace', fontWeight: '500'}}>{serial.serial_number}</td>
                          <td style={{padding: '10px'}}>{serial.pmax ? serial.pmax.toFixed(2) : '-'}</td>
                          <td style={{padding: '10px', fontWeight: '500'}}>{serial.binning || '-'}</td>
                          <td style={{padding: '10px'}}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: serial.class_status === 'OK' ? '#d4edda' : '#f8d7da',
                              color: serial.class_status === 'OK' ? '#155724' : '#721c24'
                            }}>
                              {serial.class_status}
                            </span>
                          </td>
                          <td style={{padding: '10px'}}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: serial.status === 'assigned' ? '#fff3cd' : '#d4edda',
                              color: serial.status === 'assigned' ? '#856404' : '#155724'
                            }}>
                              {serial.status}
                            </span>
                          </td>
                          <td style={{padding: '10px', fontSize: '11px', color: '#666'}}>{serial.assigned_date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', padding: '10px', background: '#e8f4f8', borderRadius: '8px', border: '1px solid #17a2b8'}}>
                  <div style={{fontSize: '14px', color: '#666'}}>
                    Showing {((pdiSerialsPage - 1) * PAGE_SIZE) + 1} - {Math.min(pdiSerialsPage * PAGE_SIZE, pdiSerialsTotal)} of {pdiSerialsTotal.toLocaleString()} serials
                  </div>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <button 
                      onClick={() => { setPdiSerialsPage(p => p - 1); loadPdiSerials(selectedPdiNumber, pdiSerialsSearch, pdiSerialsPage - 1); }}
                      disabled={pdiSerialsPage <= 1}
                      style={{
                        padding: '8px 16px',
                        background: pdiSerialsPage <= 1 ? '#ccc' : '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: pdiSerialsPage <= 1 ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ◀ Prev
                    </button>
                    <span style={{fontWeight: '600', color: '#333'}}>Page {pdiSerialsPage} of {pdiSerialsTotalPages}</span>
                    <button 
                      onClick={() => { setPdiSerialsPage(p => p + 1); loadPdiSerials(selectedPdiNumber, pdiSerialsSearch, pdiSerialsPage + 1); }}
                      disabled={pdiSerialsPage >= pdiSerialsTotalPages}
                      style={{
                        padding: '8px 16px',
                        background: pdiSerialsPage >= pdiSerialsTotalPages ? '#ccc' : '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: pdiSerialsPage >= pdiSerialsTotalPages ? 'not-allowed' : 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowPdiSerialsModal(false)}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    padding: '12px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div className="loading-overlay">Loading...</div>}
    </div>
  );
};

export default FTRManagement;
