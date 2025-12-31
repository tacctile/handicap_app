/**
 * Winner Rank Diagnostic Script
 *
 * Analyzes where actual winners rank in our scoring projections
 * to identify patterns in our algorithm's blind spots.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import type { TrackCondition } from '../src/hooks/useRaceState';
import type { HorseEntry, RaceHeader } from '../src/types/drf';
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

interface WinnerData {
  raceId: string;
  winnerRank: number;
  winnerScore: number;
  // Data completeness
  ppCount: number;
  speedFigCount: number;
  // Recency
  daysSinceLastRace: number | null;
  // Form
  wonLastOut: boolean;
  won2OfLast3: boolean;
  lastFinishPosition: number | null;
  // Intent signals
  isClassDrop: boolean;
  hasEquipmentChange: boolean;
  hasJockeySwitch: boolean;
  // Odds
  morningLineOdds: number;
  wasMLFavorite: boolean;
}

// ============================================================================
// PARSE ACTUAL RESULTS FILE (reused from run-bulk-validation.ts)
// ============================================================================

function parseResultsFile(content: string): ActualResult[] {
  const results: ActualResult[] = [];
  const lines = content.split('\n');
  let currentRace: ActualResult | null = null;

  for (const line of lines) {
    const trimmed = line.replace(/^\s*\d+→/, '').trim();

    const raceMatch = trimmed.match(/^RACE\s+(\d+)/i);
    if (raceMatch) {
      if (currentRace) results.push(currentRace);
      currentRace = { raceNumber: parseInt(raceMatch[1]), finishers: [], scratches: [] };
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
          if (match) currentRace.scratches.push(match[1].trim().toLowerCase());
        }
      }
    }
  }

  if (currentRace) results.push(currentRace);
  return results;
}

// ============================================================================
// FILE DISCOVERY (reused from run-bulk-validation.ts)
// ============================================================================

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
// HELPER FUNCTIONS
// ============================================================================

function parseOdds(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();
  if (cleaned === 'EVEN' || cleaned === 'EVN') return 1.0;
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    return parseFloat(parts[0] || '10') || 10;
  }
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parseFloat(parts[0] || '0');
    const denom = parseFloat(parts[1] || '1');
    return num / (denom || 1);
  }
  return parseFloat(cleaned) || 10;
}

function countSpeedFigures(horse: HorseEntry): number {
  let count = 0;
  for (const pp of horse.pastPerformances) {
    if (pp.speedFigures.beyer !== null && pp.speedFigures.beyer > 0) count++;
  }
  return count;
}

function getLastFinishPosition(horse: HorseEntry): number | null {
  if (horse.pastPerformances.length === 0) return null;
  return horse.pastPerformances[0].finishPosition;
}

function checkWonLastOut(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;
  return horse.pastPerformances[0].finishPosition === 1;
}

function checkWon2OfLast3(horse: HorseEntry): boolean {
  const pps = horse.pastPerformances.slice(0, 3);
  if (pps.length < 2) return false;
  const wins = pps.filter((pp) => pp.finishPosition === 1).length;
  return wins >= 2;
}

function checkClassDrop(horse: HorseEntry, raceHeader: RaceHeader): boolean {
  if (horse.pastPerformances.length === 0) return false;
  const lastPP = horse.pastPerformances[0];

  // Check claiming price drop
  if (raceHeader.claimingPriceMax && lastPP.claimingPrice) {
    if (raceHeader.claimingPriceMax < lastPP.claimingPrice) return true;
  }

  // Check purse drop as proxy
  if (raceHeader.purse < lastPP.purse * 0.8) return true;

  return false;
}

function checkEquipmentChange(horse: HorseEntry): boolean {
  return (
    horse.equipment.equipmentChanges.length > 0 ||
    horse.equipment.firstTimeEquipment.length > 0 ||
    horse.medication.lasixFirstTime
  );
}

function checkJockeySwitch(horse: HorseEntry): boolean {
  if (horse.pastPerformances.length === 0) return false;
  const lastJockey = horse.pastPerformances[0].jockey?.toLowerCase().trim();
  const currentJockey = horse.jockeyName?.toLowerCase().trim();
  if (!lastJockey || !currentJockey) return false;
  return lastJockey !== currentJockey;
}

function checkWasMLFavorite(horse: HorseEntry, allHorses: HorseEntry[]): boolean {
  const thisOdds = parseOdds(horse.morningLineOdds);
  for (const h of allHorses) {
    if (h.programNumber !== horse.programNumber) {
      if (parseOdds(h.morningLineOdds) < thisOdds) return false;
    }
  }
  return true;
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

function processFile(
  drfPath: string,
  resultsPath: string
): { winners: WinnerData[]; racesProcessed: number } {
  const drfContent = fs.readFileSync(drfPath, 'utf-8');
  const resultsContent = fs.readFileSync(resultsPath, 'utf-8');

  const parseResult = parseDRFFile(drfContent);
  const actualResults = parseResultsFile(resultsContent);
  const baseName = path.basename(drfPath, path.extname(drfPath));

  const winners: WinnerData[] = [];
  let racesProcessed = 0;

  for (const race of parseResult.races) {
    const actual = actualResults.find((r) => r.raceNumber === race.header.raceNumber);
    if (!actual) continue;

    const actualWinner = actual.finishers.find((f) => f.position === 1);
    if (!actualWinner) continue;

    racesProcessed++;

    const scratchedNames = new Set(actual.scratches.map((s) => s.toLowerCase()));

    const trackCondition: TrackCondition = {
      surface: race.header.surface,
      condition: race.header.condition || 'fast',
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

    // Sort by BASE SCORE descending to get our rankings
    const rankedHorses = scoredHorses
      .filter((h) => !scratchedNames.has(h.horse.horseName.toLowerCase()))
      .sort((a, b) => b.score.baseScore - a.score.baseScore);

    // Find actual winner in our rankings
    const winnerInRanking = rankedHorses.findIndex(
      (h) => h.horse.programNumber === actualWinner.postPosition
    );

    if (winnerInRanking === -1) continue;

    const winnerHorse = rankedHorses[winnerInRanking];
    const winnerEntry = winnerHorse.horse;

    winners.push({
      raceId: `${baseName}-R${race.header.raceNumber}`,
      winnerRank: winnerInRanking + 1,
      winnerScore: winnerHorse.score.baseScore,
      ppCount: winnerEntry.pastPerformances.length,
      speedFigCount: countSpeedFigures(winnerEntry),
      daysSinceLastRace: winnerEntry.daysSinceLastRace,
      wonLastOut: checkWonLastOut(winnerEntry),
      won2OfLast3: checkWon2OfLast3(winnerEntry),
      lastFinishPosition: getLastFinishPosition(winnerEntry),
      isClassDrop: checkClassDrop(winnerEntry, race.header),
      hasEquipmentChange: checkEquipmentChange(winnerEntry),
      hasJockeySwitch: checkJockeySwitch(winnerEntry),
      morningLineOdds: parseOdds(winnerEntry.morningLineOdds),
      wasMLFavorite: checkWasMLFavorite(winnerEntry, race.horses),
    });
  }

  return { winners, racesProcessed };
}

// ============================================================================
// REPORTING
// ============================================================================

function printRankDistribution(winners: WinnerData[]): void {
  console.log('='.repeat(60));
  console.log('WINNER RANK DISTRIBUTION (' + winners.length + ' races)');
  console.log('Where did the ACTUAL WINNER rank in our projections?');
  console.log('='.repeat(60));
  console.log('Rank    Count    Pct     Cumulative');
  console.log('-'.repeat(40));

  const rankBuckets: number[] = Array(10).fill(0);
  for (const w of winners) {
    if (w.winnerRank <= 8) {
      rankBuckets[w.winnerRank - 1]++;
    } else {
      rankBuckets[8]++; // 9+
    }
  }

  let cumulative = 0;
  for (let i = 0; i < 9; i++) {
    cumulative += rankBuckets[i];
    const pct = ((rankBuckets[i] / winners.length) * 100).toFixed(1);
    const cumPct = ((cumulative / winners.length) * 100).toFixed(1);
    const label = i < 8 ? `#${i + 1}` : '#9+';
    console.log(`${label.padEnd(8)}${rankBuckets[i].toString().padStart(3)}      ${pct.padStart(5)}%   ${cumPct.padStart(5)}%`);
  }

  const top4 = rankBuckets.slice(0, 4).reduce((a, b) => a + b, 0);
  const top6 = rankBuckets.slice(0, 6).reduce((a, b) => a + b, 0);
  const bottom = rankBuckets.slice(6).reduce((a, b) => a + b, 0);

  console.log('-'.repeat(40));
  console.log(`INSIGHT: We find the winner in Top 4 in ${((top4 / winners.length) * 100).toFixed(1)}% of races`);
  console.log(`INSIGHT: We find the winner in Top 6 in ${((top6 / winners.length) * 100).toFixed(1)}% of races`);
  console.log(`INSIGHT: ${((bottom / winners.length) * 100).toFixed(1)}% of winners ranked #7 or worse`);
}

function printScoreDistribution(winners: WinnerData[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('WINNER SCORE DISTRIBUTION (' + winners.length + ' races)');
  console.log('What BASE SCORES did actual winners have?');
  console.log('='.repeat(60));
  console.log('Score Range    Count    Pct     Avg Rank We Gave Them');
  console.log('-'.repeat(55));

  const scoreBuckets: { count: number; ranks: number[] }[] = [
    { count: 0, ranks: [] }, // 250+
    { count: 0, ranks: [] }, // 225-249
    { count: 0, ranks: [] }, // 200-224
    { count: 0, ranks: [] }, // 175-199
    { count: 0, ranks: [] }, // 150-174
    { count: 0, ranks: [] }, // 125-149
    { count: 0, ranks: [] }, // 100-124
    { count: 0, ranks: [] }, // <100
  ];

  for (const w of winners) {
    let bucket: number;
    if (w.winnerScore >= 250) bucket = 0;
    else if (w.winnerScore >= 225) bucket = 1;
    else if (w.winnerScore >= 200) bucket = 2;
    else if (w.winnerScore >= 175) bucket = 3;
    else if (w.winnerScore >= 150) bucket = 4;
    else if (w.winnerScore >= 125) bucket = 5;
    else if (w.winnerScore >= 100) bucket = 6;
    else bucket = 7;

    scoreBuckets[bucket].count++;
    scoreBuckets[bucket].ranks.push(w.winnerRank);
  }

  const labels = ['250+', '225-249', '200-224', '175-199', '150-174', '125-149', '100-124', '<100'];
  for (let i = 0; i < 8; i++) {
    const b = scoreBuckets[i];
    const pct = ((b.count / winners.length) * 100).toFixed(1);
    const avgRank = b.ranks.length > 0 ? (b.ranks.reduce((a, c) => a + c, 0) / b.ranks.length).toFixed(1) : '-';
    console.log(`${labels[i].padEnd(14)}${b.count.toString().padStart(3)}      ${pct.padStart(5)}%   #${avgRank}`);
  }

  const below175 = scoreBuckets.slice(4).reduce((a, b) => a + b.count, 0);
  const below150 = scoreBuckets.slice(5).reduce((a, b) => a + b.count, 0);

  console.log('-'.repeat(55));
  console.log(`INSIGHT: ${((below175 / winners.length) * 100).toFixed(1)}% of winners scored below 175 (our "contender" threshold)`);
  console.log(`INSIGHT: ${((below150 / winners.length) * 100).toFixed(1)}% of winners scored below 150`);
}

function printCharacteristicsComparison(winners: WinnerData[]): void {
  const wellRanked = winners.filter((w) => w.winnerRank <= 3);
  const poorlyRanked = winners.filter((w) => w.winnerRank >= 7);

  console.log('\n' + '='.repeat(60));
  console.log('WINNER CHARACTERISTICS BY OUR RANK');
  console.log('='.repeat(60));
  console.log('                      Winners We      Winners We');
  console.log('                      Ranked #1-3     Ranked #7+');
  console.log('                      -----------     ----------');

  // Count
  console.log(`Count                     ${wellRanked.length.toString().padStart(2)} races        ${poorlyRanked.length.toString().padStart(2)} races`);

  // Avg Base Score
  const avgScoreWell = wellRanked.length > 0 ? wellRanked.reduce((a, w) => a + w.winnerScore, 0) / wellRanked.length : 0;
  const avgScorePoor = poorlyRanked.length > 0 ? poorlyRanked.reduce((a, w) => a + w.winnerScore, 0) / poorlyRanked.length : 0;
  console.log(`Avg Base Score            ${avgScoreWell.toFixed(0).padStart(3)} pts         ${avgScorePoor.toFixed(0).padStart(3)} pts`);

  console.log('DATA COMPLETENESS:');

  // Avg # Past Performances
  const avgPPWell = wellRanked.length > 0 ? wellRanked.reduce((a, w) => a + w.ppCount, 0) / wellRanked.length : 0;
  const avgPPPoor = poorlyRanked.length > 0 ? poorlyRanked.reduce((a, w) => a + w.ppCount, 0) / poorlyRanked.length : 0;
  console.log(`Avg # Past Performances   ${avgPPWell.toFixed(1).padStart(4)}             ${avgPPPoor.toFixed(1).padStart(4)}`);

  // % with 0-2 PPs
  const pctLowPPWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.ppCount <= 2).length / wellRanked.length) * 100 : 0;
  const pctLowPPPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.ppCount <= 2).length / poorlyRanked.length) * 100 : 0;
  console.log(`% with 0-2 PPs            ${pctLowPPWell.toFixed(0).padStart(3)}%             ${pctLowPPPoor.toFixed(0).padStart(3)}%`);

  // % with 5+ PPs
  const pctHighPPWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.ppCount >= 5).length / wellRanked.length) * 100 : 0;
  const pctHighPPPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.ppCount >= 5).length / poorlyRanked.length) * 100 : 0;
  console.log(`% with 5+ PPs             ${pctHighPPWell.toFixed(0).padStart(3)}%             ${pctHighPPPoor.toFixed(0).padStart(3)}%`);

  // Avg # Speed Figures
  const avgSFWell = wellRanked.length > 0 ? wellRanked.reduce((a, w) => a + w.speedFigCount, 0) / wellRanked.length : 0;
  const avgSFPoor = poorlyRanked.length > 0 ? poorlyRanked.reduce((a, w) => a + w.speedFigCount, 0) / poorlyRanked.length : 0;
  console.log(`Avg # Speed Figures       ${avgSFWell.toFixed(1).padStart(4)}             ${avgSFPoor.toFixed(1).padStart(4)}`);

  // % with 0-1 Speed Figs
  const pctLowSFWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.speedFigCount <= 1).length / wellRanked.length) * 100 : 0;
  const pctLowSFPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.speedFigCount <= 1).length / poorlyRanked.length) * 100 : 0;
  console.log(`% with 0-1 Speed Figs     ${pctLowSFWell.toFixed(0).padStart(3)}%             ${pctLowSFPoor.toFixed(0).padStart(3)}%`);

  console.log('RECENCY:');

  // Avg Days Since Last Race
  const wellWithDays = wellRanked.filter((w) => w.daysSinceLastRace !== null);
  const poorWithDays = poorlyRanked.filter((w) => w.daysSinceLastRace !== null);
  const avgDaysWell = wellWithDays.length > 0 ? wellWithDays.reduce((a, w) => a + (w.daysSinceLastRace || 0), 0) / wellWithDays.length : 0;
  const avgDaysPoor = poorWithDays.length > 0 ? poorWithDays.reduce((a, w) => a + (w.daysSinceLastRace || 0), 0) / poorWithDays.length : 0;
  console.log(`Avg Days Since Last Race  ${avgDaysWell.toFixed(0).padStart(3)} days         ${avgDaysPoor.toFixed(0).padStart(3)} days`);

  // % Raced Within 21 Days
  const pct21Well = wellRanked.length > 0 ? (wellRanked.filter((w) => w.daysSinceLastRace !== null && w.daysSinceLastRace <= 21).length / wellRanked.length) * 100 : 0;
  const pct21Poor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.daysSinceLastRace !== null && w.daysSinceLastRace <= 21).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Raced Within 21 Days    ${pct21Well.toFixed(0).padStart(3)}%             ${pct21Poor.toFixed(0).padStart(3)}%`);

  // % Raced Within 14 Days
  const pct14Well = wellRanked.length > 0 ? (wellRanked.filter((w) => w.daysSinceLastRace !== null && w.daysSinceLastRace <= 14).length / wellRanked.length) * 100 : 0;
  const pct14Poor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.daysSinceLastRace !== null && w.daysSinceLastRace <= 14).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Raced Within 14 Days    ${pct14Well.toFixed(0).padStart(3)}%             ${pct14Poor.toFixed(0).padStart(3)}%`);

  console.log('FORM:');

  // % Won Last Out
  const pctWLOWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.wonLastOut).length / wellRanked.length) * 100 : 0;
  const pctWLOPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.wonLastOut).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Won Last Out            ${pctWLOWell.toFixed(0).padStart(3)}%             ${pctWLOPoor.toFixed(0).padStart(3)}%`);

  // % Won 2 of 3
  const pctW23Well = wellRanked.length > 0 ? (wellRanked.filter((w) => w.won2OfLast3).length / wellRanked.length) * 100 : 0;
  const pctW23Poor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.won2OfLast3).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Won 2 of 3              ${pctW23Well.toFixed(0).padStart(3)}%             ${pctW23Poor.toFixed(0).padStart(3)}%`);

  // Avg Last Finish Position
  const wellWithFinish = wellRanked.filter((w) => w.lastFinishPosition !== null);
  const poorWithFinish = poorlyRanked.filter((w) => w.lastFinishPosition !== null);
  const avgFinishWell = wellWithFinish.length > 0 ? wellWithFinish.reduce((a, w) => a + (w.lastFinishPosition || 0), 0) / wellWithFinish.length : 0;
  const avgFinishPoor = poorWithFinish.length > 0 ? poorWithFinish.reduce((a, w) => a + (w.lastFinishPosition || 0), 0) / poorWithFinish.length : 0;
  console.log(`Avg Last Finish Position  ${avgFinishWell.toFixed(1).padStart(4)}             ${avgFinishPoor.toFixed(1).padStart(4)}`);

  console.log('INTENT SIGNALS:');

  // % Class Drop
  const pctCDWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.isClassDrop).length / wellRanked.length) * 100 : 0;
  const pctCDPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.isClassDrop).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Class Drop              ${pctCDWell.toFixed(0).padStart(3)}%             ${pctCDPoor.toFixed(0).padStart(3)}%`);

  // % Equipment Change
  const pctECWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.hasEquipmentChange).length / wellRanked.length) * 100 : 0;
  const pctECPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.hasEquipmentChange).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Equipment Change        ${pctECWell.toFixed(0).padStart(3)}%             ${pctECPoor.toFixed(0).padStart(3)}%`);

  // % Jockey Switch
  const pctJSWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.hasJockeySwitch).length / wellRanked.length) * 100 : 0;
  const pctJSPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.hasJockeySwitch).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Jockey Switch           ${pctJSWell.toFixed(0).padStart(3)}%             ${pctJSPoor.toFixed(0).padStart(3)}%`);

  console.log('ODDS:');

  // Avg Morning Line
  const avgMLWell = wellRanked.length > 0 ? wellRanked.reduce((a, w) => a + w.morningLineOdds, 0) / wellRanked.length : 0;
  const avgMLPoor = poorlyRanked.length > 0 ? poorlyRanked.reduce((a, w) => a + w.morningLineOdds, 0) / poorlyRanked.length : 0;
  console.log(`Avg Morning Line          ${avgMLWell.toFixed(1).padStart(4)}-1           ${avgMLPoor.toFixed(1).padStart(4)}-1`);

  // % Were ML Favorite
  const pctMLFWell = wellRanked.length > 0 ? (wellRanked.filter((w) => w.wasMLFavorite).length / wellRanked.length) * 100 : 0;
  const pctMLFPoor = poorlyRanked.length > 0 ? (poorlyRanked.filter((w) => w.wasMLFavorite).length / poorlyRanked.length) * 100 : 0;
  console.log(`% Were ML Favorite        ${pctMLFWell.toFixed(0).padStart(3)}%             ${pctMLFPoor.toFixed(0).padStart(3)}%`);

  // Key Findings
  console.log('='.repeat(60));
  console.log('KEY FINDINGS');
  console.log('Winners we ranked POORLY (#7+) compared to winners we ranked WELL (#1-3):');
  console.log('-'.repeat(60));

  const findings: string[] = [];

  // Compare PP counts
  const ppDiff = avgPPWell - avgPPPoor;
  if (Math.abs(ppDiff) >= 0.5) {
    findings.push(`Had ${Math.abs(ppDiff).toFixed(1)} ${ppDiff > 0 ? 'fewer' : 'more'} past performances on average`);
  }

  // Compare speed figures
  const sfDiff = avgSFWell - avgSFPoor;
  if (Math.abs(sfDiff) >= 0.5) {
    findings.push(`Had ${Math.abs(sfDiff).toFixed(1)} ${sfDiff > 0 ? 'fewer' : 'more'} speed figures on average`);
  }

  // Compare low speed fig %
  const lowSFDiff = pctLowSFPoor - pctLowSFWell;
  if (Math.abs(lowSFDiff) >= 10) {
    findings.push(`Were ${Math.abs(lowSFDiff).toFixed(0)}% ${lowSFDiff > 0 ? 'more' : 'less'} likely to have 0-1 speed figures`);
  }

  // Compare days since last race
  const daysDiff = avgDaysPoor - avgDaysWell;
  if (Math.abs(daysDiff) >= 5) {
    findings.push(`Raced ${Math.abs(daysDiff).toFixed(0)} days ${daysDiff > 0 ? 'more recently' : 'less recently'} on average`);
  }

  // Compare recency
  const recencyDiff = pct21Poor - pct21Well;
  if (Math.abs(recencyDiff) >= 10) {
    findings.push(`Were ${Math.abs(recencyDiff).toFixed(0)}% ${recencyDiff > 0 ? 'more' : 'less'} likely to have raced within 21 days`);
  }

  // Compare won last out
  const wloDiff = pctWLOPoor - pctWLOWell;
  if (Math.abs(wloDiff) >= 10) {
    findings.push(`Were ${Math.abs(wloDiff).toFixed(0)}% ${wloDiff > 0 ? 'more' : 'less'} likely to have won last out`);
  }

  // Compare last finish
  const finishDiff = avgFinishWell - avgFinishPoor;
  if (Math.abs(finishDiff) >= 0.5) {
    findings.push(`Had ${Math.abs(finishDiff).toFixed(1)} positions ${finishDiff > 0 ? 'worse' : 'better'} last finish on average`);
  }

  // Compare ML odds
  const mlDiff = avgMLPoor - avgMLWell;
  if (Math.abs(mlDiff) >= 2) {
    findings.push(`Were ${Math.abs(mlDiff).toFixed(1)}-1 ${mlDiff > 0 ? 'longer' : 'shorter'} on the morning line`);
  }

  // Compare ML favorite %
  const mlfDiff = pctMLFWell - pctMLFPoor;
  if (Math.abs(mlfDiff) >= 15) {
    findings.push(`Were ${Math.abs(mlfDiff).toFixed(0)}% ${mlfDiff > 0 ? 'less' : 'more'} likely to be the ML favorite`);
  }

  // Compare low PP %
  const lowPPDiff = pctLowPPPoor - pctLowPPWell;
  if (Math.abs(lowPPDiff) >= 10) {
    findings.push(`Were ${Math.abs(lowPPDiff).toFixed(0)}% ${lowPPDiff > 0 ? 'more' : 'less'} likely to have 0-2 past performances`);
  }

  if (findings.length === 0) {
    findings.push('No significant differences detected (sample size may be too small)');
  }

  for (const f of findings) {
    console.log(`  - ${f}`);
  }

  // Hypothesis
  console.log('\n' + '-'.repeat(60));
  console.log('HYPOTHESIS: Winners we miss are likely horses with LIMITED DATA');
  console.log('(fewer PPs, fewer speed figures) that get penalized by our');
  console.log('confidence multipliers even if they have strong recent signals.');
  console.log('='.repeat(60));
}

// ============================================================================
// MAIN
// ============================================================================

async function runDiagnostic() {
  console.log('='.repeat(70));
  console.log('          WINNER RANK DIAGNOSTIC: WHERE DO WINNERS RANK?');
  console.log('='.repeat(70) + '\n');

  // Discover DRF/Results pairs
  const drfFiles = findDRFFiles(DATA_DIR);
  const pairs: { drf: string; results: string }[] = [];

  for (const drfPath of drfFiles) {
    const resultsPath = findMatchingResultsFile(drfPath);
    if (resultsPath) {
      pairs.push({ drf: drfPath, results: resultsPath });
    }
  }

  if (pairs.length === 0) {
    console.log('No DRF files with matching results found in', DATA_DIR);
    process.exit(1);
  }

  console.log(`Found ${pairs.length} DRF file(s) with matching results\n`);

  // Process all files
  let allWinners: WinnerData[] = [];
  let totalRaces = 0;

  for (const pair of pairs) {
    const baseName = path.basename(pair.drf, path.extname(pair.drf));
    console.log(`Processing ${baseName}...`);
    try {
      const result = processFile(pair.drf, pair.results);
      allWinners = allWinners.concat(result.winners);
      totalRaces += result.racesProcessed;
    } catch (e) {
      console.log(`  Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\nProcessed ${totalRaces} races with ${allWinners.length} winners found\n`);

  if (allWinners.length === 0) {
    console.log('No winners found to analyze');
    process.exit(1);
  }

  // Print reports
  printRankDistribution(allWinners);
  printScoreDistribution(allWinners);
  printCharacteristicsComparison(allWinners);

  console.log('\n' + '='.repeat(70));
  console.log('Diagnostic completed at:', new Date().toISOString());
  console.log('='.repeat(70) + '\n');
}

runDiagnostic().catch(console.error);
