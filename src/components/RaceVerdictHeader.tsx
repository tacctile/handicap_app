/**
 * Race Verdict Header Component (Single Line Layout)
 *
 * Single-line sticky header using --bar-height (48px) showing:
 * - Verdict icon + label + confidence + value play details on one line
 *
 * Full viewport width, no side margins. Uses uniform 14px typography.
 * Differentiates with color/weight only.
 */

import React, { useCallback } from 'react';
import type { RaceValueAnalysis, RaceVerdict } from '../hooks/useValueDetection';
import {
  formatEdge,
  getEdgeColor,
  getVerdictColor,
  getVerdictBgColor,
  getBetTypeDisplay,
} from '../hooks/useValueDetection';
import './RaceVerdictHeader.css';

interface RaceVerdictHeaderProps {
  /** Race value analysis from useValueDetection */
  valueAnalysis: RaceValueAnalysis;
  /** Race number for display */
  raceNumber: number;
  /** Callback when value play horse is clicked (scroll to horse) */
  onValuePlayClick?: (horseIndex: number) => void;
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
      return 'BETTABLE';
    case 'CAUTION':
      return 'CAUTION';
    case 'PASS':
      return 'PASS';
  }
}

/**
 * Get confidence label formatted for display
 */
function getConfidenceLabel(confidence: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (confidence) {
    case 'HIGH':
      return 'High Confidence';
    case 'MEDIUM':
      return 'Moderate Confidence';
    case 'LOW':
      return 'Low Confidence';
  }
}

/**
 * Convert decimal odds (like "10.00") to fractional (like "10-1")
 * or pass through if already in fractional format
 */
function convertToFractionalOdds(odds: string): string {
  if (!odds) return '—';

  // If already in fractional format (contains "-"), return as-is
  if (odds.includes('-')) return odds;

  // Parse decimal odds
  const decimal = parseFloat(odds);
  if (isNaN(decimal) || decimal <= 1) return odds;

  // Convert to fractional: decimal - 1 = X-1 format
  const fractional = Math.round(decimal - 1);
  return `${fractional}-1`;
}

/**
 * Calculate fair odds from model win probability
 */
function calculateFairOdds(modelWinProb: number): string {
  if (modelWinProb <= 0) return '—';
  const fairOddsDecimal = Math.round(100 / modelWinProb - 1);
  return `${fairOddsDecimal}-1`;
}

export const RaceVerdictHeader: React.FC<RaceVerdictHeaderProps> = ({
  valueAnalysis,
  raceNumber: _raceNumber,
  onValuePlayClick,
}) => {
  const { verdict, confidence, primaryValuePlay, verdictReason, closestToThreshold } =
    valueAnalysis;

  const handleValuePlayClick = useCallback(() => {
    if (primaryValuePlay && onValuePlayClick) {
      onValuePlayClick(primaryValuePlay.horseIndex);
    }
  }, [primaryValuePlay, onValuePlayClick]);

  const handleClosestHorseClick = useCallback(() => {
    if (closestToThreshold && onValuePlayClick) {
      onValuePlayClick(closestToThreshold.horseIndex);
    }
  }, [closestToThreshold, onValuePlayClick]);

  const verdictColor = getVerdictColor(verdict);
  const verdictBgColor = getVerdictBgColor(verdict);

  // Build short PASS reason for display
  const getPassReason = (): string => {
    if (verdictReason.includes('chalk')) {
      return 'No longshots';
    }
    return 'Below threshold';
  };

  return (
    <div
      className={`race-verdict-header race-verdict-header--${verdict.toLowerCase()}`}
      style={{
        borderColor: verdictColor,
        backgroundColor: verdictBgColor,
      }}
    >
      {/* Single line layout: Verdict + Details */}
      <div className="race-verdict-header__content">
        {/* Left: Verdict icon + label + confidence/reason */}
        <div className="race-verdict-header__verdict-section">
          <span className="race-verdict-header__icon">{getVerdictIcon(verdict)}</span>
          <span className="race-verdict-header__verdict-label" style={{ color: verdictColor }}>
            {getVerdictLabel(verdict)}
          </span>
          <span className="race-verdict-header__middot">·</span>
          <span className="race-verdict-header__confidence">
            {verdict === 'PASS' ? getPassReason() : getConfidenceLabel(confidence)}
          </span>
        </div>

        {/* Separator */}
        <div className="race-verdict-header__divider"></div>

        {/* Right: Value play details */}
        <div className="race-verdict-header__details-section">
          {verdict === 'PASS' ? (
            /* PASS verdict - show closest horse */
            closestToThreshold ? (
              <>
                <span className="race-verdict-header__label">Closest:</span>
                <button
                  className="race-verdict-header__horse-btn"
                  onClick={handleClosestHorseClick}
                  title="Click to scroll to this horse"
                >
                  {closestToThreshold.horseName.toUpperCase()} (#{closestToThreshold.programNumber})
                </button>
                <span className="race-verdict-header__middot">·</span>
                <span className="race-verdict-header__odds-value">
                  {convertToFractionalOdds(closestToThreshold.currentOdds)}
                </span>
                <span className="race-verdict-header__middot">·</span>
                <span className="race-verdict-header__label">Fair:</span>
                <span className="race-verdict-header__fair-value">
                  {closestToThreshold.fairOdds}
                </span>
                <span className="race-verdict-header__middot">·</span>
                <span
                  className="race-verdict-header__edge-value"
                  style={{ color: getEdgeColor(closestToThreshold.edge) }}
                >
                  {formatEdge(closestToThreshold.edge)} Edge
                </span>
                <span className="race-verdict-header__threshold-note">(below threshold)</span>
              </>
            ) : (
              <span className="race-verdict-header__no-value">No longshots with positive edge</span>
            )
          ) : primaryValuePlay ? (
            /* BET or CAUTION verdict with value play */
            <>
              <span className="race-verdict-header__fire-icon">{'\u{1F525}'}</span>
              <button
                className="race-verdict-header__horse-btn"
                onClick={handleValuePlayClick}
                title="Click to scroll to this horse"
              >
                {primaryValuePlay.horseName.toUpperCase()} (#{primaryValuePlay.programNumber})
              </button>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__odds-value">
                {convertToFractionalOdds(primaryValuePlay.currentOdds)}
              </span>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__label">Fair:</span>
              <span className="race-verdict-header__fair-value">
                {calculateFairOdds(primaryValuePlay.modelWinProb)}
              </span>
              <span className="race-verdict-header__middot">·</span>
              <span
                className="race-verdict-header__edge-value"
                style={{ color: getEdgeColor(primaryValuePlay.valueEdge) }}
              >
                {formatEdge(primaryValuePlay.valueEdge)} Edge
              </span>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__bet-type">
                {getBetTypeDisplay(primaryValuePlay.betType)}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RaceVerdictHeader;
