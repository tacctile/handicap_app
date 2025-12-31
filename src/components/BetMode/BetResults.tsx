/**
 * BetResults Component - Dashboard Layout
 *
 * REDESIGNED: Dense, dashboard-style layout where ALL critical information
 * is visible at a glance WITHOUT scrolling. Designed for split-second
 * decisions 3 minutes before post time.
 *
 * Layout:
 * - Desktop: Two-column (40% Value/Skip | 60% Bets/Returns)
 * - Tablet: Tighter two-column
 * - Mobile: Single column, still dense
 */

import React, { useState } from 'react';
import type { BetCalculationResult } from '../../lib/betting/calculateBets';
import type { RiskStyle, SingleBet } from '../../lib/betting/betTypes';
import type { DaySession } from '../../lib/betting/daySession';
import { getSessionProgress } from '../../lib/betting/daySession';
import { formatReturnRange, calculateReturnScenarios } from '../../lib/betting/returnEstimates';
import { generateCompleteTicket } from '../../lib/betting/whatToSay';
import { formatEdge } from '../../hooks/useValueDetection';
import './BetResults.css';

// Helper to calculate fair odds string from model win probability
function calculateFairOdds(modelWinProb: number): string {
  if (modelWinProb <= 0 || modelWinProb >= 100) return 'N/A';
  const fairOddsDecimal = (100 / modelWinProb) - 1;
  if (fairOddsDecimal < 1) {
    // Odds-on (e.g., 1-2, 2-5)
    const denominator = Math.round(1 / fairOddsDecimal);
    return `1-${denominator}`;
  }
  return `${Math.round(fairOddsDecimal)}-1`;
}

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
  /** Callback to change options (go back to style selection) */
  onChangeOptions: () => void;
  /** Race distance and type for display */
  raceInfo?: string;

  // Day mode specific props
  /** Whether this is part of a day plan */
  isDayMode?: boolean;
  /** Active day session (for day mode) */
  daySession?: DaySession | null;
  /** Callback to go to previous race */
  onPrevRace?: () => void;
  /** Callback to go to next race */
  onNextRace?: () => void;
  /** Callback to view the day plan overview */
  onViewPlan?: () => void;
  /** Callback when user marks this race as bet */
  onMarkAsBet?: () => void;
  /** Whether this race has already been marked as bet */
  isRaceCompleted?: boolean;
  /** Callback to adjust the race budget */
  onAdjustBudget?: () => void;
  /** Callback to close bet mode */
  onClose?: () => void;
}

// ============================================================================
// COMPACT BET CARD
// ============================================================================

interface CompactBetCardProps {
  bet: SingleBet;
}

