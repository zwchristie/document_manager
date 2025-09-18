import axios, { AxiosInstance } from 'axios'
import type {
  SearchQuery,
  SearchResult,
  ExistingDocument,
  DriftAnalysis,
  DriftChange,
  EnrichedDocument,
  ApiResponse,
  DocumentContent
} from '@/types'

export class QAService {
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
        console.log(`[QA] Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('[QA] Request error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[QA] Response: ${response.status} ${response.statusText}`)
        return response
      },
      (error) => {
        console.error('[QA] Response error:', error.response?.data || error.message)
        return Promise.reject(this.handleApiError(error))
      }
    )
  }

  private handleApiError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response
      switch (status) {
        case 400:
          return new Error(`Invalid search query: ${data.message || 'Bad request'}`)
        case 401:
          return new Error('Authentication failed: Invalid API key')
        case 404:
          return new Error('Q&A endpoint not found')
        case 429:
          return new Error('Rate limit exceeded: Too many search requests')
        case 500:
          return new Error('Q&A service error: Internal server error')
        default:
          return new Error(`Q&A service error: ${data.message || `HTTP ${status}`}`)
      }
    } else if (error.request) {
      return new Error('Network error: Unable to reach Q&A service')
    } else {
      return new Error(`Request setup error: ${error.message}`)
    }
  }

  async searchExisting(query: SearchQuery): Promise<SearchResult> {
    try {
      const response = await this.client.post<ApiResponse<SearchResult>>(
        '/search',
        {
          query: query.query,
          filters: {
            documentType: query.documentType,
            tags: query.tags,
          },
          limit: query.limit || 10,
          threshold: query.threshold || 0.7
        }
      )

      if (!response.data.success || !response.data.data) {
        throw new Error('Search failed: Invalid response')
      }

      return response.data.data
    } catch (error) {
      console.error('[QA] Search failed:', error)
      throw error
    }
  }

  async searchByContent(content: string, documentType?: string): Promise<ExistingDocument[]> {
    const query: SearchQuery = {
      query: this.extractSearchTerms(content),
      documentType: documentType as any,
      limit: 5,
      threshold: 0.6
    }

    const result = await this.searchExisting(query)
    return result.documents
  }

  private extractSearchTerms(content: string): string {
    // Extract key terms from content for search
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)

    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that',
      'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
      'she', 'it', 'they', 'them', 'their', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can'
    ])

    const keywords = words
      .filter(word => !stopWords.has(word))
      .slice(0, 10) // Limit to top 10 keywords

    return keywords.join(' ')
  }

  async detectDrift(existing: EnrichedDocument, newDoc: EnrichedDocument): Promise<DriftAnalysis> {
    try {
      // Use API endpoint for sophisticated drift detection if available
      const response = await this.client.post<ApiResponse<DriftAnalysis>>(
        '/detect-drift',
        {
          existing: existing,
          new: newDoc
        }
      )

      if (response.data.success && response.data.data) {
        return response.data.data
      }
    } catch (error) {
      console.warn('[QA] API drift detection failed, falling back to local analysis:', error)
    }

    // Fallback to local drift detection
    return this.performLocalDriftDetection(existing, newDoc)
  }

  private performLocalDriftDetection(
    existing: EnrichedDocument,
    newDoc: EnrichedDocument
  ): DriftAnalysis {
    const changes: DriftChange[] = []

    // Compare titles
    if (existing.enrichedContent.title !== newDoc.enrichedContent.title) {
      changes.push({
        section: 'title',
        type: 'modification',
        oldValue: existing.enrichedContent.title,
        newValue: newDoc.enrichedContent.title,
        significance: 'medium'
      })
    }

    // Compare descriptions
    const descriptionSimilarity = this.calculateSimilarity(
      existing.enrichedContent.description,
      newDoc.enrichedContent.description
    )
    
    if (descriptionSimilarity < 0.8) {
      changes.push({
        section: 'description',
        type: 'modification',
        oldValue: existing.enrichedContent.description,
        newValue: newDoc.enrichedContent.description,
        significance: descriptionSimilarity < 0.5 ? 'high' : 'medium'
      })
    }

    // Compare sections
    const existingSections = new Map(
      existing.enrichedContent.sections.map(s => [s.title, s])
    )
    const newSections = new Map(
      newDoc.enrichedContent.sections.map(s => [s.title, s])
    )

    // Check for deleted sections
    for (const [title, section] of existingSections) {
      if (!newSections.has(title)) {
        changes.push({
          section: `sections.${title}`,
          type: 'deletion',
          oldValue: section.content,
          significance: 'medium'
        })
      }
    }

    // Check for new sections
    for (const [title, section] of newSections) {
      if (!existingSections.has(title)) {
        changes.push({
          section: `sections.${title}`,
          type: 'addition',
          newValue: section.content,
          significance: 'medium'
        })
      }
    }

    // Check for modified sections
    for (const [title, newSection] of newSections) {
      const existingSection = existingSections.get(title)
      if (existingSection) {
        const sectionSimilarity = this.calculateSimilarity(
          existingSection.content,
          newSection.content
        )
        
        if (sectionSimilarity < 0.8) {
          changes.push({
            section: `sections.${title}`,
            type: 'modification',
            oldValue: existingSection.content,
            newValue: newSection.content,
            significance: sectionSimilarity < 0.5 ? 'high' : 'medium'
          })
        }
      }
    }

    const hasChanges = changes.length > 0
    const highImpactChanges = changes.filter(c => c.significance === 'high').length
    const confidence = this.calculateDriftConfidence(changes)

    let recommendation: DriftAnalysis['recommendation'] = 'create-new'
    
    if (!hasChanges) {
      recommendation = 'create-new' // Identical content, probably create new
    } else if (highImpactChanges > 2) {
      recommendation = 'manual-review'
    } else if (changes.length <= 3) {
      recommendation = 'update-existing'
    } else {
      recommendation = 'manual-review'
    }

    return {
      hasChanges,
      confidence,
      changes,
      recommendation
    }
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for text comparison
    const set1 = new Set(text1.toLowerCase().split(/\s+/))
    const set2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return union.size === 0 ? 0 : intersection.size / union.size
  }

  private calculateDriftConfidence(changes: DriftChange[]): number {
    if (changes.length === 0) return 1.0

    // Base confidence decreases with number of changes
    let confidence = Math.max(0.3, 1.0 - (changes.length * 0.1))

    // Adjust based on significance of changes
    const highImpact = changes.filter(c => c.significance === 'high').length
    const mediumImpact = changes.filter(c => c.significance === 'medium').length
    
    confidence -= (highImpact * 0.2) + (mediumImpact * 0.1)

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  async similarity(doc1: EnrichedDocument, doc2: EnrichedDocument): Promise<number> {
    // Combine multiple similarity metrics
    const titleSim = this.calculateSimilarity(
      doc1.enrichedContent.title,
      doc2.enrichedContent.title
    )
    
    const descSim = this.calculateSimilarity(
      doc1.enrichedContent.description,
      doc2.enrichedContent.description
    )

    const purposeSim = this.calculateSimilarity(
      doc1.enrichedContent.purpose,
      doc2.enrichedContent.purpose
    )

    // Weighted average (description gets highest weight)
    return (titleSim * 0.2) + (descSim * 0.6) + (purposeSim * 0.2)
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