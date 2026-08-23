import React, { useCallback, useRef, useState } from 'react';

interface FileUploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** compact = inline button-style used inside the action row */
  compact?: boolean;
}

const SUPPORTED_TYPES = ['.pdf', '.docx', '.txt', '.eml', '.md', '.csv'];
const SUPPORTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'message/rfc822',
  'text/markdown',
  'text/csv',
];

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onFile, disabled, compact }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_TYPES.includes(ext)) {
      return `Unsupported type "${ext}". Use PDF, DOCX, TXT, or EML.`;
    }
    if (file.size === 0) return 'File is empty.';
    if (file.size > 10 * 1024 * 1024) return 'File exceeds the 10 MB limit.';
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFile(file);
  }, [onFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  if (compact) {
    // Compact: single button used inline next to the Analyze button
    return (
      <div>
        <button
          className={`btn btn-secondary copilot-upload-btn ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
          disabled={disabled}
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          type="button"
          title="Upload PDF, DOCX, TXT, or EML"
        >
          {isDragging ? '⬇ Drop file…' : '📎 Upload File'}
        </button>
        {error && <div className="file-drop-error" style={{ marginTop: 4 }}>{error}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_TYPES.join(',')}
          style={{ display: 'none' }}
          onChange={onInputChange}
          disabled={disabled}
        />
      </div>
    );
  }

  // Full drop-zone variant (used standalone if needed)
  return (
    <div>
      <div
        className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      >
        <div className="file-drop-icon">📎</div>
        <div className="file-drop-label">
          {isDragging ? 'Drop to analyze…' : 'Upload Complaint File'}
        </div>
        <div className="file-drop-sub">
          Drag &amp; drop or click · PDF, DOCX, TXT, EML
        </div>
      </div>
      {error && <div className="file-drop-error">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={onInputChange}
        disabled={disabled}
      />
    </div>
  );
};

export default FileUploadZone;
