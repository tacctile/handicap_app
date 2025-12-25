/**
 * Sex Restriction Scoring Tests
 * Tests sex-based adjustments for fillies/mares-only races vs mixed-sex competition
 *
 * Key scenarios:
 * - Filly/mare in fillies-only race = 0 adjustment (baseline)
 * - Filly/mare in mixed/open race = -1 pt (historically tougher)
 * - Male (colt/gelding) in open race = 0 adjustment (baseline)
 * - First-time facing males = flagged for awareness
 * - Can't determine race restriction = 0 adjustment (conservative)
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeSexRestriction,
  calculateSexRestrictionScore,
  isHorseFemale,
  isHorseMale,
  getSexRestrictionSummary,
  hasSexFlags,
  MAX_SEX_ADJUSTMENT,
} from '../../../lib/scoring/sexRestriction';
import { createHorseEntry, createRaceHeader } from '../../fixtures/testHelpers';

describe('Sex Restriction Scoring', () => {
  describe('Constants', () => {
    it('has maximum adjustment of 1', () => {
      expect(MAX_SEX_ADJUSTMENT).toBe(1);
    });
  });

  describe('Sex Detection', () => {
    it('correctly identifies filly as female', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      expect(isHorseFemale(horse)).toBe(true);
      expect(isHorseMale(horse)).toBe(false);
    });

    it('correctly identifies mare as female', () => {
      const horse = createHorseEntry({ sex: 'm', sexFull: 'Mare' });
      expect(isHorseFemale(horse)).toBe(true);
      expect(isHorseMale(horse)).toBe(false);
    });

    it('correctly identifies colt as male', () => {
      const horse = createHorseEntry({ sex: 'c', sexFull: 'Colt' });
      expect(isHorseFemale(horse)).toBe(false);
      expect(isHorseMale(horse)).toBe(true);
    });

    it('correctly identifies gelding as male', () => {
      const horse = createHorseEntry({ sex: 'g', sexFull: 'Gelding' });
      expect(isHorseFemale(horse)).toBe(false);
      expect(isHorseMale(horse)).toBe(true);
    });

    it('correctly identifies horse (intact male) as male', () => {
      const horse = createHorseEntry({ sex: 'h', sexFull: 'Horse' });
      expect(isHorseFemale(horse)).toBe(false);
      expect(isHorseMale(horse)).toBe(true);
    });

    it('correctly identifies ridgling as male', () => {
      const horse = createHorseEntry({ sex: 'r', sexFull: 'Ridgling' });
      expect(isHorseFemale(horse)).toBe(false);
      expect(isHorseMale(horse)).toBe(true);
    });
  });

  describe('Filly in Fillies-Only Race (0 adjustment)', () => {
    it('returns 0 adjustment for filly in F&M restricted race', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: 'F&M' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'f', sexFull: 'Filly', programNumber: 2 }),
        createHorseEntry({ sex: 'm', sexFull: 'Mare', programNumber: 3 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
      expect(result.analysis.isRestrictedRace).toBe(true);
      expect(result.analysis.isMixedRace).toBe(false);
      expect(result.analysis.isFemale).toBe(true);
    });

    it('returns 0 adjustment for mare in F&M restricted race', () => {
      const horse = createHorseEntry({ sex: 'm', sexFull: 'Mare' });
      const raceHeader = createRaceHeader({ sexRestriction: 'F&M' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'f', sexFull: 'Filly', programNumber: 2 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
      expect(result.analysis.isRestrictedRace).toBe(true);
    });

    it('detects restricted race from "fillies" in conditions text', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({
        sexRestriction: '',
        conditions: 'For three year old fillies',
      });
      const fieldHorses = [horse];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
      expect(result.analysis.isRestrictedRace).toBe(true);
      expect(result.analysis.detectionMethod).toBe('conditions_text');
    });

    it('detects restricted race from all-female field composition', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '', conditions: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'f', sexFull: 'Filly', programNumber: 2 }),
        createHorseEntry({ sex: 'm', sexFull: 'Mare', programNumber: 3 }),
        createHorseEntry({ sex: 'f', sexFull: 'Filly', programNumber: 4 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
      expect(result.analysis.isRestrictedRace).toBe(true);
      expect(result.analysis.detectionMethod).toBe('field_composition');
    });
  });

  describe('Filly/Mare in Mixed Race (-1 pt)', () => {
    it('returns -1 adjustment for filly in open race with males', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
        createHorseEntry({ sex: 'g', sexFull: 'Gelding', programNumber: 3 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(-1);
      expect(result.analysis.isRestrictedRace).toBe(false);
      expect(result.analysis.isMixedRace).toBe(true);
      expect(result.analysis.adjustment).toBe(-1);
    });

    it('returns -1 adjustment for mare in open race with males', () => {
      const horse = createHorseEntry({ sex: 'm', sexFull: 'Mare' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
        createHorseEntry({ sex: 'h', sexFull: 'Horse', programNumber: 3 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(-1);
      expect(result.analysis.isMixedRace).toBe(true);
    });

    it('reasoning mentions facing males in open race', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'g', sexFull: 'Gelding', programNumber: 2 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.reasoning.toLowerCase()).toContain('facing males');
    });
  });

  describe('Male in Open Race (0 adjustment)', () => {
    it('returns 0 adjustment for colt in open race', () => {
      const horse = createHorseEntry({ sex: 'c', sexFull: 'Colt' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'g', sexFull: 'Gelding', programNumber: 2 }),
        createHorseEntry({ sex: 'f', sexFull: 'Filly', programNumber: 3 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
      expect(result.analysis.isFemale).toBe(false);
    });

    it('returns 0 adjustment for gelding in open race', () => {
      const horse = createHorseEntry({ sex: 'g', sexFull: 'Gelding' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
    });
  });

  describe('Cannot Determine Race Restriction (0 adjustment)', () => {
    it('returns 0 adjustment when field is empty', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses: ReturnType<typeof createHorseEntry>[] = [];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      // Empty field - can't determine, should be conservative (0)
      expect(result.total).toBe(0);
    });

    it('returns 0 adjustment for unknown sex code', () => {
      const horse = createHorseEntry({ sex: 'u', sexFull: 'Unknown' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBe(0);
    });
  });

  describe('First-Time Facing Males Flag', () => {
    it('flags first-time facing males for experienced filly', () => {
      const horse = createHorseEntry({
        sex: 'f',
        sexFull: 'Filly',
        lifetimeStarts: 5,
        pastPerformances: [
          // All past races in fillies company (detected by lack of "open" markers)
          {
            date: '2024-01-15',
            track: 'CD',
            trackName: 'Churchill Downs',
            raceNumber: 5,
            distanceFurlongs: 6,
            distance: '6f',
            surface: 'dirt',
            trackCondition: 'fast',
            classification: 'allowance',
            claimingPrice: null,
            purse: 50000,
            fieldSize: 8,
            finishPosition: 2,
            lengthsBehind: 1,
            lengthsAhead: null,
            finalTime: 68.5,
            finalTimeFormatted: '1:08.50',
            speedFigures: {
              beyer: 80,
              timeformUS: null,
              equibase: null,
              trackVariant: null,
              dirtVariant: null,
              turfVariant: null,
            },
            runningLine: {
              start: null,
              quarterMile: null,
              quarterMileLengths: null,
              halfMile: null,
              halfMileLengths: null,
              threeQuarters: null,
              threeQuartersLengths: null,
              stretch: null,
              stretchLengths: null,
              finish: 2,
              finishLengths: 1,
            },
            jockey: 'J. Smith',
            weight: 118,
            apprenticeAllowance: 0,
            equipment: '',
            medication: '',
            winner: 'WinnerHorse',
            secondPlace: 'SecondHorse',
            thirdPlace: 'ThirdHorse',
            tripComment: 'Fillies race',
            comment: 'Ran well in fillies only',
            odds: 3.5,
            favoriteRank: 2,
            wasClaimed: false,
            claimedFrom: null,
            daysSinceLast: 28,
            earlyPace1: null,
            latePace: null,
          },
        ],
      });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
        createHorseEntry({ sex: 'g', sexFull: 'Gelding', programNumber: 3 }),
      ];

      const result = analyzeSexRestriction(horse, raceHeader, fieldHorses);

      // Should be flagged as first time facing males
      expect(result.isFirstTimeFacingMales).toBe(true);
      expect(result.flags.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    it('getSexRestrictionSummary returns appropriate text for filly in restricted race', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: 'F&M' });
      const fieldHorses = [horse];

      const analysis = analyzeSexRestriction(horse, raceHeader, fieldHorses);
      const summary = getSexRestrictionSummary(analysis);

      expect(summary).toContain('Restricted race');
    });

    it('getSexRestrictionSummary returns appropriate text for filly facing males', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
      ];

      const analysis = analyzeSexRestriction(horse, raceHeader, fieldHorses);
      const summary = getSexRestrictionSummary(analysis);

      expect(summary).toContain('Facing males');
    });

    it('getSexRestrictionSummary returns appropriate text for male horse', () => {
      const horse = createHorseEntry({ sex: 'c', sexFull: 'Colt' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [horse];

      const analysis = analyzeSexRestriction(horse, raceHeader, fieldHorses);
      const summary = getSexRestrictionSummary(analysis);

      expect(summary).toContain('Male');
    });

    it('hasSexFlags returns true when there are flags', () => {
      const horse = createHorseEntry({
        sex: 'f',
        sexFull: 'Filly',
        lifetimeStarts: 5,
        pastPerformances: [],
      });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
      ];

      const analysis = analyzeSexRestriction(horse, raceHeader, fieldHorses);

      // First time facing males should create flags
      expect(hasSexFlags(analysis)).toBe(true);
    });
  });

  describe('Score Boundaries', () => {
    it('score never exceeds -1', () => {
      // Even in edge cases, adjustment should be capped at -1
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
      ];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBeGreaterThanOrEqual(-MAX_SEX_ADJUSTMENT);
      expect(result.total).toBeLessThanOrEqual(0);
    });

    it('score never goes positive', () => {
      const horse = createHorseEntry({ sex: 'c', sexFull: 'Colt' });
      const raceHeader = createRaceHeader({ sexRestriction: '' });
      const fieldHorses = [horse];

      const result = calculateSexRestrictionScore(horse, raceHeader, fieldHorses);

      expect(result.total).toBeLessThanOrEqual(0);
    });
  });

  describe('Detection Method Tracking', () => {
    it('correctly tracks header detection method', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: 'F&M' });
      const fieldHorses = [horse];

      const result = analyzeSexRestriction(horse, raceHeader, fieldHorses);

      expect(result.detectionMethod).toBe('header');
    });

    it('correctly tracks conditions_text detection method', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({
        sexRestriction: '',
        conditions: 'For fillies and mares, 3 years old and up',
      });
      const fieldHorses = [horse];

      const result = analyzeSexRestriction(horse, raceHeader, fieldHorses);

      expect(result.detectionMethod).toBe('conditions_text');
    });

    it('correctly tracks field_composition detection method', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '', conditions: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'm', sexFull: 'Mare', programNumber: 2 }),
      ];

      const result = analyzeSexRestriction(horse, raceHeader, fieldHorses);

      expect(result.detectionMethod).toBe('field_composition');
    });

    it('correctly tracks none detection method for mixed field', () => {
      const horse = createHorseEntry({ sex: 'f', sexFull: 'Filly' });
      const raceHeader = createRaceHeader({ sexRestriction: '', conditions: '' });
      const fieldHorses = [
        horse,
        createHorseEntry({ sex: 'c', sexFull: 'Colt', programNumber: 2 }),
      ];

      const result = analyzeSexRestriction(horse, raceHeader, fieldHorses);

      expect(result.detectionMethod).toBe('none');
    });
  });
});
