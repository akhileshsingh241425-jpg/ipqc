import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// MRP COC APIs
const MRP_COC_API = 'https://umanmrp.in/api/coc_api.php';
const MRP_ASSIGNED_API = 'https://umanmrp.in/a/get_assigned_coc_records.php';

// Map software company names → MRP assigned_to codes
const COMPANY_NAME_TO_MRP = {
  'sterlin and wilson': 'S&W',
  'sterlin & wilson': 'S&W',
  'sterlin': 'S&W',
  's&w': 'S&W',
  'larsen & toubro': 'L&T',
  'larsen and toubro': 'L&T',
  'l&t': 'L&T',
  'rays power': 'Rays',
  'rays power infra': 'Rays',
  'rays': 'Rays',
};
const getMrpCompanyCode = (name) => {
  if (!name) return '';
  const lower = name.trim().toLowerCase();
  // Exact match first
  if (COMPANY_NAME_TO_MRP[lower]) return COMPANY_NAME_TO_MRP[lower];
  // Partial match
  for (const [pattern, code] of Object.entries(COMPANY_NAME_TO_MRP)) {
    if (lower.includes(pattern) || pattern.includes(lower)) return code;
  }
  return name;
};

// Match MRP "Lot X" → PDI name in our system
const matchPdiFromLot = (mrpPdiNo, pdiList) => {
  if (!mrpPdiNo || !pdiList || pdiList.length === 0) return null;
  const numMatch = mrpPdiNo.match(/(\d+\.?\d*)/);
  if (!numMatch) return null;
  const targetNum = numMatch[1];
  for (const pdi of pdiList) {
    const pdiNum = (pdi.name || '').match(/(\d+\.?\d*)/);
    if (pdiNum && pdiNum[1] === targetNum) return pdi.name;
  }
  return null;
};

// Map MRP material names → BOM_MATERIALS keys
const MRP_MATERIAL_MAP = {
  'solar cell': 'cell', 'cell': 'cell', 'cells': 'cell',
  'front glass': 'f_glass', 'front tempered glass': 'f_glass',
  'back glass': 'b_glass', 'back tempered glass': 'b_glass', 'rear glass': 'b_glass',
  'glass': 'f_glass',
  'ribbon': 'ribbon', 'interconnect ribbon': 'ribbon',
  'flux': 'flux', 'soldering flux': 'flux',
  'busbar-4': 'busbar4', 'busbar 4': 'busbar4', 'bus bar 4': 'busbar4', 'busbar4': 'busbar4',
  'busbar-6': 'busbar6', 'busbar 6': 'busbar6', 'bus bar 6': 'busbar6', 'busbar6': 'busbar6',
  'epe sheet': 'epe', 'epe': 'epe', 'eva': 'epe', 'epe foam': 'epe',
  'frame': 'frame', 'aluminium frame': 'frame', 'aluminum frame': 'frame', 'al frame': 'frame',
  'sealant': 'sealant', 'silicone sealant': 'sealant', 'sealent': 'sealant',
  'potting': 'potting', 'potting material': 'potting', 'jb potting': 'potting',
  'junction box': 'jb', 'j.box': 'jb', 'jb': 'jb', 'j box': 'jb',
  'rfid tag': 'rfid', 'rfid': 'rfid',
  'tape': 'tape', 'adhesive tape': 'tape',
};

const matchMaterialKey = (name) => {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  if (MRP_MATERIAL_MAP[lower]) return MRP_MATERIAL_MAP[lower];
  // Partial match
  for (const [pattern, key] of Object.entries(MRP_MATERIAL_MAP)) {
    if (lower.includes(pattern) || pattern.includes(lower)) return key;
  }
  return null;
};

