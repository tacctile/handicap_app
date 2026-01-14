/**
 * BetModeContainer Component
 *
 * SINGLE-SCREEN betting interface with user horse selection.
 * - Budget, style, and bet type are inline dropdowns
 * - User can select horses for their custom bet
 * - Furlong's auto-generated picks shown below
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BetModeHeader } from './BetModeHeader';
import { BetResults } from './BetResults';
import { InlineSettings } from './InlineSettings';
import { RaceNavigation } from './RaceNavigation';
import { DayPlanModal } from './DayPlanModal';
import { HorseSelector } from './HorseSelector';
import { UserBetCard } from './UserBetCard';
import { calculateBets, getContenders } from '../../lib/betting/calculateBets';
import { allocateDayBudget } from '../../lib/betting/allocateDayBudget';
import { analyzeRaceValue } from '../../hooks/useValueDetection';
import { generateCompleteTicket, generateWhatToSay } from '../../lib/betting/whatToSay';
import { estimateBetReturn, parseOddsToDecimal } from '../../lib/betting/returnEstimates';
import type {
  RiskStyle,
  BetCalculationResult,
  SingleBet,
  UserSelectableBetType,
  BetTypeConfig,
} from '../../lib/betting/betTypes';
import { USER_BET_TYPE_CONFIGS } from '../../lib/betting/betTypes';
import type { RaceAllocation } from '../../lib/betting/allocateDayBudget';
import type { ParsedRace } from '../../types/drf';
import type { RaceValueAnalysis } from '../../hooks/useValueDetection';
import type { ScoredHorse } from '../../lib/scoring';
import './BetModeContainer.css';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BUDGET = 20;
const DEFAULT_STYLE: RiskStyle = 'balanced';
const DEFAULT_BET_TYPE: UserSelectableBetType = 'WIN';
const STORAGE_KEY_BUDGET = 'betmode_budget';
const STORAGE_KEY_STYLE = 'betmode_style';
const STORAGE_KEY_BET_TYPE = 'betmode_bet_type';

// ============================================================================
// TYPES
// ============================================================================

interface BetModeContainerProps {
  /** Current race data */
  race: ParsedRace | undefined;
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Track name for display */
  trackName?: string;
  /** Value analysis for the race */
  valueAnalysis?: RaceValueAnalysis | null;
  /** Scored horses with rankings */
  scoredHorses?: ScoredHorse[];
  /** Function to get current odds for a horse */
  getOdds?: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched?: (index: number) => boolean;
  /** Callback to close bet mode */
  onClose: () => void;
  /** All races for day planning */
  allRaces?: ParsedRace[];
  /** All scored horses for each race */
  allScoredHorses?: ScoredHorse[][];
  /** Callback to navigate to a specific race */
  onNavigateToRace?: (raceIndex: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BetModeContainer: React.FC<BetModeContainerProps> = ({
  race,
  raceNumber,
  trackName = 'Track',
  valueAnalysis,
  scoredHorses = [],
  getOdds = (_index, defaultOdds) => defaultOdds,
  isScratched = () => false,
  onClose,
  allRaces = [],
  allScoredHorses = [],
  onNavigateToRace,
}) => {
  // ============================================================================
  // STATE - Settings (with localStorage persistence)
  // ============================================================================

  const [budget, setBudget] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_BUDGET);
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 2 && num <= 1000) return num;
      }
    }
    return DEFAULT_BUDGET;
  });

  const [riskStyle, setRiskStyle] = useState<RiskStyle>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_STYLE) as RiskStyle | null;
      if (saved && ['safe', 'balanced', 'aggressive'].includes(saved)) return saved;
    }
    return DEFAULT_STYLE;
  });

  const [betType, setBetType] = useState<UserSelectableBetType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_BET_TYPE) as UserSelectableBetType | null;
      const validTypes = USER_BET_TYPE_CONFIGS.map((c) => c.type);
      if (saved && validTypes.includes(saved)) return saved;
    }
    return DEFAULT_BET_TYPE;
  });

  // ============================================================================
  // STATE - User Horse Selections
  // ============================================================================

  const [selectedHorses, setSelectedHorses] = useState<number[]>([]);

  // ============================================================================
  // STATE - Day Plan
  // ============================================================================

  const [showDayPlanModal, setShowDayPlanModal] = useState(false);
  const [isDayPlanActive, setIsDayPlanActive] = useState(false);
  const [dayPlanBankroll, setDayPlanBankroll] = useState(500);
  const [raceAllocations, setRaceAllocations] = useState<RaceAllocation[]>([]);
  const [multiRaceReserve, setMultiRaceReserve] = useState(0);
  const [completedRaces, setCompletedRaces] = useState<number[]>([]);

  // ============================================================================
  // STATE - Copy feedback
  // ============================================================================

  const [copySuccess, setCopySuccess] = useState(false);

  // ============================================================================
  // STATE - Current viewed race (for navigation)
  // ============================================================================

  const [viewedRaceNumber, setViewedRaceNumber] = useState(raceNumber);

  // Sync with external race number when it changes
  useEffect(() => {
    setViewedRaceNumber(raceNumber);
  }, [raceNumber]);

  // ============================================================================
  // PERSIST SETTINGS
  // ============================================================================

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BUDGET, String(budget));
    }
  }, [budget]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_STYLE, riskStyle);
    }
  }, [riskStyle]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BET_TYPE, betType);
    }
  }, [betType]);

  // ============================================================================
  // BET TYPE CONFIG
  // ============================================================================

  const betTypeConfig = useMemo(() => {
    return USER_BET_TYPE_CONFIGS.find((c) => c.type === betType) || USER_BET_TYPE_CONFIGS[0]!;
  }, [betType]);

  // ============================================================================
  // GET DATA FOR VIEWED RACE
  // ============================================================================

  const viewedRaceIndex = viewedRaceNumber - 1;
  const viewedRaceData = allRaces[viewedRaceIndex] || race;
  const viewedScoredHorses = allScoredHorses[viewedRaceIndex] || scoredHorses;

  // Value analysis for viewed race
  const viewedValueAnalysis = useMemo(() => {
    if (viewedRaceNumber === raceNumber && valueAnalysis) {
      return valueAnalysis;
    }
    if (viewedScoredHorses.length > 0) {
      return analyzeRaceValue(viewedScoredHorses, getOdds, isScratched);
    }
    return null;
  }, [viewedRaceNumber, raceNumber, valueAnalysis, viewedScoredHorses, getOdds, isScratched]);

  // ============================================================================
  // CONTENDERS
  // ============================================================================

  const contenders = useMemo(() => {
    return getContenders(viewedScoredHorses, isScratched, 4);
  }, [viewedScoredHorses, isScratched]);

  // ============================================================================
  // AUTO-FILL HORSE SELECTIONS
  // ============================================================================

  // Auto-fill horses when bet type changes, race changes, or on initial load
  useEffect(() => {
    if (viewedScoredHorses.length === 0) return;

    // Get top horses sorted by rank (non-scratched)
    const availableHorses = viewedScoredHorses
      .filter((h) => !isScratched(h.index) && !h.score.isScratched)
      .sort((a, b) => a.rank - b.rank);

    if (availableHorses.length === 0) return;

    // Fill with top N horses based on bet type
    const numHorses = betTypeConfig.defaultHorses;
    const newSelections = availableHorses
      .slice(0, Math.min(numHorses, availableHorses.length))
      .map((h) => h.horse.programNumber);

    setSelectedHorses(newSelections);
  }, [betType, viewedRaceNumber, viewedScoredHorses, isScratched, betTypeConfig.defaultHorses]);

  // ============================================================================
  // USER BET CALCULATION
  // ============================================================================

  const userBet: SingleBet | null = useMemo(() => {
    if (selectedHorses.length === 0 || viewedScoredHorses.length === 0) return null;
    if (selectedHorses.length < betTypeConfig.minHorses) return null;

    // Get horse data for selected horses
    const selectedHorseData = selectedHorses
      .map((pp) => viewedScoredHorses.find((h) => h.horse.programNumber === pp))
      .filter((h): h is ScoredHorse => h !== undefined);

    if (selectedHorseData.length < betTypeConfig.minHorses) return null;

    // Calculate combinations
    const n = selectedHorses.length;
    let combinations = 1;
    switch (betType) {
      case 'WIN':
      case 'PLACE':
      case 'SHOW':
      case 'EXACTA':
      case 'QUINELLA':
      case 'TRIFECTA':
        combinations = 1;
        break;
      case 'EXACTA_BOX':
        combinations = n * (n - 1);
        break;
      case 'TRIFECTA_BOX':
        combinations = n * (n - 1) * (n - 2);
        break;
      case 'SUPERFECTA_BOX':
        combinations = n * (n - 1) * (n - 2) * (n - 3);
        break;
    }

    // Calculate bet amount per combination
    const perComboAmount = Math.max(2, Math.round(budget / combinations));
    const totalCost = perComboAmount * combinations;

    // Get odds for return estimation
    const odds = selectedHorseData.map((h) =>
      parseOddsToDecimal(getOdds(h.index, h.horse.morningLineOdds))
    );

    // Estimate returns
    const returns = estimateBetReturn(betType, odds, perComboAmount, combinations);

    // Generate what to say
    const whatToSay = generateWhatToSay(betType, selectedHorses, perComboAmount);

    return {
      id: `user-bet-${Date.now()}`,
      type: betType,
      horses: selectedHorses,
      horseNames: selectedHorseData.map((h) => h.horse.horseName),
      amount: perComboAmount,
      combinations,
      totalCost,
      potentialReturn: returns,
      explanation: `Your custom ${betTypeConfig.name} bet`,
      whatToSay,
      priority: 0,
    };
  }, [selectedHorses, viewedScoredHorses, betType, betTypeConfig, budget, getOdds]);

  // ============================================================================
  // HANDLE BET TYPE CHANGE
  // ============================================================================

  const handleBetTypeChange = useCallback((newType: UserSelectableBetType) => {
    setBetType(newType);
    // Horse selections will be auto-updated by the effect above
  }, []);

  // ============================================================================
  // BET CALCULATION (Furlong's Picks)
  // ============================================================================

  const calculationResult: BetCalculationResult | null = useMemo(() => {
    if (!viewedRaceData?.horses || !viewedValueAnalysis || viewedScoredHorses.length === 0) {
      return null;
    }

    // Get budget - from day plan if active, otherwise from inline setting
    const raceBudget = isDayPlanActive
      ? raceAllocations.find((a) => a.raceNumber === viewedRaceNumber)?.allocatedBudget || budget
      : budget;

    return calculateBets({
      raceHeader: viewedRaceData.header,
      horses: viewedRaceData.horses,
      scoredHorses: viewedScoredHorses,
      budget: raceBudget,
      riskStyle,
      valueAnalysis: viewedValueAnalysis,
      valuePlay: viewedValueAnalysis.primaryValuePlay,
      contenders,
      getOdds,
      isScratched,
    });
  }, [
    viewedRaceData,
    viewedValueAnalysis,
    viewedScoredHorses,
    budget,
    riskStyle,
    contenders,
    getOdds,
    isScratched,
    isDayPlanActive,
    raceAllocations,
    viewedRaceNumber,
  ]);

  // ============================================================================
  // DAY PLAN HANDLERS
  // ============================================================================

  const handleOpenDayPlan = () => {
    if (isDayPlanActive) {
      // Show existing plan
      setShowDayPlanModal(true);
    } else {
      // Generate new plan
      const raceAnalyses = allRaces.map((_raceData, index) => {
        const raceScored = allScoredHorses[index] || [];
        if (raceScored.length === 0) {
          return {
            verdict: 'PASS' as const,
            confidence: 'LOW' as const,
            verdictReason: 'No data available',
            valuePlays: [],
            primaryValuePlay: null,
            secondaryValuePlays: [],
            hasValuePlay: false,
            topPick: null,
            totalFieldScore: 0,
            activeHorseCount: 0,
            closestToThreshold: null,
          };
        }
        return analyzeRaceValue(raceScored, getOdds, isScratched);
      });

      const allocation = allocateDayBudget({
        totalBankroll: dayPlanBankroll,
        raceAnalyses,
        trackName,
        riskStyle,
      });

      setRaceAllocations(allocation.raceAllocations);
      setMultiRaceReserve(allocation.multiRaceReserve);
      setShowDayPlanModal(true);
    }
  };

  const handleApplyDayPlan = () => {
    setIsDayPlanActive(true);
    setShowDayPlanModal(false);
  };

  const handleClearDayPlan = () => {
    setIsDayPlanActive(false);
    setRaceAllocations([]);
    setMultiRaceReserve(0);
    setCompletedRaces([]);
    setShowDayPlanModal(false);
  };

  const handleDayPlanBankrollChange = (newBankroll: number) => {
    setDayPlanBankroll(newBankroll);

    // Recalculate allocations
    const raceAnalyses = allRaces.map((_raceData, index) => {
      const raceScored = allScoredHorses[index] || [];
      if (raceScored.length === 0) {
        return {
          verdict: 'PASS' as const,
          confidence: 'LOW' as const,
          verdictReason: 'No data available',
          valuePlays: [],
          primaryValuePlay: null,
          secondaryValuePlays: [],
          hasValuePlay: false,
          topPick: null,
          totalFieldScore: 0,
          activeHorseCount: 0,
          closestToThreshold: null,
        };
      }
      return analyzeRaceValue(raceScored, getOdds, isScratched);
    });

    const allocation = allocateDayBudget({
      totalBankroll: newBankroll,
      raceAnalyses,
      trackName,
      riskStyle,
    });

    setRaceAllocations(allocation.raceAllocations);
    setMultiRaceReserve(allocation.multiRaceReserve);
  };

  // ============================================================================
  // RACE NAVIGATION
  // ============================================================================

  const handleRaceSelect = useCallback(
    (raceNum: number) => {
      setViewedRaceNumber(raceNum);
      if (onNavigateToRace) {
        onNavigateToRace(raceNum - 1);
      }
    },
    [onNavigateToRace]
  );

  // ============================================================================
  // COPY ALL BETS
  // ============================================================================

  const handleCopyAll = useCallback(async () => {
    if (!calculationResult) return;

    try {
      const ticket = generateCompleteTicket(
        viewedRaceNumber,
        trackName,
        calculationResult.bets.map((b: SingleBet) => ({
          betType: b.type,
          horses: b.horses,
          amount: b.amount,
          totalCost: b.totalCost,
        }))
      );
      await navigator.clipboard.writeText(ticket);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [calculationResult, viewedRaceNumber, trackName]);

  // ============================================================================
  // MARK RACE AS BET (for day plan)
  // ============================================================================

  const handleMarkAsBet = useCallback(() => {
    if (!completedRaces.includes(viewedRaceNumber)) {
      setCompletedRaces((prev) => [...prev, viewedRaceNumber]);
    }
  }, [viewedRaceNumber, completedRaces]);

  // ============================================================================
  // GET CURRENT BUDGET FOR DISPLAY
  // ============================================================================

  const currentBudget = isDayPlanActive
    ? raceAllocations.find((a) => a.raceNumber === viewedRaceNumber)?.allocatedBudget || budget
    : budget;

  const dayPlanBudgetLabel = isDayPlanActive ? `Day Plan: $${currentBudget}` : undefined;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bet-mode-container bet-mode-container--single-screen">
      {/* Header with close button */}
      <BetModeHeader raceNumber={viewedRaceNumber} trackName={trackName} onClose={onClose} />

      {/* Inline Settings Bar */}
      <InlineSettings
        budget={budget}
        onBudgetChange={setBudget}
        riskStyle={riskStyle}
        onStyleChange={setRiskStyle}
        betType={betType}
        onBetTypeChange={handleBetTypeChange}
        onOpenDayPlan={allRaces.length > 1 ? handleOpenDayPlan : undefined}
        isDayPlanActive={isDayPlanActive}
        dayPlanBudgetLabel={dayPlanBudgetLabel}
      />

      {/* Main Content */}
      <div className="bet-mode-content bet-mode-content--no-padding">
        {/* User Bet Builder Section */}
        <div className="bet-mode-section bet-mode-section--user-bet">
          <div className="bet-mode-section__header">
            <span className="bet-mode-section__title">YOUR BET</span>
          </div>

          {/* Horse Selector */}
          {viewedScoredHorses.length > 0 && (
            <HorseSelector
              scoredHorses={viewedScoredHorses}
              selectedHorses={selectedHorses}
              onSelectionChange={setSelectedHorses}
              betTypeConfig={betTypeConfig}
              getOdds={getOdds}
              isScratched={isScratched}
            />
          )}

          {/* User's Bet Card */}
          {userBet && (
            <UserBetCard
              bet={userBet}
              betTypeConfig={betTypeConfig}
            />
          )}
        </div>

        {/* Divider */}
        <div className="bet-mode-divider">
          <span className="bet-mode-divider__line" />
        </div>

        {/* Furlong's Picks Section */}
        <div className="bet-mode-section bet-mode-section--furlongs">
          <div className="bet-mode-section__header">
            <span className="bet-mode-section__icon">🏇</span>
            <span className="bet-mode-section__title">FURLONG'S PICKS</span>
            <span className="bet-mode-section__subtitle">Auto-generated recommendations</span>
          </div>

          {calculationResult ? (
            <BetResults
              result={calculationResult}
              raceNumber={viewedRaceNumber}
              trackName={trackName}
              budget={currentBudget}
              riskStyle={riskStyle}
              onChangeOptions={() => {}}
              valueAnalysis={viewedValueAnalysis}
              isDayMode={isDayPlanActive}
              isRaceCompleted={completedRaces.includes(viewedRaceNumber)}
              onMarkAsBet={
                isDayPlanActive && !completedRaces.includes(viewedRaceNumber)
                  ? handleMarkAsBet
                  : undefined
              }
            />
          ) : (
            <div className="bet-mode-loading">
              <span className="bet-mode-loading__icon">⏳</span>
              <p>Calculating recommendations...</p>
            </div>
          )}
        </div>
      </div>

      {/* Race Navigation */}
      {allRaces.length > 1 && (
        <RaceNavigation
          currentRace={viewedRaceNumber}
          totalRaces={allRaces.length}
          onRaceSelect={handleRaceSelect}
          onCopyAll={handleCopyAll}
          copySuccess={copySuccess}
          raceAllocations={isDayPlanActive ? raceAllocations : undefined}
          completedRaces={completedRaces}
        />
      )}

      {/* Day Plan Modal */}
      {showDayPlanModal && (
        <DayPlanModal
          isOpen={showDayPlanModal}
          onClose={() => setShowDayPlanModal(false)}
          raceAllocations={raceAllocations}
          totalBankroll={dayPlanBankroll}
          onBankrollChange={handleDayPlanBankrollChange}
          riskStyle={riskStyle}
          multiRaceReserve={multiRaceReserve}
          onApply={handleApplyDayPlan}
          onClear={isDayPlanActive ? handleClearDayPlan : undefined}
          isExisting={isDayPlanActive}
        />
      )}
    </div>
  );
};

export default BetModeContainer;
