#!/usr/bin/env npx ts-node
/**
 * AI Validation Runner
 *
 * Runs AI analysis on all races from existing DRF files, records metrics,
 * and generates a comprehensive comparison report against the algorithm baseline.
 *
 * Usage:
 *   npm run validate:ai
 *   npm run validate:ai -- --fresh (force restart, ignore progress)
 *
 * Algorithm Baseline:
 *   - Win Rate: 16.2%
 *   - Top-3 Rate: 48.6%
 *   - Exacta Box 4: 33.3%
 *   - Trifecta Box 5: 37.8%
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseDRFFile } from '../../lib/drfParser';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { calculateRaceScores, analyzePaceScenario } from '../../lib/scoring';
import { getMultiBotAnalysis, checkAIServiceStatus } from '../../services/ai';
import {
  calculatePerformanceMetrics,
  buildDecisionRecord,
  saveDecisionRecord,
  getAllDecisionRecords,
  initializeMetricsStorage,
  resetStorageForTesting,
} from '../../services/ai/metrics';
import type { ParsedRace, HorseEntry } from '../../types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../../types/scoring';
import type { ScoredHorse } from '../../lib/scoring';
import type { TrackCondition } from '../../hooks/useRaceState';
import type { AIDecisionRecord, AIPerformanceMetrics } from '../../services/ai/metrics/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = path.join(__dirname, '../../data');
const RESULTS_DIR = path.join(__dirname, 'results');
const PROGRESS_FILE = path.join(RESULTS_DIR, 'ai_validation_progress.json');
const REPORT_FILE = path.join(RESULTS_DIR, 'ai_validation_report.md');
const METRICS_FILE = path.join(RESULTS_DIR, 'ai_validation_metrics.json');

// Delay between API calls (2 seconds as specified)
const API_DELAY_MS = 2000;
// Rate limit retry delay (30 seconds as specified)
const RATE_LIMIT_DELAY_MS = 30000;

// Algorithm baseline from requirements
const ALGORITHM_BASELINE = {
  winRate: 16.2,
  top3Rate: 48.6,
  exactaBox4Rate: 33.3,
  trifectaBox5Rate: 37.8,
  wins: 18, // 111 races * 16.2%
  top3Hits: 54, // 111 races * 48.6%
  exactaBox4Hits: 37, // 111 races * 33.3%
  trifectaBox5Hits: 42, // 111 races * 37.8%
};

// ============================================================================
// TYPES
// ============================================================================

interface RaceResult {
  raceNumber: number;
  positions: { post: number; horseName: string }[];
  scratches: { post: number; horseName: string }[];
}

interface ProgressData {
  version: string;
  lastUpdated: string;
  processedRaces: string[]; // raceIds that have been processed
  totalRaces: number;
  errors: Array<{ raceId: string; error: string; timestamp: string }>;
}

interface RaceData {
  race: ParsedRace;
  raceResult: RaceResult;
  trackCode: string;
  raceId: string;
}

interface ValidationSummary {
  totalRaces: number;
  processedRaces: number;
  errorRaces: number;
  startTime: string;
  endTime: string;
  totalTimeMs: number;
}

// ============================================================================
// API KEY CHECK
// ============================================================================

function checkApiKey(): boolean {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(`
╔══════════════════════════════════════════════════════════════════════╗
║                    ERROR: VITE_GEMINI_API_KEY not set                 ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  To run AI validation:                                               ║
║                                                                       ║
║  1. Get API key from https://makersuite.google.com/app/apikey        ║
║                                                                       ║
║  2. Add to .env file:                                                ║
║     VITE_GEMINI_API_KEY=your_key_here                                ║
║                                                                       ║
║  3. Run again:                                                       ║
║     npm run validate:ai                                              ║
║                                                                       ║
╚══════════════════════════════════════════════════════════════════════╝
`);
    return false;
  }

  const status = checkAIServiceStatus();
  if (status !== 'ready') {
    console.error(`\nAI Service Status: ${status}\n`);
    return false;
  }

  return true;
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

function discoverTestFiles(): { drfPath: string; resultsPath: string; trackCode: string }[] {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    return [];
  }

  const files = fs.readdirSync(DATA_DIR);
  const drfFiles = files.filter((f) => f.endsWith('.DRF') && f !== 'sample.DRF');

  return drfFiles
    .map((drfFile) => {
      const trackCode = drfFile.replace('.DRF', '');
      const resultsFile = `${trackCode}_results.txt`;
      const resultsPath = path.join(DATA_DIR, resultsFile);

      if (!fs.existsSync(resultsPath)) {
        console.warn(`  Warning: Results file not found for ${trackCode}, skipping...`);
        return null;
      }

      return {
        drfPath: path.join(DATA_DIR, drfFile),
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

    // Build the complete HorseScoreForAI object
    const horse = sh.horse;
    const horseScoreForAI: HorseScoreForAI = {
      programNumber: horse.postPosition,
      horseName: horse.horseName,
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
      morningLineOdds: horse.morningLineOdds || '5-1',
      morningLineDecimal: horse.morningLineDecimal || 5.0,
      pastPerformances: (horse.pastPerformances || []).slice(0, 3).map((pp) => ({
        date: pp.date,
        track: pp.track,
        distance: pp.distanceFurlongs,
        surface: pp.surface,
        trackCondition: pp.trackCondition,
        finishPosition: pp.finishPosition,
        fieldSize: pp.fieldSize,
        lengthsBehind: pp.lengthsBehind,
        beyer: pp.speedFigures?.beyer ?? null,
        earlyPace1: pp.earlyPace1 ?? null,
        latePace: pp.latePace ?? null,
        tripComment: pp.tripComment || '',
        odds: pp.odds ?? null,
        favoriteRank: pp.favoriteRank ?? null,
        runningLine: {
          start: pp.runningLine?.start ?? null,
          stretch: pp.runningLine?.stretch ?? null,
          finish: pp.runningLine?.finish ?? null,
        },
      })),
      workouts: (horse.workouts || []).slice(0, 3).map((w) => ({
        date: w.date,
        track: w.track,
        distanceFurlongs: w.distanceFurlongs,
        timeSeconds: w.timeSeconds,
        type: w.type || 'unknown',
        isBullet: w.isBullet,
        rankNumber: w.rankNumber ?? null,
        totalWorks: w.totalWorks ?? null,
      })),
      trainerPatterns: mapTrainerPatterns(horse),
      equipment: {
        blinkers: horse.equipment?.blinkers ?? false,
        blinkersOff: horse.equipment?.blinkersOff ?? false,
        frontBandages: horse.equipment?.frontBandages ?? false,
        tongueTie: horse.equipment?.tongueTie ?? false,
        nasalStrip: horse.equipment?.nasalStrip ?? false,
        shadowRoll: horse.equipment?.shadowRoll ?? false,
        barShoes: horse.equipment?.barShoes ?? false,
        mudCaulks: horse.equipment?.mudCaulks ?? false,
        firstTimeEquipment: horse.equipment?.firstTimeEquipment ?? [],
        equipmentChanges: horse.equipment?.equipmentChanges ?? [],
      },
      breeding: {
        sire: horse.breeding?.sire || '',
        damSire: horse.breeding?.damSire || '',
        whereBred: horse.breeding?.whereBred || '',
      },
      distanceSurfaceStats: {
        distanceStarts: horse.distanceStarts || 0,
        distanceWins: horse.distanceWins || 0,
        distanceWinRate: horse.distanceStarts ? horse.distanceWins / horse.distanceStarts : 0,
        surfaceStarts: horse.surfaceStarts || 0,
        surfaceWins: horse.surfaceWins || 0,
        surfaceWinRate: horse.surfaceStarts ? horse.surfaceWins / horse.surfaceStarts : 0,
        turfStarts: horse.turfStarts || 0,
        turfWins: horse.turfWins || 0,
        turfWinRate: horse.turfStarts ? horse.turfWins / horse.turfStarts : 0,
        wetStarts: horse.wetStarts || 0,
        wetWins: horse.wetWins || 0,
        wetWinRate: horse.wetStarts ? horse.wetWins / horse.wetStarts : 0,
      },
      formIndicators: {
        daysSinceLastRace: horse.daysSinceLastRace ?? null,
        averageBeyer: horse.averageBeyer ?? null,
        bestBeyer: horse.bestBeyer ?? null,
        lastBeyer: horse.lastBeyer ?? null,
        earlySpeedRating: horse.earlySpeedRating ?? null,
        lifetimeStarts: horse.lifetimeStarts || 0,
        lifetimeWins: horse.lifetimeWins || 0,
        lifetimeWinRate: horse.lifetimeStarts ? horse.lifetimeWins / horse.lifetimeStarts : 0,
      },
    };

    return horseScoreForAI;
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

  // Check if favorite is vulnerable
  const topScore = sortedByRank[0]?.score.total || 0;
  const secondScore = sortedByRank[1]?.score.total || 0;
  const vulnerableFavorite = topScore - secondScore < 10;

  // Check for likely pace collapse
  const likelyPaceCollapse = paceScenario.scenario === 'speed_duel' || paceScenario.ppi > 70;

  // Map pace scenario to expected pace type
  const mapPaceScenario = (scenario: string): 'hot' | 'moderate' | 'slow' | 'contested' => {
    switch (scenario) {
      case 'speed_duel':
      case 'lone_speed':
        return 'hot';
      case 'contested':
        return 'contested';
      case 'slow_pace':
        return 'slow';
      default:
        return 'moderate';
    }
  };

  // Get likely leader from early speed horses
  const likelyLeader =
    paceScenario.styleBreakdown?.earlySpeed?.[0] || sortedByRank[0]?.horse.postPosition || 1;

  const raceAnalysis: RaceAnalysis = {
    paceScenario: {
      expectedPace: mapPaceScenario(paceScenario.scenario),
      likelyLeader,
      speedDuelProbability: paceScenario.ppi / 100,
      earlySpeedCount: paceScenario.styleBreakdown?.earlySpeed?.length || 0,
    },
    fieldStrength,
    vulnerableFavorite,
    likelyPaceCollapse,
    trackIntelligence: null,
  };

  return {
    scores,
    raceAnalysis,
  };
}

/**
 * Map trainer category stats to AI format
 */
