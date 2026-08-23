export interface FieldConfidence {
  value: any;
  confidence: number;
}

export interface AuditLog {
  id: number;
  complaint_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_source: 'AI' | 'USER' | 'SYSTEM';
  actor: string;
  created_at: string;
}

export interface CapaTask {
  id: number;
  complaint_id: number;
  action: string;
  owner: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export interface ComplaintDraft {
  source: string;
  customer_name: string;
  customer_type: string;
  reporter_contact: string;
  product_type: 'FDF' | 'API';
  product_name: string;
  strength_or_grade: string;
  batch_number: string;
  affected_quantity: string;
  manufacturing_date: string;
  expiry_date: string;
  complaint_date: string;
  complaint_category: string;
  complaint_description: string;
  originating_site_block: string;
  impacted_non_product_material: string;
  suggested_severity: string;
  risk_level: string;
  patient_safety_impact: boolean;
  suggested_next_action: string;
  initial_risk_assessment: string;
  status: string;
  assigned_investigator: string;
  missing_information: string[];
  possible_root_causes: string[];
  recommended_capa: string[];
}

export interface Complaint extends ComplaintDraft {
  id: number;
  complaint_number: string;
  severity: string;
  created_at: string;
  updated_at: string;
  audit_logs: AuditLog[];
  capa_tasks: CapaTask[];
}

export interface AIAnalysis {
  id?: number;
  extracted_fields: Record<string, any>;
  field_confidence: Record<string, FieldConfidence>;
  completeness_score: number;
  missing_information: string[];
  suggested_severity: string;
  suggested_risk: string;
  patient_safety_impact?: boolean | string | null;
  risk_reasoning: string;
  suggested_next_action: string;
  complaint_summary: string;
  possible_root_causes: string[];
  recommended_capa: string[];
  model_name: string;
  is_fallback_used: boolean;
}

export interface DuplicateMatch {
  complaint_id: number;
  complaint_number: string;
  product_name: string;
  batch_number: string;
  complaint_category: string;
  similarity_score: number;
  matched_factors: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AIStatus {
  status: string;
  model: string;
  groq_available: boolean;
  active_provider: string;
  is_fallback_active: boolean;
}

export interface StatsResponse {
  total_complaints: number;
  open_investigations: number;
  high_risk_count: number;
  capa_pending_count: number;
  categories_breakdown: Record<string, number>;
  risk_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
}

export type ExtractionStatus =
  | 'idle'
  | 'parsing'
  | 'extracting'
  | 'validating'
  | 'assessing'
  | 'generating'
  | 'checking_duplicates'
  | 'ready'
  | 'error';

export interface ComplaintsState {
  draft: ComplaintDraft;
  analysis: AIAnalysis | null;
  chatMessages: ChatMessage[];
  extractionStatus: ExtractionStatus;
  progress: number;
  aiPopulatedFields: string[];
  userReviewedFields: string[];
  duplicates: DuplicateMatch[];
  complaints: Complaint[];
  selectedComplaint: Complaint | null;
  aiStatus: AIStatus | null;
  stats: StatsResponse | null;
  loading: boolean;
  chatLoading: boolean;
  error: string | null;
  savedComplaintId: number | null;
}
