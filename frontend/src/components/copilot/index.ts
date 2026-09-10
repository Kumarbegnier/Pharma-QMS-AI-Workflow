// AIVOACopilot component tree — barrel exports
// Main entry: import CopilotPanel from '../components/copilot/CopilotPanel'

export { default }                         from './CopilotPanel';
export { default as CopilotPanel }         from './CopilotPanel';
export { default as WorkflowIndicator }    from './WorkflowIndicator';
export { default as FileAttachment }       from './FileAttachment';
export { default as QuickExamples }        from './QuickExamples';
export { default as AnalysisProgress }     from './AnalysisProgress';
export { default as AnalysisResult }       from './AnalysisResult';
export { default as ConfidenceBadge }      from './ConfidenceBadge';
export { default as ConflictDialog }       from './ConflictDialog';
export type { ConflictItem }               from './ConflictDialog';
export { ExtractionStep, RiskStep, RCAStep, DuplicateStep } from './AIAnalysisProgress';
