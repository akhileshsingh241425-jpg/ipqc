import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import axios from 'axios';
import { companyService } from '../services/apiService';
import COCSelectionModal from './COCSelectionModal';
import PasswordModal from './PasswordModal';
import '../styles/DailyReport.css';

// Smart API URL helper
const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';
const getAPIBase = () => window.location.hostname === 'localhost' ? 'http://localhost:5003/api' : '/api';

// Material name mapping (Legacy DB names → Modern Display names)
const MATERIAL_NAME_MAP = {
  'Cell': 'Solar Cell',
  'EVA Front': 'EVA',
  'EVA Back': 'EVA',
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
    { name: 'EVA', qty: 2.8, product_type: '', needsCompany: true },
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
    { name: 'JB Potting (A and B)', qty: 0.021, product_type: '', needsCompany: true },
    { name: 'JUNCTION BOX', qty: 1, product_type: '35A 1200mm', needsCompany: true },
    { name: 'RFID', qty: 1, product_type: '', needsCompany: true }
  ],
  '630wp': [
    { name: 'Solar Cell', qty: 66, product_type: '25.40%', min_efficiency: 25.40, needsCompany: true },
    { name: 'EVA', qty: 2.8, product_type: '', needsCompany: true },
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
    { name: 'JB Potting (A and B)', qty: 0.021, product_type: '', needsCompany: true },
    { name: 'JUNCTION BOX', qty: 1, product_type: '35A 1200mm', needsCompany: true },
    { name: 'RFID', qty: 1, product_type: '', needsCompany: true }
  ]
};

