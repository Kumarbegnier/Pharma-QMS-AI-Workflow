import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type {
  ComplaintsState, ComplaintDraft, AIAnalysis, DuplicateMatch,
  Complaint, AIStatus, StatsResponse, ExtractionStatus, ChatMessage
} from './types';

const initialDraft: ComplaintDraft = {
  source: 'Pharmacy',
  customer_name: '',
  customer_type: 'Pharmacy',
  reporter_contact: '',
  product_type: 'FDF',
  product_name: '',
  strength_or_grade: '',
  batch_number: '',
  affected_quantity: '',
  manufacturing_date: '',
  expiry_date: '',
  complaint_date: '',
  complaint_category: 'Product Quality',
  complaint_description: '',
  originating_site_block: '',
  impacted_non_product_material: '',
  suggested_severity: '',
  risk_level: '',
  patient_safety_impact: false,
  suggested_next_action: '',
  initial_risk_assessment: '',
  status: 'Pending Triage',
  assigned_investigator: '',
  missing_information: [],
  possible_root_causes: [],
  recommended_capa: [],
};

const initialState: ComplaintsState = {
  draft: { ...initialDraft },
  analysis: null,
  chatMessages: [],
  extractionStatus: 'idle',
  progress: 0,
  aiPopulatedFields: [],
  userReviewedFields: [],
  duplicates: [],
  complaints: [],
  selectedComplaint: null,
  aiStatus: null,
  stats: null,
  loading: false,
  chatLoading: false,
  error: null,
  savedComplaintId: null,
};

function makeMsg(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: `${Date.now()}-${Math.random()}`, role, content, timestamp: new Date().toISOString() };
}

// ── Async thunks ──────────────────────────────────────────────────────────────

