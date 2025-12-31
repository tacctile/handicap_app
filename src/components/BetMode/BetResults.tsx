/**
 * BetResults Component
 *
 * TWO-COLUMN DASHBOARD LAYOUT for bet display.
 * Left: Value analysis and skip info
 * Right: Bet cards with "what to say" scripts
 *
 * Mobile: Single column, bets first.
 */

import React from 'react';
import { BetCard, SkipCard } from './BetCard';
import type { BetCalculationResult } from '../../lib/betting/calculateBets';
import type { RiskStyle, SingleBet } from '../../lib/betting/betTypes';
import type { RaceValueAnalysis } from '../../hooks/useValueDetection';
import { formatReturnRange, calculateReturnScenarios } from '../../lib/betting/returnEstimates';
import { formatEdge, getEdgeColor } from '../../hooks/useValueDetection';
import './BetResults.css';

interface BetResultsProps {
  /** Calculation result */
  result: BetCalculationResult;
  /** Race number for display */
  raceNumber: number;
  /** Track name */
  trackName: string;
  /** User's budget */
  budget: number;
  /** User's selected style */
  riskStyle: RiskStyle;
  /** Callback to change options (deprecated - settings are inline now) */
  onChangeOptions: () => void;
  /** Value analysis for detailed display */
  valueAnalysis?: RaceValueAnalysis | null;
  /** Whether this is part of a day plan */
  isDayMode?: boolean;
  /** Whether this race has been marked as bet */
  isRaceCompleted?: boolean;
  /** Callback to mark race as bet */
  onMarkAsBet?: () => void;
}

