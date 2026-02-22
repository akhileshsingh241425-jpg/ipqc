import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:5003/api' : '/api');

// Material definitions matching the Excel IQC sheet structure
const MATERIALS = [
  { key: 'cell', label: 'Cell', unit: 'Pcs', qtyPerModule: 67, icon: '⚡' },
  { key: 'f_glass', label: 'F. Glass', unit: 'Pcs', qtyPerModule: 1, icon: '🔲' },
  { key: 'b_glass', label: 'B. Glass', unit: 'Pcs', qtyPerModule: 1, icon: '🔳' },
  { key: 'ribbon', label: 'Ribbon', unit: 'Kg', qtyPerModule: 0.212, icon: '🎀' },
  { key: 'flux', label: 'Flux', unit: 'Kg', qtyPerModule: 0.025, icon: '💧' },
  { key: 'busbar_4', label: 'Busbar-4', unit: 'Kg', qtyPerModule: 0.038, icon: '🔌' },
  { key: 'busbar_6', label: 'Busbar-6', unit: 'Kg', qtyPerModule: 0.018, icon: '🔌' },
  { key: 'epe', label: 'EPE', unit: 'Sqm', qtyPerModule: 5.4, icon: '📦' },
  { key: 'frame', label: 'Frame', unit: 'Sets', qtyPerModule: 1, icon: '🖼️' },
  { key: 'sealant', label: 'Sealant', unit: 'Kg', qtyPerModule: 0.37, icon: '🧴' },
  { key: 'potting', label: 'Potting', unit: 'Kg', qtyPerModule: 0.024, icon: '🧪' },
  { key: 'jb', label: 'JB', unit: 'Sets', qtyPerModule: 1, icon: '📟' },
  { key: 'rfid', label: 'RFID', unit: 'Pcs', qtyPerModule: 1, icon: '📡' },
  { key: 'tape', label: 'Tape', unit: 'Meter', qtyPerModule: 0.56, icon: '📏' },
];

// Material name mapping from API to our keys
const MATERIAL_NAME_MAP = {
  'solar cell': 'cell',
  'cell': 'cell',
  'front glass': 'f_glass',
  'f. glass': 'f_glass',
  'f glass': 'f_glass',
  'front tempered glass': 'f_glass',
  'back glass': 'b_glass',
  'b. glass': 'b_glass',
  'b glass': 'b_glass',
  'back tempered glass': 'b_glass',
  'ribbon': 'ribbon',
  'inter connector ribbon': 'ribbon',
  'flux': 'flux',
  'soldering flux': 'flux',
  'busbar-4': 'busbar_4',
  'busbar 4': 'busbar_4',
  'bus bar ribbon': 'busbar_4',
  'busbar-6': 'busbar_6',
  'busbar 6': 'busbar_6',
  'epe': 'epe',
  'epe foam sheet': 'epe',
  'eva': 'epe',
  'frame': 'frame',
  'aluminium frame': 'frame',
  'al frame': 'frame',
  'sealant': 'sealant',
  'silicone sealant': 'sealant',
  'potting': 'potting',
  'potting material': 'potting',
  'jb': 'jb',
  'junction box': 'jb',
  'j.b.': 'jb',
  'rfid': 'rfid',
  'rfid tag': 'rfid',
  'tape': 'tape',
  'insulation tape': 'tape',
};

