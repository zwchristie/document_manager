import { config } from '@/config/app.config'
import { logger } from './logger'
import { metrics } from './metrics'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  uptime: number
  checks: HealthCheck[]
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  duration: number
  message?: string
  metadata?: Record<string, any>
}

export interface HealthChecker {
  name: string
  check: () => Promise<HealthCheck>
  required?: boolean
  timeout?: number
}

class HealthCheckService {
  private static instance: HealthCheckService
  private checkers: Map<string, HealthChecker> = new Map()
  private lastStatus: HealthStatus | null = null
  private startTime: number = Date.now()
  private enabled: boolean

  private constructor() {
    this.enabled = config.get('observability').enableHealthChecks
    if (this.enabled) {
      logger.info('Health check service enabled', { component: 'HealthCheckService' })
      this.registerDefaultCheckers()
      this.startPeriodicChecks()
    }
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService()
    }
    return HealthCheckService.instance
  }

  public registerChecker(checker: HealthChecker): void {
    this.checkers.set(checker.name, checker)
    logger.debug(`Registered health checker: ${checker.name}`, { component: 'HealthCheckService' })
  }

  public async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now()
    const checks: HealthCheck[] = []
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    for (const [name, checker] of this.checkers) {
      try {
        const checkStartTime = Date.now()
        const timeout = checker.timeout || 5000

        const checkPromise = checker.check()
        const timeoutPromise = new Promise<HealthCheck>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), timeout)
        )

        const result = await Promise.race([checkPromise, timeoutPromise])
        result.duration = Date.now() - checkStartTime
        checks.push(result)

        // Update overall status
        if (result.status === 'fail' && checker.required !== false) {
          overallStatus = 'unhealthy'
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded'
        }

        metrics.recordHealthCheck(name, result.status, result.duration)
      } catch (error) {
        const duration = Date.now() - checkStartTime
        const failedCheck: HealthCheck = {
          name,
          status: 'fail',
          duration,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
        checks.push(failedCheck)

        if (checker.required !== false) {
          overallStatus = 'unhealthy'
        }

        metrics.recordHealthCheck(name, 'fail', duration)
        logger.warn(`Health check failed: ${name}`, {
          component: 'HealthCheckService',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        })
      }
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: config.get('app').version,
      environment: config.get('app').environment,
      uptime: Date.now() - this.startTime,
      checks
    }

    this.lastStatus = healthStatus
    const totalDuration = Date.now() - startTime

    logger.debug(`Health check completed in ${totalDuration}ms`, {
      component: 'HealthCheckService',
      metadata: { status: overallStatus, checkCount: checks.length, duration: totalDuration }
    })

    metrics.timing('health_check.duration', totalDuration)
    metrics.gauge('health_check.status', overallStatus === 'healthy' ? 1 : overallStatus === 'degraded' ? 0.5 : 0)

    return healthStatus
  }

  public getLastStatus(): HealthStatus | null {
    return this.lastStatus
  }

  private registerDefaultCheckers(): void {
    // Memory usage check
    this.registerChecker({
      name: 'memory',
      check: async (): Promise<HealthCheck> => {
        if (typeof process === 'undefined' || !process.memoryUsage) {
          return {
            name: 'memory',
            status: 'warn',
            duration: 0,
            message: 'Memory usage unavailable'
          }
        }

        const memUsage = process.memoryUsage()
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024
        const usage = heapUsedMB / heapTotalMB

        let status: 'pass' | 'warn' | 'fail' = 'pass'
        let message = `Heap usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${(usage * 100).toFixed(1)}%)`

        if (usage > 0.9) {
          status = 'fail'
          message += ' - Critical memory usage'
        } else if (usage > 0.8) {
          status = 'warn'
          message += ' - High memory usage'
        }

        return {
          name: 'memory',
          status,
          duration: 0,
          message,
          metadata: {
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            usage: usage
          }
        }
      },
      required: false
    })

    // Configuration check
    this.registerChecker({
      name: 'configuration',
      check: async (): Promise<HealthCheck> => {
        const validation = config.validateConfig()

        return {
          name: 'configuration',
          status: validation.valid ? 'pass' : 'fail',
          duration: 0,
          message: validation.valid ? 'Configuration valid' : `Configuration errors: ${validation.errors.join(', ')}`,
          metadata: validation.valid ? undefined : { errors: validation.errors }
        }
      },
      required: true
    })

    // API endpoints availability check
    const apiConfig = config.get('api')

    for (const [serviceName, serviceConfig] of Object.entries(apiConfig)) {
      this.registerChecker({
        name: `api-${serviceName}`,
        check: async (): Promise<HealthCheck> => {
          try {
            // This would be replaced with actual health check calls to your APIs
            const response = await fetch(`${serviceConfig.baseURL}/health`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...(serviceConfig.apiKey && { Authorization: `Bearer ${serviceConfig.apiKey}` })
              },
              signal: AbortSignal.timeout(serviceConfig.timeout || 5000)
            })

            const status = response.ok ? 'pass' : response.status >= 500 ? 'fail' : 'warn'

            return {
              name: `api-${serviceName}`,
              status,
              duration: 0,
              message: `${serviceName.toUpperCase()} API: HTTP ${response.status}`,
              metadata: { httpStatus: response.status, url: serviceConfig.baseURL }
            }
          } catch (error) {
            return {
              name: `api-${serviceName}`,
              status: 'fail',
              duration: 0,
              message: `${serviceName.toUpperCase()} API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
              metadata: { url: serviceConfig.baseURL }
            }
          }
        },
        required: true,
        timeout: serviceConfig.timeout || 5000
      })
    }
  }

  private startPeriodicChecks(): void {
    const interval = config.get('observability').healthCheckInterval

    setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        logger.error('Periodic health check failed', error instanceof Error ? error : undefined, {
          component: 'HealthCheckService'
        })
      }
    }, interval)

    logger.info(`Periodic health checks started (interval: ${interval}ms)`, { component: 'HealthCheckService' })
  }
}

// Extend metrics to include health check recording
declare module './metrics' {
  interface MetricsCollector {
    recordHealthCheck(name: string, status: 'pass' | 'warn' | 'fail', duration: number): void
  }
}

// Add health check metrics method
Object.assign(metrics, {
  recordHealthCheck(name: string, status: 'pass' | 'warn' | 'fail', duration: number): void {
    const tags = { name, status }
    this.increment('health_check.total', 1, tags)
    this.timing('health_check.individual', duration, tags)
  }
})

// Export singleton instance
export const healthCheck = HealthCheckService.getInstance()
export { HealthCheckService }