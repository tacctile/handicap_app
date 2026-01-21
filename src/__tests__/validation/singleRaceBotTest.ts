#!/usr/bin/env npx ts-node
/**
 * Single Race Bot Test
 *
 * Minimal test script to debug bot parsing issues.
 * Loads one race from validation data and calls each bot individually,
 * capturing and displaying raw responses with parse results.
 *
 * Usage:
 *   npx ts-node --esm src/__tests__/validation/singleRaceBotTest.ts
 *   npx tsx src/__tests__/validation/singleRaceBotTest.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { parseDRFFile } from '../../lib/drfParser';
import { calculateRaceScores, analyzePaceScenario } from '../../lib/scoring';
import {
  analyzeTripTrouble,
  analyzePaceScenario as analyzePaceScenarioBot,
  analyzeVulnerableFavorite,
  analyzeFieldSpread,
  clearRawResponseLog,
  getRawResponseLog,
} from '../../services/ai';
import type { HorseEntry } from '../../types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../../types/scoring';
import type { ScoredHorse } from '../../lib/scoring';
import type { TrackCondition } from '../../hooks/useRaceState';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = path.join(__dirname, '../../data');
const RESULTS_DIR = path.join(__dirname, 'results');
const OUTPUT_FILE = path.join(RESULTS_DIR, 'api_response_debug.log');

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
║  To run this test:                                                   ║
║                                                                       ║
║  1. Get API key from https://makersuite.google.com/app/apikey        ║
║                                                                       ║
║  2. Add to .env file:                                                ║
║     VITE_GEMINI_API_KEY=your_key_here                                ║
║                                                                       ║
║  3. Run again:                                                       ║
║     npx tsx src/__tests__/validation/singleRaceBotTest.ts            ║
║                                                                       ║
╚══════════════════════════════════════════════════════════════════════╝
`);
    return false;
  }

  console.log('✓ API key found');
  return true;
}

// ============================================================================
// SCORING RESULT CONVERSION (copied from runAIValidation.ts)
// ============================================================================

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

    if (sh.score.breakdown.speedClass.speedScore >= 80) {
      positiveFactors.push('Strong speed figures');
    }
    if (sh.score.breakdown.form.wonLastOut) {
      positiveFactors.push('Won last race');
    }
    if (sh.score.breakdown.connections.total >= 18) {
      positiveFactors.push('Strong connections');
    }
    if (sh.score.breakdown.speedClass.speedScore < 40) {
      negativeFactors.push('Weak speed figures');
    }
    if (sh.score.breakdown.form.formTrend === 'declining') {
      negativeFactors.push('Declining form');
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

  const activeHorses = horses.filter((h) => !h.isScratched);
  const paceScenario = analyzePaceScenario(activeHorses);
  const avgScore = sortedByRank.reduce((sum, sh) => sum + sh.score.total, 0) / sortedByRank.length;
  let fieldStrength: 'elite' | 'strong' | 'average' | 'weak' = 'average';
  if (avgScore >= 220) fieldStrength = 'elite';
  else if (avgScore >= 180) fieldStrength = 'strong';
  else if (avgScore < 140) fieldStrength = 'weak';

  const topScore = sortedByRank[0]?.score.total || 0;
  const secondScore = sortedByRank[1]?.score.total || 0;
  const vulnerableFavorite = topScore - secondScore < 10;
  const likelyPaceCollapse = paceScenario.scenario === 'speed_duel' || paceScenario.ppi > 70;

  const mapPaceScenarioType = (scenario: string): 'hot' | 'moderate' | 'slow' | 'contested' => {
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

  const likelyLeader =
    paceScenario.styleBreakdown?.earlySpeed?.[0] || sortedByRank[0]?.horse.postPosition || 1;

  const raceAnalysis: RaceAnalysis = {
    paceScenario: {
      expectedPace: mapPaceScenarioType(paceScenario.scenario),
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

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function runSingleRaceTest(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('              SINGLE RACE BOT TEST');
  console.log('═'.repeat(70));
  console.log(`Started: ${new Date().toISOString()}`);

  // Check API key
  if (!checkApiKey()) {
    process.exit(1);
  }

  // Clear any existing logs
  clearRawResponseLog();

  // Clear the output file
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  fs.writeFileSync(
    OUTPUT_FILE,
    `SINGLE RACE BOT TEST - ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`
  );

  // Find a DRF file
  const drfFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.DRF') && f !== 'sample.DRF');

  if (drfFiles.length === 0) {
    console.error('No DRF files found in data directory');
    process.exit(1);
  }

  // Use the first DRF file and its first race
  const drfFile = drfFiles[0]!;
  const drfPath = path.join(DATA_DIR, drfFile);
  console.log(`\nUsing DRF file: ${drfFile}`);

  const drfContent = fs.readFileSync(drfPath, 'utf-8');
  const parsed = parseDRFFile(drfContent, drfFile);

  if (parsed.races.length === 0) {
    console.error('No races found in DRF file');
    process.exit(1);
  }

  // Use the first race
  const race = parsed.races[0]!;
  console.log(
    `\nRace ${race.header.raceNumber} at ${race.header.trackName} (${race.header.trackCode})`
  );
  console.log(`Distance: ${race.header.distance}, Surface: ${race.header.surface}`);
  console.log(`Class: ${race.header.classification}`);
  console.log(`Field Size: ${race.horses.length} horses`);

  // Calculate scores
  const trackCondition: TrackCondition = race.header.trackCondition || 'fast';
  const getOdds = (index: number, originalOdds: string) => {
    return originalOdds || race.horses[index]?.morningLineOdds || '5-1';
  };
  const isScratched = (_index: number) => false;

  const scoredHorses = calculateRaceScores(
    race.horses,
    race.header,
    getOdds,
    isScratched,
    trackCondition
  );

  const scoringResult = convertToRaceScoringResult(scoredHorses, race.horses);

  console.log(`\nAlgorithm top pick: #${scoringResult.scores[0]?.programNumber} ${scoringResult.scores[0]?.horseName}`);

  // Test each bot individually
  const bots = [
    { name: 'Trip Trouble', fn: () => analyzeTripTrouble(race, scoringResult) },
    { name: 'Pace Scenario', fn: () => analyzePaceScenarioBot(race, scoringResult) },
    { name: 'Vulnerable Favorite', fn: () => analyzeVulnerableFavorite(race, scoringResult) },
    { name: 'Field Spread', fn: () => analyzeFieldSpread(race, scoringResult) },
  ];

  const results: Array<{
    name: string;
    success: boolean;
    result?: unknown;
    error?: string;
    responseTime: number;
  }> = [];

  for (const bot of bots) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Testing ${bot.name} bot...`);
    console.log('─'.repeat(70));

    const startTime = Date.now();

    try {
      const result = await bot.fn();
      const responseTime = Date.now() - startTime;

      console.log(`✓ ${bot.name} completed in ${responseTime}ms`);
      console.log(`Result:`, JSON.stringify(result, null, 2));

      results.push({
        name: bot.name,
        success: true,
        result,
        responseTime,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorMsg: string;
      if (error instanceof Error) {
        errorMsg = `${error.name}: ${error.message}`;
        if (error.stack) {
          console.log(`Stack trace:`, error.stack);
        }
      } else if (typeof error === 'object' && error !== null) {
        errorMsg = JSON.stringify(error, null, 2);
      } else {
        errorMsg = String(error);
      }

      console.log(`✗ ${bot.name} FAILED in ${responseTime}ms`);
      console.log(`Error:`, errorMsg);

      results.push({
        name: bot.name,
        success: false,
        error: errorMsg,
        responseTime,
      });
    }

    // Small delay between bots to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Get the raw response log
  const rawLog = getRawResponseLog();

  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('              TEST SUMMARY');
  console.log('═'.repeat(70));

  const successCount = results.filter((r) => r.success).length;
  console.log(`\nBots Successful: ${successCount}/4`);

  for (const result of results) {
    const status = result.success ? '✓ SUCCESS' : '✗ FAILED';
    console.log(`  ${result.name}: ${status} (${result.responseTime}ms)`);
    if (!result.success) {
      console.log(`    Error: ${result.error}`);
    }
  }

  // Print raw responses summary
  console.log('\n' + '─'.repeat(70));
  console.log('RAW RESPONSE LOG SUMMARY');
  console.log('─'.repeat(70));

  for (const entry of rawLog) {
    console.log(`\n${entry.botName}:`);
    console.log(`  Parse Success: ${entry.parseSuccess}`);
    if (entry.parseError) {
      console.log(`  Parse Error: ${entry.parseError}`);
    }
    console.log(`  Response Preview (first 300 chars):`);
    console.log(`    ${entry.rawText.substring(0, 300).replace(/\n/g, '\n    ')}`);
  }

  // Write detailed results to file
  const detailedResults = `
DETAILED TEST RESULTS
${'='.repeat(80)}

Race Information:
  Track: ${race.header.trackName} (${race.header.trackCode})
  Race Number: ${race.header.raceNumber}
  Distance: ${race.header.distance}
  Surface: ${race.header.surface}
  Class: ${race.header.classification}
  Field Size: ${race.horses.length}

Algorithm Top Pick: #${scoringResult.scores[0]?.programNumber} ${scoringResult.scores[0]?.horseName}

${'─'.repeat(80)}

BOT RESULTS:
${results
  .map(
    (r) => `
${r.name}:
  Status: ${r.success ? 'SUCCESS' : 'FAILED'}
  Response Time: ${r.responseTime}ms
  ${r.success ? `Result: ${JSON.stringify(r.result, null, 2)}` : `Error: ${r.error}`}
`
  )
  .join('\n')}

${'─'.repeat(80)}

RAW RESPONSES:
${rawLog
  .map(
    (entry) => `
Bot: ${entry.botName}
Timestamp: ${entry.timestamp}
Parse Success: ${entry.parseSuccess}
${entry.parseError ? `Parse Error: ${entry.parseError}` : ''}
Raw Response:
${entry.rawText}
`
  )
  .join('\n' + '─'.repeat(40) + '\n')}
`;

  fs.appendFileSync(OUTPUT_FILE, detailedResults);
  console.log(`\nDetailed results saved to: ${OUTPUT_FILE}`);
}

// Run
runSingleRaceTest().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
