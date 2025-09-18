// Main library exports for micro frontend usage
export { default as DocumentManagerEmbed } from '@/utils/microFrontendBridge'
export { DocumentManagerErrorBoundary } from '@/utils/microFrontendBridge'

// Type exports
export type {
  DocumentInput,
  EnrichedDocument,
  DocumentType,
  EmbedConfig,
  ProcessingStep,
  DriftAnalysis,
  DriftResolution,
  PromptTemplate,
  ValidationResult
} from '@/types'

// Service exports (for advanced usage)
export { LLMService } from '@/services/llmService'
export { QAService } from '@/services/qaService'
export { DocumentService } from '@/services/documentService'

// Utility exports
export { PromptEngineering } from '@/utils/promptEngineering'
export { DriftDetection } from '@/utils/driftDetection'

// Store exports (for advanced integration)
export { useDocumentStore } from '@/store/documentStore'

// Constants and defaults
export const DEFAULT_CONFIG: Partial<EmbedConfig> = {
  theme: 'auto',
  features: {
    enableDriftDetection: true,
    enableAutoSave: false,
    enablePreview: true,
    enableMetadataValidation: true
  }
}

export const DOCUMENT_TYPES = [
  'microservice',
  'api-endpoint', 
  'business-logic',
  'system-architecture',
  'database-schema',
  'configuration',
  'deployment',
  'security-policy'
] as const

// Version information
export const VERSION = '1.0.0'

// Quick setup function for common use cases
export function createDocumentManager(config: EmbedConfig) {
  return new DocumentManagerEmbed()
}