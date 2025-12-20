import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HorseEntry, RaceHeader } from '../types/drf'
import type { HorseScore, ScoredHorse } from '../lib/scoring'
import type { BettingTier } from '../lib/betting'
import {
  formatOverlayPercent,
  formatEV,
  getOverlayColor,
} from '../lib/scoring'
import {
  generateRecommendations,
  formatCurrency,
  isKellyEnabled,
  calculateBetWithKelly,
  type GeneratedBet,
  type BetGeneratorResult,
  type KellyBetSizingResult,
} from '../lib/recommendations'
import { loadKellySettings, getKellyFractionLabel } from '../lib/betting/kellySettings'
import type { UseBankrollReturn } from '../hooks/useBankroll'
import { BankrollSummaryCard } from './BankrollSummaryCard'

interface BettingRecommendationsProps {
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
  raceNumber: number
  raceHeader?: RaceHeader
  bankroll: UseBankrollReturn
  onOpenBankrollSettings: () => void
}

// Extended bet with selection state and overlay data
interface SelectableBet extends GeneratedBet {
  isSelected: boolean
  customAmount: number
  kellyInfo?: {
    kellyAmount: number
    kellyFraction: string
    edge: string
    shouldBet: boolean
    warnings: string[]
  }
}

// Tier badge colors
const TIER_COLORS: Record<BettingTier, { bg: string; border: string; text: string }> = {
  tier1: { bg: 'rgba(25, 171, 181, 0.2)', border: 'rgba(25, 171, 181, 0.5)', text: '#19abb5' },
  tier2: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' },
  tier3: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#f59e0b' },
}

const TIER_ICONS: Record<BettingTier, string> = {
  tier1: 'workspace_premium',
  tier2: 'trending_up',
  tier3: 'bolt',
}

// Preset types
type PresetType = 'allTier1' | 'conservative' | 'valueHunter' | 'positiveEV' | 'maxCoverage' | 'clearAll'

interface PresetConfig {
  id: PresetType
  label: string
  icon: string
  description: string
}

const PRESETS: PresetConfig[] = [
  { id: 'allTier1', label: 'All Tier 1', icon: 'workspace_premium', description: 'Select all top tier bets' },
  { id: 'positiveEV', label: '+EV Only', icon: 'trending_up', description: 'Positive expected value only' },
  { id: 'valueHunter', label: 'Overlays', icon: 'local_fire_department', description: '25%+ overlay bets' },
  { id: 'conservative', label: 'Safe', icon: 'shield', description: 'Low risk selections' },
  { id: 'maxCoverage', label: 'All', icon: 'grid_view', description: 'Maximum bet coverage' },
  { id: 'clearAll', label: 'Clear', icon: 'clear_all', description: 'Deselect all bets' },
]

// Bet Slip Modal Component
interface BetSlipModalProps {
  isOpen: boolean
  onClose: () => void
  selectedBets: SelectableBet[]
  raceNumber: number
  totalCost: number
  potentialReturn: { min: number; max: number }
  onCopyAll: () => void
  onCopySingle: (instruction: string) => void
}