function DailyReport() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [viewMode, setViewMode] = useState('list');

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
  const [showRejectionList, setShowRejectionList] = useState(false);
  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayPdiNumber, setNewDayPdiNumber] = useState('');
  const [newDayRunningOrder, setNewDayRunningOrder] = useState('');
  const [showBomModal, setShowBomModal] = useState(false);
  const [selectedWattage, setSelectedWattage] = useState('625wp'); // Default wattage
  const [cocBrands, setCocBrands] = useState({}); // Available brands by material name from COC API
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
  const [pdiFilter, setPdiFilter] = useState('all'); // 'all', 'done', 'pending'
  const [showCocUploadModal, setShowCocUploadModal] = useState(false);
  const [selectedPdiRecords, setSelectedPdiRecords] = useState([]);
  const [availableCocData, setAvailableCocData] = useState([]);
  const [cocInvoiceSearch, setCocInvoiceSearch] = useState('');
  const [showPdiDetailsModal, setShowPdiDetailsModal] = useState(false);
  const [selectedPdiForDetails, setSelectedPdiForDetails] = useState(null);
  const [showMaterialCocModal, setShowMaterialCocModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialCocData, setMaterialCocData] = useState([]);
  const [loadingMaterialCoc, setLoadingMaterialCoc] = useState(false);
  const [editingUsedQty, setEditingUsedQty] = useState(null); // {materialName, lotNumber}
  const [editUsedQtyValue, setEditUsedQtyValue] = useState('');
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
  const [reportOptions, setReportOptions] = useState({
    includeCellInventory: true,
    includeRejections: true,
    includeKPIMetrics: true,
    includeProductionDetails: true,
    includeDayWiseSummary: true,
    includeBomMaterials: true
  });
  
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
          await autoGenerateIPQCPDF(record);
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

  const autoGenerateIPQCPDF = async (record) => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      
      // Extract serial prefix and start number from serial
      const serialStart = record.serialNumberStart || '';
      const serialPrefix = serialStart.replace(/\d+$/, ''); // Remove trailing numbers
      const startNum = parseInt(serialStart.match(/\d+$/)?.[0] || '1');
      
      const ipqcData = {
        date: record.date || new Date().toISOString().split('T')[0],
        shift: 'A',
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
      
      console.log('Auto-generating IPQC PDF:', ipqcData);
      
      const response = await axios.post(`${API_BASE_URL}/api/ipqc/generate-pdf-only`, ipqcData, {
        responseType: 'blob'
      });
      
      // Save the PDF path to record (backend should return the saved path)
      console.log('✅ IPQC PDF auto-generated successfully');
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

  const [cocValidation, setCocValidation] = useState(null);
  const [showCocWarningModal, setShowCocWarningModal] = useState(false);
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

  const handleOpenBomModal = (record) => {
    setSelectedRecordForBom(record);
    
    // Fetch COC brands when opening modal
    fetchCOCBrands();
    
    // Get wattage from company data or default
    const wattage = selectedCompany?.wattage || '625wp';
    setSelectedWattage(wattage);
    
    // Initialize bomMaterials state with existing data
    const currentMaterials = BOM_MATERIALS_BY_WATTAGE[wattage] || [];
    const materialsData = {};
    
    currentMaterials.forEach(material => {
      const existing = record.bomMaterials?.find(bm => bm.materialName === material.name);
      materialsData[material.name] = {
        lotNumber: existing?.lotNumber || '',
        company: existing?.company || '',
        image: null,
        existingImage: existing?.imagePath || null
      };
    });
    
    setBomMaterials(materialsData);
    setIpqcPdf(null);
    setFtrDocument(null);
    setShowBomModal(true);
  };

  const handleBomMaterialChange = (materialName, field, value) => {
    setBomMaterials(prev => ({
      ...prev,
      [materialName]: {
        ...prev[materialName],
        [field]: value
      }
    }));
  };

  // Handle clicking on material name to load COC data
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

  // Handle selecting COC for a material
  const handleSelectCoc = async (cocItem) => {
    if (!selectedMaterial || !selectedPdiForDetails) {
      alert('❌ Material or PDI not selected');
      return;
    }

    try {
      setLoading(true);
      
      // Find all BOM materials for this PDI across all dates
      const pdiRecords = selectedCompany.productionRecords.filter(
        r => r.pdi === selectedPdiForDetails
      );

      // Update each record's BOM material with the selected COC
      for (const record of pdiRecords) {
        // Find and update the specific material in the bomMaterials array
        const updatedBomMaterials = record.bomMaterials.map(bm => {
          if (bm.materialName === selectedMaterial) {
            console.log('Updating material:', selectedMaterial, 'with COC:', cocItem);
            const updatedMaterial = {
              ...bm,
              lotNumber: cocItem.invoice_no,
              cocQty: cocItem.coc_qty,
              invoiceQty: cocItem.invoice_qty,
              lotBatchNo: cocItem.lot_batch_no
            };
            console.log('Updated Material Object:', updatedMaterial);
            return updatedMaterial;
          }
          return bm;
        });
        
        console.log('Updated BOM Materials Array:', JSON.stringify(updatedBomMaterials, null, 2));
        
        await companyService.updateProductionRecord(selectedCompany.id, record.id, {
          bomMaterials: updatedBomMaterials
        });
      }

      alert(`✅ COC assigned to ${selectedMaterial}: Invoice ${cocItem.invoice_no}`);
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
  const fetchCOCBrands = async () => {
    try {
      setLoadingCocBrands(true);
      const API_BASE = getAPIBase();
      
      // Get last 6 months data
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 180*24*60*60*1000).toISOString().split('T')[0];
      
      const response = await axios.get(`${API_BASE}/coc/list?from_date=${fromDate}&to_date=${toDate}`);
      
      if (response.data.success) {
        // Material name mapping for fuzzy matching
        const materialMapping = {
          'Solar Cell': ['solar cell', 'cell', 'solar', 'solarcell'],
          'EVA': ['eva', 'ethylene vinyl acetate'],
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
        const matchMaterial = (cocMaterialName, bomMaterialName) => {
          const cocName = cocMaterialName.toLowerCase().trim();
          const bomName = bomMaterialName.toLowerCase().trim();
          
          // Exact match
          if (cocName === bomName) return true;
          
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
              
              const matchKey = materialGroup || bomMaterial.split('(')[0].trim(); // Use group or base name
              
              if (matchMaterial(item.material_name, matchKey)) {
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
      summaryData.push(['Material Name', 'Product Type', 'Required Qty', 'Available', 'Shortage', 'Status', '🎯 USE THIS COC', 'Company', 'Invoice No', 'COC Qty', 'Lot/Batch', 'Date']);
      
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
        
        // Find suggested COC (OLDEST date - FIFO principle)
        let suggestedCoc = null;
        let suggestionText = '-';
        
        if (allCocs.length > 0) {
          // Sort by date - OLDEST first (FIFO principle)
          const sortedCocs = allCocs.sort((a, b) => {
            const dateA = new Date(a.invoiceDate || '2099-01-01');
            const dateB = new Date(b.invoiceDate || '2099-01-01');
            return dateA - dateB;
          });
          
          if (shortage > 0) {
            // Find COC that can fulfill shortage
            suggestedCoc = sortedCocs.find(coc => coc.cocQty >= shortage) || sortedCocs[0];
            suggestionText = '✅ ADD THIS';
          } else {
            // Show oldest COC for FIFO
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
          suggestedCoc ? (suggestedCoc.invoiceDate || '-') : '-'
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
        { wch: 28 }, // Company
        { wch: 20 }, // Invoice No
        { wch: 12 }, // COC Qty
        { wch: 20 }, // Lot/Batch
        { wch: 15 }  // Date
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
      
      // Get current wattage materials
      const currentMaterials = BOM_MATERIALS_BY_WATTAGE[selectedWattage] || [];

      // Upload each BOM material
      for (const material of currentMaterials) {
        const materialData = bomMaterials[material.name];
        if (materialData && (materialData.lotNumber || materialData.image || materialData.company)) {
          const formData = new FormData();
          formData.append('materialName', material.name);
          formData.append('lotNumber', materialData.lotNumber || '');
          formData.append('company', materialData.company || '');
          formData.append('qty', material.qty);
          formData.append('product_type', material.product_type);
          if (materialData.image) {
            formData.append('image', materialData.image);
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
      
      // Fetch available COCs from database
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 180*24*60*60*1000).toISOString().split('T')[0];
      const response = await axios.get(`${API_BASE}/coc/list?from_date=${fromDate}&to_date=${toDate}`);
      
      if (response.data.success) {
        // Group COCs by material and company
        const requiredCocsData = requiredMaterials.map(req => {
          // Find matching COCs for this material
          const matchingCocs = response.data.coc_data.filter(coc => {
            const cocMaterial = (coc.material_name || '').toLowerCase();
            const reqMaterial = req.materialName.toLowerCase();
            
            // Simple matching logic
            if (reqMaterial.includes('cell') && cocMaterial.includes('cell')) return true;
            if (reqMaterial.includes('eva') && cocMaterial.includes('eva')) return true;
            if (reqMaterial.includes('glass') && cocMaterial.includes('glass')) return true;
            if (reqMaterial.includes('ribbon') && (cocMaterial.includes('ribbon') || cocMaterial.includes('busbar'))) return true;
            if (reqMaterial.includes('flux') && cocMaterial.includes('flux')) return true;
            if (reqMaterial.includes('epe') && cocMaterial.includes('epe')) return true;
            if (reqMaterial.includes('frame') && cocMaterial.includes('frame')) return true;
            if (reqMaterial.includes('sealent') && cocMaterial.includes('sealant')) return true;
            if (reqMaterial.includes('potting') && cocMaterial.includes('potting')) return true;
            if (reqMaterial.includes('junction') && cocMaterial.includes('junction')) return true;
            if (reqMaterial.includes('rfid') && cocMaterial.includes('rfid')) return true;
            
            return false;
          });
          
          // Group by company/brand
          const cocsByCompany = {};
          matchingCocs.forEach(coc => {
            const company = coc.brand || 'Unknown';
            if (!cocsByCompany[company]) {
              cocsByCompany[company] = [];
            }
            cocsByCompany[company].push({
              invoiceNo: coc.invoice_no,
              cocQty: parseFloat(coc.coc_qty) || 0,
              invoiceQty: parseFloat(coc.invoice_qty) || 0,
              lotBatchNo: coc.lot_batch_no,
              invoiceDate: coc.invoice_date,
              cocDocUrl: coc.coc_document_url,
              iqcDocUrl: coc.iqc_document_url
            });
          });
          
          return {
            ...req,
            availableCocs: cocsByCompany
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
            onChange={(e) => setCompanyForm({...companyForm, companyName: e.target.value})}
            placeholder="Enter company name"
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Module Wattage *</label>
            <input
              type="number"
              value={companyForm.moduleWattage}
              onChange={(e) => setCompanyForm({...companyForm, moduleWattage: e.target.value})}
              placeholder="625"
            />
          </div>
          
          <div className="form-group">
            <label>Module Type *</label>
            <select
              value={companyForm.moduleType}
              onChange={(e) => setCompanyForm({...companyForm, moduleType: e.target.value})}
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
            onChange={(e) => setCompanyForm({...companyForm, cellsPerModule: e.target.value})}
            placeholder="132"
          />
        </div>

        <div className="form-group">
          <label>Current Running Order</label>
          <input
            type="text"
            value={companyForm.currentRunningOrder}
            onChange={(e) => setCompanyForm({...companyForm, currentRunningOrder: e.target.value})}
            placeholder="e.g., ORD-2024-001"
          />
          <small style={{color: '#666', fontSize: '12px', marginTop: '5px', display: 'block'}}>
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
                onChange={(e) => setCompanyForm({...companyForm, cellsReceivedQty: e.target.value})}
                placeholder="Enter number of cells"
              />
            </div>
            
            <div className="form-group">
              <label>MW</label>
              <input
                type="number"
                step="0.01"
                value={companyForm.cellsReceivedMW}
                onChange={(e) => setCompanyForm({...companyForm, cellsReceivedMW: e.target.value})}
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

    return (
      <div className="production-view-container">
        <div className="production-header">
          <h2>{selectedCompany.companyName} - Production Management</h2>
          <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'}}>
            <button 
              className="btn-primary" 
              onClick={handleAddNewDay}
              style={{padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'}}
            >
              ➕ Add New Day
            </button>
            <button 
              className="btn-primary" 
              onClick={() => document.getElementById('master-data-upload').click()}
              style={{padding: '10px 20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'}}
            >
              📤 Upload Master Data
            </button>
            <input
              id="master-data-upload"
              type="file"
              accept=".xlsx,.xls"
              style={{display: 'none'}}
              onChange={handleMasterDataUpload}
            />
            <button 
              className="btn-primary" 
              onClick={() => document.getElementById('rejection-upload').click()}
              style={{padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'}}
            >
              🚫 Upload Rejections
            </button>
            <input
              id="rejection-upload"
              type="file"
              accept=".xlsx,.xls"
              style={{display: 'none'}}
              onChange={handleRejectionUpload}
            />
            <button 
              style={{padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer'}}
              onClick={() => { setSelectedCompany(null); setViewMode('list'); }}
            >
              ← Back to List
            </button>
          </div>
        </div>

        {loading && <div className="loading">Loading...</div>}

        <div className="production-section">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h3>Daily Production Records</h3>
            <div style={{display: 'flex', gap: '8px'}}>
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
              <div style={{marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
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
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <h4 style={{margin: 0, color: '#2e7d32', fontSize: '16px'}}>✅ {pdiNumber}</h4>
                        <span style={{background: '#28a745', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'}}>
                          COMPLETED
                        </span>
                      </div>
                      <p style={{margin: '5px 0', fontSize: '13px', color: '#666'}}>
                        <strong>Records:</strong> {pdiRecords.length}<br/>
                        <strong>Production:</strong> {totalProduction} modules
                      </p>
                      
                      <div style={{display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap'}}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPdiForDetails(pdiNumber);
                            setShowPdiDetailsModal(true);
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
              <div style={{marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
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
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <h4 style={{margin: 0, color: '#f57c00', fontSize: '16px'}}>⚠️ {pdiNumber}</h4>
                        <span style={{background: '#ffc107', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'}}>
                          PENDING
                        </span>
                      </div>
                      <p style={{margin: '5px 0', fontSize: '13px', color: '#666'}}>
                        <strong>Records:</strong> {pdiRecords.length}<br/>
                        <strong>Production:</strong> {totalProduction} modules
                      </p>
                      
                      <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPdiForDetails(pdiNumber);
                            setShowPdiDetailsModal(true);
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
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 8px'}}>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                  <h3 style={{margin: 0, color: '#1e3a8a', fontSize: '16px'}}>📋 Production Records ({dateRecords.length})</h3>
                  <span style={{fontSize: '13px', color: '#6b7280'}}>
                    Total Production: <strong>{dateRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0).toLocaleString()}</strong> modules
                  </span>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
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
                <div style={{marginBottom: '25px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '2px solid #FF9800'}}>
                  <h4 style={{marginTop: 0, color: '#FF6F00', display: 'flex', alignItems: 'center', gap: '8px'}}>
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
                  <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
                    Based on <strong>{dateRecords.reduce((sum, r) => sum + (r.dayProduction || 0) + (r.nightProduction || 0), 0)} modules</strong> production
                  </p>
                  
                  <div style={{maxHeight: '500px', overflowY: 'auto'}}>
                    {requiredCocsReport.map((req, idx) => (
                      <div key={idx} style={{marginBottom: '15px', padding: '12px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #dee2e6'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                          <div>
                            <strong style={{fontSize: '13px', color: '#1976d2'}}>{req.materialName}</strong>
                            {req.productType && <span style={{fontSize: '10px', color: '#666', marginLeft: '8px'}}>({req.productType})</span>}
                          </div>
                          <div style={{fontSize: '12px', fontWeight: 'bold', color: '#d32f2f'}}>
                            Need: {req.requiredQty}
                          </div>
                        </div>
                        
                        {Object.keys(req.availableCocs).length > 0 ? (
                          <div>
                            {Object.entries(req.availableCocs).map(([company, cocs]) => {
                              const totalAvailable = cocs.reduce((sum, coc) => sum + coc.cocQty, 0);
                              const isEnough = totalAvailable >= req.requiredQty;
                              
                              return (
                                <div key={company} style={{marginTop: '8px', padding: '8px', backgroundColor: isEnough ? '#e8f5e9' : '#ffebee', borderRadius: '4px', border: `1px solid ${isEnough ? '#4caf50' : '#f44336'}`}}>
                                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
                                    <strong style={{fontSize: '11px', color: '#333'}}>{company}</strong>
                                    <span style={{fontSize: '11px', fontWeight: 'bold', color: isEnough ? '#4caf50' : '#f44336'}}>
                                      {totalAvailable} {isEnough ? '✅' : '⚠️'}
                                    </span>
                                  </div>
                                  
                                  <div style={{maxHeight: '100px', overflowY: 'auto'}}>
                                    {cocs.slice(0, 3).map((coc, cocIdx) => (
                                      <div key={cocIdx} style={{padding: '4px', backgroundColor: 'rgba(255,255,255,0.6)', marginBottom: '3px', borderRadius: '3px', fontSize: '10px'}}>
                                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                          <span>Inv: <strong>{coc.invoiceNo}</strong></span>
                                          <span>Qty: <strong>{coc.cocQty}</strong></span>
                                        </div>
                                      </div>
                                    ))}
                                    {cocs.length > 3 && <div style={{fontSize: '10px', color: '#666', textAlign: 'center'}}>+{cocs.length - 3} more</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{padding: '8px', backgroundColor: '#ffebee', borderRadius: '4px', textAlign: 'center', color: '#d32f2f', fontSize: '11px'}}>
                            ❌ No COC in database
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="production-table-wrapper" style={{overflowX: 'auto', maxWidth: '100%'}}>
                <table className="production-table" style={{fontSize: '12px', minWidth: '1550px'}}>
                <thead>
                  <tr>
                    <th style={{width: '80px'}}>DATE</th>
                    <th style={{width: '120px'}}>RUNNING ORDER</th>
                    <th style={{width: '60px'}}>PDI</th>
                    <th style={{width: '130px'}}>SERIAL START</th>
                    <th style={{width: '130px'}}>SERIAL END</th>
                    <th style={{width: '50px'}}>COUNT</th>
                    <th style={{width: '70px'}}>DAY</th>
                    <th style={{width: '70px'}}>NIGHT</th>
                    <th style={{width: '60px'}}>TOTAL</th>
                    <th style={{width: '70px', backgroundColor: '#fff3cd'}}>CELL REJ %</th>
                    <th style={{width: '80px', backgroundColor: '#f8d7da'}}>MODULE REJ %</th>
                    <th style={{width: '80px', backgroundColor: '#d1ecf1'}}>IPQC Sheet</th>
                    <th style={{width: '80px', backgroundColor: '#d4edda'}}>FTR Doc</th>
                    <th style={{width: '80px'}}>BOM/Docs</th>
                    <th style={{width: '60px'}}>Status</th>
                    <th style={{width: '60px'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dateRecords.map(record => {
                    const total = (record.dayProduction || 0) + (record.nightProduction || 0);
                    const isClosed = record.isClosed || false;
                    return (
                      <tr key={record.id} style={{backgroundColor: isClosed ? '#f5f5f5' : 'transparent'}}>
                        <td style={{fontSize: '11px'}}>{record.date}</td>
                        <td>
                          <input
                            type="text"
                            value={record.runningOrder || ''}
                            onChange={(e) => handleProductionChange(record.id, 'runningOrder', e.target.value)}
                            className="table-input"
                            placeholder={selectedCompany?.currentRunningOrder || 'Order No.'}
                            disabled={isClosed}
                            style={{width: '115px', padding: '4px', fontSize: '10px'}}
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
                            style={{width: '125px', fontSize: '10px', padding: '4px 3px'}}
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
                            style={{width: '125px', fontSize: '10px', padding: '4px 3px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={record.serialCount || 0}
                            onChange={(e) => handleProductionChange(record.id, 'serialCount', e.target.value)}
                            className="table-input"
                            disabled={isClosed}
                            style={{width: '45px', padding: '4px', fontSize: '11px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={record.dayProduction || 0}
                            onChange={(e) => handleProductionChange(record.id, 'dayProduction', e.target.value)}
                            className="table-input"
                            disabled={isClosed}
                            style={{width: '65px', padding: '4px', fontSize: '11px'}}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={record.nightProduction || 0}
                            onChange={(e) => handleProductionChange(record.id, 'nightProduction', e.target.value)}
                            className="table-input"
                            disabled={isClosed}
                            style={{width: '65px', padding: '4px', fontSize: '11px'}}
                          />
                        </td>
                        <td className="total-cell" style={{fontSize: '12px', fontWeight: '700'}}>{total}</td>
                        <td style={{backgroundColor: '#fff3cd22'}}>
                          <input
                            type="number"
                            step="0.1"
                            value={record.cellRejectionPercent || 0}
                            onChange={(e) => handleProductionChange(record.id, 'cellRejectionPercent', e.target.value)}
                            className="table-input"
                            disabled={isClosed}
                            style={{width: '60px', padding: '4px', fontSize: '11px'}}
                          />
                        </td>
                        <td style={{backgroundColor: '#f8d7da22'}}>
                          <input
                            type="number"
                            step="0.1"
                            value={record.moduleRejectionPercent || 0}
                            onChange={(e) => handleProductionChange(record.id, 'moduleRejectionPercent', e.target.value)}
                            className="table-input"
                            disabled={isClosed}
                            style={{width: '70px', padding: '4px', fontSize: '11px'}}
                          />
                        </td>
                        <td style={{backgroundColor: '#d1ecf122', textAlign: 'center'}}>
                          {(() => {
                            // Show IPQC button if uploaded OR if serial numbers are present
                            const hasUploadedIpqc = record.ipqcPdf;
                            const hasSerialData = record.serialNumberStart && record.serialNumberEnd && record.serialCount > 0;
                            
                            if (hasUploadedIpqc) {
                              return (
                                <button
                                  onClick={() => {
                                    const path = record.ipqcPdf.startsWith('/') ? record.ipqcPdf : `/${record.ipqcPdf}`;
                                    const url = record.ipqcPdf.startsWith('http') 
                                      ? record.ipqcPdf 
                                      : `${getAPIBaseURL()}${path}`;
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                  }}
                                  style={{
                                    color: '#0066cc',
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
                                  📄 View
                                </button>
                              );
                            } else if (hasSerialData) {
                              return (
                                <button
                                  onClick={async () => {
                                    try {
                                      setLoading(true);
                                      await autoGenerateIPQCPDF(record);
                                      
                                      // Download the generated PDF
                                      const API_BASE_URL = getAPIBaseURL();
                                      const serialStart = record.serialNumberStart || '';
                                      const serialPrefix = serialStart.replace(/\\d+$/, '');
                                      const startNum = parseInt(serialStart.match(/\\d+$/)?.[0] || '1');
                                      
                                      const ipqcData = {
                                        date: record.date || new Date().toISOString().split('T')[0],
                                        shift: 'A',
                                        customer_id: 'GSPL/IPQC/IPC/003',
                                        po_number: record.runningOrder || selectedCompany.currentRunningOrder || '',
                                        serial_prefix: serialPrefix,
                                        serial_start: startNum,
                                        module_count: record.serialCount || 1,
                                        cell_manufacturer: 'Solar Space',
                                        cell_efficiency: 25.7,
                                        jb_cable_length: 1200,
                                        golden_module_number: `GM-${new Date().getFullYear()}-001`
                                      };
                                      
                                      const response = await axios.post(`${API_BASE_URL}/api/ipqc/generate-pdf-only`, ipqcData, {
                                        responseType: 'blob'
                                      });
                                      
                                      const url = window.URL.createObjectURL(new Blob([response.data]));
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.setAttribute('download', `IPQC_${record.date}_${record.serialCount}modules.pdf`);
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      window.URL.revokeObjectURL(url);
                                      
                                      setLoading(false);
                                      alert('\u2705 IPQC PDF downloaded successfully!');
                                    } catch (error) {
                                      console.error('IPQC generation error:', error);
                                      setLoading(false);
                                      alert('\u274c Failed to generate IPQC: ' + (error.response?.data?.error || error.message));
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
                                  title={`Auto-generate IPQC (${record.serialCount} modules)`}
                                >
                                  \ud83d\udce5 View
                                </button>
                              );
                            } else {
                              return <span style={{color: '#999', fontSize: '10px'}}>-</span>;
                            }
                          })()}
                        </td>
                        <td style={{backgroundColor: '#d4edda22', textAlign: 'center'}}>
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
                              return <span style={{color: '#999', fontSize: '10px'}}>-</span>;
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
                            <span style={{color: '#f44336', fontWeight: 'bold', fontSize: '9px'}}>🔒 Closed</span>
                          ) : (
                            <span style={{color: '#4CAF50', fontWeight: 'bold', fontSize: '9px'}}>✓ Open</span>
                          )}
                        </td>
                        <td>
                          <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
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
                                style={{fontSize: '14px', padding: '2px 6px'}}
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
            onChange={(e) => setReportData({...reportData, remarks: e.target.value})}
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
                onChange={(e) => setNewRejection({...newRejection, serialNumber: e.target.value})}
                placeholder="Enter serial number"
              />
            </div>
            <div className="form-group">
              <label>Rejection Date</label>
              <input
                type="date"
                value={newRejection.rejectionDate}
                onChange={(e) => setNewRejection({...newRejection, rejectionDate: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Reason</label>
              <select
                value={newRejection.reason}
                onChange={(e) => setNewRejection({...newRejection, reason: e.target.value})}
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
                onChange={(e) => setNewRejection({...newRejection, stage: e.target.value})}
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
                style={{borderColor: newDayPdiNumber ? '#4CAF50' : '#ff9800'}}
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
                <small style={{color: '#f44336', marginTop: '5px', display: 'block'}}>
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
                style={{borderColor: newDayRunningOrder ? '#4CAF50' : '#ff9800'}}
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
                <small style={{color: '#f44336', marginTop: '5px', display: 'block'}}>
                  ⚠️ Running Order is mandatory
                </small>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-save" 
                onClick={handleSaveNewDay}
                disabled={!newDayPdiNumber || !newDayRunningOrder}
                style={{opacity: (newDayPdiNumber && newDayRunningOrder) ? 1 : 0.5, cursor: (newDayPdiNumber && newDayRunningOrder) ? 'pointer' : 'not-allowed'}}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h3>📦 Upload BOM Materials & Documents - {selectedRecordForBom?.date}</h3>
            
            {/* Wattage Selection */}
            <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px'}}>
              <label style={{fontWeight: 'bold', marginRight: '10px', fontSize: '16px'}}>
                ⚡ Select Module Wattage:
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
                style={{padding: '8px 15px', fontSize: '15px', fontWeight: 'bold', borderRadius: '5px', border: '2px solid #1976d2'}}
              >
                <option value="625wp">625 Wp</option>
                <option value="630wp">630 Wp</option>
              </select>
            </div>
            
            <div style={{marginBottom: '20px'}}>
              <h4 style={{color: '#1976d2', marginBottom: '10px'}}>📋 BOM Materials</h4>
              {loadingCocBrands && (
                <div style={{padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px', marginBottom: '10px'}}>
                  Loading COC brands...
                </div>
              )}
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px'}}>
                {(BOM_MATERIALS_BY_WATTAGE[selectedWattage] || []).map(material => (
                  <div key={material.name} style={{border: '1px solid #ddd', padding: '10px', borderRadius: '5px', backgroundColor: material.needsCompany ? '#e3f2fd' : 'white'}}>
                    <label style={{fontWeight: 'bold', marginBottom: '5px', display: 'block'}}>
                      {material.name}
                      {material.product_type && <span style={{fontSize: '11px', color: '#666', display: 'block'}}>({material.product_type})</span>}
                      <span style={{fontSize: '11px', color: '#1976d2', display: 'block'}}>Qty: {material.qty}</span>
                    </label>
                    
                    {/* Company dropdown - filtered by material name */}
                    {material.needsCompany && (
                      <select
                        value={bomMaterials[material.name]?.company || ''}
                        onChange={(e) => handleBomMaterialChange(material.name, 'company', e.target.value)}
                        style={{width: '100%', marginBottom: '5px', padding: '5px', border: '2px solid #1976d2'}}
                      >
                        <option value="">Select Company/Brand</option>
                        {(cocBrands[material.name] || []).map((brand, idx) => (
                          <option key={idx} value={brand.brand}>
                            {brand.brand}
                          </option>
                        ))}
                      </select>
                    )}
                    
                    <input
                      type="text"
                      placeholder="Lot Number"
                      value={bomMaterials[material.name]?.lotNumber || ''}
                      onChange={(e) => handleBomMaterialChange(material.name, 'lotNumber', e.target.value)}
                      style={{width: '100%', marginBottom: '5px', padding: '5px'}}
                    />
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleBomMaterialChange(material.name, 'image', e.target.files[0])}
                      style={{width: '100%', fontSize: '11px'}}
                    />
                    {bomMaterials[material.name]?.image && (
                      <small style={{color: '#4CAF50', display: 'block', marginTop: '3px'}}>
                        ✓ {bomMaterials[material.name].image.name}
                      </small>
                    )}
                    {bomMaterials[material.name]?.existingImage && !bomMaterials[material.name]?.image && (
                      <small style={{color: '#2196F3', display: 'block', marginTop: '3px'}}>
                        📄 Already uploaded
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginBottom: '20px', border: '2px solid #4CAF50', padding: '15px', borderRadius: '5px'}}>
              <h4 style={{color: '#4CAF50', marginBottom: '10px'}}>📄 IPQC PDF Upload</h4>
              {selectedRecordForBom?.ipqcPdf && (
                <div style={{marginBottom: '10px', padding: '8px', backgroundColor: '#d1ecf1', borderRadius: '4px'}}>
                  <small style={{color: '#0c5460', display: 'block', fontWeight: 'bold'}}>✓ Current IPQC:</small>
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
                style={{width: '100%'}}
              />
              {ipqcPdf && (
                <small style={{color: '#4CAF50', display: 'block', marginTop: '5px'}}>
                  ✓ Selected: {ipqcPdf.name}
                </small>
              )}
            </div>

            <div style={{marginBottom: '20px', border: '2px solid #FF9800', padding: '15px', borderRadius: '5px'}}>
              <h4 style={{color: '#FF9800', marginBottom: '10px'}}>📑 FTR Document Upload</h4>
              {selectedRecordForBom?.ftrDocument && (
                <div style={{marginBottom: '10px', padding: '8px', backgroundColor: '#d4edda', borderRadius: '4px'}}>
                  <small style={{color: '#155724', display: 'block', fontWeight: 'bold'}}>✓ Current FTR:</small>
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
                style={{width: '100%'}}
              />
              {ftrDocument && (
                <small style={{color: '#4CAF50', display: 'block', marginTop: '5px'}}>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '600px'}}>
            <h3>📊 Configure Production Report</h3>
            
            <div className="form-section">
              <h4 style={{color: '#1976d2', marginBottom: '10px'}}>📅 Date Range</h4>
              <div style={{display: 'flex', gap: '15px'}}>
                <div className="form-group" style={{flex: 1}}>
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={pdfDateRange.startDate}
                    onChange={(e) => setPdfDateRange({...pdfDateRange, startDate: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{flex: 1}}>
                  <label>End Date</label>
                  <input
                    type="date"
                    value={pdfDateRange.endDate}
                    onChange={(e) => setPdfDateRange({...pdfDateRange, endDate: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="form-section" style={{marginTop: '20px'}}>
              <h4 style={{color: '#1976d2', marginBottom: '10px'}}>✅ Include in Report</h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                <label style={{display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeProductionDetails}
                    onChange={(e) => setReportOptions({...reportOptions, includeProductionDetails: e.target.checked})}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px'}}>📈 Production Details</span>
                </label>

                <label style={{display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeCellInventory}
                    onChange={(e) => setReportOptions({...reportOptions, includeCellInventory: e.target.checked})}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px'}}>📦 Cell Inventory</span>
                </label>

                <label style={{display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeKPIMetrics}
                    onChange={(e) => setReportOptions({...reportOptions, includeKPIMetrics: e.target.checked})}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px'}}>🎯 KPI Metrics</span>
                </label>

                <label style={{display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeDayWiseSummary}
                    onChange={(e) => setReportOptions({...reportOptions, includeDayWiseSummary: e.target.checked})}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px'}}>📊 Day-wise Summary</span>
                </label>

                <label style={{display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#fff3e0', borderRadius: '5px', cursor: 'pointer', gridColumn: '1 / -1'}}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeRejections}
                    onChange={(e) => setReportOptions({...reportOptions, includeRejections: e.target.checked})}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px', fontWeight: 'bold'}}>❌ Rejection Details</span>
                </label>

                <label style={{display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', cursor: 'pointer', gridColumn: '1 / -1'}}>
                  <input
                    type="checkbox"
                    checked={reportOptions.includeBomMaterials}
                    onChange={(e) => setReportOptions({...reportOptions, includeBomMaterials: e.target.checked})}
                    style={{marginRight: '10px', width: '18px', height: '18px'}}
                  />
                  <span style={{fontSize: '14px', fontWeight: 'bold'}}>📦 BOM Materials & Documents</span>
                </label>
              </div>
            </div>

            <div className="modal-actions" style={{marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
              <button className="btn-save" onClick={handleGeneratePDF} style={{flex: 1, padding: '12px'}}>
                📄 Generate PDF
              </button>
              <button className="btn-save" onClick={handleGenerateExcel} style={{backgroundColor: '#4CAF50', flex: 1, padding: '12px'}}>
                📊 Generate Excel
              </button>
              <button className="btn-cancel" onClick={() => setShowPDFModal(false)} style={{padding: '12px'}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COC Warning Modal */}
      {showCocWarningModal && cocValidation && (
        <div className="modal-overlay" onClick={() => setShowCocWarningModal(false)}>
          <div className="modal-content" style={{maxWidth: '800px', maxHeight: '90vh', overflow: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ COC Material Availability Check</h2>
              <button className="close-btn" onClick={() => setShowCocWarningModal(false)}>×</button>
            </div>
            
            <div style={{padding: '20px'}}>
              <div style={{marginBottom: '20px', padding: '15px', background: cocValidation.valid ? '#d4edda' : '#f8d7da', borderRadius: '8px', border: `2px solid ${cocValidation.valid ? '#28a745' : '#dc3545'}`}}>
                <h3 style={{margin: '0 0 10px 0', color: cocValidation.valid ? '#155724' : '#721c24'}}>
                  {cocValidation.valid ? '✅ All Materials Available' : '❌ Material Shortage Detected'}
                </h3>
                <p style={{margin: 0, fontSize: '14px', color: cocValidation.valid ? '#155724' : '#721c24'}}>
                  Total Production: <strong>{cocValidation.total_production} modules</strong>
                </p>
              </div>

              {cocValidation.warnings && cocValidation.warnings.length > 0 && (
                <div style={{marginBottom: '20px'}}>
                  <h3 style={{color: '#dc3545', marginBottom: '15px'}}>⚠️ Warnings:</h3>
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

              <div style={{marginBottom: '20px'}}>
                <h3 style={{marginBottom: '15px'}}>📊 Material Status:</h3>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                  <thead>
                    <tr style={{background: '#f8f9fa'}}>
                      <th style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'left'}}>Material</th>
                      <th style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'right'}}>Required</th>
                      <th style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'right'}}>Available</th>
                      <th style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'right'}}>After Use</th>
                      <th style={{padding: '10px', border: '1px solid #dee2e6', textAlign: 'center'}}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cocValidation.materials && cocValidation.materials.map((material, idx) => (
                      <tr key={idx} style={{background: material.is_sufficient ? '#fff' : '#ffebee'}}>
                        <td style={{padding: '8px', border: '1px solid #dee2e6'}}>{material.material}</td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'right'}}>{material.required.toLocaleString()}</td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'right'}}>{material.available.toLocaleString()}</td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold', color: material.is_sufficient ? '#28a745' : '#dc3545'}}>
                          {material.is_sufficient ? material.remaining_after.toLocaleString() : `-${material.shortage.toLocaleString()}`}
                        </td>
                        <td style={{padding: '8px', border: '1px solid #dee2e6', textAlign: 'center'}}>
                          {material.is_sufficient ? '✅' : '❌'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{padding: '15px', background: '#e7f3ff', borderRadius: '6px', border: '2px solid #2196F3'}}>
                <strong>💡 Note:</strong> COC materials are consumed automatically from the shared pool using FIFO (First In, First Out) method. Please ensure sufficient COC documents are added before proceeding with production.
              </div>

              <div className="modal-actions" style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
                {!cocValidation.valid ? (
                  <>
                    <button className="btn-cancel" onClick={() => setShowCocWarningModal(false)} style={{flex: 1}}>
                      ❌ Cannot Proceed - Add COC First
                    </button>
                    <button className="btn-save" onClick={() => {
                      setShowCocWarningModal(false);
                      window.open('/#/coc-dashboard', '_blank');
                    }} style={{flex: 1, background: '#2196F3'}}>
                      📋 Go to COC Dashboard
                    </button>
                  </>
                ) : (
                  <button className="btn-save" onClick={() => setShowCocWarningModal(false)} style={{flex: 1}}>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h3>📤 Upload COC Materials to PDI Batch</h3>
            <p style={{color: '#666', marginBottom: '20px'}}>
              Select COC materials to upload for PDI Done records. Data will be fetched from COC API.
            </p>

            <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>
              <h4>PDI Done Records:</h4>
              <ul style={{margin: '10px 0', paddingLeft: '20px'}}>
                {selectedCompany.productionRecords
                  ?.filter(r => r.pdi && r.pdi.trim() !== '')
                  .map(record => (
                    <li key={record.id} style={{marginBottom: '5px'}}>
                      <strong>{record.date}</strong> - PDI: {record.pdi} - Production: {(record.dayProduction || 0) + (record.nightProduction || 0)} modules
                    </li>
                  ))}
              </ul>
            </div>

            <div style={{marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center'}}>
              <div style={{flex: 1}}>
                <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>🔍 Search by Invoice Number:</label>
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
              <div style={{marginBottom: '20px'}}>
                <h4>Available COC Materials ({availableCocData.length}):</h4>
                <div style={{maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '5px', padding: '10px'}}>
                  <table style={{width: '100%', fontSize: '12px'}}>
                    <thead style={{position: 'sticky', top: 0, backgroundColor: '#f8f9fa'}}>
                      <tr>
                        <th style={{textAlign: 'left', padding: '8px'}}>Select</th>
                        <th style={{textAlign: 'left', padding: '8px'}}>Invoice No</th>
                        <th style={{textAlign: 'left', padding: '8px'}}>Material</th>
                        <th style={{textAlign: 'left', padding: '8px'}}>Lot Number</th>
                        <th style={{textAlign: 'left', padding: '8px'}}>Quantity</th>
                        <th style={{textAlign: 'left', padding: '8px'}}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableCocData.map((material, index) => (
                        <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                          <td style={{padding: '8px'}}>
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
                          <td style={{padding: '8px'}}>{material.invoice_no || 'N/A'}</td>
                          <td style={{padding: '8px'}}>{material.material_name || 'N/A'}</td>
                          <td style={{padding: '8px'}}>{material.lot_number || 'N/A'}</td>
                          <td style={{padding: '8px'}}>{material.quantity || 'N/A'}</td>
                          <td style={{padding: '8px'}}>{material.date || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
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
        
        // Consolidate BOM materials from all records of this PDI
        const consolidatedBomMap = {};
        pdiRecords.forEach(record => {
          if (record.bomMaterials && record.bomMaterials.length > 0) {
            record.bomMaterials.forEach(bm => {
              const key = `${bm.materialName}_${bm.lotNumber || 'no_invoice'}`;
              if (!consolidatedBomMap[key]) {
                consolidatedBomMap[key] = { ...bm };
              }
            });
          }
        });
        const consolidatedBom = Object.values(consolidatedBomMap);
        
        return (
          <div className="modal-overlay" onClick={() => setShowPdiDetailsModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'}}>
              <h3>📋 {selectedPdiForDetails} - BOM Materials & COC Details</h3>
              
              <div style={{padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '5px', marginBottom: '20px', border: '2px solid #28a745'}}>
                <p style={{margin: '5px 0', fontSize: '14px'}}><strong>Total Records:</strong> {pdiRecords.length} days</p>
                <p style={{margin: '5px 0', fontSize: '14px'}}><strong>Total Production:</strong> {totalProduction} modules</p>
                <p style={{margin: '5px 0', fontSize: '14px'}}><strong>Date Range:</strong> {pdiRecords[0]?.date} to {pdiRecords[pdiRecords.length - 1]?.date}</p>
                <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
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
                <div style={{marginBottom: '25px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '5px', border: '2px solid #FF9800'}}>
                  <h4 style={{marginTop: 0, color: '#FF6F00'}}>📊 Required COCs for {selectedPdiForDetails}</h4>
                  <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
                    Based on <strong>{totalProduction} modules</strong> production
                  </p>
                  
                  {requiredCocsReport.map((req, idx) => (
                    <div key={idx} style={{marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #dee2e6'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <div>
                          <strong style={{fontSize: '14px', color: '#1976d2'}}>{req.materialName}</strong>
                          {req.productType && <span style={{fontSize: '11px', color: '#666', marginLeft: '8px'}}>({req.productType})</span>}
                        </div>
                        <div style={{fontSize: '13px', fontWeight: 'bold', color: '#d32f2f'}}>
                          Required: {req.requiredQty} <span style={{fontSize: '10px', color: '#666'}}>({req.perModuleQty} per module)</span>
                        </div>
                      </div>
                      
                      {/* Available COCs by Company */}
                      {Object.keys(req.availableCocs).length > 0 ? (
                        <div>
                          {Object.entries(req.availableCocs).map(([company, cocs]) => {
                            const totalAvailable = cocs.reduce((sum, coc) => sum + coc.cocQty, 0);
                            const isEnough = totalAvailable >= req.requiredQty;
                            
                            return (
                              <div key={company} style={{marginTop: '10px', padding: '10px', backgroundColor: isEnough ? '#e8f5e9' : '#ffebee', borderRadius: '4px', border: `1px solid ${isEnough ? '#4caf50' : '#f44336'}`}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                  <strong style={{fontSize: '12px', color: '#333'}}>{company}</strong>
                                  <span style={{fontSize: '12px', fontWeight: 'bold', color: isEnough ? '#4caf50' : '#f44336'}}>
                                    Available: {totalAvailable} {isEnough ? '✅' : '⚠️'}
                                  </span>
                                </div>
                                
                                {/* Individual COCs */}
                                <div style={{maxHeight: '120px', overflowY: 'auto'}}>
                                  {cocs.map((coc, cocIdx) => (
                                    <div key={cocIdx} style={{padding: '5px', backgroundColor: 'white', marginBottom: '5px', borderRadius: '3px', fontSize: '11px'}}>
                                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                        <span>Invoice: <strong>{coc.invoiceNo}</strong></span>
                                        <span>Qty: <strong>{coc.cocQty}</strong></span>
                                      </div>
                                      {coc.lotBatchNo && <div style={{color: '#666'}}>Lot: {coc.lotBatchNo}</div>}
                                      {coc.invoiceDate && <div style={{color: '#666'}}>Date: {coc.invoiceDate}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px', textAlign: 'center', color: '#d32f2f', fontSize: '12px'}}>
                          ❌ No COC available in database
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{marginTop: '20px', marginBottom: '15px'}}>📦 BOM Materials for Complete PDI:</h4>
              {consolidatedBom.length > 0 ? (
                <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #dee2e6'}}>
                  <table style={{width: '100%', fontSize: '11px'}}>
                    <thead>
                      <tr style={{backgroundColor: '#e9ecef'}}>
                        <th style={{padding: '8px', textAlign: 'left', border: '1px solid #dee2e6'}}>Material</th>
                        <th style={{padding: '8px', textAlign: 'left', border: '1px solid #dee2e6'}}>Invoice No</th>
                        <th style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6'}}>COC Qty</th>
                        <th style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6'}}>Used Qty</th>
                        <th style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6'}}>Gap</th>
                        <th style={{padding: '8px', textAlign: 'left', border: '1px solid #dee2e6'}}>Used in PDI</th>
                        <th style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6'}}>Image</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidatedBom.map((bm, idx) => {
                        // Calculate total used quantity based on total production
                        const materialLower = bm.materialName.toLowerCase();
                        
                        let usedQty = 0;
                        if (materialLower.includes('cell')) {
                          usedQty = totalProduction * 66; // 66 cells per module
                        } else if (materialLower.includes('glass')) {
                          usedQty = totalProduction * 1; // 1 glass per module
                        } else if (materialLower.includes('ribbon') && !materialLower.includes('bus')) {
                          usedQty = totalProduction * 0.212; // 0.212 kg ribbon per module
                        } else if (materialLower.includes('flux')) {
                          usedQty = totalProduction * 0.02; // 0.02 ltr per module
                        } else if (materialLower.includes('bus bar 4mm') || materialLower.includes('busbar 4mm')) {
                          usedQty = totalProduction * 0.038; // 0.038 kg per module
                        } else if (materialLower.includes('bus bar 6mm') || materialLower.includes('busbar 6mm')) {
                          usedQty = totalProduction * 0.018; // 0.018 kg per module
                        } else if (materialLower.includes('epe')) {
                          usedQty = totalProduction * 5.2; // 5.2 sqm per module
                        } else if (materialLower.includes('frame')) {
                          usedQty = totalProduction * 1; // 1 set per module
                        } else if (materialLower.includes('sealant') || materialLower.includes('silicone 270')) {
                          usedQty = totalProduction * 0.35; // 0.35 kg per module
                        } else if (materialLower.includes('potting')) {
                          usedQty = totalProduction * 0.021; // 0.021 kg per module
                        } else if (materialLower.includes('jb') || materialLower.includes('junction')) {
                          usedQty = totalProduction * 1; // 1 junction box per module
                        } else {
                          usedQty = totalProduction * 1; // Default 1 per module
                        }
                        
                        // Round to 2 decimal places
                        usedQty = Math.round(usedQty * 100) / 100;
                        
                        // Check if manual override exists
                        const key = `${bm.materialName}_${bm.lotNumber || 'no_invoice'}`;
                        const finalUsedQty = manualUsedQty[key] !== undefined ? manualUsedQty[key] : usedQty;
                        
                        const cocQty = parseFloat(bm.cocQty) || 0;
                        const gap = Math.round((cocQty - finalUsedQty) * 100) / 100;
                        
                        return (
                          <tr key={idx}>
                            <td style={{padding: '8px', border: '1px solid #dee2e6'}}>
                              <span
                                onClick={() => handleMaterialClick(bm.materialName)}
                                style={{
                                  color: '#007bff',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                  fontSize: '11px'
                                }}
                                title="Click to select COC for this material"
                              >
                                {getDisplayMaterialName(bm.materialName)}
                              </span>
                            </td>
                            <td style={{padding: '8px', border: '1px solid #dee2e6', fontSize: '10px'}}>{bm.lotNumber || '-'}</td>
                            <td style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6', fontWeight: '500'}}>{bm.cocQty || '-'}</td>
                            <td style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6'}}>
                              {editingUsedQty && editingUsedQty.materialName === bm.materialName && editingUsedQty.lotNumber === bm.lotNumber ? (
                                <div style={{display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center'}}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editUsedQtyValue}
                                    onChange={(e) => setEditUsedQtyValue(e.target.value)}
                                    style={{
                                      width: '80px',
                                      padding: '4px',
                                      border: '2px solid #007bff',
                                      borderRadius: '3px',
                                      fontSize: '11px'
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      const key = `${bm.materialName}_${bm.lotNumber || 'no_invoice'}`;
                                      setManualUsedQty({...manualUsedQty, [key]: parseFloat(editUsedQtyValue)});
                                      setEditingUsedQty(null);
                                      setEditUsedQtyValue('');
                                    }}
                                    style={{
                                      padding: '3px 6px',
                                      background: '#28a745',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontWeight: 'bold'
                                    }}
                                    title="Save"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingUsedQty(null);
                                      setEditUsedQtyValue('');
                                    }}
                                    style={{
                                      padding: '3px 6px',
                                      background: '#dc3545',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      fontSize: '10px',
                                      fontWeight: 'bold'
                                    }}
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div style={{display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center'}}>
                                  <span>
                                    {(() => {
                                      const key = `${bm.materialName}_${bm.lotNumber || 'no_invoice'}`;
                                      if (manualUsedQty[key] !== undefined) {
                                        return manualUsedQty[key];
                                      }
                                      return usedQty || '-';
                                    })()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingUsedQty({materialName: bm.materialName, lotNumber: bm.lotNumber});
                                      const key = `${bm.materialName}_${bm.lotNumber || 'no_invoice'}`;
                                      setEditUsedQtyValue(manualUsedQty[key] !== undefined ? manualUsedQty[key] : usedQty);
                                    }}
                                    style={{
                                      padding: '2px 5px',
                                      background: '#007bff',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      fontSize: '9px'
                                    }}
                                    title="Edit used quantity"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={{
                              padding: '8px', 
                              textAlign: 'center', 
                              border: '1px solid #dee2e6',
                              fontWeight: '500',
                              color: gap >= 0 ? '#28a745' : '#dc3545'
                            }}>
                              {bm.cocQty ? (gap >= 0 ? `+${gap}` : gap) : '-'}
                            </td>
                            <td style={{
                              padding: '8px', 
                              border: '1px solid #dee2e6',
                              fontSize: '10px',
                              backgroundColor: bm.usedInPdis && bm.usedInPdis.length > 1 ? '#fff3cd' : 'transparent'
                            }}>
                              {bm.usedInPdis && bm.usedInPdis.length > 0 ? (
                                <div style={{display: 'flex', flexDirection: 'column', gap: '3px'}}>
                                  {bm.usedInPdis.map((pdiWithCompany, pdiIdx) => {
                                    // Extract PDI number from "PDI-1 (Company Name)" format
                                    const pdiMatch = pdiWithCompany.match(/^([^\(]+)/);
                                    const pdi = pdiMatch ? pdiMatch[1].trim() : pdiWithCompany;
                                    const isCurrentPdi = pdi === selectedPdiForDetails;
                                    
                                    return (
                                      <span 
                                        key={pdiIdx}
                                        style={{
                                          padding: '3px 8px',
                                          backgroundColor: isCurrentPdi ? '#007bff' : '#6c757d',
                                          color: 'white',
                                          borderRadius: '4px',
                                          fontSize: '9px',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap',
                                          display: 'inline-block',
                                          textAlign: 'left'
                                        }}
                                        title={isCurrentPdi ? 'Current PDI' : 'Also used in this PDI'}
                                      >
                                        {pdiWithCompany}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : '-'}
                            </td>
                            <td style={{padding: '8px', textAlign: 'center', border: '1px solid #dee2e6'}}>
                              {bm.imagePath ? (
                                <button
                                  onClick={() => window.open(window.location.hostname === 'localhost' ? `http://localhost:5003${bm.imagePath}` : bm.imagePath, '_blank')}
                                  style={{padding: '3px 6px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px'}}
                                >
                                  📷 View
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{color: '#999', fontStyle: 'italic', fontSize: '12px', padding: '20px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>
                  No BOM materials uploaded yet. Use the "COC Link" button in the production table to add materials.
                </p>
              )}

              <div style={{marginTop: '30px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '5px', border: '2px solid #2196F3'}}>
                <h4 style={{marginTop: 0}}>📑 Generate COC Report with PDFs</h4>
                <p style={{fontSize: '13px', color: '#666'}}>Generate consolidated COC report with all PDF documents indexed</p>
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const API_BASE_URL = getAPIBaseURL();
                      
                      // Collect all unique COC invoice numbers from BOM materials
                      const cocInvoices = new Set();
                      pdiRecords.forEach(record => {
                        record.bomMaterials?.forEach(bm => {
                          if (bm.lotNumber) {
                            cocInvoices.add(bm.lotNumber);
                          }
                        });
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

              <div className="modal-actions" style={{marginTop: '20px'}}>
                <button className="btn-cancel" onClick={() => setShowPdiDetailsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Material COC Selection Modal */}
      {showMaterialCocModal && selectedMaterial && (
        <div className="modal-overlay" onClick={() => setShowMaterialCocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h3>📦 Select COC for: {selectedMaterial}</h3>
            <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>
              Click on any COC to assign it to <strong>{selectedMaterial}</strong> across all dates in PDI <strong>{selectedPdiForDetails}</strong>
            </p>

            {loadingMaterialCoc ? (
              <div style={{textAlign: 'center', padding: '40px'}}>
                <p>⏳ Loading COC data from API...</p>
              </div>
            ) : materialCocData.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px'}}>
                <p style={{color: '#999'}}>❌ No COC data available from API</p>
                <p style={{fontSize: '12px', color: '#666', marginBottom: '20px'}}>You can add COC manually using the button below</p>
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
                <div style={{marginBottom: '15px', textAlign: 'right'}}>
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
                <div style={{display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #dee2e6'}}>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#495057'}}>🔍 Material Filter:</label>
                    <select
                      value={cocMaterialFilter}
                      onChange={(e) => setCocMaterialFilter(e.target.value)}
                      style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                    >
                      <option value="all">All Materials</option>
                      {[...new Set(materialCocData.map(coc => coc.material_name).filter(Boolean))].map(material => (
                        <option key={material} value={material}>{material}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#495057'}}>🔎 Invoice Search:</label>
                    <input
                      type="text"
                      value={cocInvoiceFilter}
                      onChange={(e) => setCocInvoiceFilter(e.target.value)}
                      placeholder="Search by invoice number..."
                      style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
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
                      <p style={{fontSize: '12px', color: '#666', marginBottom: '10px'}}>Showing {filteredData.length} of {materialCocData.length} records</p>
                      {filteredData.length === 0 ? (
                        <div style={{textAlign: 'center', padding: '40px'}}>
                          <p style={{color: '#999'}}>No records match your filter</p>
                        </div>
                      ) : (
              <div style={{maxHeight: '500px', overflowY: 'auto'}}>
                <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse'}}>
                  <thead style={{position: 'sticky', top: 0, backgroundColor: '#f8f9fa'}}>
                    <tr style={{backgroundColor: '#007bff', color: 'white'}}>
                      <th style={{padding: '6px', textAlign: 'left', border: '1px solid #dee2e6'}}>Material Name</th>
                      <th style={{padding: '6px', textAlign: 'left', border: '1px solid #dee2e6'}}>Brand</th>
                      <th style={{padding: '6px', textAlign: 'left', border: '1px solid #dee2e6'}}>Invoice No</th>
                      <th style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>Invoice Date</th>
                      <th style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>COC Qty</th>
                      <th style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>Invoice Qty</th>
                      <th style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>COC Doc</th>
                      <th style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>IQC Doc</th>
                      <th style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((coc, idx) => (
                      <tr key={idx} style={{backgroundColor: idx % 2 === 0 ? 'white' : '#f8f9fa'}}>
                        <td style={{padding: '6px', border: '1px solid #dee2e6', fontWeight: '500'}}>{coc.material_name || '-'}</td>
                        <td style={{padding: '6px', border: '1px solid #dee2e6', fontSize: '10px'}}>{coc.brand || '-'}</td>
                        <td style={{padding: '6px', border: '1px solid #dee2e6'}}>{coc.invoice_no || '-'}</td>
                        <td style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>{coc.invoice_date || '-'}</td>
                        <td style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6', fontWeight: '500'}}>{coc.coc_qty || '-'}</td>
                        <td style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>{coc.invoice_qty || '-'}</td>
                        <td style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>
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
                        <td style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>
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
                        <td style={{padding: '6px', textAlign: 'center', border: '1px solid #dee2e6'}}>
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
                    ))}
                  </tbody>
                </table>
              </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            <div style={{marginTop: '20px', textAlign: 'right'}}>
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

      {/* Manual COC Entry Modal */}
      {showManualCocModal && (
        <div className="modal-overlay" onClick={() => setShowManualCocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h3>➕ Add COC Manually</h3>
            <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>
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
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                <div style={{gridColumn: 'span 2'}}>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    Material Name <span style={{color: 'red'}}>*</span>
                  </label>
                  <select
                    value={manualCocForm.materialName}
                    onChange={(e) => setManualCocForm({...manualCocForm, materialName: e.target.value})}
                    required
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
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
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    Invoice Number <span style={{color: 'red'}}>*</span>
                  </label>
                  <input
                    type="text"
                    value={manualCocForm.invoiceNo}
                    onChange={(e) => setManualCocForm({...manualCocForm, invoiceNo: e.target.value})}
                    required
                    placeholder="e.g., INV2025110613-2"
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                </div>

                <div>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    Brand
                  </label>
                  <input
                    type="text"
                    value={manualCocForm.brand}
                    onChange={(e) => setManualCocForm({...manualCocForm, brand: e.target.value})}
                    placeholder="e.g., ABC Corp"
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                </div>

                <div>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    Lot/Batch Number
                  </label>
                  <input
                    type="text"
                    value={manualCocForm.lotBatchNo}
                    onChange={(e) => setManualCocForm({...manualCocForm, lotBatchNo: e.target.value})}
                    placeholder="e.g., LOT123"
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                </div>

                <div>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    COC Quantity <span style={{color: 'red'}}>*</span>
                  </label>
                  <input
                    type="number"
                    value={manualCocForm.cocQty}
                    onChange={(e) => setManualCocForm({...manualCocForm, cocQty: e.target.value})}
                    required
                    placeholder="e.g., 200000"
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                </div>

                <div>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    Invoice Quantity
                  </label>
                  <input
                    type="number"
                    value={manualCocForm.invoiceQty}
                    onChange={(e) => setManualCocForm({...manualCocForm, invoiceQty: e.target.value})}
                    placeholder="e.g., 200000"
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                </div>

                <div>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    Invoice Date <span style={{color: 'red'}}>*</span>
                  </label>
                  <input
                    type="date"
                    value={manualCocForm.invoiceDate}
                    onChange={(e) => setManualCocForm({...manualCocForm, invoiceDate: e.target.value})}
                    required
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                </div>

                <div style={{gridColumn: 'span 2'}}>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    📄 COC PDF Document
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setManualCocForm({...manualCocForm, cocPdf: e.target.files[0]})}
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                  {manualCocForm.cocPdf && (
                    <p style={{fontSize: '11px', color: '#28a745', marginTop: '5px'}}>
                      ✅ {manualCocForm.cocPdf.name}
                    </p>
                  )}
                </div>

                <div style={{gridColumn: 'span 2'}}>
                  <label style={{display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '13px'}}>
                    📋 IQC PDF Document (Optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setManualCocForm({...manualCocForm, iqcPdf: e.target.files[0]})}
                    style={{width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px'}}
                  />
                  {manualCocForm.iqcPdf && (
                    <p style={{fontSize: '11px', color: '#28a745', marginTop: '5px'}}>
                      ✅ {manualCocForm.iqcPdf.name}
                    </p>
                  )}
                </div>
              </div>

              <div style={{marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
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