export const BetResults: React.FC<BetResultsProps> = ({
  result,
  raceNumber: _raceNumber,
  trackName: _trackName,
  budget,
  riskStyle: _riskStyle,
  onChangeOptions: _onChangeOptions,
  valueAnalysis,
  isDayMode = false,
  isRaceCompleted = false,
  onMarkAsBet,
}) => {
  const isPassRace = result.raceVerdict === 'PASS';

  // Format potential returns
  const returnScenarios = calculateReturnScenarios(
    result.bets.map((b: SingleBet) => ({
      type: b.type,
      totalCost: b.totalCost,
      potentialReturn: b.potentialReturn,
      horseNames: b.horseNames,
    })),
    result.totalCost
  );

  return (
    <div className="bet-results bet-results--dashboard">
      {/* Two-column layout container */}
      <div className="bet-results__columns">
        {/* LEFT COLUMN: Analysis & Skip Info */}
        <div className="bet-results__left-column">
          {/* Value Play or No Value Section */}
          {result.valuePlay ? (
            <div className="bet-results__value-section bet-results__value-section--bet">
              <div className="bet-results__value-header">
                <span className="bet-results__value-icon">🔥</span>
                <span className="bet-results__value-label">VALUE PLAY</span>
              </div>

              <div className="bet-results__value-horse">
                <span className="bet-results__value-pp">#{result.valuePlay.programNumber}</span>
                <span className="bet-results__value-name">{result.valuePlay.horseName}</span>
              </div>

              <div className="bet-results__odds-compare">
                <span className="bet-results__current-odds">{result.valuePlay.currentOdds}</span>
                <span className="bet-results__odds-arrow">→</span>
                <span className="bet-results__fair-odds">
                  {Math.round((100 / result.valuePlay.modelWinProb) - 1)}-1 Fair
                </span>
              </div>

              <div className="bet-results__edge-display">
                <span className="bet-results__edge-label">Edge:</span>
                <span
                  className="bet-results__edge-value"
                  style={{ color: getEdgeColor(result.valuePlay.valueEdge) }}
                >
                  {formatEdge(result.valuePlay.valueEdge)}
                </span>
              </div>

              {/* Edge bar visualization */}
              <div className="bet-results__edge-bar">
                <div
                  className="bet-results__edge-fill"
                  style={{
                    width: `${Math.min(100, Math.abs(result.valuePlay.valueEdge))}%`,
                    backgroundColor: getEdgeColor(result.valuePlay.valueEdge),
                  }}
                />
              </div>

              <p className="bet-results__value-reason">
                "Ranked #{result.valuePlay.modelRank}, huge overlay.
                Public has at longshot odds. This is the play."
              </p>

              <details className="bet-results__full-analysis">
                <summary>❓ Full Analysis</summary>
                <p>
                  Our model ranks this horse at position {result.valuePlay.modelRank},
                  but the public is betting it at {result.valuePlay.currentOdds} odds.
                  Fair odds should be {Math.round((100 / result.valuePlay.modelWinProb) - 1)}-1.
                  This gives us a {formatEdge(result.valuePlay.valueEdge)} edge.
                </p>
              </details>
            </div>
          ) : (
            <div className="bet-results__value-section bet-results__value-section--pass">
              <div className="bet-results__value-header">
                <span className="bet-results__value-icon">🔴</span>
                <span className="bet-results__value-label">NO VALUE IN THIS RACE</span>
              </div>

              <p className="bet-results__pass-reason">
                All contenders are chalk or underlays. Smart money skips this race entirely.
              </p>

              {/* Least bad option */}
              {valueAnalysis?.topPick && (
                <div className="bet-results__least-bad">
                  <div className="bet-results__least-bad-label">LEAST BAD:</div>
                  <div className="bet-results__least-bad-horse">
                    #{valueAnalysis.topPick.rank} {valueAnalysis.topPick.name}
                  </div>
                  <div className="bet-results__least-bad-edge">
                    Edge: ~0% (least negative)
                  </div>
                </div>
              )}

              <div className="bet-results__divider" />

              <div className="bet-results__honest-advice">
                <span className="bet-results__advice-icon">💡</span>
                <div className="bet-results__advice-content">
                  <strong>HONEST ADVICE:</strong>
                  <p>Save your money for races with real value. This is gambling.</p>
                </div>
              </div>
            </div>
          )}

          {/* Skip Section */}
          {result.skippedBets.length > 0 && (
            <div className="bet-results__skip-section">
              <div className="bet-results__skip-header">
                <span className="bet-results__skip-icon">⚠️</span>
                <span className="bet-results__skip-label">SKIP THESE</span>
              </div>

              {result.skippedBets.slice(0, 3).map((bet: SingleBet, index: number) => (
                <SkipCard
                  key={`skip-${index}`}
                  horseName={bet.horseNames[0] || 'Unknown'}
                  programNumber={bet.horses[0] || 0}
                  odds={bet.explanation.match(/\d+-1/)?.[0] || 'N/A'}
                  explanation={bet.explanation}
                  compact={true}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Bets */}
        <div className="bet-results__right-column">
          {/* Bets Header */}
          <div className="bet-results__bets-header">
            <div className="bet-results__bets-title">
              <span className="bet-results__bets-icon">💰</span>
              <span className="bet-results__bets-label">
                {isPassRace ? '"SURVIVAL" BETS' : 'YOUR BETS'}
              </span>
            </div>
            <div className="bet-results__bets-total">
              Total: ${result.totalCost}
            </div>
          </div>

          {/* Day Mode Completed Badge */}
          {isDayMode && isRaceCompleted && (
            <div className="bet-results__completed-badge">
              <span className="material-icons">check_circle</span>
              <span>RACE MARKED AS BET</span>
            </div>
          )}

          {/* Bet Cards */}
          <div className="bet-results__bets-list">
            {result.bets.map((bet: SingleBet, index: number) => (
              <BetCard key={bet.id} bet={bet} betNumber={index + 1} compact={true} />
            ))}
          </div>

          {/* Potential Returns */}
          <div className="bet-results__returns">
            <div className="bet-results__returns-title">POTENTIAL RETURNS:</div>
            <div className="bet-results__returns-list">
              {returnScenarios.slice(0, 3).map((scenario, index) => (
                <div
                  key={index}
                  className={`bet-results__returns-item ${scenario.isMainScenario ? 'bet-results__returns-item--main' : ''}`}
                >
                  <span className="bet-results__returns-desc">{scenario.description}:</span>
                  <span className="bet-results__returns-amount">
                    {formatReturnRange(scenario.totalReturn)}
                  </span>
                  {scenario.isMainScenario && (
                    <span className="bet-results__returns-fire">🔥</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mark as Bet (Day Mode) */}
          {isDayMode && onMarkAsBet && !isRaceCompleted && (
            <button className="bet-results__mark-btn" onClick={onMarkAsBet}>
              <span className="material-icons">check</span>
              <span>MARK AS BET</span>
            </button>
          )}
        </div>
      </div>

      {/* Budget Info Footer (mobile only) */}
      <div className="bet-results__mobile-footer">
        <div className="bet-results__budget-info">
          <span className="bet-results__budget-label">Budget:</span>
          <span className="bet-results__budget-value">${budget}</span>
        </div>
        {result.remainingBudget > 0 && (
          <div className="bet-results__remaining-info">
            <span className="bet-results__remaining-label">Remaining:</span>
            <span className="bet-results__remaining-value">${result.remainingBudget}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BetResults;
