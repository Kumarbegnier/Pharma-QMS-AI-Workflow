import React from 'react';

// ConflictDialog — shown when "Apply to Form" would overwrite a user-entered value.
// NEVER auto-overwrites. Shows field name, current value, and AI suggestion.

interface ConflictItem {
  field: string;
  label: string;
  currentValue: string;
  aiValue: string;
}

interface ConflictDialogProps {
  conflicts: ConflictItem[];
  onResolve: (field: string, choice: 'keep' | 'use-ai') => void;
  onDone: () => void;
}

function humanLabel(field: string): string {
  const map: Record<string, string> = {
    source: 'Complaint Source',
    customer_name: 'Customer / Organization',
    customer_type: 'Customer Type',
    reporter_contact: 'Reporter Contact',
    product_type: 'Product Type',
    product_name: 'Product Name',
    strength_or_grade: 'Strength / Grade',
    batch_number: 'Batch / Lot Number',
    affected_quantity: 'Quantity Affected',
    manufacturing_date: 'Manufacturing Date',
    expiry_date: 'Expiry Date',
    complaint_date: 'Complaint Date',
    complaint_category: 'Complaint Category',
    complaint_description: 'Complaint Description',
    originating_site_block: 'Originating Site / Block',
    impacted_non_product_material: 'Impacted Material',
  };
  return map[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const ConflictDialog: React.FC<ConflictDialogProps> = ({ conflicts, onResolve, onDone }) => {
  const remaining = conflicts.filter(c => c.currentValue !== undefined);

  if (remaining.length === 0) {
    onDone();
    return null;
  }

  const first = remaining[0];

  return (
    // Backdrop
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div style={{
        background: '#FFFFFF', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(15,23,42,0.20)',
        width: '100%', maxWidth: 400,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #E2E8F0',
          background: '#FFFBEB',
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#92400E' }} id="conflict-title">
            ⚠ Field Conflict
          </div>
          <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 3 }}>
            {remaining.length > 1
              ? `${remaining.length} fields need your decision`
              : 'The AI suggestion differs from your current value'}
          </div>
        </div>

        {/* Field name */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: '#94A3B8',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10,
          }}>
            {humanLabel(first.field)}
          </div>

          {/* Current value */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>
              Your current value
            </div>
            <div style={{
              padding: '8px 11px', background: '#F8FAFC',
              border: '1px solid #E2E8F0', borderRadius: 7,
              fontSize: 13, color: '#0F172A', fontWeight: 500,
              fontFamily: 'JetBrains Mono, monospace',
              wordBreak: 'break-word',
            }}>
              {first.currentValue}
            </div>
          </div>

          {/* AI suggestion */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#4F46E5', fontWeight: 600, marginBottom: 4 }}>
              ✦ AI suggestion
            </div>
            <div style={{
              padding: '8px 11px', background: '#EEF2FF',
              border: '1px solid #C7D2FE', borderRadius: 7,
              fontSize: 13, color: '#1E1B4B', fontWeight: 500,
              fontFamily: 'JetBrains Mono, monospace',
              wordBreak: 'break-word',
            }}>
              {first.aiValue}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 18px 16px',
          display: 'flex', gap: 8,
        }}>
          <button
            onClick={() => onResolve(first.field, 'keep')}
            style={{
              flex: 1, height: 36, borderRadius: 7,
              border: '1px solid #E2E8F0', background: '#F8FAFC',
              fontSize: 12.5, fontWeight: 700, color: '#334155',
              cursor: 'pointer',
            }}
          >
            Keep Current
          </button>
          <button
            onClick={() => onResolve(first.field, 'use-ai')}
            style={{
              flex: 1, height: 36, borderRadius: 7,
              border: 'none', background: '#4F46E5',
              fontSize: 12.5, fontWeight: 700, color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Use AI Suggestion
          </button>
        </div>

        {/* Progress indicator when multiple conflicts */}
        {remaining.length > 1 && (
          <div style={{
            padding: '0 18px 14px',
            fontSize: 11, color: '#94A3B8', textAlign: 'center',
          }}>
            {remaining.length - 1} more field{remaining.length > 2 ? 's' : ''} to resolve
          </div>
        )}
      </div>
    </div>
  );
};

export type { ConflictItem };
export default ConflictDialog;
