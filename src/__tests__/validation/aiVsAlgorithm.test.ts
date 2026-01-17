/**
 * AI vs Algorithm Validation Test
 *
 * Runs all 112 races through:
 * 1. Algorithm-only (baseline)
 * 2. Algorithm + AI (test)
 *
 * Compares both against actual results.
 *
 * Run with: npm test -- --run src/__tests__/validation/aiVsAlgorithm.test.ts
 */

// Load environment variables first
import 'dotenv/config';

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseDRFFile } from '../../lib/drfParser';
import { calculateRaceScores, analyzePaceScenario } from '../../lib/scoring';
import { getAIAnalysis, checkAIServiceStatus } from '../../services/ai';
import type { ParsedRace, HorseEntry } from '../../types/drf';
import type { AIRaceAnalysis } from '../../services/ai/types';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../../types/scoring';
import type { ScoredHorse } from '../../lib/scoring';
import type { TrackCondition } from '../../hooks/useRaceState';

// ============================================================================
// THROTTLING UTILITIES
// ============================================================================

// Throttle API calls to avoid rate limits
const DELAY_BETWEEN_CALLS_MS = 1500; // 1.5 seconds between calls

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call AI with retry logic and exponential backoff for rate limits
 */
async function callAIWithRetry(
  race: ParsedRace,
  scoringResult: RaceScoringResult,
  maxRetries: number = 3
): Promise<AIRaceAnalysis | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await getAIAnalysis(race, scoringResult, { forceRefresh: true });
    } catch (err: any) {
      const errorMessage = err?.message || '';
      const isRateLimit = errorMessage.includes('429') ||
                          errorMessage.includes('RATE_LIMIT') ||
                          errorMessage.includes('Too Many Requests') ||
                          err?.code === 'RATE_LIMIT';

      if (isRateLimit && attempt < maxRetries) {
        const backoffMs = attempt * 5000; // 5s, 10s, 15s
        console.log(`    ⚠️ Rate limited. Waiting ${backoffMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await delay(backoffMs);
      } else {
        throw err;
      }
    }
  }
  return null;
}

// ============================================================================
// TYPES
// ============================================================================

interface RaceResult {
  raceNumber: number;
  positions: { post: number; horseName: string }[];
  scratches: { post: number; horseName: string }[];
}

interface ExoticBetResults {
  // Exacta variants
  exactaStraight: number;      // #1-#2 exact order
  exactaBox2: number;          // Top 2 in any order
  exactaBox3: number;          // Win + any of top 3 for place
  exactaBox4: number;          // Win + any of top 4 for place

  // Trifecta variants
  trifectaStraight: number;    // #1-#2-#3 exact order
  trifectaBox3: number;        // Top 3 in any order
  trifectaBox4: number;        // Top 4, any 3 in order
  trifectaBox5: number;        // Top 5, any 3 in order
  trifectaKey: number;         // #1 over top 4 for 2nd/3rd

  // Superfecta variants
  superfectaStraight: number;  // #1-#2-#3-#4 exact order
  superfectaBox4: number;      // Top 4 in any order
  superfectaBox5: number;      // Top 5, any 4 in order
  superfectaKey: number;       // #1 over top 5 for 2nd/3rd/4th
}

interface RaceComparison {
  trackCode: string;
  raceNumber: number;

  // Actual result
  actualWinner: number; // post position
  actualExacta: [number, number];
  actualTrifecta: [number, number, number];

  // Algorithm predictions
  algorithmPick: number; // post position
  algorithmTop3: number[];
  algorithmCorrect: boolean;
  algorithmInTop3: boolean;
  algorithmExactaHit: boolean;
  algorithmTrifectaHit: boolean;

  // AI predictions
  aiPick: number | null;
  aiTop3: number[];
  aiCorrect: boolean;
  aiInTop3: boolean;
  aiExactaHit: boolean;
  aiTrifectaHit: boolean;

  // Comparison
  agreedOnWinner: boolean;
  aiDisagreedAndWon: boolean;
  aiDisagreedAndLost: boolean;

  // Timing
  aiProcessingMs: number;

  // AI flags
  aiConfidence: string;
  aiFlaggedVulnerableFavorite: boolean;
  aiFlaggedLikelyUpset: boolean;

  // Algorithm exotic bets
  algorithmExotics: ExoticBetResults;

  // AI exotic bets
  aiExotics: ExoticBetResults;
}

interface TestSummary {
  totalRaces: number;
  totalProcessingTimeMs: number;
  averageProcessingTimeMs: number;

  algorithm: {
    winRate: number;
    top3Rate: number;
    exactaRate: number;
    trifectaRate: number;
    wins: number;
    top3Hits: number;
    exactaHits: number;
    trifectaHits: number;
  };

  ai: {
    winRate: number;
    top3Rate: number;
    exactaRate: number;
    trifectaRate: number;
    wins: number;
    top3Hits: number;
    exactaHits: number;
    trifectaHits: number;
    skippedRaces: number;
  };

  comparison: {
    agreedCount: number;
    agreedBothCorrect: number;
    agreedBothWrong: number;
    disagreedCount: number;
    aiDisagreedAndWon: number;
    aiDisagreedAndLost: number;
    algorithmWonDisagreement: number;
  };

  aiFlags: {
    vulnerableFavoritesCalled: number;
    vulnerableFavoritesCorrect: number;
    likelyUpsetsCalled: number;
    likelyUpsetsCorrect: number;
  };

  algorithmExotics: ExoticBetResults;
  aiExotics: ExoticBetResults;
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

function discoverTestFiles(): { drfPath: string; resultsPath: string; trackCode: string }[] {
  const dataDir = path.join(__dirname, '../../data');
  const files = fs.readdirSync(dataDir);

  const drfFiles = files.filter((f) => f.endsWith('.DRF') && f !== 'sample.DRF');

  return drfFiles
    .map((drfFile) => {
      const trackCode = drfFile.replace('.DRF', '');
      const resultsFile = `${trackCode}_results.txt`;
      const resultsPath = path.join(dataDir, resultsFile);

      if (!fs.existsSync(resultsPath)) {
        return null;
      }

      return {
        drfPath: path.join(dataDir, drfFile),
        resultsPath,
        trackCode,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

// ============================================================================
// RESULTS PARSER
// ============================================================================

function parseResultsFile(filePath: string): RaceResult[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Normalize unicode spaces
  const normalizedContent = content.replace(/\u202F/g, ' ');
  const lines = normalizedContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: RaceResult[] = [];
  let currentRace: RaceResult | null = null;

  for (const line of lines) {
    // Race header
    const raceMatch = line.match(/^RACE\s+(\d+)/i);
    if (raceMatch) {
      if (currentRace) {
        results.push(currentRace);
      }
      currentRace = {
        raceNumber: parseInt(raceMatch[1], 10),
        positions: [],
        scratches: [],
      };
      continue;
    }

    if (!currentRace) continue;

    // Position lines (1st, 2nd, 3rd, 4th)
    const posMatch = line.match(/^(1st|2nd|3rd|4th):\s*(\d+)?\s*(.+)?$/i);
    if (posMatch) {
      const post = posMatch[2] ? parseInt(posMatch[2], 10) : 0;
      const name = posMatch[3]?.trim() || 'N/A';
      if (post > 0 && name !== 'N/A') {
        currentRace.positions.push({ post, horseName: name });
      }
      continue;
    }

    // Scratches
    const scratchMatch = line.match(/^SCRATCHED:\s*(.+)$/i);
    if (scratchMatch) {
      const scratchText = scratchMatch[1].trim().toLowerCase();
      if (scratchText !== 'none' && scratchText !== '(none)') {
        // Parse scratched horses: "4 Barnstorming, 7 Another Horse"
        const scratchParts = scratchMatch[1].split(/[,;]/);
        for (const part of scratchParts) {
          const scratchHorseMatch = part.trim().match(/^(\d+)\s+(.+)$/);
          if (scratchHorseMatch) {
            currentRace.scratches.push({
              post: parseInt(scratchHorseMatch[1], 10),
              horseName: scratchHorseMatch[2].trim(),
            });
          }
        }
      }
    }
  }

  if (currentRace) {
    results.push(currentRace);
  }

  return results;
}

// ============================================================================
// SCORING RESULT CONVERSION
// ============================================================================

/**
 * Convert ScoredHorse[] to RaceScoringResult format for AI service
 */
function convertToRaceScoringResult(
  scoredHorses: ScoredHorse[],
  horses: HorseEntry[]
): RaceScoringResult {
  // Sort by rank for HorseScoreForAI
  const sortedByRank = [...scoredHorses]
    .filter((h) => !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  const scores: HorseScoreForAI[] = sortedByRank.map((sh) => {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    // Extract positive factors
    if (sh.score.breakdown.speedClass.speedScore >= 80) {
      positiveFactors.push('Strong speed figures');
    }
    if (sh.score.breakdown.form.wonLastOut) {
      positiveFactors.push('Won last race');
    }
    if (sh.score.breakdown.connections.total >= 18) {
      positiveFactors.push('Strong connections');
    }
    if (sh.score.breakdown.pace.paceFit === 'ideal' || sh.score.breakdown.pace.total >= 28) {
      positiveFactors.push('Favorable pace fit');
    }
    if (sh.score.breakdown.trackSpecialist?.isSpecialist) {
      positiveFactors.push('Track specialist');
    }
    if (sh.score.breakdown.form.formTrend === 'improving') {
      positiveFactors.push('Improving form');
    }

    // Extract negative factors
    if (sh.score.breakdown.speedClass.speedScore < 40) {
      negativeFactors.push('Weak speed figures');
    }
    if (sh.score.breakdown.form.formTrend === 'declining') {
      negativeFactors.push('Declining form');
    }
    if (sh.score.breakdown.postPosition.total < 4) {
      negativeFactors.push('Poor post position');
    }
    if (sh.score.dataCompleteness?.isLowConfidence) {
      negativeFactors.push('Limited data');
    }

    return {
      programNumber: sh.horse.postPosition,
      horseName: sh.horse.horseName,
      rank: sh.rank,
      finalScore: sh.score.total,
      confidenceTier: sh.score.confidenceLevel,
      breakdown: {
        speedScore: sh.score.breakdown.speedClass.speedScore,
        classScore: sh.score.breakdown.speedClass.classScore,
        formScore: sh.score.breakdown.form.total,
        paceScore: sh.score.breakdown.pace.total,
        connectionScore: sh.score.breakdown.connections.total,
      },
      positiveFactors,
      negativeFactors,
      isScratched: false,
    };
  });

  // Build race analysis
  const activeHorses = horses.filter((h) => !h.isScratched);
  const paceScenario = analyzePaceScenario(activeHorses);

  // Determine field strength based on average scores
  const avgScore = sortedByRank.reduce((sum, sh) => sum + sh.score.total, 0) / sortedByRank.length;
  let fieldStrength: 'elite' | 'strong' | 'average' | 'weak' = 'average';
  if (avgScore >= 220) fieldStrength = 'elite';
  else if (avgScore >= 180) fieldStrength = 'strong';
  else if (avgScore < 140) fieldStrength = 'weak';

  // Check if favorite is vulnerable (top scorer not far ahead of 2nd)
  const topScore = sortedByRank[0]?.score.total || 0;
  const secondScore = sortedByRank[1]?.score.total || 0;
  const vulnerableFavorite = topScore - secondScore < 10;

  // Check for likely pace collapse (many early speed types)
  const likelyPaceCollapse = paceScenario.scenario === 'speed_duel' || paceScenario.ppi > 70;

  const raceAnalysis: RaceAnalysis = {
    paceScenario: {
      expectedPace: paceScenario.scenario,
      likelyLeader: paceScenario.likelyLeader || sortedByRank[0]?.horse.postPosition || 1,
      speedDuelProbability: paceScenario.ppi / 100,
      earlySpeedCount: paceScenario.styleBreakdown?.earlySpeed?.length || 0,
    },
    fieldStrength,
    vulnerableFavorite,
    likelyPaceCollapse,
  };

  return {
    scores,
    raceAnalysis,
  };
}

// ============================================================================
// COMPARISON LOGIC
// ============================================================================

function checkExactaHit(predicted: number[], actual: [number, number]): boolean {
  return predicted.length >= 2 && predicted[0] === actual[0] && predicted[1] === actual[1];
}

function checkTrifectaHit(predicted: number[], actual: [number, number, number]): boolean {
  return (
    predicted.length >= 3 &&
    predicted[0] === actual[0] &&
    predicted[1] === actual[1] &&
    predicted[2] === actual[2]
  );
}

function checkTop3Contains(predicted: number[], actualWinner: number): boolean {
  return predicted.slice(0, 3).includes(actualWinner);
}

// Check exacta box: top N picks contain the actual 1-2
function checkExactaBox(predictedTop: number[], actual1st: number, actual2nd: number, boxSize: number): boolean {
  const topN = new Set(predictedTop.slice(0, boxSize));
  return topN.has(actual1st) && topN.has(actual2nd);
}

// Check trifecta box: top N picks contain the actual 1-2-3
function checkTrifectaBox(predictedTop: number[], actual: [number, number, number], boxSize: number): boolean {
  const topN = new Set(predictedTop.slice(0, boxSize));
  return actual.every(pos => topN.has(pos));
}

// Check trifecta key: #1 pick wins, any of top N fill 2nd and 3rd
function checkTrifectaKey(predictedTop: number[], actual: [number, number, number], keyOverSize: number): boolean {
  if (predictedTop[0] !== actual[0]) return false; // Key horse must win
  const others = new Set(predictedTop.slice(1, keyOverSize));
  return others.has(actual[1]) && others.has(actual[2]);
}

// Check superfecta box: top N picks contain actual 1-2-3-4
function checkSuperfectaBox(predictedTop: number[], actual: [number, number, number, number], boxSize: number): boolean {
  const topN = new Set(predictedTop.slice(0, boxSize));
  return actual.every(pos => topN.has(pos));
}

// Check superfecta key: #1 pick wins, any of top N fill 2nd/3rd/4th
function checkSuperfectaKey(predictedTop: number[], actual: [number, number, number, number], keyOverSize: number): boolean {
  if (predictedTop[0] !== actual[0]) return false;
  const others = new Set(predictedTop.slice(1, keyOverSize));
  return others.has(actual[1]) && others.has(actual[2]) && others.has(actual[3]);
}

// ============================================================================
// MAIN TEST
// ============================================================================

describe('AI vs Algorithm Validation', () => {
  const testFiles = discoverTestFiles();
  const allComparisons: RaceComparison[] = [];
  let totalAITime = 0;
  let aiSkippedCount = 0;
  let totalRacesToProcess = 0; // Set during test execution for ETA calculation

  beforeAll(() => {
    // Debug: Log environment status
    console.log('\n=== AI SERVICE ENVIRONMENT CHECK ===');
    console.log('process.env.VITE_GEMINI_API_KEY exists:', !!process.env.VITE_GEMINI_API_KEY);
    console.log('API key length:', process.env.VITE_GEMINI_API_KEY?.length || 0);

    const status = checkAIServiceStatus();
    console.log('AI Service Status:', status);
    console.log('=====================================\n');

    if (status === 'offline') {
      console.warn('\n⚠️  AI SERVICE IS OFFLINE - AI predictions will be skipped\n');
    }
  });

  // Process each track file
  for (const { drfPath, resultsPath, trackCode } of testFiles) {
    describe(`Track: ${trackCode}`, () => {
      it(`should compare algorithm vs AI for all races`, async () => {
        // Parse DRF
        const drfContent = fs.readFileSync(drfPath, 'utf-8');
        const parsed = parseDRFFile(drfContent, path.basename(drfPath));

        // Parse results
        const results = parseResultsFile(resultsPath);

        // Calculate total races for ETA (only races with valid results)
        const racesWithResults = parsed.races.filter(race => {
          const raceResult = results.find((r) => r.raceNumber === race.header.raceNumber);
          return raceResult && raceResult.positions.length >= 3;
        });
        totalRacesToProcess = racesWithResults.length;

        console.log(`  Processing ${totalRacesToProcess} races from ${trackCode}...`);

        // Process each race
        for (const race of parsed.races) {
          const raceResult = results.find((r) => r.raceNumber === race.header.raceNumber);
          if (!raceResult || raceResult.positions.length < 3) {
            continue; // Skip races without results
          }

          // Apply scratches
          const scratchedPosts = new Set(raceResult.scratches.map((s) => s.post));
          for (const entry of race.horses) {
            if (scratchedPosts.has(entry.postPosition)) {
              entry.isScratched = true;
            }
          }

          // Get actual results
          const actualWinner = raceResult.positions[0]?.post || 0;
          const actualExacta: [number, number] = [
            raceResult.positions[0]?.post || 0,
            raceResult.positions[1]?.post || 0,
          ];
          const actualTrifecta: [number, number, number] = [
            raceResult.positions[0]?.post || 0,
            raceResult.positions[1]?.post || 0,
            raceResult.positions[2]?.post || 0,
          ];

          // Set up scoring parameters
          const trackCondition: TrackCondition = {
            surface: race.header.surface,
            condition: race.header.condition || 'fast',
            variant: 0,
          };

          const getOdds = (index: number, originalOdds: string) => {
            return originalOdds || race.horses[index]?.morningLineOdds || '5-1';
          };

          const isScratched = (index: number) => {
            const horse = race.horses[index];
            if (!horse) return false;
            return scratchedPosts.has(horse.postPosition);
          };

          // Run algorithm
          const scoredHorses = calculateRaceScores(
            race.horses,
            race.header,
            getOdds,
            isScratched,
            trackCondition
          );

          const algorithmRanked = [...scoredHorses]
            .filter((s) => !s.score.isScratched)
            .sort((a, b) => a.rank - b.rank);

          const algorithmPick = algorithmRanked[0]?.horse.postPosition || 0;
          const algorithmTop3 = algorithmRanked.slice(0, 3).map((s) => s.horse.postPosition);

          // Run AI
          let aiAnalysis: AIRaceAnalysis | null = null;
          let aiProcessingMs = 0;

          const aiStatus = checkAIServiceStatus();
          if (aiStatus === 'ready') {
            try {
              const startTime = Date.now();

              // Convert to RaceScoringResult format
              const scoringResult = convertToRaceScoringResult(scoredHorses, race.horses);

              // Call AI service with retry logic for rate limits
              aiAnalysis = await callAIWithRetry(race, scoringResult);

              aiProcessingMs = Date.now() - startTime;
              totalAITime += aiProcessingMs;

              // Throttle to avoid rate limits
              await delay(DELAY_BETWEEN_CALLS_MS);
            } catch (err) {
              console.warn(`AI failed for ${trackCode} R${race.header.raceNumber}:`, err);
              aiSkippedCount++;
            }
          } else {
            aiSkippedCount++;
          }

          // Extract AI predictions
          let aiPick: number | null = null;
          let aiTop3: number[] = [];

          if (aiAnalysis) {
            aiPick = aiAnalysis.topPick;
            aiTop3 = aiAnalysis.horseInsights
              .sort((a, b) => a.projectedFinish - b.projectedFinish)
              .slice(0, 3)
              .map((h) => h.programNumber);
          }

          // Get actual top 4 (for superfecta)
          const actual4th = raceResult.positions[3]?.post || 0;
          const actualSuperfecta: [number, number, number, number] = [
            actualWinner, actualExacta[1], actualTrifecta[2], actual4th
          ];

          // Calculate algorithm exotic hits
          const algoTop5 = algorithmRanked.slice(0, 5).map(s => s.horse.postPosition);
          const algorithmExotics: ExoticBetResults = {
            exactaStraight: checkExactaHit(algorithmTop3, actualExacta) ? 1 : 0,
            exactaBox2: checkExactaBox(algoTop5, actualWinner, actualExacta[1], 2) ? 1 : 0,
            exactaBox3: checkExactaBox(algoTop5, actualWinner, actualExacta[1], 3) ? 1 : 0,
            exactaBox4: checkExactaBox(algoTop5, actualWinner, actualExacta[1], 4) ? 1 : 0,
            trifectaStraight: checkTrifectaHit(algorithmTop3, actualTrifecta) ? 1 : 0,
            trifectaBox3: checkTrifectaBox(algoTop5, actualTrifecta, 3) ? 1 : 0,
            trifectaBox4: checkTrifectaBox(algoTop5, actualTrifecta, 4) ? 1 : 0,
            trifectaBox5: checkTrifectaBox(algoTop5, actualTrifecta, 5) ? 1 : 0,
            trifectaKey: checkTrifectaKey(algoTop5, actualTrifecta, 5) ? 1 : 0,
            superfectaStraight: actual4th > 0 && algoTop5[0] === actualWinner && algoTop5[1] === actualExacta[1] && algoTop5[2] === actualTrifecta[2] && algoTop5[3] === actual4th ? 1 : 0,
            superfectaBox4: actual4th > 0 ? (checkSuperfectaBox(algoTop5, actualSuperfecta, 4) ? 1 : 0) : 0,
            superfectaBox5: actual4th > 0 ? (checkSuperfectaBox(algoTop5, actualSuperfecta, 5) ? 1 : 0) : 0,
            superfectaKey: actual4th > 0 ? (checkSuperfectaKey(algoTop5, actualSuperfecta, 6) ? 1 : 0) : 0,
          };

          // Calculate AI exotic hits
          const aiTop5 = aiAnalysis
            ? aiAnalysis.horseInsights
                .sort((a, b) => a.projectedFinish - b.projectedFinish)
                .slice(0, 5)
                .map(h => h.programNumber)
            : [];

          const aiExotics: ExoticBetResults = aiTop5.length >= 5 ? {
            exactaStraight: checkExactaHit(aiTop3, actualExacta) ? 1 : 0,
            exactaBox2: checkExactaBox(aiTop5, actualWinner, actualExacta[1], 2) ? 1 : 0,
            exactaBox3: checkExactaBox(aiTop5, actualWinner, actualExacta[1], 3) ? 1 : 0,
            exactaBox4: checkExactaBox(aiTop5, actualWinner, actualExacta[1], 4) ? 1 : 0,
            trifectaStraight: checkTrifectaHit(aiTop3, actualTrifecta) ? 1 : 0,
            trifectaBox3: checkTrifectaBox(aiTop5, actualTrifecta, 3) ? 1 : 0,
            trifectaBox4: checkTrifectaBox(aiTop5, actualTrifecta, 4) ? 1 : 0,
            trifectaBox5: checkTrifectaBox(aiTop5, actualTrifecta, 5) ? 1 : 0,
            trifectaKey: checkTrifectaKey(aiTop5, actualTrifecta, 5) ? 1 : 0,
            superfectaStraight: actual4th > 0 && aiTop5[0] === actualWinner && aiTop5[1] === actualExacta[1] && aiTop5[2] === actualTrifecta[2] && aiTop5[3] === actual4th ? 1 : 0,
            superfectaBox4: actual4th > 0 ? (checkSuperfectaBox(aiTop5, actualSuperfecta, 4) ? 1 : 0) : 0,
            superfectaBox5: actual4th > 0 ? (checkSuperfectaBox(aiTop5, actualSuperfecta, 5) ? 1 : 0) : 0,
            superfectaKey: actual4th > 0 ? (checkSuperfectaKey(aiTop5, actualSuperfecta, 6) ? 1 : 0) : 0,
          } : {
            exactaStraight: 0, exactaBox2: 0, exactaBox3: 0, exactaBox4: 0,
            trifectaStraight: 0, trifectaBox3: 0, trifectaBox4: 0, trifectaBox5: 0, trifectaKey: 0,
            superfectaStraight: 0, superfectaBox4: 0, superfectaBox5: 0, superfectaKey: 0,
          };

          // Build comparison
          const comparison: RaceComparison = {
            trackCode,
            raceNumber: race.header.raceNumber,

            actualWinner,
            actualExacta,
            actualTrifecta,

            algorithmPick,
            algorithmTop3,
            algorithmCorrect: algorithmPick === actualWinner,
            algorithmInTop3: checkTop3Contains(algorithmTop3, actualWinner),
            algorithmExactaHit: checkExactaHit(algorithmTop3, actualExacta),
            algorithmTrifectaHit: checkTrifectaHit(algorithmTop3, actualTrifecta),

            aiPick,
            aiTop3,
            aiCorrect: aiPick === actualWinner,
            aiInTop3: aiTop3.length > 0 ? checkTop3Contains(aiTop3, actualWinner) : false,
            aiExactaHit: aiTop3.length > 0 ? checkExactaHit(aiTop3, actualExacta) : false,
            aiTrifectaHit: aiTop3.length > 0 ? checkTrifectaHit(aiTop3, actualTrifecta) : false,

            agreedOnWinner: algorithmPick === aiPick,
            aiDisagreedAndWon:
              aiPick !== null && aiPick !== algorithmPick && aiPick === actualWinner,
            aiDisagreedAndLost:
              aiPick !== null &&
              aiPick !== algorithmPick &&
              aiPick !== actualWinner &&
              algorithmPick === actualWinner,

            aiProcessingMs,
            aiConfidence: aiAnalysis?.confidence || 'N/A',
            aiFlaggedVulnerableFavorite: aiAnalysis?.vulnerableFavorite || false,
            aiFlaggedLikelyUpset: aiAnalysis?.likelyUpset || false,

            algorithmExotics,
            aiExotics,
          };

          allComparisons.push(comparison);

          // Log progress with ETA
          const racesProcessed = allComparisons.length;
          const estimatedRemainingMs = (totalRacesToProcess - racesProcessed) * (DELAY_BETWEEN_CALLS_MS + 3000);
          const estimatedRemainingMin = Math.ceil(estimatedRemainingMs / 60000);
          const algoResult = comparison.algorithmCorrect ? '\u2713' : '\u2717';
          const aiResult = comparison.aiCorrect ? '\u2713' : '\u2717';
          console.log(
            `  [${racesProcessed}/${totalRacesToProcess}] ${trackCode} R${race.header.raceNumber}: Algo=${algorithmPick} AI=${aiPick || 'skip'} Actual=${actualWinner} ${algoResult}/${aiResult} | ETA: ~${estimatedRemainingMin}min`
          );
        }

        expect(true).toBe(true); // Test passes if we get here
      }, 600000); // 10 minute timeout per track (throttled execution)
    });
  }

  // Final summary
  describe('Summary', () => {
    it('should generate comparison report', () => {
      const totalRaces = allComparisons.length;

      if (totalRaces === 0) {
        console.log('\n\u26A0\uFE0F  No races were processed\n');
        return;
      }

      // Algorithm stats
      const algoWins = allComparisons.filter((c) => c.algorithmCorrect).length;
      const algoTop3 = allComparisons.filter((c) => c.algorithmInTop3).length;
      const algoExacta = allComparisons.filter((c) => c.algorithmExactaHit).length;
      const algoTrifecta = allComparisons.filter((c) => c.algorithmTrifectaHit).length;

      // AI stats (only count races where AI ran)
      const aiRaces = allComparisons.filter((c) => c.aiPick !== null);
      const aiWins = aiRaces.filter((c) => c.aiCorrect).length;
      const aiTop3 = aiRaces.filter((c) => c.aiInTop3).length;
      const aiExacta = aiRaces.filter((c) => c.aiExactaHit).length;
      const aiTrifecta = aiRaces.filter((c) => c.aiTrifectaHit).length;

      // Comparison stats
      const agreed = allComparisons.filter((c) => c.agreedOnWinner && c.aiPick !== null);
      const disagreed = allComparisons.filter((c) => !c.agreedOnWinner && c.aiPick !== null);
      const aiDisagreedWon = allComparisons.filter((c) => c.aiDisagreedAndWon).length;
      const aiDisagreedLost = allComparisons.filter((c) => c.aiDisagreedAndLost).length;
      const agreedBothCorrect = agreed.filter((c) => c.algorithmCorrect).length;
      const agreedBothWrong = agreed.filter((c) => !c.algorithmCorrect).length;

      // AI flag stats
      const vulnFavCalled = allComparisons.filter((c) => c.aiFlaggedVulnerableFavorite);
      const vulnFavCorrect = vulnFavCalled.filter((c) => !c.algorithmCorrect).length; // Favorite lost
      const upsetCalled = allComparisons.filter((c) => c.aiFlaggedLikelyUpset);
      const upsetCorrect = upsetCalled.filter((c) => c.aiCorrect && !c.algorithmCorrect).length;

      // Aggregate exotic results
      const algoExoticTotals: ExoticBetResults = {
        exactaStraight: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.exactaStraight, 0),
        exactaBox2: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.exactaBox2, 0),
        exactaBox3: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.exactaBox3, 0),
        exactaBox4: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.exactaBox4, 0),
        trifectaStraight: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.trifectaStraight, 0),
        trifectaBox3: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.trifectaBox3, 0),
        trifectaBox4: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.trifectaBox4, 0),
        trifectaBox5: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.trifectaBox5, 0),
        trifectaKey: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.trifectaKey, 0),
        superfectaStraight: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.superfectaStraight, 0),
        superfectaBox4: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.superfectaBox4, 0),
        superfectaBox5: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.superfectaBox5, 0),
        superfectaKey: allComparisons.reduce((sum, c) => sum + c.algorithmExotics.superfectaKey, 0),
      };

      const aiExoticTotals: ExoticBetResults = {
        exactaStraight: allComparisons.reduce((sum, c) => sum + c.aiExotics.exactaStraight, 0),
        exactaBox2: allComparisons.reduce((sum, c) => sum + c.aiExotics.exactaBox2, 0),
        exactaBox3: allComparisons.reduce((sum, c) => sum + c.aiExotics.exactaBox3, 0),
        exactaBox4: allComparisons.reduce((sum, c) => sum + c.aiExotics.exactaBox4, 0),
        trifectaStraight: allComparisons.reduce((sum, c) => sum + c.aiExotics.trifectaStraight, 0),
        trifectaBox3: allComparisons.reduce((sum, c) => sum + c.aiExotics.trifectaBox3, 0),
        trifectaBox4: allComparisons.reduce((sum, c) => sum + c.aiExotics.trifectaBox4, 0),
        trifectaBox5: allComparisons.reduce((sum, c) => sum + c.aiExotics.trifectaBox5, 0),
        trifectaKey: allComparisons.reduce((sum, c) => sum + c.aiExotics.trifectaKey, 0),
        superfectaStraight: allComparisons.reduce((sum, c) => sum + c.aiExotics.superfectaStraight, 0),
        superfectaBox4: allComparisons.reduce((sum, c) => sum + c.aiExotics.superfectaBox4, 0),
        superfectaBox5: allComparisons.reduce((sum, c) => sum + c.aiExotics.superfectaBox5, 0),
        superfectaKey: allComparisons.reduce((sum, c) => sum + c.aiExotics.superfectaKey, 0),
      };

      const summary: TestSummary = {
        totalRaces,
        totalProcessingTimeMs: totalAITime,
        averageProcessingTimeMs: aiRaces.length > 0 ? Math.round(totalAITime / aiRaces.length) : 0,

        algorithm: {
          wins: algoWins,
          winRate: Math.round((algoWins / totalRaces) * 1000) / 10,
          top3Hits: algoTop3,
          top3Rate: Math.round((algoTop3 / totalRaces) * 1000) / 10,
          exactaHits: algoExacta,
          exactaRate: Math.round((algoExacta / totalRaces) * 1000) / 10,
          trifectaHits: algoTrifecta,
          trifectaRate: Math.round((algoTrifecta / totalRaces) * 1000) / 10,
        },

        ai: {
          wins: aiWins,
          winRate: aiRaces.length > 0 ? Math.round((aiWins / aiRaces.length) * 1000) / 10 : 0,
          top3Hits: aiTop3,
          top3Rate: aiRaces.length > 0 ? Math.round((aiTop3 / aiRaces.length) * 1000) / 10 : 0,
          exactaHits: aiExacta,
          exactaRate: aiRaces.length > 0 ? Math.round((aiExacta / aiRaces.length) * 1000) / 10 : 0,
          trifectaHits: aiTrifecta,
          trifectaRate:
            aiRaces.length > 0 ? Math.round((aiTrifecta / aiRaces.length) * 1000) / 10 : 0,
          skippedRaces: aiSkippedCount,
        },

        comparison: {
          agreedCount: agreed.length,
          agreedBothCorrect,
          agreedBothWrong,
          disagreedCount: disagreed.length,
          aiDisagreedAndWon: aiDisagreedWon,
          aiDisagreedAndLost: aiDisagreedLost,
          algorithmWonDisagreement: aiDisagreedLost,
        },

        aiFlags: {
          vulnerableFavoritesCalled: vulnFavCalled.length,
          vulnerableFavoritesCorrect: vulnFavCorrect,
          likelyUpsetsCalled: upsetCalled.length,
          likelyUpsetsCorrect: upsetCorrect,
        },

        algorithmExotics: algoExoticTotals,
        aiExotics: aiExoticTotals,
      };

      // Print report
      console.log('\n' + '='.repeat(70));
      console.log('                    AI vs ALGORITHM COMPARISON REPORT');
      console.log('='.repeat(70));

      console.log(`\nTOTAL RACES: ${summary.totalRaces}`);
      console.log(`TOTAL AI PROCESSING TIME: ${(summary.totalProcessingTimeMs / 1000).toFixed(1)}s`);
      console.log(`AVERAGE AI TIME PER RACE: ${summary.averageProcessingTimeMs}ms`);
      if (summary.ai.skippedRaces > 0) {
        console.log(`AI SKIPPED RACES: ${summary.ai.skippedRaces}`);
      }

      console.log('\n' + '-'.repeat(70));
      console.log('                         WIN RATE COMPARISON');
      console.log('-'.repeat(70));
      console.log(`                    ALGORITHM        AI           DIFF`);
      console.log(
        `Win Rate:           ${summary.algorithm.winRate.toFixed(1)}%           ${summary.ai.winRate.toFixed(1)}%         ${(summary.ai.winRate - summary.algorithm.winRate) >= 0 ? '+' : ''}${(summary.ai.winRate - summary.algorithm.winRate).toFixed(1)}%`
      );
      console.log(
        `Top 3 Rate:         ${summary.algorithm.top3Rate.toFixed(1)}%           ${summary.ai.top3Rate.toFixed(1)}%         ${(summary.ai.top3Rate - summary.algorithm.top3Rate) >= 0 ? '+' : ''}${(summary.ai.top3Rate - summary.algorithm.top3Rate).toFixed(1)}%`
      );
      console.log(
        `Exacta Rate:        ${summary.algorithm.exactaRate.toFixed(1)}%            ${summary.ai.exactaRate.toFixed(1)}%          ${(summary.ai.exactaRate - summary.algorithm.exactaRate) >= 0 ? '+' : ''}${(summary.ai.exactaRate - summary.algorithm.exactaRate).toFixed(1)}%`
      );
      console.log(
        `Trifecta Rate:      ${summary.algorithm.trifectaRate.toFixed(1)}%            ${summary.ai.trifectaRate.toFixed(1)}%          ${(summary.ai.trifectaRate - summary.algorithm.trifectaRate) >= 0 ? '+' : ''}${(summary.ai.trifectaRate - summary.algorithm.trifectaRate).toFixed(1)}%`
      );

      console.log('\n' + '-'.repeat(70));
      console.log('                         AGREEMENT ANALYSIS');
      console.log('-'.repeat(70));
      console.log(`Times AI agreed with Algorithm:     ${summary.comparison.agreedCount}`);
      console.log(`  - Both correct:                   ${summary.comparison.agreedBothCorrect}`);
      console.log(`  - Both wrong:                     ${summary.comparison.agreedBothWrong}`);
      console.log(`Times AI disagreed with Algorithm:  ${summary.comparison.disagreedCount}`);
      console.log(
        `  - AI was right, Algorithm wrong:  ${summary.comparison.aiDisagreedAndWon} \uD83C\uDFAF`
      );
      console.log(
        `  - Algorithm was right, AI wrong:  ${summary.comparison.algorithmWonDisagreement}`
      );

      console.log('\n' + '-'.repeat(70));
      console.log('                         AI FLAG ACCURACY');
      console.log('-'.repeat(70));
      console.log(
        `"Vulnerable Favorite" flags:        ${summary.aiFlags.vulnerableFavoritesCalled}`
      );
      console.log(
        `  - Favorite actually lost:         ${summary.aiFlags.vulnerableFavoritesCorrect} (${summary.aiFlags.vulnerableFavoritesCalled > 0 ? Math.round((summary.aiFlags.vulnerableFavoritesCorrect / summary.aiFlags.vulnerableFavoritesCalled) * 100) : 0}%)`
      );
      console.log(`"Likely Upset" flags:               ${summary.aiFlags.likelyUpsetsCalled}`);
      console.log(
        `  - AI pick won (algo didn't):      ${summary.aiFlags.likelyUpsetsCorrect} (${summary.aiFlags.likelyUpsetsCalled > 0 ? Math.round((summary.aiFlags.likelyUpsetsCorrect / summary.aiFlags.likelyUpsetsCalled) * 100) : 0}%)`
      );

      console.log('\n' + '-'.repeat(70));
      console.log('                         EXOTIC BET RESULTS');
      console.log('-'.repeat(70));
      console.log(`                        ALGORITHM    AI       DIFF`);
      console.log(`EXACTA:`);
      console.log(`  Straight (#1-#2):      ${algoExoticTotals.exactaStraight}/${totalRaces}        ${aiExoticTotals.exactaStraight}/${totalRaces}     ${aiExoticTotals.exactaStraight - algoExoticTotals.exactaStraight >= 0 ? '+' : ''}${aiExoticTotals.exactaStraight - algoExoticTotals.exactaStraight}`);
      console.log(`  Box 2 (top 2):         ${algoExoticTotals.exactaBox2}/${totalRaces}        ${aiExoticTotals.exactaBox2}/${totalRaces}     ${aiExoticTotals.exactaBox2 - algoExoticTotals.exactaBox2 >= 0 ? '+' : ''}${aiExoticTotals.exactaBox2 - algoExoticTotals.exactaBox2}`);
      console.log(`  Box 3 (top 3):         ${algoExoticTotals.exactaBox3}/${totalRaces}        ${aiExoticTotals.exactaBox3}/${totalRaces}     ${aiExoticTotals.exactaBox3 - algoExoticTotals.exactaBox3 >= 0 ? '+' : ''}${aiExoticTotals.exactaBox3 - algoExoticTotals.exactaBox3}`);
      console.log(`  Box 4 (top 4):         ${algoExoticTotals.exactaBox4}/${totalRaces}        ${aiExoticTotals.exactaBox4}/${totalRaces}     ${aiExoticTotals.exactaBox4 - algoExoticTotals.exactaBox4 >= 0 ? '+' : ''}${aiExoticTotals.exactaBox4 - algoExoticTotals.exactaBox4}`);
      console.log(`TRIFECTA:`);
      console.log(`  Straight (#1-#2-#3):   ${algoExoticTotals.trifectaStraight}/${totalRaces}        ${aiExoticTotals.trifectaStraight}/${totalRaces}     ${aiExoticTotals.trifectaStraight - algoExoticTotals.trifectaStraight >= 0 ? '+' : ''}${aiExoticTotals.trifectaStraight - algoExoticTotals.trifectaStraight}`);
      console.log(`  Box 3 (top 3):         ${algoExoticTotals.trifectaBox3}/${totalRaces}        ${aiExoticTotals.trifectaBox3}/${totalRaces}     ${aiExoticTotals.trifectaBox3 - algoExoticTotals.trifectaBox3 >= 0 ? '+' : ''}${aiExoticTotals.trifectaBox3 - algoExoticTotals.trifectaBox3}`);
      console.log(`  Box 4 (top 4):         ${algoExoticTotals.trifectaBox4}/${totalRaces}        ${aiExoticTotals.trifectaBox4}/${totalRaces}     ${aiExoticTotals.trifectaBox4 - algoExoticTotals.trifectaBox4 >= 0 ? '+' : ''}${aiExoticTotals.trifectaBox4 - algoExoticTotals.trifectaBox4}`);
      console.log(`  Box 5 (top 5):         ${algoExoticTotals.trifectaBox5}/${totalRaces}        ${aiExoticTotals.trifectaBox5}/${totalRaces}     ${aiExoticTotals.trifectaBox5 - algoExoticTotals.trifectaBox5 >= 0 ? '+' : ''}${aiExoticTotals.trifectaBox5 - algoExoticTotals.trifectaBox5}`);
      console.log(`  Key (#1 over 4):       ${algoExoticTotals.trifectaKey}/${totalRaces}        ${aiExoticTotals.trifectaKey}/${totalRaces}     ${aiExoticTotals.trifectaKey - algoExoticTotals.trifectaKey >= 0 ? '+' : ''}${aiExoticTotals.trifectaKey - algoExoticTotals.trifectaKey}`);
      console.log(`SUPERFECTA:`);
      console.log(`  Straight (#1-#2-#3-#4): ${algoExoticTotals.superfectaStraight}/${totalRaces}        ${aiExoticTotals.superfectaStraight}/${totalRaces}     ${aiExoticTotals.superfectaStraight - algoExoticTotals.superfectaStraight >= 0 ? '+' : ''}${aiExoticTotals.superfectaStraight - algoExoticTotals.superfectaStraight}`);
      console.log(`  Box 4 (top 4):         ${algoExoticTotals.superfectaBox4}/${totalRaces}        ${aiExoticTotals.superfectaBox4}/${totalRaces}     ${aiExoticTotals.superfectaBox4 - algoExoticTotals.superfectaBox4 >= 0 ? '+' : ''}${aiExoticTotals.superfectaBox4 - algoExoticTotals.superfectaBox4}`);
      console.log(`  Box 5 (top 5):         ${algoExoticTotals.superfectaBox5}/${totalRaces}        ${aiExoticTotals.superfectaBox5}/${totalRaces}     ${aiExoticTotals.superfectaBox5 - algoExoticTotals.superfectaBox5 >= 0 ? '+' : ''}${aiExoticTotals.superfectaBox5 - algoExoticTotals.superfectaBox5}`);
      console.log(`  Key (#1 over 5):       ${algoExoticTotals.superfectaKey}/${totalRaces}        ${aiExoticTotals.superfectaKey}/${totalRaces}     ${aiExoticTotals.superfectaKey - algoExoticTotals.superfectaKey >= 0 ? '+' : ''}${aiExoticTotals.superfectaKey - algoExoticTotals.superfectaKey}`);

      console.log('\n' + '='.repeat(70));
      console.log('                              VERDICT');
      console.log('='.repeat(70));

      const winDiff = summary.ai.winRate - summary.algorithm.winRate;
      if (winDiff > 2) {
        console.log(
          `\n\u2705 AI OUTPERFORMED ALGORITHM BY ${winDiff.toFixed(1)} PERCENTAGE POINTS`
        );
      } else if (winDiff < -2) {
        console.log(
          `\n\u274C ALGORITHM OUTPERFORMED AI BY ${Math.abs(winDiff).toFixed(1)} PERCENTAGE POINTS`
        );
      } else {
        console.log(`\n\u2796 AI AND ALGORITHM PERFORMED SIMILARLY (within 2%)`);
      }

      if (summary.comparison.aiDisagreedAndWon > summary.comparison.algorithmWonDisagreement) {
        console.log(
          `\u2705 When they disagreed, AI was right more often (${summary.comparison.aiDisagreedAndWon} vs ${summary.comparison.algorithmWonDisagreement})`
        );
      } else if (
        summary.comparison.aiDisagreedAndWon < summary.comparison.algorithmWonDisagreement
      ) {
        console.log(
          `\u274C When they disagreed, Algorithm was right more often (${summary.comparison.algorithmWonDisagreement} vs ${summary.comparison.aiDisagreedAndWon})`
        );
      }

      console.log('\n' + '='.repeat(70) + '\n');

      // Save detailed results to file
      const outputPath = path.join(__dirname, '../../data/ai_comparison_results.json');
      fs.writeFileSync(
        outputPath,
        JSON.stringify(
          {
            summary,
            comparisons: allComparisons,
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
      console.log(`Detailed results saved to: ${outputPath}\n`);

      expect(totalRaces).toBeGreaterThan(0);
    }, 10000);
  });
});
