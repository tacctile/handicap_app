import React from 'react';
import { ScoreCategoryBar } from './ScoreCategoryBar';
import type { HorseScore } from '../../lib/scoring';

// ============================================================================
// TYPES
// ============================================================================

export interface HorseScoreBreakdownProps {
  score: HorseScore;  // Full score object from scoring system
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Score category definitions with their max values from ALGORITHM_REFERENCE.md
 */
const SCORE_CATEGORIES = {
  speedClass: { label: 'Speed & Class', max: 140 },
  form: { label: 'Form', max: 50 },
  pace: { label: 'Pace', max: 35 },
  connections: { label: 'Connections', max: 23 },
  distanceSurface: { label: 'Distance/Surface', max: 20 },
  postPosition: { label: 'Post Position', max: 12 },
  odds: { label: 'Odds Factor', max: 12 },
  trackSpecialist: { label: 'Track Specialist', max: 10 },
  equipment: { label: 'Equipment', max: 8 },
  trainerPatterns: { label: 'Trainer Patterns', max: 8 },
  trainerSurfaceDistance: { label: 'Trainer Surf/Dist', max: 6 },
  comboPatterns: { label: 'Combo Patterns', max: 4 },
  ageFactor: { label: 'Age Factor', max: 1 },
  siresSire: { label: "Sire's Sire", max: 1 },
  weight: { label: 'Weight', max: 1 },
} as const;

// ============================================================================
// STYLES
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
};

const sectionHeaderStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  color: 'var(--text-primary)',
  marginTop: 'var(--space-3)',
  marginBottom: 'var(--space-1)',
  paddingBottom: 'var(--space-1)',
  borderBottom: '1px solid var(--border-subtle)',
};

// ============================================================================
// HELPERS
// ============================================================================

interface CategoryData {
  key: string;
  label: string;
  score: number;
  max: number;
}

/**
 * Extract category scores from HorseScore breakdown
 */
function extractCategoryScores(score: HorseScore): CategoryData[] {
  const breakdown = score.breakdown;
  const categories: CategoryData[] = [];

  // Core categories (always present)
  categories.push({
    key: 'speedClass',
    label: SCORE_CATEGORIES.speedClass.label,
    score: breakdown.speedClass.total,
    max: SCORE_CATEGORIES.speedClass.max,
  });

  categories.push({
    key: 'form',
    label: SCORE_CATEGORIES.form.label,
    score: breakdown.form.total,
    max: SCORE_CATEGORIES.form.max,
  });

  categories.push({
    key: 'pace',
    label: SCORE_CATEGORIES.pace.label,
    score: breakdown.pace.total,
    max: SCORE_CATEGORIES.pace.max,
  });

  categories.push({
    key: 'connections',
    label: SCORE_CATEGORIES.connections.label,
    score: breakdown.connections.total,
    max: SCORE_CATEGORIES.connections.max,
  });

  categories.push({
    key: 'distanceSurface',
    label: SCORE_CATEGORIES.distanceSurface.label,
    score: breakdown.distanceSurface.total,
    max: SCORE_CATEGORIES.distanceSurface.max,
  });

  categories.push({
    key: 'postPosition',
    label: SCORE_CATEGORIES.postPosition.label,
    score: breakdown.postPosition.total,
    max: SCORE_CATEGORIES.postPosition.max,
  });

  categories.push({
    key: 'odds',
    label: SCORE_CATEGORIES.odds.label,
    score: breakdown.odds.total,
    max: SCORE_CATEGORIES.odds.max,
  });

  categories.push({
    key: 'trackSpecialist',
    label: SCORE_CATEGORIES.trackSpecialist.label,
    score: breakdown.trackSpecialist.total,
    max: SCORE_CATEGORIES.trackSpecialist.max,
  });

  categories.push({
    key: 'equipment',
    label: SCORE_CATEGORIES.equipment.label,
    score: breakdown.equipment.total,
    max: SCORE_CATEGORIES.equipment.max,
  });

  categories.push({
    key: 'trainerPatterns',
    label: SCORE_CATEGORIES.trainerPatterns.label,
    score: breakdown.trainerPatterns.total,
    max: SCORE_CATEGORIES.trainerPatterns.max,
  });

  categories.push({
    key: 'trainerSurfaceDistance',
    label: SCORE_CATEGORIES.trainerSurfaceDistance.label,
    score: breakdown.trainerSurfaceDistance.total,
    max: SCORE_CATEGORIES.trainerSurfaceDistance.max,
  });

  categories.push({
    key: 'comboPatterns',
    label: SCORE_CATEGORIES.comboPatterns.label,
    score: breakdown.comboPatterns.total,
    max: SCORE_CATEGORIES.comboPatterns.max,
  });

  // P3 Refinements (optional - check if they exist)
  if (breakdown.ageAnalysis) {
    categories.push({
      key: 'ageFactor',
      label: SCORE_CATEGORIES.ageFactor.label,
      score: breakdown.ageAnalysis.adjustment,
      max: SCORE_CATEGORIES.ageFactor.max,
    });
  }

  if (breakdown.siresSireAnalysis) {
    categories.push({
      key: 'siresSire',
      label: SCORE_CATEGORIES.siresSire.label,
      score: breakdown.siresSireAnalysis.adjustment,
      max: SCORE_CATEGORIES.siresSire.max,
    });
  }

  categories.push({
    key: 'weight',
    label: SCORE_CATEGORIES.weight.label,
    score: breakdown.weightAnalysis.total,
    max: SCORE_CATEGORIES.weight.max,
  });

  return categories;
}

