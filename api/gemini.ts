/**
 * Vercel Serverless Function for Gemini API
 *
 * Securely proxies requests to Gemini 2.0 Flash-Lite.
 * Keeps the API key server-side, not exposed to the browser.
 *
 * POST /api/gemini
 * Body: { systemPrompt: string, userContent: string, temperature?: number, maxOutputTokens?: number }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Allowed models for security - prevents arbitrary model injection
const ALLOWED_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash-lite'] as const;

const DEFAULT_CONFIG = {
  temperature: 0.7,
  maxOutputTokens: 2048,
  topP: 0.95,
  topK: 40,
};

// Rate limiting (simple in-memory, per-instance)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per minute
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// ============================================================================
// TYPES
// ============================================================================

interface GeminiRequestBody {
  systemPrompt: string;
  userContent: string;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

interface GeminiAPIResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(clientIP);

  if (!record || now > record.resetTime) {
    // New window
    requestCounts.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

function validateRequest(body: unknown): body is GeminiRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.systemPrompt === 'string' &&
    b.systemPrompt.length > 0 &&
    typeof b.userContent === 'string' &&
    b.userContent.length > 0
  );
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key configuration
  const apiKey = process?.env?.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini API] GEMINI_API_KEY not configured');
    return res.status(500).json({
      error: 'Server configuration error',
      code: 'API_KEY_MISSING',
    });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(clientIP);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMITED',
    });
  }

  // Validate request body
  if (!validateRequest(req.body)) {
    return res.status(400).json({
      error: 'Invalid request. Required: systemPrompt (string), userContent (string)',
      code: 'INVALID_REQUEST',
    });
  }

  const {
    systemPrompt,
    userContent,
    temperature,
    maxOutputTokens,
    model: requestedModel,
  } = req.body;

  // Validate and select model - use default if not specified or not allowed
  const model =
    requestedModel && ALLOWED_MODELS.includes(requestedModel as (typeof ALLOWED_MODELS)[number])
      ? requestedModel
      : DEFAULT_GEMINI_MODEL;

  console.log(`[Gemini API] Using model: ${model}`);

  // Build Gemini API request
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userContent }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens,
      topP: DEFAULT_CONFIG.topP,
      topK: DEFAULT_CONFIG.topK,
    },
  };

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const processingTimeMs = Date.now() - startTime;

    // Handle API errors
    if (!response.ok) {
      let errorMessage = 'Gemini API error';
      let errorCode = 'API_ERROR';

      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || responseText;
      } catch {
        errorMessage = responseText;
      }

      if (response.status === 401 || response.status === 403) {
        errorCode = 'API_KEY_INVALID';
      } else if (response.status === 429) {
        errorCode = 'RATE_LIMITED';
      } else if (response.status === 402 || errorMessage.toLowerCase().includes('quota')) {
        errorCode = 'QUOTA_EXCEEDED';
      }

      console.error(`[Gemini API] Error ${response.status}: ${errorMessage}`);

      return res.status(response.status).json({
        error: errorMessage,
        code: errorCode,
      });
    }

    // Parse successful response
    const data: GeminiAPIResponse = JSON.parse(responseText);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[Gemini API] No text in response:', JSON.stringify(data).slice(0, 500));
      return res.status(500).json({
        error: 'No text content in Gemini response',
        code: 'PARSE_ERROR',
      });
    }

    // Return successful response
    return res.status(200).json({
      text,
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
      model,
      processingTimeMs,
    });
  } catch (error) {
    console.error('[Gemini API] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return res.status(503).json({
        error: 'Network error communicating with Gemini API',
        code: 'NETWORK_ERROR',
      });
    }

    return res.status(500).json({
      error: `Server error: ${errorMessage}`,
      code: 'API_ERROR',
    });
  }
}
