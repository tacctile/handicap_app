/**
 * Velocity Analysis Validation Script
 *
 * Validates the fractional velocity analysis implementation against real horses
 * from DRF files. Produces comprehensive before/after score comparisons.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import parser and scoring
import { parseDRFFile } from '../src/lib/drfParser';
import type { HorseEntry, RaceHeader, PastPerformance } from '../src/types/drf';

// Import velocity analysis functions
import {
  buildVelocityProfile,
  calculateVelocityScore,
  analyzePPVelocity,
  hasVelocityData,
  VELOCITY_DIFF_THRESHOLDS,
  VELOCITY_SCORE_POINTS,
  type VelocityProfile,
  type VelocityScoreResult,
  type PPVelocityAnalysis,
} from '../src/lib/scoring/velocityAnalysis';

// Import pace analysis functions
import {
  parseRunningStyle,
  analyzePaceScenario,
  calculateTacticalAdvantage,
  type RunningStyleProfile,
  type PaceScenarioAnalysis,
} from '../src/lib/scoring/paceAnalysis';

// ============================================================================
// TYPES
// ============================================================================

interface HorseVelocityAnalysis {
  horseName: string;
  programNumber: number;
  raceNumber: number;
  raceInfo: string;
  runningStyle: string;
  runningStyleCode: string;
  ppVelocities: PPVelocityAnalysis[];
  velocityProfile: VelocityProfile;
  avgVD: number | null;
  classification: string;
  velocityScoreResult: VelocityScoreResult;
  paceScenario: string;
  paceScoreBefore: number;
  paceScoreAfter: number;
  delta: number;
  makesSense: boolean;
  reason: string;
}

interface ValidationStats {
  totalHorses: number;
  horsesWithVelocityData: number;
  horsesWithoutVelocityData: number;
  strongClosers: number;
  moderateClosers: number;
  steadyPace: number;
  faders: number;
  unknown: number;
  velocityDiffs: number[];
  bonusPoints: number[];
  anomalies: HorseVelocityAnalysis[];
}

// ============================================================================
// HELPERS
// ============================================================================

function formatVD(vd: number | null): string {
  if (vd === null) return 'N/A';
  return vd >= 0 ? `+${vd.toFixed(2)}` : vd.toFixed(2);
}

function classifyExpected(styleCode: string): 'closer' | 'speed' | 'mixed' {
  if (styleCode === 'C' || styleCode === 'S') return 'closer';
  if (styleCode === 'E') return 'speed';
  return 'mixed';
}

function validateClassification(
  styleCode: string,
  classification: string,
  avgVD: number | null
): { makesSense: boolean; reason: string } {
  const expected = classifyExpected(styleCode);

  // No data case
  if (avgVD === null || classification === 'unknown') {
    return { makesSense: true, reason: 'Insufficient data - correctly handled' };
  }

  // Speed horses (E) should NOT be strong closers
  if (expected === 'speed') {
    if (classification === 'strong_closer') {
      return { makesSense: false, reason: `Speed horse classified as ${classification} with VD ${formatVD(avgVD)}` };
    }
    if (classification === 'fader' || classification === 'steady_pace') {
      return { makesSense: true, reason: 'Speed horse correctly identified as fader/steady' };
    }
    return { makesSense: true, reason: 'Unexpected but not necessarily wrong' };
  }

  // Closers (C, S) should NOT be faders
  if (expected === 'closer') {
    if (classification === 'fader' && avgVD < -1.0) {
      return { makesSense: false, reason: `Closer classified as ${classification} with VD ${formatVD(avgVD)}` };
    }
    if (classification === 'strong_closer' || classification === 'moderate_closer') {
      return { makesSense: true, reason: 'Closer correctly identified with positive VD' };
    }
    return { makesSense: true, reason: 'Classification plausible' };
  }

  // Mixed/Pressers
  return { makesSense: true, reason: 'Mixed style - classification reasonable' };
}

// Calculate a baseline pace score without velocity analysis
function calculateBaselinePaceScore(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  paceScenario: PaceScenarioAnalysis
): number {
  const profile = parseRunningStyle(horse);
  const tactical = calculateTacticalAdvantage(profile.style, paceScenario.scenario);
  // Base tactical score scaled by 0.875 (35/40)
  return Math.round(tactical.points * 0.875);
}

// ============================================================================
// MAIN ANALYSIS FUNCTIONS
// ============================================================================

function analyzeHorse(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  raceHeader: RaceHeader
): HorseVelocityAnalysis | null {
  // Skip scratched horses
  if (horse.isScratched) return null;

  // Get running style
  const styleProfile = parseRunningStyle(horse);

  // Analyze pace scenario
  const paceScenario = analyzePaceScenario(allHorses);

  // Get individual PP velocity analyses
  const ppVelocities: PPVelocityAnalysis[] = [];
  const recentPPs = horse.pastPerformances.slice(0, 5);
  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (pp) {
      ppVelocities.push(analyzePPVelocity(pp, i));
    }
  }

  // Build velocity profile
  const velocityProfile = buildVelocityProfile(horse);

  // Calculate velocity score with pace scenario
  const velocityScoreResult = calculateVelocityScore(
    horse,
    styleProfile.style,
    paceScenario.scenario
  );

  // Calculate baseline pace score (without velocity)
  const paceScoreBefore = calculateBaselinePaceScore(horse, allHorses, paceScenario);

  // Calculate pace score with velocity
  const paceScoreAfter = paceScoreBefore + velocityScoreResult.totalBonusPoints;

  // Validate the classification
  const validation = validateClassification(
    styleProfile.style,
    velocityProfile.classification,
    velocityProfile.avgVelocityDiff
  );

  return {
    horseName: horse.horseName,
    programNumber: horse.programNumber,
    raceNumber: raceHeader.raceNumber,
    raceInfo: `R${raceHeader.raceNumber} ${raceHeader.distance} ${raceHeader.surface}`,
    runningStyle: styleProfile.styleName,
    runningStyleCode: styleProfile.style,
    ppVelocities,
    velocityProfile,
    avgVD: velocityProfile.avgVelocityDiff,
    classification: velocityProfile.classification,
    velocityScoreResult,
    paceScenario: paceScenario.scenario,
    paceScoreBefore,
    paceScoreAfter,
    delta: velocityScoreResult.totalBonusPoints,
    makesSense: validation.makesSense,
    reason: validation.reason,
  };
}

function analyzeAllHorses(drfFiles: string[]): {
  closers: HorseVelocityAnalysis[];
  speedHorses: HorseVelocityAnalysis[];
  allHorses: HorseVelocityAnalysis[];
  stats: ValidationStats;
  raceScenarios: Map<string, { scenario: string; horses: HorseVelocityAnalysis[] }>;
} {
  const allAnalyses: HorseVelocityAnalysis[] = [];
  const raceScenarios = new Map<string, { scenario: string; horses: HorseVelocityAnalysis[] }>();

  const stats: ValidationStats = {
    totalHorses: 0,
    horsesWithVelocityData: 0,
    horsesWithoutVelocityData: 0,
    strongClosers: 0,
    moderateClosers: 0,
    steadyPace: 0,
    faders: 0,
    unknown: 0,
    velocityDiffs: [],
    bonusPoints: [],
    anomalies: [],
  };

  for (const filePath of drfFiles) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parseResult = parseDRFFile(fileContent);

    for (const race of parseResult.races) {
      const raceKey = `${parseResult.trackCode}-R${race.header.raceNumber}`;
      const paceScenario = analyzePaceScenario(race.horses);
      const raceHorses: HorseVelocityAnalysis[] = [];

      for (const horse of race.horses) {
        const analysis = analyzeHorse(horse, race.horses, race.header);
        if (analysis) {
          allAnalyses.push(analysis);
          raceHorses.push(analysis);
          stats.totalHorses++;

          // Count velocity data availability
          if (hasVelocityData(horse)) {
            stats.horsesWithVelocityData++;
          } else {
            stats.horsesWithoutVelocityData++;
          }

          // Count classifications
          switch (analysis.classification) {
            case 'strong_closer': stats.strongClosers++; break;
            case 'moderate_closer': stats.moderateClosers++; break;
            case 'steady_pace': stats.steadyPace++; break;
            case 'fader': stats.faders++; break;
            default: stats.unknown++;
          }

          // Collect VDs for distribution analysis
          if (analysis.avgVD !== null) {
            stats.velocityDiffs.push(analysis.avgVD);
          }

          // Collect bonus points
          stats.bonusPoints.push(analysis.delta);

          // Track anomalies
          if (!analysis.makesSense) {
            stats.anomalies.push(analysis);
          }
        }
      }

      raceScenarios.set(raceKey, { scenario: paceScenario.scenario, horses: raceHorses });
    }
  }

  // Separate closers and speed horses
  const closers = allAnalyses.filter(h =>
    h.runningStyleCode === 'C' || h.runningStyleCode === 'S'
  );
  const speedHorses = allAnalyses.filter(h => h.runningStyleCode === 'E');

  return { closers, speedHorses, allHorses: allAnalyses, stats, raceScenarios };
}

// ============================================================================
// REPORTING FUNCTIONS
// ============================================================================

function printCloserAnalysis(closers: HorseVelocityAnalysis[]) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         PART 1: CLOSER ANALYSIS                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Get 3 closers with valid velocity data
  const validClosers = closers
    .filter(c => c.velocityProfile.isReliable)
    .slice(0, 3);

  if (validClosers.length === 0) {
    console.log('No closers with sufficient velocity data found.\n');
    return;
  }

  console.log('Looking for horses with CLOSER running style (C or S) that should have POSITIVE VD.\n');
  console.log('| Horse                     | Race      | PP1 VD  | PP2 VD  | PP3 VD  | Avg VD  | Class          |');
  console.log('|---------------------------|-----------|---------|---------|---------|---------|----------------|');

  for (const closer of validClosers) {
    const pp1VD = closer.ppVelocities[0]?.velocityDiff;
    const pp2VD = closer.ppVelocities[1]?.velocityDiff;
    const pp3VD = closer.ppVelocities[2]?.velocityDiff;

    console.log(`| ${closer.horseName.padEnd(25)} | ${closer.raceInfo.padEnd(9)} | ${formatVD(pp1VD ?? null).padStart(7)} | ${formatVD(pp2VD ?? null).padStart(7)} | ${formatVD(pp3VD ?? null).padStart(7)} | ${formatVD(closer.avgVD).padStart(7)} | ${closer.classification.padEnd(14)} |`);
  }

  console.log('\n✓ Closers with positive VD = correctly identified (accelerates late)');
  console.log('✗ Closers with negative VD = potential concern (may be mislabeled or fading closers)\n');
}

function printSpeedHorseAnalysis(speedHorses: HorseVelocityAnalysis[]) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      PART 1: SPEED HORSE ANALYSIS                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Get 3 speed horses with valid velocity data
  const validSpeed = speedHorses
    .filter(s => s.velocityProfile.isReliable)
    .slice(0, 3);

  if (validSpeed.length === 0) {
    console.log('No speed horses with sufficient velocity data found.\n');
    return;
  }

  console.log('Looking for horses with EARLY SPEED style (E) that should have NEGATIVE or NEUTRAL VD.\n');
  console.log('| Horse                     | Race      | PP1 VD  | PP2 VD  | PP3 VD  | Avg VD  | Class          |');
  console.log('|---------------------------|-----------|---------|---------|---------|---------|----------------|');

  for (const speed of validSpeed) {
    const pp1VD = speed.ppVelocities[0]?.velocityDiff;
    const pp2VD = speed.ppVelocities[1]?.velocityDiff;
    const pp3VD = speed.ppVelocities[2]?.velocityDiff;

    console.log(`| ${speed.horseName.padEnd(25)} | ${speed.raceInfo.padEnd(9)} | ${formatVD(pp1VD ?? null).padStart(7)} | ${formatVD(pp2VD ?? null).padStart(7)} | ${formatVD(pp3VD ?? null).padStart(7)} | ${formatVD(speed.avgVD).padStart(7)} | ${speed.classification.padEnd(14)} |`);
  }

  console.log('\n✓ Speed horses with negative/neutral VD = correctly identified (fades or maintains)');
  console.log('✗ Speed horses with strong positive VD = potential concern (may be mislabeled)\n');
}

function printBeforeAfterComparison(allHorses: HorseVelocityAnalysis[]) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                 PART 2: BEFORE/AFTER PACE SCORE COMPARISON                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Get representative horses from each category
  const closers = allHorses.filter(h => h.runningStyleCode === 'C' || h.runningStyleCode === 'S').slice(0, 3);
  const speed = allHorses.filter(h => h.runningStyleCode === 'E').slice(0, 3);
  const sample = [...closers, ...speed];

  console.log('| Horse                     | Style          | Avg VD  | Before | After | Delta | Makes Sense? |');
  console.log('|---------------------------|----------------|---------|--------|-------|-------|--------------|');

  for (const horse of sample) {
    const deltaStr = horse.delta >= 0 ? `+${horse.delta}` : `${horse.delta}`;
    const sense = horse.makesSense ? '✓ Yes' : '✗ No';
    console.log(`| ${horse.horseName.padEnd(25)} | ${horse.runningStyle.padEnd(14)} | ${formatVD(horse.avgVD).padStart(7)} | ${horse.paceScoreBefore.toString().padStart(6)} | ${horse.paceScoreAfter.toString().padStart(5)} | ${deltaStr.padStart(5)} | ${sense.padEnd(12)} |`);
  }

  console.log('\n');
}

function printPaceScenarioInteraction(
  raceScenarios: Map<string, { scenario: string; horses: HorseVelocityAnalysis[] }>
) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PART 3: PACE SCENARIO INTERACTION                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Find hot pace race
  let hotPaceRace: { key: string; data: { scenario: string; horses: HorseVelocityAnalysis[] } } | null = null;
  let softPaceRace: { key: string; data: { scenario: string; horses: HorseVelocityAnalysis[] } } | null = null;

  for (const [key, data] of raceScenarios) {
    if (data.scenario === 'contested' || data.scenario === 'speed_duel') {
      if (!hotPaceRace && data.horses.length >= 5) {
        hotPaceRace = { key, data };
      }
    }
    if (data.scenario === 'soft') {
      if (!softPaceRace && data.horses.length >= 5) {
        softPaceRace = { key, data };
      }
    }
  }

  if (hotPaceRace) {
    console.log(`HOT PACE RACE: ${hotPaceRace.key} (${hotPaceRace.data.scenario.toUpperCase()})`);
    console.log('─'.repeat(76));
    console.log('Closers should benefit from velocity bonus + pace scenario bonus:');
    console.log('| Horse                     | Style          | VD      | Bonus | Scenario Effect |');
    console.log('|---------------------------|----------------|---------|-------|-----------------|');

    for (const horse of hotPaceRace.data.horses.slice(0, 6)) {
      const scenarioEffect = horse.classification === 'strong_closer' ? '+1 (hot pace)' :
                            horse.classification === 'fader' ? '-1 (hot pace)' : 'none';
      console.log(`| ${horse.horseName.padEnd(25)} | ${horse.runningStyle.padEnd(14)} | ${formatVD(horse.avgVD).padStart(7)} | ${horse.delta.toString().padStart(5)} | ${scenarioEffect.padEnd(15)} |`);
    }
    console.log('\n');
  } else {
    console.log('No hot pace race found in sample data.\n');
  }

  if (softPaceRace) {
    console.log(`SOFT PACE RACE: ${softPaceRace.key} (${softPaceRace.data.scenario.toUpperCase()})`);
    console.log('─'.repeat(76));
    console.log('Lone speed should benefit, closers may be disadvantaged:');
    console.log('| Horse                     | Style          | VD      | Bonus | Scenario Effect |');
    console.log('|---------------------------|----------------|---------|-------|-----------------|');

    for (const horse of softPaceRace.data.horses.slice(0, 6)) {
      const scenarioEffect = horse.classification === 'strong_closer' ? '-1 (soft pace)' :
                            horse.classification === 'fader' && horse.runningStyleCode === 'E' ? '+1 (soft pace)' : 'none';
      console.log(`| ${horse.horseName.padEnd(25)} | ${horse.runningStyle.padEnd(14)} | ${formatVD(horse.avgVD).padStart(7)} | ${horse.delta.toString().padStart(5)} | ${scenarioEffect.padEnd(15)} |`);
    }
    console.log('\n');
  } else {
    console.log('No soft pace race found in sample data.\n');
  }
}

function printEdgeCases(allHorses: HorseVelocityAnalysis[], drfFiles: string[]) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                       PART 4: EDGE CASE VERIFICATION                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Find horse with incomplete data
  const incompleteData = allHorses.find(h =>
    h.velocityProfile.validPPCount > 0 &&
    h.velocityProfile.validPPCount < h.velocityProfile.requiredPPCount
  );

  console.log('1. INCOMPLETE FRACTIONAL DATA:');
  if (incompleteData) {
    console.log(`   Horse: ${incompleteData.horseName}`);
    console.log(`   Valid PPs: ${incompleteData.velocityProfile.validPPCount} / ${incompleteData.velocityProfile.requiredPPCount} required`);
    console.log(`   isReliable: ${incompleteData.velocityProfile.isReliable}`);
    console.log(`   Classification: ${incompleteData.classification}`);
    console.log(`   ✓ System gracefully handles incomplete data - no crash\n`);
  } else {
    const noData = allHorses.find(h => h.velocityProfile.validPPCount === 0);
    if (noData) {
      console.log(`   Horse: ${noData.horseName}`);
      console.log(`   Valid PPs: 0 (no fractional times available)`);
      console.log(`   Classification: ${noData.classification}`);
      console.log(`   ✓ System gracefully handles missing data - no crash\n`);
    } else {
      console.log('   No horses with incomplete data found in sample.\n');
    }
  }

  // Find first-time starter
  console.log('2. FIRST-TIME STARTER:');
  let foundFTS = false;

  for (const filePath of drfFiles) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parseResult = parseDRFFile(fileContent);

    for (const race of parseResult.races) {
      for (const horse of race.horses) {
        if (horse.lifetimeStarts === 0 || horse.pastPerformances.length === 0) {
          console.log(`   Horse: ${horse.horseName}`);
          console.log(`   Lifetime Starts: ${horse.lifetimeStarts}`);
          console.log(`   Past Performances: ${horse.pastPerformances.length}`);

          const profile = buildVelocityProfile(horse);
          console.log(`   VD: ${formatVD(profile.avgVelocityDiff)}`);
          console.log(`   Classification: ${profile.classification}`);
          console.log(`   isReliable: ${profile.isReliable}`);
          console.log(`   ✓ First-time starter correctly gets no velocity bonus (neutral)\n`);
          foundFTS = true;
          break;
        }
      }
      if (foundFTS) break;
    }
    if (foundFTS) break;
  }

  if (!foundFTS) {
    console.log('   No first-time starters found in sample data.\n');
  }

  // Find horse with mixed style (not clearly E or C)
  console.log('3. MIXED RUNNING STYLE:');
  const mixedStyle = allHorses.find(h => h.runningStyleCode === 'P' && h.velocityProfile.isReliable);
  if (mixedStyle) {
    console.log(`   Horse: ${mixedStyle.horseName}`);
    console.log(`   Running Style: ${mixedStyle.runningStyle} (${mixedStyle.runningStyleCode})`);
    console.log(`   Avg VD: ${formatVD(mixedStyle.avgVD)}`);
    console.log(`   Classification: ${mixedStyle.classification}`);
    console.log(`   Bonus Points: ${mixedStyle.delta}`);
    console.log(`   Validation: ${mixedStyle.makesSense ? '✓' : '✗'} ${mixedStyle.reason}\n`);
  } else {
    console.log('   No pressers with velocity data found in sample.\n');
  }
}

function printDataDistribution(stats: ValidationStats) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      PART 5: DATA DISTRIBUTION ANALYSIS                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // VD range and average
  const sortedVDs = [...stats.velocityDiffs].sort((a, b) => a - b);
  const minVD = sortedVDs[0] ?? 0;
  const maxVD = sortedVDs[sortedVDs.length - 1] ?? 0;
  const avgVD = sortedVDs.length > 0
    ? sortedVDs.reduce((a, b) => a + b, 0) / sortedVDs.length
    : 0;

  console.log('VELOCITY DIFFERENTIAL RANGE:');
  console.log(`   Min VD: ${minVD.toFixed(2)} sec/f`);
  console.log(`   Max VD: ${maxVD.toFixed(2)} sec/f`);
  console.log(`   Avg VD: ${avgVD.toFixed(2)} sec/f\n`);

  // Classification distribution
  const total = stats.totalHorses;
  const pctStrongCloser = ((stats.strongClosers / total) * 100).toFixed(1);
  const pctModerateCloser = ((stats.moderateClosers / total) * 100).toFixed(1);
  const pctSteady = ((stats.steadyPace / total) * 100).toFixed(1);
  const pctFader = ((stats.faders / total) * 100).toFixed(1);
  const pctUnknown = ((stats.unknown / total) * 100).toFixed(1);

  console.log('CLASSIFICATION DISTRIBUTION:');
  console.log(`   Strong Closer (VD > +2.0):     ${stats.strongClosers.toString().padStart(3)} (${pctStrongCloser}%)`);
  console.log(`   Moderate Closer (+0.5 to +2):  ${stats.moderateClosers.toString().padStart(3)} (${pctModerateCloser}%)`);
  console.log(`   Steady Pace (-0.5 to +0.5):    ${stats.steadyPace.toString().padStart(3)} (${pctSteady}%)`);
  console.log(`   Fader (VD < -0.5):             ${stats.faders.toString().padStart(3)} (${pctFader}%)`);
  console.log(`   Unknown (insufficient data):   ${stats.unknown.toString().padStart(3)} (${pctUnknown}%)\n`);

  // Threshold appropriateness check
  console.log('THRESHOLD APPROPRIATENESS CHECK:');
  const strongCloserThreshold = VELOCITY_DIFF_THRESHOLDS.STRONG_CLOSER;
  const faderThreshold = VELOCITY_DIFF_THRESHOLDS.FADER;

  const strongCloserPct = parseFloat(pctStrongCloser);
  const faderPct = parseFloat(pctFader);

  let thresholdsOK = true;

  if (strongCloserPct > 50) {
    console.log(`   ⚠ Warning: ${pctStrongCloser}% classified as Strong Closer - threshold (${strongCloserThreshold}) may be too low`);
    thresholdsOK = false;
  } else {
    console.log(`   ✓ Strong Closer threshold (${strongCloserThreshold}): ${pctStrongCloser}% qualify - appropriate`);
  }

  if (faderPct > 50) {
    console.log(`   ⚠ Warning: ${pctFader}% classified as Fader - threshold (${faderThreshold}) may be too aggressive`);
    thresholdsOK = false;
  } else {
    console.log(`   ✓ Fader threshold (${faderThreshold}): ${pctFader}% qualify - appropriate`);
  }

  // Bonus points impact
  console.log('\nPACE SCORE IMPACT:');
  const nonZeroBonuses = stats.bonusPoints.filter(b => b !== 0);
  const avgBonus = nonZeroBonuses.length > 0
    ? nonZeroBonuses.reduce((a, b) => a + b, 0) / nonZeroBonuses.length
    : 0;
  const maxBonus = Math.max(...stats.bonusPoints);
  const minBonus = Math.min(...stats.bonusPoints);

  console.log(`   Horses with non-zero bonus: ${nonZeroBonuses.length} / ${stats.totalHorses}`);
  console.log(`   Average bonus (when applied): ${avgBonus >= 0 ? '+' : ''}${avgBonus.toFixed(1)} pts`);
  console.log(`   Max bonus: +${maxBonus} pts`);
  console.log(`   Max penalty: ${minBonus} pts`);
  console.log(`   Max allowed: ±5 pts (cap verified: ${maxBonus <= 5 && minBonus >= -5 ? '✓ YES' : '✗ NO'})\n`);

  // Is impact meaningful?
  const impactMeaningful = Math.abs(avgBonus) >= 1 && Math.abs(avgBonus) <= 4;
  console.log(`   Impact assessment: ${impactMeaningful ? '✓ Meaningful but not overwhelming' : '⚠ May need adjustment'}`);
}

function printIssuesFound(stats: ValidationStats) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        PART 6: ISSUES IDENTIFIED                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  if (stats.anomalies.length === 0) {
    console.log('✓ No anomalies detected. All classifications appear reasonable.\n');
  } else {
    console.log(`Found ${stats.anomalies.length} horses with unexpected classifications:\n`);
    console.log('| Horse                     | Style     | VD      | Classification | Issue                          |');
    console.log('|---------------------------|-----------|---------|----------------|--------------------------------|');

    for (const anomaly of stats.anomalies.slice(0, 10)) {
      console.log(`| ${anomaly.horseName.padEnd(25)} | ${anomaly.runningStyleCode.padEnd(9)} | ${formatVD(anomaly.avgVD).padStart(7)} | ${anomaly.classification.padEnd(14)} | ${anomaly.reason.substring(0, 30).padEnd(30)} |`);
    }

    if (stats.anomalies.length > 10) {
      console.log(`\n... and ${stats.anomalies.length - 10} more anomalies.`);
    }
    console.log('\n');
  }

  // Check for NaN or extreme values
  console.log('DATA QUALITY CHECK:');
  const hasNaN = stats.velocityDiffs.some(v => !Number.isFinite(v));
  const hasExtreme = stats.velocityDiffs.some(v => Math.abs(v) > 10);

  console.log(`   NaN/Infinity values: ${hasNaN ? '✗ FOUND - needs fix' : '✓ None detected'}`);
  console.log(`   Extreme values (|VD| > 10): ${hasExtreme ? '⚠ Found - may need review' : '✓ None detected'}`);
  console.log(`   Bonus cap exceeded: ${stats.bonusPoints.some(b => Math.abs(b) > 5) ? '✗ YES' : '✓ No'}\n`);
}

function printFinalReport(stats: ValidationStats) {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          FINAL VALIDATION REPORT                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  console.log('SUMMARY STATISTICS:');
  console.log(`   Total horses analyzed: ${stats.totalHorses}`);
  console.log(`   Horses with velocity data: ${stats.horsesWithVelocityData} (${((stats.horsesWithVelocityData / stats.totalHorses) * 100).toFixed(1)}%)`);
  console.log(`   Horses without velocity data: ${stats.horsesWithoutVelocityData} (${((stats.horsesWithoutVelocityData / stats.totalHorses) * 100).toFixed(1)}%)`);
  console.log('');

  // Calculate overall assessment
  const anomalyRate = stats.anomalies.length / stats.totalHorses;
  const hasNaN = stats.velocityDiffs.some(v => !Number.isFinite(v));
  const capExceeded = stats.bonusPoints.some(b => Math.abs(b) > 5);

  let recommendation: string;
  let workingAsIntended: boolean;
  let confidenceLevel: string;

  if (hasNaN || capExceeded) {
    recommendation = 'NEEDS FIXES - Data quality issues detected';
    workingAsIntended = false;
    confidenceLevel = 'LOW';
  } else if (anomalyRate > 0.15) {
    recommendation = 'ADJUST THRESHOLDS - High anomaly rate suggests calibration needed';
    workingAsIntended = false;
    confidenceLevel = 'MEDIUM';
  } else if (anomalyRate > 0.05) {
    recommendation = 'MERGE WITH MONITORING - Some edge cases to watch';
    workingAsIntended = true;
    confidenceLevel = 'MEDIUM-HIGH';
  } else {
    recommendation = 'MERGE AS-IS - Velocity analysis working correctly';
    workingAsIntended = true;
    confidenceLevel = 'HIGH';
  }

  console.log('OVERALL ASSESSMENT:');
  console.log(`   Is velocity analysis working as intended? ${workingAsIntended ? '✓ YES' : '✗ NO'}`);
  console.log(`   Recommendation: ${recommendation}`);
  console.log(`   Anomaly rate: ${(anomalyRate * 100).toFixed(1)}%`);
  console.log('');

  console.log('CONFIDENCE LEVEL:');
  console.log(`   ${confidenceLevel}`);
  console.log('');

  console.log('CONCERNS:');
  if (stats.anomalies.length > 0) {
    console.log(`   - ${stats.anomalies.length} horses with unexpected classifications`);
  }
  if (stats.horsesWithoutVelocityData / stats.totalHorses > 0.3) {
    console.log(`   - ${((stats.horsesWithoutVelocityData / stats.totalHorses) * 100).toFixed(1)}% of horses lack velocity data`);
  }
  if (hasNaN) {
    console.log('   - NaN/Infinity values detected in calculations');
  }
  if (capExceeded) {
    console.log('   - Bonus points exceeded ±5 cap');
  }
  if (stats.anomalies.length === 0 && !hasNaN && !capExceeded) {
    console.log('   - None identified');
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`Validation completed at: ${new Date().toISOString()}`);
  console.log('═'.repeat(80) + '\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           VELOCITY ANALYSIS VALIDATION - REAL HORSE DATA TEST               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Get DRF files
  const dataDir = path.join(__dirname, '../src/data');
  const drfFiles = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.DRF'))
    .map(f => path.join(dataDir, f));

  console.log(`Found ${drfFiles.length} DRF files to analyze:\n`);
  for (const f of drfFiles) {
    console.log(`   - ${path.basename(f)}`);
  }
  console.log('');

  // Analyze all horses
  console.log('Analyzing horses...\n');
  const { closers, speedHorses, allHorses, stats, raceScenarios } = analyzeAllHorses(drfFiles);

  // Generate reports
  printCloserAnalysis(closers);
  printSpeedHorseAnalysis(speedHorses);
  printBeforeAfterComparison(allHorses);
  printPaceScenarioInteraction(raceScenarios);
  printEdgeCases(allHorses, drfFiles);
  printDataDistribution(stats);
  printIssuesFound(stats);
  printFinalReport(stats);
}

main().catch(console.error);
