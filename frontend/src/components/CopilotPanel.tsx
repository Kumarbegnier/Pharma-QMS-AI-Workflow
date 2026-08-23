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

// ── Demo samples (story/email/informal styles) ─────────────────────────────
const SAMPLES = [
  {
    label: '¶ Story',
    title: 'Sample 1: Story-style',
    text: `Apollo Pharmacy informed us that several Amoxicillin 500 mg capsules from batch AMX240602 appear discolored.

Around 12 capsules are affected. The product was manufactured in March 2026 and expires in February 2028.

They want the issue investigated and a replacement provided.`,
  },
  {
    label: '✉ Email',
    title: 'Sample 2: Email-style',
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
    label: '💬 Informal',
    title: 'Sample 3: Informal text',
    text: `There seems to be something wrong with 48 tablets from batch PCM260801. ABC Pharmacy says the tablets inside one strip have changed colour. Not sure when they were made but exp is July 2028.`,
  },
];

// File-upload progress steps
const FILE_PROGRESS_STEPS = [
  'Reading document…',
  'Extracting complaint text…',
  'Analyzing complaint…',
  'Validating fields…',
  'Assessing risk…',
  'Populating form…',
];

const CopilotPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { chatMessages, extractionStatus, progress, analysis, draft, chatLoading, aiStatus } =
    useAppSelector(s => s.complaints);

  const [inputText, setInputText] = useState('');
  const [activeFile, setActiveFile] = useState<{ name: string; step: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (chatMessages.length === 0) {
      dispatch(addSystemMessage(
        'Welcome to AIVOA Copilot. Paste any complaint text — paragraph, email, customer message — or upload a file. The AI will extract and populate the form automatically.'
      ));
    }
  }, []);

  // Animate file-progress steps while processing
  useEffect(() => {
    if (activeFile && !['idle', 'ready', 'error'].includes(extractionStatus)) {
      fileStepTimer.current = setInterval(() => {
        setActiveFile(prev =>
          prev && prev.step < FILE_PROGRESS_STEPS.length - 1
            ? { ...prev, step: prev.step + 1 }
            : prev
        );
      }, 900);
    } else {
      if (fileStepTimer.current) clearInterval(fileStepTimer.current);
      if (activeFile && extractionStatus === 'ready') {
        setActiveFile(prev => prev ? { ...prev, step: FILE_PROGRESS_STEPS.length - 1 } : null);
        setTimeout(() => setActiveFile(null), 2500);
      }
      if (extractionStatus === 'error') setActiveFile(null);
    }
    return () => { if (fileStepTimer.current) clearInterval(fileStepTimer.current); };
  }, [extractionStatus, activeFile?.name]);

  const isProcessing = !['idle', 'ready', 'error'].includes(extractionStatus);
  const isReadyForCorrection = analysis && extractionStatus === 'ready';

  const handleAnalyze = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    if (isReadyForCorrection) {
      // Correction mode
      dispatch(sendChatCorrection({ message: text, draft }));
    } else {
      // New intake
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
    setActiveFile({ name: file.name, step: 0 });
    dispatch(addSystemMessage(`📎 Processing file: ${file.name}`));
    dispatch(analyzeComplaintFile(file));
  };

  const handleSampleLoad = (text: string) => {
    dispatch(analyzeComplaintText({ text, fileName: 'sample_complaint.txt' }));
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const isOnline = aiStatus?.groq_available;
  const btnLabel = isReadyForCorrection ? 'Correct →' : 'Analyze →';
  const btnDisabled = !inputText.trim() || isProcessing;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="copilot-header">
        <div>
          <div className="copilot-title">AIVOA Copilot</div>
          <div className="copilot-subtitle">
            {isOnline ? '● Online · Groq AI' : '● Demo Mode · Local Rules'}
          </div>
        </div>
        <span className="copilot-online-dot" />
      </div>

      {/* ── Pipeline progress bar ──────────────────────────────────────── */}
      {isProcessing && <StageProgress status={extractionStatus} progress={progress} />}

      {/* ── File upload progress ───────────────────────────────────────── */}
      {activeFile && isProcessing && (
        <div className="file-upload-progress">
          <div className="file-upload-filename">📎 {activeFile.name}</div>
          <div className="file-upload-steps">
            {FILE_PROGRESS_STEPS.map((step, i) => (
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

      {/* ── File success banner ────────────────────────────────────────── */}
      {activeFile && extractionStatus === 'ready' && (
        <div className="file-upload-success">
          ✅ <strong>{activeFile.name}</strong> analyzed — form auto-populated
        </div>
      )}

      {/* ── Chat messages ──────────────────────────────────────────────── */}
      <div className="copilot-messages">
        {chatMessages.map(msg => (
          <div key={msg.id} className={`chat-msg ${msg.role}`}>
            <div className="chat-bubble">{msg.content}</div>
            <span className="chat-time">{formatTime(msg.timestamp)}</span>
          </div>
        ))}
        {chatLoading && (
          <div className="chat-msg assistant">
            <div className="chat-bubble"><span className="spinner spinner-dark" /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Primary text input area (always visible) ───────────────────── */}
      <div className="copilot-input-area">
        <div className="copilot-textarea-wrap">
          <textarea
            className="copilot-textarea"
            placeholder={
              isReadyForCorrection
                ? 'Correct a field, e.g. "The batch is BMX240602 and quantity is 48 tablets"…'
                : 'Paste complaint text here — paragraph, email, customer message, WhatsApp, anything…'
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
          />
        </div>

        {/* Action row */}
        <div className="copilot-action-row">
          <button
            className="btn btn-primary copilot-analyze-btn"
            onClick={handleAnalyze}
            disabled={btnDisabled}
          >
            {isProcessing
              ? <><span className="spinner" /> Analyzing…</>
              : isReadyForCorrection
                ? '✏ Correct Fields'
                : '🔍 Analyze with AI'}
          </button>

          <div className="copilot-action-divider">or</div>

          {/* File upload trigger */}
          <FileUploadZone
            onFile={handleFileSelected}
            disabled={isProcessing}
            compact
          />
        </div>

        <div className="copilot-input-footer">
          <span className="copilot-model-label">
            {isOnline
              ? `${aiStatus?.model ?? 'llama-3.3-70b-versatile'} · Groq`
              : 'Demo Mode — add GROQ_API_KEY for full AI'}
          </span>
          <span className="copilot-model-label">Ctrl+Enter to analyze</span>
        </div>
      </div>

      {/* ── Sample loaders — only shown when idle ──────────────────────── */}
      {extractionStatus === 'idle' && (
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
    </>
  );
};

export default CopilotPanel;
