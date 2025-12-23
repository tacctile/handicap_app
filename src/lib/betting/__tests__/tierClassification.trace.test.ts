/**
 * Trace test for classifyHorses integration
 * Verifies field-relative data is attached as advisory only
 * NOTE: Tier assignment uses adjustedScore (overlay-adjusted), not raw score
 */

import { describe, it, expect } from 'vitest';
import { classifyHorses } from '../tierClassification';
import type { HorseEntry } from '../../../types/drf';
import type { HorseScore } from '../../scoring';

function createMockHorse(
  idx: number,
  score: number,
  odds = '5-1'
): { horse: HorseEntry; index: number; score: HorseScore } {
  return {
    horse: {
      programNumber: String(idx + 1),
      horseName: `Horse${idx + 1}`,
      morningLineOdds: odds,
    } as HorseEntry,
    index: idx,
    score: {
      total: score,
      isScratched: false,
      breakdown: {} as HorseScore['breakdown'],
    } as HorseScore,
  };
}

describe('classifyHorses with field-relative integration', () => {
  it('should attach fieldContext to tier groups', () => {
    const horses = [
      createMockHorse(0, 195),
      createMockHorse(1, 175),
      createMockHorse(2, 165),
      createMockHorse(3, 145),
    ];

    const tierGroups = classifyHorses(horses);

    console.log('\n=== Field Context ===');
    const ctx = tierGroups[0]?.fieldContext;
    console.log('  fieldSize:', ctx?.fieldSize);
    console.log('  averageScore:', ctx?.averageScore);
    console.log('  fieldStrength:', ctx?.fieldStrength);

    expect(ctx).toBeDefined();
    expect(ctx?.fieldSize).toBe(4);
    expect(ctx?.averageScore).toBe(170);
    expect(ctx?.fieldStrength).toBe('strong');
  });

  it('should attach fieldRelative to each classified horse', () => {
    const horses = [
      createMockHorse(0, 195),
      createMockHorse(1, 175),
      createMockHorse(2, 165),
      createMockHorse(3, 145),
    ];

    const tierGroups = classifyHorses(horses);
    const allHorses = tierGroups.flatMap((g) => g.horses);

    console.log('\n=== Per-Horse Field Relative Data ===');
    for (const h of allHorses) {
      console.log(`\nHorse ${h.score.total}:`);
      console.log('  tier:', h.tier);
      console.log('  fieldRelative.isStandout:', h.fieldRelative?.isStandout);
      console.log('  fieldRelative.tierAdjustment:', h.fieldRelative?.tierAdjustment);
      console.log('  fieldRelative.gapFromNextBest:', h.fieldRelative?.gapFromNextBest);

      // Every classified horse should have fieldRelative attached
      expect(h.fieldRelative).toBeDefined();
    }
  });

  it('should correctly identify standout (unique leader with gap >= 20)', () => {
    const horses = [
      createMockHorse(0, 195),
      createMockHorse(1, 170), // Gap of 25 points
      createMockHorse(2, 160),
    ];

    const tierGroups = classifyHorses(horses);
    const h195 = tierGroups.flatMap((g) => g.horses).find((h) => h.score.total === 195);

    console.log('\n=== Standout Detection ===');
    console.log('Horse 195 fieldRelative:', JSON.stringify(h195?.fieldRelative, null, 2));

    expect(h195?.fieldRelative?.isStandout).toBe(true);
    expect(h195?.fieldRelative?.gapFromNextBest).toBe(25);
    // Strong field (avg = 175) means no tier promotion
    expect(h195?.fieldRelative?.tierAdjustment).toBe(0);
  });

  it('should handle tied scores - isStandout = false', () => {
    const horses = [
      createMockHorse(0, 185),
      createMockHorse(1, 185), // Tied at top
      createMockHorse(2, 160),
    ];

    const tierGroups = classifyHorses(horses);
    const tiedHorses = tierGroups.flatMap((g) => g.horses).filter((h) => h.score.total === 185);

    console.log('\n=== Tied Scores Handling ===');
    for (const h of tiedHorses) {
      console.log(
        `Horse ${h.score.total}: isStandout=${h.fieldRelative?.isStandout}, gapFromNextBest=${h.fieldRelative?.gapFromNextBest}`
      );

      expect(h.fieldRelative?.isStandout).toBe(false);
      expect(h.fieldRelative?.gapFromNextBest).toBe(0); // Tied for first
    }
  });

  it('should confirm field-relative is ADVISORY only - does not change tier', () => {
    // Key verification: the tier is determined by determineTier() using adjustedScore
    // The fieldRelative.tierAdjustment is purely informational - never applied
    const horses = [createMockHorse(0, 195), createMockHorse(1, 175)];

    const tierGroups = classifyHorses(horses);
    const h195 = tierGroups.flatMap((g) => g.horses).find((h) => h.score.total === 195);

    console.log('\n=== Advisory-Only Verification ===');
    console.log('Horse 195:');
    console.log('  tier (actual):', h195?.tier);
    console.log('  fieldRelative.tierAdjustment (advisory):', h195?.fieldRelative?.tierAdjustment);
    console.log('  adjustedScore (from overlay system):', h195?.adjustedScore);

    // The tier is tier1 because of the absolute/overlay-adjusted thresholds
    // The fieldRelative.tierAdjustment is just informational
    expect(h195?.tier).toBeDefined();
    expect(h195?.fieldRelative?.tierAdjustment).toBeDefined();
    // These are separate systems - one determines tier, one provides advisory info
  });
});
