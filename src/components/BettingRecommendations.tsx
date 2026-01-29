import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HorseEntry, RaceHeader } from '../types/drf';
import type { HorseScore, ScoredHorse } from '../lib/scoring';
import type { BettingTier } from '../lib/betting';
import { useAnalytics } from '../hooks/useAnalytics';
import { formatOverlayPercent, formatEV, getOverlayColor } from '../lib/scoring';
import {
  generateRecommendations,
  formatCurrency,
  isKellyEnabled,
  calculateBetWithKelly,
  type GeneratedBet,
  type BetGeneratorResult,
} from '../lib/recommendations';
import {
  optimizeExoticBet,
  generateComparisonTable,
  type ExoticBetType,
  type OptimizationResult,
  type HorseTier,
} from '../lib/exotics';
import {
  calculateDutchBook,
  findOptimalDutchCombinations,
  convertToDutchCandidates,
  formatCurrency as formatDutchCurrency,
  loadDutchSettings,
  EDGE_COLORS,
  EDGE_ICONS,
  type DutchCombination,
  type DutchResult,
  type DutchCandidateHorse,
  type DutchSettings,
} from '../lib/dutch';
import type { UseBankrollReturn } from '../hooks/useBankroll';
import { BankrollSummaryCard } from './BankrollSummaryCard';
import { ExoticBuilderModal, type ExoticBetResult } from './ExoticBuilderModal';
import { MultiRaceExoticsPanel } from './MultiRaceExoticsPanel';
import type { MultiRaceTicketResult } from './MultiRaceBuilderModal';

interface BettingRecommendationsProps {
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>;
  raceNumber: number;
  raceHeader?: RaceHeader;
  bankroll: UseBankrollReturn;
  onOpenBankrollSettings: () => void;
  /** All races in the card for multi-race betting */
  allRaces?: Array<{
    raceNumber: number;
    horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>;
    postTime?: string;
  }>;
  /** Track code for carryover lookups */
  trackCode?: string;
}

// Extended bet with selection state and overlay data
interface SelectableBet extends GeneratedBet {
  isSelected: boolean;
  customAmount: number;
  kellyInfo?: {
    kellyAmount: number;
    kellyFraction: string;
    edge: string;
    shouldBet: boolean;
    warnings: string[];
  };
}

// Tier badge colors
const TIER_COLORS: Record<BettingTier, { bg: string; border: string; text: string }> = {
  tier1: { bg: 'rgba(25, 171, 181, 0.2)', border: 'rgba(25, 171, 181, 0.5)', text: '#19abb5' },
  tier2: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' },
  tier3: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#f59e0b' },
};

const TIER_ICONS: Record<BettingTier, string> = {
  tier1: 'workspace_premium',
  tier2: 'trending_up',
  tier3: 'bolt',
};

// Preset types
type PresetType =
  | 'allTier1'
  | 'conservative'
  | 'valueHunter'
  | 'positiveEV'
  | 'maxCoverage'
  | 'clearAll';

interface PresetConfig {
  id: PresetType;
  label: string;
  icon: string;
  description: string;
}

const PRESETS: PresetConfig[] = [
  {
    id: 'valueHunter',
    label: 'Value Hunter',
    icon: 'local_fire_department',
    description: 'Best value bets (sorted by EV%)',
  },
  {
    id: 'positiveEV',
    label: '+EV Only',
    icon: 'trending_up',
    description: 'All positive expected value bets',
  },
  {
    id: 'allTier1',
    label: 'All Tier 1',
    icon: 'workspace_premium',
    description: 'Select all top tier bets',
  },
  { id: 'conservative', label: 'Safe', icon: 'shield', description: 'High confidence, low risk' },
  { id: 'maxCoverage', label: 'All', icon: 'grid_view', description: 'Maximum bet coverage' },
  { id: 'clearAll', label: 'Clear', icon: 'clear_all', description: 'Deselect all bets' },
];

