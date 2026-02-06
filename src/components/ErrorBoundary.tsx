/**
 * React error boundary that catches rendering errors in child components,
 * logs them via the logging service, and displays a recoverable fallback UI.
 * @param props - Component props
 * @returns React element
 */
import { Component } from 'react';
import type { ReactNode } from 'react';
import { logger } from '../services/logging';
import type { ErrorSeverity } from '../services/logging';
import {
  isAppError,
  isDRFParseError,
  isFileFormatError,
  getUserFriendlyMessage,
  getErrorSuggestion,
} from '../types/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallback?: ReactNode;
  /** Component name for context in error logs */
  componentName?: string;
  /** Additional context to include in error logs */
  context?: Record<string, unknown>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Determine severity based on error type
    let severity: ErrorSeverity = 'error';
    if (isAppError(error)) {
      severity = error.recoverable ? 'warning' : 'error';
    }

    // Capture the error with full context using the enhanced logging service
    // This includes breadcrumbs automatically from the logger's internal state
    const capturedError = logger.captureError(
      error,
      {
        component: this.props.componentName || 'ErrorBoundary',
        componentStack: errorInfo.componentStack || undefined,
        errorCode: isAppError(error) ? error.code : undefined,
        errorCategory: isAppError(error) ? error.category : undefined,
        recoverable: isAppError(error) ? error.recoverable : true,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        action: 'component_render',
        additionalData: {
          ...this.props.context,
          errorBoundaryName: this.props.componentName,
          reactErrorInfo: {
            componentStack: errorInfo.componentStack,
          },
        },
      },
      severity
    );

    // Also log to the standard error log for backwards compatibility
    logger.logError(error, {
      component: this.props.componentName || 'ErrorBoundary',
      componentStack: errorInfo.componentStack || undefined,
    });

    // Log that we captured the error (useful for debugging)
    logger.logInfo(`Error captured by ErrorBoundary: ${capturedError.message}`, {
      component: 'ErrorBoundary',
      additionalData: {
        breadcrumbCount: capturedError.breadcrumbs.length,
        severity: capturedError.severity,
      },
    });

    this.setState({
      errorInfo: errorInfo.componentStack || null,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  // Use the error utilities to get proper messages based on error type
  let title = 'Something went wrong';
  let description = 'An unexpected error occurred while processing your request.';
  let suggestion = 'Please try again or contact support if the problem persists.';

  if (error) {
    // Check for our custom error types first
    if (isAppError(error)) {
      title = error.category;
      description = getUserFriendlyMessage(error);
      suggestion = getErrorSuggestion(error);
    } else if (isDRFParseError(error)) {
      title = 'File Parsing Error';
      description = error.getUserMessage();
      suggestion = error.getSuggestion();
    } else if (isFileFormatError(error)) {
      title = 'File Format Error';
      description = error.getUserMessage();
      suggestion = error.getSuggestion();
    } else {
      // Fallback to message pattern matching for generic errors
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('parse') || msg.includes('drf')) {
        title = 'File Parsing Error';
        description =
          "We couldn't parse the DRF file. The file format may be incorrect or unsupported.";
        suggestion = "Make sure you're uploading a valid .drf file from Daily Racing Form.";
      } else if (msg.includes('corrupt') || msg.includes('invalid')) {
        title = 'Corrupted File Detected';
        description = 'The DRF file appears to be corrupted or contains invalid data.';
        suggestion = 'Try downloading the file again or use a different DRF file.';
      } else if (msg.includes('file') || msg.includes('read')) {
        title = 'File Read Error';
        description = 'There was a problem reading the file.';
        suggestion = 'Make sure the file is accessible and try again.';
      }
    }
  }

  return (
    <div className="error-boundary-container">
      <div className="error-boundary-card">
        {/* Error icon */}
        <div className="error-icon-wrapper">
          <span className="material-icons error-icon">error</span>
        </div>

        {/* Error title */}
        <h2 className="error-title">{title}</h2>

        {/* Error description */}
        <p className="error-description">{description}</p>

        {/* Suggestion */}
        <p className="error-suggestion">{suggestion}</p>

        {/* Error details (collapsible) */}
        {error && (
          <details className="error-details">
            <summary className="error-details-summary">
              <span className="material-icons">code</span>
              Technical Details
            </summary>
            <pre className="error-details-content">{error.message}</pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="error-actions">
          <button onClick={onReset} className="error-reset-button">
            <span className="material-icons">refresh</span>
            Try Another File
          </button>
        </div>
      </div>
    </div>
  );
}

// Standalone error display for non-boundary errors
interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ title = 'Error', message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="error-display">
      <div className="error-display-content">
        <span className="material-icons error-display-icon">warning</span>
        <div className="error-display-text">
          <span className="error-display-title">{title}</span>
          <span className="error-display-message">{message}</span>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="error-display-retry">
            <span className="material-icons">refresh</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Data validation error display
interface DataValidationWarningProps {
  warnings: string[];
  onDismiss?: () => void;
}

export function DataValidationWarning({ warnings, onDismiss }: DataValidationWarningProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="validation-warning">
      <div className="validation-warning-header">
        <span className="material-icons validation-warning-icon">warning_amber</span>
        <span className="validation-warning-title">Data Warnings</span>
        {onDismiss && (
          <button onClick={onDismiss} className="validation-warning-dismiss">
            <span className="material-icons">close</span>
          </button>
        )}
      </div>
      <ul className="validation-warning-list">
        {warnings.map((warning, index) => (
          <li key={index} className="validation-warning-item">
            {warning}
          </li>
        ))}
      </ul>
      <p className="validation-warning-note">
        Continuing with available data. Some analysis may be incomplete.
      </p>
    </div>
  );
}
