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
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

  useEffect(() => {
    checkApiConfig();
    loadFTRData();
    checkSchedulerStatus();
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '👋 Namaste! Main aapka AI FTR Assistant hoon.\n\n📊 **Smart Excel Commands:**\n• "Rays ka R-3 excel do"\n• "L&T ke I-2 packed barcodes"\n• "Sterlin ka dispatched excel do"\n• "50 barcode list do"\n\n📁 **Upload & Check:**\n• Sidebar se Excel upload karke barcode status check karo\n\n❓ **Questions:**\n• "Total packed kitne hai?"\n• "Binning wise breakup batao"'
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
      link.setAttribute('download', `${exportType}_${targetCompany}_${new Date().toISOString().slice(0,10)}.xlsx`);
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
            resultMessage += `${i+1}. ${r.barcode} - ${r.status}`;
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
                  <span className="label">Available</span>
                  <span className="value highlight">{ftrData.summary.total_available?.toLocaleString() || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Pending Pack</span>
                  <span className="value warning">{ftrData.summary.total_pending_pack?.toLocaleString() || 0}</span>
                </div>
              </div>
              
              <h4>🏭 Companies</h4>
              <div className="company-list">
                {ftrData.companies.map((c, idx) => (
                  <div key={idx} className="company-item" onClick={() => setInput(`${c.name} ka status batao`)}>
                    <span className="company-name">{c.name}</span>
                    <span className="company-stats">
                      M: {c.master_total?.toLocaleString() || 0} | P: {c.packed?.toLocaleString() || 0}
                    </span>
                  </div>
                ))}
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
            <button 
              className="btn-export" 
              onClick={() => handleExcelDownload('all')}
              disabled={exportLoading}
            >
              📊 Summary Report
            </button>
            <button 
              className="btn-export" 
              onClick={() => handleExcelDownload('packed')}
              disabled={exportLoading || !selectedCompany}
              title={!selectedCompany ? 'Select company first' : ''}
            >
              📦 Packed Modules
            </button>
            <button 
              className="btn-export" 
              onClick={() => handleExcelDownload('dispatched')}
              disabled={exportLoading || !selectedCompany}
              title={!selectedCompany ? 'Select company first' : ''}
            >
              🚚 Dispatched Modules
            </button>
            <button 
              className="btn-export" 
              onClick={() => handleExcelDownload('pending')}
              disabled={exportLoading}
            >
              ⏳ Pending Pack
            </button>
            <button 
              className="btn-export" 
              onClick={() => handleExcelDownload('rejected')}
              disabled={exportLoading}
            >
              ❌ Rejected
            </button>
            <button 
              className="btn-export" 
              onClick={() => handleExcelDownload('binning')}
              disabled={exportLoading}
            >
              🏷️ Binning Data
            </button>
            <button 
              className="btn-export btn-packed-not-pdi" 
              onClick={() => handleExcelDownload('packed_not_pdi')}
              disabled={exportLoading || !selectedCompany}
              title={!selectedCompany ? 'Select company first' : 'Packed modules not in any PDI and not rejected'}
            >
              📦❌ Packed Not in PDI
            </button>
          </div>
          {exportLoading && <p className="export-loading">⏳ Downloading...</p>}
          
          {/* Barcode Check Upload */}
          <h4>🔍 Check Barcode Status</h4>
          <div className="barcode-check-section">
            <p className="check-help">Upload Excel with serial numbers to check packed/dispatched status</p>
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleBarcodeCheck(e.target.files[0])}
              style={{ display: 'none' }}
              id="barcode-file-input"
            />
            <button 
              className="btn-upload-check"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || !selectedCompany}
              title={!selectedCompany ? 'Select company first' : 'Upload Excel to check status'}
            >
              {uploadingFile ? '⏳ Checking...' : '📤 Upload & Check Barcodes'}
            </button>
            {!selectedCompany && <p className="check-warning">⚠️ Select company first</p>}
          </div>

          {/* Packing Validation */}
          <h4>⚠️ Packing Validation</h4>
          <div className="validation-section">
            <p className="check-help">Check for: Rejected packed, Mix binning, Wrong party dispatch, Duplicates</p>
            <button 
              className="btn-validation"
              onClick={handleRunValidation}
              disabled={validationLoading}
              style={{
                backgroundColor: '#e74c3c',
                color: 'white',
                padding: '12px 16px',
                border: 'none',
                borderRadius: '8px',
                cursor: validationLoading ? 'wait' : 'pointer',
                width: '100%',
                fontWeight: 'bold',
                fontSize: '14px',
                marginTop: '8px'
              }}
            >
              {validationLoading ? '⏳ Validating...' : '🔍 Run Validation Now'}
            </button>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '5px', textAlign: 'center' }}>
              {selectedCompany ? `For: ${selectedCompany}` : 'All Companies: Rays, L&T, S&W'}
            </p>
            
            {/* Auto Scheduler Control */}
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
              <p style={{ fontSize: '12px', color: '#555', marginBottom: '8px', textAlign: 'center' }}>
                🤖 Auto Scheduler (Every 10 min)
              </p>
              <button 
                onClick={handleToggleScheduler}
                disabled={schedulerLoading}
                style={{
                  backgroundColor: schedulerEnabled ? '#f39c12' : '#27ae60',
                  color: 'white',
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: schedulerLoading ? 'wait' : 'pointer',
                  width: '100%',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                {schedulerLoading ? '⏳ Processing...' : (schedulerEnabled ? '⏸️ Stop Scheduler' : '▶️ Start Scheduler')}
              </button>
              <p style={{ 
                fontSize: '10px', 
                color: schedulerEnabled ? '#27ae60' : '#e74c3c', 
                marginTop: '5px', 
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Status: {schedulerEnabled ? '🟢 Running' : '🔴 Stopped'}
              </p>
            </div>
          </div>
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
                  <pre>{msg.content}</pre>
                  {msg.hasExcel && msg.excelData && (
                    <button 
                      className="btn-download-excel"
                      onClick={() => downloadExcelFromBase64(msg.excelData, `Barcode_Status_${new Date().toISOString().slice(0,10)}.xlsx`)}
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