function BetSlipModal({
  isOpen,
  onClose,
  selectedBets,
  raceNumber,
  totalCost,
  potentialReturn,
  onCopyAll,
  onCopySingle,
}: BetSlipModalProps) {
  if (!isOpen) return null

  return (
    <>
      <motion.div
        className="bet-slip-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="bet-slip-modal-container"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="bet-slip-modal">
          {/* Header */}
          <div className="bet-slip-modal-header">
            <div className="bet-slip-modal-title-group">
              <span className="material-icons bet-slip-modal-icon">receipt_long</span>
              <div>
                <h2 className="bet-slip-modal-title">Bet Slip</h2>
                <p className="bet-slip-modal-subtitle">Race {raceNumber} - {selectedBets.length} bets selected</p>
              </div>
            </div>
            <button className="bet-slip-modal-close" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="bet-slip-modal-content">
            {selectedBets.length === 0 ? (
              <div className="bet-slip-empty">
                <span className="material-icons">inbox</span>
                <p>No bets selected</p>
                <span className="bet-slip-empty-hint">Select bets from the list to add them here</span>
              </div>
            ) : (
              <div className="bet-slip-list">
                {selectedBets.map((bet) => {
                  const windowInstruction = bet.windowInstruction
                    .replace(/^"/, `"Race ${raceNumber}, `)
                    .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)

                  return (
                    <div key={bet.id} className="bet-slip-item">
                      <div className="bet-slip-item-header">
                        <div className="bet-slip-item-type">
                          <span
                            className="bet-slip-tier-dot"
                            style={{ backgroundColor: TIER_COLORS[bet.tier].text }}
                          />
                          <span className="bet-slip-item-name">{bet.typeName}</span>
                        </div>
                        <span className="bet-slip-item-amount">
                          {formatCurrency(bet.customAmount)}
                        </span>
                      </div>
                      <p className="bet-slip-item-horses">
                        {bet.horseNumbers.map(n => `#${n}`).join(', ')}
                      </p>
                      <div className="bet-slip-item-instruction">
                        <p className="bet-slip-instruction-text">
                          {windowInstruction.replace(/^"|"$/g, '')}
                        </p>
                        <button
                          className="bet-slip-copy-single"
                          onClick={() => onCopySingle(windowInstruction.replace(/^"|"$/g, ''))}
                          title="Copy to clipboard"
                        >
                          <span className="material-icons">content_copy</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bet-slip-modal-footer">
            <div className="bet-slip-modal-totals">
              <div className="bet-slip-total-row">
                <span>Total Cost</span>
                <span className="bet-slip-total-value">{formatCurrency(totalCost)}</span>
              </div>
              <div className="bet-slip-total-row potential">
                <span>Potential Return</span>
                <span className="bet-slip-total-value">
                  {formatCurrency(potentialReturn.min)} - {formatCurrency(potentialReturn.max)}
                </span>
              </div>
            </div>
            <div className="bet-slip-modal-actions">
              <button className="bet-slip-btn-secondary" onClick={onClose}>
                Close
              </button>
              <button
                className="bet-slip-btn-primary"
                onClick={onCopyAll}
                disabled={selectedBets.length === 0}
              >
                <span className="material-icons">content_copy</span>
                Copy All
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// Interactive Bet Card Component
interface InteractiveBetCardProps {
  bet: SelectableBet
  tierColor: { bg: string; border: string; text: string }
  raceNumber: number
  onToggleSelect: (id: string) => void
  onAmountChange: (id: string, amount: number) => void
  remainingBudget: number
  kellyEnabled?: boolean
}

function InteractiveBetCard({
  bet,
  tierColor,
  raceNumber,
  onToggleSelect,
  onAmountChange,
  remainingBudget,
  kellyEnabled = false,
}: InteractiveBetCardProps) {
  const [showInstruction, setShowInstruction] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(bet.customAmount.toString())

  // Generate window instruction with race number
  const windowInstruction = bet.windowInstruction
    .replace(/^"/, `"Race ${raceNumber}, `)
    .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)

  const handleAmountBlur = () => {
    setIsEditing(false)
    const newAmount = parseFloat(inputValue)
    if (!isNaN(newAmount) && newAmount > 0) {
      onAmountChange(bet.id, Math.round(newAmount))
    } else {
      setInputValue(bet.customAmount.toString())
    }
  }

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAmountBlur()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setInputValue(bet.customAmount.toString())
    }
  }

  useEffect(() => {
    setInputValue(bet.customAmount.toString())
  }, [bet.customAmount])

  const isOverBudget = bet.isSelected && bet.customAmount > remainingBudget + bet.customAmount

  return (
    <div className={`interactive-bet-card ${bet.isSelected ? 'selected' : ''} ${isOverBudget ? 'over-budget' : ''}`}>
      {/* Checkbox and Main Info */}
      <div className="bet-card-main">
        <button
          className={`bet-card-checkbox ${bet.isSelected ? 'checked' : ''}`}
          onClick={() => onToggleSelect(bet.id)}
          aria-label={bet.isSelected ? 'Deselect bet' : 'Select bet'}
        >
          {bet.isSelected && <span className="material-icons">check</span>}
        </button>

        <div className="bet-card-info">
          <div className="bet-card-header">
            <div className="bet-type-badge">
              <span className="material-icons bet-type-icon" style={{ color: tierColor.text }}>
                {bet.icon}
              </span>
              <span className="bet-type-name">{bet.typeName}</span>
            </div>
            <div className="bet-confidence-badge">
              <span className="material-icons">speed</span>
              <span>{bet.confidence}%</span>
            </div>
          </div>

          <p className="bet-description">{bet.description}</p>

          <div className="bet-horses">
            {bet.horseNumbers.map((num, idx) => (
              <span key={idx} className="bet-horse-number">
                #{num}
              </span>
            ))}
          </div>

          {/* Overlay info badge */}
          {bet.overlayPercent > 0 && (
            <div className="bet-overlay-info">
              <span
                className="bet-overlay-badge"
                style={{
                  color: getOverlayColor(bet.overlayPercent),
                  backgroundColor: `${getOverlayColor(bet.overlayPercent)}15`,
                }}
              >
                {formatOverlayPercent(bet.overlayPercent)}
              </span>
              <span
                className="bet-ev-badge"
                style={{
                  color: bet.evPerDollar > 0 ? '#22c55e' : '#9ca3af',
                }}
              >
                EV: {formatEV(bet.evPerDollar)}
              </span>
            </div>
          )}

          {/* Special category badge */}
          {bet.specialCategory && (
            <div className="bet-special-badge">
              <span className="material-icons" style={{ fontSize: 14 }}>
                {bet.specialCategory === 'nuclear' ? 'local_fire_department' :
                 bet.specialCategory === 'diamond' ? 'diamond' : 'trending_up'}
              </span>
              <span>
                {bet.specialCategory === 'nuclear' ? 'Nuclear Longshot' :
                 bet.specialCategory === 'diamond' ? 'Hidden Gem' : 'Value Bomb'}
              </span>
            </div>
          )}

          {/* Kelly Criterion info (Advanced mode only) */}
          {kellyEnabled && bet.kellyInfo && (
            <div className="bet-kelly-info">
              <div className="bet-kelly-badge">
                <span className="material-icons" style={{ fontSize: 14 }}>functions</span>
                <span className="bet-kelly-label">{bet.kellyInfo.kellyFraction}</span>
                {bet.kellyInfo.shouldBet ? (
                  <span className="bet-kelly-amount">${bet.kellyInfo.kellyAmount}</span>
                ) : (
                  <span className="bet-kelly-pass">Pass</span>
                )}
              </div>
              {bet.kellyInfo.edge && (
                <span className="bet-kelly-edge" style={{
                  color: bet.kellyInfo.edge.startsWith('+') ? '#22c55e' : '#ef4444'
                }}>
                  Edge: {bet.kellyInfo.edge}
                </span>
              )}
              {bet.kellyInfo.warnings.length > 0 && !bet.kellyInfo.shouldBet && (
                <span className="bet-kelly-warning">
                  <span className="material-icons" style={{ fontSize: 12 }}>warning</span>
                  {bet.kellyInfo.warnings[0]}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="bet-card-amount-section">
          {isEditing ? (
            <div className="bet-amount-input-wrapper">
              <span className="bet-amount-prefix">$</span>
              <input
                type="number"
                className="bet-amount-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleAmountBlur}
                onKeyDown={handleAmountKeyDown}
                autoFocus
                min="1"
              />
            </div>
          ) : (
            <button
              className="bet-amount-display"
              onClick={() => setIsEditing(true)}
              style={{ borderColor: bet.isSelected ? tierColor.text : undefined }}
            >
              <span className="bet-amount-value">{formatCurrency(bet.customAmount)}</span>
              <span className="material-icons bet-amount-edit">edit</span>
            </button>
          )}
          <div className="bet-potential-return">
            <span className="material-icons">trending_up</span>
            <span>
              {formatCurrency(bet.potentialReturn.min)}-{formatCurrency(bet.potentialReturn.max)}
            </span>
          </div>
        </div>
      </div>

      {/* Window Instruction Toggle */}
      <button
        className="window-instruction-toggle"
        onClick={() => setShowInstruction(!showInstruction)}
      >
        <span className="material-icons">record_voice_over</span>
        <span>Window Instructions</span>
        <span className={`material-icons chevron ${showInstruction ? 'open' : ''}`}>
          chevron_right
        </span>
      </button>

      {showInstruction && (
        <div className="window-instruction-box">
          <p className="window-instruction-text">{windowInstruction}</p>
          <button
            className="copy-instruction-btn"
            onClick={() => navigator.clipboard.writeText(windowInstruction.replace(/^"|"$/g, ''))}
            title="Copy to clipboard"
          >
            <span className="material-icons">content_copy</span>
          </button>
        </div>
      )}
    </div>
  )
}

// Quick Preset Buttons Component
interface QuickPresetButtonsProps {
  onPresetClick: (preset: PresetType) => void
  isMobile: boolean
}

function QuickPresetButtons({ onPresetClick, isMobile }: QuickPresetButtonsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  if (isMobile) {
    return (
      <div className="preset-dropdown-container">
        <button
          className="preset-dropdown-trigger"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span className="material-icons">tune</span>
          <span>Quick Select</span>
          <span className={`material-icons ${isDropdownOpen ? 'rotated' : ''}`}>
            expand_more
          </span>
        </button>
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              className="preset-dropdown-menu"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-dropdown-item"
                  onClick={() => {
                    onPresetClick(preset.id)
                    setIsDropdownOpen(false)
                  }}
                >
                  <span className="material-icons">{preset.icon}</span>
                  <div className="preset-dropdown-item-content">
                    <span className="preset-dropdown-item-label">{preset.label}</span>
                    <span className="preset-dropdown-item-desc">{preset.description}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="preset-buttons-bar">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          className={`preset-button ${preset.id === 'clearAll' ? 'clear' : ''}`}
          onClick={() => onPresetClick(preset.id)}
          title={preset.description}
        >
          <span className="material-icons">{preset.icon}</span>
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  )
}

// Sticky Footer Component
interface StickyFooterProps {
  selectedCount: number
  totalCost: number
  remainingBudget: number
  dailyBudget: number
  potentialReturn: { min: number; max: number }
  onViewBetSlip: () => void
  onCopyToClipboard: () => void
  isOverBudget: boolean
}

function StickyFooter({
  selectedCount,
  totalCost,
  remainingBudget,
  dailyBudget,
  potentialReturn,
  onViewBetSlip,
  onCopyToClipboard,
  isOverBudget,
}: StickyFooterProps) {
  const budgetPercentUsed = Math.min(100, (totalCost / dailyBudget) * 100)

  return (
    <div className="betting-sticky-footer">
      <div className="sticky-footer-content">
        {/* Stats Row */}
        <div className="sticky-footer-stats">
          <div className="sticky-stat">
            <span className="sticky-stat-label">Selected</span>
            <span className="sticky-stat-value">{selectedCount} bets</span>
          </div>
          <div className="sticky-stat-divider" />
          <div className="sticky-stat">
            <span className="sticky-stat-label">Total Cost</span>
            <span className={`sticky-stat-value ${isOverBudget ? 'over-budget' : ''}`}>
              {formatCurrency(totalCost)}
            </span>
          </div>
          <div className="sticky-stat-divider" />
          <div className="sticky-stat">
            <span className="sticky-stat-label">Remaining</span>
            <span className={`sticky-stat-value ${isOverBudget ? 'over-budget' : remainingBudget < dailyBudget * 0.2 ? 'warning' : ''}`}>
              {formatCurrency(Math.max(0, remainingBudget))}
            </span>
          </div>
          <div className="sticky-stat-divider hide-mobile" />
          <div className="sticky-stat hide-mobile">
            <span className="sticky-stat-label">Potential</span>
            <span className="sticky-stat-value potential">
              {formatCurrency(potentialReturn.min)}-{formatCurrency(potentialReturn.max)}
            </span>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="sticky-footer-progress">
          <div className="sticky-progress-bar">
            <div
              className={`sticky-progress-fill ${isOverBudget ? 'over-budget' : budgetPercentUsed > 80 ? 'warning' : ''}`}
              style={{ width: `${Math.min(100, budgetPercentUsed)}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky-footer-actions">
          <button
            className="sticky-action-btn secondary"
            onClick={onCopyToClipboard}
            disabled={selectedCount === 0}
          >
            <span className="material-icons">content_copy</span>
            <span className="btn-text">Copy</span>
          </button>
          <button
            className="sticky-action-btn primary"
            onClick={onViewBetSlip}
            disabled={selectedCount === 0}
          >
            <span className="material-icons">receipt_long</span>
            <span className="btn-text">View Bet Slip</span>
            {selectedCount > 0 && <span className="sticky-badge">{selectedCount}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main Component
export function BettingRecommendations({
  horses,
  raceNumber,
  raceHeader,
  bankroll,
  onOpenBankrollSettings,
}: BettingRecommendationsProps) {
  const [selectableBets, setSelectableBets] = useState<SelectableBet[]>([])
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null)

  // Check if Kelly Criterion is enabled
  const kellyEnabled = useMemo(() => isKellyEnabled(bankroll), [bankroll])
  const kellySettings = useMemo(() => loadKellySettings(), [])

  // Convert horses to ScoredHorse format for generator
  const scoredHorses: ScoredHorse[] = useMemo(() => {
    return horses.map((h, idx) => ({
      horse: h.horse,
      index: h.index,
      score: h.score,
      rank: idx + 1,
    }))
  }, [horses])

  // Create default race header if not provided
  const effectiveRaceHeader: RaceHeader = useMemo(() => {
    if (raceHeader) return raceHeader
    // Create a minimal header from available data
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]
    return {
      trackCode: 'UNK',
      trackName: 'Unknown Track',
      trackLocation: '',
      raceNumber,
      raceDate: dateStr,
      raceDateRaw: dateStr.replace(/-/g, ''),
      postTime: '',
      distanceFurlongs: 6,
      distance: '6 furlongs',
      distanceExact: '6f',
      surface: 'dirt',
      trackCondition: 'fast',
      classification: 'claiming',
      raceType: 'Claiming',
      purse: 0,
      purseFormatted: '$0',
      ageRestriction: '3&UP',
      sexRestriction: '',
      weightConditions: '',
      stateBred: null,
      claimingPriceMin: null,
      claimingPriceMax: null,
      allowedWeight: null,
      conditions: '',
      raceName: null,
      grade: null,
      isListed: false,
      isAbout: false,
      tempRail: null,
      turfCourseType: null,
      chuteStart: false,
      hasReplay: false,
      programNumber: raceNumber,
      fieldSize: horses.length,
      probableFavorite: null,
    }
  }, [raceHeader, raceNumber, horses.length])

  // Generate recommendations using new integrated system
  const generatorResult: BetGeneratorResult = useMemo(() => {
    return generateRecommendations({
      scoredHorses,
      raceHeader: effectiveRaceHeader,
      raceNumber,
      bankroll,
    })
  }, [scoredHorses, effectiveRaceHeader, raceNumber, bankroll])

  // Extract tier recommendations for backward compatibility
  const recommendations = generatorResult.tierBets

  // Initialize selectable bets when generator result changes
  useEffect(() => {
    const newSelectableBets: SelectableBet[] = generatorResult.allBets.map(bet => {
      // Calculate Kelly info if enabled
      let kellyInfo: SelectableBet['kellyInfo'] = undefined

      if (kellyEnabled && bet.horses && bet.horses.length > 0) {
        const topHorse = bet.horses[0]
        // Get odds from horse's morning line
        const oddsString = topHorse?.horse?.morningLineOdds || topHorse?.oddsDisplay || '5-1'

        const kellyResult = calculateBetWithKelly(
          bet.confidence,
          oddsString,
          bet.tier,
          bankroll,
          horses.length
        )

        if (kellyResult.kellyResult) {
          kellyInfo = {
            kellyAmount: kellyResult.kellyAmount,
            kellyFraction: kellyResult.display.kellyFraction,
            edge: kellyResult.display.edge,
            shouldBet: kellyResult.display.shouldBet,
            warnings: kellyResult.display.warnings,
          }
        }
      }

      return {
        ...bet,
        isSelected: bet.isRecommended, // Pre-select recommended bets
        customAmount: bet.totalCost,
        kellyInfo,
      }
    })
    setSelectableBets(newSelectableBets)
  }, [generatorResult, kellyEnabled, bankroll, horses.length])

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Calculate totals
  const selectedBets = useMemo(
    () => selectableBets.filter((bet) => bet.isSelected),
    [selectableBets]
  )

  const totalCost = useMemo(
    () => selectedBets.reduce((sum, bet) => sum + bet.customAmount, 0),
    [selectedBets]
  )

  const potentialReturn = useMemo(() => {
    const min = selectedBets.reduce((sum, bet) => sum + bet.potentialReturn.min, 0)
    const max = selectedBets.reduce((sum, bet) => sum + bet.potentialReturn.max, 0)
    return { min, max }
  }, [selectedBets])

  const dailyBudget = bankroll.getDailyBudget()
  const spentToday = bankroll.getSpentToday()
  const remainingBudget = dailyBudget - spentToday - totalCost
  const isOverBudget = remainingBudget < 0

  // Handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectableBets((prev) =>
      prev.map((bet) => (bet.id === id ? { ...bet, isSelected: !bet.isSelected } : bet))
    )
  }, [])

  const handleAmountChange = useCallback((id: string, amount: number) => {
    setSelectableBets((prev) =>
      prev.map((bet) =>
        bet.id === id
          ? {
              ...bet,
              customAmount: amount,
              potentialReturn: {
                min: Math.round((bet.potentialReturn.min / bet.totalCost) * amount),
                max: Math.round((bet.potentialReturn.max / bet.totalCost) * amount),
              },
            }
          : bet
      )
    )
  }, [])

  const handlePresetClick = useCallback(
    (preset: PresetType) => {
      setSelectableBets((prev) => {
        switch (preset) {
          case 'allTier1':
            return prev.map((bet) => ({ ...bet, isSelected: bet.tier === 'tier1' }))
          case 'positiveEV':
            // Select only bets with positive expected value
            return prev.map((bet) => ({
              ...bet,
              isSelected: bet.evPerDollar > 0,
            }))
          case 'valueHunter':
            // Select bets with 25%+ overlay
            return prev.map((bet) => ({
              ...bet,
              isSelected: bet.overlayPercent >= 25,
            }))
          case 'conservative':
            return prev.map((bet) => ({
              ...bet,
              isSelected: bet.confidence >= 70 && bet.tier !== 'tier3',
            }))
          case 'maxCoverage':
            return prev.map((bet) => ({ ...bet, isSelected: true }))
          case 'clearAll':
            return prev.map((bet) => ({ ...bet, isSelected: false }))
          default:
            return prev
        }
      })
    },
    []
  )

  const handleCopyToClipboard = useCallback(() => {
    const instructions = selectedBets
      .map((bet) => {
        const instruction = bet.windowInstruction
          .replace(/^"/, `"Race ${raceNumber}, `)
          .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)
          .replace(/^"|"$/g, '')
        return `${bet.typeName} (${formatCurrency(bet.customAmount)}): ${instruction}`
      })
      .join('\n')

    const fullText = `Bet Slip - Race ${raceNumber}\n${'='.repeat(30)}\n${instructions}\n${'='.repeat(30)}\nTotal: ${formatCurrency(totalCost)} | Potential: ${formatCurrency(potentialReturn.min)}-${formatCurrency(potentialReturn.max)}`

    navigator.clipboard.writeText(fullText)
    setCopiedMessage('Copied to clipboard!')
    setTimeout(() => setCopiedMessage(null), 2000)
  }, [selectedBets, raceNumber, totalCost, potentialReturn])

  const handleCopySingle = useCallback((instruction: string) => {
    navigator.clipboard.writeText(instruction)
    setCopiedMessage('Copied!')
    setTimeout(() => setCopiedMessage(null), 2000)
  }, [])

  // Check if we have any recommendations
  if (generatorResult.allBets.length === 0) {
    return null
  }

  // Group bets by tier for display
  const betsByTier = recommendations.map((tierRec) => ({
    ...tierRec,
    selectableBets: selectableBets.filter((bet) => bet.tier === tierRec.tier && !bet.specialCategory),
  }))

  // Get special category bets
  const specialBets = selectableBets.filter(bet => bet.specialCategory !== null)

  return (
    <div className="interactive-betting-container">
      {/* Bankroll Summary at Top */}
      <div className="betting-bankroll-section">
        <BankrollSummaryCard
          bankroll={bankroll}
          onOpenSettings={onOpenBankrollSettings}
          variant={isMobile ? 'mobile' : 'compact'}
          className="betting-bankroll-card"
        />
      </div>

      {/* Quick Preset Buttons */}
      <QuickPresetButtons onPresetClick={handlePresetClick} isMobile={isMobile} />

      {/* Special Category Bets */}
      {specialBets.length > 0 && (
        <div className="special-bets-section">
          <div className="special-bets-header">
            <span className="material-icons">auto_awesome</span>
            <span>Special Plays</span>
            <span className="special-bets-count">{specialBets.length} bets</span>
          </div>
          <div className="special-bets-list">
            {specialBets.map((bet) => (
              <InteractiveBetCard
                key={bet.id}
                bet={bet}
                tierColor={TIER_COLORS[bet.tier]}
                raceNumber={raceNumber}
                onToggleSelect={handleToggleSelect}
                onAmountChange={handleAmountChange}
                remainingBudget={remainingBudget + (bet.isSelected ? bet.customAmount : 0)}
                kellyEnabled={kellyEnabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Interactive Bet List */}
      <div className="interactive-bet-list">
        {betsByTier.map((tierGroup) => {
          if (tierGroup.selectableBets.length === 0) return null

          const tierColor = TIER_COLORS[tierGroup.tier]
          const tierIcon = TIER_ICONS[tierGroup.tier]

          return (
            <div key={tierGroup.tier} className="tier-bet-group">
              <div className="tier-bet-header">
                <div
                  className="tier-header-badge"
                  style={{
                    backgroundColor: tierColor.bg,
                    borderColor: tierColor.border,
                    color: tierColor.text,
                  }}
                >
                  <span className="material-icons">{tierIcon}</span>
                  <span>{tierGroup.tierName}</span>
                </div>
                <span className="tier-bet-count">
                  {tierGroup.selectableBets.length} bets
                </span>
              </div>

              <div className="tier-bets-list">
                {tierGroup.selectableBets.map((bet) => (
                  <InteractiveBetCard
                    key={bet.id}
                    bet={bet}
                    tierColor={tierColor}
                    raceNumber={raceNumber}
                    onToggleSelect={handleToggleSelect}
                    onAmountChange={handleAmountChange}
                    remainingBudget={remainingBudget + (bet.isSelected ? bet.customAmount : 0)}
                    kellyEnabled={kellyEnabled}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky Footer */}
      <StickyFooter
        selectedCount={selectedBets.length}
        totalCost={totalCost}
        remainingBudget={remainingBudget + totalCost}
        dailyBudget={dailyBudget}
        potentialReturn={potentialReturn}
        onViewBetSlip={() => setIsSlipModalOpen(true)}
        onCopyToClipboard={handleCopyToClipboard}
        isOverBudget={isOverBudget}
      />

      {/* Bet Slip Modal */}
      <AnimatePresence>
        {isSlipModalOpen && (
          <BetSlipModal
            isOpen={isSlipModalOpen}
            onClose={() => setIsSlipModalOpen(false)}
            selectedBets={selectedBets}
            raceNumber={raceNumber}
            totalCost={totalCost}
            potentialReturn={potentialReturn}
            onCopyAll={handleCopyToClipboard}
            onCopySingle={handleCopySingle}
          />
        )}
      </AnimatePresence>

      {/* Copy notification toast */}
      <AnimatePresence>
        {copiedMessage && (
          <motion.div
            className="copy-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span className="material-icons">check_circle</span>
            <span>{copiedMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default BettingRecommendations