/**
 * Split categories into core and bonus sections
 */
function splitCategories(categories: CategoryData[]): {
  core: CategoryData[];
  bonus: CategoryData[];
  refinements: CategoryData[];
} {
  const coreKeys = ['speedClass', 'form', 'pace', 'connections', 'postPosition', 'odds', 'equipment'];
  const bonusKeys = ['distanceSurface', 'trackSpecialist', 'trainerPatterns', 'trainerSurfaceDistance', 'comboPatterns'];
  const refinementKeys = ['ageFactor', 'siresSire', 'weight'];

  return {
    core: categories.filter((c) => coreKeys.includes(c.key)),
    bonus: categories.filter((c) => bonusKeys.includes(c.key)),
    refinements: categories.filter((c) => refinementKeys.includes(c.key)),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * HorseScoreBreakdown displays all scoring categories with their individual scores.
 * Categories are organized into Core, Bonus, and Refinement sections.
 */
export function HorseScoreBreakdown({
  score,
}: HorseScoreBreakdownProps): React.ReactElement {
  const categories = extractCategoryScores(score);
  const { core, bonus, refinements } = splitCategories(categories);

  return (
    <div style={containerStyles}>
      {/* Core Categories */}
      <div style={sectionHeaderStyles}>Core Factors</div>
      {core.map((cat) => (
        <ScoreCategoryBar
          key={cat.key}
          category={cat.label}
          score={cat.score}
          maxScore={cat.max}
        />
      ))}

      {/* Bonus Categories */}
      <div style={sectionHeaderStyles}>Bonus Factors</div>
      {bonus.map((cat) => (
        <ScoreCategoryBar
          key={cat.key}
          category={cat.label}
          score={cat.score}
          maxScore={cat.max}
        />
      ))}

      {/* P3 Refinements (only show if any have non-zero scores) */}
      {refinements.some((c) => c.score !== 0) && (
        <>
          <div style={sectionHeaderStyles}>Refinements</div>
          {refinements
            .filter((c) => c.score !== 0)
            .map((cat) => (
              <ScoreCategoryBar
                key={cat.key}
                category={cat.label}
                score={cat.score}
                maxScore={cat.max}
              />
            ))}
        </>
      )}
    </div>
  );
}
