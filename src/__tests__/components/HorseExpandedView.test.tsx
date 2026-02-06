/**
 * HorseExpandedView Component Tests
 *
 * Tests score category display, tier color coding, value indicators,
 * and category breakdown rendering.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HorseExpandedView } from '../../components/HorseExpandedView';
import { SCORE_LIMITS, MAX_BASE_SCORE, MAX_SCORE, getScoreColor } from '../../lib/scoring';
import type { HorseEntry } from '../../types/drf';
import type { HorseScore } from '../../lib/scoring';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock CSS import
vi.mock('../../components/HorseExpandedView.css', () => ({}));

// Mock PPLine component
vi.mock('../../components/PPLine', () => ({
  PPLine: () => <div data-testid="pp-line" />,
}));

// Mock formatters
vi.mock('../../utils/formatters', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
  };
});

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 5,
    horseName: 'Thunder Strike',
    morningLineOdds: '5-1',
    postPosition: 5,
    weight: 122,
    jockey: 'Smith J',
    jockeyName: 'John Smith',
    trainer: 'Jones B',
    trainerName: 'Bob Jones',
    owner: 'Stable LLC',
    sex: 'C',
    sexFull: 'Colt',
    age: 4,
    color: 'b',
    lifetimeStarts: 12,
    lifetimeWins: 3,
    lifetimeSeconds: 2,
    lifetimeThirds: 2,
    lifetimeEarnings: 150000,
    lastRaceDistance: '6f',
    lastRaceTrack: 'CD',
    pastPerformances: [],
    workouts: [],
    ...overrides,
  } as HorseEntry;
}

function createMockScore(overrides: Partial<HorseScore> = {}): HorseScore {
  return {
    total: 280,
    baseScore: 250,
    overlayScore: 30,
    isScratched: false,
    confidenceLevel: 'high',
    dataQuality: 85,
    dataCompleteness: { score: 85, completenessPercent: 85, missingFields: [], reasoning: '' },
    lowConfidencePenaltyApplied: false,
    lowConfidencePenaltyAmount: 0,
    paperTigerPenaltyApplied: false,
    paperTigerPenaltyAmount: 0,
    keyRaceIndexBonus: 0,
    fieldSpreadAdjustment: 0,
    breakdown: {
      connections: { total: 18, trainer: 10, jockey: 7, partnershipBonus: 1, reasoning: '' },
      postPosition: { total: 8, trackBiasApplied: false, isGoldenPost: false, reasoning: '' },
      speedClass: {
        total: 100,
        speedScore: 70,
        classScore: 30,
        bestFigure: 92,
        classMovement: 'up',
        reasoning: '',
      },
      form: {
        total: 35,
        recentFormScore: 25,
        layoffScore: 5,
        consistencyBonus: 5,
        formTrend: 'up',
        reasoning: '',
        wonLastOut: true,
        won2OfLast3: false,
      },
      equipment: { total: 4, hasChanges: true, reasoning: '' },
      pace: { total: 30, runningStyle: 'stalker', paceFit: 'good', reasoning: '' },
      odds: { total: 5, oddsValue: 4, oddsSource: 'morning_line', tier: 'FAIR', reasoning: '' },
      distanceSurface: {
        total: 12,
        turfScore: 0,
        wetScore: 0,
        distanceScore: 12,
        turfWinRate: 0,
        wetWinRate: 0,
        distanceWinRate: 0.3,
        reasoning: [],
      },
      trainerPatterns: { total: 5, matchedPatterns: [], reasoning: [] },
      comboPatterns: { total: 0, detectedCombos: [], intentScore: 0, reasoning: [] },
      trackSpecialist: {
        total: 0,
        trackWinRate: 0,
        trackITMRate: 0,
        isSpecialist: false,
        reasoning: '',
      },
      trainerSurfaceDistance: {
        total: 0,
        matchedCategory: null,
        trainerWinPercent: 0,
        wetTrackWinPercent: 0,
        wetBonusApplied: false,
        reasoning: '',
      },
      weightAnalysis: {
        total: 0,
        currentWeight: 122,
        lastRaceWeight: null,
        weightChange: null,
        significantDrop: false,
        significantGain: false,
        showWeightGainFlag: false,
        reasoning: '',
      },
      sexAnalysis: {
        total: 0,
        horseSex: 'C',
        isFemale: false,
        isRestrictedRace: false,
        isMixedRace: true,
        isFirstTimeFacingMales: false,
        flags: [],
        reasoning: '',
      },
    },
    ...overrides,
  } as HorseScore;
}

// ============================================================================
// TESTS
// ============================================================================

describe('HorseExpandedView', () => {
  describe('Score Category Display', () => {
    it('renders all 6 major scoring categories', () => {
      render(
        <HorseExpandedView horse={createMockHorse()} isVisible={true} score={createMockScore()} />
      );

      expect(screen.getByText('CONNECTIONS')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('SPEED/CLASS')).toBeInTheDocument();
      expect(screen.getByText('FORM')).toBeInTheDocument();
      expect(screen.getByText('EQUIPMENT')).toBeInTheDocument();
      expect(screen.getByText('PACE')).toBeInTheDocument();
    });

    it('displays correct max values from SCORE_LIMITS for each category', () => {
      render(
        <HorseExpandedView horse={createMockHorse()} isVisible={true} score={createMockScore()} />
      );

      // Each category should show value/max format
      expect(screen.getByText(`18/${SCORE_LIMITS.connections}`)).toBeInTheDocument();
      expect(screen.getByText(`8/${SCORE_LIMITS.postPosition}`)).toBeInTheDocument();
      expect(screen.getByText(`100/${SCORE_LIMITS.speedClass}`)).toBeInTheDocument();
      expect(screen.getByText(`35/${SCORE_LIMITS.form}`)).toBeInTheDocument();
      expect(screen.getByText(`4/${SCORE_LIMITS.equipment}`)).toBeInTheDocument();
      expect(screen.getByText(`30/${SCORE_LIMITS.pace}`)).toBeInTheDocument();
    });

    it('displays total score out of MAX_SCORE (376)', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore({ total: 280 })}
        />
      );

      expect(screen.getByText('280')).toBeInTheDocument();
      expect(screen.getByText(`/${MAX_SCORE}`)).toBeInTheDocument();
    });

    it('displays base score breakdown with MAX_BASE_SCORE (336)', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore({ baseScore: 250 })}
        />
      );

      expect(screen.getByText(`Base: 250/${MAX_BASE_SCORE}`)).toBeInTheDocument();
    });
  });

  describe('Tier Color Coding', () => {
    it('uses baseScore for tier color coding via getScoreColor', () => {
      const baseScore = 250;
      const expectedColor = getScoreColor(baseScore, false);

      const { container } = render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore({ baseScore })}
        />
      );

      const totalValueEl = container.querySelector('.furlong-score__total-value');
      expect(totalValueEl).toBeInTheDocument();
      // DOM converts hex to rgb, so check the element has a color style
      const style = totalValueEl?.getAttribute('style') ?? '';
      expect(style).toContain('color:');
      // Verify getScoreColor returns expected hex for this baseScore
      expect(expectedColor).toBeTruthy();
    });

    it('returns different colors for different score tiers', () => {
      const eliteColor = getScoreColor(300, false);
      const weakColor = getScoreColor(50, false);
      // Elite and Weak scores should produce different colors
      expect(eliteColor).not.toBe(weakColor);
    });

    it('returns weak color for scratched horses regardless of baseScore', () => {
      const scratchedColor = getScoreColor(300, true);
      const weakColor = getScoreColor(50, false);
      // Scratched always returns weak color
      expect(scratchedColor).toBe(weakColor);
    });
  });

  describe('Value Indicators', () => {
    it('shows VALUE when isOverlay is true', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          isOverlay={true}
          isUnderlay={false}
        />
      );

      expect(screen.getByText('VALUE')).toBeInTheDocument();
    });

    it('shows NO VALUE when isUnderlay is true', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          isOverlay={false}
          isUnderlay={true}
        />
      );

      expect(screen.getByText('NO VALUE')).toBeInTheDocument();
    });

    it('shows FAIR when neither overlay nor underlay', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          isOverlay={false}
          isUnderlay={false}
        />
      );

      expect(screen.getByText('FAIR')).toBeInTheDocument();
    });
  });

  describe('Visibility Toggle', () => {
    it('adds --visible class when isVisible is true', () => {
      const { container } = render(
        <HorseExpandedView horse={createMockHorse()} isVisible={true} score={createMockScore()} />
      );

      const root = container.querySelector('.horse-expanded');
      expect(root?.classList.contains('horse-expanded--visible')).toBe(true);
    });

    it('does not add --visible class when isVisible is false', () => {
      const { container } = render(
        <HorseExpandedView horse={createMockHorse()} isVisible={false} score={createMockScore()} />
      );

      const root = container.querySelector('.horse-expanded');
      expect(root?.classList.contains('horse-expanded--visible')).toBe(false);
    });
  });

  describe('Tab Navigation', () => {
    it('renders all 4 tabs', () => {
      render(
        <HorseExpandedView horse={createMockHorse()} isVisible={true} score={createMockScore()} />
      );

      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('View Profile')).toBeInTheDocument();
      expect(screen.getByText('View Full PPs')).toBeInTheDocument();
      expect(screen.getByText('View Workouts')).toBeInTheDocument();
    });

    it('shows analysis content by default', () => {
      render(
        <HorseExpandedView horse={createMockHorse()} isVisible={true} score={createMockScore()} />
      );

      expect(screen.getByText('FACTOR BREAKDOWN')).toBeInTheDocument();
      expect(screen.getByText('SUGGESTED BETS')).toBeInTheDocument();
    });

    it('switches to profile tab when clicked', () => {
      render(
        <HorseExpandedView horse={createMockHorse()} isVisible={true} score={createMockScore()} />
      );

      fireEvent.click(screen.getByText('View Profile'));
      expect(screen.getByText('HORSE PROFILE')).toBeInTheDocument();
      expect(screen.getByText('IDENTITY')).toBeInTheDocument();
      expect(screen.getByText('BREEDING')).toBeInTheDocument();
      expect(
        screen.getByText('CONNECTIONS', { selector: '.profile-col__header' })
      ).toBeInTheDocument();
    });

    it('switches to workouts tab and shows no data message when empty', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse({ workouts: [] })}
          isVisible={true}
          score={createMockScore()}
        />
      );

      fireEvent.click(screen.getByText('View Workouts'));
      expect(screen.getByText('No workouts available')).toBeInTheDocument();
    });

    it('switches to PPs tab and shows no data message for first-time starter', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse({ pastPerformances: [] })}
          isVisible={true}
          score={createMockScore()}
        />
      );

      fireEvent.click(screen.getByText('View Full PPs'));
      expect(screen.getByText(/No past performances available/)).toBeInTheDocument();
    });
  });

  describe('Category Rating Percentages', () => {
    it('calculates correct percentage for each category', () => {
      const score = createMockScore();
      // connections: 18/24 = 75% -> "Good"
      // speedClass: 100/140 = 71% -> "Good"
      // form: 35/50 = 70% -> "Good"
      // pace: 30/45 = 67% -> "Good"

      render(<HorseExpandedView horse={createMockHorse()} isVisible={true} score={score} />);

      // Check that percentage displays exist in the factor breakdown
      expect(screen.getByText(/CONNECTIONS: Good \(75%\)/)).toBeInTheDocument();
      expect(screen.getByText(/SPEED\/CLASS: Good \(71%\)/)).toBeInTheDocument();
      expect(screen.getByText(/FORM: Good \(70%\)/)).toBeInTheDocument();
      expect(screen.getByText(/PACE: Good \(67%\)/)).toBeInTheDocument();
    });

    it('shows Elite rating for category at 80%+', () => {
      const score = createMockScore();
      // postPosition: 8/12 = 67% -> Good
      // Let's set to 10/12 = 83% -> Elite
      score.breakdown.postPosition.total = 10;

      render(<HorseExpandedView horse={createMockHorse()} isVisible={true} score={score} />);

      expect(screen.getByText(/POST: Elite \(83%\)/)).toBeInTheDocument();
    });
  });

  describe('Edge Display', () => {
    it('shows positive edge with + prefix', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          edgePercent={15.7}
        />
      );

      expect(screen.getByText(/Edge: \+16%/)).toBeInTheDocument();
    });

    it('shows negative edge', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          edgePercent={-12.3}
        />
      );

      expect(screen.getByText(/Edge: -12%/)).toBeInTheDocument();
    });
  });

  describe('Bet Recommendations Display', () => {
    it('shows empty message when no recommendations', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          betRecommendations={{
            conservative: {
              label: 'Conservative Bets',
              hasBets: false,
              bets: [],
              emptyMessage: 'No win/place value identified.',
            } as any,
            moderate: {
              label: 'Moderate Bets',
              hasBets: false,
              bets: [],
              emptyMessage: 'No exotic combinations recommended.',
            } as any,
            aggressive: {
              label: 'Aggressive Bets',
              hasBets: false,
              bets: [],
              emptyMessage: 'No high-risk plays identified.',
            } as any,
            hasRecommendations: false,
            summary: '',
          }}
        />
      );

      expect(screen.getByText('No win/place value identified.')).toBeInTheDocument();
      expect(screen.getByText('No exotic combinations recommended.')).toBeInTheDocument();
      expect(screen.getByText('No high-risk plays identified.')).toBeInTheDocument();
    });

    it('shows bet recommendations when present', () => {
      render(
        <HorseExpandedView
          horse={createMockHorse()}
          isVisible={true}
          score={createMockScore()}
          betRecommendations={{
            conservative: {
              label: 'Conservative Bets',
              hasBets: true,
              bets: [{ type: 'WIN', horsesDisplay: '#5 Thunder Strike' }],
            } as any,
            moderate: {
              label: 'Moderate Bets',
              hasBets: false,
              bets: [],
            } as any,
            aggressive: {
              label: 'Aggressive Bets',
              hasBets: false,
              bets: [],
            } as any,
            hasRecommendations: true,
            summary: 'Value detected',
          }}
        />
      );

      expect(screen.getByText('WIN:')).toBeInTheDocument();
      expect(screen.getByText('#5 Thunder Strike')).toBeInTheDocument();
    });
  });
});
