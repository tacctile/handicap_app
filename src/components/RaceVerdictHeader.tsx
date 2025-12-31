/**
 * Race Verdict Header Component
 *
 * Displays a prominent header at the top of each race showing:
 * - BET / CAUTION / PASS verdict
 * - Value play identification with edge percentage
 * - Bet type suggestion
 * - Educational explanation
 *
 * This is the first element users see when viewing a race.
 */

import React, { useState, useCallback } from 'react';
import type { RaceValueAnalysis, RaceVerdict, BetTypeSuggestion } from '../hooks/useValueDetection';
import {
  formatEdge,
  getEdgeColor,
  getVerdictColor,
  getVerdictBgColor,
  getBetTypeDisplay,
} from '../hooks/useValueDetection';
import { ValueTooltip } from './ValueTooltip';
import './RaceVerdictHeader.css';

interface RaceVerdictHeaderProps {
  /** Race value analysis from useValueDetection */
  valueAnalysis: RaceValueAnalysis;
  /** Race number for display */
  raceNumber: number;
  /** Callback when value play horse is clicked (scroll to horse) */
  onValuePlayClick?: (horseIndex: number) => void;
  /** Whether to start collapsed (default: false = expanded) */
  defaultCollapsed?: boolean;
}

/**
 * Get the verdict icon emoji
 */
function getVerdictIcon(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return '\u{1F7E2}'; // Green circle
    case 'CAUTION':
      return '\u{1F7E1}'; // Yellow circle
    case 'PASS':
      return '\u{1F534}'; // Red circle
  }
}

/**
 * Get the verdict label
 */
function getVerdictLabel(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return 'BETTABLE RACE';
    case 'CAUTION':
      return 'CAUTION — MARGINAL VALUE';
    case 'PASS':
      return 'PASS — NO VALUE IN THIS RACE';
  }
}

/**
 * Get the value play icon
 */
function getValuePlayIcon(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return '\u{1F525}'; // Fire
    case 'CAUTION':
      return '⚠️'; // Warning
    case 'PASS':
      return '';
  }
}

/**
 * Get the value play label prefix
 */
function getValuePlayLabel(verdict: RaceVerdict): string {
  switch (verdict) {
    case 'BET':
      return 'VALUE PLAY';
    case 'CAUTION':
      return 'POSSIBLE VALUE';
    case 'PASS':
      return '';
  }
}

/**
 * Generate educational explanation based on verdict and value play
 */
function getEducationalExplanation(valueAnalysis: RaceValueAnalysis): string {
  const { verdict, primaryValuePlay, topPick } = valueAnalysis;

  if (verdict === 'PASS') {
    if (topPick?.isChalk) {
      return 'The favorites are fairly priced. Betting here is gambling, not smart handicapping. Professional bettors skip races like this and wait for better opportunities.';
    }
    return "Our model does not see a clear edge in this race. The odds accurately reflect each horse's chances. Wait for a better opportunity.";
  }

  if (!primaryValuePlay) {
    return '';
  }

  const edge = Math.round(primaryValuePlay.valueEdge);
  const rank = primaryValuePlay.modelRank;
  const betType = primaryValuePlay.betType;

  if (verdict === 'BET') {
    const betExplanation =
      betType === 'WIN'
        ? `Bet WIN for maximum payout.`
        : betType === 'PLACE'
          ? `Bet PLACE (top 2 finish) for the best risk/reward.`
          : betType === 'SHOW'
            ? `Bet SHOW (top 3 finish) for a safer play.`
            : `Use as a key in exotic bets.`;

    return `Our model ranks this horse #${rank} in the field — a legit contender for the top ${rank <= 2 ? '2' : '3'}. But the public has them at ${primaryValuePlay.currentOdds} (longshot). That's a +${edge}% edge. ${betExplanation}`;
  }

  // CAUTION
  return `There's some value here, but the edge is smaller (+${edge}%). Consider a smaller bet size, or skip this race entirely. The edge isn't big enough to bet aggressively.`;
}

/**
 * Get bet type explanation for the suggestion
 */
function getBetTypeExplanation(betType: BetTypeSuggestion, edge: number): string {
  switch (betType) {
    case 'WIN':
      return '';
    case 'PLACE':
      return '(top 2 finish)';
    case 'SHOW':
      return edge < 75 ? '(lower edge = safer bet type)' : '(top 3 finish)';
    case 'TRIFECTA_KEY':
      return '(key in exotic bets)';
    case 'PASS':
      return '';
  }
}

