/**
 * BetModeContainer Component
 *
 * SINGLE-SCREEN betting interface with two modes:
 * 1. Quick View: Auto-generated bets based on value analysis
 * 2. Bet Builder: Interactive two-column interface for custom bet building
 *
 * Budget and style are inline dropdowns that recalculate instantly.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BetModeHeader } from './BetModeHeader';
import { BetResults } from './BetResults';
import { InlineSettings } from './InlineSettings';
import { RaceNavigation } from './RaceNavigation';
import { DayPlanModal } from './DayPlanModal';
import { BetBuilderInterface } from './BetBuilderInterface';
import { calculateBets, getContenders } from '../../lib/betting/calculateBets';
import { allocateDayBudget } from '../../lib/betting/allocateDayBudget';
import { analyzeRaceValue } from '../../hooks/useValueDetection';
import { generateCompleteTicket } from '../../lib/betting/whatToSay';
import type { RiskStyle, BetCalculationResult, SingleBet } from '../../lib/betting/betTypes';
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
const STORAGE_KEY_BUDGET = 'betmode_budget';
const STORAGE_KEY_STYLE = 'betmode_style';

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
  // STATE - Bet Builder View
  // ============================================================================

  const [showBetBuilder, setShowBetBuilder] = useState(false);

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
  // BET CALCULATION
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
  // RENDER - BET BUILDER MODE
  // ============================================================================

  if (showBetBuilder && viewedRaceData) {
    return (
      <BetBuilderInterface
        race={viewedRaceData}
        raceNumber={viewedRaceNumber}
        trackName={trackName}
        scoredHorses={viewedScoredHorses}
        getOdds={getOdds}
        isScratched={isScratched}
        onClose={() => setShowBetBuilder(false)}
      />
    );
  }

  // ============================================================================
  // RENDER - QUICK VIEW MODE
  // ============================================================================

  return (
    <div className="bet-mode-container bet-mode-container--single-screen">
      {/* Header with close button */}
      <BetModeHeader raceNumber={viewedRaceNumber} trackName={trackName} onClose={onClose} />

      {/* View Toggle + Inline Settings Bar */}
      <div className="bet-mode-view-toggle">
        <button
          className={`bet-mode-view-toggle__btn ${!showBetBuilder ? 'bet-mode-view-toggle__btn--active' : ''}`}
          onClick={() => setShowBetBuilder(false)}
        >
          <span className="material-icons">flash_on</span>
          <span>Quick Bets</span>
        </button>
        <button
          className={`bet-mode-view-toggle__btn ${showBetBuilder ? 'bet-mode-view-toggle__btn--active' : ''}`}
          onClick={() => setShowBetBuilder(true)}
        >
          <span className="material-icons">build</span>
          <span>Bet Builder</span>
        </button>
      </div>

      {/* Inline Settings Bar */}
      <InlineSettings
        budget={budget}
        onBudgetChange={setBudget}
        riskStyle={riskStyle}
        onStyleChange={setRiskStyle}
        onOpenDayPlan={allRaces.length > 1 ? handleOpenDayPlan : undefined}
        isDayPlanActive={isDayPlanActive}
        dayPlanBudgetLabel={dayPlanBudgetLabel}
      />

      {/* Main Content - Bet Results */}
      <div className="bet-mode-content bet-mode-content--no-padding">
        {calculationResult ? (
          <BetResults
            result={calculationResult}
            raceNumber={viewedRaceNumber}
            trackName={trackName}
            budget={currentBudget}
            riskStyle={riskStyle}
            onChangeOptions={() => {}} // No longer needed - settings are inline
            valueAnalysis={viewedValueAnalysis}
            // Day mode props
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
            <p>Calculating your bets...</p>
          </div>
        )}
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
