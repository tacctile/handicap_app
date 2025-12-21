/**
 * Sentry Integration Scaffolding
 *
 * Production-ready infrastructure for Sentry error tracking.
 * Currently operates in mock mode - logs to console instead of sending to Sentry.
 *
 * When ready to enable Sentry:
 * 1. Install @sentry/react package
 * 2. Update initSentry() to call Sentry.init()
 * 3. Update SentryProvider methods to use Sentry SDK
 *
 * Usage:
 * ```ts
 * import { initSentry, sentryProvider } from '@/services/logging/sentry'
 *
 * // In app initialization
 * initSentry('your-sentry-dsn')
 *
 * // Configure logger to use Sentry handler
 * logger.configure({ handlers: [sentryProvider] })
 * ```
 */

import type {
  LogHandler,
  LogEntry,
  ErrorContext,
  CapturedError,
  Breadcrumb,
  ErrorSeverity,
} from './types';

// ============================================================================
// SENTRY CONFIGURATION
// ============================================================================

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  enabled: boolean;
  debug: boolean;
  sampleRate: number;
  tracesSampleRate: number;
}

let sentryConfig: SentryConfig | null = null;

/**
 * Check if running in development mode
 */
function isDevelopment(): boolean {
  return import.meta.env.MODE === 'development';
}

/**
 * Initialize Sentry with the provided DSN
 *
 * Currently a stub that logs initialization info to console.
 * When Sentry package is installed, this will call Sentry.init()
 */
