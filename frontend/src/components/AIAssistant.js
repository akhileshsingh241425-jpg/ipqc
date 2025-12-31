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
  const messagesEndRef = useRef(null);

  const getAPIBaseURL = () => window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

  useEffect(() => {
    checkApiConfig();
    loadFTRData();
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '👋 Namaste! Main aapka AI FTR Assistant hoon.\n\nMujhse pucho:\n• "KSPL ka status batao"\n• "Kitna production pending hai?"\n• "Total packed modules kitne hai?"\n• "Kis company ka sabse zyada FTR hai?"'
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
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.response
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

  const quickQuestions = [
    "Total FTR status batao",
    "Kitna production pending hai?",
    "Kis company ka data show karo",
    "Available serial numbers kitne hai?",
    "Packed vs Assigned comparison"
  ];

  // Excel download handler
  const handleExcelDownload = async (exportType, companyId = null, companyName = 'All') => {
    try {
      const API_BASE_URL = getAPIBaseURL();
      const response = await axios.post(`${API_BASE_URL}/api/ai/export/excel`, {
        type: exportType,
        company_id: companyId,
        company_name: companyName
      }, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportType}_${companyName}_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel download error:', error);
      alert('❌ Excel download failed: ' + (error.response?.data?.error || error.message));
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
          <div className="export-buttons">
            <button className="btn-export" onClick={() => handleExcelDownload('all')}>
              📊 Summary Report
            </button>
            <button className="btn-export" onClick={() => handleExcelDownload('packed', null, 'Rays Power')}>
              📦 Rays Packed
            </button>
            <button className="btn-export" onClick={() => handleExcelDownload('dispatched', null, 'Rays Power')}>
              🚚 Rays Dispatched
            </button>
            <button className="btn-export" onClick={() => handleExcelDownload('pending')}>
              ⏳ All Pending
            </button>
            <button className="btn-export" onClick={() => handleExcelDownload('rejected')}>
              ❌ All Rejected
            </button>
            <button className="btn-export" onClick={() => handleExcelDownload('binning')}>
              🏷️ Binning Data
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="ai-chat-area">
          {/* Quick Questions */}
          <div className="quick-questions">
            {quickQuestions.map((q, idx) => (
              <button 
                key={idx} 
                className="quick-q-btn"
                onClick={() => setInput(q)}
              >
                {q}
              </button>
            ))}
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
