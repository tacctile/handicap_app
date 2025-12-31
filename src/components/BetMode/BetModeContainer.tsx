/**
 * BetModeContainer Component
 *
 * Full-screen container for the betting interface.
 * Takes over the main content area when bet mode is active.
 * Implements the 3-step betting flow:
 * 1. Budget selection
 * 2. Style selection (safe/balanced/aggressive)
 * 3. Bet results with recommendations
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BetModeHeader } from './BetModeHeader';
import { BudgetStep } from './BudgetStep';
import { StyleStep } from './StyleStep';
import { BetResults } from './BetResults';
import { calculateBets, getContenders } from '../../lib/betting/calculateBets';
import type { RiskStyle, BetCalculationResult } from '../../lib/betting/betTypes';
import type { ParsedRace } from '../../types/drf';
import type { RaceValueAnalysis } from '../../hooks/useValueDetection';
import type { ScoredHorse } from '../../lib/scoring';
import './BetModeContainer.css';

// ============================================================================
// TYPES
// ============================================================================

type BetFlowStep = 'budget' | 'style' | 'results';

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
}) => {
  // Flow state
  const [flowStep, setFlowStep] = useState<BetFlowStep>('budget');
  const [budget, setBudget] = useState<number | null>(null);
  const [riskStyle, setRiskStyle] = useState<RiskStyle | null>(null);

  // Calculation result (computed when we have all inputs)
  const [calculationResult, setCalculationResult] = useState<BetCalculationResult | null>(null);

  // Get contenders from scored horses
  const contenders = useMemo(() => {
    return getContenders(scoredHorses, isScratched, 4);
  }, [scoredHorses, isScratched]);

  // Calculate bets when all inputs are available
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

  // Recalculate when dependencies change (dynamic updates)
  useEffect(() => {
    if (flowStep === 'results') {
      calculateBetsIfReady();
    }
  }, [flowStep, budget, riskStyle, valueAnalysis, getOdds, isScratched, calculateBetsIfReady]);

  // Flow navigation handlers
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

  // Render current step
  const renderStep = () => {
    switch (flowStep) {
      case 'budget':
        return <BudgetStep budget={budget} onBudgetChange={setBudget} onNext={handleBudgetNext} />;

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
        // Fallback if calculation isn't ready
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

  return (
    <div className="bet-mode-container">
      <BetModeHeader raceNumber={raceNumber} trackName={trackName} onClose={onClose} />

      <div className="bet-mode-content">
        {/* Progress indicator */}
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

        {/* Step content */}
        <div className="bet-mode-step-content">{renderStep()}</div>
      </div>
    </div>
  );
};

export default BetModeContainer;
