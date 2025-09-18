import React, { useEffect, useRef } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { DocumentManagerErrorBoundary } from '@/utils/microFrontendBridge'
import type { EmbedConfig } from '@/types'

interface DocumentManagerAppProps {
  config: EmbedConfig
  eventBridge: any
}

export function DocumentManagerApp({ config, eventBridge }: DocumentManagerAppProps) {
  const store = useDocumentStore()
  const isInitialized = useRef(false)

  // Initialize store with config
  useEffect(() => {
    if (!isInitialized.current) {
      store.initialize(config)
      isInitialized.current = true
    }
  }, [config, store])

  // Set up event bridge listeners
  useEffect(() => {
    const unsubscribers: (() => void)[] = []

    // Listen for config updates
    unsubscribers.push(
      eventBridge.on('config-update', (newConfig: EmbedConfig) => {
        store.updateConfig(newConfig)
      })
    )

    // Listen for reset requests
    unsubscribers.push(
      eventBridge.on('reset', () => {
        store.reset()
      })
    )

    // Listen for health check requests
    unsubscribers.push(
      eventBridge.on('health-check', async () => {
        try {
          const health = await store.checkServiceHealth()
          eventBridge.emit('health-check-result', health)
        } catch (error) {
          eventBridge.emit('health-check-result', { llm: false, qa: false, storage: false })
        }
      })
    )

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [eventBridge, store])

  // Subscribe to store changes and emit events
  useEffect(() => {
    const unsubscribe = useDocumentStore.subscribe(
      (state) => state,
      (state, prevState) => {
        // Emit step change events
        if (state.activeStep !== prevState.activeStep) {
          eventBridge.emit('step-change', state.activeStep)
          config.callbacks?.onStepChange?.(state.activeStep)
        }

        // Emit document saved events
        if (state.enrichedDocument && 
            state.activeStep === 'complete' && 
            prevState.activeStep !== 'complete') {
          eventBridge.emit('document-saved', state.enrichedDocument)
          config.callbacks?.onDocumentSaved?.(state.enrichedDocument)
        }

        // Emit error events
        if (state.errors.length > prevState.errors.length) {
          const newError = state.errors[state.errors.length - 1]
          const error = new Error(newError)
          eventBridge.emit('error', error)
          config.callbacks?.onError?.(error)
        }

        // Emit state change events
        eventBridge.emit('state-change', state)
      }
    )

    return unsubscribe
  }, [eventBridge, config])

  const theme = config.theme === 'auto' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
    config.theme

  return (
    <DocumentManagerErrorBoundary 
      onError={(error) => {
        eventBridge.emit('error', error)
        config.callbacks?.onError?.(error)
      }}
    >
      <div 
        className="dm-container" 
        data-theme={theme}
        style={{ 
          minHeight: '400px',
          position: 'relative'
        }}
      >
        {/* Loading overlay */}
        {store.isLoading && (
          <div className="dm-loading-overlay">
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                display: 'inline-block',
                width: 20,
                height: 20,
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'dm-spin 1s linear infinite',
                marginBottom: 8
              }} />
              <div>Processing...</div>
            </div>
          </div>
        )}

        {/* Main content will be rendered here */}
        <div style={{ padding: '20px' }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600 }}>
            Document Manager
          </h2>
          
          {/* Placeholder content - replace with actual components */}
          <div style={{ 
            padding: 20, 
            border: '2px dashed #d1d5db', 
            borderRadius: 8,
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <p>Document Manager is ready!</p>
            <p style={{ fontSize: 12, marginTop: 10 }}>
              Current step: {store.activeStep} | Status: {store.processingStatus}
            </p>
            
            {store.errors.length > 0 && (
              <div style={{ 
                marginTop: 15,
                padding: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                color: '#dc2626'
              }}>
                <strong>Errors:</strong>
                <ul style={{ margin: '5px 0', paddingLeft: 20 }}>
                  {store.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* CSS animation for loading spinner */}
        <style>
          {`
            @keyframes dm-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </DocumentManagerErrorBoundary>
  )
}