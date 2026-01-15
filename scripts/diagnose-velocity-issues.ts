/**
 * Velocity Analysis Diagnostic Script
 *
 * Deep investigation into extreme VD values and anomalies
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { parseDRFFile } from '../src/lib/drfParser';
import type { HorseEntry, PastPerformance } from '../src/types/drf';

import {
  buildVelocityProfile,
  analyzePPVelocity,
  hasVelocityData,
} from '../src/lib/scoring/velocityAnalysis';

import { parseRunningStyle } from '../src/lib/scoring/paceAnalysis';

// ============================================================================
// DIAGNOSTIC FUNCTIONS
// ============================================================================

function diagnoseHorse(horse: HorseEntry, showAll: boolean = false): void {
  console.log('\n' + '═'.repeat(80));
  console.log(`HORSE: ${horse.horseName}`);
  console.log('═'.repeat(80));

  // Running style from DRF
  const styleProfile = parseRunningStyle(horse);
  console.log(`\nDRF Running Style: ${styleProfile.style} (${styleProfile.styleName})`);
  console.log(`Confidence: ${styleProfile.confidence}%`);

  // Show PP details
  console.log('\n─── PAST PERFORMANCE FRACTIONAL TIMES ───');
  console.log('PP# | Date     | Dist   | Surf | 1/4 Time | 1/2 Time | 6f Time  | Mile Time| Final    | Early Rate | Late Rate | VD');
  console.log('────|──────────|────────|──────|──────────|──────────|──────────|──────────|──────────|────────────|───────────|────────');

  const recentPPs = horse.pastPerformances.slice(0, showAll ? 10 : 5);

  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (!pp) continue;

    const ppAnalysis = analyzePPVelocity(pp, i);

    const formatTime = (t: number | null) => t !== null ? t.toFixed(2).padStart(8) : '    N/A ';
    const formatRate = (r: number | null) => r !== null ? r.toFixed(2).padStart(10) : '      N/A ';
    const formatVD = (v: number | null) => {
      if (v === null) return '    N/A';
      return (v >= 0 ? '+' : '') + v.toFixed(2);
    };

    console.log(
      `${(i + 1).toString().padStart(3)} | ${pp.date.padEnd(8)} | ${pp.distanceFurlongs.toFixed(2).padStart(5)}f | ${pp.surface.padEnd(4)} | ` +
      `${formatTime(pp.quarterTime)} | ${formatTime(pp.halfMileTime)} | ${formatTime(pp.sixFurlongTime)} | ${formatTime(pp.mileTime)} | ` +
      `${formatTime(pp.finalTime)} | ${formatRate(ppAnalysis.earlyPaceRate)} | ${formatRate(ppAnalysis.latePaceRate)} | ${formatVD(ppAnalysis.velocityDiff).padStart(7)}`
    );
  }

  // Overall velocity profile
  const profile = buildVelocityProfile(horse);
  console.log('\n─── VELOCITY PROFILE SUMMARY ───');
  console.log(`Valid PPs for analysis: ${profile.validPPCount}`);
  console.log(`Is Reliable: ${profile.isReliable}`);
  console.log(`Average VD: ${profile.avgVelocityDiff !== null ? (profile.avgVelocityDiff >= 0 ? '+' : '') + profile.avgVelocityDiff.toFixed(2) : 'N/A'}`);
  console.log(`Classification: ${profile.classification}`);
  console.log(`Trend: ${profile.trend}`);
  console.log(`Description: ${profile.description}`);

  // Identify potential issues
  console.log('\n─── DIAGNOSTIC NOTES ───');

  // Check for extreme VD values
  let hasExtremeVD = false;
  for (let i = 0; i < recentPPs.length; i++) {
    const pp = recentPPs[i];
    if (!pp) continue;
    const ppAnalysis = analyzePPVelocity(pp, i);
    if (ppAnalysis.velocityDiff !== null && Math.abs(ppAnalysis.velocityDiff) > 10) {
      hasExtremeVD = true;
      console.log(`⚠ PP${i + 1}: Extreme VD of ${ppAnalysis.velocityDiff.toFixed(2)} - check distance/times`);

      // Diagnose why
      if (ppAnalysis.earlyPaceRate !== null && ppAnalysis.latePaceRate !== null) {
        console.log(`   Early Rate: ${ppAnalysis.earlyPaceRate.toFixed(2)} sec/f, Late Rate: ${ppAnalysis.latePaceRate.toFixed(2)} sec/f`);
        if (ppAnalysis.latePaceRate < 10) {
          console.log(`   ⚠ Suspiciously fast late pace rate - may be calculation error`);
        }
        if (ppAnalysis.earlyPaceRate > 20) {
          console.log(`   ⚠ Suspiciously slow early pace rate - may be calculation error`);
        }
      }
    }
  }

  // Check for mismatch between running style and VD
  if (profile.avgVelocityDiff !== null && profile.isReliable) {
    if (styleProfile.style === 'E' && profile.avgVelocityDiff > 2.0) {
      console.log(`⚠ MISMATCH: DRF says Early Speed but VD suggests closer (VD > +2.0)`);
      console.log(`   This could mean:`);
      console.log(`   1. Horse has changed running style recently`);
      console.log(`   2. DRF classification is outdated`);
      console.log(`   3. Horse is versatile (can run from front or close)`);
    }
    if ((styleProfile.style === 'C' || styleProfile.style === 'S') && profile.avgVelocityDiff < -1.0) {
      console.log(`⚠ MISMATCH: DRF says Closer but VD suggests fader (VD < -1.0)`);
      console.log(`   This could mean:`);
      console.log(`   1. Horse is a "grinding closer" that doesn't accelerate`);
      console.log(`   2. Recent poor form/tired races`);
      console.log(`   3. DRF classification may be inaccurate`);
    }
  }

  if (!hasExtremeVD && profile.isReliable) {
    console.log(`✓ All VD values within reasonable range`);
  }
}

function findProblematicHorses(drfFiles: string[]): void {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   VELOCITY ANALYSIS DIAGNOSTIC REPORT                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const extremeVDHorses: { horse: HorseEntry; avgVD: number; style: string }[] = [];
  const mismatchHorses: { horse: HorseEntry; avgVD: number; style: string; issue: string }[] = [];

  for (const filePath of drfFiles) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parseResult = parseDRFFile(fileContent);

    for (const race of parseResult.races) {
      for (const horse of race.horses) {
        if (horse.isScratched) continue;

        const styleProfile = parseRunningStyle(horse);
        const velocityProfile = buildVelocityProfile(horse);

        if (velocityProfile.avgVelocityDiff !== null) {
          // Check for extreme values
          if (Math.abs(velocityProfile.avgVelocityDiff) > 10) {
            extremeVDHorses.push({
              horse,
              avgVD: velocityProfile.avgVelocityDiff,
              style: styleProfile.style,
            });
          }

          // Check for mismatches
          if (styleProfile.style === 'E' && velocityProfile.avgVelocityDiff > 2.0) {
            mismatchHorses.push({
              horse,
              avgVD: velocityProfile.avgVelocityDiff,
              style: styleProfile.style,
              issue: 'Early Speed horse with strong closer VD',
            });
          }
          if ((styleProfile.style === 'C' || styleProfile.style === 'S') && velocityProfile.avgVelocityDiff < -2.0) {
            mismatchHorses.push({
              horse,
              avgVD: velocityProfile.avgVelocityDiff,
              style: styleProfile.style,
              issue: 'Closer with strong fader VD',
            });
          }
        }
      }
    }
  }

  // Report extreme VD horses
  console.log('\n═══ HORSES WITH EXTREME VD VALUES (|VD| > 10) ═══\n');
  if (extremeVDHorses.length === 0) {
    console.log('None found.\n');
  } else {
    console.log(`Found ${extremeVDHorses.length} horses with extreme VD values.\n`);
    // Show top 5 most extreme
    const sorted = [...extremeVDHorses].sort((a, b) => Math.abs(b.avgVD) - Math.abs(a.avgVD));
    for (const item of sorted.slice(0, 5)) {
      diagnoseHorse(item.horse, false);
    }
  }

  // Report mismatches
  console.log('\n═══ STYLE/VD MISMATCHES (Sample) ═══\n');
  if (mismatchHorses.length === 0) {
    console.log('No significant mismatches found.\n');
  } else {
    console.log(`Found ${mismatchHorses.length} horses with style/VD mismatches.\n`);

    // Show examples of each type
    const speedAsCloser = mismatchHorses.filter(m => m.style === 'E');
    const closerAsFader = mismatchHorses.filter(m => m.style === 'C' || m.style === 'S');

    if (speedAsCloser.length > 0) {
      console.log(`\n--- Early Speed horses classified as Closers (${speedAsCloser.length} total) ---`);
      diagnoseHorse(speedAsCloser[0]!.horse, false);
    }

    if (closerAsFader.length > 0) {
      console.log(`\n--- Closers classified as Faders (${closerAsFader.length} total) ---`);
      diagnoseHorse(closerAsFader[0]!.horse, false);
    }
  }

  // Investigate the calculation issue
  console.log('\n═══ CALCULATION INVESTIGATION ═══\n');
  console.log('The velocity differential is calculated as: VD = earlyPaceRate - latePaceRate');
  console.log('Where rates are in seconds per furlong.\n');
  console.log('If VD is very negative, it means latePaceRate >> earlyPaceRate');
  console.log('This could happen if:');
  console.log('  1. Late fraction distance is much shorter than early fraction');
  console.log('  2. Time calculations are using wrong segment lengths');
  console.log('  3. Missing/zero fractional times are causing division issues\n');

  // Sample a horse with extreme negative VD to investigate
  const negativeVDHorse = extremeVDHorses.find(h => h.avgVD < -20);
  if (negativeVDHorse) {
    console.log('Detailed investigation of extreme negative VD horse:');
    diagnoseHorse(negativeVDHorse.horse, true);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const dataDir = path.join(__dirname, '../src/data');
  const drfFiles = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.DRF'))
    .map(f => path.join(dataDir, f))
    .slice(0, 5); // Limit to first 5 files for diagnostics

  findProblematicHorses(drfFiles);
}

main().catch(console.error);
