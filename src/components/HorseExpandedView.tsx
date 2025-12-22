import React from 'react';
import './HorseExpandedView.css';
import { PPLine } from './PPLine';
import type { HorseEntry, PastPerformance, Workout } from '../types/drf';
import type { HorseScore } from '../lib/scoring';
import { formatRacingDistance } from '../utils/formatters';

// Determine tier class based on value percentage
const getTierClass = (value: number): string => {
  if (value >= 100) return 'elite';
  if (value >= 50) return 'good';
  if (value >= 10) return 'fair';
  if (value >= -10) return 'neutral';
  return 'bad';
};

// Format earnings with K/M abbreviations
const formatEarnings = (amount: number): string => {
  if (!amount || amount === 0) return '0';
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(0) + 'K';
  }
  return amount.toLocaleString();
};

// Helper to determine if win rate is good (25%+)
const isGoodWinRate = (starts: number, wins: number): boolean => {
  if (!starts || starts < 2) return false;
  return wins / starts >= 0.25;
};

// Score limits by category (from lib/scoring)
const SCORE_LIMITS_LOCAL = {
  connections: 55,
  postPosition: 45,
  speedClass: 50,
  form: 30,
  equipment: 25,
  pace: 40,
  total: 240,
} as const;

// Determine score tier class based on total score
const getScoreTierClass = (score: number): string => {
  if (score >= 200) return 'elite';
  if (score >= 180) return 'good';
  if (score >= 160) return 'fair';
  if (score >= 140) return 'neutral';
  return 'bad';
};

// ============================================================================
// WORKOUT ITEM COMPONENT
// ============================================================================

interface WorkoutItemProps {
  workout: Workout;
  index: number;
}

