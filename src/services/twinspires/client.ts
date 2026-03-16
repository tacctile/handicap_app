/**
 * TwinSpires API Client
 *
 * Typed fetch client for the TwinSpires entries endpoint.
 * Routes requests through a same-origin Vercel serverless proxy
 * (/api/twinspires-entries) to avoid CORS restrictions.
 * Includes retry logic (one retry on network failure with 2s delay)
 * and 8-second timeout on all requests.
 */

import { logger } from '../logging';
import type { TwinSpiresEntry, TwinSpiresError, TwinSpiresErrorCode } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Request timeout in milliseconds (must complete before next 10s poll) */
const REQUEST_TIMEOUT_MS = 8000;

/** Delay before retry on network failure */
const RETRY_DELAY_MS = 2000;

/** Proxy endpoint pattern — same-origin, avoids CORS */
const PROXY_URL_PATTERN =
  '/api/twinspires-entries?trackCode={trackCode}&raceType={raceType}&raceNumber={raceNumber}';

// ============================================================================
// ERROR HELPER
// ============================================================================

function createTwinSpiresError(code: TwinSpiresErrorCode, message: string): TwinSpiresError {
  return { code, message };
}

// ============================================================================
// URL BUILDER
// ============================================================================

/**
 * Build the proxy URL for a specific race.
 */
export function buildEntriesUrl(trackCode: string, raceType: string, raceNumber: number): string {
  return PROXY_URL_PATTERN.replace('{trackCode}', encodeURIComponent(trackCode))
    .replace('{raceType}', encodeURIComponent(raceType))
    .replace('{raceNumber}', String(raceNumber));
}

// ============================================================================
// FETCH CLIENT
// ============================================================================

/**
 * Fetch entries for a single race from TwinSpires.
 *
 * @param trackCode - Track code (e.g., "CD", "SAR")
 * @param raceType - Race type from DRF (e.g., "T" for thoroughbred)
 * @param raceNumber - Race number (1-based)
 * @param signal - Optional AbortSignal for cancellation
 * @returns Array of TwinSpiresEntry objects
 * @throws TwinSpiresError on failure
 */
export async function fetchTwinSpiresEntries(
  trackCode: string,
  raceType: string,
  raceNumber: number,
  signal?: AbortSignal
): Promise<TwinSpiresEntry[]> {
  const url = buildEntriesUrl(trackCode, raceType, raceNumber);

  logger.logInfo(`[TwinSpires] Fetching: ${url}`, { component: 'TwinSpiresClient' });

  let lastError: TwinSpiresError | null = null;

  // Attempt up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      logger.logDebug(`[TwinSpires] Retrying race ${raceNumber} after ${RETRY_DELAY_MS}ms`, {
        component: 'TwinSpiresClient',
      });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    // Check if aborted before attempting
    if (signal?.aborted) {
      throw createTwinSpiresError('NETWORK', 'Request aborted');
    }

    try {
      const entries = await fetchWithTimeout(url, signal);
      return entries;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const tsError = error as TwinSpiresError;
        lastError = tsError;

        // Only retry on NETWORK errors, not TIMEOUT or PARSE
        if (tsError.code !== 'NETWORK') {
          throw tsError;
        }
      } else {
        lastError = createTwinSpiresError(
          'NETWORK',
          error instanceof Error ? error.message : 'Unknown fetch error'
        );
      }
    }
  }

  // Both attempts failed
  throw lastError ?? createTwinSpiresError('NETWORK', 'All fetch attempts failed');
}

/**
 * Internal fetch with timeout and response parsing.
 */
async function fetchWithTimeout(
  url: string,
  externalSignal?: AbortSignal
): Promise<TwinSpiresEntry[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // If external signal aborts, propagate to our controller
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw createTwinSpiresError('NETWORK', `HTTP ${response.status}: ${response.statusText}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw createTwinSpiresError('PARSE', 'Failed to parse JSON response');
    }

    if (!Array.isArray(data)) {
      throw createTwinSpiresError('PARSE', 'Expected array response from entries endpoint');
    }

    return data as TwinSpiresEntry[];
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw createTwinSpiresError('NETWORK', 'Request aborted');
      }
      throw createTwinSpiresError('TIMEOUT', `Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw createTwinSpiresError(
      'NETWORK',
      error instanceof Error ? error.message : 'Network request failed'
    );
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
