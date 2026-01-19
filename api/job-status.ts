/**
 * Vercel Serverless Function for Job Status
 *
 * GET /api/job-status?jobId=xxx
 *
 * Returns current processing status and results if complete.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { JobStatusResponse } from '../src/services/orchestrator/types';
import { jobs } from './analyze-tracks';

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get job ID from query
  const jobId = req.query.jobId;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({
      error: 'Missing required query parameter: jobId',
      code: 'INVALID_REQUEST',
    });
  }

  // Look up job
  const jobEntry = jobs.get(jobId);

  if (!jobEntry) {
    return res.status(404).json({
      error: `Job not found: ${jobId}`,
      code: 'JOB_NOT_FOUND',
    });
  }

  // Build response
  const response: JobStatusResponse = {
    jobId: jobEntry.jobId,
    status: jobEntry.status,
  };

  // Include result if complete
  if (jobEntry.status.state === 'completed' && jobEntry.result) {
    response.result = jobEntry.result;
  }

  // Include error if failed
  if (jobEntry.status.state === 'failed' && jobEntry.error) {
    response.error = jobEntry.error;
  }

  // Set cache headers based on status
  if (jobEntry.status.active) {
    // Job still processing - don't cache
    res.setHeader('Cache-Control', 'no-store');
  } else {
    // Job complete - cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300');
  }

  return res.status(200).json(response);
}
