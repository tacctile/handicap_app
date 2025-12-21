import React from 'react';
import './HorseExpandedView.css';
import { PPLine } from './PPLine';
import type { HorseEntry, PastPerformance, Workout } from '../types/drf';
import type { HorseScore } from '../lib/scoring';

interface HorseExpandedViewProps {
  horse: HorseEntry;
  isVisible: boolean;
  valuePercent?: number;
  score?: HorseScore;
}

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
}

const WorkoutItem: React.FC<WorkoutItemProps> = ({ workout }) => {
  // Format date: "Dec10" or "Jan03"
  const formatWorkoutDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
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
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}${day}`;
    } catch {
      return dateStr.slice(0, 5) || '—';
    }
  };

  // Format distance: "4f", "5f", "6f"
  const formatWorkoutDist = (furlongs: number, distStr?: string): string => {
    if (distStr) {
      return distStr.replace('furlongs', 'f').replace('furlong', 'f').replace(' ', '').slice(0, 3);
    }
    if (!furlongs) return '—';
    return `${furlongs}f`;
  };

  // Format time: ":48.20" or "1:00.40"
  const formatWorkoutTime = (seconds: number, formatted?: string): string => {
    if (formatted) return formatted;
    if (!seconds) return '—';
    if (seconds < 60) {
      return `:${seconds.toFixed(2)}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  // Format type: "H" for handily, "B" for breezing, "D" for driving, "E" for easy
  const formatWorkoutType = (type: string): string => {
    if (!type) return '';
    const abbrevs: Record<string, string> = {
      handily: 'H',
      breezing: 'B',
      breeze: 'B',
      driving: 'D',
      easy: 'E',
    };
    return abbrevs[type.toLowerCase()] || type.charAt(0).toUpperCase();
  };

  // Format surface/condition: "fst", "gd", "sly"
  const formatWorkoutCond = (condition: string, surface?: string): string => {
    const cond = condition || surface || '';
    const abbrevs: Record<string, string> = {
      fast: 'fst',
      good: 'gd',
      sloppy: 'sly',
      muddy: 'my',
      firm: 'fm',
      dirt: 'd',
      turf: 't',
    };
    return abbrevs[cond.toLowerCase()] || cond.slice(0, 3).toLowerCase();
  };

  // Format ranking: "2/35"
  const formatRanking = (rank: number | null, total: number | null, rankStr?: string): string => {
    if (rankStr) return rankStr;
    if (rank && total) return `${rank}/${total}`;
    return '';
  };

  const isBullet = workout.isBullet || workout.rankNumber === 1;

  return (
    <div className={`horse-workouts__item ${isBullet ? 'horse-workouts__item--bullet' : ''}`}>
      <span className="horse-workouts__date">{formatWorkoutDate(workout.date)}</span>
      <span className="horse-workouts__track">{workout.track || '—'}</span>
      <span className="horse-workouts__dist">
        {formatWorkoutDist(workout.distanceFurlongs, workout.distance)}
      </span>
      <span className="horse-workouts__cond">
        {formatWorkoutCond(workout.trackCondition, workout.surface)}
      </span>
      <span className="horse-workouts__time">
        {formatWorkoutTime(workout.timeSeconds, workout.timeFormatted)}
      </span>
      <span className="horse-workouts__type">{formatWorkoutType(workout.type)}</span>
      <span className="horse-workouts__rank">
        {formatRanking(workout.rankNumber, workout.totalWorks, workout.ranking)}
      </span>
      {isBullet && <span className="horse-workouts__bullet-icon">●</span>}
      {workout.fromGate && <span className="horse-workouts__gate-icon">g</span>}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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
                <WorkoutItem key={`${workout.date}-${workout.track}-${index}`} workout={workout} />
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
