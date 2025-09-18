import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  DocumentManagerState,
  DocumentInput,
  EnrichedDocument,
  ExistingDocument,
  DriftAnalysis,
  DriftResolution,
  ProcessingStatus,
  ProcessingStep,
  EmbedConfig
} from '@/types'
import { LLMService } from '@/services/llmService'
import { QAService } from '@/services/qaService'
import { DocumentService } from '@/services/documentService'
import { PromptEngineering } from '@/utils/promptEngineering'
import { DriftDetection } from '@/utils/driftDetection'

interface DocumentStoreActions {
  // Configuration
  initialize: (config: EmbedConfig) => void
  updateConfig: (config: Partial<EmbedConfig>) => void
  
  // Document processing
  processDocument: (input: DocumentInput) => Promise<void>
  previewEnrichment: (input: DocumentInput) => Promise<void>
  
  // Drift resolution
  resolveDrift: (resolution: DriftResolution) => Promise<void>
  skipDriftCheck: () => void
  
  // State management
  setActiveStep: (step: ProcessingStep) => void
  addError: (error: string) => void
  clearErrors: () => void
  reset: () => void
  
  // Service health checks
  checkServiceHealth: () => Promise<{ llm: boolean; qa: boolean; storage: boolean }>
}

type DocumentStore = DocumentManagerState & DocumentStoreActions

