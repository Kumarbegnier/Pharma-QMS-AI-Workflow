import React, { useRef, useState, useCallback } from 'react';

interface FileUploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ACCEPTED = ['.pdf', '.txt', '.docx', '.eml', '.md', '.csv'];
const ACCEPTED_MIME = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'message/rfc822',
  'text/markdown',
  'text/csv',
  'application/csv',
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Inline SVG upload icon
const UploadIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const FileIcon: React.FC = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    stroke="#D97706" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFile, disabled = false, compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateAndDispatch = useCallback((file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const ok = ACCEPTED.includes(ext) || ACCEPTED_MIME.includes(file.type);
    if (!ok) {
      setError(`Unsupported type. Use: PDF, DOCX, TXT, EML, MD or CSV.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }
    setSelectedFile(file);
    onFile(file);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) validateAndDispatch(file);
  }, [disabled, validateAndDispatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndDispatch(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
  };

  // ── Compact: single upload button ──────────────────────────────────────
  if (compact) {
    return (
      <>
        <input
          ref={inputRef} type="file" accept={ACCEPTED.join(',')}
          style={{ display: 'none' }} onChange={handleChange}
        />
        <button
          className={`btn btn-secondary copilot-upload-btn${isDragging ? ' dragging' : ''}`}
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          title="Upload PDF, DOCX, TXT, or EML"
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <UploadIcon size={14} />
          Upload File
        </button>
      </>
    );
  }

  // ── Full drop zone ──────────────────────────────────────────────────────
  return (
    <div>
      <input
        ref={inputRef} type="file" accept={ACCEPTED.join(',')}
        style={{ display: 'none' }} onChange={handleChange}
      />

      {selectedFile ? (
        /* Selected file card */
        <div className="file-drop-selected">
          <FileIcon />
          <div className="file-drop-selected-info">
            <div className="file-drop-selected-name">{selectedFile.name}</div>
            <div className="file-drop-selected-size">{formatBytes(selectedFile.size)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="file-drop-selected-status">✓ Ready to analyze</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleRemove}
              style={{ fontSize: 10, padding: '1px 6px', color: '#94A3B8' }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          className={`file-drop-zone${isDragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={e => e.key === 'Enter' && !disabled && inputRef.current?.click()}
          aria-label="Upload complaint document"
        >
          <UploadIcon size={24} />
          <div className="file-drop-label">
            {isDragging ? 'Drop file here' : 'Upload Complaint'}
          </div>
          <div className="file-drop-sub">PDF · DOCX · TXT · EML · Drag & drop or click</div>
        </div>
      )}

      {error && <div className="file-drop-error">{error}</div>}
    </div>
  );
};

export default FileUploadZone;
