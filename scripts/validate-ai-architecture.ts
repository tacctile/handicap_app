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
import type { AIRaceAnalysis, BetConstructionGuidance } from '../src/services/ai/types';
import { analyzePaceScenario } from '../src/lib/scoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = path.join(__dirname, '../src/data');
const OUTPUT_FILE = path.join(__dirname, '../validation-results.json');

// Delay between API calls to avoid rate limiting
const API_DELAY_MS = 500;

// ============================================================================
// TYPES
// ============================================================================

interface ValidationResult {
  // Test metadata
  runDate: string;
  totalRaces: number;
  racesAnalyzed: number;
  errors: string[];

  // SECTION A: Algorithm Baseline (no AI)
  algorithmBaseline: {
    winRate: number;
    top3Rate: number;
    exactaBox4Rate: number;
    trifectaBox5Rate: number;
    wins: number;
    top3Hits: number;
    exactaBox4Hits: number;
    trifectaBox5Hits: number;
  };

  // SECTION B: Expansion Horse Performance
  expansionAnalysis: {
    totalExpansionHorsesIdentified: number;
    expansionHorseWins: number;
    expansionHorseTop3: number;
    expansionHorseWinRate: number;
    expansionHorseTop3Rate: number;
    avgOddsWhenExpansionWon: number;
    // Key metric: did adding sleepers improve exotic hit rate?
    racesWithExpansion: number;
    exactaWithExpansionHitRate: number;
    trifectaWithExpansionHitRate: number;
    exactaWithExpansionHits: number;
    trifectaWithExpansionHits: number;
  };

  // SECTION C: Vulnerable Favorite Analysis
  vulnerableFavoriteAnalysis: {
    totalVulnerableFavoritesDetected: number;
    vulnerableFavoritesActuallyLost: number;
    detectionAccuracy: number;
    // Key metric: did excluding vulnerable favorites improve exotic returns?
    exactaExcludingVulnerableHitRate: number;
    trifectaExcludingVulnerableHitRate: number;
    exactaExcludingVulnerableHits: number;
    trifectaExcludingVulnerableHits: number;
  };

  // SECTION D: Ticket Strategy Comparison
  ticketStrategyComparison: {
    // Compare AI-recommended tickets vs naive algorithm boxes
    naiveExactaBox4Hits: number;
    naiveExactaBox4Rate: number;
    aiExactaStrategyHits: number;
    aiExactaStrategyRate: number;
    exactaImprovement: number;

    naiveTrifectaBox5Hits: number;
    naiveTrifectaBox5Rate: number;
    aiTrifectaStrategyHits: number;
    aiTrifectaStrategyRate: number;
    trifectaImprovement: number;
  };

  // SECTION E: Signal Quality
  signalQuality: {
    tripTroubleHighCount: number;
    tripTroubleHighAccuracy: number; // % that hit board
    tripTroubleHighHits: number;
    paceAdvantageStrongCount: number;
    paceAdvantageStrongAccuracy: number;
    paceAdvantageStrongHits: number;
    vulnerableFavoriteHighCount: number;
    vulnerableFavoriteHighAccuracy: number; // % that actually lost
    vulnerableFavoriteHighLost: number;
  };

