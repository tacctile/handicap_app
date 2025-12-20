/**
 * Form Scoring Tests
 * Tests layoff calculations, recent form patterns, and consistency bonuses
 */

import { describe, it, expect } from 'vitest'
import {
  calculateFormScore,
  isOnHotStreak,
  getFormSummary,
} from '../../../lib/scoring/form'
import {
  createHorseEntry,
  createPastPerformance,
  createLayoffHorse,
  createFirstTimeStarter,
} from '../../fixtures/testHelpers'

describe('Form Scoring', () => {
  describe('Layoff Calculations', () => {
    it('returns 10 points (max) for optimal layoff (7-35 days)', () => {
      const horse = createLayoffHorse(21)

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(10)
      expect(result.reasoning).toContain('Optimal layoff')
    })

    it('returns 10 points for 7-day layoff', () => {
      const horse = createLayoffHorse(7)

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(10)
    })

    it('returns 10 points for 35-day layoff', () => {
      const horse = createLayoffHorse(35)

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(10)
    })

    it('returns 7 points for 30-60 day layoff (short freshening)', () => {
      const horse = createLayoffHorse(45)

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(7)
      expect(result.reasoning).toContain('freshening')
    })

    it('returns 4 points for 60-90 day layoff', () => {
      const horse = createLayoffHorse(75)

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(4)
      expect(result.reasoning).toContain('Moderate layoff')
    })

    it('returns 0-5 points for 180+ day extended layoff', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 180,
        pastPerformances: [
          createPastPerformance({ daysSinceLast: 180, finishPosition: 5 }),
          createPastPerformance({ daysSinceLast: 30, finishPosition: 3 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBeLessThanOrEqual(5)
    })

    it('returns 6 points for quick turnback (<7 days)', () => {
      const horse = createLayoffHorse(5)

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(6)
      expect(result.reasoning).toContain('Quick turnback')
    })

    it('returns 5 points for first-time starter', () => {
      const horse = createFirstTimeStarter()

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBe(5)
      expect(result.reasoning).toContain('First')
    })

    it('adds bonus for horse with winning off layoff history', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 120,
        pastPerformances: [
          createPastPerformance({ daysSinceLast: 120, finishPosition: 4 }),
          createPastPerformance({ daysSinceLast: 90, finishPosition: 1 }), // Won off layoff
          createPastPerformance({ daysSinceLast: 21, finishPosition: 2 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.layoffScore).toBeGreaterThan(0)
      expect(result.reasoning).toContain('won fresh')
    })
  })

  describe('Recent Form Patterns', () => {
    it('returns 15 points (max) for recent win', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1, lengthsBehind: 0 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.recentFormScore).toBe(15)
    })

    it('returns 8 points for first-time starter (neutral)', () => {
      const horse = createFirstTimeStarter()

      const result = calculateFormScore(horse)

      expect(result.recentFormScore).toBe(8)
    })

    it('weights most recent race higher (50%)', () => {
      // Recent win followed by poor races should still score well
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // 50% weight
          createPastPerformance({ finishPosition: 10 }), // 30% weight
          createPastPerformance({ finishPosition: 10 }), // 20% weight
        ],
      })

      const result = calculateFormScore(horse)

      // 15*0.5 + 3*0.3 + 3*0.2 = 7.5 + 0.9 + 0.6 = 9
      expect(result.recentFormScore).toBeGreaterThanOrEqual(9)
    })

    it('gives higher score for close 2nd place (within 2 lengths)', () => {
      const closeSecond = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2, lengthsBehind: 1.5 }),
        ],
      })

      const wideSecond = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2, lengthsBehind: 5 }),
        ],
      })

      const closeResult = calculateFormScore(closeSecond)
      const wideResult = calculateFormScore(wideSecond)

      expect(closeResult.recentFormScore).toBeGreaterThan(wideResult.recentFormScore)
    })
  })

  describe('Consistency Bonus', () => {
    it('returns 5 point bonus for 3+ consecutive ITM finishes (hot streak)', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.consistencyBonus).toBe(5)
      expect(result.itmStreak).toBe(4)
      expect(result.reasoning).toContain('Hot streak')
    })

    it('returns 3 point bonus for 2 consecutive ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }), // Breaks streak
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.consistencyBonus).toBe(3)
      expect(result.itmStreak).toBe(2)
    })

    it('returns 1 point bonus for ITM last out only', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }), // Not ITM
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.consistencyBonus).toBe(1)
      expect(result.itmStreak).toBe(1)
    })

    it('returns 0 bonus for no recent ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 5 }),
          createPastPerformance({ finishPosition: 6 }),
          createPastPerformance({ finishPosition: 4 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.consistencyBonus).toBe(0)
      expect(result.itmStreak).toBe(0)
    })

    it('returns 3 bonus for high ITM rate (4/5) even without streak', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 4 }), // Not ITM - breaks streak
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.consistencyBonus).toBe(3) // 4/5 ITM = consistent
    })
  })

  describe('Form Trend Analysis', () => {
    it('detects improving form trend', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // Most recent - best
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 6 }), // Oldest - worst
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.formTrend).toBe('improving')
    })

    it('detects declining form trend', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 8 }), // Most recent - worst
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 1 }), // Oldest - best
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.formTrend).toBe('declining')
    })

    it('detects steady form trend', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.formTrend).toBe('steady')
    })

    it('returns unknown trend for insufficient data', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.formTrend).toBe('unknown')
    })
  })

  describe('Total Score', () => {
    it('is capped at 30 points maximum', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21, // Optimal layoff = 10
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }), // Recent form = 15
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 1 }), // Hot streak = 5
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.total).toBeLessThanOrEqual(30)
    })

    it('combines all components correctly', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 21,
        pastPerformances: [
          createPastPerformance({ finishPosition: 2, daysSinceLast: 21 }),
        ],
      })

      const result = calculateFormScore(horse)

      expect(result.total).toBe(
        result.recentFormScore + result.layoffScore + result.consistencyBonus
      )
    })
  })

  describe('isOnHotStreak', () => {
    it('returns true for 3+ consecutive ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      })

      expect(isOnHotStreak(horse)).toBe(true)
    })

    it('returns false for 2 consecutive ITM finishes', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
          createPastPerformance({ finishPosition: 5 }),
        ],
      })

      expect(isOnHotStreak(horse)).toBe(false)
    })

    it('returns false for no past performances', () => {
      const horse = createFirstTimeStarter()

      expect(isOnHotStreak(horse)).toBe(false)
    })
  })

  describe('getFormSummary', () => {
    it('returns Hot for 3+ ITM streak', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 2 }),
          createPastPerformance({ finishPosition: 3 }),
        ],
      })

      const summary = getFormSummary(horse)

      expect(summary.label).toBe('Hot')
    })

    it('returns Improving for improving form', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 1 }),
          createPastPerformance({ finishPosition: 5 }),
          createPastPerformance({ finishPosition: 8 }),
        ],
      })

      const summary = getFormSummary(horse)

      expect(summary.label).toBe('Improving')
    })

    it('returns Declining for declining form', () => {
      const horse = createHorseEntry({
        pastPerformances: [
          createPastPerformance({ finishPosition: 8 }),
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 1 }),
        ],
      })

      const summary = getFormSummary(horse)

      expect(summary.label).toBe('Declining')
    })

    it('returns Layoff for extended layoff', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 120,
        pastPerformances: [
          createPastPerformance({ finishPosition: 5 }),
        ],
      })

      const summary = getFormSummary(horse)

      expect(summary.label).toBe('Layoff')
    })

    it('returns Steady for steady form', () => {
      const horse = createHorseEntry({
        daysSinceLastRace: 30,
        pastPerformances: [
          createPastPerformance({ finishPosition: 4 }),
          createPastPerformance({ finishPosition: 5 }),
          createPastPerformance({ finishPosition: 4 }),
        ],
      })

      const summary = getFormSummary(horse)

      expect(summary.label).toBe('Steady')
    })
  })
})
