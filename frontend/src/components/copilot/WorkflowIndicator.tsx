import React from 'react';

// ── WorkflowIndicator ────────────────────────────────────────────────────────
// Shows the 5-step AI pipeline as a compact informational row.
// These are NOT buttons — they are read-only workflow indicators.

const STEPS = [
  { label: 'Extract',     icon: '⊙' },
  { label: 'Validate',    icon: '✓' },
  { label: 'Assess Risk', icon: '⚡' },
  { label: 'RCA',         icon: '⊕' },
  { label: 'CAPA',        icon: '◈' },
];

const WorkflowIndicator: React.FC = () => (
  <div
    style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '8px 14px', borderBottom: '1px solid #E2E8F0',
      background: '#F8FAFC', overflowX: 'auto', flexShrink: 0,
    }}
    aria-label="AI analysis workflow steps"
    role="list"
  >
    {STEPS.map((step, i) => (
      <React.Fragment key={step.label}>
        <div
          role="listitem"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            fontSize: 11, fontWeight: 600, color: '#1D4ED8',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10 }}>{step.icon}</span>
          {step.label}
        </div>
        {i < STEPS.length - 1 && (
          <span style={{
            color: '#CBD5E1', fontSize: 10, fontWeight: 700, padding: '0 4px', flexShrink: 0,
          }}>
            →
          </span>
        )}
      </React.Fragment>
    ))}
  </div>
);

export default WorkflowIndicator;
