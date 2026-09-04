import React, { useState } from 'react';
import type { AIAnalysis } from '../features/complaints/types';

interface RiskAssessmentCardProps {
  analysis: AIAnalysis;
}

function getSeverityClass(sev: string) {
  if (sev === 'Critical') return 'badge-critical';
  if (sev === 'Major') return 'badge-major';
  return 'badge-minor';
}

function getRiskClass(risk: string) {
  if (risk === 'High') return 'badge-high';
  if (risk === 'Medium') return 'badge-medium';
  return 'badge-low';
}

function getCompletenessClass(score: number) {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function getCompletenessColor(cls: string) {
  if (cls === 'high') return '#16A34A';
  if (cls === 'medium') return '#D97706';
  return '#DC2626';
}

const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({ analysis }) => {
  const [showCauses, setShowCauses] = useState(false);
  const [showCapa, setShowCapa] = useState(false);

  const completeness = Math.round((analysis.completeness_score || 0) * 100);
  const cls = getCompletenessClass(analysis.completeness_score || 0);

  const psi = analysis.patient_safety_impact;
  const safetyImpact: boolean | null =
    psi === true || psi === 'true' ? true :
    psi === false || psi === 'false' ? false : null;

  return (
    <div className="risk-card">
      {/* Header — blue AI accent */}
      <div className="risk-card-header">
        <span style={{ fontSize: 13, color: '#2563EB' }}>✦</span>
        <span className="risk-card-title">AI Copilot — Risk Assessment</span>
        <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto', fontWeight: 500 }}>
          {analysis.is_fallback_used ? 'Demo Fallback' : (analysis.model_name ?? 'Groq AI')}
        </span>
      </div>

      <div className="risk-card-body">

        {/* AI Summary */}
        {analysis.complaint_summary && (
          <div style={{
            fontSize: 12, color: '#1E293B', padding: '8px 11px',
            background: '#EFF6FF', borderRadius: 6, borderLeft: '2.5px solid #3B82F6',
            lineHeight: 1.55,
          }}>
            <strong style={{
              display: 'block', marginBottom: 3,
              fontSize: 9.5, color: '#1D4ED8',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              AI Summary
            </strong>
            {analysis.complaint_summary}
          </div>
        )}

        {/* Severity + Risk in a 2-col row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '8px 10px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Suggested Severity
            </div>
            <span className={`badge ${getSeverityClass(analysis.suggested_severity)}`}>
              {analysis.suggested_severity || '—'}
            </span>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 6, padding: '8px 10px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Risk Level
            </div>
            <span className={`badge ${getRiskClass(analysis.suggested_risk)}`}>
              {analysis.suggested_risk || '—'}
            </span>
          </div>
        </div>

        {/* Patient safety */}
        <div className="risk-row">
          <span className="risk-row-label">Patient Safety Impact</span>
          {safetyImpact === true ? (
            <span className="badge badge-critical">⚠ Yes — Potential impact</span>
          ) : safetyImpact === false ? (
            <span className="badge badge-low">No direct impact identified</span>
          ) : (
            <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Not determined</span>
          )}
        </div>

        {/* Completeness */}
        <div>
          <div className="risk-row" style={{ marginBottom: 5 }}>
            <span className="risk-row-label">Complaint Completeness</span>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: getCompletenessColor(cls),
            }}>
              {completeness}%
            </span>
          </div>
          <div className="completeness-bar">
            <div className={`completeness-fill ${cls}`} style={{ width: `${completeness}%` }} />
          </div>
        </div>

        {/* Missing information */}
        {analysis.missing_information?.length > 0 && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5,
            }}>
              Missing Information
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {analysis.missing_information.map((item, i) => (
                <span key={i} style={{
                  fontSize: 11, color: '#B45309', padding: '2px 8px',
                  background: '#FFFBEB', borderRadius: 4,
                  border: '1px solid #FCD34D', fontWeight: 500,
                }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Risk rationale — indigo left bar */}
        {analysis.risk_reasoning && (
          <div className="risk-reasoning">
            <strong style={{
              display: 'block', marginBottom: 3, fontSize: 9.5,
              color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Risk Rationale
            </strong>
            {analysis.risk_reasoning}
          </div>
        )}

        {/* Suggested next action */}
        {analysis.suggested_next_action && (
          <div style={{
            fontSize: 12, color: '#1E293B', padding: '8px 10px',
            background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0',
          }}>
            <strong style={{
              display: 'block', marginBottom: 3, fontSize: 9.5,
              color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.4px',
            }}>
              Suggested Next Action
            </strong>
            {analysis.suggested_next_action}
          </div>
        )}

        {/* Root causes — collapsible */}
        {analysis.possible_root_causes?.length > 0 && (
          <div>
            <button className="collapsible-toggle" onClick={() => setShowCauses(v => !v)}>
              {showCauses ? '▾' : '▸'}
              &nbsp;Possible Root Causes ({analysis.possible_root_causes.length})
            </button>
            {showCauses && (
              <div className="risk-list" style={{ marginTop: 6 }}>
                {analysis.possible_root_causes.map((c, i) => (
                  <div key={i} className="risk-list-item">{c}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CAPA — collapsible */}
        {analysis.recommended_capa?.length > 0 && (
          <div>
            <button className="collapsible-toggle" onClick={() => setShowCapa(v => !v)}>
              {showCapa ? '▾' : '▸'}
              &nbsp;Recommended Actions ({analysis.recommended_capa.length})
            </button>
            {showCapa && (
              <div className="risk-list" style={{ marginTop: 6 }}>
                {analysis.recommended_capa.map((c, i) => (
                  <div key={i} className="risk-list-item">{c}</div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default RiskAssessmentCard;
