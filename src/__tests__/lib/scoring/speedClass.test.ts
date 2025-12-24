/**
 * Speed & Class Scoring Tests
 * Tests speed figure and class level evaluation
 * Includes track speed normalization tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSpeedClassScore,
  getParFigures,
  getClassHierarchy,
} from '../../../lib/scoring/speedClass';
import {
  getSpeedTier,
  getTrackTierAdjustment,
  getTrackSpeedPar,
  normalizeSpeedFigure,
  analyzeShipper,
  isTier1Track,
  isTier4Track,
  getTracksInTier,
  getTrackSpeedInfo,
} from '../../../lib/scoring/trackSpeedNormalization';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createSpeedFigures,
  createSpeedFigureHorse,
} from '../../fixtures/testHelpers';

describe('Speed & Class Scoring', () => {
  describe('Speed Figure Scoring', () => {
    // NOTE: v2.0 rescaled from 30 max to 48 max (scale factor: 80/50 = 1.6)
    // All tests use LRL (Tier 3, neutral) for consistent tier-neutral scoring
    it('returns 48 points (max) for speed figure 10+ above par', () => {
      const header = createRaceHeader({ classification: 'allowance', trackCode: 'LRL' }); // Par = 82
      const horse = createSpeedFigureHorse([95, 92, 90]); // Best = 95, 13 above par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(48);
    });

    it('returns 40 points for speed figure 5-9 above par', () => {
      const header = createRaceHeader({ classification: 'allowance', trackCode: 'LRL' }); // Par = 82
      const horse = createSpeedFigureHorse([88, 86, 85]); // Best = 88, 6 above par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(40);
    });

    it('returns 32 points for speed figure at par (0-4 above)', () => {
      const header = createRaceHeader({ classification: 'allowance', trackCode: 'LRL' }); // Par = 82
      const horse = createSpeedFigureHorse([84, 82, 80]); // Best = 84, 2 above par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(32);
    });

    it('returns 24 points for speed figure 1-5 below par', () => {
      // Use LRL (Tier 3, neutral) for both race and past performances
      const header = createRaceHeader({ classification: 'allowance', trackCode: 'LRL' }); // Par = 82
      const horse = createSpeedFigureHorse([80, 78, 77]); // Best = 80, 2 below par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(24);
    });

    it('returns 16 points for speed figure 6-10 below par', () => {
      // Use LRL (Tier 3, neutral) for both race and past performances
      const header = createRaceHeader({ classification: 'allowance', trackCode: 'LRL' }); // Par = 82
      const horse = createSpeedFigureHorse([75, 73, 72]); // Best = 75, 7 below par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(16);
    });

    it('returns 8 points for speed figure significantly below par', () => {
      // Use LRL (Tier 3, neutral) for both race and past performances
      const header = createRaceHeader({ classification: 'allowance', trackCode: 'LRL' }); // Par = 82
      const horse = createSpeedFigureHorse([65, 63, 60]); // Best = 65, 17 below par

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(8);
    });

    it('returns neutral 24 for missing speed figures', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        bestBeyer: null,
        averageBeyer: null,
        lastBeyer: null,
        pastPerformances: [
          createPastPerformance({
            speedFigures: createSpeedFigures({ beyer: null }),
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.speedScore).toBe(24);
      expect(result.speedReasoning).toContain('No speed figures');
    });

    it('uses best of last 3 races for scoring', () => {
      const header = createRaceHeader({ classification: 'maiden' }); // Par = 72
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 75 }) }),
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 85 }) }), // Best
          createPastPerformance({ speedFigures: createSpeedFigures({ beyer: 70 }) }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.bestRecentFigure).toBe(85);
    });
  });

  describe('Class Level Scoring', () => {
    // NOTE: v2.0 rescaled from 20 max to 32 max (scale factor: 80/50 = 1.6)
    it('returns 32 points (max) for proven winner at level', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 1 }),
          createPastPerformance({ classification: 'allowance', finishPosition: 3 }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(32);
      expect(result.classReasoning).toContain('Proven winner');
    });

    it('returns 24 points for competitive at level (placed)', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 2 }),
          createPastPerformance({ classification: 'allowance', finishPosition: 3 }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(24);
      expect(result.classReasoning).toContain('Competitive');
    });

    it('returns 16 points for first-time starter (unknown class)', () => {
      const header = createRaceHeader({ classification: 'maiden' });
      const horse = createHorseEntry({
        lifetimeStarts: 0,
        pastPerformances: [],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(16);
      expect(result.classReasoning).toContain('First-time starter');
    });

    it('detects class drop and returns 26+ points', () => {
      const header = createRaceHeader({ classification: 'claiming' }); // Lower class
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 5 }), // Higher class
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classMovement).toBe('drop');
      expect(result.classScore).toBeGreaterThanOrEqual(26);
    });

    it('detects class rise', () => {
      const header = createRaceHeader({ classification: 'stakes' }); // Higher class
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ classification: 'allowance', finishPosition: 1 }), // Lower class
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classMovement).toBe('rise');
    });

    it('returns higher score for class drop with valid excuse', () => {
      const header = createRaceHeader({ classification: 'claiming' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            finishPosition: 6,
            tripComment: 'Wide on both turns, bumped at start',
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.classScore).toBe(29);
      expect(result.classReasoning).toContain('excuse');
    });
  });

  describe('Combined Score', () => {
    it('total is sum of speed and class scores', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createSpeedFigureHorse([85, 83, 80]);

      // Add class history
      horse.pastPerformances = horse.pastPerformances.map((pp) => ({
        ...pp,
        classification: 'allowance' as const,
        finishPosition: 2,
      }));

      const result = calculateSpeedClassScore(horse, header);

      expect(result.total).toBe(result.speedScore + result.classScore);
    });

    // NOTE: v2.0 rescaled from 50 max to 80 max
    it('total score is capped at 80 points', () => {
      const header = createRaceHeader({ classification: 'maiden' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'maiden',
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 95 }),
          }),
          createPastPerformance({
            classification: 'maiden',
            finishPosition: 1,
            speedFigures: createSpeedFigures({ beyer: 90 }),
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.total).toBeLessThanOrEqual(80);
    });
  });

  describe('Par Figures', () => {
    it('returns par figures for all class levels', () => {
      const pars = getParFigures();

      expect(pars['maiden-claiming']).toBe(65);
      expect(pars['maiden']).toBe(72);
      expect(pars['claiming']).toBe(75);
      expect(pars['allowance']).toBe(82);
      expect(pars['stakes-graded-1']).toBe(105);
    });
  });

  describe('Class Hierarchy', () => {
    it('returns correct class hierarchy rankings', () => {
      const hierarchy = getClassHierarchy();

      expect(hierarchy['maiden-claiming']).toBeLessThan(hierarchy['maiden']);
      expect(hierarchy['maiden']).toBeLessThan(hierarchy['claiming']);
      expect(hierarchy['claiming']).toBeLessThan(hierarchy['allowance']);
      expect(hierarchy['allowance']).toBeLessThan(hierarchy['stakes']);
      expect(hierarchy['stakes']).toBeLessThan(hierarchy['stakes-graded-1']);
    });
  });

  describe('Edge Cases', () => {
    it('handles horse with only one past performance', () => {
      const header = createRaceHeader({ classification: 'claiming' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            speedFigures: createSpeedFigures({ beyer: 78 }),
            finishPosition: 4,
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.total).toBeGreaterThan(0);
      expect(result.speedScore).toBeGreaterThan(0);
    });

    it('handles unknown classification gracefully', () => {
      const header = createRaceHeader({ classification: 'unknown' });
      const horse = createSpeedFigureHorse([80, 78, 75]);

      const result = calculateSpeedClassScore(horse, header);

      expect(result.parForClass).toBe(75); // Default for unknown
      expect(result.total).toBeGreaterThan(0);
    });

    it('uses TimeformUS if Beyer not available', () => {
      const header = createRaceHeader({ classification: 'allowance' });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            speedFigures: createSpeedFigures({ beyer: null, timeformUS: 90 }),
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      expect(result.bestRecentFigure).toBe(90);
    });
  });

  // =========================================================================
  // TRACK SPEED NORMALIZATION TESTS
  // =========================================================================

  describe('Track Speed Normalization', () => {
    describe('Track Tier Classification', () => {
      it('correctly classifies Tier 1 (elite) tracks', () => {
        expect(getSpeedTier('SAR')).toBe(1); // Saratoga
        expect(getSpeedTier('DMR')).toBe(1); // Del Mar
        expect(getSpeedTier('KEE')).toBe(1); // Keeneland
        expect(getSpeedTier('SA')).toBe(1); // Santa Anita
        expect(getSpeedTier('BEL')).toBe(1); // Belmont

        expect(isTier1Track('SAR')).toBe(true);
        expect(isTier1Track('FL')).toBe(false);
      });

      it('correctly classifies Tier 2 (strong) tracks', () => {
        expect(getSpeedTier('GP')).toBe(2); // Gulfstream
        expect(getSpeedTier('CD')).toBe(2); // Churchill
        expect(getSpeedTier('OP')).toBe(2); // Oaklawn
        expect(getSpeedTier('AQU')).toBe(2); // Aqueduct
      });

      it('correctly classifies Tier 3 (average) tracks', () => {
        expect(getSpeedTier('LRL')).toBe(3); // Laurel
        expect(getSpeedTier('FG')).toBe(3); // Fair Grounds
        expect(getSpeedTier('TAM')).toBe(3); // Tampa Bay Downs
        expect(getSpeedTier('PRX')).toBe(3); // Parx
      });

      it('correctly classifies Tier 4 (weak) tracks', () => {
        expect(getSpeedTier('FL')).toBe(4); // Finger Lakes
        expect(getSpeedTier('FON')).toBe(4); // Fonner Park
        expect(getSpeedTier('BTP')).toBe(4); // Belterra Park
        expect(getSpeedTier('SUN')).toBe(4); // Sunland

        expect(isTier4Track('FL')).toBe(true);
        expect(isTier4Track('SAR')).toBe(false);
      });

      it('defaults unknown tracks to Tier 3', () => {
        expect(getSpeedTier('UNKNOWN')).toBe(3);
        expect(getSpeedTier('XYZ')).toBe(3);
      });
    });

    describe('Tier Adjustments', () => {
      it('returns positive adjustment for Tier 1 tracks', () => {
        expect(getTrackTierAdjustment('SAR')).toBe(5);
        expect(getTrackTierAdjustment('BEL')).toBe(5);
      });

      it('returns positive adjustment for Tier 2 tracks', () => {
        expect(getTrackTierAdjustment('GP')).toBe(2);
        expect(getTrackTierAdjustment('CD')).toBe(2);
      });

      it('returns zero adjustment for Tier 3 tracks (baseline)', () => {
        expect(getTrackTierAdjustment('LRL')).toBe(0);
        expect(getTrackTierAdjustment('TAM')).toBe(0);
      });

      it('returns negative adjustment for Tier 4 tracks', () => {
        expect(getTrackTierAdjustment('FL')).toBe(-3);
        expect(getTrackTierAdjustment('FON')).toBe(-3);
      });
    });

    describe('Speed Figure Normalization', () => {
      it('normalizes figure based on track tier', () => {
        // 88 Beyer at Saratoga (Tier 1) should be boosted
        const sarResult = normalizeSpeedFigure(88, 'SAR', 6, 'allowance');
        expect(sarResult.rawFigure).toBe(88);
        expect(sarResult.tierAdjustment).toBe(5);
        expect(sarResult.normalizedFigure).toBe(93); // 88 + 5

        // 88 Beyer at Finger Lakes (Tier 4) should be penalized
        const flResult = normalizeSpeedFigure(88, 'FL', 6, 'allowance');
        expect(flResult.rawFigure).toBe(88);
        expect(flResult.tierAdjustment).toBe(-3);
        expect(flResult.normalizedFigure).toBe(85); // 88 - 3
      });

      it('includes reasoning about track tier', () => {
        const result = normalizeSpeedFigure(88, 'SAR', 6, 'allowance');
        expect(result.reasoning).toContain('SAR');
        expect(result.reasoning).toContain('Tier 1');
        expect(result.reasoning).toContain('Elite');
      });
    });

    describe('Shipper Analysis', () => {
      it('detects shipping from Tier 1 to Tier 4 (shipping down)', () => {
        const result = analyzeShipper('SAR', 'FL');

        expect(result.isShipping).toBe(true);
        expect(result.fromTier).toBe(1);
        expect(result.toTier).toBe(4);
        expect(result.tierChange).toBe(3); // 1 - 4 = -3, but we store as positive for down
        expect(result.adjustment).toBeGreaterThan(0); // Boost for shipping down
      });

      it('detects shipping from Tier 4 to Tier 1 (shipping up)', () => {
        const result = analyzeShipper('FL', 'SAR');

        expect(result.isShipping).toBe(true);
        expect(result.fromTier).toBe(4);
        expect(result.toTier).toBe(1);
        expect(result.tierChange).toBe(-3); // 4 - 1 = 3, negative for up
        expect(result.adjustment).toBeLessThan(0); // Penalty for shipping up
      });

      it('returns no shipping for same tier', () => {
        // Both Tier 1
        const result = analyzeShipper('SAR', 'BEL');
        expect(result.isShipping).toBe(false);
        expect(result.tierChange).toBe(0);
        expect(result.adjustment).toBe(0);
      });

      it('handles null previous track', () => {
        const result = analyzeShipper(null, 'SAR');
        expect(result.isShipping).toBe(false);
        expect(result.fromTrack).toBeNull();
      });
    });

    describe('Track Speed Pars', () => {
      it('returns par figure for track with data', () => {
        // Saratoga has winning time data
        const par = getTrackSpeedPar('SAR', 6, 'allowance');
        expect(par).not.toBeNull();
        expect(par).toBeGreaterThan(70);
        expect(par).toBeLessThan(100);
      });

      it('returns null for track without data', () => {
        const par = getTrackSpeedPar('UNKNOWN', 6, 'allowance');
        expect(par).toBeNull();
      });

      it('returns different pars for different class levels', () => {
        const claimingPar = getTrackSpeedPar('SAR', 6, 'claiming');
        const stakesPar = getTrackSpeedPar('SAR', 6, 'stakes');

        if (claimingPar !== null && stakesPar !== null) {
          expect(stakesPar).toBeGreaterThan(claimingPar);
        }
      });
    });

    describe('Track Info', () => {
      it('returns comprehensive track info', () => {
        const info = getTrackSpeedInfo('SAR');
        expect(info.trackCode).toBe('SAR');
        expect(info.tier).toBe(1);
        expect(info.tierName).toBe('Elite');
        expect(info.tierAdjustment).toBe(5);
      });

      it('returns tracks by tier', () => {
        const tier1 = getTracksInTier(1);
        expect(tier1).toContain('SAR');
        expect(tier1).toContain('BEL');
        expect(tier1).not.toContain('FL');

        const tier4 = getTracksInTier(4);
        expect(tier4).toContain('FL');
        expect(tier4).not.toContain('SAR');
      });
    });
  });

  describe('Speed/Class Score with Track Normalization', () => {
    it('includes track normalization info in result', () => {
      const header = createRaceHeader({
        trackCode: 'SAR',
        classification: 'allowance',
        distanceFurlongs: 6,
      });
      const horse = createSpeedFigureHorse([88, 86, 85]);

      const result = calculateSpeedClassScore(horse, header);

      expect(result.trackNormalization).toBeDefined();
      expect(result.trackNormalization?.currentTrackTier).toBe(1);
      expect(result.trackNormalization?.currentTrackTierName).toBe('Elite');
    });

    it('applies tier adjustment when comparing 88 Beyer at Saratoga vs Finger Lakes', () => {
      // Scenario: 88 Beyer at Saratoga (Tier 1)
      const sarHeader = createRaceHeader({
        trackCode: 'SAR',
        classification: 'allowance',
        distanceFurlongs: 6,
      });
      const sarHorse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            track: 'SAR',
            speedFigures: createSpeedFigures({ beyer: 88 }),
            classification: 'allowance',
            finishPosition: 2,
          }),
        ],
      });

      const sarResult = calculateSpeedClassScore(sarHorse, sarHeader);

      // Scenario: 88 Beyer at Finger Lakes (Tier 4)
      const flHeader = createRaceHeader({
        trackCode: 'FL',
        classification: 'allowance',
        distanceFurlongs: 6,
      });
      const flHorse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            track: 'FL',
            speedFigures: createSpeedFigures({ beyer: 88 }),
            classification: 'allowance',
            finishPosition: 2,
          }),
        ],
      });

      const flResult = calculateSpeedClassScore(flHorse, flHeader);

      // Saratoga 88 should score higher than Finger Lakes 88
      // Due to tier adjustment: SAR (+5) vs FL (-3) = 8 point difference in effective figure
      expect(sarResult.speedScore).toBeGreaterThan(flResult.speedScore);
    });

    it('detects and adjusts for shipping from Tier 3 to Tier 1', () => {
      // Horse running at SAR (Tier 1) with recent races at LRL (Tier 3)
      const header = createRaceHeader({
        trackCode: 'SAR', // Tier 1
        classification: 'allowance',
        distanceFurlongs: 6,
      });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            track: 'LRL', // Tier 3 - shipping up to Tier 1
            speedFigures: createSpeedFigures({ beyer: 85 }),
            classification: 'allowance',
            finishPosition: 1,
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      // Should detect shipping up (penalty expected)
      expect(result.trackNormalization?.shipperAnalysis).toBeDefined();
      expect(result.trackNormalization?.shipperAnalysis?.isShipping).toBe(true);
      expect(result.trackNormalization?.shipperAnalysis?.adjustment).toBeLessThan(0);
      expect(result.speedReasoning).toContain('Shipping up');
    });

    it('falls back to raw figure when no par data available', () => {
      const header = createRaceHeader({
        trackCode: 'UNKNOWN', // Unknown track - no par data
        classification: 'allowance',
        distanceFurlongs: 6,
      });
      const horse = createSpeedFigureHorse([85, 83, 80]);

      const result = calculateSpeedClassScore(horse, header);

      // Should still calculate a score using raw figure
      expect(result.total).toBeGreaterThan(0);
      expect(result.speedScore).toBeGreaterThan(0);
      expect(result.trackNormalization?.trackParFigure).toBeNull();
    });

    it('calculates par differential correctly', () => {
      const header = createRaceHeader({
        trackCode: 'SAR',
        classification: 'allowance',
        distanceFurlongs: 6,
      });
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            track: 'SAR',
            speedFigures: createSpeedFigures({ beyer: 92 }),
            classification: 'allowance',
            finishPosition: 1,
          }),
        ],
      });

      const result = calculateSpeedClassScore(horse, header);

      // Should have par data and calculate differential
      if (result.trackNormalization?.trackParFigure !== null) {
        expect(result.trackNormalization?.parDifferential).toBeDefined();
        // 92 Beyer should be above typical allowance par
        expect(result.trackNormalization?.parDifferential).toBeGreaterThan(0);
      }
    });
  });
});
