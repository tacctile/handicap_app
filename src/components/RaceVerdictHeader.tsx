/**
 * Race Verdict Header Component (Redesigned)
 *
 * Fixed 2-unit height (128px = 2 × top bar height) sticky header showing:
 * - Line 1: Verdict type + confidence level
 * - Line 2: Value play details (horse name, odds, fair odds, edge%, bet type)
 *
 * Always visible, no collapse/expand functionality.
 * Uses 3-tier typography system:
 * - PRIMARY: 16px semibold — horse name, edge percentage, bet type
 * - SECONDARY: 14px regular — odds values, fair odds, verdict label, confidence
 * - TERTIARY: 12px regular, muted — labels
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
      return 'BETTABLE RACE';
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

  // Build PASS reason for display
  const getPassReason = (): string => {
    if (verdictReason.includes('chalk')) {
      return 'All contenders are chalk (under 6-1 odds)';
    }
    return 'No horses show 50%+ edge at 6-1 or longer';
  };

  return (
    <div
      className={`race-verdict-header race-verdict-header--${verdict.toLowerCase()}`}
      style={{
        borderColor: verdictColor,
        backgroundColor: verdictBgColor,
      }}
    >
      {/* LINE 1: Verdict type + confidence */}
      <div className="race-verdict-header__line1">
        <div className="race-verdict-header__verdict-section">
          <span className="race-verdict-header__icon">{getVerdictIcon(verdict)}</span>
          <span className="race-verdict-header__verdict-label" style={{ color: verdictColor }}>
            {getVerdictLabel(verdict)}
          </span>
          {verdict === 'PASS' && (
            <>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__pass-reason">{getPassReason()}</span>
            </>
          )}
          {verdict !== 'PASS' && (
            <>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__confidence">
                {getConfidenceLabel(confidence)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* LINE 2: Value play details OR closest-to-threshold for PASS */}
      <div className="race-verdict-header__line2">
        {verdict === 'PASS' ? (
          /* PASS verdict - show closest horse to threshold */
          closestToThreshold ? (
            <div className="race-verdict-header__closest-section">
              <span className="race-verdict-header__closest-label">Closest:</span>
              <button
                className="race-verdict-header__horse-btn"
                onClick={handleClosestHorseClick}
                title="Click to scroll to this horse"
              >
                {closestToThreshold.horseName.toUpperCase()} (#{closestToThreshold.programNumber})
              </button>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__odds-value">
                {closestToThreshold.currentOdds}
              </span>
              <span className="race-verdict-header__middot">·</span>
              <span className="race-verdict-header__fair-label">Fair:</span>
              <span className="race-verdict-header__fair-value">{closestToThreshold.fairOdds}</span>
              <span className="race-verdict-header__middot">·</span>
              <span
                className="race-verdict-header__edge-value"
                style={{ color: getEdgeColor(closestToThreshold.edge) }}
              >
                {formatEdge(closestToThreshold.edge)} Edge
              </span>
              <span className="race-verdict-header__threshold-note">(below 50% threshold)</span>
            </div>
          ) : (
            <div className="race-verdict-header__no-value">
              No horses at 6-1 or longer odds with positive edge
            </div>
          )
        ) : primaryValuePlay ? (
          /* BET or CAUTION verdict with value play */
          <div className="race-verdict-header__value-section">
            <span className="race-verdict-header__fire-icon">{'\u{1F525}'}</span>
            <button
              className="race-verdict-header__horse-btn"
              onClick={handleValuePlayClick}
              title="Click to scroll to this horse"
            >
              {primaryValuePlay.horseName.toUpperCase()} (#{primaryValuePlay.programNumber})
            </button>
            <span className="race-verdict-header__middot">·</span>
            <span className="race-verdict-header__odds-value">{primaryValuePlay.currentOdds}</span>
            <span className="race-verdict-header__middot">·</span>
            <span className="race-verdict-header__fair-label">Fair:</span>
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
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RaceVerdictHeader;
