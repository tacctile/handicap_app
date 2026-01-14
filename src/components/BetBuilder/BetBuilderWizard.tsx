/**
 * Bet Builder Wizard Component
 *
 * A step-by-step questionnaire that guides complete novices through
 * building algorithm-suggested bets with the option to override.
 *
 * Steps:
 * 1. Bet Style - What kind of bettor are you today?
 * 2. Budget - How much are you betting this race?
 * 3. Risk Level - How risky do you want to be?
 * 4. Furlong's Suggestion - Algorithm-generated bets
 * 5. Confirm or Override - Final actions
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  calculateCombinations,
  calculateTotalCost,
  calculatePotentialReturn,
  generateWindowScript,
  generateAllBetsScript,
  parseOdds,
  type Horse,
} from '../../lib/betting/combinationCalculator';
import {
  BET_TYPE_DEFINITIONS,
  generateWhyThisBet,
  getValueLabel,
  VALUE_LABEL_EXPLANATIONS,
  getBettingAdvice,
  type RiskLevel,
} from '../../lib/betting/betTypeDefinitions';
import type { ScoredHorse } from '../../lib/scoring';
import type { ValuePlay } from '../../hooks/useValueDetection';
import './BetBuilderWizard.css';

// ============================================================================
// TYPES
// ============================================================================

export type BetStyle = 'simple' | 'action' | 'crazy';

export interface WizardBet {
  id: string;
  betType: string;
  horses: Horse[];
  amount: number;
  combinations: number;
  totalCost: number;
  potentialReturn: { min: number; max: number };
  whatToSay: string;
  explanation: string;
  whyThisBet: string;
}

interface BetBuilderWizardProps {
  /** Current race number */
  raceNumber: number;
  /** Track name */
  trackName: string;
  /** Scored horses with rankings */
  scoredHorses: ScoredHorse[];
  /** Function to get current odds for a horse */
  getOdds: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched: (index: number) => boolean;
  /** Primary value play (if any) */
  valuePlay: ValuePlay | null;
  /** Callback to close the wizard */
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BUDGET_PRESETS = [5, 10, 20, 50, 100];

const BET_STYLE_OPTIONS = [
  {
    key: 'simple' as BetStyle,
    icon: '1',
    title: 'Keep it simple',
    description: 'Win/Place/Show bets',
    subtext: 'Best for beginners. One horse, one bet.',
  },
  {
    key: 'action' as BetStyle,
    icon: '2',
    title: 'I want some action',
    description: 'Exacta/Trifecta bets',
    subtext: 'Pick multiple horses. Bigger payouts.',
  },
  {
    key: 'crazy' as BetStyle,
    icon: '3',
    title: "Let's get crazy",
    description: 'Superfecta/Multi-race bets',
    subtext: 'High risk, huge rewards. Lottery-level payouts.',
  },
];

