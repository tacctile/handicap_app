/**
 * Bulk Algorithm Validation Script
 *
 * Scans src/data/ for all DRF files and their matching results files,
 * runs the scoring algorithm against each, and outputs aggregate performance stats.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import type { TrackCondition } from '../src/hooks/useRaceState';

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

interface TrackStats {
  trackCode: string;
  trackName: string;
  racesScored: number;
  winnersCorrect: number;
  top2Correct: number;
  top3Correct: number;
  exactaCorrect: number;
  badBeats: BadBeat[];
}

interface BadBeat {
  trackCode: string;
  raceNumber: number;
  raceDate: string;
  topPickName: string;
  topPickPost: number;
  topPickScore: number;
  actualFinish: number;
  winnerName: string;
  winnerPost: number;
}

interface ValidationPair {
  drfPath: string;
  resultsPath: string;
  baseName: string;
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

    // Match race header
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

    // Match finish positions (1st, 2nd, 3rd, 4th)
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

    // Match scratches
    const scratchMatch = trimmed.match(/^SCRATCHED:\s*(.+)/i);
    if (scratchMatch) {
      const scratchText = scratchMatch[1].trim();
      if (scratchText.toLowerCase() !== 'none') {
        // Parse scratches - format: "1 Decapo, 2 Joe's Candy, 5 Flaubert"
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
  return files.filter((f) => f.toLowerCase().endsWith('.drf')).map((f) => path.join(dataDir, f));
}

function findMatchingResultsFile(drfPath: string): string | null {
  const baseName = path.basename(drfPath, path.extname(drfPath));
  const dir = path.dirname(drfPath);

  // Try [filename]_results.txt first
  const resultsPath1 = path.join(dir, `${baseName}_results.txt`);
  if (fs.existsSync(resultsPath1)) {
    // Validate it's a results file by checking for "RACE" inside
    const content = fs.readFileSync(resultsPath1, 'utf-8');
    if (content.includes('RACE')) {
      return resultsPath1;
    }
  }

  // Try [filename].txt second
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

    // Use file basename as fallback for track code/name if not in parse result
    const trackCode = parseResult.trackCode || pair.baseName.substring(0, 3).toUpperCase();
    const trackName = parseResult.trackName || pair.baseName;
    const raceDate = parseResult.raceDate || pair.baseName.substring(3);

    const stats: TrackStats = {
      trackCode,
      trackName,
      racesScored: 0,
      winnersCorrect: 0,
      top2Correct: 0,
      top3Correct: 0,
      exactaCorrect: 0,
      badBeats: [],
    };

    for (const race of parseResult.races) {
      const actual = actualResults.find((r) => r.raceNumber === race.header.raceNumber);
      if (!actual) continue;

      stats.racesScored++;

      // Build scratched list from actual results
      const scratchedNames = new Set(actual.scratches.map((s) => s.toLowerCase()));

      // Calculate scores
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

      // Filter out scratches and sort by BASE SCORE
      const activeHorses = scoredHorses
        .filter((h) => !scratchedNames.has(h.horse.horseName.toLowerCase()))
        .sort((a, b) => b.score.baseScore - a.score.baseScore);

      if (activeHorses.length === 0) continue;

      // Get our predictions
      const ourTop4 = activeHorses.slice(0, 4);
      const actualTop4 = actual.finishers.slice(0, 4);

      const ourWinner = ourTop4[0];
      const actualWinner = actualTop4[0];

      if (!ourWinner || !actualWinner) continue;

      const winnerHit = ourWinner.horse.programNumber === actualWinner.postPosition;
      const winnerInTop2 = ourTop4
        .slice(0, 2)
        .some((h) => h.horse.programNumber === actualWinner.postPosition);
      const winnerInTop3 = ourTop4
        .slice(0, 3)
        .some((h) => h.horse.programNumber === actualWinner.postPosition);

      // Check exacta
      const exactaHit =
        ourTop4[0]?.horse.programNumber === actualTop4[0]?.postPosition &&
        ourTop4[1]?.horse.programNumber === actualTop4[1]?.postPosition;

      if (winnerHit) stats.winnersCorrect++;
      if (winnerInTop2) stats.top2Correct++;
      if (winnerInTop3) stats.top3Correct++;
      if (exactaHit) stats.exactaCorrect++;

      // Check for Bad Beat: #1 pick (Tier 1, >180 pts) finished 4th or worse
      const ourTopPickScore = ourWinner.score.baseScore;
      const ourTopPickActualFinish = actual.finishers.find(
        (f) => f.postPosition === ourWinner.horse.programNumber
      );

      if (
        ourTopPickScore >= 180 &&
        ourTopPickActualFinish &&
        ourTopPickActualFinish.position >= 4
      ) {
        stats.badBeats.push({
          trackCode,
          raceNumber: race.header.raceNumber,
          raceDate,
          topPickName: ourWinner.horse.horseName,
          topPickPost: ourWinner.horse.programNumber,
          topPickScore: ourTopPickScore,
          actualFinish: ourTopPickActualFinish.position,
          winnerName: actualWinner.horseName,
          winnerPost: actualWinner.postPosition,
        });
      }
    }

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${pair.baseName}: ${errorMessage}`);
    return null;
  }
}

// ============================================================================
// REPORTING
// ============================================================================

function printTrackTable(stats: TrackStats): void {
  const winPct =
    stats.racesScored > 0 ? ((stats.winnersCorrect / stats.racesScored) * 100).toFixed(1) : '0.0';
  const top3Pct =
    stats.racesScored > 0 ? ((stats.top3Correct / stats.racesScored) * 100).toFixed(1) : '0.0';
  const exactaPct =
    stats.racesScored > 0 ? ((stats.exactaCorrect / stats.racesScored) * 100).toFixed(1) : '0.0';

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`TRACK: ${stats.trackCode} - ${stats.trackName}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Races Scored:    ${stats.racesScored.toString().padStart(3)}`);
  console.log(
    `  Win % (Top Pick): ${winPct.padStart(5)}%  (${stats.winnersCorrect}/${stats.racesScored})`
  );
  console.log(
    `  Top 3 %:          ${top3Pct.padStart(5)}%  (${stats.top3Correct}/${stats.racesScored})`
  );
  console.log(
    `  Exacta %:         ${exactaPct.padStart(5)}%  (${stats.exactaCorrect}/${stats.racesScored})`
  );
}

function printGrandTotal(allStats: TrackStats[]): void {
  const totals = {
    racesScored: 0,
    winnersCorrect: 0,
    top2Correct: 0,
    top3Correct: 0,
    exactaCorrect: 0,
  };

  for (const stats of allStats) {
    totals.racesScored += stats.racesScored;
    totals.winnersCorrect += stats.winnersCorrect;
    totals.top2Correct += stats.top2Correct;
    totals.top3Correct += stats.top3Correct;
    totals.exactaCorrect += stats.exactaCorrect;
  }

  const winPct =
    totals.racesScored > 0
      ? ((totals.winnersCorrect / totals.racesScored) * 100).toFixed(1)
      : '0.0';
  const top2Pct =
    totals.racesScored > 0 ? ((totals.top2Correct / totals.racesScored) * 100).toFixed(1) : '0.0';
  const top3Pct =
    totals.racesScored > 0 ? ((totals.top3Correct / totals.racesScored) * 100).toFixed(1) : '0.0';
  const exactaPct =
    totals.racesScored > 0 ? ((totals.exactaCorrect / totals.racesScored) * 100).toFixed(1) : '0.0';

  console.log('\n' + '█'.repeat(70));
  console.log('                    GRAND TOTAL - ALL TRACKS');
  console.log('█'.repeat(70));
  console.log(`\n  Tracks Processed:  ${allStats.length}`);
  console.log(`  Total Races:       ${totals.racesScored}`);
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│  METRIC                          │  COUNT  │  PERCENTAGE    │');
  console.log('├──────────────────────────────────────────────────────────────┤');
  console.log(
    `│  Winners Picked Correctly (#1)   │   ${totals.winnersCorrect.toString().padStart(3)}   │     ${winPct.padStart(5)}%     │`
  );
  console.log(
    `│  Winner in Our Top 2             │   ${totals.top2Correct.toString().padStart(3)}   │     ${top2Pct.padStart(5)}%     │`
  );
  console.log(
    `│  Winner in Our Top 3             │   ${totals.top3Correct.toString().padStart(3)}   │     ${top3Pct.padStart(5)}%     │`
  );
  console.log('├──────────────────────────────────────────────────────────────┤');
  console.log(
    `│  Exacta (1-2 in order)           │   ${totals.exactaCorrect.toString().padStart(3)}   │     ${exactaPct.padStart(5)}%     │`
  );
  console.log('└──────────────────────────────────────────────────────────────┘');

  // Assessment
  console.log('\n' + '─'.repeat(70));
  console.log('ASSESSMENT:');
  console.log('─'.repeat(70));

  const winPctNum = parseFloat(winPct);
  const top3PctNum = parseFloat(top3Pct);

  if (winPctNum >= 33) {
    console.log('🏆 EXCELLENT: Picking winners at 33%+ is profitable territory!');
  } else if (winPctNum >= 25) {
    console.log('✅ GOOD: Solid win rate, competitive with typical handicapping.');
  } else if (winPctNum >= 15) {
    console.log('🟡 FAIR: Below average win rate, algorithm needs refinement.');
  } else {
    console.log('❌ POOR: Significant algorithm issues - investigate scoring weights.');
  }

  if (top3PctNum >= 66) {
    console.log('🎯 Winner appearing in top 3 picks 66%+ of the time is excellent!');
  } else if (top3PctNum >= 50) {
    console.log('👍 Winner in top 3 at least 50% - decent predictive power.');
  } else {
    console.log('⚠️  Winner outside top 3 too often - consider algorithm adjustments.');
  }
}

function printBadBeats(allStats: TrackStats[]): void {
  const allBadBeats: BadBeat[] = [];
  for (const stats of allStats) {
    allBadBeats.push(...stats.badBeats);
  }

  if (allBadBeats.length === 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('BAD BEATS: None! (No Tier 1 picks with 180+ pts finished 4th or worse)');
    console.log('─'.repeat(70));
    return;
  }

  console.log('\n' + '─'.repeat(70));
  console.log(
    `BAD BEATS: ${allBadBeats.length} race(s) where Tier 1 (180+ pts) pick finished 4th+`
  );
  console.log('─'.repeat(70));

  for (const bb of allBadBeats) {
    console.log(
      `  ${bb.trackCode} R${bb.raceNumber} (${bb.raceDate}): #${bb.topPickPost} ${bb.topPickName} (${bb.topPickScore} pts) → ${getOrdinal(bb.actualFinish)}`
    );
    console.log(`      Winner: #${bb.winnerPost} ${bb.winnerName}`);
  }
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================================================
// MAIN
// ============================================================================

async function runBulkValidation() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              BULK ALGORITHM VALIDATION: ALL TRACKS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Discover DRF/Results pairs
  const pairs = discoverValidationPairs(DATA_DIR);

  if (pairs.length === 0) {
    console.log('❌ No DRF files with matching results found in', DATA_DIR);
    console.log('   Looking for: .DRF files with matching _results.txt or .txt files');
    process.exit(1);
  }

  console.log(`📁 Found ${pairs.length} DRF file(s) with matching results:\n`);
  for (const pair of pairs) {
    console.log(`   • ${pair.baseName}`);
  }

  // Process each pair
  const allStats: TrackStats[] = [];

  console.log('\n' + '═'.repeat(70));
  console.log('PROCESSING FILES...');
  console.log('═'.repeat(70));

  for (const pair of pairs) {
    console.log(`\nProcessing ${pair.baseName}...`);
    const stats = processValidationPair(pair);
    if (stats) {
      allStats.push(stats);
      printTrackTable(stats);
    }
  }

  // Print Grand Total
  if (allStats.length > 0) {
    printGrandTotal(allStats);
    printBadBeats(allStats);
  } else {
    console.log('\n❌ No files were successfully processed.');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('Bulk validation completed at:', new Date().toISOString());
  console.log('═'.repeat(70) + '\n');
}

// Run validation
runBulkValidation().catch(console.error);
