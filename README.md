# Document Manager Micro Frontend

A sophisticated document management micro frontend application designed to capture, enrich, and structure technical documentation for RAG (Retrieval-Augmented Generation) knowledge bases.

## 🎯 Purpose

Transform natural language descriptions into enriched, structured documentation while automatically preventing duplicates through intelligent drift detection. Perfect for enterprise environments managing 20+ interdependent modules and services.

## ✨ Key Features

- **🤖 AI-Powered Enrichment**: Leverages custom LLM endpoints to transform basic descriptions into comprehensive documentation
- **🔍 Smart Drift Detection**: Automatically identifies similar existing documentation and manages content evolution
- **🧩 Micro Frontend Architecture**: Embeds seamlessly into existing applications
- **📊 Structured Output**: Generates LLM-optimized content for RAG knowledge bases
- **🔧 Flexible Configuration**: Supports custom prompt templates and document types
- **⚡ Real-time Processing**: Provides live status updates and error handling

## 🏗️ Architecture

### Core Components

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
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Document Types Supported

- **Microservices**: Service architecture, APIs, dependencies, deployment
- **API Endpoints**: Request/response formats, authentication, error handling
- **Business Logic**: Rules, decision flows, data transformations
- **System Architecture**: Component relationships, data flow, scalability
- **Database Schema**: Table structures, relationships, constraints
- **Configuration**: Parameters, environment settings, deployment options
- **Security Policies**: Controls, compliance, risk mitigation

## 🚀 Quick Start

### Installation

```bash
npm install @company/document-manager
# or
yarn add @company/document-manager
```

### Basic Usage

```typescript
import DocumentManagerEmbed from '@company/document-manager'

// Initialize the micro frontend
const documentManager = new DocumentManagerEmbed()

// Configure and mount
await documentManager.mount(document.getElementById('container')!, {
  apiEndpoints: {
    llm: 'https://api.company.com/llm',
    qa: 'https://api.company.com/qa', 
    storage: 'https://api.company.com/storage'
  },
  theme: 'auto',
  defaultDocumentType: 'microservice',
  features: {
    enableDriftDetection: true,
    enableAutoSave: false,
    enablePreview: true,
    enableMetadataValidation: true
  },
  callbacks: {
    onDocumentSaved: (document) => {
      console.log('Document saved:', document.id)
    },
    onError: (error) => {
      console.error('Error occurred:', error.message)
    },
    onStepChange: (step) => {
      console.log('Processing step:', step)
    }
  }
})

// Event listeners
documentManager.onDocumentSaved((document) => {
  // Handle successful document creation
  updateKnowledgeBase(document)
})

documentManager.onError((error) => {
  // Handle errors
  showErrorNotification(error.message)
})

// Cleanup
// documentManager.unmount()
```

### Advanced Configuration

```typescript
import { DocumentManagerEmbed, PromptTemplate } from '@company/document-manager'

const customPrompts: PromptTemplate[] = [
  {
    id: 'custom-microservice',
    name: 'Custom Microservice Template',
    documentType: 'microservice',
    systemPrompt: 'You are an expert in our company architecture...',
    userPromptTemplate: `
      Create documentation for {{serviceName}} microservice:
      
      Content: {{content}}
      Dependencies: {{dependencies}}
      
      Include our standard sections:
      - Service Overview
      - API Contracts
      - Deployment Guide
      - Monitoring & Alerts
    `,
    outputSchema: { /* JSON schema */ },
    examples: [],
    version: '2.0'
  }
]

const config = {
  apiEndpoints: {
    llm: process.env.REACT_APP_LLM_ENDPOINT!,
    qa: process.env.REACT_APP_QA_ENDPOINT!,
    storage: process.env.REACT_APP_STORAGE_ENDPOINT!
  },
  customPromptTemplates: customPrompts,
  features: {
    enableDriftDetection: true,
    enableAutoSave: true,
    enablePreview: true,
    enableMetadataValidation: true
  }
}
```

## 📋 API Reference

### DocumentManagerEmbed

#### Methods

- `mount(container: HTMLElement, config: EmbedConfig): Promise<void>`
- `unmount(): void`
- `updateConfig(config: Partial<EmbedConfig>): void`
- `reset(): void`
- `checkHealth(): Promise<HealthStatus>`

#### Event Handlers

- `onDocumentSaved(callback): () => void`
- `onError(callback): () => void`
- `onStepChange(callback): () => void`

### Configuration Types

```typescript
interface EmbedConfig {
  apiEndpoints: {
    llm: string        // LLM enrichment endpoint
    qa: string         // Q&A search endpoint  
    storage: string    // Document storage endpoint
  }
  theme?: 'light' | 'dark' | 'auto'
  defaultDocumentType?: DocumentType
  customPromptTemplates?: PromptTemplate[]
  features?: {
    enableDriftDetection: boolean
    enableAutoSave: boolean
    enablePreview: boolean
    enableMetadataValidation: boolean
  }
  callbacks?: {
    onDocumentSaved?: (document: EnrichedDocument) => void
    onError?: (error: Error) => void
    onStepChange?: (step: ProcessingStep) => void
    onDriftDetected?: (analysis: DriftAnalysis) => void
  }
}
```

## 🔄 Document Processing Workflow

1. **Input**: User provides natural language description + metadata
2. **Enrichment**: LLM processes content using engineered prompts
3. **Preview**: User reviews enriched documentation
4. **Drift Check**: System searches for similar existing documents
5. **Analysis**: If matches found, analyzes content differences
6. **Resolution**: User decides: update existing, create new, or merge
7. **Storage**: Final document saved to knowledge base

## 🔧 Development

### Prerequisites

- Node.js 18+
- TypeScript 5+
- React 18+

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Build as library
npm run build:lib
```

### Project Structure

```
document_manager/
├── src/
│   ├── components/          # React components
│   ├── services/           # API integration services
│   ├── store/              # Zustand state management
│   └── index.ts            # Main library exports
├── components/             # Shared UI components
├── services/              # Business logic services
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
└── dev-context/           # Development documentation
```

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📦 Building & Deployment

### Library Build

```bash
npm run build:lib
```

Generates:
- `dist/document-manager.es.js` - ES modules
- `dist/document-manager.umd.js` - UMD bundle
- `dist/index.d.ts` - TypeScript definitions

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 Security Considerations

- All API endpoints should use HTTPS
- Implement proper authentication headers
- Validate and sanitize all user inputs
- Rate limit LLM API calls
- Audit log document changes
- Secure prompt injection prevention

## 🚀 Performance Optimization

- Lazy load components for faster initial render
- Implement virtual scrolling for large document lists
- Cache enriched documents locally
- Debounce search and validation calls
- Use React.memo for expensive components

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](./dev-context/)
- 🐛 [Issue Tracker](https://github.com/company/document-manager/issues)
- 💬 [Discussions](https://github.com/company/document-manager/discussions)

---

Built with ❤️ for enterprise documentation management