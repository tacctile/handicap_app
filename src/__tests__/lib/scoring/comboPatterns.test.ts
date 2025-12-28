/**
 * Combo Patterns Scoring Tests
 * Tests for high-value play detection where multiple positive signals align
 */

import { describe, it, expect } from 'vitest';
import {
  detectComboPatterns,
  hasComboPatterns,
  getComboPatternSummary,
  getIntentLevel,
  isClassDrop,
  isFirstTimeLasix,
  isFirstTimeBlinkers,
  isSecondOffLayoff,
  hasBulletWork,
  isTrainerHot,
  isFirstTimeTurf,
  hasTurfBreeding,
  MAX_COMBO_PATTERN_POINTS,
} from '../../../lib/scoring/comboPatterns';
import {
  createHorseEntry,
  createPastPerformance,
  createEquipment,
  createMedication,
  createRaceHeader,
  createWorkout,
  createBreeding,
} from '../../fixtures/testHelpers';

describe('Combo Patterns Detection', () => {
  describe('Class Drop + First Time Lasix = 1 pt (v3.0)', () => {
    it('detects class drop + first time Lasix combo', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            medication: '',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v3.0: Combo patterns reduced to 1 pt
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('classDropLasix');
      expect(result.detectedCombos[0]?.points).toBe(1);
      expect(result.detectedCombos[0]?.components).toContain('classDrop');
      expect(result.detectedCombos[0]?.components).toContain('firstTimeLasix');
    });
  });

  describe('Class Drop + First Time Blinkers = 3 pts', () => {
    it('detects class drop + first time blinkers combo', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
          raw: 'B',
        }),
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            equipment: '',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v2.5: Halved from 3 to 1
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('classDropBlinkers');
      expect(result.detectedCombos[0]?.points).toBe(1);
    });
  });

  describe('Class Drop + Jockey Upgrade = 2 pts (v2.5)', () => {
    it('detects class drop + jockey upgrade combo', () => {
      const horse = createHorseEntry({
        jockeyName: 'Star Jockey',
        jockeyMeetStarts: 50,
        jockeyMeetWins: 12, // 24% win rate
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            jockey: 'Average Jockey',
            finishPosition: 5,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 6,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 4,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 7,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 8,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 3,
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v3.0: Further reduced to 1 pt
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('classDropJockeyUpgrade');
      expect(result.detectedCombos[0]?.points).toBe(1);
    });
  });

  describe('Class Drop + Hot Trainer = 3 pts', () => {
    it('detects class drop + hot trainer combo', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 20,
        trainerMeetWins: 6, // 30% win rate
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v2.5: Halved from 3 to 1
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('classDropHotTrainer');
      expect(result.detectedCombos[0]?.points).toBe(1);
    });
  });

  describe('Triple Combo: Class + Equipment + Jockey = 2 pts (v3.0)', () => {
    it('detects triple combo and awards 2 pts (not individual combos)', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        jockeyName: 'Star Jockey',
        jockeyMeetStarts: 50,
        jockeyMeetWins: 12, // 24% win rate
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            medication: '',
            jockey: 'Average Jockey',
            finishPosition: 5,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 6,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 4,
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v3.0: Further reduced to 2 pts
      expect(result.total).toBe(2);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('tripleClassEquipmentJockey');
      expect(result.detectedCombos[0]?.points).toBe(2);
      expect(result.detectedCombos[0]?.components).toContain('classDrop');
      expect(result.detectedCombos[0]?.components).toContain('equipment');
      expect(result.detectedCombos[0]?.components).toContain('jockeyUpgrade');
    });
  });

  describe('2nd Off Layoff + Bullet Work = 1 pt (v3.0)', () => {
    it('detects second off layoff + bullet work combo', () => {
      const today = new Date();
      const recentDate = new Date(today);
      recentDate.setDate(recentDate.getDate() - 7);

      const horse = createHorseEntry({
        workouts: [
          createWorkout({
            date: recentDate.toISOString().split('T')[0]!,
            isBullet: true,
          }),
        ],
        pastPerformances: [
          createPastPerformance({
            daysSinceLast: 50, // 50+ days before last race = today is 2nd off layoff
          }),
          createPastPerformance({
            daysSinceLast: 21,
          }),
        ],
      });
      const header = createRaceHeader();

      const result = detectComboPatterns(horse, header, [horse]);

      // v3.0: Further reduced to 1 pt
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('secondLayoffBullet');
      expect(result.detectedCombos[0]?.points).toBe(1);
    });
  });

  describe('Layoff + Class Drop = 1 pt (v3.0)', () => {
    it('detects layoff + class drop combo', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 60, // Returning from layoff
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v3.0: Further reduced to 1 pt
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('layoffClassDrop');
      expect(result.detectedCombos[0]?.points).toBe(1);
    });
  });

  describe('First Time Turf + Turf Breeding = 2 pts', () => {
    it('detects first time turf + turf breeding combo', () => {
      const horse = createHorseEntry({
        breeding: createBreeding({
          sire: "Kitten's Joy",
          damSire: 'Storm Cat',
        }),
        turfStarts: 0,
        pastPerformances: [
          createPastPerformance({
            surface: 'dirt',
          }),
        ],
      });
      const header = createRaceHeader({
        surface: 'turf',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // v2.5: Halved from 2 to 1
      expect(result.total).toBe(1);
      expect(result.detectedCombos.length).toBe(1);
      expect(result.detectedCombos[0]?.combo).toBe('firstTurfWithBreeding');
      expect(result.detectedCombos[0]?.points).toBe(1);
    });
  });

  describe('No Combo Signals = 0 pts', () => {
    it('returns 0 points when no combo patterns detected', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'claiming', // Same class
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      expect(result.total).toBe(0);
      expect(result.detectedCombos.length).toBe(0);
    });
  });

  describe('Single Signal Without Combo Partner = 0 pts', () => {
    it('returns 0 points for class drop alone', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      expect(result.total).toBe(0);
      expect(result.detectedCombos.length).toBe(0);
    });

    it('returns 0 points for first time Lasix alone', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        pastPerformances: [
          createPastPerformance({
            classification: 'claiming', // Same class
            medication: '',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      expect(result.total).toBe(0);
      expect(result.detectedCombos.length).toBe(0);
    });
  });

  describe('Multiple Combos Stack Up To Cap', () => {
    it('stacks multiple combos but caps at 12 points', () => {
      const today = new Date();
      const recentDate = new Date(today);
      recentDate.setDate(recentDate.getDate() - 7);

      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        trainerMeetStarts: 20,
        trainerMeetWins: 6, // 30% win rate (hot trainer)
        daysSinceLastRace: 60, // Returning from layoff
        workouts: [
          createWorkout({
            date: recentDate.toISOString().split('T')[0]!,
            isBullet: true,
          }),
        ],
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            medication: '',
            daysSinceLast: 50, // Also triggers 2nd off layoff check
          }),
          createPastPerformance({
            classification: 'allowance',
            daysSinceLast: 21,
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      // Multiple combos should trigger:
      // - Class drop + Lasix (4) - but this gets overridden by triple layoff combo
      // - Class drop + hot trainer (3)
      // - Layoff + Class drop (3) - but this gets overridden by triple layoff combo
      // - 2nd off layoff + bullet (3)
      // Or triple: Layoff + Class Drop + Equipment (5)
      // Total could be high, but capped at 12
      expect(result.total).toBeLessThanOrEqual(MAX_COMBO_PATTERN_POINTS);
      expect(result.detectedCombos.length).toBeGreaterThan(0);
    });
  });

  describe('Intent Score', () => {
    it('calculates low intent score for no signals', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance()],
      });
      const header = createRaceHeader();

      const result = detectComboPatterns(horse, header, [horse]);

      expect(result.intentScore).toBeLessThan(4);
      expect(getIntentLevel(result.intentScore)).toBe('Low Intent');
    });

    it('calculates high intent score for multiple signals', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        jockeyName: 'Star Jockey',
        jockeyMeetStarts: 50,
        jockeyMeetWins: 12,
        trainerMeetStarts: 20,
        trainerMeetWins: 6,
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            medication: '',
            jockey: 'Average Jockey',
            finishPosition: 5,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 6,
          }),
          createPastPerformance({
            jockey: 'Average Jockey',
            finishPosition: 4,
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      const result = detectComboPatterns(horse, header, [horse]);

      expect(result.intentScore).toBeGreaterThanOrEqual(6);
      expect(['High Intent', 'Maximum Intent']).toContain(getIntentLevel(result.intentScore));
    });
  });
});

