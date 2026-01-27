import React, { useState, useMemo } from 'react';
import { Drawer } from '../ui';
import { HorseScoreCard } from './HorseScoreCard';
import { HorseScoreBreakdown } from './HorseScoreBreakdown';
import { HorseProfile } from './HorseProfile';
import { HorsePastPerformances } from './HorsePastPerformances';
import { HorseWorkouts } from './HorseWorkouts';
import type { HorseEntry } from '../../types/drf';
import type { HorseScore } from '../../lib/scoring';
import { MAX_SCORE, MAX_BASE_SCORE } from '../../lib/scoring';

// ============================================================================
// TYPES
// ============================================================================

export interface HorseDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  horse: HorseEntry | null;
  score: HorseScore | null;
  rank: number;
  valueEdge?: number;
  fairOdds?: string;
}

type TabId = 'score' | 'profile' | 'pps' | 'workouts';

interface TabConfig {
  id: TabId;
  label: string;
  implemented: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS: TabConfig[] = [
  { id: 'score', label: 'Score', implemented: true },
  { id: 'profile', label: 'Profile', implemented: true },
  { id: 'pps', label: 'PPs', implemented: true },
  { id: 'workouts', label: 'Workouts', implemented: true },
];

// ============================================================================
// STYLES
// ============================================================================

const tabRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--bg-elevated)',
  marginTop: 'calc(-1 * var(--space-4))',
  marginLeft: 'calc(-1 * var(--space-4))',
  marginRight: 'calc(-1 * var(--space-4))',
  marginBottom: 'var(--space-4)',
};

const tabButtonStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  borderRadius: 'var(--radius-md)',
  border: 'none',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
};

const activeTabStyles: React.CSSProperties = {
  ...tabButtonStyles,
  backgroundColor: 'var(--bg-active)',
  color: 'var(--text-primary)',
};

const inactiveTabStyles: React.CSSProperties = {
  ...tabButtonStyles,
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
};

const tabContentStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const placeholderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-sm)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determine tier based on score thresholds from ALGORITHM_REFERENCE.md
 * Tier 1: 180+ with 70%+ confidence
 * Tier 2: 160-179 with 60%+ confidence
 * Tier 3: 130-159 with 40%+ confidence
 */
function determineTier(score: HorseScore): 1 | 2 | 3 | null {
  const baseScore = score.baseScore;
  const confidence = calculateConfidence(baseScore);

  if (baseScore >= 180 && confidence >= 70) {
    return 1;
  } else if (baseScore >= 160 && confidence >= 60) {
    return 2;
  } else if (baseScore >= 130 && confidence >= 40) {
    return 3;
  }
  return null;
}

/**
 * Calculate confidence from base score
 * Formula from ALGORITHM_REFERENCE.md: confidence = 40 + (baseScore / 331) * 60
 */
function calculateConfidence(baseScore: number): number {
  return Math.round(40 + (baseScore / MAX_BASE_SCORE) * 60);
}

/**
 * Calculate overlay from score
 * Overlay = total - baseScore
 */
function calculateOverlay(score: HorseScore): number {
  return score.overlayScore || score.total - score.baseScore;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseDetailDrawer is a slide-out panel showing detailed horse information.
 * Currently implements the Score tab with HorseScoreCard and HorseScoreBreakdown.
 * Profile, PPs, and Workouts tabs are placeholders for future implementation.
 */
export function HorseDetailDrawer({
  isOpen,
  onClose,
  horse,
  score,
  rank,
  valueEdge,
  fairOdds,
}: HorseDetailDrawerProps): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<TabId>('score');

  // Reset to score tab when drawer opens with new horse
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('score');
    }
  }, [isOpen, horse?.programNumber]);

  // Compute derived values from score
  const scoreCardProps = useMemo(() => {
    if (!horse || !score) return null;

    const tier = determineTier(score);
    const confidence = calculateConfidence(score.baseScore);
    const overlay = calculateOverlay(score);

    return {
      horseName: horse.horseName,
      score: score.total,
      maxScore: MAX_SCORE,
      baseScore: score.baseScore,
      maxBaseScore: MAX_BASE_SCORE,
      overlay,
      tier,
      confidence,
      rank,
      valueEdge,
      morningLineOdds: horse.morningLineOdds,
      fairOdds,
    };
  }, [horse, score, rank, valueEdge, fairOdds]);

  // Don't render if no horse data
  if (!horse || !score) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title="Horse Details" width="lg">
        <div style={placeholderStyles}>No horse selected</div>
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={horse.horseName} width="lg">
      {/* Tab Row */}
      <div style={tabRowStyles}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            style={activeTab === tab.id ? activeTabStyles : inactiveTabStyles}
            onClick={() => setActiveTab(tab.id)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={tabContentStyles}>
        {activeTab === 'score' && scoreCardProps && (
          <>
            <HorseScoreCard {...scoreCardProps} />
            <HorseScoreBreakdown score={score} />
          </>
        )}

        {activeTab === 'profile' && <HorseProfile horse={horse} />}

        {activeTab === 'pps' && <HorsePastPerformances pastPerformances={horse.pastPerformances} />}

        {activeTab === 'workouts' && <HorseWorkouts workouts={horse.workouts} />}
      </div>
    </Drawer>
  );
}
