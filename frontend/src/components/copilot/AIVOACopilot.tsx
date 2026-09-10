import React, { useRef, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  analyzeComplaintText,
  analyzeComplaintFile,
  sendChatCorrection,
  addSystemMessage,
} from '../../features/complaints/complaintsSlice';

import CopilotHeader                         from './CopilotHeader';
import CapabilityChips                       from './CapabilityChips';
import ComplaintComposer                     from './ComplaintComposer';
import AIAnalysisProgress                    from './AIAnalysisProgress';
import FileUploadZone                        from '../FileUploadZone';

// ── Welcome message (StrictMode-safe — fires once) ─────────────────────────
const WELCOME =
  'Upload a complaint file or paste any complaint text — email, paragraph, customer message. AI will extract all fields and assess risk automatically.';

const FILE_STEPS = [
  'Reading document…',
  'Extracting complaint text…',
  'Analyzing with AI…',
  'Validating extracted fields…',
  'Assessing risk…',
  'Populating form…',
];

const AIVOACopilot: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    chatMessages, extractionStatus, progress, analysis,
    draft, chatLoading, aiStatus, aiPopulatedFields,
  } = useAppSelector(s => s.complaints);

  const [inputText, setInputText]     = useState('');
  const [activeFile, setActiveFile]   = useState<{ name: string; step: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const welcomeSent    = useRef(false);   // prevent StrictMode double-fire

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // One-time welcome
  useEffect(() => {
    if (chatMessages.length === 0 && !welcomeSent.current) {
      welcomeSent.current = true;
      dispatch(addSystemMessage(WELCOME));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate file step counter
  useEffect(() => {
    if (activeFile && isProcessing) {
      fileTimer.current = setInterval(() => {
        setActiveFile(prev =>
          prev && prev.step < FILE_STEPS.length - 1
            ? { ...prev, step: prev.step + 1 }
            : prev,
        );
      }, 900);
    } else {
      if (fileTimer.current) clearInterval(fileTimer.current);
      if (activeFile && extractionStatus === 'ready') {
        setActiveFile(prev => prev ? { ...prev, step: FILE_STEPS.length - 1 } : null);
        setTimeout(() => setActiveFile(null), 2200);
      }
      if (extractionStatus === 'error') setActiveFile(null);
    }
    return () => { if (fileTimer.current) clearInterval(fileTimer.current); };
  }, [extractionStatus, activeFile?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ─────────────────────────────────────────────────────────
  const isProcessing    = !['idle', 'ready', 'error'].includes(extractionStatus);
  const isAfterAnalysis = !!(analysis && extractionStatus === 'ready');
  const isOnline        = !!(aiStatus?.groq_available);

  // Show onboarding (big upload zone) when truly idle with no results
  const showOnboarding  = !isAfterAnalysis && extractionStatus === 'idle' && chatMessages.length <= 1;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAnalyze = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    if (isAfterAnalysis) {
      dispatch(sendChatCorrection({ message: text, draft }));
    } else {
      dispatch(analyzeComplaintText({ text, fileName: 'user_input.txt' }));
    }
    setInputText('');
  };

  const handleFileSelected = (file: File) => {
    setActiveFile({ name: file.name, step: 0 });
    dispatch(addSystemMessage(`Processing file: ${file.name}`));
    dispatch(analyzeComplaintFile(file));
  };

  const handleSampleLoad = (text: string) => {
    dispatch(analyzeComplaintText({ text, fileName: 'sample_complaint.txt' }));
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── CopilotHeader ──────────────────────────────────────────────── */}
      <CopilotHeader
        online={isOnline}
        model="Llama 3.3 70B"
        provider="Groq"
        isFallback={!isOnline}
      />

      {/* ── CapabilityChips ────────────────────────────────────────────── */}
      {extractionStatus === 'idle' && <CapabilityChips />}

      {/* ── AIAnalysisProgress ─────────────────────────────────────────── */}
      <AIAnalysisProgress status={extractionStatus} progress={progress} />

      {/* ── File progress steps (per-file animation) ───────────────────── */}
      {activeFile && isProcessing && (
        <div style={{
          padding: '10px 14px', background: '#F0F7FF',
          borderTop: '1px solid #DBEAFE', borderBottom: '1px solid #DBEAFE',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#1D4ED8',
            marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            📎 {activeFile.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FILE_STEPS.map((step, i) => {
              const state = i < activeFile.step ? 'done' : i === activeFile.step ? 'active' : 'pending';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 11.5,
                  color: state === 'done' ? '#16A34A' : state === 'active' ? '#1D4ED8' : '#94A3B8',
                  fontWeight: state === 'active' ? 700 : 400,
                  transition: 'color 0.2s',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: state === 'done' ? '#16A34A' : state === 'active' ? '#2563EB' : '#CBD5E1',
                  }} />
                  {step}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── File analyzed banner ───────────────────────────────────────── */}
      {activeFile && extractionStatus === 'ready' && (
        <div style={{
          padding: '8px 14px', background: '#F0FDF4',
          borderTop: '1px solid #BBF7D0', borderBottom: '1px solid #BBF7D0',
          fontSize: 12, color: '#15803D', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
        }}>
          ✓ <strong>{activeFile.name}</strong> — form auto-populated from file
        </div>
      )}

      {/* ── Scrollable content area ────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>

        {/* Onboarding — shown when blank */}
        {showOnboarding && (
          <div style={{ padding: '0 12px 10px' }}>
            <div style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0',
              borderRadius: 12, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
                Turn any customer complaint into structured QMS data.
              </div>
              <div style={{ fontSize: 12, color: '#64748B' }}>
                Upload a PDF, DOCX, EML, or paste an email or paragraph below.
              </div>
              <FileUploadZone onFile={handleFileSelected} disabled={isProcessing} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 11, color: '#94A3B8', fontWeight: 500,
              }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                or paste text below
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {!showOnboarding && chatMessages.map(msg => (
          <div
            key={msg.id}
            style={{
              padding: '0 12px', marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start',
            }}
          >
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word',
              maxWidth: '90%',
              ...(msg.role === 'user'
                ? { background: '#0F172A', color: '#FFFFFF', borderBottomRightRadius: 3 }
                : msg.role === 'assistant'
                ? { background: '#FFFFFF', color: '#0F172A', border: '1px solid #E2E8F0', borderBottomLeftRadius: 3 }
                : {
                    background: '#F1F5F9', color: '#64748B',
                    fontSize: 11.5, borderRadius: 6, textAlign: 'center',
                    border: '1px solid #E2E8F0', padding: '5px 12px',
                  }),
            }}>
              {msg.content}
            </div>
            <span style={{ fontSize: 9.5, color: '#94A3B8', padding: '2px 3px' }}>
              {formatTime(msg.timestamp)}
            </span>
          </div>
        ))}

        {/* Typing spinner */}
        {chatLoading && (
          <div style={{ padding: '0 12px', marginBottom: 8 }}>
            <div style={{
              display: 'inline-flex', padding: '8px 12px',
              background: '#FFFFFF', border: '1px solid #E2E8F0',
              borderRadius: 10, borderBottomLeftRadius: 3,
            }}>
              <span className="spinner spinner-dark" style={{ width: 12, height: 12 }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── ComplaintComposer — sticky bottom ──────────────────────────── */}
      <ComplaintComposer
        inputText={inputText}
        setInputText={setInputText}
        onAnalyze={handleAnalyze}
        onFileSelected={handleFileSelected}
        onSampleLoad={handleSampleLoad}
        isProcessing={isProcessing}
        isCorrection={isAfterAnalysis}
      />
    </div>
  );
};

export default AIVOACopilot;
