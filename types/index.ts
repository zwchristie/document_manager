// Core document types
export interface DocumentInput {
  content: string
  type: DocumentType
  metadata: DocumentMetadata
}

export interface DocumentMetadata {
  serviceName?: string
  version?: string
  author?: string
  dependencies?: string[]
  tags?: string[]
  category?: string
  businessUnit?: string
}

export type DocumentType = 
  | 'microservice'
  | 'api-endpoint'
  | 'business-logic'
  | 'system-architecture'
  | 'database-schema'
  | 'configuration'
  | 'deployment'
  | 'security-policy'

// Enriched document structure
export interface EnrichedDocument {
  id?: string
  originalInput: DocumentInput
  enrichedContent: DocumentContent
  metadata: EnrichedDocumentMetadata
  structuredData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface DocumentContent {
  title: string
  summary: string
  description: string
  purpose: string
  sections: DocumentSection[]
}

export interface DocumentSection {
  title: string
  content: string
  type: SectionType
  metadata?: Record<string, any>
}

export type SectionType = 
  | 'overview'
  | 'inputs'
  | 'outputs'
  | 'dependencies'
  | 'examples'
  | 'configuration'
  | 'troubleshooting'
  | 'related-services'

export interface EnrichedDocumentMetadata extends DocumentMetadata {
  enrichmentTimestamp: string
  llmModel: string
  confidence: number
  reviewStatus: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
}

// LLM Integration types
export interface LLMRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface LLMResponse {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  finishReason: string
}

export interface PromptTemplate {
  id: string
  name: string
  documentType: DocumentType
  systemPrompt: string
  userPromptTemplate: string
  outputSchema: Record<string, any>
  examples: PromptExample[]
  version: string
}

export interface PromptExample {
  input: DocumentInput
  expectedOutput: EnrichedDocument
  description: string
}

// Drift detection types
export interface ExistingDocument {
  id: string
  title: string
  content: DocumentContent
  metadata: EnrichedDocumentMetadata
  similarity: number
}

export interface DriftAnalysis {
  hasChanges: boolean
  confidence: number
  changes: DriftChange[]
  recommendation: DriftRecommendation
}

export interface DriftChange {
  section: string
  type: 'addition' | 'deletion' | 'modification'
  oldValue?: string
  newValue?: string
  significance: 'low' | 'medium' | 'high'
}

export type DriftRecommendation = 
  | 'create-new'
  | 'update-existing'
  | 'manual-review'
  | 'merge-required'

export interface DriftResolution {
  action: 'keep-existing' | 'update' | 'create-new' | 'merge'
  targetDocumentId?: string
  mergeStrategy?: MergeStrategy
}

export interface MergeStrategy {
  conflictResolution: 'prefer-new' | 'prefer-existing' | 'manual'
  sectionsToUpdate: string[]
  preserveMetadata: boolean
}

// Q&A Service types
export interface SearchQuery {
  query: string
  documentType?: DocumentType
  tags?: string[]
  limit?: number
  threshold?: number
}

export interface SearchResult {
  documents: ExistingDocument[]
  totalCount: number
  searchTime: number
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  timestamp: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

// State management types
export interface DocumentManagerState {
  // Current document processing
  currentDocument: DocumentInput | null
  enrichedDocument: EnrichedDocument | null
  processingStatus: ProcessingStatus
  
  // Drift detection
  existingDocuments: ExistingDocument[]
  driftAnalysis: DriftAnalysis | null
  resolutionRequired: boolean
  
  // UI state
  activeStep: ProcessingStep
  errors: string[]
  isLoading: boolean
  
  // Configuration
  config: EmbedConfig
}

export type ProcessingStatus = 
  | 'idle'
  | 'enriching'
  | 'searching'
  | 'analyzing-drift'
  | 'saving'
  | 'error'

export type ProcessingStep = 
  | 'input'
  | 'enriching'
  | 'preview'
  | 'drift-resolution'
  | 'complete'

// Micro frontend configuration
export interface EmbedConfig {
  apiEndpoints: {
    llm: string
    qa: string
    storage: string
  }
  theme?: 'light' | 'dark' | 'auto'
  defaultDocumentType?: DocumentType
  customPromptTemplates?: PromptTemplate[]
  features?: FeatureFlags
  callbacks?: CallbackConfig
}

export interface FeatureFlags {
  enableDriftDetection: boolean
  enableAutoSave: boolean
  enablePreview: boolean
  enableMetadataValidation: boolean
}

export interface CallbackConfig {
  onDocumentSaved?: (document: EnrichedDocument) => void
  onError?: (error: Error) => void
  onStepChange?: (step: ProcessingStep) => void
  onDriftDetected?: (analysis: DriftAnalysis) => void
}

// Validation types
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Export all types as a namespace for easier importing
export namespace DocumentManager {
  export type Input = DocumentInput
  export type Enriched = EnrichedDocument
  export type Metadata = DocumentMetadata
  export type Type = DocumentType
  export type Config = EmbedConfig
  export type State = DocumentManagerState
}