#!/usr/bin/env npx tsx
/**
 * Algorithm Validation Test Harness
 *
 * Tests algorithm-only performance against historical results.
 * Measures box hit rates for exacta, trifecta, and superfecta.
 * No AI calls - pure algorithm validation.
 *
 * Usage:
 *   npx tsx scripts/validate-algorithm.ts
 *
 * Results saved to:
 *   - algorithm-validation-results.json
 *   - algorithm-validation-summary.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import type { ParsedRace } from '../src/types/drf';
import type { ScoredHorse } from '../src/lib/scoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATA_DIR = path.join(__dirname, '../src/data');
const OUTPUT_JSON = path.join(__dirname, '../algorithm-validation-results.json');
const OUTPUT_MD = path.join(__dirname, '../algorithm-validation-summary.md');

// Target hit rates for validation
const TARGETS = {
  exactaBox4: 30, // >30%
  trifectaBox5: 35, // >35%
  superfectaBox6: 40, // >40%
};

// ============================================================================
// TYPES
// ============================================================================

interface AlgorithmValidationResult {
  runDate: string;
  totalRaces: number;

  // Win/Place/Show
  winRate: number;
  placeRate: number;
  showRate: number;

  // Exacta boxes
  exactaBox2Rate: number;
  exactaBox3Rate: number;
  exactaBox4Rate: number;

  // Trifecta boxes
  trifectaBox3Rate: number;
  trifectaBox4Rate: number;
  trifectaBox5Rate: number;

  // Superfecta boxes
  superfectaBox4Rate: number;
  superfectaBox5Rate: number;
  superfectaBox6Rate: number;

  // Confidence distribution
  confidenceDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };

  // Verdict
  verdict: {
    exactaBox4Pass: boolean;
    trifectaBox5Pass: boolean;
    superfectaBox6Pass: boolean;
    status: 'VALIDATED' | 'NEEDS_TUNING' | 'FAILING';
  };
}

interface RaceResult {
  raceNumber: number;
  positions: { post: number; horseName: string }[];
  scratches: { post: number; horseName: string }[];
}

interface RaceMetrics {
  hasValidResults: boolean;
  actualFirst: number;
  actualSecond: number;
  actualThird: number;
  actualFourth: number;
  algorithmTop: number[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ============================================================================
// HELPER FUNCTIONS - BOX HIT CHECKERS
// ============================================================================

/**
 * Check if exacta box hits (first two finishers in top N picks)
 */
function checkExactaBoxHit(
  algorithmTop: number[],
  actualFirst: number,
  actualSecond: number,
  boxSize: number
): boolean {
  const box = algorithmTop.slice(0, boxSize);
  return box.includes(actualFirst) && box.includes(actualSecond);
}

/**
 * Check if trifecta box hits (first three finishers in top N picks)
 */
function checkTrifectaBoxHit(
  algorithmTop: number[],
  actualFirst: number,
  actualSecond: number,
  actualThird: number,
  boxSize: number
): boolean {
  const box = algorithmTop.slice(0, boxSize);
  return box.includes(actualFirst) && box.includes(actualSecond) && box.includes(actualThird);
}

/**
 * Check if superfecta box hits (first four finishers in top N picks)
 */
function checkSuperfectaBoxHit(
  algorithmTop: number[],
  actualFirst: number,
  actualSecond: number,
  actualThird: number,
  actualFourth: number,
  boxSize: number
): boolean {
  const box = algorithmTop.slice(0, boxSize);
  return (
    box.includes(actualFirst) &&
    box.includes(actualSecond) &&
    box.includes(actualThird) &&
    box.includes(actualFourth)
  );
}

/**
 * Calculate confidence based on score separation between top picks
 */
