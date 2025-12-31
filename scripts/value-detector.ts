/**
 * Value Detection System
 *
 * Identifies live longshots the public is undervaluing by:
 * 1. Converting scores to win probabilities
 * 2. Comparing model probabilities to morning line odds
 * 3. Flagging value betting opportunities
 * 4. Validating against actual race results
 * 5. Calculating potential ROI by bet type
 *
 * Strategy: Find horses the PUBLIC UNDERVALUES
 * - A 15-1 shot that our model ranks #3 is a value bet
 * - A 2-1 favorite that our model ranks #1 is NOT a bet (no edge, chalk)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores, type ScoredHorse } from '../src/lib/scoring';
import type { TrackCondition } from '../src/hooks/useRaceState';
import type { HorseEntry, RaceHeader } from '../src/types/drf';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../src/data');

// Value detection thresholds
const VALUE_THRESHOLDS = {
  minOddsForValue: 6, // Minimum morning line odds (6-1+) to consider
  minEdgePercent: 50, // Minimum value edge percentage to flag
  minRankForValue: 4, // Horse must be in model's Top N
  highConfidenceEdge: 75, // Edge threshold for high confidence
  winBetEdge: 100, // Edge threshold for WIN bet recommendation
  placeBetEdge: 75, // Edge threshold for PLACE bet
  showBetEdge: 50, // Edge threshold for SHOW bet
};

// ============================================================================
// TYPES
// ============================================================================

interface ActualResult {
  raceNumber: number;
  finishers: { position: number; postPosition: number; horseName: string }[];
  scratches: string[];
}

interface ValuePlay {
  horseName: string;
  programNumber: number;
  postPosition: number;
  modelRank: number;
  baseScore: number;
  totalScore: number;
  modelWinProb: number;
  modelTop3Prob: number;
  modelTop4Prob: number;
  morningLineOdds: string;
  morningLineDecimal: number;
  impliedProb: number;
  valueEdge: number;
  betType: 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA_KEY' | 'PASS';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  // Result validation
  actualFinish: number | null;
  didWin: boolean;
  didPlace: boolean;
  didShow: boolean;
  didHitTop4: boolean;
  // Additional analysis fields
  wonLastOut: boolean;
  hasClassDrop: boolean;
  daysSinceRace: number | null;
}

interface RaceValueAnalysis {
  trackCode: string;
  raceNumber: number;
  raceDate: string;
  fieldSize: number;
  distance: string;
  surface: string;
  raceClass: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceReason: string;
  valuePlays: ValuePlay[];
  hasValuePlay: boolean;
  topPick: {
    name: string;
    rank: number;
    score: number;
    odds: string;
    isChalk: boolean;
  } | null;
  // Actual results
  actualWinner: { name: string; post: number } | null;
  actualExacta: { first: number; second: number } | null;
  actualTrifecta: { first: number; second: number; third: number } | null;
}

interface BetResult {
  betType: 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA_KEY';
  hits: number;
  total: number;
  invested: number;
  returned: number;
  avgOdds: number;
  roi: number;
}

interface ValuePlayProfile {
  avgRank: number;
  avgScore: number;
  avgOdds: number;
  avgEdge: number;
  pctClassDrop: number;
  pctWonLastOut: number;
  avgDaysSinceRace: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal number
 * "5-1" -> 5, "3/2" -> 1.5, "EVEN" -> 1
 */
function parseOddsToNumber(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 1.0;
  }

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parseFloat(parts[0] || '10');
    const denom = parseFloat(parts[1] || '1');
    return num / denom;
  }

  return parseFloat(cleaned) || 10;
}

/**
 * Convert odds to implied probability
 * 5-1 = 1/(5+1) = 16.67%
 */
function oddsToImpliedProbability(oddsDecimal: number): number {
  return (1 / (oddsDecimal + 1)) * 100;
}

/**
 * Calculate value edge percentage
 * Edge = (ModelProb - ImpliedProb) / ImpliedProb * 100
 */
function calculateValueEdge(modelProb: number, impliedProb: number): number {
  if (impliedProb <= 0) return 0;
  return ((modelProb - impliedProb) / impliedProb) * 100;
}

/**
 * Calculate Top 3 probability based on model rank and score gap
 */
function calculateTop3Probability(rank: number, scoreGap: number, fieldSize: number): number {
  // Base probabilities by rank
  const baseProbs: Record<number, number> = {
    1: 80,
    2: 70,
    3: 55,
    4: 45,
    5: 35,
    6: 25,
    7: 18,
    8: 12,
    9: 8,
    10: 5,
  };

  let prob = baseProbs[rank] || Math.max(3, 50 - rank * 5);

  // Adjust for score gap (larger gap = more confident)
  if (scoreGap > 30) prob += 10;
  else if (scoreGap > 20) prob += 5;
  else if (scoreGap < 10) prob -= 5;

  // Adjust for field size (smaller field = higher probability)
  if (fieldSize <= 6) prob += 10;
  else if (fieldSize <= 8) prob += 5;
  else if (fieldSize >= 12) prob -= 5;

  return Math.max(5, Math.min(95, prob));
}