export const RaceVerdictHeader: React.FC<RaceVerdictHeaderProps> = ({
  valueAnalysis,
  raceNumber,
  onValuePlayClick,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const { verdict, confidence, primaryValuePlay, verdictReason } = valueAnalysis;

  const handleValuePlayClick = useCallback(() => {
    if (primaryValuePlay && onValuePlayClick) {
      onValuePlayClick(primaryValuePlay.horseIndex);
    }
  }, [primaryValuePlay, onValuePlayClick]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const verdictColor = getVerdictColor(verdict);
  const verdictBgColor = getVerdictBgColor(verdict);

  // Collapsed view
  if (isCollapsed) {
    return (
      <div
        className="race-verdict-header race-verdict-header--collapsed"
        style={{ borderColor: verdictColor }}
        onClick={toggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapse();
          }
        }}
        aria-expanded={false}
        aria-label="Expand race verdict"
      >
        <div className="race-verdict-header__collapsed-content">
          <span className="race-verdict-header__icon">{getVerdictIcon(verdict)}</span>
          <span className="race-verdict-header__verdict-label" style={{ color: verdictColor }}>
            R{raceNumber}: {verdict}
          </span>
          {primaryValuePlay && (
            <>
              <span className="race-verdict-header__separator">|</span>
              <span className="race-verdict-header__value-horse">
                {primaryValuePlay.horseName} ({primaryValuePlay.currentOdds})
              </span>
              <span
                className="race-verdict-header__edge"
                style={{ color: getEdgeColor(primaryValuePlay.valueEdge) }}
              >
                {formatEdge(primaryValuePlay.valueEdge)}
              </span>
            </>
          )}
          <span className="material-icons race-verdict-header__expand-icon">expand_more</span>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div
      className={`race-verdict-header race-verdict-header--${verdict.toLowerCase()}`}
      style={{
        borderColor: verdictColor,
        backgroundColor: verdictBgColor,
      }}
    >
      {/* Header row with verdict and confidence */}
      <div className="race-verdict-header__top-row">
        <div className="race-verdict-header__verdict-section">
          <span className="race-verdict-header__icon">{getVerdictIcon(verdict)}</span>
          <span
            className="race-verdict-header__verdict-label"
            style={{ color: verdictColor }}
            title={
              verdict === 'BET'
                ? 'Our model found a value play. A horse the public is undervaluing.'
                : verdict === 'CAUTION'
                  ? 'Marginal value exists. Consider a smaller bet.'
                  : 'No value plays. Betting here is gambling, not smart handicapping.'
            }
          >
            {getVerdictLabel(verdict)}
          </span>
        </div>
        <div className="race-verdict-header__controls">
          <span
            className="race-verdict-header__confidence"
            title={
              confidence === 'HIGH'
                ? 'Clear separation between value play and field. Strong conviction.'
                : 'Value exists but less certain. Bet smaller.'
            }
          >
            {confidence} Confidence
          </span>
          <button
            className="race-verdict-header__collapse-btn"
            onClick={toggleCollapse}
            aria-label="Collapse race verdict"
            title="Collapse"
          >
            <span className="material-icons">expand_less</span>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="race-verdict-header__content">
        {verdict === 'PASS' ? (
          /* PASS verdict - no value play to show */
          <div className="race-verdict-header__pass-content">
            <p className="race-verdict-header__pass-reason">{verdictReason}</p>
          </div>
        ) : primaryValuePlay ? (
          /* BET or CAUTION verdict with value play */
          <>
            {/* Value play identification */}
            <div className="race-verdict-header__value-play-section">
              <span className="race-verdict-header__value-icon">{getValuePlayIcon(verdict)}</span>
              <span className="race-verdict-header__value-label">
                {getValuePlayLabel(verdict)}:
              </span>
              <button
                className="race-verdict-header__value-horse-btn"
                onClick={handleValuePlayClick}
                title="Click to scroll to this horse"
              >
                {primaryValuePlay.horseName.toUpperCase()} (#{primaryValuePlay.programNumber})
              </button>
            </div>

            {/* Odds comparison line */}
            <div className="race-verdict-header__odds-line">
              <span className="race-verdict-header__odds-item">
                <span className="race-verdict-header__odds-label">Current Odds:</span>
                <span className="race-verdict-header__odds-value">
                  {primaryValuePlay.currentOdds}
                </span>
              </span>
              <span className="race-verdict-header__odds-arrow">→</span>
              <span className="race-verdict-header__odds-item">
                <span className="race-verdict-header__odds-label">Our Fair Odds:</span>
                <span className="race-verdict-header__odds-value">
                  ~{Math.round(100 / primaryValuePlay.modelWinProb - 1)}-1
                </span>
              </span>
              <span className="race-verdict-header__odds-arrow">→</span>
              <span className="race-verdict-header__odds-item race-verdict-header__odds-item--edge">
                <span className="race-verdict-header__odds-label">
                  EDGE:
                  <ValueTooltip term="EDGE" className="race-verdict-header__tooltip" />
                </span>
                <span
                  className="race-verdict-header__edge-value"
                  style={{ color: getEdgeColor(primaryValuePlay.valueEdge) }}
                >
                  {formatEdge(primaryValuePlay.valueEdge)}
                </span>
              </span>
            </div>

            {/* Bet type suggestion */}
            <div className="race-verdict-header__bet-suggestion">
              <span className="race-verdict-header__bet-label">Suggested Bet:</span>
              <span className="race-verdict-header__bet-type">
                {getBetTypeDisplay(primaryValuePlay.betType)}
              </span>
              <span className="race-verdict-header__bet-explanation">
                {getBetTypeExplanation(primaryValuePlay.betType, primaryValuePlay.valueEdge)}
              </span>
            </div>
          </>
        ) : null}

        {/* Divider and educational explanation */}
        <div className="race-verdict-header__divider" />
        <div className="race-verdict-header__explanation">
          <span className="race-verdict-header__explanation-icon">{'\u{1F4A1}'}</span>
          <span className="race-verdict-header__explanation-label">What this means:</span>
          <span className="race-verdict-header__explanation-text">
            {getEducationalExplanation(valueAnalysis)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RaceVerdictHeader;
