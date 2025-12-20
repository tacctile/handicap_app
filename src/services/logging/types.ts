/**
 * Logging Service Type Definitions
 *
 * Defines interfaces for the logging abstraction layer.
 * Supports development console logging and production structured logging.
 */

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Severity levels for error classification
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Context that can be attached to any log entry
 */
export interface LogContext {
  /** User identifier (when auth is implemented) */
  userId?: string | null

  /** Current session ID */
  sessionId?: string

  /** Component or module where log originated */
  component?: string

  /** Current race being analyzed */
  raceNumber?: number

  /** Current track code */
  trackCode?: string

  /** File being processed */
  fileName?: string

  /** Browser/environment info */
  userAgent?: string

  /** App version */
  appVersion?: string

  /** Any additional context */
  [key: string]: unknown
}

/**
 * Error-specific context for enhanced error logging
 */
export interface ErrorContext extends LogContext {
  /** Error code if available */
  errorCode?: string

  /** Error category */
  errorCategory?: string

  /** Whether the error is recoverable */
  recoverable?: boolean

  /** Component stack trace (for React errors) */
  componentStack?: string

  /** URL where error occurred */
  url?: string

  /** Timestamp of error */
  timestamp?: string
}

/**
 * Structured log entry for production logging
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel

  /** Log message */
  message: string

  /** ISO timestamp */
  timestamp: string

  /** Additional context */
  context: LogContext

  /** Error details if applicable */
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
    category?: string
  }
}

/**
 * Configuration for the logging service
 */
export interface LoggingConfig {
  /** Minimum log level to output */
  minLevel: LogLevel

  /** Whether to include timestamps in console output */
  showTimestamps: boolean

  /** Whether to include context in console output */
  showContext: boolean

  /** Maximum context object depth for serialization */
  maxContextDepth: number

  /** Whether logging is enabled */
  enabled: boolean

  /** Custom log handlers for production integration */
  handlers?: LogHandler[]
}

/**
 * Handler for processing log entries
 * Used for production integrations (Sentry, LogRocket, etc.)
 */
export interface LogHandler {
  /** Handler name for identification */
  name: string

  /** Process a log entry */
  handle(entry: LogEntry): void

  /** Process an error specifically */
  handleError?(error: Error, context?: ErrorContext): void

  /** Set user context for the handler */
  setUser?(userId: string | null): void

  /** Flush any buffered logs */
  flush?(): Promise<void>
}

/**
 * Main logging service interface
 */
export interface LoggingService {
  /**
   * Log an error with optional context
   */
  logError(error: Error, context?: ErrorContext): void

  /**
   * Log a warning message
   */
  logWarning(message: string, context?: LogContext): void

  /**
   * Log an informational message
   */
  logInfo(message: string, context?: LogContext): void

  /**
   * Log a debug message (development only)
   */
  logDebug(message: string, context?: LogContext): void

  /**
   * Set the current user context (for when auth is implemented)
   */
  setUser(userId: string | null): void

  /**
   * Set global context that applies to all logs
   */
  setGlobalContext(context: Partial<LogContext>): void

  /**
   * Get the current configuration
   */
  getConfig(): LoggingConfig

  /**
   * Update configuration
   */
  configure(config: Partial<LoggingConfig>): void

  /**
   * Flush any buffered logs (for production handlers)
   */
  flush(): Promise<void>
}

/**
 * Log level numeric values for comparison
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Check if a log level should be output given a minimum level
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[minLevel]
}

/**
 * Console colors for different log levels (for development)
 */
export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#888888',
  info: '#19abb5',
  warn: '#f59e0b',
  error: '#ef4444',
}

/**
 * Console icons for different log levels
 */
export const LOG_LEVEL_ICONS: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
}
