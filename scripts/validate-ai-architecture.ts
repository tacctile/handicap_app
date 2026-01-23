#!/usr/bin/env npx tsx
/**
 * AI Architecture Validation Test Harness
 *
 * Measures the expansion/contraction bet construction architecture:
 * 1. Algorithm baseline performance (no AI)
 * 2. Whether expansion horses hit the board
 * 3. Whether vulnerable favorite detection improves exotic returns
 * 4. Whether the new ticket strategies outperform naive boxes
 *
 * Usage:
 *   npx tsx scripts/validate-ai-architecture.ts
 *
 * Results saved to: validation-results.json
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import { getMultiBotAnalysis, checkAIServiceStatus } from '../src/services/ai';
import type { ParsedRace, HorseEntry } from '../src/types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../src/types/scoring';
import type { ScoredHorse } from '../src/lib/scoring';
import type {
  AIRaceAnalysis,
  TicketTemplate,
  SizingRecommendationType,
} from '../src/services/ai/types';
import { analyzePaceScenario } from '../src/lib/scoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = path.join(__dirname, '../src/data');
const OUTPUT_FILE = path.join(__dirname, '../validation-results.json');

// Parallel batch processing configuration
// Gemini allows 4,000 RPM. With 4 bots per race, 20 races = 80 requests per batch
const BATCH_SIZE = 20;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Template-specific performance metrics
 */
interface TemplatePerformanceMetrics {
  races: number;
  wins: number;
  winRate: number;
  exactaHits: number;
  exactaRate: number;
  exactaCost: number;
  exactaPayout: number;
  exactaROI: number;
  trifectaHits: number;
  trifectaRate: number;
  trifectaCost: number;
  trifectaPayout: number;
  trifectaROI: number;
}

/**
 * Odds bracket performance for Template B favorite fading
 */
interface OddsBracketMetrics {
  races: number;
  favoritesLost: number;
  fadeAccuracy: number;
  exactaHits: number;
  exactaCost: number;
  exactaPayout: number;
  exactaROI: number;
}

/**
 * Sizing performance metrics
 */
interface SizingPerformanceMetrics {
  races: number;
  exactaHits: number;
  exactaRate: number;
  avgConfidence: number;
}

// ============================================================================
// EXPANDED BET TYPE TRACKING TYPES
// ============================================================================

/**
 * Generic bet type metrics - used for all bet variations
 */
interface BetTypeMetrics {
  races: number; // Number of races where this bet was possible
  hits: number; // Number of times the bet hit
  hitRate: number; // hits / races * 100
  cost: number; // Total cost at $1 base
  payout: number; // Total estimated payout
  roi: number; // (payout - cost) / cost * 100
}

/**
 * Win/Place/Show metrics for both Algorithm Only and Algorithm+AI
 */
interface WPSMetrics {
  win: BetTypeMetrics;
  place: BetTypeMetrics;
  show: BetTypeMetrics;
}

/**
 * All exacta variations
 */
interface ExactaVariationMetrics {
  straight: BetTypeMetrics; // Exact 1-2 order
  box2: BetTypeMetrics; // Top 2, any order
  box3: BetTypeMetrics; // Top 3, any order
  box4: BetTypeMetrics; // Top 4, any order (already tracked)
  keyValueOver2: BetTypeMetrics; // Value horse over 2 others
  keyValueOver3: BetTypeMetrics; // Value horse over 3 others
  keyValueOver4: BetTypeMetrics; // Value horse over 4 others
  key2OverValue: BetTypeMetrics; // 2 others over value horse
}

/**
 * All trifecta variations
 */
interface TrifectaVariationMetrics {
  straight: BetTypeMetrics; // Exact 1-2-3 order
  box3: BetTypeMetrics; // Top 3, any order
  box4: BetTypeMetrics; // Top 4, any order
  box5: BetTypeMetrics; // Top 5, any order (already tracked)
  keyValueWith2Over3: BetTypeMetrics; // Value 1st, 2 for 2nd, 3 for 3rd
  keyValueWith3Over4: BetTypeMetrics; // Value 1st, 3 for 2nd, 4 for 3rd
  key2WithValueOver3: BetTypeMetrics; // 2 for 1st, value 2nd, 3 for 3rd
  key2Over3WithValue: BetTypeMetrics; // 2 for 1st, 3 for 2nd, value 3rd
}

/**
 * All superfecta variations
 */
interface SuperfectaVariationMetrics {
  straight: BetTypeMetrics; // Exact 1-2-3-4 order
  box4: BetTypeMetrics; // Top 4, any order
  box5: BetTypeMetrics; // Top 5, any order
  box6: BetTypeMetrics; // Top 6, any order
  keyValueWith3Over4Over5: BetTypeMetrics; // Value 1st, 3 for 2nd, 4 for 3rd, 5 for 4th
  keyValueInAnyTop4: BetTypeMetrics; // Value somewhere in 1-2-3-4
}

/**
 * Value horse specific performance metrics
 */
interface ValueHorsePerformanceMetrics {
  totalRacesWithValueHorse: number;
  valueHorseByTier: {
    HIGH: { races: number; wins: number; places: number; shows: number; boards: number };
    MEDIUM: { races: number; wins: number; places: number; shows: number; boards: number };
    LOW: { races: number; wins: number; places: number; shows: number; boards: number };
  };
  overall: {
    winRate: number;
    placeRate: number;
    showRate: number;
    boardRate: number;
  };
}

/**
 * Expanded ROI tracking for all bet types
 */
interface ExpandedROITracking {
  // Win/Place/Show
  algorithmOnlyWPS: WPSMetrics;
  algorithmPlusAIWPS: WPSMetrics;

  // Exacta variations
  algorithmOnlyExacta: ExactaVariationMetrics;
  algorithmPlusAIExacta: ExactaVariationMetrics;

  // Trifecta variations
  algorithmOnlyTrifecta: TrifectaVariationMetrics;
  algorithmPlusAITrifecta: TrifectaVariationMetrics;

  // Superfecta variations
  algorithmOnlySuperfecta: SuperfectaVariationMetrics;
  algorithmPlusAISuperfecta: SuperfectaVariationMetrics;

  // Value horse specific metrics
  valueHorseMetrics: ValueHorsePerformanceMetrics;
}

/**
 * ValidationResult - ROI-focused structure for template/sizing system
 */
interface ValidationResult {
  // Metadata
  runDate: string;
  totalRaces: number;
  racesAnalyzed: number;
  racesPassed: number;
  errors: string[];

  // SECTION A: Algorithm Baseline (unchanged)
  algorithmBaseline: {
    winRate: number;
    top3Rate: number;
    exactaBox4Rate: number;
    exactaBox4Cost: number;
    trifectaBox5Rate: number;
    trifectaBox5Cost: number;
    wins: number;
    top3Hits: number;
    exactaBox4Hits: number;
    trifectaBox5Hits: number;
  };

  // SECTION B: Template Distribution
  templateDistribution: {
    templateA: { count: number; percentage: number };
    templateB: { count: number; percentage: number };
    templateC: { count: number; percentage: number };
    passed: { count: number; percentage: number };
  };

  // SECTION C: Template Performance
  templatePerformance: {
    templateA: TemplatePerformanceMetrics;
    templateB: TemplatePerformanceMetrics;
    templateC: TemplatePerformanceMetrics;
  };

  // SECTION D: Sizing Performance
  sizingPerformance: {
    MAX: SizingPerformanceMetrics;
    STRONG: SizingPerformanceMetrics;
    STANDARD: SizingPerformanceMetrics;
    HALF: SizingPerformanceMetrics;
    PASS: { races: number; wouldHaveHit: number; correctPassRate: number };
  };

  // SECTION E: Vulnerable Favorite Analysis
  vulnerableFavoriteAnalysis: {
    detected: number;
    actuallyLost: number;
    accuracy: number;
    templateBExactaHits: number;
    templateBExactaRate: number;
  };

  // SECTION F: ROI Summary
  roiSummary: {
    algorithmExactaROI: number;
    algorithmTrifectaROI: number;
    aiExactaROI: number;
    aiTrifectaROI: number;
    exactaImprovement: number;
    trifectaImprovement: number;
    totalAlgorithmCost: number;
    totalAICost: number;
    costReduction: number;
  };

  // SECTION G: Verdict
  verdict: {
    templatesWork: boolean;
    sizingCalibrated: boolean;
    roiPositive: boolean;
    recommendation: 'DEPLOY' | 'TUNE' | 'REVERT';
  };

  // TIER 1 COMPARISON METRICS (calibration only)
  tier1Comparison: {
    algorithmOnly: {
      winRate: number;
      exactaHitRate: number;
      trifectaHitRate: number;
      exactaROI: number;
      trifectaROI: number;
      racesBet: number;
    };
    algorithmPlusAI: {
      winRate: number;
      exactaHitRate: number;
      trifectaHitRate: number;
      exactaROI: number;
      trifectaROI: number;
      racesBet: number;
    };
  };

  // Favorite fade by odds bracket (Template B only)
  favoriteFadeByOdds: {
    heavy: OddsBracketMetrics; // ≤2-1
    mid: OddsBracketMetrics; // 5/2-7/2
    light: OddsBracketMetrics; // 4-1+
  };

  // PASS filter audit
  passFilterAudit: {
    totalPassRaces: number;
    passPercentage: number;
    wouldHitExactas: number;
    wouldHitTrifectas: number;
    estimatedROIImpact: number;
    passRateSuspiciouslyLow: boolean; // <10%
    passRateTooAggressive: boolean; // >40%
  };

  // EXPANDED ROI TRACKING - All bet types
  expandedROI: ExpandedROITracking;
}

interface RaceResult {
  raceNumber: number;
  positions: { post: number; horseName: string }[];
  scratches: { post: number; horseName: string }[];
}

interface RaceAnalysisData {
  race: ParsedRace;
  scoredHorses: ScoredHorse[];
  scoringResult: RaceScoringResult;
  raceResult: RaceResult;
  aiAnalysis?: AIRaceAnalysis;
}

// ============================================================================
// PAYOUT ESTIMATES
// ============================================================================

/**
 * Estimated payouts by template (if actual payouts not available)
 */
const PAYOUT_ESTIMATES = {
  exacta: {
    A: 18, // Template A (favorite wins): lower payout
    B: 45, // Template B (favorite loses): higher payout
    C: 35, // Template C (wide open): medium-high payout
  },
  trifecta: {
    A: 100, // Template A: lower payout
    B: 250, // Template B: higher payout
    C: 200, // Template C: medium-high payout
  },
};

/**
 * Calculate ticket cost based on template and sizing multiplier
 */
function calculateTicketCost(
  template: TicketTemplate,
  multiplier: number
): { exactaCost: number; trifectaCost: number } {
  switch (template) {
    case 'A':
      // Template A: 3 exacta combos @ $2, 6 trifecta combos @ $1
      return {
        exactaCost: 3 * 2 * multiplier,
        trifectaCost: 6 * 1 * multiplier,
      };
    case 'B':
      // Template B: 9 exacta combos @ $2, 18 trifecta combos @ $1
      return {
        exactaCost: 9 * 2 * multiplier,
        trifectaCost: 18 * 1 * multiplier,
      };
    case 'C':
      // Template C: 12 exacta combos @ $2, 60 trifecta combos @ $1
      return {
        exactaCost: 12 * 2 * multiplier,
        trifectaCost: 60 * 1 * multiplier,
      };
    default:
      return { exactaCost: 0, trifectaCost: 0 };
  }
}

/**
 * Get estimated payout for a template hit
 */
