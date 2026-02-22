import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import axios from 'axios';
import { companyService } from '../services/apiService';
import COCSelectionModal from './COCSelectionModal';
import PasswordModal from './PasswordModal';
import PDIDashboard from './PDIDashboard';
import IQCTracker from './IQCTracker';
import '../styles/DailyReport.css';

// Smart API URL helper
const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';
const getAPIBase = () => window.location.hostname === 'localhost' ? 'http://localhost:5003/api' : '/api';

// Material name mapping (Legacy DB names → Modern Display names)
const MATERIAL_NAME_MAP = {
  'Cell': 'Solar Cell',
  'Glass Front': 'FRONT GLASS',
  'Glass Back': 'BACK GLASS',
  'Ribbon': 'RIBBON (0.26 mm)',
  'Frame Long': 'Aluminium Frame LONG',
  'Frame Short': 'Aluminium Frame SHORT',
  'JB': 'JUNCTION BOX',
  'Flux': 'FLUX',
  'Potting Material': 'JB Potting (A and B)',
  'Bus Bar 6mm': 'RIBBON (6.0X0.4)',
  'Bus Bar 4mm': 'RIBBON (4.0X0.4)',
  'Silicone 2kg': 'SEALENT',
  'Silicone 10kg': 'SEALENT',
  'Silicone 270kg': 'SEALENT'
};

// Helper function to get display name
const getDisplayMaterialName = (dbName) => MATERIAL_NAME_MAP[dbName] || dbName;

// BOM Materials by Wattage (based on PHP logic)
const BOM_MATERIALS_BY_WATTAGE = {
  '625wp': [
    { name: 'Solar Cell', qty: 66, product_type: '25.30%', min_efficiency: 25.30, needsCompany: true },
    { name: 'FRONT GLASS', qty: 1, product_type: '2376x1128x2.0 mm', needsCompany: true },
    { name: 'BACK GLASS', qty: 1, product_type: '2376x1128x2.0 mm(3 hole)', needsCompany: true },
    { name: 'RIBBON (0.26 mm)', qty: 0.212, product_type: '0.26 mm', needsCompany: true, materialGroup: 'RIBBON' },
    { name: 'RIBBON (4.0X0.4)', qty: 0.038, product_type: '4.0*0.40', needsCompany: true, materialGroup: 'RIBBON' },
    { name: 'RIBBON (6.0X0.4)', qty: 0.018, product_type: '6.0X0.40 mm', needsCompany: true, materialGroup: 'RIBBON' },
    { name: 'FLUX', qty: 0.02, product_type: '', needsCompany: true },
    { name: 'EPE FRONT', qty: 5.2, product_type: '0.70MM*1125MM*320M (EP304)', needsCompany: true },
    { name: 'Aluminium Frame LONG', qty: 1, product_type: '6 Hole (2382 mm length)', needsCompany: true },
    { name: 'Aluminium Frame SHORT', qty: 1, product_type: '1134 mm Width', needsCompany: true },
    { name: 'SEALENT', qty: 0.35, product_type: '', needsCompany: true },
    { name: 'JB Potting A', qty: 0.0105, product_type: 'Part A', needsCompany: true },
    { name: 'JB Potting B', qty: 0.0105, product_type: 'Part B', needsCompany: true },
    { name: 'JUNCTION BOX', qty: 1, product_type: '35A 1200mm', needsCompany: true }
  ],
  '630wp': [
    { name: 'Solar Cell', qty: 66, product_type: '25.40%', min_efficiency: 25.40, needsCompany: true },
    { name: 'FRONT GLASS', qty: 1, product_type: '2376x1128x2.0 mm', needsCompany: true },
    { name: 'BACK GLASS', qty: 1, product_type: '2376x1128x2.0 mm(3 hole)', needsCompany: true },
    { name: 'RIBBON (0.26 mm)', qty: 0.212, product_type: '0.26 mm', needsCompany: true, materialGroup: 'RIBBON' },
    { name: 'RIBBON (4.0X0.4)', qty: 0.038, product_type: '4.0*0.40', needsCompany: true, materialGroup: 'RIBBON' },
    { name: 'RIBBON (6.0X0.4)', qty: 0.018, product_type: '6.0X0.40 mm', needsCompany: true, materialGroup: 'RIBBON' },
    { name: 'FLUX', qty: 0.02, product_type: '', needsCompany: true },
    { name: 'EPE FRONT', qty: 5.2, product_type: '0.70MM*1125MM*320M (EP304)', needsCompany: true },
    { name: 'Aluminium Frame LONG', qty: 1, product_type: '6 Hole (2382 mm length)', needsCompany: true },
    { name: 'Aluminium Frame SHORT', qty: 1, product_type: '1134 mm Width', needsCompany: true },
    { name: 'SEALENT', qty: 0.35, product_type: '', needsCompany: true },
    { name: 'JB Potting A', qty: 0.0105, product_type: 'Part A', needsCompany: true },
    { name: 'JB Potting B', qty: 0.0105, product_type: 'Part B', needsCompany: true },
    { name: 'JUNCTION BOX', qty: 1, product_type: '35A 1200mm', needsCompany: true }
  ]
};

