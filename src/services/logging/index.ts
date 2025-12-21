/**
 * Logging Service
 *
 * Production-grade logging abstraction with:
 * - Development: Formatted console output
 * - Production: Structured JSON output ready for Sentry/LogRocket
 *
 * Usage:
 * ```ts
 * import { logger } from '@/services/logging'
 *
 * logger.logError(error, { component: 'FileUpload' })
 * logger.logWarning('Something unusual', { raceNumber: 3 })
 * logger.logInfo('File parsed successfully', { fileName: 'file.drf' })
 * logger.setUser('user-123')
 * ```
 */

import type {
  LoggingService,
  LoggingConfig,
  LogContext,
  ErrorContext,
  LogEntry,
  LogLevel,
  LogHandler,
  ErrorSeverity,
  CapturedError,
  Breadcrumb,
} from './types';
import { shouldLog, LOG_LEVEL_COLORS, LOG_LEVEL_ICONS } from './types';
import { isAppError, normalizeError } from '../../types/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of breadcrumbs to keep in memory */
const MAX_BREADCRUMBS = 20;

/** Maximum number of errors to queue for batch sending */
const MAX_ERROR_QUEUE = 50;

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Detect if we're running in development mode
 */
function isDevelopment(): boolean {
  return import.meta.env.MODE === 'development';
}

/**
 * Get the current environment name
 */
function getEnvironment(): string {
  return import.meta.env.MODE || 'unknown';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Safely serialize an object to JSON with depth limit
 */
function safeStringify(obj: unknown, maxDepth = 3): string {
  const seen = new WeakSet();

  function replacer(depth: number) {
    return function (this: unknown, _key: string, value: unknown): unknown {
      if (depth > maxDepth) {
        return '[Max Depth Reached]';
      }

      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }

      // Handle specific types
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      if (typeof value === 'function') {
        return '[Function]';
      }

      if (typeof value === 'symbol') {
        return value.toString();
      }

      return value;
    };
  }

  try {
    return JSON.stringify(obj, replacer(0), 2);
  } catch {
    return String(obj);
  }
}

/**
 * Truncate string for safe logging
 */
function truncate(str: string, maxLength = 500): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

// ============================================================================
// DEVELOPMENT LOGGER
// ============================================================================

/**
 * Format context for console output
 */
function formatContextForConsole(context: LogContext): string {
  const parts: string[] = [];

  if (context.component) {
    parts.push(`[${context.component}]`);
  }
  if (context.raceNumber) {
    parts.push(`Race ${context.raceNumber}`);
  }
  if (context.trackCode) {
    parts.push(`Track: ${context.trackCode}`);
  }
  if (context.fileName) {
    parts.push(`File: ${context.fileName}`);
  }

  return parts.length > 0 ? parts.join(' | ') : '';
}

/**
 * Development logger with formatted console output
 */
class DevelopmentLogger implements LoggingService {
  private config: LoggingConfig;
  private globalContext: LogContext = {};
  private sessionId: string;
  private breadcrumbs: Breadcrumb[] = [];
  private errorQueue: CapturedError[] = [];

  constructor(config: Partial<LoggingConfig> = {}) {
    this.sessionId = generateSessionId();
    this.config = {
      minLevel: 'debug',
      showTimestamps: true,
      showContext: true,
      maxContextDepth: 3,
      enabled: true,
      handlers: [],
      ...config,
    };
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.config.enabled || !shouldLog(level, this.config.minLevel)) {
      return;
    }

    const mergedContext = { ...this.globalContext, ...context, sessionId: this.sessionId };
    const timestamp = this.config.showTimestamps ? this.formatTimestamp() : '';
    const contextStr = this.config.showContext ? formatContextForConsole(mergedContext) : '';
    const icon = LOG_LEVEL_ICONS[level];
    const color = LOG_LEVEL_COLORS[level];

    // Build the log message parts
    const parts = [
      `%c${icon}`,
      timestamp && `%c${timestamp}`,
      `%c${message}`,
      contextStr && `%c${contextStr}`,
    ].filter(Boolean);

    // Build the styles
    const styles = [
      `color: ${color}; font-weight: bold`,
      timestamp && 'color: #888888',
      `color: ${level === 'error' ? color : 'inherit'}`,
      contextStr && 'color: #888888; font-style: italic',
    ].filter(Boolean);

    // Choose console method
    const consoleFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log;

    consoleFn(parts.join(' '), ...styles);

