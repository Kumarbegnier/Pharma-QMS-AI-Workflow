// CopilotPanel — thin shell, delegates to the AIVOACopilot component tree.
//
// Component tree:
//   AIVOACopilot
//   ├── CopilotHeader  (AIStatus · ModelBadge)
//   ├── CapabilityChips
//   ├── AIAnalysisProgress  (ExtractionStep · RiskStep · RCAStep · DuplicateStep)
//   ├── [chat messages / onboarding]
//   ├── AnalysisResult  (ConfidenceScore · ExtractedData · ApplyToForm)
//   └── ComplaintComposer  (TextInput · FileAttachment · QuickActions)
//
// Import individual components directly from '../components/copilot' if needed.

import AIVOACopilot from './copilot/AIVOACopilot';
export default AIVOACopilot;
