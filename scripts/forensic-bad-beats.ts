/**
 * Forensic Bad Beats Diagnostic Script
 *
 * Deep-dive analysis of "Bad Beat" races to identify root causes of algorithm misses.
 * A Bad Beat is defined as: Our #1 pick scored 180+ base points AND finished 4th or worse.
 *
 * This script provides complete forensic breakdown of ALL 53+ scoring categories for
 * every Bad Beat race to identify the ACTUAL root cause of the stubborn win rate ceiling.
 *
 * Output: Both console AND scripts/output/forensic-report.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores, type ScoredHorse, type HorseScore } from '../src/lib/scoring';
import { calculateDataCompleteness, type DataCompletenessResult } from '../src/lib/scoring/dataCompleteness';
import { calculateFormScore } from '../src/lib/scoring/form';
import { calculatePaceScore, analyzeFieldPace } from '../src/lib/scoring/pace';
import { calculateSpeedClassScore } from '../src/lib/scoring/speedClass';
import { calculateConnectionsScore, buildConnectionsDatabase } from '../src/lib/scoring/connections';
import { calculatePostPositionScore } from '../src/lib/scoring/postPosition';
import { calculateOddsScore, parseOddsToDecimal } from '../src/lib/scoring/oddsScore';
import { calculateEquipmentScore } from '../src/lib/scoring/equipment';
import { calculateDistanceSurfaceScore, calculateTrackSpecialistScore } from '../src/lib/scoring/distanceSurface';
import { calculateTrainerPatternScore } from '../src/lib/scoring/trainerPatterns';
import { detectComboPatterns } from '../src/lib/scoring/comboPatterns';
import type { TrackCondition } from '../src/hooks/useRaceState';
import type { HorseEntry, RaceHeader } from '../src/types/drf';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../src/data');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'forensic-report.txt');

// Bad Beat threshold: #1 pick with 180+ base points finished 4th or worse
const BAD_BEAT_SCORE_THRESHOLD = 180;
const BAD_BEAT_FINISH_THRESHOLD = 4;

// ============================================================================
// TYPES
// ============================================================================

interface ActualResult {
  raceNumber: number;
  finishers: { position: number; postPosition: number; horseName: string }[];
  scratches: string[];
}

interface ValidationPair {
  drfPath: string;
  resultsPath: string;
  baseName: string;
}

interface ForensicHorseData {
  // Identity
  horseName: string;
  postPosition: number;
  morningLineOdds: string;
  morningLineDecimal: number | null;
  actualFinish: number | null;

  // Final Scores
  baseScore: number;
  overlayScore: number;
  totalScore: number;
  rank: number;

  // ABILITY SCORES (217 max)
  speedScore: number;
  bestSpeedFigure: number | null;
  avgSpeedFigure: number | null;
  speedConfidence: string;
  classScore: number;
  classLevel: string;
  classMovement: string;
  formScore: number;
  formTrend: string;
  wonLastOut: boolean;
  won2OfLast3: boolean;
  layoffScore: number;
  daysSinceLastRace: number | null;
  consistencyBonus: number;
  paceScore: number;
  runningStyle: string;
  paceFit: string;
  e1Pace: number | null;
  lpPace: number | null;

  // BIAS SCORES (47 max raw, capped)
  connectionsScore: number;
  trainerScore: number;
  jockeyScore: number;
  partnershipBonus: number;
  trainerName: string;
  jockeyName: string;
  postPositionScore: number;
  isGoldenPost: boolean;
  oddsScore: number;
  oddsTier: string;
  trainerPatternsScore: number;

  // BIAS CAP ANALYSIS
  rawBiasScore: number;
  cappedBiasScore: number;
  biasCapApplied: boolean;
  biasReduction: number;

  // SUPPLEMENTAL SCORES
  equipmentScore: number;
  hasEquipmentChanges: boolean;
  firstTimeEquipment: string[];
  distanceSurfaceScore: number;
  turfScore: number;
  wetScore: number;
  distanceScore: number;
  trackSpecialistScore: number;
  isTrackSpecialist: boolean;
  comboPatternsScore: number;
  detectedCombos: string[];

  // DATA QUALITY
  dataCompletenessScore: number;
  dataCompletenessGrade: string;
  criticalComplete: number;
  isLowConfidence: boolean;
  confidenceReason: string;
  lowConfidencePenaltyApplied: boolean;
  lowConfidencePenaltyAmount: number;

  // PENALTIES
  paperTigerPenaltyApplied: boolean;
  paperTigerPenaltyAmount: number;

  // RAW DATA
  lifetimeStarts: number;
  lifetimeWins: number;
  lifetimeWinPct: number;
  currentYearStarts: number;
  currentYearWins: number;
  workoutCount: number;
  hasBulletWork: boolean;
}

interface BadBeatRace {
  trackCode: string;
  trackName: string;
  raceNumber: number;
  raceDate: string;
  distance: string;
  surface: string;
  raceType: string;
  fieldSize: number;
  ourPick: ForensicHorseData;
  winner: ForensicHorseData;
  scoreDelta: number;
  abilityDelta: number;
  biasDelta: number;
}

// ============================================================================
// FILE DISCOVERY (reused from run-bulk-validation.ts)
// ============================================================================

function findDRFFiles(dataDir: string): string[] {
  if (!fs.existsSync(dataDir)) {
    return [];
  }
  const files = fs.readdirSync(dataDir);
  return files.filter((f) => f.toLowerCase().endsWith('.drf')).map((f) => path.join(dataDir, f));
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
// FORENSIC DATA EXTRACTION
// ============================================================================

function extractForensicData(
  scoredHorse: ScoredHorse,
  actualFinish: number | null,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): ForensicHorseData {
  const horse = scoredHorse.horse;
  const score = scoredHorse.score;
  const breakdown = score.breakdown;

  // Calculate ability and bias scores for analysis
  const abilityScore =
    breakdown.speedClass.total +
    breakdown.form.total +
    breakdown.pace.total;

  const rawBiasScore =
    breakdown.connections.total +
    breakdown.postPosition.total +
    breakdown.odds.total +
    breakdown.trainerPatterns.total;

  const maxBiasAllowed = Math.round(abilityScore * 0.25);
  const cappedBiasScore = Math.min(rawBiasScore, maxBiasAllowed);
  const biasReduction = rawBiasScore - cappedBiasScore;

  // Extract pace figures from past performances
  let e1Pace: number | null = null;
  let lpPace: number | null = null;
  if (horse.pastPerformances.length > 0) {
    const lastPP = horse.pastPerformances[0];
    e1Pace = lastPP?.paceFigures?.e1 ?? null;
    lpPace = lastPP?.paceFigures?.lp ?? null;
  }

  // Check for bullet work
  const hasBulletWork = horse.workouts?.some(w => w.isBullet) ?? false;

  return {
    // Identity
    horseName: horse.horseName,
    postPosition: horse.postPosition,
    morningLineOdds: horse.morningLineOdds,
    morningLineDecimal: parseOddsToDecimal(horse.morningLineOdds),
    actualFinish,

    // Final Scores
    baseScore: score.baseScore,
    overlayScore: score.overlayScore,
    totalScore: score.total,
    rank: scoredHorse.rank,

    // ABILITY SCORES
    speedScore: breakdown.speedClass.speedScore,
    bestSpeedFigure: breakdown.speedClass.bestFigure,
    avgSpeedFigure: horse.averageBeyer ?? null,
    speedConfidence: score.dataCompleteness.hasSpeedFigures ? 'HIGH' : 'LOW',
    classScore: breakdown.speedClass.classScore,
    classLevel: breakdown.speedClass.classMovement,
    classMovement: breakdown.classAnalysis?.movement ?? 'N/A',
    formScore: breakdown.form.total,
    formTrend: breakdown.form.formTrend,
    wonLastOut: breakdown.form.wonLastOut,
    won2OfLast3: breakdown.form.won2OfLast3,
    layoffScore: breakdown.form.layoffScore,
    daysSinceLastRace: horse.daysSinceLastRace ?? null,
    consistencyBonus: breakdown.form.consistencyBonus,
    paceScore: breakdown.pace.total,
    runningStyle: breakdown.pace.runningStyle,
    paceFit: breakdown.pace.paceFit,
    e1Pace,
    lpPace,

    // BIAS SCORES
    connectionsScore: breakdown.connections.total,
    trainerScore: breakdown.connections.trainer,
    jockeyScore: breakdown.connections.jockey,
    partnershipBonus: breakdown.connections.partnershipBonus,
    trainerName: horse.trainerName || 'N/A',
    jockeyName: horse.jockeyName || 'N/A',
    postPositionScore: breakdown.postPosition.total,
    isGoldenPost: breakdown.postPosition.isGoldenPost,
    oddsScore: breakdown.odds.total,
    oddsTier: breakdown.odds.tier,
    trainerPatternsScore: breakdown.trainerPatterns.total,

    // BIAS CAP
    rawBiasScore,
    cappedBiasScore,
    biasCapApplied: biasReduction > 0,
    biasReduction,

    // SUPPLEMENTAL
    equipmentScore: breakdown.equipment.total,
    hasEquipmentChanges: breakdown.equipment.hasChanges,
    firstTimeEquipment: horse.equipment.firstTimeEquipment || [],
    distanceSurfaceScore: breakdown.distanceSurface.total,
    turfScore: breakdown.distanceSurface.turfScore,
    wetScore: breakdown.distanceSurface.wetScore,
    distanceScore: breakdown.distanceSurface.distanceScore,
    trackSpecialistScore: breakdown.trackSpecialist.total,
    isTrackSpecialist: breakdown.trackSpecialist.isSpecialist,
    comboPatternsScore: breakdown.comboPatterns.total,
    detectedCombos: breakdown.comboPatterns.detectedCombos.map(c => c.pattern),

    // DATA QUALITY
    dataCompletenessScore: score.dataCompleteness.overallScore,
    dataCompletenessGrade: score.dataCompleteness.overallGrade,
    criticalComplete: score.dataCompleteness.criticalComplete,
    isLowConfidence: score.dataCompleteness.isLowConfidence,
    confidenceReason: score.dataCompleteness.confidenceReason || 'N/A',
    lowConfidencePenaltyApplied: score.lowConfidencePenaltyApplied,
    lowConfidencePenaltyAmount: score.lowConfidencePenaltyAmount,

    // PENALTIES
    paperTigerPenaltyApplied: score.paperTigerPenaltyApplied,
    paperTigerPenaltyAmount: score.paperTigerPenaltyAmount,

    // RAW DATA
    lifetimeStarts: horse.lifetimeStarts ?? 0,
    lifetimeWins: horse.lifetimeWins ?? 0,
    lifetimeWinPct: horse.lifetimeStarts && horse.lifetimeStarts > 0
      ? Math.round((horse.lifetimeWins ?? 0) / horse.lifetimeStarts * 100)
      : 0,
    currentYearStarts: horse.currentYearStarts ?? 0,
    currentYearWins: horse.currentYearWins ?? 0,
    workoutCount: horse.workouts?.length ?? 0,
    hasBulletWork,
  };
}

// ============================================================================
// BAD BEAT DETECTION
// ============================================================================

function processPairForBadBeats(pair: ValidationPair): BadBeatRace[] {
  const badBeats: BadBeatRace[] = [];

  try {
    const drfContent = fs.readFileSync(pair.drfPath, 'utf-8');
    const resultsContent = fs.readFileSync(pair.resultsPath, 'utf-8');

    const parseResult = parseDRFFile(drfContent);
    const actualResults = parseResultsFile(resultsContent);

    const trackCode = parseResult.trackCode || pair.baseName.substring(0, 3).toUpperCase();
    const trackName = parseResult.trackName || pair.baseName;
    const raceDate = parseResult.raceDate || pair.baseName.substring(3);

    for (const race of parseResult.races) {
      const actual = actualResults.find((r) => r.raceNumber === race.header.raceNumber);
      if (!actual || actual.finishers.length === 0) continue;

      const scratchedNames = new Set(actual.scratches.map((s) => s.toLowerCase()));

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

      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        trackCondition
      );

      // Get active horses sorted by base score
      const activeHorses = scoredHorses
        .filter((h) => !scratchedNames.has(h.horse.horseName.toLowerCase()))
        .sort((a, b) => b.score.baseScore - a.score.baseScore);

      if (activeHorses.length === 0) continue;

      const ourPick = activeHorses[0];
      if (!ourPick) continue;

      // Find our pick's actual finish
      const ourPickFinish = actual.finishers.find(
        (f) => f.postPosition === ourPick.horse.programNumber
      );

      // Check for Bad Beat: 180+ base pts AND finished 4th or worse
      if (
        ourPick.score.baseScore >= BAD_BEAT_SCORE_THRESHOLD &&
        ourPickFinish &&
        ourPickFinish.position >= BAD_BEAT_FINISH_THRESHOLD
      ) {
        // Find the actual winner in our scored horses
        const actualWinner = actual.finishers[0];
        if (!actualWinner) continue;

        const winnerScored = scoredHorses.find(
          (h) => h.horse.programNumber === actualWinner.postPosition
        );
        if (!winnerScored) continue;

        // Extract forensic data for both horses
        const ourPickData = extractForensicData(
          ourPick,
          ourPickFinish.position,
          race.header,
          race.horses
        );

        const winnerData = extractForensicData(
          winnerScored,
          1,
          race.header,
          race.horses
        );

        // Calculate deltas
        const scoreDelta = ourPickData.baseScore - winnerData.baseScore;
        const abilityDelta =
          (ourPickData.speedScore + ourPickData.classScore + ourPickData.formScore + ourPickData.paceScore) -
          (winnerData.speedScore + winnerData.classScore + winnerData.formScore + winnerData.paceScore);
        const biasDelta = ourPickData.cappedBiasScore - winnerData.cappedBiasScore;

        badBeats.push({
          trackCode,
          trackName,
          raceNumber: race.header.raceNumber,
          raceDate,
          distance: race.header.distance,
          surface: race.header.surface,
          raceType: race.header.raceType || 'N/A',
          fieldSize: race.header.fieldSize,
          ourPick: ourPickData,
          winner: winnerData,
          scoreDelta,
          abilityDelta,
          biasDelta,
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${pair.baseName}: ${errorMessage}`);
  }

  return badBeats;
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function formatValue(value: unknown, width: number = 8): string {
  if (value === null || value === undefined) {
    return 'NULL'.padStart(width);
  }
  if (typeof value === 'boolean') {
    return (value ? 'YES' : 'NO').padStart(width);
  }
  if (typeof value === 'number') {
    return value.toString().padStart(width);
  }
  const str = String(value);
  return str.length > width ? str.substring(0, width - 1) + '…' : str.padStart(width);
}

function formatRow(label: string, ourValue: unknown, winnerValue: unknown, delta?: number): string {
  const labelCol = label.padEnd(30);
  const ourCol = formatValue(ourValue, 12);
  const winCol = formatValue(winnerValue, 12);
  const deltaCol = delta !== undefined ? formatValue(delta, 8) : '        ';
  return `│ ${labelCol} │ ${ourCol} │ ${winCol} │ ${deltaCol} │`;
}

function formatSectionHeader(title: string): string {
  return `├${'─'.repeat(32)}┼${'─'.repeat(14)}┼${'─'.repeat(14)}┼${'─'.repeat(10)}┤\n│ ${title.padEnd(30)} │ ${'OUR PICK'.padStart(12)} │ ${'WINNER'.padStart(12)} │ ${'DELTA'.padStart(8)} │`;
}

function formatBadBeatReport(bb: BadBeatRace): string {
  const lines: string[] = [];
  const sep = '═'.repeat(74);
  const thinSep = '─'.repeat(74);

  lines.push(`\n${sep}`);
  lines.push(`BAD BEAT: ${bb.trackCode} Race ${bb.raceNumber} - ${bb.raceDate}`);
  lines.push(`${bb.distance} ${bb.surface} | ${bb.raceType} | Field Size: ${bb.fieldSize}`);
  lines.push(sep);

  // Summary box
  lines.push(`┌${'─'.repeat(72)}┐`);
  lines.push(`│ OUR PICK: #${bb.ourPick.postPosition} ${bb.ourPick.horseName.substring(0, 20).padEnd(20)} │ BASE: ${bb.ourPick.baseScore.toString().padStart(3)} pts │ FINISH: ${getOrdinal(bb.ourPick.actualFinish || 0).padStart(4)} │`);
  lines.push(`│ WINNER:   #${bb.winner.postPosition} ${bb.winner.horseName.substring(0, 20).padEnd(20)} │ BASE: ${bb.winner.baseScore.toString().padStart(3)} pts │ FINISH: 1st  │`);
  lines.push(`├${'─'.repeat(72)}┤`);
  lines.push(`│ SCORE DELTA: ${bb.scoreDelta >= 0 ? '+' : ''}${bb.scoreDelta} pts │ ABILITY DELTA: ${bb.abilityDelta >= 0 ? '+' : ''}${bb.abilityDelta} pts │ BIAS DELTA: ${bb.biasDelta >= 0 ? '+' : ''}${bb.biasDelta} pts │`);
  lines.push(`└${'─'.repeat(72)}┘`);

  // Detailed comparison table
  lines.push(`\n┌${'─'.repeat(32)}┬${'─'.repeat(14)}┬${'─'.repeat(14)}┬${'─'.repeat(10)}┐`);
  lines.push(`│ ${'CATEGORY'.padEnd(30)} │ ${'OUR PICK'.padStart(12)} │ ${'WINNER'.padStart(12)} │ ${'DELTA'.padStart(8)} │`);

  // === FINAL SCORES ===
  lines.push(formatSectionHeader('FINAL SCORES'));
  lines.push(formatRow('Base Score', bb.ourPick.baseScore, bb.winner.baseScore, bb.scoreDelta));
  lines.push(formatRow('Overlay Score', bb.ourPick.overlayScore, bb.winner.overlayScore));
  lines.push(formatRow('Total Score', bb.ourPick.totalScore, bb.winner.totalScore));
  lines.push(formatRow('Rank', bb.ourPick.rank, bb.winner.rank));

  // === ABILITY SCORES (217 max) ===
  lines.push(formatSectionHeader('ABILITY SCORES (217 max)'));
  lines.push(formatRow('Speed Score (105 max)', bb.ourPick.speedScore, bb.winner.speedScore,
    bb.ourPick.speedScore - bb.winner.speedScore));
  lines.push(formatRow('Best Speed Figure', bb.ourPick.bestSpeedFigure, bb.winner.bestSpeedFigure));
  lines.push(formatRow('Avg Speed Figure', bb.ourPick.avgSpeedFigure, bb.winner.avgSpeedFigure));
  lines.push(formatRow('Speed Confidence', bb.ourPick.speedConfidence, bb.winner.speedConfidence));
  lines.push(formatRow('Class Score (35 max)', bb.ourPick.classScore, bb.winner.classScore,
    bb.ourPick.classScore - bb.winner.classScore));
  lines.push(formatRow('Class Movement', bb.ourPick.classMovement, bb.winner.classMovement));
  lines.push(formatRow('Form Score (42 max)', bb.ourPick.formScore, bb.winner.formScore,
    bb.ourPick.formScore - bb.winner.formScore));
  lines.push(formatRow('Form Trend', bb.ourPick.formTrend, bb.winner.formTrend));
  lines.push(formatRow('Won Last Out', bb.ourPick.wonLastOut, bb.winner.wonLastOut));
  lines.push(formatRow('Won 2 of Last 3', bb.ourPick.won2OfLast3, bb.winner.won2OfLast3));
  lines.push(formatRow('Layoff Score', bb.ourPick.layoffScore, bb.winner.layoffScore));
  lines.push(formatRow('Days Since Race', bb.ourPick.daysSinceLastRace, bb.winner.daysSinceLastRace));
  lines.push(formatRow('Consistency Bonus', bb.ourPick.consistencyBonus, bb.winner.consistencyBonus));
  lines.push(formatRow('Pace Score (35 max)', bb.ourPick.paceScore, bb.winner.paceScore,
    bb.ourPick.paceScore - bb.winner.paceScore));
  lines.push(formatRow('Running Style', bb.ourPick.runningStyle, bb.winner.runningStyle));
  lines.push(formatRow('Pace Fit', bb.ourPick.paceFit, bb.winner.paceFit));
  lines.push(formatRow('E1 Pace', bb.ourPick.e1Pace, bb.winner.e1Pace));
  lines.push(formatRow('LP Pace', bb.ourPick.lpPace, bb.winner.lpPace));

  // === BIAS SCORES ===
  lines.push(formatSectionHeader('BIAS SCORES (47 max raw)'));
  lines.push(formatRow('Connections (23 max)', bb.ourPick.connectionsScore, bb.winner.connectionsScore,
    bb.ourPick.connectionsScore - bb.winner.connectionsScore));
  lines.push(formatRow('  Trainer Score', bb.ourPick.trainerScore, bb.winner.trainerScore));
  lines.push(formatRow('  Jockey Score', bb.ourPick.jockeyScore, bb.winner.jockeyScore));
  lines.push(formatRow('  Partnership Bonus', bb.ourPick.partnershipBonus, bb.winner.partnershipBonus));
  lines.push(formatRow('Trainer Name', bb.ourPick.trainerName.substring(0, 12), bb.winner.trainerName.substring(0, 12)));
  lines.push(formatRow('Jockey Name', bb.ourPick.jockeyName.substring(0, 12), bb.winner.jockeyName.substring(0, 12)));
  lines.push(formatRow('Post Position (12 max)', bb.ourPick.postPositionScore, bb.winner.postPositionScore,
    bb.ourPick.postPositionScore - bb.winner.postPositionScore));
  lines.push(formatRow('Is Golden Post', bb.ourPick.isGoldenPost, bb.winner.isGoldenPost));
  lines.push(formatRow('Odds Score (12 max)', bb.ourPick.oddsScore, bb.winner.oddsScore,
    bb.ourPick.oddsScore - bb.winner.oddsScore));
  lines.push(formatRow('Odds Tier', bb.ourPick.oddsTier, bb.winner.oddsTier));
  lines.push(formatRow('Morning Line', bb.ourPick.morningLineOdds, bb.winner.morningLineOdds));
  lines.push(formatRow('Trainer Patterns (8 max)', bb.ourPick.trainerPatternsScore, bb.winner.trainerPatternsScore));

  // === BIAS CAP ANALYSIS ===
  lines.push(formatSectionHeader('BIAS CAP ANALYSIS'));
  lines.push(formatRow('Raw Bias Score', bb.ourPick.rawBiasScore, bb.winner.rawBiasScore));
  lines.push(formatRow('Capped Bias Score', bb.ourPick.cappedBiasScore, bb.winner.cappedBiasScore));
  lines.push(formatRow('Bias Cap Applied', bb.ourPick.biasCapApplied, bb.winner.biasCapApplied));
  lines.push(formatRow('Bias Reduction', bb.ourPick.biasReduction, bb.winner.biasReduction));

  // === SUPPLEMENTAL SCORES ===
  lines.push(formatSectionHeader('SUPPLEMENTAL SCORES'));
  lines.push(formatRow('Equipment (8 max)', bb.ourPick.equipmentScore, bb.winner.equipmentScore));
  lines.push(formatRow('Has Equip Changes', bb.ourPick.hasEquipmentChanges, bb.winner.hasEquipmentChanges));
  lines.push(formatRow('First-Time Equip', bb.ourPick.firstTimeEquipment.join(',') || 'None',
    bb.winner.firstTimeEquipment.join(',') || 'None'));
  lines.push(formatRow('Dist/Surf (20 max)', bb.ourPick.distanceSurfaceScore, bb.winner.distanceSurfaceScore));
  lines.push(formatRow('  Turf Score', bb.ourPick.turfScore, bb.winner.turfScore));
  lines.push(formatRow('  Wet Score', bb.ourPick.wetScore, bb.winner.wetScore));
  lines.push(formatRow('  Distance Score', bb.ourPick.distanceScore, bb.winner.distanceScore));
  lines.push(formatRow('Track Specialist (10)', bb.ourPick.trackSpecialistScore, bb.winner.trackSpecialistScore));
  lines.push(formatRow('Is Track Specialist', bb.ourPick.isTrackSpecialist, bb.winner.isTrackSpecialist));
  lines.push(formatRow('Combo Patterns (4)', bb.ourPick.comboPatternsScore, bb.winner.comboPatternsScore));
  lines.push(formatRow('Detected Combos', bb.ourPick.detectedCombos.join(',') || 'None',
    bb.winner.detectedCombos.join(',') || 'None'));

  // === DATA QUALITY ===
  lines.push(formatSectionHeader('DATA QUALITY'));
  lines.push(formatRow('Completeness Score', bb.ourPick.dataCompletenessScore, bb.winner.dataCompletenessScore));
  lines.push(formatRow('Completeness Grade', bb.ourPick.dataCompletenessGrade, bb.winner.dataCompletenessGrade));
  lines.push(formatRow('Critical Complete %', bb.ourPick.criticalComplete, bb.winner.criticalComplete));
  lines.push(formatRow('Is Low Confidence', bb.ourPick.isLowConfidence, bb.winner.isLowConfidence));
  lines.push(formatRow('Low Conf Penalty', bb.ourPick.lowConfidencePenaltyApplied, bb.winner.lowConfidencePenaltyApplied));
  lines.push(formatRow('Low Conf Amount', bb.ourPick.lowConfidencePenaltyAmount, bb.winner.lowConfidencePenaltyAmount));

  // === PENALTIES ===
  lines.push(formatSectionHeader('PENALTIES'));
  lines.push(formatRow('Paper Tiger Applied', bb.ourPick.paperTigerPenaltyApplied, bb.winner.paperTigerPenaltyApplied));
  lines.push(formatRow('Paper Tiger Amount', bb.ourPick.paperTigerPenaltyAmount, bb.winner.paperTigerPenaltyAmount));

  // === RAW DATA ===
  lines.push(formatSectionHeader('RAW PERFORMANCE DATA'));
  lines.push(formatRow('Lifetime Starts', bb.ourPick.lifetimeStarts, bb.winner.lifetimeStarts));
  lines.push(formatRow('Lifetime Wins', bb.ourPick.lifetimeWins, bb.winner.lifetimeWins));
  lines.push(formatRow('Lifetime Win %', bb.ourPick.lifetimeWinPct, bb.winner.lifetimeWinPct));
  lines.push(formatRow('Current Yr Starts', bb.ourPick.currentYearStarts, bb.winner.currentYearStarts));
  lines.push(formatRow('Current Yr Wins', bb.ourPick.currentYearWins, bb.winner.currentYearWins));
  lines.push(formatRow('Workout Count', bb.ourPick.workoutCount, bb.winner.workoutCount));
  lines.push(formatRow('Has Bullet Work', bb.ourPick.hasBulletWork, bb.winner.hasBulletWork));

  lines.push(`└${'─'.repeat(32)}┴${'─'.repeat(14)}┴${'─'.repeat(14)}┴${'─'.repeat(10)}┘`);

  return lines.join('\n');
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================================================
// PATTERN ANALYSIS
// ============================================================================

interface PatternAnalysis {
  // Speed-related patterns
  winnerHadBetterSpeed: number;
  winnerSpeedAdvantageAvg: number;
  speedConfidenceMismatch: number;

  // Form-related patterns
  winnerWonLastOut: number;
  winnerWon2OfLast3: number;
  ourPickStaleForm: number;
  formScoreGapAvg: number;

  // Pace-related patterns
  paceFitMismatch: number;
  winnerBetterPaceFit: number;
  paceScoreGapAvg: number;

  // Bias-related patterns
  ourPickBiasCapped: number;
  biasInflatedPicks: number;

  // Data quality patterns
  ourPickLowConfidence: number;
  winnerLowConfidence: number;
  dataQualityGapAvg: number;

  // Equipment/patterns
  winnerFirstTimeEquip: number;
  winnerHadCombos: number;

  // Odds patterns
  winnerWasLongshot: number;
  winnerOddsTier: Record<string, number>;

  // Running style patterns
  winnerRunningStyles: Record<string, number>;
}

function analyzePatterns(badBeats: BadBeatRace[]): PatternAnalysis {
  const analysis: PatternAnalysis = {
    winnerHadBetterSpeed: 0,
    winnerSpeedAdvantageAvg: 0,
    speedConfidenceMismatch: 0,
    winnerWonLastOut: 0,
    winnerWon2OfLast3: 0,
    ourPickStaleForm: 0,
    formScoreGapAvg: 0,
    paceFitMismatch: 0,
    winnerBetterPaceFit: 0,
    paceScoreGapAvg: 0,
    ourPickBiasCapped: 0,
    biasInflatedPicks: 0,
    ourPickLowConfidence: 0,
    winnerLowConfidence: 0,
    dataQualityGapAvg: 0,
    winnerFirstTimeEquip: 0,
    winnerHadCombos: 0,
    winnerWasLongshot: 0,
    winnerOddsTier: {},
    winnerRunningStyles: {},
  };

  if (badBeats.length === 0) return analysis;

  let totalSpeedGap = 0;
  let totalFormGap = 0;
  let totalPaceGap = 0;
  let totalDataGap = 0;

  for (const bb of badBeats) {
    // Speed patterns
    if (bb.winner.speedScore > bb.ourPick.speedScore) {
      analysis.winnerHadBetterSpeed++;
      totalSpeedGap += bb.winner.speedScore - bb.ourPick.speedScore;
    }
    if (bb.ourPick.speedConfidence !== bb.winner.speedConfidence) {
      analysis.speedConfidenceMismatch++;
    }

    // Form patterns
    if (bb.winner.wonLastOut) analysis.winnerWonLastOut++;
    if (bb.winner.won2OfLast3) analysis.winnerWon2OfLast3++;
    if (!bb.ourPick.wonLastOut && !bb.ourPick.won2OfLast3) analysis.ourPickStaleForm++;
    totalFormGap += bb.winner.formScore - bb.ourPick.formScore;

    // Pace patterns
    if (bb.ourPick.paceFit !== bb.winner.paceFit) analysis.paceFitMismatch++;
    if (bb.winner.paceScore > bb.ourPick.paceScore) analysis.winnerBetterPaceFit++;
    totalPaceGap += bb.winner.paceScore - bb.ourPick.paceScore;

    // Bias patterns
    if (bb.ourPick.biasCapApplied) analysis.ourPickBiasCapped++;
    if (bb.ourPick.biasReduction > 10) analysis.biasInflatedPicks++;

    // Data quality patterns
    if (bb.ourPick.isLowConfidence) analysis.ourPickLowConfidence++;
    if (bb.winner.isLowConfidence) analysis.winnerLowConfidence++;
    totalDataGap += bb.winner.dataCompletenessScore - bb.ourPick.dataCompletenessScore;

    // Equipment patterns
    if (bb.winner.firstTimeEquipment.length > 0) analysis.winnerFirstTimeEquip++;
    if (bb.winner.detectedCombos.length > 0) analysis.winnerHadCombos++;

    // Odds patterns
    const winnerOdds = bb.winner.morningLineDecimal ?? 99;
    if (winnerOdds > 10) analysis.winnerWasLongshot++;
    analysis.winnerOddsTier[bb.winner.oddsTier] = (analysis.winnerOddsTier[bb.winner.oddsTier] || 0) + 1;

    // Running style patterns
    analysis.winnerRunningStyles[bb.winner.runningStyle] =
      (analysis.winnerRunningStyles[bb.winner.runningStyle] || 0) + 1;
  }

  analysis.winnerSpeedAdvantageAvg = Math.round(totalSpeedGap / Math.max(1, analysis.winnerHadBetterSpeed));
  analysis.formScoreGapAvg = Math.round(totalFormGap / badBeats.length * 10) / 10;
  analysis.paceScoreGapAvg = Math.round(totalPaceGap / badBeats.length * 10) / 10;
  analysis.dataQualityGapAvg = Math.round(totalDataGap / badBeats.length * 10) / 10;

  return analysis;
}

function formatPatternAnalysis(analysis: PatternAnalysis, totalBadBeats: number): string {
  const lines: string[] = [];
  const sep = '═'.repeat(74);
  const thinSep = '─'.repeat(74);

  const pct = (n: number) => totalBadBeats > 0 ? `${Math.round(n / totalBadBeats * 100)}%` : 'N/A';

  lines.push(`\n${sep}`);
  lines.push('PATTERN ANALYSIS SUMMARY');
  lines.push(sep);

  lines.push('\n### SPEED PATTERNS ###');
  lines.push(`Winner had better Speed Score: ${analysis.winnerHadBetterSpeed}/${totalBadBeats} (${pct(analysis.winnerHadBetterSpeed)})`);
  lines.push(`Average Speed advantage when winner faster: +${analysis.winnerSpeedAdvantageAvg} pts`);
  lines.push(`Speed confidence mismatch (HIGH vs LOW): ${analysis.speedConfidenceMismatch}/${totalBadBeats} (${pct(analysis.speedConfidenceMismatch)})`);

  lines.push('\n### FORM PATTERNS ###');
  lines.push(`Winner Won Last Out: ${analysis.winnerWonLastOut}/${totalBadBeats} (${pct(analysis.winnerWonLastOut)})`);
  lines.push(`Winner Won 2 of Last 3: ${analysis.winnerWon2OfLast3}/${totalBadBeats} (${pct(analysis.winnerWon2OfLast3)})`);
  lines.push(`Our Pick had STALE form (no recent wins): ${analysis.ourPickStaleForm}/${totalBadBeats} (${pct(analysis.ourPickStaleForm)})`);
  lines.push(`Average Form Score gap (winner - ourPick): ${analysis.formScoreGapAvg > 0 ? '+' : ''}${analysis.formScoreGapAvg} pts`);

  lines.push('\n### PACE PATTERNS ###');
  lines.push(`Pace Fit mismatch: ${analysis.paceFitMismatch}/${totalBadBeats} (${pct(analysis.paceFitMismatch)})`);
  lines.push(`Winner had better Pace Score: ${analysis.winnerBetterPaceFit}/${totalBadBeats} (${pct(analysis.winnerBetterPaceFit)})`);
  lines.push(`Average Pace Score gap (winner - ourPick): ${analysis.paceScoreGapAvg > 0 ? '+' : ''}${analysis.paceScoreGapAvg} pts`);

  lines.push('\n### BIAS CAP PATTERNS ###');
  lines.push(`Our Pick had Bias Capped: ${analysis.ourPickBiasCapped}/${totalBadBeats} (${pct(analysis.ourPickBiasCapped)})`);
  lines.push(`Our Pick was Bias-Inflated (>10 pts reduced): ${analysis.biasInflatedPicks}/${totalBadBeats} (${pct(analysis.biasInflatedPicks)})`);

  lines.push('\n### DATA QUALITY PATTERNS ###');
  lines.push(`Our Pick was Low Confidence: ${analysis.ourPickLowConfidence}/${totalBadBeats} (${pct(analysis.ourPickLowConfidence)})`);
  lines.push(`Winner was Low Confidence: ${analysis.winnerLowConfidence}/${totalBadBeats} (${pct(analysis.winnerLowConfidence)})`);
  lines.push(`Average Data Completeness gap: ${analysis.dataQualityGapAvg > 0 ? '+' : ''}${analysis.dataQualityGapAvg} pts`);

  lines.push('\n### EQUIPMENT & COMBO PATTERNS ###');
  lines.push(`Winner had First-Time Equipment: ${analysis.winnerFirstTimeEquip}/${totalBadBeats} (${pct(analysis.winnerFirstTimeEquip)})`);
  lines.push(`Winner had Detected Combos: ${analysis.winnerHadCombos}/${totalBadBeats} (${pct(analysis.winnerHadCombos)})`);

  lines.push('\n### ODDS PATTERNS ###');
  lines.push(`Winner was Longshot (>10-1): ${analysis.winnerWasLongshot}/${totalBadBeats} (${pct(analysis.winnerWasLongshot)})`);
  lines.push('Winner Odds Tier distribution:');
  for (const [tier, count] of Object.entries(analysis.winnerOddsTier).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${tier}: ${count} (${pct(count)})`);
  }

  lines.push('\n### RUNNING STYLE PATTERNS ###');
  lines.push('Winner Running Style distribution:');
  for (const [style, count] of Object.entries(analysis.winnerRunningStyles).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${style}: ${count} (${pct(count)})`);
  }

  lines.push(`\n${thinSep}`);

  // Hypothesis testing
  lines.push('\n### HYPOTHESIS TESTING ###');
  lines.push(thinSep);

  const speedPct = totalBadBeats > 0 ? analysis.winnerHadBetterSpeed / totalBadBeats * 100 : 0;
  const formPct = totalBadBeats > 0 ? analysis.winnerWonLastOut / totalBadBeats * 100 : 0;
  const stalePct = totalBadBeats > 0 ? analysis.ourPickStaleForm / totalBadBeats * 100 : 0;
  const biasPct = totalBadBeats > 0 ? analysis.ourPickBiasCapped / totalBadBeats * 100 : 0;
  const longshotPct = totalBadBeats > 0 ? analysis.winnerWasLongshot / totalBadBeats * 100 : 0;

  lines.push('\nH1: "Speed figures are under-weighted"');
  if (speedPct > 50) {
    lines.push(`   SUPPORTED: Winner had better speed ${analysis.winnerHadBetterSpeed}/${totalBadBeats} (${speedPct.toFixed(1)}%)`);
    lines.push(`   AVG SPEED GAP: +${analysis.winnerSpeedAdvantageAvg} pts when winner was faster`);
  } else {
    lines.push(`   NOT SUPPORTED: Winner had better speed only ${speedPct.toFixed(1)}% of the time`);
  }

  lines.push('\nH2: "Form score is over-weighted (rewarding stale form)"');
  if (stalePct > 40 && analysis.formScoreGapAvg < 0) {
    lines.push(`   SUPPORTED: Our pick had stale form ${stalePct.toFixed(1)}% yet outscored winner on form`);
  } else {
    lines.push(`   NOT SUPPORTED: Form scoring appears balanced`);
  }

  lines.push('\nH3: "Bias (connections/odds) inflating scores"');
  if (biasPct > 30) {
    lines.push(`   SUPPORTED: Our pick was bias-capped ${biasPct.toFixed(1)}% of the time`);
    lines.push(`   IMPLICATION: Bias cap working but may need to be stricter`);
  } else {
    lines.push(`   NOT SUPPORTED: Bias cap rarely triggered`);
  }

  lines.push('\nH4: "Winners are unpredictable longshots"');
  if (longshotPct > 40) {
    lines.push(`   SUPPORTED: ${longshotPct.toFixed(1)}% of winners were >10-1 longshots`);
    lines.push(`   IMPLICATION: May need to identify hidden value plays better`);
  } else {
    lines.push(`   NOT SUPPORTED: Most winners were reasonable prices`);
  }

  lines.push('\nH5: "Recent form (won last out) is under-valued"');
  if (formPct > 40) {
    lines.push(`   SUPPORTED: ${formPct.toFixed(1)}% of winners won last out`);
    lines.push(`   IMPLICATION: Consider increasing wonLastOut bonus`);
  } else {
    lines.push(`   NOT SUPPORTED: Winners don't consistently have recent wins`);
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function runForensicDiagnostic() {
  const output: string[] = [];

  const log = (msg: string) => {
    console.log(msg);
    output.push(msg);
  };

  log('╔══════════════════════════════════════════════════════════════════════════════╗');
  log('║              FORENSIC BAD BEATS DIAGNOSTIC                                   ║');
  log('║              Deep Analysis of Algorithm Misses                               ║');
  log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  log(`Threshold: Base Score >= ${BAD_BEAT_SCORE_THRESHOLD} pts AND Finish >= ${BAD_BEAT_FINISH_THRESHOLD}th\n`);

  // Discover DRF/Results pairs
  const pairs = discoverValidationPairs(DATA_DIR);

  if (pairs.length === 0) {
    log('No DRF files with matching results found in ' + DATA_DIR);
    process.exit(1);
  }

  log(`Found ${pairs.length} DRF file(s) with matching results:\n`);
  for (const pair of pairs) {
    log(`   ${pair.baseName}`);
  }

  // Process each pair for bad beats
  const allBadBeats: BadBeatRace[] = [];
  let totalRaces = 0;

  log('\n' + '═'.repeat(74));
  log('PROCESSING FILES...');
  log('═'.repeat(74));

  for (const pair of pairs) {
    log(`\nProcessing ${pair.baseName}...`);
    const badBeats = processPairForBadBeats(pair);
    allBadBeats.push(...badBeats);

    // Count races
    try {
      const drfContent = fs.readFileSync(pair.drfPath, 'utf-8');
      const parseResult = parseDRFFile(drfContent);
      totalRaces += parseResult.races.length;
    } catch {
      // Ignore
    }
  }

  log(`\n${'═'.repeat(74)}`);
  log(`FOUND ${allBadBeats.length} BAD BEAT(S) OUT OF ${totalRaces} RACES`);
  log(`Bad Beat Rate: ${totalRaces > 0 ? (allBadBeats.length / totalRaces * 100).toFixed(1) : 0}%`);
  log('═'.repeat(74));

  if (allBadBeats.length === 0) {
    log('\nNo Bad Beats found! All 180+ pt picks finished in the money.');
    log('═'.repeat(74));
  } else {
    // Print detailed reports for each bad beat
    for (const bb of allBadBeats) {
      const report = formatBadBeatReport(bb);
      log(report);
    }

    // Pattern analysis
    const patterns = analyzePatterns(allBadBeats);
    const patternReport = formatPatternAnalysis(patterns, allBadBeats.length);
    log(patternReport);
  }

  log(`\n${'═'.repeat(74)}`);
  log(`Forensic analysis completed at: ${new Date().toISOString()}`);
  log('═'.repeat(74) + '\n');

  // Write to file
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, output.join('\n'), 'utf-8');
  console.log(`\nReport saved to: ${OUTPUT_FILE}`);
}

// Run diagnostic
runForensicDiagnostic().catch(console.error);