function mapTrainerPatterns(horse: HorseEntry) {
  const stats = horse.trainerCategoryStats;
  const mapStat = (s: { starts: number; wins: number; winPercent: number; roi: number }) => ({
    starts: s?.starts || 0,
    wins: s?.wins || 0,
    winPercent: s?.winPercent || 0,
    roi: s?.roi || 0,
  });

  return {
    firstTimeLasix: mapStat(stats?.firstTimeLasix),
    firstTimeBlinkers: mapStat(stats?.firstTimeBlinkers),
    blinkersOff: mapStat(stats?.blinkersOff),
    secondOffLayoff: mapStat(stats?.secondOffLayoff),
    days31to60: mapStat(stats?.days31to60),
    days61to90: mapStat(stats?.days61to90),
    days91to180: mapStat(stats?.days91to180),
    days181plus: mapStat(stats?.days181plus),
    sprintToRoute: mapStat(stats?.sprintToRoute),
    routeToSprint: mapStat(stats?.routeToSprint),
    turfSprint: mapStat(stats?.turfSprint),
    turfRoute: mapStat(stats?.turfRoute),
    wetTrack: mapStat(stats?.wetTrack),
    dirtSprint: mapStat(stats?.dirtSprint),
    dirtRoute: mapStat(stats?.dirtRoute),
    maidenClaiming: mapStat(stats?.maidenClaiming),
    stakes: mapStat(stats?.stakes),
    firstStartTrainer: mapStat(stats?.firstStartTrainer),
    afterClaim: mapStat(stats?.afterClaim),
  };
}

