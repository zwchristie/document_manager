import { config } from '@/config/app.config'
import { logger } from './logger'

export interface MetricData {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp?: number
}

export interface CounterMetric extends MetricData {
  type: 'counter'
}

export interface GaugeMetric extends MetricData {
  type: 'gauge'
}

export interface HistogramMetric extends MetricData {
  type: 'histogram'
  buckets?: number[]
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric

class MetricsCollector {
  private static instance: MetricsCollector
  private metrics: Map<string, Metric[]> = new Map()
  private enabled: boolean

  private constructor() {
    this.enabled = config.isFeatureEnabled('enableMetrics')
    if (this.enabled) {
      logger.info('Metrics collection enabled', { component: 'MetricsCollector' })
      this.startPeriodicFlush()
    }
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  public increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.enabled) return

    const metric: CounterMetric = {
      type: 'counter',
      name,
      value,
      tags,
      timestamp: Date.now()
    }

    this.addMetric(metric)
  }

  public gauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.enabled) return

    const metric: GaugeMetric = {
      type: 'gauge',
      name,
      value,
      tags,
      timestamp: Date.now()
    }

    this.addMetric(metric)
  }

  public histogram(name: string, value: number, tags?: Record<string, string>, buckets?: number[]): void {
    if (!this.enabled) return

    const metric: HistogramMetric = {
      type: 'histogram',
      name,
      value,
      tags,
      buckets,
      timestamp: Date.now()
    }

    this.addMetric(metric)
  }

  public timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.histogram(`${name}.duration`, duration, tags, [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000])
  }

  private addMetric(metric: Metric): void {
    const key = `${metric.name}.${metric.type}`
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    this.metrics.get(key)!.push(metric)
  }

  public getMetrics(): Map<string, Metric[]> {
    return new Map(this.metrics)
  }

  public clearMetrics(): void {
    this.metrics.clear()
  }

  private startPeriodicFlush(): void {
    const flushInterval = 60000 // 1 minute
    setInterval(() => {
      this.flushMetrics()
    }, flushInterval)
  }

  private flushMetrics(): void {
    if (this.metrics.size === 0) return

    const metricsSnapshot = this.getMetrics()
    this.clearMetrics()

    // In a real implementation, these would be sent to a metrics backend
    logger.debug('Flushing metrics', {
      component: 'MetricsCollector',
      metadata: {
        metricsCount: Array.from(metricsSnapshot.values()).reduce((sum, arr) => sum + arr.length, 0),
        metricsTypes: Array.from(metricsSnapshot.keys())
      }
    })

    // Log summary metrics for monitoring
    this.logMetricsSummary(metricsSnapshot)
  }

  private logMetricsSummary(metrics: Map<string, Metric[]>): void {
    const summary: Record<string, any> = {}

    for (const [key, metricList] of metrics) {
      const values = metricList.map(m => m.value)
      summary[key] = {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        min: Math.min(...values),
        max: Math.max(...values)
      }
    }

    logger.info('Metrics Summary', {
      component: 'MetricsCollector',
      operation: 'metrics-flush',
      metadata: summary
    })
  }

  // Predefined application metrics
  public recordApiCall(service: string, endpoint: string, method: string, status: number, duration: number): void {
    const tags = { service, endpoint, method, status: status.toString() }

    this.increment('api.requests.total', 1, tags)
    this.timing('api.requests', duration, tags)

    if (status >= 400) {
      this.increment('api.errors.total', 1, tags)
    }
  }

  public recordDocumentOperation(operation: string, documentType?: string, success: boolean = true): void {
    const tags = { operation, ...(documentType && { documentType }), success: success.toString() }

    this.increment('document.operations.total', 1, tags)

    if (!success) {
      this.increment('document.operations.errors', 1, tags)
    }
  }

  public recordLLMRequest(model: string, tokens: number, duration: number, success: boolean): void {
    const tags = { model, success: success.toString() }

    this.increment('llm.requests.total', 1, tags)
    this.gauge('llm.tokens.consumed', tokens, tags)
    this.timing('llm.requests', duration, tags)

    if (!success) {
      this.increment('llm.requests.errors', 1, tags)
    }
  }

  public recordCacheOperation(operation: string, hit: boolean): void {
    const tags = { operation, hit: hit.toString() }

    this.increment('cache.operations.total', 1, tags)

    if (hit) {
      this.increment('cache.hits.total', 1, tags)
    } else {
      this.increment('cache.misses.total', 1, tags)
    }
  }

  public recordUserAction(action: string, userId?: string): void {
    const tags = { action, ...(userId && { userId }) }

    this.increment('user.actions.total', 1, tags)
  }

  public updateSystemMetrics(): void {
    // Memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      this.gauge('system.memory.rss', memUsage.rss)
      this.gauge('system.memory.heapUsed', memUsage.heapUsed)
      this.gauge('system.memory.heapTotal', memUsage.heapTotal)
    }

    // Active connections/operations
    this.gauge('system.active_connections', this.getActiveConnectionsCount())
  }

  private getActiveConnectionsCount(): number {
    // This would be implemented based on your connection pooling
    return 0
  }
}

// Export singleton instance
export const metrics = MetricsCollector.getInstance()
export { MetricsCollector }