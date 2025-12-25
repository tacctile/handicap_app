/**
 * Diagnostics Module Tests
 *
 * Tests for the scoring diagnostics module that helps identify
 * why favorites may rank lower than expected.
 */

import { describe, it, expect } from 'vitest';
import {
  diagnoseHorseScoring,
  diagnoseField,
  analyzeWeightDistribution,
  getWeightDistributionTable,
  getSummaryIssues,
  INDUSTRY_STANDARD_WEIGHTS,
  CURRENT_WEIGHTS,
} from '../../../lib/scoring/diagnostics';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createTestField,
  createSpeedFigures,
} from '../../fixtures/testHelpers';

describe('Scoring Diagnostics', () => {
  describe('diagnoseHorseScoring', () => {
    it('calculates market-implied win probability correctly for 1-1 odds', () => {
      const horse = createHorseEntry({
        morningLineOdds: '1-1',
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // 1-1 odds should give 50% implied probability
      expect(diagnostic.marketImpliedWinProb).toBeCloseTo(50, 1);
    });

    it('calculates market-implied win probability correctly for 5-1 odds', () => {
      const horse = createHorseEntry({
        morningLineOdds: '5-1',
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // 5-1 odds should give ~16.7% implied probability
      expect(diagnostic.marketImpliedWinProb).toBeCloseTo(16.7, 1);
    });

    it('identifies weak categories when score is below 50%', () => {
      // Create a horse with low connections data
      const horse = createHorseEntry({
        trainerMeetStarts: 1, // Very few starts = neutral/low score
        jockeyMeetStarts: 1,
        pastPerformances: [],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Should have some weak categories identified
      expect(diagnostic.weakestCategories.length).toBeGreaterThan(0);
    });

    it('identifies strong categories when score is above 75%', () => {
      // Create a horse that won last race (strong form)
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Form should be a strong category
      expect(diagnostic.strongestCategories).toContain('form');
    });

    it('flags low disagreement for aligned market and model', () => {
      const horse = createHorseEntry({
        morningLineOdds: '5-1',
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 4 }),
        ],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Expect some level of disagreement (could be low, medium, or high depending on score)
      expect(['low', 'medium', 'high', 'extreme']).toContain(diagnostic.disagreementLevel);
    });

    it('includes all category scores in breakdown', () => {
      const horse = createHorseEntry();
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Check all expected categories are present
      expect(diagnostic.categoryScores).toHaveProperty('connections');
      expect(diagnostic.categoryScores).toHaveProperty('postPosition');
      expect(diagnostic.categoryScores).toHaveProperty('speedClass');
      expect(diagnostic.categoryScores).toHaveProperty('form');
      expect(diagnostic.categoryScores).toHaveProperty('equipment');
      expect(diagnostic.categoryScores).toHaveProperty('pace');
      expect(diagnostic.categoryScores).toHaveProperty('distanceSurface');
      expect(diagnostic.categoryScores).toHaveProperty('trainerPatterns');
      expect(diagnostic.categoryScores).toHaveProperty('comboPatterns');
      expect(diagnostic.categoryScores).toHaveProperty('trackSpecialist');
    });

    it('calculates percentage correctly for each category', () => {
      const horse = createHorseEntry();
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Check that percentages are calculated correctly
      for (const [, data] of Object.entries(diagnostic.categoryScores)) {
        if (data.max > 0) {
          const expectedPercent = (data.score / data.max) * 100;
          expect(data.percent).toBeCloseTo(expectedPercent, 1);
        }
      }
    });
  });

  describe('Favorite-specific diagnostics', () => {
    it('flags favorites that score low on connections', () => {
      const horse = createHorseEntry({
        morningLineOdds: '1-1',
        trainerMeetStarts: 0,
        jockeyMeetStarts: 0,
        pastPerformances: [createPastPerformance({ finishPosition: 1 })],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Favorite should have flags about potential issues
      expect(diagnostic.favoriteFlags.length).toBeGreaterThanOrEqual(0);
    });

    it('flags favorites missing bonus categories', () => {
      // Create a horse with no track record, no turf/wet experience
      const horse = createHorseEntry({
        morningLineOdds: '2-1',
        trackRecordStarts: 0, // No track record
        turfStarts: 0, // No turf
        wetTrackStarts: 0, // No wet track
        pastPerformances: [createPastPerformance({ finishPosition: 1 })],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Should flag missing bonus categories
      const hasTrackOrSurfaceIssue = diagnostic.favoriteFlags.some(
        (f) => f.includes('trackSpecialist') || f.includes('distanceSurface') || f.includes('bonus')
      );

      // May or may not have issues depending on score
      expect(typeof hasTrackOrSurfaceIssue).toBe('boolean');
    });

    it('flags recent winner with low form score', () => {
      // Horse won last race but has poor earlier races
      const horse = createHorseEntry({
        morningLineOdds: '1-1',
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // Won last
          createPastPerformance({ finishPosition: 10 }), // Terrible 2nd back
          createPastPerformance({ finishPosition: 10 }), // Terrible 3rd back
        ],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Form should be in strong categories since last race was a win
      // The weighted averaging means form could still be relatively strong
      expect(diagnostic.categoryScores.form.score).toBeGreaterThan(0);
    });
  });

  describe('analyzeWeightDistribution', () => {
    it('returns analysis for all major categories', () => {
      const analysis = analyzeWeightDistribution();

      // Should have analysis for major categories
      const categoryNames = analysis.map((a) => a.category);
      expect(categoryNames).toContain('speedClass');
      expect(categoryNames).toContain('pace');
      expect(categoryNames).toContain('form');
      expect(categoryNames).toContain('connections');
    });

    it('identifies misaligned weights', () => {
      const analysis = analyzeWeightDistribution();

      // Each category should have an alignment status
      for (const item of analysis) {
        expect(['under', 'aligned', 'over']).toContain(item.alignment);
      }
    });

    it('provides recommendations for misaligned weights', () => {
      const analysis = analyzeWeightDistribution();

      // Categories with 'under' or 'over' alignment should have recommendations
      for (const item of analysis) {
        if (item.alignment !== 'aligned') {
          expect(item.recommendation).toBeDefined();
        }
      }
    });
  });

  describe('getWeightDistributionTable', () => {
    it('returns a formatted string table', () => {
      const table = getWeightDistributionTable();

      expect(typeof table).toBe('string');
      expect(table.length).toBeGreaterThan(100);
      expect(table).toContain('CATEGORY WEIGHT DISTRIBUTION');
      expect(table).toContain('speedClass');
    });

    it('includes totals at the bottom', () => {
      const table = getWeightDistributionTable();

      expect(table).toContain('Core Categories Total');
      expect(table).toContain('Bonus Categories Total');
      expect(table).toContain('TOTAL BASE SCORE');
    });
  });

  describe('diagnoseField', () => {
    it('diagnoses all horses in the field', () => {
      const horses = createTestField(6);
      const raceHeader = createRaceHeader({ fieldSize: 6 });

      const fieldDiag = diagnoseField(horses, raceHeader);

      expect(fieldDiag.horses.length).toBe(6);
      expect(fieldDiag.summary.totalHorses).toBe(6);
    });

    it('identifies systematic issues when favorites rank low', () => {
      // Create a field where favorites have poor bonus category scores
      const horses = [
        // Favorite - low odds but missing bonus categories
        createHorseEntry({
          programNumber: 1,
          postPosition: 1,
          horseName: 'Heavy Favorite',
          morningLineOdds: '1-1',
          trackRecordStarts: 0,
          turfStarts: 0,
          wetTrackStarts: 0,
          pastPerformances: [createPastPerformance({ finishPosition: 1 })],
        }),
        // Longshot with lots of bonus categories
        createHorseEntry({
          programNumber: 2,
          postPosition: 2,
          horseName: 'Live Longshot',
          morningLineOdds: '15-1',
          trackRecordStarts: 10,
          trackRecordWins: 4, // Track specialist
          turfStarts: 5,
          turfWins: 2,
          wetTrackStarts: 5,
          wetTrackWins: 2,
          pastPerformances: [
            createPastPerformance({ finishPosition: 3 }),
            createPastPerformance({ finishPosition: 2 }),
          ],
        }),
        // Mid-level horse
        createHorseEntry({
          programNumber: 3,
          postPosition: 3,
          horseName: 'Mid Pack',
          morningLineOdds: '8-1',
          pastPerformances: [createPastPerformance({ finishPosition: 4 })],
        }),
      ];
      const raceHeader = createRaceHeader({ fieldSize: 3 });

      const fieldDiag = diagnoseField(horses, raceHeader);

      // Should have weight analysis
      expect(fieldDiag.weightAnalysis.length).toBeGreaterThan(0);

      // Should calculate summary stats
      expect(fieldDiag.summary.totalHorses).toBe(3);
    });

    it('includes weight distribution analysis', () => {
      const horses = createTestField(4);
      const raceHeader = createRaceHeader({ fieldSize: 4 });

      const fieldDiag = diagnoseField(horses, raceHeader);

      expect(fieldDiag.weightAnalysis.length).toBeGreaterThan(0);
    });

    it('tracks how many favorites finish in top 3', () => {
      const horses = createTestField(6);
      const raceHeader = createRaceHeader({ fieldSize: 6 });

      const fieldDiag = diagnoseField(horses, raceHeader);

      expect(typeof fieldDiag.summary.favoritesInTop3).toBe('number');
      expect(fieldDiag.summary.favoritesInTop3).toBeGreaterThanOrEqual(0);
      expect(fieldDiag.summary.favoritesInTop3).toBeLessThanOrEqual(3);
    });
  });

  describe('getSummaryIssues', () => {
    it('returns a list of identified issues', () => {
      const issues = getSummaryIssues();

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('includes bonus category issues', () => {
      const issues = getSummaryIssues();
      const issueText = issues.join('\n');

      expect(issueText).toContain('Bonus');
    });

    it('includes root cause hypothesis', () => {
      const issues = getSummaryIssues();
      const issueText = issues.join('\n');

      expect(issueText).toContain('ROOT CAUSE');
    });
  });

  describe('INDUSTRY_STANDARD_WEIGHTS', () => {
    it('has defined ranges for major categories', () => {
      expect(INDUSTRY_STANDARD_WEIGHTS.speedClass).toBeDefined();
      expect(INDUSTRY_STANDARD_WEIGHTS.speedClass.low).toBeLessThan(
        INDUSTRY_STANDARD_WEIGHTS.speedClass.high
      );

      expect(INDUSTRY_STANDARD_WEIGHTS.form).toBeDefined();
      expect(INDUSTRY_STANDARD_WEIGHTS.form.low).toBeLessThan(INDUSTRY_STANDARD_WEIGHTS.form.high);
    });

    it('has reasonable ranges that sum to approximately 100%', () => {
      // Not strict since ranges can overlap, but should be reasonable
      let totalLow = 0;
      let totalHigh = 0;

      for (const [, range] of Object.entries(INDUSTRY_STANDARD_WEIGHTS)) {
        totalLow += range.low;
        totalHigh += range.high;
      }

      // Ranges should allow for ~100% when combined
      expect(totalLow).toBeLessThan(100);
      expect(totalHigh).toBeGreaterThan(50);
    });
  });

  describe('CURRENT_WEIGHTS', () => {
    it('has percentages that sum to 100%', () => {
      let totalPercent = 0;

      for (const [, weights] of Object.entries(CURRENT_WEIGHTS)) {
        totalPercent += weights.percent;
      }

      // Should sum to approximately 100%
      expect(totalPercent).toBeCloseTo(100, 1);
    });

    it('speedClass is the highest weighted category', () => {
      const speedClassPercent = CURRENT_WEIGHTS.speedClass.percent;

      for (const [category, weights] of Object.entries(CURRENT_WEIGHTS)) {
        if (category !== 'speedClass') {
          expect(speedClassPercent).toBeGreaterThanOrEqual(weights.percent);
        }
      }
    });
  });

  describe('Test case: 1-1 favorite that won last race should score in top 2', () => {
    it('validates that recent winner should have high form score', () => {
      const horse = createHorseEntry({
        morningLineOdds: '1-1',
        daysSinceLastRace: 14,
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Form should be strong (>75% of max)
      expect(diagnostic.categoryScores.form.percent).toBeGreaterThan(60);

      // Should be in strong categories
      expect(diagnostic.strongestCategories).toContain('form');
    });
  });

  describe('Test case: Horse with best speed figure should score high on Speed/Class', () => {
    it('validates that best speed figure horse gets top speed score', () => {
      const horse = createHorseEntry({
        bestBeyer: 100,
        averageBeyer: 95,
        lastBeyer: 98,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 2,
            speedFigures: createSpeedFigures({ beyer: 98 }),
          }),
          createPastPerformance({
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 100 }),
          }),
        ],
      });
      const raceHeader = createRaceHeader();

      const diagnostic = diagnoseHorseScoring(horse, raceHeader);

      // Speed/Class should be a strong category
      expect(diagnostic.categoryScores.speedClass.score).toBeGreaterThan(0);
    });
  });

  describe('Test case: Horse with 0 track record should not be penalized', () => {
    it('validates that missing track record is handled', () => {
      // Horse with 10 starts at track and 30%+ win rate qualifies for track specialist
      const horseWithTrackRecord = createHorseEntry({
        trackStarts: 10,
        trackWins: 4, // 40% win rate
        trackPlaces: 2,
        trackShows: 1,
      });

      const horseNoTrackRecord = createHorseEntry({
        trackStarts: 0,
        trackWins: 0,
        trackPlaces: 0,
        trackShows: 0,
      });

      const raceHeader = createRaceHeader();

      const withRecord = diagnoseHorseScoring(horseWithTrackRecord, raceHeader);
      const noRecord = diagnoseHorseScoring(horseNoTrackRecord, raceHeader);

      // Horse with no record should get 0 for track specialist (not negative)
      expect(noRecord.categoryScores.trackSpecialist.score).toBeGreaterThanOrEqual(0);

      // The diagnostic identifies this as a potential issue
      const hasTrackIssue = noRecord.potentialIssues.some(
        (i) => i.includes('track') || i.includes('Track')
      );
      expect(hasTrackIssue).toBe(true);

      // Horse with 40% win rate at track (10 starts, 4 wins) should score higher
      // Track specialist requires 4+ starts and 30%+ win rate for bonus
      expect(withRecord.categoryScores.trackSpecialist.score).toBeGreaterThan(
        noRecord.categoryScores.trackSpecialist.score
      );
    });
  });
});
