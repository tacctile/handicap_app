import React from 'react';
import './HorseExpandedView.css';
import { PPLine } from './PPLine';
import type { HorseEntry, PastPerformance, Workout } from '../types/drf';
import type { HorseScore } from '../lib/scoring';
import { scoreToWinProbability } from '../lib/scoring/overlayAnalysis';
import { formatRacingDistance } from '../utils/formatters';

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

// Score limits by category (from lib/scoring)
const SCORE_LIMITS = {
  connections: 55,
  postPosition: 45,
  speedClass: 50,
  form: 30,
  equipment: 25,
  pace: 40,
  base: 240, // Max base score before overlay
  total: 290, // Max final score (base + overlay: 240 + 50)
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

// Determine tier class based on value percentage
const getTierClass = (value: number): string => {
  if (value >= 100) return 'elite';
  if (value >= 50) return 'good';
  if (value >= 10) return 'fair';
  if (value >= -10) return 'neutral';
  return 'bad';
};

// Get tier color CSS variable for total score
// Thresholds: Elite (200+), Strong (180+), Good (160+), Fair (140+), Weak (<140)
const getTierColor = (score: number): string => {
  if (score >= 200) return 'var(--color-tier-elite)'; // Green - Elite
  if (score >= 180) return 'var(--color-tier-good)'; // Light Green - Strong
  if (score >= 160) return 'var(--color-tier-fair)'; // Yellow - Good
  if (score >= 140) return 'var(--color-tier-neutral)'; // Orange - Fair
  return 'var(--color-tier-bad)'; // Red - Weak
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

// Get value label based on value percentage
const getValueLabel = (valuePercent: number): string => {
  if (valuePercent >= 100) return 'Strong Value';
  if (valuePercent >= 50) return 'Value';
  if (valuePercent >= 10) return 'Fair Value';
  if (valuePercent >= -10) return 'Neutral';
  return 'Poor Value';
};

// Get value color based on value percentage
const getValueColor = (valuePercent: number): string => {
  if (valuePercent >= 100) return 'var(--color-tier-elite)'; // Green
  if (valuePercent >= 50) return 'var(--color-tier-good)'; // Light green
  if (valuePercent >= 10) return 'var(--color-tier-fair)'; // Yellow
  if (valuePercent >= -10) return 'var(--color-text-secondary)'; // Gray/neutral
  return 'var(--color-tier-bad)'; // Red
};

// Get category bar fill class based on percentage
const getCategoryFillClass = (percent: number): string => {
  if (percent >= 70) return 'high';
  if (percent >= 40) return 'medium';
  return 'low';
};

// Format earnings with K/M abbreviations
const formatEarnings = (amount: number): string => {
  if (!amount || amount === 0) return '$0';
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(0) + 'K';
  }
  return '$' + amount.toLocaleString();
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
        const month = months[date.getMonth()];
        const day = date.getDate();
        return `${day}${month}`;
      }

      return str.slice(0, 5) || '—';
    } catch {
      return '—';
    }
  };

  const formatWorkoutTrack = (): string => {
    const track = w.track || w.workTrack || w.trackCode;
    if (!track || track === 'undefined' || track === 'null') return '—';
    const str = String(track).trim();
    if (!str || str.toLowerCase() === 'nan' || str.toLowerCase() === 'undefined') return '—';
    return str.toUpperCase().slice(0, 3);
  };

  const getWorkoutDistance = (): string => {
    const furlongs = w.distanceFurlongs;
    if (typeof furlongs !== 'number' || furlongs < 3 || furlongs > 7) {
      if (w.distance && typeof w.distance === 'string') {
        const cleaned = String(w.distance).trim();
        if (cleaned && !cleaned.includes('undefined') && cleaned.length < 6) {
          return cleaned;
        }
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
    if (!str || str === 'nan' || str === 'undefined' || str === 'null') return '—';
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

    if (w.ranking && typeof w.ranking === 'string' && w.ranking.includes('/')) {
      return w.ranking;
    }

    if (rank && total && !isNaN(Number(rank)) && !isNaN(Number(total))) {
      return `${rank}/${total}`;
    }

    if (rank && !isNaN(Number(rank))) {
      return `#${rank}`;
    }

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
}

export const HorseExpandedView: React.FC<HorseExpandedViewProps> = ({
  horse,
  isVisible,
  valuePercent = 0,
  score,
}) => {
  if (!isVisible) return null;

  const tierClass = getTierClass(valuePercent);
  const scoreTotal = score?.total || 0;
  const baseScore = score?.baseScore || 0;
  const overlayScore = score?.overlayScore || 0;
  const scoreBreakdown = score?.breakdown;
  const scorePercentage = Math.round((scoreTotal / SCORE_LIMITS.total) * 100);
  const winProbability = scoreToWinProbability(scoreTotal);

  // Format horse identity info
  const colorDisplay = formatColor(horse.color);
  const sexDisplay = formatSex(horse.sexFull || horse.sex);
  const equipmentDisplay = formatEquipment(horse.equipment?.raw);
  const medicationDisplay = formatMedication(horse.medication?.raw);

  return (
    <div className={`horse-expanded horse-expanded--tier-${tierClass}`}>
      {/* ================================================================
          SECTION 1: FURLONG SCORE ANALYSIS
          ================================================================ */}
      <section className="furlong-score-analysis">
        <div className="furlong-score-analysis__header">FURLONG SCORE ANALYSIS</div>

        <div className="furlong-score-analysis__content">
          {/* Total Score - Hero (Left Side) */}
          <div className="furlong-score__total">
            <div className="furlong-score__total-header">
              <div className="furlong-score__total-number">
                <span
                  className="furlong-score__total-value"
                  style={{ color: getTierColor(scoreTotal) }}
                >
                  {scoreTotal}
                </span>
                <span className="furlong-score__total-max">/{SCORE_LIMITS.total}</span>
              </div>
              <span className="furlong-score__win-prob">
                Win Probability: ~{Math.round(winProbability)}%
              </span>
            </div>
            <div className="furlong-score__total-bar">
              <div
                className="furlong-score__total-bar-fill"
                style={{
                  width: `${scorePercentage}%`,
                  backgroundColor: getTierColor(scoreTotal),
                }}
              />
            </div>
            <div className="furlong-score__breakdown">
              <span className="furlong-score__breakdown-item">
                Base: {baseScore}/{SCORE_LIMITS.base}
              </span>
              <span className="furlong-score__breakdown-separator">•</span>
              <span className="furlong-score__breakdown-item">
                Edge: {overlayScore >= 0 ? '+' : ''}
                {overlayScore}
              </span>
              <span
                className="furlong-score__breakdown-value"
                style={{ color: getValueColor(valuePercent) }}
              >
                {getValueLabel(valuePercent)}
              </span>
            </div>
            <div className="furlong-score__rating-section">
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

          {/* Category Scores - Supporting (Right Side) */}
          <div className="furlong-score__categories">
            {[
              {
                key: 'connections',
                label: 'CONNECTIONS',
                desc: 'Trainer & Jockey Stats',
                max: SCORE_LIMITS.connections,
              },
              {
                key: 'postPosition',
                label: 'POST',
                desc: 'Starting Gate Advantage',
                max: SCORE_LIMITS.postPosition,
              },
              {
                key: 'speedClass',
                label: 'SPEED/CLASS',
                desc: 'Speed Figures & Class',
                max: SCORE_LIMITS.speedClass,
              },
              { key: 'form', label: 'FORM', desc: 'Recent Performance', max: SCORE_LIMITS.form },
              {
                key: 'equipment',
                label: 'EQUIPMENT',
                desc: 'Equipment Changes',
                max: SCORE_LIMITS.equipment,
              },
              { key: 'pace', label: 'PACE', desc: 'Running Style & Pace', max: SCORE_LIMITS.pace },
            ].map((cat) => {
              const category =
                scoreBreakdown?.[
                  cat.key as
                    | 'connections'
                    | 'postPosition'
                    | 'speedClass'
                    | 'form'
                    | 'equipment'
                    | 'pace'
                ];
              const value = category?.total || 0;
              const percent = (value / cat.max) * 100;
              const fillClass = getCategoryFillClass(percent);

              return (
                <div key={cat.key} className="furlong-score__category">
                  <span className="furlong-score__category-label">{cat.label}</span>
                  <span className="furlong-score__category-value">
                    {value}/{cat.max}
                  </span>
                  <div className="furlong-score__category-bar">
                    <div
                      className={`furlong-score__category-bar-fill furlong-score__category-bar-fill--${fillClass}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="furlong-score__category-desc">{cat.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 2: HORSE PROFILE
          ================================================================ */}
      <section className="horse-expanded__section horse-expanded__section--profile">
        <SectionHeader title="HORSE PROFILE" />

        <div className="profile-panel">
          {/* Row 1: Identity and Breeding */}
          <div className="profile-panel__row">
            {/* Identity Card */}
            <div className="profile-card">
              <div className="profile-card__header">IDENTITY</div>
              <div className="profile-card__content">
                <div className="profile-card__field">
                  <span className="profile-card__value profile-card__value--primary">
                    {colorDisplay} {sexDisplay}, {horse.age || '?'}
                    {horse.breeding?.whereBred && (
                      <span className="profile-card__bred"> ({horse.breeding.whereBred})</span>
                    )}
                  </span>
                </div>
                <div className="profile-card__field">
                  <span className="profile-card__label">Weight:</span>
                  <span className="profile-card__value">{horse.weight || '—'} lbs</span>
                </div>
                {equipmentDisplay && (
                  <div className="profile-card__field">
                    <span className="profile-card__label">Equipment:</span>
                    <span className="profile-card__value">{equipmentDisplay}</span>
                  </div>
                )}
                {medicationDisplay && (
                  <div className="profile-card__field">
                    <span className="profile-card__label">Medication:</span>
                    <span className="profile-card__value">{medicationDisplay}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Breeding Card */}
            <div className="profile-card">
              <div className="profile-card__header">BREEDING</div>
              <div className="profile-card__content">
                <div className="profile-card__field">
                  <span className="profile-card__label">Sire:</span>
                  <span className="profile-card__value">
                    {horse.breeding?.sire || '—'}
                    {horse.breeding?.sireOfSire && (
                      <span className="profile-card__sub"> ({horse.breeding.sireOfSire})</span>
                    )}
                  </span>
                </div>
                <div className="profile-card__field">
                  <span className="profile-card__label">Dam:</span>
                  <span className="profile-card__value">
                    {horse.breeding?.dam || '—'}
                    {horse.breeding?.damSire && (
                      <span className="profile-card__sub"> ({horse.breeding.damSire})</span>
                    )}
                  </span>
                </div>
                <div className="profile-card__field">
                  <span className="profile-card__label">Breeder:</span>
                  <span className="profile-card__value">{horse.breeding?.breeder || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Connections */}
          <div className="profile-panel__row">
            <div className="profile-card profile-card--full">
              <div className="profile-card__header">CONNECTIONS</div>
              <div className="profile-card__content profile-card__content--horizontal">
                <div className="profile-card__field">
                  <span className="profile-card__label">Owner:</span>
                  <span className="profile-card__value">{horse.owner || '—'}</span>
                </div>
                <div className="profile-card__field">
                  <span className="profile-card__label">Trainer:</span>
                  <span className="profile-card__value">
                    {horse.trainerName || '—'}
                    {horse.trainerStats && (
                      <span className="profile-card__stat"> ({horse.trainerStats})</span>
                    )}
                  </span>
                </div>
                <div className="profile-card__field">
                  <span className="profile-card__label">Jockey:</span>
                  <span className="profile-card__value">
                    {horse.jockeyName || '—'}
                    {horse.jockeyStats && (
                      <span className="profile-card__stat"> ({horse.jockeyStats})</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 3: CAREER STATISTICS
          ================================================================ */}
      <section className="horse-expanded__section horse-expanded__section--stats">
        <SectionHeader title="CAREER STATISTICS" />

        <div className="stats-panel">
          {/* Overall Record */}
          <div className="stats-group">
            <div className="stats-group__header">OVERALL RECORD</div>
            <div className="stats-group__content">
              <div className="stat-item">
                <span className="stat-item__label">LIFETIME</span>
                <span className="stat-item__record">
                  {horse.lifetimeStarts || 0}-{horse.lifetimeWins || 0}-{horse.lifetimePlaces || 0}-
                  {horse.lifetimeShows || 0}
                </span>
                <span className="stat-item__earnings">
                  {formatEarnings(horse.lifetimeEarnings || 0)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-item__label">{new Date().getFullYear()}</span>
                <span className="stat-item__record">
                  {horse.currentYearStarts || 0}-{horse.currentYearWins || 0}-
                  {horse.currentYearPlaces || 0}-{horse.currentYearShows || 0}
                </span>
                <span className="stat-item__earnings">
                  {formatEarnings(horse.currentYearEarnings || 0)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-item__label">{new Date().getFullYear() - 1}</span>
                <span className="stat-item__record">
                  {horse.previousYearStarts || 0}-{horse.previousYearWins || 0}-
                  {horse.previousYearPlaces || 0}-{horse.previousYearShows || 0}
                </span>
                <span className="stat-item__earnings">
                  {formatEarnings(horse.previousYearEarnings || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Surface & Distance Splits */}
          <div className="stats-group">
            <div className="stats-group__header">SURFACE & DISTANCE SPLITS</div>
            <div className="stats-group__content">
              <div className="stat-item stat-item--split">
                <span className="stat-item__label">DIRT (FAST)</span>
                <span
                  className={`stat-item__record ${isGoodWinRate(horse.surfaceStarts || 0, horse.surfaceWins || 0) ? 'stat-item__record--hot' : ''}`}
                >
                  {horse.surfaceStarts || 0}-{horse.surfaceWins || 0}
                </span>
              </div>
              <div className="stat-item stat-item--split">
                <span className="stat-item__label">WET TRACK</span>
                <span
                  className={`stat-item__record ${isGoodWinRate(horse.wetStarts || 0, horse.wetWins || 0) ? 'stat-item__record--hot' : ''}`}
                >
                  {horse.wetStarts || 0}-{horse.wetWins || 0}
                </span>
              </div>
              <div className="stat-item stat-item--split">
                <span className="stat-item__label">TURF</span>
                <span
                  className={`stat-item__record ${isGoodWinRate(horse.turfStarts || 0, horse.turfWins || 0) ? 'stat-item__record--hot' : ''}`}
                >
                  {horse.turfStarts || 0}-{horse.turfWins || 0}
                </span>
              </div>
              <div className="stat-item stat-item--split">
                <span className="stat-item__label">DISTANCE</span>
                <span
                  className={`stat-item__record ${isGoodWinRate(horse.distanceStarts || 0, horse.distanceWins || 0) ? 'stat-item__record--hot' : ''}`}
                >
                  {horse.distanceStarts || 0}-{horse.distanceWins || 0}
                </span>
              </div>
              <div className="stat-item stat-item--split">
                <span className="stat-item__label">TRACK</span>
                <span
                  className={`stat-item__record ${isGoodWinRate(horse.trackStarts || 0, horse.trackWins || 0) ? 'stat-item__record--hot' : ''}`}
                >
                  {horse.trackStarts || 0}-{horse.trackWins || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 4: PAST PERFORMANCES
          ================================================================ */}
      <section className="horse-expanded__section horse-expanded__section--pp">
        <SectionHeader title="PAST PERFORMANCES" />

        <div className="pp-panel">
          {/* PP Header Row with FULL column names */}
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

          {/* PP Lines */}
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

      {/* ================================================================
          SECTION 5: RECENT WORKOUTS
          ================================================================ */}
      <section className="horse-expanded__section horse-expanded__section--workouts">
        <SectionHeader title="RECENT WORKOUTS" />

        <div className="workouts-panel">
          {horse.workouts && horse.workouts.length > 0 ? (
            <>
              {/* Workout Header Row */}
              <div className="workout-header">
                <span className="workout-header__col workout-header__col--date">DATE</span>
                <span className="workout-header__col workout-header__col--track">TRACK</span>
                <span className="workout-header__col workout-header__col--dist">DISTANCE</span>
                <span className="workout-header__col workout-header__col--surface">SURFACE</span>
                <span className="workout-header__col workout-header__col--cond">COND</span>
                <span className="workout-header__col workout-header__col--rank">RANKING</span>
              </div>

              {/* Workout Items */}
              <div className="workout-list">
                {horse.workouts.slice(0, 5).map((workout: Workout, index: number) => (
                  <WorkoutItem
                    key={`${workout.date}-${workout.track}-${index}`}
                    workout={workout}
                    index={index}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="workouts-panel__legend">
                <span className="workouts-panel__legend-item">
                  <span className="workouts-panel__legend-bullet">●</span> = Bullet (fastest of the
                  day at distance)
                </span>
              </div>
            </>
          ) : (
            <div className="workouts-panel__no-data">No workouts available</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HorseExpandedView;
