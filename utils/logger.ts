import pino from 'pino'
import { config } from '@/config/app.config'

export interface LogContext {
  component?: string
  operation?: string
  requestId?: string
  userId?: string
  metadata?: Record<string, any>
}

class Logger {
  private static instance: Logger
  private logger: pino.Logger

  private constructor() {
    const appConfig = config.getConfig()

    this.logger = pino({
      level: appConfig.app.logLevel,
      transport: appConfig.app.environment === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname'
            }
          }
        : undefined,
      formatters: {
        level: (label) => ({ level: label }),
        ...(appConfig.observability.enableStructuredLogging && {
          log: (obj) => ({
            ...obj,
            timestamp: new Date().toISOString(),
            service: appConfig.app.name,
            version: appConfig.app.version,
            environment: appConfig.app.environment
          })
        })
      }
    })
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private formatMessage(message: string, context?: LogContext): any {
    return {
      msg: message,
      ...(context && {
        component: context.component,
        operation: context.operation,
        requestId: context.requestId,
        userId: context.userId,
        metadata: context.metadata
      })
    }
  }

  public trace(message: string, context?: LogContext): void {
    this.logger.trace(this.formatMessage(message, context))
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(this.formatMessage(message, context))
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(this.formatMessage(message, context))
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(this.formatMessage(message, context))
  }

  public error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error({
      ...this.formatMessage(message, context),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    })
  }

  public fatal(message: string, error?: Error, context?: LogContext): void {
    this.logger.fatal({
      ...this.formatMessage(message, context),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    })
  }

  // API-specific logging methods
  public logApiRequest(method: string, url: string, context?: LogContext): void {
    this.info(`API Request: ${method.toUpperCase()} ${url}`, {
      ...context,
      operation: 'api-request'
    })
  }

  public logApiResponse(method: string, url: string, status: number, duration: number, context?: LogContext): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    this[level](`API Response: ${method.toUpperCase()} ${url} - ${status} (${duration}ms)`, {
      ...context,
      operation: 'api-response',
      metadata: {
        httpStatus: status,
        duration
      }
    })
  }

  public logBusinessEvent(event: string, data?: any, context?: LogContext): void {
    this.info(`Business Event: ${event}`, {
      ...context,
      operation: 'business-event',
      metadata: data
    })
  }

  public logPerformance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 5000 ? 'warn' : 'debug'
    this[level](`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      operation: 'performance',
      metadata: { duration }
    })
  }
}

// Export singleton instance
export const logger = Logger.getInstance()
export { Logger }