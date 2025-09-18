# Architecture Design

## Application Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Host Application                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          Document Manager Micro Frontend           │ │
│  │                                                     │ │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │ │
│  │  │   UI Components │  │    State Management     │   │ │
│  │  │                 │  │     (Zustand Store)     │   │ │
│  │  │ - DocumentForm  │  │                         │   │ │
│  │  │ - DriftResolver │  │ - documentState         │   │ │
│  │  │ - StatusPanel   │  │ - apiState              │   │ │
│  │  └─────────────────┘  │ - driftDetectionState   │   │ │
│  │                       └─────────────────────────┘   │ │
│  │                                                     │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │                Service Layer                    │ │ │
│  │  │                                                 │ │ │
│  │  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │ │ │
│  │  │ │LLM Service  │ │Q&A Service  │ │Doc Service  │ │ │ │
│  │  │ │             │ │             │ │             │ │ │ │
│  │  │ │- enrich()   │ │- search()   │ │- save()     │ │ │ │
│  │  │ │- prompt()   │ │- compare()  │ │- update()   │ │ │ │
│  │  │ └─────────────┘ └─────────────┘ └─────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                                                     │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │                Utility Layer                    │ │ │
│  │  │                                                 │ │ │
│  │  │ - promptEngineering.ts                          │ │ │
│  │  │ - driftDetection.ts                             │ │ │
│  │  │ - documentValidator.ts                          │ │ │
│  │  │ - microFrontendBridge.ts                        │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Document Input Component (`DocumentForm`)
- Natural language input field
- Documentation type selector (microservice, API, business logic, etc.)
- Metadata input fields (service name, dependencies, etc.)
- Submit and preview functionality

### 2. Drift Resolution Component (`DriftResolver`)
- Side-by-side comparison view
- Highlighting of differences
- User decision interface (keep existing, update, merge)
- Preview of final documentation

### 3. Status Panel Component (`StatusPanel`)
- Processing status indicators
- Error handling display
- Success confirmations
- Progress tracking

## Service Layer

### 1. LLM Service (`services/llmService.ts`)
```typescript
interface LLMService {
  enrichDocument(input: DocumentInput): Promise<EnrichedDocument>
  generatePrompt(input: DocumentInput, template: PromptTemplate): string
  validateResponse(response: LLMResponse): boolean
}
```

### 2. Q&A Service (`services/qaService.ts`)
```typescript
interface QAService {
  searchExisting(query: string): Promise<ExistingDocument[]>
  detectDrift(existing: Document, new: Document): Promise<DriftAnalysis>
  similarity(doc1: Document, doc2: Document): number
}
```

### 3. Document Service (`services/documentService.ts`)
```typescript
interface DocumentService {
  save(document: EnrichedDocument): Promise<SaveResult>
  update(id: string, document: EnrichedDocument): Promise<UpdateResult>
  getById(id: string): Promise<Document>
}
```

## State Management Architecture

### Zustand Store Structure
```typescript
interface DocumentManagerState {
  // Document processing state
  currentDocument: DocumentInput | null
  enrichedDocument: EnrichedDocument | null
  processingStatus: 'idle' | 'enriching' | 'checking' | 'saving'
  
  // Drift detection state
  existingDocuments: ExistingDocument[]
  driftAnalysis: DriftAnalysis | null
  resolutionRequired: boolean
  
  // UI state
  activeStep: 'input' | 'preview' | 'drift-resolution' | 'complete'
  errors: string[]
  
  // Actions
  processDocument: (input: DocumentInput) => Promise<void>
  resolveDrift: (decision: DriftResolution) => Promise<void>
  reset: () => void
}
```

## Data Flow

1. **User Input** → DocumentForm captures natural language + metadata
2. **Enrichment** → LLM Service processes input with engineered prompts
3. **Drift Check** → Q&A Service searches for existing similar documents
4. **Analysis** → If matches found, drift detection compares content
5. **Resolution** → If drift detected, user resolves via DriftResolver
6. **Storage** → Document Service saves final approved documentation

## Micro Frontend Integration

### Embedding Interface
```typescript
interface DocumentManagerEmbed {
  mount(container: HTMLElement, config: EmbedConfig): void
  unmount(): void
  onDocumentSaved(callback: (document: EnrichedDocument) => void): void
  onError(callback: (error: Error) => void): void
}
```

### Configuration Options
```typescript
interface EmbedConfig {
  apiEndpoints: {
    llm: string
    qa: string
    storage: string
  }
  theme?: 'light' | 'dark' | 'auto'
  defaultDocumentType?: DocumentType
  customPromptTemplates?: PromptTemplate[]
}
```

## Prompt Engineering Strategy

### Template Structure
```typescript
interface PromptTemplate {
  type: DocumentType
  systemPrompt: string
  userPromptTemplate: string
  outputSchema: JSONSchema
  examples: PromptExample[]
}
```

### Document Types Supported
- **Microservice Documentation**
- **API Endpoint Documentation**
- **Business Logic Documentation**
- **System Architecture Documentation**
- **Database Schema Documentation**

## Error Handling & Resilience

- Network failure retry logic
- LLM response validation
- Graceful degradation for offline scenarios
- User-friendly error messages
- Rollback capabilities for failed updates

## Security Considerations

- API endpoint validation
- Input sanitization
- Secure prompt injection prevention
- Rate limiting for LLM calls
- Audit logging for document changes