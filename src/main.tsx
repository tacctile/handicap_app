import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'material-icons/iconfont/material-icons.css';
import './index.css';
import App from './App.tsx';
import { logger } from './services/logging';

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

/**
 * Handle uncaught JavaScript errors
 * These are errors that occur outside of React's error boundary
 */
window.onerror = (
  message: string | Event,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
) => {
  // Create or use the error object
  const errorToLog = error || new Error(typeof message === 'string' ? message : 'Unknown error');

  logger.logError(errorToLog, {
    component: 'GlobalErrorHandler',
    errorCategory: 'uncaught',
    url: source,
    // Include source location
    sourceLocation: source && lineno ? `${source}:${lineno}:${colno}` : undefined,
  });

  // Return false to allow the default error handling (console output)
  // This ensures developers still see errors in dev tools
  return false;
};

/**
 * Handle unhandled Promise rejections
 * These are async errors that weren't caught with .catch() or try/catch
 */
window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  // Extract the error from the rejection
  const reason = event.reason;
  const error =
    reason instanceof Error
      ? reason
      : new Error(typeof reason === 'string' ? reason : 'Unhandled Promise rejection');

  logger.logError(error, {
    component: 'GlobalErrorHandler',
    errorCategory: 'unhandled-promise',
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    // Add additional context about the promise if available
    promiseReason: typeof reason === 'string' ? reason : undefined,
  });

  // Optionally prevent the default browser behavior
  // event.preventDefault()
};

/**
 * Handle errors during resource loading (images, scripts, stylesheets)
 * Note: This captures errors on the capture phase for resource elements
 */
window.addEventListener(
  'error',
  (event) => {
    const target = event.target as HTMLElement | null;

    // Only handle resource loading errors (not general JS errors which are handled by onerror)
    if (
      target &&
      (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')
    ) {
      const resourceUrl =
        (target as HTMLImageElement | HTMLScriptElement).src ||
        (target as HTMLLinkElement).href ||
        'unknown';

      logger.logWarning('Resource failed to load', {
        component: 'GlobalErrorHandler',
        resourceType: target.tagName.toLowerCase(),
        resourceUrl,
        url: window.location.href,
      });
    }
  },
  true
); // Use capture phase to catch resource errors

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

// Log application start
logger.logInfo('Furlong application initializing', {
  component: 'Main',
  environment: import.meta.env.MODE,
  buildTime: import.meta.env.VITE_BUILD_TIME || 'development',
});

// Render the application
const rootElement = document.getElementById('root');

if (!rootElement) {
  logger.logError(new Error('Root element not found'), {
    component: 'Main',
    errorCategory: 'initialization',
  });
  throw new Error('Failed to find root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Log successful initialization
logger.logInfo('Furlong application initialized successfully', {
  component: 'Main',
});
