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
  
  // Rejection upload (NEW)
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [uploadingRejection, setUploadingRejection] = useState(false);
  const [selectedRejectionFile, setSelectedRejectionFile] = useState(null);
  
  // PDI serial assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPdiForAssign, setSelectedPdiForAssign] = useState(null);
  const [serialsToAssign, setSerialsToAssign] = useState('');
  const [uploadingPdiSerials, setUploadingPdiSerials] = useState(false);
  const [selectedPdiFile, setSelectedPdiFile] = useState(null);
  
  // Actual packed modules upload
  const [showPackedModal, setShowPackedModal] = useState(false);
  const [uploadingPacked, setUploadingPacked] = useState(false);
  const [selectedPackedFile, setSelectedPackedFile] = useState(null);

  const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

  useEffect(() => {
    loadCompanies();
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
          
          // Upload to rejection API
          const response = await axios.post(`${API_BASE_URL}/api/ftr/rejection`, {
            company_id: selectedCompany.id,
            serial_numbers: serialNumbers,
            file_name: file.name
          });
          
          if (response.data.success) {
            alert(`✅ Rejection Data Uploaded!\n\n❌ Marked as REJECTED: ${response.data.updated_count}\n⚠️ Already Rejected: ${response.data.already_rejected}\n🆕 New Entries: ${response.data.new_entries}`);
            loadFTRData(selectedCompany.id);
            setShowRejectionModal(false);
            setSelectedRejectionFile(null);
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
      const file = selectedPdiFile;
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Extract serial numbers (first column)
          const serialNumbers = [];
          for (let i = 1; i < jsonData.length; i++) {
            if (jsonData[i][0]) {
              serialNumbers.push(String(jsonData[i][0]).trim());
            }
          }
          
          if (serialNumbers.length === 0) {
            alert('❌ No serial numbers found in Excel');
            return;
          }
          
          // Upload to backend
          const API_BASE_URL = getAPIBaseURL();
          const response = await axios.post(`${API_BASE_URL}/api/ftr/assign-excel`, {
            company_id: selectedCompany.id,
            pdi_number: selectedPdiForAssign,
            serial_numbers: serialNumbers
          });
          
          if (response.data.success) {
            alert(`✅ ${serialNumbers.length} barcodes assigned to ${selectedPdiForAssign}`);
            loadFTRData(selectedCompany.id);
            setShowAssignModal(false);
            setSelectedPdiForAssign(null);
            setSelectedPdiFile(null);
          }
        } catch (error) {
          console.error('Failed to process Excel:', error);
          alert('❌ Failed to process barcode Excel file');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Failed to upload PDI barcodes:', error);
      alert('❌ Failed to upload PDI barcodes');
    } finally {
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
                  <button className="btn-view">View Serials</button>
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
              className="btn-rejection"
              onClick={() => setShowRejectionModal(true)}
              style={{ background: 'linear-gradient(135deg, #dc3545, #c82333)' }}
            >
              ❌ Upload Rejection
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
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
                disabled={uploadingRejection || !selectedRejectionFile}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: !selectedRejectionFile ? '#ccc' : 'linear-gradient(135deg, #dc3545, #c82333)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: !selectedRejectionFile ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {uploadingRejection ? '⏳ Uploading...' : '❌ Upload Rejection'}
              </button>
              <button 
                onClick={() => {
                  setShowRejectionModal(false);
                  setSelectedRejectionFile(null);
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
                {selectedPdiFile && (
                  <p style={{fontSize: '11px', color: '#f687b3', marginBottom: '8px', fontWeight: '600', wordBreak: 'break-all'}}>
                    📄 {selectedPdiFile.name}
                  </p>
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
                    marginBottom: '8px'
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
                    fontWeight: '600'
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

      {loading && <div className="loading-overlay">Loading...</div>}
    </div>
  );
};

export default FTRManagement;
