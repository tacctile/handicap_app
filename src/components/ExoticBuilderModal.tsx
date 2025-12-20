/**
 * Exotic Builder Modal
 *
 * Interactive modal for building custom exotic bets:
 * - Visual horse selector (check Tier 1/2/3 horses)
 * - Bet type selector (exacta/trifecta/superfecta)
 * - Structure selector (box/key/wheel/part-wheel)
 * - Cost preview updates live
 * - Payout estimate shows
 * - "Add to Bet Slip" button
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HorseEntry } from '../types/drf'
import type { HorseScore } from '../lib/scoring'
import {
  calculateExoticCost,
  quickPayoutEstimate,
  generateComparisonTable,
  type ExoticBetType,
  type BetStructure,
  type ExoticCost,
  BASE_BET_OPTIONS,
  MIN_HORSES,
} from '../lib/exotics'
import { formatCurrency } from '../lib/recommendations'

// ============================================================================
// TYPES
// ============================================================================

interface HorseForExotic {
  programNumber: number
  horseName: string
  odds: number
  oddsDisplay: string
  confidence: number
  tier: 1 | 2 | 3
  isSelected: boolean
  position: 'first' | 'second' | 'third' | 'fourth' | 'any' | null
}

interface ExoticBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
  raceNumber: number
  fieldSize: number
  onAddToBetSlip: (bet: ExoticBetResult) => void
}

export interface ExoticBetResult {
  betType: ExoticBetType
  structure: BetStructure
  horses: number[]
  baseBet: number
  totalCost: number
  combinations: number
  payoutRange: { min: number; max: number; likely: number }
  windowInstruction: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BET_TYPE_OPTIONS: { value: ExoticBetType; label: string; icon: string; minHorses: number }[] = [
  { value: 'exacta', label: 'Exacta', icon: 'swap_vert', minHorses: 2 },
  { value: 'trifecta', label: 'Trifecta', icon: 'view_list', minHorses: 3 },
  { value: 'superfecta', label: 'Superfecta', icon: 'format_list_numbered', minHorses: 4 },
]

const STRUCTURE_OPTIONS: Record<ExoticBetType, { value: BetStructure; label: string; description: string }[]> = {
  exacta: [
    { value: 'box', label: 'Box', description: 'Any order of selected horses' },
    { value: 'key_over', label: 'Key Over', description: 'First horse must win' },
    { value: 'key_under', label: 'Key Under', description: 'First horse must place second' },
    { value: 'straight', label: 'Straight', description: 'Exact order only' },
  ],
  trifecta: [
    { value: 'box', label: 'Box', description: 'Any order for 1-2-3' },
    { value: 'key_over', label: 'Key', description: 'Key horse must win' },
    { value: 'part_wheel', label: 'Part Wheel', description: 'Different horses per position' },
  ],
  superfecta: [
    { value: 'box', label: 'Box', description: 'Any order for 1-2-3-4' },
    { value: 'key_over', label: 'Key', description: 'Key horse must win' },
    { value: 'part_wheel', label: 'Part Wheel', description: 'Different horses per position' },
  ],
}

const TIER_COLORS = {
  1: { bg: 'rgba(25, 171, 181, 0.15)', border: '#19abb5', text: '#19abb5' },
  2: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
  3: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ExoticBuilderModal({
  isOpen,
  onClose,
  horses,
  raceNumber,
  fieldSize,
  onAddToBetSlip,
}: ExoticBuilderModalProps) {
  // State
  const [betType, setBetType] = useState<ExoticBetType>('exacta')
  const [structure, setStructure] = useState<BetStructure>('box')
  const [baseBet, setBaseBet] = useState(2)
  const [selectedHorses, setSelectedHorses] = useState<HorseForExotic[]>([])
  const [showComparison, setShowComparison] = useState(false)

  // Convert horses to ExoticBuilderModal format
  const horsesForExotic = useMemo((): HorseForExotic[] => {
    return horses.map(h => {
      // Determine tier based on score
      let tier: 1 | 2 | 3 = 3
      if (h.score.total >= 180) tier = 1
      else if (h.score.total >= 160) tier = 2

      // Parse odds
      const oddsMatch = h.horse.morningLineOdds.match(/(\d+(?:\.\d+)?)[/-](\d+(?:\.\d+)?)?/)
      const odds = oddsMatch ? parseFloat(oddsMatch[1]) / (oddsMatch[2] ? parseFloat(oddsMatch[2]) : 1) : 5

      return {
        programNumber: h.horse.programNumber,
        horseName: h.horse.horseName,
        odds,
        oddsDisplay: h.horse.morningLineOdds,
        confidence: Math.min(100, 40 + (h.score.total / 240) * 60),
        tier,
        isSelected: false,
        position: null,
      }
    }).sort((a, b) => a.tier - b.tier || a.programNumber - b.programNumber)
  }, [horses])

  // Initialize selected horses
  useEffect(() => {
    setSelectedHorses(horsesForExotic)
  }, [horsesForExotic])

  // Reset structure when bet type changes
  useEffect(() => {
    setStructure(STRUCTURE_OPTIONS[betType][0].value)
    // Reset selections
    setSelectedHorses(prev => prev.map(h => ({ ...h, isSelected: false, position: null })))
  }, [betType])

  // Calculate cost
  const costResult = useMemo((): ExoticCost | null => {
    const selected = selectedHorses.filter(h => h.isSelected)
    if (selected.length < MIN_HORSES[betType]) return null

    const firstPosition = selected.filter(h => h.position === 'first' || h.position === 'any').map(h => h.programNumber)
    const secondPosition = selected.filter(h => h.position === 'second' || h.position === 'any').map(h => h.programNumber)
    const thirdPosition = selected.filter(h => h.position === 'third' || h.position === 'any').map(h => h.programNumber)
    const fourthPosition = selected.filter(h => h.position === 'fourth' || h.position === 'any').map(h => h.programNumber)

    // For box, all horses go in all positions
    if (structure === 'box') {
      const allNums = selected.map(h => h.programNumber)
      return calculateExoticCost({
        betType,
        structure,
        baseBet,
        firstPosition: allNums,
        secondPosition: allNums,
        thirdPosition: allNums,
        fourthPosition: allNums,
        fieldSize,
      })
    }

    // For key/part-wheel, use positions
    return calculateExoticCost({
      betType,
      structure,
      baseBet,
      firstPosition: firstPosition.length > 0 ? firstPosition : selected.map(h => h.programNumber),
      secondPosition: secondPosition.length > 0 ? secondPosition : selected.map(h => h.programNumber),
      thirdPosition: thirdPosition.length > 0 ? thirdPosition : selected.map(h => h.programNumber),
      fourthPosition: fourthPosition.length > 0 ? fourthPosition : selected.map(h => h.programNumber),
      fieldSize,
    })
  }, [selectedHorses, betType, structure, baseBet, fieldSize])

  // Calculate payout estimate
  const payoutEstimate = useMemo(() => {
    const selected = selectedHorses.filter(h => h.isSelected)
    if (selected.length < 2) return null
    return quickPayoutEstimate(betType, selected.map(h => h.odds), baseBet)
  }, [selectedHorses, betType, baseBet])

  // Generate comparison table
  const comparisonTable = useMemo(() => {
    const selected = selectedHorses.filter(h => h.isSelected)
    if (selected.length < 2) return null
    return generateComparisonTable({
      budget: 50,
      horses: selected.map(h => ({
        programNumber: h.programNumber,
        horseName: h.horseName,
        odds: h.odds,
        confidence: h.confidence,
      })),
      fieldSize,
      maxOptions: 6,
    })
  }, [selectedHorses, fieldSize])

  // Handlers
  const handleHorseSelect = useCallback((programNumber: number) => {
    setSelectedHorses(prev => prev.map(h => {
      if (h.programNumber === programNumber) {
        const newSelected = !h.isSelected
        return {
          ...h,
          isSelected: newSelected,
          position: newSelected ? 'any' : null,
        }
      }
      return h
    }))
  }, [])

  const handlePositionChange = useCallback((programNumber: number, position: HorseForExotic['position']) => {
    setSelectedHorses(prev => prev.map(h => {
      if (h.programNumber === programNumber) {
        return { ...h, position }
      }
      return h
    }))
  }, [])

  const handleAddToBetSlip = useCallback(() => {
    if (!costResult || !costResult.isValid) return

    const selected = selectedHorses.filter(h => h.isSelected)
    const horseNums = selected.map(h => h.programNumber)

    // Generate window instruction
    let instruction = `Race ${raceNumber}, $${baseBet} `
    switch (structure) {
      case 'box':
        instruction += `${betType.toUpperCase()} BOX ${horseNums.join(', ')}`
        break
      case 'key_over':
        const keyHorse = selected.find(h => h.position === 'first')?.programNumber || horseNums[0]
        const others = horseNums.filter(n => n !== keyHorse)
        instruction += `${betType.toUpperCase()}, #${keyHorse} on top with ${others.join(', ')}`
        break
      case 'key_under':
        const underHorse = selected.find(h => h.position === 'second')?.programNumber || horseNums[0]
        const topHorses = horseNums.filter(n => n !== underHorse)
        instruction += `${betType.toUpperCase()}, ${topHorses.join(', ')} with #${underHorse} second`
        break
      case 'straight':
        instruction += `${betType.toUpperCase()} ${horseNums.join('-')}`
        break
      case 'part_wheel':
        instruction += `${betType.toUpperCase()} part wheel with ${horseNums.join(', ')}`
        break
      default:
        instruction += `${betType.toUpperCase()} ${horseNums.join(', ')}`
    }

    const result: ExoticBetResult = {
      betType,
      structure,
      horses: horseNums,
      baseBet,
      totalCost: costResult.total,
      combinations: costResult.combinations,
      payoutRange: payoutEstimate || { min: 0, max: 0, likely: 0 },
      windowInstruction: instruction,
    }

    onAddToBetSlip(result)
    onClose()
  }, [costResult, selectedHorses, betType, structure, baseBet, raceNumber, payoutEstimate, onAddToBetSlip, onClose])

  const selectedCount = selectedHorses.filter(h => h.isSelected).length
  const canSubmit = costResult?.isValid && selectedCount >= MIN_HORSES[betType]

  if (!isOpen) return null

  return (
    <>
      <motion.div
        className="exotic-builder-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="exotic-builder-container"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="exotic-builder-modal">
          {/* Header */}
          <div className="exotic-builder-header">
            <div className="exotic-builder-title-group">
              <span className="material-icons exotic-builder-icon">build</span>
              <div>
                <h2 className="exotic-builder-title">Build Custom Exotic</h2>
                <p className="exotic-builder-subtitle">Race {raceNumber}</p>
              </div>
            </div>
            <button className="exotic-builder-close" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="exotic-builder-content">
            {/* Bet Type Selector */}
            <div className="exotic-builder-section">
              <label className="exotic-builder-label">Bet Type</label>
              <div className="exotic-type-buttons">
                {BET_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`exotic-type-btn ${betType === opt.value ? 'active' : ''}`}
                    onClick={() => setBetType(opt.value)}
                  >
                    <span className="material-icons">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Structure Selector */}
            <div className="exotic-builder-section">
              <label className="exotic-builder-label">Structure</label>
              <div className="exotic-structure-buttons">
                {STRUCTURE_OPTIONS[betType].map(opt => (
                  <button
                    key={opt.value}
                    className={`exotic-structure-btn ${structure === opt.value ? 'active' : ''}`}
                    onClick={() => setStructure(opt.value)}
                  >
                    <span className="exotic-structure-name">{opt.label}</span>
                    <span className="exotic-structure-desc">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Base Bet Selector */}
            <div className="exotic-builder-section">
              <label className="exotic-builder-label">Base Bet Amount</label>
              <div className="exotic-bet-buttons">
                {BASE_BET_OPTIONS.map(amount => (
                  <button
                    key={amount}
                    className={`exotic-bet-btn ${baseBet === amount ? 'active' : ''}`}
                    onClick={() => setBaseBet(amount)}
                  >
                    ${amount < 1 ? amount.toFixed(2) : amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Horse Selector */}
            <div className="exotic-builder-section">
              <label className="exotic-builder-label">
                Select Horses
                <span className="exotic-builder-hint">
                  ({selectedCount} selected, min {MIN_HORSES[betType]} required)
                </span>
              </label>
              <div className="exotic-horses-grid">
                {selectedHorses.map(horse => (
                  <div
                    key={horse.programNumber}
                    className={`exotic-horse-card ${horse.isSelected ? 'selected' : ''}`}
                    onClick={() => handleHorseSelect(horse.programNumber)}
                    style={{
                      borderColor: horse.isSelected ? TIER_COLORS[horse.tier].border : undefined,
                      backgroundColor: horse.isSelected ? TIER_COLORS[horse.tier].bg : undefined,
                    }}
                  >
                    <div className="exotic-horse-header">
                      <span className="exotic-horse-number">#{horse.programNumber}</span>
                      <span
                        className="exotic-horse-tier"
                        style={{ color: TIER_COLORS[horse.tier].text }}
                      >
                        T{horse.tier}
                      </span>
                    </div>
                    <div className="exotic-horse-name">{horse.horseName}</div>
                    <div className="exotic-horse-odds">{horse.oddsDisplay}</div>
                    {horse.isSelected && structure !== 'box' && (
                      <select
                        className="exotic-horse-position"
                        value={horse.position || 'any'}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handlePositionChange(
                          horse.programNumber,
                          e.target.value as HorseForExotic['position']
                        )}
                      >
                        <option value="any">Any</option>
                        <option value="first">1st</option>
                        <option value="second">2nd</option>
                        {betType !== 'exacta' && <option value="third">3rd</option>}
                        {betType === 'superfecta' && <option value="fourth">4th</option>}
                      </select>
                    )}
                    {horse.isSelected && (
                      <span className="material-icons exotic-horse-check">check_circle</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Preview */}
            {costResult && costResult.isValid && (
              <div className="exotic-preview-section">
                <div className="exotic-preview-header">
                  <span className="material-icons">receipt</span>
                  <span>Bet Preview</span>
                </div>
                <div className="exotic-preview-stats">
                  <div className="exotic-preview-stat">
                    <span className="exotic-preview-label">Combinations</span>
                    <span className="exotic-preview-value">{costResult.combinations}</span>
                  </div>
                  <div className="exotic-preview-stat">
                    <span className="exotic-preview-label">Total Cost</span>
                    <span className="exotic-preview-value cost">{formatCurrency(costResult.total)}</span>
                  </div>
                  {payoutEstimate && (
                    <div className="exotic-preview-stat wide">
                      <span className="exotic-preview-label">Est. Payout Range</span>
                      <span className="exotic-preview-value payout">{payoutEstimate.display}</span>
                    </div>
                  )}
                </div>
                <div className="exotic-preview-breakdown">
                  {costResult.breakdown}
                </div>
              </div>
            )}

            {/* Comparison Toggle */}
            {comparisonTable && comparisonTable.isValid && (
              <div className="exotic-comparison-section">
                <button
                  className="exotic-comparison-toggle"
                  onClick={() => setShowComparison(!showComparison)}
                >
                  <span className="material-icons">compare</span>
                  <span>Compare Structures</span>
                  <span className={`material-icons chevron ${showComparison ? 'open' : ''}`}>
                    chevron_right
                  </span>
                </button>
                <AnimatePresence>
                  {showComparison && (
                    <motion.div
                      className="exotic-comparison-table"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Cost</th>
                            <th>Combos</th>
                            <th>Payout</th>
                            <th>EV</th>
                            <th>Hit%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonTable.rows.slice(0, 5).map(row => (
                            <tr
                              key={row.id}
                              className={row.isRecommended ? 'recommended' : ''}
                            >
                              <td>{row.type} {row.displayName}</td>
                              <td>{formatCurrency(row.cost.total)}</td>
                              <td>{row.combinations}</td>
                              <td>${row.payoutRange.min}-${row.payoutRange.max}</td>
                              <td className={row.expectedValue >= 0 ? 'positive' : 'negative'}>
                                {row.evDisplay}
                              </td>
                              <td>{row.hitDisplay}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Error Message */}
            {costResult && !costResult.isValid && (
              <div className="exotic-error-message">
                <span className="material-icons">warning</span>
                <span>{costResult.error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="exotic-builder-footer">
            <button className="exotic-builder-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="exotic-builder-btn primary"
              onClick={handleAddToBetSlip}
              disabled={!canSubmit}
            >
              <span className="material-icons">add_shopping_cart</span>
              Add to Bet Slip
              {costResult?.isValid && (
                <span className="exotic-builder-cost">{formatCurrency(costResult.total)}</span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

export default ExoticBuilderModal
