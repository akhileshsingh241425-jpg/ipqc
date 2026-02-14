import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/QMSAssistant.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// ═══════════════════════════════════════════════════════════════
// QMS AI Document Assistant — RAG-Powered ChatGPT-Style Interface
// Groq LLM + TF-IDF Document Search = Intelligent QMS Expert
// ═══════════════════════════════════════════════════════════════

const QMSAssistant = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [indexStats, setIndexStats] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [typingText, setTypingText] = useState('');
  const [isTypingAnim, setIsTypingAnim] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingRef = useRef(null);

  // ── Load stats & AI status ──────────────────────
  const loadIndexStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/index-stats`);
      if (res.ok) {
        const data = await res.json();
        setIndexStats(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to load index stats:', err);
    }
    return null;
  }, []);

  const loadAiStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/ai-status`);
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch (err) {
      console.error('AI status check failed:', err);
    }
  }, []);

  // ── Greeting on first open ──────────────────────
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadIndexStats();
      loadAiStatus();
      const greeting = {
        id: Date.now(),
        type: 'bot',
        isGreeting: true,
        time: new Date()
      };
      setMessages([greeting]);
    }
  // eslint-disable-next-line
  }, [isOpen]);

  // ── Auto-scroll ─────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, typingText]);

  // ── Focus input ─────────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // ── Typing animation ───────────────────────────
  const typeMessage = useCallback((fullText, msgId) => {
    setIsTypingAnim(true);
    setTypingText('');
    let i = 0;
    const speed = 6;
    
    if (typingRef.current) clearInterval(typingRef.current);
    
    typingRef.current = setInterval(() => {
      if (i < fullText.length) {
        const chunk = fullText.substring(0, i + 4);
        setTypingText(chunk);
        i += 4;
      } else {
        clearInterval(typingRef.current);
        setTypingText('');
        setIsTypingAnim(false);
        setMessages(prev => prev.map(m => 
          m.id === msgId ? { ...m, isTyping: false, text: fullText } : m
        ));
      }
    }, speed);
  }, []);

  useEffect(() => {
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
  }, []);

  // ── Extract all documents ───────────────────────
  const handleExtractAll = async () => {
    setIsExtracting(true);
    addBotMessage('🔄 Extracting text from all documents... AI index updating...', 'system');
    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/extract-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      const data = await res.json();
      const r = data.results || data;
      addBotMessage(`✅ **Extraction Complete!**\n\n- ✅ **${r.success || 0}** documents extracted\n- ❌ **${r.failed || 0}** failed\n- ⏭️ **${r.skipped || 0}** skipped\n\nAb aap kuch bhi pooch sakte hain! 🎉`, 'system');
      loadIndexStats();
    } catch (err) {
      addBotMessage(`❌ Extraction failed: ${err.message}`, 'error');
    }
    setIsExtracting(false);
  };

  const addBotMessage = (text, subtype = 'normal') => {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: 'bot', text, subtype,
      time: new Date()
    }]);
  };

  // ── Send query ──────────────────────────────────
  const handleSend = async (customQuery) => {
    const text = (customQuery || input).trim();
    if (!text || isThinking) return;

    setMessages(prev => [...prev, { id: Date.now(), type: 'user', text, time: new Date() }]);
    setInput('');
    setIsThinking(true);
    setShowSuggestions(false);

    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      });

      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();

      const botMsgId = Date.now() + 1;
      setMessages(prev => [...prev, {
        id: botMsgId,
        type: 'bot',
        text: '',
        isTyping: true,
        data: {
          answer: data.answer,
          sources: data.sources || [],
          confidence: data.confidence,
          aiPowered: data.ai_powered,
          totalDocs: data.total_docs,
          indexedDocs: data.indexed_docs,
          resultsCount: data.results_count,
          suggestions: data.suggestions || []
        },
        time: new Date()
      }]);
      setIsThinking(false);
      typeMessage(data.answer || 'No answer available', botMsgId);

    } catch (err) {
      setIsThinking(false);
      addBotMessage(`❌ Error: ${err.message}`, 'error');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    try { await fetch(`${API_BASE}/api/qms/assistant/chat-history`, { method: 'DELETE' }); } catch (e) {}
    if (typingRef.current) clearInterval(typingRef.current);
    setTypingText('');
    setIsTypingAnim(false);
    setShowSuggestions(true);
    setMessages([{ id: Date.now(), type: 'bot', isGreeting: true, time: new Date() }]);
  };

  const handleViewContent = async (docId, title) => {
    setIsThinking(true);
    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/document-content/${docId}`);
      const data = await res.json();
      addBotMessage(`📄 **${data.title || title}** (${data.doc_number || ''})\n\n📏 Size: ${formatSize(data.text_length)}\n\n---\n\n${(data.content || 'No text extracted.').substring(0, 3000)}${data.content?.length > 3000 ? '\n\n... [truncated]' : ''}`);
    } catch (err) {
      addBotMessage(`❌ Failed: ${err.message}`, 'error');
    }
    setIsThinking(false);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="qa2-code"><code>$2</code></pre>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gm, '<h4 class="qa2-h4">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 class="qa2-h3">$1</h3>')
      .replace(/^[•\-] (.*$)/gm, '<div class="qa2-bullet"><span class="qa2-bdot">•</span><span>$1</span></div>')
      .replace(/^(\d+)\. (.*$)/gm, '<div class="qa2-numlist"><span class="qa2-nnum">$1.</span><span>$2</span></div>')
      .replace(/^---$/gm, '<hr class="qa2-hr"/>')
      .replace(/\n/g, '<br/>');
  };

  // ═══════════════════════════════════════════
  //  SMART SUGGESTIONS
  // ═══════════════════════════════════════════
  const smartSuggestions = [
    { icon: '📋', text: 'Quality Manual ka scope kya hai?', cat: 'Documents' },
    { icon: '🔬', text: 'Flash test parameters for 540W module', cat: 'Testing' },
    { icon: '🌡️', text: 'Lamination temperature profile', cat: 'Process' },
    { icon: '📦', text: 'Packing SOP aur checklist', cat: 'Packing' },
    { icon: '⚠️', text: 'NCR categorization aur CAPA process', cat: 'Quality' },
    { icon: '📏', text: 'Calibration schedule requirements', cat: 'Calibration' },
    { icon: '🔍', text: 'Incoming inspection criteria', cat: 'Inspection' },
    { icon: '📊', text: 'ISO 9001 compliance status', cat: 'Compliance' },
  ];

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════

  const renderGreeting = () => (
    <div className="qa2-greeting">
      <div className="qa2-greeting-glow" />
      <div className="qa2-greeting-icon">
        <div className="qa2-brain-pulse">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="url(#qg1)" strokeWidth="1.5" fill="url(#qg1)" fillOpacity="0.08"/>
            <path d="M9 8.5c0-1.38 1.12-2.5 2.5-2.5S14 7.12 14 8.5c0 1.38-1.12 2.5-2.5 2.5H11" stroke="url(#qg1)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10.5 15.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S14.38 13 13 13h-.5" stroke="url(#qg1)" strokeWidth="1.5" strokeLinecap="round"/>
            <defs><linearGradient id="qg1" x1="2" y1="2" x2="22" y2="22"><stop stopColor="#667eea"/><stop offset="1" stopColor="#764ba2"/></linearGradient></defs>
          </svg>
        </div>
      </div>
      <h2 className="qa2-greeting-title">QMS AI Assistant</h2>
      <p className="qa2-greeting-sub">
        {aiStatus?.ai_available 
          ? '🧠 Powered by Groq AI + Document RAG Engine — LLaMA 3.1'
          : '🔍 Document Search Engine Active'}
      </p>
      
      <div className="qa2-stats-row">
        <div className="qa2-stat-card">
          <span className="qa2-stat-num">{indexStats?.total_documents || 0}</span>
          <span className="qa2-stat-lbl">Documents</span>
        </div>
        <div className="qa2-stat-card">
          <span className="qa2-stat-num">{indexStats?.indexed || 0}</span>
          <span className="qa2-stat-lbl">Indexed</span>
        </div>
        <div className="qa2-stat-card">
          <span className="qa2-stat-num">{formatSize(indexStats?.total_text_size)}</span>
          <span className="qa2-stat-lbl">Knowledge</span>
        </div>
        <div className="qa2-stat-card">
          <span className="qa2-stat-num" style={{color: aiStatus?.ai_available ? '#22c55e' : '#f59e0b'}}>
            {aiStatus?.ai_available ? '● ON' : '○ OFF'}
          </span>
          <span className="qa2-stat-lbl">AI Engine</span>
        </div>
      </div>

      {indexStats?.pending > 0 && (
        <button className="qa2-extract-cta" onClick={handleExtractAll} disabled={isExtracting}>
          {isExtracting ? <><span className="qa2-spin" /> Extracting...</> : <>🔄 Extract {indexStats.pending} Pending Documents</>}
        </button>
      )}
    </div>
  );

  const renderBotMsg = (msg) => {
    const displayText = msg.isTyping ? typingText : msg.text;
    const data = msg.data;

    return (
      <div className="qa2-msg qa2-msg-bot">
        <div className="qa2-bot-ava">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
            <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <div className="qa2-bot-body">
          {data?.aiPowered && (
            <div className="qa2-ai-tag">
              <span className="qa2-ai-pulse" /> AI Powered
              {data.resultsCount > 0 && <span> • {data.resultsCount} docs referenced</span>}
            </div>
          )}

          {data?.confidence && data.confidence !== 'ai' && (
            <div className={`qa2-conf qa2-conf-${data.confidence}`}>
              {data.confidence === 'high' ? '✅ High Confidence' : data.confidence === 'medium' ? '🟡 Medium' : '🔴 Low Match'}
            </div>
          )}

          {displayText && (
            <div className="qa2-bot-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }} />
          )}
          {msg.isTyping && <span className="qa2-blink-cursor">|</span>}

          {!msg.isTyping && data?.sources?.length > 0 && (
            <div className="qa2-src-section">
              <div className="qa2-src-head">📚 Sources</div>
              <div className="qa2-src-list">
                {data.sources.map((src, i) => (
                  <button key={i} className="qa2-src-chip" onClick={() => handleViewContent(src.id, src.title)}>
                    <span className="qa2-src-idx">{i + 1}</span>
                    <div className="qa2-src-info">
                      <span className="qa2-src-title">{src.title}</span>
                      <span className="qa2-src-meta">{src.doc_number} • {src.category}</span>
                    </div>
                    {src.coverage > 0 && <span className="qa2-src-pct">{src.coverage}%</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!msg.isTyping && data?.suggestions?.length > 0 && (
            <div className="qa2-followups">
              {data.suggestions.map((s, i) => (
                <button key={i} className="qa2-follow-chip" onClick={() => handleSend(s)}>→ {s}</button>
              ))}
            </div>
          )}

          <span className="qa2-time">{msg.time?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="qa2-overlay">
      <div className="qa2-panel">
        {/* Header */}
        <div className="qa2-head">
          <div className="qa2-head-left">
            <div className="qa2-head-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
                <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div>
              <h3 className="qa2-head-title">QMS AI Assistant</h3>
              <span className="qa2-head-sub">
                {aiStatus?.ai_available 
                  ? <><span className="qa2-dot-on" /> LLaMA 3.1 + RAG</>
                  : <><span className="qa2-dot-off" /> Search Mode</>}
              </span>
            </div>
          </div>
          <div className="qa2-head-btns">
            <button className="qa2-hbtn" onClick={handleExtractAll} disabled={isExtracting} title="Index documents">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button className="qa2-hbtn" onClick={handleClearChat} title="New chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            <button className="qa2-hbtn qa2-hbtn-close" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="qa2-chat">
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.isGreeting ? renderGreeting() :
               msg.type === 'user' ? (
                <div className="qa2-msg qa2-msg-user">
                  <div className="qa2-user-bubble">
                    <div className="qa2-user-text">{msg.text}</div>
                    <span className="qa2-time">{msg.time?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ) : renderBotMsg(msg)}
            </div>
          ))}
          
          {isThinking && (
            <div className="qa2-msg qa2-msg-bot">
              <div className="qa2-bot-ava qa2-ava-think">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
                  <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/>
                  <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/>
                </svg>
              </div>
              <div className="qa2-bot-body qa2-thinking">
                <div className="qa2-think-row">
                  <span className="qa2-think-brain">🧠</span>
                  <span className="qa2-think-label">Thinking<span className="qa2-dots"><span>.</span><span>.</span><span>.</span></span></span>
                </div>
                <div className="qa2-think-steps">
                  <span className="qa2-step s1">🔍 Searching docs</span>
                  <span className="qa2-step s2">🧠 AI analyzing</span>
                  <span className="qa2-step s3">✍️ Composing</span>
                </div>
              </div>
            </div>
          )}

          {showSuggestions && messages.length <= 1 && (
            <div className="qa2-sug-grid">
              {smartSuggestions.map((s, i) => (
                <button key={i} className="qa2-sug-card" onClick={() => handleSend(s.text)}>
                  <span className="qa2-sug-icon">{s.icon}</span>
                  <span className="qa2-sug-text">{s.text}</span>
                  <span className="qa2-sug-cat">{s.cat}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="qa2-footer">
          <div className="qa2-input-box">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about QMS documents..."
              rows="1"
            />
            <button className={`qa2-send ${input.trim() ? 'active' : ''}`} onClick={() => handleSend()} disabled={!input.trim() || isThinking}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div className="qa2-foot-info">
            <span>{aiStatus?.ai_available ? '🧠 AI Mode' : '🔍 Search'} • {indexStats?.indexed || 0}/{indexStats?.total_documents || 0} indexed</span>
            <span className="qa2-foot-brand">Groq + LLaMA 3.1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QMSAssistant;