const CompactBetCard: React.FC<CompactBetCardProps> = ({ bet }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bet.whatToSay);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formattedReturn = formatReturnRange(bet.potentialReturn);

  // Format horses display compactly
  const horsesDisplay =
    bet.horses.length === 1
      ? `#${bet.horses[0]} ${bet.horseNames[0]}`
      : `#${bet.horses[0]} w/ ${bet.horses.slice(1).map((h) => `#${h}`).join(',')}`;

  return (
    <div className="compact-bet">
      <div className="compact-bet__header">
        <span className="compact-bet__type">{bet.type.replace('_', ' ')}</span>
        <span className="compact-bet__horses">{horsesDisplay}</span>
        <span className="compact-bet__amount">${bet.totalCost}</span>
      </div>
      <div className="compact-bet__return">Return: {formattedReturn}</div>
      <div className="compact-bet__script">
        <span className="compact-bet__script-icon">📝</span>
        <span className="compact-bet__script-text">"{bet.whatToSay}"</span>
        <button
          className={`compact-bet__copy ${copied ? 'compact-bet__copy--copied' : ''}`}
          onClick={handleCopy}
        >
          <span className="material-icons">{copied ? 'check' : 'content_copy'}</span>
          <span>{copied ? 'COPIED!' : 'COPY'}</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// VALUE PLAY CARD
// ============================================================================

interface ValuePlayCardProps {
  horseName: string;
  programNumber: number;
  currentOdds: string;
  fairOdds?: string;
  edge: number;
  explanation: string;
}

const ValuePlayCard: React.FC<ValuePlayCardProps> = ({
  horseName,
  programNumber,
  currentOdds,
  fairOdds,
  edge,
  explanation,
}) => {
  const [showWhy, setShowWhy] = useState(false);

  // Calculate edge bar fill (100% edge = 50% fill, 200% = full)
  const edgeFill = Math.min(100, Math.abs(edge) / 2);
  const isPositive = edge > 0;

  return (
    <div className="value-card">
      <div className="value-card__header">
        <span className="value-card__icon">🔥</span>
        <span className="value-card__label">VALUE PLAY</span>
      </div>

      <div className="value-card__horse">
        #{programNumber} {horseName.toUpperCase()}
      </div>

      <div className="value-card__odds">
        <span className="value-card__current">{currentOdds}</span>
        <span className="value-card__arrow">→</span>
        <span className="value-card__fair">{fairOdds || 'N/A'} Fair</span>
      </div>

      <div className="value-card__edge-row">
        <div className="value-card__edge-bar">
          <div
            className={`value-card__edge-fill ${isPositive ? 'value-card__edge-fill--positive' : 'value-card__edge-fill--negative'}`}
            style={{ width: `${edgeFill}%` }}
          />
        </div>
        <span
          className={`value-card__edge-pct ${isPositive ? 'value-card__edge-pct--positive' : 'value-card__edge-pct--negative'}`}
        >
          {formatEdge(edge)}
        </span>
      </div>

      <div className="value-card__reason">"{explanation}"</div>

      <button className="value-card__why-btn" onClick={() => setShowWhy(!showWhy)}>
        <span className="value-card__why-icon">❓</span>
        <span>{showWhy ? 'Hide Details' : 'Full Analysis'}</span>
        <span className="material-icons">{showWhy ? 'expand_less' : 'expand_more'}</span>
      </button>

      {showWhy && (
        <div className="value-card__details">
          <p>
            Our model ranks this horse higher than the public does. The current odds of {currentOdds}{' '}
            represent a significant overlay compared to our fair odds assessment.
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SKIP SECTION
// ============================================================================

interface SkipSectionProps {
  skippedBets: SingleBet[];
}

const SkipSection: React.FC<SkipSectionProps> = ({ skippedBets }) => {
  const [showAll, setShowAll] = useState(false);
  const displayLimit = 3;
  const hasMore = skippedBets.length > displayLimit;
  const displayedBets = showAll ? skippedBets : skippedBets.slice(0, displayLimit);

  if (skippedBets.length === 0) return null;

  return (
    <div className="skip-section">
      <div className="skip-section__header">
        <span className="skip-section__icon">⚠️</span>
        <span className="skip-section__title">SKIP THESE</span>
      </div>
      <div className="skip-section__divider" />
      <div className="skip-section__list">
        {displayedBets.map((bet, index) => {
          const odds = bet.explanation.match(/\d+-1/)?.[0] || 'N/A';
          // Extract edge from explanation if possible
          const edgeMatch = bet.explanation.match(/(-?\d+)%/);
          const edge = edgeMatch ? edgeMatch[0] : 'Underlay';

          return (
            <div key={`skip-${index}`} className="skip-section__item">
              <div className="skip-section__item-header">
                <span className="skip-section__horse">
                  #{bet.horses[0]} {bet.horseNames[0]} ({odds})
                </span>
                <span className="skip-section__edge">{edge}</span>
              </div>
              <div className="skip-section__reason">{bet.skipReason || bet.explanation}</div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button className="skip-section__toggle" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show ${skippedBets.length - displayLimit} more`}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// RETURNS SUMMARY
// ============================================================================

interface ReturnsSummaryProps {
  scenarios: ReturnType<typeof calculateReturnScenarios>;
}

const ReturnsSummary: React.FC<ReturnsSummaryProps> = ({ scenarios }) => {
  if (scenarios.length === 0) return null;

  return (
    <div className="returns-summary">
      <div className="returns-summary__header">POTENTIAL RETURNS</div>
      <div className="returns-summary__divider" />
      {scenarios.map((scenario, index) => (
        <div
          key={index}
          className={`returns-summary__row ${scenario.isMainScenario ? 'returns-summary__row--main' : ''}`}
        >
          <span className="returns-summary__label">{scenario.description}:</span>
          <span className="returns-summary__value">
            {formatReturnRange(scenario.totalReturn)}
            {scenario.isMainScenario && <span className="returns-summary__fire">🔥</span>}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BetResults: React.FC<BetResultsProps> = ({
  result,
  raceNumber,
  trackName,
  budget,
  riskStyle,
  onChangeOptions,
  raceInfo = '',
  // Day mode props
  isDayMode = false,
  daySession,
  onPrevRace,
  onNextRace,
  onViewPlan,
  onMarkAsBet,
  isRaceCompleted = false,
  // onAdjustBudget - available but not used in current UI
  onClose,
}) => {
  const [allCopied, setAllCopied] = useState(false);

  const isPassRace = result.raceVerdict === 'PASS';

  // Get session progress for day mode
  const sessionProgress = daySession ? getSessionProgress(daySession) : null;

  // Calculate return scenarios
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

  // Get style icon
  const getStyleIcon = (style: RiskStyle) => {
    switch (style) {
      case 'safe':
        return '🛡️';
      case 'balanced':
        return '⚖️';
      case 'aggressive':
        return '🔥';
      default:
        return '⚖️';
    }
  };

  return (
    <div className={`bet-dashboard ${isPassRace ? 'bet-dashboard--pass' : ''}`}>
      {/* ============================================
          TOP HEADER BAR
          ============================================ */}
      <header className="bet-dashboard__header">
        <div className="bet-dashboard__title-section">
          <span className="bet-dashboard__icon">{isPassRace ? '🔴' : '🎯'}</span>
          <h1 className="bet-dashboard__title">
            {isPassRace ? `RACE ${raceNumber} — NO VALUE` : `RACE ${raceNumber} BETS`}
          </h1>
          {raceInfo && <span className="bet-dashboard__race-info">{trackName} • {raceInfo}</span>}
        </div>
        <div className="bet-dashboard__header-right">
          <div className="bet-dashboard__budget">Budget: ${budget}</div>
          {onClose && (
            <button className="bet-dashboard__close" onClick={onClose} title="Close">
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
      </header>

      {/* Day Mode Bankroll Status - Compact inline */}
      {isDayMode && sessionProgress && (
        <div className="bet-dashboard__bankroll">
          <span>💰 Bankroll: ${daySession?.totalBankroll}</span>
          <span className="bet-dashboard__bankroll-sep">|</span>
          <span>Wagered: ${sessionProgress.amountWagered}</span>
          <span className="bet-dashboard__bankroll-sep">|</span>
          <span className="bet-dashboard__bankroll-remaining">
            Remaining: ${sessionProgress.amountRemaining}
          </span>
          <span className="bet-dashboard__bankroll-sep">|</span>
          <span>Races left: {sessionProgress.remainingRaces}</span>
        </div>
      )}

      {/* Completed badge */}
      {isDayMode && isRaceCompleted && (
        <div className="bet-dashboard__completed">
          <span className="material-icons">check_circle</span>
          <span>RACE MARKED AS BET</span>
        </div>
      )}

      {/* ============================================
          PASS RACE WARNING (if applicable)
          ============================================ */}
      {isPassRace && (
        <div className="bet-dashboard__pass-warning">
          All contenders are chalk or underlays. Smart money skips this race. But if you're betting
          anyway, here's how to minimize damage:
        </div>
      )}

      {/* ============================================
          MAIN TWO-COLUMN LAYOUT
          ============================================ */}
      <div className="bet-dashboard__content">
        {/* LEFT COLUMN: Value Play + Skip Section */}
        <div className="bet-dashboard__left">
          {/* Value Play Card */}
          {result.valuePlay && !isPassRace ? (
            <ValuePlayCard
              horseName={result.valuePlay.horseName}
              programNumber={result.valuePlay.programNumber}
              currentOdds={result.valuePlay.currentOdds}
              fairOdds={calculateFairOdds(result.valuePlay.modelWinProb)}
              edge={result.valuePlay.valueEdge}
              explanation="Ranked higher than public pricing. Huge overlay. Primary target."
            />
          ) : isPassRace ? (
            <div className="least-bad-section">
              <div className="least-bad-section__header">
                <span className="least-bad-section__icon">🎯</span>
                <span className="least-bad-section__title">LEAST BAD OPTIONS</span>
              </div>
              <div className="least-bad-section__divider" />
              {result.bets.slice(0, 2).map((bet, index) => {
                const edgeMatch = bet.explanation.match(/(-?\d+)%/);
                const edge = edgeMatch ? edgeMatch[0] : '~0%';
                return (
                  <div key={index} className="least-bad-section__item">
                    <div className="least-bad-section__horse">
                      #{bet.horses[0]} {bet.horseNames[0]}
                    </div>
                    <div className="least-bad-section__info">
                      <span className="least-bad-section__edge">Edge: {edge}</span>
                      <span className="least-bad-section__note">(least negative)</span>
                    </div>
                    <div className="least-bad-section__reason">
                      {bet.explanation.slice(0, 60)}...
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Skip Section */}
          <SkipSection skippedBets={result.skippedBets} />
        </div>

        {/* RIGHT COLUMN: Bets + Returns */}
        <div className="bet-dashboard__right">
          {/* Bets Header */}
          <div className="bet-dashboard__bets-header">
            <div className="bet-dashboard__bets-title">
              <span>{isPassRace ? '💸' : '💰'}</span>
              <span>{isPassRace ? '"SURVIVAL" BETS' : 'YOUR BETS'}</span>
            </div>
            <div className="bet-dashboard__bets-total">Total: ${result.totalCost}</div>
          </div>

          {/* Bet Cards */}
          <div className="bet-dashboard__bets">
            {result.bets.map((bet: SingleBet) => (
              <CompactBetCard key={bet.id} bet={bet} />
            ))}
          </div>

          {/* Returns Summary */}
          <ReturnsSummary scenarios={returnScenarios} />
        </div>
      </div>

      {/* ============================================
          HONEST ADVICE FOR PASS RACES
          ============================================ */}
      {isPassRace && (
        <div className="bet-dashboard__advice">
          <span className="bet-dashboard__advice-icon">💡</span>
          <span className="bet-dashboard__advice-text">
            <strong>HONEST ADVICE:</strong> Save your money for races with real value.
          </span>
        </div>
      )}

      {/* ============================================
          BOTTOM NAVIGATION BAR
          ============================================ */}
      <nav className="bet-dashboard__nav">
        {isDayMode ? (
          <>
            <button
              className="bet-dashboard__nav-btn"
              onClick={onPrevRace}
              disabled={!onPrevRace}
            >
              <span className="material-icons">arrow_back</span>
              <span className="bet-dashboard__nav-label">PREV</span>
            </button>

            <button
              className={`bet-dashboard__nav-btn bet-dashboard__nav-btn--primary ${allCopied ? 'bet-dashboard__nav-btn--copied' : ''}`}
              onClick={handleCopyAll}
            >
              <span className="material-icons">{allCopied ? 'check' : 'content_copy'}</span>
              <span className="bet-dashboard__nav-label">{allCopied ? 'COPIED!' : 'COPY ALL'}</span>
            </button>

            {!isRaceCompleted && onMarkAsBet && (
              <button className="bet-dashboard__nav-btn bet-dashboard__nav-btn--mark" onClick={onMarkAsBet}>
                <span className="material-icons">check</span>
                <span className="bet-dashboard__nav-label">MARK BET</span>
              </button>
            )}

            <button className="bet-dashboard__nav-btn" onClick={onViewPlan}>
              <span className="material-icons">dashboard</span>
              <span className="bet-dashboard__nav-label">OVERVIEW</span>
            </button>

            <button
              className="bet-dashboard__nav-btn"
              onClick={onNextRace}
              disabled={!onNextRace}
            >
              <span className="bet-dashboard__nav-label">NEXT</span>
              <span className="material-icons">arrow_forward</span>
            </button>
          </>
        ) : (
          <>
            <button className="bet-dashboard__nav-btn" onClick={onChangeOptions}>
              <span className="material-icons">arrow_back</span>
              <span className="bet-dashboard__nav-label">BACK</span>
            </button>

            <button
              className={`bet-dashboard__nav-btn bet-dashboard__nav-btn--primary ${allCopied ? 'bet-dashboard__nav-btn--copied' : ''}`}
              onClick={handleCopyAll}
            >
              <span className="material-icons">{allCopied ? 'check' : 'content_copy'}</span>
              <span className="bet-dashboard__nav-label">{allCopied ? 'COPIED!' : 'COPY ALL'}</span>
            </button>

            <button className="bet-dashboard__nav-btn" onClick={onChangeOptions}>
              <span className="material-icons">attach_money</span>
              <span className="bet-dashboard__nav-label">BUDGET</span>
            </button>

            <button className="bet-dashboard__nav-btn" onClick={onChangeOptions}>
              <span>{getStyleIcon(riskStyle)}</span>
              <span className="bet-dashboard__nav-label">STYLE</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
};

export default BetResults;
