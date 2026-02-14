import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PDIBatchManager.css';
import PDIFTRGenerator from './PDIFTRGenerator';

function PDIBatchManager() {
  const [batches, setBatches] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [companies, setCompanies] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    status: 'all',
    company: 'all',
    search: ''
  });

  useEffect(() => {
    loadCompaniesWithPDIs();
  }, []);

  const loadCompaniesWithPDIs = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';
      const response = await axios.get(`${API_BASE_URL}/api/companies`);
      
      if (response.data && Array.isArray(response.data)) {
        setCompanies(response.data);
        
        // Extract all PDI batches from production records
        const allPDIs = [];
        response.data.forEach(company => {
          if (company.productionRecords && Array.isArray(company.productionRecords)) {
            // Group production records by PDI number
            const pdiGroups = {};
            
            company.productionRecords.forEach(record => {
              if (record.pdi && record.pdi.trim() !== '') {
                if (!pdiGroups[record.pdi]) {
                  pdiGroups[record.pdi] = {
                    pdi_number: record.pdi,
                    company_name: company.companyName,
                    company_id: company.id,
                    records: [],
                    total_production: 0,
                    start_date: record.date,
                    end_date: record.date,
                    running_order: record.runningOrder || '',
                    status: 'in_progress',
                    has_coc: false,
                    has_ipqc: false,
                    has_ftr: false
                  };
                }
                
                pdiGroups[record.pdi].records.push(record);
                pdiGroups[record.pdi].total_production += (record.dayProduction || 0) + (record.nightProduction || 0);
                
                // Update date range
                if (record.date < pdiGroups[record.pdi].start_date) {
                  pdiGroups[record.pdi].start_date = record.date;
                }
                if (record.date > pdiGroups[record.pdi].end_date) {
                  pdiGroups[record.pdi].end_date = record.date;
                }
                
                // Check for documents
                if (record.bomMaterials && record.bomMaterials.length > 0) {
                  pdiGroups[record.pdi].has_coc = true;
                }
                if (record.ipqcPdf) {
                  pdiGroups[record.pdi].has_ipqc = true;
                }
                if (record.ftrDocument) {
                  pdiGroups[record.pdi].has_ftr = true;
                }
              }
            });
            
            // After grouping, check if ALL records are approved to set status
            Object.values(pdiGroups).forEach(pdiGroup => {
              const allApproved = pdiGroup.records.every(rec => rec.pdiApproved === true);
              pdiGroup.status = allApproved ? 'completed' : 'in_progress';
              allPDIs.push(pdiGroup);
            });
          }
        });
        
        setBatches(allPDIs);
      }
    } catch (error) {
      console.error('Failed to load PDI data:', error);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter batches based on search, status, and company
  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.pdi_number.toLowerCase().includes(filters.search.toLowerCase());
    const matchesStatus = filters.status === 'all' || batch.status === filters.status;
    const matchesCompany = filters.company === 'all' || batch.company_name === filters.company;
    return matchesSearch && matchesStatus && matchesCompany;
  });

  // Get unique company names for filter dropdown
  const uniqueCompanies = [...new Set(batches.map(batch => batch.company_name))].sort();

  const getStatusBadge = (status) => {
    const badges = {
      'in_progress': 'badge-warning',
      'completed': 'badge-success',
      'open': 'badge-info'
    };
    return `badge ${badges[status] || 'badge-secondary'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  return (
    <div className="pdi-batch-manager">
      <div className="page-header">
        <h1>📦 PDI Batch Management</h1>
        <button 
          className="btn btn-primary" 
          onClick={() => window.location.href = '/?section=daily-report'}
          title="Go to Daily Report to create PDI batches"
        >
          ➕ Go to Daily Report
        </button>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Company:</label>
          <select 
            value={filters.company} 
            onChange={(e) => setFilters({...filters, company: e.target.value})}
          >
            <option value="all">All Companies</option>
            {uniqueCompanies.map(companyName => (
              <option key={companyName} value={companyName}>{companyName}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="all">All</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Search PDI Number:</label>
          <input 
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            placeholder="Search..."
          />
        </div>
      </div>

      <div className="batch-layout">
        {/* Batches List */}
        <div className="batches-list">
          <h2>PDI Batches ({filteredBatches.length})</h2>
          {loading ? (
            <div style={{textAlign: 'center', padding: '40px'}}>
              <p>⏳ Loading PDI batches...</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="empty-state">
              <p>No PDI batches found</p>
              <p style={{fontSize: '13px', color: '#666'}}>Go to Daily Report to create production records with PDI numbers</p>
            </div>
          ) : (
            filteredBatches.map((batch, idx) => (
              <div 
                key={`${batch.pdi_number}-${idx}`}
                className={`batch-card ${selectedBatch?.pdi_number === batch.pdi_number ? 'selected' : ''}`}
                onClick={() => setSelectedBatch(batch)}
              >
                <div className="batch-card-header">
                  <h3>{batch.pdi_number}</h3>
                  <span className={getStatusBadge(batch.status)}>
                    {batch.status === 'in_progress' ? 'IN PROGRESS' : 'COMPLETED'}
                  </span>
                </div>
                <div className="batch-card-body">
                  <p><strong>Company:</strong> {batch.company_name}</p>
                  <p><strong>Production:</strong> {batch.total_production.toLocaleString()} modules</p>
                  <p><strong>Period:</strong> {formatDate(batch.start_date)} - {formatDate(batch.end_date)}</p>
                  <p><strong>R.O:</strong> {batch.running_order || 'N/A'}</p>
                  <div style={{display: 'flex', gap: '5px', marginTop: '8px'}}>
                    {batch.has_coc && <span style={{fontSize: '10px', padding: '2px 6px', background: '#28a745', color: 'white', borderRadius: '3px'}}>COC ✓</span>}
                    {batch.has_ipqc && <span style={{fontSize: '10px', padding: '2px 6px', background: '#007bff', color: 'white', borderRadius: '3px'}}>IPQC ✓</span>}
                    {batch.has_ftr && <span style={{fontSize: '10px', padding: '2px 6px', background: '#17a2b8', color: 'white', borderRadius: '3px'}}>FTR ✓</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Batch Details */}
        <div className="batch-details">
          {selectedBatch ? (
            <>
              <div className="details-header">
                <h2>{selectedBatch.pdi_number}</h2>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    // Navigate to Daily Report and open this PDI
                    localStorage.setItem('openPDI', selectedBatch.pdi_number);
                    window.location.href = '/?section=daily-report';
                  }}
                >
                  📋 View in Daily Report
                </button>
              </div>

              {/* Basic Info */}
              <div className="details-section">
                <h3>Basic Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>PDI Number:</label>
                    <span>{selectedBatch.pdi_number}</span>
                  </div>
                  <div className="info-item">
                    <label>Company:</label>
                    <span>{selectedBatch.company_name}</span>
                  </div>
                  <div className="info-item">
                    <label>Running Order:</label>
                    <span>{selectedBatch.running_order || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Status:</label>
                    <span className={getStatusBadge(selectedBatch.status)}>
                      {selectedBatch.status === 'in_progress' ? 'IN PROGRESS' : 'COMPLETED'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Total Production:</label>
                    <span>{selectedBatch.total_production.toLocaleString()} modules</span>
                  </div>
                  <div className="info-item">
                    <label>Production Days:</label>
                    <span>{selectedBatch.records.length} days</span>
                  </div>
                  <div className="info-item">
                    <label>Start Date:</label>
                    <span>{formatDate(selectedBatch.start_date)}</span>
                  </div>
                  <div className="info-item">
                    <label>End Date:</label>
                    <span>{formatDate(selectedBatch.end_date)}</span>
                  </div>
                </div>
              </div>

              {/* Production Records */}
              <div className="details-section">
                <h3>Daily Production Records ({selectedBatch.records.length})</h3>
                <table style={{width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginTop: '10px'}}>
                  <thead>
                    <tr style={{backgroundColor: '#f8f9fa'}}>
                      <th style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'left'}}>Date</th>
                      <th style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>Day Prod.</th>
                      <th style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>Night Prod.</th>
                      <th style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>Total</th>
                      <th style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBatch.records.map((record, idx) => (
                      <tr key={idx} style={{backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa'}}>
                        <td style={{padding: '8px', border: '1px solid #dee2e6'}}>{formatDate(record.date)}</td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>{record.dayProduction || 0}</td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>{record.nightProduction || 0}</td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold'}}>
                          {(record.dayProduction || 0) + (record.nightProduction || 0)}
                        </td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>
                          {record.bomMaterials?.length > 0 && <span style={{marginRight: '5px'}}>📦</span>}
                          {record.ipqcPdf && <span style={{marginRight: '5px'}}>📄</span>}
                          {record.ftrDocument && <span>📋</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Documents Status */}
              <div className="details-section">
                <h3>📁 Documents Status</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '10px'}}>
                  <div style={{padding: '15px', background: selectedBatch.has_coc ? '#d4edda' : '#f8d7da', borderRadius: '5px', border: `1px solid ${selectedBatch.has_coc ? '#28a745' : '#dc3545'}`}}>
                    <h4 style={{margin: '0 0 5px 0'}}>COC Materials</h4>
                    <p style={{margin: 0, fontSize: '24px', fontWeight: 'bold', color: selectedBatch.has_coc ? '#28a745' : '#dc3545'}}>
                      {selectedBatch.has_coc ? '✓' : '✗'}
                    </p>
                  </div>
                  <div style={{padding: '15px', background: selectedBatch.has_ipqc ? '#d4edda' : '#f8d7da', borderRadius: '5px', border: `1px solid ${selectedBatch.has_ipqc ? '#28a745' : '#dc3545'}`}}>
                    <h4 style={{margin: '0 0 5px 0'}}>IPQC Report</h4>
                    <p style={{margin: 0, fontSize: '24px', fontWeight: 'bold', color: selectedBatch.has_ipqc ? '#28a745' : '#dc3545'}}>
                      {selectedBatch.has_ipqc ? '✓' : '✗'}
                    </p>
                  </div>
                  <div style={{padding: '15px', background: selectedBatch.has_ftr ? '#d4edda' : '#f8d7da', borderRadius: '5px', border: `1px solid ${selectedBatch.has_ftr ? '#28a745' : '#dc3545'}`}}>
                    <h4 style={{margin: '0 0 5px 0'}}>FTR Document</h4>
                    <p style={{margin: 0, fontSize: '24px', fontWeight: 'bold', color: selectedBatch.has_ftr ? '#28a745' : '#dc3545'}}>
                      {selectedBatch.has_ftr ? '✓' : '✗'}
                    </p>
                  </div>
                </div>

                {/* Download Complete Report Button */}
                <div style={{marginTop: '20px', textAlign: 'center'}}>
                  <button
                    className="btn btn-success"
                    style={{
                      padding: '12px 30px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                    }}
                    onClick={async () => {
                      try {
                        const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';
                        const response = await axios.post(
                          `${API_BASE_URL}/api/pdi/download-complete-report`,
                          {
                            pdi_number: selectedBatch.pdi_number,
                            company_name: selectedBatch.company_name
                          },
                          { responseType: 'blob' }
                        );

                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `Complete_Report_${selectedBatch.pdi_number}_${new Date().toISOString().split('T')[0]}.pdf`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Failed to download complete report:', error);
                        alert('Failed to download complete report. Please try again.');
                      }
                    }}
                  >
                    📥 Download Complete Report
                    <div style={{fontSize: '11px', marginTop: '4px', opacity: '0.9'}}>
                      (COC + IPQC + FTR + Production Data)
                    </div>
                  </button>
                </div>
              </div>

              {/* FTR Bulk Report Generator */}
              <div className="details-section">
                <PDIFTRGenerator />
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a PDI batch to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PDIBatchManager;
