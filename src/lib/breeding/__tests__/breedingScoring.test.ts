/**
 * Breeding Scoring Tests
 *
 * Tests for the breeding-based scoring system for lightly raced horses.
 * Validates score calculations, bonuses, and weight adjustments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateDetailedBreedingScore,
  calculateBreedingScoreForHorse,
  getBreedingScoreWeight,
  calculateBreedingContribution,
  shouldShowBreedingAnalysis,
  getBreedingScoreDisplay,
  BREEDING_CATEGORY_LIMITS,
} from '../breedingScoring';
import type { DetailedBreedingScore } from '../breedingScoring';
import type { BreedingScore } from '../types';
import {
  createHorseEntry,
  createRaceHeader,
  createPastPerformance,
  createBreeding,
} from '../../../__tests__/fixtures/testHelpers';

// Mock the database modules to control sire/dam lookups
vi.mock('../sireDatabase', () => ({
  calculateSireScore: vi.fn((sireName: string, _context: { isDebut: boolean }) => {
    // Elite sires
    if (sireName === 'Into Mischief' || sireName === 'Gun Runner') {
      return {
        score: 25,
        reasoning: 'Elite sire with exceptional statistics',
      };
    }
    // Good sires
    if (sireName === 'Quality Road') {
      return {
        score: 20,
        reasoning: 'Quality sire with strong statistics',
      };
    }
    // Unknown sire
    return {
      score: 5,
      reasoning: 'Unknown sire - default score',
    };
  }),
  lookupSire: vi.fn((sireName: string) => {
    if (sireName === 'Into Mischief') {
      return {
        name: 'Into Mischief',
        tier: 'elite' as const,
        surfacePreference: 'dirt' as const,
        distancePreference: { category: 'sprint' as const, minFurlongs: 5, maxFurlongs: 8 },
      };
    }
    if (sireName === 'Gun Runner') {
      return {
        name: 'Gun Runner',
        tier: 'elite' as const,
        surfacePreference: 'dirt' as const,
        distancePreference: { category: 'route' as const, minFurlongs: 8, maxFurlongs: 12 },
      };
    }
    if (sireName === "Kitten's Joy") {
      return {
        name: "Kitten's Joy",
        tier: 'premier' as const,
        surfacePreference: 'turf' as const,
        distancePreference: { category: 'route' as const, minFurlongs: 8, maxFurlongs: 12 },
      };
    }
    if (sireName === 'Quality Road') {
      return {
        name: 'Quality Road',
        tier: 'quality' as const,
        surfacePreference: 'dirt' as const,
        distancePreference: { category: 'versatile' as const, minFurlongs: 6, maxFurlongs: 10 },
      };
    }
    return null;
  }),
  getSireTierLabel: vi.fn((tier: string) => {
    const labels: Record<string, string> = {
      elite: 'Elite Sire',
      premier: 'Premier Sire',
      quality: 'Quality Sire',
    };
    return labels[tier] || 'Unknown';
  }),
  getSireTierColor: vi.fn(() => '#22c55e'),
}));

vi.mock('../damDatabase', () => ({
  calculateDamScore: vi.fn((damName: string) => {
    if (damName === 'Stellar Mare') {
      return {
        score: 20,
        reasoning: 'Elite producing dam',
      };
    }
    return {
      score: 5,
      reasoning: 'Unknown dam - default score',
    };
  }),
  lookupDam: vi.fn((damName: string) => {
    if (damName === 'Stellar Mare') {
      return {
        name: 'Stellar Mare',
        tier: 'elite' as const,
      };
    }
    return null;
  }),
  getDamTierLabel: vi.fn(() => 'Unknown'),
}));

vi.mock('../damsireDatabase', () => ({
  calculateDamsireScore: vi.fn((damsireName: string) => {
    if (damsireName === 'Storm Cat') {
      return {
        score: 15,
        reasoning: 'Elite broodmare sire',
      };
    }
    return {
      score: 5,
      reasoning: 'Unknown damsire - default score',
    };
  }),
  lookupDamsire: vi.fn((damsireName: string) => {
    if (damsireName === 'Storm Cat') {
      return {
        name: 'Storm Cat',
        tier: 'elite' as const,
        surfaceInfluence: 'dirt' as const,
      };
    }
    return null;
  }),
  getDamsireTierLabel: vi.fn(() => 'Unknown'),
}));

vi.mock('../breedingExtractor', () => ({
  extractBreedingInfo: vi.fn((horse) => ({
    sire: horse.breeding.sire,
    dam: horse.breeding.dam,
    damsire: horse.breeding.damSire,
    lifetimeStarts: horse.lifetimeStarts ?? 0,
    isLightlyRaced: (horse.lifetimeStarts ?? 0) < 8,
    isDebut: (horse.lifetimeStarts ?? 0) === 0,
    isComplete: true,
    whereBred: horse.breeding.whereBred || 'KY',
  })),
}));

describe('Breeding Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateDetailedBreedingScore', () => {
    describe('Lightly Raced Horse with Elite Sire', () => {
      it('calculates high breeding score for debut runner with elite sire', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 0,
          pastPerformances: [],
          breeding: createBreeding({
            sire: 'Into Mischief',
            dam: 'Speed Queen',
            damSire: 'Storm Cat',
          }),
        });

        const raceHeader = createRaceHeader({
          surface: 'dirt',
          distance: '6f',
        });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(true);
        expect(result.total).toBeGreaterThanOrEqual(40);
        expect(result.sireDetails.score).toBe(25);
        expect(result.bonuses.eliteSireDebut).toBe(10); // Elite sire debut bonus
      });

      it('calculates breeding score for 2-start horse with quality sire', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 2,
          pastPerformances: [
            createPastPerformance({ finishPosition: 4 }),
            createPastPerformance({ finishPosition: 3 }),
          ],
          breeding: createBreeding({
            sire: 'Quality Road',
            dam: 'Unknown Mare',
            damSire: 'Unknown Sire',
          }),
        });

        const raceHeader = createRaceHeader({
          surface: 'dirt',
          distance: '8f',
        });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(true);
        expect(result.total).toBeGreaterThan(20);
        expect(result.bonuses.eliteSireDebut).toBe(0); // Not a debut
      });
    });

    describe('Score = 0 for Experienced Horses (8+ Starts)', () => {
      it('returns score of 0 for horse with exactly 8 starts', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 8,
          pastPerformances: Array(8).fill(createPastPerformance()),
          breeding: createBreeding({
            sire: 'Into Mischief', // Elite sire should not matter
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(false);
        expect(result.total).toBe(0);
        expect(result.notAppliedReason).toContain('8+');
      });

      it('returns score of 0 for horse with 15+ starts', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 15,
          pastPerformances: Array(10).fill(createPastPerformance()),
          breeding: createBreeding({
            sire: 'Gun Runner', // Elite sire should not matter
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(false);
        expect(result.total).toBe(0);
      });
    });

    describe('Elite Sire Debut Bonus (+10 pts)', () => {
      it('applies +10 bonus for elite sire debut runner', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 0,
          pastPerformances: [],
          breeding: createBreeding({
            sire: 'Into Mischief',
          }),
        });

        const raceHeader = createRaceHeader({ surface: 'dirt', distance: '6f' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.eliteSireDebut).toBe(10);
        // Check reasons mention elite or debut
        expect(
          result.bonuses.reasons.some(
            (r) => r.toLowerCase().includes('elite') || r.toLowerCase().includes('debut')
          )
        ).toBe(true);
      });

      it('does not apply debut bonus for non-elite sire', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 0,
          pastPerformances: [],
          breeding: createBreeding({
            sire: 'Unknown Sire',
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.eliteSireDebut).toBe(0);
      });

      it('does not apply debut bonus for second-time starter', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: 'Into Mischief', // Elite sire
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.eliteSireDebut).toBe(0);
      });
    });

    describe('Surface Fit Bonus (+5 pts)', () => {
      it('applies surface fit bonus when turf sire runs on turf', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: "Kitten's Joy", // Turf specialist
          }),
        });

        const raceHeader = createRaceHeader({ surface: 'turf' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.surfaceFit).toBe(5);
        // Check reasons mention surface in some form
        expect(
          result.bonuses.reasons.some(
            (r) => r.toLowerCase().includes('surface') || r.toLowerCase().includes('turf')
          )
        ).toBe(true);
      });

      it('applies surface fit bonus when dirt sire runs on dirt', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 2,
          pastPerformances: [createPastPerformance(), createPastPerformance()],
          breeding: createBreeding({
            sire: 'Into Mischief', // Dirt specialist
          }),
        });

        const raceHeader = createRaceHeader({ surface: 'dirt' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.surfaceFit).toBe(5);
      });

      it('does not apply surface fit when mismatch (turf sire on dirt)', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: "Kitten's Joy", // Turf specialist
          }),
        });

        const raceHeader = createRaceHeader({ surface: 'dirt' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.surfaceFit).toBe(0);
      });
    });

    describe('Distance Fit Bonus (+5 pts)', () => {
      it('applies distance fit bonus for sprint sire in sprint race', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: 'Into Mischief', // Sprint specialist
          }),
        });

        const raceHeader = createRaceHeader({ distance: '6f' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.distanceFit).toBe(5);
        // Check reasons mention distance or sprint in some form
        expect(
          result.bonuses.reasons.some(
            (r) => r.toLowerCase().includes('distance') || r.toLowerCase().includes('sprint')
          )
        ).toBe(true);
      });

      it('applies distance fit bonus for route sire in route race', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 2,
          pastPerformances: [createPastPerformance(), createPastPerformance()],
          breeding: createBreeding({
            sire: 'Gun Runner', // Route specialist
          }),
        });

        const raceHeader = createRaceHeader({ distance: '1 1/8m' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.distanceFit).toBe(5);
      });

      it('does not apply distance fit for versatile sire', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: 'Quality Road', // Versatile
          }),
        });

        const raceHeader = createRaceHeader({ distance: '7f' });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.bonuses.distanceFit).toBe(0);
      });
    });

    describe('Unknown Sire/Dam Defaults (5 pts baseline)', () => {
      it('returns baseline score for completely unknown breeding', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 2,
          pastPerformances: [createPastPerformance(), createPastPerformance()],
          breeding: createBreeding({
            sire: 'Obscure Sire',
            dam: 'Unknown Mare',
            damSire: 'Unknown Damsire',
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(true);
        // Should have default scores of 5 each
        expect(result.sireDetails.score).toBe(5);
        expect(result.damDetails.score).toBe(5);
        expect(result.damsireDetails.score).toBe(5);
        expect(result.total).toBeGreaterThanOrEqual(15); // At least the three defaults
      });

      it('combines unknown sire with known dam correctly', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: 'Unknown Sire',
            dam: 'Stellar Mare', // Known elite dam
            damSire: 'Unknown Damsire',
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.sireDetails.score).toBe(5); // Default
        expect(result.damDetails.score).toBe(20); // Elite dam
        expect(result.damsireDetails.score).toBe(5); // Default
      });
    });

    describe('Score Weighting by Experience', () => {
      it('returns 100% weight for 0 starts', () => {
        expect(getBreedingScoreWeight(0)).toBe(1.0);
      });

      it('returns 90% weight for 1 start', () => {
        expect(getBreedingScoreWeight(1)).toBe(0.9);
      });

      it('returns 50% weight for 5 starts', () => {
        expect(getBreedingScoreWeight(5)).toBe(0.5);
      });

      it('returns 30% weight for 7 starts', () => {
        expect(getBreedingScoreWeight(7)).toBe(0.3);
      });

      it('returns 0% weight for 8+ starts', () => {
        expect(getBreedingScoreWeight(8)).toBe(0);
        expect(getBreedingScoreWeight(10)).toBe(0);
        expect(getBreedingScoreWeight(50)).toBe(0);
      });
    });

    describe('Score Contribution Calculation', () => {
      it('calculates full contribution for debut horse', () => {
        const breedingScore: BreedingScore = {
          total: 50,
          breakdown: { sireScore: 25, damScore: 15, damsireScore: 5, fitScore: 5 },
          confidence: 'high',
          summary: 'Elite breeding',
          wasApplied: true,
        };

        const contribution = calculateBreedingContribution(breedingScore, 0);

        expect(contribution).toBe(50); // 100% of 50
      });

      it('calculates weighted contribution for 3-start horse', () => {
        const breedingScore: BreedingScore = {
          total: 40,
          breakdown: { sireScore: 20, damScore: 10, damsireScore: 5, fitScore: 5 },
          confidence: 'medium',
          summary: 'Good breeding',
          wasApplied: true,
        };

        const contribution = calculateBreedingContribution(breedingScore, 3);

        expect(contribution).toBe(28); // 70% of 40
      });

      it('returns 0 contribution when breeding was not applied', () => {
        const breedingScore: BreedingScore = {
          total: 0,
          breakdown: { sireScore: 0, damScore: 0, damsireScore: 0, fitScore: 0 },
          confidence: 'none',
          summary: 'Not applicable',
          wasApplied: false,
        };

        const contribution = calculateBreedingContribution(breedingScore, 0);

        expect(contribution).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('handles missing breeding data gracefully', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 0,
          pastPerformances: [],
          breeding: createBreeding({
            sire: '',
            dam: '',
            damSire: '',
          }),
        });

        const raceHeader = createRaceHeader();

        // Should not throw
        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(true);
        expect(result.total).toBeGreaterThanOrEqual(0);
      });

      it('handles invalid sire names gracefully', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 1,
          pastPerformances: [createPastPerformance()],
          breeding: createBreeding({
            sire: 'NonExistent123456',
          }),
        });

        const raceHeader = createRaceHeader();

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.wasApplied).toBe(true);
        expect(result.sireDetails.score).toBe(5); // Default score
        expect(result.sireDetails.profile).toBeNull();
      });

      it('caps total breeding score at maximum', () => {
        const horse = createHorseEntry({
          lifetimeStarts: 0,
          pastPerformances: [],
          breeding: createBreeding({
            sire: 'Into Mischief', // Elite - 25 pts
            dam: 'Stellar Mare', // Elite - 20 pts
            damSire: 'Storm Cat', // Elite - 15 pts
          }),
        });

        // Dirt sprint for full bonuses
        const raceHeader = createRaceHeader({
          surface: 'dirt',
          distance: '6f',
        });

        const result = calculateDetailedBreedingScore(horse, raceHeader);

        expect(result.total).toBeLessThanOrEqual(BREEDING_CATEGORY_LIMITS.total); // 60 max
      });
    });
  });

  describe('shouldShowBreedingAnalysis', () => {
    it('returns true for debut horse', () => {
      const horse = createHorseEntry({ lifetimeStarts: 0 });
      expect(shouldShowBreedingAnalysis(horse)).toBe(true);
    });

    it('returns true for horse with 7 starts', () => {
      const horse = createHorseEntry({ lifetimeStarts: 7 });
      expect(shouldShowBreedingAnalysis(horse)).toBe(true);
    });

    it('returns false for horse with 8 starts', () => {
      const horse = createHorseEntry({ lifetimeStarts: 8 });
      expect(shouldShowBreedingAnalysis(horse)).toBe(false);
    });

    it('handles undefined starts (treats as 0)', () => {
      const horse = createHorseEntry({ lifetimeStarts: undefined as unknown as number });
      expect(shouldShowBreedingAnalysis(horse)).toBe(true);
    });
  });

  describe('getBreedingScoreDisplay', () => {
    it('returns Elite label for score >= 50', () => {
      const score: DetailedBreedingScore = {
        total: 55,
        breakdown: { sireScore: 25, damScore: 15, damsireScore: 10, fitScore: 5 },
        confidence: 'high',
        summary: 'Elite breeding',
        wasApplied: true,
        sireDetails: {
          score: 25,
          profile: null,
          tierLabel: 'Elite',
          tierColor: '#22c55e',
          reasoning: '',
        },
        damDetails: { score: 15, profile: null, tierLabel: 'Elite', reasoning: '' },
        damsireDetails: { score: 10, profile: null, tierLabel: 'Elite', reasoning: '' },
        bonuses: { eliteSireDebut: 5, surfaceFit: 0, distanceFit: 0, total: 5, reasons: [] },
      };

      const display = getBreedingScoreDisplay(score);

      expect(display.label).toBe('Elite');
      expect(display.color).toBe('#22c55e');
    });

    it('returns Strong label for score >= 40', () => {
      const score: DetailedBreedingScore = {
        total: 45,
        breakdown: { sireScore: 20, damScore: 15, damsireScore: 5, fitScore: 5 },
        confidence: 'high',
        summary: 'Strong breeding',
        wasApplied: true,
        sireDetails: {
          score: 20,
          profile: null,
          tierLabel: 'Premier',
          tierColor: '#36d1da',
          reasoning: '',
        },
        damDetails: { score: 15, profile: null, tierLabel: 'Elite', reasoning: '' },
        damsireDetails: { score: 5, profile: null, tierLabel: 'Unknown', reasoning: '' },
        bonuses: { eliteSireDebut: 0, surfaceFit: 5, distanceFit: 0, total: 5, reasons: [] },
      };

      const display = getBreedingScoreDisplay(score);

      expect(display.label).toBe('Strong');
    });

    it('returns N/A for non-applied breeding', () => {
      const score: DetailedBreedingScore = {
        total: 0,
        breakdown: { sireScore: 0, damScore: 0, damsireScore: 0, fitScore: 0 },
        confidence: 'none',
        summary: 'Not applicable',
        wasApplied: false,
        notAppliedReason: 'Horse has 8+ starts',
        sireDetails: {
          score: 0,
          profile: null,
          tierLabel: 'N/A',
          tierColor: '#888888',
          reasoning: '',
        },
        damDetails: { score: 0, profile: null, tierLabel: null, reasoning: '' },
        damsireDetails: { score: 0, profile: null, tierLabel: null, reasoning: '' },
        bonuses: { eliteSireDebut: 0, surfaceFit: 0, distanceFit: 0, total: 0, reasons: [] },
      };

      const display = getBreedingScoreDisplay(score);

      expect(display.label).toBe('N/A');
      expect(display.description).toContain('8+');
    });

    it('returns Below Avg label for low scores', () => {
      const score: DetailedBreedingScore = {
        total: 15,
        breakdown: { sireScore: 5, damScore: 5, damsireScore: 5, fitScore: 0 },
        confidence: 'low',
        summary: 'Limited breeding',
        wasApplied: true,
        sireDetails: {
          score: 5,
          profile: null,
          tierLabel: 'Unknown',
          tierColor: '#888888',
          reasoning: '',
        },
        damDetails: { score: 5, profile: null, tierLabel: null, reasoning: '' },
        damsireDetails: { score: 5, profile: null, tierLabel: null, reasoning: '' },
        bonuses: { eliteSireDebut: 0, surfaceFit: 0, distanceFit: 0, total: 0, reasons: [] },
      };

      const display = getBreedingScoreDisplay(score);

      expect(display.label).toBe('Below Avg');
    });
  });

  describe('calculateBreedingScoreForHorse', () => {
    it('returns simplified BreedingScore type', () => {
      const horse = createHorseEntry({
        lifetimeStarts: 2,
        breeding: createBreeding({ sire: 'Into Mischief' }),
      });

      const raceHeader = createRaceHeader();

      const result = calculateBreedingScoreForHorse(horse, raceHeader);

      // Should have basic BreedingScore properties
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('wasApplied');

      // Should not have detailed properties
      expect(result).not.toHaveProperty('sireDetails');
      expect(result).not.toHaveProperty('bonuses');
    });
  });

  describe('Real-World Racing Scenarios', () => {
    it('scores Into Mischief debut runner on dirt sprint highly', () => {
      const horse = createHorseEntry({
        horseName: 'Mischief Maker',
        lifetimeStarts: 0,
        pastPerformances: [],
        breeding: createBreeding({
          sire: 'Into Mischief',
          dam: 'Speed Queen',
          damSire: 'Storm Cat',
        }),
      });

      const raceHeader = createRaceHeader({
        surface: 'dirt',
        distance: '6f',
        classification: 'maiden',
      });

      const result = calculateDetailedBreedingScore(horse, raceHeader);

      // Should get elite sire (25) + elite damsire (15) + debut bonus (10) +
      // surface fit (5) + distance fit (5) = 60+ (capped at 60)
      expect(result.total).toBeGreaterThanOrEqual(55);
      expect(result.bonuses.eliteSireDebut).toBe(10);
      expect(result.bonuses.surfaceFit).toBe(5);
      expect(result.bonuses.distanceFit).toBe(5);
    });

    it('scores turf breeding appropriately for turf race', () => {
      const horse = createHorseEntry({
        horseName: 'Turf Flyer',
        lifetimeStarts: 1,
        pastPerformances: [createPastPerformance({ surface: 'turf', finishPosition: 2 })],
        breeding: createBreeding({
          sire: "Kitten's Joy", // Turf specialist
          dam: 'Grass Dancer',
          damSire: 'Unknown',
        }),
      });

      const raceHeader = createRaceHeader({
        surface: 'turf',
        distance: '1 1/16m',
      });

      const result = calculateDetailedBreedingScore(horse, raceHeader);

      expect(result.bonuses.surfaceFit).toBe(5);
      expect(result.wasApplied).toBe(true);
    });

    it('penalizes turf breeding mismatch on dirt', () => {
      const horse = createHorseEntry({
        horseName: 'Grass Lover',
        lifetimeStarts: 1,
        pastPerformances: [createPastPerformance()],
        breeding: createBreeding({
          sire: "Kitten's Joy", // Turf specialist
          dam: 'Unknown',
          damSire: 'Unknown',
        }),
      });

      const raceHeader = createRaceHeader({
        surface: 'dirt', // Mismatch!
        distance: '7f',
      });

      const result = calculateDetailedBreedingScore(horse, raceHeader);

      expect(result.bonuses.surfaceFit).toBe(0); // No surface fit bonus
    });
  });
});