describe('Signal Detection Helpers', () => {
  describe('isClassDrop', () => {
    it('returns true for class drop', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      expect(isClassDrop(horse, header)).toBe(true);
    });

    it('returns false for class rise', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            classification: 'claiming',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'allowance',
      });

      expect(isClassDrop(horse, header)).toBe(false);
    });

    it('returns false for first time starter', () => {
      const horse = createHorseEntry({
        pastPerformances: [],
      });
      const header = createRaceHeader();

      expect(isClassDrop(horse, header)).toBe(false);
    });
  });

  describe('isFirstTimeLasix', () => {
    it('returns true for explicit first time Lasix', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
      });

      expect(isFirstTimeLasix(horse)).toBe(true);
    });

    it('returns true when Lasix added since last race', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: false,
          lasix: true,
          raw: 'L',
        }),
        pastPerformances: [
          createPastPerformance({
            medication: '',
          }),
        ],
      });

      expect(isFirstTimeLasix(horse)).toBe(true);
    });

    it('returns false when already on Lasix', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: false,
          lasix: true,
          raw: 'L',
        }),
        pastPerformances: [
          createPastPerformance({
            medication: 'L',
          }),
        ],
      });

      expect(isFirstTimeLasix(horse)).toBe(false);
    });
  });

  describe('isFirstTimeBlinkers', () => {
    it('returns true for explicit first time blinkers', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: ['blinkers'],
        }),
      });

      expect(isFirstTimeBlinkers(horse)).toBe(true);
    });

    it('returns true when blinkers added since last race', () => {
      const horse = createHorseEntry({
        equipment: createEquipment({
          blinkers: true,
          firstTimeEquipment: [],
        }),
        pastPerformances: [
          createPastPerformance({
            equipment: '',
          }),
        ],
      });

      expect(isFirstTimeBlinkers(horse)).toBe(true);
    });
  });

  describe('isTrainerHot', () => {
    it('returns true for 25%+ win rate with 5+ starts', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 20,
        trainerMeetWins: 6, // 30%
      });

      expect(isTrainerHot(horse)).toBe(true);
    });

    it('returns false for insufficient starts', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 4,
        trainerMeetWins: 2, // 50% but only 4 starts
      });

      expect(isTrainerHot(horse)).toBe(false);
    });

    it('returns false for low win rate', () => {
      const horse = createHorseEntry({
        trainerMeetStarts: 20,
        trainerMeetWins: 3, // 15%
      });

      expect(isTrainerHot(horse)).toBe(false);
    });
  });

  describe('hasBulletWork', () => {
    it('returns true for recent bullet work', () => {
      const today = new Date();
      const recentDate = new Date(today);
      recentDate.setDate(recentDate.getDate() - 7);

      const horse = createHorseEntry({
        workouts: [
          createWorkout({
            date: recentDate.toISOString().split('T')[0]!,
            isBullet: true,
          }),
        ],
      });

      expect(hasBulletWork(horse, 30)).toBe(true);
    });

    it('returns false for old bullet work', () => {
      const today = new Date();
      const oldDate = new Date(today);
      oldDate.setDate(oldDate.getDate() - 60);

      const horse = createHorseEntry({
        workouts: [
          createWorkout({
            date: oldDate.toISOString().split('T')[0]!,
            isBullet: true,
          }),
        ],
      });

      expect(hasBulletWork(horse, 30)).toBe(false);
    });
  });

  describe('isSecondOffLayoff', () => {
    it('returns true when last race was first off layoff', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            daysSinceLast: 50, // 50 days gap before last race
          }),
          createPastPerformance({
            daysSinceLast: 21,
          }),
        ],
      });

      expect(isSecondOffLayoff(horse)).toBe(true);
    });

    it('returns false when last race was not off layoff', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({
            daysSinceLast: 21,
          }),
          createPastPerformance({
            daysSinceLast: 28,
          }),
        ],
      });

      expect(isSecondOffLayoff(horse)).toBe(false);
    });
  });

  describe('hasTurfBreeding', () => {
    it('returns true for known turf sire', () => {
      const horse = createHorseEntry({
        breeding: createBreeding({
          sire: "Kitten's Joy",
        }),
      });

      expect(hasTurfBreeding(horse)).toBe(true);
    });

    it('returns true for known turf damsire', () => {
      const horse = createHorseEntry({
        breeding: createBreeding({
          sire: 'Unknown Sire',
          damSire: 'English Channel',
        }),
      });

      expect(hasTurfBreeding(horse)).toBe(true);
    });

    it('returns false for unknown pedigree', () => {
      const horse = createHorseEntry({
        breeding: createBreeding({
          sire: 'Obscure Stallion',
          damSire: 'Random Horse',
        }),
      });

      expect(hasTurfBreeding(horse)).toBe(false);
    });
  });

  describe('isFirstTimeTurf', () => {
    it('returns true for first turf start', () => {
      const horse = createHorseEntry({
        turfStarts: 0,
        pastPerformances: [
          createPastPerformance({
            surface: 'dirt',
          }),
        ],
      });
      const header = createRaceHeader({
        surface: 'turf',
      });

      expect(isFirstTimeTurf(horse, header)).toBe(true);
    });

    it('returns false when has previous turf starts', () => {
      const horse = createHorseEntry({
        turfStarts: 2,
      });
      const header = createRaceHeader({
        surface: 'turf',
      });

      expect(isFirstTimeTurf(horse, header)).toBe(false);
    });

    it('returns false for dirt race', () => {
      const horse = createHorseEntry({
        turfStarts: 0,
      });
      const header = createRaceHeader({
        surface: 'dirt',
      });

      expect(isFirstTimeTurf(horse, header)).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('hasComboPatterns', () => {
    it('returns true when combos detected', () => {
      const horse = createHorseEntry({
        medication: createMedication({
          lasixFirstTime: true,
          lasix: true,
          raw: 'L1',
        }),
        pastPerformances: [
          createPastPerformance({
            classification: 'allowance',
            medication: '',
          }),
        ],
      });
      const header = createRaceHeader({
        classification: 'claiming',
      });

      expect(hasComboPatterns(horse, header)).toBe(true);
    });

    it('returns false when no combos detected', () => {
      const horse = createHorseEntry({
        pastPerformances: [createPastPerformance()],
      });
      const header = createRaceHeader();

      expect(hasComboPatterns(horse, header)).toBe(false);
    });
  });

  describe('getComboPatternSummary', () => {
    it('returns summary for detected combos', () => {
      const result = {
        total: 4,
        detectedCombos: [
          {
            combo: 'classDropLasix',
            components: ['classDrop', 'firstTimeLasix'],
            points: 4,
            reasoning: 'Test',
          },
        ],
        intentScore: 5,
        reasoning: ['Test'],
      };

      const summary = getComboPatternSummary(result);

      expect(summary).toContain('4 pts');
      expect(summary).toContain('1 combo');
      expect(summary).toContain('classDropLasix');
    });

    it('returns appropriate message when no combos', () => {
      const result = {
        total: 0,
        detectedCombos: [],
        intentScore: 0,
        reasoning: [],
      };

      const summary = getComboPatternSummary(result);

      expect(summary).toBe('No combo patterns detected');
    });
  });

  describe('getIntentLevel', () => {
    it('returns correct intent levels', () => {
      expect(getIntentLevel(0)).toBe('Low Intent');
      expect(getIntentLevel(2)).toBe('Some Intent');
      expect(getIntentLevel(4)).toBe('Moderate Intent');
      expect(getIntentLevel(6)).toBe('High Intent');
      expect(getIntentLevel(8)).toBe('Maximum Intent');
      expect(getIntentLevel(10)).toBe('Maximum Intent');
    });
  });
});