// ============================================================================
// PROGRESS MANAGEMENT
// ============================================================================

function loadProgress(): ProgressData | null {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (_error) {
    console.warn('  Warning: Could not load progress file, starting fresh');
    return null;
  }
}

function saveProgress(progress: ProgressData): void {
  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateRaceId(trackCode: string, raceDate: string, raceNumber: number): string {
  return `${trackCode}-${raceDate}-R${raceNumber}`;
}

// ============================================================================
// RACE PROCESSING
// ============================================================================

async function processRace(
  raceData: RaceData,
  scoredHorses: ScoredHorse[],
  scoringResult: RaceScoringResult
): Promise<{
  success: boolean;
  record?: AIDecisionRecord;
  error?: string;
}> {
  const { race, raceResult, raceId } = raceData;

  try {
    // Run AI analysis
    const aiAnalysis = await getMultiBotAnalysis(race, scoringResult, {
      forceRefresh: true,
      recordMetrics: false, // We'll record manually after updating with results
    });

    // Build the decision record
    const record = buildDecisionRecord(aiAnalysis, scoringResult, race);

    // Update the record with actual results
    const actualResults = {
      winner: raceResult.positions[0]?.post || 0,
      exacta: [raceResult.positions[0]?.post || 0, raceResult.positions[1]?.post || 0] as [
        number,
        number,
      ],
      trifecta: [
        raceResult.positions[0]?.post || 0,
        raceResult.positions[1]?.post || 0,
        raceResult.positions[2]?.post || 0,
      ] as [number, number, number],
    };

    // Manually update the record with results
    const updatedRecord: AIDecisionRecord = {
      ...record,
      raceId,
      actualWinner: actualResults.winner,
      actualExacta: actualResults.exacta,
      actualTrifecta: actualResults.trifecta,
      resultRecorded: true,
    };

    // Save the complete record
    await saveDecisionRecord(updatedRecord);

    return { success: true, record: updatedRecord };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateComparisonReport(
  metrics: AIPerformanceMetrics,
  records: AIDecisionRecord[],
  summary: ValidationSummary,
  errors: Array<{ raceId: string; error: string; timestamp: string }>
): string {
  const completedRecords = records.filter((r) => r.resultRecorded);
  const totalRaces = completedRecords.length;

  // Calculate rates
  const algoWinRate = toPercentage(metrics.algorithmWins, totalRaces);
  const aiWinRate = metrics.aiWinRate;
  const algoTop3Rate = toPercentage(metrics.algorithmTop3Hits, totalRaces);
  const aiTop3Rate = metrics.aiTop3Rate;

  // Calculate exotic rates
  const exactaBox2Rate = toPercentage(metrics.exactaBox2Hits, totalRaces);
  const exactaBox3Rate = toPercentage(metrics.exactaBox3Hits, totalRaces);
  const exactaBox4Rate = toPercentage(metrics.exactaBox4Hits, totalRaces);
  const trifectaBox3Rate = toPercentage(metrics.trifectaBox3Hits, totalRaces);
  const trifectaBox4Rate = toPercentage(metrics.trifectaBox4Hits, totalRaces);
  const trifectaBox5Rate = toPercentage(metrics.trifectaBox5Hits, totalRaces);

  // Calculate algorithm exotics from records
  let algoExactaBox2 = 0;
  let algoExactaBox3 = 0;
  let algoExactaBox4 = 0;
  let algoTrifectaBox3 = 0;
  let algoTrifectaBox4 = 0;
  let algoTrifectaBox5 = 0;

  for (const record of completedRecords) {
    if (!record.actualExacta || !record.actualTrifecta) continue;

    const algoTop5 = record.algorithmScores.slice(0, 5).map((s) => s.programNumber);

    if (checkExactaBox(algoTop5, record.actualExacta, 2)) algoExactaBox2++;
    if (checkExactaBox(algoTop5, record.actualExacta, 3)) algoExactaBox3++;
    if (checkExactaBox(algoTop5, record.actualExacta, 4)) algoExactaBox4++;
    if (checkTrifectaBox(algoTop5, record.actualTrifecta, 3)) algoTrifectaBox3++;
    if (checkTrifectaBox(algoTop5, record.actualTrifecta, 4)) algoTrifectaBox4++;
    if (checkTrifectaBox(algoTop5, record.actualTrifecta, 5)) algoTrifectaBox5++;
  }

  // Field type breakdown
  const fieldTypeCounts: Record<string, { races: number; wins: number; algoWins: number }> = {};
  for (const record of completedRecords) {
    const ft = record.fieldType || 'UNKNOWN';
    if (!fieldTypeCounts[ft]) {
      fieldTypeCounts[ft] = { races: 0, wins: 0, algoWins: 0 };
    }
    fieldTypeCounts[ft].races++;
    if (record.actualWinner === record.aiTopPick) fieldTypeCounts[ft].wins++;
    if (record.actualWinner === record.algorithmTopPick) fieldTypeCounts[ft].algoWins++;
  }

  // Confidence breakdown
  const confidenceCounts: Record<string, { races: number; wins: number; top3: number }> = {
    HIGH: { races: 0, wins: 0, top3: 0 },
    MEDIUM: { races: 0, wins: 0, top3: 0 },
    LOW: { races: 0, wins: 0, top3: 0 },
  };

  for (const record of completedRecords) {
    const conf = record.aiConfidence || 'MEDIUM';
    if (confidenceCounts[conf]) {
      confidenceCounts[conf].races++;
      if (record.actualWinner === record.aiTopPick) confidenceCounts[conf].wins++;
      if (record.aiTop3.includes(record.actualWinner!)) confidenceCounts[conf].top3++;
    }
  }

  // Bot effectiveness
  let tripTroubleTotal = 0;
  let tripTroubleWins = 0;
  let paceAdvantageTotal = 0;
  let paceAdvantageWins = 0;
  let vulnFavTotal = 0;
  let vulnFavLost = 0;

  for (const record of completedRecords) {
    if (record.tripTroubleHorses.length > 0) {
      tripTroubleTotal += record.tripTroubleHorses.length;
      if (record.actualWinner && record.tripTroubleHorses.includes(record.actualWinner)) {
        tripTroubleWins++;
      }
    }
    if (record.paceAdvantageHorses.length > 0) {
      paceAdvantageTotal += record.paceAdvantageHorses.length;
      if (record.actualWinner && record.paceAdvantageHorses.includes(record.actualWinner)) {
        paceAdvantageWins++;
      }
    }
    if (record.vulnerableFavorite) {
      vulnFavTotal++;
      if (record.actualWinner !== record.algorithmTopPick) {
        vulnFavLost++;
      }
    }
  }

  // Override analysis
  const overrideRaces = completedRecords.filter((r) => r.isOverride);
  const overrideWins = overrideRaces.filter((r) => r.actualWinner === r.aiTopPick).length;
  const confirmRaces = completedRecords.filter((r) => !r.isOverride);
  const confirmWins = confirmRaces.filter((r) => r.actualWinner === r.aiTopPick).length;

  // Value play analysis
  const valuePlays = completedRecords.filter((r) => r.aiValuePlay !== null);
  const valuePlayWins = valuePlays.filter((r) => r.actualWinner === r.aiValuePlay).length;
  const valuePlayTop3 = valuePlays.filter((r) => r.aiTop3.includes(r.actualWinner!)).length;

  // Generate key findings
  const keyFindings: string[] = [];

  if (aiWinRate > ALGORITHM_BASELINE.winRate) {
    keyFindings.push(
      `AI outperformed algorithm baseline by ${(aiWinRate - ALGORITHM_BASELINE.winRate).toFixed(1)}% on win rate`
    );
  } else if (aiWinRate < ALGORITHM_BASELINE.winRate) {
    keyFindings.push(
      `AI underperformed algorithm baseline by ${(ALGORITHM_BASELINE.winRate - aiWinRate).toFixed(1)}% on win rate`
    );
  }

  const overrideWinRate = toPercentage(overrideWins, overrideRaces.length);
  const confirmWinRate = toPercentage(confirmWins, confirmRaces.length);
  if (overrideWinRate > confirmWinRate) {
    keyFindings.push(
      `Overrides are working - AI adding value when disagreeing (${overrideWinRate.toFixed(1)}% vs ${confirmWinRate.toFixed(1)}%)`
    );
  }

  const vulnFavFadeRate = toPercentage(vulnFavLost, vulnFavTotal);
  if (vulnFavFadeRate > 50) {
    keyFindings.push(
      `Vulnerable favorite detection is accurate (${vulnFavFadeRate.toFixed(1)}% fade rate)`
    );
  }

  const valuePlayWinRate = toPercentage(valuePlayWins, valuePlays.length);
  const avgWinRate = toPercentage(metrics.aiWins, totalRaces);
  if (valuePlayWinRate > avgWinRate) {
    keyFindings.push(
      `Value play identification is finding hidden winners (${valuePlayWinRate.toFixed(1)}% win rate)`
    );
  }

  if (keyFindings.length === 0) {
    keyFindings.push('Insufficient data for conclusive findings - continue collecting more races');
  }

  // Build the report
  const report = `# AI VALIDATION REPORT

Run Date: ${summary.endTime}
Total Races: ${summary.totalRaces}
Races Successfully Analyzed: ${summary.processedRaces}
Races with Errors: ${summary.errorRaces}
Total Run Time: ${(summary.totalTimeMs / 1000 / 60).toFixed(1)} minutes

## BASELINE COMPARISON

### Win Rate
| Source | Wins | Rate | vs Baseline |
|--------|------|------|-------------|
| Algorithm Baseline | ${ALGORITHM_BASELINE.wins} | ${ALGORITHM_BASELINE.winRate}% | - |
| Algorithm (this run) | ${metrics.algorithmWins} | ${algoWinRate.toFixed(1)}% | ${formatDiff(algoWinRate - ALGORITHM_BASELINE.winRate)} |
| AI Top Pick | ${metrics.aiWins} | ${aiWinRate.toFixed(1)}% | ${formatDiff(aiWinRate - ALGORITHM_BASELINE.winRate)} |

### Top-3 Rate
| Source | Hits | Rate | vs Baseline |
|--------|------|------|-------------|
| Algorithm Baseline | ${ALGORITHM_BASELINE.top3Hits} | ${ALGORITHM_BASELINE.top3Rate}% | - |
| Algorithm (this run) | ${metrics.algorithmTop3Hits} | ${algoTop3Rate.toFixed(1)}% | ${formatDiff(algoTop3Rate - ALGORITHM_BASELINE.top3Rate)} |
| AI Top 3 | ${metrics.aiTop3Hits} | ${aiTop3Rate.toFixed(1)}% | ${formatDiff(aiTop3Rate - ALGORITHM_BASELINE.top3Rate)} |

### Exotic Performance
| Bet Type | Baseline | Algorithm | AI | AI vs Baseline |
|----------|----------|-----------|-----|----------------|
| Exacta Box 2 | - | ${toPercentage(algoExactaBox2, totalRaces).toFixed(1)}% | ${exactaBox2Rate.toFixed(1)}% | - |
| Exacta Box 3 | - | ${toPercentage(algoExactaBox3, totalRaces).toFixed(1)}% | ${exactaBox3Rate.toFixed(1)}% | - |
| Exacta Box 4 | ${ALGORITHM_BASELINE.exactaBox4Rate}% | ${toPercentage(algoExactaBox4, totalRaces).toFixed(1)}% | ${exactaBox4Rate.toFixed(1)}% | ${formatDiff(exactaBox4Rate - ALGORITHM_BASELINE.exactaBox4Rate)} |
| Trifecta Box 3 | - | ${toPercentage(algoTrifectaBox3, totalRaces).toFixed(1)}% | ${trifectaBox3Rate.toFixed(1)}% | - |
| Trifecta Box 4 | - | ${toPercentage(algoTrifectaBox4, totalRaces).toFixed(1)}% | ${trifectaBox4Rate.toFixed(1)}% | - |
| Trifecta Box 5 | ${ALGORITHM_BASELINE.trifectaBox5Rate}% | ${toPercentage(algoTrifectaBox5, totalRaces).toFixed(1)}% | ${trifectaBox5Rate.toFixed(1)}% | ${formatDiff(trifectaBox5Rate - ALGORITHM_BASELINE.trifectaBox5Rate)} |

## OVERRIDE ANALYSIS
- Total Overrides: ${metrics.totalOverrides} (${metrics.overrideRate.toFixed(1)}% of races)
- Override Wins: ${overrideWins} (${overrideWinRate.toFixed(1)}% when AI disagreed with algorithm)
- Confirm Wins: ${confirmWins} (${confirmWinRate.toFixed(1)}% when AI agreed with algorithm)
- Override Edge: ${(overrideWinRate - confirmWinRate).toFixed(1)}%

## VALUE PLAY PERFORMANCE
- Value Plays Identified: ${valuePlays.length}
- Value Play Wins: ${valuePlayWins} (${valuePlayWinRate.toFixed(1)}%)
- Value Play in Top 3: ${valuePlayTop3} (${toPercentage(valuePlayTop3, valuePlays.length).toFixed(1)}%)
- Avg Odds When Value Play Won: ${metrics.valuePlayAvgOdds.toFixed(1)}-1

## CONFIDENCE CALIBRATION
| Confidence | Races | Win Rate | Top-3 Rate |
|------------|-------|----------|------------|
| HIGH | ${confidenceCounts['HIGH'].races} | ${toPercentage(confidenceCounts['HIGH'].wins, confidenceCounts['HIGH'].races).toFixed(1)}% | ${toPercentage(confidenceCounts['HIGH'].top3, confidenceCounts['HIGH'].races).toFixed(1)}% |
| MEDIUM | ${confidenceCounts['MEDIUM'].races} | ${toPercentage(confidenceCounts['MEDIUM'].wins, confidenceCounts['MEDIUM'].races).toFixed(1)}% | ${toPercentage(confidenceCounts['MEDIUM'].top3, confidenceCounts['MEDIUM'].races).toFixed(1)}% |
| LOW | ${confidenceCounts['LOW'].races} | ${toPercentage(confidenceCounts['LOW'].wins, confidenceCounts['LOW'].races).toFixed(1)}% | ${toPercentage(confidenceCounts['LOW'].top3, confidenceCounts['LOW'].races).toFixed(1)}% |

## BOT EFFECTIVENESS
| Bot Signal | Horses Flagged | Winners | Win Rate |
|------------|----------------|---------|----------|
| Trip Trouble Boost | ${tripTroubleTotal} | ${tripTroubleWins} | ${toPercentage(tripTroubleWins, tripTroubleTotal).toFixed(1)}% |
| Pace Advantage | ${paceAdvantageTotal} | ${paceAdvantageWins} | ${toPercentage(paceAdvantageWins, paceAdvantageTotal).toFixed(1)}% |
| Vulnerable Favorite | ${vulnFavTotal} faded | ${vulnFavLost} lost | ${vulnFavFadeRate.toFixed(1)}% |

## FIELD TYPE PERFORMANCE
| Field Type | Races | AI Win Rate | Algorithm Win Rate |
|------------|-------|-------------|-------------------|
| DOMINANT | ${fieldTypeCounts['DOMINANT']?.races || 0} | ${toPercentage(fieldTypeCounts['DOMINANT']?.wins || 0, fieldTypeCounts['DOMINANT']?.races || 1).toFixed(1)}% | ${toPercentage(fieldTypeCounts['DOMINANT']?.algoWins || 0, fieldTypeCounts['DOMINANT']?.races || 1).toFixed(1)}% |
| SEPARATED | ${fieldTypeCounts['SEPARATED']?.races || 0} | ${toPercentage(fieldTypeCounts['SEPARATED']?.wins || 0, fieldTypeCounts['SEPARATED']?.races || 1).toFixed(1)}% | ${toPercentage(fieldTypeCounts['SEPARATED']?.algoWins || 0, fieldTypeCounts['SEPARATED']?.races || 1).toFixed(1)}% |
| COMPETITIVE | ${fieldTypeCounts['COMPETITIVE']?.races || 0} | ${toPercentage(fieldTypeCounts['COMPETITIVE']?.wins || 0, fieldTypeCounts['COMPETITIVE']?.races || 1).toFixed(1)}% | ${toPercentage(fieldTypeCounts['COMPETITIVE']?.algoWins || 0, fieldTypeCounts['COMPETITIVE']?.races || 1).toFixed(1)}% |
| WIDE_OPEN | ${fieldTypeCounts['WIDE_OPEN']?.races || 0} | ${toPercentage(fieldTypeCounts['WIDE_OPEN']?.wins || 0, fieldTypeCounts['WIDE_OPEN']?.races || 1).toFixed(1)}% | ${toPercentage(fieldTypeCounts['WIDE_OPEN']?.algoWins || 0, fieldTypeCounts['WIDE_OPEN']?.races || 1).toFixed(1)}% |

## KEY FINDINGS
${keyFindings.map((f) => `- ${f}`).join('\n')}

## ERRORS & ISSUES
${errors.length === 0 ? 'No errors occurred during validation.' : errors.map((e) => `- ${e.raceId}: ${e.error}`).join('\n')}
`;

  return report;
}

function toPercentage(num: number, denom: number): number {
  if (denom === 0) return 0;
  return (num / denom) * 100;
}

function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff.toFixed(1)}%`;
  if (diff < 0) return `${diff.toFixed(1)}%`;
  return '0.0%';
}

function checkExactaBox(candidates: number[], actual: [number, number], boxSize: number): boolean {
  const boxCandidates = candidates.slice(0, boxSize);
  return actual.every((num) => boxCandidates.includes(num));
}

function checkTrifectaBox(
  candidates: number[],
  actual: [number, number, number],
  boxSize: number
): boolean {
  const boxCandidates = candidates.slice(0, boxSize);
  return actual.every((num) => boxCandidates.includes(num));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const freshStart = args.includes('--fresh');

  console.log('\n' + '═'.repeat(70));
  console.log('              AI VALIDATION RUNNER');
  console.log('═'.repeat(70));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Fresh start: ${freshStart}`);

  // Check API key
  if (!checkApiKey()) {
    process.exit(1);
  }

  console.log('\nAI Service Status: ready');
  console.log('Multi-bot mode: ACTIVE');

  // Initialize metrics storage (use in-memory for validation)
  resetStorageForTesting();
  await initializeMetricsStorage();

  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Load or initialize progress
  let progress: ProgressData;
  if (freshStart) {
    console.log('\nForcing fresh start, ignoring previous progress...');
    progress = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      processedRaces: [],
      totalRaces: 0,
      errors: [],
    };
    // Clear progress file if exists
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
  } else {
    const loadedProgress = loadProgress();
    if (loadedProgress) {
      console.log(`\nResuming from previous run...`);
      console.log(`  Previously processed: ${loadedProgress.processedRaces.length} races`);
      progress = loadedProgress;
    } else {
      progress = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        processedRaces: [],
        totalRaces: 0,
        errors: [],
      };
    }
  }

  // Discover test files
  console.log('\nDiscovering test files...');
  const testFiles = discoverTestFiles();

  if (testFiles.length === 0) {
    console.error('No DRF files with results found in data directory');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} tracks with results files`);

  // Collect all races
  const allRaces: RaceData[] = [];

  for (const { drfPath, resultsPath, trackCode } of testFiles) {
    console.log(`\n  Parsing ${trackCode}...`);

    const drfContent = fs.readFileSync(drfPath, 'utf-8');
    const parsed = parseDRFFile(drfContent, path.basename(drfPath));
    const results = parseResultsFile(resultsPath);

    for (const race of parsed.races) {
      const raceResult = results.find((r) => r.raceNumber === race.header.raceNumber);
      if (!raceResult || raceResult.positions.length < 3) {
        continue; // Skip races without complete results
      }

      const raceId = generateRaceId(
        trackCode,
        race.header.raceDate || trackCode.slice(-4),
        race.header.raceNumber
      );

      allRaces.push({
        race,
        raceResult,
        trackCode,
        raceId,
      });
    }
  }

  console.log(`\nTotal races to process: ${allRaces.length}`);
  progress.totalRaces = allRaces.length;

  // Filter out already processed races
  const racesToProcess = allRaces.filter((r) => !progress.processedRaces.includes(r.raceId));
  console.log(`Remaining races: ${racesToProcess.length}`);

  if (racesToProcess.length === 0) {
    console.log('\nAll races already processed. Use --fresh to restart.');
  }

  // Process races
  const startTime = Date.now();
  let processedCount = progress.processedRaces.length;
  let errorCount = progress.errors.length;

  for (let i = 0; i < racesToProcess.length; i++) {
    const raceData = racesToProcess[i]!;
    const { race, raceResult, raceId } = raceData;

    // Log progress every 10 races
    if ((processedCount + 1) % 10 === 0 || i === 0) {
      console.log(`\nProcessed ${processedCount}/${allRaces.length} races...`);
    }

    console.log(`  [${processedCount + 1}/${allRaces.length}] ${raceId}...`);

    // Apply scratches
    const scratchedPosts = new Set(raceResult.scratches.map((s) => s.post));
    for (const entry of race.horses) {
      if (scratchedPosts.has(entry.postPosition)) {
        entry.isScratched = true;
      }
    }

    // Set up scoring parameters - TrackCondition is a string type
    const trackCondition: TrackCondition = race.header.trackCondition || 'fast';

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

    // Convert to RaceScoringResult format
    const scoringResult = convertToRaceScoringResult(scoredHorses, race.horses);

    // Process the race
    const result = await processRace(raceData, scoredHorses, scoringResult);

    if (result.success) {
      progress.processedRaces.push(raceId);
      processedCount++;
      console.log(`    ✓ Success`);
    } else {
      progress.errors.push({
        raceId,
        error: result.error || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      errorCount++;
      console.log(`    ✗ Error: ${result.error}`);

      // Check for rate limit
      if (result.error?.includes('429') || result.error?.includes('RATE_LIMIT')) {
        console.log(`    Waiting ${RATE_LIMIT_DELAY_MS / 1000}s for rate limit...`);
        await delay(RATE_LIMIT_DELAY_MS);
      }
    }

    // Save progress after each race
    saveProgress(progress);

    // Add delay between API calls (unless it's the last one)
    if (i < racesToProcess.length - 1) {
      await delay(API_DELAY_MS);
    }
  }

  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;

  // Generate summary
  const summary: ValidationSummary = {
    totalRaces: allRaces.length,
    processedRaces: processedCount,
    errorRaces: errorCount,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    totalTimeMs,
  };

  console.log('\n' + '═'.repeat(70));
  console.log('              VALIDATION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Total races: ${summary.totalRaces}`);
  console.log(`Successfully processed: ${summary.processedRaces}`);
  console.log(`Errors: ${summary.errorRaces}`);
  console.log(`Total time: ${(totalTimeMs / 1000 / 60).toFixed(1)} minutes`);

  // Get all records and calculate metrics
  const allRecords = await getAllDecisionRecords();
  console.log(`\nRecords in storage: ${allRecords.length}`);

  if (allRecords.length > 0) {
    const metrics = calculatePerformanceMetrics(allRecords);

    // Generate and save report
    console.log('\nGenerating comparison report...');
    const report = generateComparisonReport(metrics, allRecords, summary, progress.errors);
    fs.writeFileSync(REPORT_FILE, report);
    console.log(`Report saved to: ${REPORT_FILE}`);

    // Save raw metrics
    const metricsOutput = {
      generatedAt: new Date().toISOString(),
      summary,
      metrics,
      baseline: ALGORITHM_BASELINE,
      records: allRecords,
    };
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metricsOutput, null, 2));
    console.log(`Metrics saved to: ${METRICS_FILE}`);

    // Print quick summary
    console.log('\n' + '─'.repeat(50));
    console.log('QUICK SUMMARY');
    console.log('─'.repeat(50));
    console.log(
      `Algorithm Win Rate: ${toPercentage(metrics.algorithmWins, allRecords.length).toFixed(1)}%`
    );
    console.log(`AI Win Rate: ${metrics.aiWinRate.toFixed(1)}%`);
    console.log(`Override Rate: ${metrics.overrideRate.toFixed(1)}%`);
    console.log(`Override Win Rate: ${metrics.overrideWinRate.toFixed(1)}%`);
    console.log('─'.repeat(50));
  }

  console.log('\nDone!');
}

// Run
main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
