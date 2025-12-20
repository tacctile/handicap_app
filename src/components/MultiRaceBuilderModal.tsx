/**
 * Multi-Race Builder Modal
 *
 * Interactive modal for building multi-race exotic bets:
 * - Daily Double, Pick 3, Pick 4, Pick 5, Pick 6
 * - Race-by-race horse selection
 * - Live cost calculation
 * - Smart suggestions
 * - Auto-optimize button
 * - Carryover display for Pick 5/6
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HorseEntry } from '../types/drf'
import type { HorseScore } from '../lib/scoring'
import {
  type MultiRaceBetType,
  type MultiRaceStrategy,
  type MultiRaceRaceData,
  type MultiRaceHorse,
  type OptimizedTicket,
  type LegSuggestion,
  MULTI_RACE_BET_CONFIGS,
  getBetConfig,
  createBuilderState,
  updateLegSelection,
  toggleHorseInLeg,
  toggleAllForLeg,
  updateBaseBet,
  updateBudget,
  updateStrategy,
  generateAllSuggestions,
  applySuggestion,
  applyAllSuggestions,
  autoOptimizeForBudget,
  buildTicketFromState,
  validateBuilderState,
  getStateSummary,
  getProbabilityColor,
  getEVColor,
  formatProbability,
  formatEV,
  formatCarryoverAmount,
  getCarryoverBadgeColor,
  calculateTicketProbability,
  estimatePayoutRange,
  calculateExpectedValue,
  classifyRaceStrength,
  findStandoutHorse,
} from '../lib/multirace'
import { formatCurrency } from '../lib/recommendations'

// ============================================================================
// TYPES
// ============================================================================

interface RaceData {
  raceNumber: number
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
  postTime?: string
}

interface MultiRaceBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  betType: MultiRaceBetType
  races: RaceData[]
  startingRace: number
  trackCode?: string
  budget: number
  onAddToBetSlip: (ticket: MultiRaceTicketResult) => void
}

export interface MultiRaceTicketResult {
  id: string
  betType: MultiRaceBetType
  displayName: string
  raceRange: string
  spreadNotation: string
  totalCost: number
  combinations: number
  probability: number
  payoutRange: { min: number; max: number }
  expectedValue: number
  windowInstruction: string
  raceInstructions: Array<{
    raceNumber: number
    horses: number[]
  }>
  hasCarryover: boolean
  carryoverAmount?: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_COLORS = {
  1: { bg: 'rgba(25, 171, 181, 0.15)', border: '#19abb5', text: '#19abb5' },
  2: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
  3: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
}

const STRATEGY_OPTIONS: { value: MultiRaceStrategy; label: string; icon: string; description: string }[] = [
  { value: 'conservative', label: 'Conservative', icon: 'savings', description: 'Singles in standout races' },
  { value: 'balanced', label: 'Balanced', icon: 'balance', description: '2-3 horses per race' },
  { value: 'aggressive', label: 'Aggressive', icon: 'local_fire_department', description: 'ALL in weak races' },
]

const RACE_STRENGTH_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  standout: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', icon: 'verified' },
  competitive: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', icon: 'multiple_stop' },
  weak: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', icon: 'help_outline' },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToMultiRaceData(raceData: RaceData): MultiRaceRaceData {
  const horses: MultiRaceHorse[] = raceData.horses.map((h, idx) => {
    let tier: 1 | 2 | 3 = 3
    if (h.score.total >= 180) tier = 1
    else if (h.score.total >= 160) tier = 2

    const oddsMatch = h.horse.morningLineOdds.match(/(\d+(?:\.\d+)?)[/-](\d+(?:\.\d+)?)?/)
    const decimalOdds = oddsMatch
      ? parseFloat(oddsMatch[1]) / (oddsMatch[2] ? parseFloat(oddsMatch[2]) : 1)
      : 5
    const winProbability = 1 / (decimalOdds + 1)

    const sorted = [...raceData.horses].sort((a, b) => b.score.total - a.score.total)
    const nextHorse = sorted[idx + 1]
    const scoreGapToNext = nextHorse ? h.score.total - nextHorse.score.total : 0

    return {
      programNumber: h.horse.programNumber,
      horseName: h.horse.horseName,
      score: h.score.total,
      morningLineOdds: h.horse.morningLineOdds,
      decimalOdds,
      winProbability,
      tier,
      isSingleCandidate: h.score.total >= 180 && scoreGapToNext >= 15,
      scoreGapToNext,
    }
  }).sort((a, b) => b.score - a.score)

  const strength = classifyRaceStrength(horses)
  const standout = findStandoutHorse(horses)

  return {
    raceNumber: raceData.raceNumber,
    postTime: raceData.postTime || '',
    fieldSize: horses.length,
    horses,
    strength,
    hasStandout: !!standout,
    standoutHorse: standout,
    isCancelled: false,
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MultiRaceBuilderModal({
  isOpen,
  onClose,
  betType,
  races,
  startingRace,
  trackCode,
  budget,
  onAddToBetSlip,
}: MultiRaceBuilderModalProps) {
  const config = getBetConfig(betType)

  // Convert races to MultiRaceRaceData format
  const multiRaceData = useMemo(() => {
    return races.slice(0, config.racesRequired).map(convertToMultiRaceData)
  }, [races, config.racesRequired])

  // Initialize builder state
  const [state, setState] = useState(() =>
    createBuilderState(betType, startingRace, multiRaceData, budget, trackCode)
  )

  // Current leg being viewed
  const [currentLeg, setCurrentLeg] = useState(0)

  // Suggestions
  const suggestions = useMemo(() =>
    generateAllSuggestions(state, multiRaceData),
    [state, multiRaceData]
  )

  // Probability and payout calculations
  const probability = useMemo(() => {
    if (!state.liveCost?.isValid) return 0
    return calculateTicketProbability(multiRaceData, state.selections)
  }, [state.liveCost, state.selections, multiRaceData])

  const payoutRange = useMemo(() => {
    if (!state.liveCost?.isValid) return { min: 0, max: 0, likely: 0 }
    return estimatePayoutRange(betType, state.liveCost, probability)
  }, [betType, state.liveCost, probability])

  const expectedValue = useMemo(() => {
    if (!state.liveCost?.isValid) return 0
    return calculateExpectedValue(probability, payoutRange.likely, state.liveCost.total)
  }, [probability, payoutRange.likely, state.liveCost])

  // Validation
  const validation = useMemo(() => validateBuilderState(state), [state])

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setState(createBuilderState(betType, startingRace, multiRaceData, budget, trackCode))
      setCurrentLeg(0)
    }
  }, [isOpen, betType, startingRace, multiRaceData, budget, trackCode])

  // Handlers
  const handleHorseToggle = useCallback((legNumber: number, programNumber: number) => {
    setState(prev => toggleHorseInLeg(prev, legNumber, programNumber))
  }, [])

  const handleToggleAll = useCallback((legNumber: number) => {
    setState(prev => toggleAllForLeg(prev, legNumber))
  }, [])

  const handleBaseBetChange = useCallback((newBaseBet: number) => {
    setState(prev => updateBaseBet(prev, newBaseBet))
  }, [])

  const handleBudgetChange = useCallback((newBudget: number) => {
    setState(prev => updateBudget(prev, newBudget))
  }, [])

  const handleStrategyChange = useCallback((newStrategy: MultiRaceStrategy) => {
    setState(prev => updateStrategy(prev, newStrategy))
  }, [])

  const handleApplySuggestion = useCallback((suggestion: LegSuggestion) => {
    setState(prev => applySuggestion(prev, suggestion))
  }, [])

  const handleApplyAllSuggestions = useCallback(() => {
    setState(prev => applyAllSuggestions(prev, multiRaceData))
  }, [multiRaceData])

  const handleAutoOptimize = useCallback(() => {
    setState(prev => autoOptimizeForBudget(prev, multiRaceData))
  }, [multiRaceData])

  const handleAddToBetSlip = useCallback(() => {
    const ticket = buildTicketFromState(state, multiRaceData)
    if (!ticket) return

    const result: MultiRaceTicketResult = {
      id: ticket.id,
      betType: ticket.betType,
      displayName: `${config.displayName} (Races ${ticket.raceRange})`,
      raceRange: ticket.raceRange,
      spreadNotation: ticket.cost.spreadNotation,
      totalCost: ticket.cost.total,
      combinations: ticket.cost.combinations,
      probability: ticket.probability,
      payoutRange: {
        min: ticket.payoutRange.min,
        max: ticket.payoutRange.max,
      },
      expectedValue: ticket.expectedValue,
      windowInstruction: ticket.windowInstruction,
      raceInstructions: ticket.selections.map(s => ({
        raceNumber: s.raceNumber,
        horses: s.selections,
      })),
      hasCarryover: !!state.carryover,
      carryoverAmount: state.carryover?.carryoverAmount,
    }

    onAddToBetSlip(result)
    onClose()
  }, [state, multiRaceData, config.displayName, onAddToBetSlip, onClose])

  if (!isOpen) return null

  const currentRace = multiRaceData[currentLeg]
  const currentSelection = state.selections[currentLeg]
  const currentSuggestion = suggestions[currentLeg]

  return (
    <>
      <motion.div
        className="multirace-builder-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="multirace-builder-container"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="multirace-builder-modal">
          {/* Header */}
          <div className="multirace-builder-header">
            <div className="multirace-builder-title-group">
              <span className="material-icons multirace-builder-icon">{config.icon}</span>
              <div>
                <h2 className="multirace-builder-title">{config.displayName} Builder</h2>
                <p className="multirace-builder-subtitle">
                  Races {startingRace}-{startingRace + config.racesRequired - 1}
                </p>
              </div>
            </div>
            <button className="multirace-builder-close" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>

          {/* Carryover Alert */}
          {state.carryover && (
            <div
              className="multirace-carryover-alert"
              style={{
                backgroundColor: getCarryoverBadgeColor(state.carryover.valueClass).bg,
                borderColor: getCarryoverBadgeColor(state.carryover.valueClass).border,
              }}
            >
              <span className="material-icons" style={{ color: getCarryoverBadgeColor(state.carryover.valueClass).text }}>
                {state.carryover.isMandatory ? 'priority_high' : 'trending_up'}
              </span>
              <div className="multirace-carryover-info">
                <span className="multirace-carryover-amount">
                  ${formatCarryoverAmount(state.carryover.carryoverAmount)} Carryover
                </span>
                <span className="multirace-carryover-text">
                  {state.carryover.isMandatory ? 'MANDATORY PAYOUT' : state.carryover.recommendation}
                </span>
              </div>
            </div>
          )}

          {/* Strategy Selector */}
          <div className="multirace-strategy-section">
            <label className="multirace-section-label">Strategy</label>
            <div className="multirace-strategy-buttons">
              {STRATEGY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`multirace-strategy-btn ${state.strategy === opt.value ? 'active' : ''}`}
                  onClick={() => handleStrategyChange(opt.value)}
                >
                  <span className="material-icons">{opt.icon}</span>
                  <span className="multirace-strategy-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Race Tabs */}
          <div className="multirace-race-tabs">
            {state.selections.map((sel, idx) => {
              const race = multiRaceData[idx]
              const strengthColor = RACE_STRENGTH_COLORS[race?.strength || 'weak']
              const hasSelections = sel.selections.length > 0

              return (
                <button
                  key={idx}
                  className={`multirace-race-tab ${currentLeg === idx ? 'active' : ''} ${hasSelections ? 'has-selections' : ''}`}
                  onClick={() => setCurrentLeg(idx)}
                >
                  <span className="multirace-race-tab-number">R{sel.raceNumber}</span>
                  <span
                    className="multirace-race-tab-strength"
                    style={{ backgroundColor: strengthColor.bg, color: strengthColor.text }}
                  >
                    <span className="material-icons" style={{ fontSize: 12 }}>{strengthColor.icon}</span>
                  </span>
                  {hasSelections && (
                    <span className="multirace-race-tab-count">{sel.selections.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Current Race Content */}
          <div className="multirace-race-content">
            {currentRace && currentSelection && (
              <>
                {/* Race Header */}
                <div className="multirace-race-header">
                  <div className="multirace-race-info">
                    <span className="multirace-race-title">Race {currentSelection.raceNumber}</span>
                    <span
                      className="multirace-race-strength-badge"
                      style={{
                        backgroundColor: RACE_STRENGTH_COLORS[currentRace.strength].bg,
                        color: RACE_STRENGTH_COLORS[currentRace.strength].text,
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 14 }}>
                        {RACE_STRENGTH_COLORS[currentRace.strength].icon}
                      </span>
                      {currentRace.strength.charAt(0).toUpperCase() + currentRace.strength.slice(1)}
                    </span>
                  </div>
                  <button
                    className="multirace-all-btn"
                    onClick={() => handleToggleAll(currentSelection.legNumber)}
                  >
                    <span className="material-icons">
                      {currentSelection.isAllSelected ? 'check_box' : 'select_all'}
                    </span>
                    {currentSelection.isAllSelected ? 'Clear All' : 'Use All'}
                  </button>
                </div>

                {/* Suggestion */}
                {currentSuggestion && (
                  <div className="multirace-suggestion">
                    <span className="material-icons">{currentSuggestion.icon}</span>
                    <span className="multirace-suggestion-text">{currentSuggestion.reason}</span>
                    <button
                      className="multirace-suggestion-apply"
                      onClick={() => handleApplySuggestion(currentSuggestion)}
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Horse Selection Grid */}
                <div className="multirace-horses-grid">
                  {currentRace.horses.map(horse => {
                    const isSelected = currentSelection.selections.includes(horse.programNumber)
                    const tierColor = TIER_COLORS[horse.tier]

                    return (
                      <button
                        key={horse.programNumber}
                        className={`multirace-horse-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleHorseToggle(currentSelection.legNumber, horse.programNumber)}
                        style={{
                          borderColor: isSelected ? tierColor.border : undefined,
                          backgroundColor: isSelected ? tierColor.bg : undefined,
                        }}
                      >
                        <div className="multirace-horse-header">
                          <span className="multirace-horse-number">#{horse.programNumber}</span>
                          <span className="multirace-horse-score">{horse.score}pts</span>
                        </div>
                        <div className="multirace-horse-name">{horse.horseName}</div>
                        <div className="multirace-horse-footer">
                          <span className="multirace-horse-odds">{horse.morningLineOdds}</span>
                          <span
                            className="multirace-horse-tier"
                            style={{ color: tierColor.text }}
                          >
                            T{horse.tier}
                          </span>
                        </div>
                        {horse.isSingleCandidate && (
                          <span className="multirace-horse-single-badge">
                            <span className="material-icons" style={{ fontSize: 12 }}>verified</span>
                            Single
                          </span>
                        )}
                        {isSelected && (
                          <span className="material-icons multirace-horse-check">check_circle</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="multirace-quick-actions">
            <button className="multirace-quick-btn" onClick={handleApplyAllSuggestions}>
              <span className="material-icons">auto_fix_high</span>
              Apply Suggestions
            </button>
            <button className="multirace-quick-btn" onClick={handleAutoOptimize}>
              <span className="material-icons">tune</span>
              Auto-Optimize
            </button>
          </div>

          {/* Base Bet Selector */}
          <div className="multirace-basebet-section">
            <label className="multirace-section-label">Base Bet</label>
            <div className="multirace-basebet-buttons">
              {config.baseBetOptions.map(amount => (
                <button
                  key={amount}
                  className={`multirace-basebet-btn ${state.baseBet === amount ? 'active' : ''}`}
                  onClick={() => handleBaseBetChange(amount)}
                >
                  ${amount < 1 ? amount.toFixed(2) : amount}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Preview */}
          {state.liveCost && state.liveCost.isValid && (
            <div className="multirace-preview-section">
              <div className="multirace-preview-header">
                <span className="material-icons">receipt</span>
                <span>Ticket Preview</span>
              </div>
              <div className="multirace-preview-summary">
                <span className="multirace-preview-spread">{state.liveCost.spreadNotation}</span>
                <span className="multirace-preview-combos">{state.liveCost.combinations} combos</span>
              </div>
              <div className="multirace-preview-stats">
                <div className="multirace-preview-stat">
                  <span className="multirace-preview-label">Cost</span>
                  <span className="multirace-preview-value cost">
                    {formatCurrency(state.liveCost.total)}
                  </span>
                </div>
                <div className="multirace-preview-stat">
                  <span className="multirace-preview-label">Hit %</span>
                  <span
                    className="multirace-preview-value"
                    style={{ color: getProbabilityColor(probability) }}
                  >
                    {formatProbability(probability)}
                  </span>
                </div>
                <div className="multirace-preview-stat">
                  <span className="multirace-preview-label">Payout</span>
                  <span className="multirace-preview-value">
                    ${payoutRange.min}-${payoutRange.max}
                  </span>
                </div>
                <div className="multirace-preview-stat">
                  <span className="multirace-preview-label">EV</span>
                  <span
                    className="multirace-preview-value"
                    style={{ color: getEVColor(expectedValue) }}
                  >
                    {formatEV(expectedValue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div className="multirace-errors">
              {validation.errors.map((error, idx) => (
                <div key={idx} className="multirace-error">
                  <span className="material-icons">error_outline</span>
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="multirace-warnings">
              {validation.warnings.map((warning, idx) => (
                <div key={idx} className="multirace-warning">
                  <span className="material-icons">warning</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="multirace-builder-footer">
            <button className="multirace-builder-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="multirace-builder-btn primary"
              onClick={handleAddToBetSlip}
              disabled={!validation.isValid}
            >
              <span className="material-icons">add_shopping_cart</span>
              Add to Bet Slip
              {state.liveCost?.isValid && (
                <span className="multirace-builder-cost">
                  {formatCurrency(state.liveCost.total)}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default MultiRaceBuilderModal
