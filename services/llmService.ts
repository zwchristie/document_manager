import axios, { AxiosInstance } from 'axios'
import type {
  DocumentInput,
  EnrichedDocument,
  LLMRequest,
  LLMResponse,
  PromptTemplate,
  ApiResponse,
  DocumentType
} from '@/types'

export class LLMService {
  private client: AxiosInstance
  private baseURL: string
  private apiKey?: string

  constructor(baseURL: string, apiKey?: string) {
    this.baseURL = baseURL
    this.apiKey = apiKey
    this.client = axios.create({
      baseURL,
      timeout: 120000, // 2 minutes for LLM processing
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` })
      }
    })

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[LLM] Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('[LLM] Request error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[LLM] Response: ${response.status} ${response.statusText}`)
        return response
      },
      (error) => {
        console.error('[LLM] Response error:', error.response?.data || error.message)
        return Promise.reject(this.handleApiError(error))
      }
    )
  }

  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          return new Error(`Invalid request: ${data.message || 'Bad request'}`)
        case 401:
          return new Error('Authentication failed: Invalid API key')
        case 403:
          return new Error('Access forbidden: Insufficient permissions')
        case 429:
          return new Error('Rate limit exceeded: Too many requests')
        case 500:
          return new Error('LLM service error: Internal server error')
        default:
          return new Error(`LLM service error: ${data.message || `HTTP ${status}`}`)
      }
    } else if (error.request) {
      return new Error('Network error: Unable to reach LLM service')
    } else {
      return new Error(`Request setup error: ${error.message}`)
    }
  }

  async enrichDocument(
    input: DocumentInput,
    template?: PromptTemplate
  ): Promise<EnrichedDocument> {
    try {
      const prompt = this.generatePrompt(input, template)
      const llmRequest: LLMRequest = {
        prompt,
        systemPrompt: template?.systemPrompt || this.getDefaultSystemPrompt(input.type),
        temperature: 0.3,
        maxTokens: 4000
      }

      const response = await this.client.post<ApiResponse<LLMResponse>>(
        '/enrich',
        llmRequest
      )

      if (!response.data.success || !response.data.data) {
        throw new Error('Failed to enrich document: Invalid response')
      }

      const llmResponse = response.data.data
      return this.parseEnrichedDocument(input, llmResponse)
    } catch (error) {
      console.error('[LLM] Document enrichment failed:', error)
      throw error
    }
  }

  generatePrompt(input: DocumentInput, template?: PromptTemplate): string {
    if (template) {
      return this.applyTemplate(template, input)
    }

    // Default prompt generation based on document type
    const basePrompt = this.getDefaultPrompt(input.type)
    return `${basePrompt}

## Input Content:
${input.content}

## Metadata:
${JSON.stringify(input.metadata, null, 2)}

Please provide a comprehensive, structured documentation following the expected format.`
  }

  private applyTemplate(template: PromptTemplate, input: DocumentInput): string {
    let prompt = template.userPromptTemplate

    // Replace template variables
    prompt = prompt.replace(/\{\{content\}\}/g, input.content)
    prompt = prompt.replace(/\{\{type\}\}/g, input.type)
    prompt = prompt.replace(/\{\{metadata\}\}/g, JSON.stringify(input.metadata, null, 2))

    // Replace metadata-specific variables
    if (input.metadata.serviceName) {
      prompt = prompt.replace(/\{\{serviceName\}\}/g, input.metadata.serviceName)
    }
    if (input.metadata.dependencies) {
      prompt = prompt.replace(/\{\{dependencies\}\}/g, input.metadata.dependencies.join(', '))
    }

    return prompt
  }

  private getDefaultSystemPrompt(documentType: DocumentType): string {
    const basePrompt = `You are a technical documentation expert specializing in creating comprehensive, structured documentation for software systems. Your goal is to transform natural language descriptions into well-organized, detailed documentation that will be used in a RAG knowledge base.

Always respond with valid JSON following the specified schema. Ensure all sections are relevant and provide actionable information.`

    const typeSpecificPrompts = {
      'microservice': `Focus on service architecture, APIs, dependencies, deployment, and operational aspects.`,
      'api-endpoint': `Focus on request/response formats, authentication, error handling, and usage examples.`,
      'business-logic': `Focus on business rules, decision flows, data transformations, and business context.`,
      'system-architecture': `Focus on component relationships, data flow, scalability, and design decisions.`,
      'database-schema': `Focus on table structures, relationships, constraints, and data integrity.`,
      'configuration': `Focus on configuration parameters, environment-specific settings, and deployment options.`,
      'deployment': `Focus on deployment procedures, infrastructure requirements, and operational considerations.`,
      'security-policy': `Focus on security controls, compliance requirements, and risk mitigation strategies.`
    }

    return `${basePrompt}\n\n${typeSpecificPrompts[documentType] || 'Focus on clear structure and comprehensive coverage of the topic.'}`
  }

  private getDefaultPrompt(documentType: DocumentType): string {
    const prompts = {
      'microservice': `Create comprehensive microservice documentation including:
- Service overview and purpose
- API endpoints and contracts
- Dependencies and integrations
- Configuration and environment variables
- Deployment and operational procedures
- Error handling and troubleshooting`,

      'api-endpoint': `Create detailed API endpoint documentation including:
- Endpoint purpose and functionality
- Request/response formats and examples
- Authentication and authorization
- Error codes and handling
- Rate limiting and constraints
- Usage examples and best practices`,

      'business-logic': `Create comprehensive business logic documentation including:
- Business purpose and context
- Decision rules and workflows
- Data transformations and validations
- Business constraints and assumptions
- Related processes and dependencies
- Examples and edge cases`,

      'system-architecture': `Create detailed system architecture documentation including:
- System overview and components
- Component relationships and interactions
- Data flow and communication patterns
- Scalability and performance considerations
- Technology stack and design decisions
- Deployment architecture`,

      'database-schema': `Create comprehensive database schema documentation including:
- Schema overview and purpose
- Table structures and relationships
- Constraints and indexes
- Data types and validation rules
- Migration and versioning strategy
- Performance considerations`,

      'configuration': `Create detailed configuration documentation including:
- Configuration overview and purpose
- Parameter descriptions and defaults
- Environment-specific variations
- Validation rules and constraints
- Security considerations
- Examples and best practices`,

      'deployment': `Create comprehensive deployment documentation including:
- Deployment overview and strategy
- Infrastructure requirements
- Step-by-step procedures
- Environment configuration
- Monitoring and validation
- Rollback procedures`,

      'security-policy': `Create detailed security policy documentation including:
- Policy overview and scope
- Security controls and measures
- Compliance requirements
- Risk assessment and mitigation
- Implementation guidelines
- Monitoring and audit procedures`
    }

    return prompts[documentType] || 'Create comprehensive technical documentation for the provided content.'
  }

  private parseEnrichedDocument(
    input: DocumentInput,
    llmResponse: LLMResponse
  ): EnrichedDocument {
    try {
      // Attempt to parse JSON response
      const parsed = JSON.parse(llmResponse.content)
      
      // Validate required fields
      if (!parsed.title || !parsed.description) {
        throw new Error('LLM response missing required fields (title, description)')
      }

      const now = new Date().toISOString()

      return {
        originalInput: input,
        enrichedContent: {
          title: parsed.title,
          summary: parsed.summary || parsed.description.substring(0, 200) + '...',
          description: parsed.description,
          purpose: parsed.purpose || parsed.summary || 'Purpose not specified',
          sections: parsed.sections || []
        },
        metadata: {
          ...input.metadata,
          enrichmentTimestamp: now,
          llmModel: llmResponse.model,
          confidence: this.calculateConfidence(llmResponse),
          reviewStatus: 'pending'
        },
        structuredData: parsed.structuredData || {},
        createdAt: now,
        updatedAt: now
      }
    } catch (error) {
      console.error('[LLM] Failed to parse enriched document:', error)
      
      // Fallback: create document from raw text response
      return this.createFallbackDocument(input, llmResponse)
    }
  }

  private createFallbackDocument(
    input: DocumentInput,
    llmResponse: LLMResponse
  ): EnrichedDocument {
    const now = new Date().toISOString()
    const lines = llmResponse.content.split('\n').filter(line => line.trim())
    
    return {
      originalInput: input,
      enrichedContent: {
        title: input.metadata.serviceName || 'Untitled Document',
        summary: lines[0] || 'No summary available',
        description: llmResponse.content,
        purpose: 'Purpose extracted from content',
        sections: [{
          title: 'Content',
          content: llmResponse.content,
          type: 'overview'
        }]
      },
      metadata: {
        ...input.metadata,
        enrichmentTimestamp: now,
        llmModel: llmResponse.model,
        confidence: 0.5, // Lower confidence for fallback
        reviewStatus: 'pending'
      },
      structuredData: {},
      createdAt: now,
      updatedAt: now
    }
  }

  private calculateConfidence(response: LLMResponse): number {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.8 // Base confidence
    
    try {
      const parsed = JSON.parse(response.content)
      
      // Boost confidence for structured responses
      if (parsed.sections && Array.isArray(parsed.sections)) {
        confidence += 0.1
      }
      
      if (parsed.title && parsed.description) {
        confidence += 0.05
      }
      
      // Adjust based on finish reason
      if (response.finishReason === 'stop') {
        confidence += 0.05
      } else if (response.finishReason === 'length') {
        confidence -= 0.1
      }
      
    } catch {
      // Reduce confidence for unparseable responses
      confidence -= 0.2
    }
    
    return Math.max(0, Math.min(1, confidence))
  }

  async validateResponse(response: LLMResponse): Promise<boolean> {
    try {
      // Check if response is valid JSON
      const parsed = JSON.parse(response.content)
      
      // Check required fields
      const requiredFields = ['title', 'description']
      const hasRequiredFields = requiredFields.every(field => 
        parsed[field] && typeof parsed[field] === 'string'
      )
      
      return hasRequiredFields
    } catch {
      return false
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health')
      return response.status === 200
    } catch {
      return false
    }
  }
}