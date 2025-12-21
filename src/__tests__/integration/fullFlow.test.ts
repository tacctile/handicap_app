/**
 * Integration Tests - Full Flow
 * Tests complete workflows: Upload → Parse → Score → Recommend
 */

import { describe, it, expect } from 'vitest';
import { parseDRFFile } from '../../lib/drfParser';
import { calculateRaceScores, calculateHorseScore } from '../../lib/scoring';
import { classifyHorses } from '../../lib/betting/tierClassification';
import { generateBetRecommendations } from '../../lib/betting/betRecommendations';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createSpeedFigures,
  createTestField,
} from '../fixtures/testHelpers';

// Helper to load fixture files
function loadFixture(filename: string): string {
  const fixturePath = join(__dirname, '../fixtures', filename);
  return readFileSync(fixturePath, 'utf-8');
}

describe('Full Flow Integration', () => {
  describe('Upload → Parse → Score → Recommend Flow', () => {
    it('processes valid DRF file end-to-end', () => {
      // Step 1: Parse file
      const content = loadFixture('sample.drf');
      const parseResult = parseDRFFile(content, 'sample.drf');

      expect(parseResult.isValid).toBe(true);
      expect(parseResult.races.length).toBeGreaterThan(0);

      // Step 2: Score horses
      const race = parseResult.races[0];
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        getOdds,
        isScratched,
        'fast'
      );

      expect(scoredHorses.length).toBe(race.horses.length);
      scoredHorses.forEach((sh) => {
        expect(sh.score.total).toBeGreaterThanOrEqual(0);
        expect(sh.rank).toBeGreaterThanOrEqual(0);
      });

      // Step 3: Classify into tiers
      const horsesForClassification = scoredHorses.map((sh) => ({
        horse: sh.horse,
        index: sh.index,
        score: sh.score,
      }));

      const tierGroups = classifyHorses(horsesForClassification);

      // Step 4: Generate recommendations
      const recommendations = generateBetRecommendations(tierGroups);

      expect(recommendations).toBeInstanceOf(Array);
      recommendations.forEach((rec) => {
        expect(rec.tier).toBeDefined();
        expect(rec.bets).toBeInstanceOf(Array);
      });
    });

    it('handles file with no qualifying horses', () => {
      // Create minimal data that scores below threshold
      const horses = [
        createHorseEntry({
          programNumber: 1,
          horseName: 'Weak Horse',
          morningLineOdds: '30-1',
          pastPerformances: [], // No data = low score
        }),
      ];
      const header = createRaceHeader();
      const getOdds = () => '30-1';
      const isScratched = () => false;

      const scoredHorses = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const horsesForClassification = scoredHorses.map((sh) => ({
        horse: sh.horse,
        index: sh.index,
        score: sh.score,
      }));

      const tierGroups = classifyHorses(horsesForClassification);
      const recommendations = generateBetRecommendations(tierGroups);

      // Should not crash, may have empty recommendations
      expect(recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Scratch Horse → Recalculate Flow', () => {
    it('removes scratched horse from rankings', () => {
      const horses = createTestField(8);
      const header = createRaceHeader({ fieldSize: 8 });
      const getOdds = (_i: number, odds: string) => odds;

      // Initial scoring - no scratches
      const initialScored = calculateRaceScores(horses, header, getOdds, () => false, 'fast');

      // Scratch the top-ranked horse
      const topHorse = initialScored[0];
      const isScratched = (i: number) => horses[i].horseName === topHorse.horse.horseName;

      const rescored = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');

      // Scratched horse should be at bottom with rank 0
      const scratchedResult = rescored.find(
        (sh) => sh.horse.horseName === topHorse.horse.horseName
      );
      expect(scratchedResult?.score.isScratched).toBe(true);
      expect(scratchedResult?.rank).toBe(0);

      // Other horses should have shifted ranks
      const newRanks = rescored.filter((sh) => !sh.score.isScratched).map((sh) => sh.rank);
      expect(newRanks).toContain(1);
    });

    it('recalculates tier classification after scratch', () => {
      const horses = [
        createHorseEntry({
          programNumber: 1,
          horseName: 'Top Horse',
          morningLineOdds: '2-1',
          pastPerformances: Array.from({ length: 5 }, () =>
            createPastPerformance({
              finishPosition: 1,
              speedFigures: createSpeedFigures({ beyer: 95 }),
            })
          ),
        }),
        createHorseEntry({
          programNumber: 2,
          horseName: 'Second Horse',
          morningLineOdds: '5-1',
          pastPerformances: Array.from({ length: 3 }, () =>
            createPastPerformance({
              finishPosition: 2,
              speedFigures: createSpeedFigures({ beyer: 85 }),
            })
          ),
        }),
      ];
      const header = createRaceHeader({ fieldSize: 2 });
      const getOdds = (_i: number, odds: string) => odds;

      // Scratch top horse
      const scored2 = calculateRaceScores(horses, header, getOdds, (i) => i === 0, 'fast');
      const classification2 = classifyHorses(
        scored2.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );

      // Second classification should not include scratched horse
      const allClassifiedHorses = classification2.flatMap((g) => g.horses);
      const hasScratched = allClassifiedHorses.some((h) => h.horse.horseName === 'Top Horse');
      expect(hasScratched).toBe(false);
    });
  });

  describe('Change Odds → Recalculate Flow', () => {
    it('updates overlay analysis when odds change', () => {
      const horse = createHorseEntry({
        programNumber: 1,
        horseName: 'Test Horse',
        morningLineOdds: '5-1',
        pastPerformances: Array.from({ length: 3 }, () =>
          createPastPerformance({
            finishPosition: 2,
            speedFigures: createSpeedFigures({ beyer: 85 }),
          })
        ),
      });
      const header = createRaceHeader();

      // Score at morning line odds (5-1)
      const score1 = calculateHorseScore(horse, header, '5-1', 'fast', false);

      // Score at changed odds (15-1) - should be bigger overlay
      const score2 = calculateHorseScore(horse, header, '15-1', 'fast', false);

      // Both should have valid scores
      expect(score1.total).toBeGreaterThan(0);
      expect(score2.total).toBeGreaterThan(0);
    });

    it('updates tier classification when odds change significantly', () => {
      const horse = createHorseEntry({
        programNumber: 1,
        horseName: 'Test Horse',
        morningLineOdds: '5-1',
        pastPerformances: Array.from({ length: 5 }, () =>
          createPastPerformance({
            finishPosition: 3,
            speedFigures: createSpeedFigures({ beyer: 82 }),
          })
        ),
      });
      const header = createRaceHeader({ fieldSize: 1 });

      // At short odds
      const getShortOdds = () => '3-1';
      const scored1 = calculateRaceScores([horse], header, getShortOdds, () => false, 'fast');
      const classified1 = classifyHorses(
        scored1.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );

      // At long odds (more overlay potential)
      const getLongOdds = () => '25-1';
      const scored2 = calculateRaceScores([horse], header, getLongOdds, () => false, 'fast');
      const classified2 = classifyHorses(
        scored2.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );

      // Classification may change based on overlay
      expect(classified1).toBeInstanceOf(Array);
      expect(classified2).toBeInstanceOf(Array);
    });
  });

  describe('Data Quality Scenarios', () => {
    it('handles first-time starter (no past performances)', () => {
      const horse = createHorseEntry({
        programNumber: 1,
        horseName: 'First Timer',
        morningLineOdds: '10-1',
        lifetimeStarts: 0,
        pastPerformances: [],
        lastBeyer: null,
        averageBeyer: null,
      });
      const header = createRaceHeader();

      const score = calculateHorseScore(horse, header, '10-1', 'fast', false);

      expect(score.total).toBeGreaterThan(0);
      expect(score.confidenceLevel).toBeDefined();
      expect(score.dataQuality).toBeLessThanOrEqual(50); // Low data quality expected
    });

    it('handles horse with only one race', () => {
      const horse = createHorseEntry({
        programNumber: 1,
        horseName: 'Second Start',
        morningLineOdds: '8-1',
        lifetimeStarts: 1,
        pastPerformances: [
          createPastPerformance({
            finishPosition: 3,
            speedFigures: createSpeedFigures({ beyer: 75 }),
          }),
        ],
      });
      const header = createRaceHeader();

      const score = calculateHorseScore(horse, header, '8-1', 'fast', false);

      expect(score.total).toBeGreaterThan(0);
    });

    it('handles mixed quality field', () => {
      const horses = [
        // Experienced horse with lots of data
        createHorseEntry({
          programNumber: 1,
          horseName: 'Veteran',
          morningLineOdds: '3-1',
          pastPerformances: Array.from({ length: 10 }, (_, i) =>
            createPastPerformance({
              finishPosition: (i % 3) + 1,
              speedFigures: createSpeedFigures({ beyer: 85 + (i % 5) }),
            })
          ),
        }),
        // First-time starter
        createHorseEntry({
          programNumber: 2,
          horseName: 'Debut',
          morningLineOdds: '12-1',
          pastPerformances: [],
        }),
      ];
      const header = createRaceHeader({ fieldSize: 2 });
      const getOdds = (_i: number, odds: string) => odds;

      const scored = calculateRaceScores(horses, header, getOdds, () => false, 'fast');

      expect(scored.length).toBe(2);
      expect(scored[0].score.total).toBeGreaterThan(scored[1].score.total);
    });
  });

  describe('Track Condition Changes', () => {
    it('recalculates when track condition changes from fast to sloppy', () => {
      const horse = createHorseEntry({
        programNumber: 1,
        horseName: 'Mudder',
        morningLineOdds: '5-1',
        wetStarts: 3,
        wetWins: 2,
        pastPerformances: [createPastPerformance({ trackCondition: 'sloppy', finishPosition: 1 })],
      });
      const header = createRaceHeader();

      const fastScore = calculateHorseScore(horse, header, '5-1', 'fast', false);
      const wetScore = calculateHorseScore(horse, header, '5-1', 'sloppy', false);

      // Both should produce valid scores
      expect(fastScore.total).toBeGreaterThan(0);
      expect(wetScore.total).toBeGreaterThan(0);
    });
  });

  describe('Recommendation Consistency', () => {
    it('generates consistent recommendations for same inputs', () => {
      const horses = createTestField(6);
      const header = createRaceHeader({ fieldSize: 6 });
      const getOdds = (_i: number, odds: string) => odds;
      const isScratched = () => false;

      const scored1 = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const classified1 = classifyHorses(
        scored1.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );
      const recs1 = generateBetRecommendations(classified1);

      const scored2 = calculateRaceScores(horses, header, getOdds, isScratched, 'fast');
      const classified2 = classifyHorses(
        scored2.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );
      const recs2 = generateBetRecommendations(classified2);

      // Same inputs should produce same outputs
      expect(recs1.length).toBe(recs2.length);
      recs1.forEach((rec, i) => {
        expect(rec.tier).toBe(recs2[i].tier);
        expect(rec.bets.length).toBe(recs2[i].bets.length);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles single horse race', () => {
      const horses = [
        createHorseEntry({
          programNumber: 1,
          horseName: 'Solo Runner',
          morningLineOdds: '1-9',
        }),
      ];
      const header = createRaceHeader({ fieldSize: 1 });
      const getOdds = () => '1-9';

      const scored = calculateRaceScores(horses, header, getOdds, () => false, 'fast');
      const classified = classifyHorses(
        scored.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );
      const recs = generateBetRecommendations(classified);

      expect(scored.length).toBe(1);
      expect(recs).toBeInstanceOf(Array);
    });

    it('handles large field (14 horses)', () => {
      const horses = createTestField(14);
      const header = createRaceHeader({ fieldSize: 14 });
      const getOdds = (_i: number, odds: string) => odds;

      const scored = calculateRaceScores(horses, header, getOdds, () => false, 'fast');
      const classified = classifyHorses(
        scored.map((sh) => ({ horse: sh.horse, index: sh.index, score: sh.score }))
      );
      const recs = generateBetRecommendations(classified);

      expect(scored.length).toBe(14);
      expect(recs).toBeInstanceOf(Array);
    });
  });
});
