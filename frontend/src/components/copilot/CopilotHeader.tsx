import React from 'react';

interface AIStatusProps {
  online: boolean;
}

export const AIStatus: React.FC<AIStatusProps> = ({ online }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: online ? '#34D399' : '#FCD34D',
      boxShadow: online ? '0 0 6px rgba(52,211,153,0.6)' : '0 0 6px rgba(252,211,77,0.5)',
      animation: online ? 'pulse-ring 2s ease-in-out infinite' : 'none',
    }} />
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: online ? '#059669' : '#B45309',
    }}>
      {online ? 'Online' : 'Demo Mode'}
    </span>
    <style>{`
      @keyframes pulse-ring {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  </div>
);

interface ModelBadgeProps {
  model: string;
  provider: string;
  isFallback: boolean;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({ model, provider, isFallback }) => (
  <div
    title={isFallback ? 'Demo mode — add GROQ_API_KEY for full AI' : `Model: ${model}`}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 5,
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1px',
      background: isFallback ? '#FFFBEB' : '#EFF6FF',
      color: isFallback ? '#B45309' : '#1D4ED8',
      border: `1px solid ${isFallback ? '#FCD34D' : '#BFDBFE'}`,
      cursor: 'default',
    }}
  >
    {isFallback ? '⚡ Demo' : `${provider} · ${model}`}
  </div>
);

interface CopilotHeaderProps {
  online: boolean;
  model: string;
  provider: string;
  isFallback: boolean;
}

const CopilotHeader: React.FC<CopilotHeaderProps> = ({ online, model, provider, isFallback }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    flexShrink: 0,
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 13, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px',
        }}>
          AIVOA Copilot
        </span>
        <AIStatus online={online} />
      </div>
      <div style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>
        Complaint Intelligence · LangGraph Pipeline
      </div>
    </div>
    <ModelBadge model={model} provider={provider} isFallback={isFallback} />
  </div>
);

export default CopilotHeader;