    // Log additional context as collapsed group if verbose
    if (context && Object.keys(context).length > 3 && this.config.showContext) {
      console.groupCollapsed('Context Details');
      console.table(mergedContext);
      console.groupEnd();
    }
  }

  logError(error: Error, context?: ErrorContext): void {
    if (!this.config.enabled) return;

    const mergedContext = { ...this.globalContext, ...context, sessionId: this.sessionId };
    const normalizedError = normalizeError(error);

    // Log the error message
    this.log('error', normalizedError.message, mergedContext);

    // Log additional error details
    console.groupCollapsed('Error Details');

    if (isAppError(error)) {
      console.log('Error Code:', error.code);
      console.log('Category:', error.category);
      console.log('Recoverable:', error.recoverable);
      console.log('User Message:', error.getUserMessage());
      console.log('Suggestion:', error.getSuggestion());
    }

    console.log('Error Name:', normalizedError.name);
    console.log('Context:', normalizedError.context);

    if (mergedContext.componentStack) {
      console.log('Component Stack:', mergedContext.componentStack);
    }

    if (normalizedError.stack) {
      console.log('Stack Trace:');
      console.log(normalizedError.stack);
    }

    console.groupEnd();
  }

  logWarning(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  logInfo(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  logDebug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  setUser(userId: string | null): void {
    this.globalContext.userId = userId;
    if (userId) {
      this.log('info', `User context set: ${userId}`);
    } else {
      this.log('info', 'User context cleared');
    }
  }

  setGlobalContext(context: Partial<LogContext>): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  getConfig(): LoggingConfig {
    return { ...this.config };
  }

  configure(config: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async flush(): Promise<void> {
    // No-op for development logger
  }

  captureError(
    error: Error,
    context?: ErrorContext,
    severity: ErrorSeverity = 'error'
  ): CapturedError {
    const mergedContext: ErrorContext = {
      ...this.globalContext,
      ...context,
      sessionId: this.sessionId,
    };

    const normalizedError = normalizeError(error);
    const captured: CapturedError = {
      message: normalizedError.message,
      stack: normalizedError.stack,
      severity,
      context: mergedContext,
      timestamp: new Date().toISOString(),
      breadcrumbs: [...this.breadcrumbs],
    };

    // Log to console in development
    console.group(
      `%c[CAPTURED ${severity.toUpperCase()}]`,
      `color: ${LOG_LEVEL_COLORS.error}; font-weight: bold`
    );
    console.log('%cMessage:', 'font-weight: bold', captured.message);
    console.log('%cSeverity:', 'font-weight: bold', severity);
    console.log('%cTimestamp:', 'font-weight: bold', captured.timestamp);
    console.log('%cContext:', 'font-weight: bold', captured.context);
    if (captured.breadcrumbs.length > 0) {
      console.log('%cBreadcrumbs:', 'font-weight: bold', captured.breadcrumbs);
    }
    if (captured.stack) {
      console.log('%cStack:', 'font-weight: bold');
      console.log(captured.stack);
    }
    console.groupEnd();

    // Add to error queue
    this.errorQueue.push(captured);
    if (this.errorQueue.length > MAX_ERROR_QUEUE) {
      this.errorQueue.shift();
    }

    return captured;
  }

  captureMessage(
    message: string,
    context?: ErrorContext,
    severity: ErrorSeverity = 'info'
  ): CapturedError {
    const mergedContext: ErrorContext = {
      ...this.globalContext,
      ...context,
      sessionId: this.sessionId,
    };

    const captured: CapturedError = {
      message,
      severity,
      context: mergedContext,
      timestamp: new Date().toISOString(),
      breadcrumbs: [...this.breadcrumbs],
    };

    // Log to console in development
    const colorMap: Record<ErrorSeverity, string> = {
      fatal: LOG_LEVEL_COLORS.error,
      error: LOG_LEVEL_COLORS.error,
      warning: LOG_LEVEL_COLORS.warn,
      info: LOG_LEVEL_COLORS.info,
    };
    console.group(
      `%c[CAPTURED MESSAGE: ${severity.toUpperCase()}]`,
      `color: ${colorMap[severity]}; font-weight: bold`
    );
    console.log('%cMessage:', 'font-weight: bold', message);
    console.log('%cSeverity:', 'font-weight: bold', severity);
    console.log('%cTimestamp:', 'font-weight: bold', captured.timestamp);
    console.log('%cContext:', 'font-weight: bold', captured.context);
    if (captured.breadcrumbs.length > 0) {
      console.log('%cBreadcrumbs:', 'font-weight: bold', captured.breadcrumbs);
    }
    console.groupEnd();

    // Add to error queue
    this.errorQueue.push(captured);
    if (this.errorQueue.length > MAX_ERROR_QUEUE) {
      this.errorQueue.shift();
    }

    return captured;
  }

  breadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
    const crumb: Breadcrumb = {
      message,
      category,
      timestamp: new Date().toISOString(),
      data,
    };

    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }

    // Log breadcrumb in development
    console.log(
      `%c[BREADCRUMB]%c ${category ? `[${category}] ` : ''}${message}`,
      'color: #888888; font-weight: bold',
      'color: #888888'
    );
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  getErrorQueue(): CapturedError[] {
    return [...this.errorQueue];
  }

  clearErrorQueue(): void {
    this.errorQueue = [];
  }
}

// ============================================================================
// PRODUCTION LOGGER
// ============================================================================

/**
 * Production logger with structured JSON output
 */
class ProductionLogger implements LoggingService {
  private config: LoggingConfig;
  private globalContext: LogContext = {};
  private sessionId: string;
  private buffer: LogEntry[] = [];
  private maxBufferSize = 100;
  private breadcrumbs: Breadcrumb[] = [];
  private errorQueue: CapturedError[] = [];

  constructor(config: Partial<LoggingConfig> = {}) {
    this.sessionId = generateSessionId();
    this.config = {
      minLevel: 'info', // Less verbose in production
      showTimestamps: true,
      showContext: true,
      maxContextDepth: 3,
      enabled: true,
      handlers: [],
      ...config,
    };

    // Set up global context
    this.globalContext = {
      sessionId: this.sessionId,
      environment: getEnvironment(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message: truncate(message, 1000),
      timestamp: new Date().toISOString(),
      context: {
        ...this.globalContext,
        ...context,
      },
    };

    if (error) {
      const normalized = normalizeError(error);
      entry.error = {
        name: normalized.name,
        message: truncate(normalized.message, 500),
        stack: normalized.stack ? truncate(normalized.stack, 2000) : undefined,
        code: isAppError(error) ? error.code : undefined,
        category: isAppError(error) ? error.category : undefined,
      };
    }

    return entry;
  }

  private outputLog(entry: LogEntry): void {
    if (!this.config.enabled) return;

    // Output as structured JSON
    const jsonOutput = safeStringify(entry, this.config.maxContextDepth);

    // Choose console method based on level
    if (entry.level === 'error') {
      console.error(jsonOutput);
    } else if (entry.level === 'warn') {
      console.warn(jsonOutput);
    } else {
      console.log(jsonOutput);
    }

    // Send to handlers (e.g., Sentry, LogRocket)
    this.config.handlers?.forEach((handler) => {
      try {
        handler.handle(entry);
      } catch {
        // Silently fail handler errors to prevent cascading
      }
    });

    // Buffer for potential batch sending
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level, this.config.minLevel)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context);
    this.outputLog(entry);
  }

  logError(error: Error, context?: ErrorContext): void {
    const entry = this.createLogEntry('error', error.message, context, error);
    this.outputLog(entry);

    // Also call error-specific handlers
    this.config.handlers?.forEach((handler) => {
      try {
        handler.handleError?.(error, context);
      } catch {
        // Silently fail
      }
    });
  }

  logWarning(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  logInfo(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  logDebug(message: string, context?: LogContext): void {
    // Debug logs are typically suppressed in production
    // but we log them if explicitly enabled
    this.log('debug', message, context);
  }

  setUser(userId: string | null): void {
    this.globalContext.userId = userId;

    // Notify handlers
    this.config.handlers?.forEach((handler) => {
      try {
        handler.setUser?.(userId);
      } catch {
        // Silently fail
      }
    });

    this.log('info', userId ? 'User context updated' : 'User context cleared');
  }

  setGlobalContext(context: Partial<LogContext>): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  getConfig(): LoggingConfig {
    return { ...this.config };
  }

  configure(config: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async flush(): Promise<void> {
    // Flush all handlers
    const flushPromises = this.config.handlers
      ?.map((handler) => handler.flush?.())
      .filter((p): p is Promise<void> => p !== undefined);

    if (flushPromises && flushPromises.length > 0) {
      await Promise.all(flushPromises);
    }
  }

  captureError(
    error: Error,
    context?: ErrorContext,
    severity: ErrorSeverity = 'error'
  ): CapturedError {
    const mergedContext: ErrorContext = {
      ...this.globalContext,
      ...context,
      sessionId: this.sessionId,
    };

    const normalizedError = normalizeError(error);
    const captured: CapturedError = {
      message: normalizedError.message,
      stack: normalizedError.stack,
      severity,
      context: mergedContext,
      timestamp: new Date().toISOString(),
      breadcrumbs: [...this.breadcrumbs],
    };

    // Log to console (structured JSON)
    console.error(
      JSON.stringify({
        type: 'CAPTURED_ERROR',
        ...captured,
      })
    );

    // Add to error queue for batch sending
    this.errorQueue.push(captured);
    if (this.errorQueue.length > MAX_ERROR_QUEUE) {
      this.errorQueue.shift();
    }

    // Notify handlers
    this.config.handlers?.forEach((handler) => {
      try {
        handler.handleError?.(error, mergedContext);
      } catch {
        // Silently fail
      }
    });

    return captured;
  }

  captureMessage(
    message: string,
    context?: ErrorContext,
    severity: ErrorSeverity = 'info'
  ): CapturedError {
    const mergedContext: ErrorContext = {
      ...this.globalContext,
      ...context,
      sessionId: this.sessionId,
    };

    const captured: CapturedError = {
      message,
      severity,
      context: mergedContext,
      timestamp: new Date().toISOString(),
      breadcrumbs: [...this.breadcrumbs],
    };

    // Log to console (structured JSON)
    const logFn =
      severity === 'fatal' || severity === 'error'
        ? console.error
        : severity === 'warning'
          ? console.warn
          : console.log;
    logFn(
      JSON.stringify({
        type: 'CAPTURED_MESSAGE',
        ...captured,
      })
    );

    // Add to error queue for batch sending
    this.errorQueue.push(captured);
    if (this.errorQueue.length > MAX_ERROR_QUEUE) {
      this.errorQueue.shift();
    }

    return captured;
  }

  breadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
    const crumb: Breadcrumb = {
      message,
      category,
      timestamp: new Date().toISOString(),
      data,
    };

    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
  }

  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  getErrorQueue(): CapturedError[] {
    return [...this.errorQueue];
  }

  clearErrorQueue(): void {
    this.errorQueue = [];
  }
}

// ============================================================================
// LOGGER FACTORY & SINGLETON
// ============================================================================

/**
 * Create the appropriate logger based on environment
 */
function createLogger(config?: Partial<LoggingConfig>): LoggingService {
  if (isDevelopment()) {
    return new DevelopmentLogger(config);
  }
  return new ProductionLogger(config);
}

/**
 * Singleton logger instance for app-wide use
 */
export const logger: LoggingService = createLogger();

// ============================================================================
// HANDLER FACTORIES (for future Sentry/LogRocket integration)
// ============================================================================

/**
 * Create a handler that buffers logs for batch sending
 */
export function createBatchHandler(options: {
  name: string;
  batchSize?: number;
  flushInterval?: number;
  onFlush: (entries: LogEntry[]) => Promise<void>;
}): LogHandler {
  const buffer: LogEntry[] = [];
  const batchSize = options.batchSize ?? 10;
  const flushInterval = options.flushInterval ?? 30000;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const flush = async () => {
    if (buffer.length === 0) return;
    const entries = buffer.splice(0, buffer.length);
    await options.onFlush(entries);
  };

  // Start auto-flush interval
  if (typeof window !== 'undefined') {
    intervalId = setInterval(flush, flushInterval);
  }

  return {
    name: options.name,
    handle(entry: LogEntry) {
      buffer.push(entry);
      if (buffer.length >= batchSize) {
        flush();
      }
    },
    async flush() {
      if (intervalId) {
        clearInterval(intervalId);
      }
      await flush();
    },
  };
}

/**
 * Create a no-op handler (useful for testing)
 */
export function createNoOpHandler(name = 'noop'): LogHandler {
  return {
    name,
    handle() {},
  };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type {
  LoggingService,
  LoggingConfig,
  LogContext,
  ErrorContext,
  LogEntry,
  LogLevel,
  LogHandler,
  ErrorSeverity,
  CapturedError,
  Breadcrumb,
} from './types';

export { shouldLog, LOG_LEVEL_VALUES } from './types';

// Default export for convenience
export default logger;
