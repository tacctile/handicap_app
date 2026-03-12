/**
 * Expanded inline view for a horse showing past performances, workouts,
 * score breakdowns, and betting context within the race list.
 * @param props - Component props
 * @returns React element
 */
import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ErrorBoundary } from './ErrorBoundary';
import './HorseExpandedView.css';
import { PPLine } from './PPLine';
import type { HorseEntry, PastPerformance, Workout } from '../types/drf';
import type { HorseScore, ScoredHorse } from '../lib/scoring';
import { formatRacingDistance, getEdgeColor } from '../utils/formatters';
import type { BetTier, RaceContextSummary } from '../hooks/useRaceBets';

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

// Import score limits and tier functions from the authoritative scoring engine (single source of truth)
import {
  SCORE_LIMITS as SCORING_LIMITS,
  MAX_BASE_SCORE,
  MAX_SCORE,
  getScoreColor,
} from '../lib/scoring';

// Score limits by category - derived from lib/scoring for display
const SCORE_LIMITS = {
  connections: SCORING_LIMITS.connections, // 24
  postPosition: SCORING_LIMITS.postPosition, // 12
  speedClass: SCORING_LIMITS.speedClass, // 140
  form: SCORING_LIMITS.form, // 50
  equipment: SCORING_LIMITS.equipment, // 8
  pace: SCORING_LIMITS.pace, // 45
  base: MAX_BASE_SCORE, // 336 - Max base score before overlay
  total: MAX_SCORE, // 376 - Max final score (base + overlay)
} as const;

// All scoring categories including hidden ones (for full report card)
const ALL_CATEGORIES: Array<{ key: string; label: string; max: number; description: string }> = [
  {
    key: 'connections',
    label: 'CONNECTIONS',
    max: SCORING_LIMITS.connections,
    description: 'Trainer & Jockey combo quality',
  },
  {
    key: 'postPosition',
    label: 'POST POSITION',
    max: SCORING_LIMITS.postPosition,
    description: 'Starting gate advantage',
  },
  {
    key: 'speedClass',
    label: 'SPEED/CLASS',
    max: SCORING_LIMITS.speedClass,
    description: 'Raw speed + competition level',
  },
  { key: 'form', label: 'FORM', max: SCORING_LIMITS.form, description: 'Recent race performance' },
  {
    key: 'equipment',
    label: 'EQUIPMENT',
    max: SCORING_LIMITS.equipment,
    description: 'Gear changes & effects',
  },
  {
    key: 'pace',
    label: 'PACE',
    max: SCORING_LIMITS.pace,
    description: 'Running style fit for this race',
  },
  {
    key: 'distanceSurface',
    label: 'DISTANCE/SURFACE',
    max: 20,
    description: 'Track type & distance preference',
  },
  {
    key: 'trainerPatterns',
    label: 'TRAINER PATTERNS',
    max: 8,
    description: 'Trainer situational win patterns',
  },
  {
    key: 'comboPatterns',
    label: 'COMBO PATTERNS',
    max: 10,
    description: 'Multi-factor winning combos',
  },
  {
    key: 'trackSpecialist',
    label: 'TRACK SPECIALIST',
    max: 10,
    description: 'Performance at this specific track',
  },
  {
    key: 'trainerSurfaceDistance',
    label: 'TRAINER SURFACE/DIST',
    max: 6,
    description: 'Trainer skill on this surface & distance',
  },
  { key: 'weightAnalysis', label: 'WEIGHT', max: 1, description: 'Weight change impact' },
  { key: 'sexAnalysis', label: 'SEX ANALYSIS', max: 0, description: 'Gender-based adjustments' },
];

// Get field-relative label from rank and field size
const getFieldLabel = (fieldRank: number, fieldSize: number): { label: string; color: string } => {
  if (fieldSize <= 4) {
    // Compressed scale for small fields
    if (fieldRank === 1) return { label: 'Top Pick', color: '#22c55e' };
    if (fieldRank === 2) return { label: 'Contender', color: '#22c55e' };
    return { label: 'Longshot', color: '#eab308' };
  }
  if (fieldRank === 1) return { label: 'Top Pick', color: '#22c55e' };
  if (fieldRank === 2) return { label: 'Contender', color: '#22c55e' };
  if (fieldRank === 3) return { label: 'In the Mix', color: '#eab308' };
  if (fieldRank === 4) return { label: 'Longshot', color: '#eab308' };
  return { label: 'Long Odds', color: '#6B7280' };
};

// Fallback: percentage-based labels when field rank is not available
const getPercentLabel = (percent: number): { label: string; color: string } => {
  if (percent >= 70) return { label: 'Top Tier', color: '#22c55e' };
  if (percent >= 55) return { label: 'Solid Pick', color: '#22c55e' };
  if (percent >= 40) return { label: 'In the Mix', color: '#eab308' };
  if (percent >= 25) return { label: 'Longshot', color: '#eab308' };
  return { label: 'Long Odds', color: '#6B7280' };
};

// Get field ranking for a specific category
const getFieldRanking = (
  horseName: string,
  categoryKey: string,
  allScoredHorses: ScoredHorse[]
): { rank: number; total: number; percentile: string } => {
  const activeHorses = allScoredHorses.filter((h) => !h.score.isScratched);
  if (activeHorses.length === 0) return { rank: 0, total: 0, percentile: '—' };

  const scores = activeHorses
    .map((h) => {
      const breakdown = h.score.breakdown;
      const cat = breakdown?.[categoryKey as keyof typeof breakdown] as
        | { total?: number }
        | undefined;
      return { name: h.horse.horseName, value: cat?.total || 0 };
    })
    .sort((a, b) => b.value - a.value);

  const rank = scores.findIndex((s) => s.name === horseName) + 1;
  const total = scores.length;
  const percentile = total > 1 ? `Top ${Math.round((rank / total) * 100)}%` : '—';

  return { rank: rank || total, total, percentile };
};

// Equipment code mappings
const EQUIPMENT_CODES: Record<string, string> = {
  B: 'Blinkers',
  L: 'Lasix',
  BL: 'Blinkers, Lasix',
  TT: 'Tongue Tie',
  MT: 'Mud Caulks, Tongue Tie',
  '1stB': 'First-Time Blinkers',
  '1stL': 'First-Time Lasix',
  b: 'Blinkers',
  l: 'Lasix',
  bl: 'Blinkers, Lasix',
  tt: 'Tongue Tie',
  mt: 'Mud Caulks, Tongue Tie',
  f: 'Front Wraps',
  F: 'Front Wraps',
  c: 'Cheek Pieces',
  C: 'Cheek Pieces',
  s: 'Shadow Roll',
  S: 'Shadow Roll',
};

// Medication code mappings
const MEDICATION_CODES: Record<string, string> = {
  L: 'Lasix',
  B: 'Bute',
  L1: 'First-Time Lasix',
  '1L': 'First-Time Lasix',
  l: 'Lasix',
  b: 'Bute',
};

// Category configuration for display - matches the explicit requirements
interface CategoryConfig {
  key: string;
  label: string;
  description: string;
  max: number;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'connections',
    label: 'CONNECTIONS',
    description: 'Trainer/Jockey',
    max: SCORING_LIMITS.connections,
  },
  {
    key: 'postPosition',
    label: 'POST',
    description: 'Draw position',
    max: SCORING_LIMITS.postPosition,
  },
  {
    key: 'speedClass',
    label: 'SPEED/CLASS',
    description: 'Figures & Class',
    max: SCORING_LIMITS.speedClass,
  },
  { key: 'form', label: 'FORM', description: 'Recent races', max: SCORING_LIMITS.form },
  {
    key: 'equipment',
    label: 'EQUIPMENT',
    description: 'Gear changes',
    max: SCORING_LIMITS.equipment,
  },
  { key: 'pace', label: 'PACE', description: 'Race shape', max: SCORING_LIMITS.pace },
];

/**
 * Get category rating info based on percentage
 */
interface CategoryRating {
  icon: string;
  label: string;
  colorClass: string;
}

