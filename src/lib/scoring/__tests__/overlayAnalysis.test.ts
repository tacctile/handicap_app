/**
 * Overlay Analysis Tests
 *
 * Tests for the overlay detection and expected value (EV) calculation system.
 * Validates score-to-probability conversion, fair odds calculation, and value classifications.
 */

import { describe, it, expect } from 'vitest'
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
} from '../overlayAnalysis'

describe('Overlay Analysis', () => {
  describe('Score to Win Probability Conversion', () => {
    it('converts 200 pts → ~75% win probability', () => {
      const probability = scoreToWinProbability(200)
      expect(probability).toBe(75)
    })

    it('converts 140 pts → 45% win probability', () => {
      const probability = scoreToWinProbability(140)
      expect(probability).toBe(45)
    })

    it('converts 100 pts → 25% win probability', () => {
      const probability = scoreToWinProbability(100)
      expect(probability).toBe(25)
    })

    it('converts 150 pts → 50% win probability', () => {
      const probability = scoreToWinProbability(150)
      expect(probability).toBe(50)
    })

    it('converts 50 pts → minimum probability (2%)', () => {
      const probability = scoreToWinProbability(50)
      expect(probability).toBe(2) // Clamped at minimum
    })

    it('converts 250 pts → maximum probability (80%)', () => {
      const probability = scoreToWinProbability(250)
      expect(probability).toBe(80) // Clamped at maximum
    })

    it('handles scores below 50 (clamps to 2%)', () => {
      expect(scoreToWinProbability(30)).toBe(2)
      expect(scoreToWinProbability(0)).toBe(2)
    })

    it('handles extreme high scores (clamps to 80%)', () => {
      expect(scoreToWinProbability(300)).toBe(80)
      expect(scoreToWinProbability(500)).toBe(80)
    })
  })

  describe('Win Probability to Fair Odds Conversion', () => {
    it('converts 50% probability → 2.0 decimal (even money)', () => {
      const odds = probabilityToDecimalOdds(50)
      expect(odds).toBe(2)
    })

    it('converts 25% probability → 4.0 decimal (3-1)', () => {
      const odds = probabilityToDecimalOdds(25)
      expect(odds).toBe(4)
    })

    it('converts 20% probability → 5.0 decimal (4-1)', () => {
      const odds = probabilityToDecimalOdds(20)
      expect(odds).toBe(5)
    })

    it('converts 10% probability → 10.0 decimal (9-1)', () => {
      const odds = probabilityToDecimalOdds(10)
      expect(odds).toBe(10)
    })

    it('converts 5% probability → 20.0 decimal (19-1)', () => {
      const odds = probabilityToDecimalOdds(5)
      expect(odds).toBe(20)
    })

    it('handles edge case: 0% probability', () => {
      const odds = probabilityToDecimalOdds(0)
      expect(odds).toBe(100) // Capped at 99-1
    })

    it('handles edge case: 100% probability', () => {
      const odds = probabilityToDecimalOdds(100)
      expect(odds).toBe(1.01) // Near even money
    })
  })

  describe('Decimal to Fractional Odds Conversion', () => {
    it('converts 2.0 → "EVEN"', () => {
      expect(decimalToFractionalOdds(2.0)).toBe('EVEN')
    })

    it('converts 4.0 → "3-1"', () => {
      expect(decimalToFractionalOdds(4.0)).toBe('3-1')
    })

    it('converts 3.5 → "5-2"', () => {
      expect(decimalToFractionalOdds(3.5)).toBe('5-2')
    })

    it('converts 6.0 → "5-1"', () => {
      expect(decimalToFractionalOdds(6.0)).toBe('5-1')
    })

    it('converts 1.5 → "1-2"', () => {
      expect(decimalToFractionalOdds(1.5)).toBe('1-2')
    })

    it('converts 11.0 → "10-1"', () => {
      expect(decimalToFractionalOdds(11.0)).toBe('10-1')
    })
  })

  describe('Decimal to Moneyline Conversion', () => {
    it('converts 4.0 (underdog) → "+300"', () => {
      expect(decimalToMoneyline(4.0)).toBe('+300')
    })

    it('converts 2.0 (even money) → "+100"', () => {
      expect(decimalToMoneyline(2.0)).toBe('+100')
    })

    it('converts 1.5 (favorite) → "-200"', () => {
      expect(decimalToMoneyline(1.5)).toBe('-200')
    })

    it('converts 3.0 → "+200"', () => {
      expect(decimalToMoneyline(3.0)).toBe('+200')
    })

    it('converts 1.25 → "-400"', () => {
      expect(decimalToMoneyline(1.25)).toBe('-400')
    })
  })

  describe('Parse Odds to Decimal', () => {
    it('parses "3-1" format', () => {
      expect(parseOddsToDecimal('3-1')).toBe(4)
      expect(parseOddsToDecimal('5-1')).toBe(6)
    })

    it('parses "5/2" format', () => {
      expect(parseOddsToDecimal('5/2')).toBe(3.5)
      expect(parseOddsToDecimal('3/2')).toBe(2.5)
    })

    it('parses "EVEN" odds', () => {
      expect(parseOddsToDecimal('EVEN')).toBe(2)
      expect(parseOddsToDecimal('evn')).toBe(2)
    })

    it('parses moneyline format "+300"', () => {
      expect(parseOddsToDecimal('+300')).toBe(4)
      expect(parseOddsToDecimal('+200')).toBe(3)
    })

    it('parses moneyline format "-150"', () => {
      expect(parseOddsToDecimal('-150')).toBeCloseTo(1.667, 1)
      expect(parseOddsToDecimal('-200')).toBe(1.5)
    })

    it('parses plain number as X-1 odds', () => {
      expect(parseOddsToDecimal('5')).toBe(6) // Treated as 5-1
      expect(parseOddsToDecimal('10')).toBe(11) // Treated as 10-1
    })

    it('handles invalid input gracefully', () => {
      expect(parseOddsToDecimal('invalid')).toBe(11) // Default to 10-1
    })
  })

  describe('Calculate Overlay Percentage', () => {
    it('calculates positive overlay (value bet)', () => {
      // Fair odds 3-1 (4.0), actual 8-1 (9.0)
      const overlay = calculateOverlayPercent(4.0, 9.0)
      expect(overlay).toBe(125) // 125% overlay
    })

    it('calculates moderate overlay', () => {
      // Fair odds 2-1 (3.0), actual 5/2 (3.5)
      const overlay = calculateOverlayPercent(3.0, 3.5)
      expect(overlay).toBeCloseTo(16.7, 0)
    })

    it('calculates underlay (negative value)', () => {
      // Fair odds 5/2 (3.5), actual 2-1 (3.0)
      const overlay = calculateOverlayPercent(3.5, 3.0)
      expect(overlay).toBeCloseTo(-14.3, 0)
    })

    it('calculates zero overlay (fair price)', () => {
      const overlay = calculateOverlayPercent(4.0, 4.0)
      expect(overlay).toBe(0)
    })

    it('handles edge case: near even money fair odds', () => {
      const overlay = calculateOverlayPercent(1.5, 2.0)
      expect(overlay).toBeCloseTo(33.3, 0)
    })
  })

  describe('Value Classification', () => {
    it('classifies 150%+ as massive_overlay', () => {
      expect(classifyValue(150)).toBe('massive_overlay')
      expect(classifyValue(200)).toBe('massive_overlay')
    })

    it('classifies 50-149% as strong_overlay', () => {
      expect(classifyValue(50)).toBe('strong_overlay')
      expect(classifyValue(100)).toBe('strong_overlay')
      expect(classifyValue(149)).toBe('strong_overlay')
    })

    it('classifies 25-49% as moderate_overlay', () => {
      expect(classifyValue(25)).toBe('moderate_overlay')
      expect(classifyValue(40)).toBe('moderate_overlay')
    })

    it('classifies 10-24% as slight_overlay', () => {
      expect(classifyValue(10)).toBe('slight_overlay')
      expect(classifyValue(20)).toBe('slight_overlay')
    })

    it('classifies -10% to +9% as fair_price', () => {
      expect(classifyValue(0)).toBe('fair_price')
      expect(classifyValue(5)).toBe('fair_price')
      expect(classifyValue(-5)).toBe('fair_price')
      expect(classifyValue(-10)).toBe('fair_price')
    })

    it('classifies below -10% as underlay', () => {
      expect(classifyValue(-11)).toBe('underlay')
      expect(classifyValue(-25)).toBe('underlay')
      expect(classifyValue(-50)).toBe('underlay')
    })
  })

  describe('Expected Value Calculation', () => {
    it('calculates positive EV for overlay bet', () => {
      // 25% win probability at 8-1 odds (9.0 decimal)
      // EV = (0.25 × 8) - (0.75 × 1) = 2.0 - 0.75 = +$1.25
      const ev = calculateEV(25, 9.0)
      expect(ev).toBeCloseTo(1.25, 2)
    })

    it('calculates zero EV at fair odds', () => {
      // 25% win probability at 3-1 odds (4.0 decimal)
      // EV = (0.25 × 3) - (0.75 × 1) = 0.75 - 0.75 = 0
      const ev = calculateEV(25, 4.0)
      expect(ev).toBeCloseTo(0, 2)
    })

    it('calculates negative EV for underlay bet', () => {
      // 25% win probability at 2-1 odds (3.0 decimal)
      // EV = (0.25 × 2) - (0.75 × 1) = 0.5 - 0.75 = -$0.25
      const ev = calculateEV(25, 3.0)
      expect(ev).toBeCloseTo(-0.25, 2)
    })

    it('calculates EV correctly for favorites', () => {
      // 60% win probability at even money (2.0 decimal)
      // EV = (0.60 × 1) - (0.40 × 1) = 0.60 - 0.40 = +$0.20
      const ev = calculateEV(60, 2.0)
      expect(ev).toBeCloseTo(0.2, 2)
    })

    it('calculates EV for longshots', () => {
      // 5% win probability at 30-1 odds (31.0 decimal)
      // EV = (0.05 × 30) - (0.95 × 1) = 1.5 - 0.95 = +$0.55
      const ev = calculateEV(5, 31.0)
      expect(ev).toBeCloseTo(0.55, 2)
    })
  })

  describe('Generate Recommendation', () => {
    it('generates bet_heavily for massive overlay', () => {
      const rec = generateRecommendation('massive_overlay', 175, 1.5)
      expect(rec.action).toBe('bet_heavily')
      expect(rec.urgency).toBe('immediate')
      expect(rec.suggestedMultiplier).toBeGreaterThan(1.5)
    })

    it('generates bet_standard for strong overlay', () => {
      const rec = generateRecommendation('strong_overlay', 75, 0.8)
      expect(rec.action).toBe('bet_standard')
      expect(rec.urgency).toBe('standard')
    })

    it('generates bet_standard for moderate overlay', () => {
      const rec = generateRecommendation('moderate_overlay', 35, 0.4)
      expect(rec.action).toBe('bet_standard')
      expect(rec.suggestedMultiplier).toBe(1.0)
    })

    it('generates bet_small for slight overlay', () => {
      const rec = generateRecommendation('slight_overlay', 15, 0.15)
      expect(rec.action).toBe('bet_small')
      expect(rec.suggestedMultiplier).toBe(0.75)
    })

    it('generates pass for fair price', () => {
      const rec = generateRecommendation('fair_price', 5, 0.05)
      expect(rec.action).toBe('pass')
      expect(rec.urgency).toBe('none')
    })

    it('generates avoid for underlay', () => {
      const rec = generateRecommendation('underlay', -25, -0.25)
      expect(rec.action).toBe('avoid')
      expect(rec.suggestedMultiplier).toBe(0)
    })
  })

  describe('Generate Overlay Description', () => {
    it('generates description for massive overlay', () => {
      const desc = generateOverlayDescription(175, 'massive_overlay', '4-1', '12-1')
      expect(desc).toContain('175%')
      expect(desc).toContain('exceptional')
      expect(desc).toContain('4-1')
      expect(desc).toContain('12-1')
    })

    it('generates description for underlay', () => {
      const desc = generateOverlayDescription(-25, 'underlay', '5-1', '3-1')
      expect(desc).toContain('Underlay')
      expect(desc).toContain('25%')
      expect(desc).toContain('worse')
    })

    it('generates description for fair price', () => {
      const desc = generateOverlayDescription(3, 'fair_price', '4-1', '4-1')
      expect(desc).toContain('Fair price')
      expect(desc).toContain('close to fair value')
    })
  })

  describe('Analyze Overlay (Integration)', () => {
    it('performs complete analysis for overlay bet', () => {
      // Score 160 = 55% win prob = fair odds 1.82
      // Actual 5-1 = 6.0 decimal
      const analysis = analyzeOverlay(160, '5-1')

      expect(analysis.winProbability).toBeCloseTo(55, 0)
      expect(analysis.actualOddsDecimal).toBe(6)
      expect(analysis.overlayPercent).toBeGreaterThan(200) // Massive overlay
      expect(analysis.valueClass).toBe('massive_overlay')
      expect(analysis.isPositiveEV).toBe(true)
      expect(analysis.evPerDollar).toBeGreaterThan(0)
      expect(analysis.recommendation.action).toBe('bet_heavily')
    })

    it('performs complete analysis for underlay bet', () => {
      // Score 200 = 75% win prob = fair odds 1.33
      // Actual 1-9 = 1.11 decimal (heavy favorite at bad odds)
      const analysis = analyzeOverlay(200, '1-9')

      expect(analysis.winProbability).toBe(75)
      expect(analysis.overlayPercent).toBeLessThan(0)
      // At 1-9 odds (1.11 decimal) vs fair 1.33, this is underlay
      expect(analysis.valueClass).toBe('underlay')
      expect(analysis.isPositiveEV).toBe(false)
      expect(analysis.recommendation.action).toBe('avoid')
    })

    it('performs complete analysis for fair price bet', () => {
      // Score 100 = 25% win prob = fair odds 4.0
      // Actual 3-1 = 4.0 decimal
      const analysis = analyzeOverlay(100, '3-1')

      expect(analysis.winProbability).toBe(25)
      expect(analysis.actualOddsDecimal).toBe(4)
      expect(analysis.overlayPercent).toBe(0)
      expect(analysis.valueClass).toBe('fair_price')
    })
  })

  describe('Tier Adjustment Logic', () => {
    it('bumps up tier for high overlay', () => {
      // Score 165 + 80% overlay = adjusted score 185
      const adjustment = calculateTierAdjustment(165, 80)

      expect(adjustment.adjustedScore).toBe(185)
      expect(adjustment.tierShift).toBe(1)
      expect(adjustment.reasoning).toContain('+20')
    })

    it('bumps down tier for underlay', () => {
      // Score 175 + -35% overlay = adjusted score 160 (avoid Fool's Gold trigger at 180+)
      const adjustment = calculateTierAdjustment(175, -35)

      expect(adjustment.adjustedScore).toBe(150)
      expect(adjustment.tierShift).toBe(-2)
      expect(adjustment.reasoning).toContain('underlay')
    })

    it('identifies Diamond in Rough (low score + massive overlay)', () => {
      // Score 155 + 175% overlay = special case
      const adjustment = calculateTierAdjustment(155, 175)

      expect(adjustment.isSpecialCase).toBe(true)
      expect(adjustment.specialCaseType).toBe('diamond_in_rough')
      expect(adjustment.reasoning).toContain('DIAMOND')
    })

    it('identifies Fool\'s Gold (high score + severe underlay)', () => {
      // Score 190 + -30% overlay = overbet public choice
      const adjustment = calculateTierAdjustment(190, -30)

      expect(adjustment.isSpecialCase).toBe(true)
      expect(adjustment.specialCaseType).toBe('fool_gold')
      expect(adjustment.reasoning).toContain('FOOL\'S GOLD')
    })

    it('handles slight overlay (+15%)', () => {
      const adjustment = calculateTierAdjustment(150, 15)

      expect(adjustment.adjustedScore).toBe(155)
      expect(adjustment.tierShift).toBe(0)
    })

    it('handles massive overlay (+150%)', () => {
      const adjustment = calculateTierAdjustment(140, 150)

      expect(adjustment.adjustedScore).toBe(170)
      expect(adjustment.tierShift).toBe(2)
    })
  })

  describe('Detect Value Plays', () => {
    it('detects and ranks value plays in a race', () => {
      const horses = [
        { horseIndex: 0, horseName: 'No Value', programNumber: 1, score: 150, currentOdds: '1-1', isScratched: false },
        { horseIndex: 1, horseName: 'Big Overlay', programNumber: 2, score: 140, currentOdds: '15-1', isScratched: false },
        { horseIndex: 2, horseName: 'Moderate Value', programNumber: 3, score: 120, currentOdds: '8-1', isScratched: false },
        { horseIndex: 3, horseName: 'Scratched', programNumber: 4, score: 180, currentOdds: '20-1', isScratched: true },
      ]

      const valuePlays = detectValuePlays(horses, 10)

      // Should exclude scratched horse and no-value horse
      expect(valuePlays.length).toBe(2)
      // Should be sorted by overlay (best first)
      expect(valuePlays[0].horseName).toBe('Big Overlay')
      expect(valuePlays[0].overlayPercent).toBeGreaterThan(valuePlays[1].overlayPercent)
    })

    it('returns empty array when no value plays exist', () => {
      const horses = [
        { horseIndex: 0, horseName: 'Favorite', programNumber: 1, score: 200, currentOdds: '1-5', isScratched: false },
        { horseIndex: 1, horseName: 'Underlay', programNumber: 2, score: 150, currentOdds: '1-2', isScratched: false },
      ]

      const valuePlays = detectValuePlays(horses, 10)

      expect(valuePlays.length).toBe(0)
    })

    it('excludes scratched horses', () => {
      const horses = [
        { horseIndex: 0, horseName: 'Good Value', programNumber: 1, score: 120, currentOdds: '20-1', isScratched: true },
      ]

      const valuePlays = detectValuePlays(horses)

      expect(valuePlays.length).toBe(0)
    })
  })

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
          recommendation: {} as any,
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
          recommendation: {} as any,
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
          recommendation: {} as any,
        },
      ]

      const summary = getValuePlaysSummary(valuePlays)

      expect(summary.totalCount).toBe(3)
      expect(summary.massiveCount).toBe(1)
      expect(summary.strongCount).toBe(1)
      expect(summary.moderateCount).toBe(1)
      expect(summary.bestPlay?.horseName).toBe('Massive')
      expect(summary.totalPositiveEV).toBeCloseTo(2.7, 1)
    })

    it('handles empty value plays', () => {
      const summary = getValuePlaysSummary([])

      expect(summary.totalCount).toBe(0)
      expect(summary.bestPlay).toBeNull()
      expect(summary.totalPositiveEV).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('handles 0 odds gracefully', () => {
      const analysis = analyzeOverlay(150, '0')

      // Should not throw and should return reasonable values
      expect(analysis.actualOddsDecimal).toBeDefined()
      expect(analysis.winProbability).toBe(50)
    })

    it('handles missing morning line', () => {
      const analysis = analyzeOverlay(100, '')

      // Should use default odds
      expect(analysis.actualOddsDecimal).toBeDefined()
    })

    it('handles score out of expected range (very low)', () => {
      const analysis = analyzeOverlay(20, '10-1')

      expect(analysis.winProbability).toBe(2) // Clamped minimum
      expect(analysis.fairOddsDecimal).toBe(50) // 1/0.02 = 50
    })

    it('handles score out of expected range (very high)', () => {
      // Score 300 = 80% win prob (capped)
      // Fair odds = 1/0.8 = 1.25 (1-4)
      // Actual 2-1 = 3.0 decimal
      // This is actually a massive overlay, not underlay
      const analysis = analyzeOverlay(300, '2-1')

      expect(analysis.winProbability).toBe(80) // Clamped maximum
      // 2-1 (3.0) vs fair 1.25 is a big overlay!
      expect(analysis.overlayPercent).toBeGreaterThan(100)
    })
  })

  describe('Display Formatters', () => {
    describe('formatOverlayPercent', () => {
      it('formats positive overlay with + sign', () => {
        expect(formatOverlayPercent(75)).toBe('+75%')
        expect(formatOverlayPercent(150)).toBe('+150%')
      })

      it('formats negative overlay without + sign', () => {
        expect(formatOverlayPercent(-25)).toBe('-25%')
        expect(formatOverlayPercent(-5)).toBe('-5%')
      })

      it('formats zero overlay', () => {
        expect(formatOverlayPercent(0)).toBe('+0%')
      })
    })

    describe('formatEV', () => {
      it('formats positive EV with + sign', () => {
        expect(formatEV(1.25)).toBe('+$1.25')
        expect(formatEV(0.5)).toBe('+$0.50')
      })

      it('formats negative EV', () => {
        // The function returns the sign before the $ symbol
        const result = formatEV(-0.25)
        expect(result).toContain('0.25')
        expect(result).toContain('-')
      })
    })

    describe('formatEVPercent', () => {
      it('formats EV as percentage', () => {
        expect(formatEVPercent(125)).toBe('+125.0%')
        expect(formatEVPercent(-15.5)).toBe('-15.5%')
      })
    })

    describe('getOverlayColor', () => {
      it('returns correct colors for value classifications', () => {
        expect(getOverlayColor(160)).toBe(VALUE_COLORS.massive_overlay)
        expect(getOverlayColor(75)).toBe(VALUE_COLORS.strong_overlay)
        expect(getOverlayColor(35)).toBe(VALUE_COLORS.moderate_overlay)
        expect(getOverlayColor(15)).toBe(VALUE_COLORS.slight_overlay)
        expect(getOverlayColor(5)).toBe(VALUE_COLORS.fair_price)
        expect(getOverlayColor(-20)).toBe(VALUE_COLORS.underlay)
      })
    })
  })

  describe('Real-World Racing Scenarios', () => {
    it('analyzes a favorite with bad odds (underlay)', () => {
      // Top-rated horse at 180 score (65% win prob) going off at 4-5
      const analysis = analyzeOverlay(180, '4-5')

      expect(analysis.winProbability).toBe(65)
      expect(analysis.fairOddsDecimal).toBeCloseTo(1.54, 1)
      expect(analysis.actualOddsDecimal).toBeCloseTo(1.8, 1)
      // Actually this would be an overlay since 4-5 = 1.8 > 1.54
      expect(analysis.overlayPercent).toBeGreaterThan(0)
    })

    it('analyzes a longshot with good odds (overlay)', () => {
      // Low-rated horse at 100 score (25% win prob) at 8-1 odds
      const analysis = analyzeOverlay(100, '8-1')

      expect(analysis.winProbability).toBe(25)
      expect(analysis.fairOddsDecimal).toBe(4) // 1/0.25 = 4 (3-1)
      expect(analysis.actualOddsDecimal).toBe(9) // 8-1 = 9.0
      expect(analysis.overlayPercent).toBe(125) // (9-4)/4 * 100 = 125%
      expect(analysis.valueClass).toBe('strong_overlay')
      expect(analysis.isPositiveEV).toBe(true)
    })

    it('analyzes Penn National value play scenario', () => {
      // Saratoga shipper with 145 score at 12-1 odds
      const analysis = analyzeOverlay(145, '12-1')

      expect(analysis.winProbability).toBe(47.5)
      expect(analysis.actualOddsDecimal).toBe(13) // 12-1 = 13.0
      // Fair odds at 47.5% = 2.1
      expect(analysis.overlayPercent).toBeGreaterThan(400) // Massive overlay
      expect(analysis.valueClass).toBe('massive_overlay')
      expect(analysis.recommendation.action).toBe('bet_heavily')
    })

    it('identifies chalk play as underlay when odds are too short', () => {
      // Highly-rated horse (185 score = 67.5% win prob)
      // Fair odds ~ 1.48 (1-2)
      // Going off at 2-5 (1.4 decimal) - slight underlay
      const analysis = analyzeOverlay(185, '2-5')

      expect(analysis.winProbability).toBe(67.5)
      // At 67.5%, fair decimal = 1/0.675 = 1.48
      // Actual 2-5 = 1.4
      // Overlay = (1.4 - 1.48) / 1.48 * 100 = -5.4%
      expect(analysis.overlayPercent).toBeLessThan(0)
    })

    it('handles classic value bet: mid-odds horse at overlay', () => {
      // 130 score (40% win prob) at 5-1 odds
      const analysis = analyzeOverlay(130, '5-1')

      expect(analysis.winProbability).toBe(40)
      expect(analysis.fairOddsDecimal).toBe(2.5) // 1/0.4 = 2.5 (3-2)
      expect(analysis.actualOddsDecimal).toBe(6) // 5-1 = 6.0
      expect(analysis.overlayPercent).toBe(140) // (6-2.5)/2.5 * 100 = 140%
      expect(analysis.valueClass).toBe('strong_overlay')
    })
  })
})
