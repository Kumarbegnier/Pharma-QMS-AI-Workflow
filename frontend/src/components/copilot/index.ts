// AIVOACopilot component tree
// Usage: import AIVOACopilot from '../components/copilot';
//   or:  import { CopilotHeader, CapabilityChips, ... } from '../components/copilot';

export { default }                       from './AIVOACopilot';
export { default as AIVOACopilot }       from './AIVOACopilot';
export { default as CopilotHeader }      from './CopilotHeader';
export { AIStatus, ModelBadge }          from './CopilotHeader';
export { default as CapabilityChips }    from './CapabilityChips';
export { default as ComplaintComposer }  from './ComplaintComposer';
export { TextInput, FileAttachment, QuickActions } from './ComplaintComposer';
export { default as AIAnalysisProgress } from './AIAnalysisProgress';
export { ExtractionStep, RiskStep, RCAStep, DuplicateStep } from './AIAnalysisProgress';
export { default as AnalysisResult }     from './AnalysisResult';
export { ConfidenceScore, ExtractedData, ApplyToForm } from './AnalysisResult';
