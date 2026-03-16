/**
 * Vercel Serverless Proxy for TwinSpires Entries API
 *
 * Proxies requests to TwinSpires server-side to avoid CORS restrictions.
 * The TwinSpires API does not set Access-Control-Allow-Origin headers,
 * so browser-side fetch is blocked. This proxy fetches server-side
 * and returns the response to the client.
 *
 * GET /api/twinspires-entries?trackCode=fg&raceType=Thoroughbred&raceNumber=1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// CONSTANTS
// ============================================================================

const TWINSPIRES_BASE_URL = 'https://www.twinspires.com/adw/todays-tracks';

const AFFID = '2800';

/** Server-side request timeout */
const FETCH_TIMEOUT_MS = 7000;

// Rate limiting (simple in-memory, per-instance)
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// ============================================================================
// HELPERS
// ============================================================================

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

// ============================================================================
// HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Rate limit
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  // Validate params
  const { trackCode, raceType, raceNumber } = req.query;

  if (
    typeof trackCode !== 'string' ||
    !trackCode ||
    typeof raceType !== 'string' ||
    !raceType ||
    typeof raceNumber !== 'string' ||
    !raceNumber
  ) {
    res
      .status(400)
      .json({ error: 'Missing required query parameters: trackCode, raceType, raceNumber' });
    return;
  }

  const raceNum = parseInt(raceNumber, 10);
  if (isNaN(raceNum) || raceNum < 1 || raceNum > 20) {
    res.status(400).json({ error: 'raceNumber must be between 1 and 20' });
    return;
  }

  // Validate trackCode and raceType (alphanumeric + limited chars only)
  if (!/^[a-zA-Z0-9_-]{1,20}$/.test(trackCode)) {
    res.status(400).json({ error: 'Invalid trackCode format' });
    return;
  }
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(raceType)) {
    res.status(400).json({ error: 'Invalid raceType format' });
    return;
  }

  // Build TwinSpires URL
  const url = `${TWINSPIRES_BASE_URL}/${encodeURIComponent(trackCode)}/${encodeURIComponent(raceType)}/races/${raceNum}/entries?affid=${AFFID}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        Referer: 'https://www.twinspires.com/',
        Origin: 'https://www.twinspires.com',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      res.status(response.status).json({
        error: `TwinSpires returned ${response.status}: ${response.statusText}`,
      });
      return;
    }

    const data: unknown = await response.json();

    // Cache for 5 seconds — odds update frequently
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=5');
    res.status(200).json(data);
  } catch (error) {
    // In Node.js, AbortError may be a DOMException or plain Error
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(504).json({ error: 'TwinSpires request timed out' });
      return;
    }
    res.status(502).json({
      error: 'Failed to fetch from TwinSpires',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
