import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ScoreCategoryBarProps {
  category: string;        // e.g., "Speed & Class"
  score: number;           // e.g., 89
  maxScore: number;        // e.g., 140
  showBar?: boolean;       // default true
}

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) 0',
};

const categoryLabelStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  minWidth: '140px',
};

const progressContainerStyles: React.CSSProperties = {
  flex: 1,
  height: '6px',
  backgroundColor: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-full)',
  overflow: 'hidden',
  minWidth: '60px',
};

const scoreValueStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'var(--font-mono)',
  whiteSpace: 'nowrap',
  minWidth: '50px',
  textAlign: 'right',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get bar color based on percentage of max score
 */
function getBarColor(score: number, maxScore: number): string {
  if (maxScore <= 0) return 'var(--text-tertiary)';

  const percentage = (score / maxScore) * 100;

  if (percentage >= 80) {
    return 'var(--status-success)'; // Green - excellent
  } else if (percentage >= 60) {
    return 'var(--tier-2)'; // Blue - good
  } else if (percentage >= 40) {
    return 'var(--status-warning)'; // Yellow - average
  } else {
    return 'var(--text-tertiary)'; // Gray - below average
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ScoreCategoryBar displays a single scoring category with its score and progress bar.
 * The bar color indicates performance: green (>=80%), blue (>=60%), yellow (>=40%), gray (<40%).
 */
export function ScoreCategoryBar({
  category,
  score,
  maxScore,
  showBar = true,
}: ScoreCategoryBarProps): React.ReactElement {
  const percentage = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0;
  const barColor = getBarColor(score, maxScore);

  return (
    <div style={containerStyles}>
      {/* Category Name */}
      <span style={categoryLabelStyles}>{category}</span>

      {/* Progress Bar (conditional) */}
      {showBar && (
        <div style={progressContainerStyles}>
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: barColor,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      )}

      {/* Score Value */}
      <span style={{ ...scoreValueStyles, color: barColor }}>
        {score}/{maxScore}
      </span>
    </div>
  );
}
