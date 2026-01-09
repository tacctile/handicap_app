import React, { useState } from 'react';
import './HorseExpandedView.css';
import { PPLine } from './PPLine';
import type { HorseEntry, PastPerformance, Workout } from '../types/drf';
import type { HorseScore } from '../lib/scoring';
import { formatRacingDistance } from '../utils/formatters';
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
  connections: SCORING_LIMITS.connections, // 23
  postPosition: SCORING_LIMITS.postPosition, // 12
  speedClass: SCORING_LIMITS.speedClass, // 140
  form: SCORING_LIMITS.form, // 42
  equipment: SCORING_LIMITS.equipment, // 8
  pace: SCORING_LIMITS.pace, // 35
  base: MAX_BASE_SCORE, // 323 - Max base score before overlay
  total: MAX_SCORE, // 363 - Max final score (base + overlay)
} as const;

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
  { key: 'connections', label: 'CONNECTIONS', description: 'Trainer/Jockey', max: 23 },
  { key: 'postPosition', label: 'POST', description: 'Draw position', max: 12 },
  { key: 'speedClass', label: 'SPEED/CLASS', description: 'Figures & Class', max: 140 },
  { key: 'form', label: 'FORM', description: 'Recent races', max: 42 },
  { key: 'equipment', label: 'EQUIPMENT', description: 'Gear changes', max: 8 },
  { key: 'pace', label: 'PACE', description: 'Race shape', max: 35 },
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

// Get edge color
const getEdgeColor = (edge: number): string => {
  if (edge >= 75) return '#10b981'; // Bright green
  if (edge >= 50) return '#22c55e'; // Green
  if (edge >= 25) return '#84cc16'; // Yellow-green
  if (edge >= -25) return '#6B7280'; // Gray (fair)
  return '#ef4444'; // Red (underlay)
};

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
  betRecommendations,
}) => {
  // State for active tab - defaults to 'analysis'
  const [activeTab, setActiveTab] = useState<'analysis' | 'pps' | 'workouts' | 'profile'>(
    'analysis'
  );

  if (!isVisible) return null;

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
    <div className={`horse-expanded horse-expanded--${valueStatus.toLowerCase()}`}>
      {/* ================================================================
          SECTION 1: FURLONG SCORE ANALYSIS (Always Visible)
          Left: Large score with progress bar, base/edge, rating
          Right: Horizontal category breakdown with progress bars
          ================================================================ */}
      <section className="furlong-score-analysis">
        <div className="furlong-score-analysis__header">FURLONG SCORE ANALYSIS</div>
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

export default HorseExpandedView;
