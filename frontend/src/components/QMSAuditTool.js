import React, { useState, useEffect, useCallback } from 'react';
import AUDIT_CHECKSHEET from '../constants/auditChecksheet';
import '../styles/QMSAuditTool.css';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5003' : '';

// ═══════════════════════════════════════════════
// QMS Audit Tool - Complete Self-Assessment & Gap Analysis
// ═══════════════════════════════════════════════

const QMSAuditTool = () => {
  // State
  const [audits, setAudits] = useState([]);
  const [currentAudit, setCurrentAudit] = useState(null);
  const [scores, setScores] = useState({});
  const [actionPlans, setActionPlans] = useState([]);
  const [activeView, setActiveView] = useState('list'); // list, scoring, gap-analysis, action-plans, history
  const [activeSection, setActiveSection] = useState('1');
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);
  const [showNewAuditForm, setShowNewAuditForm] = useState(false);
  const [newAuditData, setNewAuditData] = useState({
    audit_name: '', audit_type: 'Initial Assessment', partner_name: '',
    partner_location: '', auditor_name: '', auditor_designation: '', audit_date: ''
  });
  const [editingAction, setEditingAction] = useState(null);
  const [skippedSections, setSkippedSections] = useState({});

  // Fetch
  const fetchAudits = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/audits`);
      const data = await res.json();
      setAudits(data.audits || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  // ─── Create Audit ──────────────────────────
  const createAudit = async () => {
    if (!newAuditData.audit_name || !newAuditData.partner_name) {
      showMsg('Please fill audit name and partner name', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/qms/audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAuditData)
      });
      const data = await res.json();
      if (res.ok) {
        showMsg('Audit created successfully');
        setShowNewAuditForm(false);
        setNewAuditData({ audit_name: '', audit_type: 'Initial Assessment', partner_name: '', partner_location: '', auditor_name: '', auditor_designation: '', audit_date: '' });
        fetchAudits();
        openAudit(data.audit);
      }
    } catch (err) { showMsg('Error creating audit', 'error'); }
  };

  // ─── Open Audit ────────────────────────────
  const openAudit = async (audit) => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/audits/${audit.id}`);
      const data = await res.json();
      setCurrentAudit(data.audit);
      setActionPlans(data.action_plans || []);
      
      // Parse scores
      let sc = {};
      try { sc = JSON.parse(data.audit.scores_json || '{}'); } catch { sc = {}; }
      setScores(sc);
      
      setActiveView('scoring');
      setActiveSection('1');
    } catch (err) { showMsg('Error loading audit', 'error'); }
  };

  // ─── Save Scores ──────────────────────────
  const saveScores = async () => {
    if (!currentAudit) return;
    setSaving(true);
    try {
      // Calculate totals
      let totalScore = 0, maxScore = 0;
      AUDIT_CHECKSHEET.forEach(section => {
        if (skippedSections[section.id]) return;
        section.questions.forEach(q => {
          const sc = scores[section.id]?.[q.id];
          if (sc && sc.score >= 0) {
            totalScore += sc.score;
            maxScore += 4;
          }
        });
      });
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      let overall_rating = 'Critical';
      if (percentage >= 90) overall_rating = 'Excellent';
      else if (percentage >= 75) overall_rating = 'Good';
      else if (percentage >= 60) overall_rating = 'Acceptable';
      else if (percentage >= 40) overall_rating = 'Needs Improvement';

      const res = await fetch(`${API_BASE}/api/qms/audits/${currentAudit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores_json: JSON.stringify(scores),
          total_score: totalScore,
          max_score: maxScore,
          percentage,
          overall_rating
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentAudit(data.audit);
        showMsg('Scores saved successfully');
      }
    } catch (err) { showMsg('Error saving scores', 'error'); }
    setSaving(false);
  };

  // ─── Score Update Handler ─────────────────
  const updateScore = (sectionId, questionId, field, value) => {
    setScores(prev => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || {}),
        [questionId]: {
          ...(prev[sectionId]?.[questionId] || {}),
          [field]: value
        }
      }
    }));
  };

  // ─── Generate Action Plans ────────────────
  const generateActionPlans = async () => {
    if (!currentAudit) return;
    try {
      // Save scores first
      await saveScores();
      
      const res = await fetch(`${API_BASE}/api/qms/audits/${currentAudit.id}/generate-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 3 })
      });
      const data = await res.json();
      if (res.ok) {
        setActionPlans(data.action_plans || []);
        showMsg(data.message);
        setActiveView('action-plans');
      }
    } catch (err) { showMsg('Error generating action plans', 'error'); }
  };

  // ─── Update Action Plan ───────────────────
  const updateActionPlan = async (actionId, updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/qms/action-plans/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        showMsg('Action plan updated');
        setEditingAction(null);
        // Refresh
        const res2 = await fetch(`${API_BASE}/api/qms/audits/${currentAudit.id}/action-plans`);
        const data2 = await res2.json();
        setActionPlans(data2.action_plans || []);
      }
    } catch (err) { showMsg('Error updating action plan', 'error'); }
  };

  // ─── Delete Audit ─────────────────────────
  const deleteAudit = async (auditId) => {
    if (!window.confirm('Delete this audit? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/qms/audits/${auditId}`, { method: 'DELETE' });
      if (res.ok) {
        showMsg('Audit deleted');
        fetchAudits();
        if (currentAudit?.id === auditId) {
          setCurrentAudit(null);
          setActiveView('list');
        }
      }
    } catch (err) { showMsg('Error deleting', 'error'); }
  };

  // ─── Complete Audit ───────────────────────
  const completeAudit = async () => {
    if (!currentAudit) return;
    await saveScores();
    try {
      await fetch(`${API_BASE}/api/qms/audits/${currentAudit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      });
      showMsg('Audit marked as Completed');
      const res = await fetch(`${API_BASE}/api/qms/audits/${currentAudit.id}`);
      const data = await res.json();
      setCurrentAudit(data.audit);
      fetchAudits();
    } catch (err) { showMsg('Error', 'error'); }
  };

  // ─── Calculations ─────────────────────────
  const getSectionScore = (sectionId) => {
    const section = AUDIT_CHECKSHEET.find(s => s.id === sectionId);
    if (!section || skippedSections[sectionId]) return { total: 0, max: 0, pct: 0, answered: 0 };
    let total = 0, max = 0, answered = 0;
    section.questions.forEach(q => {
      const sc = scores[sectionId]?.[q.id];
      if (sc && sc.score >= 0) {
        total += sc.score;
        max += 4;
        answered++;
      }
    });
    return { total, max, pct: max > 0 ? Math.round((total / max) * 100) : 0, answered, totalQ: section.questions.length };
  };

  const getOverallScore = () => {
    let total = 0, max = 0;
    AUDIT_CHECKSHEET.forEach(s => {
      if (skippedSections[s.id]) return;
      const sc = getSectionScore(s.id);
      total += sc.total;
      max += sc.max;
    });
    const pct = max > 0 ? Math.round((total / max) * 100) : 0;
    let rating = 'Critical';
    if (pct >= 90) rating = 'Excellent';
    else if (pct >= 75) rating = 'Good';
    else if (pct >= 60) rating = 'Acceptable';
    else if (pct >= 40) rating = 'Needs Improvement';
    return { total, max, pct, rating };
  };

  const getScoreColor = (pct) => {
    if (pct >= 75) return '#059669';
    if (pct >= 50) return '#d97706';
    return '#dc2626';
  };

  const getRatingClass = (rating) => {
    const map = { 'Excellent': 'excellent', 'Good': 'good', 'Acceptable': 'acceptable', 'Needs Improvement': 'needs-improvement', 'Critical': 'critical' };
    return map[rating] || 'critical';
  };

  // ═══════════════════════════════════════════════
  // RENDER: Audit List
  // ═══════════════════════════════════════════════
  const renderAuditList = () => (
    <div className="audit-list-view">
      <div className="audit-list-header">
        <div>
          <h2>Partner Audit Assessments</h2>
          <p className="audit-list-subtitle">Create and manage quality audits for supplier and partner evaluation</p>
        </div>
        <button className="aq-btn-primary" onClick={() => setShowNewAuditForm(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Audit
        </button>
      </div>

      {showNewAuditForm && (
        <div className="new-audit-form">
          <h3>Create New Audit Assessment</h3>
          <div className="naf-grid">
            <div className="naf-group">
              <label>Audit Name *</label>
              <input type="text" value={newAuditData.audit_name} onChange={e => setNewAuditData({...newAuditData, audit_name: e.target.value})} placeholder="e.g., Q1 2026 Partner Assessment" />
            </div>
            <div className="naf-group">
              <label>Audit Type</label>
              <select value={newAuditData.audit_type} onChange={e => setNewAuditData({...newAuditData, audit_type: e.target.value})}>
                <option>Initial Assessment</option>
                <option>Surveillance Audit</option>
                <option>Re-Audit</option>
                <option>Customer Audit</option>
              </select>
            </div>
            <div className="naf-group">
              <label>Partner / Supplier Name *</label>
              <input type="text" value={newAuditData.partner_name} onChange={e => setNewAuditData({...newAuditData, partner_name: e.target.value})} placeholder="e.g., Gautam Solar" />
            </div>
            <div className="naf-group">
              <label>Location</label>
              <input type="text" value={newAuditData.partner_location} onChange={e => setNewAuditData({...newAuditData, partner_location: e.target.value})} placeholder="e.g., Bhiwani, Haryana" />
            </div>
            <div className="naf-group">
              <label>Auditor Name</label>
              <input type="text" value={newAuditData.auditor_name} onChange={e => setNewAuditData({...newAuditData, auditor_name: e.target.value})} placeholder="Auditor name" />
            </div>
            <div className="naf-group">
              <label>Auditor Designation</label>
              <input type="text" value={newAuditData.auditor_designation} onChange={e => setNewAuditData({...newAuditData, auditor_designation: e.target.value})} placeholder="e.g., QA Manager" />
            </div>
            <div className="naf-group">
              <label>Audit Date</label>
              <input type="date" value={newAuditData.audit_date} onChange={e => setNewAuditData({...newAuditData, audit_date: e.target.value})} />
            </div>
          </div>
          <div className="naf-actions">
            <button className="aq-btn-ghost" onClick={() => setShowNewAuditForm(false)}>Cancel</button>
            <button className="aq-btn-primary" onClick={createAudit}>Create Audit</button>
          </div>
        </div>
      )}

      {audits.length === 0 ? (
        <div className="audit-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          <h3>No Audits Yet</h3>
          <p>Start your first partner audit assessment to evaluate quality systems.</p>
          <button className="aq-btn-primary" onClick={() => setShowNewAuditForm(true)}>Create First Audit</button>
        </div>
      ) : (
        <div className="audit-cards-grid">
          {audits.map(audit => {
            const pct = audit.percentage || 0;
            return (
              <div key={audit.id} className="audit-card" onClick={() => openAudit(audit)}>
                <div className="ac-top">
                  <span className={`ac-type ${audit.audit_type?.replace(/\s/g, '-').toLowerCase()}`}>{audit.audit_type}</span>
                  <span className={`ac-status ${audit.status?.replace(/\s/g, '-').toLowerCase()}`}>{audit.status}</span>
                </div>
                <h3 className="ac-name">{audit.audit_name}</h3>
                <p className="ac-partner">{audit.partner_name}{audit.partner_location ? ` — ${audit.partner_location}` : ''}</p>
                
                <div className="ac-score-bar">
                  <div className="ac-bar-track">
                    <div className="ac-bar-fill" style={{ width: `${pct}%`, background: getScoreColor(pct) }} />
                  </div>
                  <div className="ac-score-info">
                    <span className="ac-pct" style={{ color: getScoreColor(pct) }}>{pct}%</span>
                    <span className="ac-score-detail">{audit.total_score || 0}/{audit.max_score || 0}</span>
                  </div>
                </div>

                <div className="ac-meta">
                  <span>{audit.auditor_name || '—'}</span>
                  <span>{audit.audit_date || '—'}</span>
                </div>
                <div className="ac-actions-row">
                  <button className="ac-action" onClick={e => { e.stopPropagation(); openAudit(audit); }}>Open</button>
                  <button className="ac-action ac-del" onClick={e => { e.stopPropagation(); deleteAudit(audit.id); }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════
  // RENDER: Scoring Interface
  // ═══════════════════════════════════════════════
  const renderScoring = () => {
    const section = AUDIT_CHECKSHEET.find(s => s.id === activeSection);
    const sectionScore = getSectionScore(activeSection);
    const overall = getOverallScore();

    return (
      <div className="audit-scoring-view">
        {/* Top Bar */}
        <div className="scoring-topbar">
          <button className="aq-btn-ghost" onClick={() => { setActiveView('list'); setCurrentAudit(null); }}>← Back to Audits</button>
          <div className="scoring-topbar-info">
            <h2>{currentAudit?.audit_name}</h2>
            <span className="stb-partner">{currentAudit?.partner_name}</span>
          </div>
          <div className="scoring-topbar-actions">
            <button className="aq-btn-secondary" onClick={() => setActiveView('gap-analysis')}>📊 Gap Analysis</button>
            <button className="aq-btn-secondary" onClick={generateActionPlans}>📋 Generate Actions</button>
            <button className="aq-btn-primary" onClick={saveScores} disabled={saving}>{saving ? 'Saving...' : '💾 Save'}</button>
          </div>
        </div>

        {/* Overall Score Strip */}
        <div className="overall-score-strip">
          <div className="oss-item">
            <span className="oss-label">Overall Score</span>
            <span className="oss-value" style={{ color: getScoreColor(overall.pct) }}>{overall.pct}%</span>
          </div>
          <div className="oss-item">
            <span className="oss-label">Points</span>
            <span className="oss-value">{overall.total}/{overall.max}</span>
          </div>
          <div className="oss-item">
            <span className="oss-label">Rating</span>
            <span className={`oss-rating ${getRatingClass(overall.rating)}`}>{overall.rating}</span>
          </div>
          <div className="oss-bar-wrap">
            <div className="oss-bar-track"><div className="oss-bar-fill" style={{ width: `${overall.pct}%`, background: getScoreColor(overall.pct) }} /></div>
          </div>
        </div>

        <div className="scoring-layout">
          {/* Section Sidebar */}
          <div className="scoring-sidebar">
            <h4>Assessment Sections</h4>
            {AUDIT_CHECKSHEET.map(s => {
              const sc = getSectionScore(s.id);
              const isSkipped = skippedSections[s.id];
              return (
                <div key={s.id} className={`ss-item ${activeSection === s.id ? 'active' : ''} ${isSkipped ? 'skipped' : ''}`}>
                  <div className="ss-item-main" onClick={() => setActiveSection(s.id)}>
                    <span className="ss-num">{s.id}</span>
                    <div className="ss-info">
                      <span className="ss-title">{s.title}</span>
                      <span className="ss-progress">{isSkipped ? 'Skipped' : `${sc.answered}/${sc.totalQ} • ${sc.pct}%`}</span>
                    </div>
                    {!isSkipped && sc.answered > 0 && (
                      <div className="ss-mini-bar">
                        <div className="ss-mini-fill" style={{ width: `${sc.pct}%`, background: getScoreColor(sc.pct) }} />
                      </div>
                    )}
                  </div>
                  {s.optional && (
                    <label className="ss-skip">
                      <input type="checkbox" checked={!!isSkipped} onChange={e => setSkippedSections({...skippedSections, [s.id]: e.target.checked})} />
                      <span>Skip</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {/* Questions */}
          <div className="scoring-main">
            {section && !skippedSections[section.id] ? (
              <>
                <div className="sm-header">
                  <h3>Section {section.id}: {section.title}</h3>
                  <div className="sm-header-score">
                    <span className="sm-score-pct" style={{ color: getScoreColor(sectionScore.pct) }}>{sectionScore.pct}%</span>
                    <span className="sm-score-pts">{sectionScore.total}/{sectionScore.max}</span>
                  </div>
                </div>

                {section.questions.map(q => {
                  const qScore = scores[section.id]?.[q.id] || {};
                  const isExpanded = expandedQuestion === q.id;
                  
                  return (
                    <div key={q.id} className={`question-card ${qScore.score >= 0 ? 'scored' : ''}`}>
                      <div className="qc-header" onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}>
                        <span className="qc-num">{q.id}</span>
                        <div className="qc-text">{q.text}</div>
                        {qScore.score >= 0 && (
                          <span className="qc-score-badge" style={{ background: getScoreColor(qScore.score * 25) }}>{qScore.score}/4</span>
                        )}
                        <span className={`qc-chevron ${isExpanded ? 'open' : ''}`}>▼</span>
                      </div>

                      {isExpanded && (
                        <div className="qc-body">
                          {/* Scoring Buttons */}
                          <div className="score-buttons">
                            <span className="sb-label">Score:</span>
                            {[0, 1, 2, 3, 4].map(val => (
                              <button 
                                key={val}
                                className={`score-btn ${qScore.score === val ? 'selected' : ''} score-${val}`}
                                onClick={() => updateScore(section.id, q.id, 'score', val)}
                              >
                                {val}
                              </button>
                            ))}
                          </div>

                          {/* Criteria Reference */}
                          <div className="criteria-table">
                            <div className="ct-title">Scoring Criteria Guide</div>
                            <div className="ct-grid">
                              {q.criteria.map((c, i) => (
                                <div key={i} className={`ct-cell ${qScore.score === i ? 'highlighted' : ''}`} onClick={() => updateScore(section.id, q.id, 'score', i)}>
                                  <span className="ct-score">{i}</span>
                                  <span className="ct-text">{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* What to Look For */}
                          {q.whatToLook && (
                            <div className="what-to-look">
                              <div className="wtl-title">🔍 What to Look For</div>
                              <p>{q.whatToLook}</p>
                            </div>
                          )}

                          {/* Observation & Action */}
                          <div className="qc-inputs">
                            <div className="qc-input-group">
                              <label>Observation / Findings</label>
                              <textarea rows="2" value={qScore.observation || ''} onChange={e => updateScore(section.id, q.id, 'observation', e.target.value)} placeholder="Document your findings here..." />
                            </div>
                            <div className="qc-input-group">
                              <label>Corrective Action Required</label>
                              <textarea rows="2" value={qScore.action || ''} onChange={e => updateScore(section.id, q.id, 'action', e.target.value)} placeholder="Action plan if score < 3..." />
                            </div>
                            <div className="qc-input-row">
                              <div className="qc-input-group">
                                <label>Responsible Person</label>
                                <input type="text" value={qScore.responsible || ''} onChange={e => updateScore(section.id, q.id, 'responsible', e.target.value)} placeholder="Name" />
                              </div>
                              <div className="qc-input-group">
                                <label>Target Date</label>
                                <input type="date" value={qScore.target_date || ''} onChange={e => updateScore(section.id, q.id, 'target_date', e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Section Navigation */}
                <div className="section-nav">
                  {parseInt(activeSection) > 1 && (
                    <button className="aq-btn-secondary" onClick={() => setActiveSection(String(parseInt(activeSection) - 1))}>← Previous Section</button>
                  )}
                  <div style={{ flex: 1 }} />
                  {parseInt(activeSection) < 10 && (
                    <button className="aq-btn-primary" onClick={() => { saveScores(); setActiveSection(String(parseInt(activeSection) + 1)); }}>Next Section →</button>
                  )}
                  {activeSection === '10' && (
                    <button className="aq-btn-primary" onClick={() => { saveScores(); setActiveView('gap-analysis'); }}>View Gap Analysis →</button>
                  )}
                </div>
              </>
            ) : (
              <div className="section-skipped">
                <p>This section has been marked as skipped (not applicable).</p>
                <button className="aq-btn-secondary" onClick={() => setSkippedSections({...skippedSections, [activeSection]: false})}>Enable This Section</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  // RENDER: Gap Analysis
  // ═══════════════════════════════════════════════
  const renderGapAnalysis = () => {
    const overall = getOverallScore();
    
    // Collect all gaps
    const gaps = [];
    AUDIT_CHECKSHEET.forEach(section => {
      if (skippedSections[section.id]) return;
      section.questions.forEach(q => {
        const sc = scores[section.id]?.[q.id];
        if (sc && sc.score >= 0 && sc.score < 3) {
          gaps.push({
            section: section.title,
            sectionId: section.id,
            questionId: q.id,
            question: q.text,
            score: sc.score,
            observation: sc.observation || '',
            action: sc.action || '',
            responsible: sc.responsible || '',
            target_date: sc.target_date || '',
            priority: sc.score <= 1 ? 'Critical' : 'High'
          });
        }
      });
    });
    gaps.sort((a, b) => a.score - b.score);

    return (
      <div className="gap-analysis-view">
        <div className="gap-topbar">
          <button className="aq-btn-ghost" onClick={() => setActiveView('scoring')}>← Back to Scoring</button>
          <h2>Gap Analysis Report</h2>
          <div className="gap-topbar-actions">
            <button className="aq-btn-secondary" onClick={generateActionPlans}>📋 Generate Action Plans</button>
            <button className="aq-btn-secondary" onClick={completeAudit}>✅ Complete Audit</button>
          </div>
        </div>

        {/* Overall Summary */}
        <div className="gap-summary">
          <div className="gs-card gs-overall">
            <div className="gs-circle" style={{ borderColor: getScoreColor(overall.pct) }}>
              <span className="gs-circle-pct">{overall.pct}%</span>
            </div>
            <div className="gs-info">
              <h3>Overall Score</h3>
              <span className={`gs-rating ${getRatingClass(overall.rating)}`}>{overall.rating}</span>
              <span className="gs-pts">{overall.total} / {overall.max} points</span>
            </div>
          </div>
          <div className="gs-card gs-stat">
            <span className="gs-stat-number" style={{ color: '#dc2626' }}>{gaps.filter(g => g.score <= 1).length}</span>
            <span className="gs-stat-label">Critical Gaps (0-1)</span>
          </div>
          <div className="gs-card gs-stat">
            <span className="gs-stat-number" style={{ color: '#d97706' }}>{gaps.filter(g => g.score === 2).length}</span>
            <span className="gs-stat-label">High Gaps (Score 2)</span>
          </div>
          <div className="gs-card gs-stat">
            <span className="gs-stat-number" style={{ color: '#059669' }}>
              {AUDIT_CHECKSHEET.reduce((c, s) => c + (skippedSections[s.id] ? 0 : s.questions.filter(q => {
                const sc = scores[s.id]?.[q.id];
                return sc && sc.score >= 3;
              }).length), 0)}
            </span>
            <span className="gs-stat-label">Compliant (3-4)</span>
          </div>
        </div>

        {/* Section Radar / Bar Chart */}
        <div className="gap-section-chart">
          <h3>Section-wise Score</h3>
          <div className="gsc-bars">
            {AUDIT_CHECKSHEET.map(s => {
              if (skippedSections[s.id]) return null;
              const sc = getSectionScore(s.id);
              return (
                <div key={s.id} className="gsc-bar-row">
                  <span className="gsc-label">{s.id}. {s.title}</span>
                  <div className="gsc-bar-track">
                    <div className="gsc-bar-fill" style={{ width: `${sc.pct}%`, background: getScoreColor(sc.pct) }} />
                  </div>
                  <span className="gsc-pct" style={{ color: getScoreColor(sc.pct) }}>{sc.pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gap Items Table */}
        <div className="gap-items">
          <h3>Gap Items (Score &lt; 3)</h3>
          {gaps.length === 0 ? (
            <div className="no-gaps">
              <span style={{ fontSize: 32 }}>🎉</span>
              <p>No significant gaps found! All items scored 3 or above.</p>
            </div>
          ) : (
            <div className="gap-table-wrap">
              <table className="gap-table">
                <thead>
                  <tr>
                    <th>Q.No</th>
                    <th>Section</th>
                    <th>Assessment Area</th>
                    <th>Score</th>
                    <th>Priority</th>
                    <th>Observation</th>
                    <th>Action Required</th>
                    <th>Responsible</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g, i) => (
                    <tr key={i} className={`gap-row gap-${g.priority.toLowerCase()}`}>
                      <td className="gap-qnum">{g.questionId}</td>
                      <td>{g.section}</td>
                      <td className="gap-question">{g.question.substring(0, 100)}...</td>
                      <td><span className={`gap-score-badge score-${g.score}`}>{g.score}/4</span></td>
                      <td><span className={`gap-priority ${g.priority.toLowerCase()}`}>{g.priority}</span></td>
                      <td>{g.observation || '—'}</td>
                      <td>{g.action || '—'}</td>
                      <td>{g.responsible || '—'}</td>
                      <td>{g.target_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  // RENDER: Action Plans
  // ═══════════════════════════════════════════════
  const renderActionPlans = () => {
    const openCount = actionPlans.filter(a => a.status === 'Open').length;
    const inProgressCount = actionPlans.filter(a => a.status === 'In Progress').length;
    const completedCount = actionPlans.filter(a => a.status === 'Completed' || a.status === 'Verified').length;

    return (
      <div className="action-plans-view">
        <div className="ap-topbar">
          <button className="aq-btn-ghost" onClick={() => setActiveView('scoring')}>← Back to Scoring</button>
          <h2>Corrective Action Plans</h2>
          <button className="aq-btn-secondary" onClick={() => setActiveView('gap-analysis')}>📊 Gap Analysis</button>
        </div>

        <div className="ap-stats">
          <div className="ap-stat"><span className="ap-stat-num" style={{ color: '#dc2626' }}>{openCount}</span><span>Open</span></div>
          <div className="ap-stat"><span className="ap-stat-num" style={{ color: '#d97706' }}>{inProgressCount}</span><span>In Progress</span></div>
          <div className="ap-stat"><span className="ap-stat-num" style={{ color: '#059669' }}>{completedCount}</span><span>Completed</span></div>
          <div className="ap-stat"><span className="ap-stat-num">{actionPlans.length}</span><span>Total</span></div>
        </div>

        {actionPlans.length === 0 ? (
          <div className="ap-empty">
            <p>No action plans generated yet. Go to scoring and click "Generate Actions" to auto-create action plans for low-scoring items.</p>
            <button className="aq-btn-primary" onClick={generateActionPlans}>Generate Action Plans</button>
          </div>
        ) : (
          <div className="ap-list">
            {actionPlans.map(ap => (
              <div key={ap.id} className={`ap-card priority-${ap.priority?.toLowerCase()}`}>
                <div className="ap-card-header">
                  <span className="ap-qid">Q{ap.question_id}</span>
                  <span className={`ap-priority ${ap.priority?.toLowerCase()}`}>{ap.priority}</span>
                  <span className={`ap-card-status ${ap.status?.replace(/\s/g, '-').toLowerCase()}`}>{ap.status}</span>
                </div>
                <p className="ap-question">{ap.question_text || `Section ${ap.section_id}, Q${ap.question_id}`}</p>
                <div className="ap-score-line">
                  <span>Current: <strong>{ap.current_score}/4</strong></span>
                  <span>→</span>
                  <span>Target: <strong>{ap.target_score}/4</strong></span>
                </div>
                {ap.gap_description && <p className="ap-gap-desc"><strong>Gap:</strong> {ap.gap_description}</p>}
                
                {editingAction === ap.id ? (
                  <div className="ap-edit-form">
                    <div className="ap-edit-row">
                      <div className="ap-edit-group">
                        <label>Action Plan</label>
                        <textarea rows="2" defaultValue={ap.action_plan} id={`ap-action-${ap.id}`} />
                      </div>
                    </div>
                    <div className="ap-edit-row">
                      <div className="ap-edit-group">
                        <label>Responsible</label>
                        <input type="text" defaultValue={ap.responsible} id={`ap-resp-${ap.id}`} />
                      </div>
                      <div className="ap-edit-group">
                        <label>Target Date</label>
                        <input type="date" defaultValue={ap.target_date} id={`ap-tdate-${ap.id}`} />
                      </div>
                      <div className="ap-edit-group">
                        <label>Status</label>
                        <select defaultValue={ap.status} id={`ap-status-${ap.id}`}>
                          <option>Open</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                          <option>Verified</option>
                        </select>
                      </div>
                      <div className="ap-edit-group">
                        <label>Priority</label>
                        <select defaultValue={ap.priority} id={`ap-prio-${ap.id}`}>
                          <option>Critical</option>
                          <option>High</option>
                          <option>Medium</option>
                          <option>Low</option>
                        </select>
                      </div>
                    </div>
                    <div className="ap-edit-row">
                      <div className="ap-edit-group">
                        <label>Evidence / Remarks</label>
                        <textarea rows="2" defaultValue={ap.remarks || ''} id={`ap-remarks-${ap.id}`} />
                      </div>
                    </div>
                    <div className="ap-edit-actions">
                      <button className="aq-btn-ghost" onClick={() => setEditingAction(null)}>Cancel</button>
                      <button className="aq-btn-primary" onClick={() => {
                        updateActionPlan(ap.id, {
                          action_plan: document.getElementById(`ap-action-${ap.id}`).value,
                          responsible: document.getElementById(`ap-resp-${ap.id}`).value,
                          target_date: document.getElementById(`ap-tdate-${ap.id}`).value,
                          status: document.getElementById(`ap-status-${ap.id}`).value,
                          priority: document.getElementById(`ap-prio-${ap.id}`).value,
                          remarks: document.getElementById(`ap-remarks-${ap.id}`).value
                        });
                      }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="ap-card-details">
                    {ap.action_plan && <p><strong>Action:</strong> {ap.action_plan}</p>}
                    <div className="ap-card-meta">
                      <span>👤 {ap.responsible || '—'}</span>
                      <span>📅 {ap.target_date || '—'}</span>
                    </div>
                    <button className="aq-btn-secondary ap-edit-btn" onClick={() => setEditingAction(ap.id)}>Edit Action Plan</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  // RENDER: Audit History / Comparison
  // ═══════════════════════════════════════════════
  const renderHistory = () => {
    const completedAudits = audits.filter(a => a.status === 'Completed' && a.percentage > 0);
    
    return (
      <div className="history-view">
        <div className="history-header">
          <h2>Audit History & Trends</h2>
          <p>Track improvement progress across multiple audits</p>
        </div>

        {completedAudits.length === 0 ? (
          <div className="audit-empty">
            <p>No completed audits yet. Complete your first audit to see trends.</p>
          </div>
        ) : (
          <>
            <div className="history-chart">
              <h3>Score Trend</h3>
              <div className="hc-bars">
                {completedAudits.map((a, i) => (
                  <div key={i} className="hc-bar-col">
                    <div className="hc-bar-wrapper">
                      <div className="hc-bar" style={{ height: `${a.percentage}%`, background: getScoreColor(a.percentage) }} />
                    </div>
                    <span className="hc-bar-pct">{a.percentage}%</span>
                    <span className="hc-bar-label">{a.partner_name}</span>
                    <span className="hc-bar-date">{a.audit_date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="history-table-wrap">
              <table className="gap-table">
                <thead>
                  <tr>
                    <th>Audit Name</th>
                    <th>Partner</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>%</th>
                    <th>Rating</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completedAudits.map(a => (
                    <tr key={a.id} onClick={() => openAudit(a)} style={{ cursor: 'pointer' }}>
                      <td><strong>{a.audit_name}</strong></td>
                      <td>{a.partner_name}</td>
                      <td>{a.audit_type}</td>
                      <td>{a.audit_date || '—'}</td>
                      <td>{a.total_score}/{a.max_score}</td>
                      <td style={{ color: getScoreColor(a.percentage), fontWeight: 700 }}>{a.percentage}%</td>
                      <td><span className={`gs-rating ${getRatingClass(a.overall_rating)}`}>{a.overall_rating}</span></td>
                      <td>{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════
  if (loading) {
    return <div className="aq-loading"><div className="aq-spinner" /><p>Loading Audit Tool...</p></div>;
  }

  return (
    <div className="audit-tool-container">
      {/* Tabs */}
      {currentAudit && (
        <div className="at-tabs">
          <button className={activeView === 'scoring' ? 'active' : ''} onClick={() => setActiveView('scoring')}>📝 Scoring</button>
          <button className={activeView === 'gap-analysis' ? 'active' : ''} onClick={() => setActiveView('gap-analysis')}>📊 Gap Analysis</button>
          <button className={activeView === 'action-plans' ? 'active' : ''} onClick={() => setActiveView('action-plans')}>📋 Action Plans ({actionPlans.length})</button>
          <button className={activeView === 'history' ? 'active' : ''} onClick={() => setActiveView('history')}>📈 History</button>
        </div>
      )}

      {/* Messages */}
      {message.text && (
        <div className={`aq-message ${message.type}`}>{message.text}</div>
      )}

      {/* Content */}
      {activeView === 'list' && renderAuditList()}
      {activeView === 'scoring' && currentAudit && renderScoring()}
      {activeView === 'gap-analysis' && currentAudit && renderGapAnalysis()}
      {activeView === 'action-plans' && currentAudit && renderActionPlans()}
      {activeView === 'history' && renderHistory()}
    </div>
  );
};

export default QMSAuditTool;
