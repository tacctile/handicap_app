/**
 * Real DRF File Integration Test
 *
 * Tests the scoring system with an actual DRF file from TwinSpires
 * to validate all calculations work correctly with real data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { parseDRFFile } from '../../lib/drfParser';
import { calculateRaceScores, getScoreTier, MAX_BASE_SCORE, MAX_SCORE } from '../../lib/scoring';
import type { TrackCondition } from '../../hooks/useRaceState';
import type { ParsedDRFFile } from '../../types/drf';

describe('Real DRF File Integration Test', () => {
  let parseResult: ParsedDRFFile;
  const DRF_FILE_PATH = path.join(__dirname, '../../data/sample.DRF');

  beforeAll(() => {
    // Load and parse the DRF file
    const fileContent = fs.readFileSync(DRF_FILE_PATH, 'utf-8');
    parseResult = parseDRFFile(fileContent);
  });

  it('should parse the DRF file successfully', () => {
    expect(parseResult).toBeDefined();
    expect(parseResult.races.length).toBeGreaterThan(0);
    // Track code is on the race header, not on the ParsedDRFFile directly
    const trackCode = parseResult.races[0]?.header?.trackCode;
    expect(trackCode).toBeTruthy();
    console.log(`\n📁 Parsed ${parseResult.races.length} races from ${trackCode}`);
  });

  it('should score all horses without NaN or Infinity values', () => {
    const issues: string[] = [];

    for (const race of parseResult.races) {
      const trackCondition: TrackCondition = {
        surface: race.header.surface,
        condition: race.header.condition || 'fast',
        variant: 0,
      };

      const getOdds = (index: number, defaultOdds: string) => {
        return race.horses[index]?.morningLineOdds || defaultOdds;
      };

      const isScratched = (index: number) => {
        return race.horses[index]?.isScratched || false;
      };

      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        trackCondition
      );

      for (const scored of scoredHorses) {
        if (scored.score.isScratched) continue;

        // Check for NaN/Infinity
        if (!Number.isFinite(scored.score.total)) {
          issues.push(`R${race.header.raceNumber} ${scored.horse.horseName}: Invalid total score`);
        }
        if (!Number.isFinite(scored.score.baseScore)) {
          issues.push(`R${race.header.raceNumber} ${scored.horse.horseName}: Invalid base score`);
        }
        if (!Number.isFinite(scored.score.overlayScore)) {
          issues.push(
            `R${race.header.raceNumber} ${scored.horse.horseName}: Invalid overlay score`
          );
        }

        // Check breakdown
        const b = scored.score.breakdown;
        if (!Number.isFinite(b.connections.total))
          issues.push(`${scored.horse.horseName}: NaN connections`);
        if (!Number.isFinite(b.postPosition.total))
          issues.push(`${scored.horse.horseName}: NaN postPosition`);
        if (!Number.isFinite(b.speedClass.total))
          issues.push(`${scored.horse.horseName}: NaN speedClass`);
        if (!Number.isFinite(b.form.total)) issues.push(`${scored.horse.horseName}: NaN form`);
        if (!Number.isFinite(b.equipment.total))
          issues.push(`${scored.horse.horseName}: NaN equipment`);
        if (!Number.isFinite(b.pace.total)) issues.push(`${scored.horse.horseName}: NaN pace`);
      }
    }

    if (issues.length > 0) {
      console.error('Issues found:', issues);
    }
    expect(issues).toHaveLength(0);
  });

  it('should keep all scores within valid boundaries', () => {
    const issues: string[] = [];

    for (const race of parseResult.races) {
      const trackCondition: TrackCondition = {
        surface: race.header.surface,
        condition: race.header.condition || 'fast',
        variant: 0,
      };

      const getOdds = (index: number, defaultOdds: string) => {
        return race.horses[index]?.morningLineOdds || defaultOdds;
      };

      const isScratched = (index: number) => {
        return race.horses[index]?.isScratched || false;
      };

      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        trackCondition
      );

      for (const scored of scoredHorses) {
        if (scored.score.isScratched) continue;

        // Check boundaries
        if (scored.score.total < 0) {
          issues.push(
            `R${race.header.raceNumber} ${scored.horse.horseName}: Score below 0 (${scored.score.total})`
          );
        }
        if (scored.score.total > MAX_SCORE) {
          issues.push(
            `R${race.header.raceNumber} ${scored.horse.horseName}: Score above max (${scored.score.total})`
          );
        }
        if (scored.score.baseScore > MAX_BASE_SCORE) {
          issues.push(
            `R${race.header.raceNumber} ${scored.horse.horseName}: Base score above max (${scored.score.baseScore})`
          );
        }
        if (scored.score.baseScore < 0) {
          issues.push(
            `R${race.header.raceNumber} ${scored.horse.horseName}: Base score below 0 (${scored.score.baseScore})`
          );
        }
        if (scored.score.overlayScore < -50 || scored.score.overlayScore > 50) {
          issues.push(
            `R${race.header.raceNumber} ${scored.horse.horseName}: Overlay out of bounds (${scored.score.overlayScore})`
          );
        }
      }
    }

    if (issues.length > 0) {
      console.error('Boundary issues:', issues);
    }
    expect(issues).toHaveLength(0);
  });

  it('should produce reasonable score distributions', () => {
    const distribution: Record<string, number> = {
      Elite: 0,
      Strong: 0,
      Good: 0,
      Fair: 0,
      Weak: 0,
    };
    let totalScored = 0;

    for (const race of parseResult.races) {
      const trackCondition: TrackCondition = {
        surface: race.header.surface,
        condition: race.header.condition || 'fast',
        variant: 0,
      };

      const getOdds = (index: number, defaultOdds: string) => {
        return race.horses[index]?.morningLineOdds || defaultOdds;
      };

      const isScratched = (index: number) => {
        return race.horses[index]?.isScratched || false;
      };

      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        trackCondition
      );

      for (const scored of scoredHorses) {
        if (scored.score.isScratched) continue;
        totalScored++;
        const tier = getScoreTier(scored.score.total);
        distribution[tier]++;
      }
    }

    console.log('\n📊 Score Distribution:');
    console.log(
      `   Elite (200+):  ${distribution.Elite} (${((distribution.Elite / totalScored) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Strong (180+): ${distribution.Strong} (${((distribution.Strong / totalScored) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Good (160+):   ${distribution.Good} (${((distribution.Good / totalScored) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Fair (140+):   ${distribution.Fair} (${((distribution.Fair / totalScored) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Weak (<140):   ${distribution.Weak} (${((distribution.Weak / totalScored) * 100).toFixed(1)}%)`
    );
    console.log(`   Total Scored:  ${totalScored}`);

    // Expect reasonable distribution (not all in one tier)
    const tiers = Object.values(distribution).filter((v) => v > 0);
    expect(tiers.length).toBeGreaterThan(1); // Should have multiple tiers
  });

  it('should generate detailed report for each race', () => {
    console.log('\n' + '═'.repeat(72));
    console.log('                    DETAILED RACE-BY-RACE REPORT');
    console.log('═'.repeat(72));

    for (const race of parseResult.races) {
      const trackCondition: TrackCondition = {
        surface: race.header.surface,
        condition: race.header.condition || 'fast',
        variant: 0,
      };

      const getOdds = (index: number, defaultOdds: string) => {
        return race.horses[index]?.morningLineOdds || defaultOdds;
      };

      const isScratched = (index: number) => {
        return race.horses[index]?.isScratched || false;
      };

      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        trackCondition
      );

      console.log(`\n${'─'.repeat(72)}`);
      console.log(
        `RACE ${race.header.raceNumber}: ${race.header.raceConditions || race.header.raceType || 'N/A'}`
      );
      console.log(
        `${race.header.distance} | ${race.header.surface} | $${race.header.purse?.toLocaleString() || 'N/A'}`
      );
      console.log(`${'─'.repeat(72)}`);

      console.log('\n  PP  Horse                     Score  Base  Ovly  Tier    ML Odds');
      console.log('  ' + '─'.repeat(66));

      for (const scored of scoredHorses) {
        if (scored.score.isScratched) {
          console.log(
            `  ${scored.horse.programNumber.toString().padStart(2)}  ${scored.horse.horseName.substring(0, 22).padEnd(22)}  [SCRATCHED]`
          );
          continue;
        }

        const tier = getScoreTier(scored.score.total);
        const ovlySign = scored.score.overlayScore >= 0 ? '+' : '';

        console.log(
          `  ${scored.horse.programNumber.toString().padStart(2)}  ${scored.horse.horseName.substring(0, 22).padEnd(22)}  ` +
            `${scored.score.total.toString().padStart(3)}   ${scored.score.baseScore.toString().padStart(3)}   ${ovlySign}${scored.score.overlayScore.toString().padStart(2)}   ` +
            `${tier.padEnd(6)}  ${scored.horse.morningLineOdds.padStart(8)}`
        );
      }

      // Top 3
      const top3 = scoredHorses.filter((h) => !h.score.isScratched).slice(0, 3);
      console.log('\n  🏆 Top Picks:');
      top3.forEach((h, i) => {
        const medal = ['🥇', '🥈', '🥉'][i];
        console.log(
          `     ${medal} #${h.horse.programNumber} ${h.horse.horseName} (${h.score.total} pts @ ${h.horse.morningLineOdds})`
        );
      });
    }

    expect(true).toBe(true);
  });
});
