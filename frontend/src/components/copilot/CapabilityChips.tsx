import React from 'react';

interface Capability {
  icon: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}

const CAPABILITIES: Capability[] = [
  { icon: '📄', label: 'PDF',       desc: 'Scanned or text-based PDF',      color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { icon: '📝', label: 'DOCX',      desc: 'Word document',                  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { icon: '📧', label: 'Email',     desc: 'EML or email-style text',        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { icon: '💬', label: 'Free text', desc: 'Any paragraph or customer note', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
];

const CapabilityChips: React.FC = () => (
  <div style={{
    padding: '10px 14px',
    borderBottom: '1px solid #E2E8F0',
    background: '#FAFBFC',
    flexShrink: 0,
  }}>
    <div style={{
      fontSize: 9.5, fontWeight: 700, color: '#94A3B8',
      textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 7,
    }}>
      Accepts any of
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {CAPABILITIES.map(c => (
        <div
          key={c.label}
          title={c.desc}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 5,
            fontSize: 11, fontWeight: 700,
            background: c.bg, color: c.color,
            border: `1px solid ${c.border}`,
            cursor: 'default', userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 12 }}>{c.icon}</span>
          {c.label}
        </div>
      ))}
    </div>
  </div>
);

export default CapabilityChips;