function calculateConfidence(
  scores: { programNumber: number; totalScore: number }[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (scores.length < 4) return 'LOW';

  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  const separation = sorted[0].totalScore - sorted[3].totalScore;

  if (separation >= 25) return 'HIGH';
  if (separation >= 15) return 'MEDIUM';
  return 'LOW';
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
// RACE PROCESSING
// ============================================================================

function processRace(
  race: ParsedRace,
  raceResult: RaceResult,
  scratchedPosts: Set<number>
): RaceMetrics | null {
  // Get actual finishing positions
  const positions = raceResult.positions;
  if (positions.length < 4) {
    return null; // Need at least 4 finishers for superfecta
  }

  const actualFirst = positions[0].post;
  const actualSecond = positions[1].post;
  const actualThird = positions[2].post;
  const actualFourth = positions[3].post;

  // Score the race using the algorithm
  const scoredHorses = calculateRaceScores(
    race.horses,
    race.header,
    (idx: number, origOdds: string) => origOdds, // Use morning line odds
    (idx: number) => scratchedPosts.has(race.horses[idx]?.postPosition ?? 0),
    'fast' // Assume fast track
  );

  // Get non-scratched horses sorted by rank
  const activeHorses = scoredHorses
    .filter((sh) => !sh.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  if (activeHorses.length < 4) {
    return null; // Need at least 4 active horses
  }

  // Get algorithm's top picks (program numbers)
  const algorithmTop = activeHorses.slice(0, 6).map((sh) => sh.horse.postPosition);

  // Calculate confidence
  const scoresForConfidence = activeHorses.map((sh) => ({
    programNumber: sh.horse.postPosition,
    totalScore: sh.score.total,
  }));
  const confidence = calculateConfidence(scoresForConfidence);

  return {
    hasValidResults: true,
    actualFirst,
    actualSecond,
    actualThird,
    actualFourth,
    algorithmTop,
    confidence,
  };
}

// ============================================================================
// MAIN VALIDATION
// ============================================================================

async function runValidation(): Promise<AlgorithmValidationResult> {
  console.log('============================================================');
  console.log('ALGORITHM VALIDATION - Starting');
  console.log('============================================================\n');

  const testFiles = discoverTestFiles();
  console.log(`Found ${testFiles.length} DRF files with results\n`);

  // Counters
  let totalRaces = 0;
  let validRaces = 0;

  // Win/Place/Show
  let wins = 0;
  let places = 0;
  let shows = 0;

  // Exacta boxes
  let exactaBox2Hits = 0;
  let exactaBox3Hits = 0;
  let exactaBox4Hits = 0;

  // Trifecta boxes
  let trifectaBox3Hits = 0;
  let trifectaBox4Hits = 0;
  let trifectaBox5Hits = 0;

  // Superfecta boxes (only count races with 4+ finishers)
  let superfectaRaces = 0;
  let superfectaBox4Hits = 0;
  let superfectaBox5Hits = 0;
  let superfectaBox6Hits = 0;

  // Confidence distribution
  const confidenceCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  // Process each DRF file
  for (const { drfPath, resultsPath, trackCode } of testFiles) {
    console.log(`Processing ${trackCode}...`);

    try {
      const drfContent = fs.readFileSync(drfPath, 'utf-8');
      const parsed = parseDRFFile(drfContent, path.basename(drfPath));
      const results = parseResultsFile(resultsPath);

      // Map results by race number
      const resultsByRace = new Map(results.map((r) => [r.raceNumber, r]));

      for (const race of parsed.races) {
        totalRaces++;

        const raceResult = resultsByRace.get(race.header.raceNumber);
        if (!raceResult) {
          continue;
        }

        // Get scratched posts
        const scratchedPosts = new Set(raceResult.scratches.map((s) => s.post));

        // Process the race
        const metrics = processRace(race, raceResult, scratchedPosts);
        if (!metrics) {
          continue;
        }

        validRaces++;
        confidenceCounts[metrics.confidence]++;

        const { actualFirst, actualSecond, actualThird, actualFourth, algorithmTop } = metrics;

        // Win/Place/Show (top pick)
        const topPick = algorithmTop[0];
        if (topPick === actualFirst) wins++;
        if (topPick === actualFirst || topPick === actualSecond) places++;
        if (topPick === actualFirst || topPick === actualSecond || topPick === actualThird) shows++;

        // Exacta boxes
        if (checkExactaBoxHit(algorithmTop, actualFirst, actualSecond, 2)) exactaBox2Hits++;
        if (checkExactaBoxHit(algorithmTop, actualFirst, actualSecond, 3)) exactaBox3Hits++;
        if (checkExactaBoxHit(algorithmTop, actualFirst, actualSecond, 4)) exactaBox4Hits++;

        // Trifecta boxes
        if (checkTrifectaBoxHit(algorithmTop, actualFirst, actualSecond, actualThird, 3))
          trifectaBox3Hits++;
        if (checkTrifectaBoxHit(algorithmTop, actualFirst, actualSecond, actualThird, 4))
          trifectaBox4Hits++;
        if (checkTrifectaBoxHit(algorithmTop, actualFirst, actualSecond, actualThird, 5))
          trifectaBox5Hits++;

        // Superfecta boxes (need 4th place finisher and 6 algorithm picks)
        if (actualFourth > 0 && algorithmTop.length >= 6) {
          superfectaRaces++;
          if (
            checkSuperfectaBoxHit(
              algorithmTop,
              actualFirst,
              actualSecond,
              actualThird,
              actualFourth,
              4
            )
          )
            superfectaBox4Hits++;
          if (
            checkSuperfectaBoxHit(
              algorithmTop,
              actualFirst,
              actualSecond,
              actualThird,
              actualFourth,
              5
            )
          )
            superfectaBox5Hits++;
          if (
            checkSuperfectaBoxHit(
              algorithmTop,
              actualFirst,
              actualSecond,
              actualThird,
              actualFourth,
              6
            )
          )
            superfectaBox6Hits++;
        }
      }

      console.log(`  Processed ${parsed.races.length} races`);
    } catch (error) {
      console.error(`  Error processing ${trackCode}:`, error);
    }
  }

  // Calculate rates
  const toRate = (hits: number, total: number): number =>
    total > 0 ? (hits / total) * 100 : 0;

  const winRate = toRate(wins, validRaces);
  const placeRate = toRate(places, validRaces);
  const showRate = toRate(shows, validRaces);

  const exactaBox2Rate = toRate(exactaBox2Hits, validRaces);
  const exactaBox3Rate = toRate(exactaBox3Hits, validRaces);
  const exactaBox4Rate = toRate(exactaBox4Hits, validRaces);

  const trifectaBox3Rate = toRate(trifectaBox3Hits, validRaces);
  const trifectaBox4Rate = toRate(trifectaBox4Hits, validRaces);
  const trifectaBox5Rate = toRate(trifectaBox5Hits, validRaces);

  const superfectaBox4Rate = toRate(superfectaBox4Hits, superfectaRaces);
  const superfectaBox5Rate = toRate(superfectaBox5Hits, superfectaRaces);
  const superfectaBox6Rate = toRate(superfectaBox6Hits, superfectaRaces);

  // Determine verdict
  const exactaBox4Pass = exactaBox4Rate >= TARGETS.exactaBox4;
  const trifectaBox5Pass = trifectaBox5Rate >= TARGETS.trifectaBox5;
  const superfectaBox6Pass = superfectaBox6Rate >= TARGETS.superfectaBox6;

  let status: 'VALIDATED' | 'NEEDS_TUNING' | 'FAILING';
  const passCount = [exactaBox4Pass, trifectaBox5Pass, superfectaBox6Pass].filter(Boolean).length;
  if (passCount === 3) {
    status = 'VALIDATED';
  } else if (passCount >= 1) {
    status = 'NEEDS_TUNING';
  } else {
    status = 'FAILING';
  }

  const result: AlgorithmValidationResult = {
    runDate: new Date().toISOString(),
    totalRaces: validRaces,

    winRate,
    placeRate,
    showRate,

    exactaBox2Rate,
    exactaBox3Rate,
    exactaBox4Rate,

    trifectaBox3Rate,
    trifectaBox4Rate,
    trifectaBox5Rate,

    superfectaBox4Rate,
    superfectaBox5Rate,
    superfectaBox6Rate,

    confidenceDistribution: confidenceCounts,

    verdict: {
      exactaBox4Pass,
      trifectaBox5Pass,
      superfectaBox6Pass,
      status,
    },
  };

  // Print results
  printResults(result, validRaces, superfectaRaces, {
    wins,
    places,
    shows,
    exactaBox2Hits,
    exactaBox3Hits,
    exactaBox4Hits,
    trifectaBox3Hits,
    trifectaBox4Hits,
    trifectaBox5Hits,
    superfectaBox4Hits,
    superfectaBox5Hits,
    superfectaBox6Hits,
  });

  // Write JSON results
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${OUTPUT_JSON}`);

  // Write markdown summary
  writeSummary(result, validRaces, superfectaRaces, {
    wins,
    places,
    shows,
    exactaBox2Hits,
    exactaBox3Hits,
    exactaBox4Hits,
    trifectaBox3Hits,
    trifectaBox4Hits,
    trifectaBox5Hits,
    superfectaBox4Hits,
    superfectaBox5Hits,
    superfectaBox6Hits,
  });
  console.log(`Summary saved to: ${OUTPUT_MD}`);

  return result;
}

// ============================================================================
// OUTPUT FUNCTIONS
// ============================================================================

interface HitCounts {
  wins: number;
  places: number;
  shows: number;
  exactaBox2Hits: number;
  exactaBox3Hits: number;
  exactaBox4Hits: number;
  trifectaBox3Hits: number;
  trifectaBox4Hits: number;
  trifectaBox5Hits: number;
  superfectaBox4Hits: number;
  superfectaBox5Hits: number;
  superfectaBox6Hits: number;
}

function printResults(
  result: AlgorithmValidationResult,
  validRaces: number,
  superfectaRaces: number,
  hits: HitCounts
): void {
  const formatRate = (rate: number, count: number, total: number): string =>
    `${rate.toFixed(1)}% (${count}/${total})`;

  const passOrFail = (pass: boolean): string => (pass ? '✓ PASS' : '✗ FAIL');

  console.log('\n============================================================');
  console.log('ALGORITHM VALIDATION RESULTS');
  console.log('============================================================');
  console.log(`Run Date: ${result.runDate}`);
  console.log(`Total Races: ${validRaces}`);

  console.log('\n------------------------------------------------------------');
  console.log('WIN/PLACE/SHOW');
  console.log('------------------------------------------------------------');
  console.log(`  Win Rate:       ${formatRate(result.winRate, hits.wins, validRaces)}`);
  console.log(`  Place Rate:     ${formatRate(result.placeRate, hits.places, validRaces)}`);
  console.log(`  Show Rate:      ${formatRate(result.showRate, hits.shows, validRaces)}`);

  console.log('\n------------------------------------------------------------');
  console.log('EXACTA BOXES');
  console.log('------------------------------------------------------------');
  console.log(`  Box 2:          ${formatRate(result.exactaBox2Rate, hits.exactaBox2Hits, validRaces)}`);
  console.log(`  Box 3:          ${formatRate(result.exactaBox3Rate, hits.exactaBox3Hits, validRaces)}`);
  console.log(`  Box 4:          ${formatRate(result.exactaBox4Rate, hits.exactaBox4Hits, validRaces)}  ← TARGET >${TARGETS.exactaBox4}%`);

  console.log('\n------------------------------------------------------------');
  console.log('TRIFECTA BOXES');
  console.log('------------------------------------------------------------');
  console.log(`  Box 3:          ${formatRate(result.trifectaBox3Rate, hits.trifectaBox3Hits, validRaces)}`);
  console.log(`  Box 4:          ${formatRate(result.trifectaBox4Rate, hits.trifectaBox4Hits, validRaces)}`);
  console.log(`  Box 5:          ${formatRate(result.trifectaBox5Rate, hits.trifectaBox5Hits, validRaces)}  ← TARGET >${TARGETS.trifectaBox5}%`);

  console.log('\n------------------------------------------------------------');
  console.log('SUPERFECTA BOXES');
  console.log('------------------------------------------------------------');
  console.log(`  Box 4:          ${formatRate(result.superfectaBox4Rate, hits.superfectaBox4Hits, superfectaRaces)}`);
  console.log(`  Box 5:          ${formatRate(result.superfectaBox5Rate, hits.superfectaBox5Hits, superfectaRaces)}`);
  console.log(`  Box 6:          ${formatRate(result.superfectaBox6Rate, hits.superfectaBox6Hits, superfectaRaces)}  ← TARGET >${TARGETS.superfectaBox6}%`);

  console.log('\n------------------------------------------------------------');
  console.log('CONFIDENCE DISTRIBUTION');
  console.log('------------------------------------------------------------');
  const confDist = result.confidenceDistribution;
  const highPct = ((confDist.HIGH / validRaces) * 100).toFixed(1);
  const medPct = ((confDist.MEDIUM / validRaces) * 100).toFixed(1);
  const lowPct = ((confDist.LOW / validRaces) * 100).toFixed(1);
  console.log(`  HIGH:    ${confDist.HIGH} races (${highPct}%)`);
  console.log(`  MEDIUM:  ${confDist.MEDIUM} races (${medPct}%)`);
  console.log(`  LOW:     ${confDist.LOW} races (${lowPct}%)`);

  console.log('\n------------------------------------------------------------');
  console.log('VERDICT');
  console.log('------------------------------------------------------------');
  console.log(`  Exacta Box 4:    ${passOrFail(result.verdict.exactaBox4Pass)} (${result.exactaBox4Rate.toFixed(1)}% ${result.verdict.exactaBox4Pass ? '>' : '<'} ${TARGETS.exactaBox4}%)`);
  console.log(`  Trifecta Box 5:  ${passOrFail(result.verdict.trifectaBox5Pass)} (${result.trifectaBox5Rate.toFixed(1)}% ${result.verdict.trifectaBox5Pass ? '>' : '<'} ${TARGETS.trifectaBox5}%)`);
  console.log(`  Superfecta Box 6: ${passOrFail(result.verdict.superfectaBox6Pass)} (${result.superfectaBox6Rate.toFixed(1)}% ${result.verdict.superfectaBox6Pass ? '>' : '<'} ${TARGETS.superfectaBox6}%)`);

  console.log(`\n  STATUS: ${result.verdict.status === 'VALIDATED' ? 'ALGORITHM BASELINE VALIDATED' : result.verdict.status}`);
  console.log('============================================================');
}

function writeSummary(
  result: AlgorithmValidationResult,
  validRaces: number,
  superfectaRaces: number,
  hits: HitCounts
): void {
  const formatRate = (rate: number, count: number, total: number): string =>
    `${rate.toFixed(1)}% (${count}/${total})`;

  const passOrFail = (pass: boolean): string => (pass ? '✅ PASS' : '❌ FAIL');

  const statusEmoji =
    result.verdict.status === 'VALIDATED'
      ? '✅'
      : result.verdict.status === 'NEEDS_TUNING'
        ? '⚠️'
        : '❌';

  let md = `# Algorithm Validation Results\n\n`;
  md += `**Run Date:** ${result.runDate}\n`;
  md += `**Total Races:** ${validRaces}\n`;
  md += `**Status:** ${statusEmoji} ${result.verdict.status}\n\n`;

  md += `## Win/Place/Show\n\n`;
  md += `| Metric | Rate |\n`;
  md += `|--------|------|\n`;
  md += `| Win Rate | ${formatRate(result.winRate, hits.wins, validRaces)} |\n`;
  md += `| Place Rate | ${formatRate(result.placeRate, hits.places, validRaces)} |\n`;
  md += `| Show Rate | ${formatRate(result.showRate, hits.shows, validRaces)} |\n\n`;

  md += `## Exacta Boxes\n\n`;
  md += `| Box Size | Rate |\n`;
  md += `|----------|------|\n`;
  md += `| Box 2 | ${formatRate(result.exactaBox2Rate, hits.exactaBox2Hits, validRaces)} |\n`;
  md += `| Box 3 | ${formatRate(result.exactaBox3Rate, hits.exactaBox3Hits, validRaces)} |\n`;
  md += `| **Box 4** | **${formatRate(result.exactaBox4Rate, hits.exactaBox4Hits, validRaces)}** ← TARGET >${TARGETS.exactaBox4}% |\n\n`;

  md += `## Trifecta Boxes\n\n`;
  md += `| Box Size | Rate |\n`;
  md += `|----------|------|\n`;
  md += `| Box 3 | ${formatRate(result.trifectaBox3Rate, hits.trifectaBox3Hits, validRaces)} |\n`;
  md += `| Box 4 | ${formatRate(result.trifectaBox4Rate, hits.trifectaBox4Hits, validRaces)} |\n`;
  md += `| **Box 5** | **${formatRate(result.trifectaBox5Rate, hits.trifectaBox5Hits, validRaces)}** ← TARGET >${TARGETS.trifectaBox5}% |\n\n`;

  md += `## Superfecta Boxes\n\n`;
  md += `| Box Size | Rate |\n`;
  md += `|----------|------|\n`;
  md += `| Box 4 | ${formatRate(result.superfectaBox4Rate, hits.superfectaBox4Hits, superfectaRaces)} |\n`;
  md += `| Box 5 | ${formatRate(result.superfectaBox5Rate, hits.superfectaBox5Hits, superfectaRaces)} |\n`;
  md += `| **Box 6** | **${formatRate(result.superfectaBox6Rate, hits.superfectaBox6Hits, superfectaRaces)}** ← TARGET >${TARGETS.superfectaBox6}% |\n\n`;

  md += `## Confidence Distribution\n\n`;
  const confDist = result.confidenceDistribution;
  const highPct = ((confDist.HIGH / validRaces) * 100).toFixed(1);
  const medPct = ((confDist.MEDIUM / validRaces) * 100).toFixed(1);
  const lowPct = ((confDist.LOW / validRaces) * 100).toFixed(1);
  md += `| Confidence | Count | Percentage |\n`;
  md += `|------------|-------|------------|\n`;
  md += `| HIGH | ${confDist.HIGH} | ${highPct}% |\n`;
  md += `| MEDIUM | ${confDist.MEDIUM} | ${medPct}% |\n`;
  md += `| LOW | ${confDist.LOW} | ${lowPct}% |\n\n`;

  md += `## Verdict\n\n`;
  md += `| Target | Result |\n`;
  md += `|--------|--------|\n`;
  md += `| Exacta Box 4 >${TARGETS.exactaBox4}% | ${passOrFail(result.verdict.exactaBox4Pass)} ${result.exactaBox4Rate.toFixed(1)}% |\n`;
  md += `| Trifecta Box 5 >${TARGETS.trifectaBox5}% | ${passOrFail(result.verdict.trifectaBox5Pass)} ${result.trifectaBox5Rate.toFixed(1)}% |\n`;
  md += `| Superfecta Box 6 >${TARGETS.superfectaBox6}% | ${passOrFail(result.verdict.superfectaBox6Pass)} ${result.superfectaBox6Rate.toFixed(1)}% |\n\n`;

  md += `---\n`;
  md += `*Generated by Algorithm Validation Script*\n`;

  fs.writeFileSync(OUTPUT_MD, md);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  try {
    const result = await runValidation();

    // Exit with appropriate code
    if (result.verdict.status === 'FAILING') {
      console.log('\nAlgorithm baseline FAILING. Exiting with code 1.');
      process.exit(1);
    } else if (result.verdict.status === 'NEEDS_TUNING') {
      console.log('\nAlgorithm baseline needs tuning. Exiting with code 0 (warning).');
      process.exit(0);
    } else {
      console.log('\nAlgorithm baseline VALIDATED. Exiting with code 0.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

main();
