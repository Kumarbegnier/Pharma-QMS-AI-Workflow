import React, { useRef, useState, useCallback } from 'react';

interface FileAttachmentProps {
  attached: File | null;
  onAttach: (file: File) => void;
  onRemove: () => void;
  disabled: boolean;
}

const ACCEPTED_EXT = ['.pdf', '.txt', '.docx', '.eml', '.md', '.csv'];
const ACCEPTED_MIME = [
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'message/rfc822', 'text/markdown', 'text/csv',
];

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

const FileAttachment: React.FC<FileAttachmentProps> = ({ attached, onAttach, onRemove, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError]     = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const validate = useCallback((file: File): boolean => {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ACCEPTED_EXT.includes(ext) && !ACCEPTED_MIME.includes(file.type)) {
      setError('Unsupported format. Use PDF, DOCX, TXT or EML.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Max 10 MB.');
      return false;
    }
    setError(null);
    return true;
  }, []);

  const handleFile = useCallback((file: File) => {
    if (validate(file)) onAttach(file);
  }, [validate, onAttach]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  if (attached) {
    // Selected file pill
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: '#EFF6FF',
        border: '1px solid #BFDBFE', borderRadius: 8,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#1E293B',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {attached.name}
          </div>
          <div style={{ fontSize: 10.5, color: '#64748B' }}>{fmtSize(attached.size)}</div>
        </div>
        <button
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove attached file"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            color: '#94A3B8', fontSize: 14, lineHeight: 1,
            borderRadius: 4,
          }}
          onMouseOver={e => (e.currentTarget.style.color = '#DC2626')}
          onMouseOut={e  => (e.currentTarget.style.color = '#94A3B8')}
        >
          ×
        </button>
      </div>
    );
  }

  // Attach button + drop target
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef} type="file"
        accept={ACCEPTED_EXT.join(',')}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        id="copilot-file-input"
        aria-label="Attach complaint file"
        disabled={disabled}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <label
          htmlFor="copilot-file-input"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
            border: `1px solid ${dragging ? '#3B82F6' : '#E2E8F0'}`,
            background: dragging ? '#EFF6FF' : '#F8FAFC',
            color: disabled ? '#94A3B8' : '#334155',
            fontSize: 12.5, fontWeight: 600, transition: 'all 0.15s',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span style={{ fontSize: 14 }}>📎</span>
          Attach file
        </label>
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
          PDF · DOCX · TXT · EML
        </span>
      </div>
      {error && (
        <div style={{
          marginTop: 5, fontSize: 11, color: '#DC2626',
          padding: '3px 8px', background: '#FEF2F2',
          borderRadius: 5, border: '1px solid #FECACA',
        }}>
          {error}
        </div>
      )}
      {dragging && !disabled && (
        <div style={{
          marginTop: 6, padding: '8px', textAlign: 'center',
          border: '1.5px dashed #3B82F6', borderRadius: 8,
          background: '#EFF6FF', fontSize: 12, color: '#1D4ED8', fontWeight: 600,
        }}>
          Drop file here
        </div>
      )}
    </div>
  );
};

export default FileAttachment;
