/**
 * AIAnalysisContainer Component
 *
 * Container component that manages AI analysis state and renders
 * the collapsed summary and expanded panel.
 *
 * Design principle: Horses first, AI on demand.
 * The container is COLLAPSED by default, showing a subtle one-liner.
 * Users click to expand and see full AI insights.
 */

import React, { useState, useCallback } from 'react';
import { AIAnalysisSummary } from './AIAnalysisSummary';
import { AIAnalysisExpanded } from './AIAnalysisExpanded';
import { useAIAnalysis } from '../../hooks/useAIAnalysis';
import type { ParsedRace } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAnalysisContainerProps {
  /** The current race data */
  race: ParsedRace;
  /** Array of scored horses from the scoring engine */
  scoredHorses: ScoredHorse[];
  /** Race number for display context */
  raceNumber: number;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  position: 'relative',
  width: '100%',
};

const expandedContainerStyles: React.CSSProperties = {
  overflow: 'hidden',
  transition: 'max-height var(--transition-normal)',
};

const expandedVisibleStyles: React.CSSProperties = {
  ...expandedContainerStyles,
  maxHeight: '500px',
};

const expandedHiddenStyles: React.CSSProperties = {
  ...expandedContainerStyles,
  maxHeight: '0px',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AIAnalysisContainer manages AI analysis state and renders
 * the collapsed summary and expanded panel.
 *
 * Key behaviors:
 * - COLLAPSED by default (horses first, AI on demand)
 * - Calls useAIAnalysis hook to fetch/manage AI data
 * - Smooth height animation on expand/collapse
 */
export function AIAnalysisContainer({
  race,
  scoredHorses,
  raceNumber,
}: AIAnalysisContainerProps): React.ReactElement {
  // Collapsed by default - AI is on-demand
  const [isExpanded, setIsExpanded] = useState(false);

  // Get AI analysis from the hook
  const { aiAnalysis, aiLoading, aiError, isAIAvailable, retryAnalysis } = useAIAnalysis(
    race,
    scoredHorses
  );

  // Toggle expand/collapse
  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Don't render if AI is not available and no analysis/error
  if (!isAIAvailable && !aiAnalysis && !aiLoading && !aiError) {
    return <></>;
  }

  return (
    <div style={containerStyles}>
      {/* Always show the collapsed summary */}
      <AIAnalysisSummary
        analysis={aiAnalysis}
        isLoading={aiLoading}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        raceNumber={raceNumber}
        error={aiError}
      />

      {/* Expanded panel - conditionally rendered with animation */}
      <div style={isExpanded ? expandedVisibleStyles : expandedHiddenStyles}>
        {isExpanded && aiAnalysis && (
          <AIAnalysisExpanded analysis={aiAnalysis} raceNumber={raceNumber} />
        )}

        {/* Show retry button when expanded and there's an error */}
        {isExpanded && aiError && !aiAnalysis && (
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--status-error)',
              }}
            >
              <span className="material-icons" style={{ fontSize: '20px' }}>
                error_outline
              </span>
              <span style={{ fontSize: 'var(--text-sm)' }}>
                {aiError === 'API_KEY_MISSING'
                  ? 'AI analysis requires a Gemini API key'
                  : 'AI analysis failed'}
              </span>
            </div>
            {aiError !== 'API_KEY_MISSING' && (
              <button
                onClick={retryAnalysis}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>
                  refresh
                </span>
                Retry Analysis
              </button>
            )}
            {aiError === 'API_KEY_MISSING' && (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary)',
                  fontSize: 'var(--text-sm)',
                  textDecoration: 'none',
                }}
              >
                Get a Gemini API key
              </a>
            )}
          </div>
        )}

        {/* Loading state when expanded */}
        {isExpanded && aiLoading && !aiAnalysis && (
          <div
            style={{
              padding: 'var(--space-6)',
              backgroundColor: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span
              className="material-icons spinning"
              style={{
                fontSize: '32px',
                color: 'var(--text-tertiary)',
                animation: 'spin 1s linear infinite',
              }}
            >
              sync
            </span>
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                AI Analyzing Race...
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Running 5-bot analysis
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIAnalysisContainer;
