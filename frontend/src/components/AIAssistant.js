import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/AIAssistant.css';

const AIAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [ftrData, setFtrData] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [checkResults, setCheckResults] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [binningCheckLoading, setBinningCheckLoading] = useState(false);
  const [vehicleLoadingLoading, setVehicleLoadingLoading] = useState(false);
  const [vehicleFromDate, setVehicleFromDate] = useState('');
  const [vehicleToDate, setVehicleToDate] = useState('');
  const [pdiNumber, setPdiNumber] = useState('');
  const [pdiStatusLoading, setPdiStatusLoading] = useState(false);
  const [pdiList, setPdiList] = useState([]); // PDI dropdown list
  const [palletSearchLoading, setPalletSearchLoading] = useState(false);
  const [showBinningSourceModal, setShowBinningSourceModal] = useState(false);
  const [pendingPalletFile, setPendingPalletFile] = useState(null);
  const fileInputRef = useRef(null);
  const binningFileInputRef = useRef(null);
  const palletFileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

  useEffect(() => {
    checkApiConfig();
    loadFTRData();
    checkSchedulerStatus();
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '👋 Namaste! Main aapka AI FTR Assistant hoon.\n\n📊 **Smart Excel Commands:**\n• "Rays ka R-3 excel do"\n• "L&T ke I-2 packed barcodes"\n• "Sterlin ka dispatched excel do"\n• "50 barcode list do"\n\n📁 **Upload & Check:**\n• Sidebar se Excel upload karke barcode status check karo\n• 🏷️ **Binning Check:** Serial numbers ki binning check karo\n\n❓ **Questions:**\n• "Total packed kitne hai?"\n• "Binning wise breakup batao"'
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkApiConfig = async () => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/ai/config`);
      setApiKeyConfigured(response.data.configured);
    } catch (error) {
      console.error('Failed to check API config:', error);
    }
  };

  const loadFTRData = async () => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/ai/data`);
      if (response.data.success) {
        setFtrData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load FTR data:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    setLoading(true);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/chat`, {
        message: userMessage
      });

      if (response.data.success) {
        // Check if response has Excel data
        const hasExcel = response.data.has_excel && response.data.excel_base64;

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.response,
          hasExcel: hasExcel,
          excelData: response.data.excel_base64,
          excelParams: response.data.excel_params
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfigureApiKey = async () => {
    if (!apiKey.trim()) {
      alert('Please enter API key');
      return;
    }

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/config`, {
        api_key: apiKey.trim()
      });

      if (response.data.success) {
        setApiKeyConfigured(true);
        setShowApiKeyModal(false);
        setApiKey('');
        alert('✅ API Key configured successfully!');
      }
    } catch (error) {
      alert('❌ Failed to configure API key');
    }
  };

  // Categorized suggested questions
  const suggestedQuestions = {
    pallet: {
      icon: '📦',
      title: 'Pallet',
      questions: [
        "Rays ke kitne pallet dispatch hue?",
        "L&T ka pallet audit karo",
        "S&W me total kitne pallet packed?",
        "Mix packing check karo"
      ]
    },
    julian: {
      icon: '📅',
      title: 'Julian Date',
      questions: [
        "Julian 350 se 365 ka data",
        "Oldest pending julian batao",
        "Rays ka julian wise breakdown",
        "300 se purane pending modules"
      ]
    },
    barcode: {
      icon: '🔢',
      title: 'Barcode',
      questions: [
        "50 barcode packed list do",
        "R-3 I-2 ke pending barcodes",
        "Duplicate barcode check karo",
        "Missing barcodes in MRP"
      ]
    },
    quality: {
      icon: '✅',
      title: 'Quality Check',
      questions: [
        "Binning mismatch check karo",
        "Rejected packed check karo",
        "Extra barcodes in MRP",
        "Full quality audit karo"
      ]
    },
    status: {
      icon: '📊',
      title: 'Status',
      questions: [
        "Rays ka R-3 status",
        "L&T ka I-2 dispatched kitna?",
        "All companies comparison",
        "Sterlin ka full status"
      ]
    }
  };

  const [activeCategory, setActiveCategory] = useState('pallet');
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    quickExport: true,
    fullExport: false,
    uploads: false,
    validation: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Excel download handler
  const handleExcelDownload = async (exportType, companyId = null, companyName = null) => {
    const targetCompany = companyName || selectedCompany || 'All';
    setExportLoading(true);
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/export/excel`, {
        type: exportType,
        company_id: companyId,
        company_name: targetCompany
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportType}_${targetCompany}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Add success message to chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Excel downloaded: ${exportType} data for ${targetCompany}`
      }]);
    } catch (error) {
      console.error('Excel download error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Excel download failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setExportLoading(false);
    }
  };

  // Barcode check - upload Excel and check status
  const handleBarcodeCheck = async (file) => {
    if (!file) return;

    const targetCompany = selectedCompany || 'Rays Power';
    setUploadingFile(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: `📤 Uploading ${file.name} to check barcode status for ${targetCompany}...`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_name', targetCompany);

      const response = await axios.post(`${API_BASE_URL}/api/ai/check-barcodes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const { summary, results, excel_base64, message } = response.data;
        setCheckResults({ summary, results, excel_base64 });

        // Create detailed message
        let resultMessage = `📊 **Barcode Status Check Complete!**\n\n${message}\n\n`;

        // Show first 10 results
        if (results && results.length > 0) {
          resultMessage += `\n**Sample Results (first 10):**\n`;
          results.slice(0, 10).forEach((r, i) => {
            resultMessage += `${i + 1}. ${r.barcode} - ${r.status}`;
            if (r.running_order) resultMessage += ` | ${r.running_order}`;
            if (r.binning) resultMessage += ` | ${r.binning}`;
            resultMessage += '\n';
          });
          if (results.length > 10) {
            resultMessage += `\n... and ${results.length - 10} more. Download Excel for full report.`;
          }
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: resultMessage,
          hasExcel: !!excel_base64,
          excelData: excel_base64
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Barcode check error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Barcode check failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Download Excel from base64
  const downloadExcelFromBase64 = (base64Data, filename = 'Barcode_Status.xlsx') => {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed');
    }
  };

  // Binning Check - Upload Excel and check binning from database
  const handleBinningCheck = async (file) => {
    if (!file) return;

    setBinningCheckLoading(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: `📤 Uploading ${file.name} to check binning...`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_BASE_URL}/api/ai/check-binning`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const { summary, results, excel_base64, message } = response.data;

        // Create detailed message
        let resultMessage = message + '\n\n';

        // Show first 10 results
        if (results && results.length > 0) {
          resultMessage += `**Sample Results (first 10):**\n`;
          results.slice(0, 10).forEach((r, i) => {
            resultMessage += `${i + 1}. ${r.serial_number} - **${r.binning}** | Pmax: ${r.pmax} | ${r.status}\n`;
          });
          if (results.length > 10) {
            resultMessage += `\n... and ${results.length - 10} more. Download Excel for full report.`;
          }
        }

        const excelFilename = `Binning_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

        // Auto download Excel
        if (excel_base64) {
          downloadExcelFromBase64(excel_base64, excelFilename);
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: resultMessage,
          hasExcel: !!excel_base64,
          excelData: excel_base64,
          excelFilename: excelFilename
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Binning check error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Binning check failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setBinningCheckLoading(false);
      if (binningFileInputRef.current) binningFileInputRef.current.value = '';
    }
  };

  // Run Packing Validation - Check all issues
  const handleRunValidation = async () => {
    setValidationLoading(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: `🔍 Running Packing Validation${selectedCompany ? ` for ${selectedCompany}` : ' for all companies'}...`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/run-validation-now`, {
        company: selectedCompany || null
      });

      if (response.data.success) {
        const { results, total_issues, whatsapp_alerts_sent } = response.data;

        let resultMessage = `📊 **Packing Validation Complete!**\n\n`;
        resultMessage += `🔔 WhatsApp Alerts Sent: ${whatsapp_alerts_sent}\n`;
        resultMessage += `⚠️ Total Issues Found: ${total_issues}\n\n`;

        // Show results for each company
        results.forEach(companyResult => {
          const issues = companyResult.issues || [];
          const issueCount = issues.length;
          const status = issueCount === 0 ? '✅' : '⚠️';

          resultMessage += `${status} **${companyResult.company}**: ${issueCount} issues\n`;

          if (issueCount > 0) {
            // Group by issue type
            const rejected = issues.filter(i => i.issue_type === 'Rejected Module Packed');
            const mixBinning = issues.filter(i => i.issue_type === 'Mix Binning');
            const wrongParty = issues.filter(i => i.issue_type === 'Wrong Party');
            const duplicates = issues.filter(i => i.issue_type === 'Duplicate Barcode');

            if (rejected.length > 0) {
              resultMessage += `  ❌ Rejected Packed: ${rejected.length}\n`;
              rejected.slice(0, 3).forEach(r => {
                resultMessage += `     - ${r.module_no} | ${r.pallet_no}\n`;
              });
              if (rejected.length > 3) resultMessage += `     ... +${rejected.length - 3} more\n`;
            }
            if (mixBinning.length > 0) {
              resultMessage += `  🔀 Mix Binning: ${mixBinning.length}\n`;
              mixBinning.slice(0, 3).forEach(r => {
                resultMessage += `     - ${r.module_no} | ${r.pallet_no} | ${r.details}\n`;
              });
              if (mixBinning.length > 3) resultMessage += `     ... +${mixBinning.length - 3} more\n`;
            }
            if (wrongParty.length > 0) {
              resultMessage += `  🚫 Wrong Party Dispatch: ${wrongParty.length}\n`;
              wrongParty.slice(0, 3).forEach(r => {
                resultMessage += `     - ${r.module_no} | ${r.pallet_no} | ${r.details}\n`;
              });
              if (wrongParty.length > 3) resultMessage += `     ... +${wrongParty.length - 3} more\n`;
            }
            if (duplicates.length > 0) {
              resultMessage += `  🔁 Duplicate Barcodes: ${duplicates.length}\n`;
              duplicates.slice(0, 3).forEach(r => {
                resultMessage += `     - ${r.module_no} | ${r.pallet_no}\n`;
              });
              if (duplicates.length > 3) resultMessage += `     ... +${duplicates.length - 3} more\n`;
            }
          }
          resultMessage += '\n';
        });

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: resultMessage
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Validation Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Validation failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setValidationLoading(false);
    }
  };

  // Check Scheduler Status
  const checkSchedulerStatus = async () => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.get(`${API_BASE_URL}/api/ai/scheduler-status`);
      if (response.data.success) {
        setSchedulerEnabled(response.data.enabled);
      }
    } catch (error) {
      console.error('Failed to check scheduler status:', error);
    }
  };

  // Toggle Scheduler (Start/Stop)
  const handleToggleScheduler = async () => {
    setSchedulerLoading(true);
    const action = schedulerEnabled ? 'stop' : 'start';

    setMessages(prev => [...prev, {
      role: 'user',
      content: `${schedulerEnabled ? '⏸️ Stopping' : '▶️ Starting'} auto validation scheduler...`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/scheduler-control`, {
        action: action
      });

      if (response.data.success) {
        setSchedulerEnabled(!schedulerEnabled);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.message
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Scheduler control error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Failed to ${action} scheduler: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setSchedulerLoading(false);
    }
  };

  // Vehicle Loading Validation - Check for wrong party and mix binning during dispatch
  const handleVehicleLoadingValidation = async () => {
    setVehicleLoadingLoading(true);

    const dateRange = vehicleFromDate && vehicleToDate
      ? `${vehicleFromDate} to ${vehicleToDate}`
      : 'Last 7 days';

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: `🚚 Running Vehicle Loading Validation (${dateRange})...`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/validate-vehicle-loading`, {
        from_date: vehicleFromDate || null,
        to_date: vehicleToDate || null
      });

      if (response.data.success) {
        const { answer } = response.data;

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: answer
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Vehicle Loading Validation Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Vehicle loading validation error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Vehicle Loading Validation failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setVehicleLoadingLoading(false);
    }
  };

  // Get PDI list when company changes
  const handleCompanyChange = (companyName) => {
    setSelectedCompany(companyName);
    setPdiNumber(''); // Reset PDI selection
    
    // Find company data and get PDI list
    if (ftrData?.companies && companyName) {
      const company = ftrData.companies.find(c => c.name === companyName);
      if (company?.pdi_breakdown) {
        setPdiList(company.pdi_breakdown);
      } else {
        setPdiList([]);
      }
    } else {
      setPdiList([]);
    }
  };

  // Handle file selection - show binning source modal first
  const handlePalletFileSelect = (file) => {
    if (!file) return;

    if (!selectedCompany) {
      alert('Please select a company first');
      return;
    }

    // Store file and show modal to ask binning source
    setPendingPalletFile(file);
    setShowBinningSourceModal(true);
  };

  // Pallet Module Excel Export - Upload Excel with pallet numbers
  const handlePalletModuleExport = async (binningSource) => {
    const file = pendingPalletFile;
    if (!file) return;

    setShowBinningSourceModal(false);
    setPalletSearchLoading(true);

    const sourceLabel = binningSource === 'packing' ? 'Packing (MRP)' : 'Total FTR (Master Database)';

    setMessages(prev => [...prev, {
      role: 'user',
      content: `📦 Uploading ${file.name} for ${selectedCompany}...\n📊 Binning Source: ${sourceLabel}`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company', selectedCompany);
      formData.append('binning_source', binningSource);

      const response = await axios.post(`${API_BASE_URL}/api/ai/pallet-modules-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const { total_modules, total_pallets, excel_base64, message, pallet_summary } = response.data;
        const excelFilename = `Pallets_${selectedCompany.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

        // Build result message
        let resultMessage = `📦 **${selectedCompany} - Pallet Modules Report**\n\n`;
        resultMessage += message + '\n\n';

        if (pallet_summary && pallet_summary.length > 0) {
          resultMessage += `**Pallet Summary:**\n`;
          pallet_summary.slice(0, 15).forEach((p, i) => {
            resultMessage += `${i + 1}. Pallet ${p.pallet_no}: ${p.module_count} modules | ${p.binning_summary}\n`;
          });
          if (pallet_summary.length > 15) {
            resultMessage += `\n... and ${pallet_summary.length - 15} more pallets. Download Excel for full details.`;
          }
        }

        // Auto download Excel if available
        if (excel_base64) {
          downloadExcelFromBase64(excel_base64, excelFilename);
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: resultMessage,
          hasExcel: !!excel_base64,
          excelData: excel_base64,
          excelFilename: excelFilename
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('Pallet module export error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Pallet search failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setPalletSearchLoading(false);
      setPendingPalletFile(null);
      if (palletFileInputRef.current) palletFileInputRef.current.value = '';
    }
  };

  // PDI Dispatch Status Check
  const handlePdiDispatchStatus = async () => {
    if (!pdiNumber.trim()) {
      alert('Please select a PDI');
      return;
    }

    setPdiStatusLoading(true);

    setMessages(prev => [...prev, {
      role: 'user',
      content: `📋 Checking dispatch status for ${selectedCompany} - ${pdiNumber}...`
    }]);

    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/pdi-dispatch-status`, {
        pdi_number: pdiNumber,
        company: selectedCompany || null
      });

      if (response.data.success) {
        const { total, dispatched, packed, pending } = response.data;
        const dispatchPercent = total > 0 ? Math.round((dispatched / total) * 100) : 0;
        const packedPercent = total > 0 ? Math.round((packed / total) * 100) : 0;
        
        // Create dashboard-style HTML response
        const dashboardHtml = `
<div class="pdi-dashboard">
  <div class="pdi-dash-header">
    <h3>📊 ${selectedCompany}</h3>
    <span class="pdi-badge">${pdiNumber}</span>
  </div>
  
  <div class="pdi-dash-cards">
    <div class="pdi-card total">
      <div class="pdi-card-icon">📦</div>
      <div class="pdi-card-value">${total.toLocaleString()}</div>
      <div class="pdi-card-label">Total Assigned</div>
    </div>
    
    <div class="pdi-card dispatched">
      <div class="pdi-card-icon">🚚</div>
      <div class="pdi-card-value">${dispatched.toLocaleString()}</div>
      <div class="pdi-card-label">Dispatched</div>
      <div class="pdi-card-percent">${dispatchPercent}%</div>
    </div>
    
    <div class="pdi-card packed">
      <div class="pdi-card-icon">📤</div>
      <div class="pdi-card-value">${packed.toLocaleString()}</div>
      <div class="pdi-card-label">Packed</div>
      <div class="pdi-card-percent">${packedPercent}%</div>
    </div>
    
    <div class="pdi-card pending">
      <div class="pdi-card-icon">⏳</div>
      <div class="pdi-card-value">${pending.toLocaleString()}</div>
      <div class="pdi-card-label">Pending</div>
    </div>
  </div>
  
  <div class="pdi-progress-section">
    <div class="pdi-progress-label">
      <span>Dispatch Progress</span>
      <span>${dispatchPercent}%</span>
    </div>
    <div class="pdi-progress-bar">
      <div class="pdi-progress-fill dispatch" style="width: ${dispatchPercent}%"></div>
    </div>
    
    <div class="pdi-progress-label">
      <span>Packing Progress</span>
      <span>${packedPercent}%</span>
    </div>
    <div class="pdi-progress-bar">
      <div class="pdi-progress-fill pack" style="width: ${packedPercent}%"></div>
    </div>
  </div>
</div>`;

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: dashboardHtml,
          isDashboard: true
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${response.data.error}`,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('PDI status error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ PDI Status Check failed: ${error.response?.data?.error || error.message}`,
        isError: true
      }]);
    } finally {
      setPdiStatusLoading(false);
    }
  };

  return (
    <div className="ai-assistant-container">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <button className="btn-back" onClick={() => window.location.href = '/'}>
            ← Back
          </button>
          <h1>🤖 AI FTR Assistant</h1>
        </div>
        <div className="ai-header-right">
          <span className={`api-status ${apiKeyConfigured ? 'configured' : 'not-configured'}`}>
            {apiKeyConfigured ? '✅ API Connected' : '⚠️ API Not Configured'}
          </span>
          <button className="btn-config" onClick={() => setShowApiKeyModal(true)}>
            ⚙️ Configure
          </button>
        </div>
      </div>

      <div className="ai-main-content">
        {/* Sidebar - FTR Summary */}
        <div className="ai-sidebar">
          <h3>📊 Live FTR Data</h3>
          {ftrData ? (
            <>
              <div className="sidebar-summary">
                <div className="summary-item">
                  <span className="label">Total Master FTR</span>
                  <span className="value">{ftrData.summary.total_master_ftr?.toLocaleString() || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Assigned</span>
                  <span className="value">{ftrData.summary.total_assigned?.toLocaleString() || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Packed</span>
                  <span className="value">{ftrData.summary.total_packed?.toLocaleString() || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label" style={{ color: '#e74c3c' }}>🔴 Extra Packed (Not in PDI)</span>
                  <span className="value warning" style={{ color: '#e74c3c', fontWeight: 'bold' }}>{ftrData.summary.total_extra_packed?.toLocaleString() || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Available</span>
                  <span className="value highlight">{ftrData.summary.total_available?.toLocaleString() || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Pending Pack</span>
                  <span className="value warning">{ftrData.summary.total_pending_pack?.toLocaleString() || 0}</span>
                </div>
              </div>
            </>
          ) : (
            <p>Loading data...</p>
          )}

          <button className="btn-refresh" onClick={loadFTRData}>
            🔄 Refresh Data
          </button>

          {/* Excel Export Buttons */}
          <h4>📥 Export Excel</h4>

          {/* Company Selector for Export */}
          <div className="company-selector">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="company-dropdown"
            >
              <option value="">-- Select Company --</option>
              {ftrData?.companies?.map((c, idx) => (
                <option key={idx} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="export-buttons">
            <div className="sidebar-section">
              <button className="section-header" onClick={() => toggleSection('quickExport')}>
                <span>📊 Data Export</span>
                <span>{expandedSections.quickExport ? '▼' : '▶'}</span>
              </button>
              {expandedSections.quickExport && (
                <div className="section-content">
                  <button className="btn-export btn-primary" onClick={() => handleExcelDownload('all')} disabled={exportLoading}>
                    📊 Summary
                  </button>
                  <button className="btn-export" onClick={() => handleExcelDownload('packed')} disabled={exportLoading || !selectedCompany}>
                    📦 Packed
                  </button>
                  <button className="btn-export" onClick={() => handleExcelDownload('pending')} disabled={exportLoading}>
                    ⏳ Pending
                  </button>
                  <button className="btn-export-small" onClick={() => handleExcelDownload('dispatched')} disabled={exportLoading || !selectedCompany}>🚚 Dispatched</button>
                  <button className="btn-export-small" onClick={() => handleExcelDownload('rejected')} disabled={exportLoading}>❌ Rejected</button>
                  <button className="btn-export-small" onClick={() => handleExcelDownload('binning')} disabled={exportLoading}>🏷️ Binning</button>
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <button className="section-header" onClick={() => toggleSection('companyWise')}>
                <span>🔴 Extra Packed Export</span>
                <span>{expandedSections.companyWise ? '▼' : '▶'}</span>
              </button>
              {expandedSections.companyWise && (
                <div className="section-content">
                  <button className="btn-export btn-danger" onClick={() => handleExcelDownload('packed_not_pdi')} disabled={exportLoading || !selectedCompany}>
                    🔴 Selected Company
                  </button>
                  {ftrData?.companies?.map((company, idx) => (
                    <button key={idx} className="btn-company-item" onClick={() => handleExcelDownload('packed_not_pdi', company.id, company.name)} disabled={exportLoading}>
                      <span>{company.name}</span>
                      <span className={`badge ${company.extra_packed > 0 ? 'badge-danger' : 'badge-success'}`}>
                        {company.extra_packed?.toLocaleString() || 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {exportLoading && <p className="export-loading">⏳ Downloading...</p>}
          
          {/* SECTION 4: FILE UPLOADS */}
          <div className="sidebar-section">
            <button className="section-header" onClick={() => toggleSection('uploads')}>
              <span>📤 Upload & Check</span>
              <span>{expandedSections.uploads ? '▼' : '▶'}</span>
            </button>
            {expandedSections.uploads && (
              <div className="section-content">
                <div className="upload-item">
                  <p className="upload-title">🔍 Barcode Status</p>
                  <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={(e) => handleBarcodeCheck(e.target.files[0])} style={{ display: 'none' }} />
                  <button className="btn-upload" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || !selectedCompany}>
                    {uploadingFile ? '⏳ Checking...' : '📤 Barcodes'}
                  </button>
                  {!selectedCompany && <p className="hint">⚠️ Select company</p>}
                </div>
                <div className="upload-item">
                  <p className="upload-title">🏷️ Serial Binning</p>
                  <input type="file" ref={binningFileInputRef} accept=".xlsx,.xls,.csv" onChange={(e) => handleBinningCheck(e.target.files[0])} style={{ display: 'none' }} />
                  <button className="btn-upload" onClick={() => binningFileInputRef.current?.click()} disabled={binningCheckLoading}>
                    {binningCheckLoading ? '⏳ Checking...' : '📤 Binning'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: VALIDATION & CHECKS */}
          <div className="sidebar-section">
            <button className="section-header" onClick={() => toggleSection('validation')}>
              <span>⚠️ Checks</span>
              <span>{expandedSections.validation ? '▼' : '▶'}</span>
            </button>
            {expandedSections.validation && (
              <div className="section-content">
                <div className="check-item">
                  <p className="check-title">🔍 Packing Validation</p>
                  <button className="btn-check" onClick={handleRunValidation} disabled={validationLoading}>
                    {validationLoading ? '⏳ Running...' : '🔍 Run'}
                  </button>
                </div>
                <div className="check-item">
                  <p className="check-title">🚚 Vehicle Loading</p>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', fontSize: '11px' }}>
                    <input type="date" value={vehicleFromDate} onChange={(e) => setVehicleFromDate(e.target.value)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    <input type="date" value={vehicleToDate} onChange={(e) => setVehicleToDate(e.target.value)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                  <button className="btn-check" onClick={handleVehicleLoadingValidation} disabled={vehicleLoadingLoading}>
                    {vehicleLoadingLoading ? '⏳ Checking...' : '✓ Check'}
                  </button>
                </div>
                <div className="check-item">
                  <p className="check-title">📋 PDI Status</p>
                  <select value={pdiNumber} onChange={(e) => setPdiNumber(e.target.value)} disabled={!selectedCompany} style={{ width: '100%', padding: '6px', fontSize: '11px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <option value="">-- Select PDI --</option>
                    {pdiList.map((pdi, idx) => (
                      <option key={idx} value={pdi.pdi}>{pdi.pdi}</option>
                    ))}
                  </select>
                  <button className="btn-check" onClick={handlePdiDispatchStatus} disabled={pdiStatusLoading || !pdiNumber.trim()}>
                    {pdiStatusLoading ? '⏳ Checking...' : '✓ Check'}
                  </button>
                </div>
                <div className="check-item">
                  <p className="check-title">📦 Pallet Module Excel</p>
                  <p className="hint" style={{ fontSize: '10px', color: '#7f8c8d', marginBottom: '6px' }}>Upload Excel with pallet numbers</p>
                  <input 
                    type="file" 
                    ref={palletFileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handlePalletFileSelect(e.target.files[0])} 
                    style={{ display: 'none' }}
                  />
                  <button className="btn-check" onClick={() => palletFileInputRef.current?.click()} disabled={palletSearchLoading || !selectedCompany} style={{ backgroundColor: '#9b59b6' }}>
                    {palletSearchLoading ? '⏳ Processing...' : '📤 Upload Pallet Excel'}
                  </button>
                  {!selectedCompany && <p className="hint" style={{ fontSize: '10px', color: '#e74c3c', marginTop: '4px' }}>⚠️ Select company first</p>}
                </div>
                <div className="check-item">
                  <p className="check-title">🤖 Auto Scheduler</p>
                  <button className="btn-scheduler" onClick={handleToggleScheduler} disabled={schedulerLoading} style={{ backgroundColor: schedulerEnabled ? '#f39c12' : '#27ae60' }}>
                    {schedulerLoading ? '⏳...' : (schedulerEnabled ? '⏸️ Stop' : '▶️ Start')}
                  </button>
                  <p className="hint" style={{ color: schedulerEnabled ? '#27ae60' : '#e74c3c', marginTop: '6px' }}>
                    {schedulerEnabled ? '🟢 Running' : '🔴 Stopped'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <button className="btn-refresh" onClick={loadFTRData} style={{ marginTop: '15px', width: '100%' }}>
            🔄 Refresh
          </button>
        </div>

        {/* Chat Area */}
        <div className="ai-chat-area">
          {/* Suggested Questions - Categorized */}
          <div className="suggested-questions-section">
            {/* Category Tabs */}
            <div className="category-tabs">
              {Object.entries(suggestedQuestions).map(([key, category]) => (
                <button
                  key={key}
                  className={`category-tab ${activeCategory === key ? 'active' : ''}`}
                  onClick={() => setActiveCategory(key)}
                >
                  {category.icon} {category.title}
                </button>
              ))}
            </div>

            {/* Questions for Active Category */}
            <div className="category-questions">
              {suggestedQuestions[activeCategory]?.questions.map((q, idx) => (
                <button
                  key={idx}
                  className="quick-q-btn"
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="messages-container">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  {msg.isDashboard ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                  ) : (
                    <pre>{msg.content}</pre>
                  )}
                  {msg.hasExcel && msg.excelData && (
                    <button
                      className="btn-download-excel"
                      onClick={() => downloadExcelFromBase64(msg.excelData, msg.excelFilename || `Report_${new Date().toISOString().slice(0, 10)}.xlsx`)}
                      style={{
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginTop: '10px',
                        fontSize: '14px'
                      }}
                    >
                      📥 Download Excel Report
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message assistant loading">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pucho kuch bhi FTR ke baare me..."
              disabled={loading}
              rows={1}
            />
            <button
              className="btn-send"
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
            >
              {loading ? '⏳' : '📤'} Send
            </button>
          </div>
        </div>
      </div>

      {/* Binning Source Selection Modal */}
      {showBinningSourceModal && (
        <div className="modal-overlay" onClick={() => { setShowBinningSourceModal(false); setPendingPalletFile(null); if (palletFileInputRef.current) palletFileInputRef.current.value = ''; }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h2>📊 Binning Data Source</h2>
            <p style={{ marginBottom: '20px', color: '#7f8c8d' }}>Binning data kahan se check karna hai?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn-save" 
                onClick={() => handlePalletModuleExport('packing')}
                style={{ 
                  padding: '15px 20px', 
                  fontSize: '14px', 
                  backgroundColor: '#3498db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                📦 Packing (MRP Data)
                <span style={{ fontSize: '11px', opacity: 0.8 }}>- Running Order se binning</span>
              </button>
              
              <button 
                className="btn-save" 
                onClick={() => handlePalletModuleExport('total_ftr')}
                style={{ 
                  padding: '15px 20px', 
                  fontSize: '14px', 
                  backgroundColor: '#9b59b6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                📊 Total FTR (Master Database)
                <span style={{ fontSize: '11px', opacity: 0.8 }}>- Uploaded FTR se binning</span>
              </button>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn-cancel" onClick={() => { setShowBinningSourceModal(false); setPendingPalletFile(null); if (palletFileInputRef.current) palletFileInputRef.current.value = ''; }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>🔑 Configure Groq API Key</h2>
            <p>Get your FREE API key from <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer">console.groq.com</a></p>

            <div className="api-key-input">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxxxxxx"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowApiKeyModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleConfigureApiKey}>
                ✅ Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
