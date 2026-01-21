/**
 * AIAnalysisPanel Component
 *
 * Displays AI race analysis results with loading/error states.
 * Collapsible panel that shows AI insights including:
 * - Race narrative
 * - Top pick with reasoning
 * - Value play recommendation
 * - Flags (vulnerable favorite, likely upset, chaotic race)
 * - Per-horse insights
 */

import React, { useState, useCallback } from 'react';
import type { AIRaceAnalysis, HorseInsight, BotStatusDebugInfo } from '../services/ai/types';
import './AIAnalysisPanel.css';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAnalysisPanelProps {
  /** AI analysis result (null if not yet loaded) */
  aiAnalysis: AIRaceAnalysis | null;
  /** Whether AI analysis is currently loading */
  loading: boolean;
  /** Error message if AI analysis failed */
  error: string | null;
  /** Callback to retry analysis */
  onRetry?: () => void;
  /** Optional: get horse name by program number (for display) */
  getHorseName?: (programNumber: number) => string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Loading state component
 */
const LoadingState: React.FC = () => (
  <div className="ai-panel__loading">
    <div className="ai-panel__loading-spinner">
      <span className="material-icons spinning">sync</span>
    </div>
    <div className="ai-panel__loading-text">
      <span className="ai-panel__loading-title">AI Analyzing Race...</span>
      <span className="ai-panel__loading-subtitle">
        Running multi-bot analysis (trip trouble, pace, favorites, field spread)
      </span>
    </div>
  </div>
);

/**
 * Error state component
 */
const ErrorState: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => {
  // Map error codes to user-friendly messages
  const getErrorDisplay = (errorCode: string) => {
    switch (errorCode) {
      case 'API_KEY_MISSING':
        return {
          icon: 'key_off',
          title: 'AI Analysis Requires API Key',
          message: 'Set VITE_GEMINI_API_KEY in your .env.local file to enable AI race analysis.',
          helpLink: 'https://aistudio.google.com/app/apikey',
          helpText: 'Get a Gemini API key',
          canRetry: false,
        };
      case 'RATE_LIMITED':
        return {
          icon: 'speed',
          title: 'Rate Limited',
          message: 'Too many requests. Please wait a moment before retrying.',
          canRetry: true,
        };
      case 'TIMEOUT':
        return {
          icon: 'timer_off',
          title: 'Analysis Timed Out',
          message: 'The AI service took too long to respond. Please try again.',
          canRetry: true,
        };
      case 'NETWORK_ERROR':
        return {
          icon: 'wifi_off',
          title: 'Network Error',
          message: 'Unable to connect to the AI service. Check your internet connection.',
          canRetry: true,
        };
      default:
        return {
          icon: 'error_outline',
          title: 'AI Analysis Failed',
          message: error || 'An unexpected error occurred.',
          canRetry: true,
        };
    }
  };

  const errorDisplay = getErrorDisplay(error);

  return (
    <div className="ai-panel__error">
      <span className="material-icons ai-panel__error-icon">{errorDisplay.icon}</span>
      <div className="ai-panel__error-content">
        <span className="ai-panel__error-title">{errorDisplay.title}</span>
        <span className="ai-panel__error-message">{errorDisplay.message}</span>
        {errorDisplay.helpLink && (
          <a
            href={errorDisplay.helpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-panel__error-link"
          >
            {errorDisplay.helpText} →
          </a>
        )}
      </div>
      {errorDisplay.canRetry && onRetry && (
        <button className="ai-panel__retry-btn" onClick={onRetry}>
          <span className="material-icons">refresh</span>
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

/**
 * Flag badge component
 */
const FlagBadge: React.FC<{
  active: boolean;
  icon: string;
  label: string;
  variant: 'warning' | 'danger' | 'info';
}> = ({ active, icon, label, variant }) => {
  if (!active) return null;

  return (
    <div className={`ai-panel__flag ai-panel__flag--${variant}`}>
      <span className="material-icons">{icon}</span>
      <span>{label}</span>
    </div>
  );
};

/**
 * Horse insight row component
 */
const HorseInsightRow: React.FC<{
  insight: HorseInsight;
  isTopPick: boolean;
  isValuePlay: boolean;
}> = ({ insight, isTopPick, isValuePlay }) => {
  const getValueLabelClass = (label: string) => {
    switch (label) {
      case 'BEST BET':
      case 'PRIME VALUE':
        return 'ai-panel__value-label--elite';
      case 'SOLID PLAY':
        return 'ai-panel__value-label--good';
      case 'FAIR PRICE':
      case 'WATCH ONLY':
        return 'ai-panel__value-label--fair';
      case 'TOO SHORT':
      case 'NO VALUE':
        return 'ai-panel__value-label--neutral';
      case 'SKIP':
      case 'NO CHANCE':
        return 'ai-panel__value-label--bad';
      default:
        return '';
    }
  };

  return (
    <div
      className={`ai-panel__horse-insight ${isTopPick ? 'ai-panel__horse-insight--top-pick' : ''} ${isValuePlay ? 'ai-panel__horse-insight--value-play' : ''}`}
    >
      <div className="ai-panel__horse-insight-header">
        <span className="ai-panel__horse-number">#{insight.programNumber}</span>
        <span className="ai-panel__horse-name">{insight.horseName}</span>
        {isTopPick && (
          <span className="ai-panel__horse-badge ai-panel__horse-badge--top">TOP PICK</span>
        )}
        {isValuePlay && (
          <span className="ai-panel__horse-badge ai-panel__horse-badge--value">VALUE</span>
        )}
        <span className={`ai-panel__value-label ${getValueLabelClass(insight.valueLabel)}`}>
          {insight.valueLabel}
        </span>
      </div>
      <div className="ai-panel__horse-insight-body">
        <span className="ai-panel__one-liner">{insight.oneLiner}</span>
        {insight.keyStrength && (
          <span className="ai-panel__key-factor ai-panel__key-factor--positive">
            <span className="material-icons">add_circle</span>
            {insight.keyStrength}
          </span>
        )}
        {insight.keyWeakness && (
          <span className="ai-panel__key-factor ai-panel__key-factor--negative">
            <span className="material-icons">remove_circle</span>
            {insight.keyWeakness}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Bot Status Debug section component
 * Shows success/failure status for each bot with data summaries
 */
const BotStatusDebugSection: React.FC<{ debugInfo: BotStatusDebugInfo }> = ({ debugInfo }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const botStatuses = [
    debugInfo.tripTrouble,
    debugInfo.paceScenario,
    debugInfo.vulnerableFavorite,
    debugInfo.fieldSpread,
  ];

  return (
    <div className="ai-panel__debug-section">
      <div
        className="ai-panel__debug-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsExpanded((prev) => !prev)}
      >
        <span className="material-icons ai-panel__debug-icon">bug_report</span>
        <span className="ai-panel__debug-title">Bot Status Debug</span>
        <span
          className={`ai-panel__debug-status ${debugInfo.successCount === 4 ? 'ai-panel__debug-status--success' : 'ai-panel__debug-status--warning'}`}
        >
          {debugInfo.successCount}/{debugInfo.totalBots} bots OK
        </span>
        <span className="material-icons ai-panel__debug-chevron">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      {isExpanded && (
        <div className="ai-panel__debug-content">
          <div className="ai-panel__debug-bots">
            {botStatuses.map((bot) => (
              <div key={bot.name} className="ai-panel__debug-bot">
                <div className="ai-panel__debug-bot-header">
                  <span
                    className={`ai-panel__debug-bot-indicator ${bot.success ? 'ai-panel__debug-bot-indicator--success' : 'ai-panel__debug-bot-indicator--fail'}`}
                  >
                    {bot.success ? '✓' : '✗'}
                  </span>
                  <span className="ai-panel__debug-bot-name">{bot.name}</span>
                  <span
                    className={`ai-panel__debug-bot-status ${bot.success ? 'ai-panel__debug-bot-status--success' : 'ai-panel__debug-bot-status--fail'}`}
                  >
                    {bot.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
                <div className="ai-panel__debug-bot-summary">{bot.summary}</div>
              </div>
            ))}
          </div>
          <div className="ai-panel__debug-signals">
            <div className="ai-panel__debug-signal-row">
              <span className="ai-panel__debug-signal-label">Signal Aggregation:</span>
              <span className="ai-panel__debug-signal-value">{debugInfo.signalSummary}</span>
            </div>
            <div className="ai-panel__debug-signal-row">
              <span className="ai-panel__debug-signal-label">Override Triggered:</span>
              <span
                className={`ai-panel__debug-signal-value ${debugInfo.hasOverride ? 'ai-panel__debug-signal-value--override' : ''}`}
              >
                {debugInfo.hasOverride ? 'YES - AI changed top pick' : 'NO - Confirms algorithm'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  aiAnalysis,
  loading,
  error,
  onRetry,
  getHorseName,
}) => {
  // State for collapse/expand
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Toggle show all insights
  const toggleShowAll = useCallback(() => {
    setShowAllInsights((prev) => !prev);
  }, []);

  // Get confidence badge variant
  const getConfidenceVariant = (confidence: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (confidence) {
      case 'HIGH':
        return 'ai-panel__confidence--high';
      case 'MEDIUM':
        return 'ai-panel__confidence--medium';
      case 'LOW':
        return 'ai-panel__confidence--low';
    }
  };

  // Render loading state
  if (loading && !aiAnalysis) {
    return (
      <div className="ai-panel">
        <div className="ai-panel__header">
          <div className="ai-panel__header-left">
            <span className="material-icons ai-panel__icon">psychology</span>
            <span className="ai-panel__title">AI Race Analysis</span>
          </div>
        </div>
        <LoadingState />
      </div>
    );
  }

  // Render error state
  if (error && !aiAnalysis) {
    return (
      <div className="ai-panel">
        <div className="ai-panel__header">
          <div className="ai-panel__header-left">
            <span className="material-icons ai-panel__icon">psychology</span>
            <span className="ai-panel__title">AI Race Analysis</span>
          </div>
        </div>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  // No analysis available yet (before first load)
  if (!aiAnalysis) {
    return null;
  }

  // Get top pick and value play horse insights
  const topPickInsight = aiAnalysis.horseInsights.find(
    (h) => h.programNumber === aiAnalysis.topPick
  );
  const valuePlayInsight =
    aiAnalysis.valuePlay !== aiAnalysis.topPick
      ? aiAnalysis.horseInsights.find((h) => h.programNumber === aiAnalysis.valuePlay)
      : null;

  // Get horse name for avoid list display
  const getHorseNameDisplay = (programNumber: number) => {
    if (getHorseName) return getHorseName(programNumber);
    const insight = aiAnalysis.horseInsights.find((h) => h.programNumber === programNumber);
    return insight?.horseName || `#${programNumber}`;
  };

  // Insights to show (limited or all)
  const contenderInsights = aiAnalysis.horseInsights.filter((h) => h.isContender);
  const insightsToShow = showAllInsights ? aiAnalysis.horseInsights : contenderInsights.slice(0, 4);

  return (
    <div className={`ai-panel ${isCollapsed ? 'ai-panel--collapsed' : ''}`}>
      {/* Header */}
      <div className="ai-panel__header" onClick={toggleCollapse}>
        <div className="ai-panel__header-left">
          <span className="material-icons ai-panel__icon">psychology</span>
          <span className="ai-panel__title">AI Race Analysis</span>
          <span className={`ai-panel__confidence ${getConfidenceVariant(aiAnalysis.confidence)}`}>
            {aiAnalysis.confidence} CONFIDENCE
          </span>
          {aiAnalysis.bettableRace ? (
            <span className="ai-panel__bettable ai-panel__bettable--yes">BETTABLE</span>
          ) : (
            <span className="ai-panel__bettable ai-panel__bettable--no">PASS</span>
          )}
          {loading && (
            <span className="ai-panel__updating">
              <span className="material-icons spinning">sync</span>
              Updating...
            </span>
          )}
        </div>
        <div className="ai-panel__header-right">
          <span className="material-icons ai-panel__collapse-icon">
            {isCollapsed ? 'expand_more' : 'expand_less'}
          </span>
        </div>
      </div>

      {/* Content (collapsible) */}
      {!isCollapsed && (
        <div className="ai-panel__content">
          {/* Race Narrative */}
          <div className="ai-panel__narrative">
            <p>{aiAnalysis.raceNarrative}</p>
          </div>

          {/* Flags Row */}
          <div className="ai-panel__flags">
            <FlagBadge
              active={aiAnalysis.vulnerableFavorite}
              icon="warning"
              label="Vulnerable Favorite"
              variant="warning"
            />
            <FlagBadge
              active={aiAnalysis.likelyUpset}
              icon="trending_up"
              label="Likely Upset"
              variant="info"
            />
            <FlagBadge
              active={aiAnalysis.chaoticRace}
              icon="shuffle"
              label="Chaotic Race"
              variant="danger"
            />
          </div>

          {/* Top Pick & Value Play */}
          <div className="ai-panel__picks">
            {/* Top Pick */}
            {topPickInsight && (
              <div className="ai-panel__pick-card ai-panel__pick-card--top">
                <div className="ai-panel__pick-header">
                  <span className="material-icons">emoji_events</span>
                  <span>Top Pick</span>
                </div>
                <div className="ai-panel__pick-horse">
                  <span className="ai-panel__pick-number">#{topPickInsight.programNumber}</span>
                  <span className="ai-panel__pick-name">{topPickInsight.horseName}</span>
                </div>
                <div className="ai-panel__pick-reason">{topPickInsight.oneLiner}</div>
              </div>
            )}

            {/* Value Play */}
            {valuePlayInsight && (
              <div className="ai-panel__pick-card ai-panel__pick-card--value">
                <div className="ai-panel__pick-header">
                  <span className="material-icons">paid</span>
                  <span>Value Play</span>
                </div>
                <div className="ai-panel__pick-horse">
                  <span className="ai-panel__pick-number">#{valuePlayInsight.programNumber}</span>
                  <span className="ai-panel__pick-name">{valuePlayInsight.horseName}</span>
                </div>
                <div className="ai-panel__pick-reason">{valuePlayInsight.oneLiner}</div>
              </div>
            )}

            {/* Avoid List */}
            {aiAnalysis.avoidList.length > 0 && (
              <div className="ai-panel__pick-card ai-panel__pick-card--avoid">
                <div className="ai-panel__pick-header">
                  <span className="material-icons">block</span>
                  <span>Avoid</span>
                </div>
                <div className="ai-panel__avoid-list">
                  {aiAnalysis.avoidList.map((num) => (
                    <span key={num} className="ai-panel__avoid-horse">
                      #{num} {getHorseNameDisplay(num)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Horse Insights */}
          <div className="ai-panel__insights-section">
            <div className="ai-panel__insights-header">
              <span className="ai-panel__insights-title">Per-Horse Analysis</span>
              <button className="ai-panel__show-all-btn" onClick={toggleShowAll}>
                {showAllInsights ? 'Show Contenders' : 'Show All'}
              </button>
            </div>
            <div className="ai-panel__insights-grid">
              {insightsToShow.map((insight) => (
                <HorseInsightRow
                  key={insight.programNumber}
                  insight={insight}
                  isTopPick={insight.programNumber === aiAnalysis.topPick}
                  isValuePlay={insight.programNumber === aiAnalysis.valuePlay}
                />
              ))}
            </div>
          </div>

          {/* Bot Status Debug Info - Shows bot success/failure and data summaries */}
          {aiAnalysis.botDebugInfo && <BotStatusDebugSection debugInfo={aiAnalysis.botDebugInfo} />}

          {/* Processing Time */}
          <div className="ai-panel__footer">
            <span className="ai-panel__timestamp">
              Analyzed {new Date(aiAnalysis.timestamp).toLocaleTimeString()} •{' '}
              {aiAnalysis.processingTimeMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalysisPanel;
