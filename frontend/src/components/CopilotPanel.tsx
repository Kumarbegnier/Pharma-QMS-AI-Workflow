import React, { useRef, useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  analyzeComplaintText,
  analyzeComplaintFile,
  sendChatCorrection,
  addSystemMessage,
} from '../features/complaints/complaintsSlice';
import StageProgress from './StageProgress';
import FileUploadZone from './FileUploadZone';

const SAMPLES = [
  {
    label: '¶ Story',
    title: 'Story-style complaint',
    text: `Apollo Pharmacy informed us that several Amoxicillin 500 mg capsules from batch AMX240602 appear discolored.

Around 12 capsules are affected. The product was manufactured in March 2026 and expires in February 2028.

They want the issue investigated and a replacement provided.`,
  },
  {
    label: '✉ Email',
    title: 'Email-style complaint',
    text: `Subject: Complaint regarding Metformin Hydrochloride API

Dear Quality Team,

We received 25 kg of Metformin Hydrochloride API, batch MFH260712A, in one HDPE drum.

During incoming QC inspection, our team identified visible black particulate matter embedded within the bulk API powder. Foreign matter confirmed in three separate sample pulls.

Please investigate urgently.

Regards,
Vikram Iyer, QC Manager
Zenith Life Sciences Pvt. Ltd.
vikram.iyer@zenithlifesciences.com`,
  },
  {
    label: '💬 Message',
    title: 'Informal customer message',
    text: `There seems to be something wrong with 48 tablets from batch PCM260801. ABC Pharmacy says the tablets inside one strip have changed colour. Not sure when they were made but exp is July 2028.`,
  },
];

const FILE_STEPS = [
  'Reading document…',
  'Extracting complaint text…',
  'Analyzing with AI…',
  'Validating extracted fields…',
  'Assessing risk…',
  'Populating form…',
];

const CopilotPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    chatMessages, extractionStatus, progress, analysis, draft, chatLoading, aiStatus,
  } = useAppSelector(s => s.complaints);

  const [inputText, setInputText] = useState('');
  const [activeFile, setActiveFile] = useState<{ name: string; size: number; step: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Fix: prevent duplicate welcome message under React StrictMode
  const welcomeSent = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (chatMessages.length === 0 && !welcomeSent.current) {
      welcomeSent.current = true;
      dispatch(addSystemMessage(
        'Upload a complaint file or paste any complaint text — email, paragraph, customer message. AI will extract all fields automatically.'
      ));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate file step counter
  useEffect(() => {
    if (activeFile && !['idle', 'ready', 'error'].includes(extractionStatus)) {
      fileStepTimer.current = setInterval(() => {
        setActiveFile(prev =>
          prev && prev.step < FILE_STEPS.length - 1
            ? { ...prev, step: prev.step + 1 }
            : prev
        );
      }, 900);
    } else {
      if (fileStepTimer.current) clearInterval(fileStepTimer.current);
      if (activeFile && extractionStatus === 'ready') {
        setActiveFile(prev => prev ? { ...prev, step: FILE_STEPS.length - 1 } : null);
        setTimeout(() => setActiveFile(null), 2500);
      }
      if (extractionStatus === 'error') setActiveFile(null);
    }
    return () => { if (fileStepTimer.current) clearInterval(fileStepTimer.current); };
  }, [extractionStatus, activeFile?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const isProcessing = !['idle', 'ready', 'error'].includes(extractionStatus);
  const isAfterAnalysis = analysis && extractionStatus === 'ready';

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const handleFileSelected = (file: File) => {
    setActiveFile({ name: file.name, size: file.size, step: 0 });
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

  // Show onboarding block when: only the welcome system msg exists and idle
  const showOnboarding = !isAfterAnalysis && extractionStatus === 'idle' && chatMessages.length <= 1;

  const analyzeLabel = isProcessing
    ? 'Analyzing…'
    : isAfterAnalysis
    ? '✎ Send Correction'
    : '✦ Analyze Complaint';

  const btnDisabled = !inputText.trim() || isProcessing;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="copilot-header">
        <div>
          <div className="copilot-title">AIVOA Copilot</div>
          <div className="copilot-subtitle">
            {aiStatus?.groq_available ? '● Groq AI · Online' : '● Demo Mode · Local rules'}
          </div>
        </div>
        <span className="copilot-online-dot"
          title={aiStatus?.groq_available ? 'AI connected' : 'Demo mode'} />
      </div>

      {/* ── LangGraph progress ─────────────────────────────────────────── */}
      {isProcessing && <StageProgress status={extractionStatus} progress={progress} />}

      {/* ── File progress steps ────────────────────────────────────────── */}
      {activeFile && isProcessing && (
        <div className="file-upload-progress">
          <div className="file-upload-filename">📎 {activeFile.name}</div>
          <div className="file-upload-steps">
            {FILE_STEPS.map((step, i) => (
              <div
                key={i}
                className={`file-upload-step ${
                  i < activeFile.step ? 'done' : i === activeFile.step ? 'active' : 'pending'
                }`}
              >
                <span className="file-step-dot" />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── File analyzed success ──────────────────────────────────────── */}
      {activeFile && extractionStatus === 'ready' && (
        <div className="file-upload-success">
          ✓ <strong>{activeFile.name}</strong> — form auto-populated from file
        </div>
      )}

      {/* ── Messages area ─────────────────────────────────────────────── */}
      <div className="copilot-messages">
        {/* Onboarding card replaces empty chat */}
        {showOnboarding ? (
          <div className="copilot-onboarding">
            <div className="copilot-onboarding-title">
              Turn any customer complaint into structured QMS data.
            </div>
            <div className="copilot-onboarding-sub">
              Upload a PDF, DOCX, EML, or paste an email or paragraph below.
              The AI reads it and populates all form fields automatically.
            </div>

            {/* Full drop zone */}
            <FileUploadZone onFile={handleFileSelected} disabled={isProcessing} />

            <div className="copilot-or-divider">or paste text below</div>
          </div>
        ) : (
          /* Normal conversation */
          chatMessages.map(msg => (
            <div key={msg.id} className={`chat-msg ${msg.role}`}>
              <div className="chat-bubble">{msg.content}</div>
              <span className="chat-time">{formatTime(msg.timestamp)}</span>
            </div>
          ))
        )}

        {chatLoading && (
          <div className="chat-msg assistant">
            <div className="chat-bubble">
              <span className="spinner spinner-dark" style={{ width: 12, height: 12 }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Sample buttons (only when idle) ───────────────────────────── */}
      {extractionStatus === 'idle' && !isProcessing && (
        <div className="sample-loaders">
          <div className="sample-loaders-label">Try a demo sample</div>
          <div className="sample-btns">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                className="sample-btn"
                title={s.title}
                onClick={() => handleSampleLoad(s.text)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input area ────────────────────────────────────────────────── */}
      <div className="copilot-input-area">
        <div className="copilot-textarea-wrap">
          <textarea
            className="copilot-textarea"
            placeholder={
              isAfterAnalysis
                ? 'e.g. "Actually the batch is BMX240602 and 48 capsules are affected"'
                : 'Paste complaint text here — email, paragraph, customer message, anything…'
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            rows={3}
          />
        </div>

        {/* Action row: Analyze button + Upload button */}
        <div className="copilot-action-row">
          <button
            className="btn copilot-analyze-btn"
            onClick={handleAnalyze}
            disabled={btnDisabled}
          >
            {isProcessing ? <><span className="spinner" /> Analyzing…</> : analyzeLabel}
          </button>

          <div className="copilot-action-divider">or</div>

          <FileUploadZone onFile={handleFileSelected} disabled={isProcessing} compact />
        </div>

        <div className="copilot-input-footer">
          <span className="copilot-model-label">Ctrl+Enter to analyze</span>
        </div>
      </div>
    </>
  );
};

export default CopilotPanel;
