import React from 'react'
import { createRoot } from 'react-dom/client'
import type { EmbedConfig, EnrichedDocument, ProcessingStep } from '@/types'

// Event system for micro frontend communication
class EventBridge {
  private events: Map<string, Function[]> = new Map()

  on(event: string, callback: Function): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)

    // Return cleanup function
    return () => this.off(event, callback)
  }

  off(event: string, callback: Function): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`[EventBridge] Error in ${event} callback:`, error)
        }
      })
    }
  }

  clear(): void {
    this.events.clear()
  }
}

// Main micro frontend interface
export class DocumentManagerEmbed {
  private root: any = null
  private container: HTMLElement | null = null
  private config: EmbedConfig | null = null
  private eventBridge = new EventBridge()
  private isStylesInjected = false

  async mount(container: HTMLElement, config: EmbedConfig): Promise<void> {
    try {
      if (this.root) {
        throw new Error('DocumentManager is already mounted')
      }

      this.container = container
      this.config = config

      // Inject scoped styles for isolation
      this.injectStyles()

      // Validate configuration
      this.validateConfig(config)

      // Create React root and render app
      const { DocumentManagerApp } = await import('@/components/DocumentManagerApp')
      
      this.root = createRoot(container)
      this.root.render(
        React.createElement(DocumentManagerApp, {
          config,
          eventBridge: this.eventBridge
        })
      )

      console.log('[MicroFrontend] DocumentManager mounted successfully')
      
      // Emit mount event
      this.eventBridge.emit('mount', config)

    } catch (error) {
      console.error('[MicroFrontend] Mount failed:', error)
      throw error
    }
  }

  unmount(): void {
    try {
      if (this.root) {
        this.root.unmount()
        this.root = null
      }

      if (this.container) {
        this.container.innerHTML = ''
        this.container = null
      }

      // Remove injected styles
      this.removeStyles()

      // Clear event listeners
      this.eventBridge.clear()

      console.log('[MicroFrontend] DocumentManager unmounted')

    } catch (error) {
      console.error('[MicroFrontend] Unmount failed:', error)
    }
  }

  // Event subscription methods
  onDocumentSaved(callback: (document: EnrichedDocument) => void): () => void {
    return this.eventBridge.on('document-saved', callback)
  }

  onError(callback: (error: Error) => void): () => void {
    return this.eventBridge.on('error', callback)
  }

  onStepChange(callback: (step: ProcessingStep) => void): () => void {
    return this.eventBridge.on('step-change', callback)
  }

  onStateChange(callback: (state: any) => void): () => void {
    return this.eventBridge.on('state-change', callback)
  }

  // Configuration updates
  updateConfig(configUpdate: Partial<EmbedConfig>): void {
    if (!this.config) {
      throw new Error('DocumentManager is not mounted')
    }

    this.config = { ...this.config, ...configUpdate }
    this.eventBridge.emit('config-update', this.config)
  }

  // Public API methods
  getCurrentState(): any {
    if (!this.root) {
      throw new Error('DocumentManager is not mounted')
    }
    
    // This would need to be implemented via the event bridge
    // or by exposing the store state
    return null
  }

  reset(): void {
    this.eventBridge.emit('reset')
  }

  // Health check
  async checkHealth(): Promise<{ llm: boolean; qa: boolean; storage: boolean }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timeout'))
      }, 5000)

      this.eventBridge.on('health-check-result', (result) => {
        clearTimeout(timeout)
        resolve(result)
      })

      this.eventBridge.emit('health-check')
    })
  }

  private validateConfig(config: EmbedConfig): void {
    const errors: string[] = []

    if (!config.apiEndpoints.llm) {
      errors.push('LLM API endpoint is required')
    }

    if (!config.apiEndpoints.qa) {
      errors.push('Q&A API endpoint is required')
    }

    if (!config.apiEndpoints.storage) {
      errors.push('Storage API endpoint is required')
    }

    // Validate URLs
    const endpoints = [config.apiEndpoints.llm, config.apiEndpoints.qa, config.apiEndpoints.storage]
    endpoints.forEach((endpoint, index) => {
      if (endpoint) {
        try {
          new URL(endpoint)
        } catch {
          const names = ['LLM', 'Q&A', 'Storage']
          errors.push(`${names[index]} endpoint must be a valid URL`)
        }
      }
    })

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
    }
  }

  private injectStyles(): void {
    if (this.isStylesInjected) return

    const styleId = 'document-manager-styles'
    if (document.getElementById(styleId)) return

    const styles = `
      /* Document Manager Micro Frontend Styles */
      .dm-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #374151;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        overflow: hidden;
        position: relative;
      }

      .dm-container * {
        box-sizing: border-box;
      }

      /* Dark theme support */
      .dm-container[data-theme="dark"] {
        color: #f9fafb;
        background: #111827;
      }

      /* Loading overlay */
      .dm-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dm-container[data-theme="dark"] .dm-loading-overlay {
        background: rgba(17, 24, 39, 0.8);
      }

      /* Prevent global style bleeding */
      .dm-container button,
      .dm-container input,
      .dm-container textarea,
      .dm-container select {
        font-family: inherit;
        font-size: inherit;
      }

      /* Focus management */
      .dm-container :focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      /* Error boundary styles */
      .dm-error-boundary {
        padding: 20px;
        text-align: center;
        color: #dc2626;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        margin: 10px;
      }

      .dm-container[data-theme="dark"] .dm-error-boundary {
        color: #fca5a5;
        background: #1f1d1d;
        border-color: #7f1d1d;
      }
    `

    const styleElement = document.createElement('style')
    styleElement.id = styleId
    styleElement.textContent = styles
    document.head.appendChild(styleElement)

    this.isStylesInjected = true
  }

  private removeStyles(): void {
    const styleElement = document.getElementById('document-manager-styles')
    if (styleElement) {
      styleElement.remove()
    }
    this.isStylesInjected = false
  }
}

// Error boundary for React components
export class DocumentManagerErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[DocumentManager] Error boundary caught error:', error, errorInfo)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dm-error-boundary">
          <h3>Something went wrong</h3>
          <p>The Document Manager encountered an unexpected error.</p>
          <details style={{ marginTop: 10, textAlign: 'left' }}>
            <summary>Error details</summary>
            <pre style={{ fontSize: 12, marginTop: 5 }}>
              {this.state.error?.stack || this.state.error?.message || 'Unknown error'}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              marginTop: 10,
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              background: '#f9fafb',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Theme detection utility
export function detectTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Utility for safe JSON parsing
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

// Generate unique IDs for instances
export function generateInstanceId(): string {
  return `dm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Export the main interface
export default DocumentManagerEmbed