import { diffLines, diffWords, Change } from 'diff'
import type {
  EnrichedDocument,
  DriftAnalysis,
  DriftChange,
  DocumentSection
} from '@/types'

export class DriftDetection {
  private static readonly SIMILARITY_THRESHOLD = 0.7
  private static readonly HIGH_SIGNIFICANCE_THRESHOLD = 0.5
  private static readonly MEDIUM_SIGNIFICANCE_THRESHOLD = 0.8

  static analyzeDocuments(
    existing: EnrichedDocument,
    newDoc: EnrichedDocument,
    options: {
      threshold?: number
      ignoreMinorChanges?: boolean
      focusAreas?: string[]
    } = {}
  ): DriftAnalysis {
    const changes: DriftChange[] = []
    const threshold = options.threshold || this.SIMILARITY_THRESHOLD

    // Analyze title changes
    if (existing.enrichedContent.title !== newDoc.enrichedContent.title) {
      const titleSimilarity = this.calculateStringSimilarity(
        existing.enrichedContent.title,
        newDoc.enrichedContent.title
      )

      changes.push({
        section: 'title',
        type: 'modification',
        oldValue: existing.enrichedContent.title,
        newValue: newDoc.enrichedContent.title,
        significance: titleSimilarity < this.HIGH_SIGNIFICANCE_THRESHOLD ? 'high' : 'medium'
      })
    }

    // Analyze description changes
    const descriptionChanges = this.analyzeTextChanges(
      'description',
      existing.enrichedContent.description,
      newDoc.enrichedContent.description,
      options.ignoreMinorChanges
    )
    changes.push(...descriptionChanges)

    // Analyze purpose changes
    if (existing.enrichedContent.purpose !== newDoc.enrichedContent.purpose) {
      const purposeChanges = this.analyzeTextChanges(
        'purpose',
        existing.enrichedContent.purpose,
        newDoc.enrichedContent.purpose,
        options.ignoreMinorChanges
      )
      changes.push(...purposeChanges)
    }

    // Analyze sections
    const sectionChanges = this.analyzeSectionChanges(
      existing.enrichedContent.sections,
      newDoc.enrichedContent.sections,
      options.ignoreMinorChanges
    )
    changes.push(...sectionChanges)

    // Analyze metadata changes
    const metadataChanges = this.analyzeMetadataChanges(
      existing.metadata,
      newDoc.metadata,
      options.focusAreas
    )
    changes.push(...metadataChanges)

    // Filter out minor changes if requested
    const filteredChanges = options.ignoreMinorChanges 
      ? changes.filter(change => change.significance !== 'low')
      : changes

    const hasChanges = filteredChanges.length > 0
    const confidence = this.calculateConfidence(filteredChanges)
    const recommendation = this.generateRecommendation(filteredChanges, confidence)

    return {
      hasChanges,
      confidence,
      changes: filteredChanges,
      recommendation
    }
  }

  private static analyzeTextChanges(
    section: string,
    oldText: string,
    newText: string,
    ignoreMinor: boolean = false
  ): DriftChange[] {
    if (oldText === newText) return []

    const similarity = this.calculateStringSimilarity(oldText, newText)
    
    // Skip very minor changes if requested
    if (ignoreMinor && similarity > 0.95) return []

    const significance = this.determineSignificance(similarity)
    
    return [{
      section,
      type: 'modification',
      oldValue: oldText,
      newValue: newText,
      significance
    }]
  }

  private static analyzeSectionChanges(
    existingSections: DocumentSection[],
    newSections: DocumentSection[],
    ignoreMinor: boolean = false
  ): DriftChange[] {
    const changes: DriftChange[] = []
    
    // Create maps for easier comparison
    const existingMap = new Map(existingSections.map(s => [s.title, s]))
    const newMap = new Map(newSections.map(s => [s.title, s]))

    // Check for deleted sections
    for (const [title, section] of existingMap) {
      if (!newMap.has(title)) {
        changes.push({
          section: `sections.${title}`,
          type: 'deletion',
          oldValue: section.content,
          significance: 'medium'
        })
      }
    }

    // Check for new sections
    for (const [title, section] of newMap) {
      if (!existingMap.has(title)) {
        changes.push({
          section: `sections.${title}`,
          type: 'addition',
          newValue: section.content,
          significance: 'medium'
        })
      }
    }

    // Check for modified sections
    for (const [title, newSection] of newMap) {
      const existingSection = existingMap.get(title)
      if (existingSection && existingSection.content !== newSection.content) {
        const similarity = this.calculateStringSimilarity(
          existingSection.content,
          newSection.content
        )

        // Skip very minor changes if requested
        if (ignoreMinor && similarity > 0.95) continue

        changes.push({
          section: `sections.${title}`,
          type: 'modification',
          oldValue: existingSection.content,
          newValue: newSection.content,
          significance: this.determineSignificance(similarity)
        })
      }
    }

    return changes
  }