const WorkoutItem: React.FC<WorkoutItemProps> = ({ workout, index }) => {
  // Type-safe access with Record for flexible field access
  const w = workout as Workout & Record<string, unknown>;

  // Format workout date safely using industry standard format: "23Jul" (day + 3-letter month)
  const formatWorkoutDate = (): string => {
    const dateStr = w.date || w.workDate || w.workoutDate;
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return '—';

    const str = String(dateStr).trim();
    if (!str) return '—';

    try {
      // Handle YYYYMMDD
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
        const day = parseInt(str.slice(6, 8), 10); // Remove leading zero for single digits
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
        const day = date.getDate(); // No padding - single digit days show as "5Jul" not "05Jul"
        return `${day}${month}`;
      }

      return str.slice(0, 5) || '—';
    } catch {
      return '—';
    }
  };

  // Format workout track safely
  const formatWorkoutTrack = (): string => {
    const track = w.track || w.workTrack || w.trackCode;
    if (!track || track === 'undefined' || track === 'null') return '—';
    const str = String(track).trim();
    if (!str || str.toLowerCase() === 'nan' || str.toLowerCase() === 'undefined') return '—';
    return str.toUpperCase().slice(0, 3);
  };

  // Get workout distance using centralized formatter
  // distanceFurlongs is calculated by parser (yards / 220)
  const getWorkoutDistance = (): string => {
    const furlongs = w.distanceFurlongs;

    // DIAGNOSTIC TRACE - First workout only
    if (index === 0) {
      console.log('===== WORKOUT COMPONENT TRACE (First Workout) =====');
      console.log('workout object:', workout);
      console.log('workout.distanceFurlongs:', workout.distanceFurlongs);
      console.log('workout.distance:', workout.distance);
      console.log('typeof distanceFurlongs:', typeof workout.distanceFurlongs);
      console.log('w.distanceFurlongs (from Record):', w.distanceFurlongs);
      console.log('====================================================');
    }

    // Validate it's a reasonable workout distance (2f to 8f)
    // Workouts are almost never longer than 1 mile - values > 8 indicate bad field mapping
    if (typeof furlongs !== 'number' || furlongs < 2 || furlongs > 8) {
      // Try the distance string as fallback
      if (w.distance && typeof w.distance === 'string') {
        const cleaned = String(w.distance).trim();
        if (cleaned && !cleaned.includes('undefined') && cleaned.length < 6) {
          return cleaned;
        }
      }
      return '—';
    }

    // Use the standard racing distance formatter
    return formatRacingDistance(furlongs);
  };

  // Format surface/condition safely using industry standard abbreviations (Equibase/DRF)
  // ft=fast, gd=good, sy=sloppy, my=muddy, fm=firm, yl=yielding, sf=soft, hy=heavy
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
      dirt: 'd',
      turf: 't',
    };
    return abbrevs[str] || str.slice(0, 2).toLowerCase() || '—';
  };

  // Get workout ranking safely
  const getWorkoutRanking = (): string => {
    const rank = w.rankNumber || w.rank;
    const total = w.totalWorks || w.total;

    // If we have a pre-formatted ranking string
    if (w.ranking && typeof w.ranking === 'string' && w.ranking.includes('/')) {
      return w.ranking;
    }

    // Build from parts
    if (rank && total && !isNaN(Number(rank)) && !isNaN(Number(total))) {
      return `${rank}/${total}`;
    }

    if (rank && !isNaN(Number(rank))) {
      return `#${rank}`;
    }

    return '—';
  };

  // Get workout surface (D for dirt, T for turf)
  const getWorkoutSurface = (): string => {
    const surface = w.surface;
    if (!surface) return '—';
    const str = String(surface).toLowerCase().trim();
    if (str === 'dirt' || str === 'd') return 'D';
    if (str === 'turf' || str === 't') return 'T';
    if (str === 'synthetic' || str === 's') return 'S';
    return str.charAt(0).toUpperCase() || '—';
  };

  // Check if workout data is valid
  const hasValidData = workout && (w.date || w.track || w.distanceFurlongs);

  if (!hasValidData) return null;

  const isBullet = w.isBullet || w.bullet || w.rankNumber === 1 || w.rank === 1;

  return (
    <div className={`horse-workouts__item ${isBullet ? 'horse-workouts__item--bullet' : ''}`}>
      <span className="horse-workouts__date">{formatWorkoutDate()}</span>
      <span className="horse-workouts__track">{formatWorkoutTrack()}</span>
      <span
        className="horse-workouts__dist"
        title={`Raw: ${w._rawDistanceValue} (${w._interpretedFormat || 'unknown'}) → ${w.distanceFurlongs}f`}
      >
        {getWorkoutDistance()}
      </span>
      <span className="horse-workouts__surface">{getWorkoutSurface()}</span>
      <span className="horse-workouts__cond">{formatWorkoutCond()}</span>
      <span className="horse-workouts__rank">{getWorkoutRanking()}</span>
      {isBullet && <span className="horse-workouts__bullet-icon">●</span>}
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
  const scoreTierClass = getScoreTierClass(scoreTotal);
  const scoreBreakdown = score?.breakdown;

  return (
    <div className={`horse-expanded-view horse-expanded-view--tier-${tierClass}`}>
      {/* Section 1: Furlong Scoring Breakdown */}
      <section className="horse-expanded-view__section horse-expanded-view__section--scoring">
        <div className="horse-scoring">
          {/* Total Score - Prominent */}
          <div className="horse-scoring__total">
            <span className="horse-scoring__total-label">FURLONG SCORE</span>
            <span
              className={`horse-scoring__total-value horse-scoring__total-value--${scoreTierClass}`}
            >
              {scoreTotal}
              <span className="horse-scoring__total-max">/240</span>
            </span>
            <span
              className={`horse-scoring__total-percent horse-scoring__total-percent--${scoreTierClass}`}
            >
              ({Math.round((scoreTotal / 240) * 100)}%)
            </span>
          </div>

          <span className="horse-scoring__divider">│</span>

          {/* Category Breakdowns */}
          {scoreBreakdown ? (
            <div className="horse-scoring__categories">
              {/* Connections - Max 55 */}
              <div className="horse-scoring__category">
                <span className="horse-scoring__cat-label">Conn</span>
                <div className="horse-scoring__cat-bar-wrap">
                  <div
                    className="horse-scoring__cat-bar"
                    style={{
                      width: `${((scoreBreakdown.connections?.total || 0) / SCORE_LIMITS_LOCAL.connections) * 100}%`,
                    }}
                  />
                </div>
                <span className="horse-scoring__cat-value">
                  {scoreBreakdown.connections?.total || 0}/{SCORE_LIMITS_LOCAL.connections}
                </span>
              </div>

              {/* Post Position - Max 45 */}
              <div className="horse-scoring__category">
                <span className="horse-scoring__cat-label">Post</span>
                <div className="horse-scoring__cat-bar-wrap">
                  <div
                    className="horse-scoring__cat-bar"
                    style={{
                      width: `${((scoreBreakdown.postPosition?.total || 0) / SCORE_LIMITS_LOCAL.postPosition) * 100}%`,
                    }}
                  />
                </div>
                <span className="horse-scoring__cat-value">
                  {scoreBreakdown.postPosition?.total || 0}/{SCORE_LIMITS_LOCAL.postPosition}
                </span>
              </div>

              {/* Speed/Class - Max 50 */}
              <div className="horse-scoring__category">
                <span className="horse-scoring__cat-label">Speed</span>
                <div className="horse-scoring__cat-bar-wrap">
                  <div
                    className="horse-scoring__cat-bar"
                    style={{
                      width: `${((scoreBreakdown.speedClass?.total || 0) / SCORE_LIMITS_LOCAL.speedClass) * 100}%`,
                    }}
                  />
                </div>
                <span className="horse-scoring__cat-value">
                  {scoreBreakdown.speedClass?.total || 0}/{SCORE_LIMITS_LOCAL.speedClass}
                </span>
              </div>

              {/* Form - Max 30 */}
              <div className="horse-scoring__category">
                <span className="horse-scoring__cat-label">Form</span>
                <div className="horse-scoring__cat-bar-wrap">
                  <div
                    className="horse-scoring__cat-bar"
                    style={{
                      width: `${((scoreBreakdown.form?.total || 0) / SCORE_LIMITS_LOCAL.form) * 100}%`,
                    }}
                  />
                </div>
                <span className="horse-scoring__cat-value">
                  {scoreBreakdown.form?.total || 0}/{SCORE_LIMITS_LOCAL.form}
                </span>
              </div>

              {/* Equipment - Max 25 */}
              <div className="horse-scoring__category">
                <span className="horse-scoring__cat-label">Equip</span>
                <div className="horse-scoring__cat-bar-wrap">
                  <div
                    className="horse-scoring__cat-bar"
                    style={{
                      width: `${((scoreBreakdown.equipment?.total || 0) / SCORE_LIMITS_LOCAL.equipment) * 100}%`,
                    }}
                  />
                </div>
                <span className="horse-scoring__cat-value">
                  {scoreBreakdown.equipment?.total || 0}/{SCORE_LIMITS_LOCAL.equipment}
                </span>
              </div>

              {/* Pace - Max 40 */}
              <div className="horse-scoring__category">
                <span className="horse-scoring__cat-label">Pace</span>
                <div className="horse-scoring__cat-bar-wrap">
                  <div
                    className="horse-scoring__cat-bar"
                    style={{
                      width: `${((scoreBreakdown.pace?.total || 0) / SCORE_LIMITS_LOCAL.pace) * 100}%`,
                    }}
                  />
                </div>
                <span className="horse-scoring__cat-value">
                  {scoreBreakdown.pace?.total || 0}/{SCORE_LIMITS_LOCAL.pace}
                </span>
              </div>
            </div>
          ) : (
            <div className="horse-scoring__no-breakdown">
              <span className="horse-scoring__no-breakdown-text">
                Score breakdown not available
              </span>
            </div>
          )}

          {/* Confidence Indicator (if available) */}
          {score?.confidenceLevel && (
            <>
              <span className="horse-scoring__divider">│</span>
              <div className="horse-scoring__confidence">
                <span className="horse-scoring__conf-label">Conf:</span>
                <span
                  className={`horse-scoring__conf-value horse-scoring__conf-value--${score.confidenceLevel}`}
                >
                  {score.confidenceLevel}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Section 2: Horse Identity & Connections */}
      <section className="horse-expanded-view__section horse-expanded-view__section--identity">
        <div className="horse-identity">
          {/* Row 1: Horse info + Breeding */}
          <div className="horse-identity__row">
            {/* Color/Sex/Age */}
            <div className="horse-identity__field horse-identity__field--profile">
              <span className="horse-identity__value horse-identity__value--highlight">
                {horse.color || 'B'}. {horse.sexFull || horse.sex || 'c'}. {horse.age || '?'}
              </span>
              {horse.breeding?.whereBred && (
                <span className="horse-identity__bred">({horse.breeding.whereBred})</span>
              )}
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Sire */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Sire:</span>
              <span className="horse-identity__value">
                {horse.breeding?.sire || '—'}
                {horse.breeding?.sireOfSire && (
                  <span className="horse-identity__sub">({horse.breeding.sireOfSire})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Dam */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Dam:</span>
              <span className="horse-identity__value">
                {horse.breeding?.dam || '—'}
                {horse.breeding?.damSire && (
                  <span className="horse-identity__sub">({horse.breeding.damSire})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Breeder */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Breeder:</span>
              <span className="horse-identity__value">{horse.breeding?.breeder || '—'}</span>
            </div>
          </div>

          {/* Row 2: Connections */}
          <div className="horse-identity__row">
            {/* Owner */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Owner:</span>
              <span className="horse-identity__value">{horse.owner || '—'}</span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Trainer */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Trainer:</span>
              <span className="horse-identity__value">
                {horse.trainerName || '—'}
                {horse.trainerStats && (
                  <span className="horse-identity__stat">({horse.trainerStats})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Jockey */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Jockey:</span>
              <span className="horse-identity__value">
                {horse.jockeyName || '—'}
                {horse.jockeyStats && (
                  <span className="horse-identity__stat">({horse.jockeyStats})</span>
                )}
              </span>
            </div>

            <span className="horse-identity__divider">|</span>

            {/* Weight */}
            <div className="horse-identity__field">
              <span className="horse-identity__label">Wt:</span>
              <span className="horse-identity__value">{horse.weight || '—'}</span>
            </div>

            {/* Equipment if any */}
            {horse.equipment?.raw && (
              <>
                <span className="horse-identity__divider">|</span>
                <div className="horse-identity__field">
                  <span className="horse-identity__label">Equip:</span>
                  <span className="horse-identity__value horse-identity__value--equip">
                    {horse.equipment.raw}
                  </span>
                </div>
              </>
            )}

            {/* Medication if any */}
            {horse.medication?.raw && (
              <>
                <span className="horse-identity__divider">|</span>
                <div className="horse-identity__field">
                  <span className="horse-identity__label">Med:</span>
                  <span className="horse-identity__value horse-identity__value--med">
                    {horse.medication.raw}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Statistics Table */}
      <section className="horse-expanded-view__section horse-expanded-view__section--stats">
        <div className="horse-stats">
          {/* Primary Records */}
          <div className="horse-stats__group horse-stats__group--primary">
            {/* Lifetime */}
            <div className="horse-stats__item">
              <span className="horse-stats__label">LIFE:</span>
              <span className="horse-stats__record">
                {horse.lifetimeStarts || 0}-{horse.lifetimeWins || 0}-{horse.lifetimePlaces || 0}-
                {horse.lifetimeShows || 0}
              </span>
              {(horse.lifetimeEarnings || 0) > 0 && (
                <span className="horse-stats__earnings">
                  ${formatEarnings(horse.lifetimeEarnings)}
                </span>
              )}
            </div>

            <span className="horse-stats__divider">|</span>

            {/* Current Year */}
            <div className="horse-stats__item">
              <span className="horse-stats__label">{new Date().getFullYear()}:</span>
              <span className="horse-stats__record">
                {horse.currentYearStarts || 0}-{horse.currentYearWins || 0}-
                {horse.currentYearPlaces || 0}-{horse.currentYearShows || 0}
              </span>
              {(horse.currentYearEarnings || 0) > 0 && (
                <span className="horse-stats__earnings">
                  ${formatEarnings(horse.currentYearEarnings)}
                </span>
              )}
            </div>

            <span className="horse-stats__divider">|</span>

            {/* Previous Year */}
            <div className="horse-stats__item">
              <span className="horse-stats__label">{new Date().getFullYear() - 1}:</span>
              <span className="horse-stats__record">
                {horse.previousYearStarts || 0}-{horse.previousYearWins || 0}-
                {horse.previousYearPlaces || 0}-{horse.previousYearShows || 0}
              </span>
              {(horse.previousYearEarnings || 0) > 0 && (
                <span className="horse-stats__earnings">
                  ${formatEarnings(horse.previousYearEarnings)}
                </span>
              )}
            </div>
          </div>

          {/* Surface/Distance Splits */}
          <div className="horse-stats__group horse-stats__group--splits">
            <span className="horse-stats__divider horse-stats__divider--section">│</span>

            {/* Dirt Fast */}
            <div className="horse-stats__item horse-stats__item--split">
              <span className="horse-stats__label">D.Fst:</span>
              <span
                className={`horse-stats__record ${isGoodWinRate(horse.surfaceStarts || 0, horse.surfaceWins || 0) ? 'horse-stats__record--hot' : ''}`}
              >
                {horse.surfaceStarts || 0}-{horse.surfaceWins || 0}
              </span>
            </div>

            <span className="horse-stats__divider">|</span>

            {/* Wet */}
            <div className="horse-stats__item horse-stats__item--split">
              <span className="horse-stats__label">Wet:</span>
              <span
                className={`horse-stats__record ${isGoodWinRate(horse.wetStarts || 0, horse.wetWins || 0) ? 'horse-stats__record--hot' : ''}`}
              >
                {horse.wetStarts || 0}-{horse.wetWins || 0}
              </span>
            </div>

            <span className="horse-stats__divider">|</span>

            {/* Turf */}
            <div className="horse-stats__item horse-stats__item--split">
              <span className="horse-stats__label">Turf:</span>
              <span
                className={`horse-stats__record ${isGoodWinRate(horse.turfStarts || 0, horse.turfWins || 0) ? 'horse-stats__record--hot' : ''}`}
              >
                {horse.turfStarts || 0}-{horse.turfWins || 0}
              </span>
            </div>

            <span className="horse-stats__divider">|</span>

            {/* Distance */}
            <div className="horse-stats__item horse-stats__item--split">
              <span className="horse-stats__label">Dist:</span>
              <span
                className={`horse-stats__record ${isGoodWinRate(horse.distanceStarts || 0, horse.distanceWins || 0) ? 'horse-stats__record--hot' : ''}`}
              >
                {horse.distanceStarts || 0}-{horse.distanceWins || 0}
              </span>
            </div>

            <span className="horse-stats__divider">|</span>

            {/* Track */}
            <div className="horse-stats__item horse-stats__item--split">
              <span className="horse-stats__label">Trk:</span>
              <span
                className={`horse-stats__record ${isGoodWinRate(horse.trackStarts || 0, horse.trackWins || 0) ? 'horse-stats__record--hot' : ''}`}
              >
                {horse.trackStarts || 0}-{horse.trackWins || 0}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Past Performances */}
      <section className="horse-expanded-view__section horse-expanded-view__section--performances">
        <div className="horse-pp">
          {/* PP Header Row */}
          <div className="horse-pp__header">
            <span className="horse-pp__col horse-pp__col--date">DATE</span>
            <span className="horse-pp__col horse-pp__col--track">TRK</span>
            <span className="horse-pp__col horse-pp__col--dist">DIST</span>
            <span className="horse-pp__col horse-pp__col--cond">COND</span>
            <span className="horse-pp__col horse-pp__col--class">CLASS</span>
            <span className="horse-pp__col horse-pp__col--finish">FIN</span>
            <span className="horse-pp__col horse-pp__col--odds">ODDS</span>
            <span className="horse-pp__col horse-pp__col--figure">FIG</span>
            <span className="horse-pp__col horse-pp__col--running">RUNNING LINE</span>
            <span className="horse-pp__col horse-pp__col--jockey">JOCKEY</span>
            <span className="horse-pp__col horse-pp__col--weight">WT</span>
            <span className="horse-pp__col horse-pp__col--comment">COMMENT</span>
          </div>

          {/* PP Lines */}
          <div className="horse-pp__lines">
            {horse.pastPerformances && horse.pastPerformances.length > 0 ? (
              horse.pastPerformances
                .slice(0, 10)
                .map((pp: PastPerformance, index: number) => (
                  <PPLine key={`${pp.date}-${pp.track}-${index}`} pp={pp} index={index} />
                ))
            ) : (
              <div className="horse-pp__no-data">
                No past performances available (First-time starter)
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 5: Workouts */}
      <section className="horse-expanded-view__section horse-expanded-view__section--workouts">
        <div className="horse-workouts">
          <span className="horse-workouts__label">WORKOUTS</span>

          {horse.workouts && horse.workouts.length > 0 ? (
            <div className="horse-workouts__list">
              {horse.workouts.slice(0, 5).map((workout: Workout, index: number) => (
                <WorkoutItem
                  key={`${workout.date}-${workout.track}-${index}`}
                  workout={workout}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <span className="horse-workouts__none">No workouts available</span>
          )}
        </div>
      </section>
    </div>
  );
};

export default HorseExpandedView;
