import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:5003/api' : '/api');

// 14 BOM Materials with per-module usage
const BOM_MATERIALS = [
  { key: 'cell', label: 'Solar Cell', unit: 'Pcs', perModule: 67 },
  { key: 'f_glass', label: 'Front Glass', unit: 'Pcs', perModule: 1 },
  { key: 'b_glass', label: 'Back Glass', unit: 'Pcs', perModule: 1 },
  { key: 'ribbon', label: 'Ribbon', unit: 'Kg', perModule: 0.212 },
  { key: 'flux', label: 'Flux', unit: 'Kg', perModule: 0.025 },
  { key: 'busbar4', label: 'Busbar-4', unit: 'Kg', perModule: 0.038 },
  { key: 'busbar6', label: 'Busbar-6', unit: 'Kg', perModule: 0.018 },
  { key: 'epe', label: 'EPE Sheet', unit: 'Sqm', perModule: 5.4 },
  { key: 'frame', label: 'Frame', unit: 'Sets', perModule: 1 },
  { key: 'sealant', label: 'Sealant', unit: 'Kg', perModule: 0.37 },
  { key: 'potting', label: 'Potting', unit: 'Kg', perModule: 0.024 },
  { key: 'jb', label: 'Junction Box', unit: 'Sets', perModule: 1 },
  { key: 'rfid', label: 'RFID Tag', unit: 'Pcs', perModule: 1 },
  { key: 'tape', label: 'Tape', unit: 'Meter', perModule: 0.56 },
];

const fmt = (n) => {
  if (n === 0 || n === null || n === undefined) return '0';
  if (Number.isInteger(n)) return n.toLocaleString('en-IN');
  return parseFloat(n.toFixed(3)).toLocaleString('en-IN');
};

const EMPTY_COC = { invoiceNo: '', date: '', qty: '', partyName: '' };

