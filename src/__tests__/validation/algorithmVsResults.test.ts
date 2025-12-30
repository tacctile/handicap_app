/**
 * Algorithm Validation Test
 *
 * Compares BASE ABILITY (base score) rankings against actual race results
 * to measure algorithm accuracy.
 *
 * Run with: npm test -- --run src/__tests__/validation/algorithmVsResults.test.ts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { parseDRFFile } from '../../lib/drfParser';
import { calculateRaceScores } from '../../lib/scoring';
import type { TrackCondition } from '../../hooks/useRaceState';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRF_FILE_PATH = path.join(__dirname, '../../data/SAX1229.DRF');
const RESULTS_FILE_PATH = path.join(__dirname, '../../data/SAX1229_results.txt');

// ============================================================================
// TYPES
// ============================================================================

interface ActualResult {
  raceNumber: number;
  finishers: { position: number; postPosition: number; horseName: string }[];
  scratches: string[];
}

interface RaceAnalysis {
  raceNumber: number;
  raceInfo: string;
  scratches: string[];
  ourTop4: { post: number; name: string; baseScore: number }[];
  actualTop4: { position: number; postPosition: number; horseName: string }[];
  fullField: {
    rank: number;
    post: number;
    name: string;
    baseScore: number;
    actualFinish: string;
  }[];
  winnerHit: boolean;
  winnerInTop2: boolean;
  winnerInTop3: boolean;
  exactaHit: boolean;
  trifectaHit: boolean;
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

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ============================================================================
// MAIN TEST
// ============================================================================

describe('Algorithm Validation: BASE ABILITY vs Actual Results', () => {
  it('validates algorithm predictions against actual race results', () => {
    // Check files exist
    expect(fs.existsSync(DRF_FILE_PATH), `DRF file not found: ${DRF_FILE_PATH}`).toBe(true);
    expect(fs.existsSync(RESULTS_FILE_PATH), `Results file not found: ${RESULTS_FILE_PATH}`).toBe(
      true
    );

    const drfContent = fs.readFileSync(DRF_FILE_PATH, 'utf-8');
    const resultsContent = fs.readFileSync(RESULTS_FILE_PATH, 'utf-8');

    const parseResult = parseDRFFile(drfContent);
    const actualResults = parseResultsFile(resultsContent);

    // Print header
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║          ALGORITHM VALIDATION: BASE ABILITY vs ACTUAL RESULTS               ║');
    console.log(
      '╚══════════════════════════════════════════════════════════════════════════════╝\n'
    );
    console.log(`📁 Track: ${parseResult.trackCode} - ${parseResult.trackName}`);
    console.log(`📅 Date: ${parseResult.raceDate}`);
    console.log(`🏇 Races in DRF: ${parseResult.races.length}`);
    console.log(`📊 Races with Results: ${actualResults.length}\n`);

    // Statistics
    let totalRaces = 0;
    let winnersCorrect = 0;
    let top2Correct = 0;
    let top3Correct = 0;
    let exactaCorrect = 0;
    let trifectaCorrect = 0;
    let superfectaCorrect = 0;

    const raceAnalyses: RaceAnalysis[] = [];

    // Process each race
    for (const race of parseResult.races) {
      const actual = actualResults.find((r) => r.raceNumber === race.header.raceNumber);
      if (!actual) continue;

      totalRaces++;

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

      const activeHorses = scoredHorses
        .filter((h) => !scratchedNames.has(h.horse.horseName.toLowerCase()))
        .sort((a, b) => b.score.baseScore - a.score.baseScore);

      const ourTop4 = activeHorses.slice(0, 4).map((h) => ({
        post: h.horse.programNumber,
        name: h.horse.horseName,
        baseScore: h.score.baseScore,
      }));

      const actualTop4 = actual.finishers.slice(0, 4);
      const actualWinner = actualTop4[0];

      const winnerHit = ourTop4[0]?.post === actualWinner?.postPosition;
      const winnerInTop2 = ourTop4.slice(0, 2).some((h) => h.post === actualWinner?.postPosition);
      const winnerInTop3 = ourTop4.slice(0, 3).some((h) => h.post === actualWinner?.postPosition);
      const exactaHit =
        ourTop4[0]?.post === actualTop4[0]?.postPosition &&
        ourTop4[1]?.post === actualTop4[1]?.postPosition;
      const trifectaHit = exactaHit && ourTop4[2]?.post === actualTop4[2]?.postPosition;
      const superfectaHit = trifectaHit && ourTop4[3]?.post === actualTop4[3]?.postPosition;

      if (winnerHit) winnersCorrect++;
      if (winnerInTop2) top2Correct++;
      if (winnerInTop3) top3Correct++;
      if (exactaHit) exactaCorrect++;
      if (trifectaHit) trifectaCorrect++;
      if (superfectaHit) superfectaCorrect++;

      // Build full field analysis
      const fullField = activeHorses.map((h, i) => {
        const actualFinish = actual.finishers.find((f) => f.postPosition === h.horse.programNumber);
        return {
          rank: i + 1,
          post: h.horse.programNumber,
          name: h.horse.horseName,
          baseScore: h.score.baseScore,
          actualFinish: actualFinish
            ? `${actualFinish.position}${getOrdinal(actualFinish.position)}`
            : '---',
        };
      });

      raceAnalyses.push({
        raceNumber: race.header.raceNumber,
        raceInfo: `${race.header.distance} ${race.header.surface} - ${race.header.raceConditions || race.header.raceType}`,
        scratches: actual.scratches,
        ourTop4,
        actualTop4,
        fullField,
        winnerHit,
        winnerInTop2,
        winnerInTop3,
        exactaHit,
        trifectaHit,
      });
    }

    // Print race-by-race analysis
    for (const analysis of raceAnalyses) {
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`RACE ${analysis.raceNumber}: ${analysis.raceInfo}`);
      console.log(`${'═'.repeat(80)}\n`);

      if (analysis.scratches.length > 0) {
        console.log(`🚫 SCRATCHES: ${analysis.scratches.join(', ')}\n`);
      }

      console.log(
        `┌─────────────────────────────────────────────────────────────────────────────┐`
      );
      console.log(`│  OUR RANKING (by Base Score)          │  ACTUAL FINISH ORDER               │`);
      console.log(
        `├─────────────────────────────────────────────────────────────────────────────┤`
      );

      for (let i = 0; i < 4; i++) {
        const ours = analysis.ourTop4[i];
        const theirs = analysis.actualTop4[i];

        const ourStr = ours
          ? `${i + 1}. #${ours.post.toString().padEnd(2)} ${ours.name.substring(0, 18).padEnd(18)} (${ours.baseScore})`
          : `${i + 1}. ---`;

        const theirStr = theirs
          ? `${i + 1}. #${theirs.postPosition.toString().padEnd(2)} ${theirs.horseName.substring(0, 18).padEnd(18)}`
          : `${i + 1}. ---`;

        const match = ours && theirs && ours.post === theirs.postPosition;
        const marker = match ? ' ✓' : '  ';

        console.log(`│  ${ourStr.padEnd(36)} │  ${theirStr.padEnd(32)}${marker} │`);
      }

      console.log(
        `└─────────────────────────────────────────────────────────────────────────────┘\n`
      );

      // Full field table
      console.log(`FULL FIELD (sorted by Base Score):`);
      console.log(`${'─'.repeat(70)}`);
      console.log(`Rank  PP  Horse Name                   Base   Actual Finish`);
      console.log(`${'─'.repeat(70)}`);

      for (const horse of analysis.fullField) {
        const finishNum = parseInt(horse.actualFinish);
        const highlight =
          finishNum === 1
            ? ' ← WINNER'
            : finishNum === 2
              ? ' ← 2nd'
              : finishNum === 3
                ? ' ← 3rd'
                : '';

        console.log(
          `${horse.rank.toString().padStart(3)}.  ${horse.post.toString().padStart(2)}  ${horse.name.substring(0, 25).padEnd(25)}  ${horse.baseScore.toString().padStart(3)}    ${horse.actualFinish.padStart(4)}${highlight}`
        );
      }

      console.log();
      if (analysis.winnerHit) {
        console.log(`✅ WINNER CORRECT! Our #1 pick won.`);
      } else if (analysis.winnerInTop2) {
        console.log(`🟡 Winner was our #2 pick.`);
      } else if (analysis.winnerInTop3) {
        console.log(`🟠 Winner was our #3 pick.`);
      } else {
        const actualWinner = analysis.actualTop4[0];
        const winnerRank =
          analysis.fullField.find((h) => h.post === actualWinner?.postPosition)?.rank || '?';
        console.log(
          `❌ MISSED. Winner (#${actualWinner?.postPosition} ${actualWinner?.horseName}) was our #${winnerRank} pick.`
        );
      }
    }

    // Summary
    console.log('\n\n' + '█'.repeat(80));
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

    console.log('\n' + '═'.repeat(80) + '\n');

    // The test always passes - this is for output/validation purposes
    expect(totalRaces).toBeGreaterThan(0);
  });
});
