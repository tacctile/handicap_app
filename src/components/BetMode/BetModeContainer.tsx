/**
 * BetModeContainer Component
 *
 * Full-screen container for the betting interface.
 * Takes over the main content area when bet mode is active.
 *
 * Supports two modes:
 * - Single Race: Budget → Style → Results (original flow)
 * - Plan My Day: Full day planning with budget allocation across all races
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BetModeHeader } from './BetModeHeader';
import { BudgetStep } from './BudgetStep';
import { StyleStep } from './StyleStep';
import { BetResults } from './BetResults';
import { ModeSelection, type BetModeType } from './ModeSelection';
import {
  DayBankrollStep,
  DayExperienceStep,
  DayStyleStep,
  DayOverview,
  DayProgress,
  DayComplete,
  BudgetAdjustModal,
} from './DaySetup';
import { calculateBets, getContenders } from '../../lib/betting/calculateBets';
import { allocateDayBudget, adjustRaceBudget } from '../../lib/betting/allocateDayBudget';
import type { RaceAllocation } from '../../lib/betting/allocateDayBudget';
import {
  createDaySession,
  saveDaySession,
  loadDaySession,
  clearDaySession,
  hasActiveDaySession,
  markRaceAsBet,
  updateRaceAllocations,
  isSessionComplete,
  getRaceAllocation,
  isRaceCompleted,
  type DaySession,
} from '../../lib/betting/daySession';
import { analyzeRaceValue } from '../../hooks/useValueDetection';
import type { RiskStyle, ExperienceLevel, BetCalculationResult } from '../../lib/betting/betTypes';
import type { ParsedRace } from '../../types/drf';
import type { RaceValueAnalysis } from '../../hooks/useValueDetection';
import type { ScoredHorse } from '../../lib/scoring';
import './BetModeContainer.css';

// ============================================================================
// TYPES
// ============================================================================

type BetFlowStep = 'mode-select' | 'budget' | 'style' | 'results';
type DayFlowStep = 'bankroll' | 'experience' | 'style' | 'overview' | 'race-bets' | 'complete';

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
  /** All races for day planning (optional) */
  allRaces?: ParsedRace[];
  /** All scored horses for each race (optional) */
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
  // MODE STATE
  // ============================================================================

  const [betMode, setBetMode] = useState<BetModeType | null>(null);

  // ============================================================================
  // SINGLE RACE FLOW STATE
  // ============================================================================

  const [flowStep, setFlowStep] = useState<BetFlowStep>('mode-select');
  const [budget, setBudget] = useState<number | null>(null);
  const [riskStyle, setRiskStyle] = useState<RiskStyle | null>(null);
  const [calculationResult, setCalculationResult] = useState<BetCalculationResult | null>(null);

  // ============================================================================
  // DAY FLOW STATE
  // ============================================================================

  const [dayFlowStep, setDayFlowStep] = useState<DayFlowStep>('bankroll');
  const [dayBankroll, setDayBankroll] = useState<number | null>(null);
  const [dayExperience, setDayExperience] = useState<ExperienceLevel | null>(null);
  const [dayRiskStyle, setDayRiskStyle] = useState<RiskStyle | null>(null);
  const [daySession, setDaySession] = useState<DaySession | null>(null);
  const [selectedDayRace, setSelectedDayRace] = useState<number | null>(null);
  const [showBudgetAdjust, setShowBudgetAdjust] = useState<number | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const existingSession = loadDaySession();
    if (existingSession) {
      setDaySession(existingSession);
    }
  }, []);

  // ============================================================================
  // CONTENDERS
  // ============================================================================

  const contenders = useMemo(() => {
    return getContenders(scoredHorses, isScratched, 4);
  }, [scoredHorses, isScratched]);

  // ============================================================================
  // SINGLE RACE BET CALCULATION
  // ============================================================================

  const calculateBetsIfReady = useCallback(() => {
    if (
      budget !== null &&
      riskStyle !== null &&
      race?.horses &&
      valueAnalysis &&
      scoredHorses.length > 0
    ) {
      const result = calculateBets({
        raceHeader: race.header,
        horses: race.horses,
        scoredHorses,
        budget,
        riskStyle,
        valueAnalysis,
        valuePlay: valueAnalysis.primaryValuePlay,
        contenders,
        getOdds,
        isScratched,
      });
      setCalculationResult(result);
      return result;
    }
    return null;
  }, [budget, riskStyle, race, valueAnalysis, scoredHorses, contenders, getOdds, isScratched]);

  // Recalculate when dependencies change
  useEffect(() => {
    if (flowStep === 'results' && betMode === 'single') {
      calculateBetsIfReady();
    }
  }, [flowStep, betMode, budget, riskStyle, valueAnalysis, getOdds, isScratched, calculateBetsIfReady]);

  // ============================================================================
  // DAY BET CALCULATION FOR SELECTED RACE
  // ============================================================================

  const dayRaceResult = useMemo(() => {
    if (!daySession || selectedDayRace === null) return null;

    const allocation = getRaceAllocation(daySession, selectedDayRace);
    if (!allocation) return null;

    const raceIndex = selectedDayRace - 1;
    const raceData = allRaces[raceIndex];
    const raceScored = allScoredHorses[raceIndex] || [];

    if (!raceData?.horses || raceScored.length === 0) return null;

    // Analyze value for this race
    const raceValueAnalysis = analyzeRaceValue(
      raceScored,
      (index, defaultOdds) => getOdds(index, defaultOdds),
      isScratched
    );

    const raceContenders = getContenders(raceScored, isScratched, 4);

    return calculateBets({
      raceHeader: raceData.header,
      horses: raceData.horses,
      scoredHorses: raceScored,
      budget: allocation.allocatedBudget,
      riskStyle: daySession.riskStyle,
      valueAnalysis: raceValueAnalysis,
      valuePlay: raceValueAnalysis.primaryValuePlay,
      contenders: raceContenders,
      getOdds,
      isScratched,
    });
  }, [daySession, selectedDayRace, allRaces, allScoredHorses, getOdds, isScratched]);

  // ============================================================================
  // MODE SELECTION HANDLERS
  // ============================================================================

  const handleSelectMode = (mode: BetModeType) => {
    setBetMode(mode);
    if (mode === 'single') {
      setFlowStep('budget');
    } else {
      setDayFlowStep('bankroll');
    }
  };

  const handleResumeSession = () => {
    const existingSession = loadDaySession();
    if (existingSession) {
      setDaySession(existingSession);
      setBetMode('day');
      // Check if session is complete
      if (isSessionComplete(existingSession)) {
        setDayFlowStep('complete');
      } else {
        setDayFlowStep('overview');
      }
    }
  };

  // ============================================================================
  // SINGLE RACE FLOW HANDLERS
  // ============================================================================

  const handleBudgetNext = () => {
    if (budget !== null) {
      setFlowStep('style');
    }
  };

  const handleStyleBack = () => {
    setFlowStep('budget');
  };

  const handleShowBets = () => {
    if (budget !== null && riskStyle !== null) {
      calculateBetsIfReady();
      setFlowStep('results');
    }
  };

  const handleChangeOptions = () => {
    setFlowStep('style');
  };

  // ============================================================================
  // DAY FLOW HANDLERS
  // ============================================================================

  const handleDayBankrollNext = () => {
    if (dayBankroll !== null) {
      setDayFlowStep('experience');
    }
  };

  const handleDayExperienceBack = () => {
    setDayFlowStep('bankroll');
  };

  const handleDayExperienceNext = () => {
    if (dayExperience !== null) {
      setDayFlowStep('style');
    }
  };

  const handleDayStyleBack = () => {
    setDayFlowStep('experience');
  };

  const handleSeePlan = () => {
    if (dayBankroll !== null && dayExperience !== null && dayRiskStyle !== null) {
      // Generate race analyses for all races
      const raceAnalyses = allRaces.map((raceData, index) => {
        const raceScored = allScoredHorses[index] || [];
        if (raceScored.length === 0) {
          // Return default PASS analysis for races without data
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
          };
        }
        return analyzeRaceValue(
          raceScored,
          (horseIndex, defaultOdds) => getOdds(horseIndex, defaultOdds),
          isScratched
        );
      });

      // Allocate budget across races
      const allocation = allocateDayBudget({
        totalBankroll: dayBankroll,
        raceAnalyses,
        trackName,
        riskStyle: dayRiskStyle,
      });

      // Create and save session
      const session = createDaySession(
        trackName,
        dayBankroll,
        dayExperience,
        dayRiskStyle,
        allocation.raceAllocations
      );

      saveDaySession(session);
      setDaySession(session);
      setDayFlowStep('overview');
    }
  };

  const handleEditSettings = () => {
    setDayFlowStep('bankroll');
  };

  const handleSelectDayRace = (raceNum: number) => {
    setSelectedDayRace(raceNum);
    setDayFlowStep('race-bets');
    // Optionally navigate to that race in the main app
    if (onNavigateToRace) {
      onNavigateToRace(raceNum - 1);
    }
  };

  const handleStartBetting = () => {
    // Start with the first race that hasn't been bet
    if (daySession) {
      const firstUnbet = daySession.raceAllocations.find(
        a => !daySession.racesCompleted.includes(a.raceNumber)
      );
      if (firstUnbet) {
        handleSelectDayRace(firstUnbet.raceNumber);
      } else {
        // All races complete
        setDayFlowStep('complete');
      }
    }
  };

  const handleViewPlan = () => {
    setSelectedDayRace(null);
    setDayFlowStep('overview');
  };

  const handlePrevRace = () => {
    if (selectedDayRace && selectedDayRace > 1) {
      handleSelectDayRace(selectedDayRace - 1);
    }
  };

  const handleNextRace = () => {
    if (selectedDayRace && daySession && selectedDayRace < daySession.raceAllocations.length) {
      handleSelectDayRace(selectedDayRace + 1);
    }
  };

  const handleMarkAsBet = () => {
    if (daySession && selectedDayRace && dayRaceResult) {
      const updatedSession = markRaceAsBet(daySession, selectedDayRace, dayRaceResult.totalCost);
      setDaySession(updatedSession);

      // Check if all races complete
      if (isSessionComplete(updatedSession)) {
        setDayFlowStep('complete');
      } else {
        // Move to next race or overview
        const nextUnbet = updatedSession.raceAllocations.find(
          a => !updatedSession.racesCompleted.includes(a.raceNumber)
        );
        if (nextUnbet) {
          handleSelectDayRace(nextUnbet.raceNumber);
        } else {
          setDayFlowStep('overview');
        }
      }
    }
  };

  const handleAdjustBudget = (raceNum: number) => {
    setShowBudgetAdjust(raceNum);
  };

  const handleApplyBudgetAdjust = (newBudget: number) => {
    if (daySession && showBudgetAdjust !== null) {
      const raceIndex = showBudgetAdjust - 1;
      const newAllocations = adjustRaceBudget(
        daySession.raceAllocations,
        raceIndex,
        newBudget,
        daySession.totalBankroll
      );
      const updatedSession = updateRaceAllocations(daySession, newAllocations);
      setDaySession(updatedSession);
      setShowBudgetAdjust(null);
    }
  };

  const handleStartNewDay = () => {
    clearDaySession();
    setDaySession(null);
    setDayBankroll(null);
    setDayExperience(null);
    setDayRiskStyle(null);
    setSelectedDayRace(null);
    setBetMode(null);
    setFlowStep('mode-select');
    setDayFlowStep('bankroll');
  };

  const handleBackToModeSelect = () => {
    setBetMode(null);
    setFlowStep('mode-select');
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderSingleRaceFlow = () => {
    switch (flowStep) {
      case 'budget':
        return (
          <BudgetStep
            budget={budget}
            onBudgetChange={setBudget}
            onNext={handleBudgetNext}
          />
        );

      case 'style':
        return (
          <StyleStep
            budget={budget || 0}
            selectedStyle={riskStyle}
            onStyleChange={setRiskStyle}
            onBack={handleStyleBack}
            onShowBets={handleShowBets}
          />
        );

      case 'results':
        if (calculationResult && budget !== null && riskStyle !== null) {
          return (
            <BetResults
              result={calculationResult}
              raceNumber={raceNumber}
              trackName={trackName}
              budget={budget}
              riskStyle={riskStyle}
              onChangeOptions={handleChangeOptions}
            />
          );
        }
        return (
          <div className="bet-mode-loading">
            <span className="bet-mode-loading__icon">⏳</span>
            <p>Calculating your bets...</p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderDayFlow = () => {
    switch (dayFlowStep) {
      case 'bankroll':
        return (
          <DayBankrollStep
            bankroll={dayBankroll}
            onBankrollChange={setDayBankroll}
            onBack={handleBackToModeSelect}
            onNext={handleDayBankrollNext}
          />
        );

      case 'experience':
        return (
          <DayExperienceStep
            bankroll={dayBankroll || 0}
            experienceLevel={dayExperience}
            onExperienceChange={setDayExperience}
            onBack={handleDayExperienceBack}
            onNext={handleDayExperienceNext}
          />
        );

      case 'style':
        return (
          <DayStyleStep
            bankroll={dayBankroll || 0}
            experienceLevel={dayExperience || 'standard'}
            riskStyle={dayRiskStyle}
            onStyleChange={setDayRiskStyle}
            onBack={handleDayStyleBack}
            onSeePlan={handleSeePlan}
          />
        );

      case 'overview':
        if (daySession) {
          return (
            <DayOverview
              session={daySession}
              onEdit={handleEditSettings}
              onSelectRace={handleSelectDayRace}
              onStartBetting={handleStartBetting}
            />
          );
        }
        return null;

      case 'race-bets':
        if (daySession && selectedDayRace && dayRaceResult) {
          const allocation = getRaceAllocation(daySession, selectedDayRace);
          const isCompleted = isRaceCompleted(daySession, selectedDayRace);

          return (
            <BetResults
              result={dayRaceResult}
              raceNumber={selectedDayRace}
              trackName={trackName}
              budget={allocation?.allocatedBudget || 0}
              riskStyle={daySession.riskStyle}
              onChangeOptions={handleViewPlan}
              // Day mode specific props
              isDayMode={true}
              daySession={daySession}
              onPrevRace={selectedDayRace > 1 ? handlePrevRace : undefined}
              onNextRace={selectedDayRace < daySession.raceAllocations.length ? handleNextRace : undefined}
              onViewPlan={handleViewPlan}
              onMarkAsBet={!isCompleted ? handleMarkAsBet : undefined}
              isRaceCompleted={isCompleted}
              onAdjustBudget={() => handleAdjustBudget(selectedDayRace)}
            />
          );
        }
        return (
          <div className="bet-mode-loading">
            <span className="bet-mode-loading__icon">⏳</span>
            <p>Loading race data...</p>
          </div>
        );

      case 'complete':
        if (daySession) {
          return (
            <DayComplete
              session={daySession}
              onStartNewDay={handleStartNewDay}
              onExitBetMode={onClose}
            />
          );
        }
        return null;

      default:
        return null;
    }
  };

  const renderModeSelection = () => {
    return (
      <ModeSelection
        hasActiveSession={hasActiveDaySession()}
        onSelectMode={handleSelectMode}
        onResumeSession={handleResumeSession}
      />
    );
  };

  // ============================================================================
  // PROGRESS INDICATOR
  // ============================================================================

  const renderProgress = () => {
    if (betMode === 'single') {
      return (
        <div className="bet-mode-progress">
          <div
            className={`bet-mode-progress__step ${flowStep === 'budget' ? 'bet-mode-progress__step--active' : ''} ${['style', 'results'].includes(flowStep) ? 'bet-mode-progress__step--complete' : ''}`}
          >
            <span className="bet-mode-progress__number">1</span>
            <span className="bet-mode-progress__label">Budget</span>
          </div>
          <div className="bet-mode-progress__line"></div>
          <div
            className={`bet-mode-progress__step ${flowStep === 'style' ? 'bet-mode-progress__step--active' : ''} ${flowStep === 'results' ? 'bet-mode-progress__step--complete' : ''}`}
          >
            <span className="bet-mode-progress__number">2</span>
            <span className="bet-mode-progress__label">Style</span>
          </div>
          <div className="bet-mode-progress__line"></div>
          <div
            className={`bet-mode-progress__step ${flowStep === 'results' ? 'bet-mode-progress__step--active' : ''}`}
          >
            <span className="bet-mode-progress__number">3</span>
            <span className="bet-mode-progress__label">Bets</span>
          </div>
        </div>
      );
    }

    if (betMode === 'day' && ['bankroll', 'experience', 'style'].includes(dayFlowStep)) {
      const stepNum = dayFlowStep === 'bankroll' ? 1 : dayFlowStep === 'experience' ? 2 : 3;
      return (
        <div className="bet-mode-progress">
          <div
            className={`bet-mode-progress__step ${stepNum === 1 ? 'bet-mode-progress__step--active' : ''} ${stepNum > 1 ? 'bet-mode-progress__step--complete' : ''}`}
          >
            <span className="bet-mode-progress__number">1</span>
            <span className="bet-mode-progress__label">Bankroll</span>
          </div>
          <div className="bet-mode-progress__line"></div>
          <div
            className={`bet-mode-progress__step ${stepNum === 2 ? 'bet-mode-progress__step--active' : ''} ${stepNum > 2 ? 'bet-mode-progress__step--complete' : ''}`}
          >
            <span className="bet-mode-progress__number">2</span>
            <span className="bet-mode-progress__label">Experience</span>
          </div>
          <div className="bet-mode-progress__line"></div>
          <div
            className={`bet-mode-progress__step ${stepNum === 3 ? 'bet-mode-progress__step--active' : ''}`}
          >
            <span className="bet-mode-progress__number">3</span>
            <span className="bet-mode-progress__label">Style</span>
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="bet-mode-container">
      <BetModeHeader
        raceNumber={betMode === 'day' && selectedDayRace ? selectedDayRace : raceNumber}
        trackName={trackName}
        onClose={onClose}
      />

      {/* Day Progress Bar (when in day mode with active session) */}
      {betMode === 'day' && daySession && dayFlowStep === 'race-bets' && (
        <DayProgress session={daySession} onViewPlan={handleViewPlan} />
      )}

      <div className="bet-mode-content">
        {/* Progress indicator */}
        {renderProgress()}

        {/* Step content */}
        <div className="bet-mode-step-content">
          {betMode === null && renderModeSelection()}
          {betMode === 'single' && renderSingleRaceFlow()}
          {betMode === 'day' && renderDayFlow()}
        </div>
      </div>

      {/* Budget Adjust Modal */}
      {showBudgetAdjust !== null && daySession && (
        <BudgetAdjustModal
          allocation={daySession.raceAllocations[showBudgetAdjust - 1]!}
          allAllocations={daySession.raceAllocations}
          raceIndex={showBudgetAdjust - 1}
          onCancel={() => setShowBudgetAdjust(null)}
          onApply={handleApplyBudgetAdjust}
        />
      )}
    </div>
  );
};

export default BetModeContainer;