function DailyReport() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [productionTab, setProductionTab] = useState('production'); // 'production' or 'cellInventory'

  // Check if user is super admin
  const isSuperAdmin = () => {
    return localStorage.getItem('userRole') === 'super_admin';
  };

  const [companyForm, setCompanyForm] = useState({
    id: null,
    companyName: '',
    moduleWattage: '625',
    moduleType: 'Topcon',
    cellsPerModule: '132',
    currentRunningOrder: '',
    cellsReceivedQty: '',
    cellsReceivedMW: '',
    productionRecords: [],
    rejectedModules: [],
    createdDate: ''
  });

  const [reportData, setReportData] = useState({
    remarks: ''
  });

  const [newRejection, setNewRejection] = useState({
    serialNumber: '',
    rejectionDate: new Date().toISOString().split('T')[0],
    reason: 'Cell Color Mismatch (Shade Difference)',
    stage: 'Visual Inspection'
  });

  const [showRejectionModal, setShowRejectionModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [showRejectionList, setShowRejectionList] = useState(false);
  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayPdiNumber, setNewDayPdiNumber] = useState('');
  const [newDayRunningOrder, setNewDayRunningOrder] = useState('');
  const [showBomModal, setShowBomModal] = useState(false);
  const [selectedWattage, setSelectedWattage] = useState('625wp'); // Default wattage
  const [selectedShift, setSelectedShift] = useState('day'); // 'day' or 'night'
  // eslint-disable-next-line no-unused-vars
  const [cocBrands, setCocBrands] = useState({}); // Available brands by material name from COC API
  // eslint-disable-next-line no-unused-vars
  const [loadingCocBrands, setLoadingCocBrands] = useState(false);
  const [showCOCModal, setShowCOCModal] = useState(false);
  const [currentProductionQty, setCurrentProductionQty] = useState(0);
  const [selectedCOCs, setSelectedCOCs] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [selectedRecordForBom, setSelectedRecordForBom] = useState(null);
  const [bomMaterials, setBomMaterials] = useState({});
  const [ipqcPdf, setIpqcPdf] = useState(null);
  const [ftrDocument, setFtrDocument] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [bomSuppliers, setBomSuppliers] = useState([]); // List of unique supplier names
  // eslint-disable-next-line no-unused-vars
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [pdiFilter, setPdiFilter] = useState('all'); // 'all', 'done', 'pending'
  const [showCocUploadModal, setShowCocUploadModal] = useState(false);
  const [selectedPdiRecords, setSelectedPdiRecords] = useState([]);
  const [availableCocData, setAvailableCocData] = useState([]);
  const [cocInvoiceSearch, setCocInvoiceSearch] = useState('');
  const [showPdiDetailsModal, setShowPdiDetailsModal] = useState(false);
  const [selectedPdiForDetails, setSelectedPdiForDetails] = useState(null);
  const [assignedCocData, setAssignedCocData] = useState([]); // COC data from MRP assigned API
  const [masterCocData, setMasterCocData] = useState([]); // All available COCs from Master API
  const [loadingAssignedCoc, setLoadingAssignedCoc] = useState(false);
  const [showMaterialCocModal, setShowMaterialCocModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialCocData, setMaterialCocData] = useState([]);
  const [loadingMaterialCoc, setLoadingMaterialCoc] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [editingUsedQty, setEditingUsedQty] = useState(null); // {materialName, lotNumber}
  // eslint-disable-next-line no-unused-vars
  const [editUsedQtyValue, setEditUsedQtyValue] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [manualUsedQty, setManualUsedQty] = useState({}); // Store manual overrides
  const [requiredCocsReport, setRequiredCocsReport] = useState([]);
  const [loadingRequiredCocs, setLoadingRequiredCocs] = useState(false);
  const [cocMaterialFilter, setCocMaterialFilter] = useState('all');
  const [cocInvoiceFilter, setCocInvoiceFilter] = useState('');
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfDateRange, setPdfDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  // Load pdiProductionOverrides from localStorage on init
  const [pdiProductionOverrides, setPdiProductionOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('pdiProductionOverrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }); // {pdi: customProductionQty}
  const [editingPdiProduction, setEditingPdiProduction] = useState(false);
  const [tempPdiProduction, setTempPdiProduction] = useState('');
  const [reportOptions, setReportOptions] = useState({
    includeCellInventory: true,
    includeRejections: true,
    includeKPIMetrics: true,
    includeProductionDetails: true,
    includeDayWiseSummary: true,
    includeBomMaterials: true
  });

  // Cell Efficiency Received Entry states
  const [showCellReceivedModal, setShowCellReceivedModal] = useState(false);
  const [cellReceivedForm, setCellReceivedForm] = useState({
    efficiency: '25.5',
    supplierCompany: '',
    quantity: '',
    invoiceNo: '',
    receiveDate: new Date().toISOString().split('T')[0]
  });
  const [cellReceivedEditMode, setCellReceivedEditMode] = useState(false); // For edit mode
  const [cellReceivedEditKey, setCellReceivedEditKey] = useState(null); // {eff, company} for editing

  // Manual COC Entry states
  const [showManualCocModal, setShowManualCocModal] = useState(false);
  const [manualCocForm, setManualCocForm] = useState({
    materialName: '',
    invoiceNo: '',
    brand: '',
    lotBatchNo: '',
    cocQty: '',
    invoiceQty: '',
    invoiceDate: '',
    cocPdf: null,
    iqcPdf: null
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  // Save pdiProductionOverrides to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pdiProductionOverrides', JSON.stringify(pdiProductionOverrides));
    } catch (e) {
      console.error('Failed to save pdiProductionOverrides to localStorage:', e);
    }
  }, [pdiProductionOverrides]);

  const loadAvailableCocData = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/coc/list`);

      if (response.data && response.data.coc_data) {
        setAvailableCocData(response.data.coc_data);
      }
    } catch (error) {
      console.error('Failed to load COC data:', error);
      alert('Failed to load COC data from API');
    } finally {
      setLoading(false);
    }
  };

  // Load Master COC data from MRP API (all available COCs for suggestion - FIFO)
  const loadMasterCocData = async () => {
    try {
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 180 days

      console.log('📡 Fetching Master COC data from MRP API...', { from: fromDate, to: toDate });
      const response = await axios.post('https://umanmrp.in/api/coc_api.php', {
        from: fromDate,
        to: toDate
      });

      console.log('📦 Master COC API Response:', response.data);

      // Handle different response formats
      let cocData = [];
      if (response.data && Array.isArray(response.data)) {
        cocData = response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        cocData = response.data.data;
      } else if (response.data && response.data.status === 'success' && response.data.data) {
        cocData = response.data.data;
      }

      if (cocData.length > 0) {
        // Log first record to see structure
        console.log('📋 Sample COC record:', cocData[0]);
        // Sort by ID (FIFO - oldest first)
        const sortedData = cocData.sort((a, b) => parseInt(a.id || 0) - parseInt(b.id || 0));
        setMasterCocData(sortedData);
        console.log('✅ Loaded Master COC records:', sortedData.length);
        alert(`✅ Loaded ${sortedData.length} COC records for suggestions!`);
      } else {
        console.log('⚠️ No COC data found in response');
        setMasterCocData([]);
        alert('⚠️ No COC data found from Master API');
      }
    } catch (error) {
      console.error('❌ Failed to load Master COC data:', error);
      setMasterCocData([]);
      alert('❌ Failed to load Master COC data: ' + error.message);
    }
  };

  // Load assigned COC data from MRP API (shows which COC is assigned to which PDI)
  const loadAssignedCocData = async (companyName = '') => {
    try {
      setLoadingAssignedCoc(true);

      // Use MRP API directly for assigned COC data
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      console.log('📡 Fetching assigned COC data from MRP API...');
      const response = await axios.post('https://umanmrp.in/a/get_assigned_coc_records.php', {
        from: fromDate,
        to: toDate
      });

      if (response.data && response.data.status === 'success') {
        // Map company name for filtering
        const companyMap = {
          'Sterlin and Wilson': 'S&W',
          'Larsen & Toubro': 'L&T',
          'Rays Power': 'Rays Power'
        };
        const mrpCompanyName = companyMap[companyName] || companyName;

        // Filter by company if provided
        let filteredData = response.data.data || [];
        if (companyName && mrpCompanyName) {
          filteredData = filteredData.filter(coc => coc.assigned_to === mrpCompanyName);
        }

        // Add company_short field for easier matching
        filteredData = filteredData.map(coc => ({
          ...coc,
          company_short: coc.assigned_to?.toLowerCase() || ''
        }));

        setAssignedCocData(filteredData);
        console.log('✅ Loaded assigned COC records from MRP:', filteredData.length);
      } else {
        console.error('❌ Failed to load assigned COC data:', response.data?.error);
        setAssignedCocData([]);
      }
    } catch (error) {
      console.error('Failed to load assigned COC data:', error);
      setAssignedCocData([]);
    } finally {
      setLoadingAssignedCoc(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleOpenCocUploadModal = () => {
    const pdiDoneRecords = selectedCompany.productionRecords.filter(
      r => r.pdi && r.pdi.trim() !== ''
    );

    if (pdiDoneRecords.length === 0) {
      alert('No PDI Done records found!');
      return;
    }

    setSelectedPdiRecords(pdiDoneRecords);
    loadAvailableCocData();
    setShowCocUploadModal(true);
  };

  // eslint-disable-next-line no-unused-vars
  const handleUploadCocToPdi = async (selectedMaterials) => {
    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();

      // Upload selected COC materials to PDI batch
      const response = await axios.post(`${API_BASE_URL}/api/pdi/upload-coc-materials`, {
        company_id: selectedCompany.id,
        materials: selectedMaterials
      });

      if (response.data.success) {
        alert(`✅ Successfully uploaded ${selectedMaterials.length} materials to PDI batch!`);
        setShowCocUploadModal(false);
        await refreshSelectedCompany();
      }
    } catch (error) {
      console.error('Failed to upload COC materials:', error);
      alert(error.response?.data?.error || 'Failed to upload COC materials to PDI');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await companyService.getAllCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
      alert('Failed to load companies from database');
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedCompany = async () => {
    if (selectedCompany && selectedCompany.id) {
      try {
        const updated = await companyService.getCompany(selectedCompany.id);
        setSelectedCompany(updated);
      } catch (error) {
        console.error('Failed to refresh company:', error);
      }
    }
  };

  const handleNewCompany = () => {
    setCompanyForm({
      id: null,
      companyName: '',
      moduleWattage: '625',
      moduleType: 'Topcon',
      cellsPerModule: '132',
      cellsReceivedQty: '',
      cellsReceivedMW: '',
      productionRecords: [],
      rejectedModules: [],
      createdDate: new Date().toISOString().split('T')[0]
    });
    setViewMode('form');
  };

  const handleSaveCompany = async () => {
    if (!companyForm.companyName) {
      alert('Please enter company name!');
      return;
    }

    try {
      setLoading(true);
      if (companyForm.id) {
        await companyService.updateCompany(companyForm.id, companyForm);
        alert('Company updated successfully!');
      } else {
        await companyService.createCompany(companyForm);
        alert('Company saved successfully!');
      }
      await loadCompanies();
      setViewMode('list');
    } catch (error) {
      console.error('Failed to save company:', error);
      alert('Failed to save company');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = async (company) => {
    try {
      setLoading(true);
      const fullCompany = await companyService.getCompany(company.id);
      setSelectedCompany(fullCompany);
      setViewMode('production');
    } catch (error) {
      console.error('Failed to load company details:', error);
      alert('Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company? All production data will be lost!')) {
      return;
    }

    try {
      setLoading(true);
      await companyService.deleteCompany(companyId);
      alert('Company deleted successfully!');
      await loadCompanies();
    } catch (error) {
      console.error('Failed to delete company:', error);
      alert('Failed to delete company');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalProduction = () => {
    if (!selectedCompany || !selectedCompany.productionRecords) return 0;
    return selectedCompany.productionRecords.reduce((sum, record) => {
      return sum + (record.dayProduction || 0) + (record.nightProduction || 0);
    }, 0);
  };

  const calculateTotalMW = () => {
    const totalProduction = calculateTotalProduction();
    const wattage = selectedCompany ? parseFloat(selectedCompany.moduleWattage) : 0;
    return ((totalProduction * wattage) / 1000000).toFixed(2);
  };

  const calculateCellStock = () => {
    if (!selectedCompany) return 0;

    const cellsReceived = parseFloat(selectedCompany.cellsReceivedQty) || 0;
    const cellsPerModule = parseFloat(selectedCompany.cellsPerModule) || 132;

    let totalCellsUsed = 0;
    let totalCellsRejected = 0;

    if (selectedCompany.productionRecords) {
      selectedCompany.productionRecords.forEach(record => {
        const dailyProduction = (record.dayProduction || 0) + (record.nightProduction || 0);
        const cellsUsedToday = dailyProduction * cellsPerModule;
        const cellRejectionPercent = record.cellRejectionPercent || 0;
        const cellsRejectedToday = (cellsUsedToday * cellRejectionPercent) / 100;

        totalCellsUsed += cellsUsedToday;
        totalCellsRejected += cellsRejectedToday;
      });
    }

    const cellStock = cellsReceived - totalCellsUsed - totalCellsRejected;
    return Math.round(cellStock);
  };

  // eslint-disable-next-line no-unused-vars
  const calculateTotalRejectedModules = () => {
    if (!selectedCompany || !selectedCompany.rejectedModules) return 0;
    return selectedCompany.rejectedModules.length;
  };

  const getDateRange = () => {
    if (!selectedCompany || !selectedCompany.productionRecords || selectedCompany.productionRecords.length === 0) {
      return [];
    }

    let records = selectedCompany.productionRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Apply PDI filter
    if (pdiFilter === 'done') {
      records = records.filter(r => r.pdi && r.pdi.trim() !== '');
    } else if (pdiFilter === 'pending') {
      records = records.filter(r => !r.pdi || r.pdi.trim() === '');
    }

    return records;
  };

  // Password verification handler
  const handlePasswordVerification = (verified) => {
    setShowPasswordModal(false);

    if (verified) {
      setIsPasswordVerified(true);

      // Execute pending action
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }

      // Auto-lock after 5 minutes
      setTimeout(() => {
        setIsPasswordVerified(false);
      }, 5 * 60 * 1000);
    } else {
      setPendingAction(null);
    }
  };

  // Check password before production change
  const checkPasswordAndExecute = (action) => {
    if (isPasswordVerified) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPasswordModal(true);
    }
  };

  const handleProductionChange = (recordId, field, value) => {
    if (!selectedCompany) return;

    // Immediate UI update only - no backend save
    const updatedRecords = selectedCompany.productionRecords.map(record =>
      record.id === recordId
        ? { ...record, [field]: field.includes('Percent') || field.includes('Production') ? parseFloat(value) || 0 : value }
        : record
    );

    setSelectedCompany({
      ...selectedCompany,
      productionRecords: updatedRecords
    });
  };

  const handleSaveRecord = async (record) => {
    setLoading(true);
    try {
      // Save record to backend
      await companyService.updateProductionRecord(selectedCompany.id, record.id, record);

      // Auto-generate IPQC PDF if serial numbers are present
      if (record.serialNumberStart && record.serialNumberEnd && record.serialCount > 0) {
        try {
          // Generate IPQC for both shifts if they have production
          if (record.dayProduction > 0) {
            await autoGenerateIPQCPDF(record, 'day');
          }
          if (record.nightProduction > 0) {
            await autoGenerateIPQCPDF(record, 'night');
          }
        } catch (error) {
          console.error('IPQC auto-generation error:', error);
        }
      }

      // Auto-link FTR from master data
      if (record.serialNumberStart && record.serialNumberEnd && record.serialCount > 0) {
        try {
          await autoLinkFTRFromMasterData(record.id, record);
          alert('✅ Record saved, IPQC generated, and FTR linked successfully!');
        } catch (error) {
          console.error('FTR auto-link error:', error);
          alert('✅ Record saved and IPQC generated! (FTR linking failed - check master data)');
        }
      } else {
        alert('✅ Record saved successfully!');
      }

      await refreshSelectedCompany();
    } catch (error) {
      console.error('Failed to save record:', error);
      alert('❌ Failed to save record: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateIPQCPDF = async (record, shift = 'day') => {
    try {
      const API_BASE_URL = getAPIBaseURL();

      // Extract serial prefix and start number from serial
      const serialStart = record.serialNumberStart || '';
      const serialPrefix = serialStart.replace(/\d+$/, ''); // Remove trailing numbers
      const startNum = parseInt(serialStart.match(/\d+$/)?.[0] || '1');

      const ipqcData = {
        date: record.date || new Date().toISOString().split('T')[0],
        shift: shift === 'day' ? 'A' : 'B',  // Map to shift codes
        customer_id: 'GSPL/IPQC/IPC/003',
        po_number: record.runningOrder || selectedCompany.currentRunningOrder || '',
        serial_prefix: serialPrefix,
        serial_start: startNum,
        module_count: record.serialCount || 1,
        cell_manufacturer: 'Solar Space',
        cell_efficiency: 25.7,
        jb_cable_length: 1200, // Fixed as per requirement
        golden_module_number: `GM-${new Date().getFullYear()}-001`
      };

      console.log(`Auto-generating IPQC PDF for ${shift} shift:`, ipqcData);

      // eslint-disable-next-line no-unused-vars
      const response = await axios.post(`${API_BASE_URL}/api/ipqc/generate-pdf-only`, ipqcData, {
        responseType: 'blob'
      });

      // Save the PDF path to record (backend should return the saved path)
      console.log(`✅ IPQC PDF auto-generated successfully for ${shift} shift`);
      return true;
    } catch (error) {
      console.error('Auto-generate IPQC error:', error);
      throw error;
    }
  };

  const autoLinkFTRFromMasterData = async (recordId, recordData) => {
    try {
      const API_BASE_URL = getAPIBaseURL();

      // Get master orders for this company
      const ordersResponse = await axios.get(`${API_BASE_URL}/api/master/orders`);
      const companyOrders = ordersResponse.data.orders.filter(
        order => order.company_name === selectedCompany.companyName
      );

      if (companyOrders.length === 0) {
        throw new Error('No master data found for this company. Please upload Master Data first.');
      }

      // Use most recent order
      const latestOrder = companyOrders.sort((a, b) => b.id - a.id)[0];

      // Check if serials exist in master data
      const checkResponse = await axios.post(`${API_BASE_URL}/api/master/check-serials`, {
        order_id: latestOrder.id,
        serial_range: {
          start: recordData.serialNumberStart,
          end: recordData.serialNumberEnd
        }
      });

      if (!checkResponse.data.valid) {
        throw new Error(`Serials not found in master data. Available range: ${checkResponse.data.message || 'Unknown'}`);
      }

      console.log(`✅ FTR auto-linked: ${recordData.serialCount} modules from master data`);
      return true;
    } catch (error) {
      console.error('Auto-link FTR error:', error);
      throw error;
    }
  };

  // eslint-disable-next-line no-unused-vars
  const validateCOCAvailability = async (recordId, dayProduction, nightProduction) => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/production/validate-materials`, {
        company_id: selectedCompany.id,
        day_production: dayProduction,
        night_production: nightProduction
      });

      if (!response.data.sufficient) {
        alert(`⚠️ Warning: Insufficient materials!\n${response.data.message}`);
      }
    } catch (error) {
      console.error('Material validation error:', error);
    }
  };

  const handleMasterDataUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Try to find FTR sheet or use first sheet
          let sheetName = null;
          if (workbook.SheetNames.includes('FTR')) {
            sheetName = 'FTR';
          } else if (workbook.SheetNames.includes('ftr')) {
            sheetName = 'ftr';
          } else {
            // Use first sheet
            sheetName = workbook.SheetNames[0];
            console.log('FTR sheet not found, using first sheet:', sheetName);
          }

          const sheet = workbook.Sheets[sheetName];
          if (!sheet) {
            alert('❌ No valid sheet found in Excel file');
            setLoading(false);
            return;
          }

          const ftrData = XLSX.utils.sheet_to_json(sheet);

          // Check if first row might be header
          if (ftrData.length > 0) {
            const firstRow = ftrData[0];
            const firstRowValues = Object.values(firstRow).join(' ').toLowerCase();

            // If first row contains header keywords, skip it
            if (firstRowValues.includes('pmax') || firstRowValues.includes('date') || firstRowValues.includes('serial')) {
              ftrData.shift(); // Remove header row
            }
          }

          console.log('FTR Data rows:', ftrData.length);

          // Validate and extract unique serial numbers - check multiple column names
          const serialNumbers = new Set();
          const duplicatesInFile = [];
          const invalidRows = [];

          ftrData.forEach((row, index) => {
            // Try different column name variations
            const serialNumber = row['ID'] || row['SERIAL NUMBER'] || row['Serial Number'] ||
              row['serial_number'] || row['id'] || row['SerialNumber'] ||
              Object.values(row)[1]; // Sometimes serial is 2nd column

            if (!serialNumber || serialNumber.toString().trim() === '') {
              invalidRows.push(`Row ${index + 2}: Missing serial number`);
              return;
            }

            const cleanSerial = serialNumber.toString().trim();

            if (serialNumbers.has(cleanSerial)) {
              duplicatesInFile.push(cleanSerial);
            } else {
              serialNumbers.add(cleanSerial);
            }
          });

          // Show validation errors
          if (invalidRows.length > 0 || duplicatesInFile.length > 0) {
            let errorMsg = '❌ Excel Validation Failed:\n\n';
            if (invalidRows.length > 0) {
              errorMsg += `Invalid Rows:\n${invalidRows.join('\n')}\n\n`;
            }
            if (duplicatesInFile.length > 0) {
              errorMsg += `Duplicate Serial Numbers in File:\n${duplicatesInFile.slice(0, 10).join('\n')}`;
              if (duplicatesInFile.length > 10) {
                errorMsg += `\n... and ${duplicatesInFile.length - 10} more`;
              }
            }
            alert(errorMsg);
            setLoading(false);
            return;
          }

          const validSerials = Array.from(serialNumbers);

          // FTR data contains only passed modules - no rejection count needed
          const rejectionCount = 0;

          // Upload to server
          const API_BASE_URL = getAPIBaseURL();
          const formData = new FormData();
          formData.append('file', file);
          formData.append('company_name', selectedCompany.companyName);
          formData.append('order_number', `${selectedCompany.companyName}-${Date.now()}`);
          formData.append('serial_prefix', '');
          formData.append('rejection_count', '0');

          console.log('Uploading FTR Master Data:', {
            company: selectedCompany.companyName,
            fileSize: file.size,
            fileName: file.name
          });

          const response = await axios.post(`${API_BASE_URL}/api/master/upload-excel`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          console.log('Upload response:', response.data);

          if (response.data.order) {
            const ftrCount = response.data.order.ftr_count || (validSerials.length - rejectionCount);
            alert(`✅ Master Data uploaded successfully!\n\n` +
              `Total Modules: ${response.data.order.total_modules}\n` +
              `FTR Count: ${ftrCount}\n` +
              `Rejected: ${rejectionCount}`);
          } else {
            alert(`✅ Master Data uploaded successfully!`);
          }

          await refreshSelectedCompany();

          // Reset file input
          event.target.value = '';
        } catch (error) {
          console.error('Error processing Excel:', error);
          alert('❌ Error processing Excel file: ' + (error.message || 'Unknown error'));
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        fullError: error
      });
      alert('❌ Upload failed: ' + (error.response?.data?.error || error.message));
      setLoading(false);
    }
  };

  const handleRejectionUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!selectedCompany) {
      alert('❌ Please select a company first');
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Use first sheet
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) {
            alert('❌ No valid sheet found in Excel file');
            setLoading(false);
            return;
          }

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          // Find header row
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row.length > 0 && row.some(cell =>
              cell && typeof cell === 'string' &&
              (cell.toLowerCase().includes('serial') || cell.toLowerCase().includes('id'))
            )) {
              headerRowIndex = i;
              break;
            }
          }

          const headers = jsonData[headerRowIndex];
          const dataRows = jsonData.slice(headerRowIndex + 1);

          // Find serial number column (Column A or first column with serial data)
          let serialColIndex = 0;
          for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (header && typeof header === 'string') {
              const headerLower = header.toLowerCase();
              if (headerLower.includes('serial') || headerLower.includes('id')) {
                serialColIndex = i;
                break;
              }
            }
          }

          // Extract serial numbers
          const rejectionSerials = [];
          for (const row of dataRows) {
            if (!row || row.length === 0) continue;
            const serial = row[serialColIndex];
            if (serial && serial.toString().trim() !== '') {
              rejectionSerials.push(serial.toString().trim());
            }
          }

          if (rejectionSerials.length === 0) {
            alert('❌ No serial numbers found in Excel file');
            setLoading(false);
            event.target.value = '';
            return;
          }

          // Find master order for this company
          const API_BASE_URL = getAPIBaseURL();
          const ordersResponse = await axios.get(`${API_BASE_URL}/api/master/orders`);

          const companyOrders = ordersResponse.data.orders.filter(
            order => order.company_name === selectedCompany.companyName
          );

          if (companyOrders.length === 0) {
            alert(`❌ No master data found for ${selectedCompany.companyName}\n\nPlease upload Master Data first!`);
            setLoading(false);
            event.target.value = '';
            return;
          }

          // Use most recent order
          const latestOrder = companyOrders.sort((a, b) => b.id - a.id)[0];

          // Upload rejections
          const formData = new FormData();
          formData.append('file', file);
          formData.append('order_id', latestOrder.id.toString());

          const response = await axios.post(`${API_BASE_URL}/api/master/upload-rejections`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          let messageText = `✅ Successfully marked ${response.data.rejected_count} modules as rejected!`;

          if (response.data.warning) {
            messageText += `\n\n⚠️ ${response.data.warning}`;
            if (response.data.not_found_serials && response.data.not_found_serials.length > 0) {
              const displaySerials = response.data.not_found_serials.slice(0, 5);
              messageText += `\n\nNot found in master data:\n${displaySerials.join('\n')}`;
              if (response.data.not_found_serials.length > 5) {
                messageText += `\n... and ${response.data.not_found_serials.length - 5} more`;
              }
            }
          }

          alert(messageText);

          // Reset file input
          event.target.value = '';
        } catch (error) {
          console.error('Error processing rejection Excel:', error);
          alert('❌ Error processing Excel file: ' + (error.message || 'Unknown error'));
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Rejection upload error:', error);
      alert('❌ Upload failed: ' + (error.response?.data?.error || error.message));
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleOpenCOCModal = (record) => {
    const totalProduction = (record.dayProduction || 0) + (record.nightProduction || 0);
    if (totalProduction === 0) {
      alert('⚠️ Please enter production quantity first!');
      return;
    }

    // Check password before opening COC modal
    checkPasswordAndExecute(() => {
      setCurrentProductionQty(totalProduction);
      setSelectedRecordForBom(record);
      setShowCOCModal(true);
    });
  };

  const handleCOCConfirm = async (selectedCOCData) => {
    try {
      setLoading(true);

      // Store COC selection in the production record
      const recordData = {
        ...selectedRecordForBom,
        coc_materials_used: JSON.stringify(selectedCOCData),
        coc_warning_shown: false
      };

      await companyService.updateProductionRecord(
        selectedCompany.id,
        selectedRecordForBom.id,
        recordData
      );

      setSelectedCOCs(selectedCOCData);
      setShowCOCModal(false);
      await refreshSelectedCompany();
      alert('✅ COC selection saved successfully!');
    } catch (error) {
      console.error('Failed to save COC selection:', error);
      alert('Failed to save COC selection');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getCOCStatus = (record) => {
    if (!record.coc_materials_used) {
      return { hasLinked: false, count: 0 };
    }

    try {
      const cocData = typeof record.coc_materials_used === 'string'
        ? JSON.parse(record.coc_materials_used)
        : record.coc_materials_used;

      const count = Object.keys(cocData).length;
      return { hasLinked: count > 0, count };
    } catch (error) {
      return { hasLinked: false, count: 0 };
    }
  };

  const handleAddNewDay = () => {
    // Check password before adding new production day
    checkPasswordAndExecute(() => {
      setNewDayDate(new Date().toISOString().split('T')[0]);
      setShowAddDayModal(true);
    });
  };

  // eslint-disable-next-line no-unused-vars
  const [cocValidation, setCocValidation] = useState(null);
  const [showCocWarningModal, setShowCocWarningModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [newDayProduction, setNewDayProduction] = useState({ day: 0, night: 0 });

  const handleSaveNewDay = async () => {
    if (!newDayDate) {
      alert('Please select a date!');
      return;
    }

    if (!newDayPdiNumber || newDayPdiNumber.trim() === '') {
      alert('⚠️ PDI Number is mandatory!');
      return;
    }

    if (!newDayRunningOrder || newDayRunningOrder.trim() === '') {
      alert('⚠️ Running Order is mandatory!');
      return;
    }

    const existingRecord = selectedCompany.productionRecords.find(r => r.date === newDayDate);
    if (existingRecord) {
      alert('Production record already exists for this date!');
      return;
    }

    try {
      setLoading(true);

      // Create production record with PDI number and Running Order (pending approval)
      await companyService.addProductionRecord(selectedCompany.id, {
        date: newDayDate,
        pdi: newDayPdiNumber.trim(),
        runningOrder: newDayRunningOrder.trim(),
        dayProduction: 0,
        nightProduction: 0,
        pdiApproved: false,  // Pending approval by default
        cellRejectionPercent: 0.0,
        moduleRejectionPercent: 0.0
      });

      await refreshSelectedCompany();
      await loadCompanies();
      setShowAddDayModal(false);
      setNewDayDate('');
      setNewDayPdiNumber('');
      setNewDayRunningOrder('');
      alert(`✅ Production day added with PDI: ${newDayPdiNumber} and Running Order: ${newDayRunningOrder}!`);
    } catch (error) {
      console.error('Failed to add new day:', error);
      const errorMsg = error.response?.data?.error || 'Failed to add new production day';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unique supplier names for dropdown
  const fetchBomSuppliers = async (materialName = '') => {
    try {
      setLoadingSuppliers(true);
      const API_BASE = getAPIBase();
      const params = materialName ? `?material=${encodeURIComponent(materialName)}` : '';
      console.log('🔍 Fetching suppliers for:', materialName);
      console.log('🌐 API URL:', `${API_BASE.replace('/api', '')}/api/bom-suppliers${params}`);

      const response = await axios.get(`${API_BASE.replace('/api', '')}/api/bom-suppliers${params}`);

      console.log('✅ API Response:', response.data);
      console.log('📋 Suppliers:', response.data.suppliers);

      return response.data.suppliers || [];
    } catch (error) {
      console.error('❌ Failed to fetch suppliers:', error);
      console.error('Error details:', error.response?.data);
      return [];
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleOpenBomModal = async (record) => {
    setSelectedRecordForBom(record);

    // Get wattage from company data or default
    const wattage = selectedCompany?.wattage || '625wp';
    setSelectedWattage(wattage);

    // Initialize bomMaterials state with EXISTING saved data
    const currentMaterials = BOM_MATERIALS_BY_WATTAGE[wattage] || [];
    const materialsData = {};

    // Get existing BOM materials from record (if any saved previously)
    const existingBomMaterials = record.bomMaterials || [];

    currentMaterials.forEach(material => {
      // Find existing saved data for this material
      const existingMaterial = existingBomMaterials.find(bm =>
        bm.materialName === material.name || bm.material_name === material.name
      );

      materialsData[material.name] = {
        lotBatchNo: existingMaterial?.lotBatchNo || existingMaterial?.lot_batch_no || '',
        company: existingMaterial?.company || '',
        images: [], // New images to upload (existing are already saved)
        existingImages: existingMaterial?.imagePaths || existingMaterial?.image_paths || [], // Show existing images
        suppliers: [] // Material-specific suppliers
      };
    });

    setBomMaterials(materialsData);
    setIpqcPdf(null);
    setFtrDocument(null);
    setShowBomModal(true);

    // Fetch suppliers for each material in background
    currentMaterials.forEach(async (material) => {
      const suppliers = await fetchBomSuppliers(material.name);
      setBomMaterials(prev => ({
        ...prev,
        [material.name]: {
          ...prev[material.name],
          suppliers: suppliers
        }
      }));
    });
  };

  const handleBomMaterialChange = (materialName, field, value) => {
    setBomMaterials(prev => {
      const currentMaterial = prev[materialName] || {};

      // Handle multiple images
      if (field === 'images') {
        const existingImages = currentMaterial.images || [];
        return {
          ...prev,
          [materialName]: {
            ...currentMaterial,
            images: [...existingImages, ...Array.from(value)]
          }
        };
      }

      // Handle other fields
      return {
        ...prev,
        [materialName]: {
          ...currentMaterial,
          [field]: value
        }
      };
    });
  };

  // Handle clicking on material name to load COC data
  // eslint-disable-next-line no-unused-vars
  const handleMaterialClick = async (materialName) => {
    setSelectedMaterial(materialName);
    setMaterialCocData([]);
    setLoadingMaterialCoc(true);
    setShowMaterialCocModal(true);

    // Reset filters
    setCocMaterialFilter('all');
    setCocInvoiceFilter('');

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/coc/list`);
      if (response.data && response.data.coc_data) {
        setMaterialCocData(response.data.coc_data);
      }
    } catch (error) {
      console.error('Error loading COC data:', error);
      alert('❌ Failed to load COC data from API.');
    } finally {
      setLoadingMaterialCoc(false);
    }
  };

  // Handle deleting BOM material from PDI
  const handleDeleteBomMaterial = async (materialGroup) => {
    // This handles COC unlinking (not BOM material deletion)
    const materialName = materialGroup.materialName;
    const invoiceNo = materialGroup.lotNumber; // lotNumber is actually invoiceNo in COC context

    if (!window.confirm(`Are you sure you want to unlink COC?\n\nMaterial: ${materialName}\nInvoice: ${invoiceNo}`)) {
      return;
    }

    try {
      // eslint-disable-next-line no-unused-vars
      const API_BASE_URL = getAPIBaseURL();

      // Get all production records for this PDI
      const pdiRecords = selectedCompany.productionRecords.filter(
        r => r.pdi === selectedPdiForDetails
      );

      let removedCount = 0;

      // Remove COC from each production record's cocMaterials
      for (const record of pdiRecords) {
        const existingCocMaterials = record.cocMaterials || [];

        // Filter out the COC we want to remove
        const updatedCocMaterials = existingCocMaterials.filter(
          cm => !(cm.materialName === materialName && cm.invoiceNo === invoiceNo)
        );

        // Only update if something was removed
        if (updatedCocMaterials.length < existingCocMaterials.length) {
          await companyService.updateProductionRecord(selectedCompany.id, record.id, {
            cocMaterials: updatedCocMaterials
          });
          removedCount++;
        }
      }

      if (removedCount > 0) {
        alert(`✅ COC unlinked successfully from ${removedCount} production record(s)!`);
      } else {
        alert('⚠️ COC was not found in any production records.');
      }

      // Refresh data
      await loadCompanies();
      await refreshSelectedCompany();
    } catch (error) {
      console.error('Error unlinking COC:', error);
      alert('❌ Error unlinking COC: ' + (error.response?.data?.error || error.message));
    }
  };

  // Handle selecting COC for a material
  const handleSelectCoc = async (cocItem) => {
    if (!selectedMaterial || !selectedPdiForDetails) {
      alert('❌ Material or PDI not selected');
      return;
    }

    try {
      setLoading(true);
      const API_BASE_URL = getAPIBaseURL();

      // Step 1: Download COC PDF from URL and save to server
      let imagePath = null;
      if (cocItem.coc_document_url) {
        try {
          console.log('Downloading COC PDF from:', cocItem.coc_document_url);
          const downloadResponse = await axios.post(`${API_BASE_URL}/api/companies/download-coc-pdf`, {
            pdf_url: cocItem.coc_document_url,
            material_name: selectedMaterial,
            invoice_no: cocItem.invoice_no
          });

          if (downloadResponse.data.success) {
            imagePath = downloadResponse.data.image_path;
            console.log('✓ COC PDF downloaded and saved:', imagePath);
          }
        } catch (pdfError) {
          console.error('Warning: Could not download COC PDF:', pdfError);
          // Continue without PDF - just save metadata
        }
      }

      // Step 2: Find all production records for this PDI
      const pdiRecords = selectedCompany.productionRecords.filter(
        r => r.pdi === selectedPdiForDetails
      );

      if (pdiRecords.length === 0) {
        alert('❌ No production records found for this PDI!');
        setLoading(false);
        return;
      }

      // Step 3: Assign COC to each production record
      // COC linking is SEPARATE from BOM materials
      // Saves in coc_materials JSON field, not in bom_materials table
      let assignedCount = 0;

      for (const record of pdiRecords) {
        // Get existing COC materials for this record
        const existingCocMaterials = record.cocMaterials || [];

        // Check if this COC is already assigned to this material
        const existing = existingCocMaterials.find(
          cm => cm.materialName === selectedMaterial &&
            cm.invoiceNo === cocItem.invoice_no
        );

        if (existing) {
          console.log(`⚠️ COC already assigned to ${selectedMaterial} on ${record.date}`);
          continue; // Skip this record
        }

        // Create new COC entry
        const newCocEntry = {
          materialName: selectedMaterial,
          invoiceNo: cocItem.invoice_no,
          lotBatchNo: cocItem.lot_batch_no || '',
          companyName: cocItem.company_name || '',
          cocQty: cocItem.coc_qty || 0,
          invoiceQty: cocItem.invoice_qty || 0,
          cocDocumentUrl: cocItem.coc_document_url || '',
          imagePath: imagePath || '',
          assignedAt: new Date().toISOString()
        };

        // Add to existing COC materials
        const updatedCocMaterials = [...existingCocMaterials, newCocEntry];

        // Update production record with COC materials
        await companyService.updateProductionRecord(selectedCompany.id, record.id, {
          cocMaterials: updatedCocMaterials
        });

        assignedCount++;
        console.log(`✅ COC linked to ${selectedMaterial} on ${record.date}`);
      }

      if (assignedCount === 0) {
        alert('⚠️ This COC is already linked to all production records!');
      } else {
        alert(`✅ COC linked successfully!\n\nMaterial: ${selectedMaterial}\nInvoice: ${cocItem.invoice_no}\nLot/Batch: ${cocItem.lot_batch_no || 'N/A'}\nLinked to: ${assignedCount} production date(s)\n\n(Saved separately for customer documentation)`);
      }

      setShowMaterialCocModal(false);

      // Refresh company data
      const refreshedCompanies = await companyService.getAllCompanies();
      setCompanies(refreshedCompanies);
      const updatedCompany = refreshedCompanies.find(c => c.id === selectedCompany.id);
      if (updatedCompany) {
        setSelectedCompany(updatedCompany);
      }
    } catch (error) {
      console.error('Error assigning COC to material:', error);
      alert('❌ Failed to assign COC to material');
    } finally {
      setLoading(false);
    }
  };

  // Fetch COC brands for Solar Cell when modal opens
  // eslint-disable-next-line no-unused-vars
  const fetchCOCBrands = async () => {
    try {
      setLoadingCocBrands(true);
      const API_BASE = getAPIBase();

      // Get last 6 months data
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await axios.get(`${API_BASE}/coc/list?from_date=${fromDate}&to_date=${toDate}`);

      if (response.data.success) {
        // Material name mapping for fuzzy matching
        const materialMapping = {
          'Solar Cell': ['solar cell', 'cell', 'solar', 'solarcell'],
          'FRONT GLASS': ['front glass', 'glass front', 'glass', 'fg'],
          'BACK GLASS': ['back glass', 'glass back', 'bg', 'backglass'],
          'RIBBON': ['ribbon', 'tab ribbon', 'tabbing ribbon', 'busbar', 'bus bar'],
          'FLUX': ['flux', 'soldering flux'],
          'EPE FRONT': ['epe', 'epe front', 'epe sheet'],
          'Aluminium Frame LONG': ['aluminium frame', 'al frame', 'frame long', 'aluminum frame'],
          'Aluminium Frame SHORT': ['aluminium frame', 'al frame', 'frame short', 'aluminum frame'],
          'SEALENT': ['sealant', 'sealent', 'silicone'],
          'JB Potting (A and B)': ['jb potting', 'potting', 'junction box potting', 'jb compound'],
          'JUNCTION BOX': ['junction box', 'jb', 'j box', 'jbox'],
          'RFID': ['rfid', 'rfid tag', 'tag']
        };

        // Helper function to match material name
        const matchMaterial = (cocMaterialName, bomMaterialName, cocSpec = '', bomSpec = '') => {
          const cocName = cocMaterialName.toLowerCase().trim();
          const bomName = bomMaterialName.toLowerCase().trim();
          const cocSpecNorm = (cocSpec || '').toLowerCase().replace(/\s+/g, '');
          const bomSpecNorm = (bomSpec || '').toLowerCase().replace(/\s+/g, '');
          // Exact match with spec
          if (cocName === bomName && cocSpecNorm === bomSpecNorm) return true;
          // For ribbon/busbar, require spec match too
          if ((bomName.includes('ribbon') || bomName.includes('busbar')) && cocName.includes('ribbon')) {
            if (cocSpecNorm && bomSpecNorm && cocSpecNorm === bomSpecNorm) return true;
            // fallback: if no spec, fallback to name only
            if (!cocSpecNorm && !bomSpecNorm && cocName === bomName) return true;
            return false;
          }
          // Check mapping
          const keywords = materialMapping[bomMaterialName] || [bomName];
          return keywords.some(keyword =>
            cocName.includes(keyword) || keyword.includes(cocName)
          );
        };

        // Group brands by material name
        const brandsByMaterial = {};

        // Get all BOM material names
        const allBomMaterials = [...new Set([
          ...(BOM_MATERIALS_BY_WATTAGE['625wp'] || []).map(m => m.name),
          ...(BOM_MATERIALS_BY_WATTAGE['630wp'] || []).map(m => m.name)
        ])];

        response.data.coc_data.forEach(item => {
          if (item.material_name && item.brand) {
            // Try to match with BOM materials
            allBomMaterials.forEach(bomMaterial => {
              // Get the material group (for RIBBON variants)
              const materialGroup = BOM_MATERIALS_BY_WATTAGE['625wp']?.find(m => m.name === bomMaterial)?.materialGroup ||
                BOM_MATERIALS_BY_WATTAGE['630wp']?.find(m => m.name === bomMaterial)?.materialGroup;
              const bomSpec = BOM_MATERIALS_BY_WATTAGE['625wp']?.find(m => m.name === bomMaterial)?.product_type ||
                BOM_MATERIALS_BY_WATTAGE['630wp']?.find(m => m.name === bomMaterial)?.product_type || '';
              const matchKey = materialGroup || bomMaterial.split('(')[0].trim(); // Use group or base name
              // Use spec for matching
              if (matchMaterial(item.material_name, matchKey, item.spec, bomSpec)) {
                if (!brandsByMaterial[bomMaterial]) {
                  brandsByMaterial[bomMaterial] = [];
                }
                // Add brand if not already exists for this material
                const brandExists = brandsByMaterial[bomMaterial].some(b => b.brand === item.brand);
                if (!brandExists) {
                  brandsByMaterial[bomMaterial].push({
                    brand: item.brand,
                    lot_batch_no: item.lot_batch_no,
                    product_type: item.product_type
                  });
                }
              }
            });
          }
        });

        console.log('COC Brands by Material:', brandsByMaterial);
        setCocBrands(brandsByMaterial);
      }
    } catch (error) {
      console.error('Failed to fetch COC brands:', error);
    } finally {
      setLoadingCocBrands(false);
    }
  };

  // Generate Excel with Required COCs and Available COCs
  const generateCOCExcelReport = () => {
    if (requiredCocsReport.length === 0) {
      alert('❌ Please click "Show Required COCs Report" first to load data');
      return;
    }

    try {
      // Sheet 1: COMPREHENSIVE COC STATUS (Combined Required + Available)
      const comprehensiveData = [];
      comprehensiveData.push(['Material Name', 'Product Type', 'Required Qty', 'Available COCs', 'Company', 'Invoice No', 'COC Qty', 'Lot/Batch', 'Invoice Date', 'Status']);

      requiredCocsReport.forEach(req => {
        // Calculate total available
        let totalAvailable = 0;
        const allCocs = [];

        Object.entries(req.availableCocs).forEach(([company, cocs]) => {
          cocs.forEach(coc => {
            totalAvailable += coc.cocQty;
            allCocs.push({ company, ...coc });
          });
        });

        // Sort by date - oldest first (FIFO)
        allCocs.sort((a, b) => {
          const dateA = new Date(a.invoiceDate || '2099-01-01');
          const dateB = new Date(b.invoiceDate || '2099-01-01');
          return dateA - dateB;
        });

        // Status
        let status = totalAvailable === 0 ? '❌ NO COC' : (totalAvailable >= req.requiredQty ? '✅ SUFFICIENT' : '⚠️ SHORTAGE');

        if (allCocs.length > 0) {
          // Add rows for each available COC
          allCocs.forEach((coc, idx) => {
            comprehensiveData.push([
              idx === 0 ? req.materialName : '',
              idx === 0 ? (req.productType || '-') : '',
              idx === 0 ? req.requiredQty : '',
              idx === 0 ? totalAvailable : '',
              coc.company,
              coc.invoiceNo || '-',
              coc.cocQty || 0,
              coc.lotBatchNo || '-',
              coc.invoiceDate || '-',
              idx === 0 ? status : ''
            ]);
          });
        } else {
          comprehensiveData.push([
            req.materialName,
            req.productType || '-',
            req.requiredQty,
            0,
            'No COC Available',
            '-',
            0,
            '-',
            '-',
            status
          ]);
        }
      });

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add Sheet 1 - Comprehensive COC Status
      const ws1 = XLSX.utils.aoa_to_sheet(comprehensiveData);

      // Style Sheet 1 Header
      const range1 = XLSX.utils.decode_range(ws1['!ref']);
      for (let col = range1.s.c; col <= range1.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws1[cellAddress]) continue;
        ws1[cellAddress].s = {
          fill: { fgColor: { rgb: "1565C0" } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 13 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "medium", color: { rgb: "000000" } },
            bottom: { style: "medium", color: { rgb: "000000" } },
            left: { style: "medium", color: { rgb: "000000" } },
            right: { style: "medium", color: { rgb: "000000" } }
          }
        };
      }

      // Style Sheet 1 Data rows
      for (let row = range1.s.r + 1; row <= range1.e.r; row++) {
        const statusCell = ws1[XLSX.utils.encode_cell({ r: row, c: 9 })];
        const statusValue = statusCell ? statusCell.v : '';

        let rowColor = "FFFFFF";
        if (statusValue.includes('NO COC')) {
          rowColor = "FFCDD2"; // Red
        } else if (statusValue.includes('SHORTAGE')) {
          rowColor = "FFE082"; // Yellow
        } else if (statusValue.includes('SUFFICIENT')) {
          rowColor = "C8E6C9"; // Green
        }

        for (let col = range1.s.c; col <= range1.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws1[cellAddress]) continue;

          ws1[cellAddress].s = {
            fill: { fgColor: { rgb: rowColor } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "BDBDBD" } },
              bottom: { style: "thin", color: { rgb: "BDBDBD" } },
              left: { style: "thin", color: { rgb: "BDBDBD" } },
              right: { style: "thin", color: { rgb: "BDBDBD" } }
            }
          };

          // Bold for material name and status
          if (col === 0 || col === 9) {
            ws1[cellAddress].s.font = { bold: true, sz: 11 };
          }
        }
      }

      ws1['!cols'] = [
        { wch: 25 }, // Material Name
        { wch: 28 }, // Product Type
        { wch: 14 }, // Required Qty
        { wch: 15 }, // Available COCs
        { wch: 28 }, // Company
        { wch: 20 }, // Invoice No
        { wch: 12 }, // COC Qty
        { wch: 18 }, // Lot/Batch
        { wch: 15 }, // Invoice Date
        { wch: 16 }  // Status
      ];

      // Set row heights
      ws1['!rows'] = [{ hpt: 25 }]; // Header row height

      XLSX.utils.book_append_sheet(wb, ws1, 'COC Status Report');

      // Sheet 2: Smart COC Suggestions (Which COC to use for fulfillment)
      const summaryData = [];
      summaryData.push(['Material Name', 'Product Type', 'Required Qty', 'Available', 'Shortage', 'Status', '🎯 USE THIS COC', 'Company', 'Invoice No', 'COC Qty', 'Lot/Batch', 'Date', 'Production BOM']);

      // Add summary data from required COCs
      requiredCocsReport.forEach(req => {
        // Calculate total available across all companies
        let totalAvailable = 0;
        const allCocs = [];

        Object.entries(req.availableCocs).forEach(([company, cocs]) => {
          cocs.forEach(coc => {
            totalAvailable += coc.cocQty;
            allCocs.push({
              company: company,
              ...coc
            });
          });
        });

        // Calculate shortage
        const shortage = req.requiredQty - totalAvailable;
        const shortageText = shortage > 0 ? Math.round(shortage * 100) / 100 : 0;

        // Find suggested COC - PRIORITIZE production BOM companies
        let suggestedCoc = null;
        let suggestionText = '-';

        if (allCocs.length > 0) {
          // First: Try production BOM companies (oldest first)
          const productionCocs = allCocs.filter(coc =>
            req.productionCompanies && req.productionCompanies.includes(coc.company)
          ).sort((a, b) => {
            const dateA = new Date(a.invoiceDate || '2099-01-01');
            const dateB = new Date(b.invoiceDate || '2099-01-01');
            return dateA - dateB;
          });

          // Then: Other companies (oldest first)
          const otherCocs = allCocs.filter(coc =>
            !req.productionCompanies || !req.productionCompanies.includes(coc.company)
          ).sort((a, b) => {
            const dateA = new Date(a.invoiceDate || '2099-01-01');
            const dateB = new Date(b.invoiceDate || '2099-01-01');
            return dateA - dateB;
          });

          // Combine: Production companies first
          const sortedCocs = [...productionCocs, ...otherCocs];

          if (shortage > 0) {
            // Find COC that can fulfill shortage - prioritize production BOM
            suggestedCoc = sortedCocs.find(coc => coc.cocQty >= shortage) || sortedCocs[0];
            suggestionText = '✅ ADD THIS';
          } else {
            // Show oldest COC for FIFO - prioritize production BOM
            suggestedCoc = sortedCocs[0];
            suggestionText = '✅ USE FIRST';
          }
        }

        // Status
        let status = '';
        if (totalAvailable === 0) {
          status = '❌ NO COC';
        } else if (shortage <= 0) {
          status = '✅ OK';
        } else {
          status = '⚠️ SHORT';
        }

        // Check if suggested COC is from production BOM
        const isProductionBom = suggestedCoc && req.productionCompanies &&
          req.productionCompanies.includes(suggestedCoc.company) ? '✅ USED IN PRODUCTION' : '';

        summaryData.push([
          req.materialName,
          req.productType || '-',
          req.requiredQty,
          totalAvailable,
          shortageText,
          status,
          suggestionText,
          suggestedCoc ? suggestedCoc.company : '-',
          suggestedCoc ? suggestedCoc.invoiceNo : '-',
          suggestedCoc ? suggestedCoc.cocQty : '-',
          suggestedCoc ? suggestedCoc.lotBatchNo : '-',
          suggestedCoc ? (suggestedCoc.invoiceDate || '-') : '-',
          isProductionBom
        ]);
      });

      // Add Sheet 2 - COC Suggestions
      const ws2 = XLSX.utils.aoa_to_sheet(summaryData);

      // Apply advanced styling to Sheet 2
      const range2 = XLSX.utils.decode_range(ws2['!ref']);

      // Header row styling - Gradient effect with dark blue
      for (let col = range2.s.c; col <= range2.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws2[cellAddress]) continue;
        ws2[cellAddress].s = {
          fill: { fgColor: { rgb: "0D47A1" } },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 13 },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "medium", color: { rgb: "000000" } },
            bottom: { style: "medium", color: { rgb: "000000" } },
            left: { style: "medium", color: { rgb: "000000" } },
            right: { style: "medium", color: { rgb: "000000" } }
          }
        };
      }

      // Data rows styling with conditional colors
      for (let row = range2.s.r + 1; row <= range2.e.r; row++) {
        const statusCell = ws2[XLSX.utils.encode_cell({ r: row, c: 5 })];
        const statusValue = statusCell ? statusCell.v : '';

        let rowColor = "FFFFFF";
        let statusColor = "FFFFFF";

        if (statusValue.includes('NO COC')) {
          rowColor = "FFCDD2"; // Light red
          statusColor = "F44336"; // Red
        } else if (statusValue.includes('SHORT')) {
          rowColor = "FFF9C4"; // Light yellow
          statusColor = "FFC107"; // Amber
        } else if (statusValue.includes('OK')) {
          rowColor = "C8E6C9"; // Light green
          statusColor = "4CAF50"; // Green
        }

        for (let col = range2.s.c; col <= range2.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws2[cellAddress]) continue;

          const cellColor = col === 5 ? statusColor : rowColor;

          ws2[cellAddress].s = {
            fill: { fgColor: { rgb: cellColor } },
            font: {
              bold: col === 0 || col === 5 || col === 6,
              color: { rgb: col === 5 ? "FFFFFF" : "000000" },
              sz: col === 6 ? 12 : 11
            },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "BDBDBD" } },
              bottom: { style: "thin", color: { rgb: "BDBDBD" } },
              left: { style: "thin", color: { rgb: "BDBDBD" } },
              right: { style: "thin", color: { rgb: "BDBDBD" } }
            }
          };
        }
      }

      ws2['!cols'] = [
        { wch: 25 }, // Material Name
        { wch: 28 }, // Product Type
        { wch: 14 }, // Required Qty
        { wch: 12 }, // Available
        { wch: 12 }, // Shortage
        { wch: 12 }, // Status
        { wch: 16 }, // USE THIS COC
        { wch: 30 }, // Company
        { wch: 22 }, // Invoice No
        { wch: 12 }, // COC Qty
        { wch: 20 }, // Lot/Batch
        { wch: 15 }, // Date
        { wch: 25 }  // Production BOM
      ];

      ws2['!rows'] = [{ hpt: 30 }]; // Header row height

      XLSX.utils.book_append_sheet(wb, ws2, 'Smart Suggestions');

      // Download
      const fileName = `COC_Report_PDI_${selectedPdiForDetails || 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert('✅ Professional Excel Report Downloaded!\n📊 Sheet 1: Complete COC Status\n🎯 Sheet 2: Smart COC Suggestions (FIFO)');
    } catch (error) {
      console.error('Failed to generate Excel:', error);
      alert('❌ Failed to generate Excel report');
    }
  };

  const handleSaveBomMaterials = async () => {
    if (!selectedRecordForBom) return;

    try {
      setLoading(true);
      const recordId = selectedRecordForBom.id;
      const API_BASE = getAPIBase();

      // Get current wattage materials (14 fixed materials)
      const currentMaterials = BOM_MATERIALS_BY_WATTAGE[selectedWattage] || [];

      // Upload each BOM material - ONLY if there's NEW data to save
      for (const material of currentMaterials) {
        const materialData = bomMaterials[material.name];

        // Check if there's any NEW data to save (not just existing data)
        const hasNewLotBatchNo = materialData.lotBatchNo && materialData.lotBatchNo.trim() !== '';
        const hasNewCompany = materialData.company && materialData.company.trim() !== '';
        const hasNewImages = materialData.images && materialData.images.length > 0;
        const hasNewEfficiency = material.name === 'Solar Cell' && materialData.cellEfficiency;

        console.log(`[BOM DEBUG] Material: ${material.name}, lotBatchNo: '${materialData?.lotBatchNo}', company: '${materialData?.company}', efficiency: '${materialData?.cellEfficiency}', hasImages: ${hasNewImages}, will send: ${hasNewLotBatchNo || hasNewCompany || hasNewImages || hasNewEfficiency}`);

        // Only send request if there's actual new data to save
        if (materialData && (hasNewLotBatchNo || hasNewCompany || hasNewImages || hasNewEfficiency)) {
          const formData = new FormData();
          formData.append('materialName', material.name);
          formData.append('lotBatchNo', materialData.lotBatchNo || '');
          formData.append('company', materialData.company || '');
          formData.append('shift', selectedShift);  // day or night

          // Add cell efficiency for Solar Cell
          if (material.name === 'Solar Cell' && materialData.cellEfficiency) {
            formData.append('cellEfficiency', materialData.cellEfficiency);
          }

          // Append multiple images (only new ones)
          if (hasNewImages) {
            for (const image of materialData.images) {
              formData.append('images', image);
            }
          }

          await axios.post(
            `${API_BASE.replace('/api', '')}/api/companies/${selectedCompany.id}/production/${recordId}/bom-material`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            }
          );
        }
      }

      // Upload IPQC PDF if provided
      if (ipqcPdf) {
        const formData = new FormData();
        formData.append('pdf', ipqcPdf);
        formData.append('shift', selectedShift);  // Send shift (day or night)
        await axios.post(
          `${API_BASE.replace('/api', '')}/api/companies/${selectedCompany.id}/production/${recordId}/ipqc-pdf`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      // Upload FTR Document if provided
      if (ftrDocument) {
        const formData = new FormData();
        formData.append('document', ftrDocument);
        await axios.post(
          `${API_BASE.replace('/api', '')}/api/companies/${selectedCompany.id}/production/${recordId}/ftr-document`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      await refreshSelectedCompany();
      setShowBomModal(false);
      setSelectedRecordForBom(null);
      setBomMaterials({});
      setIpqcPdf(null);
      setFtrDocument(null);
      alert('BOM materials and documents uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload BOM materials:', error);
      alert(error.response?.data?.error || 'Failed to upload BOM materials');
    } finally {
      setLoading(false);
    }
  };

  // Calculate required COCs for a PDI based on production and suggest available COCs
  const calculateRequiredCocs = async (pdiNumber, wattage) => {
    try {
      setLoadingRequiredCocs(true);
      const API_BASE = getAPIBase();

      // Get PDI records
      const pdiRecords = selectedCompany.productionRecords.filter(r => r.pdi === pdiNumber);
      const totalProduction = pdiRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0);

      // Get BOM materials for this wattage
      const bomMaterials = BOM_MATERIALS_BY_WATTAGE[wattage] || [];

      // Calculate required quantities
      const requiredMaterials = bomMaterials.map(material => {
        const requiredQty = totalProduction * material.qty;
        return {
          materialName: material.name,
          productType: material.product_type,
          requiredQty: Math.round(requiredQty * 100) / 100,
          perModuleQty: material.qty
        };
      });

      // Fetch available COCs from MRP API (correct endpoint with full data)
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await axios.post('https://umanmrp.in/a/get_assigned_coc_records.php', {
        from: fromDate,
        to: toDate
      });

      if (response.data && response.data.status === 'success') {
        const cocData = response.data.data || [];

        // Map company name to MRP API format
        const COMPANY_NAME_MAPPING = {
          'Rays Power': 'Rays Power',
          'Larsen & Toubro': 'L&T',
          'Sterlin and Wilson': 'S&W'
        };
        const mrpCompanyName = COMPANY_NAME_MAPPING[selectedCompany.name] || selectedCompany.name;

        // Filter COCs by company (assigned_to) AND PDI number
        const filteredCocData = cocData.filter(coc => {
          const matchesCompany = coc.assigned_to === mrpCompanyName;
          const matchesPdi = coc.pdi_no === pdiNumber || coc.pdi_no?.toString() === pdiNumber?.toString();
          return matchesCompany && matchesPdi;
        });

        console.log(`Filtered COCs for ${mrpCompanyName} PDI ${pdiNumber}:`, filteredCocData.length);

        // Get actual BOM materials used in production (priority: production BOM > COC API)
        const actualBomMaterials = {};
        pdiRecords.forEach(record => {
          if (record.bomMaterials && Array.isArray(record.bomMaterials)) {
            record.bomMaterials.forEach(bom => {
              if (bom.company && bom.materialName) {
                const key = bom.materialName.toLowerCase();
                if (!actualBomMaterials[key]) {
                  actualBomMaterials[key] = new Set();
                }
                actualBomMaterials[key].add(bom.company);
              }
            });
          }
        });

        // Group COCs by material and company
        const requiredCocsData = requiredMaterials.map(req => {
          const reqMaterial = req.materialName.toLowerCase();

          // PRIORITY 1: Use companies from actual production BOM
          let companiesUsedInProduction = actualBomMaterials[reqMaterial];
          if (!companiesUsedInProduction) {
            // Try fuzzy matching for production BOM
            const bomKeys = Object.keys(actualBomMaterials);
            for (const bomKey of bomKeys) {
              if (reqMaterial.includes(bomKey) || bomKey.includes(reqMaterial)) {
                companiesUsedInProduction = actualBomMaterials[bomKey];
                break;
              }
            }
          }

          // Find matching COCs for this material from FILTERED MRP API data
          const matchingCocs = filteredCocData.filter(coc => {
            const cocMaterial = (coc.material_name || '').toLowerCase().trim();

            // Improved matching logic with better aliases
            if (reqMaterial.includes('cell') && cocMaterial.includes('cell')) return true;
            if (reqMaterial.includes('eva') && cocMaterial.includes('eva')) return true;

            // Glass: Handle FRONT/BACK variants
            if ((reqMaterial.includes('glass') || reqMaterial.includes('front glass') || reqMaterial.includes('back glass'))
              && cocMaterial.includes('glass')) return true;

            // Ribbon: Handle all ribbon variants (0.26mm, 4.0x0.4, 6.0x0.4, BUSBAR)
            if ((reqMaterial.includes('ribbon') || reqMaterial.includes('busbar'))
              && (cocMaterial.includes('ribbon') || cocMaterial.includes('busbar'))) return true;

            if (reqMaterial.includes('flux') && cocMaterial.includes('flux')) return true;

            // EPE: Handle EPE FRONT variant
            if ((reqMaterial.includes('epe') || reqMaterial.includes('epe front'))
              && cocMaterial.includes('epe')) return true;

            // Aluminium Frame: Handle LONG/SHORT variants
            if ((reqMaterial.includes('frame') || reqMaterial.includes('aluminium') || reqMaterial.includes('aluminum'))
              && (cocMaterial.includes('frame') || cocMaterial.includes('aluminium') || cocMaterial.includes('aluminum'))) return true;

            // Sealent/Sealant spelling variants
            if ((reqMaterial.includes('sealent') || reqMaterial.includes('sealant'))
              && (cocMaterial.includes('sealent') || cocMaterial.includes('sealant'))) return true;

            // JB Potting: Handle A/B/both variants
            if ((reqMaterial.includes('potting') || reqMaterial.includes('jb'))
              && (cocMaterial.includes('potting') || cocMaterial.includes('jb'))) return true;

            // Junction Box
            if ((reqMaterial.includes('junction') || reqMaterial.includes('box'))
              && (cocMaterial.includes('junction') || cocMaterial.includes('box'))) return true;

            if (reqMaterial.includes('rfid') && cocMaterial.includes('rfid')) return true;

            return false;
          });

          // Group by company/brand using MRP API fields
          const cocsByCompany = {};
          matchingCocs.forEach(coc => {
            const company = coc.assigned_to || 'Unknown';  // Use assigned_to from MRP API
            if (!cocsByCompany[company]) {
              cocsByCompany[company] = [];
            }
            cocsByCompany[company].push({
              invoiceNo: coc.invoice_no,
              cocQty: parseFloat(coc.remaining_qty) || 0,  // Use remaining_qty from MRP API
              lotBatchNo: coc.lot_batch_no,
              pdiNo: coc.pdi_no,
              usedInProduction: companiesUsedInProduction && companiesUsedInProduction.has(company) ? '✅ USED' : ''
            });
          });

          // Sort companies: Production BOM companies first
          const sortedCocsByCompany = {};
          const productionCompanies = [];
          const otherCompanies = [];

          Object.keys(cocsByCompany).forEach(company => {
            if (companiesUsedInProduction && companiesUsedInProduction.has(company)) {
              productionCompanies.push(company);
            } else {
              otherCompanies.push(company);
            }
          });

          [...productionCompanies, ...otherCompanies].forEach(company => {
            sortedCocsByCompany[company] = cocsByCompany[company];
          });

          return {
            ...req,
            availableCocs: sortedCocsByCompany,
            productionCompanies: Array.from(companiesUsedInProduction || [])
          };
        });

        setRequiredCocsReport(requiredCocsData);
      }
    } catch (error) {
      console.error('Failed to calculate required COCs:', error);
    } finally {
      setLoadingRequiredCocs(false);
    }
  };

  const handleDeleteProductionRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this production record?')) {
      return;
    }

    try {
      setLoading(true);
      await companyService.deleteProductionRecord(selectedCompany.id, recordId);
      await refreshSelectedCompany();
      alert('Production record deleted successfully!');
    } catch (error) {
      console.error('Failed to delete production record:', error);
      alert('Failed to delete production record');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleExcelUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Random defect selector - 70% minor, 30% major (realistic distribution)
        const getRandomDefect = () => {
          const majorDefects = [
            'EL Major Micro-crack / Cell Crack',
            'Broken Cell / Dead Cell (Dark Cell)',
            'Hot-spot Affected Cell',
            'Glass Crack / Corner Crack',
            'Low Power / Pmax Less Than Tolerance',
            'Soldering Open / Ribbon Cut',
            'J-Box Diode Failure / Wrong Diode',
            'Delamination (Air Gap Inside Laminate)',
            'Insulation Resistance Fail / Hi-pot Fail',
            'Frame Major Dent / Frame Separation'
          ];

          const minorDefects = [
            'Cell Color Mismatch (Shade Difference)',
            'Minor EVA Bubble (Non-critical Position)',
            'Backsheet Wrinkle',
            'Ribbon Alignment Not Straight',
            'Glass Small Scratch (Acceptable Limit)',
            'EVA Overflow / Glue Mark',
            'Small Dust / Particle Inside Laminate',
            'Label Alignment Wrong / Print Misalignment',
            'Frame Minor Cosmetic Scratch',
            'Barcode Sticker Tilt / Small Ink Mark'
          ];

          const stages = [
            'Visual Inspection',
            'Electrical Test',
            'EL Test',
            'Flash Test',
            'Final QC',
            'Packaging',
            'Lamination',
            'Stringing'
          ];

          // 70% chance of minor defect (more realistic for demo)
          const isMajor = Math.random() < 0.3;
          const defectList = isMajor ? majorDefects : minorDefects;
          const randomReason = defectList[Math.floor(Math.random() * defectList.length)];

          // Select appropriate stage based on defect type
          let randomStage;
          if (randomReason.includes('EL') || randomReason.includes('Hot-spot')) {
            randomStage = 'EL Test';
          } else if (randomReason.includes('Power') || randomReason.includes('Electrical')) {
            randomStage = 'Flash Test';
          } else if (randomReason.includes('Lamination') || randomReason.includes('Delamination')) {
            randomStage = 'Lamination';
          } else if (randomReason.includes('Soldering') || randomReason.includes('Ribbon')) {
            randomStage = 'Stringing';
          } else if (randomReason.includes('J-Box') || randomReason.includes('Diode')) {
            randomStage = 'Electrical Test';
          } else {
            randomStage = stages[Math.floor(Math.random() * stages.length)];
          }

          return { reason: randomReason, stage: randomStage };
        };

        // Extract serial numbers from Excel (supports multiple column names)
        let serialNumbers = jsonData.map(row =>
          row['Serial Number'] ||
          row['serial_number'] ||
          row['Barcode'] ||
          row['barcode'] ||
          row['Serial No'] ||
          row['Module Serial'] ||
          row['SN'] ||
          Object.values(row)[0] // If no header, take first column
        ).filter(Boolean);

        // Sort serial numbers A-Z
        serialNumbers.sort((a, b) => String(a).localeCompare(String(b)));

        // Get production records sorted by date to distribute rejections
        const productionDates = selectedCompany.productionRecords
          .filter(r => r.moduleRejectionPercent > 0)
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (productionDates.length === 0) {
          alert('No production records with rejection percentage found! Please add production data first.');
          return;
        }

        // Calculate how many rejections per date based on module rejection %
        const rejections = [];
        let currentIndex = 0;

        for (const record of productionDates) {
          const dailyProduction = (record.dayProduction || 0) + (record.nightProduction || 0);
          const rejectionPercent = record.moduleRejectionPercent || 0;
          const rejectedCount = Math.round((dailyProduction * rejectionPercent) / 100);

          // Assign serial numbers to this date with random defects
          for (let i = 0; i < rejectedCount && currentIndex < serialNumbers.length; i++) {
            const { reason, stage } = getRandomDefect();
            rejections.push({
              serialNumber: String(serialNumbers[currentIndex]),
              rejectionDate: record.date,
              reason: reason,
              stage: stage
            });
            currentIndex++;
          }

          // Break if all serial numbers assigned
          if (currentIndex >= serialNumbers.length) break;
        }

        // Warning if there are extra serial numbers that won't be used
        const unusedCount = serialNumbers.length - currentIndex;

        if (rejections.length === 0) {
          alert('No valid serial numbers found in Excel!');
          return;
        }

        // Calculate total expected rejections based on production %
        const totalExpectedRejections = productionDates.reduce((sum, record) => {
          const dailyProduction = (record.dayProduction || 0) + (record.nightProduction || 0);
          const rejectionPercent = record.moduleRejectionPercent || 0;
          return sum + Math.round((dailyProduction * rejectionPercent) / 100);
        }, 0);

        setLoading(true);
        await companyService.bulkAddRejections(selectedCompany.id, rejections);
        await refreshSelectedCompany();

        let message = `✓ ${rejections.length} rejections uploaded successfully!\nDistributed across ${productionDates.length} production days based on rejection percentages.`;

        if (unusedCount > 0) {
          message += `\n\n⚠️ Note: ${unusedCount} serial numbers were not used (Excel had ${serialNumbers.length} serials, but only ${totalExpectedRejections} rejections expected based on production %).`;
        }

        alert(message);
      } catch (error) {
        console.error('Excel upload failed:', error);
        alert('Failed to upload Excel file: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const handleAddRejection = async () => {
    if (!newRejection.serialNumber) {
      alert('Please enter serial number!');
      return;
    }

    try {
      setLoading(true);
      await companyService.addRejection(selectedCompany.id, newRejection);
      await refreshSelectedCompany();

      setNewRejection({
        serialNumber: '',
        rejectionDate: new Date().toISOString().split('T')[0],
        reason: 'Cell Crack',
        stage: 'Visual Inspection'
      });

      setShowRejectionModal(false);
      alert('Rejection added successfully!');
    } catch (error) {
      console.error('Failed to add rejection:', error);
      alert('Failed to add rejection');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleDeleteRejection = async (rejectionId) => {
    if (!window.confirm('Are you sure you want to delete this rejection?')) {
      return;
    }

    try {
      setLoading(true);
      await companyService.deleteRejection(selectedCompany.id, rejectionId);
      await refreshSelectedCompany();
      alert('Rejection deleted successfully!');
    } catch (error) {
      console.error('Failed to delete rejection:', error);
      alert('Failed to delete rejection');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleDeleteAllRejections = async () => {
    if (!window.confirm('Are you sure you want to delete ALL rejections? This cannot be undone!')) {
      return;
    }

    try {
      setLoading(true);
      await companyService.deleteAllRejections(selectedCompany.id);
      await refreshSelectedCompany();
      alert('All rejections deleted successfully!');
    } catch (error) {
      console.error('Failed to delete all rejections:', error);
      alert('Failed to delete all rejections');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPDFModal = () => {
    const records = getDateRange();
    if (records.length === 0) {
      alert('No production data available!');
      return;
    }

    setPdfDateRange({
      startDate: records[0].date,
      endDate: records[records.length - 1].date
    });
    setShowPDFModal(true);
  };

  const handleGeneratePDF = async () => {
    if (!pdfDateRange.startDate || !pdfDateRange.endDate) {
      alert('Please select date range!');
      return;
    }

    try {
      setLoading(true);

      const filteredRecords = selectedCompany.productionRecords.filter(record => {
        const recordDate = new Date(record.date);
        const start = new Date(pdfDateRange.startDate);
        const end = new Date(pdfDateRange.endDate);
        return recordDate >= start && recordDate <= end;
      });

      const filteredRejections = selectedCompany.rejectedModules.filter(rej => {
        const rejDate = new Date(rej.rejectionDate);
        const start = new Date(pdfDateRange.startDate);
        const end = new Date(pdfDateRange.endDate);
        return rejDate >= start && rejDate <= end;
      });

      const sortedRejections = filteredRejections.sort((a, b) => {
        const dateCompare = new Date(a.rejectionDate) - new Date(b.rejectionDate);
        if (dateCompare !== 0) return dateCompare;
        return a.serialNumber.localeCompare(b.serialNumber);
      });

      const totalProduction = filteredRecords.reduce((sum, r) =>
        sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0
      );

      const totalMW = ((totalProduction * parseFloat(selectedCompany.moduleWattage)) / 1000000).toFixed(2);

      const payload = {
        company_name: selectedCompany.companyName,
        module_wattage: selectedCompany.moduleWattage,
        module_type: selectedCompany.moduleType,
        cells_per_module: selectedCompany.cellsPerModule,
        cells_received_qty: selectedCompany.cellsReceivedQty || 0,
        cells_received_mw: selectedCompany.cellsReceivedMW || 0,
        start_date: pdfDateRange.startDate,
        end_date: pdfDateRange.endDate,
        production_records: filteredRecords.map(r => ({
          date: r.date,
          day_production: r.dayProduction || 0,
          night_production: r.nightProduction || 0,
          cell_rejection_percent: r.cellRejectionPercent || 0,
          module_rejection_percent: r.moduleRejectionPercent || 0,
          pdi: r.pdi || '',
          lot_number: r.lotNumber || 'N/A',
          bom_materials: r.bomMaterials || [],
          ipqc_pdf: r.ipqcPdf || null,
          day_ipqc_pdf: r.dayIpqcPdf || null,
          night_ipqc_pdf: r.nightIpqcPdf || null,
          ftr_document: r.ftrDocument || null
        })),
        cell_stock: calculateCellStock(),
        total_mw: totalMW,
        total_rejected_modules: sortedRejections.length,
        rejected_modules: sortedRejections.map(rej => ({
          serial_number: rej.serialNumber,
          rejection_date: rej.rejectionDate,
          reason: rej.reason,
          stage: rej.stage
        })),
        remarks: reportData.remarks || '',
        report_options: reportOptions
      };

      const API_BASE = getAPIBase();
      const response = await axios.post(`${API_BASE.replace('/api', '')}/api/generate-production-report`, payload, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedCompany.companyName}_Production_Report_${pdfDateRange.startDate}_to_${pdfDateRange.endDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setShowPDFModal(false);
      alert('PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Error generating PDF! Check backend logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExcel = async () => {
    if (!pdfDateRange.startDate || !pdfDateRange.endDate) {
      alert('Please select date range!');
      return;
    }

    try {
      setLoading(true);

      const filteredRecords = selectedCompany.productionRecords.filter(record => {
        const recordDate = new Date(record.date);
        const start = new Date(pdfDateRange.startDate);
        const end = new Date(pdfDateRange.endDate);
        return recordDate >= start && recordDate <= end;
      });

      const filteredRejections = selectedCompany.rejectedModules.filter(rej => {
        const rejDate = new Date(rej.rejectionDate);
        const start = new Date(pdfDateRange.startDate);
        const end = new Date(pdfDateRange.endDate);
        return rejDate >= start && rejDate <= end;
      });

      const sortedRejections = filteredRejections.sort((a, b) => {
        const dateCompare = new Date(a.rejectionDate) - new Date(b.rejectionDate);
        if (dateCompare !== 0) return dateCompare;
        return a.serialNumber.localeCompare(b.serialNumber);
      });

      const totalProduction = filteredRecords.reduce((sum, r) =>
        sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0
      );

      const totalMW = ((totalProduction * parseFloat(selectedCompany.moduleWattage)) / 1000000).toFixed(2);

      const payload = {
        company: {
          name: selectedCompany.companyName,
          address: selectedCompany.address || 'N/A',
          contact: selectedCompany.contact || 'N/A',
          module_wattage: selectedCompany.moduleWattage,
          module_type: selectedCompany.moduleType,
          cells_per_module: selectedCompany.cellsPerModule
        },
        production_data: filteredRecords.map(r => ({
          date: r.date,
          day_of_week: new Date(r.date).toLocaleDateString('en-US', { weekday: 'long' }),
          day_production: r.dayProduction || 0,
          night_production: r.nightProduction || 0,
          cell_rejection_percent: (r.cellRejectionPercent || 0) / 100,
          module_rejection_percent: (r.moduleRejectionPercent || 0) / 100,
          cells_rejected: Math.round(((r.dayProduction || 0) + (r.nightProduction || 0)) * 132 * (r.cellRejectionPercent || 0) / 100),
          modules_rejected: Math.round(((r.dayProduction || 0) + (r.nightProduction || 0)) * (r.moduleRejectionPercent || 0) / 100),
          lot_number: r.lotNumber || 'N/A',
          bom_materials: r.bomMaterials || [],
          ipqc_pdf: r.ipqcPdf || null,
          day_ipqc_pdf: r.dayIpqcPdf || null,
          night_ipqc_pdf: r.nightIpqcPdf || null,
          ftr_document: r.ftrDocument || null
        })),
        rejections: sortedRejections.map((rej, index) => ({
          no: index + 1,
          date: rej.rejectionDate,
          serial: rej.serialNumber,
          reason: rej.reason,
          stage: rej.stage,
          defect_type: rej.defectType || 'Minor',
          remarks: rej.remarks || ''
        })),
        start_date: pdfDateRange.startDate,
        end_date: pdfDateRange.endDate,
        cells_received_qty: selectedCompany.cellsReceivedQty || 0,
        cells_received_mw: selectedCompany.cellsReceivedMW || 0,
        report_options: reportOptions
      };

      const API_BASE = getAPIBase();
      const response = await axios.post(`${API_BASE.replace('/api', '')}/api/generate-production-excel`, payload, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedCompany.companyName}_Production_Report_${pdfDateRange.startDate}_to_${pdfDateRange.endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setShowPDFModal(false);
      alert('Excel generated successfully!');
    } catch (error) {
      console.error('Excel generation failed:', error);
      alert('Error generating Excel! Check backend logs.');
    } finally {
      setLoading(false);
    }
  };

  const renderCompanyList = () => (
    <div className="company-list-container">
      <div className="list-header">
        <h2>Companies List</h2>
        <button className="btn-add-company" onClick={handleNewCompany}>
          + Add New Company
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {!loading && companies.length === 0 && (
        <div className="empty-state">
          <p>No companies added yet. Click "Add New Company" to get started!</p>
        </div>
      )}

      <div className="companies-grid">
        {companies.map(company => (
          <div key={company.id} className="company-card">
            <div className="card-header">
              <h3>{company.companyName}</h3>
              <span className="card-date">{company.createdDate}</span>
            </div>
            <div className="card-body">
              <div className="info-row">
                <span className="info-label">📦 Module</span>
                <span className="info-value">{company.moduleWattage}W {company.moduleType}</span>
              </div>
              <div className="info-row">
                <span className="info-label">🔢 Cells/Module</span>
                <span className="info-value">{company.cellsPerModule}</span>
              </div>
              {company.cellsReceivedQty && (
                <div className="info-row">
                  <span className="info-label">📥 Cells Received</span>
                  <span className="info-value">{company.cellsReceivedQty} <span className="info-unit">({company.cellsReceivedMW} MW)</span></span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">📊 Production Records</span>
                <span className="info-value highlight-blue">{company.productionRecords?.length || 0}</span>
              </div>
              <div className="info-row">
                <span className="info-label">🚫 Rejections</span>
                <span className="info-value highlight-red">{company.rejectedModules?.length || 0}</span>
              </div>
            </div>
            <div className="card-actions">
              <button className="btn-open" onClick={() => handleSelectCompany(company)}>
                📂 Open
              </button>
              {isSuperAdmin() && (
                <button className="btn-delete-card" onClick={() => handleDeleteCompany(company.id)}>
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompanyForm = () => (
    <div className="company-form-container">
      <div className="form-header">
        <h2>{companyForm.id ? 'Edit Company' : 'New Company'}</h2>
        <button className="btn-back" onClick={() => setViewMode('list')}>
          ← Back to List
        </button>
      </div>

      <div className="form-content">
        <div className="form-group">
          <label>Company Name *</label>
          <input
            type="text"
            value={companyForm.companyName}
            onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
            placeholder="Enter company name"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Module Wattage *</label>
            <input
              type="number"
              value={companyForm.moduleWattage}
              onChange={(e) => setCompanyForm({ ...companyForm, moduleWattage: e.target.value })}
              placeholder="625"
            />
          </div>

          <div className="form-group">
            <label>Module Type *</label>
            <select
              value={companyForm.moduleType}
              onChange={(e) => setCompanyForm({ ...companyForm, moduleType: e.target.value })}
            >
              <option value="Topcon">Topcon</option>
              <option value="Perc">Perc</option>
              <option value="HJT">HJT</option>
              <option value="Mono">Mono</option>
              <option value="Poly">Poly</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Cells Per Module *</label>
          <input
            type="number"
            value={companyForm.cellsPerModule}
            onChange={(e) => setCompanyForm({ ...companyForm, cellsPerModule: e.target.value })}
            placeholder="132"
          />
        </div>

        <div className="form-group">
          <label>Current Running Order</label>
          <input
            type="text"
            value={companyForm.currentRunningOrder}
            onChange={(e) => setCompanyForm({ ...companyForm, currentRunningOrder: e.target.value })}
            placeholder="e.g., ORD-2024-001"
          />
          <small style={{ color: '#666', fontSize: '12px', marginTop: '5px', display: 'block' }}>
            📋 Enter the order number that is currently in production
          </small>
        </div>

        <div className="form-section">
          <h3>Cells Received (Optional)</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                value={companyForm.cellsReceivedQty}
                onChange={(e) => setCompanyForm({ ...companyForm, cellsReceivedQty: e.target.value })}
                placeholder="Enter number of cells"
              />
            </div>

            <div className="form-group">
              <label>MW</label>
              <input
                type="number"
                step="0.01"
                value={companyForm.cellsReceivedMW}
                onChange={(e) => setCompanyForm({ ...companyForm, cellsReceivedMW: e.target.value })}
                placeholder="Enter MW"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-save" onClick={handleSaveCompany} disabled={loading}>
            {loading ? 'Saving...' : 'Save Company'}
          </button>
          <button className="btn-cancel" onClick={() => setViewMode('list')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const renderProductionView = () => {
    if (!selectedCompany) return null;

    const dateRecords = getDateRange();

    // ======== CALCULATIONS FOR DETAILED INVENTORY UI ========
    // 1. Total Received
    // ======== CALCULATIONS FOR DETAILED INVENTORY UI ========
    // 1. Total Received
    const cellEfficiencyReceived = selectedCompany.cellEfficiencyReceived || {};
    const grandTotalReceived = Object.values(cellEfficiencyReceived)
      .flatMap(eff => Object.values(eff))
      .reduce((a, b) => a + (b || 0), 0);

    // 2. OK (A-grade) Modules
    const okModules = dateRecords.reduce((s, r) => s + (r.dayProduction || 0) + (r.nightProduction || 0), 0);

    // 3. OK (A-grade) Cells Used
    const okCellsUsed = okModules * 66;

    // 4. B-grade Calculation - Simple average of non-zero values
    let modRejSum2 = 0;
    let modRejCount2 = 0;
    dateRecords.forEach(r => {
      const modRej = parseFloat(r.moduleRejectionPercent) || 0;
      if (modRej > 0) {
        modRejSum2 += modRej;
        modRejCount2++;
      }
    });
    const avgModRejPct = modRejCount2 > 0 ? (modRejSum2 / modRejCount2) : 0;

    const bGradeModules = Math.round(okModules * (avgModRejPct / 100));
    const bGradeCellsUsed = bGradeModules * 66;

    // 5. R-grade Calculation (Scrap)
    const rGradePct = 0.7;
    const rGradeModules = Math.round(okModules * (rGradePct / 100));
    const rGradeCellsUsed = rGradeModules * 66;

    // 6. Total Processed Cells
    const totalProcessedCells = okCellsUsed + bGradeCellsUsed + rGradeCellsUsed;

    // 7. Cell Rejection - Simple average of non-zero values
    let cellRejSum2 = 0;
    let cellRejCount2 = 0;
    dateRecords.forEach(r => {
      const cellRej = parseFloat(r.cellRejectionPercent) || 0;
      if (cellRej > 0) {
        cellRejSum2 += cellRej;
        cellRejCount2++;
      }
    });
    const avgCellRejPct = cellRejCount2 > 0 ? (cellRejSum2 / cellRejCount2) : 0;

    const cellRejectionQty = Math.round(totalProcessedCells * (avgCellRejPct / 100));

    // 8. TOTAL Cells Used
    const grandTotalUsed = totalProcessedCells + cellRejectionQty;

    // 9. Cells Remaining
    const grandRemaining = grandTotalReceived - grandTotalUsed;

    // 10. Est. Modules
    const totalLossPct = (avgModRejPct + rGradePct) / 100;
    // eslint-disable-next-line no-unused-vars
    const estimatedModules = Math.floor((grandRemaining / 66) * (1 - totalLossPct));

    return (
      <div className="production-view-container">
        <div className="production-header">
          <h2>{selectedCompany.companyName} - Production Management</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn-primary"
              onClick={handleAddNewDay}
              style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ➕ Add New Day
            </button>
            <button
              className="btn-primary"
              onClick={() => document.getElementById('master-data-upload').click()}
              style={{ padding: '10px 20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              📤 Upload Master Data
            </button>
            <input
              id="master-data-upload"
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleMasterDataUpload}
            />
            <button
              className="btn-primary"
              onClick={() => document.getElementById('rejection-upload').click()}
              style={{ padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🚫 Upload Rejections
            </button>
            <input
              id="rejection-upload"
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleRejectionUpload}
            />
            <button
              style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
              onClick={() => { setSelectedCompany(null); setViewMode('list'); }}
            >
              ← Back to List
            </button>
          </div>
        </div>

        {loading && <div className="loading">Loading...</div>}

        {/* ========== TAB NAVIGATION ========== */}
        <div style={{
          display: 'flex',
          gap: '0',
          marginBottom: '0',
          borderBottom: '3px solid #1976d2',
          backgroundColor: '#f5f5f5',
          borderRadius: '12px 12px 0 0',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setProductionTab('production')}
            style={{
              flex: 1,
              padding: '18px 30px',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: productionTab === 'production' ? '#1976d2' : 'transparent',
              color: productionTab === 'production' ? 'white' : '#555',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '22px' }}>📋</span>
            Production Records
            <span style={{
              backgroundColor: productionTab === 'production' ? 'rgba(255,255,255,0.2)' : '#e0e0e0',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px'
            }}>
              {selectedCompany.productionRecords?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setProductionTab('cellInventory')}
            style={{
              flex: 1,
              padding: '18px 30px',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: productionTab === 'cellInventory' ? '#FF5722' : 'transparent',
              color: productionTab === 'cellInventory' ? 'white' : '#555',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '22px' }}>⚡</span>
            Cell Efficiency Inventory
            <span style={{
              backgroundColor: productionTab === 'cellInventory' ? 'rgba(255,255,255,0.2)' : '#e0e0e0',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px'
            }}>
              {(() => {
                const received = selectedCompany?.cellEfficiencyReceived || {};
                let total = 0;
                Object.values(received).forEach(effData => {
                  if (typeof effData === 'object') {
                    total += Object.values(effData).reduce((sum, qty) => sum + (qty || 0), 0);
                  }
                });
                return total.toLocaleString();
              })()}
            </span>
          </button>
          
          {/* PDI Dashboard Tab */}
          <button
            onClick={() => setProductionTab('pdiDashboard')}
            style={{
              flex: 1,
              padding: '18px 30px',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: productionTab === 'pdiDashboard' ? '#9c27b0' : 'transparent',
              color: productionTab === 'pdiDashboard' ? 'white' : '#555',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '22px' }}>📦</span>
            PDI Tracking
          </button>

          {/* IQC COC Tracker Tab */}
          <button
            onClick={() => setProductionTab('iqcTracker')}
            style={{
              flex: 1,
              padding: '18px 30px',
              fontSize: '16px',
              fontWeight: '700',
              border: 'none',
              backgroundColor: productionTab === 'iqcTracker' ? '#1a237e' : 'transparent',
              color: productionTab === 'iqcTracker' ? 'white' : '#555',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '22px' }}>📋</span>
            IQC - COC
          </button>
        </div>

        {/* ========== TAB CONTENT ========== */}
        {productionTab === 'production' && (
          <div className="production-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>Daily Production Records</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPdiFilter('all')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '5px',
                    border: pdiFilter === 'all' ? '2px solid #007bff' : '1px solid #ccc',
                    backgroundColor: pdiFilter === 'all' ? '#007bff' : 'white',
                    color: pdiFilter === 'all' ? 'white' : '#333',
                    fontWeight: pdiFilter === 'all' ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  All Records ({selectedCompany.productionRecords?.length || 0})
                </button>
                <button
                  onClick={() => setPdiFilter('done')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '5px',
                    border: pdiFilter === 'done' ? '2px solid #28a745' : '1px solid #ccc',
                    backgroundColor: pdiFilter === 'done' ? '#28a745' : 'white',
                    color: pdiFilter === 'done' ? 'white' : '#333',
                    fontWeight: pdiFilter === 'done' ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  ✓ PDI Done ({selectedCompany.productionRecords?.filter(r => r.pdi && r.pdi.trim() !== '').length || 0})
                </button>
                <button
                  onClick={() => setPdiFilter('pending')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '5px',
                    border: pdiFilter === 'pending' ? '2px solid #ffc107' : '1px solid #ccc',
                    backgroundColor: pdiFilter === 'pending' ? '#ffc107' : 'white',
                    color: pdiFilter === 'pending' ? 'white' : '#333',
                    fontWeight: pdiFilter === 'pending' ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  ⏳ PDI Pending ({selectedCompany.productionRecords?.filter(r => !r.pdi || r.pdi.trim() === '').length || 0})
                </button>
              </div>
            </div>

            {pdiFilter === 'done' && selectedCompany.productionRecords?.length > 0 && (() => {
              const uniquePdis = [...new Set(
                selectedCompany.productionRecords
                  .filter(r => r.pdi && r.pdi.trim() !== '' && r.pdiApproved)
                  .map(r => r.pdi)
              )];

              return uniquePdis.length > 0 ? (
                <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {uniquePdis.map(pdiNumber => {
                    const pdiRecords = selectedCompany.productionRecords.filter(r => r.pdi === pdiNumber && r.pdiApproved);
                    const totalProduction = pdiRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0);

                    return (
                      <div key={pdiNumber} style={{
                        padding: '15px',
                        border: '2px solid #28a745',
                        borderRadius: '8px',
                        backgroundColor: '#e8f5e9',
                        minWidth: '250px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, color: '#2e7d32', fontSize: '16px' }}>✅ {pdiNumber}</h4>
                          <span style={{ background: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                            COMPLETED
                          </span>
                        </div>
                        <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                          <strong>Records:</strong> {pdiRecords.length}<br />
                          <strong>Production:</strong> {totalProduction} modules
                        </p>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPdiForDetails(pdiNumber);
                              setShowPdiDetailsModal(true);
                              loadAssignedCocData(selectedCompany?.companyName);
                            }}
                            style={{
                              flex: '1 1 45%',
                              padding: '8px',
                              background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            📋 View BOM
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert('Download Report for ' + pdiNumber);
                            }}
                            style={{
                              flex: '1 1 45%',
                              padding: '8px',
                              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            📄 Report
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const wattage = selectedCompany.moduleWattage || '625wp';
                              setSelectedPdiForDetails(pdiNumber);
                              calculateRequiredCocs(pdiNumber, wattage);
                            }}
                            style={{
                              flex: '1 1 100%',
                              padding: '8px',
                              background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            disabled={loadingRequiredCocs}
                          >
                            {loadingRequiredCocs && selectedPdiForDetails === pdiNumber ? '⏳ Loading...' : '🔍 Required COCs'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                </div>
              ) : <p className="no-data">No completed PDI records yet.</p>;
            })()}

            {pdiFilter === 'pending' && selectedCompany.productionRecords?.length > 0 && (() => {
              const uniquePdis = [...new Set(
                selectedCompany.productionRecords
                  .filter(r => r.pdi && r.pdi.trim() !== '' && !r.pdiApproved)
                  .map(r => r.pdi)
              )];

              return uniquePdis.length > 0 ? (
                <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {uniquePdis.map(pdiNumber => {
                    const pdiRecords = selectedCompany.productionRecords.filter(r => r.pdi === pdiNumber);
                    const totalProduction = pdiRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0);

                    return (
                      <div key={pdiNumber} style={{
                        padding: '15px',
                        border: '2px solid #ffc107',
                        borderRadius: '8px',
                        backgroundColor: '#fff9e6',
                        minWidth: '250px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, color: '#f57c00', fontSize: '16px' }}>⚠️ {pdiNumber}</h4>
                          <span style={{ background: '#ffc107', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                            PENDING
                          </span>
                        </div>
                        <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                          <strong>Records:</strong> {pdiRecords.length}<br />
                          <strong>Production:</strong> {totalProduction} modules
                        </p>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPdiForDetails(pdiNumber);
                              setShowPdiDetailsModal(true);
                              loadAssignedCocData(selectedCompany?.companyName);
                            }}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            📋 View BOM
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Mark ${pdiNumber} as COMPLETE?`)) return;

                              try {
                                setLoading(true);
                                for (const record of pdiRecords) {
                                  await companyService.updateProductionRecord(selectedCompany.id, record.id, {
                                    ...record,
                                    pdiApproved: true
                                  });
                                }
                                await refreshSelectedCompany();
                                alert(`✅ ${pdiNumber} marked as complete!`);
                              } catch (error) {
                                console.error('Failed to approve PDI:', error);
                                alert('Failed to mark as complete');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '5px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            ✅ Mark as Complete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null;
            })()}

            {dateRecords.length === 0 ? (
              <p className="no-data">No production data yet. Click "Add New Day" to start tracking!</p>
            ) : pdiFilter !== 'all' ? null : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 8px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '16px' }}>📋 Production Records ({dateRecords.length})</h3>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>
                      Total Production: <strong>{dateRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0).toLocaleString()}</strong> modules
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const pdiNumber = dateRecords[0]?.pdi;
                        const wattage = dateRecords[0]?.wattage || '625wp';
                        if (pdiNumber) {
                          setSelectedPdiForDetails(pdiNumber);
                          calculateRequiredCocs(pdiNumber, wattage);
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                      disabled={loadingRequiredCocs}
                    >
                      {loadingRequiredCocs ? '⏳ Loading...' : '🔍 Required COCs'}
                    </button>
                    {dateRecords.length > 0 && isSuperAdmin() && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Delete all ${dateRecords.length} production records for ${selectedCompany.companyName}? This action cannot be undone!`)) {
                            try {
                              setLoading(true);
                              for (const record of dateRecords) {
                                await companyService.deleteProductionRecord(selectedCompany.id, record.id);
                              }
                              await refreshSelectedCompany();
                              alert('All production records deleted successfully!');
                            } catch (error) {
                              console.error('Failed to delete records:', error);
                              alert('Failed to delete some records');
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        title="Delete all production records"
                      >
                        🗑️ Clear All Records
                      </button>
                    )}
                  </div>
                </div>

                {/* Required COCs Report Section */}
                {requiredCocsReport.length > 0 && selectedPdiForDetails && (
                  <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '2px solid #FF9800' }}>
                    <h4 style={{ marginTop: 0, color: '#FF6F00', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📊 Required COCs for {selectedPdiForDetails}
                      <button
                        onClick={() => setRequiredCocsReport([])}
                        style={{
                          marginLeft: 'auto',
                          padding: '4px 12px',
                          background: '#666',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        ✕ Close
                      </button>
                    </h4>
                    <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                      Based on <strong>{dateRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0)} modules</strong> production
                    </p>

                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      {requiredCocsReport.map((req, idx) => (
                        <div key={idx} style={{ marginBottom: '15px', padding: '12px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #dee2e6' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                              <strong style={{ fontSize: '13px', color: '#1976d2' }}>{req.materialName}</strong>
                              {req.productType && <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>({req.productType})</span>}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d32f2f' }}>
                              Need: {req.requiredQty}
                            </div>
                          </div>

                          {Object.keys(req.availableCocs).length > 0 ? (
                            <div>
                              {Object.entries(req.availableCocs).map(([company, cocs]) => {
                                const totalAvailable = cocs.reduce((sum, coc) => sum + coc.cocQty, 0);
                                const isEnough = totalAvailable >= req.requiredQty;

                                return (
                                  <div key={company} style={{ marginTop: '8px', padding: '8px', backgroundColor: isEnough ? '#e8f5e9' : '#ffebee', borderRadius: '4px', border: `1px solid ${isEnough ? '#4caf50' : '#f44336'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                      <strong style={{ fontSize: '11px', color: '#333' }}>{company}</strong>
                                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: isEnough ? '#4caf50' : '#f44336' }}>
                                        {totalAvailable} {isEnough ? '✅' : '⚠️'}
                                      </span>
                                    </div>

                                    <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                      {cocs.slice(0, 3).map((coc, cocIdx) => (
                                        <div key={cocIdx} style={{ padding: '4px', backgroundColor: 'rgba(255,255,255,0.6)', marginBottom: '3px', borderRadius: '3px', fontSize: '10px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Inv: <strong>{coc.invoiceNo}</strong></span>
                                            <span>Qty: <strong>{coc.cocQty}</strong></span>
                                          </div>
                                        </div>
                                      ))}
                                      {cocs.length > 3 && <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>+{cocs.length - 3} more</div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ padding: '8px', backgroundColor: '#ffebee', borderRadius: '4px', textAlign: 'center', color: '#d32f2f', fontSize: '11px' }}>
                              ❌ No COC in database
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BULK UPDATE EFFICIENCY BUTTONS */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '15px',
                  padding: '15px',
                  backgroundColor: '#fff3e0',
                  borderRadius: '10px',
                  border: '2px solid #ff9800',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#e65100', marginRight: '10px' }}>⚡ BULK UPDATE EFFICIENCY:</span>
                  {['25.4', '25.5', '25.6', '25.7', '25.8'].map(eff => (
                    <button
                      key={eff}
                      onClick={async () => {
                        const recordsToUpdate = (selectedCompany?.productionRecords || [])
                          .filter(r => !r.dayCellEfficiency || r.dayCellEfficiency === '');

                        if (recordsToUpdate.length === 0) {
                          alert('✅ All records already have Day Efficiency set!');
                          return;
                        }

                        if (!window.confirm(`Set Day Efficiency to ${eff}% for ${recordsToUpdate.length} records without efficiency?\n\nThis will update all records where Day Efficiency is not set.`)) {
                          return;
                        }

                        setLoading(true);
                        let successCount = 0;
                        let failCount = 0;

                        for (const record of recordsToUpdate) {
                          try {
                            await companyService.updateProductionRecord(selectedCompany.id, record.id, {
                              ...record,
                              dayCellEfficiency: eff
                            });
                            successCount++;
                          } catch (error) {
                            console.error('Failed to update record:', record.id, error);
                            failCount++;
                          }
                        }

                        await loadCompanies();
                        if (selectedCompany) {
                          const updatedCompany = companies.find(c => c.id === selectedCompany.id);
                          if (updatedCompany) setSelectedCompany(updatedCompany);
                        }

                        setLoading(false);
                        alert(`✅ Bulk Update Complete!\n\nSuccess: ${successCount}\nFailed: ${failCount}`);
                      }}
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {eff}%
                    </button>
                  ))}
                  <span style={{ fontSize: '11px', color: '#666', marginLeft: '10px' }}>
                    (Updates records without Day Efficiency set)
                  </span>
                </div>

                <div className="production-table-wrapper" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <table className="production-table" style={{ fontSize: '12px', minWidth: '1650px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '80px' }}>DATE</th>
                        <th style={{ width: '120px' }}>RUNNING ORDER</th>
                        <th style={{ width: '60px' }}>PDI</th>
                        <th style={{ width: '130px' }}>SERIAL START</th>
                        <th style={{ width: '130px' }}>SERIAL END</th>
                        <th style={{ width: '50px' }}>COUNT</th>
                        <th style={{ width: '70px' }}>DAY</th>
                        <th style={{ width: '70px' }}>NIGHT</th>
                        <th style={{ width: '60px' }}>TOTAL</th>
                        <th style={{ width: '75px', backgroundColor: '#e3f2fd' }}>DAY EFF %</th>
                        <th style={{ width: '75px', backgroundColor: '#bbdefb' }}>NIGHT EFF %</th>
                        <th style={{ width: '100px', backgroundColor: '#e8f5e9' }}>CELL SUPPLIER</th>
                        <th style={{ width: '70px', backgroundColor: '#fff3cd' }}>CELL REJ %</th>
                        <th style={{ width: '80px', backgroundColor: '#f8d7da' }}>MODULE REJ %</th>
                        <th style={{ width: '80px', backgroundColor: '#d1ecf1' }}>IPQC Sheet</th>
                        <th style={{ width: '80px', backgroundColor: '#d4edda' }}>FTR Doc</th>
                        <th style={{ width: '80px' }}>BOM/Docs</th>
                        <th style={{ width: '60px' }}>Status</th>
                        <th style={{ width: '60px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateRecords.map(record => {
                        const total = (record.dayProduction || 0) + (record.nightProduction || 0);
                        const isClosed = record.isClosed || false;
                        // Get available cell suppliers from cellEfficiencyReceived
                        const cellSuppliers = selectedCompany?.cellEfficiencyReceived 
                          ? [...new Set(Object.values(selectedCompany.cellEfficiencyReceived).flatMap(eff => Object.keys(eff)))]
                          : [];
                        return (
                          <tr key={record.id} style={{ backgroundColor: isClosed ? '#f5f5f5' : 'transparent' }}>
                            <td style={{ fontSize: '11px' }}>{record.date}</td>
                            <td>
                              <input
                                type="text"
                                value={record.runningOrder || ''}
                                onChange={(e) => handleProductionChange(record.id, 'runningOrder', e.target.value)}
                                className="table-input"
                                placeholder={selectedCompany?.currentRunningOrder || 'Order No.'}
                                disabled={isClosed}
                                style={{ width: '115px', padding: '4px', fontSize: '10px' }}
                              />
                            </td>
                            <td>
                              <div style={{
                                backgroundColor: record.pdi && record.pdi.trim() !== ''
                                  ? (record.pdiApproved ? '#d4edda' : '#fff3cd')
                                  : 'transparent',
                                padding: '4px',
                                borderRadius: '3px',
                                fontWeight: record.pdi && record.pdi.trim() !== '' ? 'bold' : 'normal',
                                color: record.pdi && record.pdi.trim() !== ''
                                  ? (record.pdiApproved ? '#155724' : '#856404')
                                  : '#333',
                                fontSize: '11px',
                                textAlign: 'center'
                              }}>
                                {record.pdi || '-'}
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={record.serialNumberStart || ''}
                                onChange={(e) => handleProductionChange(record.id, 'serialNumberStart', e.target.value)}
                                className="table-input"
                                placeholder="ABC-12345-00001"
                                disabled={isClosed}
                                style={{ width: '125px', fontSize: '10px', padding: '4px 3px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={record.serialNumberEnd || ''}
                                onChange={(e) => handleProductionChange(record.id, 'serialNumberEnd', e.target.value)}
                                className="table-input"
                                placeholder="ABC-12345-00005"
                                disabled={isClosed}
                                style={{ width: '125px', fontSize: '10px', padding: '4px 3px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={record.serialCount || 0}
                                onChange={(e) => handleProductionChange(record.id, 'serialCount', e.target.value)}
                                className="table-input"
                                disabled={isClosed}
                                style={{ width: '45px', padding: '4px', fontSize: '11px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={record.dayProduction || 0}
                                onChange={(e) => handleProductionChange(record.id, 'dayProduction', e.target.value)}
                                className="table-input"
                                disabled={isClosed}
                                style={{ width: '65px', padding: '4px', fontSize: '11px' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={record.nightProduction || 0}
                                onChange={(e) => handleProductionChange(record.id, 'nightProduction', e.target.value)}
                                className="table-input"
                                disabled={isClosed}
                                style={{ width: '65px', padding: '4px', fontSize: '11px' }}
                              />
                            </td>
                            <td className="total-cell" style={{ fontSize: '12px', fontWeight: '700' }}>{total}</td>
                            <td style={{ backgroundColor: '#e3f2fd22' }}>
                              <select
                                value={record.dayCellEfficiency || ''}
                                onChange={(e) => handleProductionChange(record.id, 'dayCellEfficiency', e.target.value)}
                                disabled={isClosed}
                                style={{
                                  width: '70px',
                                  padding: '4px 2px',
                                  fontSize: '11px',
                                  border: '2px solid #1976d2',
                                  borderRadius: '3px',
                                  backgroundColor: record.dayCellEfficiency ? '#e3f2fd' : 'white',
                                  fontWeight: record.dayCellEfficiency ? 'bold' : 'normal',
                                  color: '#1565c0'
                                }}
                              >
                                <option value="">-</option>
                                <option value="25.4">25.4%</option>
                                <option value="25.5">25.5%</option>
                                <option value="25.6">25.6%</option>
                                <option value="25.7">25.7%</option>
                                <option value="25.8">25.8%</option>
                              </select>
                            </td>
                            <td style={{ backgroundColor: '#bbdefb22' }}>
                              <select
                                value={record.nightCellEfficiency || ''}
                                onChange={(e) => handleProductionChange(record.id, 'nightCellEfficiency', e.target.value)}
                                disabled={isClosed}
                                style={{
                                  width: '70px',
                                  padding: '4px 2px',
                                  fontSize: '11px',
                                  border: '2px solid #0d47a1',
                                  borderRadius: '3px',
                                  backgroundColor: record.nightCellEfficiency ? '#bbdefb' : 'white',
                                  fontWeight: record.nightCellEfficiency ? 'bold' : 'normal',
                                  color: '#0d47a1'
                                }}
                              >
                                <option value="">-</option>
                                <option value="25.4">25.4%</option>
                                <option value="25.5">25.5%</option>
                                <option value="25.6">25.6%</option>
                                <option value="25.7">25.7%</option>
                                <option value="25.8">25.8%</option>
                              </select>
                            </td>
                            <td style={{ backgroundColor: '#e8f5e922' }}>
                              <select
                                value={record.cellSupplier || record.cell_supplier || ''}
                                onChange={(e) => handleProductionChange(record.id, 'cellSupplier', e.target.value)}
                                disabled={isClosed}
                                style={{
                                  width: '95px',
                                  padding: '4px 2px',
                                  fontSize: '10px',
                                  border: '2px solid #388e3c',
                                  borderRadius: '3px',
                                  backgroundColor: (record.cellSupplier || record.cell_supplier) ? '#e8f5e9' : 'white',
                                  fontWeight: (record.cellSupplier || record.cell_supplier) ? 'bold' : 'normal',
                                  color: '#2e7d32'
                                }}
                              >
                                <option value="">Select...</option>
                                {cellSuppliers.map(supplier => (
                                  <option key={supplier} value={supplier}>{supplier}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ backgroundColor: '#fff3cd22' }}>
                              <input
                                type="number"
                                step="0.1"
                                value={record.cellRejectionPercent || 0}
                                onChange={(e) => handleProductionChange(record.id, 'cellRejectionPercent', e.target.value)}
                                className="table-input"
                                disabled={isClosed}
                                style={{ width: '60px', padding: '4px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ backgroundColor: '#f8d7da22' }}>
                              <input
                                type="number"
                                step="0.1"
                                value={record.moduleRejectionPercent || 0}
                                onChange={(e) => handleProductionChange(record.id, 'moduleRejectionPercent', e.target.value)}
                                className="table-input"
                                disabled={isClosed}
                                style={{ width: '70px', padding: '4px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ backgroundColor: '#d1ecf122', textAlign: 'center' }}>
                              {(() => {
                                // Show separate buttons for day and night IPQC
                                const hasDayIpqc = record.dayIpqcPdf;
                                const hasNightIpqc = record.nightIpqcPdf;
                                const hasSerialData = record.serialNumberStart && record.serialNumberEnd && record.serialCount > 0;

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                    {/* Day Shift IPQC */}
                                    {hasDayIpqc ? (
                                      <button
                                        onClick={() => {
                                          const path = record.dayIpqcPdf.startsWith('/') ? record.dayIpqcPdf : `/${record.dayIpqcPdf}`;
                                          const url = record.dayIpqcPdf.startsWith('http')
                                            ? record.dayIpqcPdf
                                            : `${getAPIBaseURL()}${path}`;
                                          window.open(url, '_blank', 'noopener,noreferrer');
                                        }}
                                        style={{
                                          color: '#FF9800',
                                          backgroundColor: '#FFF3E0',
                                          border: '1px solid #FF9800',
                                          borderRadius: '3px',
                                          fontSize: '10px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          padding: '3px 8px',
                                          width: '100%'
                                        }}
                                      >
                                        🌞 Day
                                      </button>
                                    ) : hasSerialData ? (
                                      <button
                                        onClick={async () => {
                                          try {
                                            setLoading(true);
                                            await autoGenerateIPQCPDF(record, 'day');
                                            await refreshSelectedCompany();
                                            setLoading(false);
                                          } catch (error) {
                                            console.error('IPQC generation error:', error);
                                            setLoading(false);
                                            alert('❌ Failed to generate IPQC');
                                          }
                                        }}
                                        style={{
                                          color: '#FF9800',
                                          backgroundColor: 'transparent',
                                          border: '1px dashed #FF9800',
                                          borderRadius: '3px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                          padding: '3px 8px',
                                          width: '100%'
                                        }}
                                      >
                                        🌞 Gen
                                      </button>
                                    ) : null}

                                    {/* Night Shift IPQC */}
                                    {hasNightIpqc ? (
                                      <button
                                        onClick={() => {
                                          const path = record.nightIpqcPdf.startsWith('/') ? record.nightIpqcPdf : `/${record.nightIpqcPdf}`;
                                          const url = record.nightIpqcPdf.startsWith('http')
                                            ? record.nightIpqcPdf
                                            : `${getAPIBaseURL()}${path}`;
                                          window.open(url, '_blank', 'noopener,noreferrer');
                                        }}
                                        style={{
                                          color: '#2196F3',
                                          backgroundColor: '#E3F2FD',
                                          border: '1px solid #2196F3',
                                          borderRadius: '3px',
                                          fontSize: '10px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          padding: '3px 8px',
                                          width: '100%'
                                        }}
                                      >
                                        🌙 Night
                                      </button>
                                    ) : hasSerialData ? (
                                      <button
                                        onClick={async () => {
                                          try {
                                            setLoading(true);
                                            await autoGenerateIPQCPDF(record, 'night');
                                            await refreshSelectedCompany();
                                            setLoading(false);
                                          } catch (error) {
                                            console.error('IPQC generation error:', error);
                                            setLoading(false);
                                            alert('❌ Failed to generate IPQC');
                                          }
                                        }}
                                        style={{
                                          color: '#2196F3',
                                          backgroundColor: 'transparent',
                                          border: '1px dashed #2196F3',
                                          borderRadius: '3px',
                                          fontSize: '10px',
                                          cursor: 'pointer',
                                          padding: '3px 8px',
                                          width: '100%'
                                        }}
                                      >
                                        🌙 Gen
                                      </button>
                                    ) : null}

                                    {!hasDayIpqc && !hasNightIpqc && !hasSerialData && (
                                      <span style={{ fontSize: '10px', color: '#999' }}>-</span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ backgroundColor: '#d4edda22', textAlign: 'center' }}>
                              {(() => {
                                // Show FTR View button if uploaded document exists OR if serial numbers are valid
                                const hasUploadedDoc = record.ftrDocument;
                                const hasSerialData = record.serialNumberStart && record.serialNumberEnd && record.serialCount > 0;

                                if (hasUploadedDoc) {
                                  return (
                                    <button
                                      onClick={() => {
                                        const path = record.ftrDocument.startsWith('/') ? record.ftrDocument : `/${record.ftrDocument}`;
                                        const url = record.ftrDocument.startsWith('http')
                                          ? record.ftrDocument
                                          : `${getAPIBaseURL()}${path}`;
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                      style={{
                                        color: '#28a745',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        textDecoration: 'underline',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '3px',
                                        margin: '0 auto'
                                      }}
                                    >
                                      📋 View
                                    </button>
                                  );
                                } else if (hasSerialData) {
                                  return (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const API_BASE_URL = getAPIBaseURL();
                                          const ordersResponse = await axios.get(`${API_BASE_URL}/api/master/orders`);
                                          const companyOrders = ordersResponse.data.orders.filter(
                                            order => order.company_name === selectedCompany.companyName
                                          );

                                          if (companyOrders.length === 0) {
                                            alert('❌ No master data found for this company');
                                            return;
                                          }

                                          const latestOrder = companyOrders.sort((a, b) => b.id - a.id)[0];

                                          // Download FTR from master data
                                          const response = await axios.post(`${API_BASE_URL}/api/master/download-ftr-by-serials`, {
                                            order_id: latestOrder.id,
                                            serial_range: {
                                              start: record.serialNumberStart,
                                              end: record.serialNumberEnd
                                            }
                                          }, {
                                            responseType: 'blob'
                                          });

                                          // Download file
                                          const url = window.URL.createObjectURL(new Blob([response.data]));
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.setAttribute('download', `FTR_${record.serialNumberStart}_to_${record.serialNumberEnd}.xlsx`);
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                          window.URL.revokeObjectURL(url);
                                        } catch (error) {
                                          console.error('FTR download error:', error);
                                          alert('❌ Failed to download FTR: ' + (error.response?.data?.error || error.message));
                                        }
                                      }}
                                      style={{
                                        color: '#007bff',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        textDecoration: 'underline',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '3px',
                                        margin: '0 auto'
                                      }}
                                      title={`FTR from Master Data (${record.serialCount} modules)`}
                                    >
                                      📥 View
                                    </button>
                                  );
                                } else {
                                  return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
                                }
                              })()}
                            </td>
                            <td>
                              {(() => {
                                const bomCount = record.bomMaterials?.length || 0;
                                // Manual uploads only (from BOM modal)
                                const hasManualIpqc = record.ipqcPdf ? 1 : 0;
                                const hasManualFtr = record.ftrDocument ? 1 : 0;
                                const totalManualDocs = bomCount + hasManualIpqc + hasManualFtr;

                                return (
                                  <button
                                    className="btn-upload-bom"
                                    onClick={() => handleOpenBomModal(record)}
                                    disabled={isClosed}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '10px',
                                      backgroundColor: isClosed ? '#ccc' : (totalManualDocs > 0 ? '#4CAF50' : '#2196F3'),
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: isClosed ? 'not-allowed' : 'pointer',
                                      width: '75px',
                                      margin: '0 auto',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '3px'
                                    }}
                                    title={`Manual uploads - BOM: ${bomCount} | IPQC: ${hasManualIpqc ? 'Yes' : 'No'} | FTR: ${hasManualFtr ? 'Yes' : 'No'}`}
                                  >
                                    {totalManualDocs > 0 ? '📋 View' : '📋 Upload'}
                                    {totalManualDocs > 0 && (
                                      <span style={{
                                        background: 'rgba(255,255,255,0.3)',
                                        padding: '1px 4px',
                                        borderRadius: '8px',
                                        fontSize: '9px',
                                        fontWeight: 'bold'
                                      }}>
                                        {totalManualDocs}
                                      </span>
                                    )}
                                  </button>
                                );
                              })()}
                            </td>
                            <td>
                              {isClosed ? (
                                <span style={{ color: '#f44336', fontWeight: 'bold', fontSize: '9px' }}>🔒 Closed</span>
                              ) : (
                                <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '9px' }}>✓ Open</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleSaveRecord(record)}
                                  disabled={isClosed || loading}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    backgroundColor: isClosed ? '#ccc' : '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isClosed || loading ? 'not-allowed' : 'pointer',
                                    opacity: isClosed || loading ? 0.5 : 1
                                  }}
                                  title="Save record and link FTR"
                                >
                                  ✔ Done
                                </button>
                                {isSuperAdmin() && (
                                  <button
                                    className="btn-delete-row"
                                    onClick={() => handleDeleteProductionRecord(record.id)}
                                    title="Delete this record"
                                    disabled={isClosed}
                                    style={{ fontSize: '14px', padding: '2px 6px' }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========== CELL INVENTORY TAB CONTENT ========== */}
        {productionTab === 'cellInventory' && (
          <div style={{
            padding: '30px',
            backgroundColor: '#fff',
            borderRadius: '0 0 12px 12px',
            border: '2px solid #FF5722',
            borderTop: 'none'
          }}>
            {(() => {
              const efficiencyGrades = ['25.4', '25.5', '25.6', '25.7', '25.8'];
              const cellEfficiencyReceived = selectedCompany?.cellEfficiencyReceived || {};
              const records = selectedCompany?.productionRecords || [];
              const cellsPerModule = 66;

              // Helper to normalize efficiency
              const normalizeEfficiency = (eff) => {
                if (!eff) return null;
                const num = parseFloat(eff);
                return isNaN(num) ? null : num.toFixed(1);
              };

              // 1. Calculate SIMPLE averages (only non-zero values) and OK Modules
              let okModules = 0;
              let modRejSum = 0;
              let modRejCount = 0;
              let cellRejSum = 0;
              let cellRejCount = 0;

              records.forEach(r => {
                const prod = (r.dayProduction || 0) + (r.nightProduction || 0);
                okModules += prod;
                
                // Simple average: count only non-zero rejection entries
                const modRej = parseFloat(r.moduleRejectionPercent) || 0;
                const cellRej = parseFloat(r.cellRejectionPercent) || 0;
                
                if (modRej > 0) {
                  modRejSum += modRej;
                  modRejCount++;
                }
                if (cellRej > 0) {
                  cellRejSum += cellRej;
                  cellRejCount++;
                }
              });

              // Simple average of non-zero rejection values
              const avgModRejPct = modRejCount > 0 ? (modRejSum / modRejCount) : 0;
              const avgCellRejPct = cellRejCount > 0 ? (cellRejSum / cellRejCount) : 0;
              const rGradePct = 0.7; // Fixed scrap rate as requested

              const okCellsUsed = okModules * cellsPerModule;
              const bGradeModules = Math.round(okModules * (avgModRejPct / 100));
              const bGradeCellsUsed = bGradeModules * cellsPerModule;
              const rGradeModules = Math.round(okModules * (rGradePct / 100));
              const rGradeCellsUsed = rGradeModules * cellsPerModule;

              const totalProcessedCells = okCellsUsed + bGradeCellsUsed + rGradeCellsUsed;
              const cellRejectionQty = Math.round(totalProcessedCells * (avgCellRejPct / 100));
              const grandTotalUsed = totalProcessedCells + cellRejectionQty;

              // Calculate SUPPLIER-WISE cell usage from production records
              // Using logic: OK Cells + B-grade Cells + R-grade Cells + Cell Rejection
              const supplierWiseUsage = {};
              records.forEach(r => {
                // Check both camelCase and snake_case (database returns snake_case)
                const supplier = r.cellSupplier || r.cell_supplier || '';
                if (supplier) {
                  const totalProd = (r.dayProduction || 0) + (r.nightProduction || 0);
                  const okCells = totalProd * cellsPerModule; // OK (A-grade) cells
                  
                  // B-grade = module rejection % of OK modules
                  const modRejPct = parseFloat(r.moduleRejectionPercent) || avgModRejPct;
                  const bGradeModules = Math.round(totalProd * (modRejPct / 100));
                  const bGradeCells = bGradeModules * cellsPerModule;
                  
                  // R-grade = 0.7% fixed scrap rate
                  const rGradeModules = Math.round(totalProd * (rGradePct / 100));
                  const rGradeCells = rGradeModules * cellsPerModule;
                  
                  // Total processed cells (OK + B + R)
                  const totalProcessed = okCells + bGradeCells + rGradeCells;
                  
                  // Cell rejection on total processed
                  const cellRejPct = parseFloat(r.cellRejectionPercent) || avgCellRejPct;
                  const cellRejection = Math.round(totalProcessed * (cellRejPct / 100));
                  
                  // TOTAL cells used = processed + rejection
                  const totalCellsUsed = totalProcessed + cellRejection;
                  
                  if (!supplierWiseUsage[supplier]) {
                    supplierWiseUsage[supplier] = 0;
                  }
                  supplierWiseUsage[supplier] += totalCellsUsed;
                }
              });
              
              // For records without cellSupplier, distribute to default (first available supplier)
              // eslint-disable-next-line no-unused-vars
              const unassignedCells = grandTotalUsed - Object.values(supplierWiseUsage).reduce((a, b) => a + b, 0);

              // 2. Efficiency Wise Used Calculation
              // Simple logic: OK modules × 66 cells per efficiency grade
              const usedByEfficiency = {};
              efficiencyGrades.forEach(eff => { usedByEfficiency[eff] = 0; });

              records.forEach(r => {
                const dayEff = normalizeEfficiency(r.dayCellEfficiency);
                const nightEff = normalizeEfficiency(r.nightCellEfficiency);
                const dayProd = r.dayProduction || 0;
                const nightProd = r.nightProduction || 0;
                const totalProd = dayProd + nightProd;

                // Simple calculation: modules × 66 cells
                if (dayEff && nightEff) {
                  // Both shifts have different efficiency - split by production
                  if (usedByEfficiency.hasOwnProperty(dayEff)) usedByEfficiency[dayEff] += dayProd * cellsPerModule;
                  if (usedByEfficiency.hasOwnProperty(nightEff)) usedByEfficiency[nightEff] += nightProd * cellsPerModule;
                } else if (dayEff) {
                  // Only day efficiency set - count total production
                  if (usedByEfficiency.hasOwnProperty(dayEff)) usedByEfficiency[dayEff] += totalProd * cellsPerModule;
                } else if (nightEff) {
                  // Only night efficiency set - count total production
                  if (usedByEfficiency.hasOwnProperty(nightEff)) usedByEfficiency[nightEff] += totalProd * cellsPerModule;
                }
              });

              let grandTotalReceived = 0;
              efficiencyGrades.forEach(eff => {
                const effData = cellEfficiencyReceived[eff] || {};
                const totalForEff = typeof effData === 'object'
                  ? Object.values(effData).reduce((sum, qty) => sum + (qty || 0), 0)
                  : (effData || 0);
                grandTotalReceived += totalForEff;
              });

              const grandRemaining = grandTotalReceived - grandTotalUsed;
              const estimatedModules = Math.floor((grandRemaining / cellsPerModule) * (1 - (avgModRejPct + rGradePct) / 100));

              return (
                <div>
                  {/* Header with Add Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2 style={{ margin: 0, color: '#FF5722', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '32px' }}>⚡</span>
                      Cell Efficiency Inventory
                    </h2>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      {/* DETAILED EXCEL EXPORT BUTTON */}
                      <button
                        onClick={() => {
                          const XLSXStyle = require('xlsx-js-style');
                          const wb = XLSXStyle.utils.book_new();
                          const records = selectedCompany?.productionRecords || [];

                          // Recalculate all values fresh
                          const effGrades = ['25.4', '25.5', '25.6', '25.7', '25.8'];
                          const cellEffReceived = selectedCompany?.cellEfficiencyReceived || {};
                          const usedByEff = {};
                          effGrades.forEach(eff => { usedByEff[eff] = 0; });

                          // eslint-disable-next-line no-unused-vars
                          let totalRejPct = 0;
                          // eslint-disable-next-line no-unused-vars
                          let recsWithRej = 0;

                          // Helper to normalize efficiency
                          const normEff = (e) => e ? parseFloat(e).toFixed(1) : null;

                          // Calculate used cells - SMART LOGIC
                          // If only one efficiency is set, use TOTAL production for that efficiency
                          records.forEach(record => {
                            const dayEff = normEff(record.dayCellEfficiency);
                            const nightEff = normEff(record.nightCellEfficiency);
                            const dayProd = record.dayProduction || 0;
                            const nightProd = record.nightProduction || 0;
                            const totalProd = dayProd + nightProd;

                            // Case 1: Both Day and Night efficiency set - count separately
                            if (dayEff && nightEff) {
                              if (usedByEff.hasOwnProperty(dayEff)) {
                                usedByEff[dayEff] += dayProd * 66;
                              }
                              if (usedByEff.hasOwnProperty(nightEff)) {
                                usedByEff[nightEff] += nightProd * 66;
                              }
                            }
                            // Case 2: Only Day efficiency set - count TOTAL production
                            else if (dayEff && !nightEff) {
                              if (usedByEff.hasOwnProperty(dayEff)) {
                                usedByEff[dayEff] += totalProd * 66;
                              }
                            }
                            // Case 3: Only Night efficiency set - count TOTAL production
                            else if (!dayEff && nightEff) {
                              if (usedByEff.hasOwnProperty(nightEff)) {
                                usedByEff[nightEff] += totalProd * 66;
                              }
                            }

                            if (record.cellRejectionPercent > 0) {
                              totalRejPct += record.cellRejectionPercent;
                              recsWithRej++;
                            }
                          });

                          // avgRejPct calculation removed (unused)

                          // ======== STYLES ========
                          const titleStyle = {
                            font: { bold: true, sz: 22, color: { rgb: 'FFFFFF' } },
                            fill: { fgColor: { rgb: 'D84315' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { bottom: { style: 'thick', color: { rgb: 'BF360C' } } }
                          };
                          const headerStyle = {
                            font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
                            fill: { fgColor: { rgb: '1565C0' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          const subHeaderStyle = {
                            font: { bold: true, sz: 11, color: { rgb: '000000' } },
                            fill: { fgColor: { rgb: 'BBDEFB' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          // eslint-disable-next-line no-unused-vars
                          const dataStyle = {
                            font: { sz: 11 },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } }
                          };
                          const greenStyle = {
                            font: { bold: true, sz: 12, color: { rgb: '1B5E20' } },
                            fill: { fgColor: { rgb: 'C8E6C9' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          const redStyle = {
                            font: { bold: true, sz: 12, color: { rgb: 'C62828' } },
                            fill: { fgColor: { rgb: 'FFCDD2' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          const blueStyle = {
                            font: { bold: true, sz: 12, color: { rgb: '0D47A1' } },
                            fill: { fgColor: { rgb: 'E3F2FD' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          const orangeStyle = {
                            font: { bold: true, sz: 12, color: { rgb: 'E65100' } },
                            fill: { fgColor: { rgb: 'FFE0B2' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          const purpleStyle = {
                            font: { bold: true, sz: 12, color: { rgb: '4A148C' } },
                            fill: { fgColor: { rgb: 'E1BEE7' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                          };
                          const totalRowStyle = {
                            font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
                            fill: { fgColor: { rgb: '2E7D32' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thick' }, bottom: { style: 'thick' }, left: { style: 'thick' }, right: { style: 'thick' } }
                          };
                          const altRowStyle1 = {
                            font: { sz: 11 },
                            fill: { fgColor: { rgb: 'FFFFFF' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } }
                          };
                          const altRowStyle2 = {
                            font: { sz: 11 },
                            fill: { fgColor: { rgb: 'F5F5F5' } },
                            alignment: { horizontal: 'center', vertical: 'center' },
                            border: { top: { style: 'thin', color: { rgb: 'E0E0E0' } }, bottom: { style: 'thin', color: { rgb: 'E0E0E0' } }, left: { style: 'thin', color: { rgb: 'E0E0E0' } }, right: { style: 'thin', color: { rgb: 'E0E0E0' } } }
                          };

                          // ======== CALCULATIONS FOR DETAILED INVENTORY ========

                          // 1. Total Received (Cell Efficiency Received)
                          const grandTotalReceived = Object.values(cellEfficiencyReceived)
                            .flatMap(eff => Object.values(eff))
                            .reduce((a, b) => a + (b || 0), 0);

                          // 2. OK (A-grade) Modules
                          const okModules = records.reduce((s, r) => s + (r.dayProduction || 0) + (r.nightProduction || 0), 0);

                          // 3. OK (A-grade) Cells Used
                          const okCellsUsed = okModules * 66;

                          // 4. B-grade Calculation
                          // Calculate weighted average of module rejection %
                          let weightedModRejSum = 0;
                          let totalProdForWeight = 0;
                          records.forEach(r => {
                            const prod = (r.dayProduction || 0) + (r.nightProduction || 0);
                            if (prod > 0) {
                              weightedModRejSum += prod * (r.moduleRejectionPercent || 0);
                              totalProdForWeight += prod;
                            }
                          });
                          const avgModRejPct = totalProdForWeight > 0 ? (weightedModRejSum / totalProdForWeight) : 0;

                          const bGradeModules = Math.round(okModules * (avgModRejPct / 100)); // Derived from OK modules
                          const bGradeCellsUsed = bGradeModules * 66;

                          // 5. R-grade Calculation (Scrap) - Fixed 0.7% as per requirement
                          const rGradePct = 0.7; // Fixed scrap rate
                          const rGradeModules = Math.round(okModules * (rGradePct / 100));
                          const rGradeCellsUsed = rGradeModules * 66;

                          // 6. Total Processed Cells (OK + B + R)
                          const totalProcessedCells = okCellsUsed + bGradeCellsUsed + rGradeCellsUsed;

                          // 7. Cell Rejection
                          // Calculate weighted average of cell rejection %
                          let weightedCellRejSum = 0;
                          records.forEach(r => {
                            const prod = (r.dayProduction || 0) + (r.nightProduction || 0);
                            if (prod > 0) {
                              weightedCellRejSum += prod * (r.cellRejectionPercent || 0);
                            }
                          });
                          const avgCellRejPct = totalProdForWeight > 0 ? (weightedCellRejSum / totalProdForWeight) : 0;

                          const cellRejectionQty = Math.round(totalProcessedCells * (avgCellRejPct / 100)); // % of processed cells

                          // 8. TOTAL Cells Used
                          const grandTotalUsed = totalProcessedCells + cellRejectionQty;

                          // 9. Cells Remaining
                          const grandRemaining = grandTotalReceived - grandTotalUsed;

                          // 10. Est. Modules (Yield)
                          // Net usable modules from remaining cells (considering future B & R loss)
                          const totalLossPct = (avgModRejPct + rGradePct) / 100;
                          const estimatedModules = Math.floor((grandRemaining / 66) * (1 - totalLossPct));

                          // ======== SHEET 1: GRAND SUMMARY (DETAILED) ========
                          const summaryData = [];
                          summaryData.push(['📊 CELL EFFICIENCY INVENTORY - DETAILED REPORT']);
                          summaryData.push([`Company: ${selectedCompany?.companyName || 'N/A'}`]);
                          summaryData.push([`Report Generated: ${new Date().toLocaleString()}`]);
                          summaryData.push([]);

                          // ===== QUICK SUMMARY BOX =====
                          summaryData.push(['═══════════════════ QUICK SUMMARY ═══════════════════']);
                          summaryData.push(['TOTAL RECEIVED', grandTotalReceived, 'TOTAL USED', grandTotalUsed, 'REMAINING', grandRemaining]);
                          summaryData.push(['AVG REJECTION %', `${avgCellRejPct.toFixed(2)}%`, 'AFTER REJECTION', Math.floor(grandRemaining * (1 - avgCellRejPct / 100)), 'EST. MODULES', estimatedModules]);
                          summaryData.push([]);

                          // ===== DETAILED BREAKDOWN =====
                          summaryData.push(['═══════════════════ DETAILED INVENTORY BREAKDOWN ═══════════════════']);
                          summaryData.push([]);
                          summaryData.push(['ITEM', 'VALUE', 'UNIT/NOTES', 'MODULES']);
                          summaryData.push(['1. Total Cells Received', grandTotalReceived, 'cells', '-']);
                          summaryData.push(['2. Cells per Module', 66, 'cells/module', '-']);
                          summaryData.push([]);
                          summaryData.push(['--- OK (A-GRADE) PRODUCTION ---', '', '', '']);
                          summaryData.push(['3. OK (A-grade) Modules', okModules, 'modules', okModules]);
                          summaryData.push(['4. OK (A-grade) Cells Used', okCellsUsed, 'cells', okModules]);
                          summaryData.push([]);
                          summaryData.push(['--- B-GRADE (MODULE REJECTION) ---', '', '', '']);
                          summaryData.push(['5. B-grade % (of OK)', `${avgModRejPct.toFixed(2)}%`, 'module rejection rate', '-']);
                          summaryData.push(['6. B-grade Modules', bGradeModules, 'modules', bGradeModules]);
                          summaryData.push(['7. B-grade Cells Used', bGradeCellsUsed, 'cells', bGradeModules]);
                          summaryData.push([]);
                          summaryData.push(['--- R-GRADE (SCRAP) ---', '', '', '']);
                          summaryData.push(['8. R-grade % (of OK)', `${rGradePct}%`, 'fixed scrap rate', '-']);
                          summaryData.push(['9. R-grade Modules', rGradeModules, 'modules', rGradeModules]);
                          summaryData.push(['10. R-grade Cells Used', rGradeCellsUsed, 'cells', rGradeModules]);
                          summaryData.push([]);
                          summaryData.push(['--- TOTAL PROCESSED ---', '', '', '']);
                          summaryData.push(['11. Total Processed Cells (OK+B+R)', totalProcessedCells, 'cells', okModules + bGradeModules + rGradeModules]);
                          summaryData.push([]);
                          summaryData.push(['--- CELL REJECTION ---', '', '', '']);
                          summaryData.push(['12. Cell Rejection %', `${avgCellRejPct.toFixed(2)}%`, '% of processed cells', '-']);
                          summaryData.push(['13. Cell Rejection Qty', cellRejectionQty, 'cells', '-']);
                          summaryData.push([]);
                          summaryData.push(['═══════════════════ FINAL SUMMARY ═══════════════════']);
                          summaryData.push(['14. TOTAL CELLS USED', grandTotalUsed, 'cells (processed + rejected)', '-']);
                          summaryData.push(['15. CELLS REMAINING', grandRemaining, 'cells', '-']);
                          summaryData.push(['16. AFTER REJECTION (Usable)', Math.floor(grandRemaining * (1 - avgCellRejPct / 100)), 'usable cells', '-']);
                          summaryData.push(['17. EST. MODULES (Yield)', estimatedModules, 'net A-grade modules', estimatedModules]);

                          // Keep existing efficiency wise summary below if needed, or remove it. 
                          // For now, I will keep key metrics simplified as the table above is comprehensive.


                          const ws1 = XLSXStyle.utils.aoa_to_sheet(summaryData);

                          // Apply styles to Sheet 1
                          if (ws1['A1']) ws1['A1'].s = titleStyle;
                          // Style Quick Summary header
                          if (ws1['A5']) ws1['A5'].s = headerStyle;
                          // Style Quick Summary values
                          ['A6', 'B6', 'C6', 'D6', 'E6', 'F6'].forEach(cell => { if (ws1[cell]) ws1[cell].s = blueStyle; });
                          ['A7', 'B7', 'C7', 'D7', 'E7', 'F7'].forEach(cell => { if (ws1[cell]) ws1[cell].s = greenStyle; });
                          // Style Detailed Breakdown header
                          if (ws1['A9']) ws1['A9'].s = headerStyle;
                          // Style column headers
                          ['A11', 'B11', 'C11', 'D11'].forEach(cell => { if (ws1[cell]) ws1[cell].s = subHeaderStyle; });
                          // Style section headers
                          ['A15', 'A20', 'A25', 'A30', 'A33', 'A37'].forEach(cell => { if (ws1[cell]) ws1[cell].s = orangeStyle; });
                          // Style Final Summary header and values
                          if (ws1['A37']) ws1['A37'].s = headerStyle;
                          ['A38', 'B38', 'C38', 'D38'].forEach(cell => { if (ws1[cell]) ws1[cell].s = redStyle; });
                          ['A39', 'B39', 'C39', 'D39'].forEach(cell => { if (ws1[cell]) ws1[cell].s = grandRemaining >= 0 ? greenStyle : redStyle; });
                          ['A40', 'B40', 'C40', 'D40'].forEach(cell => { if (ws1[cell]) ws1[cell].s = purpleStyle; });
                          ['A41', 'B41', 'C41', 'D41'].forEach(cell => { if (ws1[cell]) ws1[cell].s = totalRowStyle; });
                          
                          ws1['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 25 }, { wch: 14 }];
                          ws1['!rows'] = [{ hpt: 35 }];
                          XLSXStyle.utils.book_append_sheet(wb, ws1, 'Grand Summary');

                          // ======== SHEET 2: SUPPLIER WISE INVENTORY ========
                          const supplierData = [];
                          supplierData.push(['🏭 SUPPLIER WISE CELL INVENTORY']);
                          supplierData.push([`Company: ${selectedCompany?.companyName || 'N/A'}`]);
                          supplierData.push([]);
                          supplierData.push(['EFFICIENCY', 'SUPPLIER', 'QTY RECEIVED', 'EST. MODULES', '% OF TOTAL']);

                          effGrades.forEach(eff => {
                            const effData = cellEffReceived[eff] || {};
                            if (typeof effData === 'object' && Object.keys(effData).length > 0) {
                              const totalForEff = Object.values(effData).reduce((sum, qty) => sum + (qty || 0), 0);
                              Object.entries(effData).forEach(([company, qty]) => {
                                const percent = totalForEff > 0 ? ((qty / totalForEff) * 100).toFixed(1) + '%' : '0%';
                                supplierData.push([`${eff}%`, company, qty || 0, Math.floor((qty || 0) / 66), percent]);
                              });
                            } else {
                              supplierData.push([`${eff}%`, 'No Data', 0, 0, '0%']);
                            }
                          });

                          const ws2 = XLSXStyle.utils.aoa_to_sheet(supplierData);
                          if (ws2['A1']) ws2['A1'].s = titleStyle;
                          ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
                          ['A4', 'B4', 'C4', 'D4', 'E4'].forEach(cell => { if (ws2[cell]) ws2[cell].s = headerStyle; });
                          ws2['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
                          XLSXStyle.utils.book_append_sheet(wb, ws2, 'Supplier Inventory');

                          // ======== SHEET 3: BRAND WISE SUMMARY ========
                          const brandData = [];
                          brandData.push(['🏭 BRAND / SUPPLIER WISE CELL INVENTORY']);
                          brandData.push([`Company: ${selectedCompany?.companyName || 'N/A'}`]);
                          brandData.push([]);
                          
                          // Calculate brand totals with USED
                          const brandTotalsExcel = {};
                          effGrades.forEach(eff => {
                            const effData = cellEffReceived[eff] || {};
                            if (typeof effData === 'object') {
                              Object.entries(effData).forEach(([brand, qty]) => {
                                if (!brandTotalsExcel[brand]) {
                                  brandTotalsExcel[brand] = { received: 0, efficiencies: {}, used: 0 };
                                }
                                brandTotalsExcel[brand].received += (qty || 0);
                                brandTotalsExcel[brand].efficiencies[eff] = (qty || 0);
                              });
                            }
                          });

                          // Use supplier-wise usage from production records (based on cellSupplier field)
                          // Calculate supplierWiseUsage for Excel export using same logic as display
                          const supplierWiseUsageExcel = {};
                          const recordsForExcel = selectedCompany?.productionRecords || [];
                          const rGradePctExcel = 0.7; // Fixed scrap rate
                          // eslint-disable-next-line no-unused-vars
                          let totalUsedFromRecords = 0;
                          recordsForExcel.forEach(r => {
                            // Check both camelCase and snake_case
                            const supplier = r.cellSupplier || r.cell_supplier || '';
                            if (supplier) {
                              const totalProd = (r.dayProduction || 0) + (r.nightProduction || 0);
                              const okCells = totalProd * 66;
                              
                              // B-grade cells
                              const modRejPct = parseFloat(r.moduleRejectionPercent) || 0;
                              const bGradeModules = Math.round(totalProd * (modRejPct / 100));
                              const bGradeCells = bGradeModules * 66;
                              
                              // R-grade cells (0.7% fixed)
                              const rGradeModules = Math.round(totalProd * (rGradePctExcel / 100));
                              const rGradeCells = rGradeModules * 66;
                              
                              // Total processed
                              const totalProcessed = okCells + bGradeCells + rGradeCells;
                              
                              // Cell rejection
                              const cellRejPct = parseFloat(r.cellRejectionPercent) || 0;
                              const cellRejection = Math.round(totalProcessed * (cellRejPct / 100));
                              
                              // Total used
                              const totalCellsUsed = totalProcessed + cellRejection;
                              
                              if (!supplierWiseUsageExcel[supplier]) {
                                supplierWiseUsageExcel[supplier] = 0;
                              }
                              supplierWiseUsageExcel[supplier] += totalCellsUsed;
                              totalUsedFromRecords += totalCellsUsed;
                            }
                          });
                          // unassignedCellsExcel calculation removed (unused)
                          
                          Object.keys(brandTotalsExcel).forEach(brand => {
                            const matchedSupplier = Object.keys(supplierWiseUsageExcel).find(
                              s => s.toUpperCase() === brand.toUpperCase()
                            );
                            if (matchedSupplier) {
                              brandTotalsExcel[brand].used = supplierWiseUsageExcel[matchedSupplier];
                            } else {
                              brandTotalsExcel[brand].used = 0;
                            }
                          });
                          
                          // Note: Unassigned cells (records without cellSupplier) are NOT distributed to any supplier

                          brandData.push(['BRAND/SUPPLIER', 'RECEIVED', 'USED', 'REMAINING', 'CAN PRODUCE', '% OF TOTAL', '25.4%', '25.5%', '25.6%', '25.7%', '25.8%']);
                          
                          let totalBrandUsed = 0;
                          let totalBrandRemaining = 0;
                          let totalCanProduce = 0;

                          Object.entries(brandTotalsExcel).forEach(([brand, data]) => {
                            const brandPercent = grandTotalReceived > 0 ? ((data.received / grandTotalReceived) * 100).toFixed(1) + '%' : '0%';
                            const brandRemaining = data.received - data.used;
                            const canProduce = Math.floor(brandRemaining / 66);
                            
                            totalBrandUsed += data.used;
                            totalBrandRemaining += brandRemaining;
                            totalCanProduce += canProduce;

                            brandData.push([
                              brand,
                              data.received,
                              data.used,
                              brandRemaining,
                              canProduce,
                              brandPercent,
                              data.efficiencies['25.4'] || 0,
                              data.efficiencies['25.5'] || 0,
                              data.efficiencies['25.6'] || 0,
                              data.efficiencies['25.7'] || 0,
                              data.efficiencies['25.8'] || 0
                            ]);
                          });

                          // Add total row
                          brandData.push([]);
                          brandData.push([
                            'TOTAL',
                            grandTotalReceived,
                            totalBrandUsed,
                            totalBrandRemaining,
                            totalCanProduce,
                            '100%',
                            Object.values(brandTotalsExcel).reduce((s, d) => s + (d.efficiencies['25.4'] || 0), 0),
                            Object.values(brandTotalsExcel).reduce((s, d) => s + (d.efficiencies['25.5'] || 0), 0),
                            Object.values(brandTotalsExcel).reduce((s, d) => s + (d.efficiencies['25.6'] || 0), 0),
                            Object.values(brandTotalsExcel).reduce((s, d) => s + (d.efficiencies['25.7'] || 0), 0),
                            Object.values(brandTotalsExcel).reduce((s, d) => s + (d.efficiencies['25.8'] || 0), 0)
                          ]);

                          const wsBrand = XLSXStyle.utils.aoa_to_sheet(brandData);
                          if (wsBrand['A1']) wsBrand['A1'].s = purpleStyle;
                          wsBrand['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
                          ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4'].forEach(cell => { if (wsBrand[cell]) wsBrand[cell].s = headerStyle; });
                          // Style brand rows
                          Object.keys(brandTotalsExcel).forEach((_, idx) => {
                            const row = 5 + idx;
                            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
                              const cell = `${col}${row}`;
                              if (wsBrand[cell]) wsBrand[cell].s = idx % 2 === 0 ? altRowStyle1 : altRowStyle2;
                            });
                          });
                          // Style total row
                          const brandTotalRow = 5 + Object.keys(brandTotalsExcel).length + 1;
                          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
                            const cell = `${col}${brandTotalRow}`;
                            if (wsBrand[cell]) wsBrand[cell].s = totalRowStyle;
                          });
                          wsBrand['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
                          XLSXStyle.utils.book_append_sheet(wb, wsBrand, 'Brand Summary');

                          // ======== SHEET 4: DAILY CELL USAGE (DETAILED) ========
                          const usageData = [];
                          usageData.push(['📅 DAILY CELL USAGE - DETAILED REPORT']);
                          usageData.push([`Company: ${selectedCompany?.companyName || 'N/A'}`]);
                          usageData.push([]);
                          usageData.push(['DATE', 'DAY PROD', 'DAY EFF', 'DAY CELLS', 'NIGHT PROD', 'NIGHT EFF', 'NIGHT CELLS', 'TOTAL CELLS', 'REJECTION %', 'REMARKS']);

                          let totalDayCells = 0, totalNightCells = 0;
                          records.forEach(r => {
                            const dayCells = (r.dayProduction || 0) * 66;
                            const nightCells = (r.nightProduction || 0) * 66;
                            totalDayCells += dayCells;
                            totalNightCells += nightCells;
                            usageData.push([
                              r.date,
                              r.dayProduction || 0,
                              r.dayCellEfficiency ? `${r.dayCellEfficiency}%` : '-',
                              dayCells,
                              r.nightProduction || 0,
                              r.nightCellEfficiency ? `${r.nightCellEfficiency}%` : '-',
                              nightCells,
                              dayCells + nightCells,
                              r.cellRejectionPercent ? `${r.cellRejectionPercent}%` : '0%',
                              r.remarks || ''
                            ]);
                          });

                          usageData.push([]);
                          usageData.push(['TOTAL', records.reduce((s, r) => s + (r.dayProduction || 0), 0), '', totalDayCells, records.reduce((s, r) => s + (r.nightProduction || 0), 0), '', totalNightCells, totalDayCells + totalNightCells, '', '']);

                          const ws3 = XLSXStyle.utils.aoa_to_sheet(usageData);
                          if (ws3['A1']) ws3['A1'].s = titleStyle;
                          ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
                          ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4'].forEach(cell => { if (ws3[cell]) ws3[cell].s = headerStyle; });
                          // Style data rows with alternating colors
                          records.forEach((_, idx) => {
                            const row = 5 + idx;
                            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(col => {
                              const cell = `${col}${row}`;
                              if (ws3[cell]) ws3[cell].s = idx % 2 === 0 ? altRowStyle1 : altRowStyle2;
                            });
                          });
                          // Style total row
                          const totalRow = 5 + records.length + 1;
                          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(col => {
                            const cell = `${col}${totalRow}`;
                            if (ws3[cell]) ws3[cell].s = totalRowStyle;
                          });
                          ws3['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 25 }];
                          XLSXStyle.utils.book_append_sheet(wb, ws3, 'Daily Usage');

                          // ======== SHEET 5: EFFICIENCY WISE USAGE BREAKDOWN ========
                          const effUsageData = [];
                          effUsageData.push(['⚡ EFFICIENCY WISE DAILY USAGE BREAKDOWN']);
                          effUsageData.push([`Company: ${selectedCompany?.companyName || 'N/A'}`]);
                          effUsageData.push([]);
                          effUsageData.push(['DATE', '25.4% USED', '25.5% USED', '25.6% USED', '25.7% USED', '25.8% USED', 'TOTAL']);

                          // Track daily usage per efficiency
                          const dailyEffUsage = {};
                          // Use already defined normEff from above
                          records.forEach(r => {
                            if (!dailyEffUsage[r.date]) {
                              dailyEffUsage[r.date] = { '25.4': 0, '25.5': 0, '25.6': 0, '25.7': 0, '25.8': 0 };
                            }
                            const dayEff2 = normEff(r.dayCellEfficiency);
                            const nightEff2 = normEff(r.nightCellEfficiency);
                            const totalProd2 = (r.dayProduction || 0) + (r.nightProduction || 0);

                            // Smart logic: if only one efficiency set, count total production
                            if (dayEff2 && nightEff2) {
                              if (dailyEffUsage[r.date].hasOwnProperty(dayEff2)) dailyEffUsage[r.date][dayEff2] += (r.dayProduction || 0) * 66;
                              if (dailyEffUsage[r.date].hasOwnProperty(nightEff2)) dailyEffUsage[r.date][nightEff2] += (r.nightProduction || 0) * 66;
                            } else if (dayEff2 && !nightEff2) {
                              if (dailyEffUsage[r.date].hasOwnProperty(dayEff2)) dailyEffUsage[r.date][dayEff2] += totalProd2 * 66;
                            } else if (!dayEff2 && nightEff2) {
                              if (dailyEffUsage[r.date].hasOwnProperty(nightEff2)) dailyEffUsage[r.date][nightEff2] += totalProd2 * 66;
                            }
                          });

                          let effTotals = { '25.4': 0, '25.5': 0, '25.6': 0, '25.7': 0, '25.8': 0 };
                          Object.entries(dailyEffUsage).sort((a, b) => new Date(a[0]) - new Date(b[0])).forEach(([date, usage]) => {
                            const rowTotal = Object.values(usage).reduce((s, v) => s + v, 0);
                            effUsageData.push([date, usage['25.4'], usage['25.5'], usage['25.6'], usage['25.7'], usage['25.8'], rowTotal]);
                            Object.keys(usage).forEach(k => { effTotals[k] += usage[k]; });
                          });

                          effUsageData.push([]);
                          effUsageData.push(['TOTAL', effTotals['25.4'], effTotals['25.5'], effTotals['25.6'], effTotals['25.7'], effTotals['25.8'], Object.values(effTotals).reduce((s, v) => s + v, 0)]);

                          const ws4 = XLSXStyle.utils.aoa_to_sheet(effUsageData);
                          if (ws4['A1']) ws4['A1'].s = titleStyle;
                          ws4['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
                          ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4'].forEach(cell => { if (ws4[cell]) ws4[cell].s = headerStyle; });
                          // Style alternating rows
                          Object.keys(dailyEffUsage).forEach((_, idx) => {
                            const row = 5 + idx;
                            ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
                              const cell = `${col}${row}`;
                              if (ws4[cell]) ws4[cell].s = idx % 2 === 0 ? altRowStyle1 : altRowStyle2;
                            });
                          });
                          // Style total row
                          const effTotalRow = 5 + Object.keys(dailyEffUsage).length + 1;
                          ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
                            const cell = `${col}${effTotalRow}`;
                            if (ws4[cell]) ws4[cell].s = totalRowStyle;
                          });
                          ws4['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
                          XLSXStyle.utils.book_append_sheet(wb, ws4, 'Efficiency Usage');

                          // ======== SHEET 6: BALANCE ANALYSIS ========
                          const balanceData = [];
                          balanceData.push(['📊 BALANCE ANALYSIS & FORECAST']);
                          balanceData.push([`Company: ${selectedCompany?.companyName || 'N/A'}`]);
                          balanceData.push([]);
                          balanceData.push(['EFFICIENCY', 'RECEIVED', 'USED', 'BALANCE', 'AFTER REJ', 'EST. MODULES', 'DAYS LEFT (EST)', 'REORDER NEEDED']);

                          const avgDailyUsage = grandTotalUsed / (records.length || 1);
                          effGrades.forEach(eff => {
                            const effData = cellEffReceived[eff] || {};
                            const totalReceived = typeof effData === 'object'
                              ? Object.values(effData).reduce((sum, qty) => sum + (qty || 0), 0) : (effData || 0);
                            const used = usedByEff[eff] || 0;
                            const remaining = totalReceived - used;
                            const afterRej = Math.floor(remaining * (1 - avgCellRejPct / 100));
                            const estModules = Math.floor(afterRej / 66);
                            const avgEffUsage = used / (records.length || 1);
                            const daysLeft = avgEffUsage > 0 ? Math.floor(remaining / avgEffUsage) : remaining > 0 ? '∞' : 0;
                            const reorder = remaining < avgEffUsage * 7 ? '⚠️ YES - LOW STOCK' : remaining < 0 ? '🔴 CRITICAL - SHORTAGE' : '✅ NO';

                            balanceData.push([`${eff}%`, totalReceived, used, remaining, afterRej, estModules, daysLeft, reorder]);
                          });

                          balanceData.push([]);
                          balanceData.push(['📈 FORECAST NOTES:']);
                          balanceData.push(['• Days Left calculation based on average daily usage per efficiency']);
                          balanceData.push(['• Reorder warning when stock < 7 days of average usage']);
                          balanceData.push([`• Current Avg Daily Cell Usage: ${avgDailyUsage.toLocaleString()} cells/day`]);

                          const ws5 = XLSXStyle.utils.aoa_to_sheet(balanceData);
                          if (ws5['A1']) ws5['A1'].s = titleStyle;
                          ws5['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
                          ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4'].forEach(cell => { if (ws5[cell]) ws5[cell].s = headerStyle; });
                          effGrades.forEach((_, idx) => {
                            const row = 5 + idx;
                            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                              const cell = `${col}${row}`;
                              if (ws5[cell]) ws5[cell].s = idx % 2 === 0 ? altRowStyle1 : altRowStyle2;
                            });
                          });
                          ws5['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 22 }];
                          XLSXStyle.utils.book_append_sheet(wb, ws5, 'Balance Analysis');

                          // Download file
                          const fileName = `Cell_Inventory_DETAILED_${selectedCompany?.companyName || 'Company'}_${new Date().toISOString().split('T')[0]}.xlsx`;
                          XLSXStyle.writeFile(wb, fileName);
                          alert('✅ Detailed Excel Report Downloaded Successfully!\n\n📊 Sheets Included:\n1. Grand Summary\n2. Supplier Inventory\n3. Brand Summary\n4. Daily Usage\n5. Efficiency Usage\n6. Balance Analysis');
                        }}
                        style={{
                          padding: '14px 28px',
                          background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          boxShadow: '0 4px 15px rgba(76,175,80,0.4)'
                        }}
                      >
                        📊 EXPORT DETAILED EXCEL REPORT
                      </button>

                      <button
                        onClick={() => setShowCellReceivedModal(true)}
                        style={{
                          padding: '14px 28px',
                          backgroundColor: '#FF5722',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          boxShadow: '0 4px 15px rgba(255,87,34,0.3)'
                        }}
                      >
                        ➕ ADD CELL RECEIVED ENTRY
                      </button>
                    </div>
                  </div>

                  {/* TOP SUMMARY STAT CARDS */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '15px',
                    marginBottom: '30px'
                  }}>
                    {/* TOTAL RECEIVED - Blue */}
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: '#e3f2fd',
                      border: '3px solid #2196f3',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: '600', marginBottom: '8px' }}>📦 TOTAL RECEIVED</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1976d2' }}>{grandTotalReceived.toLocaleString()}</div>
                      <div style={{ fontSize: '12px', color: '#64b5f6' }}>Cells</div>
                    </div>

                    {/* TOTAL USED - Pink/Red */}
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: '#fce4ec',
                      border: '3px solid #e91e63',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#c2185b', fontWeight: '600', marginBottom: '8px' }}>🔧 TOTAL USED</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d81b60' }}>{grandTotalUsed.toLocaleString()}</div>
                      <div style={{ fontSize: '12px', color: '#f48fb1' }}>Cells</div>
                    </div>

                    {/* REMAINING - Green */}
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: grandRemaining >= 0 ? '#e8f5e9' : '#ffebee',
                      border: `3px solid ${grandRemaining >= 0 ? '#4caf50' : '#f44336'}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: grandRemaining >= 0 ? '#2e7d32' : '#c62828', fontWeight: '600', marginBottom: '8px' }}>📊 REMAINING</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: grandRemaining >= 0 ? '#43a047' : '#e53935' }}>{grandRemaining.toLocaleString()}</div>
                      <div style={{ fontSize: '12px', color: grandRemaining >= 0 ? '#81c784' : '#ef9a9a' }}>Cells</div>
                    </div>

                    {/* AVG REJECTION - Yellow/Orange */}
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: '#fff3e0',
                      border: '3px solid #ff9800',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#e65100', fontWeight: '600', marginBottom: '8px' }}>⚠️ AVG REJECTION</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f57c00' }}>{avgCellRejPct.toFixed(2)}%</div>
                      <div style={{ fontSize: '12px', color: '#ffb74d' }}>Rate</div>
                    </div>

                    {/* AFTER REJECTION - Purple */}
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: '#f3e5f5',
                      border: '3px solid #9c27b0',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#7b1fa2', fontWeight: '600', marginBottom: '8px' }}>✅ AFTER REJECTION</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8e24aa' }}>{Math.floor(grandRemaining * (1 - avgCellRejPct / 100)).toLocaleString()}</div>
                      <div style={{ fontSize: '12px', color: '#ba68c8' }}>Usable Cells</div>
                    </div>

                    {/* EST. MODULES - Dark Green */}
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      backgroundColor: '#1b5e20',
                      border: '3px solid #2e7d32',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#a5d6a7', fontWeight: '600', marginBottom: '8px' }}>🏭 EST. MODULES</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>{estimatedModules.toLocaleString()}</div>
                      <div style={{ fontSize: '12px', color: '#81c784' }}>Can Produce</div>
                    </div>
                  </div>

                  {/* BRAND/SUPPLIER WISE BREAKDOWN */}
                  {(() => {
                    // Calculate brand-wise totals across all efficiencies
                    const brandTotals = {};
                    efficiencyGrades.forEach(eff => {
                      const effData = cellEfficiencyReceived[eff] || {};
                      if (typeof effData === 'object') {
                        Object.entries(effData).forEach(([brand, qty]) => {
                          if (!brandTotals[brand]) {
                            brandTotals[brand] = { received: 0, efficiencies: {}, used: 0 };
                          }
                          brandTotals[brand].received += (qty || 0);
                          brandTotals[brand].efficiencies[eff] = (qty || 0);
                        });
                      }
                    });

                    // DEBUG: Check what cellSupplier values we have in records
                    const debugRecords = selectedCompany?.productionRecords || [];
                    console.log('DEBUG - All production records cellSupplier:', debugRecords.map(r => ({id: r.id, cellSupplier: r.cellSupplier, cell_supplier: r.cell_supplier})));
                    console.log('DEBUG - supplierWiseUsage:', supplierWiseUsage);
                    
                    // Use supplier-wise usage from production records (based on cellSupplier field)
                    Object.keys(brandTotals).forEach(brand => {
                      // Match brand name (case-insensitive)
                      const matchedSupplier = Object.keys(supplierWiseUsage).find(
                        s => s.toUpperCase() === brand.toUpperCase()
                      );
                      console.log('DEBUG - brand:', brand, 'matchedSupplier:', matchedSupplier, 'value:', matchedSupplier ? supplierWiseUsage[matchedSupplier] : 0);
                      if (matchedSupplier) {
                        brandTotals[brand].used = supplierWiseUsage[matchedSupplier];
                      } else {
                        brandTotals[brand].used = 0;
                      }
                    });
                    
                    // Note: Unassigned cells (records without cellSupplier) are NOT distributed
                    // They will show in the total but not in any specific supplier

                    const brands = Object.keys(brandTotals);
                    if (brands.length === 0) return null;

                    return (
                      <div style={{
                        marginBottom: '30px',
                        background: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        overflow: 'hidden',
                        border: '1px solid #e0e0e0'
                      }}>
                        <div style={{
                          padding: '15px 20px',
                          background: 'linear-gradient(135deg, #7b1fa2 0%, #4a148c 100%)',
                          color: 'white',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🏭</span> Brand / Supplier Wise Breakdown
                          </h3>
                          <div style={{ fontSize: '12px', opacity: 0.9 }}>
                            {brands.length} Suppliers
                          </div>
                        </div>

                        <div style={{ padding: '20px' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(brands.length, 4)}, 1fr)`,
                            gap: '20px'
                          }}>
                            {brands.map(brand => {
                              const data = brandTotals[brand];
                              const brandPercent = grandTotalReceived > 0 ? ((data.received / grandTotalReceived) * 100).toFixed(1) : 0;
                              const brandRemaining = data.received - data.used;
                              const estModulesFromRemaining = Math.floor(brandRemaining / cellsPerModule);

                              return (
                                <div key={brand} style={{
                                  padding: '20px',
                                  borderRadius: '12px',
                                  border: `2px solid ${brandRemaining < 0 ? '#f44336' : '#9c27b0'}`,
                                  backgroundColor: brandRemaining < 0 ? '#fff5f5' : '#faf5ff'
                                }}>
                                  {/* Brand Name */}
                                  <div style={{
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    color: '#7b1fa2',
                                    marginBottom: '15px',
                                    textAlign: 'center',
                                    padding: '10px',
                                    background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                                    borderRadius: '8px'
                                  }}>
                                    🏭 {brand}
                                  </div>

                                  {/* Total Received */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '10px',
                                    backgroundColor: '#e3f2fd',
                                    borderRadius: '8px',
                                    marginBottom: '8px'
                                  }}>
                                    <span style={{ color: '#1565c0', fontWeight: '600' }}>Received:</span>
                                    <strong style={{ color: '#1976d2', fontSize: '15px' }}>{data.received.toLocaleString()}</strong>
                                  </div>

                                  {/* Used */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '10px',
                                    backgroundColor: '#fce4ec',
                                    borderRadius: '8px',
                                    marginBottom: '8px'
                                  }}>
                                    <span style={{ color: '#c2185b', fontWeight: '600' }}>Used:</span>
                                    <strong style={{ color: '#d81b60', fontSize: '15px' }}>{data.used.toLocaleString()}</strong>
                                  </div>

                                  {/* Remaining */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    backgroundColor: brandRemaining >= 0 ? '#e8f5e9' : '#ffebee',
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    border: `1px solid ${brandRemaining >= 0 ? '#4caf50' : '#f44336'}`
                                  }}>
                                    <span style={{ color: brandRemaining >= 0 ? '#2e7d32' : '#c62828', fontWeight: '700' }}>REMAINING:</span>
                                    <strong style={{ color: brandRemaining >= 0 ? '#43a047' : '#e53935', fontSize: '18px' }}>{brandRemaining.toLocaleString()}</strong>
                                  </div>

                                  {/* Est Modules from Remaining */}
                                  <div style={{
                                    padding: '12px',
                                    background: estModulesFromRemaining > 0 ? 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)' : 'linear-gradient(135deg, #f44336 0%, #c62828 100%)',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    textAlign: 'center'
                                  }}>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>CAN PRODUCE</div>
                                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>🔧 {estModulesFromRemaining.toLocaleString()}</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>modules</div>
                                  </div>

                                  {/* Percentage of Total */}
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '8px 10px',
                                    backgroundColor: '#fff3e0',
                                    borderRadius: '8px',
                                    marginBottom: '10px'
                                  }}>
                                    <span style={{ color: '#e65100', fontWeight: '600', fontSize: '13px' }}>% of Total:</span>
                                    <strong style={{ color: '#f57c00', fontSize: '14px' }}>{brandPercent}%</strong>
                                  </div>

                                  {/* Efficiency Breakdown */}
                                  <div style={{
                                    padding: '10px',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: '8px'
                                  }}>
                                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: '600' }}>EFFICIENCY WISE:</div>
                                    {efficiencyGrades.map(eff => {
                                      const effQty = data.efficiencies[eff] || 0;
                                      if (effQty === 0) return null;
                                      return (
                                        <div key={eff} style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          padding: '3px 0',
                                          borderBottom: '1px dashed #e0e0e0',
                                          fontSize: '12px'
                                        }}>
                                          <span style={{ color: '#1565c0' }}>⚡ {eff}%</span>
                                          <strong style={{ color: '#333' }}>{effQty.toLocaleString()}</strong>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* GRAND SUMMARY STATS */}
                  {/* DETAILED INVENTORY BREAKDOWN UI */}
                  <div style={{
                    marginBottom: '30px',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0'
                  }}>
                    <div style={{
                      padding: '15px 20px',
                      background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                      color: 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📊</span> Detailed Inventory Breakdown
                      </h3>
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        Updated: {new Date().toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ padding: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#546e7a' }}>Item</th>
                            <th style={{ textAlign: 'right', padding: '12px', color: '#546e7a' }}>Value</th>
                            <th style={{ textAlign: 'left', padding: '12px', paddingLeft: '20px', color: '#90a4ae', fontSize: '12px' }}>Unit/Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* 1. Total Received */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '12px', fontWeight: '600', color: '#1a237e' }}>Total Cells Received</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '16px', color: '#1565c0' }}>{grandTotalReceived.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#78909c' }}>cells</td>
                          </tr>

                          {/* 2. OK Modules */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5', backgroundColor: '#f9fbe7' }}>
                            <td style={{ padding: '12px', fontWeight: '500' }}>OK (A-grade) Modules</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>{okModules.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#78909c' }}>modules</td>
                          </tr>

                          {/* 3. OK Cells Used */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '12px', paddingLeft: '30px', color: '#455a64' }}>↳ OK Cells Used</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#2e7d32' }}>{okCellsUsed.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#78909c' }}>cells (66/mod)</td>
                          </tr>

                          {/* 4. B-Grade */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '12px', paddingLeft: '30px', color: '#455a64' }}>
                              ↳ B-grade Modules <span style={{ fontSize: '11px', color: '#ef6c00', backgroundColor: '#fff3e0', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>{avgModRejPct.toFixed(2)}%</span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#ef6c00' }}>{bGradeModules.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#78909c' }}>modules</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '12px', paddingLeft: '50px', color: '#78909c', fontSize: '13px' }}>Using: {bGradeCellsUsed.toLocaleString()} cells</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}></td>
                            <td style={{ padding: '12px', paddingLeft: '20px' }}></td>
                          </tr>

                          {/* 5. R-Grade (Scrap) */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '12px', paddingLeft: '30px', color: '#455a64' }}>
                              ↳ R-grade / Scrap <span style={{ fontSize: '11px', color: '#c62828', backgroundColor: '#ffebee', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>{rGradePct}%</span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#c62828' }}>{rGradeModules.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#78909c' }}>modules</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '12px', paddingLeft: '50px', color: '#78909c', fontSize: '13px' }}>Using: {rGradeCellsUsed.toLocaleString()} cells</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}></td>
                            <td style={{ padding: '12px', paddingLeft: '20px' }}></td>
                          </tr>

                          {/* 6. Processed Cells */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5', backgroundColor: '#e3f2fd' }}>
                            <td style={{ padding: '12px', fontWeight: '600', color: '#1565c0' }}>Total Processed Cells</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#1565c0' }}>{totalProcessedCells.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#1565c0' }}>OK + B + R</td>
                          </tr>

                          {/* 7. Cell Rejection */}
                          <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                            <td style={{ padding: '12px', color: '#c62828' }}>
                              + Cell Rejection <span style={{ fontSize: '11px', color: '#c62828', backgroundColor: '#ffebee', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>{avgCellRejPct.toFixed(2)}%</span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#c62828', fontWeight: '600' }}>{cellRejectionQty.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#78909c' }}>cells</td>
                          </tr>

                          {/* 8. TOTAL USED */}
                          <tr style={{ borderBottom: '1px solid #f5f5f5', backgroundColor: '#ffebee' }}>
                            <td style={{ padding: '12px', fontWeight: '700', color: '#d32f2f', fontSize: '15px' }}>TOTAL CELLS USED</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '18px', color: '#d32f2f' }}>{grandTotalUsed.toLocaleString()}</td>
                            <td style={{ padding: '12px', paddingLeft: '20px', color: '#d32f2f' }}>Processed + Rej</td>
                          </tr>

                          {/* 9. REMAINING */}
                          <tr style={{ backgroundColor: grandRemaining >= 0 ? '#e8f5e9' : '#ffebee' }}>
                            <td style={{ padding: '15px', fontWeight: '700', color: grandRemaining >= 0 ? '#2e7d32' : '#c62828', fontSize: '16px' }}>CELLS REMAINING</td>
                            <td style={{ padding: '15px', textAlign: 'right', fontWeight: '700', fontSize: '22px', color: grandRemaining >= 0 ? '#2e7d32' : '#c62828' }}>{grandRemaining.toLocaleString()}</td>
                            <td style={{ padding: '15px', paddingLeft: '20px', color: grandRemaining >= 0 ? '#2e7d32' : '#c62828' }}>
                              <div>Estimated Yield:</div>
                              <div style={{ fontWeight: '700', fontSize: '14px' }}>~{estimatedModules.toLocaleString()} modules</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* EFFICIENCY-WISE CARDS */}
                  <h3 style={{ color: '#37474f', marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
                    📊 Efficiency Grade Wise Breakdown
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '20px',
                    marginBottom: '30px'
                  }}>
                    {efficiencyGrades.map(eff => {
                      const effData = cellEfficiencyReceived[eff] || {};
                      const companies = typeof effData === 'object' ? effData : {};
                      const totalReceived = typeof effData === 'object'
                        ? Object.values(effData).reduce((sum, qty) => sum + (qty || 0), 0)
                        : (effData || 0);
                      const used = usedByEfficiency[eff] || 0;
                      const remaining = totalReceived - used;
                      // Use avgCellRejPct which is defined in the parent scope
                      const estModules = Math.floor(remaining / cellsPerModule);
                      const hasData = totalReceived > 0 || used > 0;

                      return (
                        <div
                          key={eff}
                          style={{
                            padding: '20px',
                            backgroundColor: remaining < 0 ? '#ffebee' : remaining === 0 && totalReceived === 0 ? '#fafafa' : '#ffffff',
                            borderRadius: '16px',
                            border: `3px solid ${remaining < 0 ? '#f44336' : hasData ? '#4caf50' : '#e0e0e0'}`,
                            boxShadow: hasData ? '0 6px 20px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          {/* Efficiency Header */}
                          <div style={{
                            fontSize: '26px',
                            fontWeight: 'bold',
                            color: '#1565c0',
                            marginBottom: '15px',
                            textAlign: 'center',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                            borderRadius: '10px'
                          }}>
                            ⚡ {eff}%
                          </div>

                          {/* Company-wise breakdown */}
                          {Object.keys(companies).length > 0 && (
                            <div style={{
                              marginBottom: '15px',
                              padding: '12px',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '10px'
                            }}>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>SUPPLIER WISE:</div>
                              {Object.entries(companies).map(([company, qty]) => (
                                <div key={company} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  padding: '6px 0',
                                  borderBottom: '1px dashed #e0e0e0',
                                  fontSize: '14px'
                                }}>
                                  <span style={{ color: '#555' }}>🏭 {company}</span>
                                  <strong style={{ color: '#1976d2' }}>{(qty || 0).toLocaleString()}</strong>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Stats Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '11px', color: '#1565c0', fontWeight: '600' }}>RECEIVED</div>
                              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{totalReceived.toLocaleString()}</div>
                            </div>
                            <div style={{ padding: '12px', backgroundColor: '#ffebee', borderRadius: '10px', textAlign: 'center' }}>
                              <div style={{ fontSize: '11px', color: '#c62828', fontWeight: '600' }}>USED</div>
                              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#d32f2f' }}>{used.toLocaleString()}</div>
                            </div>
                          </div>

                          {/* Balance */}
                          <div style={{
                            padding: '15px',
                            backgroundColor: remaining >= 0 ? '#e8f5e9' : '#ffebee',
                            borderRadius: '10px',
                            textAlign: 'center',
                            marginBottom: '12px'
                          }}>
                            <div style={{ fontSize: '11px', color: remaining >= 0 ? '#2e7d32' : '#c62828', fontWeight: '600' }}>BALANCE</div>
                            <div style={{ fontSize: '26px', fontWeight: 'bold', color: remaining >= 0 ? '#4caf50' : '#f44336' }}>
                              {remaining.toLocaleString()}
                            </div>
                          </div>

                          {/* Estimated Modules */}
                          <div style={{
                            padding: '15px',
                            background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                            borderRadius: '10px',
                            textAlign: 'center',
                            color: 'white'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.9 }}>EST. MODULES</div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>🔧 {estModules.toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* All Entries Table */}
                  <h3 style={{ color: '#37474f', marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
                    📋 All Cell Received Entries (Click to Edit/Delete)
                  </h3>
                  <div style={{
                    backgroundColor: '#fafafa',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e0e0e0'
                  }}>
                    {efficiencyGrades.some(eff => {
                      const effData = cellEfficiencyReceived[eff] || {};
                      return typeof effData === 'object' && Object.keys(effData).length > 0;
                    }) ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1976d2', color: 'white' }}>
                            <th style={{ padding: '15px', textAlign: 'left', borderRadius: '8px 0 0 0' }}>Efficiency</th>
                            <th style={{ padding: '15px', textAlign: 'left' }}>Supplier</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Quantity</th>
                            <th style={{ padding: '15px', textAlign: 'right' }}>Est. Modules</th>
                            <th style={{ padding: '15px', textAlign: 'center', borderRadius: '0 8px 0 0' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {efficiencyGrades.map(eff => {
                            const effData = cellEfficiencyReceived[eff] || {};
                            const companies = typeof effData === 'object' ? effData : {};

                            return Object.entries(companies).map(([company, qty], idx) => (
                              <tr key={`${eff}-${company}`} style={{
                                backgroundColor: idx % 2 === 0 ? 'white' : '#f5f5f5',
                                borderBottom: '1px solid #e0e0e0'
                              }}>
                                <td style={{ padding: '15px', fontWeight: '700', color: '#1565c0', fontSize: '16px' }}>
                                  ⚡ {eff}%
                                </td>
                                <td style={{ padding: '15px', fontSize: '15px' }}>
                                  🏭 {company}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'right', fontSize: '18px', fontWeight: '700', color: '#1976d2' }}>
                                  {(qty || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'right', fontSize: '16px', fontWeight: '600', color: '#4caf50' }}>
                                  ~{Math.floor((qty || 0) / 66).toLocaleString()}
                                </td>
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => {
                                      setCellReceivedEditMode(true);
                                      setCellReceivedEditKey({ eff, company });
                                      setCellReceivedForm({
                                        efficiency: eff,
                                        supplierCompany: company,
                                        quantity: String(qty || 0),
                                        invoiceNo: '',
                                        receiveDate: new Date().toISOString().split('T')[0]
                                      });
                                      setShowCellReceivedModal(true);
                                    }}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: '#ff9800',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      marginRight: '8px'
                                    }}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`Delete ${company} (${qty.toLocaleString()} cells) from ${eff}%?`)) return;

                                      const currentReceived = { ...(selectedCompany?.cellEfficiencyReceived || {}) };
                                      if (currentReceived[eff] && currentReceived[eff][company]) {
                                        delete currentReceived[eff][company];
                                        if (Object.keys(currentReceived[eff]).length === 0) {
                                          delete currentReceived[eff];
                                        }
                                      }

                                      try {
                                        const API_BASE_URL = getAPIBaseURL();
                                        const response = await fetch(`${API_BASE_URL}/api/companies/${selectedCompany.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ cellEfficiencyReceived: currentReceived })
                                        });

                                        if (response.ok) {
                                          alert('✅ Deleted successfully!');
                                          await loadCompanies();
                                          setSelectedCompany(prev => ({ ...prev, cellEfficiencyReceived: currentReceived }));
                                        }
                                      } catch (error) {
                                        alert('❌ Error deleting');
                                      }
                                    }}
                                    style={{
                                      padding: '8px 16px',
                                      backgroundColor: '#f44336',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                        <span style={{ fontSize: '50px', display: 'block', marginBottom: '15px' }}>📦</span>
                        <p style={{ fontSize: '18px' }}>No cell inventory data yet.</p>
                        <p style={{ fontSize: '14px' }}>Click "ADD CELL RECEIVED ENTRY" button to add your first entry!</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ========== PDI DASHBOARD TAB ========== */}
        {productionTab === 'pdiDashboard' && (
          <div style={{
            padding: '25px',
            backgroundColor: '#fff',
            borderRadius: '0 0 12px 12px',
            border: '2px solid #9c27b0',
            borderTop: 'none'
          }}>
            <PDIDashboard 
              companyId={selectedCompany?.id} 
              companyName={selectedCompany?.companyName}
            />
          </div>
        )}

        {/* ========== IQC COC TRACKER TAB ========== */}
        {productionTab === 'iqcTracker' && (
          <div style={{
            padding: '25px',
            backgroundColor: '#fff',
            borderRadius: '0 0 12px 12px',
            border: '2px solid #1a237e',
            borderTop: 'none'
          }}>
            <IQCTracker 
              companyName={selectedCompany?.companyName}
              companyId={selectedCompany?.id}
              productionRecords={selectedCompany?.productionRecords || []}
            />
          </div>
        )}

        <div className="summary-cards">
          <div className="summary-card">
            <h4>Total Production</h4>
            <p className="summary-value">{calculateTotalProduction()}</p>
            <span className="summary-label">modules</span>
          </div>
          <div className="summary-card">
            <h4>Total MW</h4>
            <p className="summary-value">{calculateTotalMW()}</p>
            <span className="summary-label">megawatts</span>
          </div>
          <div className="summary-card">
            <h4>Cell Stock</h4>
            <p className="summary-value">{calculateCellStock()}</p>
            <span className="summary-label">cells remaining</span>
          </div>
        </div>

        <div className="remarks-section">
          <h3>Remarks</h3>
          <textarea
            value={reportData.remarks}
            onChange={(e) => setReportData({ ...reportData, remarks: e.target.value })}
            placeholder="Enter any additional remarks for the report..."
            rows="4"
          />
        </div>

        <div className="pdf-actions">
          <button className="btn-generate-pdf" onClick={handleOpenPDFModal} disabled={loading}>
            {loading ? 'Generating...' : '📄 Generate PDF Report'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="daily-report">
      {viewMode === 'list' && renderCompanyList()}
      {viewMode === 'form' && renderCompanyForm()}
      {viewMode === 'production' && renderProductionView()}

      {showRejectionModal && (
        <div className="modal-overlay" onClick={() => setShowRejectionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add Rejected Module</h3>
            <div className="form-group">
              <label>Serial Number</label>
              <input
                type="text"
                value={newRejection.serialNumber}
                onChange={(e) => setNewRejection({ ...newRejection, serialNumber: e.target.value })}
                placeholder="Enter serial number"
              />
            </div>
            <div className="form-group">
              <label>Rejection Date</label>
              <input
                type="date"
                value={newRejection.rejectionDate}
                onChange={(e) => setNewRejection({ ...newRejection, rejectionDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Reason</label>
              <select
                value={newRejection.reason}
                onChange={(e) => setNewRejection({ ...newRejection, reason: e.target.value })}
              >
                <optgroup label="🔴 MAJOR DEFECTS (Critical)">
                  <option value="EL Major Micro-crack / Cell Crack">EL Major Micro-crack / Cell Crack</option>
                  <option value="Broken Cell / Dead Cell (Dark Cell)">Broken Cell / Dead Cell (Dark Cell)</option>
                  <option value="Hot-spot Affected Cell">Hot-spot Affected Cell</option>
                  <option value="Glass Crack / Corner Crack">Glass Crack / Corner Crack</option>
                  <option value="Low Power / Pmax Less Than Tolerance">Low Power / Pmax Less Than Tolerance</option>
                  <option value="Soldering Open / Ribbon Cut">Soldering Open / Ribbon Cut</option>
                  <option value="J-Box Diode Failure / Wrong Diode">J-Box Diode Failure / Wrong Diode</option>
                  <option value="Delamination (Air Gap Inside Laminate)">Delamination (Air Gap Inside Laminate)</option>
                  <option value="Insulation Resistance Fail / Hi-pot Fail">Insulation Resistance Fail / Hi-pot Fail</option>
                  <option value="Frame Major Dent / Frame Separation">Frame Major Dent / Frame Separation</option>
                </optgroup>
                <optgroup label="🟡 MINOR DEFECTS (Visual/Workmanship)">
                  <option value="Cell Color Mismatch (Shade Difference)">Cell Color Mismatch (Shade Difference)</option>
                  <option value="Minor EVA Bubble (Non-critical Position)">Minor EVA Bubble (Non-critical Position)</option>
                  <option value="Backsheet Wrinkle">Backsheet Wrinkle</option>
                  <option value="Ribbon Alignment Not Straight">Ribbon Alignment Not Straight</option>
                  <option value="Glass Small Scratch (Acceptable Limit)">Glass Small Scratch (Acceptable Limit)</option>
                  <option value="EVA Overflow / Glue Mark">EVA Overflow / Glue Mark</option>
                  <option value="Small Dust / Particle Inside Laminate">Small Dust / Particle Inside Laminate</option>
                  <option value="Label Alignment Wrong / Print Misalignment">Label Alignment Wrong / Print Misalignment</option>
                  <option value="Frame Minor Cosmetic Scratch">Frame Minor Cosmetic Scratch</option>
                  <option value="Barcode Sticker Tilt / Small Ink Mark">Barcode Sticker Tilt / Small Ink Mark</option>
                </optgroup>
                <optgroup label="⚪ OTHER">
                  <option value="Other">Other</option>
                </optgroup>
              </select>
            </div>
            <div className="form-group">
              <label>Stage</label>
              <select
                value={newRejection.stage}
                onChange={(e) => setNewRejection({ ...newRejection, stage: e.target.value })}
              >
                <option value="Visual Inspection">Visual Inspection</option>
                <option value="Electrical Test">Electrical Test</option>
                <option value="EL Test">EL Test</option>
                <option value="Flash Test">Flash Test</option>
                <option value="Final QC">Final QC</option>
                <option value="Packaging">Packaging</option>
                <option value="Lamination">Lamination</option>
                <option value="Stringing">Stringing</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-save" onClick={handleAddRejection}>Add</button>
              <button className="btn-cancel" onClick={() => setShowRejectionModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddDayModal && (
        <div className="modal-overlay" onClick={() => setShowAddDayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Production Day</h3>

            <div className="form-group">
              <label>Select Date *</label>
              <input
                type="date"
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>PDI Number *</label>
              <select
                value={newDayPdiNumber}
                onChange={(e) => setNewDayPdiNumber(e.target.value)}
                required
                style={{ borderColor: newDayPdiNumber ? '#4CAF50' : '#ff9800' }}
              >
                <option value="">Select PDI Number</option>
                <option value="PDI-1">PDI-1</option>
                <option value="PDI-2">PDI-2</option>
                <option value="PDI-3">PDI-3</option>
                <option value="PDI-4">PDI-4</option>
                <option value="PDI-5">PDI-5</option>
                <option value="PDI-6">PDI-6</option>
                <option value="PDI-7">PDI-7</option>
                <option value="PDI-8">PDI-8</option>
                <option value="PDI-9">PDI-9</option>
                <option value="PDI-10">PDI-10</option>
              </select>
              {!newDayPdiNumber && (
                <small style={{ color: '#f44336', marginTop: '5px', display: 'block' }}>
                  ⚠️ PDI Number is mandatory
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Running Order *</label>
              <select
                value={newDayRunningOrder}
                onChange={(e) => setNewDayRunningOrder(e.target.value)}
                required
                style={{ borderColor: newDayRunningOrder ? '#4CAF50' : '#ff9800' }}
              >
                <option value="">Select Running Order</option>
                <option value="R1">R1</option>
                <option value="R2">R2</option>
                <option value="R3">R3</option>
                <option value="R4">R4</option>
                <option value="R5">R5</option>
                <option value="R6">R6</option>
                <option value="R7">R7</option>
                <option value="R8">R8</option>
                <option value="R9">R9</option>
                <option value="R10">R10</option>
              </select>
              {!newDayRunningOrder && (
                <small style={{ color: '#f44336', marginTop: '5px', display: 'block' }}>
                  ⚠️ Running Order is mandatory
                </small>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-save"
                onClick={handleSaveNewDay}
                disabled={!newDayPdiNumber || !newDayRunningOrder}
                style={{ opacity: (newDayPdiNumber && newDayRunningOrder) ? 1 : 0.5, cursor: (newDayPdiNumber && newDayRunningOrder) ? 'pointer' : 'not-allowed' }}
              >
                Add Day
              </button>
              <button className="btn-cancel" onClick={() => setShowAddDayModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Materials Upload Modal */}
      {showBomModal && (
        <div className="modal-overlay" onClick={() => setShowBomModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>📦 Upload BOM Materials & Documents - {selectedRecordForBom?.date}</h3>

            {/* Wattage and Shift Selection */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Wattage Selection */}
                <div>
                  <label style={{ fontWeight: 'bold', marginRight: '10px', fontSize: '16px' }}>
                    ⚡ Module Wattage:
                  </label>
                  <select
                    value={selectedWattage}
                    onChange={(e) => {
                      setSelectedWattage(e.target.value);
                      // Reset BOM materials when wattage changes
                      const newMaterials = BOM_MATERIALS_BY_WATTAGE[e.target.value] || [];
                      const materialsData = {};
                      newMaterials.forEach(material => {
                        materialsData[material.name] = {
                          lotNumber: '',
                          company: '',
                          image: null,
                          existingImage: null
                        };
                      });
                      setBomMaterials(materialsData);
                    }}
                    style={{ padding: '8px 15px', fontSize: '15px', fontWeight: 'bold', borderRadius: '5px', border: '2px solid #1976d2' }}
                  >
                    <option value="625wp">625 Wp</option>
                    <option value="630wp">630 Wp</option>
                  </select>
                </div>

                {/* Day/Night Shift Selection */}
                <div>
                  <label style={{ fontWeight: 'bold', marginRight: '10px', fontSize: '16px' }}>
                    🌞/🌙 Production Shift:
                  </label>
                  <div style={{ display: 'inline-flex', gap: '10px' }}>
                    <button
                      onClick={() => setSelectedShift('day')}
                      style={{
                        padding: '8px 20px',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        borderRadius: '5px',
                        border: selectedShift === 'day' ? '3px solid #FF9800' : '2px solid #ccc',
                        backgroundColor: selectedShift === 'day' ? '#FFF3E0' : 'white',
                        color: selectedShift === 'day' ? '#E65100' : '#666',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                      }}
                    >
                      🌞 Day
                    </button>
                    <button
                      onClick={() => setSelectedShift('night')}
                      style={{
                        padding: '8px 20px',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        borderRadius: '5px',
                        border: selectedShift === 'night' ? '3px solid #2196F3' : '2px solid #ccc',
                        backgroundColor: selectedShift === 'night' ? '#E3F2FD' : 'white',
                        color: selectedShift === 'night' ? '#0D47A1' : '#666',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                      }}
                    >
                      🌙 Night
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#1976d2', marginBottom: '10px' }}>
                📋 BOM Materials for {selectedShift === 'day' ? '🌞 Day' : '🌙 Night'} Production
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                {(BOM_MATERIALS_BY_WATTAGE[selectedWattage] || []).map(material => (
                  <div key={material.name} style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                    <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                      {material.name}
                      {material.product_type && <span style={{ fontSize: '11px', color: '#666', display: 'block' }}>({material.product_type})</span>}
                      <span style={{ fontSize: '11px', color: '#1976d2', display: 'block' }}>Qty: {material.qty}</span>
                    </label>

                    {/* Company/Supplier Name - Proper Dropdown */}
                    {bomMaterials[material.name]?.showCustomCompany ? (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input
                          type="text"
                          placeholder="Enter new supplier name"
                          value={bomMaterials[material.name]?.company || ''}
                          onChange={(e) => handleBomMaterialChange(material.name, 'company', e.target.value)}
                          style={{ flex: 1, padding: '5px', border: '1px solid #1976d2' }}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            handleBomMaterialChange(material.name, 'showCustomCompany', false);
                          }}
                          style={{ padding: '5px 10px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={bomMaterials[material.name]?.company || ''}
                        onChange={(e) => {
                          if (e.target.value === '__ADD_NEW__') {
                            handleBomMaterialChange(material.name, 'showCustomCompany', true);
                            handleBomMaterialChange(material.name, 'company', '');
                          } else {
                            handleBomMaterialChange(material.name, 'company', e.target.value);
                          }
                        }}
                        style={{ width: '100%', marginBottom: '5px', padding: '5px', border: '1px solid #1976d2' }}
                      >
                        <option value="">Select Supplier/Company</option>
                        {(bomMaterials[material.name]?.suppliers || []).map((supplier, idx) => (
                          <option key={idx} value={supplier}>{supplier}</option>
                        ))}
                        <option value="__ADD_NEW__" style={{ fontWeight: 'bold', color: '#1976d2' }}>+ Add New Supplier</option>
                      </select>
                    )}

                    {/* Lot/Batch Number */}
                    <input
                      type="text"
                      placeholder="Lot/Batch Number"
                      value={bomMaterials[material.name]?.lotBatchNo || ''}
                      onChange={(e) => handleBomMaterialChange(material.name, 'lotBatchNo', e.target.value)}
                      style={{ width: '100%', marginBottom: '5px', padding: '5px', border: '1px solid #ccc' }}
                    />

                    {/* Cell Efficiency - Only for Solar Cell */}
                    {material.name === 'Solar Cell' && (
                      <div style={{ marginBottom: '5px' }}>
                        <label style={{ fontSize: '11px', color: '#1976d2', display: 'block', marginBottom: '2px' }}>
                          ⚡ Cell Efficiency (%):
                        </label>
                        <select
                          value={bomMaterials[material.name]?.cellEfficiency || ''}
                          onChange={(e) => handleBomMaterialChange(material.name, 'cellEfficiency', e.target.value)}
                          style={{ width: '100%', padding: '5px', border: '2px solid #FF9800', borderRadius: '4px', backgroundColor: '#FFF8E1' }}
                        >
                          <option value="">Select Efficiency</option>
                          <option value="25.4">25.4%</option>
                          <option value="25.5">25.5%</option>
                          <option value="25.6">25.6%</option>
                          <option value="25.7">25.7%</option>
                          <option value="25.8">25.8%</option>
                        </select>
                      </div>
                    )}

                    {/* Multiple Images Upload */}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={(e) => handleBomMaterialChange(material.name, 'images', e.target.files)}
                      style={{ width: '100%', fontSize: '11px', marginBottom: '3px' }}
                    />

                    {/* Show selected images count */}
                    {bomMaterials[material.name]?.images && bomMaterials[material.name].images.length > 0 && (
                      <small style={{ color: '#4CAF50', display: 'block' }}>
                        ✓ {bomMaterials[material.name].images.length} image(s) selected
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px', border: '2px solid #4CAF50', padding: '15px', borderRadius: '5px' }}>
              <h4 style={{ color: '#4CAF50', marginBottom: '10px' }}>📄 IPQC PDF Upload</h4>
              {selectedRecordForBom?.ipqcPdf && (
                <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
                  <small style={{ color: '#0c5460', display: 'block', fontWeight: 'bold' }}>✓ Current IPQC:</small>
                  <button
                    onClick={() => {
                      const path = selectedRecordForBom.ipqcPdf.startsWith('/') ? selectedRecordForBom.ipqcPdf : `/${selectedRecordForBom.ipqcPdf}`;
                      const url = selectedRecordForBom.ipqcPdf.startsWith('http')
                        ? selectedRecordForBom.ipqcPdf
                        : `http://localhost:5003${path}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    style={{
                      color: '#0066cc',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textDecoration: 'underline',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '4px 0'
                    }}
                  >
                    📄 View Current IPQC PDF
                  </button>
                </div>
              )}
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setIpqcPdf(e.target.files[0])}
                style={{ width: '100%' }}
              />
              {ipqcPdf && (
                <small style={{ color: '#4CAF50', display: 'block', marginTop: '5px' }}>
                  ✓ Selected: {ipqcPdf.name}
                </small>
              )}
            </div>

            <div style={{ marginBottom: '20px', border: '2px solid #FF9800', padding: '15px', borderRadius: '5px' }}>
              <h4 style={{ color: '#FF9800', marginBottom: '10px' }}>📑 FTR Document Upload</h4>
              {selectedRecordForBom?.ftrDocument && (
                <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#d4edda', borderRadius: '4px' }}>
                  <small style={{ color: '#155724', display: 'block', fontWeight: 'bold' }}>✓ Current FTR:</small>
                  <button
                    onClick={() => {
                      const path = selectedRecordForBom.ftrDocument.startsWith('/') ? selectedRecordForBom.ftrDocument : `/${selectedRecordForBom.ftrDocument}`;
                      const url = selectedRecordForBom.ftrDocument.startsWith('http')
                        ? selectedRecordForBom.ftrDocument
                        : `http://localhost:5003${path}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    style={{
                      color: '#28a745',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textDecoration: 'underline',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '4px 0'
                    }}
                  >
                    📋 View Current FTR Document
                  </button>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.doc,.docx"
                onChange={(e) => setFtrDocument(e.target.files[0])}
                style={{ width: '100%' }}
              />
              {ftrDocument && (
                <small style={{ color: '#4CAF50', display: 'block', marginTop: '5px' }}>
                  ✓ Selected: {ftrDocument.name}
                </small>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-save" onClick={handleSaveBomMaterials} disabled={loading}>
                {loading ? 'Uploading...' : '💾 Save All'}
              </button>
              <button className="btn-cancel" onClick={() => setShowBomModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPDFModal && (
        <div className="modal-overlay" onClick={() => setShowPDFModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>📊 Configure Production Report</h3>

            <div className="form-section">
              <h4 style={{ color: '#1976d2', marginBottom: '10px' }}>📅 Date Range</h4>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={pdfDateRange.startDate}
                    onChange={(e) => setPdfDateRange({ ...pdfDateRange, startDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>End Date</label>
                  <input
                    type="date"
                    value={pdfDateRange.endDate}
                    onChange={(e) => setPdfDateRange({ ...pdfDateRange, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section" style={{ marginTop: '20px' }}>
              <h4 style={{ color: '#1976d2', marginBottom: '10px' }}>✅ Include in Report</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeProductionDetails}
                    onChange={(e) => setReportOptions({ ...reportOptions, includeProductionDetails: e.target.checked })}
                    style={{ marginRight: '10px', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px' }}>📈 Production Details</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeCellInventory}
                    onChange={(e) => setReportOptions({ ...reportOptions, includeCellInventory: e.target.checked })}
                    style={{ marginRight: '10px', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px' }}>📦 Cell Inventory</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeKPIMetrics}
                    onChange={(e) => setReportOptions({ ...reportOptions, includeKPIMetrics: e.target.checked })}
                    style={{ marginRight: '10px', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px' }}>🎯 KPI Metrics</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeDayWiseSummary}
                    onChange={(e) => setReportOptions({ ...reportOptions, includeDayWiseSummary: e.target.checked })}
                    style={{ marginRight: '10px', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px' }}>📊 Day-wise Summary</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#fff3e0', borderRadius: '5px', cursor: 'pointer', gridColumn: '1 / -1' }}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeRejections}
                    onChange={(e) => setReportOptions({ ...reportOptions, includeRejections: e.target.checked })}
                    style={{ marginRight: '10px', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>❌ Rejection Details</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', cursor: 'pointer', gridColumn: '1 / -1' }}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeBomMaterials}
                    onChange={(e) => setReportOptions({ ...reportOptions, includeBomMaterials: e.target.checked })}
                    style={{ marginRight: '10px', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📦 BOM Materials & Documents</span>
                </label>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn-save" onClick={handleGeneratePDF} style={{ flex: 1, padding: '12px' }}>
                📄 Generate PDF
              </button>
              <button className="btn-save" onClick={handleGenerateExcel} style={{ backgroundColor: '#4CAF50', flex: 1, padding: '12px' }}>
                📊 Generate Excel
              </button>
              <button className="btn-cancel" onClick={() => setShowPDFModal(false)} style={{ padding: '12px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COC Warning Modal */}
      {showCocWarningModal && cocValidation && (
        <div className="modal-overlay" onClick={() => setShowCocWarningModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ COC Material Availability Check</h2>
              <button className="close-btn" onClick={() => setShowCocWarningModal(false)}>×</button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px', padding: '15px', background: cocValidation.valid ? '#d4edda' : '#f8d7da', borderRadius: '8px', border: `2px solid ${cocValidation.valid ? '#28a745' : '#dc3545'}` }}>
                <h3 style={{ margin: '0 0 10px 0', color: cocValidation.valid ? '#155724' : '#721c24' }}>
                  {cocValidation.valid ? '✅ All Materials Available' : '❌ Material Shortage Detected'}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: cocValidation.valid ? '#155724' : '#721c24' }}>
                  Total Production: <strong>{cocValidation.total_production} modules</strong>
                </p>
              </div>

              {cocValidation.warnings && cocValidation.warnings.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ color: '#dc3545', marginBottom: '15px' }}>⚠️ Warnings:</h3>
                  {cocValidation.warnings.map((warning, idx) => (
                    <div key={idx} style={{
                      padding: '12px 15px',
                      background: warning.type === 'NO_COC' ? '#fff3cd' : '#f8d7da',
                      border: `2px solid ${warning.type === 'NO_COC' ? '#ffc107' : '#dc3545'}`,
                      borderRadius: '6px',
                      marginBottom: '10px',
                      fontSize: '14px'
                    }}>
                      <strong>{warning.material}:</strong> {warning.message}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px' }}>📊 Material Status:</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>Material</th>
                      <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>Required</th>
                      <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>Available</th>
                      <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>After Use</th>
                      <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cocValidation.materials && cocValidation.materials.map((material, idx) => (
                      <tr key={idx} style={{ background: material.is_sufficient ? '#fff' : '#ffebee' }}>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{material.material}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>{material.required.toLocaleString()}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>{material.available.toLocaleString()}</td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold', color: material.is_sufficient ? '#28a745' : '#dc3545' }}>
                          {material.is_sufficient ? material.remaining_after.toLocaleString() : `-${material.shortage.toLocaleString()}`}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                          {material.is_sufficient ? '✅' : '❌'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '15px', background: '#e7f3ff', borderRadius: '6px', border: '2px solid #2196F3' }}>
                <strong>💡 Note:</strong> COC materials are consumed automatically from the shared pool using FIFO (First In, First Out) method. Please ensure sufficient COC documents are added before proceeding with production.
              </div>

              <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                {!cocValidation.valid ? (
                  <>
                    <button className="btn-cancel" onClick={() => setShowCocWarningModal(false)} style={{ flex: 1 }}>
                      ❌ Cannot Proceed - Add COC First
                    </button>
                    <button className="btn-save" onClick={() => {
                      setShowCocWarningModal(false);
                      window.open('/#/coc-dashboard', '_blank');
                    }} style={{ flex: 1, background: '#2196F3' }}>
                      📋 Go to COC Dashboard
                    </button>
                  </>
                ) : (
                  <button className="btn-save" onClick={() => setShowCocWarningModal(false)} style={{ flex: 1 }}>
                    ✅ Okay, Continue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COC Selection Modal */}
      <COCSelectionModal
        isOpen={showCOCModal}
        onClose={() => setShowCOCModal(false)}
        onConfirm={handleCOCConfirm}
        productionQty={currentProductionQty}
        companyId={selectedCompany?.id}
        existingSelections={selectedCOCs}
      />

      {/* COC Upload to PDI Modal */}
      {showCocUploadModal && (
        <div className="modal-overlay" onClick={() => setShowCocUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>📤 Upload COC Materials to PDI Batch</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Select COC materials to upload for PDI Done records. Data will be fetched from COC API.
            </p>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
              <h4>PDI Done Records:</h4>
              <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                {selectedCompany.productionRecords
                  ?.filter(r => r.pdi && r.pdi.trim() !== '')
                  .map(record => (
                    <li key={record.id} style={{ marginBottom: '5px' }}>
                      <strong>{record.date}</strong> - PDI: {record.pdi} - Production: {(record.dayProduction || 0) + (record.nightProduction || 0)} modules
                    </li>
                  ))}
              </ul>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>🔍 Search by Invoice Number:</label>
                <input
                  type="text"
                  placeholder="Enter invoice number to filter..."
                  value={cocInvoiceSearch}
                  onChange={(e) => setCocInvoiceSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #007bff',
                    borderRadius: '5px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const API_BASE_URL = getAPIBaseURL();
                    let url = `${API_BASE_URL}/api/coc/list`;
                    if (cocInvoiceSearch.trim()) {
                      url += `?invoice_no=${encodeURIComponent(cocInvoiceSearch.trim())}`;
                    }
                    const response = await axios.get(url);
                    if (response.data && response.data.coc_data) {
                      setAvailableCocData(response.data.coc_data);
                      alert(`✅ Loaded ${response.data.coc_data.length} COC materials${cocInvoiceSearch.trim() ? ` for invoice: ${cocInvoiceSearch}` : ''}`);
                    }
                  } catch (error) {
                    console.error('Failed to load COC data:', error);
                    alert('Failed to load COC data from API');
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  minWidth: '150px',
                  marginTop: '25px'
                }}
                disabled={loading}
              >
                {loading ? 'Loading...' : '🔄 Load COC Data'}
              </button>
            </div>

            {availableCocData.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Available COC Materials ({availableCocData.length}):</h4>
                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '5px', padding: '10px' }}>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Select</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Invoice No</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Material</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Quantity</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableCocData.map((material, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPdiRecords([...selectedPdiRecords, material]);
                                } else {
                                  setSelectedPdiRecords(selectedPdiRecords.filter(m => m !== material));
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>{material.invoice_no || 'N/A'}</td>
                          <td style={{ padding: '8px' }}>{material.material_name || 'N/A'}</td>
                          <td style={{ padding: '8px' }}>{material.lot_number || 'N/A'}</td>
                          <td style={{ padding: '8px' }}>{material.quantity || 'N/A'}</td>
                          <td style={{ padding: '8px' }}>{material.date || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn-save"
                onClick={async () => {
                  if (selectedPdiRecords.length === 0) {
                    alert('Please select at least one material!');
                    return;
                  }

                  try {
                    setLoading(true);
                    const API_BASE_URL = getAPIBaseURL();

                    const response = await axios.post(`${API_BASE_URL}/api/pdi/upload-coc-materials`, {
                      company_id: selectedCompany.id,
                      materials: selectedPdiRecords
                    });

                    if (response.data.success) {
                      alert(`✅ Successfully uploaded ${selectedPdiRecords.length} materials to PDI batch!`);
                      setShowCocUploadModal(false);
                      setSelectedPdiRecords([]);
                      setAvailableCocData([]);
                      await refreshSelectedCompany();
                    }
                  } catch (error) {
                    console.error('Failed to upload:', error);
                    alert(error.response?.data?.error || 'Failed to upload COC materials');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || selectedPdiRecords.length === 0}
              >
                {loading ? 'Uploading...' : `📤 Upload Selected (${selectedPdiRecords.length})`}
              </button>
              <button className="btn-cancel" onClick={() => setShowCocUploadModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk PDI Assignment Modal */}

      {/* PDI Details Modal - BOM Materials & COC Upload */}
      {showPdiDetailsModal && selectedPdiForDetails && (() => {
        const pdiRecords = selectedCompany.productionRecords.filter(r => r.pdi === selectedPdiForDetails);
        const totalProduction = pdiRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0);

        // COC Materials - Independent of production BOM uploads
        // These are the ONLY materials that require COC documentation
        const COC_MATERIALS = [
          { name: 'Solar Cell', unit: 'PCS', spec: '' },
          { name: 'FRONT GLASS', unit: 'PCS', spec: '2376x1128x2.0 mm' },
          { name: 'BACK GLASS', unit: 'PCS', spec: '2376x1128x2.0 mm(3 hole)' },
          { name: 'RIBBON', unit: 'KG', spec: '0.26mm' },
          { name: 'Ribbon(BUSBAR) 4mm', unit: 'KG', spec: '4.0X0.4 mm' },
          { name: 'Ribbon(BUSBAR) 6mm', unit: 'KG', spec: '6.0X0.4 mm' },
          { name: 'FLUX', unit: 'KG', spec: '' },
          { name: 'EPE FRONT', unit: 'sqm', spec: '' },
          { name: 'Aluminium Frame', unit: 'SETS', spec: '' },
          { name: 'SEALENT', unit: 'KG', spec: '' },
          { name: 'JB Potting (A and B)', unit: 'KG', spec: '' },
          { name: 'JUNCTION BOX', unit: 'SETS', spec: '1200mm-' }
        ];

        // Get assigned COCs from production records (COC linking - separate from BOM)
        const assignedCocsMap = {};
        pdiRecords.forEach(record => {
          // Read from cocMaterials (COC linking) not bomMaterials (daily production)
          if (record.cocMaterials && record.cocMaterials.length > 0) {
            record.cocMaterials.forEach(cm => {
              if (cm.invoiceNo) {
                const key = `${cm.materialName}_${cm.invoiceNo}`;
                if (!assignedCocsMap[key]) {
                  assignedCocsMap[key] = {
                    materialName: cm.materialName,
                    lotNumber: cm.invoiceNo,
                    lotBatchNo: cm.lotBatchNo,
                    cocQty: cm.cocQty,
                    invoiceQty: cm.invoiceQty,
                    company: cm.companyName,
                    imagePath: cm.imagePath
                  };
                }
              }
            });
          }
        });

        // Build display list: Show ALL COCs separately (multiple rows for same material)
        const consolidatedBom = [];

        // Get current company short name for matching with MRP data
        // eslint-disable-next-line no-unused-vars
        const getCompanyShortName = (companyName) => {
          if (!companyName) return '';
          const name = companyName.toLowerCase();
          if (name.includes('sterlin') || name.includes('wilson')) return 's&w';
          if (name.includes('larsen') || name.includes('toubro') || name.includes('l&t')) return 'l&t';
          if (name.includes('rays')) return 'rays power';
          return name;
        };
        // getCompanyShortName available for future use

        // Helper function to find assigned COC data from MRP API
        const getAssignedCocForMaterial = (materialName, pdiNumber) => {
          // Normalize material name for matching with MRP API material_name
          const normalizeMatName = (name) => {
            if (!name) return '';
            const lower = name.toLowerCase().trim();
            // Map BOM table names to MRP API material names
            if (lower.includes('cell')) return 'solar cell';
            if (lower.includes('front glass') || lower.includes('back glass') || lower === 'glass') return 'glass';
            if (lower.includes('ribbon') || lower.includes('busbar')) return 'ribbon';
            if (lower.includes('flux')) return 'flux';
            if (lower.includes('epe')) return 'epe';
            if (lower.includes('frame') || lower.includes('aluminium')) return 'aluminium frame';
            if (lower.includes('sealent') || lower.includes('sealant')) return 'sealent';
            if (lower.includes('potting')) return 'jb potting';
            if (lower.includes('junction') || (lower.includes('jb') && !lower.includes('potting'))) return 'junction box';
            if (lower.includes('rfid')) return 'rfid';
            if (lower.includes('eva')) return 'eva';
            return lower;
          };

          const normalizedMaterial = normalizeMatName(materialName);

          // Map company name for MRP API matching
          const companyMap = {
            'Sterlin and Wilson': 'S&W',
            'Larsen & Toubro': 'L&T',
            'Rays Power': 'Rays Power'
          };
          const mrpCompanyName = companyMap[selectedCompany?.name] || selectedCompany?.name;

          // Filter by company, material, and PDI
          return assignedCocData.filter(rec => {
            const recMaterial = normalizeMatName(rec.material_name);
            const recPdi = (rec.pdi_no || '').toLowerCase();
            const targetPdi = (pdiNumber || '').toLowerCase();

            // Match company (assigned_to field from MRP API)
            const companyMatch = rec.assigned_to === mrpCompanyName;

            // Match material
            const materialMatch = recMaterial === normalizedMaterial;

            // Match PDI - flexible matching for Lot 1 = PDI-1, etc.
            // Extract number from PDI format: "PDI-1" -> "1", "Lot 1" -> "1", "Lot 2.2" -> "2.2"
            const extractPdiNum = (pdi) => {
              const match = pdi.match(/(\d+\.?\d*)/);
              return match ? match[1] : pdi;
            };
            const targetNum = extractPdiNum(targetPdi);
            const recNum = extractPdiNum(recPdi);
            const pdiMatch = targetNum === recNum ||
              recPdi.includes(`lot ${targetNum}`) ||
              recPdi.includes(`pdi-${targetNum}`) ||
              targetPdi.includes(`lot ${recNum}`);

            return companyMatch && materialMatch && pdiMatch;
          });
        };

        // First, collect all unique material-invoice combinations from COC linking
        const materialCocPairs = [];
        pdiRecords.forEach(record => {
          if (record.cocMaterials && record.cocMaterials.length > 0) {
            record.cocMaterials.forEach(cm => {
              if (cm.invoiceNo) {
                const key = `${cm.materialName}_${cm.invoiceNo}`;
                const exists = materialCocPairs.find(p => p.key === key);
                if (!exists) {
                  materialCocPairs.push({
                    key,
                    materialName: cm.materialName,
                    lotNumber: cm.invoiceNo,
                    lotBatchNo: cm.lotBatchNo,
                    cocQty: cm.cocQty,
                    invoiceQty: cm.invoiceQty,
                    company: cm.companyName,
                    imagePath: cm.imagePath
                  });
                }
              }
            });
          }
        });

        // Now create consolidated list showing each COC as separate row
        COC_MATERIALS.forEach(material => {
          // Find all COCs for this material - match by base name for busbar
          const baseName = material.name.replace(' 4mm', '').replace(' 6mm', '');
          const assignedCocs = materialCocPairs.filter(bm => {
            const bmNameLower = bm.materialName.toLowerCase();
            const materialNameLower = material.name.toLowerCase();
            // baseName available for extended matching if needed

            // For Ribbon(BUSBAR) 4mm and 6mm, match by spec
            if (materialNameLower.includes('busbar') && materialNameLower.includes('4mm')) {
              return bmNameLower.includes('busbar') && (bmNameLower.includes('4.0') || bmNameLower.includes('4mm'));
            }
            if (materialNameLower.includes('busbar') && materialNameLower.includes('6mm')) {
              return bmNameLower.includes('busbar') && (bmNameLower.includes('6.0') || bmNameLower.includes('6mm'));
            }

            // Default matching
            return bm.materialName === material.name ||
              bm.materialName.includes(baseName) ||
              baseName.includes(bm.materialName);
          });

          // Get assigned COC data from MRP API for this material
          const mrpAssignedCocs = getAssignedCocForMaterial(material.name, selectedPdiForDetails);

          if (assignedCocs.length > 0) {
            // Add each COC as separate row with spec from COC_MATERIALS
            assignedCocs.forEach(coc => {
              // Find matching MRP data for this invoice
              const mrpMatch = mrpAssignedCocs.find(m =>
                m.invoice_no === coc.lotNumber ||
                m.lot_batch_no === coc.lotBatchNo
              );

              consolidatedBom.push({
                ...coc,
                spec: material.spec || coc.spec || '',
                mrpRemainingQty: mrpMatch?.remaining_qty || null,
                mrpPdiNo: mrpMatch?.pdi_no || null,
                mrpIsExhausted: mrpMatch?.is_exhausted || false
              });
            });
          } else {
            // No local COC assigned - show MRP assigned COCs as separate rows
            // This shows what's assigned in MRP for this material/PDI
            if (mrpAssignedCocs.length > 0) {
              // Show each MRP assigned COC as a separate row
              mrpAssignedCocs.forEach(mrpCoc => {
                consolidatedBom.push({
                  materialName: material.name,
                  unit: material.unit,
                  spec: material.spec || '',
                  // Use MRP data for these columns
                  lotNumber: mrpCoc.invoice_no || null,
                  lotBatchNo: mrpCoc.lot_batch_no || null,
                  cocQty: mrpCoc.remaining_qty || null, // Remaining qty as COC qty
                  invoiceQty: null,
                  imagePath: null,
                  // MRP specific data
                  mrpRemainingQty: mrpCoc.remaining_qty || 0,
                  mrpPdiNo: mrpCoc.pdi_no || null,
                  mrpIsExhausted: mrpCoc.is_exhausted || false,
                  isFromMrp: true // Flag to show this is MRP data, not local
                });
              });
            } else {
              // No COC assigned anywhere - show empty row
              consolidatedBom.push({
                materialName: material.name,
                unit: material.unit,
                spec: material.spec || '',
                lotNumber: null,
                cocQty: null,
                invoiceQty: null,
                imagePath: null,
                mrpRemainingQty: null,
                mrpPdiNo: null,
                isFromMrp: false
              });
            }
          }
        });

        return (
          <div className="modal-overlay" onClick={() => setShowPdiDetailsModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3>📋 {selectedPdiForDetails} - BOM Materials & COC Details</h3>

              {/* MRP Data Status Indicator */}
              {loadingAssignedCoc ? (
                <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px', marginBottom: '10px', textAlign: 'center' }}>
                  ⏳ Loading COC assignments from MRP...
                </div>
              ) : assignedCocData.length > 0 && (
                <div style={{ padding: '10px', backgroundColor: '#d4edda', borderRadius: '5px', marginBottom: '10px', fontSize: '12px' }}>
                  ✅ <strong>MRP Data Loaded:</strong> {assignedCocData.length} COC assignments found |
                  Data shows remaining quantities per material assigned to PDIs (Lot 1 = PDI-1, Lot 2 = PDI-2, etc.)
                </div>
              )}

              <div style={{ padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '5px', marginBottom: '20px', border: '2px solid #28a745' }}>
                <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Total Records:</strong> {pdiRecords.length} days</p>
                <p style={{ margin: '5px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong>Total Production:</strong>
                  {editingPdiProduction ? (
                    <>
                      <input
                        type="number"
                        value={tempPdiProduction}
                        onChange={(e) => setTempPdiProduction(e.target.value)}
                        style={{ width: '100px', padding: '4px', border: '1px solid #ccc', borderRadius: '3px' }}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          setPdiProductionOverrides({ ...pdiProductionOverrides, [selectedPdiForDetails]: parseInt(tempPdiProduction) || totalProduction });
                          setEditingPdiProduction(false);
                        }}
                        style={{ padding: '4px 8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingPdiProduction(false)}
                        style={{ padding: '4px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 'bold', color: pdiProductionOverrides[selectedPdiForDetails] ? '#ff6b00' : '#000' }}>
                        {pdiProductionOverrides[selectedPdiForDetails] || totalProduction} modules
                        {pdiProductionOverrides[selectedPdiForDetails] && ' (edited)'}
                      </span>
                      <button
                        onClick={() => {
                          setTempPdiProduction((pdiProductionOverrides[selectedPdiForDetails] || totalProduction).toString());
                          setEditingPdiProduction(true);
                        }}
                        style={{ padding: '4px 8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}
                      >
                        ✏️ Edit
                      </button>
                      {pdiProductionOverrides[selectedPdiForDetails] && (
                        <button
                          onClick={() => {
                            const newOverrides = { ...pdiProductionOverrides };
                            delete newOverrides[selectedPdiForDetails];
                            setPdiProductionOverrides(newOverrides);
                          }}
                          style={{ padding: '4px 8px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Reset
                        </button>
                      )}
                    </>
                  )}
                </p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Date Range:</strong> {pdiRecords[0]?.date} to {pdiRecords[pdiRecords.length - 1]?.date}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => {
                      const wattage = pdiRecords[0]?.wattage || '625wp';
                      calculateRequiredCocs(selectedPdiForDetails, wattage);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}
                    disabled={loadingRequiredCocs}
                  >
                    {loadingRequiredCocs ? '⏳ Calculating...' : '🔍 Show Required COCs Report'}
                  </button>
                  <button
                    onClick={generateCOCExcelReport}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                    disabled={requiredCocsReport.length === 0}
                  >
                    📊 Download Excel Report
                  </button>
                </div>
              </div>

              {/* Required COCs Report Section */}
              {requiredCocsReport.length > 0 && (
                <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '2px solid #FF9800' }}>
                  <h4 style={{ marginTop: 0, color: '#FF6F00' }}>📊 Required COCs for {selectedPdiForDetails}</h4>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                    Based on <strong>{totalProduction} modules</strong> production
                  </p>

                  {requiredCocsReport.map((req, idx) => (
                    <div key={idx} style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #dee2e6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#1976d2' }}>{req.materialName}</strong>
                          {req.productType && <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>({req.productType})</span>}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>
                          Required: {req.requiredQty} <span style={{ fontSize: '10px', color: '#666' }}>({req.perModuleQty} per module)</span>
                        </div>
                      </div>

                      {/* Available COCs by Company */}
                      {Object.keys(req.availableCocs).length > 0 ? (
                        <div>
                          {Object.entries(req.availableCocs).map(([company, cocs]) => {
                            const totalAvailable = cocs.reduce((sum, coc) => sum + coc.cocQty, 0);
                            const isEnough = totalAvailable >= req.requiredQty;

                            return (
                              <div key={company} style={{ marginTop: '10px', padding: '10px', backgroundColor: isEnough ? '#e8f5e9' : '#ffebee', borderRadius: '4px', border: `1px solid ${isEnough ? '#4caf50' : '#f44336'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <strong style={{ fontSize: '12px', color: '#333' }}>{company}</strong>
                                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: isEnough ? '#4caf50' : '#f44336' }}>
                                    Available: {totalAvailable} {isEnough ? '✅' : '⚠️'}
                                  </span>
                                </div>

                                {/* Individual COCs */}
                                <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                  {cocs.map((coc, cocIdx) => (
                                    <div key={cocIdx} style={{ padding: '5px', backgroundColor: 'white', marginBottom: '5px', borderRadius: '3px', fontSize: '11px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Invoice: <strong>{coc.invoiceNo}</strong></span>
                                        <span>Qty: <strong>{coc.cocQty}</strong></span>
                                      </div>
                                      {coc.lotBatchNo && <div style={{ color: '#666' }}>Lot: {coc.lotBatchNo}</div>}
                                      {coc.invoiceDate && <div style={{ color: '#666' }}>Date: {coc.invoiceDate}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px', textAlign: 'center', color: '#d32f2f', fontSize: '12px' }}>
                          ❌ No COC available in database
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* OLD BOM Table - Hidden, using new MRP table below */}
              {false && (
                <><h4 style={{ marginTop: '20px', marginBottom: '15px' }}>📦 BOM Materials for Complete PDI:</h4>
                  {consolidatedBom.length > 0 ? (
                    <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #dee2e6' }}>
                      <table style={{ width: '100%', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#e9ecef' }}>
                            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #dee2e6' }}>Material</th>
                            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #dee2e6' }}>Specification</th>
                            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #dee2e6' }}>Invoice No</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>COC Qty</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>Used Qty</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>Gap</th>
                            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #dee2e6' }}>Used in PDI</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>Image</th>
                            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>Unassign</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consolidatedBom.map((bm, idx) => {
                            const materialLower = bm.materialName.toLowerCase();

                            // Use edited production quantity if available
                            const actualProduction = pdiProductionOverrides[selectedPdiForDetails] || totalProduction;

                            // Calculate used quantity based on production
                            let usedQty = 0;
                            if (materialLower.includes('cell')) {
                              usedQty = actualProduction * 66;
                            } else if (materialLower.includes('glass')) {
                              usedQty = actualProduction * 1;
                            } else if (materialLower.includes('ribbon') && !materialLower.includes('bus')) {
                              usedQty = actualProduction * 0.212;
                            } else if (materialLower.includes('flux')) {
                              usedQty = actualProduction * 0.02;
                            } else if (materialLower.includes('busbar') && materialLower.includes('4mm')) {
                              usedQty = actualProduction * 0.038;
                            } else if (materialLower.includes('busbar') && materialLower.includes('6mm')) {
                              usedQty = actualProduction * 0.018;
                            } else if (materialLower.includes('epe')) {
                              usedQty = actualProduction * 5.2;
                            } else if (materialLower.includes('frame')) {
                              usedQty = actualProduction * 1; // 1 set = 2 LONG + 2 SHORT combined
                            } else if (materialLower.includes('sealent') || materialLower.includes('sealant') || materialLower.includes('silicone')) {
                              usedQty = actualProduction * 0.35;
                            } else if (materialLower.includes('potting')) {
                              usedQty = actualProduction * 0.021; // A + B combined
                            } else if (materialLower.includes('jb') || materialLower.includes('junction')) {
                              usedQty = actualProduction * 1;
                            } else {
                              usedQty = actualProduction * 1;
                            }

                            usedQty = Math.round(usedQty * 100) / 100;

                            // Calculate individual gap for this specific COC/invoice
                            // Get all COCs for this material in order they were added
                            const allCocsForMaterial = consolidatedBom.filter(item =>
                              item.materialName === bm.materialName && item.lotNumber
                            );

                            // Find index of current COC in the list
                            const currentCocIndex = allCocsForMaterial.findIndex(item =>
                              item.lotNumber === bm.lotNumber
                            );

                            // Calculate how much was consumed by previous COCs
                            let remainingToConsume = usedQty;
                            let individualGap = 0;

                            if (bm.cocQty && bm.lotNumber) {
                              // Calculate consumption for each COC in order
                              for (let i = 0; i <= currentCocIndex; i++) {
                                const cocQty = parseFloat(allCocsForMaterial[i].cocQty) || 0;

                                if (i < currentCocIndex) {
                                  // Previous COCs - subtract their full qty from remaining
                                  remainingToConsume = Math.max(0, remainingToConsume - cocQty);
                                } else {
                                  // Current COC - calculate its individual gap
                                  const consumedFromThis = Math.min(cocQty, remainingToConsume);
                                  individualGap = Math.round((cocQty - consumedFromThis) * 100) / 100;
                                }
                              }
                            }

                            // For display: show individual gap for this COC
                            const gap = individualGap;

                            // Get specification from COC_MATERIALS directly
                            const getSpecFromCOCMaterials = (materialName) => {
                              const COC_SPEC_MAP = {
                                'Solar Cell': '25.30%',
                                'FRONT GLASS': '2376x1128x2.0 mm',
                                'BACK GLASS': '2376x1128x2.0 mm (3 hole)',
                                'RIBBON': '0.26mm',
                                'Ribbon(BUSBAR) 4mm': '4.0X0.4 mm',
                                'Ribbon(BUSBAR) 6mm': '6.0X0.4 mm',
                                'FLUX': '-',
                                'EPE FRONT': '-',
                                'Aluminium Frame': '-',
                                'SEALENT': '-',
                                'JB Potting (A and B)': '-',
                                'JUNCTION BOX': '1200mm'
                              };
                              return COC_SPEC_MAP[materialName] || '-';
                            };

                            // Use spec from bm first, then lookup from COC_SPEC_MAP
                            const specification = bm.spec && bm.spec !== '' ? bm.spec : getSpecFromCOCMaterials(bm.materialName);

                            // COC assignment status available via bm.lotNumber

                            return (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: '500', fontSize: '11px' }}>
                                      {bm.materialName}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #dee2e6', fontSize: '10px', color: '#666' }}>
                                  {specification}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #dee2e6', fontSize: '10px' }}>
                                  {bm.lotNumber || '-'}
                                  {bm.isFromMrp && bm.lotNumber && (
                                    <span style={{ marginLeft: '5px', fontSize: '8px', color: '#28a745' }}>(MRP)</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6', fontWeight: '500' }}>
                                  {bm.isFromMrp ? (
                                    <span style={{ color: '#28a745' }}>{bm.mrpRemainingQty?.toLocaleString() || '-'}</span>
                                  ) : (
                                    bm.cocQty || '-'
                                  )}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                  {usedQty || '-'}
                                </td>
                                <td style={{
                                  padding: '8px',
                                  textAlign: 'center',
                                  border: '1px solid #dee2e6',
                                  fontWeight: '500',
                                  color: bm.isFromMrp
                                    ? (bm.mrpRemainingQty > usedQty ? '#28a745' : '#dc3545')
                                    : (gap >= 0 ? '#28a745' : '#dc3545')
                                }}>
                                  {bm.isFromMrp ? (
                                    // For MRP data: Gap = remaining - used
                                    (() => {
                                      const mrpGap = Math.round((bm.mrpRemainingQty - usedQty) * 100) / 100;
                                      return mrpGap >= 0 ? `+${mrpGap.toLocaleString()}` : mrpGap.toLocaleString();
                                    })()
                                  ) : (
                                    bm.cocQty ? (gap >= 0 ? `+${gap}` : gap) : '-'
                                  )}
                                </td>
                                <td style={{
                                  padding: '8px',
                                  border: '1px solid #dee2e6',
                                  fontSize: '10px'
                                }}>
                                  {/* Show MRP PDI assignment */}
                                  {bm.mrpPdiNo ? (
                                    <span style={{
                                      padding: '3px 8px',
                                      backgroundColor: bm.mrpIsExhausted ? '#dc3545' : '#28a745',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '9px',
                                      fontWeight: '500'
                                    }}>
                                      {bm.mrpPdiNo}
                                    </span>
                                  ) : bm.isFromMrp ? (
                                    <span style={{
                                      padding: '3px 8px',
                                      backgroundColor: '#28a745',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '9px',
                                      fontWeight: '500'
                                    }}>
                                      {selectedPdiForDetails}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                  {bm.imagePath ? (
                                    <button
                                      onClick={() => {
                                        const API_BASE_URL = getAPIBaseURL();
                                        window.open(`${API_BASE_URL}/${bm.imagePath}`, '_blank');
                                      }}
                                      style={{
                                        padding: '3px 8px',
                                        background: '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '10px'
                                      }}
                                    >
                                      📄 View
                                    </button>
                                  ) : '-'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                  {bm.lotNumber && (
                                    <button
                                      onClick={() => handleDeleteBomMaterial(bm)}
                                      style={{
                                        padding: '3px 8px',
                                        background: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                      }}
                                      title="Unassign this COC from PDI"
                                    >
                                      ✖️
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#999', fontStyle: 'italic', fontSize: '12px', padding: '20px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                      No BOM materials uploaded yet. Use the "COC Link" button in the production table to add materials.
                    </p>
                  )}</>
              )}

              {/* NEW: MRP Assigned COC Table - Shows ALL materials with FIFO suggestions */}
              <h4 style={{ marginTop: '30px', marginBottom: '15px', color: '#1976d2' }}>📋 COC Status & FIFO Suggestions (MRP Data)</h4>
              {(() => {
                // Map company name for MRP API matching
                const companyMap = {
                  'Sterlin and Wilson': 'S&W',
                  'Larsen & Toubro': 'L&T',
                  'Rays Power': 'Rays Power'
                };
                const mrpCompanyName = companyMap[selectedCompany?.companyName] || selectedCompany?.companyName;

                // Extract PDI number for matching (PDI-1 -> 1, PDI-2.2 -> 2.2)
                const extractPdiNum = (pdi) => {
                  const match = (pdi || '').match(/(\d+\.?\d*)/);
                  return match ? match[1] : pdi;
                };
                const targetPdiNum = extractPdiNum(selectedPdiForDetails);

                // All MRP material names
                const MRP_MATERIALS = [
                  'Solar Cell', 'Glass', 'Ribbon', 'Flux', 'EPE',
                  'Aluminium Frame', 'Sealent', 'JB Potting', 'Junction Box', 'RFID', 'EVA'
                ];

                // Get records for current PDI
                const pdiRecords = (selectedCompany?.productionRecords || []).filter(r => r.pdi === selectedPdiForDetails);

                // Calculate qty per unit based on material (BOM doesn't store qty, so calculate from production)
                const getQtyMultiplier = (materialName) => {
                  const mat = (materialName || '').toLowerCase();
                  if (mat.includes('cell')) return 66;
                  if (mat.includes('glass')) return 2;
                  if (mat.includes('ribbon') && !mat.includes('busbar')) return 0.268;
                  if (mat.includes('busbar')) return 0.08;
                  if (mat.includes('flux')) return 0.02;
                  if (mat.includes('epe')) return 5.2;
                  if (mat.includes('frame') || mat.includes('aluminium')) return 1;
                  if (mat.includes('sealent') || mat.includes('sealant')) return 0.35;
                  if (mat.includes('potting')) return 0.021;
                  if (mat.includes('junction') || mat.includes('jb')) return 1;
                  if (mat.includes('rfid')) return 1;
                  if (mat.includes('eva')) return 2;
                  return 1;
                };

                // Get companies used in Daily BOM for each material in this PDI (with detailed usage)
                const getBomCompaniesForMaterial = (materialName, includeDetails = false) => {
                  const companies = new Map(); // company -> {qty, brand, details: []}
                  const matLower = materialName.toLowerCase();
                  const qtyMultiplier = getQtyMultiplier(materialName);

                  pdiRecords.forEach(record => {
                    if (record.bomMaterials && Array.isArray(record.bomMaterials)) {
                      record.bomMaterials.forEach(bom => {
                        const bomMatLower = (bom.materialName || '').toLowerCase();
                        // Match material names
                        const isMatch = bomMatLower.includes(matLower) || matLower.includes(bomMatLower) ||
                          (matLower.includes('cell') && bomMatLower.includes('cell')) ||
                          (matLower.includes('glass') && bomMatLower.includes('glass')) ||
                          (matLower.includes('ribbon') && (bomMatLower.includes('ribbon') || bomMatLower.includes('busbar'))) ||
                          (matLower.includes('flux') && bomMatLower.includes('flux')) ||
                          (matLower.includes('epe') && bomMatLower.includes('epe')) ||
                          (matLower.includes('frame') && (bomMatLower.includes('frame') || bomMatLower.includes('aluminium'))) ||
                          (matLower.includes('sealent') && (bomMatLower.includes('sealent') || bomMatLower.includes('sealant'))) ||
                          (matLower.includes('potting') && bomMatLower.includes('potting')) ||
                          (matLower.includes('junction') && (bomMatLower.includes('junction') || bomMatLower.includes('jb')));

                        if (isMatch && bom.company) {
                          const existing = companies.get(bom.company) || { qty: 0, brand: bom.company, details: [] };

                          // Calculate qty from production (Day + Night) for this record
                          const dayProd = parseInt(record.dayProduction) || 0;
                          const nightProd = parseInt(record.nightProduction) || 0;
                          const totalProd = dayProd + nightProd;

                          // Use shift-specific production if shift is specified, else use total
                          let shiftProd = totalProd;
                          let shiftName = 'total';
                          if (bom.shift === 'day' && dayProd > 0) {
                            shiftProd = dayProd;
                            shiftName = 'day';
                          } else if (bom.shift === 'night' && nightProd > 0) {
                            shiftProd = nightProd;
                            shiftName = 'night';
                          }

                          const calculatedQty = Math.round(shiftProd * qtyMultiplier * 100) / 100;

                          console.log(`[BOM DEBUG] Material: ${bom.materialName}, Company: ${bom.company}, Date: ${record.date}, Shift: ${bom.shift}, DayProd: ${dayProd}, NightProd: ${nightProd}, UsedProd: ${shiftProd}, Multiplier: ${qtyMultiplier}, CalcQty: ${calculatedQty}, Efficiency: ${bom.cellEfficiency || '-'}`);

                          existing.qty += calculatedQty;

                          // Add detail record
                          if (includeDetails) {
                            existing.details.push({
                              date: record.date,
                              pdiNo: record.pdi || record.pdiNumber,
                              materialName: bom.materialName,
                              qty: calculatedQty,
                              shift: shiftName,
                              production: shiftProd,
                              cellEfficiency: bom.cellEfficiency || null,  // Cell efficiency if Solar Cell
                              lotNo: bom.lotBatchNo || bom.lotNo || '-',
                              invoiceNo: bom.invoiceNo || '-'
                            });
                          }
                          companies.set(bom.company, existing);
                        }
                      });
                    }
                  });

                  return Array.from(companies.entries()).map(([company, data]) => ({
                    company,
                    usedQty: data.qty,
                    details: data.details || []
                  }));
                };

                // Filter assigned COCs for this company and PDI
                const getAssignedCocs = (materialName) => {
                  return assignedCocData.filter(coc => {
                    const cocPdiNum = extractPdiNum(coc.pdi_no);
                    const companyMatch = coc.assigned_to === mrpCompanyName;
                    const pdiMatch = cocPdiNum === targetPdiNum;
                    const materialMatch = coc.material_name?.toLowerCase() === materialName.toLowerCase();
                    return companyMatch && pdiMatch && materialMatch;
                  });
                };

                // Get FIFO suggestions from Master COC data (oldest first by invoice_date, matched by BOM company/brand)
                const getFifoSuggestions = (materialName) => {
                  if (!masterCocData || masterCocData.length === 0) {
                    console.log('⚠️ No master COC data loaded');
                    return [];
                  }

                  // Get companies used in BOM for this material
                  const bomCompanies = getBomCompaniesForMaterial(materialName);

                  // Get all assigned invoice numbers to exclude
                  const assignedInvoices = assignedCocData.map(c => c.invoice_no);

                  // Sort master data by invoice_date (FIFO - oldest first)
                  const sortedMasterData = [...masterCocData].sort((a, b) => {
                    const dateA = new Date(a.invoice_date || a.entry_date || '2099-01-01');
                    const dateB = new Date(b.invoice_date || b.entry_date || '2099-01-01');
                    return dateA - dateB;
                  });

                  const suggestions = [];

                  // If BOM companies found, get suggestion for each company
                  if (bomCompanies.length > 0) {
                    bomCompanies.forEach(({ company, usedQty }) => {
                      const suggestion = sortedMasterData.find(coc => {
                        const cocMaterial = (coc.material_name || '').toLowerCase();
                        const targetMaterial = materialName.toLowerCase();
                        const materialMatch = cocMaterial === targetMaterial ||
                          cocMaterial.includes(targetMaterial) ||
                          targetMaterial.includes(cocMaterial);
                        const notAssigned = !assignedInvoices.includes(coc.invoice_no);
                        const hasQty = parseFloat(coc.coc_qty || 0) > 0;
                        // Match brand/company from BOM
                        const brandMatch = (coc.brand || '').toLowerCase().includes(company.toLowerCase()) ||
                          company.toLowerCase().includes((coc.brand || '').toLowerCase().substring(0, 10));
                        return materialMatch && notAssigned && hasQty && brandMatch;
                      });

                      if (suggestion) {
                        suggestions.push({
                          ...suggestion,
                          bomCompany: company,
                          bomUsedQty: usedQty
                        });
                      }
                    });
                  }

                  // If no BOM-matched suggestions, get general FIFO suggestion
                  if (suggestions.length === 0) {
                    const generalSuggestion = sortedMasterData.find(coc => {
                      const cocMaterial = (coc.material_name || '').toLowerCase();
                      const targetMaterial = materialName.toLowerCase();
                      const materialMatch = cocMaterial === targetMaterial ||
                        cocMaterial.includes(targetMaterial) ||
                        targetMaterial.includes(cocMaterial);
                      const notAssigned = !assignedInvoices.includes(coc.invoice_no);
                      const hasQty = parseFloat(coc.coc_qty || 0) > 0;
                      return materialMatch && notAssigned && hasQty;
                    });

                    if (generalSuggestion) {
                      suggestions.push(generalSuggestion);
                    }
                  }

                  return suggestions;
                };

                // Calculate used qty based on production for each material
                const actualProduction = pdiProductionOverrides[selectedPdiForDetails] || totalProduction;
                const getUsedQtyForMaterial = (materialName) => {
                  const mat = (materialName || '').toLowerCase();
                  if (mat.includes('solar cell') || mat.includes('cell')) return actualProduction * 66;
                  if (mat.includes('glass')) return actualProduction * 2;
                  if (mat.includes('ribbon')) return actualProduction * 0.268;
                  if (mat.includes('flux')) return actualProduction * 0.02;
                  if (mat.includes('epe')) return actualProduction * 5.2;
                  if (mat.includes('aluminium') || mat.includes('frame')) return actualProduction * 1;
                  if (mat.includes('sealent') || mat.includes('sealant')) return actualProduction * 0.35;
                  if (mat.includes('jb potting') || mat.includes('potting')) return actualProduction * 0.021;
                  if (mat.includes('junction') || mat.includes('box')) return actualProduction * 1;
                  if (mat.includes('rfid')) return actualProduction * 1;
                  if (mat.includes('eva')) return actualProduction * 2;
                  return actualProduction * 1;
                };

                // Export COC Suggestion Report to Excel with detailed reasons - COLORFUL VERSION
                const exportCocSuggestionReport = () => {
                  // Import xlsx-js-style for colorful Excel
                  const XLSXStyle = require('xlsx-js-style');

                  const reportData = [];
                  const statusColors = []; // Track status for coloring

                  MRP_MATERIALS.forEach(material => {
                    const assignedCocs = getAssignedCocs(material);
                    const fifoSuggestions = getFifoSuggestions(material);
                    const bomCompanies = getBomCompaniesForMaterial(material, true);
                    const usedQty = Math.round(getUsedQtyForMaterial(material) * 100) / 100;
                    const totalAssignedQty = assignedCocs.reduce((sum, coc) => sum + (parseFloat(coc.remaining_qty) || 0), 0);
                    const gap = Math.round((totalAssignedQty - usedQty) * 100) / 100;

                    if (fifoSuggestions.length > 0) {
                      fifoSuggestions.forEach((suggestion, idx) => {
                        const matchingBom = bomCompanies.find(bc =>
                          (suggestion.brand || '').toLowerCase().includes(bc.company.toLowerCase()) ||
                          bc.company.toLowerCase().includes((suggestion.brand || '').toLowerCase().substring(0, 10))
                        );

                        let reason = '';
                        let reasonType = 'bom'; // bom, fifo, none
                        let efficiencyInfo = '';

                        if (matchingBom && matchingBom.details && matchingBom.details.length > 0) {
                          const usageDetails = matchingBom.details.map(d => {
                            const unit = material.toLowerCase().includes('cell') ? 'pcs' :
                              (material.toLowerCase().includes('glass') || material.toLowerCase().includes('frame') || material.toLowerCase().includes('junction') || material.toLowerCase().includes('rfid')) ? 'pcs' : 'kg';
                            const effStr = d.cellEfficiency ? ` [Eff: ${d.cellEfficiency}%]` : '';
                            return `${d.date} (${d.shift || 'both'}): ${d.production} modules → ${d.qty} ${unit}${effStr}`;
                          }).slice(0, 5).join(' | ');
                          const totalUnit = material.toLowerCase().includes('cell') ? 'pcs' :
                            (material.toLowerCase().includes('glass') || material.toLowerCase().includes('frame') || material.toLowerCase().includes('junction') || material.toLowerCase().includes('rfid')) ? 'pcs' : 'kg';
                          reason = `✅ BOM MATCH: ${matchingBom.company} - Total ${Math.round(matchingBom.usedQty * 100) / 100} ${totalUnit} used [${usageDetails}]`;

                          // Extract efficiency info for Solar Cell
                          if (material === 'Solar Cell') {
                            const efficiencies = matchingBom.details
                              .filter(d => d.cellEfficiency)
                              .map(d => `${d.date}: ${d.cellEfficiency}%`);
                            efficiencyInfo = efficiencies.length > 0 ? efficiencies.join(' | ') : '-';
                          }
                        } else if (suggestion.bomCompany) {
                          reason = `📦 Brand Match: ${suggestion.bomCompany} used ${suggestion.bomUsedQty || '-'} qty`;
                        } else {
                          reason = '📅 FIFO: Oldest available stock (no specific BOM match)';
                          reasonType = 'fifo';
                        }

                        reportData.push([
                          selectedPdiForDetails,
                          mrpCompanyName,
                          material,
                          idx + 1,
                          suggestion.invoice_no || '-',
                          suggestion.lot_batch_no || '-',
                          suggestion.invoice_date || '-',
                          suggestion.coc_qty || 0,
                          suggestion.brand?.substring(0, 35) || '-',
                          material === 'Solar Cell' ? efficiencyInfo : '-',  // Cell Efficiency column
                          reason,
                          matchingBom?.company || suggestion.bomCompany || '-',
                          matchingBom ? Math.round(matchingBom.usedQty * 100) / 100 : (suggestion.bomUsedQty || 0),
                          assignedCocs.map(c => c.invoice_no).join(', ') || 'Not Assigned',
                          totalAssignedQty,
                          usedQty,
                          gap,
                          gap >= 0 ? '✅ SUFFICIENT' : '⚠️ NEED MORE'
                        ]);
                        statusColors.push({ gap, reasonType, hasSuggestion: true });
                      });
                    } else {
                      reportData.push([
                        selectedPdiForDetails,
                        mrpCompanyName,
                        material,
                        '-',
                        '❌ No suggestion',
                        '-',
                        '-',
                        0,
                        '-',
                        '-',  // Cell Efficiency column (empty for no suggestion)
                        bomCompanies.length > 0 ?
                          `⚠️ No matching COC for: ${bomCompanies.map(b => b.company).join(', ')}` :
                          '❌ No BOM data - Load FIFO Suggestions first',
                        bomCompanies.map(b => b.company).join(', ') || '-',
                        bomCompanies.reduce((sum, b) => sum + b.usedQty, 0) || 0,
                        assignedCocs.map(c => c.invoice_no).join(', ') || 'Not Assigned',
                        totalAssignedQty,
                        usedQty,
                        gap,
                        gap >= 0 ? '✅ SUFFICIENT' : '⚠️ NEED MORE'
                      ]);
                      statusColors.push({ gap, reasonType: 'none', hasSuggestion: false });
                    }
                  });

                  // Create workbook with styling
                  const wb = XLSXStyle.utils.book_new();

                  // Headers
                  const headers = [
                    'PDI No', 'Company', 'Material', 'Suggestion #', 'COC Invoice',
                    'Lot/Batch', 'Invoice Date', 'Available Qty', 'Brand/Company',
                    'CELL EFFICIENCY', 'REASON FOR SUGGESTION', 'BOM Brand', 'BOM Qty Used',
                    'Currently Assigned', 'Assigned Qty', 'Production Used', 'Gap', 'Status'
                  ];

                  // Title row
                  const titleRow = [`COC SUGGESTION REPORT - ${mrpCompanyName} - ${selectedPdiForDetails} - Generated: ${new Date().toLocaleDateString()}`];
                  const emptyRow = [''];

                  // Build worksheet data
                  const wsData = [titleRow, emptyRow, headers, ...reportData];
                  const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

                  // Merge title cell
                  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }];

                  // Style definitions
                  const titleStyle = {
                    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '1976D2' } },
                    alignment: { horizontal: 'center', vertical: 'center' }
                  };

                  const headerStyle = {
                    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '2E7D32' } },
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                    border: {
                      top: { style: 'thin', color: { rgb: '000000' } },
                      bottom: { style: 'thin', color: { rgb: '000000' } },
                      left: { style: 'thin', color: { rgb: '000000' } },
                      right: { style: 'thin', color: { rgb: '000000' } }
                    }
                  };

                  const reasonHeaderStyle = {
                    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: 'FF6F00' } },
                    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                    border: {
                      top: { style: 'thin', color: { rgb: '000000' } },
                      bottom: { style: 'thin', color: { rgb: '000000' } },
                      left: { style: 'thin', color: { rgb: '000000' } },
                      right: { style: 'thin', color: { rgb: '000000' } }
                    }
                  };

                  // Apply title style
                  if (ws['A1']) ws['A1'].s = titleStyle;

                  // Apply header styles (row 3, index 2)
                  const colLetters = 'ABCDEFGHIJKLMNOPQR'.split('');  // Added R for 18 columns
                  colLetters.forEach((col, idx) => {
                    const cell = ws[`${col}3`];
                    if (cell) {
                      // Efficiency column (9) yellow, Reason column (10) orange
                      if (idx === 9) {
                        cell.s = {
                          font: { bold: true, sz: 11, color: { rgb: '000000' } },
                          fill: { fgColor: { rgb: 'FFD600' } },  // Yellow for efficiency
                          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
                        };
                      } else if (idx === 10) {
                        cell.s = reasonHeaderStyle;  // Orange for reason
                      } else {
                        cell.s = headerStyle;
                      }
                    }
                  });

                  // Apply data row styles
                  reportData.forEach((row, rowIdx) => {
                    const excelRow = rowIdx + 4; // Data starts at row 4
                    const statusInfo = statusColors[rowIdx];

                    // Base cell style
                    const baseStyle = {
                      alignment: { vertical: 'center', wrapText: true },
                      border: {
                        top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                        right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                      }
                    };

                    // Alternating row colors
                    const rowBg = rowIdx % 2 === 0 ? 'F5F5F5' : 'FFFFFF';

                    colLetters.forEach((col, colIdx) => {
                      const cellRef = `${col}${excelRow}`;
                      if (ws[cellRef]) {
                        let cellStyle = {
                          ...baseStyle,
                          fill: { fgColor: { rgb: rowBg } }
                        };

                        // Special styling for specific columns
                        if (colIdx === 9) { // Cell Efficiency column - yellow highlight
                          cellStyle.fill = { fgColor: { rgb: 'FFF9C4' } }; // Light yellow
                          cellStyle.font = { bold: true, color: { rgb: 'E65100' } };
                          cellStyle.alignment = { horizontal: 'center', vertical: 'center' };
                        }

                        if (colIdx === 10) { // Reason column - highlight
                          if (statusInfo.hasSuggestion) {
                            cellStyle.fill = { fgColor: { rgb: 'E8F5E9' } }; // Light green
                            cellStyle.font = { sz: 10, color: { rgb: '1B5E20' } };
                          } else {
                            cellStyle.fill = { fgColor: { rgb: 'FFEBEE' } }; // Light red
                            cellStyle.font = { sz: 10, color: { rgb: 'B71C1C' } };
                          }
                        }

                        if (colIdx === 16) { // Gap column
                          if (statusInfo.gap >= 0) {
                            cellStyle.fill = { fgColor: { rgb: 'C8E6C9' } }; // Green
                            cellStyle.font = { bold: true, color: { rgb: '1B5E20' } };
                          } else {
                            cellStyle.fill = { fgColor: { rgb: 'FFCDD2' } }; // Red
                            cellStyle.font = { bold: true, color: { rgb: 'B71C1C' } };
                          }
                        }

                        if (colIdx === 17) { // Status column
                          if (statusInfo.gap >= 0) {
                            cellStyle.fill = { fgColor: { rgb: '4CAF50' } }; // Green
                            cellStyle.font = { bold: true, color: { rgb: 'FFFFFF' } };
                          } else {
                            cellStyle.fill = { fgColor: { rgb: 'F44336' } }; // Red
                            cellStyle.font = { bold: true, color: { rgb: 'FFFFFF' } };
                          }
                          cellStyle.alignment = { horizontal: 'center', vertical: 'center' };
                        }

                        if (colIdx === 4) { // Invoice column - blue
                          cellStyle.font = { color: { rgb: '1565C0' }, bold: true };
                        }

                        if (colIdx === 2) { // Material column - bold
                          cellStyle.font = { bold: true };
                        }

                        ws[cellRef].s = cellStyle;
                      }
                    });
                  });

                  // Column widths (18 columns now)
                  ws['!cols'] = [
                    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
                    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 25 },
                    { wch: 55 }, { wch: 18 }, { wch: 10 },
                    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }
                  ];

                  // Row height for header
                  ws['!rows'] = [{ hpt: 30 }, { hpt: 15 }, { hpt: 35 }];

                  XLSXStyle.utils.book_append_sheet(wb, ws, 'COC Suggestions');

                  // Summary sheet
                  const summaryData = [
                    ['📊 SUMMARY REPORT'],
                    [''],
                    ['Category', 'Count', 'Status'],
                    ['Total Materials', MRP_MATERIALS.length, ''],
                    ['With Suggestions', statusColors.filter(s => s.hasSuggestion).length, '✅'],
                    ['Without Suggestions', statusColors.filter(s => !s.hasSuggestion).length, '⚠️'],
                    ['Sufficient Stock', statusColors.filter(s => s.gap >= 0).length, '✅'],
                    ['Need More Stock', statusColors.filter(s => s.gap < 0).length, '❌'],
                    [''],
                    ['Legend:'],
                    ['✅ BOM MATCH', 'COC suggested based on Daily BOM brand usage', ''],
                    ['📅 FIFO', 'Oldest available COC (no specific brand match)', ''],
                    ['❌ No suggestion', 'No matching COC found in system', '']
                  ];

                  const wsSummary = XLSXStyle.utils.aoa_to_sheet(summaryData);
                  wsSummary['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 10 }];

                  // Style summary
                  if (wsSummary['A1']) wsSummary['A1'].s = {
                    font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: '673AB7' } },
                    alignment: { horizontal: 'center' }
                  };
                  wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

                  XLSXStyle.utils.book_append_sheet(wb, wsSummary, 'Summary');

                  XLSXStyle.writeFile(wb, `COC_Report_${mrpCompanyName}_${selectedPdiForDetails}_${new Date().toISOString().split('T')[0]}.xlsx`);
                };

                return (
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px', border: '1px solid #2196F3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>
                        <strong>{mrpCompanyName}</strong> - <strong>Lot {targetPdiNum}</strong> | Production: {actualProduction} modules
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={loadMasterCocData}
                          style={{ padding: '5px 10px', fontSize: '10px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          🔄 Load FIFO Suggestions
                        </button>
                        <button
                          onClick={exportCocSuggestionReport}
                          style={{ padding: '5px 10px', fontSize: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          📊 Export Report
                        </button>
                      </div>
                    </div>
                    <table style={{ width: '100%', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1976d2', color: 'white' }}>
                          <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #1565c0' }}>Material</th>
                          <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #1565c0' }}>Assigned COC</th>
                          <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #1565c0' }}>COC Qty</th>
                          <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #1565c0' }}>Used Qty</th>
                          <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #1565c0' }}>Gap</th>
                          <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #1565c0' }}>FIFO Suggestion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MRP_MATERIALS.map((material, idx) => {
                          const assignedCocs = getAssignedCocs(material);
                          const fifoSuggestions = getFifoSuggestions(material);
                          const bomCompanies = getBomCompaniesForMaterial(material);
                          const usedQty = Math.round(getUsedQtyForMaterial(material) * 100) / 100;

                          // Calculate total assigned qty from Assigned API (remaining_qty field)
                          // Note: remaining_qty shows what's left after usage
                          const totalAssignedQty = assignedCocs.reduce((sum, coc) => {
                            // Assigned API returns remaining_qty (what's left)
                            const qty = parseFloat(coc.remaining_qty) || 0;
                            return sum + qty;
                          }, 0);

                          // Gap = COC Remaining - Used Required
                          // Positive = Extra COC available (green)
                          // Negative = Need more COC (red)
                          const gap = Math.round((totalAssignedQty - usedQty) * 100) / 100;

                          const hasAssigned = assignedCocs.length > 0;
                          const needsMore = !hasAssigned || gap < 0;

                          return (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f5f5f5' }}>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', fontWeight: '500' }}>
                                {material}
                                {needsMore && <span style={{ color: '#dc3545', marginLeft: '5px' }}>⚠️</span>}
                                {bomCompanies.length > 0 && (
                                  <div style={{ fontSize: '8px', color: '#666', marginTop: '3px' }}>
                                    BOM: {bomCompanies.map(c => c.company).join(', ')}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', fontSize: '10px' }}>
                                {hasAssigned ? (
                                  <div>
                                    {assignedCocs.map((coc, i) => (
                                      <div key={i} style={{ marginBottom: i < assignedCocs.length - 1 ? '3px' : 0 }}>
                                        {coc.invoice_no} <span style={{ color: '#666' }}>({coc.lot_batch_no})</span>
                                        <span style={{ color: '#1976d2', marginLeft: '5px', fontSize: '9px' }}>
                                          [{parseFloat(coc.remaining_qty || 0).toLocaleString()}]
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ color: '#999' }}>Not Assigned</span>
                                )}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6', fontWeight: '500', color: hasAssigned ? '#1976d2' : '#999' }}>
                                {hasAssigned ? totalAssignedQty.toLocaleString() : '-'}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                {usedQty.toLocaleString()}
                              </td>
                              <td style={{
                                padding: '8px',
                                textAlign: 'center',
                                border: '1px solid #dee2e6',
                                fontWeight: '500',
                                color: !hasAssigned ? '#999' : (gap >= 0 ? '#28a745' : '#dc3545')
                              }}>
                                {hasAssigned ? (gap >= 0 ? `+${gap.toLocaleString()}` : gap.toLocaleString()) : '-'}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #dee2e6', fontSize: '10px' }}>
                                {needsMore ? (
                                  fifoSuggestions.length > 0 ? (
                                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                      {fifoSuggestions.map((suggestion, sIdx) => (
                                        <div key={sIdx} style={{ backgroundColor: '#fff3cd', padding: '6px', borderRadius: '3px', marginBottom: sIdx < fifoSuggestions.length - 1 ? '5px' : 0 }}>
                                          <strong style={{ color: '#856404' }}>💡 {suggestion.invoice_no}</strong>
                                          {suggestion.bomCompany && (
                                            <span style={{ fontSize: '8px', color: '#28a745', marginLeft: '5px' }}>
                                              (for {suggestion.bomCompany})
                                            </span>
                                          )}
                                          <div style={{ fontSize: '9px', color: '#333', marginTop: '3px' }}>
                                            <strong>Qty:</strong> {parseFloat(suggestion.coc_qty || 0).toLocaleString()}
                                          </div>
                                          <div style={{ fontSize: '8px', color: '#666' }}>
                                            <strong>Lot:</strong> {suggestion.lot_batch_no}
                                          </div>
                                          <div style={{ fontSize: '8px', color: '#666' }}>
                                            <strong>Date:</strong> {suggestion.invoice_date || suggestion.entry_date || '-'}
                                          </div>
                                          <div style={{ fontSize: '8px', color: '#999', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={suggestion.brand}>
                                            <strong>Brand:</strong> {suggestion.brand ? suggestion.brand.substring(0, 20) + (suggestion.brand.length > 20 ? '...' : '') : '-'}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#999', fontSize: '9px' }}>Click "Load FIFO" to see suggestions</span>
                                  )
                                ) : (
                                  <span style={{ color: '#28a745' }}>✅ Sufficient</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '5px', border: '2px solid #2196F3' }}>
                <h4 style={{ marginTop: 0 }}>📑 Generate COC Report with PDFs</h4>
                <p style={{ fontSize: '13px', color: '#666' }}>Generate consolidated COC report with all PDF documents indexed</p>
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const API_BASE_URL = getAPIBaseURL();

                      // Collect all unique COC invoice numbers from cocMaterials AND bomMaterials
                      const cocInvoices = new Set();
                      pdiRecords.forEach(record => {
                        // Check cocMaterials (COC linking)
                        record.cocMaterials?.forEach(cm => {
                          if (cm.invoiceNo) {
                            cocInvoices.add(cm.invoiceNo);
                          }
                          if (cm.lotNumber) {
                            cocInvoices.add(cm.lotNumber);
                          }
                        });
                        // Also check bomMaterials for backward compatibility
                        record.bomMaterials?.forEach(bm => {
                          if (bm.lotNumber) {
                            cocInvoices.add(bm.lotNumber);
                          }
                          if (bm.invoiceNo) {
                            cocInvoices.add(bm.invoiceNo);
                          }
                        });
                      });

                      // Also check consolidatedBom from the table
                      consolidatedBom.forEach(bm => {
                        if (bm.lotNumber) {
                          cocInvoices.add(bm.lotNumber);
                        }
                      });

                      if (cocInvoices.size === 0) {
                        alert('⚠️ No COC materials found for this PDI batch');
                        setLoading(false);
                        return;
                      }

                      // Generate COC report with PDFs
                      const response = await axios.post(`${API_BASE_URL}/api/coc/generate-pdi-report`, {
                        pdi_number: selectedPdiForDetails,
                        company_id: selectedCompany.id,
                        invoice_numbers: Array.from(cocInvoices),
                        include_pdfs: true
                      }, {
                        responseType: 'blob'
                      });

                      // Download the generated report
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `COC_Report_${selectedPdiForDetails}_${new Date().toISOString().split('T')[0]}.pdf`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);

                      alert(`✅ COC Report generated with ${cocInvoices.size} documents!`);
                    } catch (error) {
                      console.error('Failed to generate COC report:', error);
                      alert('❌ Failed to generate COC report: ' + (error.response?.data?.error || error.message));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px',
                    width: '100%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  disabled={loading}
                >
                  {loading ? '⏳ Generating Report...' : '📄 Generate COC Report with PDFs'}
                </button>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button className="btn-cancel" onClick={() => setShowPdiDetailsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Material COC Selection Modal */}
      {showMaterialCocModal && selectedMaterial && (
        <div className="modal-overlay" onClick={() => setShowMaterialCocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>📦 Select COC for: {selectedMaterial}</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              Click on any COC to assign it to <strong>{selectedMaterial}</strong> across all dates in PDI <strong>{selectedPdiForDetails}</strong>
            </p>

            {loadingMaterialCoc ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>⏳ Loading COC data from API...</p>
              </div>
            ) : materialCocData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#999' }}>❌ No COC data available from API</p>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>You can add COC manually using the button below</p>
                <button
                  onClick={() => {
                    setManualCocForm({
                      materialName: selectedMaterial || '',
                      invoiceNo: '',
                      brand: '',
                      lotBatchNo: '',
                      cocQty: '',
                      invoiceQty: '',
                      invoiceDate: new Date().toISOString().split('T')[0],
                      cocPdf: null,
                      iqcPdf: null
                    });
                    setShowMaterialCocModal(false);
                    setShowManualCocModal(true);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #28a745 0%, #218838 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ➕ Add COC Manually
                </button>
              </div>
            ) : (
              <>
                {/* Add Manual COC Button */}
                <div style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <button
                    onClick={() => {
                      setManualCocForm({
                        materialName: selectedMaterial || '',
                        invoiceNo: '',
                        brand: '',
                        lotBatchNo: '',
                        cocQty: '',
                        invoiceQty: '',
                        invoiceDate: new Date().toISOString().split('T')[0],
                        cocPdf: null,
                        iqcPdf: null
                      });
                      setShowMaterialCocModal(false);
                      setShowManualCocModal(true);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #28a745 0%, #218838 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ➕ Add Manual COC
                  </button>
                </div>
                {/* Filters */}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #dee2e6' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#495057' }}>🔍 Material Filter:</label>
                    <select
                      value={cocMaterialFilter}
                      onChange={(e) => setCocMaterialFilter(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                    >
                      <option value="all">All Materials</option>
                      {[...new Set(materialCocData.map(coc => coc.material_name).filter(Boolean))].map(material => (
                        <option key={material} value={material}>{material}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#495057' }}>🔎 Invoice Search:</label>
                    <input
                      type="text"
                      value={cocInvoiceFilter}
                      onChange={(e) => setCocInvoiceFilter(e.target.value)}
                      placeholder="Search by invoice number..."
                      style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                {/* Filtered Data */}
                {(() => {
                  const filteredData = materialCocData.filter(coc => {
                    const materialMatch = cocMaterialFilter === 'all' || coc.material_name === cocMaterialFilter;
                    const invoiceMatch = !cocInvoiceFilter || (coc.invoice_no && coc.invoice_no.toLowerCase().includes(cocInvoiceFilter.toLowerCase()));
                    return materialMatch && invoiceMatch;
                  });

                  return (
                    <>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Showing {filteredData.length} of {materialCocData.length} records</p>
                      {filteredData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                          <p style={{ color: '#999' }}>No records match your filter</p>
                        </div>
                      ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa' }}>
                              <tr style={{ backgroundColor: '#007bff', color: 'white' }}>
                                <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #dee2e6' }}>Material Name</th>
                                <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #dee2e6' }}>Specification</th>
                                <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #dee2e6' }}>Brand</th>
                                <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #dee2e6' }}>Invoice No</th>
                                <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #dee2e6' }}>Lot Number</th>
                                <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>Invoice Date</th>
                                <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>COC Qty</th>
                                <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>Invoice Qty</th>
                                <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>COC Doc</th>
                                <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>IQC Doc</th>
                                <th style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredData.map((coc, idx) => {
                                // Get specification - use from API data first, else determine from material name
                                const getSpec = (coc) => {
                                  // First check if spec/specification/product_type exists in COC data from API
                                  if (coc.specification) return coc.specification;
                                  if (coc.spec) return coc.spec;
                                  if (coc.product_type) return coc.product_type;

                                  // Fallback: determine from material name
                                  const materialName = (coc.material_name || '').toLowerCase();
                                  if (materialName.includes('back') && materialName.includes('glass')) {
                                    return '2376x1128x2.0 mm (3 hole)';
                                  } else if (materialName.includes('front') && materialName.includes('glass')) {
                                    return '2376x1128x2.0 mm';
                                  } else if (materialName.includes('glass')) {
                                    return '2376x1128x2.0 mm';
                                  } else if (materialName.includes('ribbon') && materialName.includes('4')) {
                                    return '4.0X0.4 mm';
                                  } else if (materialName.includes('ribbon') && materialName.includes('6')) {
                                    return '6.0X0.4 mm';
                                  } else if (materialName.includes('ribbon') || materialName.includes('busbar')) {
                                    return '0.26mm';
                                  } else if (materialName.includes('cell')) {
                                    return '25.30%';
                                  } else if (materialName.includes('junction')) {
                                    return '1200mm';
                                  }
                                  return '-';
                                };

                                return (
                                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa' }}>
                                    <td style={{ padding: '6px', border: '1px solid #dee2e6', fontWeight: '500' }}>{coc.material_name || '-'}</td>
                                    <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '9px', color: '#666' }}>{getSpec(coc)}</td>
                                    <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '10px' }}>{coc.brand || '-'}</td>
                                    <td style={{ padding: '6px', border: '1px solid #dee2e6' }}>{coc.invoice_no || '-'}</td>
                                    <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '10px' }}>{coc.lot_batch_no || '-'}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>{coc.invoice_date || '-'}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6', fontWeight: '500' }}>{coc.coc_qty || '-'}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>{coc.invoice_qty || '-'}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                      {coc.coc_document_url ? (
                                        <button
                                          onClick={() => window.open(coc.coc_document_url, '_blank')}
                                          style={{
                                            padding: '3px 8px',
                                            background: '#17a2b8',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '10px'
                                          }}
                                          title="View COC Document"
                                        >
                                          📄 View
                                        </button>
                                      ) : '-'}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                      {coc.iqc_document_url ? (
                                        <button
                                          onClick={() => window.open(coc.iqc_document_url, '_blank')}
                                          style={{
                                            padding: '3px 8px',
                                            background: '#6c757d',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '10px'
                                          }}
                                          title="View IQC Document"
                                        >
                                          📋 View
                                        </button>
                                      ) : '-'}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center', border: '1px solid #dee2e6' }}>
                                      <button
                                        onClick={() => handleSelectCoc(coc)}
                                        style={{
                                          padding: '4px 10px',
                                          background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '10px',
                                          fontWeight: '500'
                                        }}
                                        title={`Assign this COC to ${selectedMaterial}`}
                                      >
                                        ✅ Select
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => setShowMaterialCocModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CELL RECEIVED ENTRY MODAL - PROFESSIONAL ========== */}
      {showCellReceivedModal && (
        <div className="modal-overlay" onClick={() => setShowCellReceivedModal(false)} style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(5px)'
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '700px',
            maxHeight: '95vh',
            overflowY: 'auto',
            padding: '0',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            border: 'none'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)',
              padding: '25px 30px',
              borderRadius: '16px 16px 0 0',
              position: 'relative'
            }}>
              <button
                onClick={() => setShowCellReceivedModal(false)}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '20px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >×</button>
              <h2 style={{
                margin: '0',
                color: 'white',
                fontSize: '26px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '10px',
                  borderRadius: '12px'
                }}>⚡</span>
                Cell Received Entry
              </h2>
              <p style={{ margin: '10px 0 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                Enter solar cell inventory received from suppliers
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();

              if (!cellReceivedForm.supplierCompany || !cellReceivedForm.quantity) {
                alert('Please fill in Supplier Company and Quantity');
                return;
              }

              const qty = parseInt(cellReceivedForm.quantity) || 0;
              if (qty <= 0) {
                alert('Quantity must be greater than 0');
                return;
              }

              const currentReceived = { ...(selectedCompany?.cellEfficiencyReceived || {}) };
              const eff = cellReceivedForm.efficiency;
              const company = cellReceivedForm.supplierCompany.trim();

              const newReceived = { ...currentReceived };

              // If in EDIT mode, first remove old entry if efficiency/company changed
              if (cellReceivedEditMode && cellReceivedEditKey) {
                const oldEff = cellReceivedEditKey.eff;
                const oldCompany = cellReceivedEditKey.company;

                // Remove old entry
                if (newReceived[oldEff] && newReceived[oldEff][oldCompany]) {
                  delete newReceived[oldEff][oldCompany];
                  if (Object.keys(newReceived[oldEff]).length === 0) {
                    delete newReceived[oldEff];
                  }
                }

                // Set new entry (replace, not add)
                if (!newReceived[eff]) {
                  newReceived[eff] = {};
                }
                newReceived[eff][company] = qty;
              } else {
                // ADD mode - add to existing
                if (!newReceived[eff]) {
                  newReceived[eff] = {};
                }
                if (typeof newReceived[eff] !== 'object') {
                  newReceived[eff] = {};
                }
                newReceived[eff][company] = (newReceived[eff][company] || 0) + qty;
              }

              try {
                const API_BASE_URL = getAPIBaseURL();
                const response = await fetch(`${API_BASE_URL}/api/companies/${selectedCompany.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cellEfficiencyReceived: newReceived
                  })
                });

                if (response.ok) {
                  alert(`✅ ${cellReceivedEditMode ? 'Updated' : 'Added'} Successfully!\n\n📦 ${qty.toLocaleString()} Cells\n⚡ Efficiency: ${eff}%\n🏭 Supplier: ${company}`);

                  // Refresh both companies list AND selected company
                  await loadCompanies();

                  // Also update selectedCompany directly so UI shows immediately
                  setSelectedCompany(prev => ({
                    ...prev,
                    cellEfficiencyReceived: newReceived
                  }));

                  // Reset form and edit mode
                  setCellReceivedEditMode(false);
                  setCellReceivedEditKey(null);
                  setCellReceivedForm({
                    efficiency: '25.5',
                    supplierCompany: '',
                    quantity: '',
                    invoiceNo: '',
                    receiveDate: new Date().toISOString().split('T')[0]
                  });
                } else {
                  alert('Error saving data');
                }
              } catch (error) {
                console.error('Error:', error);
                alert('Server Error');
              }
            }} style={{ padding: '30px' }}>

              {/* Efficiency Grade Selection */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '14px',
                  fontSize: '15px',
                  color: '#37474f',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Cell Efficiency Grade
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {['25.4', '25.5', '25.6', '25.7', '25.8'].map(eff => (
                    <button
                      key={eff}
                      type="button"
                      onClick={() => setCellReceivedForm({ ...cellReceivedForm, efficiency: eff })}
                      style={{
                        padding: '14px 28px',
                        fontSize: '17px',
                        fontWeight: '600',
                        border: 'none',
                        borderRadius: '10px',
                        backgroundColor: cellReceivedForm.efficiency === eff ? '#1a237e' : '#f5f5f5',
                        color: cellReceivedForm.efficiency === eff ? 'white' : '#546e7a',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: cellReceivedForm.efficiency === eff ? '0 4px 12px rgba(26,35,126,0.3)' : 'none'
                      }}
                    >
                      {eff}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplier Company */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '10px',
                  fontSize: '15px',
                  color: '#37474f',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Supplier Company <span style={{ color: '#e53935' }}>*</span>
                </label>
                <input
                  type="text"
                  value={cellReceivedForm.supplierCompany}
                  onChange={(e) => setCellReceivedForm({ ...cellReceivedForm, supplierCompany: e.target.value })}
                  placeholder="Enter supplier name..."
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    fontSize: '16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '10px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1a237e'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  required
                />
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Longi', 'JA Solar', 'Trina', 'Jinko', 'Canadian Solar', 'Risen'].map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCellReceivedForm({ ...cellReceivedForm, supplierCompany: name })}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        border: 'none',
                        borderRadius: '20px',
                        backgroundColor: cellReceivedForm.supplierCompany === name ? '#1a237e' : '#eceff1',
                        color: cellReceivedForm.supplierCompany === name ? 'white' : '#546e7a',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two Column Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Quantity */}
                <div>
                  <label style={{
                    display: 'block',
                    fontWeight: '600',
                    marginBottom: '10px',
                    fontSize: '15px',
                    color: '#37474f',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Quantity (Cells) <span style={{ color: '#e53935' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={cellReceivedForm.quantity}
                    onChange={(e) => setCellReceivedForm({ ...cellReceivedForm, quantity: e.target.value })}
                    placeholder="e.g., 50000"
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      fontSize: '18px',
                      fontWeight: '600',
                      border: '2px solid #e0e0e0',
                      borderRadius: '10px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1a237e'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                    required
                    min="1"
                  />
                </div>

                {/* Receive Date */}
                <div>
                  <label style={{
                    display: 'block',
                    fontWeight: '600',
                    marginBottom: '10px',
                    fontSize: '15px',
                    color: '#37474f',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Receive Date
                  </label>
                  <input
                    type="date"
                    value={cellReceivedForm.receiveDate}
                    onChange={(e) => setCellReceivedForm({ ...cellReceivedForm, receiveDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      fontSize: '16px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '10px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1a237e'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                </div>
              </div>

              {/* Invoice Number */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '10px',
                  fontSize: '15px',
                  color: '#37474f',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Invoice / Challan Number <span style={{ color: '#9e9e9e', fontWeight: '400', textTransform: 'none' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={cellReceivedForm.invoiceNo}
                  onChange={(e) => setCellReceivedForm({ ...cellReceivedForm, invoiceNo: e.target.value })}
                  placeholder="Enter invoice or challan number..."
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    fontSize: '16px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '10px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1a237e'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              {/* Summary Card */}
              {cellReceivedForm.supplierCompany && cellReceivedForm.quantity && (
                <div style={{
                  marginBottom: '28px',
                  padding: '24px',
                  background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                  borderRadius: '14px',
                  border: '1px solid #a5d6a7'
                }}>
                  <h4 style={{ margin: '0 0 18px 0', color: '#2e7d32', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#2e7d32', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>✓</span>
                    Entry Summary
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
                      <div style={{ color: '#78909c', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Efficiency</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a237e' }}>{cellReceivedForm.efficiency}%</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
                      <div style={{ color: '#78909c', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Supplier</div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: '#37474f' }}>{cellReceivedForm.supplierCompany}</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
                      <div style={{ color: '#78909c', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Total Cells</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#d32f2f' }}>{parseInt(cellReceivedForm.quantity || 0).toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
                      <div style={{ color: '#78909c', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Est. Modules</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#7b1fa2' }}>~{Math.floor(parseInt(cellReceivedForm.quantity || 0) / 66).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '16px 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(26,35,126,0.3)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(26,35,126,0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(26,35,126,0.3)';
                  }}
                >
                  {cellReceivedEditMode ? 'Update Entry' : 'Save Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCellReceivedModal(false);
                    setCellReceivedEditMode(false);
                    setCellReceivedEditKey(null);
                  }}
                  style={{
                    padding: '16px 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    backgroundColor: '#eceff1',
                    color: '#546e7a',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#cfd8dc'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#eceff1'}
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Current Stock Footer with EDIT/DELETE buttons */}
            <div style={{
              padding: '20px 30px',
              backgroundColor: '#fafafa',
              borderTop: '1px solid #e0e0e0',
              borderRadius: '0 0 16px 16px'
            }}>
              <h4 style={{ margin: '0 0 14px 0', color: '#546e7a', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Current Inventory - Click to Edit/Delete
              </h4>

              {/* Show all entries with edit/delete */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {['25.4', '25.5', '25.6', '25.7', '25.8'].map(eff => {
                  const effData = selectedCompany?.cellEfficiencyReceived?.[eff] || {};
                  const companies = typeof effData === 'object' ? effData : {};

                  if (Object.keys(companies).length === 0) return null;

                  return (
                    <div key={eff} style={{ marginBottom: '15px' }}>
                      <div style={{
                        fontWeight: '700',
                        color: '#1565c0',
                        fontSize: '16px',
                        marginBottom: '8px',
                        padding: '5px 10px',
                        backgroundColor: '#e3f2fd',
                        borderRadius: '5px'
                      }}>
                        ⚡ {eff}% Efficiency
                      </div>
                      {Object.entries(companies).map(([company, qty]) => (
                        <div key={`${eff}-${company}`} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 15px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          marginBottom: '5px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div>
                            <span style={{ fontWeight: '600', color: '#37474f' }}>🏭 {company}</span>
                            <span style={{ marginLeft: '15px', fontSize: '18px', fontWeight: '700', color: '#1976d2' }}>
                              {(qty || 0).toLocaleString()} cells
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {/* EDIT Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setCellReceivedEditMode(true);
                                setCellReceivedEditKey({ eff, company });
                                setCellReceivedForm({
                                  efficiency: eff,
                                  supplierCompany: company,
                                  quantity: String(qty || 0),
                                  invoiceNo: '',
                                  receiveDate: new Date().toISOString().split('T')[0]
                                });
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            {/* DELETE Button */}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Delete ${company} (${qty.toLocaleString()} cells) from ${eff}%?`)) return;

                                const currentReceived = { ...(selectedCompany?.cellEfficiencyReceived || {}) };
                                if (currentReceived[eff] && currentReceived[eff][company]) {
                                  delete currentReceived[eff][company];
                                  // If no companies left in this efficiency, remove the efficiency too
                                  if (Object.keys(currentReceived[eff]).length === 0) {
                                    delete currentReceived[eff];
                                  }
                                }

                                try {
                                  const API_BASE_URL = getAPIBaseURL();
                                  const response = await fetch(`${API_BASE_URL}/api/companies/${selectedCompany.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ cellEfficiencyReceived: currentReceived })
                                  });

                                  if (response.ok) {
                                    alert('✅ Deleted successfully!');
                                    await loadCompanies();
                                    setSelectedCompany(prev => ({ ...prev, cellEfficiencyReceived: currentReceived }));
                                  }
                                } catch (error) {
                                  alert('❌ Error deleting');
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* No data message */}
                {!['25.4', '25.5', '25.6', '25.7', '25.8'].some(eff => {
                  const effData = selectedCompany?.cellEfficiencyReceived?.[eff] || {};
                  return typeof effData === 'object' && Object.keys(effData).length > 0;
                }) && (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                      No cell inventory data yet. Add your first entry above!
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual COC Entry Modal */}
      {showManualCocModal && (
        <div className="modal-overlay" onClick={() => setShowManualCocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>➕ Add COC Manually</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              Fill in COC details and upload PDF documents (if available)
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);

              try {
                const API_BASE_URL = getAPIBaseURL();
                const formData = new FormData();

                // Add COC details
                formData.append('material_name', manualCocForm.materialName);
                formData.append('invoice_no', manualCocForm.invoiceNo);
                formData.append('brand', manualCocForm.brand);
                formData.append('lot_batch_no', manualCocForm.lotBatchNo);
                formData.append('coc_qty', manualCocForm.cocQty);
                formData.append('invoice_qty', manualCocForm.invoiceQty);
                formData.append('invoice_date', manualCocForm.invoiceDate);

                // Add PDF files if uploaded
                if (manualCocForm.cocPdf) {
                  formData.append('coc_pdf', manualCocForm.cocPdf);
                }
                if (manualCocForm.iqcPdf) {
                  formData.append('iqc_pdf', manualCocForm.iqcPdf);
                }

                // Submit to backend
                const response = await axios.post(`${API_BASE_URL}/api/coc/manual-entry`, formData, {
                  headers: {
                    'Content-Type': 'multipart/form-data'
                  }
                });

                if (response.data.success) {
                  alert('✅ COC added successfully!');
                  setShowManualCocModal(false);

                  // Auto-assign to current material if applicable
                  if (selectedMaterial && selectedPdiForDetails) {
                    await handleSelectCoc(response.data.coc_data);
                  }
                }
              } catch (error) {
                console.error('Failed to add manual COC:', error);
                alert('❌ Failed to add COC: ' + (error.response?.data?.error || error.message));
              } finally {
                setLoading(false);
              }
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    Material Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={manualCocForm.materialName}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, materialName: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  >
                    <option value="">Select Material</option>
                    {/* Get unique material names from both wattages */}
                    {[...new Set([
                      ...BOM_MATERIALS_BY_WATTAGE['625wp'].map(m => m.name),
                      ...BOM_MATERIALS_BY_WATTAGE['630wp'].map(m => m.name)
                    ])].map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    Invoice Number <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={manualCocForm.invoiceNo}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, invoiceNo: e.target.value })}
                    required
                    placeholder="e.g., INV2025110613-2"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    value={manualCocForm.brand}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, brand: e.target.value })}
                    placeholder="e.g., ABC Corp"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    Lot/Batch Number
                  </label>
                  <input
                    type="text"
                    value={manualCocForm.lotBatchNo}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, lotBatchNo: e.target.value })}
                    placeholder="e.g., LOT123"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    COC Quantity <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={manualCocForm.cocQty}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, cocQty: e.target.value })}
                    required
                    placeholder="e.g., 200000"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    Invoice Quantity
                  </label>
                  <input
                    type="number"
                    value={manualCocForm.invoiceQty}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, invoiceQty: e.target.value })}
                    placeholder="e.g., 200000"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    Invoice Date <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={manualCocForm.invoiceDate}
                    onChange={(e) => setManualCocForm({ ...manualCocForm, invoiceDate: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    📄 COC PDF Document
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setManualCocForm({ ...manualCocForm, cocPdf: e.target.files[0] })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                  {manualCocForm.cocPdf && (
                    <p style={{ fontSize: '11px', color: '#28a745', marginTop: '5px' }}>
                      ✅ {manualCocForm.cocPdf.name}
                    </p>
                  )}
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px' }}>
                    📋 IQC PDF Document (Optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setManualCocForm({ ...manualCocForm, iqcPdf: e.target.files[0] })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                  />
                  {manualCocForm.iqcPdf && (
                    <p style={{ fontSize: '11px', color: '#28a745', marginTop: '5px' }}>
                      ✅ {manualCocForm.iqcPdf.name}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowManualCocModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: loading ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #218838 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  {loading ? '⏳ Saving...' : '💾 Save COC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingAction(null);
        }}
        onVerify={handlePasswordVerification}
        title="🔒 Password Required"
        message="Enter password to make changes to Production or COC data. Access will remain active for 5 minutes."
      />
    </div>
  );
}

export default DailyReport;
