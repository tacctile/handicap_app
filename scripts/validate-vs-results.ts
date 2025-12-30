/**
 * Algorithm Validation Script
 *
 * Compares BASE ABILITY (base score) rankings against actual race results
 * to measure algorithm accuracy.
 */

import * as fs from 'fs';
import * as path from 'path';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import type { TrackCondition } from '../src/hooks/useRaceState';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRF_FILE_PATH = path.join(__dirname, '../src/data/SAX1229.DRF');
const RESULTS_FILE_PATH = path.join(__dirname, '../src/data/SAX1229_results.txt');

// ============================================================================
// TYPES
// ============================================================================

interface ActualResult {
  raceNumber: number;
  finishers: { position: number; postPosition: number; horseName: string }[];
  scratches: string[];
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
// MAIN VALIDATION
// ============================================================================

async function runValidation() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          ALGORITHM VALIDATION: BASE ABILITY vs ACTUAL RESULTS               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Load files
  if (!fs.existsSync(DRF_FILE_PATH)) {
    console.error('❌ DRF file not found:', DRF_FILE_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(RESULTS_FILE_PATH)) {
    console.error('❌ Results file not found:', RESULTS_FILE_PATH);
    process.exit(1);
  }

  const drfContent = fs.readFileSync(DRF_FILE_PATH, 'utf-8');
  const resultsContent = fs.readFileSync(RESULTS_FILE_PATH, 'utf-8');

  // Parse both files
  console.log('📁 Loading and parsing files...');
  const parseResult = parseDRFFile(drfContent);
  const actualResults = parseResultsFile(resultsContent);

  console.log(`   Track: ${parseResult.trackCode} - ${parseResult.trackName}`);
  console.log(`   Date: ${parseResult.raceDate}`);
  console.log(`   Races in DRF: ${parseResult.races.length}`);
  console.log(`   Races in Results: ${actualResults.length}\n`);

  // Statistics tracking
  let totalRaces = 0;
  let winnersCorrect = 0;
  let top2Correct = 0; // Winner was in our top 2
  let top3Correct = 0; // Winner was in our top 3
  let exactaCorrect = 0;
  let trifectaCorrect = 0;
  let superfectaCorrect = 0;

  const allRaceAnalysis: string[] = [];

  // Process each race
  for (const race of parseResult.races) {
    const actual = actualResults.find((r) => r.raceNumber === race.header.raceNumber);
    if (!actual) {
      console.log(`⚠️  Race ${race.header.raceNumber}: No actual results found, skipping...`);
      continue;
    }

    totalRaces++;

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

    // Filter out scratches and sort by BASE SCORE (not total)
    const activeHorses = scoredHorses
      .filter((h) => !scratchedNames.has(h.horse.horseName.toLowerCase()))
      .sort((a, b) => b.score.baseScore - a.score.baseScore);

    // Get our predictions (by base score rank)
    const ourTop4 = activeHorses.slice(0, 4).map((h) => ({
      post: h.horse.programNumber,
      name: h.horse.horseName,
      baseScore: h.score.baseScore,
      rank: h.rank,
    }));

    // Get actual finish order
    const actualTop4 = actual.finishers.slice(0, 4);

    // Check accuracy
    const ourWinner = ourTop4[0];
    const actualWinner = actualTop4[0];

    const winnerHit = ourWinner?.post === actualWinner?.postPosition;
    const winnerInTop2 = ourTop4.slice(0, 2).some((h) => h.post === actualWinner?.postPosition);
    const winnerInTop3 = ourTop4.slice(0, 3).some((h) => h.post === actualWinner?.postPosition);

    // Check exacta (top 2 in order)
    const exactaHit =
      ourTop4[0]?.post === actualTop4[0]?.postPosition &&
      ourTop4[1]?.post === actualTop4[1]?.postPosition;

    // Check trifecta (top 3 in order)
    const trifectaHit = exactaHit && ourTop4[2]?.post === actualTop4[2]?.postPosition;

    // Check superfecta (top 4 in order)
    const superfectaHit = trifectaHit && ourTop4[3]?.post === actualTop4[3]?.postPosition;

    if (winnerHit) winnersCorrect++;
    if (winnerInTop2) top2Correct++;
    if (winnerInTop3) top3Correct++;
    if (exactaHit) exactaCorrect++;
    if (trifectaHit) trifectaCorrect++;
    if (superfectaHit) superfectaCorrect++;

    // Build race analysis output
    let analysis = '';
    analysis += `\n${'═'.repeat(80)}\n`;
    analysis += `RACE ${race.header.raceNumber}: ${race.header.distance} ${race.header.surface} - ${race.header.raceConditions || race.header.raceType}\n`;
    analysis += `${'═'.repeat(80)}\n\n`;

    // Show scratches if any
    if (actual.scratches.length > 0) {
      analysis += `🚫 SCRATCHES: ${actual.scratches.join(', ')}\n\n`;
    }

    // Create comparison table
    analysis += `┌─────────────────────────────────────────────────────────────────────────────┐\n`;
    analysis += `│  OUR RANKING (by Base Score)          │  ACTUAL FINISH ORDER               │\n`;
    analysis += `├─────────────────────────────────────────────────────────────────────────────┤\n`;

    for (let i = 0; i < Math.max(ourTop4.length, actualTop4.length, 4); i++) {
      const ours = ourTop4[i];
      const theirs = actualTop4[i];

      const ourStr = ours
        ? `${i + 1}. #${ours.post.toString().padEnd(2)} ${ours.name.substring(0, 18).padEnd(18)} (${ours.baseScore})`
        : `${i + 1}. ---`;

      const theirStr = theirs
        ? `${i + 1}. #${theirs.postPosition.toString().padEnd(2)} ${theirs.horseName.substring(0, 18).padEnd(18)}`
        : `${i + 1}. ---`;

      // Check if positions match
      const match = ours && theirs && ours.post === theirs.postPosition;
      const marker = match ? ' ✓' : '  ';

      analysis += `│  ${ourStr.padEnd(36)} │  ${theirStr.padEnd(32)}${marker} │\n`;
    }

    analysis += `└─────────────────────────────────────────────────────────────────────────────┘\n\n`;

    // Show all horses with their base scores for this race
    analysis += `FULL FIELD (sorted by Base Score):\n`;
    analysis += `${'─'.repeat(70)}\n`;
    analysis += `Rank  PP  Horse Name                   Base   Actual Finish\n`;
    analysis += `${'─'.repeat(70)}\n`;

    for (let i = 0; i < activeHorses.length; i++) {
      const horse = activeHorses[i];
      const actualFinish = actual.finishers.find(
        (f) => f.postPosition === horse.horse.programNumber
      );
      const finishStr = actualFinish
        ? `${actualFinish.position}${getOrdinal(actualFinish.position)}`
        : '---';

      const highlight =
        actualFinish?.position === 1
          ? ' ← WINNER'
          : actualFinish?.position === 2
            ? ' ← 2nd'
            : actualFinish?.position === 3
              ? ' ← 3rd'
              : '';

      analysis += `${(i + 1).toString().padStart(3)}.  ${horse.horse.programNumber.toString().padStart(2)}  ${horse.horse.horseName.substring(0, 25).padEnd(25)}  ${horse.score.baseScore.toString().padStart(3)}    ${finishStr.padStart(4)}${highlight}\n`;
    }

    // Race verdict
    analysis += `\n`;
    if (winnerHit) {
      analysis += `✅ WINNER CORRECT! Our #1 pick won.\n`;
    } else if (winnerInTop2) {
      analysis += `🟡 Winner was our #2 pick.\n`;
    } else if (winnerInTop3) {
      analysis += `🟠 Winner was our #3 pick.\n`;
    } else {
      // Find where winner ranked in our picks
      const winnerRank =
        activeHorses.findIndex((h) => h.horse.programNumber === actualWinner?.postPosition) + 1;
      analysis += `❌ MISSED. Winner (#${actualWinner?.postPosition} ${actualWinner?.horseName}) was our #${winnerRank} pick.\n`;
    }

    allRaceAnalysis.push(analysis);
  }

  // Print all race analyses
  for (const analysis of allRaceAnalysis) {
    console.log(analysis);
  }

  // Summary Report
  console.log('\n' + '█'.repeat(80));
  console.log('                         OVERALL ALGORITHM PERFORMANCE');
  console.log('█'.repeat(80) + '\n');

  console.log(`Total Races Analyzed: ${totalRaces}\n`);

  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│  METRIC                          │  COUNT  │  PERCENTAGE    │');
  console.log('├──────────────────────────────────────────────────────────────┤');
  console.log(
    `│  Winners Picked Correctly (#1)   │   ${winnersCorrect.toString().padStart(2)}    │     ${((winnersCorrect / totalRaces) * 100).toFixed(1).padStart(5)}%     │`
  );
  console.log(
    `│  Winner in Our Top 2             │   ${top2Correct.toString().padStart(2)}    │     ${((top2Correct / totalRaces) * 100).toFixed(1).padStart(5)}%     │`
  );
  console.log(
    `│  Winner in Our Top 3             │   ${top3Correct.toString().padStart(2)}    │     ${((top3Correct / totalRaces) * 100).toFixed(1).padStart(5)}%     │`
  );
  console.log('├──────────────────────────────────────────────────────────────┤');
  console.log(
    `│  Exacta (1-2 in order)           │   ${exactaCorrect.toString().padStart(2)}    │     ${((exactaCorrect / totalRaces) * 100).toFixed(1).padStart(5)}%     │`
  );
  console.log(
    `│  Trifecta (1-2-3 in order)       │   ${trifectaCorrect.toString().padStart(2)}    │     ${((trifectaCorrect / totalRaces) * 100).toFixed(1).padStart(5)}%     │`
  );
  console.log(
    `│  Superfecta (1-2-3-4 in order)   │   ${superfectaCorrect.toString().padStart(2)}    │     ${((superfectaCorrect / totalRaces) * 100).toFixed(1).padStart(5)}%     │`
  );
  console.log('└──────────────────────────────────────────────────────────────┘');

  // Assessment
  console.log('\n' + '─'.repeat(80));
  console.log('ASSESSMENT:');
  console.log('─'.repeat(80));

  const winPct = (winnersCorrect / totalRaces) * 100;
  const top3Pct = (top3Correct / totalRaces) * 100;

  if (winPct >= 33) {
    console.log('🏆 EXCELLENT: Picking winners at 33%+ is profitable territory!');
  } else if (winPct >= 25) {
    console.log('✅ GOOD: Solid win rate, competitive with typical handicapping.');
  } else if (winPct >= 15) {
    console.log('🟡 FAIR: Below average win rate, algorithm needs refinement.');
  } else {
    console.log('❌ POOR: Significant algorithm issues - investigate scoring weights.');
  }

  if (top3Pct >= 66) {
    console.log('🎯 Winner appearing in top 3 picks 66%+ of the time is excellent!');
  } else if (top3Pct >= 50) {
    console.log('👍 Winner in top 3 at least 50% - decent predictive power.');
  } else {
    console.log('⚠️  Winner outside top 3 too often - consider algorithm adjustments.');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('Validation completed at:', new Date().toISOString());
  console.log('═'.repeat(80) + '\n');
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Run validation
runValidation().catch(console.error);