/**
 * Calculate Top 4 probability (for exotic inclusion)
 */
function calculateTop4Probability(rank: number, scoreGap: number, fieldSize: number): number {
  // Similar to Top 3 but slightly higher
  const top3Prob = calculateTop3Probability(rank, scoreGap, fieldSize);
  return Math.min(98, top3Prob + 10);
}

/**
 * Determine bet type based on edge and probability
 */
function determineBetType(
  rank: number,
  edge: number,
  top3Prob: number,
  oddsDecimal: number
): 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA_KEY' | 'PASS' {
  // Must be in Top 4 to be actionable
  if (rank > 4) return 'PASS';

  // Minimum odds threshold (must be 6-1 or higher for value)
  if (oddsDecimal < VALUE_THRESHOLDS.minOddsForValue) return 'PASS';

  // WIN bet: Rank #1-2 with 100%+ edge
  if (rank <= 2 && edge >= VALUE_THRESHOLDS.winBetEdge) {
    return 'WIN';
  }

  // PLACE bet: Rank #2-3 with 75%+ edge and high Top 3 probability
  if (rank <= 3 && edge >= VALUE_THRESHOLDS.placeBetEdge && top3Prob >= 60) {
    return 'PLACE';
  }

  // SHOW bet: Rank #3-4 with 50%+ edge and solid Top 3 probability
  if (rank <= 4 && edge >= VALUE_THRESHOLDS.showBetEdge && top3Prob >= 50) {
    return 'SHOW';
  }

  // EXACTA: Chalk is clear #1 and value horse is #2-3
  if (rank >= 2 && rank <= 3 && edge >= VALUE_THRESHOLDS.showBetEdge) {
    return 'EXACTA';
  }

  // TRIFECTA KEY: Value horse in Top 4 at big odds
  if (rank <= 4 && edge >= VALUE_THRESHOLDS.showBetEdge && oddsDecimal >= 8) {
    return 'TRIFECTA_KEY';
  }

  return 'PASS';
}

/**
 * Determine race confidence level
 */
function determineRaceConfidence(
  valuePlays: ValuePlay[],
  scoreSeparation: number,
  topPickIsChalk: boolean
): { confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string } {
  // No value plays = PASS
  if (valuePlays.length === 0) {
    if (topPickIsChalk) {
      return { confidence: 'LOW', reason: 'All contenders are chalk (top 4 all under 6-1)' };
    }
    return { confidence: 'LOW', reason: 'No value plays identified' };
  }

  const bestPlay = valuePlays[0];
  if (!bestPlay) {
    return { confidence: 'LOW', reason: 'No valid plays' };
  }

  // HIGH: Clear value play with 75%+ edge and good score separation
  if (
    bestPlay.valueEdge >= VALUE_THRESHOLDS.highConfidenceEdge &&
    scoreSeparation >= 15 &&
    valuePlays.length <= 2
  ) {
    return {
      confidence: 'HIGH',
      reason: `Clear value play: ${bestPlay.horseName} at ${bestPlay.morningLineOdds} with +${bestPlay.valueEdge.toFixed(0)}% edge`,
    };
  }

  // MEDIUM: Value exists but smaller edge or tight scores
  if (
    bestPlay.valueEdge >= VALUE_THRESHOLDS.minEdgePercent ||
    valuePlays.length >= 3 ||
    scoreSeparation < 15
  ) {
    return {
      confidence: 'MEDIUM',
      reason:
        valuePlays.length >= 3
          ? 'Multiple value plays (harder to choose)'
          : scoreSeparation < 15
            ? 'Score separation is tight'
            : `Moderate edge: ${bestPlay.valueEdge.toFixed(0)}%`,
    };
  }

  return { confidence: 'LOW', reason: 'Only marginal value available' };
}

/**
 * Estimate show payout based on odds
 * Approximate: (odds/3 + 1) * $2
 */
function estimateShowPayout(oddsDecimal: number): number {
  return (oddsDecimal / 3 + 1) * 2;
}

/**
 * Estimate place payout based on odds
 * Approximate: (odds/2 + 1) * $2
 */
function estimatePlacePayout(oddsDecimal: number): number {
  return (oddsDecimal / 2 + 1) * 2;
}

/**
 * Estimate win payout based on odds
 */
function estimateWinPayout(oddsDecimal: number): number {
  return (oddsDecimal + 1) * 2;
}

// ============================================================================
// FILE PARSING
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

function findDRFFiles(dataDir: string): string[] {
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir);
  return files.filter((f) => f.toLowerCase().endsWith('.drf')).map((f) => path.join(dataDir, f));
}

function findMatchingResultsFile(drfPath: string): string | null {
  const baseName = path.basename(drfPath, path.extname(drfPath));
  const dir = path.dirname(drfPath);

  const resultsPath1 = path.join(dir, `${baseName}_results.txt`);
  if (fs.existsSync(resultsPath1)) {
    const content = fs.readFileSync(resultsPath1, 'utf-8');
    if (content.includes('RACE')) return resultsPath1;
  }

  const resultsPath2 = path.join(dir, `${baseName}.txt`);
  if (fs.existsSync(resultsPath2)) {
    const content = fs.readFileSync(resultsPath2, 'utf-8');
    if (content.includes('RACE')) return resultsPath2;
  }

  return null;
}