function IQCTracker({ companyName, companyId, productionRecords = [] }) {
  const [pdiOffers, setPdiOffers] = useState({});
  const [ftrAssignedCounts, setFtrAssignedCounts] = useState({});
  const [ftrPdiList, setFtrPdiList] = useState([]);
  const [bomOverrides, setBomOverrides] = useState({});

  // COC Inventory: {matKey: [{id, invoiceNo, date, totalQty, partyName, source, pdiNo}]}
  const [cocInventory, setCocInventory] = useState({});
  // COC Allocations: {"pdi_matKey": [{cocId, qty}]}
  const [cocAllocations, setCocAllocations] = useState({});

  const [activePdi, setActivePdi] = useState(null);
  const [activeMat, setActiveMat] = useState('cell');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [view, setView] = useState('overview'); // overview | detail | inventory
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Refs for stable access in callbacks
  const pdisRef = useRef([]);
  const hasSyncedRef = useRef(false);

  const normalizePdi = (value) => String(value || '').trim().toLowerCase();

  // Build PDI list (FTR assigned + non-assigned production PDIs)
  const pdis = useCallback(() => {
    const productionMap = {};
    (productionRecords || []).forEach(r => {
      const p = r.pdi;
      if (!p || !p.trim()) return;
      if (!productionMap[p]) productionMap[p] = { name: p, produced: 0, records: 0 };
      productionMap[p].produced += (r.dayProduction || 0) + (r.nightProduction || 0);
      productionMap[p].records += 1;
    });

    const allPdiNames = new Set([
      ...Object.keys(productionMap),
      ...(Array.isArray(ftrPdiList) ? ftrPdiList.map(x => x.name).filter(Boolean) : [])
    ]);

    return Array.from(allPdiNames).map((name) => {
      const prod = productionMap[name] || { produced: 0, records: 0 };
      const assignedCount = ftrAssignedCounts[normalizePdi(name)];
      return { name, produced: prod.produced, records: prod.records, assigned: assignedCount, isFtrAssigned: assignedCount !== undefined };
    }).sort((a, b) => {
      const na = parseInt(a.name.replace(/\D/g, '')) || 0;
      const nb = parseInt(b.name.replace(/\D/g, '')) || 0;
      return na - nb;
    });
  }, [productionRecords, ftrPdiList, ftrAssignedCounts])();

  // Keep ref updated for callbacks
  pdisRef.current = pdis;

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
        if (d.cocInventory) setCocInventory(d.cocInventory);
        if (d.cocAllocations) setCocAllocations(d.cocAllocations);
      }
    } catch (e) { console.log('No saved IQC data yet'); }
    finally { setLoading(false); }
  }, [companyId]);

  // Load FTR assigned module counts
  const loadFtrAssignedCounts = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/ftr/company/${companyId}`);
      const assignments = Array.isArray(res.data?.pdi_assignments) ? res.data.pdi_assignments : [];
      const mapped = {};
      assignments.forEach((item) => {
        const pdiName = item?.pdi_number;
        if (!pdiName) return;
        mapped[normalizePdi(pdiName)] = parseInt(item?.count, 10) || 0;
      });
      setFtrPdiList(assignments.map((item) => ({
        name: item?.pdi_number, count: parseInt(item?.count, 10) || 0
      })).filter((item) => item.name));
      setFtrAssignedCounts(mapped);
    } catch (e) {
      console.error('Failed to load FTR assigned counts:', e);
      setFtrPdiList([]);
      setFtrAssignedCounts({});
    }
  }, [companyId]);

  // Load COC data from both MRP APIs and auto-populate inventory + allocations
  // API 1 (coc_api.php): All approved COCs → inventory / FIFO suggestions
  // API 2 (get_assigned_coc_records.php): Assigned COCs → auto-allocate to PDIs
  const syncMrpCoc = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch both APIs in parallel
      const [api1Res, api2Res] = await Promise.all([
        axios.post(MRP_COC_API, { from: fromDate, to: toDate }),
        axios.get(MRP_ASSIGNED_API)
      ]);

      // API 1: All approved COCs (for inventory / FIFO suggestions)
      const mrpRecords = Array.isArray(api1Res.data) ? api1Res.data : (api1Res.data?.data || []);

      // API 2: Assigned COCs — filter by current company
      const allAssigned = api2Res.data?.data || [];
      const mrpCode = getMrpCompanyCode(companyName);
      const myAssigned = allAssigned.filter(r => r.assigned_to === mrpCode);

      console.log(`[IQC Sync] Company: "${companyName}" → MRP code: "${mrpCode}"`);
      console.log(`[IQC Sync] API1: ${mrpRecords.length} COCs | API2: ${allAssigned.length} total, ${myAssigned.length} for ${mrpCode}`);
      console.log(`[IQC Sync] PDIs in system:`, pdisRef.current.map(p => p.name));
      console.log(`[IQC Sync] API2 unique companies:`, [...new Set(allAssigned.map(r => r.assigned_to))]);

      // ── Step 1: Build inventory from API 1 ──
      // Read current state via updater, build newInventory, return it
      let builtInventory = null;
      let addedCount = 0;

      setCocInventory(prev => {
        const next = {};
        // Keep existing manual entries (source !== 'mrp')
        Object.entries(prev).forEach(([mk, items]) => {
          next[mk] = (items || []).filter(i => i.source !== 'mrp');
        });

        // Add ALL MRP records fresh (avoids stale duplicates)
        mrpRecords.forEach(rec => {
          const matKey = matchMaterialKey(rec.material_name);
          if (!matKey) return;
          const invNo = rec.invoice_no || '';
          const lotBatch = rec.lot_batch_no || '';
          if (!invNo) return;

          if (!next[matKey]) next[matKey] = [];
          // Dedup within batch
          const dupKey = `${invNo.toLowerCase()}_${lotBatch}`;
          if (next[matKey].find(i => `${(i.invoiceNo || '').toLowerCase()}_${i.lotBatchNo || ''}` === dupKey)) return;

          next[matKey].push({
            id: `mrp_${rec.id || Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            mrpId: String(rec.id || ''),
            invoiceNo: invNo,
            date: rec.invoice_date || rec.entry_date || '',
            totalQty: String(rec.coc_qty || rec.invoice_qty || 0),
            partyName: rec.brand || '',
            source: 'mrp',
            lotBatchNo: lotBatch,
            productType: rec.product_type || '',
            storeName: rec.store_name || '',
            cocDocUrl: rec.coc_document_url || '',
            iqcDocUrl: rec.iqc_document_url || '',
          });
          addedCount++;
        });

        builtInventory = next;
        return next;
      });

      // ── Step 2: Auto-allocate from API 2 ──
      const currentPdis = pdisRef.current;
      let autoCount = 0;
      let skipReasons = { noMatKey: 0, zeroQty: 0, noPdiMatch: 0, noInvMatch: 0, duplicate: 0 };

      if (myAssigned.length > 0 && currentPdis.length > 0 && builtInventory) {
        setCocAllocations(prev => {
          const next = {};
          // Preserve manual allocations, remove old MRP auto-assignments
          Object.entries(prev).forEach(([allocKey, allocs]) => {
            const manual = (allocs || []).filter(a => a.source !== 'mrp_assigned');
            if (manual.length > 0) next[allocKey] = [...manual];
          });

          myAssigned.forEach(rec => {
            const matKey = matchMaterialKey(rec.material_name);
            if (!matKey) { skipReasons.noMatKey++; return; }
            const qty = parseFloat(rec.remaining_qty) || 0;
            if (qty <= 0) { skipReasons.zeroQty++; return; }

            // Match "Lot 5" / "Lot-5" → PDI name in our system
            const pdiName = matchPdiFromLot(rec.pdi_no, currentPdis);
            if (!pdiName) { skipReasons.noPdiMatch++; console.log(`[IQC Sync] No PDI match for "${rec.pdi_no}" (material: ${rec.material_name})`); return; }

            // Find matching COC in inventory by invoice_no + lot_batch_no
            const invItems = builtInventory[matKey] || [];
            let matched = invItems.find(c =>
              c.invoiceNo === rec.invoice_no && (c.lotBatchNo || '') === (rec.lot_batch_no || '')
            );
            // Fallback: match by invoice_no only
            if (!matched) {
              matched = invItems.find(c => c.invoiceNo === rec.invoice_no);
            }
            if (!matched) { skipReasons.noInvMatch++; console.log(`[IQC Sync] No inventory match for invoice "${rec.invoice_no}" lot "${rec.lot_batch_no}" mat "${matKey}"`); return; }

            const allocKey = `${pdiName}_${matKey}`;
            if (!next[allocKey]) next[allocKey] = [];
            // Don't duplicate same COC assignment
            if (next[allocKey].find(a => a.cocId === matched.id && a.source === 'mrp_assigned')) { skipReasons.duplicate++; return; }

            next[allocKey].push({ cocId: matched.id, qty, source: 'mrp_assigned' });
            autoCount++;
          });

          console.log(`[IQC Sync] Auto-assigned: ${autoCount} | Skipped:`, skipReasons);
          return next;
        });
      } else {
        console.log(`[IQC Sync] Skip auto-assign: myAssigned=${myAssigned.length}, pdis=${currentPdis.length}, inventory=${!!builtInventory}`);
      }

      if (!silent) {
        const parts = [];
        if (addedCount > 0) parts.push(`${addedCount} COC synced`);
        if (autoCount > 0) parts.push(`${autoCount} auto-assigned to PDIs`);
        if (parts.length > 0) {
          setSyncMsg(`✅ ${parts.join(', ')}`);
        } else {
          setSyncMsg(`✅ Up to date (${mrpRecords.length} COCs, ${myAssigned.length} assigned)`);
        }
      }
    } catch (e) {
      console.error('MRP COC sync error:', e);
      if (!silent) setSyncMsg('❌ MRP sync failed: ' + (e.message || ''));
    } finally {
      if (!silent) {
        setSyncing(false);
        setTimeout(() => setSyncMsg(''), 5000);
      }
    }
  }, [companyName]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadFtrAssignedCounts(); }, [loadFtrAssignedCounts]);
  useEffect(() => { if (pdis.length > 0 && !activePdi) setActivePdi(pdis[0].name); }, [pdis, activePdi]);
  // Auto-sync MRP COC after data loaded + PDIs available (runs once per company)
  useEffect(() => {
    if (!hasSyncedRef.current && pdis.length > 0 && !loading) {
      hasSyncedRef.current = true;
      syncMrpCoc(true);
    }
  }, [pdis.length, syncMrpCoc, loading]);

  // Save
  const saveData = async () => {
    if (!companyId) return;
    setSaving(true); setSaveMsg('');
    try {
      await axios.put(`${API_BASE_URL}/companies/${companyId}/iqc-data`, { pdiOffers, bomOverrides, cocInventory, cocAllocations });
      await loadFtrAssignedCounts();
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { setSaveMsg('Save failed'); console.error(e); }
    finally { setSaving(false); }
  };

  // ===== HELPERS =====
  const getOffer = (pdi) => {
    const normalized = normalizePdi(pdi);
    if (ftrAssignedCounts[normalized] !== undefined) return ftrAssignedCounts[normalized];
    return pdiOffers[pdi] || 0;
  };
  const hasFtrAssignedOffer = (pdi) => ftrAssignedCounts[normalizePdi(pdi)] !== undefined;
  const getBom = (pdi, mk) => {
    const m = BOM_MATERIALS.find(x => x.key === mk);
    if (!m) return 0;
    const ov = bomOverrides[`${pdi}_${mk}`];
    if (ov !== undefined && ov !== null && ov !== '') return parseFloat(ov);
    return getOffer(pdi) * m.perModule;
  };

  // COC Inventory ID generator
  const genId = () => `coc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Total qty used from a COC across ALL PDIs (exclude one key optionally)
  const getCocUsedTotal = (cocId, excludeKey = null) => {
    let total = 0;
    Object.entries(cocAllocations).forEach(([k, allocs]) => {
      if (k === excludeKey) return;
      (allocs || []).forEach(a => { if (a.cocId === cocId) total += (parseFloat(a.qty) || 0); });
    });
    return total;
  };

  // Available qty for a COC (total - used by others)
  const getCocAvailable = (matKey, cocId, excludeKey = null) => {
    const inv = (cocInventory[matKey] || []).find(c => c.id === cocId);
    if (!inv) return 0;
    return (parseFloat(inv.totalQty) || 0) - getCocUsedTotal(cocId, excludeKey);
  };

  // Allocated total for a PDI + material
  const getAllocTotal = (pdi, matKey) => {
    return (cocAllocations[`${pdi}_${matKey}`] || []).reduce((s, a) => s + (parseFloat(a.qty) || 0), 0);
  };

  // Current allocation source (mrp_assigned or manual)
  const getAllocSource = (pdi, matKey, cocId) => {
    const allocs = cocAllocations[`${pdi}_${matKey}`] || [];
    const found = allocs.find(a => a.cocId === cocId);
    return found?.source || '';
  };

  // Current allocation qty from a specific COC for a PDI+material
  const getAllocQty = (pdi, matKey, cocId) => {
    const allocs = cocAllocations[`${pdi}_${matKey}`] || [];
    const found = allocs.find(a => a.cocId === cocId);
    return found ? (parseFloat(found.qty) || 0) : 0;
  };

  // FIFO sorted inventory for a material (oldest date first)
  const getInventoryFIFO = (matKey) => {
    return [...(cocInventory[matKey] || [])].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
  };

  // Set allocation qty for a specific COC in a PDI+material
  const setAllocQty = (pdi, matKey, cocId, qty) => {
    const k = `${pdi}_${matKey}`;
    setCocAllocations(prev => {
      const allocs = [...(prev[k] || [])];
      const idx = allocs.findIndex(a => a.cocId === cocId);
      const numQty = parseFloat(qty) || 0;
      if (numQty <= 0) {
        if (idx >= 0) allocs.splice(idx, 1);
      } else {
        if (idx >= 0) allocs[idx] = { ...allocs[idx], qty: numQty };
        else allocs.push({ cocId, qty: numQty });
      }
      return { ...prev, [k]: allocs };
    });
  };

  // Auto FIFO allocation — fills BOM requirement from oldest COCs first
  const autoAllocateFIFO = (pdi, matKey) => {
    const required = getBom(pdi, matKey);
    const sorted = getInventoryFIFO(matKey);
    const k = `${pdi}_${matKey}`;
    let remaining = required;
    const newAllocs = [];
    sorted.forEach(coc => {
      if (remaining <= 0) return;
      const available = (parseFloat(coc.totalQty) || 0) - getCocUsedTotal(coc.id, k);
      if (available <= 0) return;
      const take = Math.min(remaining, available);
      newAllocs.push({ cocId: coc.id, qty: take });
      remaining -= take;
    });
    setCocAllocations(prev => ({ ...prev, [k]: newAllocs }));
  };

  // Clear all allocations for a PDI+material
  const clearAllocations = (pdi, matKey) => {
    const k = `${pdi}_${matKey}`;
    setCocAllocations(prev => ({ ...prev, [k]: [] }));
  };

  // Inventory CRUD
  const addCocToInventory = (matKey) => {
    setCocInventory(prev => ({
      ...prev,
      [matKey]: [...(prev[matKey] || []), { id: genId(), invoiceNo: '', date: '', totalQty: '', partyName: '' }]
    }));
  };
  const updateCocInv = (matKey, idx, field, val) => {
    setCocInventory(prev => {
      const list = [...(prev[matKey] || [])];
      list[idx] = { ...list[idx], [field]: val };
      return { ...prev, [matKey]: list };
    });
  };
  const deleteCocInv = (matKey, idx) => {
    const cocId = (cocInventory[matKey] || [])[idx]?.id;
    if (cocId) {
      setCocAllocations(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          next[k] = (next[k] || []).filter(a => a.cocId !== cocId);
          if (next[k].length === 0) delete next[k];
        });
        return next;
      });
    }
    setCocInventory(prev => {
      const list = [...(prev[matKey] || [])];
      list.splice(idx, 1);
      return { ...prev, [matKey]: list };
    });
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, color: '#1a237e', fontSize: '16px' }}>PDI Wise Offer & BOM Status</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {syncMsg && <span style={{ fontSize: '12px', fontWeight: '600', color: syncMsg.includes('✅') ? '#2e7d32' : syncMsg.includes('❌') ? '#c62828' : '#ef6c00' }}>{syncMsg}</span>}
            <button onClick={() => syncMrpCoc(false)} disabled={syncing} style={{ padding: '10px 20px', background: syncing ? '#999' : 'linear-gradient(135deg, #1565c0, #1976d2)', color: 'white', border: 'none', borderRadius: '8px', cursor: syncing ? 'wait' : 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: '0 2px 8px rgba(21,101,192,0.3)' }}>
              {syncing ? '⏳ Syncing...' : '🔄 Sync MRP COC'}
            </button>
            <button onClick={() => setView('inventory')} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #ff6f00 0%, #ff8f00 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: '0 2px 8px rgba(255,111,0,0.3)' }}>
              📦 COC Inventory
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
          {pdis.map((pdi, idx) => {
            const offered = getOffer(pdi.name);
            const diff = pdi.produced - offered;
            const matWithAlloc = BOM_MATERIALS.filter(m => getAllocTotal(pdi.name, m.key) > 0).length;
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
                    <input type="number" value={getOffer(pdi.name) || ''} onChange={e => { e.stopPropagation(); if (hasFtrAssignedOffer(pdi.name)) return; setPdiOffers(p => ({ ...p, [pdi.name]: parseInt(e.target.value) || 0 })); }}
                      onClick={e => e.stopPropagation()} placeholder={`e.g. ${pdi.produced}`}
                      disabled={hasFtrAssignedOffer(pdi.name)}
                      style={{ width: '100%', padding: '8px 12px', border: '2px solid #c5cae9', borderRadius: '6px', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box' }} />
                    {hasFtrAssignedOffer(pdi.name) && (
                      <div style={{ fontSize: '10px', color: '#2e7d32', marginTop: '4px' }}>From FTR assigned modules</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#666' }}>COC: <strong>{matWithAlloc}/{BOM_MATERIALS.length}</strong></span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {!hasFtrAssignedOffer(pdi.name) && (
                        <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '10px', fontWeight: '600', background: '#fff8e1', color: '#ef6c00' }}>Manual Entry</span>
                      )}
                      <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '10px', fontWeight: '600',
                        background: matWithAlloc === BOM_MATERIALS.length ? '#e8f5e9' : matWithAlloc > 0 ? '#fff3e0' : '#ffebee',
                        color: matWithAlloc === BOM_MATERIALS.length ? '#2e7d32' : matWithAlloc > 0 ? '#e65100' : '#c62828' }}>
                        {matWithAlloc === BOM_MATERIALS.length ? 'Complete' : matWithAlloc > 0 ? 'Partial' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ===== COC INVENTORY VIEW =====
  const renderInventory = () => {
    const mat = BOM_MATERIALS.find(m => m.key === activeMat) || BOM_MATERIALS[0];
    const items = cocInventory[activeMat] || [];

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={() => setView('overview')} style={{ padding: '8px 16px', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>← Back</button>
            <div>
              <h3 style={{ margin: 0, color: '#ff6f00', fontSize: '20px' }}>📦 COC Inventory</h3>
              <span style={{ fontSize: '12px', color: '#888' }}>Add all COC invoices here. They'll appear as FIFO suggestions in PDI details.</span>
            </div>
          </div>
        </div>

        {/* Material Tabs */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', marginBottom: '20px', padding: '5px 0' }}>
          {BOM_MATERIALS.map(m => {
            const count = (cocInventory[m.key] || []).length;
            const act = activeMat === m.key;
            return (
              <button key={m.key} onClick={() => setActiveMat(m.key)} style={{ padding: '8px 16px', fontSize: '12px', fontWeight: act ? '700' : '500', background: act ? '#ff6f00' : 'white', color: act ? 'white' : '#555', border: act ? 'none' : '1px solid #ddd', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {m.label} {count > 0 && <span style={{ marginLeft: '4px', background: act ? 'rgba(255,255,255,0.3)' : '#ff6f00', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '10px' }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Inventory Table */}
        <div style={{ border: '2px solid #ffe0b2', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg, #ff6f00, #ff8f00)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px' }}>{mat.label} — COC Invoices</h4>
              <span style={{ fontSize: '11px', opacity: 0.85 }}>Unit: {mat.unit} | {items.length} invoice(s)</span>
            </div>
            <button onClick={() => syncMrpCoc(false)} disabled={syncing} style={{ padding: '8px 18px', background: syncing ? '#999' : '#1976d2', color: 'white', border: 'none', borderRadius: '6px', cursor: syncing ? 'wait' : 'pointer', fontWeight: '700', fontSize: '12px', marginRight: '8px' }}>{syncing ? '⏳...' : '🔄 Sync from MRP'}</button>
            <button onClick={() => addCocToInventory(activeMat)} style={{ padding: '8px 18px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>+ Add Manual</button>
          </div>
          <div style={{ padding: '15px' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                <p style={{ fontSize: '14px' }}>No COC invoices for {mat.label} yet.</p>
                <button onClick={() => addCocToInventory(activeMat)} style={{ padding: '10px 24px', background: '#ff6f00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>+ Add First Invoice</button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ background: '#fff3e0' }}>
                      <th style={TH2}>#</th>
                      <th style={TH2}>Source</th>
                      <th style={TH2}>Invoice Number</th>
                      <th style={TH2}>Lot/Batch</th>
                      <th style={TH2}>Date</th>
                      <th style={{ ...TH2, color: '#e65100' }}>Total Qty ({mat.unit})</th>
                      <th style={{ ...TH2, color: '#1565c0' }}>Used</th>
                      <th style={{ ...TH2, color: '#2e7d32' }}>Available</th>
                      <th style={TH2}>Party / Supplier</th>
                      <th style={{ ...TH2, textAlign: 'center' }}>Docs</th>
                      <th style={{ ...TH2, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const totalQty = parseFloat(item.totalQty) || 0;
                      const used = getCocUsedTotal(item.id);
                      const avail = totalQty - used;
                      const pct = totalQty > 0 ? (used / totalQty * 100) : 0;
                      const isMrp = item.source === 'mrp';
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #e0e0e0', background: isMrp ? '#f8fffe' : 'white' }}>
                          <td style={TD2}>{idx + 1}</td>
                          <td style={{ ...TD2, textAlign: 'center' }}>
                            <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', background: isMrp ? '#e3f2fd' : '#fff8e1', color: isMrp ? '#1565c0' : '#ef6c00' }}>{isMrp ? 'MRP' : 'Manual'}</span>
                          </td>
                          <td style={TD2}>{isMrp ? <span style={{ fontWeight: '600', fontSize: '12px' }}>{item.invoiceNo}</span> : <input type="text" value={item.invoiceNo} onChange={e => updateCocInv(activeMat, idx, 'invoiceNo', e.target.value)} placeholder="Invoice No." style={INP} />}</td>
                          <td style={{ ...TD2, fontSize: '11px', color: '#666' }}>{item.lotBatchNo || '—'}</td>
                          <td style={TD2}>{isMrp ? <span style={{ fontSize: '11px' }}>{item.date}</span> : <input type="date" value={item.date} onChange={e => updateCocInv(activeMat, idx, 'date', e.target.value)} style={{ ...INP, width: '130px' }} />}</td>
                          <td style={{ ...TD2, textAlign: 'right' }}>{isMrp ? <span style={{ fontWeight: '700', fontSize: '13px' }}>{fmt(totalQty)}</span> : <input type="number" value={item.totalQty} onChange={e => updateCocInv(activeMat, idx, 'totalQty', e.target.value)} placeholder="0" style={{ ...INP, width: '110px', textAlign: 'right', fontWeight: '700' }} />}</td>
                          <td style={{ ...TD2, textAlign: 'right', fontWeight: '600', color: used > 0 ? '#1565c0' : '#bbb' }}>
                            {fmt(used)}
                            {totalQty > 0 && <div style={{ width: '100%', height: '3px', background: '#e0e0e0', borderRadius: '2px', marginTop: '3px' }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? '#c62828' : pct >= 80 ? '#ff9800' : '#4CAF50', borderRadius: '2px' }} />
                            </div>}
                          </td>
                          <td style={{ ...TD2, textAlign: 'right', fontWeight: '700', color: avail > 0 ? '#2e7d32' : avail === 0 && totalQty > 0 ? '#ff9800' : '#c62828' }}>{fmt(avail)}</td>
                          <td style={TD2}>{isMrp ? <span style={{ fontSize: '11px' }}>{item.partyName}</span> : <input type="text" value={item.partyName} onChange={e => updateCocInv(activeMat, idx, 'partyName', e.target.value)} placeholder="Party" style={INP} />}</td>
                          <td style={{ ...TD2, textAlign: 'center' }}>
                            {item.cocDocUrl && <a href={item.cocDocUrl} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#1565c0', marginRight: '4px' }} title="COC Document">📄COC</a>}
                            {item.iqcDocUrl && <a href={item.iqcDocUrl} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#2e7d32' }} title="IQC Document">📋IQC</a>}
                            {!item.cocDocUrl && !item.iqcDocUrl && <span style={{ color: '#ccc', fontSize: '10px' }}>—</span>}
                          </td>
                          <td style={{ ...TD2, textAlign: 'center' }}>
                            <button onClick={() => { if (window.confirm('Delete this COC invoice? All allocations will be removed.')) deleteCocInv(activeMat, idx); }} style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontSize: '11px' }}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
            <input type="number" value={getOffer(activePdi) || ''} onChange={e => { if (hasFtrAssignedOffer(activePdi)) return; setPdiOffers(p => ({ ...p, [activePdi]: parseInt(e.target.value) || 0 })); }}
              placeholder="Enter offered modules" disabled={hasFtrAssignedOffer(activePdi)} style={{ width: '150px', padding: '8px', border: '2px solid #1976d2', borderRadius: '6px', fontWeight: '700', fontSize: '14px' }} />
            {hasFtrAssignedOffer(activePdi) && <span style={{ fontSize: '11px', color: '#2e7d32' }}>From FTR</span>}
            {!hasFtrAssignedOffer(activePdi) && <span style={{ fontSize: '11px', color: '#ef6c00' }}>Manual</span>}
            <button onClick={() => setView('inventory')} style={{ padding: '8px 14px', background: '#ff6f00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>📦 Inventory</button>
          </div>
        </div>

        {/* BOM Table */}
        <div style={{ overflowX: 'auto', marginBottom: '25px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#1a237e', color: 'white' }}>
                <th style={TH}>Sr</th><th style={TH}>Material</th><th style={TH}>Unit</th><th style={TH}>Per Module</th>
                <th style={{ ...TH, background: '#283593' }}>BOM Required</th>
                <th style={{ ...TH, background: '#1b5e20' }}>COC Allocated</th>
                <th style={{ ...TH, background: '#b71c1c' }}>Remaining</th>
                <th style={{ ...TH, background: '#4a148c' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {BOM_MATERIALS.map((mat, idx) => {
                const bom = getBom(activePdi, mat.key);
                const cocQty = getAllocTotal(activePdi, mat.key);
                const rem = cocQty - bom;
                const allocCount = (cocAllocations[`${activePdi}_${mat.key}`] || []).length;
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
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: '600', background: allocCount > 0 ? '#e8f5e9' : '#f5f5f5', color: allocCount > 0 ? '#2e7d32' : '#999' }}>
                        {allocCount > 0 ? `${allocCount} COC` : 'No COC'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FIFO COC Allocation Section */}
        {renderCocAllocation()}
      </>
    );
  };

  // ===== COC ALLOCATION (FIFO SUGGESTIONS) =====
  const renderCocAllocation = () => {
    const mat = BOM_MATERIALS.find(m => m.key === activeMat);
    if (!mat) return null;
    const fifoItems = getInventoryFIFO(activeMat);
    const bom = getBom(activePdi, activeMat);
    const totalAlloc = getAllocTotal(activePdi, activeMat);
    const rem = totalAlloc - bom;
    const k = `${activePdi}_${activeMat}`;

    return (
      <div style={{ border: '2px solid #1976d2', borderRadius: '12px', overflow: 'hidden', marginBottom: '15px' }}>
        <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px' }}>📋 COC Allocation — {mat.label} ({mat.unit})</h4>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>{activePdi} | BOM Required: <strong>{fmt(bom)}</strong> {mat.unit} | FIFO Order</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => autoAllocateFIFO(activePdi, activeMat)} style={{ padding: '6px 14px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }} title="Automatically fill BOM requirement from oldest COC first">⚡ Auto FIFO</button>
            <button onClick={() => clearAllocations(activePdi, activeMat)} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>🗑️ Clear</button>
            <button onClick={() => setView('inventory')} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>📦 Add to Inventory</button>
          </div>
        </div>

        <div style={{ padding: '15px' }}>
          {fifoItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
              <div style={{ fontSize: '30px', marginBottom: '10px' }}>📭</div>
              <p>No COC invoices in inventory for <strong>{mat.label}</strong>.</p>
              <p style={{ fontSize: '12px', color: '#aaa' }}>Go to <strong>📦 COC Inventory</strong> to add invoices first.</p>
              <button onClick={() => setView('inventory')} style={{ padding: '8px 20px', background: '#ff6f00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>📦 Go to Inventory</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', padding: '8px 12px', background: '#e3f2fd', borderRadius: '6px' }}>
                💡 Invoices sorted by date (FIFO — oldest first). Enter qty to allocate. "Auto FIFO" fills BOM automatically. Cannot exceed available qty.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ background: '#e3f2fd' }}>
                      <th style={TH2}>#</th>
                      <th style={TH2}>Invoice No.</th>
                      <th style={{ ...TH2, fontSize: '10px' }}>Lot/Batch</th>
                      <th style={TH2}>Date</th>
                      <th style={TH2}>Party</th>
                      <th style={{ ...TH2, textAlign: 'right' }}>Total Qty</th>
                      <th style={{ ...TH2, textAlign: 'right', color: '#1565c0' }}>Used (Others)</th>
                      <th style={{ ...TH2, textAlign: 'right', color: '#2e7d32' }}>Available</th>
                      <th style={{ ...TH2, textAlign: 'center', color: '#e65100' }}>Allocate to {activePdi}</th>
                      <th style={{ ...TH2, textAlign: 'right', color: '#ff9800' }}>Reserve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fifoItems.map((coc, idx) => {
                      const totalQty = parseFloat(coc.totalQty) || 0;
                      const usedOthers = getCocUsedTotal(coc.id, k);
                      const available = totalQty - usedOthers;
                      const myAlloc = getAllocQty(activePdi, activeMat, coc.id);
                      const allocSource = getAllocSource(activePdi, activeMat, coc.id);
                      const isMrpAssigned = allocSource === 'mrp_assigned';
                      const reserve = available - myAlloc;
                      const pct = totalQty > 0 ? ((usedOthers + myAlloc) / totalQty * 100) : 0;
                      return (
                        <tr key={coc.id} style={{ borderBottom: '1px solid #e0e0e0', background: isMrpAssigned ? '#e8f5e9' : myAlloc > 0 ? '#f1f8e9' : 'white' }}>
                          <td style={TD2}>{idx + 1}</td>
                          <td style={{ ...TD2, fontWeight: '600', color: '#1a237e' }}>
                            {coc.invoiceNo || '—'}
                            {coc.source === 'mrp' && <span style={{ fontSize: '8px', background: '#e3f2fd', color: '#1565c0', padding: '1px 5px', borderRadius: '6px', fontWeight: '600', marginLeft: '4px', verticalAlign: 'super' }}>MRP</span>}
                          </td>
                          <td style={{ ...TD2, fontSize: '10px', color: '#666' }}>{coc.lotBatchNo || '—'}</td>
                          <td style={{ ...TD2, fontSize: '11px' }}>{coc.date || '—'}</td>
                          <td style={{ ...TD2, fontSize: '11px' }}>{coc.partyName || '—'}</td>
                          <td style={{ ...TD2, textAlign: 'right', fontWeight: '600' }}>{fmt(totalQty)}</td>
                          <td style={{ ...TD2, textAlign: 'right', color: usedOthers > 0 ? '#1565c0' : '#bbb' }}>{fmt(usedOthers)}</td>
                          <td style={{ ...TD2, textAlign: 'right', fontWeight: '700', color: available > 0 ? '#2e7d32' : '#c62828' }}>{fmt(available)}</td>
                          <td style={{ ...TD2, textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              {isMrpAssigned && <span style={{ fontSize: '8px', background: '#2e7d32', color: 'white', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>Auto</span>}
                              <input type="number" value={myAlloc || ''} min="0" max={available}
                                onChange={e => {
                                  let v = parseFloat(e.target.value) || 0;
                                  if (v > available) v = available;
                                  if (v < 0) v = 0;
                                  setAllocQty(activePdi, activeMat, coc.id, v);
                                }}
                                placeholder="0"
                                disabled={available <= 0 && myAlloc <= 0}
                                style={{ width: '100px', padding: '6px 8px', border: isMrpAssigned ? '2px solid #2e7d32' : myAlloc > 0 ? '2px solid #4CAF50' : '1px solid #ddd', borderRadius: '5px', fontSize: '12px', textAlign: 'right', fontWeight: '700', background: isMrpAssigned ? '#e8f5e9' : myAlloc > 0 ? '#e8f5e9' : available <= 0 ? '#f5f5f5' : 'white' }} />
                            </div>
                          </td>
                          <td style={{ ...TD2, textAlign: 'right' }}>
                            <span style={{ fontWeight: '600', color: reserve > 0 ? '#ff9800' : reserve === 0 && myAlloc > 0 ? '#999' : '#bbb' }}>{fmt(reserve)}</span>
                            <div style={{ width: '100%', height: '3px', background: '#e0e0e0', borderRadius: '2px', marginTop: '3px' }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? '#c62828' : pct >= 80 ? '#ff9800' : '#4CAF50', borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              {(() => {
                const mrpCount = (cocAllocations[k] || []).filter(a => a.source === 'mrp_assigned').length;
                const manualCount = (cocAllocations[k] || []).filter(a => a.source !== 'mrp_assigned').length;
                return (
                  <div style={{ marginTop: '12px', padding: '12px 15px', background: rem >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '13px' }}>
                      <strong>Total Allocated:</strong> {fmt(totalAlloc)} {mat.unit} | <strong>BOM Required:</strong> {fmt(bom)} {mat.unit}
                      {mrpCount > 0 && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '8px', fontWeight: '600' }}>🔗 {mrpCount} MRP Auto</span>}
                      {manualCount > 0 && <span style={{ marginLeft: '4px', fontSize: '11px', background: '#fff3e0', color: '#ef6c00', padding: '2px 8px', borderRadius: '8px', fontWeight: '600' }}>✏️ {manualCount} Manual</span>}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: rem >= 0 ? '#2e7d32' : '#c62828' }}>{rem >= 0 ? '✅' : '⚠️'} Remaining: {rem >= 0 ? '+' : ''}{fmt(rem)} {mat.unit}</div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Material quick tabs */}
        <div style={{ padding: '10px 15px', background: '#f5f5f5', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '5px', overflowX: 'auto', flexWrap: 'nowrap' }}>
          {BOM_MATERIALS.map(m => {
            const has = getAllocTotal(activePdi, m.key) > 0;
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
          <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>{companyName} | COC Inventory → FIFO Allocation → BOM Tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {syncMsg && <span style={{ fontSize: '12px', fontWeight: '600' }}>{syncMsg}</span>}
          {saveMsg && <span style={{ fontSize: '13px', fontWeight: '600' }}>{saveMsg === 'Saved!' ? '✅' : '❌'} {saveMsg}</span>}
          <button onClick={() => syncMrpCoc(false)} disabled={syncing} style={{ padding: '10px 20px', background: syncing ? '#666' : 'linear-gradient(135deg, #ff6f00, #ff8f00)', color: 'white', border: 'none', borderRadius: '8px', cursor: syncing ? 'wait' : 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: '0 2px 8px rgba(255,111,0,0.3)' }}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync MRP COC'}
          </button>
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
        view === 'inventory' ? renderInventory() : view === 'detail' ? renderDetail() : renderOverview()
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
