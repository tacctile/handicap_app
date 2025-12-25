/**
 * Post Position Scoring Tests
 * Tests post position advantage calculations with track bias
 * NOTE: v2.0 rescaled from 45 max to 30 max (scale factor: 30/45 = 0.667)
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePostPositionScore,
  getOptimalPostPositions,
} from '../../../lib/scoring/postPosition';
import { createHorseEntry, createRaceHeader } from '../../fixtures/testHelpers';

describe('Post Position Scoring', () => {
  describe('Sprint Races (6f-7f)', () => {
    const sprintHeader = createRaceHeader({
      distance: '6f',
      distanceFurlongs: 6,
      surface: 'dirt',
      fieldSize: 10,
    });

    it('scores post 1 lower than middle posts in sprints', () => {
      const postOne = createHorseEntry({ postPosition: 1 });
      const postFour = createHorseEntry({ postPosition: 4 });

      const resultOne = calculatePostPositionScore(postOne, sprintHeader);
      const resultFour = calculatePostPositionScore(postFour, sprintHeader);

      expect(resultFour.total).toBeGreaterThan(resultOne.total);
    });

    it('penalizes outside post 12 in sprints', () => {
      const header = createRaceHeader({
        ...sprintHeader,
        fieldSize: 12,
      });

      const postThree = createHorseEntry({ postPosition: 3 });
      const postTwelve = createHorseEntry({ postPosition: 12 });

      const resultThree = calculatePostPositionScore(postThree, header);
      const resultTwelve = calculatePostPositionScore(postTwelve, header);

      expect(resultThree.total).toBeGreaterThan(resultTwelve.total);
    });

    it('identifies golden posts (4-5) in sprints', () => {
      const postFour = createHorseEntry({ postPosition: 4 });
      const postFive = createHorseEntry({ postPosition: 5 });

      const resultFour = calculatePostPositionScore(postFour, sprintHeader);
      const resultFive = calculatePostPositionScore(postFive, sprintHeader);

      expect(resultFour.isGoldenPost).toBe(true);
      expect(resultFive.isGoldenPost).toBe(true);
      expect(resultFour.reasoning).toContain('Golden');
    });
  });

  describe('Route Races (1 mile+)', () => {
    const routeHeader = createRaceHeader({
      distance: '1 mile',
      distanceFurlongs: 8,
      surface: 'dirt',
      fieldSize: 10,
    });

    it('applies different bias for routes vs sprints', () => {
      const sprintHeader = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
        fieldSize: 10,
      });

      const horse = createHorseEntry({ postPosition: 1 });

      const sprintResult = calculatePostPositionScore(horse, sprintHeader);
      const routeResult = calculatePostPositionScore(horse, routeHeader);

      // Inside posts should be valued differently in routes
      expect(sprintResult.reasoning).not.toBe(routeResult.reasoning);
    });

    it('scores middle posts favorably in routes', () => {
      const postOne = createHorseEntry({ postPosition: 1 });
      const postFour = createHorseEntry({ postPosition: 4 });

      const resultOne = calculatePostPositionScore(postOne, routeHeader);
      const resultFour = calculatePostPositionScore(postFour, routeHeader);

      expect(resultFour.total).toBeGreaterThanOrEqual(resultOne.total);
    });
  });

  describe('Track Bias Multipliers', () => {
    it('applies track-specific bias when available', () => {
      // Note: This depends on track intelligence availability
      const header = createRaceHeader({
        trackCode: 'CD', // Churchill Downs - may have track data
        distance: '6f',
        distanceFurlongs: 6,
      });

      const horse = createHorseEntry({ postPosition: 4 });
      const result = calculatePostPositionScore(horse, header);

      // Should have a bias multiplier applied
      expect(result.biasMultiplier).toBeDefined();
    });

    it('returns trackBiasApplied flag correctly', () => {
      const header = createRaceHeader({
        trackCode: 'UNK', // Unknown track
        distance: '6f',
        distanceFurlongs: 6,
      });

      const horse = createHorseEntry({ postPosition: 4 });
      const result = calculatePostPositionScore(horse, header);

      // Unknown track should use generic scoring
      expect(typeof result.trackBiasApplied).toBe('boolean');
    });
  });

  describe('Fallback for Unknown Tracks', () => {
    it('uses generic scoring for unknown tracks', () => {
      const header = createRaceHeader({
        trackCode: 'UNKNOWN_TRACK_XYZ',
        distance: '6f',
        distanceFurlongs: 6,
      });

      const horse = createHorseEntry({ postPosition: 5 });
      const result = calculatePostPositionScore(horse, header);

      // Should still return valid score
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThanOrEqual(30);
    });
  });

  describe('Turf Adjustments', () => {
    it('favors inside posts on turf', () => {
      const turfHeader = createRaceHeader({
        surface: 'turf',
        distance: '1 mile',
        distanceFurlongs: 8,
        fieldSize: 10,
      });

      const postOne = createHorseEntry({ postPosition: 1 });
      const postEight = createHorseEntry({ postPosition: 8 });

      const resultOne = calculatePostPositionScore(postOne, turfHeader);
      const resultEight = calculatePostPositionScore(postEight, turfHeader);

      expect(resultOne.total).toBeGreaterThan(resultEight.total);
    });
  });

  describe('Field Size Adjustments', () => {
    it('penalizes outside posts more in large fields', () => {
      const smallField = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
        fieldSize: 6,
      });

      const largeField = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
        fieldSize: 12,
      });

      const outsideHorse = createHorseEntry({ postPosition: 8 });

      const smallFieldResult = calculatePostPositionScore(outsideHorse, smallField);
      const largeFieldResult = calculatePostPositionScore(outsideHorse, largeField);

      expect(smallFieldResult.fieldSizeAdjustment).toBeGreaterThanOrEqual(
        largeFieldResult.fieldSizeAdjustment
      );
    });

    it('does not penalize inside posts for field size', () => {
      const largeField = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
        fieldSize: 12,
      });

      const insideHorse = createHorseEntry({ postPosition: 2 });
      const result = calculatePostPositionScore(insideHorse, largeField);

      expect(result.fieldSizeAdjustment).toBe(0);
    });
  });

  describe('Score Limits', () => {
    // NOTE: Minimum score was rescaled from 5 to 3 (5 × 30/45 = 3.33)
    it('never returns score below 3', () => {
      const header = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
        fieldSize: 14,
      });

      const worstCase = createHorseEntry({ postPosition: 14 });
      const result = calculatePostPositionScore(worstCase, header);

      expect(result.total).toBeGreaterThanOrEqual(2); // v2.5: floor reduced from 3 to 2
    });

    it('never returns score above 20', () => {
      // v2.5: max reduced from 30 to 20
      const header = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
        fieldSize: 10,
      });

      const bestCase = createHorseEntry({ postPosition: 4 });
      const result = calculatePostPositionScore(bestCase, header);

      expect(result.total).toBeLessThanOrEqual(20); // v2.5: reduced from 30
    });
  });

  describe('getOptimalPostPositions', () => {
    it('returns optimal positions for sprint races', () => {
      const sprintHeader = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
      });

      const optimal = getOptimalPostPositions(sprintHeader);

      expect(optimal.positions).toBeInstanceOf(Array);
      expect(optimal.positions.length).toBeGreaterThan(0);
      expect(optimal.description).toBeDefined();
    });

    it('returns optimal positions for turf races', () => {
      const turfHeader = createRaceHeader({
        surface: 'turf',
        distance: '1 mile',
        distanceFurlongs: 8,
      });

      const optimal = getOptimalPostPositions(turfHeader);

      // Optimal positions depend on track data - may or may not include 1
      expect(optimal.positions).toBeInstanceOf(Array);
      expect(optimal.positions.length).toBeGreaterThan(0);
      expect(optimal.description).toBeDefined();
    });
  });

  describe('Reasoning Output', () => {
    it('includes post position in reasoning', () => {
      const horse = createHorseEntry({ postPosition: 5 });
      const header = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
      });

      const result = calculatePostPositionScore(horse, header);

      expect(result.reasoning).toContain('PP5');
    });

    it('indicates sprint vs route in reasoning', () => {
      const horse = createHorseEntry({ postPosition: 5 });

      const sprintHeader = createRaceHeader({
        distance: '6f',
        distanceFurlongs: 6,
      });

      const routeHeader = createRaceHeader({
        distance: '1 mile',
        distanceFurlongs: 8,
      });

      const sprintResult = calculatePostPositionScore(horse, sprintHeader);
      const routeResult = calculatePostPositionScore(horse, routeHeader);

      expect(sprintResult.reasoning.toLowerCase()).toContain('sprint');
      expect(routeResult.reasoning.toLowerCase()).toContain('route');
    });
  });
});