function IQCTracker({ companyName, companyId, productionRecords = [] }) {
  const [activeTab, setActiveTab] = useState('cell');
  const [cocData, setCocData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get PDI-wise production data from production records
  const getPdiSummary = useCallback(() => {
    const pdiMap = {};
    (productionRecords || []).forEach(record => {
      const pdi = record.pdi;
      if (!pdi || pdi.trim() === '') return;
      if (!pdiMap[pdi]) {
        pdiMap[pdi] = { pdiName: pdi, totalModules: 0, records: [] };
      }
      pdiMap[pdi].totalModules += (record.dayProduction || 0) + (record.nightProduction || 0);
      pdiMap[pdi].records.push(record);
    });
    return Object.values(pdiMap).sort((a, b) => {
      // Sort by PDI number
      const numA = parseInt(a.pdiName.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.pdiName.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [productionRecords]);

  // Fetch COC data from API
  const fetchCOCData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch assigned COC records from MRP API
      const response = await axios.get(`${API_BASE_URL}/coc/assigned`, {
        params: { company: companyName || '' }
      });

      if (response.data.success) {
        const records = response.data.data || [];
        
        // Group by material -> PDI -> invoices
        const grouped = {};
        
        records.forEach(record => {
          const materialName = (record.material_name || '').toLowerCase().trim();
          const materialKey = MATERIAL_NAME_MAP[materialName] || materialName;
          const pdi = record.pdi_no || record.pdi_original || 'Unknown';
          
          if (!grouped[materialKey]) {
            grouped[materialKey] = {};
          }
          if (!grouped[materialKey][pdi]) {
            grouped[materialKey][pdi] = [];
          }
          
          grouped[materialKey][pdi].push({
            invoiceNo: record.invoice_no || '',
            date: record.invoice_date || '',
            qty: parseFloat(record.coc_qty || record.invoice_qty || record.remaining_qty) || 0,
            remainingQty: parseFloat(record.remaining_qty) || 0,
            consumedQty: parseFloat(record.consumed_qty) || 0,
            partyName: record.brand || record.company_short || '',
            lotBatch: record.lot_batch_no || '',
            productType: record.product_type || '',
            cocDocUrl: record.coc_document_url || '',
            iqcDocUrl: record.iqc_document_url || '',
            isExhausted: record.is_exhausted || false
          });
        });
        
        setCocData(grouped);
      }
    } catch (err) {
      console.error('Failed to fetch COC data:', err);
      setError('Failed to load COC data. Check network connection.');
    } finally {
      setLoading(false);
    }
  }, [companyName]);

  useEffect(() => {
    fetchCOCData();
  }, [fetchCOCData]);

  const pdiSummary = getPdiSummary();

  // Get material info
  const activeMaterial = MATERIALS.find(m => m.key === activeTab) || MATERIALS[0];

  // Get COC invoices for active material
  const getMaterialCocData = () => {
    const materialCocs = cocData[activeTab] || {};
    
    // Merge with PDI summary
    return pdiSummary.map((pdi, index) => {
      const pdiKey = pdi.pdiName;
      const invoices = materialCocs[pdiKey] || [];
      
      // Also check alternate keys like PDI-1, Lot 1 etc.
      const altKeys = [
        pdiKey,
        `PDI-${index + 1}`,
        `Lot ${index + 1}`,
        pdiKey.replace('PDI-', 'Lot '),
      ];
      
      let allInvoices = [...invoices];
      altKeys.forEach(key => {
        if (key !== pdiKey && materialCocs[key]) {
          allInvoices = [...allInvoices, ...materialCocs[key]];
        }
      });

      // Remove duplicates by invoice number
      const seen = new Set();
      allInvoices = allInvoices.filter(inv => {
        if (seen.has(inv.invoiceNo)) return false;
        seen.add(inv.invoiceNo);
        return true;
      });

      const qtyRequired = pdi.totalModules * activeMaterial.qtyPerModule;
      const totalCocQty = allInvoices.reduce((sum, inv) => sum + inv.qty, 0);
      const remaining = totalCocQty - qtyRequired;

      return {
        srNo: index + 1,
        pdiName: pdi.pdiName,
        modules: pdi.totalModules,
        qtyRequired: Math.round(qtyRequired * 1000) / 1000,
        invoices: allInvoices,
        totalUsed: totalCocQty,
        remaining: Math.round(remaining * 1000) / 1000,
      };
    });
  };

  const materialData = getMaterialCocData();

  // Calculate totals  
  const totalModules = materialData.reduce((sum, d) => sum + d.modules, 0);
  const totalRequired = materialData.reduce((sum, d) => sum + d.qtyRequired, 0);
  const totalCocQty = materialData.reduce((sum, d) => sum + d.totalUsed, 0);
  const totalRemaining = materialData.reduce((sum, d) => sum + d.remaining, 0);

  // Count materials with COC data
  const materialsWithData = MATERIALS.filter(m => {
    const data = cocData[m.key] || {};
    return Object.keys(data).length > 0;
  }).length;

  const formatNumber = (num) => {
    if (num === 0) return '0';
    if (Math.abs(num) >= 1000) return num.toLocaleString('en-IN');
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(2);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '12px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
        borderRadius: '10px',
        color: 'white'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>
            📋 IQC - COC Tracker
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: '13px', opacity: 0.8 }}>
            {companyName || 'NTPC'} • Material-wise COC tracking for each PDI
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={fetchCOCData}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: loading ? '#666' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <strong>{pdiSummary.length}</strong> PDIs • <strong>{materialsWithData}</strong>/{MATERIALS.length} Materials
          </div>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: '12px 20px', 
          background: '#ffebee', 
          borderRadius: '8px', 
          color: '#c62828',
          marginBottom: '15px',
          border: '1px solid #ef9a9a'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '12px', 
        marginBottom: '20px' 
      }}>
        <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '10px', textAlign: 'center', border: '2px solid #1976d2' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1565c0' }}>{totalModules.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>TOTAL MODULES</div>
        </div>
        <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '10px', textAlign: 'center', border: '2px solid #ff9800' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#e65100' }}>{formatNumber(totalRequired)}</div>
          <div style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>{activeMaterial.label} REQUIRED ({activeMaterial.unit})</div>
        </div>
        <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '10px', textAlign: 'center', border: '2px solid #4CAF50' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#2e7d32' }}>{formatNumber(totalCocQty)}</div>
          <div style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>COC QUANTITY ({activeMaterial.unit})</div>
        </div>
        <div style={{ 
          padding: '15px', 
          background: totalRemaining >= 0 ? '#e8f5e9' : '#ffebee', 
          borderRadius: '10px', 
          textAlign: 'center',
          border: `2px solid ${totalRemaining >= 0 ? '#4CAF50' : '#f44336'}`
        }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: totalRemaining >= 0 ? '#2e7d32' : '#c62828' }}>
            {totalRemaining >= 0 ? '+' : ''}{formatNumber(totalRemaining)}
          </div>
          <div style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>REMAINING ({activeMaterial.unit})</div>
        </div>
      </div>

      {/* Material Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        marginBottom: '0',
        overflowX: 'auto',
        borderBottom: '3px solid #1a237e',
        backgroundColor: '#f5f5f5',
        borderRadius: '10px 10px 0 0',
        scrollbarWidth: 'thin'
      }}>
        {MATERIALS.map(mat => {
          const hasCocData = Object.keys(cocData[mat.key] || {}).length > 0;
          const isActive = activeTab === mat.key;
          return (
            <button
              key={mat.key}
              onClick={() => setActiveTab(mat.key)}
              style={{
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                border: 'none',
                borderBottom: isActive ? '3px solid #1a237e' : '3px solid transparent',
                backgroundColor: isActive ? '#1a237e' : 'transparent',
                color: isActive ? 'white' : '#555',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                position: 'relative',
                minWidth: 'fit-content',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>{mat.icon}</span>
              <span>{mat.label}</span>
              {hasCocData && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#4CAF50' : '#1a237e',
                  display: 'inline-block'
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Material Info Bar */}
      <div style={{
        padding: '10px 20px',
        backgroundColor: '#e8eaf6',
        border: '1px solid #c5cae9',
        borderTop: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '20px' }}>{activeMaterial.icon}</span>
          <div>
            <strong style={{ fontSize: '15px', color: '#1a237e' }}>{activeMaterial.label}</strong>
            <span style={{ fontSize: '11px', color: '#666', marginLeft: '10px' }}>
              {activeMaterial.qtyPerModule} {activeMaterial.unit} per module
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Search invoice/party..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #c5cae9',
              borderRadius: '5px',
              fontSize: '12px',
              width: '200px'
            }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          border: '2px solid #1a237e',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
              <th style={thStyle}>Sr.</th>
              <th style={thStyle}>PDI Name</th>
              <th style={thStyle}>Modules</th>
              <th style={thStyle}>Qty Required ({activeMaterial.unit})</th>
              <th style={{ ...thStyle, backgroundColor: '#283593' }} colSpan={4}>
                COC Invoice 1
              </th>
              <th style={{ ...thStyle, backgroundColor: '#303f9f' }} colSpan={4}>
                COC Invoice 2
              </th>
              <th style={{ ...thStyle, backgroundColor: '#1b5e20' }}>Qty Used</th>
              <th style={{ ...thStyle, backgroundColor: '#bf360c' }}>Remaining</th>
            </tr>
            <tr style={{ backgroundColor: '#283593', color: 'white' }}>
              <th style={subThStyle}></th>
              <th style={subThStyle}></th>
              <th style={subThStyle}></th>
              <th style={subThStyle}></th>
              <th style={subThStyle}>Invoice No</th>
              <th style={subThStyle}>Date</th>
              <th style={subThStyle}>Qty</th>
              <th style={subThStyle}>Party</th>
              <th style={subThStyle}>Invoice No</th>
              <th style={subThStyle}>Date</th>
              <th style={subThStyle}>Qty</th>
              <th style={subThStyle}>Party</th>
              <th style={subThStyle}></th>
              <th style={subThStyle}></th>
            </tr>
          </thead>
          <tbody>
            {materialData.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: '#999', fontSize: '14px' }}>
                  {loading ? '⏳ Loading COC data...' : pdiSummary.length === 0 
                    ? '📭 No PDI records found. Add production records first.' 
                    : `📭 No COC data found for ${activeMaterial.label}. Sync from MRP system.`}
                </td>
              </tr>
            ) : (
              materialData.map((row, idx) => {
                const inv1 = row.invoices[0] || {};
                const inv2 = row.invoices[1] || {};
                const hasExtraInvoices = row.invoices.length > 2;
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8f9ff';
                
                // Filter by search
                if (searchTerm) {
                  const term = searchTerm.toLowerCase();
                  const matchesSearch = row.invoices.some(inv => 
                    (inv.invoiceNo || '').toLowerCase().includes(term) ||
                    (inv.partyName || '').toLowerCase().includes(term)
                  ) || row.pdiName.toLowerCase().includes(term);
                  if (!matchesSearch) return null;
                }

                return (
                  <React.Fragment key={idx}>
                    <tr style={{ backgroundColor: rowBg, borderBottom: '1px solid #e0e0e0' }}>
                      <td style={tdStyle}>{row.srNo}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: '#1a237e' }}>{row.pdiName}</td>
                      <td style={{ ...tdStyle, fontWeight: '600', textAlign: 'right' }}>
                        {row.modules.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: '600', textAlign: 'right', color: '#e65100' }}>
                        {formatNumber(row.qtyRequired)}
                      </td>
                      
                      {/* Invoice 1 */}
                      <td style={{ ...tdStyle, backgroundColor: '#e3f2fd33', fontSize: '11px' }}>
                        {inv1.invoiceNo || '-'}
                      </td>
                      <td style={{ ...tdStyle, backgroundColor: '#e3f2fd33', fontSize: '11px' }}>
                        {formatDate(inv1.date)}
                      </td>
                      <td style={{ ...tdStyle, backgroundColor: '#e3f2fd33', fontWeight: '600', textAlign: 'right' }}>
                        {inv1.qty ? formatNumber(inv1.qty) : '-'}
                      </td>
                      <td style={{ ...tdStyle, backgroundColor: '#e3f2fd33', fontSize: '10px', color: '#555' }}>
                        {inv1.partyName || '-'}
                      </td>
                      
                      {/* Invoice 2 */}
                      <td style={{ ...tdStyle, backgroundColor: '#f3e5f533', fontSize: '11px' }}>
                        {inv2.invoiceNo || '-'}
                      </td>
                      <td style={{ ...tdStyle, backgroundColor: '#f3e5f533', fontSize: '11px' }}>
                        {formatDate(inv2.date)}
                      </td>
                      <td style={{ ...tdStyle, backgroundColor: '#f3e5f533', fontWeight: '600', textAlign: 'right' }}>
                        {inv2.qty ? formatNumber(inv2.qty) : '-'}
                      </td>
                      <td style={{ ...tdStyle, backgroundColor: '#f3e5f533', fontSize: '10px', color: '#555' }}>
                        {inv2.partyName || '-'}
                      </td>
                      
                      {/* Totals */}
                      <td style={{ 
                        ...tdStyle, fontWeight: '700', textAlign: 'right', 
                        backgroundColor: '#e8f5e9', color: '#1b5e20' 
                      }}>
                        {formatNumber(row.totalUsed)}
                      </td>
                      <td style={{ 
                        ...tdStyle, fontWeight: '700', textAlign: 'right',
                        backgroundColor: row.remaining >= 0 ? '#e8f5e9' : '#ffebee',
                        color: row.remaining >= 0 ? '#2e7d32' : '#c62828'
                      }}>
                        {row.remaining >= 0 ? '+' : ''}{formatNumber(row.remaining)}
                      </td>
                    </tr>

                    {/* Extra invoices rows (3rd, 4th, etc.) */}
                    {hasExtraInvoices && row.invoices.slice(2).map((inv, invIdx) => (
                      <tr key={`${idx}-extra-${invIdx}`} style={{ 
                        backgroundColor: '#fafafa', 
                        borderBottom: '1px dashed #e0e0e0' 
                      }}>
                        <td style={tdStyle}></td>
                        <td style={tdStyle}></td>
                        <td style={tdStyle}></td>
                        <td style={tdStyle}></td>
                        <td style={{ ...tdStyle, fontSize: '11px', color: '#1565c0' }} colSpan={4}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontWeight: '600' }}>📄 {inv.invoiceNo}</span>
                            <span style={{ fontSize: '10px', color: '#888' }}>{formatDate(inv.date)}</span>
                            <span style={{ fontWeight: '600' }}>Qty: {formatNumber(inv.qty)}</span>
                            <span style={{ fontSize: '10px', color: '#666' }}>{inv.partyName}</span>
                          </div>
                        </td>
                        <td style={tdStyle} colSpan={4}></td>
                        <td style={tdStyle}></td>
                        <td style={tdStyle}></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}

            {/* Totals Row */}
            {materialData.length > 0 && (
              <tr style={{ backgroundColor: '#1a237e', color: 'white', fontWeight: '700' }}>
                <td style={{ ...tdStyle, color: 'white', borderColor: '#1a237e' }} colSpan={2}>
                  TOTAL
                </td>
                <td style={{ ...tdStyle, color: 'white', borderColor: '#1a237e', textAlign: 'right' }}>
                  {totalModules.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, color: '#ffeb3b', borderColor: '#1a237e', textAlign: 'right' }}>
                  {formatNumber(totalRequired)}
                </td>
                <td style={{ ...tdStyle, borderColor: '#1a237e' }} colSpan={8}></td>
                <td style={{ ...tdStyle, color: '#a5d6a7', borderColor: '#1a237e', textAlign: 'right' }}>
                  {formatNumber(totalCocQty)}
                </td>
                <td style={{ 
                  ...tdStyle, 
                  borderColor: '#1a237e', 
                  textAlign: 'right',
                  color: totalRemaining >= 0 ? '#a5d6a7' : '#ef9a9a'
                }}>
                  {totalRemaining >= 0 ? '+' : ''}{formatNumber(totalRemaining)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* All Materials Summary View */}
      <div style={{ marginTop: '25px' }}>
        <h3 style={{ 
          margin: '0 0 15px', 
          fontSize: '16px', 
          color: '#1a237e',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📊 All Materials Summary
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#263238', color: 'white' }}>
                <th style={thStyle}>Material</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Per Module</th>
                <th style={thStyle}>Total Required</th>
                <th style={thStyle}>COCs Available</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((mat, idx) => {
                const matCocData = cocData[mat.key] || {};
                const cocCount = Object.values(matCocData).reduce((sum, pdis) => sum + (Array.isArray(pdis) ? pdis.length : 0), 0);
                const totalReq = totalModules * mat.qtyPerModule;
                const hasCocs = cocCount > 0;
                
                return (
                  <tr 
                    key={mat.key} 
                    style={{ 
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f5f5f5',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => setActiveTab(mat.key)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8eaf6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#f5f5f5'}
                  >
                    <td style={{ ...tdStyle, fontWeight: '600' }}>
                      {mat.icon} {mat.label}
                    </td>
                    <td style={tdStyle}>{mat.unit}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{mat.qtyPerModule}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>
                      {formatNumber(totalReq)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: hasCocs ? '#e8f5e9' : '#fff3e0',
                        color: hasCocs ? '#2e7d32' : '#e65100'
                      }}>
                        {cocCount} invoices
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {hasCocs ? (
                        <span style={{ color: '#2e7d32', fontWeight: '700' }}>✅ Tracked</span>
                      ) : (
                        <span style={{ color: '#ff9800', fontWeight: '600' }}>⏳ Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* IPQC Summary */}
      {pdiSummary.length > 0 && (
        <div style={{ marginTop: '25px' }}>
          <h3 style={{ 
            margin: '0 0 15px', 
            fontSize: '16px', 
            color: '#1a237e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📝 PDI Production Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {pdiSummary.map((pdi, idx) => (
              <div key={idx} style={{
                padding: '15px',
                borderRadius: '10px',
                border: '2px solid #c5cae9',
                backgroundColor: '#fafafa',
                transition: 'transform 0.2s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '14px', color: '#1a237e' }}>{pdi.pdiName}</strong>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '700',
                    backgroundColor: '#e3f2fd',
                    color: '#1565c0'
                  }}>
                    #{idx + 1}
                  </span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#283593' }}>
                  {pdi.totalModules.toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>modules</div>
                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '5px' }}>
                  {pdi.records.length} production records
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const thStyle = {
  padding: '10px 8px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: '700',
  borderBottom: '2px solid #1a237e',
  whiteSpace: 'nowrap'
};

const subThStyle = {
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: '600',
  borderBottom: '1px solid #3949ab',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '8px',
  borderBottom: '1px solid #e0e0e0',
  fontSize: '12px',
  whiteSpace: 'nowrap'
};

export default IQCTracker;
