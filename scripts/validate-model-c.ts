/**
 * Model C vs Model B Validation Script
 *
 * Compares the simplified 5-factor Model C (125 pts max) against
 * the complex 25+ factor Model B (323 pts base + 40 overlay = 363 max).
 *
 * Tests the hypothesis that feature bloat is hurting Model B's performance.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import { calculateModelCRaceScores, ModelCScoredHorse } from './model-c-scoring';
import type { TrackCondition } from '../src/hooks/useRaceState';
import type { ScoredHorse } from '../src/lib/scoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../src/data');

// ============================================================================
// TYPES
// ============================================================================

interface ActualResult {
  raceNumber: number;
  finishers: { position: number; postPosition: number; horseName: string }[];
  scratches: string[];
}

interface RaceComparison {
  trackCode: string;
  raceNumber: number;
  raceDate: string;
  // Model B
  modelBTop1: { name: string; score: number; post: number } | null;
  modelBTop2: { name: string; score: number; post: number }[];
  modelBTop3: { name: string; score: number; post: number }[];
  // Model C
  modelCTop1: { name: string; score: number; post: number } | null;
  modelCTop2: { name: string; score: number; post: number }[];
  modelCTop3: { name: string; score: number; post: number }[];
  // Actual results
  actualWinner: { name: string; post: number } | null;
  actualTop3: { name: string; post: number }[];
  // Hit results
  modelBWinnerHit: boolean;
  modelBTop2Hit: boolean;
  modelBTop3Hit: boolean;
  modelCWinnerHit: boolean;
  modelCTop2Hit: boolean;
  modelCTop3Hit: boolean;
  // Disagreement info
  modelsDisagree: boolean;
  modelBRightCWrong: boolean;
  modelCRightBWrong: boolean;
  bothRight: boolean;
  bothWrong: boolean;
  // Model C factor scores for winner (if Model C got it right)
  winnerFactorScores?: {
    speed: number;
    class: number;
    form: number;
    pace: number;
    connections: number;
  };
}

interface TrackStats {
  trackCode: string;
  trackName: string;
  racesScored: number;
  // Model B
  modelBWinners: number;
  modelBTop2: number;
  modelBTop3: number;
  modelBTop4: number;
  // Model C
  modelCWinners: number;
  modelCTop2: number;
  modelCTop3: number;
  modelCTop4: number;
  // Comparison stats
  comparisons: RaceComparison[];
}

interface ValidationPair {
  drfPath: string;
  resultsPath: string;
  baseName: string;
}

interface WinnerScoreAnalysis {
  modelB: {
    ranges: { min: number; max: number; count: number; avgRank: number }[];
  };
  modelC: {
    ranges: { min: number; max: number; count: number; avgRank: number }[];
  };
}

interface FactorAnalysis {
  goodPicks: { speed: number; class: number; form: number; pace: number; connections: number };
  badPicks: { speed: number; class: number; form: number; pace: number; connections: number };
  goodPickCount: number;
  badPickCount: number;
}

// ============================================================================
// PARSE ACTUAL RESULTS FILE
// ============================================================================

function parseResultsFile(content: string): ActualResult[] {
  const results: ActualResult[] = [];
  const lines = content.split('\n');

  let currentRace: ActualResult | null = null;

  for (const line of lines) {
    const trimmed = line.replace(/^\s*\d+→/, '').trim();

    const raceMatch = trimmed.match(/^RACE\s+(\d+)/i);
    if (raceMatch) {
      if (currentRace) {
        results.push(currentRace);
      }
      currentRace = {
        raceNumber: parseInt(raceMatch[1]),
        finishers: [],
        scratches: [],
      };
      continue;
    }

    if (!currentRace) continue;

    const finishMatch = trimmed.match(/^(1st|2nd|3rd|4th):\s*(\d+)\s+(.+)/i);
    if (finishMatch) {
      const posMap: Record<string, number> = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 };
      currentRace.finishers.push({
        position: posMap[finishMatch[1].toLowerCase()],
        postPosition: parseInt(finishMatch[2]),
        horseName: finishMatch[3].trim(),
      });
      continue;
    }

    const scratchMatch = trimmed.match(/^SCRATCHED:\s*(.+)/i);
    if (scratchMatch) {
      const scratchText = scratchMatch[1].trim();
      if (scratchText.toLowerCase() !== 'none') {
        const scratchParts = scratchText.split(',');
        for (const part of scratchParts) {
          const match = part.trim().match(/^\d+\s+(.+)/);
          if (match) {
            currentRace.scratches.push(match[1].trim().toLowerCase());
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

function findDRFFiles(dataDir: string): string[] {
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  const files = fs.readdirSync(dataDir);
  return files.filter(f => f.toLowerCase().endsWith('.drf')).map(f => path.join(dataDir, f));
}

function findMatchingResultsFile(drfPath: string): string | null {
  const baseName = path.basename(drfPath, path.extname(drfPath));
  const dir = path.dirname(drfPath);

  const resultsPath1 = path.join(dir, `${baseName}_results.txt`);
  if (fs.existsSync(resultsPath1)) {
    const content = fs.readFileSync(resultsPath1, 'utf-8');
    if (content.includes('RACE')) {
      return resultsPath1;
    }
  }

  const resultsPath2 = path.join(dir, `${baseName}.txt`);
  if (fs.existsSync(resultsPath2)) {
    const content = fs.readFileSync(resultsPath2, 'utf-8');
    if (content.includes('RACE')) {
      return resultsPath2;
    }
  }

  return null;
}

function discoverValidationPairs(dataDir: string): ValidationPair[] {
  const pairs: ValidationPair[] = [];
  const drfFiles = findDRFFiles(dataDir);

  for (const drfPath of drfFiles) {
    const resultsPath = findMatchingResultsFile(drfPath);
    if (resultsPath) {
      const baseName = path.basename(drfPath, path.extname(drfPath));
      pairs.push({ drfPath, resultsPath, baseName });
    }
  }

  return pairs;
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

function processValidationPair(pair: ValidationPair): TrackStats | null {
  try {
    const drfContent = fs.readFileSync(pair.drfPath, 'utf-8');
    const resultsContent = fs.readFileSync(pair.resultsPath, 'utf-8');

    const parseResult = parseDRFFile(drfContent);
    const actualResults = parseResultsFile(resultsContent);

    const trackCode = parseResult.trackCode || pair.baseName.substring(0, 3).toUpperCase();
    const trackName = parseResult.trackName || pair.baseName;
    const raceDate = parseResult.raceDate || pair.baseName.substring(3);

    const stats: TrackStats = {
      trackCode,
      trackName,
      racesScored: 0,
      modelBWinners: 0,
      modelBTop2: 0,
      modelBTop3: 0,
      modelBTop4: 0,
      modelCWinners: 0,
      modelCTop2: 0,
      modelCTop3: 0,
      modelCTop4: 0,
      comparisons: [],
    };

    for (const race of parseResult.races) {
      const actual = actualResults.find(r => r.raceNumber === race.header.raceNumber);
      if (!actual) continue;

      stats.racesScored++;

      const scratchedNames = new Set(actual.scratches.map(s => s.toLowerCase()));

      const trackCondition: TrackCondition = {
        surface: race.header.surface,
        condition: race.header.condition || 'fast',
        variant: 0,
      };

      const getOdds = (index: number, defaultOdds: string) => {
        return race.horses[index]?.morningLineOdds || defaultOdds;
      };

      const isScratched = (index: number) => {
        const horse = race.horses[index];
        if (!horse) return false;
        return scratchedNames.has(horse.horseName.toLowerCase());
      };

      // Calculate Model B scores
      const modelBScores = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        trackCondition
      );

      // Calculate Model C scores
      const modelCScores = calculateModelCRaceScores(
        race.horses,
        race.header,
        isScratched
      );

      // Sort by score (Model B by baseScore, Model C by total)
      const modelBSorted = [...modelBScores]
        .filter(h => !scratchedNames.has(h.horse.horseName.toLowerCase()))
        .sort((a, b) => b.score.baseScore - a.score.baseScore);

      const modelCSorted = [...modelCScores]
        .filter(h => !h.isScratched)
        .sort((a, b) => b.score.total - a.score.total);

      if (modelBSorted.length === 0 || modelCSorted.length === 0) continue;

      const actualTop4 = actual.finishers.slice(0, 4);
      const actualWinner = actualTop4[0];

      if (!actualWinner) continue;

      // Build comparison
      const modelBTop1 = modelBSorted[0] ? {
        name: modelBSorted[0].horse.horseName,
        score: modelBSorted[0].score.baseScore,
        post: modelBSorted[0].horse.programNumber,
      } : null;

      const modelCTop1 = modelCSorted[0] ? {
        name: modelCSorted[0].horse.horseName,
        score: modelCSorted[0].score.total,
        post: modelCSorted[0].horse.programNumber,
      } : null;

      const modelBWinnerHit = modelBTop1?.post === actualWinner.postPosition;
      const modelBTop2Hit = modelBSorted.slice(0, 2).some(h => h.horse.programNumber === actualWinner.postPosition);
      const modelBTop3Hit = modelBSorted.slice(0, 3).some(h => h.horse.programNumber === actualWinner.postPosition);
      const modelBTop4Hit = modelBSorted.slice(0, 4).some(h => h.horse.programNumber === actualWinner.postPosition);

      const modelCWinnerHit = modelCTop1?.post === actualWinner.postPosition;
      const modelCTop2Hit = modelCSorted.slice(0, 2).some(h => h.horse.programNumber === actualWinner.postPosition);
      const modelCTop3Hit = modelCSorted.slice(0, 3).some(h => h.horse.programNumber === actualWinner.postPosition);
      const modelCTop4Hit = modelCSorted.slice(0, 4).some(h => h.horse.programNumber === actualWinner.postPosition);

      // Update stats
      if (modelBWinnerHit) stats.modelBWinners++;
      if (modelBTop2Hit) stats.modelBTop2++;
      if (modelBTop3Hit) stats.modelBTop3++;
      if (modelBTop4Hit) stats.modelBTop4++;

      if (modelCWinnerHit) stats.modelCWinners++;
      if (modelCTop2Hit) stats.modelCTop2++;
      if (modelCTop3Hit) stats.modelCTop3++;
      if (modelCTop4Hit) stats.modelCTop4++;

      // Determine disagreement
      const modelsDisagree = modelBTop1?.post !== modelCTop1?.post;
      const modelBRightCWrong = modelBWinnerHit && !modelCWinnerHit;
      const modelCRightBWrong = modelCWinnerHit && !modelBWinnerHit;
      const bothRight = modelBWinnerHit && modelCWinnerHit;
      const bothWrong = !modelBWinnerHit && !modelCWinnerHit;

      // Get factor scores for Model C winner if it got the pick right
      let winnerFactorScores: RaceComparison['winnerFactorScores'];
      if (modelCWinnerHit && modelCSorted[0]) {
        const winner = modelCSorted[0];
        winnerFactorScores = {
          speed: winner.score.speed.score,
          class: winner.score.class.score,
          form: winner.score.form.score,
          pace: winner.score.pace.score,
          connections: winner.score.connections.score,
        };
      }

      const comparison: RaceComparison = {
        trackCode,
        raceNumber: race.header.raceNumber,
        raceDate,
        modelBTop1,
        modelBTop2: modelBSorted.slice(0, 2).map(h => ({
          name: h.horse.horseName,
          score: h.score.baseScore,
          post: h.horse.programNumber,
        })),
        modelBTop3: modelBSorted.slice(0, 3).map(h => ({
          name: h.horse.horseName,
          score: h.score.baseScore,
          post: h.horse.programNumber,
        })),
        modelCTop1,
        modelCTop2: modelCSorted.slice(0, 2).map(h => ({
          name: h.horse.horseName,
          score: h.score.total,
          post: h.horse.programNumber,
        })),
        modelCTop3: modelCSorted.slice(0, 3).map(h => ({
          name: h.horse.horseName,
          score: h.score.total,
          post: h.horse.programNumber,
        })),
        actualWinner: { name: actualWinner.horseName, post: actualWinner.postPosition },
        actualTop3: actualTop4.slice(0, 3).map(f => ({ name: f.horseName, post: f.postPosition })),
        modelBWinnerHit,
        modelBTop2Hit,
        modelBTop3Hit,
        modelCWinnerHit,
        modelCTop2Hit,
        modelCTop3Hit,
        modelsDisagree,
        modelBRightCWrong,
        modelCRightBWrong,
        bothRight,
        bothWrong,
        winnerFactorScores,
      };

      stats.comparisons.push(comparison);
    }

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${pair.baseName}: ${errorMessage}`);
    return null;
  }
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeWinnerScores(allStats: TrackStats[]): WinnerScoreAnalysis {
  const modelBRanges = [
    { min: 250, max: 999, count: 0, totalRank: 0 },
    { min: 225, max: 249, count: 0, totalRank: 0 },
    { min: 200, max: 224, count: 0, totalRank: 0 },
    { min: 175, max: 199, count: 0, totalRank: 0 },
    { min: 0, max: 174, count: 0, totalRank: 0 },
  ];

  const modelCRanges = [
    { min: 100, max: 999, count: 0, totalRank: 0 },
    { min: 85, max: 99, count: 0, totalRank: 0 },
    { min: 70, max: 84, count: 0, totalRank: 0 },
    { min: 55, max: 69, count: 0, totalRank: 0 },
    { min: 0, max: 54, count: 0, totalRank: 0 },
  ];

  for (const stats of allStats) {
    for (const comp of stats.comparisons) {
      // Model B winner analysis
      if (comp.modelBTop1 && comp.modelBWinnerHit) {
        const score = comp.modelBTop1.score;
        for (const range of modelBRanges) {
          if (score >= range.min && score <= range.max) {
            range.count++;
            range.totalRank += 1; // Winner is rank 1
            break;
          }
        }
      }

      // Model C winner analysis
      if (comp.modelCTop1 && comp.modelCWinnerHit) {
        const score = comp.modelCTop1.score;
        for (const range of modelCRanges) {
          if (score >= range.min && score <= range.max) {
            range.count++;
            range.totalRank += 1;
            break;
          }
        }
      }
    }
  }

  return {
    modelB: {
      ranges: modelBRanges.map(r => ({
        min: r.min,
        max: r.max,
        count: r.count,
        avgRank: r.count > 0 ? r.totalRank / r.count : 0,
      })),
    },
    modelC: {
      ranges: modelCRanges.map(r => ({
        min: r.min,
        max: r.max,
        count: r.count,
        avgRank: r.count > 0 ? r.totalRank / r.count : 0,
      })),
    },
  };
}

function analyzeModelCFactors(allStats: TrackStats[]): FactorAnalysis {
  const goodPicks = { speed: 0, class: 0, form: 0, pace: 0, connections: 0 };
  const badPicks = { speed: 0, class: 0, form: 0, pace: 0, connections: 0 };
  let goodPickCount = 0;
  let badPickCount = 0;

  for (const stats of allStats) {
    for (const comp of stats.comparisons) {
      if (comp.winnerFactorScores) {
        // Model C got it right - good pick
        goodPicks.speed += comp.winnerFactorScores.speed;
        goodPicks.class += comp.winnerFactorScores.class;
        goodPicks.form += comp.winnerFactorScores.form;
        goodPicks.pace += comp.winnerFactorScores.pace;
        goodPicks.connections += comp.winnerFactorScores.connections;
        goodPickCount++;
      } else if (comp.modelCTop1 && !comp.modelCWinnerHit) {
        // Model C got it wrong - bad pick
        // We need to track Model C's #1 pick score when wrong
        badPickCount++;
      }
    }
  }

  return {
    goodPicks: {
      speed: goodPickCount > 0 ? goodPicks.speed / goodPickCount : 0,
      class: goodPickCount > 0 ? goodPicks.class / goodPickCount : 0,
      form: goodPickCount > 0 ? goodPicks.form / goodPickCount : 0,
      pace: goodPickCount > 0 ? goodPicks.pace / goodPickCount : 0,
      connections: goodPickCount > 0 ? goodPicks.connections / goodPickCount : 0,
    },
    badPicks: {
      speed: badPickCount > 0 ? badPicks.speed / badPickCount : 0,
      class: badPickCount > 0 ? badPicks.class / badPickCount : 0,
      form: badPickCount > 0 ? badPicks.form / badPickCount : 0,
      pace: badPickCount > 0 ? badPicks.pace / badPickCount : 0,
      connections: badPickCount > 0 ? badPicks.connections / badPickCount : 0,
    },
    goodPickCount,
    badPickCount,
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printReport(allStats: TrackStats[]): void {
  // Calculate totals
  const totals = {
    racesScored: 0,
    modelBWinners: 0,
    modelBTop2: 0,
    modelBTop3: 0,
    modelBTop4: 0,
    modelCWinners: 0,
    modelCTop2: 0,
    modelCTop3: 0,
    modelCTop4: 0,
    disagreements: 0,
    modelBRightCWrong: 0,
    modelCRightBWrong: 0,
    bothRight: 0,
    bothWrong: 0,
  };

  for (const stats of allStats) {
    totals.racesScored += stats.racesScored;
    totals.modelBWinners += stats.modelBWinners;
    totals.modelBTop2 += stats.modelBTop2;
    totals.modelBTop3 += stats.modelBTop3;
    totals.modelBTop4 += stats.modelBTop4;
    totals.modelCWinners += stats.modelCWinners;
    totals.modelCTop2 += stats.modelCTop2;
    totals.modelCTop3 += stats.modelCTop3;
    totals.modelCTop4 += stats.modelCTop4;

    for (const comp of stats.comparisons) {
      if (comp.modelsDisagree) totals.disagreements++;
      if (comp.modelBRightCWrong) totals.modelBRightCWrong++;
      if (comp.modelCRightBWrong) totals.modelCRightBWrong++;
      if (comp.bothRight) totals.bothRight++;
      if (comp.bothWrong) totals.bothWrong++;
    }
  }

  const pct = (n: number, d: number) => d > 0 ? ((n / d) * 100).toFixed(1) : '0.0';
  const delta = (a: number, b: number, d: number) => {
    const diff = ((a - b) / d) * 100;
    return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
  };

  console.log('');
  console.log('================================================================================');
  console.log('MODEL C vs MODEL B VALIDATION REPORT');
  console.log(`Test Set: ${allStats.length} tracks, ${totals.racesScored} races`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('================================================================================');

  console.log('');
  console.log('OVERALL RESULTS');
  console.log('--------------------------------------------------------------------------------');
  console.log('Metric                  Model B (Current)    Model C (Simple)    Delta');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Winners (#1 pick)       ${totals.modelBWinners.toString().padStart(2)} (${pct(totals.modelBWinners, totals.racesScored).padStart(5)}%)           ${totals.modelCWinners.toString().padStart(2)} (${pct(totals.modelCWinners, totals.racesScored).padStart(5)}%)          ${delta(totals.modelCWinners, totals.modelBWinners, totals.racesScored).padStart(6)}`);
  console.log(`Top 2                   ${totals.modelBTop2.toString().padStart(2)} (${pct(totals.modelBTop2, totals.racesScored).padStart(5)}%)           ${totals.modelCTop2.toString().padStart(2)} (${pct(totals.modelCTop2, totals.racesScored).padStart(5)}%)          ${delta(totals.modelCTop2, totals.modelBTop2, totals.racesScored).padStart(6)}`);
  console.log(`Top 3                   ${totals.modelBTop3.toString().padStart(2)} (${pct(totals.modelBTop3, totals.racesScored).padStart(5)}%)           ${totals.modelCTop3.toString().padStart(2)} (${pct(totals.modelCTop3, totals.racesScored).padStart(5)}%)          ${delta(totals.modelCTop3, totals.modelBTop3, totals.racesScored).padStart(6)}`);
  console.log(`Top 4                   ${totals.modelBTop4.toString().padStart(2)} (${pct(totals.modelBTop4, totals.racesScored).padStart(5)}%)           ${totals.modelCTop4.toString().padStart(2)} (${pct(totals.modelCTop4, totals.racesScored).padStart(5)}%)          ${delta(totals.modelCTop4, totals.modelBTop4, totals.racesScored).padStart(6)}`);
  console.log('--------------------------------------------------------------------------------');

  const modelBWinRate = totals.modelBWinners / totals.racesScored * 100;
  const modelCWinRate = totals.modelCWinners / totals.racesScored * 100;
  const winRateDiff = modelCWinRate - modelBWinRate;

  if (winRateDiff > 0) {
    console.log(`VERDICT: Model C wins by ${winRateDiff.toFixed(1)}% on win rate`);
  } else if (winRateDiff < 0) {
    console.log(`VERDICT: Model B wins by ${Math.abs(winRateDiff).toFixed(1)}% on win rate`);
  } else {
    console.log('VERDICT: Models tied on win rate');
  }

  console.log('================================================================================');
  console.log('');
  console.log('PER-TRACK BREAKDOWN');
  console.log('--------------------------------------------------------------------------------');
  console.log('Track       Races   Model B Wins   Model C Wins   Model B Top3   Model C Top3');
  console.log('--------------------------------------------------------------------------------');

  for (const stats of allStats) {
    const bWinPct = pct(stats.modelBWinners, stats.racesScored);
    const cWinPct = pct(stats.modelCWinners, stats.racesScored);
    const bTop3Pct = pct(stats.modelBTop3, stats.racesScored);
    const cTop3Pct = pct(stats.modelCTop3, stats.racesScored);

    console.log(`${stats.trackCode.padEnd(11)} ${stats.racesScored.toString().padStart(2)}      ${stats.modelBWinners.toString().padStart(2)} (${bWinPct.padStart(5)}%)     ${stats.modelCWinners.toString().padStart(2)} (${cWinPct.padStart(5)}%)     ${stats.modelBTop3.toString().padStart(2)} (${bTop3Pct.padStart(5)}%)    ${stats.modelCTop3.toString().padStart(2)} (${cTop3Pct.padStart(5)}%)`);
  }

  console.log('================================================================================');
  console.log('');
  console.log('WHERE MODELS DISAGREED');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Races where Model B #1 ≠ Model C #1: ${totals.disagreements} races`);
  console.log(`Model B was right, Model C wrong:    ${totals.modelBRightCWrong} races`);
  console.log(`Model C was right, Model B wrong:    ${totals.modelCRightBWrong} races`);
  console.log(`Both wrong:                          ${totals.bothWrong} races`);
  console.log(`Both right (same pick):              ${totals.bothRight} races`);
  console.log('');

  // Show examples of Model C wins
  const modelCWins: RaceComparison[] = [];
  const modelBWins: RaceComparison[] = [];

  for (const stats of allStats) {
    for (const comp of stats.comparisons) {
      if (comp.modelCRightBWrong && modelCWins.length < 5) {
        modelCWins.push(comp);
      }
      if (comp.modelBRightCWrong && modelBWins.length < 5) {
        modelBWins.push(comp);
      }
    }
  }

  if (modelCWins.length > 0) {
    console.log('Examples of Model C wins (Model C right, Model B wrong):');
    for (const comp of modelCWins.slice(0, 3)) {
      console.log(`  ${comp.trackCode} R${comp.raceNumber}: Model C picked #${comp.modelCTop1?.post} ${comp.modelCTop1?.name} (WON), Model B picked #${comp.modelBTop1?.post} ${comp.modelBTop1?.name}`);
    }
    console.log('');
  }

  if (modelBWins.length > 0) {
    console.log('Examples of Model B wins (Model B right, Model C wrong):');
    for (const comp of modelBWins.slice(0, 3)) {
      console.log(`  ${comp.trackCode} R${comp.raceNumber}: Model B picked #${comp.modelBTop1?.post} ${comp.modelBTop1?.name} (WON), Model C picked #${comp.modelCTop1?.post} ${comp.modelCTop1?.name}`);
    }
  }

  console.log('================================================================================');
  console.log('');
  console.log('MODEL C FACTOR ANALYSIS');
  console.log('--------------------------------------------------------------------------------');

  const factorAnalysis = analyzeModelCFactors(allStats);

  console.log(`For winners Model C ranked #1 (${factorAnalysis.goodPickCount} races):`);
  console.log(`  Avg Speed Score:       ${factorAnalysis.goodPicks.speed.toFixed(1)}/50`);
  console.log(`  Avg Class Score:       ${factorAnalysis.goodPicks.class.toFixed(1)}/25`);
  console.log(`  Avg Form Score:        ${factorAnalysis.goodPicks.form.toFixed(1)}/20`);
  console.log(`  Avg Pace Score:        ${factorAnalysis.goodPicks.pace.toFixed(1)}/20`);
  console.log(`  Avg Connections Score: ${factorAnalysis.goodPicks.connections.toFixed(1)}/10`);
  console.log('');

  // Find key insight
  let keyInsight = '';
  const goodTotal = factorAnalysis.goodPicks.speed + factorAnalysis.goodPicks.class +
                    factorAnalysis.goodPicks.form + factorAnalysis.goodPicks.pace +
                    factorAnalysis.goodPicks.connections;

  if (factorAnalysis.goodPicks.speed >= 40) {
    keyInsight = 'Speed figures (40+/50) are the strongest predictor of success';
  } else if (factorAnalysis.goodPicks.class >= 22) {
    keyInsight = 'Class drops (22+/25) strongly correlate with winning';
  } else if (factorAnalysis.goodPicks.pace >= 15) {
    keyInsight = 'Favorable pace scenarios (15+/20) matter significantly';
  } else {
    keyInsight = 'Winning picks had balanced scores across all factors';
  }

  console.log(`Key Insight: ${keyInsight}`);

  console.log('================================================================================');
  console.log('');
  console.log('CONCLUSION');
  console.log('--------------------------------------------------------------------------------');
  console.log('Model C (5 factors, 125 pts) vs Model B (25+ factors, 323 pts):');
  console.log('');

  if (winRateDiff > 0) {
    console.log(`Win Rate:     BETTER by ${winRateDiff.toFixed(1)}%`);
  } else if (winRateDiff < 0) {
    console.log(`Win Rate:     WORSE by ${Math.abs(winRateDiff).toFixed(1)}%`);
  } else {
    console.log('Win Rate:     SAME');
  }

  const top3Diff = (totals.modelCTop3 - totals.modelBTop3) / totals.racesScored * 100;
  if (top3Diff > 0) {
    console.log(`Top 3 Rate:   BETTER by ${top3Diff.toFixed(1)}%`);
  } else if (top3Diff < 0) {
    console.log(`Top 3 Rate:   WORSE by ${Math.abs(top3Diff).toFixed(1)}%`);
  } else {
    console.log('Top 3 Rate:   SAME');
  }

  console.log('Simplicity:   Model C uses 80% fewer factors');
  console.log('');

  // Recommendation
  if (winRateDiff >= 0 && top3Diff >= -2) {
    console.log('Recommendation: SIMPLIFY THE PRODUCTION ALGORITHM');
    console.log('');
    console.log('If Model C matches or beats Model B:');
    console.log('→ The extra 20 factors in Model B are NOISE');
    console.log('→ Feature bloat is hurting, not helping');
    console.log('→ Consider adopting Model C as the new baseline');
  } else if (winRateDiff < -3) {
    console.log('Recommendation: KEEP MODEL B BUT INVESTIGATE');
    console.log('');
    console.log('If Model B significantly beats Model C:');
    console.log('→ Some factors ARE adding value');
    console.log('→ Identify which specific factors help and keep only those');
    console.log('→ Consider a "Model D" with 8-10 factors');
  } else {
    console.log('Recommendation: HYBRID APPROACH');
    console.log('');
    console.log('Results are close - consider:');
    console.log('→ Start with Model C simplicity');
    console.log('→ Add back ONLY factors that significantly improve accuracy');
    console.log('→ Test each addition rigorously');
  }

  console.log('================================================================================');
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function runValidation() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              MODEL C vs MODEL B VALIDATION                                    ║');
  console.log('║              5-Factor Simplicity vs 25-Factor Complexity                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const pairs = discoverValidationPairs(DATA_DIR);

  if (pairs.length === 0) {
    console.log('❌ No DRF files with matching results found in', DATA_DIR);
    process.exit(1);
  }

  console.log(`📁 Found ${pairs.length} DRF file(s) with matching results:`);
  for (const pair of pairs) {
    console.log(`   • ${pair.baseName}`);
  }
  console.log('');
  console.log('Processing...');

  const allStats: TrackStats[] = [];

  for (const pair of pairs) {
    const stats = processValidationPair(pair);
    if (stats) {
      allStats.push(stats);
    }
  }

  if (allStats.length > 0) {
    printReport(allStats);
  } else {
    console.log('\n❌ No files were successfully processed.');
  }
}

runValidation().catch(console.error);