function IQCTracker({ companyName, companyId, productionRecords = [] }) {
  const [pdiOffers, setPdiOffers] = useState({});
  const [bomOverrides, setBomOverrides] = useState({});
  const [cocMapping, setCocMapping] = useState({});
  const [activePdi, setActivePdi] = useState(null);
  const [activeMat, setActiveMat] = useState('cell');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [view, setView] = useState('overview');

  // Build PDI list from production records
  const pdis = useCallback(() => {
    const map = {};
    (productionRecords || []).forEach(r => {
      const p = r.pdi;
      if (!p || !p.trim()) return;
      if (!map[p]) map[p] = { name: p, produced: 0, records: 0 };
      map[p].produced += (r.dayProduction || 0) + (r.nightProduction || 0);
      map[p].records += 1;
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.name.replace(/\D/g, '')) || 0;
      const nb = parseInt(b.name.replace(/\D/g, '')) || 0;
      return na - nb;
    });
  }, [productionRecords])();

  // Load saved data on mount
  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/companies/${companyId}/iqc-data`);
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        if (d.pdiOffers) setPdiOffers(d.pdiOffers);
        if (d.bomOverrides) setBomOverrides(d.bomOverrides);
        if (d.cocMapping) setCocMapping(d.cocMapping);
      }
    } catch (e) { console.log('No saved IQC data yet'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (pdis.length > 0 && !activePdi) setActivePdi(pdis[0].name); }, [pdis, activePdi]);

  // Save
  const saveData = async () => {
    if (!companyId) return;
    setSaving(true); setSaveMsg('');
    try {
      await axios.put(`${API_BASE_URL}/companies/${companyId}/iqc-data`, { pdiOffers, bomOverrides, cocMapping });
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { setSaveMsg('Save failed'); console.error(e); }
    finally { setSaving(false); }
  };

  // Helpers
  const getOffer = (pdi) => pdiOffers[pdi] || 0;
  const getBom = (pdi, mk) => {
    const m = BOM_MATERIALS.find(x => x.key === mk);
    if (!m) return 0;
    const ov = bomOverrides[`${pdi}_${mk}`];
    if (ov !== undefined && ov !== null && ov !== '') return parseFloat(ov);
    return getOffer(pdi) * m.perModule;
  };
  const getCoc = (pdi, mk) => cocMapping[`${pdi}_${mk}`] || [];
  const getCocTotal = (pdi, mk) => getCoc(pdi, mk).reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const getRemaining = (pdi, mk) => getCocTotal(pdi, mk) - getBom(pdi, mk);

  const addCoc = (pdi, mk) => {
    const k = `${pdi}_${mk}`;
    setCocMapping(p => ({ ...p, [k]: [...(p[k] || []), { ...EMPTY_COC }] }));
  };
  const updateCoc = (pdi, mk, idx, field, val) => {
    const k = `${pdi}_${mk}`;
    setCocMapping(p => {
      const rows = [...(p[k] || [])];
      if (rows[idx]) rows[idx] = { ...rows[idx], [field]: val };
      return { ...p, [k]: rows };
    });
  };
  const deleteCoc = (pdi, mk, idx) => {
    const k = `${pdi}_${mk}`;
    setCocMapping(p => {
      const rows = [...(p[k] || [])];
      rows.splice(idx, 1);
      return { ...p, [k]: rows };
    });
  };
  const carryForward = (pdi, mk) => {
    const pi = pdis.findIndex(p => p.name === pdi);
    if (pi <= 0) return;
    const prev = pdis[pi - 1].name;
    const rem = getRemaining(prev, mk);
    if (rem > 0) {
      const k = `${pdi}_${mk}`;
      setCocMapping(p => {
        const rows = [...(p[k] || [])];
        rows.unshift({ invoiceNo: `C/F from ${prev}`, date: '', qty: rem.toString(), partyName: 'Carry Forward' });
        return { ...p, [k]: rows };
      });
    }
  };

  // ===== OVERVIEW =====
  const renderOverview = () => {
    const totalProd = pdis.reduce((s, p) => s + p.produced, 0);
    const totalOffer = pdis.reduce((s, p) => s + getOffer(p.name), 0);

    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <Card label="Total PDIs" value={pdis.length} color="#1976d2" icon="📑" />
          <Card label="Total Produced" value={fmt(totalProd)} color="#388e3c" icon="🏭" sub="modules" />
          <Card label="Total Offered" value={fmt(totalOffer)} color="#f57c00" icon="📦" sub="modules" />
          <Card label="Difference" value={fmt(totalProd - totalOffer)} color={totalProd - totalOffer >= 0 ? '#2e7d32' : '#c62828'} icon="📊" sub="modules" />
        </div>

        <h3 style={{ margin: '0 0 15px', color: '#1a237e', fontSize: '16px' }}>PDI Wise Offer & BOM Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
          {pdis.map((pdi, idx) => {
            const offered = getOffer(pdi.name);
            const diff = pdi.produced - offered;
            const matWithCoc = BOM_MATERIALS.filter(m => getCoc(pdi.name, m.key).length > 0).length;
            return (
              <div key={pdi.name} style={{ border: '2px solid #c5cae9', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => { setActivePdi(pdi.name); setView('detail'); }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}>
                <div style={{ padding: '15px 18px', background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)', color: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '16px' }}>{pdi.name}</strong>
                    <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '10px' }}>#{idx + 1}</span>
                  </div>
                </div>
                <div style={{ padding: '15px 18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#888' }}>Produced</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#1565c0' }}>{fmt(pdi.produced)}</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#888' }}>Offered</div><div style={{ fontSize: '18px', fontWeight: '700', color: offered > 0 ? '#2e7d32' : '#bbb' }}>{offered > 0 ? fmt(offered) : '-'}</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: '#888' }}>Diff</div><div style={{ fontSize: '18px', fontWeight: '700', color: diff >= 0 ? '#388e3c' : '#c62828' }}>{offered > 0 ? (diff >= 0 ? '+' : '') + fmt(diff) : '-'}</div></div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>PDI Offer Qty (Modules)</label>
                    <input type="number" value={pdiOffers[pdi.name] || ''} onChange={e => { e.stopPropagation(); setPdiOffers(p => ({ ...p, [pdi.name]: parseInt(e.target.value) || 0 })); }}
                      onClick={e => e.stopPropagation()} placeholder={`e.g. ${pdi.produced}`}
                      style={{ width: '100%', padding: '8px 12px', border: '2px solid #c5cae9', borderRadius: '6px', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#666' }}>COC: <strong>{matWithCoc}/{BOM_MATERIALS.length}</strong></span>
                    <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '10px', fontWeight: '600',
                      background: matWithCoc === BOM_MATERIALS.length ? '#e8f5e9' : matWithCoc > 0 ? '#fff3e0' : '#ffebee',
                      color: matWithCoc === BOM_MATERIALS.length ? '#2e7d32' : matWithCoc > 0 ? '#e65100' : '#c62828' }}>
                      {matWithCoc === BOM_MATERIALS.length ? 'Complete' : matWithCoc > 0 ? 'Partial' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ===== PDI DETAIL =====
  const renderDetail = () => {
    if (!activePdi) return <p>Select a PDI</p>;
    const pdi = pdis.find(p => p.name === activePdi);
    if (!pdi) return <p>PDI not found</p>;
    const offered = getOffer(activePdi);

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={() => setView('overview')} style={{ padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>← Back</button>
            <div>
              <h3 style={{ margin: 0, color: '#1a237e', fontSize: '20px' }}>{activePdi}</h3>
              <span style={{ fontSize: '12px', color: '#888' }}>Produced: <strong>{fmt(pdi.produced)}</strong> | Offered: <strong style={{ color: offered > 0 ? '#2e7d32' : '#c62828' }}>{offered > 0 ? fmt(offered) : 'Not set'}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: '#666' }}>Offer Qty:</label>
            <input type="number" value={pdiOffers[activePdi] || ''} onChange={e => setPdiOffers(p => ({ ...p, [activePdi]: parseInt(e.target.value) || 0 }))}
              placeholder="Enter offered modules" style={{ width: '150px', padding: '8px', border: '2px solid #1976d2', borderRadius: '6px', fontWeight: '700', fontSize: '14px' }} />
          </div>
        </div>

        {/* BOM Table */}
        <div style={{ overflowX: 'auto', marginBottom: '25px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#1a237e', color: 'white' }}>
                <th style={TH}>Sr</th><th style={TH}>Material</th><th style={TH}>Unit</th><th style={TH}>Per Module</th>
                <th style={{ ...TH, background: '#283593' }}>BOM Required</th>
                <th style={{ ...TH, background: '#1b5e20' }}>COC Qty</th>
                <th style={{ ...TH, background: '#b71c1c' }}>Remaining</th>
                <th style={{ ...TH, background: '#4a148c' }}>COC Details</th>
              </tr>
            </thead>
            <tbody>
              {BOM_MATERIALS.map((mat, idx) => {
                const bom = getBom(activePdi, mat.key);
                const cocQty = getCocTotal(activePdi, mat.key);
                const rem = cocQty - bom;
                const cocRows = getCoc(activePdi, mat.key);
                const isAct = activeMat === mat.key;
                const ovKey = `${activePdi}_${mat.key}`;
                const hasOv = bomOverrides[ovKey] !== undefined && bomOverrides[ovKey] !== '';
                return (
                  <tr key={mat.key} style={{ background: isAct ? '#e8eaf6' : idx % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #e0e0e0', cursor: 'pointer' }} onClick={() => setActiveMat(mat.key)}>
                    <td style={TD}>{idx + 1}</td>
                    <td style={{ ...TD, fontWeight: '600', color: '#1a237e' }}>{mat.label}</td>
                    <td style={TD}>{mat.unit}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>{mat.perModule}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        {hasOv && <span style={{ fontSize: '9px', color: '#ff9800' }} title="Manually adjusted">✏️</span>}
                        <input type="number" value={hasOv ? bomOverrides[ovKey] : ''} onChange={e => { e.stopPropagation(); setBomOverrides(p => ({ ...p, [ovKey]: e.target.value })); }} onClick={e => e.stopPropagation()}
                          placeholder={fmt(offered * mat.perModule)} style={{ width: '100px', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px', textAlign: 'right', fontWeight: '600', background: hasOv ? '#fff3e0' : 'transparent' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', textAlign: 'right' }}>{fmt(bom)} {mat.unit}</div>
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: '700', color: cocQty > 0 ? '#2e7d32' : '#bbb' }}>{cocQty > 0 ? fmt(cocQty) : '-'}</td>
                    <td style={{ ...TD, textAlign: 'right', fontWeight: '700', color: rem >= 0 ? '#2e7d32' : '#c62828', background: rem >= 0 ? '#e8f5e933' : '#ffebee33' }}>
                      {cocQty > 0 || bom > 0 ? (rem >= 0 ? '+' : '') + fmt(rem) : '-'}
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: '600', background: cocRows.length > 0 ? '#e8f5e9' : '#f5f5f5', color: cocRows.length > 0 ? '#2e7d32' : '#999' }}>
                        {cocRows.length > 0 ? `${cocRows.length} invoices` : 'No COC'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* COC Section */}
        {renderCocSection()}
      </>
    );
  };

  // ===== COC INVOICES =====
  const renderCocSection = () => {
    const mat = BOM_MATERIALS.find(m => m.key === activeMat);
    if (!mat) return null;
    const cocRows = getCoc(activePdi, activeMat);
    const bom = getBom(activePdi, activeMat);
    const total = getCocTotal(activePdi, activeMat);
    const rem = total - bom;
    const pi = pdis.findIndex(p => p.name === activePdi);

    return (
      <div style={{ border: '2px solid #1976d2', borderRadius: '12px', overflow: 'hidden', marginBottom: '15px' }}>
        <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px' }}>COC Invoices — {mat.label} ({mat.unit})</h4>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>{activePdi} | BOM Required: <strong>{fmt(bom)}</strong> {mat.unit}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {pi > 0 && <button onClick={() => carryForward(activePdi, activeMat)} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>Carry from {pdis[pi - 1].name}</button>}
            <button onClick={() => addCoc(activePdi, activeMat)} style={{ padding: '6px 14px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>+ Add Invoice</button>
          </div>
        </div>

        <div style={{ padding: '15px' }}>
          {cocRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
              <div style={{ fontSize: '30px', marginBottom: '10px' }}>📭</div>
              <p>No COC invoices added yet.</p>
              <button onClick={() => addCoc(activePdi, activeMat)} style={{ padding: '8px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>+ Add First Invoice</button>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#e3f2fd' }}>
                    <th style={TH2}>#</th><th style={TH2}>Invoice Number</th><th style={TH2}>Date</th><th style={TH2}>Qty ({mat.unit})</th><th style={TH2}>Party / Supplier</th><th style={TH2}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cocRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={TD2}>{idx + 1}</td>
                      <td style={TD2}><input type="text" value={row.invoiceNo} onChange={e => updateCoc(activePdi, activeMat, idx, 'invoiceNo', e.target.value)} placeholder="e.g. ZJAXSM20250444A" style={INP} /></td>
                      <td style={TD2}><input type="date" value={row.date} onChange={e => updateCoc(activePdi, activeMat, idx, 'date', e.target.value)} style={{ ...INP, width: '130px' }} /></td>
                      <td style={TD2}><input type="number" value={row.qty} onChange={e => updateCoc(activePdi, activeMat, idx, 'qty', e.target.value)} placeholder="0" style={{ ...INP, width: '100px', textAlign: 'right', fontWeight: '700' }} /></td>
                      <td style={TD2}><input type="text" value={row.partyName} onChange={e => updateCoc(activePdi, activeMat, idx, 'partyName', e.target.value)} placeholder="e.g. Tongwei, CSG, Flat" style={INP} /></td>
                      <td style={{ ...TD2, textAlign: 'center' }}><button onClick={() => deleteCoc(activePdi, activeMat, idx)} style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontSize: '11px' }}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '12px', padding: '12px 15px', background: rem >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '13px' }}><strong>Total COC:</strong> {fmt(total)} {mat.unit} | <strong>Required:</strong> {fmt(bom)} {mat.unit}</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: rem >= 0 ? '#2e7d32' : '#c62828' }}>{rem >= 0 ? '✅' : '⚠️'} Remaining: {rem >= 0 ? '+' : ''}{fmt(rem)} {mat.unit}</div>
              </div>
            </>
          )}
        </div>

        {/* Material quick tabs */}
        <div style={{ padding: '10px 15px', background: '#f5f5f5', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '5px', overflowX: 'auto', flexWrap: 'nowrap' }}>
          {BOM_MATERIALS.map(m => {
            const has = getCoc(activePdi, m.key).length > 0;
            const act = activeMat === m.key;
            return (
              <button key={m.key} onClick={() => setActiveMat(m.key)} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: act ? '700' : '500', background: act ? '#1976d2' : 'white', color: act ? 'white' : '#555', border: act ? 'none' : '1px solid #ddd', borderRadius: '15px', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative' }}>
                {m.label}
                {has && <span style={{ position: 'absolute', top: '2px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: '#4CAF50' }} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ===== MAIN =====
  return (
    <div style={{ padding: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '18px 22px', background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)', borderRadius: '12px', color: 'white', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>📋 IQC - COC Tracker</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>{companyName} | PDI Offer → BOM → COC Mapping</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {saveMsg && <span style={{ fontSize: '13px', fontWeight: '600' }}>{saveMsg === 'Saved!' ? '✅' : '❌'} {saveMsg}</span>}
          <button onClick={saveData} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#666' : '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            {saving ? '⏳ Saving...' : '💾 Save All'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>⏳ Loading saved data...</div>
      ) : pdis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
          <div style={{ fontSize: '50px', marginBottom: '15px' }}>📭</div>
          <p style={{ fontSize: '16px' }}>No PDI records found.</p>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Add production records with PDI numbers first in the Production tab.</p>
        </div>
      ) : (
        view === 'overview' ? renderOverview() : renderDetail()
      )}
    </div>
  );
}

const Card = ({ label, value, color, icon, sub }) => (
  <div style={{ padding: '18px', borderRadius: '12px', textAlign: 'center', border: `2px solid ${color}22`, background: `${color}08` }}>
    <div style={{ fontSize: '20px', marginBottom: '5px' }}>{icon}</div>
    <div style={{ fontSize: '26px', fontWeight: '800', color }}>{value}</div>
    <div style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{label}</div>
    {sub && <div style={{ fontSize: '10px', color: '#bbb' }}>{sub}</div>}
  </div>
);

const TH = { padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' };
const TD = { padding: '8px', borderBottom: '1px solid #e0e0e0', fontSize: '12px' };
const TH2 = { padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#1565c0' };
const TD2 = { padding: '6px 8px', fontSize: '12px' };
const INP = { width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' };

export default IQCTracker;