  // SECTION F: Summary Verdict
  verdict: {
    expansionHorsesAddValue: boolean; // true if expansion top3 rate > 33%
    vulnerableDetectionWorks: boolean; // true if accuracy > 60%
    ticketStrategiesImprove: boolean; // true if AI strategies beat naive
    overallRecommendation: 'DEPLOY' | 'TUNE' | 'REVERT';
  };
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

function checkExactaBox(candidates: number[], actual: { first: number; second: number }): boolean {
  return candidates.includes(actual.first) && candidates.includes(actual.second);
}

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

function checkAIExactaStrategy(
  guidance: BetConstructionGuidance,
  actual: { first: number; second: number }
): boolean {
  const strategy = guidance.exactaStrategy;

  switch (strategy.type) {
    case 'KEY':
      // Key horse must be first OR second, and the other must be in include list
      if (strategy.keyHorse === actual.first && strategy.includeHorses.includes(actual.second)) {
        return true;
      }
      if (strategy.keyHorse === actual.second && strategy.includeHorses.includes(actual.first)) {
        return true;
      }
      return false;

    case 'BOX':
      // Both must be in include list
      return (
        strategy.includeHorses.includes(actual.first) &&
        strategy.includeHorses.includes(actual.second)
      );

    case 'PART_WHEEL':
      // Key horse must be first, with others in include list
      // OR reverse depending on wheel direction
      if (strategy.keyHorse === actual.first && strategy.includeHorses.includes(actual.second)) {
        return true;
      }
      // Also check with key in second spot
      if (strategy.keyHorse === actual.second && strategy.includeHorses.includes(actual.first)) {
        return true;
      }
      return false;

    default:
      return false;
  }
}

function checkAITrifectaStrategy(
  guidance: BetConstructionGuidance,
  actual: { first: number; second: number; third: number }
): boolean {
  const strategy = guidance.trifectaStrategy;
  const aHorses = strategy.aHorses;
  const bHorses = strategy.bHorses;
  const allHorses = [...aHorses, ...bHorses];

  // Check if all finishers are covered
  return (
    allHorses.includes(actual.first) &&
    allHorses.includes(actual.second) &&
    allHorses.includes(actual.third)
  );
}

// ============================================================================
// MAIN VALIDATION RUNNER
// ============================================================================

async function runValidation(): Promise<ValidationResult> {
  console.log('\n' + '═'.repeat(70));
  console.log('          AI ARCHITECTURE VALIDATION TEST HARNESS');
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

  for (const raceData of allRaces) {
    const { scoringResult, raceResult } = raceData;
    const algoTop5 = scoringResult.scores.slice(0, 5).map((s) => s.programNumber);
    const algoTop4 = algoTop5.slice(0, 4);

    const actual = {
      first: raceResult.positions[0]?.post || 0,
      second: raceResult.positions[1]?.post || 0,
      third: raceResult.positions[2]?.post || 0,
    };

    // Win: algorithm rank 1 finished 1st
    if (algoTop5[0] === actual.first) algorithmWins++;

    // Top 3: algorithm rank 1 finished 1st, 2nd, or 3rd
    if ([actual.first, actual.second, actual.third].includes(algoTop5[0]!)) algorithmTop3++;

    // Exacta Box 4: algorithm ranks 1-4 contain actual 1st and 2nd
    if (checkExactaBox(algoTop4, actual)) algorithmExactaBox4++;

    // Trifecta Box 5: algorithm ranks 1-5 contain actual 1st, 2nd, and 3rd
    if (checkTrifecta(algoTop5, actual)) algorithmTrifectaBox5++;
  }

  console.log(`  Algorithm Win Rate: ${formatRate(algorithmWins, allRaces.length)}`);
  console.log(`  Algorithm Top 3 Rate: ${formatRate(algorithmTop3, allRaces.length)}`);
  console.log(`  Algorithm Exacta Box 4: ${formatRate(algorithmExactaBox4, allRaces.length)}`);
  console.log(`  Algorithm Trifecta Box 5: ${formatRate(algorithmTrifectaBox5, allRaces.length)}`);

  // ============================================================================
  // PHASE 2: Run AI analysis on all races
  // ============================================================================
  console.log('\n--- PHASE 2: AI Analysis ---');
  console.log(`Processing ${allRaces.length} races with AI...`);

  let processedCount = 0;
  for (const raceData of allRaces) {
    processedCount++;
    if (processedCount % 10 === 0 || processedCount === 1) {
      console.log(`  Processing ${processedCount}/${allRaces.length}...`);
    }

    try {
      const aiAnalysis = await getMultiBotAnalysis(raceData.race, raceData.scoringResult, {
        forceRefresh: true,
        recordMetrics: false,
      });
      raceData.aiAnalysis = aiAnalysis;
    } catch (error) {
      const errorMsg = `AI Error R${raceData.race.header.raceNumber}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);

      // Check for rate limit
      if (String(error).includes('429') || String(error).includes('RATE_LIMIT')) {
        console.log(`    Rate limited, waiting 30s...`);
        await delay(30000);
      }
    }

    // Add delay between API calls
    await delay(API_DELAY_MS);
  }

  // Filter races with AI analysis
  const racesWithAI = allRaces.filter((r) => r.aiAnalysis?.betConstruction);
  console.log(`\nRaces with AI analysis: ${racesWithAI.length}`);

  // ============================================================================
  // PHASE 3: Analyze expansion horse performance
  // ============================================================================
  console.log('\n--- PHASE 3: Expansion Horse Analysis ---');

  let totalExpansionHorses = 0;
  let expansionWins = 0;
  let expansionTop3 = 0;
  let expansionOddsSum = 0;
  let racesWithExpansion = 0;
  let exactaWithExpansionHits = 0;
  let trifectaWithExpansionHits = 0;

  // Signal quality tracking
  let tripTroubleHighCount = 0;
  let tripTroubleHighHits = 0;
  let paceAdvantageStrongCount = 0;
  let paceAdvantageStrongHits = 0;

  for (const raceData of racesWithAI) {
    const guidance = raceData.aiAnalysis!.betConstruction!;
    const raceResult = raceData.raceResult;

    const actual = {
      first: raceResult.positions[0]?.post || 0,
      second: raceResult.positions[1]?.post || 0,
      third: raceResult.positions[2]?.post || 0,
    };
    const actualTop3 = [actual.first, actual.second, actual.third];

    if (guidance.expansionHorses.length > 0) {
      racesWithExpansion++;
      totalExpansionHorses += guidance.expansionHorses.length;

      for (const expHorse of guidance.expansionHorses) {
        if (expHorse === actual.first) {
          expansionWins++;
          // Get odds for winning expansion horse
          const horseScore = raceData.scoringResult.scores.find(
            (s) => s.programNumber === expHorse
          );
          if (horseScore) {
            expansionOddsSum += horseScore.morningLineDecimal;
          }
        }
        if (actualTop3.includes(expHorse)) {
          expansionTop3++;
        }
      }

      // Check if expanded ticket hit
      const expandedList = [...guidance.algorithmTop4, ...guidance.expansionHorses];
      if (checkExactaBox(expandedList.slice(0, 5), actual)) exactaWithExpansionHits++;
      if (checkTrifecta(expandedList, actual)) trifectaWithExpansionHits++;
    }

    // Track signal quality from horse insights
    if (raceData.aiAnalysis!.horseInsights) {
      for (const insight of raceData.aiAnalysis!.horseInsights) {
        // Check for trip trouble HIGH (identified by one-liner or key strength)
        if (
          insight.keyStrength?.toLowerCase().includes('trip') ||
          insight.oneLiner?.toLowerCase().includes('hidden')
        ) {
          tripTroubleHighCount++;
          if (actualTop3.includes(insight.programNumber)) {
            tripTroubleHighHits++;
          }
        }

        // Check for pace advantage STRONG
        if (
          insight.keyStrength?.toLowerCase().includes('lone speed') ||
          insight.oneLiner?.toLowerCase().includes('lone speed')
        ) {
          paceAdvantageStrongCount++;
          if (actualTop3.includes(insight.programNumber)) {
            paceAdvantageStrongHits++;
          }
        }
      }
    }
  }

  console.log(
    `  Expansion horses identified: ${totalExpansionHorses} across ${racesWithExpansion} races`
  );
  console.log(`  Expansion horse wins: ${formatRate(expansionWins, totalExpansionHorses)}`);
  console.log(`  Expansion horse top 3: ${formatRate(expansionTop3, totalExpansionHorses)}`);
  if (expansionWins > 0) {
    console.log(
      `  Avg odds when expansion won: ${(expansionOddsSum / expansionWins).toFixed(1)}-1`
    );
  }

  // ============================================================================
  // PHASE 4: Analyze vulnerable favorite detection
  // ============================================================================
  console.log('\n--- PHASE 4: Vulnerable Favorite Analysis ---');

  let vulnerableFavoritesDetected = 0;
  let vulnerableFavoritesLost = 0;
  let exactaExcludingVulnerableHits = 0;
  let trifectaExcludingVulnerableHits = 0;
  let vulnerableFavoriteHighCount = 0;
  let vulnerableFavoriteHighLost = 0;

  for (const raceData of racesWithAI) {
    const guidance = raceData.aiAnalysis!.betConstruction!;
    const raceResult = raceData.raceResult;

    const actual = {
      first: raceResult.positions[0]?.post || 0,
      second: raceResult.positions[1]?.post || 0,
      third: raceResult.positions[2]?.post || 0,
    };

    if (guidance.contractionTarget !== null) {
      vulnerableFavoritesDetected++;

      // Did the vulnerable favorite actually lose (finish 2nd or worse)?
      if (guidance.contractionTarget !== actual.first) {
        vulnerableFavoritesLost++;
      }

      // Check exotic performance excluding vulnerable favorite
      const ticketWithoutVulnerable = guidance.algorithmTop4.filter(
        (p) => p !== guidance.contractionTarget
      );
      const expandedWithoutVulnerable = [...ticketWithoutVulnerable, ...guidance.expansionHorses];

      if (checkExactaBox(expandedWithoutVulnerable, actual)) exactaExcludingVulnerableHits++;
      if (checkTrifecta(expandedWithoutVulnerable, actual)) trifectaExcludingVulnerableHits++;
    }

    // Track HIGH confidence vulnerable favorite detections
    if (raceData.aiAnalysis!.vulnerableFavorite) {
      vulnerableFavoriteHighCount++;
      const algoRank1 = raceData.scoringResult.scores[0]?.programNumber;
      if (algoRank1 !== actual.first) {
        vulnerableFavoriteHighLost++;
      }
    }
  }

  console.log(`  Vulnerable favorites detected: ${vulnerableFavoritesDetected}`);
  console.log(
    `  Actually lost: ${formatRate(vulnerableFavoritesLost, vulnerableFavoritesDetected)}`
  );

  // ============================================================================
  // PHASE 5: Compare ticket strategies
  // ============================================================================
  console.log('\n--- PHASE 5: Ticket Strategy Comparison ---');

  let aiExactaHits = 0;
  let aiTrifectaHits = 0;

  for (const raceData of racesWithAI) {
    const guidance = raceData.aiAnalysis!.betConstruction!;
    const raceResult = raceData.raceResult;

    const actual = {
      first: raceResult.positions[0]?.post || 0,
      second: raceResult.positions[1]?.post || 0,
      third: raceResult.positions[2]?.post || 0,
    };

    if (checkAIExactaStrategy(guidance, actual)) aiExactaHits++;
    if (checkAITrifectaStrategy(guidance, actual)) aiTrifectaHits++;
  }

  console.log(`  Naive Exacta Box 4: ${formatRate(algorithmExactaBox4, allRaces.length)}`);
  console.log(`  AI Exacta Strategy: ${formatRate(aiExactaHits, racesWithAI.length)}`);
  console.log(`  Naive Trifecta Box 5: ${formatRate(algorithmTrifectaBox5, allRaces.length)}`);
  console.log(`  AI Trifecta Strategy: ${formatRate(aiTrifectaHits, racesWithAI.length)}`);

  // ============================================================================
  // BUILD FINAL RESULT
  // ============================================================================

  const totalRaces = allRaces.length;
  const racesAnalyzed = racesWithAI.length;

  const result: ValidationResult = {
    runDate: new Date().toISOString(),
    totalRaces,
    racesAnalyzed,
    errors,

    algorithmBaseline: {
      winRate: toPercentage(algorithmWins, totalRaces),
      top3Rate: toPercentage(algorithmTop3, totalRaces),
      exactaBox4Rate: toPercentage(algorithmExactaBox4, totalRaces),
      trifectaBox5Rate: toPercentage(algorithmTrifectaBox5, totalRaces),
      wins: algorithmWins,
      top3Hits: algorithmTop3,
      exactaBox4Hits: algorithmExactaBox4,
      trifectaBox5Hits: algorithmTrifectaBox5,
    },

    expansionAnalysis: {
      totalExpansionHorsesIdentified: totalExpansionHorses,
      expansionHorseWins: expansionWins,
      expansionHorseTop3: expansionTop3,
      expansionHorseWinRate: toPercentage(expansionWins, totalExpansionHorses),
      expansionHorseTop3Rate: toPercentage(expansionTop3, totalExpansionHorses),
      avgOddsWhenExpansionWon: expansionWins > 0 ? expansionOddsSum / expansionWins : 0,
      racesWithExpansion,
      exactaWithExpansionHitRate: toPercentage(exactaWithExpansionHits, racesWithExpansion),
      trifectaWithExpansionHitRate: toPercentage(trifectaWithExpansionHits, racesWithExpansion),
      exactaWithExpansionHits,
      trifectaWithExpansionHits,
    },

    vulnerableFavoriteAnalysis: {
      totalVulnerableFavoritesDetected: vulnerableFavoritesDetected,
      vulnerableFavoritesActuallyLost: vulnerableFavoritesLost,
      detectionAccuracy: toPercentage(vulnerableFavoritesLost, vulnerableFavoritesDetected),
      exactaExcludingVulnerableHitRate: toPercentage(
        exactaExcludingVulnerableHits,
        vulnerableFavoritesDetected
      ),
      trifectaExcludingVulnerableHitRate: toPercentage(
        trifectaExcludingVulnerableHits,
        vulnerableFavoritesDetected
      ),
      exactaExcludingVulnerableHits,
      trifectaExcludingVulnerableHits,
    },

    ticketStrategyComparison: {
      naiveExactaBox4Hits: algorithmExactaBox4,
      naiveExactaBox4Rate: toPercentage(algorithmExactaBox4, totalRaces),
      aiExactaStrategyHits: aiExactaHits,
      aiExactaStrategyRate: toPercentage(aiExactaHits, racesAnalyzed),
      exactaImprovement:
        toPercentage(aiExactaHits, racesAnalyzed) - toPercentage(algorithmExactaBox4, totalRaces),

      naiveTrifectaBox5Hits: algorithmTrifectaBox5,
      naiveTrifectaBox5Rate: toPercentage(algorithmTrifectaBox5, totalRaces),
      aiTrifectaStrategyHits: aiTrifectaHits,
      aiTrifectaStrategyRate: toPercentage(aiTrifectaHits, racesAnalyzed),
      trifectaImprovement:
        toPercentage(aiTrifectaHits, racesAnalyzed) -
        toPercentage(algorithmTrifectaBox5, totalRaces),
    },

    signalQuality: {
      tripTroubleHighCount,
      tripTroubleHighAccuracy: toPercentage(tripTroubleHighHits, tripTroubleHighCount),
      tripTroubleHighHits,
      paceAdvantageStrongCount,
      paceAdvantageStrongAccuracy: toPercentage(paceAdvantageStrongHits, paceAdvantageStrongCount),
      paceAdvantageStrongHits,
      vulnerableFavoriteHighCount,
      vulnerableFavoriteHighAccuracy: toPercentage(
        vulnerableFavoriteHighLost,
        vulnerableFavoriteHighCount
      ),
      vulnerableFavoriteHighLost,
    },

    verdict: {
      expansionHorsesAddValue: toPercentage(expansionTop3, totalExpansionHorses) > 33,
      vulnerableDetectionWorks:
        toPercentage(vulnerableFavoritesLost, vulnerableFavoritesDetected) > 60,
      ticketStrategiesImprove:
        toPercentage(aiExactaHits, racesAnalyzed) > toPercentage(algorithmExactaBox4, totalRaces) &&
        toPercentage(aiTrifectaHits, racesAnalyzed) >
          toPercentage(algorithmTrifectaBox5, totalRaces),
      overallRecommendation: 'DEPLOY', // Will be updated below
    },
  };

  // Determine overall recommendation
  const verdictChecks = [
    result.verdict.expansionHorsesAddValue,
    result.verdict.vulnerableDetectionWorks,
    result.verdict.ticketStrategiesImprove,
  ];
  const passCount = verdictChecks.filter(Boolean).length;

  if (passCount >= 2) {
    result.verdict.overallRecommendation = 'DEPLOY';
  } else if (passCount >= 1) {
    result.verdict.overallRecommendation = 'TUNE';
  } else {
    result.verdict.overallRecommendation = 'REVERT';
  }

  return result;
}

// ============================================================================
// CONSOLE OUTPUT FORMATTING
// ============================================================================

function printReport(result: ValidationResult): void {
  const { algorithmBaseline: baseline } = result;

  console.log('\n');
  console.log('═'.repeat(70));
  console.log('               AI ARCHITECTURE VALIDATION REPORT');
  console.log('═'.repeat(70));
  console.log(`Run Date: ${result.runDate}`);
  console.log(
    `Total Races: ${result.totalRaces} | Analyzed: ${result.racesAnalyzed} | Errors: ${result.errors.length}`
  );

  console.log('─'.repeat(70));
  console.log('SECTION A: ALGORITHM BASELINE');
  console.log('─'.repeat(70));
  console.log(`Win Rate:        ${formatRate(baseline.wins, result.totalRaces)}`);
  console.log(`Top 3 Rate:      ${formatRate(baseline.top3Hits, result.totalRaces)}`);
  console.log(`Exacta Box 4:    ${formatRate(baseline.exactaBox4Hits, result.totalRaces)}`);
  console.log(`Trifecta Box 5:  ${formatRate(baseline.trifectaBox5Hits, result.totalRaces)}`);

  console.log('─'.repeat(70));
  console.log('SECTION B: EXPANSION HORSES (SLEEPERS)');
  console.log('─'.repeat(70));
  const exp = result.expansionAnalysis;
  console.log(
    `Identified:      ${exp.totalExpansionHorsesIdentified} horses across ${exp.racesWithExpansion} races`
  );
  console.log(
    `Wins:            ${formatRate(exp.expansionHorseWins, exp.totalExpansionHorsesIdentified)}`
  );
  console.log(
    `Top 3:           ${formatRate(exp.expansionHorseTop3, exp.totalExpansionHorsesIdentified)}`
  );
  if (exp.avgOddsWhenExpansionWon > 0) {
    console.log(`Avg Winning Odds: ${exp.avgOddsWhenExpansionWon.toFixed(1)}-1`);
  }
  const expExactaDelta = exp.exactaWithExpansionHitRate - baseline.exactaBox4Rate;
  const expTrifectaDelta = exp.trifectaWithExpansionHitRate - baseline.trifectaBox5Rate;
  console.log(
    `Expanded Exacta Hit Rate:  ${formatRate(exp.exactaWithExpansionHits, exp.racesWithExpansion)} vs ${baseline.exactaBox4Rate.toFixed(1)}% baseline → ${expExactaDelta >= 0 ? '+' : ''}${expExactaDelta.toFixed(1)}%`
  );
  console.log(
    `Expanded Trifecta Hit Rate: ${formatRate(exp.trifectaWithExpansionHits, exp.racesWithExpansion)} vs ${baseline.trifectaBox5Rate.toFixed(1)}% baseline → ${expTrifectaDelta >= 0 ? '+' : ''}${expTrifectaDelta.toFixed(1)}%`
  );

  console.log('─'.repeat(70));
  console.log('SECTION C: VULNERABLE FAVORITE DETECTION');
  console.log('─'.repeat(70));
  const vuln = result.vulnerableFavoriteAnalysis;
  console.log(`Detected:        ${vuln.totalVulnerableFavoritesDetected} races`);
  console.log(
    `Actually Lost:   ${formatRate(vuln.vulnerableFavoritesActuallyLost, vuln.totalVulnerableFavoritesDetected)} accuracy`
  );
  const vulnExactaDelta = vuln.exactaExcludingVulnerableHitRate - baseline.exactaBox4Rate;
  const vulnTrifectaDelta = vuln.trifectaExcludingVulnerableHitRate - baseline.trifectaBox5Rate;
  console.log(
    `Exacta w/o Vulnerable:  ${formatRate(vuln.exactaExcludingVulnerableHits, vuln.totalVulnerableFavoritesDetected)} vs ${baseline.exactaBox4Rate.toFixed(1)}% baseline → ${vulnExactaDelta >= 0 ? '+' : ''}${vulnExactaDelta.toFixed(1)}%`
  );
  console.log(
    `Trifecta w/o Vulnerable: ${formatRate(vuln.trifectaExcludingVulnerableHits, vuln.totalVulnerableFavoritesDetected)} vs ${baseline.trifectaBox5Rate.toFixed(1)}% baseline → ${vulnTrifectaDelta >= 0 ? '+' : ''}${vulnTrifectaDelta.toFixed(1)}%`
  );

  console.log('─'.repeat(70));
  console.log('SECTION D: TICKET STRATEGY COMPARISON');
  console.log('─'.repeat(70));
  const ts = result.ticketStrategyComparison;
  console.log('                Naive       AI Strategy    Δ');
  console.log(
    `Exacta:         ${ts.naiveExactaBox4Rate.toFixed(1)}%       ${ts.aiExactaStrategyRate.toFixed(1)}%          ${ts.exactaImprovement >= 0 ? '+' : ''}${ts.exactaImprovement.toFixed(1)}%`
  );
  console.log(
    `Trifecta:       ${ts.naiveTrifectaBox5Rate.toFixed(1)}%       ${ts.aiTrifectaStrategyRate.toFixed(1)}%          ${ts.trifectaImprovement >= 0 ? '+' : ''}${ts.trifectaImprovement.toFixed(1)}%`
  );

  console.log('─'.repeat(70));
  console.log('SECTION E: SIGNAL QUALITY');
  console.log('─'.repeat(70));
  const sq = result.signalQuality;
  console.log('Signal              Count    Accuracy (hit board)');
  console.log(
    `Trip Trouble HIGH   ${sq.tripTroubleHighCount.toString().padStart(3)}       ${sq.tripTroubleHighAccuracy.toFixed(1)}%`
  );
  console.log(
    `Pace Adv STRONG     ${sq.paceAdvantageStrongCount.toString().padStart(3)}       ${sq.paceAdvantageStrongAccuracy.toFixed(1)}%`
  );
  console.log(
    `Vulnerable Fav HIGH ${sq.vulnerableFavoriteHighCount.toString().padStart(3)}       ${sq.vulnerableFavoriteHighAccuracy.toFixed(1)}%`
  );

  console.log('─'.repeat(70));
  console.log('VERDICT');
  console.log('─'.repeat(70));
  const v = result.verdict;
  console.log(
    `${v.expansionHorsesAddValue ? '✓' : '✗'} Expansion horses add value (${exp.expansionHorseTop3Rate.toFixed(1)}% top 3 ${v.expansionHorsesAddValue ? '>' : '<='} 33% threshold)`
  );
  console.log(
    `${v.vulnerableDetectionWorks ? '✓' : '✗'} Vulnerable detection works (${vuln.detectionAccuracy.toFixed(1)}% ${v.vulnerableDetectionWorks ? '>' : '<='} 60% threshold)`
  );
  console.log(
    `${v.ticketStrategiesImprove ? '✓' : '✗'} Ticket strategies improve (${ts.exactaImprovement >= 0 ? '+' : ''}${ts.exactaImprovement.toFixed(1)}% exacta, ${ts.trifectaImprovement >= 0 ? '+' : ''}${ts.trifectaImprovement.toFixed(1)}% trifecta)`
  );
  console.log(`RECOMMENDATION: ${v.overallRecommendation}`);
  console.log('═'.repeat(70));

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

    // Exit with appropriate code
    if (result.verdict.overallRecommendation === 'REVERT') {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
