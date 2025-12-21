/**
 * DRF Worker Client
 *
 * Provides a Promise-based API for parsing DRF files using a Web Worker.
 * Handles worker spawning, timeout management, and graceful error handling.
 */

import type {
  ParsedDRFFile,
  DRFWorkerRequest,
  DRFWorkerResponse,
  DRFWorkerProgressMessage,
} from '../types/drf';
import { logger } from '../services/logging';

/** Default timeout for parsing operations (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

/** Progress callback type */
export type ProgressCallback = (progress: DRFWorkerProgressMessage) => void;

/** Options for parseFileAsync */
export interface ParseFileOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Callback for progress updates */
  onProgress?: ProgressCallback;
}

/** Result from worker client operations */
export interface WorkerClientResult {
  success: boolean;
  data?: ParsedDRFFile;
  error?: string;
  usedFallback: boolean;
}

/**
 * Create a new Web Worker instance for DRF parsing
 * Returns null if Worker creation fails
 */
function createWorker(): Worker | null {
  try {
    const worker = new Worker(new URL('./drfWorker.ts', import.meta.url), { type: 'module' });
    return worker;
  } catch (error) {
    logger.logWarning('Failed to create Web Worker', {
      error: error instanceof Error ? error.message : String(error),
      component: 'drfWorkerClient',
    });
    return null;
  }
}

/**
 * Check if Web Workers are supported in the current environment
 */
export function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Parse a DRF file asynchronously using a Web Worker
 *
 * Features:
 * - Promise-based API for easy async/await usage
 * - Timeout handling (default 30 seconds)
 * - Progress callbacks during parsing
 * - Graceful error handling
 * - Automatic worker cleanup
 *
 * @param fileContent - Raw DRF file content as string
 * @param filename - Original filename for error reporting
 * @param options - Optional configuration (timeout, progress callback)
 * @returns Promise resolving to parsed data or rejecting with error
 */
