import React from 'react';

// Samples matching the existing demo text payloads from the codebase.
// "Email" and "Message" reuse existing payloads; "Letter" and "Product Defect" are new realistic samples.
// Clicking only populates the textarea — it does NOT auto-analyze.

export const QUICK_SAMPLES: {
  icon: string;
  label: string;
  title: string;
  text: string;
}[] = [
  {
    icon: '📧',
    label: 'Email',
    title: 'Email-style complaint',
    text: `Subject: Complaint regarding Metformin Hydrochloride API

Dear Quality Team,

We received 25 kg of Metformin Hydrochloride API, batch MFH260712A, in one HDPE drum.

During incoming QC inspection, our team identified visible black particulate matter embedded within the bulk API powder. Foreign matter confirmed in three separate sample pulls.

Please investigate urgently and provide a corrective action plan.

Regards,
Vikram Iyer, QC Manager
Zenith Life Sciences Pvt. Ltd.
vikram.iyer@zenithlifesciences.com`,
  },
  {
    icon: '💬',
    label: 'Message',
    title: 'Informal customer message',
    text: `There seems to be something wrong with 48 tablets from batch PCM260801. ABC Pharmacy says the tablets inside one strip have changed colour. Not sure when they were made but exp is July 2028.`,
  },
  {
    icon: '📄',
    label: 'Letter',
    title: 'Formal complaint letter',
    text: `Date: 10 September 2026

To: Quality Assurance Department
From: Dr. Priya Mehta, Medical Director
Organization: Sunrise Hospital, Pune

Subject: Formal Complaint — Atorvastatin 40 mg Tablets, Batch ATR260803

Dear Quality Assurance Team,

We are filing a formal complaint regarding Atorvastatin Calcium Tablets 40 mg received at our hospital pharmacy on 28 August 2026.

Batch Number: ATR260803
Quantity Received: 10,000 tablets (100 packs of 100 tablets)
Manufacturing Date: June 2026
Expiry Date: May 2028

Issue Observed: Upon routine quality check, pharmacists identified that approximately 120 tablets across 12 packs exhibit a visible white powdery deposit on the tablet surface. The deposit is inconsistent with the normal tablet coating appearance. Two tablets from separate packs were submitted for third-party laboratory testing.

Patient Impact: No adverse events have been reported to date. As a precaution, the affected batch has been quarantined.

We request an immediate investigation, root cause analysis, and replacement of the affected stock.

Yours sincerely,
Dr. Priya Mehta
Medical Director, Sunrise Hospital`,
  },
  {
    icon: '⚠',
    label: 'Product Defect',
    title: 'Pharmaceutical product defect report',
    text: `Apollo Pharmacy informed us that several Amoxicillin 500 mg capsules from batch AMX240602 appear discolored.

Around 12 capsules are affected. The product was manufactured in March 2026 and expires in February 2028.

The customer reports that the capsule shells appear brownish and some appear to have moisture damage. The product was stored under recommended conditions (below 25°C, humidity < 65%).

They want the issue investigated and a replacement provided.`,
  },
];

interface QuickExamplesProps {
  onSelect: (text: string) => void;
  disabled: boolean;
}

const QuickExamples: React.FC<QuickExamplesProps> = ({ onSelect, disabled }) => (
  <div>
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#94A3B8',
      textTransform: 'uppercase', letterSpacing: '0.6px',
      marginBottom: 7,
    }}>
      Try an example
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {QUICK_SAMPLES.map(s => (
        <button
          key={s.label}
          onClick={() => onSelect(s.text)}
          disabled={disabled}
          title={s.title}
          aria-label={`Load ${s.title} example`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 6,
            border: '1px solid #E2E8F0', background: '#F8FAFC',
            color: disabled ? '#94A3B8' : '#334155',
            fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.13s',
          }}
          onMouseOver={e => {
            if (!disabled) {
              e.currentTarget.style.background = '#EFF6FF';
              e.currentTarget.style.borderColor = '#BFDBFE';
              e.currentTarget.style.color = '#1D4ED8';
            }
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#F8FAFC';
            e.currentTarget.style.borderColor = '#E2E8F0';
            e.currentTarget.style.color = disabled ? '#94A3B8' : '#334155';
          }}
        >
          <span style={{ fontSize: 13 }}>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  </div>
);

export default QuickExamples;