  private static analyzeMetadataChanges(
    existingMetadata: any,
    newMetadata: any,
    focusAreas?: string[]
  ): DriftChange[] {
    const changes: DriftChange[] = []
    const fieldsToCheck = focusAreas || [
      'serviceName', 'version', 'dependencies', 'tags', 'category', 'businessUnit'
    ]

    for (const field of fieldsToCheck) {
      const oldValue = existingMetadata[field]
      const newValue = newMetadata[field]

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          section: `metadata.${field}`,
          type: 'modification',
          oldValue: this.formatMetadataValue(oldValue),
          newValue: this.formatMetadataValue(newValue),
          significance: this.determineMetadataSignificance(field, oldValue, newValue)
        })
      }
    }

    return changes
  }

  private static formatMetadataValue(value: any): string {
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value)
    }
    return String(value || '')
  }

  private static determineMetadataSignificance(
    field: string,
    oldValue: any,
    newValue: any
  ): 'low' | 'medium' | 'high' {
    const highImpactFields = ['serviceName', 'version']
    const mediumImpactFields = ['dependencies', 'category', 'businessUnit']

    if (highImpactFields.includes(field)) return 'high'
    if (mediumImpactFields.includes(field)) return 'medium'
    return 'low'
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    // Use Jaccard similarity for text comparison
    const set1 = new Set(str1.toLowerCase().split(/\s+/))
    const set2 = new Set(str2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return union.size === 0 ? 1 : intersection.size / union.size
  }

  private static determineSignificance(similarity: number): 'low' | 'medium' | 'high' {
    if (similarity < this.HIGH_SIGNIFICANCE_THRESHOLD) return 'high'
    if (similarity < this.MEDIUM_SIGNIFICANCE_THRESHOLD) return 'medium'
    return 'low'
  }

  private static calculateConfidence(changes: DriftChange[]): number {
    if (changes.length === 0) return 1.0

    let confidence = 0.8 // Base confidence

    // Adjust based on number of changes
    confidence -= Math.min(0.4, changes.length * 0.05)

    // Adjust based on significance of changes
    const highImpactChanges = changes.filter(c => c.significance === 'high').length
    const mediumImpactChanges = changes.filter(c => c.significance === 'medium').length

    confidence -= (highImpactChanges * 0.15) + (mediumImpactChanges * 0.08)

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  private static generateRecommendation(
    changes: DriftChange[],
    confidence: number
  ): DriftAnalysis['recommendation'] {
    if (changes.length === 0) {
      return 'create-new' // No changes detected, likely duplicate
    }

    const highImpactChanges = changes.filter(c => c.significance === 'high').length
    const mediumImpactChanges = changes.filter(c => c.significance === 'medium').length
    const totalChanges = changes.length

    // Many high-impact changes suggest manual review
    if (highImpactChanges > 2 || confidence < 0.5) {
      return 'manual-review'
    }

    // Few changes suggest updating existing
    if (totalChanges <= 3 && highImpactChanges <= 1) {
      return 'update-existing'
    }

    // Many changes but not too significant suggest new document
    if (totalChanges > 5) {
      return 'create-new'
    }

    // Moderate changes suggest merging
    return 'merge-required'
  }

  static generateDetailedDiff(oldText: string, newText: string): {
    lines: Change[]
    words: Change[]
    summary: {
      additions: number
      deletions: number
      modifications: number
    }
  } {
    const lines = diffLines(oldText, newText)
    const words = diffWords(oldText, newText)

    const summary = {
      additions: lines.filter(change => change.added).length,
      deletions: lines.filter(change => change.removed).length,
      modifications: lines.filter(change => !change.added && !change.removed).length
    }

    return { lines, words, summary }
  }

  static compareSections(
    existingSections: DocumentSection[],
    newSections: DocumentSection[]
  ): {
    added: DocumentSection[]
    removed: DocumentSection[]
    modified: Array<{
      title: string
      existing: DocumentSection
      new: DocumentSection
      similarity: number
    }>
    unchanged: DocumentSection[]
  } {
    const existingMap = new Map(existingSections.map(s => [s.title, s]))
    const newMap = new Map(newSections.map(s => [s.title, s]))

    const added: DocumentSection[] = []
    const removed: DocumentSection[] = []
    const modified: Array<{
      title: string
      existing: DocumentSection
      new: DocumentSection
      similarity: number
    }> = []
    const unchanged: DocumentSection[] = []

    // Find added sections
    for (const [title, section] of newMap) {
      if (!existingMap.has(title)) {
        added.push(section)
      }
    }

    // Find removed sections
    for (const [title, section] of existingMap) {
      if (!newMap.has(title)) {
        removed.push(section)
      }
    }

    // Find modified and unchanged sections
    for (const [title, newSection] of newMap) {
      const existingSection = existingMap.get(title)
      if (existingSection) {
        if (existingSection.content === newSection.content) {
          unchanged.push(newSection)
        } else {
          const similarity = this.calculateStringSimilarity(
            existingSection.content,
            newSection.content
          )
          modified.push({
            title,
            existing: existingSection,
            new: newSection,
            similarity
          })
        }
      }
    }

    return { added, removed, modified, unchanged }
  }

  static createMergePreview(
    existing: EnrichedDocument,
    newDoc: EnrichedDocument,
    strategy: 'prefer-new' | 'prefer-existing' | 'merge-sections' = 'merge-sections'
  ): EnrichedDocument {
    switch (strategy) {
      case 'prefer-new':
        return {
          ...newDoc,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString()
        }

      case 'prefer-existing':
        return {
          ...existing,
          updatedAt: new Date().toISOString()
        }

      case 'merge-sections':
      default:
        return this.mergeSections(existing, newDoc)
    }
  }

  private static mergeSections(
    existing: EnrichedDocument,
    newDoc: EnrichedDocument
  ): EnrichedDocument {
    const comparison = this.compareSections(
      existing.enrichedContent.sections,
      newDoc.enrichedContent.sections
    )

    const mergedSections: DocumentSection[] = [
      ...comparison.unchanged,
      ...comparison.modified.map(m => m.new), // Prefer new content for modified sections
      ...comparison.added
      // Deliberately exclude removed sections
    ]

    return {
      ...existing,
      enrichedContent: {
        ...newDoc.enrichedContent, // Prefer new content structure
        sections: mergedSections
      },
      metadata: {
        ...existing.metadata,
        ...newDoc.metadata, // Merge metadata, preferring new values
        enrichmentTimestamp: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    }
  }
}