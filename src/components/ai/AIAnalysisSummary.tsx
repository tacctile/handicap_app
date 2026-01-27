/**
 * AIAnalysisSummary Component
 *
 * Displays a collapsed one-liner summary of AI analysis.
 * Shows AI icon, concise summary text, and expand chevron.
 * Designed to be subtle - horses are the hero, AI is on-demand.
 */

import React from 'react';
import type { AIRaceAnalysis } from '../../services/ai/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AIAnalysisSummaryProps {
  /** AI analysis result (null if not yet loaded) */
  analysis: AIRaceAnalysis | null;
  /** Whether AI analysis is currently loading */
  isLoading: boolean;
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse callback */
  onToggle: () => void;
  /** Race number for display context */
  raceNumber: number;
  /** Error message if AI analysis failed */
  error?: string | null;
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  backgroundColor: 'var(--bg-card)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'pointer',
  minHeight: '48px',
  transition: 'background-color var(--transition-fast)',
};

const containerHoverStyles: React.CSSProperties = {
  ...containerStyles,
  backgroundColor: 'var(--bg-elevated)',
};

const iconContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  flexShrink: 0,
};

const iconStyles: React.CSSProperties = {
  fontSize: '20px',
  color: 'var(--text-tertiary)',
};

const summaryTextStyles: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  lineHeight: 1.4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const loadingTextStyles: React.CSSProperties = {
  ...summaryTextStyles,
  color: 'var(--text-tertiary)',
  fontStyle: 'italic',
};

const errorTextStyles: React.CSSProperties = {
  ...summaryTextStyles,
  color: 'var(--status-error)',
};

const chevronContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  flexShrink: 0,
  transition: 'transform var(--transition-fast)',
};

const chevronStyles: React.CSSProperties = {
  fontSize: '20px',
  color: 'var(--text-tertiary)',
};

const spinnerStyles: React.CSSProperties = {
  fontSize: '18px',
  color: 'var(--text-tertiary)',
  animation: 'spin 1s linear infinite',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a concise one-line summary from AI analysis
 * Max ~100 characters, focusing on template, key horse, and primary insight
 */
function generateSummaryText(analysis: AIRaceAnalysis): string {
  const parts: string[] = [];

  // Template info
  if (analysis.ticketConstruction) {
    const template = analysis.ticketConstruction.template;
    if (template === 'PASS') {
      parts.push('PASS');
    } else {
      parts.push(`Template ${template}`);
    }
  }

  // Key horse / top pick
  if (analysis.topPick !== null) {
    const topPickInsight = analysis.horseInsights.find((h) => h.programNumber === analysis.topPick);
    if (topPickInsight) {
      parts.push(`key #${analysis.topPick} ${topPickInsight.horseName}`);
    }
  }

  // Primary insight flags
  const flags: string[] = [];
  if (analysis.vulnerableFavorite) {
    flags.push('vulnerable favorite');
  }
  if (
    analysis.ticketConstruction?.paceProjection === 'HOT' ||
    analysis.botDebugInfo?.paceScenario.summary.toLowerCase().includes('hot')
  ) {
    flags.push('hot pace');
  } else if (
    analysis.ticketConstruction?.paceProjection === 'SLOW' ||
    analysis.botDebugInfo?.paceScenario.summary.toLowerCase().includes('slow')
  ) {
    flags.push('slow pace');
  }
  if (analysis.chaoticRace) {
    flags.push('chaotic');
  }
  if (analysis.likelyUpset) {
    flags.push('upset likely');
  }

  // Add up to 2 flags
  if (flags.length > 0) {
    parts.push(flags.slice(0, 2).join(', '));
  }

  // Build final string
  let summary = parts.join('. ');

  // Add confidence at the end if space allows
  if (summary.length < 80 && analysis.confidence) {
    const conf =
      analysis.confidence === 'MINIMAL'
        ? 'no edge'
        : `${analysis.confidence.toLowerCase()} confidence`;
    summary += `. ${conf}`;
  }

  // Truncate if needed
  if (summary.length > 100) {
    summary = summary.substring(0, 97) + '...';
  }

  // Capitalize first letter
  if (summary.length > 0) {
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
  }

  return summary || 'AI analysis complete';
}

/**
 * Get insights count for summary
 */
function getInsightsCount(analysis: AIRaceAnalysis): number {
  let count = 0;

  // Count from bot debug info
  if (analysis.botDebugInfo) {
    if (analysis.botDebugInfo.tripTrouble.success) count++;
    if (analysis.botDebugInfo.paceScenario.success) count++;
    if (analysis.botDebugInfo.vulnerableFavorite.success) count++;
    if (analysis.botDebugInfo.fieldSpread.success) count++;
    if (analysis.botDebugInfo.classDrop.success) count++;
  }

  return count;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AIAnalysisSummary displays a collapsed one-liner summary of AI analysis.
 * Click to expand for full analysis details.
 */
export function AIAnalysisSummary({
  analysis,
  isLoading,
  isExpanded,
  onToggle,
  raceNumber,
  error,
}: AIAnalysisSummaryProps): React.ReactElement {
  const [isHovered, setIsHovered] = React.useState(false);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  // Determine content to display
  let summaryContent: React.ReactNode;
  let summaryStyles = summaryTextStyles;

  if (isLoading) {
    summaryContent = 'Analyzing race...';
    summaryStyles = loadingTextStyles;
  } else if (error) {
    summaryContent =
      error === 'API_KEY_MISSING' ? 'AI analysis requires API key' : 'AI analysis unavailable';
    summaryStyles = errorTextStyles;
  } else if (!analysis) {
    summaryContent = 'AI analysis unavailable';
    summaryStyles = loadingTextStyles;
  } else {
    const insightsCount = getInsightsCount(analysis);
    const summaryText = generateSummaryText(analysis);
    summaryContent = insightsCount > 0 ? summaryText : summaryText;
  }

  return (
    <div
      style={isHovered ? containerHoverStyles : containerStyles}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`AI Analysis for Race ${raceNumber}. ${isExpanded ? 'Click to collapse' : 'Click to expand'}`}
    >
      {/* AI Icon */}
      <div style={iconContainerStyles}>
        {isLoading ? (
          <span className="material-icons" style={spinnerStyles}>
            sync
          </span>
        ) : (
          <span className="material-icons" style={iconStyles}>
            psychology
          </span>
        )}
      </div>

      {/* Summary Text */}
      <span style={summaryStyles}>{summaryContent}</span>

      {/* Expand/Collapse Chevron */}
      <div
        style={{
          ...chevronContainerStyles,
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <span className="material-icons" style={chevronStyles}>
          expand_more
        </span>
      </div>
    </div>
  );
}

export default AIAnalysisSummary;