export function parseFileAsync(
  fileContent: string,
  filename: string,
  options: ParseFileOptions = {}
): Promise<ParsedDRFFile> {
  const { timeout = DEFAULT_TIMEOUT_MS, onProgress } = options;

  return new Promise((resolve, reject) => {
    // Check worker support
    if (!isWorkerSupported()) {
      reject(new Error('Web Workers are not supported in this environment'));
      return;
    }

    // Create worker
    const worker = createWorker();
    if (!worker) {
      reject(new Error('Failed to initialize parsing worker'));
      return;
    }

    // Setup timeout
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      worker.terminate();
    };

    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        logger.logWarning('DRF parsing timed out', {
          filename,
          timeoutMs: timeout,
          component: 'drfWorkerClient',
        });
        reject(new Error(`Parsing timed out after ${timeout / 1000} seconds`));
      }
    }, timeout);

    // Handle worker messages
    worker.onmessage = (event: MessageEvent<DRFWorkerResponse>) => {
      const response = event.data;

      // Handle progress updates
      if (response.type === 'progress') {
        onProgress?.(response);
        return;
      }

      // Handle completion
      if (isResolved) return;
      isResolved = true;
      cleanup();

      if (response.type === 'success' && response.data) {
        logger.logInfo('DRF file parsed successfully via worker', {
          filename,
          racesCount: response.data.races.length,
          parseTimeMs: response.data.stats.parseTimeMs,
          component: 'drfWorkerClient',
        });
        resolve(response.data);
      } else if (response.type === 'error') {
        logger.logWarning('DRF parsing failed in worker', {
          filename,
          error: response.error,
          errorCode: response.errorCode,
          component: 'drfWorkerClient',
        });
        reject(new Error(response.error || 'Unknown parsing error'));
      }
    };

    // Handle worker errors
    worker.onerror = (error) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();

      const errorMessage = error.message || 'Worker execution failed';
      logger.logError(new Error(errorMessage), {
        filename,
        component: 'drfWorkerClient',
      });
      reject(new Error(errorMessage));
    };

    // Handle worker message errors
    worker.onmessageerror = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();

      const errorMessage = 'Failed to deserialize worker message';
      logger.logError(new Error(errorMessage), {
        filename,
        component: 'drfWorkerClient',
      });
      reject(new Error(errorMessage));
    };

    // Send parse request to worker
    const request: DRFWorkerRequest = {
      type: 'parse',
      fileContent,
      filename,
    };

    try {
      worker.postMessage(request);
    } catch (error) {
      isResolved = true;
      cleanup();
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send message to worker';
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Parse a DRF file with automatic fallback to main thread if worker fails
 *
 * This function first attempts to parse using a Web Worker. If the worker
 * fails to load or encounters an error, it automatically falls back to
 * main thread parsing.
 *
 * @param fileContent - Raw DRF file content as string
 * @param filename - Original filename for error reporting
 * @param options - Optional configuration (timeout, progress callback)
 * @returns Promise resolving to result object with success/data/error/usedFallback
 */
export async function parseFileWithFallback(
  fileContent: string,
  filename: string,
  options: ParseFileOptions = {}
): Promise<WorkerClientResult> {
  const { onProgress } = options;

  // First try with worker
  try {
    const data = await parseFileAsync(fileContent, filename, options);
    return {
      success: true,
      data,
      usedFallback: false,
    };
  } catch (workerError) {
    logger.logWarning('Worker parsing failed, falling back to main thread', {
      filename,
      error: workerError instanceof Error ? workerError.message : String(workerError),
      component: 'drfWorkerClient',
    });

    // Fall back to main thread parsing
    try {
      // Dynamically import parser to avoid bundling issues
      const { parseDRFFile } = await import('./drfParser');

      // Create a progress adapter
      const progressAdapter = onProgress
        ? (message: DRFWorkerProgressMessage) => onProgress(message)
        : undefined;

      const data = parseDRFFile(fileContent, filename, progressAdapter);

      if (!data.isValid && data.errors.length > 0) {
        return {
          success: false,
          error: data.errors[0] || 'Parsing failed',
          usedFallback: true,
        };
      }

      logger.logInfo('DRF file parsed successfully via main thread fallback', {
        filename,
        racesCount: data.races.length,
        parseTimeMs: data.stats.parseTimeMs,
        component: 'drfWorkerClient',
      });

      return {
        success: true,
        data,
        usedFallback: true,
      };
    } catch (fallbackError) {
      const errorMessage =
        fallbackError instanceof Error ? fallbackError.message : 'Main thread parsing failed';

      logger.logError(new Error(errorMessage), {
        filename,
        component: 'drfWorkerClient',
        stage: 'fallback',
      });

      return {
        success: false,
        error: errorMessage,
        usedFallback: true,
      };
    }
  }
}

/**
 * DRF Worker Client class for managing a persistent worker instance
 *
 * Use this class when you need to parse multiple files and want to
 * reuse the same worker instance for efficiency.
 */
export class DRFWorkerClient {
  private worker: Worker | null = null;
  private isTerminated = false;

  /**
   * Initialize the worker client
   * @returns true if worker was created successfully, false otherwise
   */
  initialize(): boolean {
    if (this.worker) {
      return true;
    }

    if (!isWorkerSupported()) {
      logger.logWarning('Web Workers not supported', {
        component: 'DRFWorkerClient',
      });
      return false;
    }

    this.worker = createWorker();
    this.isTerminated = false;
    return this.worker !== null;
  }

  /**
   * Check if the worker is ready
   */
  isReady(): boolean {
    return this.worker !== null && !this.isTerminated;
  }

  /**
   * Parse a DRF file using the managed worker
   */
  async parse(
    fileContent: string,
    filename: string,
    options: ParseFileOptions = {}
  ): Promise<ParsedDRFFile> {
    if (!this.isReady()) {
      const initialized = this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize worker');
      }
    }

    // Use the standalone function with our existing worker
    return parseFileAsync(fileContent, filename, options);
  }

  /**
   * Terminate the worker and clean up resources
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isTerminated = true;
  }
}

// Export a singleton instance for convenience
let defaultClient: DRFWorkerClient | null = null;

/**
 * Get the default worker client singleton
 */
export function getDefaultClient(): DRFWorkerClient {
  if (!defaultClient) {
    defaultClient = new DRFWorkerClient();
  }
  return defaultClient;
}