// Bet Slip Modal Component
interface BetSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBets: SelectableBet[];
  raceNumber: number;
  totalCost: number;
  potentialReturn: { min: number; max: number };
  onCopyAll: () => void;
  onCopySingle: (instruction: string) => void;
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
  if (!isOpen) return null;

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
                <p className="bet-slip-modal-subtitle">
                  Race {raceNumber} - {selectedBets.length} bets selected
                </p>
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
                <span className="bet-slip-empty-hint">
                  Select bets from the list to add them here
                </span>
              </div>
            ) : (
              <div className="bet-slip-list">
                {selectedBets.map((bet) => {
                  const windowInstruction = bet.windowInstruction
                    .replace(/^"/, `"Race ${raceNumber}, `)
                    .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`);

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
                        {bet.horseNumbers.map((n) => `#${n}`).join(', ')}
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
                  );
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
  );
}

// Interactive Bet Card Component
interface InteractiveBetCardProps {
  bet: SelectableBet;
  tierColor: { bg: string; border: string; text: string };
  raceNumber: number;
  onToggleSelect: (id: string) => void;
  onAmountChange: (id: string, amount: number) => void;
  remainingBudget: number;
  kellyEnabled?: boolean;
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
  const [showInstruction, setShowInstruction] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(bet.customAmount.toString());

  // Generate window instruction with race number
  const windowInstruction = bet.windowInstruction
    .replace(/^"/, `"Race ${raceNumber}, `)
    .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`);

  const handleAmountBlur = () => {
    setIsEditing(false);
    const newAmount = parseFloat(inputValue);
    if (!isNaN(newAmount) && newAmount > 0) {
      onAmountChange(bet.id, Math.round(newAmount));
    } else {
      setInputValue(bet.customAmount.toString());
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAmountBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(bet.customAmount.toString());
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state
    setInputValue(bet.customAmount.toString());
  }, [bet.customAmount]);

  const isOverBudget = bet.isSelected && bet.customAmount > remainingBudget + bet.customAmount;

  return (
    <div
      className={`interactive-bet-card ${bet.isSelected ? 'selected' : ''} ${isOverBudget ? 'over-budget' : ''}`}
    >
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
                {bet.specialCategory === 'nuclear'
                  ? 'local_fire_department'
                  : bet.specialCategory === 'diamond'
                    ? 'diamond'
                    : 'trending_up'}
              </span>
              <span>
                {bet.specialCategory === 'nuclear'
                  ? 'Nuclear Longshot'
                  : bet.specialCategory === 'diamond'
                    ? 'Hidden Gem'
                    : 'Value Bomb'}
              </span>
            </div>
          )}

          {/* Kelly Criterion info (Advanced mode only) */}
          {kellyEnabled && bet.kellyInfo && (
            <div className="bet-kelly-info">
              <div className="bet-kelly-badge">
                <span className="material-icons" style={{ fontSize: 14 }}>
                  functions
                </span>
                <span className="bet-kelly-label">{bet.kellyInfo.kellyFraction}</span>
                {bet.kellyInfo.shouldBet ? (
                  <span className="bet-kelly-amount">${bet.kellyInfo.kellyAmount}</span>
                ) : (
                  <span className="bet-kelly-pass">Pass</span>
                )}
              </div>
              {bet.kellyInfo.edge && (
                <span
                  className="bet-kelly-edge"
                  style={{
                    color: bet.kellyInfo.edge.startsWith('+') ? '#22c55e' : '#ef4444',
                  }}
                >
                  Edge: {bet.kellyInfo.edge}
                </span>
              )}
              {bet.kellyInfo.warnings.length > 0 && !bet.kellyInfo.shouldBet && (
                <span className="bet-kelly-warning">
                  <span className="material-icons" style={{ fontSize: 12 }}>
                    warning
                  </span>
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
  );
}

// Quick Preset Buttons Component
interface QuickPresetButtonsProps {
  onPresetClick: (preset: PresetType) => void;
  isMobile: boolean;
}

function QuickPresetButtons({ onPresetClick, isMobile }: QuickPresetButtonsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="preset-dropdown-container">
        <button
          className="preset-dropdown-trigger"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span className="material-icons">tune</span>
          <span>Quick Select</span>
          <span className={`material-icons ${isDropdownOpen ? 'rotated' : ''}`}>expand_more</span>
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
                    onPresetClick(preset.id);
                    setIsDropdownOpen(false);
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
    );
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
  );
}

// Sticky Footer Component
interface StickyFooterProps {
  selectedCount: number;
  totalCost: number;
  remainingBudget: number;
  dailyBudget: number;
  potentialReturn: { min: number; max: number };
  onViewBetSlip: () => void;
  onCopyToClipboard: () => void;
  isOverBudget: boolean;
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
  const budgetPercentUsed = Math.min(100, (totalCost / dailyBudget) * 100);

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
            <span
              className={`sticky-stat-value ${isOverBudget ? 'over-budget' : remainingBudget < dailyBudget * 0.2 ? 'warning' : ''}`}
            >
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
  );
}

