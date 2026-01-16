/**
 * Gemini API Service
 *
 * Provides direct integration with Google's Gemini 2.0 Flash-Lite model.
 * Handles API calls, error handling, and response parsing.
 */

import type { GeminiRequest, GeminiResponse, GeminiError } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Gemini model to use */
export const GEMINI_MODEL = 'gemini-2.0-flash-lite';

/** Gemini API endpoint */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Default configuration */
const DEFAULT_CONFIG = {
  temperature: 0.7,
  maxOutputTokens: 2048,
  topP: 0.95,
  topK: 40,
};

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * Get the Gemini API key from environment variables
 * Checks both client-side (VITE_) and server-side env vars
 */
export function getGeminiApiKey(): string | null {
  // Client-side (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }

  // Server-side (Node.js / Vercel)
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  return null;
}

/**
 * Check if the Gemini API is configured
 * Either via direct API key or via the serverless proxy
 */
export function isGeminiConfigured(): boolean {
  // Direct API key available
  if (getGeminiApiKey() !== null) return true;

  // In browser, we can use the /api/gemini endpoint (key is server-side)
  if (typeof window !== 'undefined') return true;

  return false;
}

/**
 * Determine if we should use the serverless proxy
 * Use proxy when: in browser AND no client-side key
 */
function shouldUseProxy(): boolean {
  if (typeof window === 'undefined') return false;
  return getGeminiApiKey() === null;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Create a structured Gemini error
 */
function createGeminiError(
  code: GeminiError['code'],
  message: string,
  retryable: boolean,
  statusCode?: number
): GeminiError {
  return { code, message, retryable, statusCode };
}

/**
 * Parse API error response to structured error
 */
function parseApiError(statusCode: number, responseText: string): GeminiError {
  // Try to parse as JSON
  try {
    const errorData = JSON.parse(responseText);
    const message = errorData.error?.message || responseText;

    if (statusCode === 401 || statusCode === 403) {
      return createGeminiError('API_KEY_INVALID', `Invalid API key: ${message}`, false, statusCode);
    }

    if (statusCode === 429) {
      return createGeminiError('RATE_LIMITED', `Rate limited: ${message}`, true, statusCode);
    }

    if (statusCode === 402 || message.toLowerCase().includes('quota')) {
      return createGeminiError('QUOTA_EXCEEDED', `Quota exceeded: ${message}`, false, statusCode);
    }

    return createGeminiError('API_ERROR', message, statusCode >= 500, statusCode);
  } catch {
    return createGeminiError('API_ERROR', responseText || 'Unknown API error', statusCode >= 500, statusCode);
  }
}

// ============================================================================
// MAIN API FUNCTION
// ============================================================================

/**
 * Call Gemini 2.0 Flash-Lite with a system prompt and user content
 *
 * Automatically uses the serverless proxy (/api/gemini) when running in browser
 * without a client-side API key. This keeps the key secure on the server.
 *
 * @param request - The request containing system prompt and user content
 * @returns Promise resolving to GeminiResponse or throwing GeminiError
 *
 * @example
 * ```typescript
 * const response = await callGemini({
 *   systemPrompt: 'You are a horse racing analyst.',
 *   userContent: 'Analyze this race data...',
 *   temperature: 0.7,
 * });
 * console.log(response.text);
 * ```
 */
export async function callGemini(request: GeminiRequest): Promise<GeminiResponse> {
  // Use serverless proxy if in browser without client-side key
  if (shouldUseProxy()) {
    return callGeminiViaProxy(request);
  }

  return callGeminiDirect(request);
}

/**
 * Call Gemini via the serverless proxy endpoint
 * Used in browser when API key is stored server-side
 */
async function callGeminiViaProxy(request: GeminiRequest): Promise<GeminiResponse> {
  const startTime = Date.now();

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt: request.systemPrompt,
        userContent: request.userContent,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw createGeminiError(
        data.code || 'API_ERROR',
        data.error || 'Unknown error from proxy',
        response.status === 429 || response.status >= 500,
        response.status
      );
    }

    return {
      text: data.text,
      promptTokens: data.promptTokens || 0,
      completionTokens: data.completionTokens || 0,
      totalTokens: data.totalTokens || 0,
      model: data.model || GEMINI_MODEL,
      processingTimeMs: data.processingTimeMs || (Date.now() - startTime),
    };
  } catch (error) {
    // Re-throw if it's already a GeminiError
    if (error && typeof error === 'object' && 'code' in error && 'retryable' in error) {
      throw error;
    }

    // Network errors
    if (error instanceof TypeError) {
      throw createGeminiError(
        'NETWORK_ERROR',
        `Network error calling API proxy: ${error.message}`,
        true
      );
    }

    throw createGeminiError(
      'API_ERROR',
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      false
    );
  }
}

/**
 * Call Gemini API directly (requires API key)
 * Used server-side or when client has direct API key access
 */
async function callGeminiDirect(request: GeminiRequest): Promise<GeminiResponse> {
  const startTime = Date.now();

  // Check for API key
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw createGeminiError(
      'API_KEY_MISSING',
      'Gemini API key not configured. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY environment variable.',
      false
    );
  }

  // Build request payload
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: request.userContent }],
      },
    ],
    systemInstruction: {
      parts: [{ text: request.systemPrompt }],
    },
    generationConfig: {
      temperature: request.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: request.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens,
      topP: DEFAULT_CONFIG.topP,
      topK: DEFAULT_CONFIG.topK,
    },
  };

  // Build URL
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw parseApiError(response.status, responseText);
    }

    // Parse successful response
    const data = JSON.parse(responseText);

    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw createGeminiError(
        'PARSE_ERROR',
        'No text content in Gemini response',
        false
      );
    }

    // Extract token usage
    const usageMetadata = data.usageMetadata || {};
    const promptTokens = usageMetadata.promptTokenCount || 0;
    const completionTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || promptTokens + completionTokens;

    const processingTimeMs = Date.now() - startTime;

    return {
      text,
      promptTokens,
      completionTokens,
      totalTokens,
      model: GEMINI_MODEL,
      processingTimeMs,
    };
  } catch (error) {
    // Re-throw if it's already a GeminiError
    if (error && typeof error === 'object' && 'code' in error && 'retryable' in error) {
      throw error;
    }

    // Network or other errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createGeminiError(
        'NETWORK_ERROR',
        `Network error calling Gemini API: ${error.message}`,
        true
      );
    }

    throw createGeminiError(
      'API_ERROR',
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      false
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Call Gemini with automatic retry on retryable errors
 *
 * @param request - The Gemini request
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay between retries in ms (default: 1000)
 * @returns Promise resolving to GeminiResponse
 */
export async function callGeminiWithRetry(
  request: GeminiRequest,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<GeminiResponse> {
  let lastError: GeminiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGemini(request);
    } catch (error) {
      const geminiError = error as GeminiError;
      lastError = geminiError;

      // Don't retry non-retryable errors
      if (!geminiError.retryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Type guard to check if an error is a GeminiError
 */
export function isGeminiError(error: unknown): error is GeminiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  );
}