const getCategoryRating = (percent: number): CategoryRating => {
  if (percent >= 80) return { icon: '✅', label: 'Elite', colorClass: 'elite' };
  if (percent >= 60) return { icon: '✅', label: 'Good', colorClass: 'good' };
  if (percent >= 40) return { icon: '➖', label: 'Average', colorClass: 'average' };
  if (percent >= 20) return { icon: '⚠️', label: 'Weak', colorClass: 'weak' };
  return { icon: '❌', label: 'Poor', colorClass: 'poor' };
};

/**
 * Generate dynamic explanation for each category
 */
const getCategoryExplanation = (
  key: string,
  percent: number,
  _score: HorseScore | undefined,
  horse: HorseEntry
): string => {
  switch (key) {
    case 'speedClass': {
      const bestBeyer = horse.pastPerformances?.[0]?.speedFigures?.beyer || horse.lastBeyer || 0;
      if (percent >= 80) return `Best Beyer ${bestBeyer} — elite speed`;
      if (percent >= 60) return `Beyer ${bestBeyer} competitive with field`;
      if (percent >= 40) return `Speed figures in the mid-range`;
      return `Speed figures below field average`;
    }
    case 'form': {
      const lastFinish = horse.pastPerformances?.[0]?.finishPosition || 0;
      const lastFinishOrd =
        lastFinish === 1
          ? '1st'
          : lastFinish === 2
            ? '2nd'
            : lastFinish === 3
              ? '3rd'
              : `${lastFinish}th`;
      if (percent >= 80) return `Hot form — recent top finishes`;
      if (percent >= 60) return `Solid form — top 3 recently`;
      if (percent >= 40) return `Mixed form — ${lastFinishOrd} last out`;
      if (percent >= 20) return `Concerning — ${lastFinishOrd} last out`;
      return `Cold form — needs bounce-back`;
    }
    case 'pace': {
      if (percent >= 80) return `Perfect pace scenario for this style`;
      if (percent >= 60) return `Favorable pace setup`;
      if (percent >= 40) return `Pace scenario is neutral`;
      return `Pace scenario may hurt`;
    }
    case 'connections': {
      const trainer = horse.trainerName?.split(' ').pop() || 'Trainer';
      const jockey = horse.jockeyName?.split(' ').pop() || 'Jockey';
      if (percent >= 80) return `${trainer}/${jockey} — top combo`;
      if (percent >= 60) return `${trainer}/${jockey} — solid`;
      if (percent >= 40) return `Average trainer/jockey stats`;
      return `Below-average connections`;
    }
    case 'postPosition': {
      const post = horse.postPosition || horse.programNumber;
      if (percent >= 80) return `Post ${post} — great position`;
      if (percent >= 60) return `Post ${post} — solid position`;
      if (percent >= 40) return `Post ${post} — neutral`;
      return `Post ${post} — challenging draw`;
    }
    case 'equipment': {
      const hasFirstTimeBlinkers =
        horse.equipment?.firstTimeEquipment?.includes('blinkers') || false;
      if (hasFirstTimeBlinkers) return `First-time blinkers — watch for improvement`;
      if (percent >= 60) return `Equipment suits this horse`;
      return `Standard equipment`;
    }
    default:
      return '';
  }
};

/**
 * Get value indicator based on edge - simplified to single word only
 * VALUE (green) = overlay, good bet
 * NO VALUE (red) = underlay, skip it
 * FAIR (gray) = fairly priced, no edge
 */
const getValueIndicator = (
  isOverlay: boolean,
  isUnderlay: boolean
): { label: string; className: string; color: string } => {
  if (isOverlay) return { label: 'VALUE', className: 'value', color: '#10b981' };
  if (isUnderlay) return { label: 'NO VALUE', className: 'no-value', color: '#ef4444' };
  return { label: 'FAIR', className: 'fair', color: '#6B7280' };
};

/**
 * Get tier color for BASE score using authoritative scoring thresholds
 */
const getTierColor = (baseScore: number): string => {
  return getScoreColor(baseScore, false);
};

// Get data quality color
const getDataQualityColor = (quality: string | undefined): string => {
  switch (quality?.toUpperCase()) {
    case 'HIGH':
      return 'var(--color-tier-good)';
    case 'MEDIUM':
      return 'var(--color-tier-fair)';
    case 'LOW':
      return 'var(--color-tier-bad)';
    default:
      return 'var(--color-text-secondary)';
  }
};

// getEdgeColor imported from utils/formatters

/**
 * Get solid teal color for progress bars
 * All bars use the same #19abb5 teal color regardless of score
 */
const getSolidTealColor = (): string => {
  return '#19abb5';
};

// Helper to determine if win rate is good (25%+)
const isGoodWinRate = (starts: number, wins: number): boolean => {
  if (!starts || starts < 2) return false;
  return wins / starts >= 0.25;
};

// Format equipment code to full text
const formatEquipment = (code: string | undefined): string => {
  if (!code) return '';
  const trimmed = code.trim();
  if (!trimmed) return '';
  return EQUIPMENT_CODES[trimmed] || trimmed;
};

// Format medication code to full text
const formatMedication = (code: string | undefined): string => {
  if (!code) return '';
  const trimmed = code.trim();
  if (!trimmed) return '';
  return MEDICATION_CODES[trimmed] || trimmed;
};

// Format sex code to full word
const formatSex = (sex: string | undefined): string => {
  if (!sex) return '';
  const sexMap: Record<string, string> = {
    c: 'Colt',
    f: 'Filly',
    g: 'Gelding',
    h: 'Horse',
    m: 'Mare',
    r: 'Ridgling',
    C: 'Colt',
    F: 'Filly',
    G: 'Gelding',
    H: 'Horse',
    M: 'Mare',
    R: 'Ridgling',
  };
  return sexMap[sex] || sex;
};

// Format color to proper case
const formatColor = (color: string | undefined): string => {
  if (!color) return '';
  const colorMap: Record<string, string> = {
    b: 'Bay',
    br: 'Brown',
    ch: 'Chestnut',
    dk: 'Dark Bay',
    gr: 'Gray',
    ro: 'Roan',
    bl: 'Black',
    B: 'Bay',
    BR: 'Brown',
    CH: 'Chestnut',
    DK: 'Dark Bay',
    GR: 'Gray',
    RO: 'Roan',
    BL: 'Black',
    Bay: 'Bay',
    Brown: 'Brown',
    Chestnut: 'Chestnut',
    Gray: 'Gray',
    Black: 'Black',
  };
  return colorMap[color.toLowerCase()] || color;
};

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <div className="section-header">
    <span className="section-header__title">{title}</span>
    <div className="section-header__line" />
  </div>
);

// ============================================================================
// HELP MODAL OVERLAY COMPONENT
// ============================================================================

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="help-modal-overlay" onClick={onClose}>
      <div
        className="help-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="help-modal__close" onClick={onClose} aria-label="Close help">
          <span className="material-icons" style={{ fontSize: '18px' }}>
            close
          </span>
        </button>
        <div className="help-modal__content">{children}</div>
      </div>
    </div>,
    document.body
  );
};

// Small "?" button component
const HelpButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    className="help-btn"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
    title={label}
  >
    ?
  </button>
);

// ============================================================================
// FURLONG SCORE HELP MODAL CONTENT
// ============================================================================

interface FurlongHelpContentProps {
  horseName: string;
  scoreTotal: number;
  scorePercentage: number;
  baseScore: number;
  edgePercent: number;
  valueLabel: string;
  dataQuality: string;
  categoryAnalysis: Array<{
    key: string;
    label: string;
    value: number;
    max: number;
    percent: number;
    explanation: string;
  }>;
  allScoredHorses: ScoredHorse[];
  score?: HorseScore;
}

