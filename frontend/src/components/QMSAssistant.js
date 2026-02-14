import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/QMSAssistant.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// ═══════════════════════════════════════════════════════════════
// QMS AI Document Assistant — Advanced Document-Aware Chatbot
// Reads uploaded document content and answers questions from it
// ═══════════════════════════════════════════════════════════════

const QMSAssistant = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [indexStats, setIndexStats] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load index stats ────────────────────────────────
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

  // ── Greeting on first open ──────────────────────────
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadIndexStats();
      const greeting = {
        id: Date.now(),
        type: 'bot',
        text: '',
        richContent: {
          type: 'greeting',
          title: '🤖 QMS Document AI Assistant',
          subtitle: 'Main aapke uploaded documents ka content padh kar jawab deta hu. Koi bhi sawal poochiye — document ke andar kya likha hai, koi procedure, specification, ya data chahiye — sab bata dunga.',
        },
        time: new Date()
      };
      setMessages([greeting]);
    }
  // eslint-disable-next-line
  }, [isOpen]);

  // ── Auto-scroll ─────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSearching]);

  // ── Focus input ─────────────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // ── Extract all pending documents ───────────────────
  const handleExtractAll = async () => {
    setIsExtracting(true);
    const statusMsg = {
      id: Date.now(),
      type: 'bot',
      text: '🔄 Sab documents se text extract ho raha hai... Please wait...',
      time: new Date()
    };
    setMessages(prev => [...prev, statusMsg]);

    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/extract-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      const data = await res.json();
      
      const resultMsg = {
        id: Date.now() + 1,
        type: 'bot',
        text: '',
        richContent: {
          type: 'extraction-result',
          data: data.results || data
        },
        time: new Date()
      };
      // Replace the loading message with result
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== statusMsg.id);
        return [...filtered, resultMsg];
      });
      loadIndexStats();
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        type: 'bot',
        text: `❌ Extraction failed: ${err.message}`,
        time: new Date()
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== statusMsg.id);
        return [...filtered, errMsg];
      });
    }
    setIsExtracting(false);
  };

  // ── Send query to AI backend ────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSearching) return;

    const userMsg = { id: Date.now(), type: 'user', text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSearching(true);

    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      });

      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      const botMsg = {
        id: Date.now() + 1,
        type: 'bot',
        text: '',
        richContent: {
          type: 'search-result',
          query: text,
          answer: data.answer,
          sources: data.sources || [],
          confidence: data.confidence,
          totalDocs: data.total_docs,
          indexedDocs: data.indexed_docs,
          resultsCount: data.results_count,
          suggestions: data.suggestions || []
        },
        time: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        type: 'bot',
        text: `❌ Error: ${err.message}. Backend se connection check karein.`,
        time: new Date()
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setIsSearching(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Quick action click (query type) ─────────────────
  const handleQuickQuery = (query) => {
    setInput('');
    const userMsg = { id: Date.now(), type: 'user', text: query, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsSearching(true);

    fetch(`${API_BASE}/api/qms/assistant/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
      .then(res => res.json())
      .then(data => {
        const botMsg = {
          id: Date.now() + 1,
          type: 'bot',
          text: '',
          richContent: {
            type: 'search-result',
            query,
            answer: data.answer,
            sources: data.sources || [],
            confidence: data.confidence,
            totalDocs: data.total_docs,
            indexedDocs: data.indexed_docs,
            resultsCount: data.results_count,
            suggestions: data.suggestions || []
          },
          time: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
        setIsSearching(false);
      })
      .catch(err => {
        setMessages(prev => [...prev, {
          id: Date.now() + 1, type: 'bot',
          text: `❌ Error: ${err.message}`, time: new Date()
        }]);
        setIsSearching(false);
      });
  };

  // ── View document content ─────────────────────────
  const handleViewContent = async (docId, title) => {
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/qms/assistant/document-content/${docId}`);
      const data = await res.json();

      const msg = {
        id: Date.now(),
        type: 'bot',
        text: '',
        richContent: {
          type: 'document-content',
          title: data.title || title,
          docNumber: data.doc_number,
          content: data.content || 'No text extracted yet.',
          textLength: data.text_length
        },
        time: new Date()
      };
      setMessages(prev => [...prev, msg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(), type: 'bot',
        text: `❌ Content load failed: ${err.message}`, time: new Date()
      }]);
    }
    setIsSearching(false);
  };

  // ── Quick Actions ───────────────────────────────────
  const quickActions = [
    { label: '📊 Index Status', action: 'status' },
    { label: '🔄 Extract Docs', action: 'extract' },
    { label: '📋 Inspection', query: 'inspection criteria parameters' },
    { label: '🌡️ Temperature', query: 'temperature profile lamination' },
    { label: '📦 Packing', query: 'packing specification procedure' },
    { label: '🔬 Testing', query: 'flash test EL hi-pot parameters' },
    { label: '📏 Calibration', query: 'calibration schedule instrument' },
    { label: '⚠️ NCR/CAPA', query: 'non-conformance rejection procedure' },
  ];

  // ═══════════════════════════════════════════════════
  //  RICH CONTENT RENDERERS
  // ═══════════════════════════════════════════════════

  const renderRichContent = (content) => {
    if (!content) return null;
    switch (content.type) {
      case 'greeting': return renderGreeting(content);
      case 'search-result': return renderSearchResult(content);
      case 'extraction-result': return renderExtractionResult(content);
      case 'document-content': return renderDocumentContent(content);
      case 'index-status': return renderIndexStatus(content);
      default: return null;
    }
  };

  const renderGreeting = (content) => (
    <div className="qa-rich-greeting">
      <div className="qa-greeting-title">{content.title}</div>
      <div className="qa-greeting-text">{content.subtitle}</div>
      {indexStats && (
        <div className="qa-index-bar">
          <div className="qa-idx-stat">
            <span className="qa-idx-num">{indexStats.total_documents}</span>
            <span className="qa-idx-label">Documents</span>
          </div>
          <div className="qa-idx-divider" />
          <div className="qa-idx-stat">
            <span className="qa-idx-num">{indexStats.indexed}</span>
            <span className="qa-idx-label">Indexed</span>
          </div>
          <div className="qa-idx-divider" />
          <div className="qa-idx-stat">
            <span className="qa-idx-num">{indexStats.pending}</span>
            <span className="qa-idx-label">Pending</span>
          </div>
          <div className="qa-idx-divider" />
          <div className="qa-idx-stat">
            <span className="qa-idx-num">{formatSize(indexStats.total_text_size)}</span>
            <span className="qa-idx-label">Text Data</span>
          </div>
        </div>
      )}
      <div className="qa-greeting-hint">
        💡 Documents upload karne ke baad <strong>"🔄 Extract Docs"</strong> click karein taaki AI unka text padh sake.
      </div>
    </div>
  );

  const renderSearchResult = (content) => (
    <div className="qa-rich-search">
      {/* Confidence Badge */}
      <div className={`qa-confidence qa-conf-${content.confidence}`}>
        <span className="qa-conf-icon">
          {content.confidence === 'high' ? '✅' : content.confidence === 'medium' ? '🟡' : '🔴'}
        </span>
        <span className="qa-conf-text">
          {content.confidence === 'high' ? 'High Confidence' : content.confidence === 'medium' ? 'Medium Match' : 'Low Match'}
        </span>
        <span className="qa-conf-meta">
          {content.resultsCount} result{content.resultsCount !== 1 ? 's' : ''} • {content.indexedDocs}/{content.totalDocs} indexed
        </span>
      </div>

      {/* Answer */}
      <div className="qa-answer-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(content.answer) }} />

      {/* Source Documents */}
      {content.sources && content.sources.length > 0 && (
        <div className="qa-sources">
          <div className="qa-sources-title">📚 Source Documents:</div>
          {content.sources.map((src, i) => (
            <div key={i} className="qa-source-card" onClick={() => handleViewContent(src.id, src.title)}>
              <div className="qa-src-header">
                <span className="qa-src-icon">📄</span>
                <div className="qa-src-info">
                  <div className="qa-src-title">{src.title}</div>
                  <div className="qa-src-meta">
                    {src.doc_number} • {src.category}
                    {src.coverage > 0 && <span className="qa-src-match"> • {src.coverage}% match</span>}
                  </div>
                </div>
                <div className={`qa-src-score score-${content.confidence}`}>
                  {src.score?.toFixed(2)}
                </div>
              </div>
              {src.matched_terms && src.matched_terms.length > 0 && (
                <div className="qa-src-terms">
                  {src.matched_terms.slice(0, 8).map((t, j) => (
                    <span key={j} className="qa-term-tag">{t}</span>
                  ))}
                </div>
              )}
              <div className="qa-src-view">📖 Full document content dekhein →</div>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up Suggestions */}
      {content.suggestions && content.suggestions.length > 0 && (
        <div className="qa-suggestions">
          <span className="qa-sugg-label">🔍 Related:</span>
          <div className="qa-sugg-chips">
            {content.suggestions.map((s, i) => (
              <button key={i} className="qa-sugg-chip" onClick={() => handleQuickQuery(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderExtractionResult = (content) => {
    const d = content.data;
    return (
      <div className="qa-rich-extract">
        <div className="qa-extract-header">📥 Text Extraction Complete</div>
        <div className="qa-extract-stats">
          <div className="qa-ext-stat success">✅ {d.success || 0} Extracted</div>
          <div className="qa-ext-stat fail">❌ {d.failed || 0} Failed</div>
          <div className="qa-ext-stat skip">⏭️ {d.skipped || 0} Skipped</div>
        </div>
        {d.details && d.details.length > 0 && (
          <div className="qa-extract-details">
            {d.details.slice(0, 10).map((item, i) => (
              <div key={i} className={`qa-ext-item ${item.status}`}>
                <span className="qa-ext-status">
                  {item.status === 'success' ? '✅' : item.status === 'failed' ? '❌' : '⏭️'}
                </span>
                <span className="qa-ext-name">{item.title}</span>
                {item.text_length > 0 && <span className="qa-ext-size">{formatSize(item.text_length)}</span>}
                {item.reason && <span className="qa-ext-reason">{item.reason}</span>}
              </div>
            ))}
            {d.details.length > 10 && (
              <div className="qa-ext-more">...aur {d.details.length - 10} documents</div>
            )}
          </div>
        )}
        <div className="qa-extract-tip">Ab documents ke content ke baare mein sawal poochiye! 🎉</div>
      </div>
    );
  };

  const renderDocumentContent = (content) => (
    <div className="qa-rich-doccontent">
      <div className="qa-dc-header">
        <span className="qa-dc-icon">📄</span>
        <div>
          <div className="qa-dc-title">{content.title}</div>
          <div className="qa-dc-meta">{content.docNumber} • {formatSize(content.textLength)} extracted text</div>
        </div>
      </div>
      <div className="qa-dc-body">
        <pre className="qa-dc-text">
          {content.content?.substring(0, 4000) || 'No content available'}
          {content.content && content.content.length > 4000 && '\n\n... [truncated — poora document bahut bada hai]'}
        </pre>
      </div>
    </div>
  );

  const renderIndexStatus = (content) => (
    <div className="qa-rich-status">
      <div className="qa-status-title">📊 Document Index Status</div>
      <div className="qa-status-grid">
        <div className="qa-st-card"><span className="qa-st-num">{content.total}</span><span className="qa-st-label">Total</span></div>
        <div className="qa-st-card indexed"><span className="qa-st-num">{content.indexed}</span><span className="qa-st-label">Indexed</span></div>
        <div className="qa-st-card pending"><span className="qa-st-num">{content.pending}</span><span className="qa-st-label">Pending</span></div>
        <div className="qa-st-card"><span className="qa-st-num">{formatSize(content.textSize)}</span><span className="qa-st-label">Data</span></div>
      </div>
    </div>
  );

  // ── Utilities ─────────────────────────────────────
  const formatSize = (bytes) => {
    if (!bytes) return '0';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
      .replace(/• /g, '<span class="qa-bullet-dot">•</span> ');
  };

  // ── Handle quick action buttons ─────────────────
  const handleQuickClick = async (action) => {
    if (action.action === 'status') {
      const stats = await loadIndexStats();
      if (stats) {
        const msg = {
          id: Date.now(), type: 'bot', text: '',
          richContent: {
            type: 'index-status',
            total: stats.total_documents,
            indexed: stats.indexed,
            pending: stats.pending,
            textSize: stats.total_text_size
          },
          time: new Date()
        };
        setMessages(prev => [...prev, msg]);
      }
      return;
    }
    if (action.action === 'extract') {
      handleExtractAll();
      return;
    }
    if (action.query) {
      handleQuickQuery(action.query);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="qms-assistant-overlay">
      <div className="qms-assistant">
        {/* ── Header ──────────────────────────── */}
        <div className="qa-header">
          <div className="qa-header-left">
            <div className="qa-avatar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </div>
            <div>
              <h3>QMS Document AI</h3>
              <span className="qa-status">
                <span className="qa-dot" />
                {indexStats
                  ? `${indexStats.indexed} docs indexed • ${formatSize(indexStats.total_text_size)} searchable`
                  : 'Connecting...'}
              </span>
            </div>
          </div>
          <button className="qa-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* ── Quick Actions ───────────────────── */}
        <div className="qa-quick-actions">
          {quickActions.map((a, i) => (
            <button
              key={i}
              className={`qa-quick-btn ${a.action === 'extract' && isExtracting ? 'extracting' : ''}`}
              onClick={() => handleQuickClick(a)}
              disabled={a.action === 'extract' && isExtracting}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* ── Chat Area ───────────────────────── */}
        <div className="qa-chat">
          {messages.map(msg => (
            <div key={msg.id} className={`qa-msg ${msg.type}`}>
              {msg.type === 'bot' && (
                <div className="qa-msg-avatar">🤖</div>
              )}
              <div className="qa-msg-bubble">
                {msg.richContent
                  ? renderRichContent(msg.richContent)
                  : <div className="qa-msg-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }} />
                }
                <span className="qa-msg-time">
                  {msg.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {isSearching && (
            <div className="qa-msg bot">
              <div className="qa-msg-avatar">🤖</div>
              <div className="qa-msg-bubble qa-typing">
                <div className="qa-typing-text">Searching documents...</div>
                <div className="qa-typing-dots">
                  <span className="qa-typing-dot" />
                  <span className="qa-typing-dot" />
                  <span className="qa-typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* ── Input Area ──────────────────────── */}
        <div className="qa-input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Document ke baare mein kuch bhi poochiye..."
            rows="1"
          />
          <button className="qa-send" onClick={handleSend} disabled={!input.trim() || isSearching}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QMSAssistant;