function getEstimatedPayout(template: TicketTemplate, betType: 'exacta' | 'trifecta'): number {
  return PAYOUT_ESTIMATES[betType][template];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPercentage(num: number, denom: number): number {
  if (denom === 0) return 0;
  return (num / denom) * 100;
}

function formatRate(hits: number, total: number): string {
  const rate = toPercentage(hits, total);
  return `${hits}/${total} (${rate.toFixed(1)}%)`;
}

/**
 * Parse morning line odds string to decimal odds
 * e.g., "3-1" -> 3.0, "5-2" -> 2.5, "7-2" -> 3.5, "1-1" -> 1.0
 */
function parseOddsToDecimal(oddsStr: string): number {
  if (!oddsStr) return 5.0; // Default to 5-1
  const cleaned = oddsStr.trim().replace(/\s+/g, '');
  const match = cleaned.match(/^(\d+)-(\d+)$/);
  if (!match) return 5.0;
  const numerator = parseInt(match[1], 10);
  const denominator = parseInt(match[2], 10);
  if (denominator === 0) return 5.0;
  return numerator / denominator;
}

/**
 * Determine odds bracket for Template B favorite fade analysis
 * Heavy: ≤2-1 (decimal ≤2.0)
 * Mid: 5/2-7/2 (decimal 2.5-3.5)
 * Light: 4-1+ (decimal ≥4.0)
 */
function getOddsBracket(decimalOdds: number): 'heavy' | 'mid' | 'light' {
  if (decimalOdds <= 2.0) return 'heavy';
  if (decimalOdds >= 4.0) return 'light';
  return 'mid';
}

// ============================================================================
// RESULTS FILE PARSING
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
        console.warn(`  Warning: No results file for ${trackCode} - skipping`);
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
// SCORING RESULT CONVERSION (from runAIValidation.ts)
// ============================================================================

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
// VALIDATION METRICS CALCULATION
// ============================================================================

/**
 * Check if naive algorithm exacta box 4 hits
 */
function checkExactaBox(candidates: number[], actual: { first: number; second: number }): boolean {
  return candidates.includes(actual.first) && candidates.includes(actual.second);
}

/**
 * Check if naive algorithm trifecta box 5 hits
 */
function checkTrifecta(
  candidates: number[],
  actual: { first: number; second: number; third: number }
): boolean {
  return (
    candidates.includes(actual.first) &&
    candidates.includes(actual.second) &&
    candidates.includes(actual.third)
  );
}

/**
 * Check template-based exacta hit
 * - Template A: 1st matches #1 rank AND 2nd in [2,3,4]
 * - Template B: 1st matches any of [2,3,4] AND 2nd in [1,2,3,4]
 * - Template C: 1st AND 2nd both in [1,2,3,4]
 */
function checkTemplateExactaHit(
  template: TicketTemplate,
  algorithmTop4: number[],
  actual: { first: number; second: number }
): boolean {
  const rank1 = algorithmTop4[0];
  const ranks234 = algorithmTop4.slice(1, 4);
  const allTop4 = algorithmTop4.slice(0, 4);

  switch (template) {
    case 'A':
      // Template A: 1st = #1 rank, 2nd in [2,3,4]
      return actual.first === rank1 && ranks234.includes(actual.second);

    case 'B':
      // Template B: 1st in [2,3,4], 2nd in [1,2,3,4]
      return ranks234.includes(actual.first) && allTop4.includes(actual.second);

    case 'C':
      // Template C: 1st AND 2nd both in [1,2,3,4]
      return allTop4.includes(actual.first) && allTop4.includes(actual.second);

    default:
      return false;
  }
}

/**
 * Check template-based trifecta hit
 * - Template A: 1st = #1, 2nd in [2,3,4], 3rd in [2,3,4], 2nd ≠ 3rd
 * - Template B: 1st in [2,3,4], 2nd in [1,2,3,4], 3rd in [1,2,3,4], all different
 * - Template C: 1st, 2nd, 3rd all in [1,2,3,4,5], all different
 */
function checkTemplateTrifectaHit(
  template: TicketTemplate,
  algorithmTop5: number[],
  actual: { first: number; second: number; third: number }
): boolean {
  const rank1 = algorithmTop5[0];
  const ranks234 = algorithmTop5.slice(1, 4);
  const allTop4 = algorithmTop5.slice(0, 4);
  const allTop5 = algorithmTop5.slice(0, 5);

  // All positions must be different
  if (
    actual.first === actual.second ||
    actual.first === actual.third ||
    actual.second === actual.third
  ) {
    return false;
  }

  switch (template) {
    case 'A':
      // Template A: 1st = #1, 2nd in [2,3,4], 3rd in [2,3,4]
      return (
        actual.first === rank1 &&
        ranks234.includes(actual.second) &&
        ranks234.includes(actual.third)
      );

    case 'B':
      // Template B: 1st in [2,3,4], 2nd in [1,2,3,4], 3rd in [1,2,3,4]
      return (
        ranks234.includes(actual.first) &&
        allTop4.includes(actual.second) &&
        allTop4.includes(actual.third)
      );

    case 'C':
      // Template C: 1st, 2nd, 3rd all in [1,2,3,4,5]
      return (
        allTop5.includes(actual.first) &&
        allTop5.includes(actual.second) &&
        allTop5.includes(actual.third)
      );

    default:
      return false;
  }
}

// ============================================================================
// EXPANDED BET TYPE HIT CHECKERS
// ============================================================================

/**
 * Check Win bet hit - top pick wins
 */
function checkWinHit(topPick: number, actual: { first: number }): boolean {
  return topPick === actual.first;
}

/**
 * Check Place bet hit - top pick finishes 1st or 2nd
 */
function checkPlaceHit(topPick: number, actual: { first: number; second: number }): boolean {
  return topPick === actual.first || topPick === actual.second;
}

/**
 * Check Show bet hit - top pick finishes 1st, 2nd, or 3rd
 */
function checkShowHit(
  topPick: number,
  actual: { first: number; second: number; third: number }
): boolean {
  return topPick === actual.first || topPick === actual.second || topPick === actual.third;
}

/**
 * Check Exacta Straight hit - exact 1-2 order
 */
function checkExactaStraight(picks: number[], actual: { first: number; second: number }): boolean {
  return picks[0] === actual.first && picks[1] === actual.second;
}

/**
 * Check Exacta Box hit - any order within candidates
 */
function checkExactaBoxN(candidates: number[], actual: { first: number; second: number }): boolean {
  return candidates.includes(actual.first) && candidates.includes(actual.second);
}

/**
 * Check Exacta Key Over - key horse wins, any of the with horses fill 2nd
 * @param keyHorse The horse keyed to win
 * @param withHorses The horses that can finish 2nd
 */
function checkExactaKeyOver(
  keyHorse: number,
  withHorses: number[],
  actual: { first: number; second: number }
): boolean {
  return keyHorse === actual.first && withHorses.includes(actual.second);
}

/**
 * Check Exacta Key Under - any of the with horses win, key horse finishes 2nd
 * @param keyHorse The horse keyed to finish 2nd
 * @param withHorses The horses that can win
 */
function checkExactaKeyUnder(
  keyHorse: number,
  withHorses: number[],
  actual: { first: number; second: number }
): boolean {
  return withHorses.includes(actual.first) && keyHorse === actual.second;
}

/**
 * Check Trifecta Straight hit - exact 1-2-3 order
 */
function checkTrifectaStraight(
  picks: number[],
  actual: { first: number; second: number; third: number }
): boolean {
  return picks[0] === actual.first && picks[1] === actual.second && picks[2] === actual.third;
}

/**
 * Check Trifecta Box hit - any order within candidates
 */
function checkTrifectaBoxN(
  candidates: number[],
  actual: { first: number; second: number; third: number }
): boolean {
  return (
    candidates.includes(actual.first) &&
    candidates.includes(actual.second) &&
    candidates.includes(actual.third)
  );
}

/**
 * Check Trifecta Key with A over B - key horse wins, A horses for 2nd, B horses for 3rd
 * @param keyHorse The horse keyed to win
 * @param aHorses Horses that can finish 2nd
 * @param bHorses Horses that can finish 3rd
 */
function checkTrifectaKeyWithAOverB(
  keyHorse: number,
  aHorses: number[],
  bHorses: number[],
  actual: { first: number; second: number; third: number }
): boolean {
  return (
    keyHorse === actual.first && aHorses.includes(actual.second) && bHorses.includes(actual.third)
  );
}

/**
 * Check Trifecta A with Key over B - A horses win, key horse 2nd, B horses 3rd
 */
function checkTrifectaAWithKeyOverB(
  aHorses: number[],
  keyHorse: number,
  bHorses: number[],
  actual: { first: number; second: number; third: number }
): boolean {
  return (
    aHorses.includes(actual.first) && keyHorse === actual.second && bHorses.includes(actual.third)
  );
}

/**
 * Check Trifecta A over B with Key - A horses win, B horses 2nd, key horse 3rd
 */
function checkTrifectaAOverBWithKey(
  aHorses: number[],
  bHorses: number[],
  keyHorse: number,
  actual: { first: number; second: number; third: number }
): boolean {
  return (
    aHorses.includes(actual.first) && bHorses.includes(actual.second) && keyHorse === actual.third
  );
}

/**
 * Check Superfecta Straight hit - exact 1-2-3-4 order
 */
function checkSuperfectaStraight(
  picks: number[],
  actual: { first: number; second: number; third: number; fourth: number }
): boolean {
  return (
    picks[0] === actual.first &&
    picks[1] === actual.second &&
    picks[2] === actual.third &&
    picks[3] === actual.fourth
  );
}

/**
 * Check Superfecta Box hit - any order within candidates
 */
function checkSuperfectaBoxN(
  candidates: number[],
  actual: { first: number; second: number; third: number; fourth: number }
): boolean {
  return (
    candidates.includes(actual.first) &&
    candidates.includes(actual.second) &&
    candidates.includes(actual.third) &&
    candidates.includes(actual.fourth)
  );
}

/**
 * Check Superfecta Key with A over B over C
 * Key horse wins, A for 2nd, B for 3rd, C for 4th
 */
function checkSuperfectaKeyWithAOverBOverC(
  keyHorse: number,
  aHorses: number[],
  bHorses: number[],
  cHorses: number[],
  actual: { first: number; second: number; third: number; fourth: number }
): boolean {
  return (
    keyHorse === actual.first &&
    aHorses.includes(actual.second) &&
    bHorses.includes(actual.third) &&
    cHorses.includes(actual.fourth)
  );
}

/**
 * Check if key horse is in any of the top 4 positions
 */
function checkSuperfectaKeyInAnyTop4(
  keyHorse: number,
  otherCandidates: number[],
  actual: { first: number; second: number; third: number; fourth: number }
): boolean {
  const actualTop4 = [actual.first, actual.second, actual.third, actual.fourth];
  // Key horse must be somewhere in 1-2-3-4
  if (!actualTop4.includes(keyHorse)) return false;
  // Other 3 positions must be filled by other candidates
  const otherActual = actualTop4.filter((p) => p !== keyHorse);
  return otherActual.every((p) => otherCandidates.includes(p));
}

// ============================================================================
// BET COST CALCULATORS
// ============================================================================

/**
 * Calculate exacta box cost: n * (n-1) combinations at $2 base
 */
function calculateExactaBoxCost(numHorses: number): number {
  return numHorses * (numHorses - 1) * 2;
}

/**
 * Calculate exacta key cost: n with-horses at $2 base
 */
function calculateExactaKeyCost(numWithHorses: number): number {
  return numWithHorses * 2;
}

/**
 * Calculate trifecta box cost: n * (n-1) * (n-2) combinations at $1 base
 */
function calculateTrifectaBoxCost(numHorses: number): number {
  return numHorses * (numHorses - 1) * (numHorses - 2) * 1;
}

/**
 * Calculate trifecta key cost: key with A over B
 * Combinations = |A| * |B| at $1 base
 */
function calculateTrifectaKeyCost(numAHorses: number, numBHorses: number): number {
  return numAHorses * numBHorses * 1;
}

/**
 * Calculate superfecta box cost: n * (n-1) * (n-2) * (n-3) combinations at $0.10 base
 */
function calculateSuperfectaBoxCost(numHorses: number): number {
  if (numHorses < 4) return 0;
  return numHorses * (numHorses - 1) * (numHorses - 2) * (numHorses - 3) * 0.1;
}

/**
 * Calculate superfecta key cost: key with A over B over C
 * Combinations = |A| * |B| * |C| at $0.10 base
 */
function calculateSuperfectaKeyCost(
  numAHorses: number,
  numBHorses: number,
  numCHorses: number
): number {
  return numAHorses * numBHorses * numCHorses * 0.1;
}

// ============================================================================
// PAYOUT ESTIMATORS (based on odds)
// ============================================================================

/**
 * Estimate win payout based on morning line odds
 */
function estimateWinPayout(oddsDecimal: number, baseUnit: number = 2): number {
  return baseUnit * (oddsDecimal + 1);
}

/**
 * Estimate place payout (roughly half of win payout)
 */
function estimatePlacePayout(oddsDecimal: number, baseUnit: number = 2): number {
  return baseUnit * (oddsDecimal / 2 + 1);
}

/**
 * Estimate show payout (roughly third of win payout)
 */
function estimateShowPayout(oddsDecimal: number, baseUnit: number = 2): number {
  return baseUnit * (oddsDecimal / 3 + 1);
}

/**
 * Estimate exacta payout based on first two finishers' odds
 */
function estimateExactaPayout(firstOdds: number, secondOdds: number, baseUnit: number = 2): number {
  // Rough estimate: product of odds plus some juice
  return baseUnit * (firstOdds * secondOdds * 0.7 + 2);
}

/**
 * Estimate trifecta payout based on first three finishers' odds
 */
function estimateTrifectaPayout(
  firstOdds: number,
  secondOdds: number,
  thirdOdds: number,
  baseUnit: number = 1
): number {
  // Rough estimate: product of odds with takeout adjustment
  return baseUnit * (firstOdds * secondOdds * thirdOdds * 0.5 + 5);
}

/**
 * Estimate superfecta payout based on first four finishers' odds
 */
function estimateSuperfectaPayout(
  firstOdds: number,
  secondOdds: number,
  thirdOdds: number,
  fourthOdds: number,
  baseUnit: number = 0.1
): number {
  // Rough estimate: product of odds with significant takeout
  return baseUnit * (firstOdds * secondOdds * thirdOdds * fourthOdds * 0.3 + 10);
}

/**
 * Initialize empty bet type metrics
 */
function createEmptyBetMetrics(): BetTypeMetrics {
  return {
    races: 0,
    hits: 0,
    hitRate: 0,
    cost: 0,
    payout: 0,
    roi: 0,
  };
}

/**
 * Initialize empty WPS metrics
 */
function createEmptyWPSMetrics(): WPSMetrics {
  return {
    win: createEmptyBetMetrics(),
    place: createEmptyBetMetrics(),
    show: createEmptyBetMetrics(),
  };
}

/**
 * Initialize empty exacta variation metrics
 */
function createEmptyExactaMetrics(): ExactaVariationMetrics {
  return {
    straight: createEmptyBetMetrics(),
    box2: createEmptyBetMetrics(),
    box3: createEmptyBetMetrics(),
    box4: createEmptyBetMetrics(),
    keyValueOver2: createEmptyBetMetrics(),
    keyValueOver3: createEmptyBetMetrics(),
    keyValueOver4: createEmptyBetMetrics(),
    key2OverValue: createEmptyBetMetrics(),
  };
}

/**
 * Initialize empty trifecta variation metrics
 */
function createEmptyTrifectaMetrics(): TrifectaVariationMetrics {
  return {
    straight: createEmptyBetMetrics(),
    box3: createEmptyBetMetrics(),
    box4: createEmptyBetMetrics(),
    box5: createEmptyBetMetrics(),
    keyValueWith2Over3: createEmptyBetMetrics(),
    keyValueWith3Over4: createEmptyBetMetrics(),
    key2WithValueOver3: createEmptyBetMetrics(),
    key2Over3WithValue: createEmptyBetMetrics(),
  };
}

/**
 * Initialize empty superfecta variation metrics
 */
function createEmptySuperfectaMetrics(): SuperfectaVariationMetrics {
  return {
    straight: createEmptyBetMetrics(),
    box4: createEmptyBetMetrics(),
    box5: createEmptyBetMetrics(),
    box6: createEmptyBetMetrics(),
    keyValueWith3Over4Over5: createEmptyBetMetrics(),
    keyValueInAnyTop4: createEmptyBetMetrics(),
  };
}

/**
 * Initialize empty value horse performance metrics
 */
function createEmptyValueHorseMetrics(): ValueHorsePerformanceMetrics {
  return {
    totalRacesWithValueHorse: 0,
    valueHorseByTier: {
      HIGH: { races: 0, wins: 0, places: 0, shows: 0, boards: 0 },
      MEDIUM: { races: 0, wins: 0, places: 0, shows: 0, boards: 0 },
      LOW: { races: 0, wins: 0, places: 0, shows: 0, boards: 0 },
    },
    overall: {
      winRate: 0,
      placeRate: 0,
      showRate: 0,
      boardRate: 0,
    },
  };
}

/**
 * Calculate ROI for bet metrics
 */
function calculateBetROI(metrics: BetTypeMetrics): number {
  if (metrics.cost === 0) return 0;
  return ((metrics.payout - metrics.cost) / metrics.cost) * 100;
}

/**
 * Calculate hit rate for bet metrics
 */
function calculateBetHitRate(metrics: BetTypeMetrics): number {
  if (metrics.races === 0) return 0;
  return (metrics.hits / metrics.races) * 100;
}

/**
 * Finalize bet metrics (calculate derived values)
 */
function finalizeBetMetrics(metrics: BetTypeMetrics): BetTypeMetrics {
  return {
    ...metrics,
    hitRate: calculateBetHitRate(metrics),
    roi: calculateBetROI(metrics),
  };
}

/**
 * Map value horse signal strength to confidence tier
 */
function mapSignalStrengthToTier(
  strength: 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'
): 'HIGH' | 'MEDIUM' | 'LOW' | null {
  switch (strength) {
    case 'VERY_STRONG':
    case 'STRONG':
      return 'HIGH';
    case 'MODERATE':
      return 'MEDIUM';
    case 'WEAK':
      return 'LOW';
    case 'NONE':
    default:
      return null;
  }
}

// ============================================================================
// MAIN VALIDATION RUNNER
// ============================================================================

async function runValidation(): Promise<ValidationResult> {
  const validationStartTime = Date.now();

  console.log('\n' + '═'.repeat(70));
  console.log('          AI ARCHITECTURE VALIDATION TEST HARNESS v2');
  console.log('═'.repeat(70));
  console.log(`Started: ${new Date().toISOString()}`);

  // Check API key
  const status = checkAIServiceStatus();
  if (status !== 'ready') {
    console.error(
      `\nAI Service Status: ${status}. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY environment variable.`
    );
    process.exit(1);
  }
  console.log('AI Service Status: ready\n');

  // Discover test files
  console.log('Discovering test files...');
  const testFiles = discoverTestFiles();

  if (testFiles.length === 0) {
    console.error('No DRF files with results found in data directory');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} tracks with results files\n`);

  // Collect all races
  const allRaces: RaceAnalysisData[] = [];
  const errors: string[] = [];

  for (const { drfPath, resultsPath, trackCode } of testFiles) {
    console.log(`  Parsing ${trackCode}...`);

    try {
      const drfContent = fs.readFileSync(drfPath, 'utf-8');
      const parsed = parseDRFFile(drfContent, path.basename(drfPath));
      const results = parseResultsFile(resultsPath);

      for (const race of parsed.races) {
        const raceResult = results.find((r) => r.raceNumber === race.header.raceNumber);
        if (!raceResult || raceResult.positions.length < 3) {
          continue; // Skip races without complete results
        }

        // Apply scratches
        const scratchedPosts = new Set(raceResult.scratches.map((s) => s.post));
        for (const entry of race.horses) {
          if (scratchedPosts.has(entry.postPosition)) {
            entry.isScratched = true;
          }
        }

        // Set up scoring parameters
        const trackCondition = race.header.trackCondition || 'fast';
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

        allRaces.push({
          race,
          scoredHorses,
          scoringResult,
          raceResult,
        });
      }
    } catch (error) {
      const errorMsg = `Error parsing ${trackCode}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`    ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`\nTotal races to analyze: ${allRaces.length}`);

  // ============================================================================
  // PHASE 1: Calculate algorithm baseline (no AI)
  // ============================================================================
  console.log('\n--- PHASE 1: Algorithm Baseline ---');

  let algorithmWins = 0;
  let algorithmTop3 = 0;
  let algorithmExactaBox4 = 0;
  let algorithmTrifectaBox5 = 0;

  // Algorithm costs: $24 per exacta box 4, $60 per trifecta box 5
  const ALGO_EXACTA_COST_PER_RACE = 12 * 2; // 12 combos @ $2 = $24
  const ALGO_TRIFECTA_COST_PER_RACE = 60 * 1; // 60 combos @ $1 = $60

  // ============================================================================
  // EXPANDED ROI TRACKING INITIALIZATION
  // ============================================================================
  const algorithmOnlyWPS = createEmptyWPSMetrics();
  const algorithmPlusAIWPS = createEmptyWPSMetrics();
  const algorithmOnlyExacta = createEmptyExactaMetrics();
  const algorithmPlusAIExacta = createEmptyExactaMetrics();
  const algorithmOnlyTrifecta = createEmptyTrifectaMetrics();
  const algorithmPlusAITrifecta = createEmptyTrifectaMetrics();
  const algorithmOnlySuperfecta = createEmptySuperfectaMetrics();
  const algorithmPlusAISuperfecta = createEmptySuperfectaMetrics();
  const valueHorseMetrics = createEmptyValueHorseMetrics();

  // Average payout estimates by bet type (used when actual payouts unavailable)
  // Note: These are unused currently as we use odds-based estimation instead
  const _AVG_EXACTA_PAYOUT = 25;
  const _AVG_TRIFECTA_PAYOUT = 150;
  const _AVG_SUPERFECTA_PAYOUT = 500;
  // Suppress unused variable warnings
  void _AVG_EXACTA_PAYOUT;
  void _AVG_TRIFECTA_PAYOUT;
  void _AVG_SUPERFECTA_PAYOUT;

  for (const raceData of allRaces) {
    const { scoringResult, raceResult } = raceData;
    const algoTop6 = scoringResult.scores.slice(0, 6).map((s) => s.programNumber);
    const algoTop5 = algoTop6.slice(0, 5);
    const algoTop4 = algoTop6.slice(0, 4);
    const algoTop3 = algoTop6.slice(0, 3);
    const algoTop2 = algoTop6.slice(0, 2);

    // Get top pick
    const topPick = algoTop6[0]!;

    // Get odds for payout estimates
    const getHorseOdds = (programNumber: number): number => {
      const horse = scoringResult.scores.find((s) => s.programNumber === programNumber);
      return horse?.morningLineDecimal ?? 5.0;
    };

    // Build actual results with 4th position if available
    const actual = {
      first: raceResult.positions[0]?.post || 0,
      second: raceResult.positions[1]?.post || 0,
      third: raceResult.positions[2]?.post || 0,
      fourth: raceResult.positions[3]?.post || 0,
    };

    // Get odds of actual finishers for payout estimation
    const firstOdds = getHorseOdds(actual.first);
    const secondOdds = getHorseOdds(actual.second);
    const thirdOdds = getHorseOdds(actual.third);
    const fourthOdds = getHorseOdds(actual.fourth);

    // Win: algorithm rank 1 finished 1st
    if (algoTop5[0] === actual.first) algorithmWins++;

    // Top 3: algorithm rank 1 finished 1st, 2nd, or 3rd
    if ([actual.first, actual.second, actual.third].includes(algoTop5[0]!)) algorithmTop3++;

    // Exacta Box 4: algorithm ranks 1-4 contain actual 1st and 2nd
    if (checkExactaBox(algoTop4, actual)) algorithmExactaBox4++;

    // Trifecta Box 5: algorithm ranks 1-5 contain actual 1st, 2nd, and 3rd
    if (checkTrifecta(algoTop5, actual)) algorithmTrifectaBox5++;

    // ========================================================================
    // ALGORITHM ONLY - Win/Place/Show Tracking
    // ========================================================================
    const topPickOdds = getHorseOdds(topPick);

    // Win bet
    algorithmOnlyWPS.win.races++;
    algorithmOnlyWPS.win.cost += 2;
    if (checkWinHit(topPick, actual)) {
      algorithmOnlyWPS.win.hits++;
      algorithmOnlyWPS.win.payout += estimateWinPayout(topPickOdds, 2);
    }

    // Place bet
    algorithmOnlyWPS.place.races++;
    algorithmOnlyWPS.place.cost += 2;
    if (checkPlaceHit(topPick, actual)) {
      algorithmOnlyWPS.place.hits++;
      algorithmOnlyWPS.place.payout += estimatePlacePayout(topPickOdds, 2);
    }

    // Show bet
    algorithmOnlyWPS.show.races++;
    algorithmOnlyWPS.show.cost += 2;
    if (checkShowHit(topPick, actual)) {
      algorithmOnlyWPS.show.hits++;
      algorithmOnlyWPS.show.payout += estimateShowPayout(topPickOdds, 2);
    }

    // ========================================================================
    // ALGORITHM ONLY - Exacta Variations
    // ========================================================================

    // Exacta Straight (top 2 in exact order)
    algorithmOnlyExacta.straight.races++;
    algorithmOnlyExacta.straight.cost += 2;
    if (checkExactaStraight(algoTop2, actual)) {
      algorithmOnlyExacta.straight.hits++;
      algorithmOnlyExacta.straight.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
    }

    // Exacta Box 2
    algorithmOnlyExacta.box2.races++;
    algorithmOnlyExacta.box2.cost += calculateExactaBoxCost(2);
    if (checkExactaBoxN(algoTop2, actual)) {
      algorithmOnlyExacta.box2.hits++;
      algorithmOnlyExacta.box2.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
    }

    // Exacta Box 3
    algorithmOnlyExacta.box3.races++;
    algorithmOnlyExacta.box3.cost += calculateExactaBoxCost(3);
    if (checkExactaBoxN(algoTop3, actual)) {
      algorithmOnlyExacta.box3.hits++;
      algorithmOnlyExacta.box3.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
    }

    // Exacta Box 4
    algorithmOnlyExacta.box4.races++;
    algorithmOnlyExacta.box4.cost += calculateExactaBoxCost(4);
    if (checkExactaBoxN(algoTop4, actual)) {
      algorithmOnlyExacta.box4.hits++;
      algorithmOnlyExacta.box4.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
    }

    // ========================================================================
    // ALGORITHM ONLY - Trifecta Variations
    // ========================================================================

    // Trifecta Straight (top 3 in exact order)
    algorithmOnlyTrifecta.straight.races++;
    algorithmOnlyTrifecta.straight.cost += 1;
    if (checkTrifectaStraight(algoTop3, actual)) {
      algorithmOnlyTrifecta.straight.hits++;
      algorithmOnlyTrifecta.straight.payout += estimateTrifectaPayout(
        firstOdds,
        secondOdds,
        thirdOdds,
        1
      );
    }

    // Trifecta Box 3
    algorithmOnlyTrifecta.box3.races++;
    algorithmOnlyTrifecta.box3.cost += calculateTrifectaBoxCost(3);
    if (checkTrifectaBoxN(algoTop3, actual)) {
      algorithmOnlyTrifecta.box3.hits++;
      algorithmOnlyTrifecta.box3.payout += estimateTrifectaPayout(
        firstOdds,
        secondOdds,
        thirdOdds,
        1
      );
    }

    // Trifecta Box 4
    algorithmOnlyTrifecta.box4.races++;
    algorithmOnlyTrifecta.box4.cost += calculateTrifectaBoxCost(4);
    if (checkTrifectaBoxN(algoTop4, actual)) {
      algorithmOnlyTrifecta.box4.hits++;
      algorithmOnlyTrifecta.box4.payout += estimateTrifectaPayout(
        firstOdds,
        secondOdds,
        thirdOdds,
        1
      );
    }

    // Trifecta Box 5
    algorithmOnlyTrifecta.box5.races++;
    algorithmOnlyTrifecta.box5.cost += calculateTrifectaBoxCost(5);
    if (checkTrifectaBoxN(algoTop5, actual)) {
      algorithmOnlyTrifecta.box5.hits++;
      algorithmOnlyTrifecta.box5.payout += estimateTrifectaPayout(
        firstOdds,
        secondOdds,
        thirdOdds,
        1
      );
    }

    // ========================================================================
    // ALGORITHM ONLY - Superfecta Variations (only if 4th place result exists)
    // ========================================================================
    if (actual.fourth > 0) {
      // Superfecta Straight (top 4 in exact order)
      algorithmOnlySuperfecta.straight.races++;
      algorithmOnlySuperfecta.straight.cost += 0.1;
      if (checkSuperfectaStraight(algoTop4, actual)) {
        algorithmOnlySuperfecta.straight.hits++;
        algorithmOnlySuperfecta.straight.payout += estimateSuperfectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          fourthOdds,
          0.1
        );
      }

      // Superfecta Box 4
      algorithmOnlySuperfecta.box4.races++;
      algorithmOnlySuperfecta.box4.cost += calculateSuperfectaBoxCost(4);
      if (checkSuperfectaBoxN(algoTop4, actual)) {
        algorithmOnlySuperfecta.box4.hits++;
        algorithmOnlySuperfecta.box4.payout += estimateSuperfectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          fourthOdds,
          0.1
        );
      }

      // Superfecta Box 5
      algorithmOnlySuperfecta.box5.races++;
      algorithmOnlySuperfecta.box5.cost += calculateSuperfectaBoxCost(5);
      if (checkSuperfectaBoxN(algoTop5, actual)) {
        algorithmOnlySuperfecta.box5.hits++;
        algorithmOnlySuperfecta.box5.payout += estimateSuperfectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          fourthOdds,
          0.1
        );
      }

      // Superfecta Box 6
      algorithmOnlySuperfecta.box6.races++;
      algorithmOnlySuperfecta.box6.cost += calculateSuperfectaBoxCost(6);
      if (checkSuperfectaBoxN(algoTop6, actual)) {
        algorithmOnlySuperfecta.box6.hits++;
        algorithmOnlySuperfecta.box6.payout += estimateSuperfectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          fourthOdds,
          0.1
        );
      }
    }
  }

  // Calculate algorithm costs
  const totalAlgorithmExactaCost = allRaces.length * ALGO_EXACTA_COST_PER_RACE;
  const totalAlgorithmTrifectaCost = allRaces.length * ALGO_TRIFECTA_COST_PER_RACE;

  console.log(`  Algorithm Win Rate: ${formatRate(algorithmWins, allRaces.length)}`);
  console.log(`  Algorithm Top 3 Rate: ${formatRate(algorithmTop3, allRaces.length)}`);
  console.log(
    `  Algorithm Exacta Box 4: ${formatRate(algorithmExactaBox4, allRaces.length)}  Cost: $${totalAlgorithmExactaCost}`
  );
  console.log(
    `  Algorithm Trifecta Box 5: ${formatRate(algorithmTrifectaBox5, allRaces.length)}  Cost: $${totalAlgorithmTrifectaCost}`
  );

  // ============================================================================
  // PHASE 2: Run AI analysis on all races (parallel batches)
  // ============================================================================
  console.log('\n--- PHASE 2: AI Analysis ---');
  console.log(`Processing ${allRaces.length} races with AI in batches of ${BATCH_SIZE}...`);

  const phase2StartTime = Date.now();
  const totalBatches = Math.ceil(allRaces.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, allRaces.length);
    const batch = allRaces.slice(batchStart, batchEnd);

    const batchStartTime = Date.now();
    console.log(
      `  Batch ${batchIndex + 1}/${totalBatches}: races ${batchStart + 1}-${batchEnd}...`
    );

    // Process all races in this batch in parallel
    const batchPromises = batch.map(async (raceData) => {
      try {
        const aiAnalysis = await getMultiBotAnalysis(raceData.race, raceData.scoringResult, {
          forceRefresh: true,
          recordMetrics: false,
        });
        raceData.aiAnalysis = aiAnalysis;

        // DEBUG: Trace AI output structure
        if (batchIndex === 0 && raceData === batch[0]) {
          console.log('\n=== DEBUG: First race AI analysis structure ===');
          console.log('aiAnalysis keys:', Object.keys(aiAnalysis));
          console.log('ticketConstruction exists:', aiAnalysis.ticketConstruction !== undefined);
          console.log('betConstruction exists:', aiAnalysis.betConstruction !== undefined);
          if (aiAnalysis.ticketConstruction) {
            console.log('ticketConstruction.template:', aiAnalysis.ticketConstruction.template);
            console.log(
              'ticketConstruction.algorithmTop4:',
              aiAnalysis.ticketConstruction.algorithmTop4
            );
            console.log('ticketConstruction.sizing:', aiAnalysis.ticketConstruction.sizing);
          } else {
            console.log('>>> ticketConstruction is MISSING! <<<');
          }
          console.log('=== END DEBUG ===\n');
        }

        return { success: true, raceData };
      } catch (error) {
        const errorMsg = `AI Error R${raceData.race.header.raceNumber}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        return { success: false, raceData, error };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    const batchElapsed = ((Date.now() - batchStartTime) / 1000).toFixed(1);
    const successCount = batchResults.filter((r) => r.success).length;
    const failCount = batchResults.filter((r) => !r.success).length;
    console.log(
      `    Batch ${batchIndex + 1} complete: ${successCount} succeeded, ${failCount} failed (${batchElapsed}s)`
    );

    // Check if any rate limit errors occurred in this batch
    const rateLimitErrors = batchResults.filter(
      (r) =>
        !r.success && (String(r.error).includes('429') || String(r.error).includes('RATE_LIMIT'))
    );
    if (rateLimitErrors.length > 0) {
      console.log(`    Rate limit detected, waiting 30s before next batch...`);
      await delay(30000);
    }
  }

  const phase2Elapsed = ((Date.now() - phase2StartTime) / 1000).toFixed(1);
  console.log(`\nPhase 2 completed in ${phase2Elapsed}s`);

  // Filter races with AI ticketConstruction (new system) or betConstruction (legacy)
  const racesWithAI = allRaces.filter(
    (r) => r.aiAnalysis?.ticketConstruction || r.aiAnalysis?.betConstruction
  );
  console.log(`\nRaces with AI analysis: ${racesWithAI.length}`);

  // DEBUG: Trace field availability
  const racesWithTicketConstruction = allRaces.filter((r) => r.aiAnalysis?.ticketConstruction);
  const racesWithBetConstruction = allRaces.filter((r) => r.aiAnalysis?.betConstruction);
  const racesWithAiAnalysis = allRaces.filter((r) => r.aiAnalysis);
  console.log(`  - Races with aiAnalysis: ${racesWithAiAnalysis.length}`);
  console.log(`  - Races with ticketConstruction: ${racesWithTicketConstruction.length}`);
  console.log(`  - Races with betConstruction: ${racesWithBetConstruction.length}`);

  // ============================================================================
  // PHASE 3: Template-Based Performance Tracking
  // ============================================================================
  console.log('\n--- PHASE 3: Template Performance Analysis ---');

  // Template distribution tracking
  const templateCounts: Record<TicketTemplate | 'PASS', number> = { A: 0, B: 0, C: 0, PASS: 0 };

  // Template performance tracking
  const templateStats: Record<
    TicketTemplate,
    {
      races: number;
      wins: number;
      exactaHits: number;
      exactaCost: number;
      exactaPayout: number;
      trifectaHits: number;
      trifectaCost: number;
      trifectaPayout: number;
    }
  > = {
    A: {
      races: 0,
      wins: 0,
      exactaHits: 0,
      exactaCost: 0,
      exactaPayout: 0,
      trifectaHits: 0,
      trifectaCost: 0,
      trifectaPayout: 0,
    },
    B: {
      races: 0,
      wins: 0,
      exactaHits: 0,
      exactaCost: 0,
      exactaPayout: 0,
      trifectaHits: 0,
      trifectaCost: 0,
      trifectaPayout: 0,
    },
    C: {
      races: 0,
      wins: 0,
      exactaHits: 0,
      exactaCost: 0,
      exactaPayout: 0,
      trifectaHits: 0,
      trifectaCost: 0,
      trifectaPayout: 0,
    },
  };

  // Odds bracket tracking for Template B favorite fading
  const oddsBracketStats: Record<
    'heavy' | 'mid' | 'light',
    {
      races: number;
      favoritesLost: number;
      exactaHits: number;
      exactaCost: number;
      exactaPayout: number;
    }
  > = {
    heavy: { races: 0, favoritesLost: 0, exactaHits: 0, exactaCost: 0, exactaPayout: 0 }, // ≤2-1
    mid: { races: 0, favoritesLost: 0, exactaHits: 0, exactaCost: 0, exactaPayout: 0 }, // 5/2-7/2
    light: { races: 0, favoritesLost: 0, exactaHits: 0, exactaCost: 0, exactaPayout: 0 }, // 4-1+
  };

  // Sizing performance tracking
  const sizingStats: Record<
    SizingRecommendationType,
    {
      races: number;
      exactaHits: number;
      totalConfidence: number;
    }
  > = {
    MAX: { races: 0, exactaHits: 0, totalConfidence: 0 },
    STRONG: { races: 0, exactaHits: 0, totalConfidence: 0 },
    STANDARD: { races: 0, exactaHits: 0, totalConfidence: 0 },
    HALF: { races: 0, exactaHits: 0, totalConfidence: 0 },
    PASS: { races: 0, exactaHits: 0, totalConfidence: 0 },
  };

  // Track PASS races - would have hit?
  let passWouldHaveHitExacta = 0;
  let passWouldHaveHitTrifecta = 0;

  // AI system win tracking (for comparison metrics)
  let aiSystemWins = 0;
  let aiSystemExactaHits = 0;
  let aiSystemTrifectaHits = 0;
  let aiSystemRacesBet = 0;

  // Vulnerable favorite tracking
  let vulnerableFavoritesDetected = 0;
  let vulnerableFavoritesLost = 0;
  let templateBExactaHits = 0;

  // Total AI costs and payouts
  let totalAIExactaCost = 0;
  let totalAITrifectaCost = 0;
  let totalAIExactaPayout = 0;
  let totalAITrifectaPayout = 0;

  let processedRaceCount = 0;
  for (const raceData of racesWithAI) {
    const ticketConstruction = raceData.aiAnalysis!.ticketConstruction;
    const betConstruction = raceData.aiAnalysis!.betConstruction;
    const raceResult = raceData.raceResult;
    const scoringResult = raceData.scoringResult;

    // DEBUG: First few races
    if (processedRaceCount < 3) {
      console.log(
        `  DEBUG Race ${processedRaceCount + 1}: ticketConstruction=${ticketConstruction ? 'exists' : 'null'}, betConstruction=${betConstruction ? 'exists' : 'null'}`
      );
      if (ticketConstruction) {
        console.log(
          `    template=${ticketConstruction.template}, sizing=${ticketConstruction.sizing?.recommendation}`
        );
      }
    }
    processedRaceCount++;

    const actual = {
      first: raceResult.positions[0]?.post || 0,
      second: raceResult.positions[1]?.post || 0,
      third: raceResult.positions[2]?.post || 0,
    };

    // Get algorithm top 5 for hit checking
    const algoTop5 = scoringResult.scores.slice(0, 5).map((s) => s.programNumber);
    const algoTop4 = algoTop5.slice(0, 4);

    // Handle new ticketConstruction system
    if (ticketConstruction) {
      const template = ticketConstruction.template;
      const sizing = ticketConstruction.sizing;
      const confidence = ticketConstruction.confidenceScore;
      const multiplier = sizing.multiplier;
      const sizingRec = sizing.recommendation;

      // Track if this is a PASS (sizing = 0 or verdict = PASS)
      if (sizingRec === 'PASS' || ticketConstruction.verdict.action === 'PASS') {
        templateCounts.PASS++;
        sizingStats.PASS.races++;
        sizingStats.PASS.totalConfidence += confidence;

        // Check if algorithm would have hit this race
        if (checkExactaBox(algoTop4, actual)) {
          passWouldHaveHitExacta++;
        }
        if (checkTrifecta(algoTop5, actual)) {
          passWouldHaveHitTrifecta++;
        }
        continue;
      }

      // Track AI system bet (non-PASS)
      aiSystemRacesBet++;

      // Count template distribution
      templateCounts[template]++;

      // Track template stats
      templateStats[template].races++;

      // Calculate costs for this race
      const { exactaCost, trifectaCost } = calculateTicketCost(template, multiplier);
      templateStats[template].exactaCost += exactaCost;
      templateStats[template].trifectaCost += trifectaCost;
      totalAIExactaCost += exactaCost;
      totalAITrifectaCost += trifectaCost;

      // Check win (algorithm rank 1 wins)
      const algoRank1 = ticketConstruction.algorithmTop4[0];
      const win = algoRank1 === actual.first;
      if (win) {
        templateStats[template].wins++;
        aiSystemWins++;
      }

      // Check hits based on template
      const exactaHit = checkTemplateExactaHit(template, ticketConstruction.algorithmTop4, actual);
      const trifectaHit = checkTemplateTrifectaHit(template, algoTop5, actual);

      if (exactaHit) {
        templateStats[template].exactaHits++;
        aiSystemExactaHits++;
        const payout = getEstimatedPayout(template, 'exacta') * multiplier;
        templateStats[template].exactaPayout += payout;
        totalAIExactaPayout += payout;
      }

      if (trifectaHit) {
        templateStats[template].trifectaHits++;
        aiSystemTrifectaHits++;
        const payout = getEstimatedPayout(template, 'trifecta') * multiplier;
        templateStats[template].trifectaPayout += payout;
        totalAITrifectaPayout += payout;
      }

      // Track sizing stats
      sizingStats[sizingRec].races++;
      sizingStats[sizingRec].totalConfidence += confidence;
      if (exactaHit) {
        sizingStats[sizingRec].exactaHits++;
      }

      // Track vulnerable favorites (Template B)
      if (template === 'B' || ticketConstruction.favoriteStatus === 'VULNERABLE') {
        vulnerableFavoritesDetected++;
        // Check if favorite actually lost (didn't win)
        const favoritePost = ticketConstruction.algorithmTop4[0];
        const favoriteLost = favoritePost !== actual.first;
        if (favoriteLost) {
          vulnerableFavoritesLost++;
        }
        if (exactaHit) {
          templateBExactaHits++;
        }

        // Track by odds bracket (Template B only)
        if (template === 'B') {
          // Get favorite's morning line odds
          const favoriteHorse = scoringResult.scores.find((s) => s.programNumber === favoritePost);
          const favoriteOdds = favoriteHorse?.morningLineOdds || '5-1';
          const decimalOdds = parseOddsToDecimal(favoriteOdds);
          const bracket = getOddsBracket(decimalOdds);

          oddsBracketStats[bracket].races++;
          if (favoriteLost) {
            oddsBracketStats[bracket].favoritesLost++;
          }
          if (exactaHit) {
            oddsBracketStats[bracket].exactaHits++;
            oddsBracketStats[bracket].exactaPayout +=
              getEstimatedPayout('B', 'exacta') * multiplier;
          }
          const { exactaCost: bracketExactaCost } = calculateTicketCost('B', multiplier);
          oddsBracketStats[bracket].exactaCost += bracketExactaCost;
        }
      }

      // ========================================================================
      // VALUE HORSE TRACKING & KEYED BET VARIATIONS
      // ========================================================================
      const valueHorse = ticketConstruction.valueHorse;
      const algoTop6 = scoringResult.scores.slice(0, 6).map((s) => s.programNumber);
      const algoTop3 = algoTop5.slice(0, 3);

      // Get 4th position for superfecta tracking
      const actualWithFourth = {
        ...actual,
        fourth: raceResult.positions[3]?.post || 0,
      };

      // Get odds for payout estimation
      const getHorseOddsAI = (programNumber: number): number => {
        const horse = scoringResult.scores.find((s) => s.programNumber === programNumber);
        return horse?.morningLineDecimal ?? 5.0;
      };

      const firstOdds = getHorseOddsAI(actual.first);
      const secondOdds = getHorseOddsAI(actual.second);
      const thirdOdds = getHorseOddsAI(actual.third);
      const fourthOdds = getHorseOddsAI(actualWithFourth.fourth);

      // Algorithm+AI WPS (using algorithm's top pick but only for non-PASS races)
      const aiTopPick = ticketConstruction.algorithmTop4[0]!;
      const aiTopPickOdds = getHorseOddsAI(aiTopPick);

      // Win bet
      algorithmPlusAIWPS.win.races++;
      algorithmPlusAIWPS.win.cost += 2;
      if (checkWinHit(aiTopPick, actual)) {
        algorithmPlusAIWPS.win.hits++;
        algorithmPlusAIWPS.win.payout += estimateWinPayout(aiTopPickOdds, 2);
      }

      // Place bet
      algorithmPlusAIWPS.place.races++;
      algorithmPlusAIWPS.place.cost += 2;
      if (checkPlaceHit(aiTopPick, actual)) {
        algorithmPlusAIWPS.place.hits++;
        algorithmPlusAIWPS.place.payout += estimatePlacePayout(aiTopPickOdds, 2);
      }

      // Show bet
      algorithmPlusAIWPS.show.races++;
      algorithmPlusAIWPS.show.cost += 2;
      if (checkShowHit(aiTopPick, actual)) {
        algorithmPlusAIWPS.show.hits++;
        algorithmPlusAIWPS.show.payout += estimateShowPayout(aiTopPickOdds, 2);
      }

      // Algorithm+AI Exacta variations (box bets using algorithm picks)
      // Exacta Straight
      algorithmPlusAIExacta.straight.races++;
      algorithmPlusAIExacta.straight.cost += 2;
      if (checkExactaStraight(ticketConstruction.algorithmTop4, actual)) {
        algorithmPlusAIExacta.straight.hits++;
        algorithmPlusAIExacta.straight.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
      }

      // Exacta Box 2
      algorithmPlusAIExacta.box2.races++;
      algorithmPlusAIExacta.box2.cost += calculateExactaBoxCost(2);
      if (checkExactaBoxN(ticketConstruction.algorithmTop4.slice(0, 2), actual)) {
        algorithmPlusAIExacta.box2.hits++;
        algorithmPlusAIExacta.box2.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
      }

      // Exacta Box 3
      algorithmPlusAIExacta.box3.races++;
      algorithmPlusAIExacta.box3.cost += calculateExactaBoxCost(3);
      if (checkExactaBoxN(ticketConstruction.algorithmTop4.slice(0, 3), actual)) {
        algorithmPlusAIExacta.box3.hits++;
        algorithmPlusAIExacta.box3.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
      }

      // Exacta Box 4
      algorithmPlusAIExacta.box4.races++;
      algorithmPlusAIExacta.box4.cost += calculateExactaBoxCost(4);
      if (checkExactaBoxN(ticketConstruction.algorithmTop4, actual)) {
        algorithmPlusAIExacta.box4.hits++;
        algorithmPlusAIExacta.box4.payout += estimateExactaPayout(firstOdds, secondOdds, 2);
      }

      // Algorithm+AI Trifecta variations
      // Trifecta Straight
      algorithmPlusAITrifecta.straight.races++;
      algorithmPlusAITrifecta.straight.cost += 1;
      if (checkTrifectaStraight(algoTop3, actual)) {
        algorithmPlusAITrifecta.straight.hits++;
        algorithmPlusAITrifecta.straight.payout += estimateTrifectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          1
        );
      }

      // Trifecta Box 3
      algorithmPlusAITrifecta.box3.races++;
      algorithmPlusAITrifecta.box3.cost += calculateTrifectaBoxCost(3);
      if (checkTrifectaBoxN(algoTop3, actual)) {
        algorithmPlusAITrifecta.box3.hits++;
        algorithmPlusAITrifecta.box3.payout += estimateTrifectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          1
        );
      }

      // Trifecta Box 4
      algorithmPlusAITrifecta.box4.races++;
      algorithmPlusAITrifecta.box4.cost += calculateTrifectaBoxCost(4);
      if (checkTrifectaBoxN(algoTop4, actual)) {
        algorithmPlusAITrifecta.box4.hits++;
        algorithmPlusAITrifecta.box4.payout += estimateTrifectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          1
        );
      }

      // Trifecta Box 5
      algorithmPlusAITrifecta.box5.races++;
      algorithmPlusAITrifecta.box5.cost += calculateTrifectaBoxCost(5);
      if (checkTrifectaBoxN(algoTop5, actual)) {
        algorithmPlusAITrifecta.box5.hits++;
        algorithmPlusAITrifecta.box5.payout += estimateTrifectaPayout(
          firstOdds,
          secondOdds,
          thirdOdds,
          1
        );
      }

      // Algorithm+AI Superfecta variations (only if 4th place exists)
      if (actualWithFourth.fourth > 0) {
        // Superfecta Straight
        algorithmPlusAISuperfecta.straight.races++;
        algorithmPlusAISuperfecta.straight.cost += 0.1;
        if (checkSuperfectaStraight(algoTop4, actualWithFourth)) {
          algorithmPlusAISuperfecta.straight.hits++;
          algorithmPlusAISuperfecta.straight.payout += estimateSuperfectaPayout(
            firstOdds,
            secondOdds,
            thirdOdds,
            fourthOdds,
            0.1
          );
        }

        // Superfecta Box 4
        algorithmPlusAISuperfecta.box4.races++;
        algorithmPlusAISuperfecta.box4.cost += calculateSuperfectaBoxCost(4);
        if (checkSuperfectaBoxN(algoTop4, actualWithFourth)) {
          algorithmPlusAISuperfecta.box4.hits++;
          algorithmPlusAISuperfecta.box4.payout += estimateSuperfectaPayout(
            firstOdds,
            secondOdds,
            thirdOdds,
            fourthOdds,
            0.1
          );
        }

        // Superfecta Box 5
        algorithmPlusAISuperfecta.box5.races++;
        algorithmPlusAISuperfecta.box5.cost += calculateSuperfectaBoxCost(5);
        if (checkSuperfectaBoxN(algoTop5, actualWithFourth)) {
          algorithmPlusAISuperfecta.box5.hits++;
          algorithmPlusAISuperfecta.box5.payout += estimateSuperfectaPayout(
            firstOdds,
            secondOdds,
            thirdOdds,
            fourthOdds,
            0.1
          );
        }

        // Superfecta Box 6
        algorithmPlusAISuperfecta.box6.races++;
        algorithmPlusAISuperfecta.box6.cost += calculateSuperfectaBoxCost(6);
        if (checkSuperfectaBoxN(algoTop6, actualWithFourth)) {
          algorithmPlusAISuperfecta.box6.hits++;
          algorithmPlusAISuperfecta.box6.payout += estimateSuperfectaPayout(
            firstOdds,
            secondOdds,
            thirdOdds,
            fourthOdds,
            0.1
          );
        }
      }

      // ========================================================================
      // VALUE HORSE SPECIFIC TRACKING
      // Only track for races where a value horse was identified (HIGH/MEDIUM/LOW)
      // ========================================================================
      if (valueHorse.identified && valueHorse.programNumber !== null) {
        const vhProgramNumber = valueHorse.programNumber;
        const vhTier = mapSignalStrengthToTier(valueHorse.signalStrength);

        if (vhTier) {
          valueHorseMetrics.totalRacesWithValueHorse++;
          valueHorseMetrics.valueHorseByTier[vhTier].races++;

          // Win: value horse finishes 1st
          if (vhProgramNumber === actual.first) {
            valueHorseMetrics.valueHorseByTier[vhTier].wins++;
          }
          // Place: value horse finishes 1st or 2nd
          if (vhProgramNumber === actual.first || vhProgramNumber === actual.second) {
            valueHorseMetrics.valueHorseByTier[vhTier].places++;
          }
          // Show: value horse finishes 1st, 2nd, or 3rd
          if (
            vhProgramNumber === actual.first ||
            vhProgramNumber === actual.second ||
            vhProgramNumber === actual.third
          ) {
            valueHorseMetrics.valueHorseByTier[vhTier].shows++;
          }
          // Board: value horse finishes in top 4
          if (
            actualWithFourth.fourth > 0 &&
            (vhProgramNumber === actual.first ||
              vhProgramNumber === actual.second ||
              vhProgramNumber === actual.third ||
              vhProgramNumber === actualWithFourth.fourth)
          ) {
            valueHorseMetrics.valueHorseByTier[vhTier].boards++;
          }

          // Get horses OTHER than the value horse for keyed bets
          const othersTop4 = ticketConstruction.algorithmTop4.filter((p) => p !== vhProgramNumber);
          const othersTop5 = algoTop5.filter((p) => p !== vhProgramNumber);
          const othersTop6 = algoTop6.filter((p) => p !== vhProgramNumber);

          // ====================================================================
          // EXACTA KEYED BETS (only for races with value horse)
          // ====================================================================

          // Exacta Key: Value horse over 2 (value wins, 2 others fill 2nd)
          if (othersTop4.length >= 2) {
            const withHorses2 = othersTop4.slice(0, 2);
            algorithmPlusAIExacta.keyValueOver2.races++;
            algorithmPlusAIExacta.keyValueOver2.cost += calculateExactaKeyCost(2);
            if (checkExactaKeyOver(vhProgramNumber, withHorses2, actual)) {
              algorithmPlusAIExacta.keyValueOver2.hits++;
              algorithmPlusAIExacta.keyValueOver2.payout += estimateExactaPayout(
                firstOdds,
                secondOdds,
                2
              );
            }
          }

          // Exacta Key: Value horse over 3
          if (othersTop4.length >= 3) {
            const withHorses3 = othersTop4.slice(0, 3);
            algorithmPlusAIExacta.keyValueOver3.races++;
            algorithmPlusAIExacta.keyValueOver3.cost += calculateExactaKeyCost(3);
            if (checkExactaKeyOver(vhProgramNumber, withHorses3, actual)) {
              algorithmPlusAIExacta.keyValueOver3.hits++;
              algorithmPlusAIExacta.keyValueOver3.payout += estimateExactaPayout(
                firstOdds,
                secondOdds,
                2
              );
            }
          }

          // Exacta Key: Value horse over 4
          if (othersTop5.length >= 4) {
            const withHorses4 = othersTop5.slice(0, 4);
            algorithmPlusAIExacta.keyValueOver4.races++;
            algorithmPlusAIExacta.keyValueOver4.cost += calculateExactaKeyCost(4);
            if (checkExactaKeyOver(vhProgramNumber, withHorses4, actual)) {
              algorithmPlusAIExacta.keyValueOver4.hits++;
              algorithmPlusAIExacta.keyValueOver4.payout += estimateExactaPayout(
                firstOdds,
                secondOdds,
                2
              );
            }
          }

          // Exacta Key: 2 over value horse (2 others win, value finishes 2nd)
          if (othersTop4.length >= 2) {
            const winHorses2 = othersTop4.slice(0, 2);
            algorithmPlusAIExacta.key2OverValue.races++;
            algorithmPlusAIExacta.key2OverValue.cost += calculateExactaKeyCost(2);
            if (checkExactaKeyUnder(vhProgramNumber, winHorses2, actual)) {
              algorithmPlusAIExacta.key2OverValue.hits++;
              algorithmPlusAIExacta.key2OverValue.payout += estimateExactaPayout(
                firstOdds,
                secondOdds,
                2
              );
            }
          }

          // ====================================================================
          // TRIFECTA KEYED BETS (only for races with value horse)
          // ====================================================================

          // Trifecta Key: Value horse with 2 over 3
          // Value 1st, top 2 others for 2nd, top 3 others for 3rd
          if (othersTop4.length >= 3) {
            const aHorses = othersTop4.slice(0, 2);
            const bHorses = othersTop4.slice(0, 3);
            algorithmPlusAITrifecta.keyValueWith2Over3.races++;
            algorithmPlusAITrifecta.keyValueWith2Over3.cost += calculateTrifectaKeyCost(2, 3);
            if (checkTrifectaKeyWithAOverB(vhProgramNumber, aHorses, bHorses, actual)) {
              algorithmPlusAITrifecta.keyValueWith2Over3.hits++;
              algorithmPlusAITrifecta.keyValueWith2Over3.payout += estimateTrifectaPayout(
                firstOdds,
                secondOdds,
                thirdOdds,
                1
              );
            }
          }

          // Trifecta Key: Value horse with 3 over 4
          if (othersTop5.length >= 4) {
            const aHorses = othersTop5.slice(0, 3);
            const bHorses = othersTop5.slice(0, 4);
            algorithmPlusAITrifecta.keyValueWith3Over4.races++;
            algorithmPlusAITrifecta.keyValueWith3Over4.cost += calculateTrifectaKeyCost(3, 4);
            if (checkTrifectaKeyWithAOverB(vhProgramNumber, aHorses, bHorses, actual)) {
              algorithmPlusAITrifecta.keyValueWith3Over4.hits++;
              algorithmPlusAITrifecta.keyValueWith3Over4.payout += estimateTrifectaPayout(
                firstOdds,
                secondOdds,
                thirdOdds,
                1
              );
            }
          }

          // Trifecta Key: 2 with value horse over 3
          // 2 others for 1st, value 2nd, 3 others for 3rd
          if (othersTop4.length >= 3) {
            const aHorses = othersTop4.slice(0, 2);
            const bHorses = othersTop4.slice(0, 3);
            algorithmPlusAITrifecta.key2WithValueOver3.races++;
            algorithmPlusAITrifecta.key2WithValueOver3.cost += calculateTrifectaKeyCost(2, 3);
            if (checkTrifectaAWithKeyOverB(aHorses, vhProgramNumber, bHorses, actual)) {
              algorithmPlusAITrifecta.key2WithValueOver3.hits++;
              algorithmPlusAITrifecta.key2WithValueOver3.payout += estimateTrifectaPayout(
                firstOdds,
                secondOdds,
                thirdOdds,
                1
              );
            }
          }

          // Trifecta Key: 2 over 3 with value horse
          // 2 others for 1st, 3 others for 2nd, value 3rd
          if (othersTop4.length >= 3) {
            const aHorses = othersTop4.slice(0, 2);
            const bHorses = othersTop4.slice(0, 3);
            algorithmPlusAITrifecta.key2Over3WithValue.races++;
            algorithmPlusAITrifecta.key2Over3WithValue.cost += calculateTrifectaKeyCost(2, 3);
            if (checkTrifectaAOverBWithKey(aHorses, bHorses, vhProgramNumber, actual)) {
              algorithmPlusAITrifecta.key2Over3WithValue.hits++;
              algorithmPlusAITrifecta.key2Over3WithValue.payout += estimateTrifectaPayout(
                firstOdds,
                secondOdds,
                thirdOdds,
                1
              );
            }
          }

          // ====================================================================
          // SUPERFECTA KEYED BETS (only for races with value horse AND 4th place)
          // ====================================================================
          if (actualWithFourth.fourth > 0) {
            // Superfecta Key: Value horse with 3 over 4 over 5
            // Value 1st, 3 others for 2nd, 4 others for 3rd, 5 others for 4th
            if (othersTop6.length >= 5) {
              const aHorses = othersTop6.slice(0, 3);
              const bHorses = othersTop6.slice(0, 4);
              const cHorses = othersTop6.slice(0, 5);
              algorithmPlusAISuperfecta.keyValueWith3Over4Over5.races++;
              algorithmPlusAISuperfecta.keyValueWith3Over4Over5.cost += calculateSuperfectaKeyCost(
                3,
                4,
                5
              );
              if (
                checkSuperfectaKeyWithAOverBOverC(
                  vhProgramNumber,
                  aHorses,
                  bHorses,
                  cHorses,
                  actualWithFourth
                )
              ) {
                algorithmPlusAISuperfecta.keyValueWith3Over4Over5.hits++;
                algorithmPlusAISuperfecta.keyValueWith3Over4Over5.payout +=
                  estimateSuperfectaPayout(firstOdds, secondOdds, thirdOdds, fourthOdds, 0.1);
              }
            }

            // Superfecta Key: Value horse in any top 4 position
            // Value somewhere in 1-2-3-4 combined with top 5 others
            if (othersTop5.length >= 3) {
              algorithmPlusAISuperfecta.keyValueInAnyTop4.races++;
              algorithmPlusAISuperfecta.keyValueInAnyTop4.cost += calculateSuperfectaBoxCost(4); // Approximate
              if (checkSuperfectaKeyInAnyTop4(vhProgramNumber, othersTop5, actualWithFourth)) {
                algorithmPlusAISuperfecta.keyValueInAnyTop4.hits++;
                algorithmPlusAISuperfecta.keyValueInAnyTop4.payout += estimateSuperfectaPayout(
                  firstOdds,
                  secondOdds,
                  thirdOdds,
                  fourthOdds,
                  0.1
                );
              }
            }
          }
        }
      }
    }
    // Handle legacy betConstruction system (backwards compatibility)
    else if (betConstruction) {
      // For legacy system, treat as Template A or B based on contractionTarget
      const template: TicketTemplate = betConstruction.contractionTarget !== null ? 'B' : 'A';
      const multiplier = 1.0; // Default multiplier for legacy

      templateCounts[template]++;
      templateStats[template].races++;

      const { exactaCost, trifectaCost } = calculateTicketCost(template, multiplier);
      templateStats[template].exactaCost += exactaCost;
      templateStats[template].trifectaCost += trifectaCost;
      totalAIExactaCost += exactaCost;
      totalAITrifectaCost += trifectaCost;

      // Check hits using legacy logic (box-based)
      const exactaHit = checkExactaBox(betConstruction.algorithmTop4, actual);
      const trifectaHit = checkTrifecta(
        [...betConstruction.algorithmTop4, ...(betConstruction.expansionHorses ?? [])],
        actual
      );

      if (exactaHit) {
        templateStats[template].exactaHits++;
        const payout = getEstimatedPayout(template, 'exacta') * multiplier;
        templateStats[template].exactaPayout += payout;
        totalAIExactaPayout += payout;
      }

      if (trifectaHit) {
        templateStats[template].trifectaHits++;
        const payout = getEstimatedPayout(template, 'trifecta') * multiplier;
        templateStats[template].trifectaPayout += payout;
        totalAITrifectaPayout += payout;
      }

      // Track sizing as STANDARD for legacy
      sizingStats.STANDARD.races++;
      sizingStats.STANDARD.totalConfidence += 50;
      if (exactaHit) {
        sizingStats.STANDARD.exactaHits++;
      }

      // Track vulnerable favorites
      if (betConstruction.contractionTarget !== null) {
        vulnerableFavoritesDetected++;
        if (betConstruction.contractionTarget !== actual.first) {
          vulnerableFavoritesLost++;
        }
        if (exactaHit) {
          templateBExactaHits++;
        }
      }
    }
  }

  console.log(`  Template A (Solid):      ${templateCounts.A} races`);
  console.log(`  Template B (Vulnerable): ${templateCounts.B} races`);
  console.log(`  Template C (Wide Open):  ${templateCounts.C} races`);
  console.log(`  PASS:                    ${templateCounts.PASS} races`);

  // DEBUG: Trace template stats
  console.log('\n  DEBUG Template Stats:');
  console.log(`    Total racesWithAI processed: ${racesWithAI.length}`);
  console.log(`    Template A stats: ${JSON.stringify(templateStats.A)}`);
  console.log(`    Template B stats: ${JSON.stringify(templateStats.B)}`);
  console.log(`    Sizing MAX stats: ${JSON.stringify(sizingStats.MAX)}`);
  console.log(`    Sizing STANDARD stats: ${JSON.stringify(sizingStats.STANDARD)}`);

  // ============================================================================
  // PHASE 4: Calculate ROI Metrics
  // ============================================================================
  console.log('\n--- PHASE 4: ROI Calculation ---');

  // Algorithm ROI calculation (estimate payouts based on average)
  const avgExactaPayout = 25; // Average payout for exacta hit
  const avgTrifectaPayout = 150; // Average payout for trifecta hit
  const algorithmExactaPayout = algorithmExactaBox4 * avgExactaPayout;
  const algorithmTrifectaPayout = algorithmTrifectaBox5 * avgTrifectaPayout;
  const algorithmExactaROI =
    totalAlgorithmExactaCost > 0
      ? ((algorithmExactaPayout - totalAlgorithmExactaCost) / totalAlgorithmExactaCost) * 100
      : 0;
  const algorithmTrifectaROI =
    totalAlgorithmTrifectaCost > 0
      ? ((algorithmTrifectaPayout - totalAlgorithmTrifectaCost) / totalAlgorithmTrifectaCost) * 100
      : 0;

  // AI ROI calculation
  const aiExactaROI =
    totalAIExactaCost > 0
      ? ((totalAIExactaPayout - totalAIExactaCost) / totalAIExactaCost) * 100
      : 0;
  const aiTrifectaROI =
    totalAITrifectaCost > 0
      ? ((totalAITrifectaPayout - totalAITrifectaCost) / totalAITrifectaCost) * 100
      : 0;

  // Cost reduction
  const totalAlgorithmCost = totalAlgorithmExactaCost + totalAlgorithmTrifectaCost;
  const totalAICost = totalAIExactaCost + totalAITrifectaCost;
  const costReduction =
    totalAlgorithmCost > 0 ? ((totalAlgorithmCost - totalAICost) / totalAlgorithmCost) * 100 : 0;

  console.log(
    `  Algorithm Exacta ROI: ${algorithmExactaROI.toFixed(1)}% (Cost: $${totalAlgorithmExactaCost}, Payout: $${algorithmExactaPayout})`
  );
  console.log(
    `  Algorithm Trifecta ROI: ${algorithmTrifectaROI.toFixed(1)}% (Cost: $${totalAlgorithmTrifectaCost}, Payout: $${algorithmTrifectaPayout})`
  );
  console.log(
    `  AI Exacta ROI: ${aiExactaROI.toFixed(1)}% (Cost: $${totalAIExactaCost.toFixed(0)}, Payout: $${totalAIExactaPayout.toFixed(0)})`
  );
  console.log(
    `  AI Trifecta ROI: ${aiTrifectaROI.toFixed(1)}% (Cost: $${totalAITrifectaCost.toFixed(0)}, Payout: $${totalAITrifectaPayout.toFixed(0)})`
  );
  console.log(`  Cost Reduction: ${costReduction.toFixed(1)}%`);

  // ============================================================================
  // PHASE 5: Sizing Calibration Check
  // ============================================================================
  console.log('\n--- PHASE 5: Sizing Calibration Check ---');

  const sizingHitRates: Record<SizingRecommendationType, number> = {
    MAX: sizingStats.MAX.races > 0 ? (sizingStats.MAX.exactaHits / sizingStats.MAX.races) * 100 : 0,
    STRONG:
      sizingStats.STRONG.races > 0
        ? (sizingStats.STRONG.exactaHits / sizingStats.STRONG.races) * 100
        : 0,
    STANDARD:
      sizingStats.STANDARD.races > 0
        ? (sizingStats.STANDARD.exactaHits / sizingStats.STANDARD.races) * 100
        : 0,
    HALF:
      sizingStats.HALF.races > 0 ? (sizingStats.HALF.exactaHits / sizingStats.HALF.races) * 100 : 0,
    PASS: 0,
  };

  console.log(
    `  MAX:      ${sizingStats.MAX.races} races, ${sizingHitRates.MAX.toFixed(1)}% exacta rate`
  );
  console.log(
    `  STRONG:   ${sizingStats.STRONG.races} races, ${sizingHitRates.STRONG.toFixed(1)}% exacta rate`
  );
  console.log(
    `  STANDARD: ${sizingStats.STANDARD.races} races, ${sizingHitRates.STANDARD.toFixed(1)}% exacta rate`
  );
  console.log(
    `  HALF:     ${sizingStats.HALF.races} races, ${sizingHitRates.HALF.toFixed(1)}% exacta rate`
  );
  console.log(
    `  PASS:     ${sizingStats.PASS.races} races (would have hit: ${passWouldHaveHitExacta})`
  );

  // FLAT BETTING: Sizing calibration check is N/A
  // With flat betting, all non-PASS bets get STANDARD sizing (1.0x multiplier).
  // The old tier-based calibration (MAX >= STRONG >= STANDARD >= HALF) doesn't apply.
  // Instead, we simply check that non-PASS bets have reasonable performance.
  const totalNonPassRaces =
    sizingStats.MAX.races +
    sizingStats.STRONG.races +
    sizingStats.STANDARD.races +
    sizingStats.HALF.races;
  const totalNonPassHits =
    sizingStats.MAX.exactaHits +
    sizingStats.STRONG.exactaHits +
    sizingStats.STANDARD.exactaHits +
    sizingStats.HALF.exactaHits;
  const overallHitRate = totalNonPassRaces > 0 ? (totalNonPassHits / totalNonPassRaces) * 100 : 0;

  // Sizing is "calibrated" if we have any non-PASS races with reasonable hit rate (>10%)
  // Since we're using flat betting, this is primarily a sanity check
  const sizingCalibrated = totalNonPassRaces > 0 && overallHitRate > 10;

  // ============================================================================
  // BUILD FINAL RESULT
  // ============================================================================

  const totalRaces = allRaces.length;
  const racesAnalyzed = racesWithAI.length;
  const racesPassed = templateCounts.PASS;

  // Helper to calculate ROI for a template
  const calculateTemplateROI = (
    stats: typeof templateStats.A,
    type: 'exacta' | 'trifecta'
  ): number => {
    const cost = type === 'exacta' ? stats.exactaCost : stats.trifectaCost;
    const payout = type === 'exacta' ? stats.exactaPayout : stats.trifectaPayout;
    return cost > 0 ? ((payout - cost) / cost) * 100 : 0;
  };

  // Calculate template performance metrics
  const buildTemplatePerformance = (stats: typeof templateStats.A): TemplatePerformanceMetrics => ({
    races: stats.races,
    wins: stats.wins,
    winRate: stats.races > 0 ? (stats.wins / stats.races) * 100 : 0,
    exactaHits: stats.exactaHits,
    exactaRate: stats.races > 0 ? (stats.exactaHits / stats.races) * 100 : 0,
    exactaCost: stats.exactaCost,
    exactaPayout: stats.exactaPayout,
    exactaROI: calculateTemplateROI(stats, 'exacta'),
    trifectaHits: stats.trifectaHits,
    trifectaRate: stats.races > 0 ? (stats.trifectaHits / stats.races) * 100 : 0,
    trifectaCost: stats.trifectaCost,
    trifectaPayout: stats.trifectaPayout,
    trifectaROI: calculateTemplateROI(stats, 'trifecta'),
  });

  // Build sizing performance metrics
  const buildSizingPerformance = (stats: typeof sizingStats.MAX): SizingPerformanceMetrics => ({
    races: stats.races,
    exactaHits: stats.exactaHits,
    exactaRate: stats.races > 0 ? (stats.exactaHits / stats.races) * 100 : 0,
    avgConfidence: stats.races > 0 ? stats.totalConfidence / stats.races : 0,
  });

  // Verdict logic
  // templatesWork: Template B exacta ROI > algorithm exacta ROI
  // Template B intentionally bets fewer races with tighter tickets - lower hit rate, better ROI
  const templateBExactaROI = calculateTemplateROI(templateStats.B, 'exacta');
  const templatesWork = templateBExactaROI > algorithmExactaROI;

  // roiPositive: AI ROI > Algorithm ROI
  const roiPositive = aiExactaROI > algorithmExactaROI;

  // Determine recommendation
  let recommendation: 'DEPLOY' | 'TUNE' | 'REVERT';
  const verdictCount = [templatesWork, sizingCalibrated, roiPositive].filter(Boolean).length;
  if (verdictCount === 3) {
    recommendation = 'DEPLOY';
  } else if (verdictCount >= 1) {
    recommendation = 'TUNE';
  } else {
    recommendation = 'REVERT';
  }

  // ============================================================================
  // FINALIZE EXPANDED ROI METRICS
  // ============================================================================

  // Finalize all Algorithm Only metrics
  const finalAlgoWPS: WPSMetrics = {
    win: finalizeBetMetrics(algorithmOnlyWPS.win),
    place: finalizeBetMetrics(algorithmOnlyWPS.place),
    show: finalizeBetMetrics(algorithmOnlyWPS.show),
  };

  const finalAlgoExacta: ExactaVariationMetrics = {
    straight: finalizeBetMetrics(algorithmOnlyExacta.straight),
    box2: finalizeBetMetrics(algorithmOnlyExacta.box2),
    box3: finalizeBetMetrics(algorithmOnlyExacta.box3),
    box4: finalizeBetMetrics(algorithmOnlyExacta.box4),
    keyValueOver2: finalizeBetMetrics(algorithmOnlyExacta.keyValueOver2),
    keyValueOver3: finalizeBetMetrics(algorithmOnlyExacta.keyValueOver3),
    keyValueOver4: finalizeBetMetrics(algorithmOnlyExacta.keyValueOver4),
    key2OverValue: finalizeBetMetrics(algorithmOnlyExacta.key2OverValue),
  };

  const finalAlgoTrifecta: TrifectaVariationMetrics = {
    straight: finalizeBetMetrics(algorithmOnlyTrifecta.straight),
    box3: finalizeBetMetrics(algorithmOnlyTrifecta.box3),
    box4: finalizeBetMetrics(algorithmOnlyTrifecta.box4),
    box5: finalizeBetMetrics(algorithmOnlyTrifecta.box5),
    keyValueWith2Over3: finalizeBetMetrics(algorithmOnlyTrifecta.keyValueWith2Over3),
    keyValueWith3Over4: finalizeBetMetrics(algorithmOnlyTrifecta.keyValueWith3Over4),
    key2WithValueOver3: finalizeBetMetrics(algorithmOnlyTrifecta.key2WithValueOver3),
    key2Over3WithValue: finalizeBetMetrics(algorithmOnlyTrifecta.key2Over3WithValue),
  };

  const finalAlgoSuperfecta: SuperfectaVariationMetrics = {
    straight: finalizeBetMetrics(algorithmOnlySuperfecta.straight),
    box4: finalizeBetMetrics(algorithmOnlySuperfecta.box4),
    box5: finalizeBetMetrics(algorithmOnlySuperfecta.box5),
    box6: finalizeBetMetrics(algorithmOnlySuperfecta.box6),
    keyValueWith3Over4Over5: finalizeBetMetrics(algorithmOnlySuperfecta.keyValueWith3Over4Over5),
    keyValueInAnyTop4: finalizeBetMetrics(algorithmOnlySuperfecta.keyValueInAnyTop4),
  };

  // Finalize all Algorithm+AI metrics
  const finalAIWPS: WPSMetrics = {
    win: finalizeBetMetrics(algorithmPlusAIWPS.win),
    place: finalizeBetMetrics(algorithmPlusAIWPS.place),
    show: finalizeBetMetrics(algorithmPlusAIWPS.show),
  };

  const finalAIExacta: ExactaVariationMetrics = {
    straight: finalizeBetMetrics(algorithmPlusAIExacta.straight),
    box2: finalizeBetMetrics(algorithmPlusAIExacta.box2),
    box3: finalizeBetMetrics(algorithmPlusAIExacta.box3),
    box4: finalizeBetMetrics(algorithmPlusAIExacta.box4),
    keyValueOver2: finalizeBetMetrics(algorithmPlusAIExacta.keyValueOver2),
    keyValueOver3: finalizeBetMetrics(algorithmPlusAIExacta.keyValueOver3),
    keyValueOver4: finalizeBetMetrics(algorithmPlusAIExacta.keyValueOver4),
    key2OverValue: finalizeBetMetrics(algorithmPlusAIExacta.key2OverValue),
  };

  const finalAITrifecta: TrifectaVariationMetrics = {
    straight: finalizeBetMetrics(algorithmPlusAITrifecta.straight),
    box3: finalizeBetMetrics(algorithmPlusAITrifecta.box3),
    box4: finalizeBetMetrics(algorithmPlusAITrifecta.box4),
    box5: finalizeBetMetrics(algorithmPlusAITrifecta.box5),
    keyValueWith2Over3: finalizeBetMetrics(algorithmPlusAITrifecta.keyValueWith2Over3),
    keyValueWith3Over4: finalizeBetMetrics(algorithmPlusAITrifecta.keyValueWith3Over4),
    key2WithValueOver3: finalizeBetMetrics(algorithmPlusAITrifecta.key2WithValueOver3),
    key2Over3WithValue: finalizeBetMetrics(algorithmPlusAITrifecta.key2Over3WithValue),
  };

  const finalAISuperfecta: SuperfectaVariationMetrics = {
    straight: finalizeBetMetrics(algorithmPlusAISuperfecta.straight),
    box4: finalizeBetMetrics(algorithmPlusAISuperfecta.box4),
    box5: finalizeBetMetrics(algorithmPlusAISuperfecta.box5),
    box6: finalizeBetMetrics(algorithmPlusAISuperfecta.box6),
    keyValueWith3Over4Over5: finalizeBetMetrics(algorithmPlusAISuperfecta.keyValueWith3Over4Over5),
    keyValueInAnyTop4: finalizeBetMetrics(algorithmPlusAISuperfecta.keyValueInAnyTop4),
  };

  // Finalize value horse metrics
  const totalVHRaces = valueHorseMetrics.totalRacesWithValueHorse;
  const vhHigh = valueHorseMetrics.valueHorseByTier.HIGH;
  const vhMedium = valueHorseMetrics.valueHorseByTier.MEDIUM;
  const vhLow = valueHorseMetrics.valueHorseByTier.LOW;

  const totalVHWins = vhHigh.wins + vhMedium.wins + vhLow.wins;
  const totalVHPlaces = vhHigh.places + vhMedium.places + vhLow.places;
  const totalVHShows = vhHigh.shows + vhMedium.shows + vhLow.shows;
  const totalVHBoards = vhHigh.boards + vhMedium.boards + vhLow.boards;

  const finalValueHorseMetrics: ValueHorsePerformanceMetrics = {
    totalRacesWithValueHorse: totalVHRaces,
    valueHorseByTier: valueHorseMetrics.valueHorseByTier,
    overall: {
      winRate: totalVHRaces > 0 ? (totalVHWins / totalVHRaces) * 100 : 0,
      placeRate: totalVHRaces > 0 ? (totalVHPlaces / totalVHRaces) * 100 : 0,
      showRate: totalVHRaces > 0 ? (totalVHShows / totalVHRaces) * 100 : 0,
      boardRate: totalVHRaces > 0 ? (totalVHBoards / totalVHRaces) * 100 : 0,
    },
  };

  const result: ValidationResult = {
    runDate: new Date().toISOString(),
    totalRaces,
    racesAnalyzed,
    racesPassed,
    errors,

    algorithmBaseline: {
      winRate: toPercentage(algorithmWins, totalRaces),
      top3Rate: toPercentage(algorithmTop3, totalRaces),
      exactaBox4Rate: toPercentage(algorithmExactaBox4, totalRaces),
      exactaBox4Cost: totalAlgorithmExactaCost,
      trifectaBox5Rate: toPercentage(algorithmTrifectaBox5, totalRaces),
      trifectaBox5Cost: totalAlgorithmTrifectaCost,
      wins: algorithmWins,
      top3Hits: algorithmTop3,
      exactaBox4Hits: algorithmExactaBox4,
      trifectaBox5Hits: algorithmTrifectaBox5,
    },

    templateDistribution: {
      templateA: {
        count: templateCounts.A,
        percentage: toPercentage(templateCounts.A, racesAnalyzed),
      },
      templateB: {
        count: templateCounts.B,
        percentage: toPercentage(templateCounts.B, racesAnalyzed),
      },
      templateC: {
        count: templateCounts.C,
        percentage: toPercentage(templateCounts.C, racesAnalyzed),
      },
      passed: {
        count: templateCounts.PASS,
        percentage: toPercentage(templateCounts.PASS, racesAnalyzed),
      },
    },

    templatePerformance: {
      templateA: buildTemplatePerformance(templateStats.A),
      templateB: buildTemplatePerformance(templateStats.B),
      templateC: buildTemplatePerformance(templateStats.C),
    },

    sizingPerformance: {
      MAX: buildSizingPerformance(sizingStats.MAX),
      STRONG: buildSizingPerformance(sizingStats.STRONG),
      STANDARD: buildSizingPerformance(sizingStats.STANDARD),
      HALF: buildSizingPerformance(sizingStats.HALF),
      PASS: {
        races: sizingStats.PASS.races,
        wouldHaveHit: passWouldHaveHitExacta,
        correctPassRate:
          sizingStats.PASS.races > 0
            ? ((sizingStats.PASS.races - passWouldHaveHitExacta) / sizingStats.PASS.races) * 100
            : 0,
      },
    },

    vulnerableFavoriteAnalysis: {
      detected: vulnerableFavoritesDetected,
      actuallyLost: vulnerableFavoritesLost,
      accuracy:
        vulnerableFavoritesDetected > 0
          ? (vulnerableFavoritesLost / vulnerableFavoritesDetected) * 100
          : 0,
      templateBExactaHits,
      templateBExactaRate: toPercentage(templateBExactaHits, templateCounts.B),
    },

    roiSummary: {
      algorithmExactaROI,
      algorithmTrifectaROI,
      aiExactaROI,
      aiTrifectaROI,
      exactaImprovement: aiExactaROI - algorithmExactaROI,
      trifectaImprovement: aiTrifectaROI - algorithmTrifectaROI,
      totalAlgorithmCost,
      totalAICost,
      costReduction,
    },

    verdict: {
      templatesWork,
      sizingCalibrated,
      roiPositive,
      recommendation,
    },

    // TIER 1 COMPARISON METRICS
    tier1Comparison: {
      algorithmOnly: {
        winRate: toPercentage(algorithmWins, totalRaces),
        exactaHitRate: toPercentage(algorithmExactaBox4, totalRaces),
        trifectaHitRate: toPercentage(algorithmTrifectaBox5, totalRaces),
        exactaROI: algorithmExactaROI,
        trifectaROI: algorithmTrifectaROI,
        racesBet: totalRaces,
      },
      algorithmPlusAI: {
        winRate: aiSystemRacesBet > 0 ? toPercentage(aiSystemWins, aiSystemRacesBet) : 0,
        exactaHitRate:
          aiSystemRacesBet > 0 ? toPercentage(aiSystemExactaHits, aiSystemRacesBet) : 0,
        trifectaHitRate:
          aiSystemRacesBet > 0 ? toPercentage(aiSystemTrifectaHits, aiSystemRacesBet) : 0,
        exactaROI: aiExactaROI,
        trifectaROI: aiTrifectaROI,
        racesBet: aiSystemRacesBet,
      },
    },

    // FAVORITE FADE BY ODDS BRACKET
    favoriteFadeByOdds: {
      heavy: {
        races: oddsBracketStats.heavy.races,
        favoritesLost: oddsBracketStats.heavy.favoritesLost,
        fadeAccuracy:
          oddsBracketStats.heavy.races > 0
            ? toPercentage(oddsBracketStats.heavy.favoritesLost, oddsBracketStats.heavy.races)
            : 0,
        exactaHits: oddsBracketStats.heavy.exactaHits,
        exactaCost: oddsBracketStats.heavy.exactaCost,
        exactaPayout: oddsBracketStats.heavy.exactaPayout,
        exactaROI:
          oddsBracketStats.heavy.exactaCost > 0
            ? ((oddsBracketStats.heavy.exactaPayout - oddsBracketStats.heavy.exactaCost) /
                oddsBracketStats.heavy.exactaCost) *
              100
            : 0,
      },
      mid: {
        races: oddsBracketStats.mid.races,
        favoritesLost: oddsBracketStats.mid.favoritesLost,
        fadeAccuracy:
          oddsBracketStats.mid.races > 0
            ? toPercentage(oddsBracketStats.mid.favoritesLost, oddsBracketStats.mid.races)
            : 0,
        exactaHits: oddsBracketStats.mid.exactaHits,
        exactaCost: oddsBracketStats.mid.exactaCost,
        exactaPayout: oddsBracketStats.mid.exactaPayout,
        exactaROI:
          oddsBracketStats.mid.exactaCost > 0
            ? ((oddsBracketStats.mid.exactaPayout - oddsBracketStats.mid.exactaCost) /
                oddsBracketStats.mid.exactaCost) *
              100
            : 0,
      },
      light: {
        races: oddsBracketStats.light.races,
        favoritesLost: oddsBracketStats.light.favoritesLost,
        fadeAccuracy:
          oddsBracketStats.light.races > 0
            ? toPercentage(oddsBracketStats.light.favoritesLost, oddsBracketStats.light.races)
            : 0,
        exactaHits: oddsBracketStats.light.exactaHits,
        exactaCost: oddsBracketStats.light.exactaCost,
        exactaPayout: oddsBracketStats.light.exactaPayout,
        exactaROI:
          oddsBracketStats.light.exactaCost > 0
            ? ((oddsBracketStats.light.exactaPayout - oddsBracketStats.light.exactaCost) /
                oddsBracketStats.light.exactaCost) *
              100
            : 0,
      },
    },

    // PASS FILTER AUDIT
    passFilterAudit: {
      totalPassRaces: templateCounts.PASS,
      passPercentage: racesAnalyzed > 0 ? toPercentage(templateCounts.PASS, racesAnalyzed) : 0,
      wouldHitExactas: passWouldHaveHitExacta,
      wouldHitTrifectas: passWouldHaveHitTrifecta,
      estimatedROIImpact:
        templateCounts.PASS > 0
          ? ((passWouldHaveHitExacta * avgExactaPayout -
              templateCounts.PASS * ALGO_EXACTA_COST_PER_RACE) /
              (templateCounts.PASS * ALGO_EXACTA_COST_PER_RACE)) *
            100
          : 0,
      passRateSuspiciouslyLow:
        racesAnalyzed > 0 && toPercentage(templateCounts.PASS, racesAnalyzed) < 10,
      passRateTooAggressive:
        racesAnalyzed > 0 && toPercentage(templateCounts.PASS, racesAnalyzed) > 40,
    },

    // EXPANDED ROI TRACKING - All bet types
    expandedROI: {
      algorithmOnlyWPS: finalAlgoWPS,
      algorithmPlusAIWPS: finalAIWPS,
      algorithmOnlyExacta: finalAlgoExacta,
      algorithmPlusAIExacta: finalAIExacta,
      algorithmOnlyTrifecta: finalAlgoTrifecta,
      algorithmPlusAITrifecta: finalAITrifecta,
      algorithmOnlySuperfecta: finalAlgoSuperfecta,
      algorithmPlusAISuperfecta: finalAISuperfecta,
      valueHorseMetrics: finalValueHorseMetrics,
    },
  };

  const totalElapsedSeconds = (Date.now() - validationStartTime) / 1000;
  const minutes = Math.floor(totalElapsedSeconds / 60);
  const seconds = (totalElapsedSeconds % 60).toFixed(1);
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`TOTAL EXECUTION TIME: ${minutes}m ${seconds}s`);
  console.log('─'.repeat(70));

  return result;
}

