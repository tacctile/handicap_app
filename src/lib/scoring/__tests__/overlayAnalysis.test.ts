/**
 * Overlay Analysis Tests
 *
 * Tests for the overlay detection and expected value (EV) calculation system.
 * Validates score-to-probability conversion, fair odds calculation, and value classifications.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreToWinProbability,
  probabilityToDecimalOdds,
  decimalToFractionalOdds,
  decimalToMoneyline,
  parseOddsToDecimal,
  calculateOverlayPercent,
  classifyValue,
  calculateEV,
  generateRecommendation,
  generateOverlayDescription,
  analyzeOverlay,
  detectValuePlays,
  getValuePlaysSummary,
  calculateTierAdjustment,
  formatOverlayPercent,
  formatEV,
  formatEVPercent,
  getOverlayColor,
  VALUE_COLORS,
  type ValueClassification,
  type BettingRecommendation,
} from '../overlayAnalysis';

describe('Overlay Analysis', () => {
  /**
   * Score to Win Probability Conversion (Legacy - standalone function)
   *
   * This is the LEGACY function for standalone use when field context isn't available.
   * Model B formula: (score / 323) * 50, clamped to 2-50% range.
   * For field-relative calculations, use calculateFieldRelativeWinProbability instead.
   */
  describe('Score to Win Probability Conversion', () => {
    it('converts 200 pts → ~31.0% win probability (standalone formula)', () => {
      const probability = scoreToWinProbability(200);
      // Model B formula: (200/323) * 50 = 30.96%
      expect(probability).toBeCloseTo(30.96, 0);
    });

    it('converts 140 pts → ~21.7% win probability (standalone formula)', () => {
      const probability = scoreToWinProbability(140);
      // Model B formula: (140/323) * 50 = 21.67%
      expect(probability).toBeCloseTo(21.67, 0);
    });

    it('converts 100 pts → ~15.5% win probability (standalone formula)', () => {
      const probability = scoreToWinProbability(100);
      // Model B formula: (100/323) * 50 = 15.48%
      expect(probability).toBeCloseTo(15.48, 0);
    });

    it('converts 150 pts → ~23.2% win probability (standalone formula)', () => {
      const probability = scoreToWinProbability(150);
      // Model B formula: (150/323) * 50 = 23.22%
      expect(probability).toBeCloseTo(23.22, 0);
    });

    it('converts 50 pts → ~7.7% win probability', () => {
      const probability = scoreToWinProbability(50);
      // Model B formula: (50/323) * 50 = 7.74%
      expect(probability).toBeCloseTo(7.74, 0);
    });

    it('converts 250 pts → ~38.7% win probability', () => {
      const probability = scoreToWinProbability(250);
      // Model B formula: (250/323) * 50 = 38.70%
      expect(probability).toBeCloseTo(38.7, 0);
    });

    it('handles scores near 0 (clamps to 2%)', () => {
      expect(scoreToWinProbability(10)).toBeCloseTo(2, 0); // 1.52% clamps to 2%
      expect(scoreToWinProbability(0)).toBe(2); // 0% clamps to 2%
    });

    it('handles extreme high scores (clamps to 50%)', () => {
      expect(scoreToWinProbability(400)).toBe(50); // 60.98% clamps to 50%
      expect(scoreToWinProbability(500)).toBe(50); // 76.22% clamps to 50%
    });
  });

  describe('Win Probability to Fair Odds Conversion', () => {
    it('converts 50% probability → 2.0 decimal (even money)', () => {
      const odds = probabilityToDecimalOdds(50);
      expect(odds).toBe(2);
    });

    it('converts 25% probability → 4.0 decimal (3-1)', () => {
      const odds = probabilityToDecimalOdds(25);
      expect(odds).toBe(4);
    });

    it('converts 20% probability → 5.0 decimal (4-1)', () => {
      const odds = probabilityToDecimalOdds(20);
      expect(odds).toBe(5);
    });

    it('converts 10% probability → 10.0 decimal (9-1)', () => {
      const odds = probabilityToDecimalOdds(10);
      expect(odds).toBe(10);
    });

    it('converts 5% probability → 20.0 decimal (19-1)', () => {
      const odds = probabilityToDecimalOdds(5);
      expect(odds).toBe(20);
    });

    it('handles edge case: 0% probability', () => {
      const odds = probabilityToDecimalOdds(0);
      expect(odds).toBe(100); // Capped at 99-1
    });

    it('handles edge case: 100% probability', () => {
      const odds = probabilityToDecimalOdds(100);
      expect(odds).toBe(1.01); // Near even money
    });
  });

  describe('Decimal to Fractional Odds Conversion', () => {
    it('converts 2.0 → "EVEN"', () => {
      expect(decimalToFractionalOdds(2.0)).toBe('EVEN');
    });

    it('converts 4.0 → "3-1"', () => {
      expect(decimalToFractionalOdds(4.0)).toBe('3-1');
    });

    it('converts 3.5 → "5-2"', () => {
      expect(decimalToFractionalOdds(3.5)).toBe('5-2');
    });

    it('converts 6.0 → "5-1"', () => {
      expect(decimalToFractionalOdds(6.0)).toBe('5-1');
    });

    it('converts 1.5 → "1-2"', () => {
      expect(decimalToFractionalOdds(1.5)).toBe('1-2');
    });

    it('converts 11.0 → "10-1"', () => {
      expect(decimalToFractionalOdds(11.0)).toBe('10-1');
    });
  });

  describe('Decimal to Moneyline Conversion', () => {
    it('converts 4.0 (underdog) → "+300"', () => {
      expect(decimalToMoneyline(4.0)).toBe('+300');
    });

    it('converts 2.0 (even money) → "+100"', () => {
      expect(decimalToMoneyline(2.0)).toBe('+100');
    });

    it('converts 1.5 (favorite) → "-200"', () => {
      expect(decimalToMoneyline(1.5)).toBe('-200');
    });

    it('converts 3.0 → "+200"', () => {
      expect(decimalToMoneyline(3.0)).toBe('+200');
    });

    it('converts 1.25 → "-400"', () => {
      expect(decimalToMoneyline(1.25)).toBe('-400');
    });
  });

  describe('Parse Odds to Decimal', () => {
    it('parses "3-1" format', () => {
      expect(parseOddsToDecimal('3-1')).toBe(4);
      expect(parseOddsToDecimal('5-1')).toBe(6);
    });

    it('parses "5/2" format', () => {
      expect(parseOddsToDecimal('5/2')).toBe(3.5);
      expect(parseOddsToDecimal('3/2')).toBe(2.5);
    });

    it('parses "EVEN" odds', () => {
      expect(parseOddsToDecimal('EVEN')).toBe(2);
      expect(parseOddsToDecimal('evn')).toBe(2);
    });

    it('parses moneyline format "+300"', () => {
      expect(parseOddsToDecimal('+300')).toBe(4);
      expect(parseOddsToDecimal('+200')).toBe(3);
    });

    it('parses moneyline format "-150"', () => {
      expect(parseOddsToDecimal('-150')).toBeCloseTo(1.667, 1);
      expect(parseOddsToDecimal('-200')).toBe(1.5);
    });

    it('parses plain number as X-1 odds', () => {
      expect(parseOddsToDecimal('5')).toBe(6); // Treated as 5-1
      expect(parseOddsToDecimal('10')).toBe(11); // Treated as 10-1
    });

    it('handles invalid input gracefully', () => {
      expect(parseOddsToDecimal('invalid')).toBe(11); // Default to 10-1
    });
  });

  describe('Calculate Overlay Percentage', () => {
    it('calculates positive overlay (value bet)', () => {
      // Fair odds 3-1 (4.0), actual 8-1 (9.0)
      const overlay = calculateOverlayPercent(4.0, 9.0);
      expect(overlay).toBe(125); // 125% overlay
    });

    it('calculates moderate overlay', () => {
      // Fair odds 2-1 (3.0), actual 5/2 (3.5)
      const overlay = calculateOverlayPercent(3.0, 3.5);
      expect(overlay).toBeCloseTo(16.7, 0);
    });

    it('calculates underlay (negative value)', () => {
      // Fair odds 5/2 (3.5), actual 2-1 (3.0)
      const overlay = calculateOverlayPercent(3.5, 3.0);
      expect(overlay).toBeCloseTo(-14.3, 0);
    });

    it('calculates zero overlay (fair price)', () => {
      const overlay = calculateOverlayPercent(4.0, 4.0);
      expect(overlay).toBe(0);
    });

    it('handles edge case: near even money fair odds', () => {
      const overlay = calculateOverlayPercent(1.5, 2.0);
      expect(overlay).toBeCloseTo(33.3, 0);
    });
  });

  /**
   * Value Classification Tests
   *
   * Updated thresholds for clearer overlay/underlay classification:
   * - Overlay: Actual odds > Fair odds by 20%+ (value bet)
   * - Fair: Within ±20% of fair odds (neutral)
   * - Underlay: Actual odds < Fair odds by 20%+ (bad bet)
   */
  describe('Value Classification', () => {
    it('classifies 100%+ as massive_overlay', () => {
      expect(classifyValue(100)).toBe('massive_overlay');
      expect(classifyValue(150)).toBe('massive_overlay');
      expect(classifyValue(200)).toBe('massive_overlay');
    });

    it('classifies 40-99% as strong_overlay', () => {
      expect(classifyValue(40)).toBe('strong_overlay');
      expect(classifyValue(60)).toBe('strong_overlay');
      expect(classifyValue(99)).toBe('strong_overlay');
    });

    it('classifies 20-39% as moderate_overlay', () => {
      expect(classifyValue(20)).toBe('moderate_overlay');
      expect(classifyValue(30)).toBe('moderate_overlay');
      expect(classifyValue(39)).toBe('moderate_overlay');
    });

    it('classifies 10-19% as slight_overlay', () => {
      expect(classifyValue(10)).toBe('slight_overlay');
      expect(classifyValue(15)).toBe('slight_overlay');
      expect(classifyValue(19)).toBe('slight_overlay');
    });

    it('classifies -20% to +9% as fair_price', () => {
      expect(classifyValue(0)).toBe('fair_price');
      expect(classifyValue(5)).toBe('fair_price');
      expect(classifyValue(9)).toBe('fair_price');
      expect(classifyValue(-10)).toBe('fair_price');
      expect(classifyValue(-15)).toBe('fair_price');
      expect(classifyValue(-20)).toBe('fair_price');
    });

    it('classifies below -20% as underlay', () => {
      expect(classifyValue(-21)).toBe('underlay');
      expect(classifyValue(-30)).toBe('underlay');
      expect(classifyValue(-50)).toBe('underlay');
    });
  });

  describe('Expected Value Calculation', () => {
    it('calculates positive EV for overlay bet', () => {
      // 25% win probability at 8-1 odds (9.0 decimal)
      // EV = (0.25 × 8) - (0.75 × 1) = 2.0 - 0.75 = +$1.25
      const ev = calculateEV(25, 9.0);
      expect(ev).toBeCloseTo(1.25, 2);
    });

    it('calculates zero EV at fair odds', () => {
      // 25% win probability at 3-1 odds (4.0 decimal)
      // EV = (0.25 × 3) - (0.75 × 1) = 0.75 - 0.75 = 0
      const ev = calculateEV(25, 4.0);
      expect(ev).toBeCloseTo(0, 2);
    });

    it('calculates negative EV for underlay bet', () => {
      // 25% win probability at 2-1 odds (3.0 decimal)
      // EV = (0.25 × 2) - (0.75 × 1) = 0.5 - 0.75 = -$0.25
      const ev = calculateEV(25, 3.0);
      expect(ev).toBeCloseTo(-0.25, 2);
    });

    it('calculates EV correctly for favorites', () => {
      // 60% win probability at even money (2.0 decimal)
      // EV = (0.60 × 1) - (0.40 × 1) = 0.60 - 0.40 = +$0.20
      const ev = calculateEV(60, 2.0);
      expect(ev).toBeCloseTo(0.2, 2);
    });

    it('calculates EV for longshots', () => {
      // 5% win probability at 30-1 odds (31.0 decimal)
      // EV = (0.05 × 30) - (0.95 × 1) = 1.5 - 0.95 = +$0.55
      const ev = calculateEV(5, 31.0);
      expect(ev).toBeCloseTo(0.55, 2);
    });
  });

  describe('Generate Recommendation', () => {
    it('generates bet_heavily for massive overlay', () => {
      const rec = generateRecommendation('massive_overlay', 175, 1.5);
      expect(rec.action).toBe('bet_heavily');
      expect(rec.urgency).toBe('immediate');
      expect(rec.suggestedMultiplier).toBeGreaterThan(1.5);
    });

    it('generates bet_standard for strong overlay', () => {
      const rec = generateRecommendation('strong_overlay', 75, 0.8);
      expect(rec.action).toBe('bet_standard');
      expect(rec.urgency).toBe('standard');
    });

    it('generates bet_standard for moderate overlay', () => {
      const rec = generateRecommendation('moderate_overlay', 35, 0.4);
      expect(rec.action).toBe('bet_standard');
      expect(rec.suggestedMultiplier).toBe(1.0);
    });

    it('generates bet_small for slight overlay', () => {
      const rec = generateRecommendation('slight_overlay', 15, 0.15);
      expect(rec.action).toBe('bet_small');
      expect(rec.suggestedMultiplier).toBe(0.75);
    });

    it('generates pass for fair price', () => {
      const rec = generateRecommendation('fair_price', 5, 0.05);
      expect(rec.action).toBe('pass');
      expect(rec.urgency).toBe('none');
    });

    it('generates avoid for underlay', () => {
      const rec = generateRecommendation('underlay', -25, -0.25);
      expect(rec.action).toBe('avoid');
      expect(rec.suggestedMultiplier).toBe(0);
    });
  });

  describe('Generate Overlay Description', () => {
    it('generates description for massive overlay', () => {
      const desc = generateOverlayDescription(175, 'massive_overlay', '4-1', '12-1');
      expect(desc).toContain('175%');
      expect(desc).toContain('exceptional');
      expect(desc).toContain('4-1');
      expect(desc).toContain('12-1');
    });

    it('generates description for underlay', () => {
      const desc = generateOverlayDescription(-25, 'underlay', '5-1', '3-1');
      expect(desc).toContain('Underlay');
      expect(desc).toContain('25%');
      expect(desc).toContain('worse');
    });

    it('generates description for fair price', () => {
      const desc = generateOverlayDescription(3, 'fair_price', '4-1', '4-1');
      expect(desc).toContain('Fair price');
      expect(desc).toContain('close to fair value');
    });
  });

  /**
   * Analyze Overlay Integration Tests (Legacy standalone function)
   *
   * Note: The standalone analyzeOverlay function uses the legacy formula:
   * Win% = (score / 328) * 50, clamped to 2-50%
   *
   * For field-relative analysis, use analyzeOverlayWithField instead.
   */
  describe('Analyze Overlay (Integration)', () => {
    it('performs complete analysis for overlay bet', () => {
      // Score 160 = (160/328)*50 = 24.4% win prob = fair odds 4.1
      // Actual 5-1 = 6.0 decimal
      // Overlay = (6.0 - 4.1) / 4.1 = 46% overlay
      const analysis = analyzeOverlay(160, '5-1');

      expect(analysis.winProbability).toBeCloseTo(24.4, 0);
      expect(analysis.actualOddsDecimal).toBe(6);
      expect(analysis.overlayPercent).toBeGreaterThan(40); // Strong overlay
      expect(analysis.valueClass).toBe('strong_overlay');
      expect(analysis.isPositiveEV).toBe(true);
      expect(analysis.evPerDollar).toBeGreaterThan(0);
      expect(analysis.recommendation.action).toBe('bet_standard');
    });

    it('performs complete analysis for underlay bet', () => {
      // Score 200 = (200/328)*50 = 30.5% win prob = fair odds 3.28
      // Actual 1-9 = 1.11 decimal (heavy favorite at bad odds)
      // Overlay = (1.11 - 3.28) / 3.28 = -66% (severe underlay)
      const analysis = analyzeOverlay(200, '1-9');

      expect(analysis.winProbability).toBeCloseTo(30.5, 0);
      expect(analysis.overlayPercent).toBeLessThan(-20);
      expect(analysis.valueClass).toBe('underlay');
      expect(analysis.isPositiveEV).toBe(false);
      expect(analysis.recommendation.action).toBe('avoid');
    });

    it('performs complete analysis for fair price bet', () => {
      // Score 100 = (100/328)*50 = 15.2% win prob = fair odds 6.58
      // Actual 3-1 = 4.0 decimal
      // Overlay = (4.0 - 6.58) / 6.58 = -39% (underlay, actually)
      const analysis = analyzeOverlay(100, '3-1');

      expect(analysis.winProbability).toBeCloseTo(15.2, 0);
      expect(analysis.actualOddsDecimal).toBe(4);
      // With fair odds 6.58 and actual 4.0, this is actually underlay
      expect(analysis.overlayPercent).toBeLessThan(-20);
      expect(analysis.valueClass).toBe('underlay');
    });
  });

  describe('Tier Adjustment Logic', () => {
    it('bumps up tier for high overlay', () => {
      // Score 165 + 80% overlay = adjusted score 185
      // Pass (totalScore, baseScore, overlayPercent)
      const adjustment = calculateTierAdjustment(165, 165, 80);

      expect(adjustment.adjustedScore).toBe(185);
      expect(adjustment.tierShift).toBe(1);
      expect(adjustment.reasoning).toContain('+20');
    });

    it('bumps down tier for underlay', () => {
      // BaseScore 150 + -35% overlay = adjusted score 125 (baseScore < 160 threshold, penalty applies)
      const adjustment = calculateTierAdjustment(150, 150, -35);

      expect(adjustment.adjustedScore).toBe(125);
      expect(adjustment.tierShift).toBe(-2);
      expect(adjustment.reasoning).toContain('underlay');
    });

    it('identifies Diamond in Rough (low baseScore + massive overlay)', () => {
      // BaseScore 155 + 175% overlay = special case
      const adjustment = calculateTierAdjustment(155, 155, 175);

      expect(adjustment.isSpecialCase).toBe(true);
      expect(adjustment.specialCaseType).toBe('diamond_in_rough');
      expect(adjustment.reasoning).toContain('DIAMOND');
    });

    it("does NOT identify Fool's Gold for baseScores >= 160 (v2.1 threshold waiver)", () => {
      // BaseScore 190 >= 160 threshold, so underlay penalty is waived and Fool's Gold disabled
      // High-scoring horses with underlays are correctly identified by market, not "fool's gold"
      const adjustment = calculateTierAdjustment(190, 190, -30);

      expect(adjustment.isSpecialCase).toBe(false);
      expect(adjustment.specialCaseType).not.toBe('fool_gold');
      expect(adjustment.adjustedScore).toBe(190); // No penalty applied
      expect(adjustment.reasoning).toContain('penalty waived');
    });

    it('handles slight overlay (+15%)', () => {
      const adjustment = calculateTierAdjustment(150, 150, 15);

      expect(adjustment.adjustedScore).toBe(155);
      expect(adjustment.tierShift).toBe(0);
    });

    it('handles massive overlay (+150%)', () => {
      const adjustment = calculateTierAdjustment(140, 140, 150);

      expect(adjustment.adjustedScore).toBe(170);
      expect(adjustment.tierShift).toBe(2);
    });

    it('waives penalty when baseScore >= 160 but totalScore < 160 (overlay already applied)', () => {
      // KEY FIX: Base score 169 should waive penalty even when total is 156 (base + overlay = -13)
      // This tests the scenario where overlay scoring already applied negative adjustments
      const adjustment = calculateTierAdjustment(156, 169, -20);

      // Penalty should be waived because BASE score (169) >= 160
      expect(adjustment.adjustedScore).toBe(156); // No additional penalty
      expect(adjustment.tierShift).toBe(0);
      expect(adjustment.reasoning).toContain('penalty waived');
      expect(adjustment.reasoning).toContain('169');
    });
  });

  describe('Detect Value Plays', () => {
    it('detects and ranks value plays in a race', () => {
      const horses = [
        {
          horseIndex: 0,
          horseName: 'No Value',
          programNumber: 1,
          score: 150,
          currentOdds: '1-1',
          isScratched: false,
        },
        {
          horseIndex: 1,
          horseName: 'Big Overlay',
          programNumber: 2,
          score: 140,
          currentOdds: '15-1',
          isScratched: false,
        },
        {
          horseIndex: 2,
          horseName: 'Moderate Value',
          programNumber: 3,
          score: 120,
          currentOdds: '8-1',
          isScratched: false,
        },
        {
          horseIndex: 3,
          horseName: 'Scratched',
          programNumber: 4,
          score: 180,
          currentOdds: '20-1',
          isScratched: true,
        },
      ];

      const valuePlays = detectValuePlays(horses, 10);

      // Should exclude scratched horse and no-value horse
      expect(valuePlays.length).toBe(2);
      // Should be sorted by overlay (best first)
      expect(valuePlays[0]?.horseName).toBe('Big Overlay');
      const firstPlay = valuePlays[0];
      const secondPlay = valuePlays[1];
      expect(firstPlay).toBeDefined();
      expect(secondPlay).toBeDefined();
      if (firstPlay && secondPlay) {
        expect(firstPlay.overlayPercent).toBeGreaterThan(secondPlay.overlayPercent);
      }
    });

    it('returns empty array when no value plays exist', () => {
      const horses = [
        {
          horseIndex: 0,
          horseName: 'Favorite',
          programNumber: 1,
          score: 200,
          currentOdds: '1-5',
          isScratched: false,
        },
        {
          horseIndex: 1,
          horseName: 'Underlay',
          programNumber: 2,
          score: 150,
          currentOdds: '1-2',
          isScratched: false,
        },
      ];

      const valuePlays = detectValuePlays(horses, 10);

      expect(valuePlays.length).toBe(0);
    });

    it('excludes scratched horses', () => {
      const horses = [
        {
          horseIndex: 0,
          horseName: 'Good Value',
          programNumber: 1,
          score: 120,
          currentOdds: '20-1',
          isScratched: true,
        },
      ];

      const valuePlays = detectValuePlays(horses);

      expect(valuePlays.length).toBe(0);
    });
  });

  describe('Value Plays Summary', () => {
    it('generates summary stats for value plays', () => {
      const valuePlays = [
        {
          horseIndex: 0,
          horseName: 'Massive',
          programNumber: 1,
          score: 130,
          overlayPercent: 180,
          valueClass: 'massive_overlay' as ValueClassification,
          evPerDollar: 1.5,
          fairOddsDisplay: '3-1',
          actualOddsDisplay: '12-1',
          recommendation: {} as unknown as BettingRecommendation,
        },
        {
          horseIndex: 1,
          horseName: 'Strong',
          programNumber: 2,
          score: 125,
          overlayPercent: 75,
          valueClass: 'strong_overlay' as ValueClassification,
          evPerDollar: 0.8,
          fairOddsDisplay: '4-1',
          actualOddsDisplay: '8-1',
          recommendation: {} as unknown as BettingRecommendation,
        },
        {
          horseIndex: 2,
          horseName: 'Moderate',
          programNumber: 3,
          score: 115,
          overlayPercent: 35,
          valueClass: 'moderate_overlay' as ValueClassification,
          evPerDollar: 0.4,
          fairOddsDisplay: '5-1',
          actualOddsDisplay: '7-1',
          recommendation: {} as unknown as BettingRecommendation,
        },
      ];

      const summary = getValuePlaysSummary(valuePlays);

      expect(summary.totalCount).toBe(3);
      expect(summary.massiveCount).toBe(1);
      expect(summary.strongCount).toBe(1);
      expect(summary.moderateCount).toBe(1);
      expect(summary.bestPlay?.horseName).toBe('Massive');
      expect(summary.totalPositiveEV).toBeCloseTo(2.7, 1);
    });

    it('handles empty value plays', () => {
      const summary = getValuePlaysSummary([]);

      expect(summary.totalCount).toBe(0);
      expect(summary.bestPlay).toBeNull();
      expect(summary.totalPositiveEV).toBe(0);
    });
  });

  /**
   * Edge Cases (Legacy standalone function)
   *
   * With the new formula: (score / 328) * 50, clamped to 2-50%
   */
  describe('Edge Cases', () => {
    it('handles 0 odds gracefully', () => {
      // Score 150 → (150/328)*50 = 22.87%
      const analysis = analyzeOverlay(150, '0');

      // Should not throw and should return reasonable values
      expect(analysis.actualOddsDecimal).toBeDefined();
      expect(analysis.winProbability).toBeCloseTo(22.87, 0);
    });

    it('handles missing morning line', () => {
      const analysis = analyzeOverlay(100, '');

      // Should use default odds
      expect(analysis.actualOddsDecimal).toBeDefined();
    });

    it('handles score out of expected range (very low)', () => {
      // Score 10 → (10/328)*50 = 1.52% → clamps to 2%
      const analysis = analyzeOverlay(10, '10-1');

      expect(analysis.winProbability).toBe(2); // Clamped minimum
      expect(analysis.fairOddsDecimal).toBe(50); // 1/0.02 = 50
    });

    it('handles score out of expected range (very high)', () => {
      // Model B: Score 300 → (300/323)*50 = 46.44% (not quite 50%)
      // Fair odds = 1/0.4644 = 2.15 (about 6-5)
      // Actual 2-1 = 3.0 decimal
      const analysis = analyzeOverlay(300, '2-1');

      expect(analysis.winProbability).toBeCloseTo(46.44, 0); // Near max
      // 2-1 (3.0) vs fair 2.15 is about 39% overlay
      expect(analysis.overlayPercent).toBeGreaterThan(30);
      expect(analysis.valueClass).toBe('moderate_overlay');
    });
  });

  describe('Display Formatters', () => {
    describe('formatOverlayPercent', () => {
      it('formats positive overlay with + sign', () => {
        expect(formatOverlayPercent(75)).toBe('+75%');
        expect(formatOverlayPercent(150)).toBe('+150%');
      });

      it('formats negative overlay without + sign', () => {
        expect(formatOverlayPercent(-25)).toBe('-25%');
        expect(formatOverlayPercent(-5)).toBe('-5%');
      });

      it('formats zero overlay', () => {
        expect(formatOverlayPercent(0)).toBe('+0%');
      });
    });

    describe('formatEV', () => {
      it('formats positive EV with + sign', () => {
        expect(formatEV(1.25)).toBe('+$1.25');
        expect(formatEV(0.5)).toBe('+$0.50');
      });

      it('formats negative EV', () => {
        // The function returns the sign before the $ symbol
        const result = formatEV(-0.25);
        expect(result).toContain('0.25');
        expect(result).toContain('-');
      });
    });

    describe('formatEVPercent', () => {
      it('formats EV as percentage', () => {
        expect(formatEVPercent(125)).toBe('+125.0%');
        expect(formatEVPercent(-15.5)).toBe('-15.5%');
      });
    });

    describe('getOverlayColor', () => {
      it('returns correct colors for value classifications', () => {
        expect(getOverlayColor(120)).toBe(VALUE_COLORS.massive_overlay); // 100%+ = massive
        expect(getOverlayColor(60)).toBe(VALUE_COLORS.strong_overlay); // 40-99% = strong
        expect(getOverlayColor(30)).toBe(VALUE_COLORS.moderate_overlay); // 20-39% = moderate
        expect(getOverlayColor(15)).toBe(VALUE_COLORS.slight_overlay); // 10-19% = slight
        expect(getOverlayColor(5)).toBe(VALUE_COLORS.fair_price); // -20 to +9% = fair
        expect(getOverlayColor(-25)).toBe(VALUE_COLORS.underlay); // < -20% = underlay
      });
    });
  });

  /**
   * Real-World Racing Scenarios (Legacy standalone function)
   *
   * Note: These use the legacy analyzeOverlay which has conservative probabilities.
   * New formula: (score / 328) * 50, clamped to 2-50%
   */
  describe('Real-World Racing Scenarios', () => {
    it('analyzes a favorite with short odds (tests overlay calculation)', () => {
      // Score 180 → (180/328)*50 = 27.4% win prob
      // Fair odds = 1/0.274 = 3.65 (about 5-2)
      // 4-5 = 1.8 decimal
      const analysis = analyzeOverlay(180, '4-5');

      expect(analysis.winProbability).toBeCloseTo(27.4, 0);
      expect(analysis.actualOddsDecimal).toBeCloseTo(1.8, 1);
      // Overlay = (1.8 - 3.65) / 3.65 = -50.7% (underlay)
      expect(analysis.overlayPercent).toBeLessThan(-20);
      expect(analysis.valueClass).toBe('underlay');
    });

    it('analyzes a longshot with good odds (overlay)', () => {
      // Score 100 → (100/328)*50 = 15.2% win prob
      // Fair odds = 1/0.152 = 6.58 (about 11-2)
      // 8-1 = 9.0 decimal
      const analysis = analyzeOverlay(100, '8-1');

      expect(analysis.winProbability).toBeCloseTo(15.2, 0);
      expect(analysis.actualOddsDecimal).toBe(9); // 8-1 = 9.0
      // Overlay = (9 - 6.58) / 6.58 = 36.8%
      expect(analysis.overlayPercent).toBeGreaterThan(20);
      expect(analysis.valueClass).toBe('moderate_overlay');
      expect(analysis.isPositiveEV).toBe(true);
    });

    it('analyzes Penn National value play scenario', () => {
      // Score 145 → (145/328)*50 = 22.1% win prob
      // Fair odds = 1/0.221 = 4.52 (about 7-2)
      // 12-1 = 13.0 decimal
      const analysis = analyzeOverlay(145, '12-1');

      expect(analysis.winProbability).toBeCloseTo(22.1, 0);
      expect(analysis.actualOddsDecimal).toBe(13); // 12-1 = 13.0
      // Overlay = (13 - 4.52) / 4.52 = 187.6% (massive overlay)
      expect(analysis.overlayPercent).toBeGreaterThan(100); // Massive overlay
      expect(analysis.valueClass).toBe('massive_overlay');
      expect(analysis.recommendation.action).toBe('bet_heavily');
    });

    it('identifies chalk play as underlay when odds are too short', () => {
      // Score 185 → (185/328)*50 = 28.2% win prob
      // Fair odds = 1/0.282 = 3.55 (about 5-2)
      // 2-5 = 1.4 decimal
      const analysis = analyzeOverlay(185, '2-5');

      expect(analysis.winProbability).toBeCloseTo(28.2, 0);
      // Overlay = (1.4 - 3.55) / 3.55 = -60.6%
      expect(analysis.overlayPercent).toBeLessThan(-20);
      expect(analysis.valueClass).toBe('underlay');
    });

    it('handles classic value bet: mid-odds horse at overlay', () => {
      // Model B: Score 130 → (130/323)*50 = 20.12% win prob
      // Fair odds = 1/0.2012 = 4.97 (about 4-1)
      // 5-1 = 6.0 decimal
      const analysis = analyzeOverlay(130, '5-1');

      expect(analysis.winProbability).toBeCloseTo(20.12, 0);
      expect(analysis.actualOddsDecimal).toBe(6); // 5-1 = 6.0
      // Overlay = (6 - 4.97) / 4.97 = 20.7%
      // This is now a moderate overlay (20%+ threshold)
      expect(analysis.overlayPercent).toBeGreaterThan(15);
      expect(analysis.overlayPercent).toBeLessThan(30);
      expect(analysis.valueClass).toBe('moderate_overlay');
    });
  });
});
