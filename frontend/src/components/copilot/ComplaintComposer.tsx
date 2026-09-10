import React from 'react';
import FileUploadZone from '../FileUploadZone';

/* ── TextInput ──────────────────────────────────────────────────────────── */
interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled: boolean;
  isCorrection: boolean;
}

export const TextInput: React.FC<TextInputProps> = ({
  value, onChange, onKeyDown, disabled, isCorrection,
}) => (
  <textarea
    className="copilot-textarea"
    style={{ minHeight: isCorrection ? 60 : 80 }}
    placeholder={
      isCorrection
        ? 'e.g. "Actually the batch is BMX240602 and 48 capsules are affected"'
        : 'Paste any complaint text — email, paragraph, WhatsApp message, anything…'
    }
    value={value}
    onChange={e => onChange(e.target.value)}
    onKeyDown={onKeyDown}
    disabled={disabled}
    rows={3}
    aria-label="Complaint text input"
  />
);

/* ── FileAttachment ─────────────────────────────────────────────────────── */
interface FileAttachmentProps {
  onFile: (file: File) => void;
  disabled: boolean;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ onFile, disabled }) => (
  <FileUploadZone onFile={onFile} disabled={disabled} compact />
);

/* ── QuickActions ────────────────────────────────────────────────────────── */
const SAMPLES = [
  {
    label: '¶ Story',
    title: 'Story-style complaint',
    text: `Apollo Pharmacy informed us that several Amoxicillin 500 mg capsules from batch AMX240602 appear discolored.\n\nAround 12 capsules are affected. The product was manufactured in March 2026 and expires in February 2028.\n\nThey want the issue investigated and a replacement provided.`,
  },
  {
    label: '✉ Email',
    title: 'Email-style complaint',
    text: `Subject: Complaint regarding Metformin Hydrochloride API\n\nDear Quality Team,\n\nWe received 25 kg of Metformin Hydrochloride API, batch MFH260712A, in one HDPE drum.\n\nDuring incoming QC inspection, our team identified visible black particulate matter embedded within the bulk API powder. Foreign matter confirmed in three separate sample pulls.\n\nPlease investigate urgently.\n\nRegards,\nVikram Iyer, QC Manager\nZenith Life Sciences Pvt. Ltd.`,
  },
  {
    label: '💬 Message',
    title: 'Informal customer message',
    text: `There seems to be something wrong with 48 tablets from batch PCM260801. ABC Pharmacy says the tablets inside one strip have changed colour. Not sure when they were made but exp is July 2028.`,
  },
];

interface QuickActionsProps {
  onSampleLoad: (text: string) => void;
  onAnalyze: () => void;
  isProcessing: boolean;
  isCorrection: boolean;
  disabled: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onSampleLoad, onAnalyze, isProcessing, isCorrection, disabled,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {/* Primary CTA */}
    <button
      className="btn copilot-analyze-btn"
      onClick={onAnalyze}
      disabled={disabled}
      aria-label={isProcessing ? 'Analyzing' : isCorrection ? 'Send correction' : 'Analyze complaint'}
    >
      {isProcessing
        ? <><span className="spinner" /> Analyzing…</>
        : isCorrection
        ? '✎ Send Correction'
        : '✦ Analyze Complaint'}
    </button>

    {/* Demo samples — only when idle */}
    {!isProcessing && !isCorrection && (
      <div>
        <div style={{
          fontSize: 9.5, fontWeight: 700, color: '#94A3B8',
          textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6,
        }}>
          Try a demo sample
        </div>
        <div className="sample-btns">
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              className="sample-btn"
              title={s.title}
              onClick={() => onSampleLoad(s.text)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

/* ── ComplaintComposer ──────────────────────────────────────────────────── */
interface ComplaintComposerProps {
  inputText: string;
  setInputText: (v: string) => void;
  onAnalyze: () => void;
  onFileSelected: (file: File) => void;
  onSampleLoad: (text: string) => void;
  isProcessing: boolean;
  isCorrection: boolean;
}

const ComplaintComposer: React.FC<ComplaintComposerProps> = ({
  inputText, setInputText, onAnalyze, onFileSelected, onSampleLoad,
  isProcessing, isCorrection,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onAnalyze();
    }
  };

  const analyzeDisabled = !inputText.trim() || isProcessing;

  return (
    <div style={{
      padding: '10px 12px',
      borderTop: '1px solid #E2E8F0',
      background: '#FFFFFF',
      flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Text input */}
      <div className="copilot-textarea-wrap">
        <TextInput
          value={inputText}
          onChange={setInputText}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          isCorrection={isCorrection}
        />
      </div>

      {/* File + Analyze row */}
      <div className="copilot-action-row">
        <QuickActions
          onAnalyze={onAnalyze}
          onSampleLoad={onSampleLoad}
          isProcessing={isProcessing}
          isCorrection={isCorrection}
          disabled={analyzeDisabled}
        />
        <div className="copilot-action-divider" style={{ flexShrink: 0 }}>or</div>
        <FileAttachment onFile={onFileSelected} disabled={isProcessing} />
      </div>

      <div className="copilot-input-footer">
        <span className="copilot-model-label">Ctrl+Enter to analyze</span>
      </div>
    </div>
  );
};

export default ComplaintComposer;