const RISK_OPTIONS = [
  {
    key: 'safe' as RiskLevel,
    icon: 'shield',
    title: 'Safe',
    description: 'Favor top-ranked horses',
    subtext: 'Smaller combinations, more likely to cash',
  },
  {
    key: 'balanced' as RiskLevel,
    icon: 'balance',
    title: 'Balanced',
    description: 'Mix of favorites and value',
    subtext: 'Best of both worlds',
  },
  {
    key: 'aggressive' as RiskLevel,
    icon: 'local_fire_department',
    title: 'Aggressive',
    description: 'Lean into longshots with edge',
    subtext: 'Higher risk, massive potential',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const BetBuilderWizard: React.FC<BetBuilderWizardProps> = ({
  raceNumber,
  trackName,
  scoredHorses,
  getOdds,
  isScratched,
  valuePlay,
  onClose,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [step, setStep] = useState(1);
  const [betStyle, setBetStyle] = useState<BetStyle | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [customBudget, setCustomBudget] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [suggestedBets, setSuggestedBets] = useState<WizardBet[]>([]);
  const [selectedHorses, setSelectedHorses] = useState<Set<number>>(new Set());
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [copyAllSuccess, setCopyAllSuccess] = useState(false);
  const [copiedBetId, setCopiedBetId] = useState<string | null>(null);
  const [expandedBetId, setExpandedBetId] = useState<string | null>(null);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Get active (non-scratched) horses
  const activeHorses = useMemo(() => {
    return scoredHorses
      .filter((h) => !isScratched(h.index) && !h.score.isScratched)
      .sort((a, b) => a.rank - b.rank);
  }, [scoredHorses, isScratched]);

  // Convert to Horse type for calculations
  const horsesForCalc: Horse[] = useMemo(() => {
    return activeHorses.map((h) => {
      const odds = getOdds(h.index, h.horse.morningLineOdds);
      return {
        programNumber: h.horse.programNumber,
        horseName: h.horse.horseName,
        currentOdds: odds,
        decimalOdds: parseOdds(odds),
        rank: h.rank,
      };
    });
  }, [activeHorses, getOdds]);

  // Get value play horse
  const valuePlayHorse = useMemo(() => {
    if (!valuePlay) return null;
    return horsesForCalc.find((h) => h.programNumber === valuePlay.programNumber);
  }, [valuePlay, horsesForCalc]);

  // Calculate effective budget
  const effectiveBudget = budget || (customBudget ? parseFloat(customBudget) : 0);

  // ============================================================================
  // BET SUGGESTION LOGIC
  // ============================================================================

  const generateSuggestedBets = useCallback(() => {
    if (!betStyle || !effectiveBudget || !riskLevel) return;

    const bets: WizardBet[] = [];
    let remainingBudget = effectiveBudget;

    // Get top horses based on rank
    const topHorse = horsesForCalc[0];
    const top2 = horsesForCalc.slice(0, 2);
    const top3 = horsesForCalc.slice(0, 3);
    const top4 = horsesForCalc.slice(0, 4);

    // Find best overlay (highest edge)
    const overlayHorse = valuePlayHorse || topHorse;

    // Decision logic based on budget and risk
    if (effectiveBudget < 10) {
      // Small budget
      if (riskLevel === 'safe') {
        // Single Win bet on #1 ranked horse
        const bet = createBet('WIN', [topHorse], Math.min(effectiveBudget, 5), riskLevel);
        if (bet) bets.push(bet);
      } else if (riskLevel === 'balanced') {
        // Place bet on #1 ranked + Win bet on top overlay
        const placeBet = createBet('PLACE', [topHorse], Math.floor(effectiveBudget * 0.6), riskLevel);
        if (placeBet) bets.push(placeBet);
        if (overlayHorse && overlayHorse !== topHorse) {
          const winBet = createBet('WIN', [overlayHorse], Math.floor(effectiveBudget * 0.4), riskLevel);
          if (winBet) bets.push(winBet);
        }
      } else {
        // Aggressive: Win bet on biggest overlay horse
        const bet = createBet('WIN', [overlayHorse || topHorse], Math.min(effectiveBudget, 5), riskLevel);
        if (bet) bets.push(bet);
      }
    } else if (effectiveBudget <= 20) {
      // Medium-small budget
      if (riskLevel === 'safe') {
        // Win bet on #1 + Place bet on #1
        const winBet = createBet('WIN', [topHorse], Math.floor(effectiveBudget * 0.5), riskLevel);
        const placeBet = createBet('PLACE', [topHorse], Math.floor(effectiveBudget * 0.5), riskLevel);
        if (winBet) bets.push(winBet);
        if (placeBet) bets.push(placeBet);
      } else if (riskLevel === 'balanced') {
        // Win bet + $2 Exacta box top 3
        const winBet = createBet('WIN', [overlayHorse || topHorse], 4, riskLevel);
        if (winBet) bets.push(winBet);
        remainingBudget -= 4;
        const exactaAmount = Math.max(2, Math.floor(remainingBudget / 6));
        const exactaBet = createBet('EXACTA_BOX', top3, exactaAmount, riskLevel);
        if (exactaBet) bets.push(exactaBet);
      } else {
        // Aggressive: $2 Trifecta key: top overlay over next 3
        const keyHorse = overlayHorse || topHorse;
        const withHorses = horsesForCalc.filter((h) => h !== keyHorse).slice(0, 3);
        const triBet = createBet('TRIFECTA_KEY', [keyHorse, ...withHorses], 2, riskLevel);
        if (triBet) bets.push(triBet);
        const winBet = createBet('WIN', [keyHorse], 4, riskLevel);
        if (winBet) bets.push(winBet);
      }
    } else if (effectiveBudget <= 50) {
      // Medium budget
      if (riskLevel === 'safe') {
        // Win/Place on #1 + Exacta box top 2
        const winBet = createBet('WIN', [topHorse], Math.floor(effectiveBudget * 0.3), riskLevel);
        const placeBet = createBet('PLACE', [topHorse], Math.floor(effectiveBudget * 0.3), riskLevel);
        if (winBet) bets.push(winBet);
        if (placeBet) bets.push(placeBet);
        remainingBudget = effectiveBudget * 0.4;
        const exactaAmount = Math.max(2, Math.floor(remainingBudget / 2));
        const exactaBet = createBet('EXACTA_BOX', top2, exactaAmount, riskLevel);
        if (exactaBet) bets.push(exactaBet);
      } else if (riskLevel === 'balanced') {
        // Win bet + Exacta box top 3 + Trifecta key
        const winBet = createBet('WIN', [overlayHorse || topHorse], Math.floor(effectiveBudget * 0.2), riskLevel);
        if (winBet) bets.push(winBet);
        const exactaAmount = Math.max(2, Math.floor(effectiveBudget * 0.3 / 6));
        const exactaBet = createBet('EXACTA_BOX', top3, exactaAmount, riskLevel);
        if (exactaBet) bets.push(exactaBet);
        const keyHorse = overlayHorse || topHorse;
        const withHorses = horsesForCalc.filter((h) => h !== keyHorse).slice(0, 3);
        const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.5 / 6));
        const triBet = createBet('TRIFECTA_KEY', [keyHorse, ...withHorses], triAmount, riskLevel);
        if (triBet) bets.push(triBet);
      } else {
        // Aggressive: Trifecta box top 4 + Win on biggest overlay
        const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.7 / 24));
        const triBet = createBet('TRIFECTA_BOX', top4, triAmount, riskLevel);
        if (triBet) bets.push(triBet);
        const winBet = createBet('WIN', [overlayHorse || topHorse], Math.floor(effectiveBudget * 0.3), riskLevel);
        if (winBet) bets.push(winBet);
      }
    } else {
      // Large budget > $50
      if (riskLevel === 'safe') {
        // Win/Place/Show on #1 + Exacta + Trifecta
        const winBet = createBet('WIN', [topHorse], Math.floor(effectiveBudget * 0.2), riskLevel);
        const placeBet = createBet('PLACE', [topHorse], Math.floor(effectiveBudget * 0.2), riskLevel);
        const showBet = createBet('SHOW', [topHorse], Math.floor(effectiveBudget * 0.1), riskLevel);
        if (winBet) bets.push(winBet);
        if (placeBet) bets.push(placeBet);
        if (showBet) bets.push(showBet);
        const exactaAmount = Math.max(2, Math.floor(effectiveBudget * 0.2 / 2));
        const exactaBet = createBet('EXACTA_BOX', top2, exactaAmount, riskLevel);
        if (exactaBet) bets.push(exactaBet);
        const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.3 / 6));
        const triBet = createBet('TRIFECTA_BOX', top3, triAmount, riskLevel);
        if (triBet) bets.push(triBet);
      } else if (riskLevel === 'balanced') {
        // Full spread: Win, Exacta box, Trifecta box
        const winBet = createBet('WIN', [overlayHorse || topHorse], Math.floor(effectiveBudget * 0.2), riskLevel);
        if (winBet) bets.push(winBet);
        const exactaAmount = Math.max(2, Math.floor(effectiveBudget * 0.3 / 6));
        const exactaBet = createBet('EXACTA_BOX', top3, exactaAmount, riskLevel);
        if (exactaBet) bets.push(exactaBet);
        const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.5 / 24));
        const triBet = createBet('TRIFECTA_BOX', top4, triAmount, riskLevel);
        if (triBet) bets.push(triBet);
      } else {
        // Aggressive: Superfecta box + Trifecta box + Win on overlays
        if (horsesForCalc.length >= 4) {
          const superAmount = Math.max(0.5, Math.floor(effectiveBudget * 0.3 / 24));
          const superBet = createBet('SUPERFECTA_BOX', top4, superAmount, riskLevel);
          if (superBet) bets.push(superBet);
        }
        const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.4 / 24));
        const triBet = createBet('TRIFECTA_BOX', top4, triAmount, riskLevel);
        if (triBet) bets.push(triBet);
        const winBet = createBet('WIN', [overlayHorse || topHorse], Math.floor(effectiveBudget * 0.3), riskLevel);
        if (winBet) bets.push(winBet);
      }
    }

    // Apply bet style modifications
    if (betStyle === 'simple') {
      // Filter to only straight bets
      const simpleBets = bets.filter((b) =>
        ['WIN', 'PLACE', 'SHOW'].includes(b.betType)
      );
      if (simpleBets.length > 0) {
        setSuggestedBets(simpleBets);
        return;
      }
      // Fallback: create simple bets
      const winBet = createBet('WIN', [topHorse], Math.floor(effectiveBudget * 0.5), riskLevel);
      const placeBet = createBet('PLACE', [topHorse], Math.floor(effectiveBudget * 0.5), riskLevel);
      setSuggestedBets([winBet, placeBet].filter(Boolean) as WizardBet[]);
      return;
    }

    if (betStyle === 'crazy') {
      // Add bigger exotic bets
      const existingTypes = new Set(bets.map((b) => b.betType));
      if (!existingTypes.has('SUPERFECTA_BOX') && horsesForCalc.length >= 4) {
        const superAmount = Math.max(0.5, Math.floor(effectiveBudget * 0.2 / 24));
        const superBet = createBet('SUPERFECTA_BOX', top4, superAmount, riskLevel);
        if (superBet) bets.push(superBet);
      }
    }

    setSuggestedBets(bets);
  }, [betStyle, effectiveBudget, riskLevel, horsesForCalc, valuePlayHorse]);

  // Helper function to create a bet
  function createBet(
    betType: string,
    horses: Horse[],
    amount: number,
    risk: RiskLevel
  ): WizardBet | null {
    if (horses.length === 0 || amount < 1) return null;

    const horseNumbers = horses.map((h) => h.programNumber);
    const keyHorseCount = betType.includes('KEY') ? horses.length - 1 : undefined;
    const combinations = calculateCombinations(betType, horses.length, keyHorseCount);
    const totalCost = calculateTotalCost(combinations, amount);
    const potentialReturn = calculatePotentialReturn(betType, horses, amount, combinations);
    const whatToSay = generateWindowScript(betType, horseNumbers, amount);

    const primaryHorse = horses[0];
    const definition = BET_TYPE_DEFINITIONS[betType];

    // Generate "why this bet" explanation
    let whyThisBet = '';
    if (valuePlay && horses.some((h) => h.programNumber === valuePlay.programNumber)) {
      const valueLabel = getValueLabel(valuePlay.valueEdge);
      whyThisBet = `${primaryHorse.horseName} is Furlong's #${primaryHorse.rank} projected finisher with a +${Math.round(valuePlay.valueEdge)}% edge. `;
      whyThisBet += `Current odds are ${primaryHorse.currentOdds} but our analysis says fair odds are ${Math.round(100 / valuePlay.modelWinProb) - 1}-1. `;
      whyThisBet += VALUE_LABEL_EXPLANATIONS[valueLabel] + ' ';
      whyThisBet += risk === 'safe'
        ? `This fits your safe approach — ${primaryHorse.horseName} is a top contender with solid fundamentals.`
        : risk === 'balanced'
        ? `This balances risk and reward — ${primaryHorse.horseName} has upside without being a pure gamble.`
        : `This fits your aggressive style — ${primaryHorse.horseName} is a longshot but the edge is massive.`;
    } else {
      whyThisBet = `${primaryHorse.horseName} is Furlong's #${primaryHorse.rank} ranked horse. `;
      whyThisBet += definition?.definition || '';
    }

    return {
      id: `${betType}-${horseNumbers.join('-')}-${Date.now()}`,
      betType,
      horses,
      amount,
      combinations,
      totalCost,
      potentialReturn,
      whatToSay,
      explanation: definition?.definition || `A ${betType} bet.`,
      whyThisBet,
    };
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleNext = () => {
    if (step === 3) {
      // Generate bets before showing step 4
      generateSuggestedBets();
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    if (isOverrideMode) {
      setIsOverrideMode(false);
      return;
    }
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleStartOver = () => {
    setStep(1);
    setBetStyle(null);
    setBudget(null);
    setCustomBudget('');
    setRiskLevel(null);
    setSuggestedBets([]);
    setSelectedHorses(new Set());
    setIsOverrideMode(false);
  };

  const handleCopyBet = async (bet: WizardBet) => {
    try {
      await navigator.clipboard.writeText(bet.whatToSay);
      setCopiedBetId(bet.id);
      setTimeout(() => setCopiedBetId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleCopyAll = async () => {
    try {
      const allBets = suggestedBets.map((b) => b.whatToSay).join('\n');
      await navigator.clipboard.writeText(allBets);
      setCopyAllSuccess(true);
      setTimeout(() => setCopyAllSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleOverrideClick = () => {
    // Initialize selected horses with current suggestions
    const initialSelected = new Set<number>();
    suggestedBets.forEach((bet) => {
      bet.horses.forEach((h) => initialSelected.add(h.programNumber));
    });
    setSelectedHorses(initialSelected);
    setIsOverrideMode(true);
  };

  const handleHorseToggle = (programNumber: number) => {
    setSelectedHorses((prev) => {
      const next = new Set(prev);
      if (next.has(programNumber)) {
        next.delete(programNumber);
      } else {
        next.add(programNumber);
      }
      return next;
    });
  };

  const handleApplyOverride = () => {
    if (selectedHorses.size === 0) return;

    // Get selected horses in rank order
    const selected = horsesForCalc.filter((h) => selectedHorses.has(h.programNumber));
    if (selected.length === 0) return;

    // Regenerate bets with selected horses
    const bets: WizardBet[] = [];

    if (selected.length === 1) {
      // Single horse - straight bets
      const winBet = createBet('WIN', selected, Math.floor(effectiveBudget * 0.5), riskLevel || 'balanced');
      const placeBet = createBet('PLACE', selected, Math.floor(effectiveBudget * 0.5), riskLevel || 'balanced');
      if (winBet) bets.push(winBet);
      if (placeBet) bets.push(placeBet);
    } else if (selected.length === 2) {
      // Two horses - exacta box
      const exactaBet = createBet('EXACTA_BOX', selected, Math.max(2, Math.floor(effectiveBudget / 2)), riskLevel || 'balanced');
      if (exactaBet) bets.push(exactaBet);
      const winBet = createBet('WIN', [selected[0]], Math.floor(effectiveBudget * 0.25), riskLevel || 'balanced');
      if (winBet) bets.push(winBet);
    } else if (selected.length === 3) {
      // Three horses - trifecta box
      const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.6 / 6));
      const triBet = createBet('TRIFECTA_BOX', selected, triAmount, riskLevel || 'balanced');
      if (triBet) bets.push(triBet);
      const exactaAmount = Math.max(2, Math.floor(effectiveBudget * 0.4 / 6));
      const exactaBet = createBet('EXACTA_BOX', selected, exactaAmount, riskLevel || 'balanced');
      if (exactaBet) bets.push(exactaBet);
    } else {
      // 4+ horses - trifecta and superfecta boxes
      const triAmount = Math.max(1, Math.floor(effectiveBudget * 0.5 / 24));
      const triBet = createBet('TRIFECTA_BOX', selected.slice(0, 4), triAmount, riskLevel || 'balanced');
      if (triBet) bets.push(triBet);
      if (selected.length >= 4) {
        const superAmount = Math.max(0.5, Math.floor(effectiveBudget * 0.3 / 24));
        const superBet = createBet('SUPERFECTA_BOX', selected.slice(0, 4), superAmount, riskLevel || 'balanced');
        if (superBet) bets.push(superBet);
      }
      const winBet = createBet('WIN', [selected[0]], Math.floor(effectiveBudget * 0.2), riskLevel || 'balanced');
      if (winBet) bets.push(winBet);
    }

    setSuggestedBets(bets);
    setIsOverrideMode(false);
  };

  const handleResetToFurlong = () => {
    generateSuggestedBets();
    setIsOverrideMode(false);
  };

  const toggleBetExpand = (betId: string) => {
    setExpandedBetId((prev) => (prev === betId ? null : betId));
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const canProceed = () => {
    switch (step) {
      case 1:
        return betStyle !== null;
      case 2:
        return effectiveBudget > 0;
      case 3:
        return riskLevel !== null;
      default:
        return true;
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalCost = suggestedBets.reduce((sum, b) => sum + b.totalCost, 0);
  const totalMinReturn = suggestedBets.reduce((sum, b) => sum + b.potentialReturn.min, 0);
  const totalMaxReturn = suggestedBets.reduce((sum, b) => sum + b.potentialReturn.max, 0);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bet-builder-wizard">
      {/* Header */}
      <div className="bet-builder-wizard__header">
        <div className="bet-builder-wizard__header-main">
          <div className="bet-builder-wizard__title">
            <span className="bet-builder-wizard__title-icon">&#128295;</span>
            <span className="bet-builder-wizard__title-text">BET BUILDER</span>
            <span className="bet-builder-wizard__title-race">— Race {raceNumber}</span>
          </div>
          <button
            className="bet-builder-wizard__close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="bet-builder-wizard__header-info">
          <span>{trackName}</span>
        </div>

        {/* Progress Bar */}
        <div className="bet-builder-wizard__progress">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`bet-builder-wizard__progress-step ${
                s === step
                  ? 'bet-builder-wizard__progress-step--active'
                  : s < step
                  ? 'bet-builder-wizard__progress-step--complete'
                  : ''
              }`}
            >
              <div className="bet-builder-wizard__progress-dot">
                {s < step ? (
                  <span className="material-icons">check</span>
                ) : (
                  s
                )}
              </div>
              <span className="bet-builder-wizard__progress-label">
                {s === 1 && 'Style'}
                {s === 2 && 'Budget'}
                {s === 3 && 'Risk'}
                {s === 4 && 'Suggestion'}
                {s === 5 && 'Confirm'}
              </span>
            </div>
          ))}
          <div
            className="bet-builder-wizard__progress-bar"
            style={{ width: `${((step - 1) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="bet-builder-wizard__content">
        {/* Step 1: Bet Style */}
        {step === 1 && (
          <div className="bet-builder-wizard__step">
            <h2 className="bet-builder-wizard__step-title">
              What kind of bettor are you today?
            </h2>
            <p className="bet-builder-wizard__step-subtitle">
              This helps us tailor your bet recommendations.
            </p>
            <div className="bet-builder-wizard__options">
              {BET_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`bet-builder-wizard__option ${
                    betStyle === option.key ? 'bet-builder-wizard__option--selected' : ''
                  }`}
                  onClick={() => setBetStyle(option.key)}
                >
                  <div className="bet-builder-wizard__option-icon">{option.icon}</div>
                  <div className="bet-builder-wizard__option-content">
                    <div className="bet-builder-wizard__option-title">{option.title}</div>
                    <div className="bet-builder-wizard__option-desc">{option.description}</div>
                    <div className="bet-builder-wizard__option-subtext">{option.subtext}</div>
                  </div>
                  {betStyle === option.key && (
                    <span className="material-icons bet-builder-wizard__option-check">
                      check_circle
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Budget */}
        {step === 2 && (
          <div className="bet-builder-wizard__step">
            <h2 className="bet-builder-wizard__step-title">
              How much are you betting this race?
            </h2>
            <p className="bet-builder-wizard__step-subtitle">
              This will determine how many combinations you can afford.
            </p>
            <div className="bet-builder-wizard__budget-presets">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`bet-builder-wizard__budget-btn ${
                    budget === preset && !customBudget
                      ? 'bet-builder-wizard__budget-btn--selected'
                      : ''
                  }`}
                  onClick={() => {
                    setBudget(preset);
                    setCustomBudget('');
                  }}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <div className="bet-builder-wizard__budget-custom">
              <label className="bet-builder-wizard__budget-label">
                Or enter custom amount:
              </label>
              <div className="bet-builder-wizard__budget-input-wrap">
                <span className="bet-builder-wizard__budget-prefix">$</span>
                <input
                  type="number"
                  className="bet-builder-wizard__budget-input"
                  placeholder="Enter amount"
                  value={customBudget}
                  onChange={(e) => {
                    setCustomBudget(e.target.value);
                    setBudget(null);
                  }}
                  min={2}
                  max={1000}
                />
              </div>
            </div>
            {effectiveBudget > 0 && (
              <div className="bet-builder-wizard__budget-advice">
                <span className="material-icons">lightbulb</span>
                <span>{getBettingAdvice(effectiveBudget, riskLevel || 'balanced')}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Risk Level */}
        {step === 3 && (
          <div className="bet-builder-wizard__step">
            <h2 className="bet-builder-wizard__step-title">
              How risky do you want to be?
            </h2>
            <p className="bet-builder-wizard__step-subtitle">
              This affects which horses we include and how we structure your bets.
            </p>
            <div className="bet-builder-wizard__options">
              {RISK_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`bet-builder-wizard__option ${
                    riskLevel === option.key ? 'bet-builder-wizard__option--selected' : ''
                  }`}
                  onClick={() => setRiskLevel(option.key)}
                >
                  <div className="bet-builder-wizard__option-icon">
                    <span className="material-icons">{option.icon}</span>
                  </div>
                  <div className="bet-builder-wizard__option-content">
                    <div className="bet-builder-wizard__option-title">{option.title}</div>
                    <div className="bet-builder-wizard__option-desc">{option.description}</div>
                    <div className="bet-builder-wizard__option-subtext">{option.subtext}</div>
                  </div>
                  {riskLevel === option.key && (
                    <span className="material-icons bet-builder-wizard__option-check">
                      check_circle
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Furlong's Suggestion */}
        {step === 4 && !isOverrideMode && (
          <div className="bet-builder-wizard__step">
            <h2 className="bet-builder-wizard__step-title">
              <span className="bet-builder-wizard__suggestion-icon">&#128161;</span>
              Based on your answers, Furlong suggests...
            </h2>

            {/* Value Play Badge */}
            {valuePlay && (
              <div className="bet-builder-wizard__value-badge">
                <span className="bet-builder-wizard__value-icon">&#128293;</span>
                <div className="bet-builder-wizard__value-content">
                  <div className="bet-builder-wizard__value-label">VALUE PLAY DETECTED</div>
                  <div className="bet-builder-wizard__value-horse">
                    #{valuePlay.programNumber} {valuePlay.horseName}
                  </div>
                  <div className="bet-builder-wizard__value-edge">
                    {valuePlay.currentOdds} odds | +{Math.round(valuePlay.valueEdge)}% edge
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Bets */}
            <div className="bet-builder-wizard__bets">
              {suggestedBets.map((bet, index) => (
                <div key={bet.id} className="bet-builder-wizard__bet-card">
                  <div className="bet-builder-wizard__bet-header">
                    <div className="bet-builder-wizard__bet-title">
                      <span className="bet-builder-wizard__bet-num">BET {index + 1}:</span>
                      <span className="bet-builder-wizard__bet-type">
                        {bet.betType.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="bet-builder-wizard__bet-cost">${bet.totalCost}</div>
                  </div>

                  <div className="bet-builder-wizard__bet-horses">
                    #{bet.horses.map((h) => h.programNumber).join(', #')}{' '}
                    {bet.horses.length === 1 && bet.horses[0].horseName}
                  </div>

                  {bet.combinations > 1 && (
                    <div className="bet-builder-wizard__bet-combos">
                      {bet.combinations} combinations @ ${bet.amount} each
                    </div>
                  )}

                  <div className="bet-builder-wizard__bet-return">
                    Potential return: ${bet.potentialReturn.min}-${bet.potentialReturn.max}
                  </div>

                  {/* What to Say */}
                  <div className="bet-builder-wizard__bet-script">
                    <div className="bet-builder-wizard__bet-script-header">
                      <span className="material-icons">record_voice_over</span>
                      <span>WHAT TO SAY AT THE WINDOW:</span>
                    </div>
                    <div className="bet-builder-wizard__bet-script-box">
                      <span className="bet-builder-wizard__bet-script-text">
                        "{bet.whatToSay}"
                      </span>
                      <button
                        className={`bet-builder-wizard__copy-btn ${
                          copiedBetId === bet.id ? 'bet-builder-wizard__copy-btn--copied' : ''
                        }`}
                        onClick={() => handleCopyBet(bet)}
                      >
                        <span className="material-icons">
                          {copiedBetId === bet.id ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedBetId === bet.id ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable: Why This Bet */}
                  <details className="bet-builder-wizard__bet-details">
                    <summary className="bet-builder-wizard__bet-summary">
                      <span className="material-icons">help_outline</span>
                      Why this bet?
                    </summary>
                    <div className="bet-builder-wizard__bet-explanation">
                      {bet.whyThisBet}
                    </div>
                  </details>

                  {/* Expandable: What's a [Bet Type]? */}
                  <details className="bet-builder-wizard__bet-details">
                    <summary className="bet-builder-wizard__bet-summary">
                      <span className="material-icons">info_outline</span>
                      What's {bet.betType === 'EXACTA_BOX' ? 'an' : 'a'}{' '}
                      {bet.betType.replace('_', ' ')}?
                    </summary>
                    <div className="bet-builder-wizard__bet-explanation">
                      {BET_TYPE_DEFINITIONS[bet.betType]?.definition || bet.explanation}
                    </div>
                  </details>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bet-builder-wizard__summary">
              <div className="bet-builder-wizard__summary-row">
                <span>Total Cost:</span>
                <span className="bet-builder-wizard__summary-value">${totalCost}</span>
              </div>
              <div className="bet-builder-wizard__summary-row">
                <span>Potential Return:</span>
                <span className="bet-builder-wizard__summary-value bet-builder-wizard__summary-value--highlight">
                  ${totalMinReturn} - ${totalMaxReturn}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Override Mode */}
        {step === 4 && isOverrideMode && (
          <div className="bet-builder-wizard__step">
            <h2 className="bet-builder-wizard__step-title">
              <span className="material-icons">edit</span>
              Change the horses
            </h2>
            <p className="bet-builder-wizard__step-subtitle">
              Select which horses you want to include in your bets.
            </p>

            <div className="bet-builder-wizard__horse-list">
              {horsesForCalc.map((horse) => {
                const isSelected = selectedHorses.has(horse.programNumber);
                const isValuePlay = valuePlay?.programNumber === horse.programNumber;
                const edge = valuePlay && isValuePlay ? valuePlay.valueEdge : 0;
                const valueLabel = getValueLabel(edge);

                return (
                  <button
                    key={horse.programNumber}
                    className={`bet-builder-wizard__horse-item ${
                      isSelected ? 'bet-builder-wizard__horse-item--selected' : ''
                    } ${isValuePlay ? 'bet-builder-wizard__horse-item--value' : ''}`}
                    onClick={() => handleHorseToggle(horse.programNumber)}
                  >
                    <div className="bet-builder-wizard__horse-check">
                      {isSelected ? (
                        <span className="material-icons">check_box</span>
                      ) : (
                        <span className="material-icons">check_box_outline_blank</span>
                      )}
                    </div>
                    <div className="bet-builder-wizard__horse-pp">
                      #{horse.programNumber}
                    </div>
                    <div className="bet-builder-wizard__horse-info">
                      <div className="bet-builder-wizard__horse-name">
                        {horse.horseName}
                      </div>
                      <div className="bet-builder-wizard__horse-meta">
                        Rank #{horse.rank} | {horse.currentOdds}
                      </div>
                    </div>
                    <div className="bet-builder-wizard__horse-label">
                      {isValuePlay && (
                        <span className="bet-builder-wizard__horse-badge bet-builder-wizard__horse-badge--value">
                          VALUE
                        </span>
                      )}
                      {edge > 10 && (
                        <span className="bet-builder-wizard__horse-badge bet-builder-wizard__horse-badge--edge">
                          +{Math.round(edge)}%
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bet-builder-wizard__override-actions">
              <button
                className="bet-builder-wizard__btn bet-builder-wizard__btn--secondary"
                onClick={handleResetToFurlong}
              >
                <span className="material-icons">refresh</span>
                Reset to Furlong's Pick
              </button>
              <button
                className="bet-builder-wizard__btn bet-builder-wizard__btn--primary"
                onClick={handleApplyOverride}
                disabled={selectedHorses.size === 0}
              >
                <span className="material-icons">check</span>
                Apply Changes ({selectedHorses.size} horses)
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === 5 && (
          <div className="bet-builder-wizard__step">
            <h2 className="bet-builder-wizard__step-title">
              <span className="material-icons">check_circle</span>
              Your bets are ready!
            </h2>

            {/* Final Summary */}
            <div className="bet-builder-wizard__final-summary">
              <div className="bet-builder-wizard__final-header">
                <span className="material-icons">receipt_long</span>
                <span>BETTING SLIP</span>
              </div>
              <div className="bet-builder-wizard__final-track">
                {trackName} | Race {raceNumber}
              </div>

              {suggestedBets.map((bet, index) => (
                <div key={bet.id} className="bet-builder-wizard__final-bet">
                  <div className="bet-builder-wizard__final-bet-type">
                    {index + 1}. {bet.betType.replace('_', ' ')}
                  </div>
                  <div className="bet-builder-wizard__final-bet-script">
                    {bet.whatToSay}
                  </div>
                  <div className="bet-builder-wizard__final-bet-cost">
                    ${bet.totalCost}
                  </div>
                </div>
              ))}

              <div className="bet-builder-wizard__final-total">
                <span>TOTAL:</span>
                <span>${totalCost}</span>
              </div>
            </div>

            {/* Copy All Button */}
            <button
              className={`bet-builder-wizard__copy-all ${
                copyAllSuccess ? 'bet-builder-wizard__copy-all--success' : ''
              }`}
              onClick={handleCopyAll}
            >
              {copyAllSuccess ? (
                <>
                  <span className="material-icons">check</span>
                  COPIED TO CLIPBOARD!
                </>
              ) : (
                <>
                  <span className="material-icons">content_copy</span>
                  COPY ALL BETS
                </>
              )}
            </button>

            <p className="bet-builder-wizard__final-tip">
              <span className="material-icons">tips_and_updates</span>
              Tip: Say these exact phrases at the betting window or type them into your betting app.
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bet-builder-wizard__footer">
        {step > 1 && !isOverrideMode && (
          <button
            className="bet-builder-wizard__btn bet-builder-wizard__btn--back"
            onClick={handleBack}
          >
            <span className="material-icons">arrow_back</span>
            Back
          </button>
        )}

        {isOverrideMode && (
          <button
            className="bet-builder-wizard__btn bet-builder-wizard__btn--back"
            onClick={handleBack}
          >
            <span className="material-icons">arrow_back</span>
            Cancel
          </button>
        )}

        <div className="bet-builder-wizard__footer-spacer" />

        {step < 4 && (
          <button
            className="bet-builder-wizard__btn bet-builder-wizard__btn--primary"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Next
            <span className="material-icons">arrow_forward</span>
          </button>
        )}

        {step === 4 && !isOverrideMode && (
          <>
            <button
              className="bet-builder-wizard__btn bet-builder-wizard__btn--secondary"
              onClick={handleOverrideClick}
            >
              <span className="material-icons">edit</span>
              Change the horses
            </button>
            <button
              className="bet-builder-wizard__btn bet-builder-wizard__btn--primary"
              onClick={handleNext}
            >
              <span className="material-icons">check</span>
              Yes, copy my bets
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <button
              className="bet-builder-wizard__btn bet-builder-wizard__btn--secondary"
              onClick={handleStartOver}
            >
              <span className="material-icons">refresh</span>
              Start Over
            </button>
            <button
              className="bet-builder-wizard__btn bet-builder-wizard__btn--primary"
              onClick={onClose}
            >
              <span className="material-icons">check</span>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BetBuilderWizard;
