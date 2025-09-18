import axios, { AxiosInstance } from 'axios'
import type {
  EnrichedDocument,
  ApiResponse,
  DocumentInput
} from '@/types'

export interface SaveResult {
  success: boolean
  documentId: string
  version?: number
  message?: string
}

export interface UpdateResult {
  success: boolean
  documentId: string
  version: number
  previousVersion: number
  message?: string
}

export class DocumentService {
  private client: AxiosInstance
  private baseURL: string
  private apiKey?: string

  constructor(baseURL: string, apiKey?: string) {
    this.baseURL = baseURL
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` })
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[DOC] Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('[DOC] Request error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[DOC] Response: ${response.status} ${response.statusText}`)
        return response
      },
      (error) => {
        console.error('[DOC] Response error:', error.response?.data || error.message)
        return Promise.reject(this.handleApiError(error))
      }
    )
  }

  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          return new Error(`Invalid document data: ${data.message || 'Bad request'}`)
        case 401:
          return new Error('Authentication failed: Invalid API key')
        case 403:
          return new Error('Access forbidden: Insufficient permissions')
        case 404:
          return new Error('Document not found')
        case 409:
          return new Error('Document conflict: Version mismatch')
        case 422:
          return new Error(`Validation error: ${data.message || 'Invalid document format'}`)
        case 429:
          return new Error('Rate limit exceeded: Too many requests')
        case 500:
          return new Error('Document service error: Internal server error')
        default:
          return new Error(`Document service error: ${data.message || `HTTP ${status}`}`)
      }
    } else if (error.request) {
      return new Error('Network error: Unable to reach document service')
    } else {
      return new Error(`Request setup error: ${error.message}`)
    }
  }

  async save(document: EnrichedDocument): Promise<SaveResult> {
    try {
      // Validate document before saving
      this.validateDocument(document)

      const response = await this.client.post<ApiResponse<SaveResult>>(
        '/documents',
        {
          document,
          metadata: {
            source: 'document-manager',
            timestamp: new Date().toISOString()
          }
        }
      )

      if (!response.data.success || !response.data.data) {
        throw new Error('Failed to save document: Invalid response')
      }

      console.log(`[DOC] Document saved successfully: ${response.data.data.documentId}`)
      return response.data.data
    } catch (error) {
      console.error('[DOC] Save failed:', error)
      throw error
    }
  }

  async update(id: string, document: EnrichedDocument): Promise<UpdateResult> {
    try {
      // Validate document before updating
      this.validateDocument(document)

      const response = await this.client.put<ApiResponse<UpdateResult>>(
        `/documents/${id}`,
        {
          document,
          metadata: {
            source: 'document-manager',
            timestamp: new Date().toISOString(),
            updateReason: 'drift-resolution'
          }
        }
      )

      if (!response.data.success || !response.data.data) {
        throw new Error('Failed to update document: Invalid response')
      }

      console.log(`[DOC] Document updated successfully: ${id}`)
      return response.data.data
    } catch (error) {
      console.error('[DOC] Update failed:', error)
      throw error
    }
  }

  async getById(id: string): Promise<EnrichedDocument> {
    try {
      const response = await this.client.get<ApiResponse<EnrichedDocument>>(
        `/documents/${id}`
      )

      if (!response.data.success || !response.data.data) {
        throw new Error('Failed to retrieve document: Invalid response')
      }

      return response.data.data
    } catch (error) {
      console.error('[DOC] Retrieval failed:', error)
      throw error
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const response = await this.client.delete<ApiResponse<{ deleted: boolean }>>(
        `/documents/${id}`
      )

      return response.data.success && response.data.data?.deleted === true
    } catch (error) {
      console.error('[DOC] Delete failed:', error)
      throw error
    }
  }

  async list(filters?: {
    type?: string
    tags?: string[]
    limit?: number
    offset?: number
  }): Promise<{ documents: EnrichedDocument[], total: number }> {
    try {
      const params = new URLSearchParams()
      
      if (filters?.type) params.append('type', filters.type)
      if (filters?.tags) filters.tags.forEach(tag => params.append('tags', tag))
      if (filters?.limit) params.append('limit', filters.limit.toString())
      if (filters?.offset) params.append('offset', filters.offset.toString())

      const response = await this.client.get<ApiResponse<{
        documents: EnrichedDocument[]
        total: number
      }>>(`/documents?${params.toString()}`)

      if (!response.data.success || !response.data.data) {
        throw new Error('Failed to list documents: Invalid response')
      }

      return response.data.data
    } catch (error) {
      console.error('[DOC] List failed:', error)
      throw error
    }
  }

  private validateDocument(document: EnrichedDocument): void {
    const errors: string[] = []

    // Required fields validation
    if (!document.enrichedContent?.title?.trim()) {
      errors.push('Document title is required')
    }

    if (!document.enrichedContent?.description?.trim()) {
      errors.push('Document description is required')
    }

    if (!document.originalInput?.content?.trim()) {
      errors.push('Original input content is required')
    }

    if (!document.originalInput?.type) {
      errors.push('Document type is required')
    }

    // Content validation
    if (document.enrichedContent?.title && document.enrichedContent.title.length > 200) {
      errors.push('Document title must be 200 characters or less')
    }

    if (document.enrichedContent?.description && document.enrichedContent.description.length > 5000) {
      errors.push('Document description must be 5000 characters or less')
    }

    // Sections validation
    if (document.enrichedContent?.sections) {
      document.enrichedContent.sections.forEach((section, index) => {
        if (!section.title?.trim()) {
          errors.push(`Section ${index + 1} title is required`)
        }
        if (!section.content?.trim()) {
          errors.push(`Section ${index + 1} content is required`)
        }
        if (section.title && section.title.length > 100) {
          errors.push(`Section ${index + 1} title must be 100 characters or less`)
        }
      })
    }

    // Metadata validation
    if (document.metadata?.serviceName && !/^[a-zA-Z0-9\-_]+$/.test(document.metadata.serviceName)) {
      errors.push('Service name can only contain alphanumeric characters, hyphens, and underscores')
    }

    if (document.metadata?.version && !/^\d+\.\d+\.\d+/.test(document.metadata.version)) {
      errors.push('Version must follow semantic versioning format (e.g., 1.0.0)')
    }

    if (document.metadata?.tags) {
      document.metadata.tags.forEach((tag, index) => {
        if (!/^[a-zA-Z0-9\-_]+$/.test(tag)) {
          errors.push(`Tag ${index + 1} can only contain alphanumeric characters, hyphens, and underscores`)
        }
      })
    }

    if (errors.length > 0) {
      throw new Error(`Document validation failed:\n${errors.join('\n')}`)
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

  // Utility method to prepare document for storage
  prepareForStorage(document: EnrichedDocument): EnrichedDocument {
    const now = new Date().toISOString()
    
    return {
      ...document,
      updatedAt: now,
      // Ensure IDs are properly set
      id: document.id || this.generateDocumentId(),
      // Clean up any undefined values
      metadata: {
        ...document.metadata,
        enrichmentTimestamp: document.metadata.enrichmentTimestamp || now
      }
    }
  }

  private generateDocumentId(): string {
    // Generate a simple ID - in production, this would be handled by the backend
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}