const FurlongHelpContent: React.FC<FurlongHelpContentProps> = ({
  horseName,
  scoreTotal,
  scorePercentage,
  baseScore,
  edgePercent,
  valueLabel,
  dataQuality,
  categoryAnalysis,
  allScoredHorses,
  score,
}) => {
  const [activeHelpTab, setActiveHelpTab] = useState<'overview' | 'fullReport'>('overview');
  const activeFieldSize = allScoredHorses.filter((h) => !h.score.isScratched).length;
  const scratchedHorses = allScoredHorses.filter((h) => h.score.isScratched);

  // Get overall field rank
  const activeHorses = allScoredHorses.filter((h) => !h.score.isScratched);
  const overallRank =
    activeHorses
      .sort((a, b) => b.score.total - a.score.total)
      .findIndex((h) => h.horse.horseName === horseName) + 1;

  // Field-relative label for overall grade
  const overallLabel =
    overallRank > 0
      ? getFieldLabel(overallRank, activeFieldSize)
      : getPercentLabel(scorePercentage);

  // Build full report card data for all categories
  const fullReportData = ALL_CATEGORIES.map((cat) => {
    const breakdown = score?.breakdown;
    const catData = breakdown?.[cat.key as keyof typeof breakdown] as
      | { total?: number }
      | undefined;
    const value = catData?.total || 0;
    const max = cat.max;
    const percent = max > 0 ? Math.round((value / max) * 100) : 0;
    const ranking = getFieldRanking(horseName, cat.key, allScoredHorses);
    const grade =
      max > 0 ? getFieldLabel(ranking.rank, ranking.total) : { label: 'N/A', color: '#6e6e70' };
    return { ...cat, value, percent, ranking, grade };
  });

  return (
    <div className="help-furlong">
      <div className="help-furlong__title">
        <span
          className="material-icons"
          style={{ fontSize: '18px', color: 'var(--color-primary)' }}
        >
          help_outline
        </span>
        <span>Understanding the Score — {horseName}</span>
        <span className="help-furlong__grade" style={{ color: overallLabel.color }}>
          {overallLabel.label}
        </span>
      </div>

      {/* Tab buttons */}
      <div className="help-tabs">
        <button
          className={`help-tabs__btn ${activeHelpTab === 'overview' ? 'help-tabs__btn--active' : ''}`}
          onClick={() => setActiveHelpTab('overview')}
        >
          Overview
        </button>
        <button
          className={`help-tabs__btn ${activeHelpTab === 'fullReport' ? 'help-tabs__btn--active' : ''}`}
          onClick={() => setActiveHelpTab('fullReport')}
        >
          Full Report Card
        </button>
      </div>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {activeHelpTab === 'overview' && (
        <>
          <div className="help-three-col">
            <div className="help-section">
              <div className="help-section__heading">What is this number?</div>
              <p className="help-section__text">
                Think of it like a test score. {horseName} got <strong>{scoreTotal}</strong> out of{' '}
                <strong>{MAX_SCORE}</strong> possible points — that's{' '}
                <strong>{scorePercentage}%</strong>. Like a spelling test where 100% means you got
                every word right, a higher score here means the horse checks more boxes for winning.
              </p>
              <p
                className="help-section__text"
                style={{
                  fontStyle: 'italic',
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#b4b4b6',
                }}
              >
                Your horse's rank is based on how it compares to the other horses in today's race —
                not a fixed scale.
              </p>
            </div>
            <div className="help-section">
              <div className="help-section__heading">The teal bar</div>
              <p className="help-section__text">
                The teal-colored bar is like a fuel gauge. A full bar means this horse scored close
                to perfect. A bar that only fills halfway means it scored about average. All bars
                are the same teal color — what matters is <strong>how far it fills</strong>, not the
                color.
              </p>
            </div>
            <div className="help-section">
              <div className="help-section__heading">Data Quality: {dataQuality}</div>
              <p className="help-section__text">
                This tells you how much homework we could do. <strong>HIGH</strong> = we had all the
                info we needed. <strong>MEDIUM</strong> = some info was missing, so we estimated.{' '}
                <strong>LOW</strong> = not much data available — take the score with a grain of
                salt.
              </p>
            </div>
          </div>

          <div className="help-two-col">
            <div className="help-section">
              <div className="help-section__heading">
                Base: {baseScore}/{MAX_BASE_SCORE}
              </div>
              <p className="help-section__text">
                This is the "report card" score — how good is this horse on paper? It's built from
                six categories below (speed, form, connections, etc.). Think of it like grading a
                student on math, reading, science, etc. and adding them all up.
              </p>
            </div>
            <div className="help-section">
              <div className="help-section__heading">
                Edge: {edgePercent >= 0 ? '+' : ''}
                {Math.round(edgePercent)}%
              </div>
              <p className="help-section__text">
                This is the "deal" meter. Imagine a toy is worth $10, but the store is selling it
                for $5 — that's a great deal (+100% edge). A <strong>positive edge</strong> means
                the horse is better than the public thinks. A <strong>negative edge</strong> means
                the public already knows this horse is good, so you're overpaying. Current rating:{' '}
                <strong>{valueLabel}</strong>.
              </p>
            </div>
          </div>

          {/* Category cards with real bars and field comparison */}
          <div className="help-section">
            <div className="help-section__heading">The six subjects on the report card</div>
            <div className="help-categories-grid">
              {categoryAnalysis.map((cat) => {
                const ranking = getFieldRanking(horseName, cat.key, allScoredHorses);
                const catLabel = getFieldLabel(ranking.rank, ranking.total);
                return (
                  <div key={cat.key} className="help-cat-card">
                    <div className="help-cat-card__header">
                      <span className="help-cat-card__name">{cat.label}</span>
                      <span className="help-cat-card__grade" style={{ color: catLabel.color }}>
                        {catLabel.label}
                      </span>
                    </div>
                    <div className="help-cat-card__score-row">
                      <span className="help-cat-card__score">
                        {cat.value}/{cat.max}
                      </span>
                      <span className="help-cat-card__percent">({cat.percent}%)</span>
                    </div>
                    {/* Real teal progress bar matching main screen */}
                    <div className="help-cat-card__bar">
                      <div
                        className="help-cat-card__bar-fill"
                        style={{ width: `${cat.percent}%`, backgroundColor: '#19abb5' }}
                      />
                    </div>
                    {/* Field ranking */}
                    <div className="help-cat-card__ranking">
                      #{ranking.rank} of {ranking.total} horses
                    </div>
                    <p className="help-cat-card__desc">
                      {cat.key === 'connections' &&
                        'The coach and driver. A great trainer + jockey combo is like having the best teacher AND tutor.'}
                      {cat.key === 'postPosition' &&
                        'Starting position in the gate. Like getting a lane assignment in a race — some lanes have an advantage.'}
                      {cat.key === 'speedClass' &&
                        "Raw speed + level of competition. The biggest factor. Like comparing a kid's 100m time AND what league they ran it in."}
                      {cat.key === 'form' &&
                        'How the horse has been running lately. A horse winning its last 3 races is "on fire." A horse finishing last is ice cold.'}
                      {cat.key === 'equipment' &&
                        'Gear changes (like adding blinders). Sometimes a small equipment change is like getting new running shoes — it can make a big difference.'}
                      {cat.key === 'pace' &&
                        "Does this horse's running style fit today's race? A sprinter in a slow race has an advantage, like a fast kid getting a head start."}
                    </p>
                    <div className="help-cat-card__live">{cat.explanation}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Summary "Report Card" */}
          <div className="help-summary">
            <div className="help-summary__header">
              <span className="help-summary__title">Overall Grade</span>
              <span className="help-summary__grade" style={{ color: overallLabel.color }}>
                {overallLabel.label}
              </span>
            </div>
            <div className="help-summary__details">
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Total Score</span>
                <span className="help-summary__stat-value">
                  {scoreTotal}/{MAX_SCORE}
                </span>
              </div>
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Field Rank</span>
                <span className="help-summary__stat-value">
                  #{overallRank} of {activeFieldSize}
                </span>
              </div>
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Edge</span>
                <span
                  className="help-summary__stat-value"
                  style={{ color: getEdgeColor(edgePercent) }}
                >
                  {edgePercent >= 0 ? '+' : ''}
                  {Math.round(edgePercent)}%
                </span>
              </div>
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Rating</span>
                <span className="help-summary__stat-value">{valueLabel}</span>
              </div>
            </div>
            {/* Overall progress bar */}
            <div className="help-summary__bar">
              <div
                className="help-summary__bar-fill"
                style={{ width: `${scorePercentage}%`, backgroundColor: '#19abb5' }}
              />
            </div>
            <p className="help-summary__text">
              {overallRank === 1
                ? `${horseName} is our top pick in this race.`
                : overallRank === 2
                  ? `${horseName} is a strong contender — second best in the field on paper.`
                  : overallRank === 3
                    ? `${horseName} is in the mix — middle of the pack.`
                    : overallRank === 4
                      ? `${horseName} is a longshot — below average in this field.`
                      : `${horseName} is a long-odds play — among the weakest in this field on paper.`}
            </p>
          </div>
        </>
      )}

      {/* ==================== TAB 2: FULL REPORT CARD ==================== */}
      {activeHelpTab === 'fullReport' && (
        <>
          <div className="help-section" style={{ marginBottom: '8px' }}>
            <p className="help-section__text">
              This is the complete breakdown of <strong>every category</strong> we grade {horseName}{' '}
              on — including categories not shown on the main screen. The 6 "core" categories are
              the top ones; the rest are bonus factors that fine-tune the final score.
            </p>
          </div>

          <div className="help-report-grid">
            {fullReportData.map((cat) => (
              <div key={cat.key} className="help-report-row">
                <span className="help-report-row__name">{cat.label}</span>
                <span className="help-report-row__grade" style={{ color: cat.grade.color }}>
                  {cat.grade.label}
                </span>
                <span className="help-report-row__score">
                  {cat.value}/{cat.max}
                </span>
                <div className="help-report-row__bar">
                  <div
                    className="help-report-row__bar-fill"
                    style={{ width: `${cat.percent}%`, backgroundColor: '#19abb5' }}
                  />
                </div>
                <span className="help-report-row__rank">
                  #{cat.ranking.rank}/{cat.ranking.total}
                </span>
              </div>
            ))}
          </div>

          {/* Overall summary in full report too */}
          <div className="help-summary" style={{ marginTop: '12px' }}>
            <div className="help-summary__header">
              <span className="help-summary__title">Final Grade</span>
              <span className="help-summary__grade" style={{ color: overallLabel.color }}>
                {overallLabel.label}
              </span>
            </div>
            <div className="help-summary__details">
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Total</span>
                <span className="help-summary__stat-value">
                  {scoreTotal}/{MAX_SCORE}
                </span>
              </div>
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Field Rank</span>
                <span className="help-summary__stat-value">
                  #{overallRank} of {activeFieldSize}
                </span>
              </div>
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Base</span>
                <span className="help-summary__stat-value">
                  {baseScore}/{MAX_BASE_SCORE}
                </span>
              </div>
              <div className="help-summary__stat">
                <span className="help-summary__stat-label">Overlay</span>
                <span className="help-summary__stat-value">{scoreTotal - baseScore}/40</span>
              </div>
            </div>
            <div className="help-summary__bar">
              <div
                className="help-summary__bar-fill"
                style={{ width: `${scorePercentage}%`, backgroundColor: '#19abb5' }}
              />
            </div>
          </div>

          {/* Scratched horses note */}
          {scratchedHorses.length > 0 && (
            <div className="help-scratched-note">
              <span
                className="help-scratched-note__icon material-icons"
                style={{ fontSize: '14px' }}
              >
                info
              </span>
              <div>
                <strong>Scratched horses excluded:</strong>{' '}
                {scratchedHorses.map((h) => h.horse.horseName).join(', ')}. Scratched horses have
                been removed from all rankings and comparisons. Their scores are not factored into
                any calculations for the remaining horses.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// FACTOR HELP MODAL CONTENT
// ============================================================================

const FACTOR_HELP_CONTENT: Record<string, { what: string; analogy: string; scoring: string }> = {
  connections: {
    what: 'The trainer teaches the horse how to race. The jockey steers it during the race. When both are winning a lot lately, it means the "team" is hot.',
    analogy:
      'Think of it like a basketball team. A great coach (trainer) + a great point guard (jockey) = more wins. We check their recent win rates to see if this team is clicking.',
    scoring:
      'Top trainers and jockeys (15%+ win rate each) earn the most points. If the trainer-jockey pair has been winning together recently, bonus points.',
  },
  postPosition: {
    what: 'This is which starting gate the horse leaves from. Gate 1 is on the inside rail, and higher numbers are further out.',
    analogy:
      'Like lanes in a 400m track race — the inside lane runs less distance on turns, but can get boxed in. We look at which gate has won the most at THIS track and distance.',
    scoring:
      'We compare this post against real win rate data for this exact track and distance. A high % means history says this is a great gate to start from.',
  },
  speedClass: {
    what: 'How fast has this horse run (measured by "Beyer Speed Figures" — a standard score used at every US track), and how tough was the competition?',
    analogy:
      'Like comparing SAT scores AND which school you went to. Running fast at a low-level race is good, but running fast against top horses is great. This is the single biggest factor in the score.',
    scoring:
      "Best recent Beyer is the main driver. 77+ = elite. 65–76 = strong. 50–64 = average. Under 50 = below average. Adjusted up or down based on the level of today's race.",
  },
  form: {
    what: 'Is this horse on a hot streak or a cold streak? We look at the last 3 races. Finishing in the top 3 = hot. Finishing way back = cold.',
    analogy:
      'Like checking a baseball player\'s last 10 games. Are they hitting .400 or .100? Recent results tell you who is "in the zone" right now.',
    scoring:
      'Top-3 finishes earn points. Wins earn the most. More recent races count more. 70%+ form = the horse is running well right now.',
  },
  equipment: {
    what: 'Sometimes trainers add or remove gear — like blinkers (blinders that help a distracted horse focus) or special shoes. These small changes can make a big difference.',
    analogy:
      'Like a runner switching to racing spikes, or a swimmer shaving their head. A small change in equipment can unlock better performance.',
    scoring:
      'Points go up if this equipment change has worked before. No equipment change = neutral score (around 25%). First-time blinkers is the most watched change in racing.',
  },
  pace: {
    what: "Every horse has a style: some sprint to the front early, some sit in the middle, some come from behind. The question is: does today's race favor their style?",
    analogy:
      "Imagine a tug-of-war. If 5 horses want to lead, they'll tire each other out, and the horse waiting in back wins easily. If only 1 horse wants to lead, it can cruise and save energy.",
    scoring:
      "We predict the pace scenario and check if this horse's style fits. High % = the race sets up perfectly for them. Low % = they're at a style disadvantage today.",
  },
};

interface FactorHelpContentProps {
  factorKey: string;
  label: string;
  percent: number;
  explanation: string;
  icon: string;
}

const FactorHelpContent: React.FC<FactorHelpContentProps> = ({
  factorKey,
  label,
  percent,
  explanation,
  icon,
}) => {
  const content = FACTOR_HELP_CONTENT[factorKey];
  if (!content) return null;

  let verdict: string;
  let verdictClass: string;
  if (percent >= 67) {
    verdict = 'This is a genuine strength for this horse in this race.';
    verdictClass = 'help-verdict--strength';
  } else if (percent >= 34) {
    verdict = 'This is average — not helping, not hurting.';
    verdictClass = 'help-verdict--neutral';
  } else {
    verdict = 'This is a real weakness for this horse in this race.';
    verdictClass = 'help-verdict--weakness';
  }

  return (
    <div className="help-factor">
      <div className="help-factor__title">
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span>
          {label} — {percent}%
        </span>
      </div>

      <div className="help-factor__body">
        <div>
          <div className="help-section">
            <div className="help-section__heading">What is this?</div>
            <p className="help-section__text">{content.what}</p>
          </div>
          <div className="help-section">
            <div className="help-section__heading">Think of it like...</div>
            <p className="help-section__text">{content.analogy}</p>
          </div>
        </div>
        <div>
          <div className="help-section">
            <div className="help-section__heading">How we grade it</div>
            <p className="help-section__text">{content.scoring}</p>
          </div>
          <div className="help-section">
            <div className="help-section__heading">This horse's grade</div>
            <p className={`help-section__text ${verdictClass}`}>{verdict}</p>
            <p className="help-section__text help-section__text--live">{explanation}</p>
          </div>
          <div className="help-section">
            <div className="help-section__heading">Icons</div>
            <div className="help-icon-guide">
              <span>✅ Strength</span>
              <span>⚠️ Caution</span>
              <span>❌ Weakness</span>
              <span>➖ Neutral</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WORKOUT ITEM COMPONENT
// ============================================================================

interface WorkoutItemProps {
  workout: Workout;
  index: number;
}

const WorkoutItem: React.FC<WorkoutItemProps> = ({ workout, index: _index }) => {
  const w = workout as Workout & Record<string, unknown>;

  const formatWorkoutDate = (): string => {
    const dateStr = w.date || w.workDate || w.workoutDate;
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '—';
    const str = String(dateStr).trim();
    if (!str) return '—';
    try {
      if (/^\d{8}$/.test(str)) {
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const month = months[parseInt(str.slice(4, 6)) - 1] || '???';
        const day = parseInt(str.slice(6, 8), 10);
        return `${day}${month}`;
      }
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        return `${date.getDate()}${months[date.getMonth()]}`;
      }
      return str.slice(0, 5) || '—';
    } catch {
      return '—';
    }
  };

  const formatWorkoutTrack = (): string => {
    const track = w.track || w.workTrack || w.trackCode;
    if (!track || track === 'undefined' || track === 'null') return '—';
    return String(track).trim().toUpperCase().slice(0, 3);
  };

  const getWorkoutDistance = (): string => {
    const furlongs = w.distanceFurlongs;
    if (typeof furlongs !== 'number' || furlongs < 3 || furlongs > 7) {
      if (w.distance && typeof w.distance === 'string') {
        const cleaned = String(w.distance).trim();
        if (cleaned && !cleaned.includes('undefined') && cleaned.length < 6) return cleaned;
      }
      return '—';
    }
    return formatRacingDistance(furlongs);
  };

  const getWorkoutSurface = (): string => {
    const surface = w.surface;
    if (!surface) return '—';
    const str = String(surface).toLowerCase().trim();
    if (str === 'dirt' || str === 'd') return 'Dirt';
    if (str === 'turf' || str === 't') return 'Turf';
    if (str === 'synthetic' || str === 's') return 'Synth';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatWorkoutCond = (): string => {
    const cond = w.trackCondition || w.surface || w.condition;
    if (!cond) return '—';
    const str = String(cond).toLowerCase().trim();
    const abbrevs: Record<string, string> = {
      fast: 'ft',
      good: 'gd',
      sloppy: 'sy',
      muddy: 'my',
      firm: 'fm',
      yielding: 'yl',
      soft: 'sf',
      heavy: 'hy',
    };
    return abbrevs[str] || str.slice(0, 2).toLowerCase() || '—';
  };

  const getWorkoutRanking = (): string => {
    const rank = w.rankNumber || w.rank;
    const total = w.totalWorks || w.total;
    if (w.ranking && typeof w.ranking === 'string' && w.ranking.includes('/')) return w.ranking;
    if (rank && total && !isNaN(Number(rank)) && !isNaN(Number(total))) return `${rank}/${total}`;
    if (rank && !isNaN(Number(rank))) return `#${rank}`;
    return '—';
  };

  const hasValidData = workout && (w.date || w.track || w.distanceFurlongs);
  if (!hasValidData) return null;

  const isBullet = w.isBullet || w.bullet || w.rankNumber === 1 || w.rank === 1;

  return (
    <div className={`workout-row ${isBullet ? 'workout-row--bullet' : ''}`}>
      <span className="workout-row__date">{formatWorkoutDate()}</span>
      <span className="workout-row__track">{formatWorkoutTrack()}</span>
      <span className="workout-row__dist">{getWorkoutDistance()}</span>
      <span className="workout-row__surface">{getWorkoutSurface()}</span>
      <span className="workout-row__cond">{formatWorkoutCond()}</span>
      <span className="workout-row__rank">{getWorkoutRanking()}</span>
      {isBullet && <span className="workout-row__bullet">●</span>}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface HorseExpandedViewProps {
  horse: HorseEntry;
  isVisible: boolean;
  valuePercent?: number;
  score?: HorseScore;
  // New props for value-focused display
  currentOdds?: string;
  fairOdds?: string;
  edgePercent?: number;
  modelRank?: number;
  totalHorses?: number;
  isOverlay?: boolean;
  isUnderlay?: boolean;
  isPrimaryValuePlay?: boolean;
  betTypeSuggestion?: string;
  valueExplanation?: string;
  // Race-level context for PASS races
  raceVerdict?: 'BET' | 'CAUTION' | 'PASS';
  isBestInPassRace?: boolean;
  // All horses in the race for suggested bets display (legacy)
  raceHorses?: Array<{ horseName: string; modelRank?: number; programNumber?: string }>;
  // All scored horses for field comparison in help modals
  allScoredHorses?: ScoredHorse[];
  // New bet recommendations from useRaceBets hook
  betRecommendations?: {
    conservative: BetTier;
    moderate: BetTier;
    aggressive: BetTier;
    hasRecommendations: boolean;
    summary: string;
    raceContext?: RaceContextSummary;
    isPassRace?: boolean;
    fieldSize?: number;
    scratchCount?: number;
  };
}

export const HorseExpandedView: React.FC<HorseExpandedViewProps> = ({
  horse,
  isVisible,
  valuePercent: _valuePercent = 0,
  score,
  currentOdds = '—',
  fairOdds = '—',
  edgePercent = 0,
  modelRank: _modelRank = 0,
  totalHorses: _totalHorses = 0,
  isOverlay = false,
  isUnderlay = false,
  isPrimaryValuePlay: _isPrimaryValuePlay = false,
  betTypeSuggestion: _betTypeSuggestion = '—',
  valueExplanation: _valueExplanation = '',
  raceVerdict: _raceVerdict = 'BET',
  isBestInPassRace: _isBestInPassRace = false,
  raceHorses: _raceHorses = [],
  allScoredHorses = [],
  betRecommendations,
}) => {
  // State for active tab - defaults to 'analysis'
  const [activeTab, setActiveTab] = useState<'analysis' | 'pps' | 'workouts' | 'profile'>(
    'analysis'
  );

  // Help modal state
  const [furlongHelpOpen, setFurlongHelpOpen] = useState(false);
  const [factorHelpOpen, setFactorHelpOpen] = useState<string | null>(null);
  const closeFurlongHelp = useCallback(() => setFurlongHelpOpen(false), []);
  const closeFactorHelp = useCallback(() => setFactorHelpOpen(null), []);

  // Always render the outer container for smooth CSS transitions
  // The --visible class controls the expand/collapse animation
  const scoreTotal = score?.total || 0;
  const baseScore = score?.baseScore || 0;
  // overlayScore available if needed: const overlayScore = scoreTotal - baseScore;
  const scorePercentage = Math.round((scoreTotal / SCORE_LIMITS.total) * 100);
  const scoreBreakdown = score?.breakdown;

  // Format horse identity info
  const colorDisplay = formatColor(horse.color);
  const sexDisplay = formatSex(horse.sexFull || horse.sex);
  const equipmentDisplay = formatEquipment(horse.equipment?.raw);
  const medicationDisplay = formatMedication(horse.medication?.raw);

  // Determine value status
  const valueStatus = isOverlay ? 'OVERLAY' : isUnderlay ? 'UNDERLAY' : 'FAIR';

  // Get value indicator (simplified to single word: VALUE/PASS/FAIR)
  const valueIndicator = getValueIndicator(isOverlay, isUnderlay);

  // Build category analysis with proper max values from requirements
  const categoryAnalysis = CATEGORIES.map((cat) => {
    const category = scoreBreakdown?.[cat.key as keyof typeof scoreBreakdown] as
      | { total?: number }
      | undefined;
    const value = category?.total || 0;
    const percent = Math.round((value / cat.max) * 100);
    const rating = getCategoryRating(percent);
    const explanation = getCategoryExplanation(cat.key, percent, score, horse);

    return {
      ...cat,
      value,
      percent,
      rating,
      explanation,
    };
  });

  // Note: Betting suggestions now come from betRecommendations prop
  // which is calculated at the Dashboard level using the useRaceBets hook

  return (
    <div
      className={`horse-expanded ${isVisible ? 'horse-expanded--visible' : ''} horse-expanded--${valueStatus.toLowerCase()}`}
    >
      {/* ================================================================
          SECTION 1: FURLONG SCORE ANALYSIS (Always Visible)
          Left: Large score with progress bar, base/edge, rating
          Right: Horizontal category breakdown with progress bars
          ================================================================ */}
      <section className="furlong-score-analysis">
        <div className="furlong-score-analysis__header">
          FURLONG SCORE ANALYSIS
          <HelpButton
            onClick={() => setFurlongHelpOpen(true)}
            label="Learn about Furlong Score Analysis"
          />
        </div>
        <div className="furlong-score-analysis__content">
          {/* Left Side: Total Score Hero */}
          <div className="furlong-score__total">
            <div className="furlong-score__total-number">
              <span
                className="furlong-score__total-value"
                style={{ color: getTierColor(baseScore) }}
              >
                {scoreTotal}
              </span>
              <span className="furlong-score__total-max">/{SCORE_LIMITS.total}</span>
              <span className="furlong-score__total-percent">({scorePercentage}%)</span>
            </div>

            {/* Progress Bar - solid teal */}
            <div className="furlong-score__total-bar">
              <div
                className="furlong-score__total-bar-fill"
                style={{
                  width: `${scorePercentage}%`,
                  backgroundColor: getSolidTealColor(),
                }}
              />
            </div>

            {/* Base + Edge Breakdown */}
            <div className="furlong-score__breakdown">
              <span className="furlong-score__breakdown-item">
                Base: {baseScore}/{SCORE_LIMITS.base}
              </span>
              <span className="furlong-score__breakdown-separator">·</span>
              <span
                className="furlong-score__breakdown-item"
                style={{ color: getEdgeColor(edgePercent) }}
              >
                Edge: {edgePercent >= 0 ? '+' : ''}
                {Math.round(edgePercent)}%
              </span>
            </div>

            {/* Rating Section - Simplified to single word only */}
            <div className="furlong-score__rating-section">
              <div className="furlong-score__tier-rating">
                <span
                  className="furlong-score__value-indicator"
                  style={{ color: valueIndicator.color }}
                >
                  {valueIndicator.label}
                </span>
                <span className="furlong-score__tier-label">RATING</span>
              </div>

              <div className="furlong-score__data-quality">
                <span
                  className="furlong-score__quality-value"
                  style={{ color: getDataQualityColor(score?.confidenceLevel) }}
                >
                  {score?.confidenceLevel?.toUpperCase() || 'HIGH'}
                </span>
                <span className="furlong-score__quality-label">DATA QUALITY</span>
              </div>
            </div>
          </div>

          {/* Right Side: Category Breakdown - Horizontal with solid teal bars */}
          <div className="furlong-score__categories">
            {categoryAnalysis.map((cat) => (
              <div key={cat.key} className="furlong-score__category">
                <span className="furlong-score__category-label">{cat.label}</span>
                <span className="furlong-score__category-value">
                  {cat.value}/{cat.max}
                </span>
                <div className="furlong-score__category-bar">
                  <div
                    className="furlong-score__category-bar-fill"
                    style={{
                      width: `${cat.percent}%`,
                      backgroundColor: getSolidTealColor(),
                    }}
                  />
                </div>
                <span className="furlong-score__category-desc">{cat.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Furlong Score Help Modal */}
      <HelpModal isOpen={furlongHelpOpen} onClose={closeFurlongHelp}>
        <FurlongHelpContent
          horseName={horse.horseName || 'Horse'}
          scoreTotal={scoreTotal}
          scorePercentage={scorePercentage}
          baseScore={baseScore}
          edgePercent={edgePercent}
          valueLabel={valueIndicator.label}
          dataQuality={score?.confidenceLevel?.toUpperCase() || 'HIGH'}
          categoryAnalysis={categoryAnalysis}
          allScoredHorses={allScoredHorses}
          score={score}
        />
      </HelpModal>

      {/* Factor Help Modal */}
      <HelpModal isOpen={factorHelpOpen !== null} onClose={closeFactorHelp}>
        {factorHelpOpen !== null &&
          (() => {
            const cat = categoryAnalysis.find((c) => c.key === factorHelpOpen);
            if (!cat) return null;
            return (
              <FactorHelpContent
                factorKey={cat.key}
                label={cat.label}
                percent={cat.percent}
                explanation={cat.explanation}
                icon={cat.rating.icon}
              />
            );
          })()}
      </HelpModal>

      {/* ================================================================
          SECTION 2: TAB NAVIGATION
          [Analysis] [View Profile] [View Full PPs] [View Workouts]
          ================================================================ */}
      <div className="expanded-tabs">
        <button
          className={`expanded-tabs__btn ${activeTab === 'analysis' ? 'expanded-tabs__btn--active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <span className="expanded-tabs__btn-icon material-icons">analytics</span>
          <span className="expanded-tabs__btn-text">Analysis</span>
        </button>
        <button
          className={`expanded-tabs__btn ${activeTab === 'profile' ? 'expanded-tabs__btn--active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="expanded-tabs__btn-icon material-icons">info</span>
          <span className="expanded-tabs__btn-text">View Profile</span>
        </button>
        <button
          className={`expanded-tabs__btn ${activeTab === 'pps' ? 'expanded-tabs__btn--active' : ''}`}
          onClick={() => setActiveTab('pps')}
        >
          <span className="expanded-tabs__btn-icon material-icons">history</span>
          <span className="expanded-tabs__btn-text">View Full PPs</span>
        </button>
        <button
          className={`expanded-tabs__btn ${activeTab === 'workouts' ? 'expanded-tabs__btn--active' : ''}`}
          onClick={() => setActiveTab('workouts')}
        >
          <span className="expanded-tabs__btn-icon material-icons">fitness_center</span>
          <span className="expanded-tabs__btn-text">View Workouts</span>
        </button>
      </div>

      {/* ================================================================
          TAB CONTENT: ANALYSIS
          Two-column layout: Factor Breakdown (left) + Suggested Bets (right)
          ================================================================ */}
      {activeTab === 'analysis' && (
        <div className="tab-content tab-content--analysis">
          <div className="analysis-two-column">
            {/* LEFT SECTION: Factor Breakdown */}
            <section className="factor-breakdown">
              <div className="factor-breakdown__header">FACTOR BREAKDOWN</div>
              <div className="factor-breakdown__divider" />

              <div className="factor-breakdown__categories">
                {categoryAnalysis.map((cat) => (
                  <div
                    key={cat.key}
                    className={`factor-breakdown__category factor-breakdown__category--${cat.rating.colorClass}`}
                  >
                    <span className="factor-breakdown__category-icon">{cat.rating.icon}</span>
                    <span className="factor-breakdown__category-name">
                      {cat.label}: {cat.rating.label} ({cat.percent}%)
                    </span>
                    <span className="factor-breakdown__category-explanation">
                      {cat.explanation}
                    </span>
                    <HelpButton
                      onClick={() => setFactorHelpOpen(cat.key)}
                      label={`Learn about ${cat.label}`}
                    />
                  </div>
                ))}
              </div>

              {/* Value Rating Indicator - shows for all horses */}
              <div
                className={`factor-breakdown__rating factor-breakdown__rating--${valueIndicator.className}`}
              >
                <span className="factor-breakdown__rating-icon">
                  {isOverlay ? '✅' : isUnderlay ? '⚠️' : '➖'}
                </span>
                <span className="factor-breakdown__rating-text">
                  {isOverlay && (
                    <>
                      VALUE DETECTED: This horse is underbet by the public.
                      <br />
                      Our fair odds: {fairOdds}. Public odds: {currentOdds}.
                      <br />
                      You're getting paid more than the risk warrants.
                    </>
                  )}
                  {isUnderlay && (
                    <>
                      THE PROBLEM: Public knows this. Odds are too low.
                      <br />
                      Our fair odds: {fairOdds}. Public odds: {currentOdds}.
                      <br />
                      You're not getting paid enough for the risk.
                    </>
                  )}
                  {!isOverlay && !isUnderlay && (
                    <>
                      FAIR PRICE: Odds reflect the horse's true chance.
                      <br />
                      Our fair odds: {fairOdds}. Public odds: {currentOdds}.
                      <br />
                      No significant edge either way.
                    </>
                  )}
                </span>
              </div>
            </section>

            {/* RIGHT SECTION: Suggested Bets */}
            <section
              className={`suggested-bets ${betRecommendations?.isPassRace ? 'suggested-bets--pass' : ''}`}
            >
              <div className="suggested-bets__header">
                <span className="suggested-bets__header-title">SUGGESTED BETS</span>
                <span className="suggested-bets__header-subtitle">
                  {betRecommendations?.hasRecommendations
                    ? '(Calculated from scoring analysis. Adjust based on live odds.)'
                    : '(No recommendations available for this race.)'}
                </span>
              </div>
              <div className="suggested-bets__divider" />

              {/* Race Context Summary - Shows at top of Suggested Bets */}
              {betRecommendations?.raceContext && (
                <div
                  className={`suggested-bets__race-context suggested-bets__race-context--${betRecommendations.raceContext.severity}`}
                >
                  <span className="suggested-bets__race-context-icon">
                    {betRecommendations.raceContext.severity === 'pass'
                      ? '⚠️'
                      : betRecommendations.raceContext.severity === 'caution'
                        ? '⚠️'
                        : betRecommendations.raceContext.severity === 'good'
                          ? '✅'
                          : betRecommendations.raceContext.severity === 'limited'
                            ? 'ℹ️'
                            : 'ℹ️'}
                  </span>
                  <div className="suggested-bets__race-context-content">
                    <span className="suggested-bets__race-context-message">
                      {betRecommendations.raceContext.message}
                    </span>
                    {betRecommendations.raceContext.details && (
                      <span className="suggested-bets__race-context-details">
                        {betRecommendations.raceContext.details}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="suggested-bets__content">
                {/* Conservative Bets Tier */}
                <div className="suggested-bets__tier">
                  <div className="suggested-bets__tier-header">
                    <span className="suggested-bets__tier-label">
                      {betRecommendations?.conservative.label || 'Conservative Bets'}
                    </span>
                  </div>
                  <div className="suggested-bets__tier-bets">
                    {betRecommendations?.conservative.hasBets ? (
                      betRecommendations.conservative.bets.map((bet, idx) => (
                        <div key={`conservative-${idx}`} className="suggested-bets__bet">
                          <span className="suggested-bets__bet-type">{bet.type}:</span>
                          <span className="suggested-bets__bet-horses">{bet.horsesDisplay}</span>
                        </div>
                      ))
                    ) : (
                      <div className="suggested-bets__bet suggested-bets__bet--empty">
                        <span className="suggested-bets__bet-empty-icon">ℹ️</span>
                        <div className="suggested-bets__bet-empty-content">
                          <span className="suggested-bets__bet-empty-message">
                            {betRecommendations?.conservative.emptyMessage ||
                              'No win/place value identified — all horses are fairly priced or underlays.'}
                          </span>
                          {betRecommendations?.conservative.contextStats && (
                            <span className="suggested-bets__bet-empty-stats">
                              ({betRecommendations.conservative.contextStats})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Moderate Bets Tier */}
                <div className="suggested-bets__tier">
                  <div className="suggested-bets__tier-header">
                    <span className="suggested-bets__tier-label">
                      {betRecommendations?.moderate.label || 'Moderate Bets'}
                    </span>
                  </div>
                  <div className="suggested-bets__tier-bets">
                    {betRecommendations?.moderate.hasBets ? (
                      betRecommendations.moderate.bets.map((bet, idx) => (
                        <div key={`moderate-${idx}`} className="suggested-bets__bet">
                          <span className="suggested-bets__bet-type">{bet.type}:</span>
                          <span className="suggested-bets__bet-horses">{bet.horsesDisplay}</span>
                        </div>
                      ))
                    ) : (
                      <div className="suggested-bets__bet suggested-bets__bet--empty">
                        <span className="suggested-bets__bet-empty-icon">ℹ️</span>
                        <div className="suggested-bets__bet-empty-content">
                          <span className="suggested-bets__bet-empty-message">
                            {betRecommendations?.moderate.emptyMessage ||
                              'No exotic combinations recommended — not enough high-confidence value plays to justify multi-horse bet costs.'}
                          </span>
                          {betRecommendations?.moderate.contextStats && (
                            <span className="suggested-bets__bet-empty-stats">
                              ({betRecommendations.moderate.contextStats})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Aggressive Bets Tier */}
                <div className="suggested-bets__tier">
                  <div className="suggested-bets__tier-header">
                    <span className="suggested-bets__tier-label">
                      {betRecommendations?.aggressive.label || 'Aggressive Bets'}
                    </span>
                  </div>
                  <div className="suggested-bets__tier-bets">
                    {betRecommendations?.aggressive.hasBets ? (
                      betRecommendations.aggressive.bets.map((bet, idx) => (
                        <div key={`aggressive-${idx}`} className="suggested-bets__bet">
                          <span className="suggested-bets__bet-type">{bet.type}:</span>
                          <span className="suggested-bets__bet-horses">{bet.horsesDisplay}</span>
                        </div>
                      ))
                    ) : (
                      <div className="suggested-bets__bet suggested-bets__bet--empty">
                        <span className="suggested-bets__bet-empty-icon">ℹ️</span>
                        <div className="suggested-bets__bet-empty-content">
                          <span className="suggested-bets__bet-empty-message">
                            {betRecommendations?.aggressive.emptyMessage ||
                              'No high-risk plays identified — no longshots showing significant overlay.'}
                          </span>
                          {betRecommendations?.aggressive.contextStats && (
                            <span className="suggested-bets__bet-empty-stats">
                              ({betRecommendations.aggressive.contextStats})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ================================================================
          TAB CONTENT: PAST PERFORMANCES
          ================================================================ */}
      {activeTab === 'pps' && (
        <section className="horse-expanded__section horse-expanded__section--pp">
          <SectionHeader title="PAST PERFORMANCES" />
          <div className="pp-panel">
            <div className="pp-header">
              <span className="pp-header__col pp-header__col--date">DATE</span>
              <span className="pp-header__col pp-header__col--track">TRACK</span>
              <span className="pp-header__col pp-header__col--dist">DISTANCE</span>
              <span className="pp-header__col pp-header__col--cond">COND</span>
              <span className="pp-header__col pp-header__col--class">CLASS</span>
              <span className="pp-header__col pp-header__col--finish">FINISH</span>
              <span className="pp-header__col pp-header__col--odds">ODDS</span>
              <span className="pp-header__col pp-header__col--figure">FIGURE</span>
              <span className="pp-header__col pp-header__col--time">TIME</span>
              <span className="pp-header__col pp-header__col--days">DAYS</span>
              <span className="pp-header__col pp-header__col--em">EQUIP/MED</span>
              <span className="pp-header__col pp-header__col--running">RUNNING LINE</span>
              <span className="pp-header__col pp-header__col--jockey">JOCKEY</span>
              <span className="pp-header__col pp-header__col--weight">WEIGHT</span>
              <span className="pp-header__col pp-header__col--comment">COMMENT</span>
            </div>
            <div className="pp-lines">
              {horse.pastPerformances && horse.pastPerformances.length > 0 ? (
                horse.pastPerformances
                  .slice(0, 10)
                  .map((pp: PastPerformance, index: number) => (
                    <PPLine key={`${pp.date}-${pp.track}-${index}`} pp={pp} index={index} />
                  ))
              ) : (
                <div className="pp-lines__no-data">
                  No past performances available (First-time starter)
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
          TAB CONTENT: WORKOUTS
          ================================================================ */}
      {activeTab === 'workouts' && (
        <section className="horse-expanded__section horse-expanded__section--workouts">
          <SectionHeader title="RECENT WORKOUTS" />
          <div className="workouts-panel">
            {horse.workouts && horse.workouts.length > 0 ? (
              <>
                <div className="workout-header">
                  <span className="workout-header__col workout-header__col--date">DATE</span>
                  <span className="workout-header__col workout-header__col--track">TRACK</span>
                  <span className="workout-header__col workout-header__col--dist">DISTANCE</span>
                  <span className="workout-header__col workout-header__col--surface">SURFACE</span>
                  <span className="workout-header__col workout-header__col--cond">COND</span>
                  <span className="workout-header__col workout-header__col--rank">RANKING</span>
                </div>
                <div className="workout-list">
                  {horse.workouts.slice(0, 5).map((workout: Workout, index: number) => (
                    <WorkoutItem
                      key={`${workout.date}-${workout.track}-${index}`}
                      workout={workout}
                      index={index}
                    />
                  ))}
                </div>
                <div className="workouts-panel__legend">
                  <span className="workouts-panel__legend-item">
                    <span className="workouts-panel__legend-bullet">●</span> = Bullet (fastest of
                    the day at distance)
                  </span>
                </div>
              </>
            ) : (
              <div className="workouts-panel__no-data">No workouts available</div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================
          TAB CONTENT: HORSE PROFILE
          5 columns: Identity, Breeding, Connections, Overall Record, Surface & Distance
          ================================================================ */}
      {activeTab === 'profile' && (
        <section className="horse-expanded__section horse-expanded__section--profile">
          <SectionHeader title="HORSE PROFILE" />
          <div className="profile-row">
            {/* Column 1: Identity */}
            <div className="profile-col">
              <div className="profile-col__header">IDENTITY</div>
              <div className="profile-col__content">
                <div className="profile-col__primary">
                  {colorDisplay} {sexDisplay}, {horse.age || '?'}
                  {horse.breeding?.whereBred && (
                    <span className="profile-col__sub"> ({horse.breeding.whereBred})</span>
                  )}
                </div>
                <div className="profile-col__line">
                  <span className="profile-col__label">Weight:</span>
                  <span className="profile-col__value">{horse.weight || '—'} lbs</span>
                </div>
                {equipmentDisplay && (
                  <div className="profile-col__line">
                    <span className="profile-col__label">Equipment:</span>
                    <span className="profile-col__value">{equipmentDisplay}</span>
                  </div>
                )}
                {medicationDisplay && (
                  <div className="profile-col__line">
                    <span className="profile-col__label">Medication:</span>
                    <span className="profile-col__value">{medicationDisplay}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Breeding */}
            <div className="profile-col">
              <div className="profile-col__header">BREEDING</div>
              <div className="profile-col__content">
                <div className="profile-col__line">
                  <span className="profile-col__label">Sire:</span>
                  <span className="profile-col__value profile-col__value--wrap">
                    {horse.breeding?.sire || '—'}
                    {horse.breeding?.sireOfSire && (
                      <span className="profile-col__sub"> ({horse.breeding.sireOfSire})</span>
                    )}
                  </span>
                </div>
                <div className="profile-col__line">
                  <span className="profile-col__label">Dam:</span>
                  <span className="profile-col__value profile-col__value--wrap">
                    {horse.breeding?.dam || '—'}
                    {horse.breeding?.damSire && (
                      <span className="profile-col__sub"> ({horse.breeding.damSire})</span>
                    )}
                  </span>
                </div>
                <div className="profile-col__line">
                  <span className="profile-col__label">Breeder:</span>
                  <span className="profile-col__value profile-col__value--wrap">
                    {horse.breeding?.breeder || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: Connections */}
            <div className="profile-col">
              <div className="profile-col__header">CONNECTIONS</div>
              <div className="profile-col__content">
                <div className="profile-col__line">
                  <span className="profile-col__label">Owner:</span>
                  <span className="profile-col__value profile-col__value--wrap">
                    {horse.owner || '—'}
                  </span>
                </div>
                <div className="profile-col__line">
                  <span className="profile-col__label">Trainer:</span>
                  <span className="profile-col__value profile-col__value--wrap">
                    {horse.trainerName || '—'}
                  </span>
                </div>
                <div className="profile-col__line">
                  <span className="profile-col__label">Jockey:</span>
                  <span className="profile-col__value profile-col__value--wrap">
                    {horse.jockeyName || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 4: Overall Record */}
            <div className="profile-col">
              <div className="profile-col__header">OVERALL RECORD</div>
              <div className="profile-col__content">
                <div className="profile-col__record-header">
                  <span></span>
                  <span className="profile-col__record-label">W-P-S-R</span>
                </div>
                <div className="profile-col__record-row">
                  <span className="profile-col__record-year">{new Date().getFullYear() - 1}</span>
                  <span className="profile-col__record-value">
                    {horse.previousYearStarts || 0}-{horse.previousYearWins || 0}-
                    {horse.previousYearPlaces || 0}-{horse.previousYearShows || 0}
                  </span>
                </div>
                <div className="profile-col__record-row">
                  <span className="profile-col__record-year">{new Date().getFullYear()}</span>
                  <span className="profile-col__record-value">
                    {horse.currentYearStarts || 0}-{horse.currentYearWins || 0}-
                    {horse.currentYearPlaces || 0}-{horse.currentYearShows || 0}
                  </span>
                </div>
                <div className="profile-col__record-row profile-col__record-row--highlight">
                  <span className="profile-col__record-year">Lifetime</span>
                  <span className="profile-col__record-value">
                    {horse.lifetimeStarts || 0}-{horse.lifetimeWins || 0}-
                    {horse.lifetimePlaces || 0}-{horse.lifetimeShows || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 5: Surface & Distance Splits */}
            <div className="profile-col">
              <div className="profile-col__header">SURFACE & DISTANCE</div>
              <div className="profile-col__content">
                <div className="profile-col__split-row">
                  <span className="profile-col__split-label">Dirt (Fast):</span>
                  <span
                    className={`profile-col__split-value ${isGoodWinRate(horse.surfaceStarts || 0, horse.surfaceWins || 0) ? 'profile-col__split-value--hot' : ''}`}
                  >
                    {horse.surfaceStarts || 0}-{horse.surfaceWins || 0}
                  </span>
                </div>
                <div className="profile-col__split-row">
                  <span className="profile-col__split-label">Wet Track:</span>
                  <span
                    className={`profile-col__split-value ${isGoodWinRate(horse.wetStarts || 0, horse.wetWins || 0) ? 'profile-col__split-value--hot' : ''}`}
                  >
                    {horse.wetStarts || 0}-{horse.wetWins || 0}
                  </span>
                </div>
                <div className="profile-col__split-row">
                  <span className="profile-col__split-label">Turf:</span>
                  <span
                    className={`profile-col__split-value ${isGoodWinRate(horse.turfStarts || 0, horse.turfWins || 0) ? 'profile-col__split-value--hot' : ''}`}
                  >
                    {horse.turfStarts || 0}-{horse.turfWins || 0}
                  </span>
                </div>
                <div className="profile-col__split-row">
                  <span className="profile-col__split-label">Distance:</span>
                  <span
                    className={`profile-col__split-value ${isGoodWinRate(horse.distanceStarts || 0, horse.distanceWins || 0) ? 'profile-col__split-value--hot' : ''}`}
                  >
                    {horse.distanceStarts || 0}-{horse.distanceWins || 0}
                  </span>
                </div>
                <div className="profile-col__split-row">
                  <span className="profile-col__split-label">Track:</span>
                  <span
                    className={`profile-col__split-value ${isGoodWinRate(horse.trackStarts || 0, horse.trackWins || 0) ? 'profile-col__split-value--hot' : ''}`}
                  >
                    {horse.trackStarts || 0}-{horse.trackWins || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

function HorseExpandedViewFallback() {
  return (
    <div
      style={{
        padding: '1rem',
        textAlign: 'center',
        background: '#0F0F10',
        borderRadius: '8px',
        border: '1px solid #2A2A2C',
      }}
    >
      <span
        className="material-icons"
        style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '0.5rem', display: 'block' }}
      >
        error
      </span>
      <p style={{ color: '#B4B4B6', fontSize: '0.875rem', margin: 0 }}>
        Something went wrong loading horse details.
      </p>
    </div>
  );
}

export function HorseExpandedViewWithBoundary(props: HorseExpandedViewProps) {
  return (
    <ErrorBoundary componentName="HorseExpandedView" fallback={<HorseExpandedViewFallback />}>
      <HorseExpandedView {...props} />
    </ErrorBoundary>
  );
}

export default HorseExpandedViewWithBoundary;
