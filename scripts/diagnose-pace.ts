/**
 * Pace Diagnosis Script
 *
 * Analyzes "Bad Beat" races to identify if pace scoring is rewarding
 * one-dimensional speed horses ("Quitters") who fade in the stretch.
 *
 * OUTPUT:
 * - Running Style comparison (Winner vs Our Pick)
 * - E1/E2 (Early Pace) figures
 * - LP (Late Pace) figures
 * - Fade differential (E1/E2 - LP)
 * - Final Pace Score
 * - Whether "Tessuto Rule" bonus was applied
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import { parseRunningStyle, analyzePaceFigures } from '../src/lib/scoring/paceAnalysis';
import type { TrackCondition } from '../src/hooks/useRaceState';
import type { HorseEntry } from '../src/types/drf';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../src/data');

// Bad Beats to analyze (from the bulk validation output)
// Format: { file: 'basename', race: raceNumber, ourPick: postPosition, winner: postPosition }
const BAD_BEATS_TO_ANALYZE = [
  { file: 'GPX1227', race: 9, ourPick: 3, winner: 8, ourPickName: 'FLAMINGO WAY', winnerName: 'Moon Spun' },
  { file: 'DED1230', race: 4, ourPick: 5, winner: 7, ourPickName: 'POLTERER', winnerName: 'Time to Party' },
  { file: 'PEN0821', race: 1, ourPick: 4, winner: 6, ourPickName: 'FREE DROP BACH', winnerName: 'Zapata (IRE)' },
  { file: 'PRX1230', race: 2, ourPick: 3, winner: 7, ourPickName: 'NUEDORF', winnerName: 'Smoke Wagon' },
  { file: 'SAX1229', race: 5, ourPick: 1, winner: 4, ourPickName: 'SKETCHY', winnerName: 'Captain Choochies' },
];

// ============================================================================
// TYPES
// ============================================================================

interface PaceAnalysis {
  horseName: string;
  programNumber: number;
  runningStyle: string;
  styleCode: string;
  avgE1: number | null;   // Early Pace (EP1)
  avgE2: number | null;   // Second call pace (if available)
  avgLP: number | null;   // Late Pace
  fadeDifferential: number | null;  // E1 - LP (positive = fades)
  paceScore: number;
  isQuitter: boolean;     // E1 - LP > 20
  hasClosingKick: boolean;
  tessutoEligible: boolean;  // High E1, pace score >= 30
  actualFinish: number;
}

interface RaceComparison {
  trackCode: string;
  raceNumber: number;
  raceDate: string;
  distance: string;
  surface: string;
  ourPick: PaceAnalysis;
  winner: PaceAnalysis;
  diagnosis: string[];
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzePaceForHorse(
  horse: HorseEntry,
  paceScore: number,
  actualFinish: number
): PaceAnalysis {
  const profile = parseRunningStyle(horse);
  const paceFigures = analyzePaceFigures(horse);

  // Calculate fade differential
  let fadeDifferential: number | null = null;
  if (paceFigures.avgEarlyPace !== null && paceFigures.avgLatePace !== null) {
    fadeDifferential = paceFigures.avgEarlyPace - paceFigures.avgLatePace;
  }

  // Determine if this is a "Quitter" - high E1 but fades badly (E1 - LP > 20)
  const isQuitter = fadeDifferential !== null && fadeDifferential > 20;

  // Check if Tessuto-eligible (high E1, would get pace protection)
  const tessutoEligible =
    paceScore >= 30 ||
    (paceFigures.avgEarlyPace !== null && paceFigures.avgEarlyPace >= 85);

  return {
    horseName: horse.horseName,
    programNumber: horse.programNumber,
    runningStyle: profile.styleName,
    styleCode: profile.style,
    avgE1: paceFigures.avgEarlyPace,
    avgE2: null, // E2 not separately tracked, using E1
    avgLP: paceFigures.avgLatePace,
    fadeDifferential,
    paceScore,
    isQuitter,
    hasClosingKick: paceFigures.hasClosingKick,
    tessutoEligible,
    actualFinish,
  };
}

function diagnoseRace(comparison: RaceComparison): string[] {
  const diagnoses: string[] = [];
  const { ourPick, winner } = comparison;

  // Check 1: Is our pick a "Quitter"?
  if (ourPick.isQuitter) {
    diagnoses.push(`🚨 OUR PICK IS A QUITTER: E1=${ourPick.avgE1}, LP=${ourPick.avgLP}, Fade=${ourPick.fadeDifferential}`);
  }

  // Check 2: Did we give high pace score to a quitter?
  if (ourPick.isQuitter && ourPick.paceScore >= 25) {
    diagnoses.push(`⚠️ REWARDED QUITTER: Pace Score ${ourPick.paceScore} despite ${ourPick.fadeDifferential} pt fade`);
  }

  // Check 3: Tessuto Rule applied to a quitter?
  if (ourPick.tessutoEligible && ourPick.isQuitter) {
    diagnoses.push(`❌ TESSUTO RULE MISAPPLIED: Protected quitter with poor LP (${ourPick.avgLP})`);
  }

  // Check 4: Did winner have better LP?
  if (winner.avgLP !== null && ourPick.avgLP !== null) {
    const lpDiff = winner.avgLP - ourPick.avgLP;
    if (lpDiff > 5) {
      diagnoses.push(`✅ WINNER HAD BETTER LP: ${winner.avgLP} vs ${ourPick.avgLP} (+${lpDiff})`);
    }
  }

  // Check 5: Did winner have closing kick?
  if (winner.hasClosingKick && !ourPick.hasClosingKick) {
    diagnoses.push(`✅ WINNER HAD CLOSING KICK, OUR PICK DID NOT`);
  }

  // Check 6: Running style mismatch
  if (ourPick.styleCode === 'E' && winner.styleCode === 'C') {
    diagnoses.push(`📊 STYLE MISMATCH: We picked E-speed, Closer won`);
  }

  // Check 7: E1 vs LP imbalance in our scoring
  if (ourPick.avgE1 !== null && winner.avgLP !== null && ourPick.avgLP !== null) {
    if (ourPick.avgE1 > ourPick.avgLP && winner.avgLP > ourPick.avgLP) {
      diagnoses.push(`📈 OVERWEIGHTED E1: Our pick's E1 (${ourPick.avgE1}) > LP (${ourPick.avgLP}), Winner LP was ${winner.avgLP}`);
    }
  }

  if (diagnoses.length === 0) {
    diagnoses.push('No obvious pace-related issues detected');
  }

  return diagnoses;
}

// ============================================================================
// MAIN
// ============================================================================

async function runPaceDiagnosis() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PACE DIAGNOSIS: BAD BEAT ANALYSIS                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const comparisons: RaceComparison[] = [];

  for (const badBeat of BAD_BEATS_TO_ANALYZE) {
    const drfPath = path.join(DATA_DIR, `${badBeat.file}.DRF`);

    if (!fs.existsSync(drfPath)) {
      console.log(`❌ File not found: ${drfPath}`);
      continue;
    }

    const drfContent = fs.readFileSync(drfPath, 'utf-8');
    const parseResult = parseDRFFile(drfContent);

    const race = parseResult.races.find(r => r.header.raceNumber === badBeat.race);
    if (!race) {
      console.log(`❌ Race ${badBeat.race} not found in ${badBeat.file}`);
      continue;
    }

    // Calculate scores
    const trackCondition: TrackCondition = {
      surface: race.header.surface,
      condition: race.header.condition || 'fast',
      variant: 0,
    };

    const getOdds = (index: number, defaultOdds: string) => {
      return race.horses[index]?.morningLineOdds || defaultOdds;
    };

    const isScratched = () => false;

    const scoredHorses = calculateRaceScores(
      race.horses,
      race.header,
      getOdds,
      isScratched,
      trackCondition
    );

    // Find our pick and winner
    const ourPickScored = scoredHorses.find(h => h.horse.programNumber === badBeat.ourPick);
    const winnerScored = scoredHorses.find(h => h.horse.programNumber === badBeat.winner);

    if (!ourPickScored || !winnerScored) {
      console.log(`❌ Could not find horses in ${badBeat.file} R${badBeat.race}`);
      continue;
    }

    // Analyze pace for both horses
    const ourPickAnalysis = analyzePaceForHorse(
      ourPickScored.horse,
      ourPickScored.score.breakdown.pace.total,
      4 // They finished 4th or worse
    );

    const winnerAnalysis = analyzePaceForHorse(
      winnerScored.horse,
      winnerScored.score.breakdown.pace.total,
      1
    );

    const comparison: RaceComparison = {
      trackCode: parseResult.trackCode || badBeat.file.substring(0, 3),
      raceNumber: badBeat.race,
      raceDate: parseResult.raceDate || 'unknown',
      distance: race.header.distance,
      surface: race.header.surface,
      ourPick: ourPickAnalysis,
      winner: winnerAnalysis,
      diagnosis: [],
    };

    comparison.diagnosis = diagnoseRace(comparison);
    comparisons.push(comparison);
  }

  // =========================================================================
  // OUTPUT: COMPARISON TABLE
  // =========================================================================

  console.log('\n' + '═'.repeat(100));
  console.log('                           PACE FIGURE COMPARISON: WINNER vs OUR LOSER');
  console.log('═'.repeat(100));

  for (const comp of comparisons) {
    console.log(`\n${'─'.repeat(100)}`);
    console.log(`RACE: ${comp.trackCode} R${comp.raceNumber} | ${comp.distance} ${comp.surface}`);
    console.log(`${'─'.repeat(100)}`);

    // Header
    console.log(`\n${''.padEnd(20)}  | ${'OUR PICK (4th+)'.padEnd(30)} | ${'WINNER'.padEnd(30)}`);
    console.log(`${'─'.repeat(20)}──┼${'─'.repeat(32)}┼${'─'.repeat(32)}`);

    // Horse name
    console.log(`${'Horse'.padEnd(20)}  | ${comp.ourPick.horseName.padEnd(30)} | ${comp.winner.horseName.padEnd(30)}`);

    // Running Style
    const ourStyle = `${comp.ourPick.runningStyle} (${comp.ourPick.styleCode})`;
    const winStyle = `${comp.winner.runningStyle} (${comp.winner.styleCode})`;
    console.log(`${'Running Style'.padEnd(20)}  | ${ourStyle.padEnd(30)} | ${winStyle.padEnd(30)}`);

    // E1 (Early Pace)
    const ourE1 = comp.ourPick.avgE1 !== null ? comp.ourPick.avgE1.toString() : 'N/A';
    const winE1 = comp.winner.avgE1 !== null ? comp.winner.avgE1.toString() : 'N/A';
    console.log(`${'Avg E1 (Early)'.padEnd(20)}  | ${ourE1.padEnd(30)} | ${winE1.padEnd(30)}`);

    // LP (Late Pace)
    const ourLP = comp.ourPick.avgLP !== null ? comp.ourPick.avgLP.toString() : 'N/A';
    const winLP = comp.winner.avgLP !== null ? comp.winner.avgLP.toString() : 'N/A';
    console.log(`${'Avg LP (Late)'.padEnd(20)}  | ${ourLP.padEnd(30)} | ${winLP.padEnd(30)}`);

    // Fade Differential
    const ourFade = comp.ourPick.fadeDifferential !== null
      ? (comp.ourPick.fadeDifferential > 0 ? `+${comp.ourPick.fadeDifferential.toFixed(1)} (FADES)` : comp.ourPick.fadeDifferential.toFixed(1))
      : 'N/A';
    const winFade = comp.winner.fadeDifferential !== null
      ? (comp.winner.fadeDifferential > 0 ? `+${comp.winner.fadeDifferential.toFixed(1)} (FADES)` : `${comp.winner.fadeDifferential.toFixed(1)} (CLOSES)`)
      : 'N/A';
    console.log(`${'E1 - LP (Fade)'.padEnd(20)}  | ${ourFade.padEnd(30)} | ${winFade.padEnd(30)}`);

    // Closing Kick
    const ourKick = comp.ourPick.hasClosingKick ? 'YES' : 'NO';
    const winKick = comp.winner.hasClosingKick ? 'YES' : 'NO';
    console.log(`${'Has Closing Kick'.padEnd(20)}  | ${ourKick.padEnd(30)} | ${winKick.padEnd(30)}`);

    // Pace Score
    console.log(`${'PACE SCORE'.padEnd(20)}  | ${comp.ourPick.paceScore.toString().padEnd(30)} | ${comp.winner.paceScore.toString().padEnd(30)}`);

    // Quitter Status
    const ourQuitter = comp.ourPick.isQuitter ? '🚨 YES - QUITTER' : 'No';
    const winQuitter = comp.winner.isQuitter ? '🚨 YES - QUITTER' : 'No';
    console.log(`${'Is Quitter?'.padEnd(20)}  | ${ourQuitter.padEnd(30)} | ${winQuitter.padEnd(30)}`);

    // Tessuto Eligible
    const ourTessuto = comp.ourPick.tessutoEligible ? 'YES (protected)' : 'No';
    const winTessuto = comp.winner.tessutoEligible ? 'YES (protected)' : 'No';
    console.log(`${'Tessuto Eligible'.padEnd(20)}  | ${ourTessuto.padEnd(30)} | ${winTessuto.padEnd(30)}`);

    // Diagnosis
    console.log(`\n📋 DIAGNOSIS:`);
    for (const d of comp.diagnosis) {
      console.log(`   ${d}`);
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================

  console.log('\n' + '█'.repeat(100));
  console.log('                                   SUMMARY');
  console.log('█'.repeat(100));

  const quitterPicks = comparisons.filter(c => c.ourPick.isQuitter).length;
  const tessutoMisapplied = comparisons.filter(c =>
    c.ourPick.tessutoEligible && c.ourPick.isQuitter
  ).length;
  const winnerBetterLP = comparisons.filter(c =>
    c.winner.avgLP !== null && c.ourPick.avgLP !== null && c.winner.avgLP > c.ourPick.avgLP
  ).length;
  const winnerHadClosingKick = comparisons.filter(c => c.winner.hasClosingKick).length;

  console.log(`\n📊 Bad Beats Analyzed: ${comparisons.length}`);
  console.log(`\n🚨 PROBLEMS FOUND:`);
  console.log(`   • Quitter Picks (E1 - LP > 20): ${quitterPicks}/${comparisons.length}`);
  console.log(`   • Tessuto Rule Misapplied: ${tessutoMisapplied}/${comparisons.length}`);
  console.log(`\n✅ WINNER ADVANTAGES:`);
  console.log(`   • Winner Had Better LP: ${winnerBetterLP}/${comparisons.length}`);
  console.log(`   • Winner Had Closing Kick: ${winnerHadClosingKick}/${comparisons.length}`);

  console.log(`\n${'─'.repeat(100)}`);
  console.log('RECOMMENDATIONS:');
  console.log('─'.repeat(100));
  console.log('1. DECREASE E1/E2 weight by 10-15%');
  console.log('2. INCREASE LP weight by 10-15%');
  console.log('3. IMPLEMENT "Fade Penalty": If E1 - LP > 20, apply -5 to -10 pt penalty');
  console.log('4. REFINE "Tessuto Rule": Only apply if LP > 70 OR race is a Sprint (< 7f)');
  console.log('\n' + '═'.repeat(100) + '\n');
}

// Run diagnosis
runPaceDiagnosis().catch(console.error);