export function initSentry(dsn: string, options: Partial<Omit<SentryConfig, 'dsn'>> = {}): void {
  sentryConfig = {
    dsn,
    environment: options.environment ?? import.meta.env.MODE ?? 'development',
    release: options.release,
    enabled: options.enabled ?? true,
    debug: options.debug ?? isDevelopment(),
    sampleRate: options.sampleRate ?? 1.0,
    tracesSampleRate: options.tracesSampleRate ?? 0.1,
  };

  if (isDevelopment()) {
    console.log(
      '%c[SENTRY STUB]',
      'color: #362d59; font-weight: bold',
      'Sentry would initialize with config:',
      sentryConfig
    );
    console.log('%c[SENTRY STUB]', 'color: #362d59; font-weight: bold', 'To enable Sentry:');
    console.log('  1. npm install @sentry/react');
    console.log('  2. Update initSentry() in sentry.ts');
    console.log('  3. Replace stub methods with real Sentry calls');
  } else {
    console.log('[SENTRY] Would initialize with DSN:', dsn.substring(0, 20) + '...');
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return sentryConfig !== null && sentryConfig.enabled;
}

/**
 * Get Sentry configuration (for debugging)
 */
export function getSentryConfig(): SentryConfig | null {
  return sentryConfig ? { ...sentryConfig } : null;
}

// ============================================================================
// SENTRY PROVIDER (LogHandler Implementation)
// ============================================================================

/**
 * Convert ErrorSeverity to Sentry-compatible level
 */
function toSentryLevel(severity: ErrorSeverity): string {
  const mapping: Record<ErrorSeverity, string> = {
    fatal: 'fatal',
    error: 'error',
    warning: 'warning',
    info: 'info',
  };
  return mapping[severity];
}

/**
 * Format captured error for Sentry transmission
 */
function formatForSentry(captured: CapturedError): Record<string, unknown> {
  return {
    message: captured.message,
    level: toSentryLevel(captured.severity),
    timestamp: captured.timestamp,
    tags: {
      component: captured.context.component,
      action: captured.context.action,
      userId: captured.context.userId,
      raceId: captured.context.raceId,
    },
    extra: {
      ...captured.context.additionalData,
      sessionId: captured.context.sessionId,
      url: captured.context.url,
      componentStack: captured.context.componentStack,
    },
    breadcrumbs: captured.breadcrumbs.map(formatBreadcrumbForSentry),
  };
}

/**
 * Format breadcrumb for Sentry transmission
 */
function formatBreadcrumbForSentry(crumb: Breadcrumb): Record<string, unknown> {
  return {
    message: crumb.message,
    category: crumb.category ?? 'default',
    timestamp: crumb.timestamp,
    data: crumb.data,
    level: 'info',
  };
}

/**
 * Sentry LogHandler implementation
 *
 * In development mode, logs what would be sent to Sentry.
 * When Sentry is installed and configured, this will send real data.
 */
class SentryLogHandler implements LogHandler {
  name = 'sentry';
  private pendingEvents: CapturedError[] = [];
  private maxPendingEvents = 50;

  handle(entry: LogEntry): void {
    // Only handle errors and warnings
    if (entry.level !== 'error' && entry.level !== 'warn') {
      return;
    }

    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would send to Sentry (${entry.level}):`,
        {
          message: entry.message,
          level: entry.level,
          timestamp: entry.timestamp,
          context: entry.context,
          error: entry.error,
        }
      );
    } else {
      console.log('[SENTRY] Would send:', entry.level, entry.message);
    }
  }

  handleError(error: Error, context?: ErrorContext): void {
    const captured: CapturedError = {
      message: error.message,
      stack: error.stack,
      severity: 'error',
      context: context ?? {},
      timestamp: new Date().toISOString(),
      breadcrumbs: [],
    };

    this.queueEvent(captured);

    if (isDevelopment()) {
      console.group('%c[SENTRY STUB]', 'color: #362d59; font-weight: bold', 'Would capture error:');
      console.log('%cError:', 'font-weight: bold', error.message);
      console.log('%cStack:', 'font-weight: bold', error.stack);
      console.log('%cContext:', 'font-weight: bold', context);
      console.log('%cFormatted for Sentry:', 'font-weight: bold', formatForSentry(captured));
      console.groupEnd();
    } else {
      console.log('[SENTRY] Would capture error:', error.message);
    }
  }

  setUser(userId: string | null): void {
    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        userId ? `Would set user: ${userId}` : 'Would clear user'
      );
    } else {
      console.log('[SENTRY] Would set user:', userId);
    }
  }

  async flush(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would flush ${events.length} events to Sentry`
      );
    } else {
      console.log('[SENTRY] Would flush', events.length, 'events');
    }

    // In production with real Sentry, this would batch send events
    // await Sentry.flush(2000)
  }

  private queueEvent(captured: CapturedError): void {
    this.pendingEvents.push(captured);
    if (this.pendingEvents.length > this.maxPendingEvents) {
      this.pendingEvents.shift();
    }
  }

  /**
   * Capture an error with full context (Sentry-style API)
   */
  captureError(error: Error, context?: ErrorContext, severity: ErrorSeverity = 'error'): void {
    const captured: CapturedError = {
      message: error.message,
      stack: error.stack,
      severity,
      context: context ?? {},
      timestamp: new Date().toISOString(),
      breadcrumbs: [],
    };

    this.queueEvent(captured);

    if (isDevelopment()) {
      console.group(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would capture ${severity}:`
      );
      console.log('%cError:', 'font-weight: bold', error.message);
      console.log('%cSeverity:', 'font-weight: bold', severity);
      console.log('%cFormatted:', 'font-weight: bold', formatForSentry(captured));
      console.groupEnd();
    } else {
      console.log(`[SENTRY] Would capture ${severity}:`, error.message);
    }
  }

  /**
   * Capture a message (Sentry-style API)
   */
  captureMessage(message: string, context?: ErrorContext, severity: ErrorSeverity = 'info'): void {
    const captured: CapturedError = {
      message,
      severity,
      context: context ?? {},
      timestamp: new Date().toISOString(),
      breadcrumbs: [],
    };

    this.queueEvent(captured);

    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would capture message (${severity}):`,
        message
      );
    } else {
      console.log(`[SENTRY] Would capture message (${severity}):`, message);
    }
  }

  /**
   * Add a breadcrumb (Sentry-style API)
   */
  addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
    const crumb: Breadcrumb = {
      message,
      category,
      timestamp: new Date().toISOString(),
      data,
    };

    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would add breadcrumb [${category ?? 'default'}]:`,
        message
      );
    }

    // In production with real Sentry:
    // Sentry.addBreadcrumb({
    //   message,
    //   category: category ?? 'default',
    //   data,
    //   level: 'info',
    // })
    void crumb; // Satisfy TypeScript (used in real implementation)
  }

  /**
   * Set extra context for all future events
   */
  setContext(name: string, context: Record<string, unknown>): void {
    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would set context "${name}":`,
        context
      );
    }

    // In production with real Sentry:
    // Sentry.setContext(name, context)
  }

  /**
   * Set a tag for all future events
   */
  setTag(key: string, value: string): void {
    if (isDevelopment()) {
      console.log(
        '%c[SENTRY STUB]',
        'color: #362d59; font-weight: bold',
        `Would set tag "${key}":`,
        value
      );
    }

    // In production with real Sentry:
    // Sentry.setTag(key, value)
  }
}

/**
 * Singleton Sentry provider instance
 */
export const sentryProvider = new SentryLogHandler();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick capture error (uses singleton provider)
 */
export function captureException(error: Error, context?: ErrorContext): void {
  sentryProvider.captureError(error, context, 'error');
}

/**
 * Quick capture message (uses singleton provider)
 */
export function captureMessage(message: string, severity: ErrorSeverity = 'info'): void {
  sentryProvider.captureMessage(message, undefined, severity);
}

/**
 * Quick add breadcrumb (uses singleton provider)
 */
export function addBreadcrumb(message: string, category?: string): void {
  sentryProvider.addBreadcrumb(message, category);
}

export type { SentryConfig };
