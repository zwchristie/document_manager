import { z } from 'zod'

// Configuration schema for validation
const AppConfigSchema = z.object({
  app: z.object({
    name: z.string().default('Document Manager'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    port: z.number().min(1000).max(65535).default(3000),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info')
  }),
  api: z.object({
    llm: z.object({
      baseURL: z.string().url(),
      apiKey: z.string().optional(),
      timeout: z.number().min(1000).default(120000),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(100).default(1000)
    }),
    qa: z.object({
      baseURL: z.string().url(),
      apiKey: z.string().optional(),
      timeout: z.number().min(1000).default(30000),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(100).default(1000)
    }),
    document: z.object({
      baseURL: z.string().url(),
      apiKey: z.string().optional(),
      timeout: z.number().min(1000).default(30000),
      retryAttempts: z.number().min(0).max(5).default(3),
      retryDelay: z.number().min(100).default(1000)
    })
  }),
  features: z.object({
    enableDriftDetection: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
    enableTracing: z.boolean().default(false),
    enableCaching: z.boolean().default(true),
    maxCacheSize: z.number().min(10).default(100),
    cacheTTL: z.number().min(60000).default(300000) // 5 minutes
  }),
  security: z.object({
    enableRateLimit: z.boolean().default(true),
    maxRequestsPerMinute: z.number().min(1).default(100),
    enableInputSanitization: z.boolean().default(true),
    allowedOrigins: z.array(z.string()).default(['*'])
  }),
  observability: z.object({
    enableHealthChecks: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
    enableTracing: z.boolean().default(false),
    enableStructuredLogging: z.boolean().default(true),
    metricsPort: z.number().min(1000).max(65535).default(9090),
    healthCheckInterval: z.number().min(5000).default(30000) // 30 seconds
  })
})

export type AppConfig = z.infer<typeof AppConfigSchema>

class ConfigManager {
  private static instance: ConfigManager
  private config: AppConfig

  private constructor() {
    this.config = this.loadConfig()
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private loadConfig(): AppConfig {
    const env = process.env.NODE_ENV || 'development'

    // Default configuration
    const defaultConfig = {
      app: {
        name: process.env.APP_NAME || 'Document Manager',
        version: process.env.APP_VERSION || '1.0.0',
        environment: env as 'development' | 'staging' | 'production',
        port: parseInt(process.env.PORT || '3000', 10),
        logLevel: (process.env.LOG_LEVEL || 'info') as 'trace' | 'debug' | 'info' | 'warn' | 'error'
      },
      api: {
        llm: {
          baseURL: process.env.LLM_API_URL || 'http://localhost:8001',
          apiKey: process.env.LLM_API_KEY,
          timeout: parseInt(process.env.LLM_TIMEOUT || '120000', 10),
          retryAttempts: parseInt(process.env.LLM_RETRY_ATTEMPTS || '3', 10),
          retryDelay: parseInt(process.env.LLM_RETRY_DELAY || '1000', 10)
        },
        qa: {
          baseURL: process.env.QA_API_URL || 'http://localhost:8002',
          apiKey: process.env.QA_API_KEY,
          timeout: parseInt(process.env.QA_TIMEOUT || '30000', 10),
          retryAttempts: parseInt(process.env.QA_RETRY_ATTEMPTS || '3', 10),
          retryDelay: parseInt(process.env.QA_RETRY_DELAY || '1000', 10)
        },
        document: {
          baseURL: process.env.DOC_API_URL || 'http://localhost:8003',
          apiKey: process.env.DOC_API_KEY,
          timeout: parseInt(process.env.DOC_TIMEOUT || '30000', 10),
          retryAttempts: parseInt(process.env.DOC_RETRY_ATTEMPTS || '3', 10),
          retryDelay: parseInt(process.env.DOC_RETRY_DELAY || '1000', 10)
        }
      },
      features: {
        enableDriftDetection: process.env.ENABLE_DRIFT_DETECTION !== 'false',
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
        enableTracing: process.env.ENABLE_TRACING === 'true',
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '100', 10),
        cacheTTL: parseInt(process.env.CACHE_TTL || '300000', 10)
      },
      security: {
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
        maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100', 10),
        enableInputSanitization: process.env.ENABLE_INPUT_SANITIZATION !== 'false',
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*']
      },
      observability: {
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
        enableMetrics: process.env.ENABLE_OBSERVABILITY_METRICS !== 'false',
        enableTracing: process.env.ENABLE_OBSERVABILITY_TRACING === 'true',
        enableStructuredLogging: process.env.ENABLE_STRUCTURED_LOGGING !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10)
      }
    }

    try {
      // Validate configuration
      const validatedConfig = AppConfigSchema.parse(defaultConfig)
      console.log(`[CONFIG] Configuration loaded for environment: ${validatedConfig.app.environment}`)
      return validatedConfig
    } catch (error) {
      console.error('[CONFIG] Configuration validation failed:', error)
      throw new Error('Invalid configuration')
    }
  }

  public getConfig(): AppConfig {
    return this.config
  }

  public get<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.config[section]
  }

  public getApiConfig(service: 'llm' | 'qa' | 'document') {
    return this.config.api[service]
  }

  public isDevelopment(): boolean {
    return this.config.app.environment === 'development'
  }

  public isProduction(): boolean {
    return this.config.app.environment === 'production'
  }

  public isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.config.features[feature]
  }

  public reload(): void {
    console.log('[CONFIG] Reloading configuration...')
    this.config = this.loadConfig()
  }

  public validateConfig(): { valid: boolean; errors: string[] } {
    try {
      AppConfigSchema.parse(this.config)
      return { valid: true, errors: [] }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }
      }
      return { valid: false, errors: ['Unknown validation error'] }
    }
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance()
export { ConfigManager }