const initialState: DocumentManagerState = {
  currentDocument: null,
  enrichedDocument: null,
  processingStatus: 'idle',
  existingDocuments: [],
  driftAnalysis: null,
  resolutionRequired: false,
  activeStep: 'input',
  errors: [],
  isLoading: false,
  config: {
    apiEndpoints: {
      llm: '',
      qa: '',
      storage: ''
    },
    theme: 'auto',
    features: {
      enableDriftDetection: true,
      enableAutoSave: false,
      enablePreview: true,
      enableMetadataValidation: true
    }
  }
}

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    initialize: (config: EmbedConfig) => {
      set({ config: { ...get().config, ...config } })
      console.log('[Store] Initialized with config:', config)
    },

    updateConfig: (configUpdate: Partial<EmbedConfig>) => {
      set({ config: { ...get().config, ...configUpdate } })
    },

    processDocument: async (input: DocumentInput) => {
      const state = get()
      
      try {
        set({ 
          currentDocument: input,
          processingStatus: 'enriching',
          activeStep: 'enriching',
          isLoading: true,
          errors: []
        })

        // Call step change callback
        state.config.callbacks?.onStepChange?.('enriching')

        // Initialize services
        const llmService = new LLMService(state.config.apiEndpoints.llm)
        const qaService = new QAService(state.config.apiEndpoints.qa)
        
        // Generate enriched document
        const template = state.config.customPromptTemplates?.find(
          t => t.documentType === input.type
        ) || PromptEngineering.getTemplate(input.type)
        
        const enrichedDoc = await llmService.enrichDocument(input, template)
        
        set({ 
          enrichedDocument: enrichedDoc,
          processingStatus: 'searching',
          activeStep: 'preview'
        })

        // Check for existing documents if drift detection is enabled
        if (state.config.features?.enableDriftDetection) {
          set({ processingStatus: 'searching' })
          
          const existingDocs = await qaService.searchByContent(
            input.content,
            input.type
          )

          set({ existingDocuments: existingDocs })

          // Analyze drift if similar documents found
          if (existingDocs.length > 0) {
            set({ processingStatus: 'analyzing-drift' })
            
            const mostSimilar = existingDocs[0]
            const driftAnalysis = await DriftDetection.analyzeDocuments(
              mostSimilar as EnrichedDocument,
              enrichedDoc
            )

            set({ driftAnalysis })

            // Call drift detection callback
            state.config.callbacks?.onDriftDetected?.(driftAnalysis)

            if (driftAnalysis.hasChanges && driftAnalysis.recommendation !== 'create-new') {
              set({ 
                resolutionRequired: true,
                activeStep: 'drift-resolution',
                processingStatus: 'idle',
                isLoading: false
              })
              return
            }
          }
        }

        // Auto-save if enabled
        if (state.config.features?.enableAutoSave) {
          await get().saveDocument()
        } else {
          set({ 
            processingStatus: 'idle',
            activeStep: 'complete',
            isLoading: false
          })
        }

      } catch (error) {
        console.error('[Store] Document processing failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        
        set({
          processingStatus: 'error',
          isLoading: false,
          errors: [...state.errors, errorMessage]
        })

        // Call error callback
        state.config.callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage))
      }
    },

    previewEnrichment: async (input: DocumentInput) => {
      const state = get()
      
      try {
        set({ 
          currentDocument: input,
          processingStatus: 'enriching',
          isLoading: true,
          errors: []
        })

        const llmService = new LLMService(state.config.apiEndpoints.llm)
        const template = state.config.customPromptTemplates?.find(
          t => t.documentType === input.type
        ) || PromptEngineering.getTemplate(input.type)
        
        const enrichedDoc = await llmService.enrichDocument(input, template)
        
        set({ 
          enrichedDocument: enrichedDoc,
          processingStatus: 'idle',
          activeStep: 'preview',
          isLoading: false
        })

      } catch (error) {
        console.error('[Store] Preview enrichment failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Preview failed'
        
        set({
          processingStatus: 'error',
          isLoading: false,
          errors: [...state.errors, errorMessage]
        })
      }
    },

    resolveDrift: async (resolution: DriftResolution) => {
      const state = get()
      
      if (!state.enrichedDocument || !state.driftAnalysis) {
        throw new Error('No drift analysis available')
      }

      try {
        set({ processingStatus: 'saving', isLoading: true })

        const documentService = new DocumentService(state.config.apiEndpoints.storage)

        switch (resolution.action) {
          case 'keep-existing':
            // Don't save, just complete
            set({ 
              processingStatus: 'idle',
              activeStep: 'complete',
              isLoading: false
            })
            break

          case 'update':
            if (!resolution.targetDocumentId) {
              throw new Error('Target document ID required for update')
            }
            
            await documentService.update(resolution.targetDocumentId, state.enrichedDocument)
            set({ 
              processingStatus: 'idle',
              activeStep: 'complete',
              isLoading: false
            })
            break

          case 'create-new':
            await get().saveDocument()
            break

          case 'merge':
            if (!resolution.targetDocumentId || !resolution.mergeStrategy) {
              throw new Error('Target document ID and merge strategy required')
            }

            const existingDoc = await documentService.getById(resolution.targetDocumentId)
            const mergedDoc = DriftDetection.createMergePreview(
              existingDoc,
              state.enrichedDocument,
              resolution.mergeStrategy.conflictResolution
            )

            await documentService.update(resolution.targetDocumentId, mergedDoc)
            set({ 
              enrichedDocument: mergedDoc,
              processingStatus: 'idle',
              activeStep: 'complete',
              isLoading: false
            })
            break
        }

        // Call document saved callback
        if (state.enrichedDocument) {
          state.config.callbacks?.onDocumentSaved?.(state.enrichedDocument)
        }

      } catch (error) {
        console.error('[Store] Drift resolution failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Resolution failed'
        
        set({
          processingStatus: 'error',
          isLoading: false,
          errors: [...state.errors, errorMessage]
        })

        state.config.callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage))
      }
    },

    skipDriftCheck: () => {
      set({ 
        resolutionRequired: false,
        activeStep: 'complete',
        processingStatus: 'idle'
      })
    },

    saveDocument: async () => {
      const state = get()
      
      if (!state.enrichedDocument) {
        throw new Error('No document to save')
      }

      try {
        set({ processingStatus: 'saving' })

        const documentService = new DocumentService(state.config.apiEndpoints.storage)
        const result = await documentService.save(state.enrichedDocument)

        set({ 
          processingStatus: 'idle',
          activeStep: 'complete',
          enrichedDocument: {
            ...state.enrichedDocument,
            id: result.documentId
          }
        })

        // Call document saved callback
        state.config.callbacks?.onDocumentSaved?.(state.enrichedDocument)

        console.log('[Store] Document saved successfully:', result.documentId)

      } catch (error) {
        console.error('[Store] Save failed:', error)
        throw error
      }
    },

    setActiveStep: (step: ProcessingStep) => {
      set({ activeStep: step })
      get().config.callbacks?.onStepChange?.(step)
    },

    addError: (error: string) => {
      set({ errors: [...get().errors, error] })
    },

    clearErrors: () => {
      set({ errors: [] })
    },

    reset: () => {
      set({
        ...initialState,
        config: get().config // Preserve config
      })
      console.log('[Store] State reset')
    },

    checkServiceHealth: async () => {
      const state = get()
      
      try {
        const [llmService, qaService, documentService] = [
          new LLMService(state.config.apiEndpoints.llm),
          new QAService(state.config.apiEndpoints.qa),
          new DocumentService(state.config.apiEndpoints.storage)
        ]

        const [llmHealth, qaHealth, storageHealth] = await Promise.allSettled([
          llmService.testConnection(),
          qaService.testConnection(),
          documentService.testConnection()
        ])

        return {
          llm: llmHealth.status === 'fulfilled' && llmHealth.value,
          qa: qaHealth.status === 'fulfilled' && qaHealth.value,
          storage: storageHealth.status === 'fulfilled' && storageHealth.value
        }
      } catch {
        return { llm: false, qa: false, storage: false }
      }
    }
  }))
)

// Selector hooks for better performance
export const useCurrentDocument = () => useDocumentStore(state => state.currentDocument)
export const useEnrichedDocument = () => useDocumentStore(state => state.enrichedDocument)
export const useProcessingStatus = () => useDocumentStore(state => state.processingStatus)
export const useActiveStep = () => useDocumentStore(state => state.activeStep)
export const useDriftAnalysis = () => useDocumentStore(state => state.driftAnalysis)
export const useErrors = () => useDocumentStore(state => state.errors)
export const useIsLoading = () => useDocumentStore(state => state.isLoading)