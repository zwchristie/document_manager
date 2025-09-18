import type {
  DocumentInput,
  DocumentType,
  PromptTemplate,
  PromptExample
} from '@/types'

export class PromptEngineering {
  private static templates: Map<DocumentType, PromptTemplate> = new Map()

  static {
    // Initialize default templates
    this.initializeDefaultTemplates()
  }

  private static initializeDefaultTemplates(): void {
    const templates: PromptTemplate[] = [
      {
        id: 'microservice-v1',
        name: 'Microservice Documentation',
        documentType: 'microservice',
        systemPrompt: `You are a technical documentation expert specializing in microservice architecture. Create comprehensive, structured documentation that will be stored in a RAG knowledge base.

Return valid JSON with the following structure:
{
  "title": "Service Name",
  "summary": "Brief overview in 1-2 sentences",
  "description": "Detailed description",
  "purpose": "Business purpose and context",
  "sections": [
    {
      "title": "Section Title",
      "content": "Section content",
      "type": "overview|inputs|outputs|dependencies|examples|configuration|troubleshooting|related-services"
    }
  ],
  "structuredData": {
    "endpoints": [],
    "dependencies": [],
    "configuration": {},
    "deployment": {}
  }
}`,
        userPromptTemplate: `Create comprehensive microservice documentation for the following:

**Service Information:**
- Name: {{serviceName}}
- Dependencies: {{dependencies}}

**Content to Document:**
{{content}}

**Additional Metadata:**
{{metadata}}

Focus on:
1. Service overview and business purpose
2. API endpoints and interfaces
3. Dependencies and integrations
4. Configuration requirements
5. Deployment and operational aspects
6. Error handling and troubleshooting`,
        outputSchema: {
          type: 'object',
          required: ['title', 'description', 'purpose', 'sections'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            purpose: { type: 'string' },
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  type: { type: 'string', enum: ['overview', 'inputs', 'outputs', 'dependencies', 'examples', 'configuration', 'troubleshooting', 'related-services'] }
                }
              }
            }
          }
        },
        examples: [],
        version: '1.0'
      },
      {
        id: 'api-endpoint-v1',
        name: 'API Endpoint Documentation',
        documentType: 'api-endpoint',
        systemPrompt: `You are a technical documentation expert specializing in API documentation. Create comprehensive, structured documentation for API endpoints.

Return valid JSON following the specified schema with clear request/response examples and error handling information.`,
        userPromptTemplate: `Create detailed API endpoint documentation for:

**Endpoint Information:**
{{content}}

**Service Context:**
- Service: {{serviceName}}
- Dependencies: {{dependencies}}

**Metadata:**
{{metadata}}

Include:
1. Endpoint purpose and functionality
2. Request format and parameters
3. Response format and examples
4. Authentication requirements
5. Error codes and handling
6. Rate limiting and constraints`,
        outputSchema: {
          type: 'object',
          required: ['title', 'description', 'sections'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            sections: { type: 'array' }
          }
        },
        examples: [],
        version: '1.0'
      },
      {
        id: 'business-logic-v1',
        name: 'Business Logic Documentation',
        documentType: 'business-logic',
        systemPrompt: `You are a business analyst and technical writer specializing in documenting business logic and rules. Focus on business context, decision flows, and rule definitions.

Return valid JSON with clear business context and technical implementation details.`,
        userPromptTemplate: `Document the following business logic:

**Business Context:**
{{content}}

**System Information:**
- Component: {{serviceName}}
- Related Systems: {{dependencies}}

**Additional Context:**
{{metadata}}

Cover:
1. Business purpose and context
2. Business rules and constraints
3. Decision flows and logic
4. Data transformations
5. Edge cases and exceptions
6. Related business processes`,
        outputSchema: {
          type: 'object',
          required: ['title', 'description', 'purpose'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            purpose: { type: 'string' },
            sections: { type: 'array' }
          }
        },
        examples: [],
        version: '1.0'
      }
    ]

    templates.forEach(template => {
      this.templates.set(template.documentType, template)
    })
  }

  static getTemplate(documentType: DocumentType): PromptTemplate | undefined {
    return this.templates.get(documentType)
  }

  static getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  static addCustomTemplate(template: PromptTemplate): void {
    this.templates.set(template.documentType, template)
  }

  static generatePrompt(input: DocumentInput, template?: PromptTemplate): string {
    const selectedTemplate = template || this.getTemplate(input.type)
    
    if (!selectedTemplate) {
      return this.generateFallbackPrompt(input)
    }

    return this.applyTemplate(selectedTemplate, input)
  }

  private static applyTemplate(template: PromptTemplate, input: DocumentInput): string {
    let prompt = template.userPromptTemplate

    // Replace template variables
    prompt = prompt.replace(/\{\{content\}\}/g, input.content)
    prompt = prompt.replace(/\{\{type\}\}/g, input.type)
    
    // Replace metadata variables
    const metadata = input.metadata || {}
    prompt = prompt.replace(/\{\{serviceName\}\}/g, metadata.serviceName || 'Not specified')
    prompt = prompt.replace(/\{\{dependencies\}\}/g, 
      metadata.dependencies ? metadata.dependencies.join(', ') : 'None specified')
    prompt = prompt.replace(/\{\{version\}\}/g, metadata.version || 'Not specified')
    prompt = prompt.replace(/\{\{author\}\}/g, metadata.author || 'Not specified')
    prompt = prompt.replace(/\{\{tags\}\}/g, 
      metadata.tags ? metadata.tags.join(', ') : 'None')
    prompt = prompt.replace(/\{\{category\}\}/g, metadata.category || 'Not specified')
    prompt = prompt.replace(/\{\{businessUnit\}\}/g, metadata.businessUnit || 'Not specified')

    // Replace metadata placeholder with formatted JSON
    const metadataJson = JSON.stringify(metadata, null, 2)
    prompt = prompt.replace(/\{\{metadata\}\}/g, metadataJson)

    return prompt
  }

  private static generateFallbackPrompt(input: DocumentInput): string {
    const documentTypeDescriptions = {
      'microservice': 'microservice architecture and implementation',
      'api-endpoint': 'API endpoint functionality and usage',
      'business-logic': 'business rules and decision logic',
      'system-architecture': 'system design and architecture',
      'database-schema': 'database structure and relationships',
      'configuration': 'configuration settings and parameters',
      'deployment': 'deployment procedures and requirements',
      'security-policy': 'security policies and controls'
    }

    const typeDescription = documentTypeDescriptions[input.type] || 'technical component'

    return `Create comprehensive technical documentation for the following ${typeDescription}:

## Content to Document:
${input.content}

## Context Information:
${JSON.stringify(input.metadata, null, 2)}

Please provide structured documentation that includes:
1. Clear title and overview
2. Detailed description
3. Purpose and business context
4. Technical specifications
5. Dependencies and relationships
6. Configuration and setup
7. Examples and usage patterns
8. Troubleshooting and common issues

Return the response as valid JSON with the structure:
{
  "title": "Document title",
  "summary": "Brief summary",
  "description": "Detailed description",
  "purpose": "Business purpose",
  "sections": [
    {
      "title": "Section title",
      "content": "Section content",
      "type": "section_type"
    }
  ],
  "structuredData": {}
}`
  }

  static validateTemplate(template: PromptTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!template.id?.trim()) {
      errors.push('Template ID is required')
    }

    if (!template.name?.trim()) {
      errors.push('Template name is required')
    }

    if (!template.documentType) {
      errors.push('Document type is required')
    }

    if (!template.systemPrompt?.trim()) {
      errors.push('System prompt is required')
    }

    if (!template.userPromptTemplate?.trim()) {
      errors.push('User prompt template is required')
    }

    if (!template.version?.trim()) {
      errors.push('Template version is required')
    }

    // Check for required template variables
    const requiredVars = ['{{content}}']
    requiredVars.forEach(variable => {
      if (!template.userPromptTemplate.includes(variable)) {
        errors.push(`Template must include ${variable} variable`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  static extractVariables(template: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1])
      }
    }

    return variables
  }

  static previewPrompt(input: DocumentInput, template?: PromptTemplate): {
    systemPrompt: string
    userPrompt: string
    variables: Record<string, string>
  } {
    const selectedTemplate = template || this.getTemplate(input.type)
    
    if (!selectedTemplate) {
      return {
        systemPrompt: 'Default system prompt for technical documentation',
        userPrompt: this.generateFallbackPrompt(input),
        variables: {}
      }
    }

    const variables: Record<string, string> = {
      content: input.content,
      type: input.type,
      serviceName: input.metadata?.serviceName || 'Not specified',
      dependencies: input.metadata?.dependencies?.join(', ') || 'None',
      version: input.metadata?.version || 'Not specified',
      author: input.metadata?.author || 'Not specified',
      tags: input.metadata?.tags?.join(', ') || 'None',
      category: input.metadata?.category || 'Not specified',
      businessUnit: input.metadata?.businessUnit || 'Not specified',
      metadata: JSON.stringify(input.metadata || {}, null, 2)
    }

    return {
      systemPrompt: selectedTemplate.systemPrompt,
      userPrompt: this.applyTemplate(selectedTemplate, input),
      variables
    }
  }
}