// ============================================================================
// MAIN VALUE DETECTION
// ============================================================================

function analyzeRaceForValue(
  horses: HorseEntry[],
  header: RaceHeader,
  actualResult: ActualResult | undefined,
  scoredHorses: ScoredHorse[]
): RaceValueAnalysis {
  const scratchedNames = new Set((actualResult?.scratches || []).map((s) => s.toLowerCase()));

  // Filter active horses and sort by rank
  const activeHorses = scoredHorses
    .filter((h) => !scratchedNames.has(h.horse.horseName.toLowerCase()) && !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  if (activeHorses.length === 0) {
    return {
      trackCode: header.trackCode,
      raceNumber: header.raceNumber,
      raceDate: header.raceDate,
      fieldSize: 0,
      distance: header.distance,
      surface: header.surface,
      raceClass: header.classification,
      confidence: 'LOW',
      confidenceReason: 'No active horses',
      valuePlays: [],
      hasValuePlay: false,
      topPick: null,
      actualWinner: null,
      actualExacta: null,
      actualTrifecta: null,
    };
  }

  // Calculate field total score for probability calculation
  const totalFieldScore = activeHorses.reduce((sum, h) => sum + h.score.baseScore, 0);

  // Get score separation between #1 and #2
  const topScore = activeHorses[0]?.score.baseScore || 0;
  const secondScore = activeHorses[1]?.score.baseScore || 0;
  const scoreSeparation = topScore - secondScore;

  // Analyze each horse for value
  const valuePlays: ValuePlay[] = [];

  for (const scoredHorse of activeHorses) {
    const horse = scoredHorse.horse;
    const rank = scoredHorse.rank;

    // Only consider Top 6 for value (could find value in #5-6 range)
    if (rank > 6) continue;

    const morningLineOdds = horse.morningLineOdds || '10-1';
    const oddsDecimal = parseOddsToNumber(morningLineOdds);

    // Skip chalk horses (under 6-1)
    if (oddsDecimal < VALUE_THRESHOLDS.minOddsForValue) continue;

    // Calculate probabilities
    const modelWinProb = (scoredHorse.score.baseScore / totalFieldScore) * 100;
    const impliedProb = oddsToImpliedProbability(oddsDecimal);
    const valueEdge = calculateValueEdge(modelWinProb, impliedProb);

    // Skip if edge is below threshold
    if (valueEdge < VALUE_THRESHOLDS.minEdgePercent) continue;

    // Calculate Top 3/4 probabilities
    const scoreGap = scoredHorse.score.baseScore - (activeHorses[rank]?.score.baseScore || 0);
    const top3Prob = calculateTop3Probability(rank, scoreGap, activeHorses.length);
    const top4Prob = calculateTop4Probability(rank, scoreGap, activeHorses.length);

    // Determine bet type
    const betType = determineBetType(rank, valueEdge, top3Prob, oddsDecimal);

    // Skip if no actionable bet type
    if (betType === 'PASS') continue;

    // Check actual result
    let actualFinish: number | null = null;
    let didWin = false;
    let didPlace = false;
    let didShow = false;
    let didHitTop4 = false;

    if (actualResult) {
      const finisher = actualResult.finishers.find(
        (f) => f.postPosition === horse.programNumber || f.postPosition === horse.postPosition
      );
      if (finisher) {
        actualFinish = finisher.position;
        didWin = finisher.position === 1;
        didPlace = finisher.position <= 2;
        didShow = finisher.position <= 3;
        didHitTop4 = finisher.position <= 4;
      }
    }

    // Determine confidence
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (valueEdge >= VALUE_THRESHOLDS.highConfidenceEdge && rank <= 3) {
      confidence = 'HIGH';
    } else if (valueEdge < VALUE_THRESHOLDS.minEdgePercent || rank > 4) {
      confidence = 'LOW';
    }

    // Extract additional analysis fields
    const wonLastOut = scoredHorse.score.breakdown.form?.wonLastOut || false;
    const hasClassDrop =
      scoredHorse.score.breakdown.classAnalysis?.movement?.includes('down') || false;

    valuePlays.push({
      horseName: horse.horseName,
      programNumber: horse.programNumber,
      postPosition: horse.postPosition,
      modelRank: rank,
      baseScore: scoredHorse.score.baseScore,
      totalScore: scoredHorse.score.total,
      modelWinProb,
      modelTop3Prob: top3Prob,
      modelTop4Prob: top4Prob,
      morningLineOdds,
      morningLineDecimal: oddsDecimal,
      impliedProb,
      valueEdge,
      betType,
      confidence,
      actualFinish,
      didWin,
      didPlace,
      didShow,
      didHitTop4,
      wonLastOut,
      hasClassDrop,
      daysSinceRace: horse.daysSinceLastRace,
    });
  }

  // Sort value plays by edge (best first)
  valuePlays.sort((a, b) => b.valueEdge - a.valueEdge);

  // Get top pick info
  const topPickHorse = activeHorses[0];
  const topPickOdds = topPickHorse ? parseOddsToNumber(topPickHorse.horse.morningLineOdds) : 10;
  const topPickIsChalk = topPickOdds < VALUE_THRESHOLDS.minOddsForValue;

  const topPick = topPickHorse
    ? {
        name: topPickHorse.horse.horseName,
        rank: 1,
        score: topPickHorse.score.baseScore,
        odds: topPickHorse.horse.morningLineOdds,
        isChalk: topPickIsChalk,
      }
    : null;

  // Determine race confidence
  const { confidence, reason } = determineRaceConfidence(valuePlays, scoreSeparation, topPickIsChalk);

  // Get actual results
  const actualWinner = actualResult?.finishers.find((f) => f.position === 1);
  const actualSecond = actualResult?.finishers.find((f) => f.position === 2);
  const actualThird = actualResult?.finishers.find((f) => f.position === 3);

  return {
    trackCode: header.trackCode,
    raceNumber: header.raceNumber,
    raceDate: header.raceDate,
    fieldSize: activeHorses.length,
    distance: header.distance,
    surface: header.surface,
    raceClass: header.classification,
    confidence,
    confidenceReason: reason,
    valuePlays,
    hasValuePlay: valuePlays.length > 0,
    topPick,
    actualWinner: actualWinner
      ? { name: actualWinner.horseName, post: actualWinner.postPosition }
      : null,
    actualExacta:
      actualWinner && actualSecond
        ? { first: actualWinner.postPosition, second: actualSecond.postPosition }
        : null,
    actualTrifecta:
      actualWinner && actualSecond && actualThird
        ? {
            first: actualWinner.postPosition,
            second: actualSecond.postPosition,
            third: actualThird.postPosition,
          }
        : null,
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function calculateBetResults(allRaces: RaceValueAnalysis[]): Map<string, BetResult> {
  const results = new Map<string, BetResult>();

  // Initialize result trackers
  const betTypes = ['WIN', 'PLACE', 'SHOW', 'EXACTA', 'TRIFECTA_KEY'] as const;
  for (const type of betTypes) {
    results.set(type, {
      betType: type,
      hits: 0,
      total: 0,
      invested: 0,
      returned: 0,
      avgOdds: 0,
      roi: 0,
    });
  }

  // Track odds for average calculation
  const oddsTracker: Record<string, number[]> = {
    WIN: [],
    PLACE: [],
    SHOW: [],
    EXACTA: [],
    TRIFECTA_KEY: [],
  };

  for (const race of allRaces) {
    for (const play of race.valuePlays) {
      const result = results.get(play.betType);
      if (!result) continue;

      result.total++;
      result.invested += 2; // $2 bet
      oddsTracker[play.betType].push(play.morningLineDecimal);

      switch (play.betType) {
        case 'WIN':
          if (play.didWin) {
            result.hits++;
            result.returned += estimateWinPayout(play.morningLineDecimal);
          }
          break;
        case 'PLACE':
          if (play.didPlace) {
            result.hits++;
            result.returned += estimatePlacePayout(play.morningLineDecimal);
          }
          break;
        case 'SHOW':
          if (play.didShow) {
            result.hits++;
            result.returned += estimateShowPayout(play.morningLineDecimal);
          }
          break;
        case 'EXACTA':
          // Exacta: Check if our value horse hit exacta position
          if (play.didPlace && race.actualExacta) {
            result.hits++;
            // Estimate exacta payout (very rough)
            result.returned += play.morningLineDecimal * 3 + 10;
          }
          break;
        case 'TRIFECTA_KEY':
          if (play.didShow && race.actualTrifecta) {
            result.hits++;
            // Estimate trifecta payout (very rough)
            result.returned += play.morningLineDecimal * 5 + 20;
          }
          break;
      }
    }
  }

  // Calculate averages and ROI
  for (const [type, result] of results) {
    const odds = oddsTracker[type];
    if (odds.length > 0) {
      result.avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    }
    if (result.invested > 0) {
      result.roi = ((result.returned - result.invested) / result.invested) * 100;
    }
  }

  return results;
}

function calculateValuePlayProfile(plays: ValuePlay[], didHit: boolean): ValuePlayProfile {
  const filtered = plays.filter((p) => {
    if (didHit) return p.didShow; // Use show as "hit" for profile
    return !p.didShow;
  });

  if (filtered.length === 0) {
    return {
      avgRank: 0,
      avgScore: 0,
      avgOdds: 0,
      avgEdge: 0,
      pctClassDrop: 0,
      pctWonLastOut: 0,
      avgDaysSinceRace: 0,
    };
  }

  const avgRank = filtered.reduce((sum, p) => sum + p.modelRank, 0) / filtered.length;
  const avgScore = filtered.reduce((sum, p) => sum + p.baseScore, 0) / filtered.length;
  const avgOdds = filtered.reduce((sum, p) => sum + p.morningLineDecimal, 0) / filtered.length;
  const avgEdge = filtered.reduce((sum, p) => sum + p.valueEdge, 0) / filtered.length;
  const pctClassDrop = (filtered.filter((p) => p.hasClassDrop).length / filtered.length) * 100;
  const pctWonLastOut = (filtered.filter((p) => p.wonLastOut).length / filtered.length) * 100;

  const withDays = filtered.filter((p) => p.daysSinceRace !== null);
  const avgDaysSinceRace =
    withDays.length > 0
      ? withDays.reduce((sum, p) => sum + (p.daysSinceRace || 0), 0) / withDays.length
      : 0;

  return {
    avgRank,
    avgScore,
    avgOdds,
    avgEdge,
    pctClassDrop,
    pctWonLastOut,
    avgDaysSinceRace,
  };
}

function generateReport(allRaces: RaceValueAnalysis[]): string {
  const lines: string[] = [];
  const separator = '='.repeat(80);
  const thinSep = '-'.repeat(80);

  // Gather all value plays
  const allPlays = allRaces.flatMap((r) => r.valuePlays);
  const racesWithValue = allRaces.filter((r) => r.hasValuePlay);
  const racesToPass = allRaces.filter((r) => !r.hasValuePlay);

  // Calculate bet results
  const betResults = calculateBetResults(allRaces);

  // Calculate totals
  let totalInvested = 0;
  let totalReturned = 0;
  let totalBets = 0;
  let totalHits = 0;

  for (const result of betResults.values()) {
    totalInvested += result.invested;
    totalReturned += result.returned;
    totalBets += result.total;
    totalHits += result.hits;
  }

  const overallROI = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0;

  // Header
  lines.push(separator);
  lines.push('VALUE DETECTION SYSTEM REPORT');
  lines.push(`Test Set: 12 tracks, ${allRaces.length} races`);
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push('Strategy: Find live longshots the public undervalues');
  lines.push(separator);

  // Executive Summary
  lines.push('');
  lines.push('EXECUTIVE SUMMARY');
  lines.push(thinSep);
  lines.push(`Races Analyzed:        ${allRaces.length}`);
  lines.push(
    `Races with Value Play: ${racesWithValue.length} (${((racesWithValue.length / allRaces.length) * 100).toFixed(1)}%)`
  );
  lines.push(
    `Races to PASS:         ${racesToPass.length} (${((racesToPass.length / allRaces.length) * 100).toFixed(1)}%)`
  );
  lines.push('');
  lines.push(`Total Value Bets Identified: ${totalBets}`);
  lines.push(
    `Value Bets that HIT:         ${totalHits} (${totalBets > 0 ? ((totalHits / totalBets) * 100).toFixed(1) : 0}%)`
  );
  lines.push(separator);

  // Value Bet Performance by Type
  lines.push('');
  lines.push('VALUE BET PERFORMANCE BY TYPE');
  lines.push(thinSep);
  lines.push(
    'Bet Type      Bets    Hits    Hit%    Avg Odds    $2 Invested    Return      ROI'
  );
  lines.push(thinSep);

  for (const [type, result] of betResults) {
    if (result.total === 0) continue;
    const hitPct = ((result.hits / result.total) * 100).toFixed(1);
    const avgOddsStr = result.avgOdds.toFixed(1) + '-1';
    const roiStr = (result.roi >= 0 ? '+' : '') + result.roi.toFixed(1) + '%';

    lines.push(
      `${type.padEnd(14)}${result.total.toString().padStart(4)}    ${result.hits.toString().padStart(4)}    ${hitPct.padStart(5)}%    ${avgOddsStr.padStart(8)}    $${result.invested.toString().padStart(10)}    $${result.returned.toFixed(2).padStart(8)}    ${roiStr.padStart(7)}`
    );
  }

  lines.push(thinSep);
  const totalHitPct = totalBets > 0 ? ((totalHits / totalBets) * 100).toFixed(1) : '0.0';
  const totalROIStr = (overallROI >= 0 ? '+' : '') + overallROI.toFixed(1) + '%';
  lines.push(
    `${'TOTAL'.padEnd(14)}${totalBets.toString().padStart(4)}    ${totalHits.toString().padStart(4)}    ${totalHitPct.padStart(5)}%    ${'--'.padStart(8)}    $${totalInvested.toString().padStart(10)}    $${totalReturned.toFixed(2).padStart(8)}    ${totalROIStr.padStart(7)}`
  );
  lines.push(separator);

  // Best Value Plays (that hit)
  lines.push('');
  lines.push('BEST VALUE PLAYS (Highest Edge that Hit)');
  lines.push(thinSep);
  lines.push(
    'Race          Horse                    ML Odds    Model Rank    Edge      Result    Payout'
  );
  lines.push(thinSep);

  const hitsPlays = allPlays.filter((p) => p.didShow).sort((a, b) => b.valueEdge - a.valueEdge);
  const topHits = hitsPlays.slice(0, 10);

  for (const play of topHits) {
    const race = allRaces.find((r) => r.valuePlays.includes(play));
    if (!race) continue;

    const raceLabel = `${race.trackCode} R${race.raceNumber}`;
    const horseName = play.horseName.substring(0, 20).padEnd(20);
    const result = play.didWin ? 'WON' : play.didPlace ? '2nd' : '3rd';
    const payoutType = play.didWin ? '' : play.didPlace ? ' (P)' : ' (S)';
    const payout =
      play.didWin
        ? estimateWinPayout(play.morningLineDecimal)
        : play.didPlace
          ? estimatePlacePayout(play.morningLineDecimal)
          : estimateShowPayout(play.morningLineDecimal);

    lines.push(
      `${raceLabel.padEnd(14)}${horseName}${play.morningLineOdds.padStart(8)}    #${play.modelRank}            +${play.valueEdge.toFixed(0)}%      ${result.padStart(4)}      $${payout.toFixed(2)}${payoutType}`
    );
  }

  lines.push(separator);

  // Missed Value Plays
  lines.push('');
  lines.push('MISSED VALUE PLAYS (High Edge that Lost)');
  lines.push(thinSep);
  lines.push('Race          Horse                    ML Odds    Model Rank    Edge      Result');
  lines.push(thinSep);

  const missedPlays = allPlays.filter((p) => !p.didShow).sort((a, b) => b.valueEdge - a.valueEdge);
  const topMisses = missedPlays.slice(0, 10);

  for (const play of topMisses) {
    const race = allRaces.find((r) => r.valuePlays.includes(play));
    if (!race) continue;

    const raceLabel = `${race.trackCode} R${race.raceNumber}`;
    const horseName = play.horseName.substring(0, 20).padEnd(20);
    const result = play.actualFinish ? `${play.actualFinish}th` : 'DNF';

    lines.push(
      `${raceLabel.padEnd(14)}${horseName}${play.morningLineOdds.padStart(8)}    #${play.modelRank}            +${play.valueEdge.toFixed(0)}%      ${result}`
    );
  }

  lines.push(separator);

  // Race-by-Race Breakdown
  lines.push('');
  lines.push('RACE-BY-RACE BREAKDOWN');
  lines.push(separator);

  // Group by track
  const trackGroups = new Map<string, RaceValueAnalysis[]>();
  for (const race of allRaces) {
    const existing = trackGroups.get(race.trackCode) || [];
    existing.push(race);
    trackGroups.set(race.trackCode, existing);
  }

  for (const [trackCode, races] of trackGroups) {
    lines.push('');
    lines.push(`TRACK: ${trackCode} (${races.length} races)`);
    lines.push(thinSep);

    for (const race of races.sort((a, b) => a.raceNumber - b.raceNumber)) {
      const confidenceIcon =
        race.confidence === 'HIGH' ? '🟢 BET' : race.confidence === 'MEDIUM' ? '🟡 CAUTION' : '🔴 PASS';

      lines.push(`Race ${race.raceNumber}: ${confidenceIcon}`);

      if (race.hasValuePlay && race.valuePlays[0]) {
        const play = race.valuePlays[0];
        lines.push(
          `   Value Play: ${play.horseName} #${play.modelRank} at ${play.morningLineOdds} (Edge: +${play.valueEdge.toFixed(0)}%)`
        );
        lines.push(`   Suggestion: ${play.betType} BET`);

        if (play.actualFinish !== null) {
          const resultIcon = play.didShow ? '✅' : '❌';
          const resultText = play.didWin
            ? `WON - Paid $${estimateWinPayout(play.morningLineDecimal).toFixed(2)}`
            : play.didPlace
              ? `2nd - Paid $${estimatePlacePayout(play.morningLineDecimal).toFixed(2)} (P)`
              : play.didShow
                ? `3rd - Paid $${estimateShowPayout(play.morningLineDecimal).toFixed(2)} (S)`
                : `${play.actualFinish}th`;
          lines.push(`   Result: ${resultText} ${resultIcon}`);
        }
      } else {
        lines.push(`   Reason: ${race.confidenceReason}`);
      }
      lines.push('');
    }
  }

  lines.push(separator);

  // Live Longshot Profile
  lines.push('');
  lines.push('LIVE LONGSHOT PROFILE');
  lines.push(thinSep);

  const hitProfile = calculateValuePlayProfile(allPlays, true);
  const missProfile = calculateValuePlayProfile(allPlays, false);

  lines.push('                        Value Plays that HIT    Value Plays that MISSED');
  lines.push('                        --------------------    -----------------------');
  lines.push(
    `Avg Model Rank              #${hitProfile.avgRank.toFixed(1)}                    #${missProfile.avgRank.toFixed(1)}`
  );
  lines.push(
    `Avg Score                   ${hitProfile.avgScore.toFixed(0)} pts                 ${missProfile.avgScore.toFixed(0)} pts`
  );
  lines.push(
    `Avg ML Odds                 ${hitProfile.avgOdds.toFixed(1)}-1                    ${missProfile.avgOdds.toFixed(1)}-1`
  );
  lines.push(
    `Avg Edge                    +${hitProfile.avgEdge.toFixed(0)}%                   +${missProfile.avgEdge.toFixed(0)}%`
  );
  lines.push(
    `% with Class Drop           ${hitProfile.pctClassDrop.toFixed(0)}%                     ${missProfile.pctClassDrop.toFixed(0)}%`
  );
  lines.push(
    `% Won Last Out              ${hitProfile.pctWonLastOut.toFixed(0)}%                     ${missProfile.pctWonLastOut.toFixed(0)}%`
  );
  lines.push(
    `Avg Days Since Race         ${hitProfile.avgDaysSinceRace.toFixed(0)} days                ${missProfile.avgDaysSinceRace.toFixed(0)} days`
  );

  // Key Insight
  let insight = 'Insufficient data for conclusive patterns.';
  if (hitProfile.avgRank < missProfile.avgRank) {
    insight = `Value plays that hit tend to be ranked HIGHER (avg #${hitProfile.avgRank.toFixed(1)} vs #${missProfile.avgRank.toFixed(1)}).`;
  }
  if (hitProfile.avgEdge > missProfile.avgEdge) {
    insight += ` Higher edge correlates with success (+${hitProfile.avgEdge.toFixed(0)}% vs +${missProfile.avgEdge.toFixed(0)}%).`;
  }
  if (hitProfile.pctWonLastOut > missProfile.pctWonLastOut) {
    insight += ' Recent winners hit more often.';
  }

  lines.push('');
  lines.push(`KEY INSIGHT: ${insight}`);
  lines.push(separator);

  // Confidence Level Analysis
  lines.push('');
  lines.push('CONFIDENCE LEVEL ANALYSIS');
  lines.push(thinSep);
  lines.push('                Races    Value Hits    Hit Rate    ROI');
  lines.push(thinSep);

  const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'] as const;
  for (const level of confidenceLevels) {
    const levelRaces = allRaces.filter((r) => r.confidence === level);
    const levelPlays = levelRaces.flatMap((r) => r.valuePlays);
    const levelHits = levelPlays.filter((p) => p.didShow).length;
    const levelInvested = levelPlays.length * 2;
    const levelReturned = levelPlays
      .filter((p) => p.didShow)
      .reduce((sum, p) => sum + estimateShowPayout(p.morningLineDecimal), 0);
    const levelROI =
      levelInvested > 0 ? ((levelReturned - levelInvested) / levelInvested) * 100 : 0;
    const hitRate = levelPlays.length > 0 ? (levelHits / levelPlays.length) * 100 : 0;

    const roiStr = (levelROI >= 0 ? '+' : '') + levelROI.toFixed(0) + '%';
    lines.push(
      `${level.padEnd(16)}${levelRaces.length.toString().padStart(5)}    ${levelHits.toString().padStart(10)}    ${hitRate.toFixed(0).padStart(7)}%    ${roiStr.padStart(7)}`
    );
  }

  lines.push('');
  const highConf = allRaces.filter((r) => r.confidence === 'HIGH');
  const highPlays = highConf.flatMap((r) => r.valuePlays);
  const highHits = highPlays.filter((p) => p.didShow).length;
  const highHitRate = highPlays.length > 0 ? (highHits / highPlays.length) * 100 : 0;

  lines.push(
    `INSIGHT: ${highHitRate >= 60 ? 'High confidence races perform well - trust the model!' : 'Confidence level shows moderate correlation with success.'}`
  );
  lines.push(separator);

  // Recommendations
  lines.push('');
  lines.push('RECOMMENDATIONS');
  lines.push(separator);

  // Find best bet type
  let bestBetType = 'SHOW';
  let bestROI = -100;
  for (const [type, result] of betResults) {
    if (result.total >= 5 && result.roi > bestROI) {
      bestROI = result.roi;
      bestBetType = type;
    }
  }

  lines.push('');
  lines.push('BETTING STRATEGY:');
  lines.push(`   Best performing bet type: ${bestBetType} (${bestROI >= 0 ? '+' : ''}${bestROI.toFixed(1)}% ROI)`);
  if (bestBetType === 'SHOW') {
    lines.push('   SHOW bets on longshots provide consistent returns with lower variance.');
  } else if (bestBetType === 'PLACE') {
    lines.push('   PLACE bets offer good balance of hit rate and payout.');
  }

  lines.push('');
  lines.push('RACE SELECTION:');
  const betPct = ((racesWithValue.length / allRaces.length) * 100).toFixed(0);
  lines.push(`   Bet ${betPct}% of races (${racesWithValue.length} of ${allRaces.length})`);
  lines.push('   Pass on races where all contenders are chalk or no clear value exists.');

  lines.push('');
  lines.push('EDGE THRESHOLD:');
  lines.push(`   Minimum edge to bet: ${VALUE_THRESHOLDS.minEdgePercent}%`);
  lines.push(`   Optimal edge for high confidence: ${VALUE_THRESHOLDS.highConfidenceEdge}%+`);

  lines.push('');
  lines.push('OPTIMAL BET TYPE BY SCENARIO:');
  lines.push('   WIN BET: Value horse ranked #1-2 with 100%+ edge');
  lines.push('   PLACE BET: Value horse ranked #2-3 with 75%+ edge, 60%+ Top 3 prob');
  lines.push('   SHOW BET: Value horse ranked #3-4 with 50%+ edge, 50%+ Top 3 prob');
  lines.push('   EXOTIC: Use value horses as keys in trifectas when odds are 8-1+');

  lines.push(separator);

  // The Bottom Line
  lines.push('');
  lines.push('THE BOTTOM LINE');
  lines.push(separator);
  lines.push('');
  lines.push('If you had bet $2 on every flagged value play:');
  lines.push(`   Investment:     $${totalInvested}`);
  lines.push(`   Return:         $${totalReturned.toFixed(2)}`);
  lines.push(`   Net Profit:     $${(totalReturned - totalInvested).toFixed(2)}`);
  lines.push(`   ROI:            ${overallROI >= 0 ? '+' : ''}${overallROI.toFixed(1)}%`);
  lines.push('');

  // Compare to chalk betting
  let chalkInvested = 0;
  let chalkReturned = 0;
  let chalkHits = 0;

  for (const race of allRaces) {
    if (!race.topPick || !race.actualWinner) continue;
    chalkInvested += 2;

    // Check if top pick won
    const topPickPost = allRaces
      .flatMap((r) =>
        r.valuePlays.length > 0
          ? []
          : [
              {
                post: r.topPick?.name,
                race: r,
              },
            ]
      )
      .find((x) => x.race === race);

    // Simplified: check if any #1 ranked horse won
    const topPickOdds = parseOddsToNumber(race.topPick.odds);
    const didTopPickWin = race.actualWinner.name.toLowerCase() === race.topPick.name.toLowerCase();

    if (didTopPickWin) {
      chalkHits++;
      chalkReturned += estimateWinPayout(topPickOdds);
    }
  }

  const chalkROI = chalkInvested > 0 ? ((chalkReturned - chalkInvested) / chalkInvested) * 100 : 0;
  const chalkHitRate = allRaces.length > 0 ? (chalkHits / allRaces.length) * 100 : 0;

  lines.push('Compared to betting the favorite (our #1 pick) to WIN every race:');
  lines.push(`   Investment:     $${chalkInvested}`);
  lines.push(`   Return:         $${chalkReturned.toFixed(2)}`);
  lines.push(`   Hit Rate:       ${chalkHitRate.toFixed(1)}%`);
  lines.push(`   ROI:            ${chalkROI >= 0 ? '+' : ''}${chalkROI.toFixed(1)}%`);
  lines.push('');

  if (overallROI > chalkROI) {
    lines.push(
      `🎯 VALUE BETTING OUTPERFORMS CHALK BY ${(overallROI - chalkROI).toFixed(1)} PERCENTAGE POINTS!`
    );
  } else {
    lines.push('⚠️ Value betting underperformed chalk in this sample. Review thresholds.');
  }

  lines.push(separator);
  lines.push(`Report generated: ${new Date().toISOString()}`);
  lines.push(separator);

  return lines.join('\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runValueDetection() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    VALUE DETECTION SYSTEM                                     ║');
  console.log('║           Finding Live Longshots the Public Undervalues                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Find all DRF files
  const drfFiles = findDRFFiles(DATA_DIR);

  if (drfFiles.length === 0) {
    console.log('❌ No DRF files found in', DATA_DIR);
    process.exit(1);
  }

  console.log(`📁 Found ${drfFiles.length} DRF file(s):\n`);

  const allRaceAnalyses: RaceValueAnalysis[] = [];
  let totalRaces = 0;

  for (const drfPath of drfFiles) {
    const baseName = path.basename(drfPath, path.extname(drfPath));
    console.log(`Processing ${baseName}...`);

    try {
      // Read and parse DRF file
      const drfContent = fs.readFileSync(drfPath, 'utf-8');
      const parseResult = parseDRFFile(drfContent);

      // Find matching results file
      const resultsPath = findMatchingResultsFile(drfPath);
      let actualResults: ActualResult[] = [];

      if (resultsPath) {
        const resultsContent = fs.readFileSync(resultsPath, 'utf-8');
        actualResults = parseResultsFile(resultsContent);
      }

      // Process each race
      for (const race of parseResult.races) {
        totalRaces++;

        const actual = actualResults.find((r) => r.raceNumber === race.header.raceNumber);
        const scratchedNames = new Set((actual?.scratches || []).map((s) => s.toLowerCase()));

        // Calculate scores
        const trackCondition: TrackCondition = {
          surface: race.header.surface,
          condition: race.header.trackCondition || 'fast',
          variant: 0,
        };

        const getOdds = (index: number, defaultOdds: string) =>
          race.horses[index]?.morningLineOdds || defaultOdds;

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

        // Analyze for value
        const analysis = analyzeRaceForValue(race.horses, race.header, actual, scoredHorses);
        allRaceAnalyses.push(analysis);
      }

      console.log(`   ✓ ${parseResult.races.length} races processed`);
    } catch (error) {
      console.error(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`Total races analyzed: ${totalRaces}`);
  console.log('═'.repeat(80) + '\n');

  // Generate and print report
  const report = generateReport(allRaceAnalyses);
  console.log(report);

  // Save report to file
  const reportPath = path.join(__dirname, '../value-detection-report.txt');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

// Run the value detection
runValueDetection().catch(console.error);