// ============================================================================
// CONSOLE OUTPUT FORMATTING
// ============================================================================

function printReport(result: ValidationResult): void {
  const { algorithmBaseline: baseline, templateDistribution: td, templatePerformance: tp } = result;
  const {
    sizingPerformance: sp,
    vulnerableFavoriteAnalysis: vuln,
    roiSummary: roi,
    verdict,
  } = result;

  console.log('\n');
  console.log('═'.repeat(70));
  console.log('           AI ARCHITECTURE VALIDATION REPORT v2');
  console.log('═'.repeat(70));
  console.log(`Run Date: ${result.runDate}`);
  console.log(
    `Total Races: ${result.totalRaces} | Analyzed: ${result.racesAnalyzed} | Passed: ${result.racesPassed} | Errors: ${result.errors.length}`
  );

  // SECTION A: Algorithm Baseline
  console.log('─'.repeat(70));
  console.log('SECTION A: ALGORITHM BASELINE');
  console.log('─'.repeat(70));
  console.log(`Win Rate:         ${formatRate(baseline.wins, result.totalRaces)}`);
  console.log(`Top 3 Rate:       ${formatRate(baseline.top3Hits, result.totalRaces)}`);
  console.log(
    `Exacta Box 4:     ${formatRate(baseline.exactaBox4Hits, result.totalRaces)}  Cost: $${baseline.exactaBox4Cost.toLocaleString()}  ROI: ${roi.algorithmExactaROI >= 0 ? '+' : ''}${roi.algorithmExactaROI.toFixed(1)}%`
  );
  console.log(
    `Trifecta Box 5:   ${formatRate(baseline.trifectaBox5Hits, result.totalRaces)}  Cost: $${baseline.trifectaBox5Cost.toLocaleString()}  ROI: ${roi.algorithmTrifectaROI >= 0 ? '+' : ''}${roi.algorithmTrifectaROI.toFixed(1)}%`
  );

  // SECTION B: Template Distribution
  console.log('─'.repeat(70));
  console.log('SECTION B: TEMPLATE DISTRIBUTION');
  console.log('─'.repeat(70));
  console.log(
    `Template A (Solid):      ${td.templateA.count.toString().padStart(3)} races (${td.templateA.percentage.toFixed(1)}%)`
  );
  console.log(
    `Template B (Vulnerable): ${td.templateB.count.toString().padStart(3)} races (${td.templateB.percentage.toFixed(1)}%)`
  );
  console.log(
    `Template C (Wide Open):  ${td.templateC.count.toString().padStart(3)} races (${td.templateC.percentage.toFixed(1)}%)`
  );
  console.log(
    `PASS:                    ${td.passed.count.toString().padStart(3)} races (${td.passed.percentage.toFixed(1)}%)`
  );

  // SECTION C: Template Performance
  console.log('─'.repeat(70));
  console.log('SECTION C: TEMPLATE PERFORMANCE');
  console.log('─'.repeat(70));
  console.log('Template    Races   Exacta    Trifecta   Ex Cost   Ex ROI   Tri ROI');
  console.log('─'.repeat(70));

  const formatTemplateRow = (name: string, perf: TemplatePerformanceMetrics) => {
    const exactaStr = `${perf.exactaHits} (${perf.exactaRate.toFixed(0)}%)`;
    const trifectaStr = `${perf.trifectaHits} (${perf.trifectaRate.toFixed(0)}%)`;
    const costStr = `$${perf.exactaCost.toFixed(0)}`;
    const exRoiStr = `${perf.exactaROI >= 0 ? '+' : ''}${perf.exactaROI.toFixed(1)}%`;
    const triRoiStr = `${perf.trifectaROI >= 0 ? '+' : ''}${perf.trifectaROI.toFixed(1)}%`;
    console.log(
      `${name.padEnd(11)} ${perf.races.toString().padStart(3)}     ${exactaStr.padEnd(10)} ${trifectaStr.padEnd(10)} ${costStr.padStart(7)}  ${exRoiStr.padStart(7)}  ${triRoiStr.padStart(7)}`
    );
  };

  formatTemplateRow('A (Solid)', tp.templateA);
  formatTemplateRow('B (Vuln)', tp.templateB);
  formatTemplateRow('C (Wide)', tp.templateC);

  // SECTION D: Sizing Calibration
  console.log('─'.repeat(70));
  console.log('SECTION D: SIZING CALIBRATION');
  console.log('─'.repeat(70));
  console.log('Sizing      Races   Exacta Rate   Avg Confidence');
  console.log('─'.repeat(70));

  const formatSizingRow = (name: string, perf: SizingPerformanceMetrics) => {
    console.log(
      `${name.padEnd(11)} ${perf.races.toString().padStart(3)}       ${perf.exactaRate.toFixed(1).padStart(5)}%          ${perf.avgConfidence.toFixed(1)}`
    );
  };

  formatSizingRow('MAX', sp.MAX);
  formatSizingRow('STRONG', sp.STRONG);
  formatSizingRow('STANDARD', sp.STANDARD);
  formatSizingRow('HALF', sp.HALF);
  console.log(
    `PASS        ${sp.PASS.races.toString().padStart(3)}       (would hit ${sp.PASS.wouldHaveHit})    ${(sp.PASS.races > 0 ? ((result.sizingPerformance.PASS.races - sp.PASS.wouldHaveHit) / result.sizingPerformance.PASS.races) * 100 : 0).toFixed(1)}% correct`
  );
  console.log(
    `Calibration: ${verdict.sizingCalibrated ? '✓' : '✗'} Flat betting - non-PASS hit rate >10%`
  );

  // SECTION E: Vulnerable Favorite Fading
  console.log('─'.repeat(70));
  console.log('SECTION E: VULNERABLE FAVORITE FADING');
  console.log('─'.repeat(70));
  console.log(`Detected:        ${vuln.detected} races`);
  console.log(
    `Actually Lost:   ${vuln.actuallyLost}/${vuln.detected} (${vuln.accuracy.toFixed(1)}% accuracy)`
  );
  console.log(
    `Template B Exacta: ${vuln.templateBExactaHits}/${td.templateB.count} (${vuln.templateBExactaRate.toFixed(1)}%)`
  );

  // SECTION F: ROI Comparison
  console.log('─'.repeat(70));
  console.log('SECTION F: ROI COMPARISON');
  console.log('─'.repeat(70));
  console.log('                Algorithm       AI System       Δ');
  console.log('─'.repeat(70));
  console.log(
    `Exacta ROI      ${roi.algorithmExactaROI >= 0 ? '+' : ''}${roi.algorithmExactaROI.toFixed(1).padStart(6)}%     ${roi.aiExactaROI >= 0 ? '+' : ''}${roi.aiExactaROI.toFixed(1).padStart(6)}%      ${roi.exactaImprovement >= 0 ? '+' : ''}${roi.exactaImprovement.toFixed(1)}%`
  );
  console.log(
    `Trifecta ROI    ${roi.algorithmTrifectaROI >= 0 ? '+' : ''}${roi.algorithmTrifectaROI.toFixed(1).padStart(6)}%     ${roi.aiTrifectaROI >= 0 ? '+' : ''}${roi.aiTrifectaROI.toFixed(1).padStart(6)}%      ${roi.trifectaImprovement >= 0 ? '+' : ''}${roi.trifectaImprovement.toFixed(1)}%`
  );
  console.log(
    `Total Cost      $${roi.totalAlgorithmCost.toLocaleString().padStart(6)}      $${roi.totalAICost.toFixed(0).padStart(6)}       -${roi.costReduction.toFixed(1)}%`
  );

  // VERDICT
  console.log('─'.repeat(70));
  console.log('VERDICT');
  console.log('─'.repeat(70));
  console.log(
    `${verdict.templatesWork ? '✓' : '✗'} Templates work (B ROI outperforms algorithm baseline ROI)`
  );
  console.log(
    `${verdict.sizingCalibrated ? '✓' : '✗'} Sizing calibrated (flat betting - non-PASS hit rate >10%)`
  );
  console.log(`${verdict.roiPositive ? '✓' : '✗'} ROI positive (AI beats algorithm baseline)`);
  console.log(`RECOMMENDATION: ${verdict.recommendation}`);

  // ============================================================================
  // TIER 1 COMPARISON METRICS (Calibration Only)
  // ============================================================================
  const { tier1Comparison: t1, favoriteFadeByOdds: ffbo, passFilterAudit: pfa } = result;

  console.log('\n' + '═'.repeat(70));
  console.log('          TIER 1 COMPARISON METRICS (Calibration Only)');
  console.log('═'.repeat(70));

  // ALGORITHM VS ALGORITHM+AI COMPARISON
  console.log('\n' + '─'.repeat(70));
  console.log('ALGORITHM VS ALGORITHM+AI COMPARISON');
  console.log('─'.repeat(70));
  console.log('Metric              | Algorithm Only | Algorithm+AI | Lift');
  console.log('─'.repeat(70));

  const formatLift = (aiVal: number, algoVal: number): string => {
    const diff = aiVal - algoVal;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const formatRacesLift = (aiRaces: number, algoRaces: number): string => {
    const diff = ((aiRaces - algoRaces) / algoRaces) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  console.log(
    `Win Rate            | ${t1.algorithmOnly.winRate.toFixed(1).padStart(12)}% | ${t1.algorithmPlusAI.winRate.toFixed(1).padStart(10)}% | ${formatLift(t1.algorithmPlusAI.winRate, t1.algorithmOnly.winRate).padStart(7)}`
  );
  console.log(
    `Exacta Hit Rate     | ${t1.algorithmOnly.exactaHitRate.toFixed(1).padStart(12)}% | ${t1.algorithmPlusAI.exactaHitRate.toFixed(1).padStart(10)}% | ${formatLift(t1.algorithmPlusAI.exactaHitRate, t1.algorithmOnly.exactaHitRate).padStart(7)}`
  );
  console.log(
    `Trifecta Hit Rate   | ${t1.algorithmOnly.trifectaHitRate.toFixed(1).padStart(12)}% | ${t1.algorithmPlusAI.trifectaHitRate.toFixed(1).padStart(10)}% | ${formatLift(t1.algorithmPlusAI.trifectaHitRate, t1.algorithmOnly.trifectaHitRate).padStart(7)}`
  );
  console.log(
    `Exacta ROI          | ${t1.algorithmOnly.exactaROI.toFixed(1).padStart(12)}% | ${t1.algorithmPlusAI.exactaROI.toFixed(1).padStart(10)}% | ${formatLift(t1.algorithmPlusAI.exactaROI, t1.algorithmOnly.exactaROI).padStart(7)}`
  );
  console.log(
    `Trifecta ROI        | ${t1.algorithmOnly.trifectaROI.toFixed(1).padStart(12)}% | ${t1.algorithmPlusAI.trifectaROI.toFixed(1).padStart(10)}% | ${formatLift(t1.algorithmPlusAI.trifectaROI, t1.algorithmOnly.trifectaROI).padStart(7)}`
  );
  console.log(
    `Races Bet           | ${t1.algorithmOnly.racesBet.toString().padStart(13)} | ${t1.algorithmPlusAI.racesBet.toString().padStart(11)} | ${formatRacesLift(t1.algorithmPlusAI.racesBet, t1.algorithmOnly.racesBet).padStart(7)}`
  );

  // PER-TEMPLATE PERFORMANCE
  console.log('\n' + '═'.repeat(70));
  console.log('PER-TEMPLATE PERFORMANCE');
  console.log('═'.repeat(70));
  console.log(
    'Template   | Races | Win Rate | Exacta Rate | Trifecta Rate | Exacta ROI | Trifecta ROI'
  );
  console.log('─'.repeat(95));

  const formatTemplateRowTier1 = (
    name: string,
    perf: TemplatePerformanceMetrics,
    flagThreshold = 20
  ) => {
    const flag = perf.races >= flagThreshold && perf.exactaROI < 0 ? ' ⚠️' : '';
    console.log(
      `${name.padEnd(10)} | ${perf.races.toString().padStart(5)} | ${perf.winRate.toFixed(1).padStart(6)}% | ${perf.exactaRate.toFixed(1).padStart(9)}% | ${perf.trifectaRate.toFixed(1).padStart(11)}% | ${(perf.exactaROI >= 0 ? '+' : '') + perf.exactaROI.toFixed(1).padStart(perf.exactaROI >= 0 ? 8 : 9)}% | ${(perf.trifectaROI >= 0 ? '+' : '') + perf.trifectaROI.toFixed(1).padStart(perf.trifectaROI >= 0 ? 10 : 11)}%${flag}`
    );
  };

  formatTemplateRowTier1('A (Solid)', tp.templateA);
  formatTemplateRowTier1('B (Vuln)', tp.templateB);
  formatTemplateRowTier1('C (Wide)', tp.templateC);
  console.log(
    `PASS       | ${td.passed.count.toString().padStart(5)} | (skipped) |   (skipped) |     (skipped) |        N/A |          N/A`
  );

  // FAVORITE FADE ACCURACY BY ODDS
  console.log('\n' + '═'.repeat(70));
  console.log('FAVORITE FADE ACCURACY BY ODDS (Template B Only)');
  console.log('═'.repeat(70));
  console.log('Odds Bracket    | Races | Favorites Lost | Fade Accuracy | Exacta ROI');
  console.log('─'.repeat(70));

  const formatOddsBracketRow = (name: string, bracket: OddsBracketMetrics) => {
    console.log(
      `${name.padEnd(15)} | ${bracket.races.toString().padStart(5)} | ${bracket.favoritesLost.toString().padStart(14)} | ${bracket.fadeAccuracy.toFixed(1).padStart(11)}% | ${(bracket.exactaROI >= 0 ? '+' : '') + bracket.exactaROI.toFixed(1)}%`
    );
  };

  formatOddsBracketRow('Heavy (≤2-1)', ffbo.heavy);
  formatOddsBracketRow('Mid (5/2-7/2)', ffbo.mid);
  formatOddsBracketRow('Light (4-1+)', ffbo.light);

  // PASS FILTER AUDIT
  console.log('\n' + '═'.repeat(70));
  console.log('PASS FILTER AUDIT');
  console.log('═'.repeat(70));
  console.log(
    `Total PASS races: ${pfa.totalPassRaces} (${pfa.passPercentage.toFixed(1)}% of total)`
  );
  console.log('');
  console.log('If PASS races had been bet with Template C:');
  console.log(`  Would-hit exactas:    ${pfa.wouldHitExactas}`);
  console.log(`  Would-hit trifectas:  ${pfa.wouldHitTrifectas}`);
  console.log(
    `  Estimated ROI impact: ${pfa.estimatedROIImpact >= 0 ? '+' : ''}${pfa.estimatedROIImpact.toFixed(1)}%`
  );
  console.log('');
  if (pfa.passRateSuspiciouslyLow) {
    console.log('⚠️  WARNING: PASS rate below 10% (suspiciously low)');
  }
  if (pfa.passRateTooAggressive) {
    console.log('⚠️  WARNING: PASS rate above 40% (too aggressive)');
  }
  if (!pfa.passRateSuspiciouslyLow && !pfa.passRateTooAggressive) {
    console.log('✓  PASS rate within acceptable range (10-40%)');
  }

  console.log('\n' + '═'.repeat(70));

  if (result.errors.length > 0) {
    console.log('\nERRORS:');
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  - ${error}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors`);
    }
  }
}

// ============================================================================
// SUMMARY FILE GENERATION (for GitHub Actions)
// ============================================================================

const SUMMARY_FILE = path.join(__dirname, '../validation-summary.md');

function writeSummaryFile(result: ValidationResult): void {
  const { algorithmBaseline: baseline, templateDistribution: td, templatePerformance: tp } = result;
  const { tier1Comparison: t1, favoriteFadeByOdds: ffbo, passFilterAudit: pfa, verdict } = result;

  const lines: string[] = [];

  // Header
  lines.push('# AI Architecture Validation Results');
  lines.push('');

  // Algorithm Baseline
  lines.push('## Algorithm Baseline');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Win Rate | ${baseline.winRate.toFixed(1)}% |`);
  lines.push(`| Top 3 Rate | ${baseline.top3Rate.toFixed(1)}% |`);
  lines.push(`| Exacta Box 4 | ${baseline.exactaBox4Rate.toFixed(1)}% |`);
  lines.push(`| Trifecta Box 5 | ${baseline.trifectaBox5Rate.toFixed(1)}% |`);
  lines.push('');

  // Verdict
  lines.push('## Verdict');
  lines.push(`- Templates Work: ${verdict.templatesWork ? '✓' : '✗'}`);
  lines.push(`- Sizing Calibrated: ${verdict.sizingCalibrated ? '✓' : '✗'}`);
  lines.push(`- ROI Positive: ${verdict.roiPositive ? '✓' : '✗'}`);
  lines.push(`- **RECOMMENDATION: ${verdict.recommendation}**`);
  lines.push('');

  // Algorithm vs Algorithm+AI Comparison
  lines.push('## Algorithm vs Algorithm+AI Comparison');
  lines.push('| Metric | Algorithm Only | Algorithm+AI | Lift |');
  lines.push('|--------|----------------|--------------|------|');

  const formatLiftMd = (aiVal: number, algoVal: number): string => {
    const diff = aiVal - algoVal;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const formatRacesLiftMd = (aiRaces: number, algoRaces: number): string => {
    if (algoRaces === 0) return 'N/A';
    const diff = ((aiRaces - algoRaces) / algoRaces) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  lines.push(
    `| Win Rate | ${t1.algorithmOnly.winRate.toFixed(1)}% | ${t1.algorithmPlusAI.winRate.toFixed(1)}% | ${formatLiftMd(t1.algorithmPlusAI.winRate, t1.algorithmOnly.winRate)} |`
  );
  lines.push(
    `| Exacta Hit Rate | ${t1.algorithmOnly.exactaHitRate.toFixed(1)}% | ${t1.algorithmPlusAI.exactaHitRate.toFixed(1)}% | ${formatLiftMd(t1.algorithmPlusAI.exactaHitRate, t1.algorithmOnly.exactaHitRate)} |`
  );
  lines.push(
    `| Trifecta Hit Rate | ${t1.algorithmOnly.trifectaHitRate.toFixed(1)}% | ${t1.algorithmPlusAI.trifectaHitRate.toFixed(1)}% | ${formatLiftMd(t1.algorithmPlusAI.trifectaHitRate, t1.algorithmOnly.trifectaHitRate)} |`
  );
  lines.push(
    `| Exacta ROI | ${t1.algorithmOnly.exactaROI.toFixed(1)}% | ${t1.algorithmPlusAI.exactaROI.toFixed(1)}% | ${formatLiftMd(t1.algorithmPlusAI.exactaROI, t1.algorithmOnly.exactaROI)} |`
  );
  lines.push(
    `| Trifecta ROI | ${t1.algorithmOnly.trifectaROI.toFixed(1)}% | ${t1.algorithmPlusAI.trifectaROI.toFixed(1)}% | ${formatLiftMd(t1.algorithmPlusAI.trifectaROI, t1.algorithmOnly.trifectaROI)} |`
  );
  lines.push(
    `| Races Bet | ${t1.algorithmOnly.racesBet} | ${t1.algorithmPlusAI.racesBet} | ${formatRacesLiftMd(t1.algorithmPlusAI.racesBet, t1.algorithmOnly.racesBet)} |`
  );
  lines.push('');

  // Per-Template Performance
  lines.push('## Per-Template Performance');
  lines.push(
    '| Template | Races | Win Rate | Exacta Rate | Trifecta Rate | Exacta ROI | Trifecta ROI |'
  );
  lines.push(
    '|----------|-------|----------|-------------|---------------|------------|--------------|'
  );

  const formatTemplateRowMd = (name: string, perf: TemplatePerformanceMetrics) => {
    return `| ${name} | ${perf.races} | ${perf.winRate.toFixed(1)}% | ${perf.exactaRate.toFixed(1)}% | ${perf.trifectaRate.toFixed(1)}% | ${perf.exactaROI >= 0 ? '+' : ''}${perf.exactaROI.toFixed(1)}% | ${perf.trifectaROI >= 0 ? '+' : ''}${perf.trifectaROI.toFixed(1)}% |`;
  };

  lines.push(formatTemplateRowMd('A (Solid)', tp.templateA));
  lines.push(formatTemplateRowMd('B (Vuln)', tp.templateB));
  lines.push(formatTemplateRowMd('C (Wide)', tp.templateC));
  lines.push(`| PASS | ${td.passed.count} | - | - | - | - | - |`);
  lines.push('');

  // Favorite Fade by Odds (Template B)
  lines.push('## Favorite Fade by Odds (Template B)');
  lines.push('| Odds Bracket | Races | Favorites Lost | Fade Accuracy | Exacta ROI |');
  lines.push('|--------------|-------|----------------|---------------|------------|');

  const formatOddsBracketMd = (name: string, bracket: OddsBracketMetrics) => {
    return `| ${name} | ${bracket.races} | ${bracket.favoritesLost} | ${bracket.fadeAccuracy.toFixed(1)}% | ${bracket.exactaROI >= 0 ? '+' : ''}${bracket.exactaROI.toFixed(1)}% |`;
  };

  lines.push(formatOddsBracketMd('Heavy (≤2-1)', ffbo.heavy));
  lines.push(formatOddsBracketMd('Mid (5/2-7/2)', ffbo.mid));
  lines.push(formatOddsBracketMd('Light (4-1+)', ffbo.light));
  lines.push('');

  // PASS Filter Audit
  lines.push('## PASS Filter Audit');
  lines.push(`- Total PASS races: ${pfa.totalPassRaces} (${pfa.passPercentage.toFixed(1)}%)`);
  lines.push(`- Would-hit exactas if bet: ${pfa.wouldHitExactas}`);
  lines.push(`- Would-hit trifectas if bet: ${pfa.wouldHitTrifectas}`);

  if (pfa.passRateSuspiciouslyLow) {
    lines.push('- PASS rate status: ⚠️ Below 10% (suspiciously low)');
  } else if (pfa.passRateTooAggressive) {
    lines.push('- PASS rate status: ⚠️ Above 40% (too aggressive)');
  } else {
    lines.push('- PASS rate status: ✓ Within acceptable range (10-40%)');
  }
  lines.push('');

  // ============================================================================
  // EXPANDED ROI TRACKING SECTIONS
  // ============================================================================
  const { expandedROI } = result;

  // Helper to format ROI with highlighting for positive values
  const formatROI = (roi: number): string => {
    const prefix = roi >= 0 ? '+' : '';
    const suffix = roi > 0 ? ' **✓**' : '';
    return `${prefix}${roi.toFixed(1)}%${suffix}`;
  };

  // Helper to format a bet type row
  const formatBetRow = (name: string, metrics: BetTypeMetrics): string => {
    if (metrics.races === 0) {
      return `| ${name} | N/A | N/A | N/A | N/A | N/A | N/A |`;
    }
    return `| ${name} | ${metrics.races} | ${metrics.hits} | ${metrics.hitRate.toFixed(1)}% | $${metrics.cost.toFixed(2)} | $${metrics.payout.toFixed(2)} | ${formatROI(metrics.roi)} |`;
  };

  // ============================================================================
  // WIN/PLACE/SHOW SECTION
  // ============================================================================
  lines.push('---');
  lines.push('');
  lines.push('# Expanded ROI Tracking');
  lines.push('');
  lines.push('## Win/Place/Show (WPS)');
  lines.push('');
  lines.push('### Algorithm Only');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Win', expandedROI.algorithmOnlyWPS.win));
  lines.push(formatBetRow('Place', expandedROI.algorithmOnlyWPS.place));
  lines.push(formatBetRow('Show', expandedROI.algorithmOnlyWPS.show));
  lines.push('');

  lines.push('### Algorithm+AI (Non-PASS races only)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Win', expandedROI.algorithmPlusAIWPS.win));
  lines.push(formatBetRow('Place', expandedROI.algorithmPlusAIWPS.place));
  lines.push(formatBetRow('Show', expandedROI.algorithmPlusAIWPS.show));
  lines.push('');

  // ============================================================================
  // EXACTA VARIATIONS SECTION
  // ============================================================================
  lines.push('## Exacta Variations');
  lines.push('');
  lines.push('### Algorithm Only');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Straight (1-2 exact)', expandedROI.algorithmOnlyExacta.straight));
  lines.push(formatBetRow('Box 2', expandedROI.algorithmOnlyExacta.box2));
  lines.push(formatBetRow('Box 3', expandedROI.algorithmOnlyExacta.box3));
  lines.push(formatBetRow('Box 4', expandedROI.algorithmOnlyExacta.box4));
  lines.push('');

  lines.push('### Algorithm+AI (Non-PASS races)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Straight (1-2 exact)', expandedROI.algorithmPlusAIExacta.straight));
  lines.push(formatBetRow('Box 2', expandedROI.algorithmPlusAIExacta.box2));
  lines.push(formatBetRow('Box 3', expandedROI.algorithmPlusAIExacta.box3));
  lines.push(formatBetRow('Box 4', expandedROI.algorithmPlusAIExacta.box4));
  lines.push('');

  lines.push('### Exacta Keys (Value Horse - races with identified value only)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Value over 2', expandedROI.algorithmPlusAIExacta.keyValueOver2));
  lines.push(formatBetRow('Value over 3', expandedROI.algorithmPlusAIExacta.keyValueOver3));
  lines.push(formatBetRow('Value over 4', expandedROI.algorithmPlusAIExacta.keyValueOver4));
  lines.push(formatBetRow('2 over Value', expandedROI.algorithmPlusAIExacta.key2OverValue));
  lines.push('');

  // ============================================================================
  // TRIFECTA VARIATIONS SECTION
  // ============================================================================
  lines.push('## Trifecta Variations');
  lines.push('');
  lines.push('### Algorithm Only');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Straight (1-2-3 exact)', expandedROI.algorithmOnlyTrifecta.straight));
  lines.push(formatBetRow('Box 3', expandedROI.algorithmOnlyTrifecta.box3));
  lines.push(formatBetRow('Box 4', expandedROI.algorithmOnlyTrifecta.box4));
  lines.push(formatBetRow('Box 5', expandedROI.algorithmOnlyTrifecta.box5));
  lines.push('');

  lines.push('### Algorithm+AI (Non-PASS races)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(formatBetRow('Straight (1-2-3 exact)', expandedROI.algorithmPlusAITrifecta.straight));
  lines.push(formatBetRow('Box 3', expandedROI.algorithmPlusAITrifecta.box3));
  lines.push(formatBetRow('Box 4', expandedROI.algorithmPlusAITrifecta.box4));
  lines.push(formatBetRow('Box 5', expandedROI.algorithmPlusAITrifecta.box5));
  lines.push('');

  lines.push('### Trifecta Keys (Value Horse - races with identified value only)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(
    formatBetRow('Value with 2 over 3', expandedROI.algorithmPlusAITrifecta.keyValueWith2Over3)
  );
  lines.push(
    formatBetRow('Value with 3 over 4', expandedROI.algorithmPlusAITrifecta.keyValueWith3Over4)
  );
  lines.push(
    formatBetRow('2 with Value over 3', expandedROI.algorithmPlusAITrifecta.key2WithValueOver3)
  );
  lines.push(
    formatBetRow('2 over 3 with Value', expandedROI.algorithmPlusAITrifecta.key2Over3WithValue)
  );
  lines.push('');

  // ============================================================================
  // SUPERFECTA VARIATIONS SECTION
  // ============================================================================
  lines.push('## Superfecta Variations');
  lines.push('');
  lines.push('### Algorithm Only');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(
    formatBetRow('Straight (1-2-3-4 exact)', expandedROI.algorithmOnlySuperfecta.straight)
  );
  lines.push(formatBetRow('Box 4', expandedROI.algorithmOnlySuperfecta.box4));
  lines.push(formatBetRow('Box 5', expandedROI.algorithmOnlySuperfecta.box5));
  lines.push(formatBetRow('Box 6', expandedROI.algorithmOnlySuperfecta.box6));
  lines.push('');

  lines.push('### Algorithm+AI (Non-PASS races)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(
    formatBetRow('Straight (1-2-3-4 exact)', expandedROI.algorithmPlusAISuperfecta.straight)
  );
  lines.push(formatBetRow('Box 4', expandedROI.algorithmPlusAISuperfecta.box4));
  lines.push(formatBetRow('Box 5', expandedROI.algorithmPlusAISuperfecta.box5));
  lines.push(formatBetRow('Box 6', expandedROI.algorithmPlusAISuperfecta.box6));
  lines.push('');

  lines.push('### Superfecta Keys (Value Horse - races with identified value only)');
  lines.push('| Bet Type | Races | Hits | Hit Rate | Cost | Return | ROI |');
  lines.push('|----------|-------|------|----------|------|--------|-----|');
  lines.push(
    formatBetRow('Value with 3/4/5', expandedROI.algorithmPlusAISuperfecta.keyValueWith3Over4Over5)
  );
  lines.push(
    formatBetRow('Value in any top 4', expandedROI.algorithmPlusAISuperfecta.keyValueInAnyTop4)
  );
  lines.push('');

  // ============================================================================
  // VALUE HORSE METRICS SECTION
  // ============================================================================
  const vh = expandedROI.valueHorseMetrics;
  lines.push('## Value Horse Performance');
  lines.push('');
  lines.push(`**Total Races with Value Horse Identified:** ${vh.totalRacesWithValueHorse}`);
  lines.push('');

  lines.push('### Overall Value Horse Performance');
  lines.push('| Metric | Rate |');
  lines.push('|--------|------|');
  lines.push(`| Win Rate (1st) | ${vh.overall.winRate.toFixed(1)}% |`);
  lines.push(`| Place Rate (top 2) | ${vh.overall.placeRate.toFixed(1)}% |`);
  lines.push(`| Show Rate (top 3) | ${vh.overall.showRate.toFixed(1)}% |`);
  lines.push(`| Board Rate (top 4) | ${vh.overall.boardRate.toFixed(1)}% |`);
  lines.push('');

  lines.push('### Value Horse by Confidence Tier');
  lines.push('| Tier | Races | Wins | Win% | Place | Place% | Show | Show% | Board | Board% |');
  lines.push('|------|-------|------|------|-------|--------|------|-------|-------|--------|');

  const formatTierRow = (
    tier: string,
    data: { races: number; wins: number; places: number; shows: number; boards: number }
  ): string => {
    if (data.races === 0) {
      return `| ${tier} | 0 | - | - | - | - | - | - | - | - |`;
    }
    const winPct = ((data.wins / data.races) * 100).toFixed(1);
    const placePct = ((data.places / data.races) * 100).toFixed(1);
    const showPct = ((data.shows / data.races) * 100).toFixed(1);
    const boardPct = ((data.boards / data.races) * 100).toFixed(1);
    return `| ${tier} | ${data.races} | ${data.wins} | ${winPct}% | ${data.places} | ${placePct}% | ${data.shows} | ${showPct}% | ${data.boards} | ${boardPct}% |`;
  };

  lines.push(formatTierRow('HIGH', vh.valueHorseByTier.HIGH));
  lines.push(formatTierRow('MEDIUM', vh.valueHorseByTier.MEDIUM));
  lines.push(formatTierRow('LOW', vh.valueHorseByTier.LOW));
  lines.push('');

  // Summary
  lines.push('---');
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total Races: ${result.totalRaces}`);
  lines.push(`- Races Analyzed: ${result.racesAnalyzed}`);
  lines.push(`- Errors: ${result.errors.length}`);
  lines.push('');

  // Methodology note
  lines.push('## Methodology Notes');
  lines.push(
    '- **Payout Estimation:** When actual track payouts are unavailable, payouts are estimated based on morning line odds using standard formulas.'
  );
  lines.push('- **Win payout:** Base × (decimal odds + 1)');
  lines.push('- **Place payout:** Base × (decimal odds / 2 + 1)');
  lines.push('- **Show payout:** Base × (decimal odds / 3 + 1)');
  lines.push('- **Exacta payout:** Base × (1st odds × 2nd odds × 0.7 + 2)');
  lines.push('- **Trifecta payout:** Base × (1st × 2nd × 3rd odds × 0.5 + 5)');
  lines.push('- **Superfecta payout:** Base × (1st × 2nd × 3rd × 4th odds × 0.3 + 10)');
  lines.push('');
  lines.push(
    '- **Keyed bets** are only calculated for races where a value horse was identified (HIGH/MEDIUM/LOW confidence tiers).'
  );
  lines.push('- **Positive ROI** bet types are marked with **✓** for easy identification.');
  lines.push('');

  const content = lines.join('\n');
  fs.writeFileSync(SUMMARY_FILE, content);

  // Log file size for verification
  const fileSizeKB = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2);
  console.log(`\nSummary file written to: ${SUMMARY_FILE} (${fileSizeKB} KB)`);
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  try {
    const result = await runValidation();

    // Print human-readable report
    printReport(result);

    // Save full result as JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\nFull results saved to: ${OUTPUT_FILE}`);

    // Write condensed summary file for GitHub Actions
    writeSummaryFile(result);

    // Exit with appropriate code
    if (result.verdict.recommendation === 'REVERT') {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