// Main Component
export function BettingRecommendations({
  horses,
  raceNumber,
  raceHeader,
  bankroll,
  onOpenBankrollSettings,
  allRaces,
  trackCode,
}: BettingRecommendationsProps) {
  const [selectableBets, setSelectableBets] = useState<SelectableBet[]>([]);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [isExoticOptimizerOpen, setIsExoticOptimizerOpen] = useState(false);
  const [isExoticBuilderOpen, setIsExoticBuilderOpen] = useState(false);
  const [exoticBudget, setExoticBudget] = useState(20);
  const [selectedExoticType, setSelectedExoticType] = useState<ExoticBetType>('exacta');
  // Dutch booking state
  const [isDutchPanelOpen, setIsDutchPanelOpen] = useState(false);
  const [isDutchBuilderOpen, setIsDutchBuilderOpen] = useState(false);
  const [dutchStake, setDutchStake] = useState(50);
  const [selectedDutchHorses, setSelectedDutchHorses] = useState<number[]>([]);
  const [dutchSettings] = useState<DutchSettings>(loadDutchSettings);

  // Analytics tracking
  const { trackEvent } = useAnalytics();
  const lastTrackedRace = useRef<number | null>(null);

  // Check if Kelly Criterion is enabled
  const kellyEnabled = useMemo(() => isKellyEnabled(bankroll), [bankroll]);

  // Convert horses to ScoredHorse format for generator
  const scoredHorses: ScoredHorse[] = useMemo(() => {
    return horses.map((h, idx) => ({
      horse: h.horse,
      index: h.index,
      score: h.score,
      rank: idx + 1,
    }));
  }, [horses]);

  // Create default race header if not provided
  const effectiveRaceHeader: RaceHeader = useMemo(() => {
    if (raceHeader) return raceHeader;
    // Create a minimal header from available data
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0] ?? '';
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
    };
  }, [raceHeader, raceNumber, horses.length]);

  // Generate recommendations using new integrated system
  const generatorResult: BetGeneratorResult = useMemo(() => {
    return generateRecommendations({
      scoredHorses,
      raceHeader: effectiveRaceHeader,
      raceNumber,
      bankroll,
    });
  }, [scoredHorses, effectiveRaceHeader, raceNumber, bankroll]);

  // Extract tier recommendations for backward compatibility
  const recommendations = generatorResult.tierBets;

  // Initialize selectable bets when generator result changes
  useEffect(() => {
    const newSelectableBets: SelectableBet[] = generatorResult.allBets.map((bet) => {
      // Calculate Kelly info if enabled
      let kellyInfo: SelectableBet['kellyInfo'] = undefined;

      if (kellyEnabled && bet.horses && bet.horses.length > 0) {
        const topHorse = bet.horses[0];
        // Get odds from horse's morning line
        const oddsString = topHorse?.horse?.morningLineOdds || topHorse?.oddsDisplay || '5-1';

        const kellyResult = calculateBetWithKelly(
          bet.confidence,
          oddsString,
          bet.tier,
          bankroll,
          horses.length
        );

        if (kellyResult.kellyResult) {
          kellyInfo = {
            kellyAmount: kellyResult.kellyAmount,
            kellyFraction: kellyResult.display.kellyFraction,
            edge: kellyResult.display.edge,
            shouldBet: kellyResult.display.shouldBet,
            warnings: kellyResult.display.warnings,
          };
        }
      }

      return {
        ...bet,
        isSelected: bet.isRecommended, // Pre-select recommended bets
        customAmount: bet.totalCost,
        kellyInfo,
      };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state from generator
    setSelectableBets(newSelectableBets);
  }, [generatorResult, kellyEnabled, bankroll, horses.length]);

  // Track bet_viewed when recommendations render
  useEffect(() => {
    // Only track if this is a new race and we have recommendations
    if (lastTrackedRace.current !== raceNumber && generatorResult.allBets.length > 0) {
      // Count bets by tier
      const tier1Count = generatorResult.allBets.filter((bet) => bet.tier === 'tier1').length;
      const tier2Count = generatorResult.allBets.filter((bet) => bet.tier === 'tier2').length;
      const tier3Count = generatorResult.allBets.filter((bet) => bet.tier === 'tier3').length;

      trackEvent('bet_viewed', {
        race_number: raceNumber,
        total_bets: generatorResult.allBets.length,
        tier1_count: tier1Count,
        tier2_count: tier2Count,
        tier3_count: tier3Count,
        horse_count: horses.length,
      });

      lastTrackedRace.current = raceNumber;
    }
  }, [raceNumber, generatorResult.allBets, horses.length, trackEvent]);

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate totals
  const selectedBets = useMemo(
    () => selectableBets.filter((bet) => bet.isSelected),
    [selectableBets]
  );

  const totalCost = useMemo(
    () => selectedBets.reduce((sum, bet) => sum + bet.customAmount, 0),
    [selectedBets]
  );

  const potentialReturn = useMemo(() => {
    const min = selectedBets.reduce((sum, bet) => sum + bet.potentialReturn.min, 0);
    const max = selectedBets.reduce((sum, bet) => sum + bet.potentialReturn.max, 0);
    return { min, max };
  }, [selectedBets]);

  // Convert horses to HorseTier format for exotic optimizer
  const horseTiers = useMemo((): HorseTier[] => {
    return horses.map((h) => {
      let tier: 1 | 2 | 3 = 3;
      if (h.score.total >= 180) tier = 1;
      else if (h.score.total >= 160) tier = 2;

      const oddsMatch = h.horse.morningLineOdds.match(/(\d+(?:\.\d+)?)[/-](\d+(?:\.\d+)?)?/);
      const odds = oddsMatch
        ? parseFloat(oddsMatch[1] ?? '5') / (oddsMatch[2] ? parseFloat(oddsMatch[2]) : 1)
        : 5;
      const winProb = 1 / (odds + 1);

      return {
        programNumber: h.horse.programNumber,
        horseName: h.horse.horseName,
        tier,
        winProbability: winProb,
        odds,
        confidence: Math.min(100, 40 + (h.score.total / 319) * 60),
      };
    });
  }, [horses]);

  // Exotic optimization results
  const exoticOptimization = useMemo((): OptimizationResult | null => {
    const tier1 = horseTiers.filter((h) => h.tier === 1);
    const tier2 = horseTiers.filter((h) => h.tier === 2);
    const tier3 = horseTiers.filter((h) => h.tier === 3);

    if (tier1.length + tier2.length < 2) return null;

    return optimizeExoticBet({
      budget: exoticBudget,
      tier1Horses: tier1,
      tier2Horses: tier2,
      tier3Horses: tier3,
      betType: selectedExoticType,
      fieldSize: horses.length,
    });
  }, [horseTiers, exoticBudget, selectedExoticType, horses.length]);

  // Exotic comparison table
  const exoticComparison = useMemo(() => {
    if (horseTiers.length < 2) return null;

    return generateComparisonTable({
      budget: exoticBudget,
      horses: horseTiers
        .filter((h) => h.tier <= 2)
        .slice(0, 6)
        .map((h) => ({
          programNumber: h.programNumber,
          horseName: h.horseName,
          odds: h.odds,
          confidence: h.confidence,
        })),
      fieldSize: horses.length,
      maxOptions: 6,
    });
  }, [horseTiers, exoticBudget, horses.length]);

  // Dutch booking candidates
  const dutchCandidates: DutchCandidateHorse[] = useMemo(() => {
    return convertToDutchCandidates(
      horses.map((h) => {
        let tier: 1 | 2 | 3 = 3;
        if (h.score.total >= 180) tier = 1;
        else if (h.score.total >= 160) tier = 2;

        return {
          programNumber: h.horse.programNumber,
          horseName: h.horse.horseName,
          morningLineOdds: h.horse.morningLineOdds,
          score: h.score.total,
          confidence: Math.min(100, 40 + (h.score.total / 319) * 60),
          tier,
          estimatedWinProb: undefined,
          overlayPercent: 0,
        };
      })
    );
  }, [horses]);

  // Dutch optimization results
  const dutchOptimization = useMemo(() => {
    if (!dutchSettings.enabled || dutchCandidates.length < 2) return null;

    return findOptimalDutchCombinations({
      horses: dutchCandidates,
      minEdgeRequired: dutchSettings.minEdgeRequired,
      maxHorses: dutchSettings.maxHorses,
      overlayOnly: dutchSettings.overlayOnly,
      preferMixedTiers: dutchSettings.preferMixedTiers,
      stake: dutchStake,
    });
  }, [dutchCandidates, dutchSettings, dutchStake]);

  // Live Dutch calculation for builder
  const liveDutchResult = useMemo((): DutchResult | null => {
    if (selectedDutchHorses.length < 2) return null;

    const selectedCandidates = dutchCandidates.filter((h) =>
      selectedDutchHorses.includes(h.programNumber)
    );

    return calculateDutchBook({
      totalStake: dutchStake,
      horses: selectedCandidates.map((h) => ({
        programNumber: h.programNumber,
        horseName: h.horseName,
        decimalOdds: h.decimalOdds,
        oddsDisplay: h.oddsDisplay,
      })),
    });
  }, [selectedDutchHorses, dutchCandidates, dutchStake]);

  const dailyBudget = bankroll.getDailyBudget();
  const spentToday = bankroll.getSpentToday();
  const remainingBudget = dailyBudget - spentToday - totalCost;
  const isOverBudget = remainingBudget < 0;

  // Handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectableBets((prev) =>
      prev.map((bet) => (bet.id === id ? { ...bet, isSelected: !bet.isSelected } : bet))
    );
  }, []);

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
    );
  }, []);

  const handlePresetClick = useCallback((preset: PresetType) => {
    setSelectableBets((prev) => {
      switch (preset) {
        case 'allTier1':
          return prev.map((bet) => ({ ...bet, isSelected: bet.tier === 'tier1' }));
        case 'positiveEV':
          // Select only bets with positive expected value
          return prev.map((bet) => ({
            ...bet,
            isSelected: bet.evPerDollar > 0,
          }));
        case 'valueHunter': {
          // Value Hunter: Select positive EV bets, sorted by EV% (ignores tier)
          // This preset focuses on mathematical value, not tier classification
          const sortedByEV = [...prev].sort((a, b) => {
            // Sort by EV per dollar (highest first)
            const evA = a.evPerDollar ?? 0;
            const evB = b.evPerDollar ?? 0;
            return evB - evA;
          });
          // Select top value bets (EV > 5% or overlay > 15%)
          return sortedByEV.map((bet) => ({
            ...bet,
            isSelected: bet.evPerDollar * 100 >= 5 || bet.overlayPercent >= 15,
          }));
        }
        case 'conservative':
          return prev.map((bet) => ({
            ...bet,
            isSelected: bet.confidence >= 70 && bet.tier !== 'tier3',
          }));
        case 'maxCoverage':
          return prev.map((bet) => ({ ...bet, isSelected: true }));
        case 'clearAll':
          return prev.map((bet) => ({ ...bet, isSelected: false }));
        default:
          return prev;
      }
    });
  }, []);

  const handleCopyToClipboard = useCallback(() => {
    const instructions = selectedBets
      .map((bet) => {
        const instruction = bet.windowInstruction
          .replace(/^"/, `"Race ${raceNumber}, `)
          .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)
          .replace(/^"|"$/g, '');
        return `${bet.typeName} (${formatCurrency(bet.customAmount)}): ${instruction}`;
      })
      .join('\n');

    const fullText = `Bet Slip - Race ${raceNumber}\n${'='.repeat(30)}\n${instructions}\n${'='.repeat(30)}\nTotal: ${formatCurrency(totalCost)} | Potential: ${formatCurrency(potentialReturn.min)}-${formatCurrency(potentialReturn.max)}`;

    navigator.clipboard.writeText(fullText);
    setCopiedMessage('Copied to clipboard!');
    setTimeout(() => setCopiedMessage(null), 2000);
  }, [selectedBets, raceNumber, totalCost, potentialReturn]);

  const handleCopySingle = useCallback((instruction: string) => {
    navigator.clipboard.writeText(instruction);
    setCopiedMessage('Copied!');
    setTimeout(() => setCopiedMessage(null), 2000);
  }, []);

  const handleExoticBetAdd = useCallback((bet: ExoticBetResult) => {
    // Add exotic bet to selectable bets
    const newBet: SelectableBet = {
      id: `exotic-${bet.betType}-${Date.now()}`,
      tier: 'tier1',
      typeName: `${bet.betType.charAt(0).toUpperCase() + bet.betType.slice(1)} ${bet.structure.replace('_', ' ')}`,
      description: `Custom ${bet.betType}: ${bet.horses.map((h) => `#${h}`).join(', ')}`,
      type:
        bet.betType === 'exacta'
          ? 'exacta_box'
          : bet.betType === 'trifecta'
            ? 'trifecta_box'
            : 'superfecta',
      horses: [],
      horseNumbers: bet.horses,
      amount: bet.baseBet,
      totalCost: bet.totalCost,
      windowInstruction: `"${bet.windowInstruction}"`,
      potentialReturn: { min: bet.payoutRange.min, max: bet.payoutRange.max },
      confidence: 65,
      icon:
        bet.betType === 'exacta'
          ? 'swap_vert'
          : bet.betType === 'trifecta'
            ? 'view_list'
            : 'format_list_numbered',
      isRecommended: false,
      overlayPercent: 0,
      evPerDollar: 0,
      specialCategory: null,
      explanation: [`Custom ${bet.betType} with ${bet.combinations} combinations`],
      narrative: `${bet.betType.charAt(0).toUpperCase() + bet.betType.slice(1)} covering horses ${bet.horses.join(', ')}`,
      scoringSources: ['exotic-builder'],
      isSelected: true,
      customAmount: bet.totalCost,
    };
    setSelectableBets((prev) => [newBet, ...prev]);
    setCopiedMessage('Exotic bet added!');
    setTimeout(() => setCopiedMessage(null), 2000);
  }, []);

  // Multi-race ticket handler
  const handleMultiRaceTicketAdd = useCallback((ticket: MultiRaceTicketResult) => {
    const newBet: SelectableBet = {
      id: ticket.id,
      tier: 'tier1',
      typeName: ticket.displayName,
      description: `${ticket.displayName}: ${ticket.spreadNotation}`,
      type: 'pick_multi' as never,
      horses: [],
      horseNumbers: ticket.raceInstructions.flatMap(
        (r: { raceNumber: number; horses: number[] }) => r.horses
      ),
      amount: ticket.totalCost,
      totalCost: ticket.totalCost,
      windowInstruction: `"${ticket.windowInstruction}"`,
      potentialReturn: { min: ticket.payoutRange.min, max: ticket.payoutRange.max },
      confidence: Math.round(ticket.probability * 100),
      icon: 'casino',
      isRecommended: false,
      overlayPercent: 0,
      evPerDollar: ticket.expectedValue / ticket.totalCost,
      specialCategory: ticket.hasCarryover ? 'nuclear' : null,
      explanation: [
        `${ticket.displayName} spanning ${ticket.raceRange}`,
        `${ticket.combinations} combinations using ${ticket.spreadNotation}`,
        `${(ticket.probability * 100).toFixed(1)}% hit rate`,
        ticket.hasCarryover ? `Carryover: $${ticket.carryoverAmount?.toLocaleString()}` : '',
      ].filter(Boolean) as string[],
      narrative: `Multi-race bet covering races ${ticket.raceRange}`,
      scoringSources: ['multirace-optimizer'],
      isSelected: true,
      customAmount: ticket.totalCost,
    };
    setSelectableBets((prev) => [newBet, ...prev]);
    setCopiedMessage(`${ticket.displayName} added!`);
    setTimeout(() => setCopiedMessage(null), 2000);
  }, []);

  // Dutch booking handlers
  const handleToggleDutchHorse = useCallback(
    (programNumber: number) => {
      setSelectedDutchHorses((prev) => {
        if (prev.includes(programNumber)) {
          return prev.filter((n) => n !== programNumber);
        }
        if (prev.length >= (dutchSettings.maxHorses || 5)) {
          return prev; // Don't add more than max
        }
        return [...prev, programNumber];
      });
    },
    [dutchSettings.maxHorses]
  );

  const handleUseDutchCombination = useCallback(
    (combination: DutchCombination) => {
      if (!combination.dutchResult) return;

      // Add all Dutch bets to the bet slip
      const dutchBets: SelectableBet[] = combination.dutchResult.bets.map((bet, idx) => ({
        id: `dutch-${combination.id}-${bet.programNumber}-${idx}`,
        tier: 'tier1' as BettingTier,
        typeName: `Dutch Win`,
        description: `Part of ${combination.horseCount}-horse Dutch (${combination.edgePercent.toFixed(1)}% edge)`,
        type: 'win' as const,
        horses: [],
        horseNumbers: [bet.programNumber],
        amount: bet.betAmountRounded,
        totalCost: bet.betAmountRounded,
        windowInstruction: `"Race ${raceNumber}, $${bet.betAmountRounded.toFixed(2)} to win on the ${bet.programNumber}"`,
        potentialReturn: { min: bet.returnIfWins, max: bet.returnIfWins },
        confidence: combination.avgConfidence,
        icon: 'balance',
        isRecommended: true,
        overlayPercent: 0,
        evPerDollar: combination.edgePercent / 100,
        specialCategory: null,
        explanation: [
          `Dutch book: ${combination.horseCount} horses for guaranteed profit`,
          `If #${bet.programNumber} wins: return ${formatDutchCurrency(bet.returnIfWins)}`,
          `Edge: ${combination.edgePercent.toFixed(1)}%`,
        ],
        narrative: `Dutch bet on #${bet.programNumber} ${bet.horseName}`,
        scoringSources: ['dutch-optimizer'],
        isSelected: true,
        customAmount: bet.betAmountRounded,
      }));

      setSelectableBets((prev) => [...dutchBets, ...prev]);
      setCopiedMessage(`Dutch book added: ${combination.horseCount} bets`);
      setTimeout(() => setCopiedMessage(null), 2000);
      setIsDutchPanelOpen(false);
    },
    [raceNumber]
  );

  const handleUseLiveDutch = useCallback(() => {
    if (!liveDutchResult || !liveDutchResult.isValid) return;

    handleUseDutchCombination({
      id: `custom-${Date.now()}`,
      horses: dutchCandidates.filter((h) => selectedDutchHorses.includes(h.programNumber)),
      horseCount: selectedDutchHorses.length,
      edgePercent: liveDutchResult.edgePercent,
      edgeClass:
        liveDutchResult.edgePercent >= 10
          ? 'good'
          : liveDutchResult.edgePercent >= 5
            ? 'moderate'
            : 'marginal',
      sumOfImpliedProbs: liveDutchResult.sumOfImpliedProbs,
      isProfitable: liveDutchResult.hasProfitPotential,
      description: `Custom Dutch: ${selectedDutchHorses.map((n) => `#${n}`).join(', ')}`,
      tierMix: 'Custom',
      avgConfidence: 70,
      avgOdds: 5,
      recommendationStrength: 70,
      dutchResult: liveDutchResult,
    });

    setSelectedDutchHorses([]);
    setIsDutchBuilderOpen(false);
  }, [liveDutchResult, selectedDutchHorses, dutchCandidates, handleUseDutchCombination]);

  // Check if we have any recommendations
  if (generatorResult.allBets.length === 0) {
    return null;
  }

  // Group bets by tier for display
  const betsByTier = recommendations.map((tierRec) => ({
    ...tierRec,
    selectableBets: selectableBets.filter(
      (bet) => bet.tier === tierRec.tier && !bet.specialCategory
    ),
  }));

  // Get special category bets
  const specialBets = selectableBets.filter((bet) => bet.specialCategory !== null);

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

      {/* Exotic Optimizer Section */}
      {horseTiers.length >= 2 && (
        <div className="exotic-optimizer-section">
          <button
            className="exotic-optimizer-toggle"
            onClick={() => setIsExoticOptimizerOpen(!isExoticOptimizerOpen)}
          >
            <span className="material-icons">tune</span>
            <span>Optimize Exotics</span>
            <span className={`material-icons chevron ${isExoticOptimizerOpen ? 'open' : ''}`}>
              expand_more
            </span>
          </button>

          <AnimatePresence>
            {isExoticOptimizerOpen && (
              <motion.div
                className="exotic-optimizer-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Budget Slider */}
                <div className="exotic-control-group">
                  <label className="exotic-control-label">
                    Budget for exotic: {formatCurrency(exoticBudget)}
                  </label>
                  <input
                    type="range"
                    className="exotic-budget-slider"
                    min={5}
                    max={100}
                    step={5}
                    value={exoticBudget}
                    onChange={(e) => setExoticBudget(Number(e.target.value))}
                  />
                  <div className="exotic-budget-labels">
                    <span>$5</span>
                    <span>$100</span>
                  </div>
                </div>

                {/* Bet Type Selector */}
                <div className="exotic-control-group">
                  <label className="exotic-control-label">Bet Type</label>
                  <div className="exotic-type-buttons">
                    {(['exacta', 'trifecta', 'superfecta'] as ExoticBetType[]).map((type) => (
                      <button
                        key={type}
                        className={`exotic-type-btn ${selectedExoticType === type ? 'active' : ''}`}
                        onClick={() => setSelectedExoticType(type)}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optimization Result */}
                {exoticOptimization &&
                  exoticOptimization.isValid &&
                  exoticOptimization.recommended && (
                    <div className="exotic-recommendation">
                      <div className="exotic-recommendation-header">
                        <span className="material-icons">verified</span>
                        <span>Recommended</span>
                      </div>
                      <div className="exotic-recommendation-content">
                        <p className="exotic-recommendation-title">
                          {exoticOptimization.recommended.description}
                        </p>
                        <div className="exotic-recommendation-stats">
                          <div className="exotic-stat">
                            <span className="exotic-stat-label">Cost</span>
                            <span className="exotic-stat-value">
                              {formatCurrency(exoticOptimization.recommended.cost.total)}
                            </span>
                          </div>
                          <div className="exotic-stat">
                            <span className="exotic-stat-label">Combos</span>
                            <span className="exotic-stat-value">
                              {exoticOptimization.recommended.cost.combinations}
                            </span>
                          </div>
                          <div className="exotic-stat">
                            <span className="exotic-stat-label">Hit %</span>
                            <span className="exotic-stat-value">
                              {(exoticOptimization.recommended.hitProbability * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <button
                          className="exotic-use-btn"
                          onClick={() => {
                            handleExoticBetAdd({
                              betType: selectedExoticType,
                              structure: exoticOptimization.recommended!.structure,
                              horses: exoticOptimization.recommended!.firstHorses,
                              baseBet: exoticOptimization.recommended!.baseBet,
                              totalCost: exoticOptimization.recommended!.cost.total,
                              combinations: exoticOptimization.recommended!.cost.combinations,
                              payoutRange: {
                                min: 0,
                                max: 0,
                                likely: 0,
                              },
                              windowInstruction: `Race ${raceNumber}, $${exoticOptimization.recommended!.baseBet} ${selectedExoticType.toUpperCase()} ${exoticOptimization.recommended!.structure === 'box' ? 'BOX' : 'KEY'} ${exoticOptimization.recommended!.firstHorses.join(', ')}`,
                            });
                          }}
                        >
                          <span className="material-icons">add</span>
                          Use This Bet
                        </button>
                      </div>
                    </div>
                  )}

                {/* Comparison Table */}
                {exoticComparison &&
                  exoticComparison.isValid &&
                  exoticComparison.rows.length > 0 && (
                    <div className="exotic-comparison-section">
                      <div className="exotic-comparison-header">
                        <span className="material-icons">compare</span>
                        <span>Compare Options</span>
                      </div>
                      <div className="exotic-comparison-table-wrapper">
                        <table className="exotic-comparison-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Cost</th>
                              <th>Combos</th>
                              <th>EV</th>
                              <th>Hit%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exoticComparison.rows.slice(0, 5).map((row) => (
                              <tr key={row.id} className={row.isRecommended ? 'recommended' : ''}>
                                <td>
                                  {row.type} {row.displayName}
                                </td>
                                <td>{formatCurrency(row.cost.total)}</td>
                                <td>{row.combinations}</td>
                                <td className={row.expectedValue >= 0 ? 'positive' : 'negative'}>
                                  {row.evDisplay}
                                </td>
                                <td>{row.hitDisplay}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Build Custom Button */}
                <button
                  className="exotic-build-custom-btn"
                  onClick={() => setIsExoticBuilderOpen(true)}
                >
                  <span className="material-icons">build</span>
                  Build Custom Exotic
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Multi-Race Exotics Section */}
      {allRaces && allRaces.length >= 2 && (
        <MultiRaceExoticsPanel
          races={allRaces}
          currentRaceNumber={raceNumber}
          trackCode={trackCode || raceHeader?.trackCode}
          budget={exoticBudget}
          onAddToBetSlip={handleMultiRaceTicketAdd}
        />
      )}

      {/* Dutch Book Opportunities Section */}
      {dutchSettings.enabled && dutchCandidates.length >= 2 && (
        <div className="dutch-optimizer-section">
          <button
            className="dutch-optimizer-toggle"
            onClick={() => setIsDutchPanelOpen(!isDutchPanelOpen)}
          >
            <span className="material-icons">balance</span>
            <span>Dutch Book Opportunities</span>
            {dutchOptimization?.overallBest && (
              <span
                className="dutch-edge-badge"
                style={{
                  backgroundColor: EDGE_COLORS[dutchOptimization.overallBest.edgeClass] + '20',
                  color: EDGE_COLORS[dutchOptimization.overallBest.edgeClass],
                }}
              >
                {dutchOptimization.overallBest.edgePercent.toFixed(1)}% edge - Guaranteed profit
              </span>
            )}
            <span className={`material-icons chevron ${isDutchPanelOpen ? 'open' : ''}`}>
              expand_more
            </span>
          </button>

          <AnimatePresence>
            {isDutchPanelOpen && (
              <motion.div
                className="dutch-optimizer-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Stake Slider */}
                <div className="dutch-control-group">
                  <label className="dutch-control-label">
                    Total stake: {formatCurrency(dutchStake)}
                  </label>
                  <input
                    type="range"
                    className="dutch-stake-slider"
                    min={10}
                    max={200}
                    step={10}
                    value={dutchStake}
                    onChange={(e) => setDutchStake(Number(e.target.value))}
                  />
                  <div className="dutch-stake-labels">
                    <span>$10</span>
                    <span>$200</span>
                  </div>
                </div>

                {/* Top Dutch Combinations */}
                {dutchOptimization && dutchOptimization.combinations.length > 0 ? (
                  <div className="dutch-combinations-list">
                    <div className="dutch-combinations-header">
                      <span className="material-icons">auto_awesome</span>
                      <span>Top Dutch Opportunities</span>
                    </div>

                    {dutchOptimization.combinations.slice(0, 3).map((combo, idx) => (
                      <div
                        key={combo.id}
                        className={`dutch-combination-card ${idx === 0 ? 'recommended' : ''}`}
                      >
                        <div className="dutch-combination-header">
                          <div className="dutch-combination-title">
                            <span className="dutch-combination-rank">#{idx + 1}</span>
                            <span className="dutch-combination-name">
                              {combo.horseCount}-Horse Dutch
                            </span>
                          </div>
                          <span
                            className="dutch-combination-badge"
                            style={{
                              backgroundColor: EDGE_COLORS[combo.edgeClass] + '20',
                              color: EDGE_COLORS[combo.edgeClass],
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: 14 }}>
                              {EDGE_ICONS[combo.edgeClass]}
                            </span>
                            {combo.edgePercent.toFixed(1)}% edge
                          </span>
                        </div>

                        <p className="dutch-combination-horses">
                          {combo.horses.map((h) => `#${h.programNumber} ${h.horseName}`).join(', ')}
                        </p>

                        <div className="dutch-combination-stats">
                          <div className="dutch-stat">
                            <span className="dutch-stat-label">Stake</span>
                            <span className="dutch-stat-value">
                              {combo.dutchResult
                                ? formatCurrency(combo.dutchResult.actualTotalCost)
                                : '-'}
                            </span>
                          </div>
                          <div className="dutch-stat">
                            <span className="dutch-stat-label">Return</span>
                            <span className="dutch-stat-value">
                              {combo.dutchResult
                                ? formatCurrency(combo.dutchResult.guaranteedReturn)
                                : '-'}
                            </span>
                          </div>
                          <div className="dutch-stat">
                            <span className="dutch-stat-label">Profit</span>
                            <span className="dutch-stat-value positive">
                              {combo.dutchResult
                                ? `+${formatCurrency(combo.dutchResult.guaranteedProfit)}`
                                : '-'}
                            </span>
                          </div>
                          <div className="dutch-stat">
                            <span className="dutch-stat-label">ROI</span>
                            <span className="dutch-stat-value positive">
                              {combo.dutchResult
                                ? `${combo.dutchResult.roiPercent.toFixed(0)}%`
                                : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Bet breakdown */}
                        {combo.dutchResult && (
                          <div className="dutch-combination-bets">
                            {combo.dutchResult.bets.map((bet) => (
                              <div key={bet.programNumber} className="dutch-bet-row">
                                <span className="dutch-bet-horse">#{bet.programNumber}</span>
                                <span className="dutch-bet-amount">
                                  {formatCurrency(bet.betAmountRounded)}
                                </span>
                                <span className="dutch-bet-odds">{bet.oddsDisplay}</span>
                                <span className="dutch-bet-return">
                                  &rarr; {formatCurrency(bet.returnIfWins)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          className="dutch-use-btn"
                          onClick={() => handleUseDutchCombination(combo)}
                        >
                          <span className="material-icons">add</span>
                          Use This Dutch
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dutch-no-opportunities">
                    <span className="material-icons">info</span>
                    <p>No profitable Dutch opportunities found with current settings.</p>
                    <span className="dutch-no-opportunities-hint">
                      Try adjusting minimum edge requirement or include more horses.
                    </span>
                  </div>
                )}

                {/* Build Custom Dutch Button */}
                <button
                  className="dutch-build-custom-btn"
                  onClick={() => setIsDutchBuilderOpen(!isDutchBuilderOpen)}
                >
                  <span className="material-icons">build</span>
                  Build Custom Dutch
                  <span className={`material-icons ${isDutchBuilderOpen ? 'rotated' : ''}`}>
                    expand_more
                  </span>
                </button>

                {/* Custom Dutch Builder */}
                <AnimatePresence>
                  {isDutchBuilderOpen && (
                    <motion.div
                      className="dutch-builder-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="dutch-builder-header">
                        <span>Select 2-{dutchSettings.maxHorses} horses:</span>
                        <span className="dutch-builder-count">
                          {selectedDutchHorses.length} selected
                        </span>
                      </div>

                      <div className="dutch-horse-selection">
                        {dutchCandidates.map((horse) => (
                          <button
                            key={horse.programNumber}
                            className={`dutch-horse-option ${selectedDutchHorses.includes(horse.programNumber) ? 'selected' : ''}`}
                            onClick={() => handleToggleDutchHorse(horse.programNumber)}
                          >
                            <span className="dutch-horse-number">#{horse.programNumber}</span>
                            <span className="dutch-horse-name">{horse.horseName}</span>
                            <span className="dutch-horse-odds">{horse.oddsDisplay}</span>
                            {selectedDutchHorses.includes(horse.programNumber) && (
                              <span className="material-icons dutch-horse-check">check</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Live calculation */}
                      {liveDutchResult && (
                        <div
                          className={`dutch-live-result ${liveDutchResult.hasProfitPotential ? 'profitable' : 'unprofitable'}`}
                        >
                          {liveDutchResult.hasProfitPotential ? (
                            <>
                              <div className="dutch-live-header">
                                <span className="material-icons">check_circle</span>
                                <span>Profitable Dutch!</span>
                                <span className="dutch-live-edge">
                                  {liveDutchResult.edgePercent.toFixed(1)}% edge
                                </span>
                              </div>
                              <div className="dutch-live-stats">
                                <div className="dutch-live-stat">
                                  <span>Stake:</span>
                                  <span>{formatCurrency(liveDutchResult.actualTotalCost)}</span>
                                </div>
                                <div className="dutch-live-stat">
                                  <span>Return:</span>
                                  <span>{formatCurrency(liveDutchResult.guaranteedReturn)}</span>
                                </div>
                                <div className="dutch-live-stat">
                                  <span>Profit:</span>
                                  <span className="positive">
                                    +{formatCurrency(liveDutchResult.guaranteedProfit)}
                                  </span>
                                </div>
                              </div>
                              <button className="dutch-use-live-btn" onClick={handleUseLiveDutch}>
                                <span className="material-icons">add</span>
                                Add to Bet Slip
                              </button>
                            </>
                          ) : (
                            <div className="dutch-live-warning">
                              <span className="material-icons">warning</span>
                              <span>
                                No profit possible: book is{' '}
                                {(liveDutchResult.sumOfImpliedProbs * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedDutchHorses.length < 2 && (
                        <div className="dutch-builder-hint">
                          <span className="material-icons">info</span>
                          Select at least 2 horses to see Dutch calculation
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Dutch explanation */}
                <div className="dutch-explanation">
                  <span className="material-icons">help_outline</span>
                  <p>
                    Dutch booking spreads risk across multiple horses. If any selected horse wins,
                    you're guaranteed the same profit regardless of which one wins.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
          if (tierGroup.selectableBets.length === 0) return null;

          const tierColor = TIER_COLORS[tierGroup.tier];
          const tierIcon = TIER_ICONS[tierGroup.tier];

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
                <span className="tier-bet-count">{tierGroup.selectableBets.length} bets</span>
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
          );
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

      {/* Exotic Builder Modal */}
      <AnimatePresence>
        {isExoticBuilderOpen && (
          <ExoticBuilderModal
            isOpen={isExoticBuilderOpen}
            onClose={() => setIsExoticBuilderOpen(false)}
            horses={horses}
            raceNumber={raceNumber}
            fieldSize={horses.length}
            onAddToBetSlip={handleExoticBetAdd}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default BettingRecommendations;
