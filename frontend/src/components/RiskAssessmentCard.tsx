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

const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({ analysis }) => {
  const [showCauses, setShowCauses] = useState(false);
  const [showCapa, setShowCapa] = useState(false);

  const completeness = Math.round((analysis.completeness_score || 0) * 100);
  const cls = getCompletenessClass(analysis.completeness_score || 0);

  // Resolve patient safety impact — may arrive as boolean or string
  const psi = analysis.patient_safety_impact;
  const safetyImpact: boolean | null =
    psi === true || psi === 'true' ? true :
    psi === false || psi === 'false' ? false : null;

  return (
    <div className="risk-card">
      <div className="risk-card-header">
        <span style={{ fontSize: '14px' }}>🤖</span>
        <span className="risk-card-title">AI Copilot — Risk Assessment</span>
        <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: 'auto' }}>
          {analysis.is_fallback_used ? 'Demo Mode' : analysis.model_name}
        </span>
      </div>

      <div className="risk-card-body">

        {/* AI Summary — shown first if available */}
        {analysis.complaint_summary && (
          <div style={{
            fontSize: '11.5px', color: '#1E293B', padding: '8px 10px',
            background: 'linear-gradient(to right, #EFF6FF, #F8FAFC)',
            borderRadius: 6, borderLeft: '3px solid #3B82F6',
            lineHeight: 1.55,
          }}>
            <strong style={{
              display: 'block', marginBottom: 3,
              fontSize: '10px', color: '#2563EB',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              AI Summary
            </strong>
            {analysis.complaint_summary}
          </div>
        )}

        {/* Severity & Risk row */}
        <div className="risk-row">
          <span className="risk-row-label">Suggested Severity</span>
          <span className={`badge ${getSeverityClass(analysis.suggested_severity)}`}>
            {analysis.suggested_severity}
          </span>
        </div>
        <div className="risk-row">
          <span className="risk-row-label">Risk Level</span>
          <span className={`badge ${getRiskClass(analysis.suggested_risk)}`}>
            {analysis.suggested_risk}
          </span>
        </div>
        <div className="risk-row">
          <span className="risk-row-label">Patient Safety Impact</span>
          {safetyImpact === true ? (
            <span className="badge badge-critical">⚠ Yes</span>
          ) : safetyImpact === false ? (
            <span className="badge badge-low">No</span>
          ) : (
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Not determined</span>
          )}
        </div>

        {/* Completeness */}
        <div>
          <div className="risk-row" style={{ marginBottom: 4 }}>
            <span className="risk-row-label">Completeness</span>
            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: cls === 'high' ? '#16A34A' : cls === 'medium' ? '#D97706' : '#DC2626',
            }}>
              {completeness}%
            </span>
          </div>
          <div className="completeness-bar">
            <div className={`completeness-fill ${cls}`} style={{ width: `${completeness}%` }} />
          </div>
        </div>

        {/* Missing fields */}
        {analysis.missing_information?.length > 0 && (
          <div>
            <div style={{
              fontSize: '10.5px', fontWeight: 700, color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5,
            }}>
              Missing Information
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {analysis.missing_information.map((item, i) => (
                <span key={i} style={{
                  fontSize: '10.5px', color: '#D97706', padding: '2px 7px',
                  background: '#FFFBEB', borderRadius: 10,
                  border: '1px solid #FCD34D', fontWeight: 500,
                }}>
                  ⚠ {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Risk reasoning */}
        {analysis.risk_reasoning && (
          <div className="risk-reasoning">{analysis.risk_reasoning}</div>
        )}

        {/* Suggested next action */}
        {analysis.suggested_next_action && (
          <div style={{
            fontSize: '11.5px', color: '#1E293B', padding: '8px 10px',
            background: '#F8FAFC', borderRadius: 6,
            border: '1px solid #E2E8F0',
          }}>
            <strong style={{
              display: 'block', marginBottom: 3,
              fontSize: '10px', color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.4px',
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
              {showCauses ? '▾' : '▸'} Possible Root Causes ({analysis.possible_root_causes.length})
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
              {showCapa ? '▾' : '▸'} Recommended CAPA ({analysis.recommended_capa.length})
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
