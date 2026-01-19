/**
 * Vercel Serverless Function for Multi-Track Analysis
 *
 * POST /api/analyze-tracks
 * Body: { tracks: TrackJob[], config?: Partial<OrchestratorConfig> }
 *
 * IMPORTANT: Due to Vercel serverless timeout (10s for hobby, 60s for pro),
 * this endpoint queues the job and returns immediately with a jobId.
 * Use /api/job-status to check progress and retrieve results.
 *
 * For long-running batch processing, consider:
 * - Vercel Edge Functions (longer timeout)
 * - Background functions (Vercel Pro)
 * - External queue service (e.g., Upstash, QStash)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  TrackJob,
  AnalyzeTracksRequest,
  AnalyzeTracksResponse,
  JobEntry,
} from '../src/services/orchestrator/types';

// ============================================================================
// IN-MEMORY JOB STORAGE
// ============================================================================

// Note: In a production environment, this should use a persistent store
// like Redis, Upstash, or a database. In-memory storage will be cleared
// when the serverless function cold starts.

const jobs = new Map<string, JobEntry>();

// Clean up old jobs periodically (keep last 100, or jobs from last hour)
function cleanupJobs(): void {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const maxJobs = 100;

  // Sort by creation time
  const sortedJobs = Array.from(jobs.entries()).sort(
    (a, b) => new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime()
  );

  // Remove old jobs beyond limit
  for (let i = maxJobs; i < sortedJobs.length; i++) {
    const [jobId, job] = sortedJobs[i]!;
    const createdAt = new Date(job.createdAt).getTime();
    if (createdAt < oneHourAgo) {
      jobs.delete(jobId);
    }
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 job requests per minute
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]!.trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(clientIP);

  if (!record || now > record.resetTime) {
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

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(body: unknown): body is AnalyzeTracksRequest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.tracks) || b.tracks.length === 0) return false;

  // Validate each track
  for (const track of b.tracks) {
    if (!track || typeof track !== 'object') return false;
    const t = track as Record<string, unknown>;
    if (typeof t.trackCode !== 'string' || !t.trackCode) return false;
    if (!Array.isArray(t.races)) return false;
  }

  // Limit number of tracks
  if (b.tracks.length > 6) return false;

  return true;
}

// ============================================================================
// JOB PROCESSING
// ============================================================================

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function estimateProcessingTime(tracks: TrackJob[]): number {
  // Estimate: ~5 seconds per race with 4 bots
  const totalRaces = tracks.reduce((sum, t) => sum + t.races.length, 0);
  return totalRaces * 5000;
}

// Start processing in background (fire-and-forget in serverless context)
// Note: This is a simplified implementation. In production, use a proper
// queue service or background worker for reliable processing.
async function startProcessingJob(jobEntry: JobEntry): Promise<void> {
  try {
    // Update status to processing
    jobEntry.status = {
      ...jobEntry.status,
      active: true,
      state: 'processing',
    };
    jobEntry.updatedAt = new Date().toISOString();

    // Import orchestrator dynamically to avoid bundling issues
    const { createOrchestrator } = await import('../src/services/orchestrator');

    const orchestrator = createOrchestrator(jobEntry.request.config);

    // Process tracks
    const result = await orchestrator.processMultipleTracks(jobEntry.request.tracks, {
      onTrackComplete: (_trackCode, _trackResult) => {
        jobEntry.status.tracksComplete++;
        jobEntry.status.currentTrack = undefined;
        jobEntry.updatedAt = new Date().toISOString();
      },
      onRaceComplete: (_trackCode, _raceNumber) => {
        jobEntry.status.racesProcessed++;
        jobEntry.updatedAt = new Date().toISOString();
      },
      onError: (trackCode, error) => {
        console.error(`[analyze-tracks] Error in ${trackCode}: ${error.message}`);
      },
    });

    // Update job with result
    jobEntry.status = {
      ...jobEntry.status,
      active: false,
      state: 'completed',
    };
    jobEntry.result = result;
    jobEntry.updatedAt = new Date().toISOString();
  } catch (error) {
    // Update job with error
    jobEntry.status = {
      ...jobEntry.status,
      active: false,
      state: 'failed',
    };
    jobEntry.error = error instanceof Error ? error.message : String(error);
    jobEntry.updatedAt = new Date().toISOString();
    console.error('[analyze-tracks] Job failed:', error);
  }
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

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(clientIP);
  res.setHeader('X-RateLimit-Remaining', rateCheck.remaining.toString());

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Max 10 job requests per minute.',
      code: 'RATE_LIMITED',
    });
  }

  // Validate request
  if (!validateRequest(req.body)) {
    return res.status(400).json({
      error:
        'Invalid request. Required: tracks (array of TrackJob with trackCode and races). Max 6 tracks.',
      code: 'INVALID_REQUEST',
    });
  }

  const request = req.body as AnalyzeTracksRequest;

  // Clean up old jobs
  cleanupJobs();

  // Generate job ID
  const jobId = generateJobId();

  // Calculate totals
  const totalRaces = request.tracks.reduce((sum, t) => sum + t.races.length, 0);

  // Create job entry
  const jobEntry: JobEntry = {
    jobId,
    status: {
      active: true,
      state: 'starting',
      tracksComplete: 0,
      tracksTotal: request.tracks.length,
      racesProcessed: 0,
      racesTotal: totalRaces,
      startedAt: new Date().toISOString(),
      jobId,
    },
    request,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store job
  jobs.set(jobId, jobEntry);

  // Start processing in background
  // Note: In serverless, this may not complete before function terminates
  // For production, use a proper queue service
  startProcessingJob(jobEntry).catch((err) => {
    console.error('[analyze-tracks] Background processing error:', err);
  });

  // Return job ID immediately
  const response: AnalyzeTracksResponse = {
    jobId,
    message: `Job created. Processing ${request.tracks.length} tracks with ${totalRaces} races.`,
    estimatedTimeMs: estimateProcessingTime(request.tracks),
  };

  return res.status(202).json(response);
}

// Export jobs map for job-status endpoint
export { jobs };
