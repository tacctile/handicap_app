/**
 * BetResults Component
 *
 * Step 3 of the betting flow: Display all calculated bets.
 * Shows bet cards, value play info, totals, and return scenarios.
 */

import React, { useState } from 'react';
import { BetCard, SkipCard } from './BetCard';
import type { BetCalculationResult } from '../../lib/betting/calculateBets';
import type { RiskStyle, SingleBet } from '../../lib/betting/betTypes';
import { formatReturnRange, calculateReturnScenarios } from '../../lib/betting/returnEstimates';
import { generateCompleteTicket } from '../../lib/betting/whatToSay';
import { formatEdge } from '../../hooks/useValueDetection';
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
  /** User's selected style (unused but kept for potential future use) */
  riskStyle: RiskStyle;
  /** Callback to change options (go back to style selection) */
  onChangeOptions: () => void;
}

export const BetResults: React.FC<BetResultsProps> = ({
  result,
  raceNumber,
  trackName,
  budget,
  riskStyle: _riskStyle,
  onChangeOptions,
}) => {
  const [allCopied, setAllCopied] = useState(false);

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

  // Copy all bets to clipboard
  const handleCopyAll = async () => {
    try {
      const ticket = generateCompleteTicket(
        raceNumber,
        trackName,
        result.bets.map((b: SingleBet) => ({
          betType: b.type,
          horses: b.horses,
          amount: b.amount,
          totalCost: b.totalCost,
        }))
      );
      await navigator.clipboard.writeText(ticket);
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="bet-results">
      {/* Header */}
      <div className="bet-results__header">
        <div className="bet-results__title-row">
          <span className="bet-results__icon">🎯</span>
          <h2 className="bet-results__title">YOUR BETS — RACE {raceNumber}</h2>
        </div>
        <div className="bet-results__budget-badge">Budget: ${budget}</div>
      </div>

      {/* Value play banner */}
      {result.valuePlay ? (
        <div className="bet-results__value-banner bet-results__value-banner--bet">
          <div className="bet-results__value-badge">
            <span className="bet-results__value-dot"></span>
            <span>VALUE PLAY</span>
          </div>
          <div className="bet-results__value-info">
            <span className="bet-results__value-horse">
              #{result.valuePlay.programNumber} {result.valuePlay.horseName} (
              {result.valuePlay.currentOdds})
            </span>
            <span className="bet-results__value-edge">
              Edge: {formatEdge(result.valuePlay.valueEdge)}
            </span>
          </div>
          <p className="bet-results__value-reason">Our model loves this horse at this price</p>
        </div>
      ) : isPassRace ? (
        <div className="bet-results__value-banner bet-results__value-banner--pass">
          <div className="bet-results__value-badge bet-results__value-badge--pass">
            <span className="bet-results__value-dot bet-results__value-dot--pass"></span>
            <span>NO VALUE IN THIS RACE</span>
          </div>
          <p className="bet-results__value-reason">
            All contenders are fairly priced or overbet. There's no edge. Smart bettors skip this
            race. But if you're betting anyway...
          </p>
        </div>
      ) : null}

      {/* PASS race header */}
      {isPassRace && (
        <div className="bet-results__pass-header">
          <span className="bet-results__pass-label">"LEAST BAD" BETS:</span>
        </div>
      )}

      {/* Bet cards */}
      <div className="bet-results__bets">
        {result.bets.map((bet: SingleBet, index: number) => (
          <BetCard key={bet.id} bet={bet} betNumber={index + 1} />
        ))}
      </div>

      {/* Skipped bets */}
      {result.skippedBets.length > 0 && (
        <div className="bet-results__skipped">
          {result.skippedBets.map((bet: SingleBet, index: number) => (
            <SkipCard
              key={`skip-${index}`}
              horseName={bet.horseNames[0] || 'Unknown'}
              programNumber={bet.horses[0] || 0}
              odds={bet.explanation.match(/\d+-1/)?.[0] || 'N/A'}
              explanation={bet.explanation}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bet-results__summary">
        <div className="bet-results__summary-row">
          <span className="bet-results__summary-label">TOTAL:</span>
          <span className="bet-results__summary-value">${result.totalCost}</span>
        </div>

        {result.remainingBudget > 0 && (
          <div className="bet-results__summary-row bet-results__summary-row--secondary">
            <span className="bet-results__summary-label">Remaining from budget:</span>
            <span className="bet-results__summary-value">${result.remainingBudget}</span>
          </div>
        )}
      </div>

      {/* Potential returns */}
      <div className="bet-results__returns">
        <h3 className="bet-results__returns-title">POTENTIAL RETURNS:</h3>
        <ul className="bet-results__returns-list">
          {returnScenarios.map((scenario, index) => (
            <li
              key={index}
              className={`bet-results__returns-item ${scenario.isMainScenario ? 'bet-results__returns-item--main' : ''}`}
            >
              <span className="bet-results__returns-desc">{scenario.description}:</span>
              <span className="bet-results__returns-amount">
                {formatReturnRange(scenario.totalReturn)}
              </span>
              <span className="bet-results__returns-profit">
                ({scenario.profit.min >= 0 ? '+' : ''}${scenario.profit.min}-{scenario.profit.max}{' '}
                profit)
              </span>
              {scenario.isMainScenario && <span className="bet-results__returns-fire">🔥</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Honest advice for PASS races */}
      {isPassRace && (
        <div className="bet-results__advice">
          <span className="bet-results__advice-icon">⚠️</span>
          <div className="bet-results__advice-content">
            <strong>HONEST ADVICE:</strong>
            <p>
              Save your money for races with value. This one is a coin flip at best. If you must
              bet, keep it small.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bet-results__actions">
        <button className="bet-results__back-btn" onClick={onChangeOptions}>
          <span className="material-icons">arrow_back</span>
          <span>CHANGE OPTIONS</span>
        </button>

        <button
          className={`bet-results__copy-all-btn ${allCopied ? 'bet-results__copy-all-btn--copied' : ''}`}
          onClick={handleCopyAll}
        >
          <span className="material-icons">{allCopied ? 'check' : 'content_copy'}</span>
          <span>{allCopied ? 'COPIED!' : 'COPY ALL'}</span>
        </button>
      </div>
    </div>
  );
};

export default BetResults;
