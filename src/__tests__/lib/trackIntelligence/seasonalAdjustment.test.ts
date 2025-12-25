/**
 * Seasonal Adjustment Tests
 * Tests track seasonal pattern adjustments for pace scoring refinement (±2 pts)
 */

import { describe, it, expect } from 'vitest';
import {
  getSeasonalAdjustment,
  hasSeasonalData,
  getSeasonalPatternSummary,
  getSeasonalPattern,
} from '../../../lib/trackIntelligence';

describe('Seasonal Adjustment', () => {
  describe('getSeasonalAdjustment', () => {
    describe('Tracks with seasonal speed bias', () => {
      it('gives +2 bonus to E runner at SAR in July (summer speed bias)', () => {
        // Saratoga in summer favors early speed (favoredStyle: 'E', magnitude: 2)
        const result = getSeasonalAdjustment('SAR', 7, 'E');

        expect(result.adjustment).toBe(2);
        expect(result.favoredStyle).toBe('E');
        expect(result.reasoning).toContain('early speed');
        expect(result.reasoning).toContain('favored');
      });

      it('gives +2 bonus to E runner at SAR in August (summer speed bias)', () => {
        const result = getSeasonalAdjustment('SAR', 8, 'E');

        expect(result.adjustment).toBe(2);
        expect(result.favoredStyle).toBe('E');
      });

      it('penalizes C runner at SAR in July (opposite of favored)', () => {
        const result = getSeasonalAdjustment('SAR', 7, 'C');

        expect(result.adjustment).toBeLessThan(0);
        expect(result.adjustment).toBeGreaterThanOrEqual(-2);
        expect(result.favoredStyle).toBe('E');
      });

      it('gives +2 bonus to E runner at GP in January (winter speed bias)', () => {
        // Gulfstream in winter favors early speed (favoredStyle: 'E', magnitude: 2)
        const result = getSeasonalAdjustment('GP', 1, 'E');

        expect(result.adjustment).toBe(2);
        expect(result.favoredStyle).toBe('E');
      });

      it('penalizes C runner at GP in January (opposite of favored)', () => {
        const result = getSeasonalAdjustment('GP', 1, 'C');

        expect(result.adjustment).toBeLessThan(0);
        expect(result.favoredStyle).toBe('E');
      });
    });

    describe('Tracks with presser-favoring patterns', () => {
      it('gives bonus to P runner at CD in May (spring, pressers favored)', () => {
        // Churchill Downs spring favors pressers
        const result = getSeasonalAdjustment('CD', 5, 'P');

        expect(result.adjustment).toBeGreaterThan(0);
        expect(result.favoredStyle).toBe('P');
      });

      it('gives bonus to S (stalker) runner at CD in May (stalkers map to pressers)', () => {
        // Stalkers are treated same as pressers for matching
        const result = getSeasonalAdjustment('CD', 5, 'S');

        expect(result.adjustment).toBeGreaterThan(0);
        expect(result.favoredStyle).toBe('P');
      });
    });

    describe('Tracks with no seasonal data', () => {
      it('returns 0 adjustment for track with no seasonal patterns', () => {
        // Using a track code that doesn't exist in the database
        const result = getSeasonalAdjustment('UNKNOWN_TRACK', 7, 'E');

        expect(result.adjustment).toBe(0);
        expect(result.favoredStyle).toBeNull();
        expect(result.reasoning).toContain('Unknown track');
      });

      it('returns 0 adjustment for month not covered by seasonal patterns', () => {
        // Saratoga only has summer (Jul-Sep), so December should return no pattern
        const result = getSeasonalAdjustment('SAR', 12, 'E');

        expect(result.adjustment).toBe(0);
        // May have no pattern for this month
      });
    });

    describe('Neutral seasonal patterns', () => {
      it('derives style preference from speedAdjustment when not explicit', () => {
        // CD in fall has favoredStyle: null, styleBiasMagnitude: 0
        // BUT speedAdjustment: 1, so it derives 'E' as favored
        const result = getSeasonalAdjustment('CD', 10, 'E');

        // The function derives style from speedAdjustment when no explicit favoredStyle
        expect(result.adjustment).toBe(1); // speedAdjustment: 1 → favors E → E runner gets +1
        expect(result.favoredStyle).toBe('E');
      });

      it('returns 0 adjustment for unknown running style', () => {
        const result = getSeasonalAdjustment('GP', 1, 'U');

        // Unknown style gets no adjustment even if track has bias
        expect(result.adjustment).toBe(0);
      });
    });

    describe('Summer patterns at Gulfstream (variable)', () => {
      it('penalizes E at GP in July (speedAdjustment: -1 derives C as favored)', () => {
        // GP summer has favoredStyle: null, speedAdjustment: -1
        // Negative speedAdjustment derives 'C' as favored (off-track/slow = closers benefit)
        const result = getSeasonalAdjustment('GP', 7, 'E');

        expect(result.adjustment).toBe(-1); // E is opposite of derived C preference
        expect(result.favoredStyle).toBe('C');
      });

      it('gives bonus to C at GP in July (speedAdjustment: -1 derives C as favored)', () => {
        const result = getSeasonalAdjustment('GP', 7, 'C');

        expect(result.adjustment).toBe(1); // C matches derived C preference
        expect(result.favoredStyle).toBe('C');
      });
    });

    describe('Adjustment bounds', () => {
      it('adjustment is capped at +2', () => {
        // Even if magnitude is higher, should be capped at 2
        const result = getSeasonalAdjustment('SAR', 7, 'E');

        expect(result.adjustment).toBeLessThanOrEqual(2);
      });

      it('adjustment is floored at -2', () => {
        const result = getSeasonalAdjustment('SAR', 7, 'C');

        expect(result.adjustment).toBeGreaterThanOrEqual(-2);
      });
    });

    describe('Invalid month handling', () => {
      it('returns 0 adjustment for month < 1', () => {
        const result = getSeasonalAdjustment('SAR', 0, 'E');

        expect(result.adjustment).toBe(0);
        expect(result.reasoning).toBe('No seasonal data available');
      });

      it('returns 0 adjustment for month > 12', () => {
        const result = getSeasonalAdjustment('SAR', 13, 'E');

        expect(result.adjustment).toBe(0);
        expect(result.reasoning).toBe('No seasonal data available');
      });
    });
  });

  describe('hasSeasonalData', () => {
    it('returns true for tracks with seasonal patterns', () => {
      expect(hasSeasonalData('SAR')).toBe(true);
      expect(hasSeasonalData('GP')).toBe(true);
      expect(hasSeasonalData('CD')).toBe(true);
    });

    it('returns true for specific month within season', () => {
      // Saratoga has summer (Jul-Sep)
      expect(hasSeasonalData('SAR', 7)).toBe(true);
      expect(hasSeasonalData('SAR', 8)).toBe(true);
      expect(hasSeasonalData('SAR', 9)).toBe(true);
    });

    it('returns false for month outside seasonal patterns', () => {
      // Saratoga only has summer, so January should return false
      expect(hasSeasonalData('SAR', 1)).toBe(false);
    });

    it('returns false for unknown tracks', () => {
      expect(hasSeasonalData('UNKNOWN')).toBe(false);
    });
  });

  describe('getSeasonalPatternSummary', () => {
    it('returns summary for track with seasonal data', () => {
      const summary = getSeasonalPatternSummary('SAR', 8);

      expect(summary.hasData).toBe(true);
      expect(summary.season).toBe('Summer');
      expect(summary.favoredStyle).toBe('Early Speed');
      expect(summary.notes).toContain('summer');
    });

    it('returns no data summary for unknown track', () => {
      const summary = getSeasonalPatternSummary('UNKNOWN', 7);

      expect(summary.hasData).toBe(false);
      expect(summary.season).toBeNull();
      expect(summary.favoredStyle).toBeNull();
      expect(summary.notes).toContain('No seasonal data');
    });

    it('returns no data summary for month without pattern', () => {
      const summary = getSeasonalPatternSummary('SAR', 1);

      expect(summary.hasData).toBe(false);
    });

    it('handles null favoredStyle gracefully', () => {
      // CD fall has no favored style
      const summary = getSeasonalPatternSummary('CD', 10);

      expect(summary.hasData).toBe(true);
      expect(summary.season).toBe('Fall');
      expect(summary.favoredStyle).toBeNull();
    });
  });

  describe('getSeasonalPattern', () => {
    it('returns pattern for valid track and month', () => {
      const pattern = getSeasonalPattern('SAR', 8);

      expect(pattern).toBeDefined();
      expect(pattern?.season).toBe('summer');
      expect(pattern?.months).toContain(8);
    });

    it('returns undefined for month without pattern', () => {
      const pattern = getSeasonalPattern('SAR', 1);

      expect(pattern).toBeUndefined();
    });

    it('returns undefined for unknown track', () => {
      const pattern = getSeasonalPattern('UNKNOWN', 7);

      expect(pattern).toBeUndefined();
    });

    it('defaults to current month if not provided', () => {
      // Just verify it doesn't throw
      const pattern = getSeasonalPattern('GP');

      // Pattern may or may not exist depending on current month
      // Just checking it doesn't error
      expect(pattern === undefined || typeof pattern === 'object').toBe(true);
    });
  });

  describe('Integration with pace scoring', () => {
    it('adjustment values are within pace refinement bounds (±2)', () => {
      // Test multiple scenarios to ensure bounds are respected
      const scenarios = [
        { track: 'SAR', month: 7, style: 'E' as const },
        { track: 'SAR', month: 7, style: 'C' as const },
        { track: 'GP', month: 1, style: 'E' as const },
        { track: 'GP', month: 1, style: 'C' as const },
        { track: 'CD', month: 5, style: 'P' as const },
        { track: 'CD', month: 7, style: 'E' as const },
      ];

      for (const { track, month, style } of scenarios) {
        const result = getSeasonalAdjustment(track, month, style);

        expect(result.adjustment).toBeGreaterThanOrEqual(-2);
        expect(result.adjustment).toBeLessThanOrEqual(2);
      }
    });
  });
});