export const fetchAIStatus = createAsyncThunk('complaints/fetchAIStatus', async () => {
  const res = await fetch('/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
});

export const analyzeComplaintText = createAsyncThunk(
  'complaints/analyzeText',
  async ({ text, fileName }: { text: string; fileName: string }, { dispatch }) => {
    const stages: [ExtractionStatus, number][] = [
      ['parsing', 10], ['extracting', 30], ['validating', 50],
      ['assessing', 65], ['generating', 80], ['checking_duplicates', 92],
    ];

    // Kick off stage animation
    (async () => {
      for (const [stage, pct] of stages) {
        await new Promise(r => setTimeout(r, 350));
        dispatch(setExtractionStatus(stage));
        dispatch(setProgress(pct));
      }
    })();

    const res = await fetch('/api/ai/intake/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_content: text, file_name: fileName }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
);

export const analyzeComplaintFile = createAsyncThunk(
  'complaints/analyzeFile',
  async (file: File, { dispatch }) => {
    const stages: [ExtractionStatus, number][] = [
      ['parsing', 10], ['extracting', 35], ['validating', 55],
      ['assessing', 70], ['generating', 85], ['checking_duplicates', 93],
    ];
    (async () => {
      for (const [stage, pct] of stages) {
        await new Promise(r => setTimeout(r, 400));
        dispatch(setExtractionStatus(stage));
        dispatch(setProgress(pct));
      }
    })();

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/ai/intake/file', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
);

export const sendChatCorrection = createAsyncThunk(
  'complaints/sendChat',
  async ({ message, draft }: { message: string; draft: ComplaintDraft }) => {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_complaint: draft, user_message: message }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
);

export const saveComplaint = createAsyncThunk(
  'complaints/save',
  async (payload: Partial<ComplaintDraft> & { severity?: string }) => {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
);

export const loadComplaints = createAsyncThunk(
  'complaints/loadAll',
  async (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/complaints${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
);

export const loadComplaint = createAsyncThunk('complaints/loadOne', async (id: number) => {
  const res = await fetch(`/api/complaints/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
});

export const loadStats = createAsyncThunk('complaints/loadStats', async () => {
  const res = await fetch('/api/complaints/stats');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
});

export const patchComplaint = createAsyncThunk(
  'complaints/patch',
  async ({ id, updates }: { id: number; updates: Record<string, any> }) => {
    const res = await fetch(`/api/complaints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const complaintsSlice = createSlice({
  name: 'complaints',
  initialState,
  reducers: {
    setExtractionStatus(state, action: PayloadAction<ExtractionStatus>) {
      state.extractionStatus = action.payload;
    },
    setProgress(state, action: PayloadAction<number>) {
      state.progress = action.payload;
    },
    updateFieldManually(state, action: PayloadAction<{ field: string; value: any }>) {
      const { field, value } = action.payload;
      (state.draft as any)[field] = value;
      if (!state.userReviewedFields.includes(field)) {
        state.userReviewedFields.push(field);
      }
    },
    resetDraft(state) {
      state.draft = { ...initialDraft };
      state.analysis = null;
      state.chatMessages = [];
      state.extractionStatus = 'idle';
      state.progress = 0;
      state.aiPopulatedFields = [];
      state.userReviewedFields = [];
      state.duplicates = [];
      state.error = null;
      state.savedComplaintId = null;
    },
    addSystemMessage(state, action: PayloadAction<string>) {
      state.chatMessages.push(makeMsg('system', action.payload));
    },
    setSelectedComplaint(state, action: PayloadAction<Complaint | null>) {
      state.selectedComplaint = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearSavedId(state) {
      state.savedComplaintId = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAIStatus
    builder
      .addCase(fetchAIStatus.fulfilled, (state, action) => {
        state.aiStatus = action.payload;
      });

    // analyzeComplaintText
    builder
      .addCase(analyzeComplaintText.pending, (state) => {
        state.extractionStatus = 'parsing';
        state.progress = 5;
        state.error = null;
        state.chatMessages.push(makeMsg('system', 'Processing complaint document...'));
      })
      .addCase(analyzeComplaintText.fulfilled, (state, action) => {
        const { analysis, duplicates } = action.payload;
        state.analysis = analysis;
        state.duplicates = duplicates || [];
        state.extractionStatus = 'ready';
        state.progress = 100;

        // Merge extracted fields into draft
        const fields = analysis.extracted_fields || {};
        const aiFields: string[] = [];
        const fieldMap: Record<string, string> = {
          source: 'source', customer_name: 'customer_name',
          customer_type: 'customer_type', reporter_contact: 'reporter_contact',
          product_type: 'product_type', product_name: 'product_name',
          strength_or_grade: 'strength_or_grade', batch_number: 'batch_number',
          affected_quantity: 'affected_quantity', manufacturing_date: 'manufacturing_date',
          expiry_date: 'expiry_date', complaint_category: 'complaint_category',
          complaint_date: 'complaint_date', complaint_description: 'complaint_description',
          originating_site_block: 'originating_site_block',
          impacted_non_product_material: 'impacted_non_product_material',
        };
        for (const [src, dst] of Object.entries(fieldMap)) {
          const val = fields[src];
          if (val !== null && val !== undefined && val !== '') {
            (state.draft as any)[dst] = String(val);
            aiFields.push(dst);
          }
        }
        // AI analysis summary fields
        if (analysis.suggested_severity) state.draft.suggested_severity = analysis.suggested_severity;
        if (analysis.suggested_risk) state.draft.risk_level = analysis.suggested_risk;
        if (analysis.suggested_next_action) state.draft.suggested_next_action = analysis.suggested_next_action;
        if (analysis.possible_root_causes) state.draft.possible_root_causes = analysis.possible_root_causes;
        if (analysis.recommended_capa) state.draft.recommended_capa = analysis.recommended_capa;
        if (analysis.missing_information) state.draft.missing_information = analysis.missing_information;

        state.aiPopulatedFields = aiFields;

        const completeness = Math.round((analysis.completeness_score || 0) * 100);
        const dupeNote = duplicates?.length ? ` ⚠️ ${duplicates.length} possible duplicate(s) found.` : '';
        state.chatMessages.push(makeMsg('assistant',
          `✅ Analysis complete. Extracted ${aiFields.length} fields with ${completeness}% completeness. ` +
          `Suggested severity: **${analysis.suggested_severity}**.${dupeNote} ` +
          `Review the form and click "Commit to QMS Ledger" when ready.`
        ));
      })
      .addCase(analyzeComplaintText.rejected, (state, action) => {
        state.extractionStatus = 'error';
        state.error = action.error.message || 'Extraction failed';
        state.chatMessages.push(makeMsg('system', `Error: ${action.error.message}`));
      });

    // analyzeComplaintFile — same shape
    builder
      .addCase(analyzeComplaintFile.pending, (state, action) => {
        state.extractionStatus = 'parsing';
        state.progress = 5;
        state.error = null;
      })
      .addCase(analyzeComplaintFile.fulfilled, (state, action) => {
        // Reuse same logic via shared fulfilled handler trick — just dispatch analyzeComplaintText.fulfilled equivalent
        const { analysis, duplicates } = action.payload;
        state.analysis = analysis;
        state.duplicates = duplicates || [];
        state.extractionStatus = 'ready';
        state.progress = 100;
        const fields = analysis.extracted_fields || {};
        const aiFields: string[] = [];
        const entries: [string, string][] = [
          ['source','source'],['customer_name','customer_name'],['customer_type','customer_type'],
          ['reporter_contact','reporter_contact'],['product_type','product_type'],
          ['product_name','product_name'],['strength_or_grade','strength_or_grade'],
          ['batch_number','batch_number'],['affected_quantity','affected_quantity'],
          ['manufacturing_date','manufacturing_date'],['expiry_date','expiry_date'],
          ['complaint_category','complaint_category'],['complaint_date','complaint_date'],
          ['complaint_description','complaint_description'],
          ['originating_site_block','originating_site_block'],
          ['impacted_non_product_material','impacted_non_product_material'],
        ];
        for (const [src, dst] of entries) {
          const val = fields[src];
          if (val !== null && val !== undefined && val !== '') {
            (state.draft as any)[dst] = String(val);
            aiFields.push(dst);
          }
        }
        if (analysis.suggested_severity) state.draft.suggested_severity = analysis.suggested_severity;
        if (analysis.suggested_risk) state.draft.risk_level = analysis.suggested_risk;
        if (analysis.suggested_next_action) state.draft.suggested_next_action = analysis.suggested_next_action;
        if (analysis.possible_root_causes) state.draft.possible_root_causes = analysis.possible_root_causes;
        if (analysis.recommended_capa) state.draft.recommended_capa = analysis.recommended_capa;
        if (analysis.missing_information) state.draft.missing_information = analysis.missing_information;
        state.aiPopulatedFields = aiFields;
        const completeness = Math.round((analysis.completeness_score || 0) * 100);
        state.chatMessages.push(makeMsg('assistant',
          `✅ File processed. ${aiFields.length} fields extracted. Completeness: ${completeness}%. ` +
          `Suggested severity: **${analysis.suggested_severity}**. Please review the form.`
        ));
      })
      .addCase(analyzeComplaintFile.rejected, (state, action) => {
        state.extractionStatus = 'error';
        state.error = action.error.message || 'File processing failed';
        state.chatMessages.push(makeMsg('system', `Error processing file: ${action.error.message}`));
      });

    // sendChatCorrection
    builder
      .addCase(sendChatCorrection.pending, (state) => {
        state.chatLoading = true;
      })
      .addCase(sendChatCorrection.fulfilled, (state, action) => {
        state.chatLoading = false;
        const { updates, assistant_message } = action.payload;
        // Apply patches
        if (updates && Object.keys(updates).length > 0) {
          for (const [field, val] of Object.entries(updates)) {
            (state.draft as any)[field] = val;
            if (!state.userReviewedFields.includes(field)) {
              state.userReviewedFields.push(field);
            }
          }
        }
        state.chatMessages.push(makeMsg('assistant', assistant_message || 'Done!'));
      })
      .addCase(sendChatCorrection.rejected, (state, action) => {
        state.chatLoading = false;
        state.chatMessages.push(makeMsg('system', `Error: ${action.error.message}`));
      });

    // saveComplaint
    builder
      .addCase(saveComplaint.pending, (state) => { state.loading = true; })
      .addCase(saveComplaint.fulfilled, (state, action) => {
        state.loading = false;
        state.savedComplaintId = action.payload.id;
      })
      .addCase(saveComplaint.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Save failed';
      });

    // loadComplaints
    builder
      .addCase(loadComplaints.pending, (state) => { state.loading = true; })
      .addCase(loadComplaints.fulfilled, (state, action) => {
        state.loading = false;
        state.complaints = action.payload;
      })
      .addCase(loadComplaints.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Load failed';
      });

    // loadComplaint
    builder
      .addCase(loadComplaint.fulfilled, (state, action) => {
        state.selectedComplaint = action.payload;
      });

    // loadStats
    builder
      .addCase(loadStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      });

    // patchComplaint
    builder
      .addCase(patchComplaint.fulfilled, (state, action) => {
        state.selectedComplaint = action.payload;
        const idx = state.complaints.findIndex(c => c.id === action.payload.id);
        if (idx >= 0) state.complaints[idx] = action.payload;
      });
  },
});

export const {
  setExtractionStatus, setProgress, updateFieldManually, resetDraft,
  addSystemMessage, setSelectedComplaint, setError, clearSavedId,
} = complaintsSlice.actions;

export default complaintsSlice.reducer;
