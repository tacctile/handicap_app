/**
 * Overlay Scoring System
 *
 * The ±50 Point Micro-Edge Capture Protocol
 *
 * This module implements the Overlay System that adds race-specific adjustments
 * on top of the base 240-point score. Each section captures micro-edges that
 * accumulate into significant advantages.
 *
 * Overlay Section Distribution:
 * - Section A: Pace Dynamics & Bias (±20 points)
 * - Section B: Form Cycle & Conditioning (±15 points)
 * - Section C: Trip Analysis & Trouble (±12 points)
 * - Section D: Class Movement & Competition (±15 points)
 * - Section E: Connection Micro-Edges (±10 points)
 * - Section F: Distance & Surface Optimization (±8 points)
 * - Section G: Head-to-Head & Tactical Matchups (±8 points)
 * - Section H: Market Intelligence (confidence modifier only)
 *
 * Raw Overlay Range: -88 to +88 points (before cap)
 * Capped Overlay Range: -50 to +50 points (applied to score)
 * Overflow: Recorded as confidence modifier
 */

import type { HorseEntry, RaceHeader, PastPerformance, TrackCondition } from '../../types/drf';
import {
  parseRunningStyle,
  analyzePaceScenario,
  type RunningStyleCode,
  type PaceScenarioType,
} from './paceAnalysis';
import {
  getSpeedBias,
  isTrackIntelligenceAvailable,
  getDrainageFactor,
  getStretchLengthFactor,
} from '../trackIntelligence';

// ============================================================================
// TYPES
// ============================================================================

export interface OverlaySectionScore {
  score: number;
  maxPossible: number;
  reasoning: string;
  breakdown: Array<{ factor: string; points: number }>;
}

export interface OverlayResult {
  /** Raw overlay score before capping */
  rawScore: number;
  /** Capped overlay score (±50) */
  cappedScore: number;
  /** Overflow recorded as confidence modifier */
  overflow: number;
  /** Confidence level from overflow */
  confidenceLevel:
    | 'supreme'
    | 'maximum'
    | 'high_plus'
    | 'normal'
    | 'caution'
    | 'strong_caution'
    | 'extreme_caution';
  /** Individual section scores */
  sections: {
    paceAndBias: OverlaySectionScore;
    formCycle: OverlaySectionScore;
    tripAnalysis: OverlaySectionScore;
    classMovement: OverlaySectionScore;
    connectionEdges: OverlaySectionScore;
    distanceSurface: OverlaySectionScore;
    headToHead: OverlaySectionScore;
  };
  /** Combined reasoning */
  reasoning: string;
}

// ============================================================================
// PROVEN HORSE PROTECTION (PHASE 5)
// ============================================================================

/**
 * Count recent wins for a horse (last N races)
 */
function countRecentWinsForHorse(horse: HorseEntry, lastNRaces: number): number {
  return horse.pastPerformances.slice(0, lastNRaces).filter((pp) => pp.finishPosition === 1).length;
}

/**
 * Check if a horse is "proven" and deserves protection from pace penalties
 *
 * A horse is "proven" if:
 * - Base score >= 180 (top tier before overlay)
 * - OR has won 2+ of last 5 races
 * - OR has 3+ wins lifetime with ITM% > 40%
 *
 * Proven horses get 50% reduction on negative pace adjustments.
 * This prevents favorites with early speed from being systematically destroyed.
 *
 * @param horse - The horse entry to evaluate
 * @param baseScore - The horse's base score (before overlay)
 * @returns True if the horse is proven
 */
function isProvenHorse(horse: HorseEntry, baseScore: number): boolean {
  // High base score = proven quality
  const hasHighBaseScore = baseScore >= 180;

  // Recent winner = proven ability
  const recentWins = countRecentWinsForHorse(horse, 5);
  const hasRecentWins = recentWins >= 2;

  // Strong lifetime record = proven ability
  const lifetimeWins = horse.lifetimeWins ?? 0;
  const lifetimeStarts = horse.lifetimeStarts ?? 0;
  const itmRate =
    lifetimeStarts > 0
      ? (((horse.lifetimeWins ?? 0) + (horse.lifetimePlaces ?? 0) + (horse.lifetimeShows ?? 0)) /
          lifetimeStarts) *
        100
      : 0;
  const hasStrongRecord = lifetimeWins >= 3 && itmRate > 40;

  return hasHighBaseScore || hasRecentWins || hasStrongRecord;
}

// ============================================================================
// SECTION A: PACE DYNAMICS & BIAS (±10 POINTS)
// PHASE 5: Reduced from ±20 to prevent systematic favorite destruction
// ============================================================================

/**
 * Pace scenario adjustments based on running style
 *
 * PHASE 5 NERF: Halved all values to reduce pace overlay impact.
 * Max pace penalty for E horses: -4 pts (was -8)
 * This prevents favorites with early speed from being systematically destroyed.
 */
const PACE_SCENARIO_MATRIX: Record<PaceScenarioType, Record<RunningStyleCode, number>> = {
  // Hot Pace (PPI >= 28) - contested or speed_duel scenarios
  speed_duel: {
    E: -4, // Pure speed penalized (halved from -8)
    P: +6, // Mid-pack pressers benefit (halved from +12)
    C: +10, // Deep closers excel (halved from +20)
    S: +3, // Stalkers benefit (halved from +5)
    U: 0,
  },
  contested: {
    E: -2, // Speed still penalized (halved from -3)
    P: +5, // Pressers benefit (halved from +10)
    C: +6, // Closers benefit (halved from +12)
    S: +4, // Stalkers in good position (halved from +8)
    U: 0,
  },
  // Honest Pace (moderate)
  moderate: {
    E: +3, // Speed can win (halved from +5)
    P: +5, // Pressers ideal (halved from +10)
    C: +2, // Closers need more pace (halved from +3)
    S: +3, // Stalkers fine (halved from +5)
    U: 0,
  },
  // Soft Pace
  soft: {
    E: +8, // Lone speed huge advantage (halved from +15)
    P: +6, // Early pressers benefit (halved from +12)
    C: -3, // Closers struggle (halved from -5)
    S: +1, // Stalkers okay (halved from +2)
    U: 0,
  },
  unknown: {
    E: 0,
    P: 0,
    C: 0,
    S: 0,
    U: 0,
  },
};

/**
 * Calculate Section A: Pace Dynamics & Bias
 *
 * PHASE 5: Added baseScore parameter for proven horse protection
 * Proven horses (baseScore >= 180 or recent winners) get 50% reduction on negative adjustments
 *
 * @param horse - The horse to analyze
 * @param allHorses - All horses in the race
 * @param raceHeader - Race information
 * @param baseScore - Horse's base score (for proven horse detection). Defaults to 0 if not provided.
 */
export function calculatePaceOverlay(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  raceHeader: RaceHeader,
  baseScore: number = 0
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  // Get horse's running style and field pace scenario
  const profile = parseRunningStyle(horse);
  const paceScenario = analyzePaceScenario(allHorses.filter((h) => !h.isScratched));

  // 1. Base pace scenario adjustment with proven horse protection
  let paceAdjustment = PACE_SCENARIO_MATRIX[paceScenario.scenario][profile.style] || 0;

  // PHASE 5: Proven horse protection - reduce negative adjustments by 50%
  const proven = isProvenHorse(horse, baseScore);
  if (proven && paceAdjustment < 0) {
    paceAdjustment = Math.round(paceAdjustment * 0.5);
  }

  if (paceAdjustment !== 0) {
    totalScore += paceAdjustment;
    const provenNote = proven && paceAdjustment < 0 ? ' (proven horse)' : '';
    breakdown.push({
      factor: `${profile.styleName} in ${paceScenario.label}${provenNote}`,
      points: paceAdjustment,
    });
  }

  // 2. Lone speed detection (halved bonus from 15 to 8)
  const speedHorses = paceScenario.styleBreakdown.earlySpeed;
  if (speedHorses.length === 1 && speedHorses.includes(horse.programNumber)) {
    const loneSpeedBonus = 8; // PHASE 5: Halved from 15
    totalScore += loneSpeedBonus;
    breakdown.push({ factor: 'Lone speed advantage', points: loneSpeedBonus });
  }

  // 3. Speed duel detection - REMOVED in Phase 5
  // The additional -5 duel penalty was stacking with PACE_SCENARIO_MATRIX
  // and systematically destroying favorites. Now only PACE_SCENARIO_MATRIX applies.

  // 4. Track bias integration using paceAdvantageRating (1-10 scale)
  // Rating 1-3: Closer-friendly, 4-6: Fair, 7-10: Speed-favoring
  // PHASE 5: All values halved to reduce pace overlay impact
  if (isTrackIntelligenceAvailable(raceHeader.trackCode)) {
    const speedBias = getSpeedBias(raceHeader.trackCode, raceHeader.surface);
    if (speedBias) {
      const paceAdvantageRating = speedBias.paceAdvantageRating;
      const biasRate = speedBias.earlySpeedWinRate;

      // Use paceAdvantageRating for more granular scoring if available
      if (paceAdvantageRating !== undefined) {
        // Extreme speed bias (8-10) - bonus for speed, penalty for closers
        if (paceAdvantageRating >= 8) {
          if (profile.style === 'E') {
            const biasBonus = 4; // PHASE 5: Halved from 8
            totalScore += biasBonus;
            breakdown.push({ factor: 'Extreme speed bias track', points: biasBonus });
          } else if (profile.style === 'P') {
            const biasBonus = 3; // PHASE 5: Halved from 5
            totalScore += biasBonus;
            breakdown.push({ factor: 'Speed bias benefits pressers', points: biasBonus });
          } else if (profile.style === 'C') {
            const biasPenalty = -4; // PHASE 5: Halved from -8
            totalScore += biasPenalty;
            breakdown.push({ factor: 'Closer on extreme speed track', points: biasPenalty });
          }
        }
        // Strong speed bias (7)
        else if (paceAdvantageRating >= 7) {
          if (profile.style === 'E' || profile.style === 'P') {
            const biasBonus = 3; // PHASE 5: Halved from 5
            totalScore += biasBonus;
            breakdown.push({ factor: 'Strong speed bias track', points: biasBonus });
          } else if (profile.style === 'C') {
            const biasPenalty = -3; // PHASE 5: Halved from -5
            totalScore += biasPenalty;
            breakdown.push({ factor: 'Closer on speed track', points: biasPenalty });
          }
        }
        // Closer-friendly track (1-3)
        else if (paceAdvantageRating <= 3) {
          if (profile.style === 'C') {
            const biasBonus = 4; // PHASE 5: Halved from 7
            totalScore += biasBonus;
            breakdown.push({ factor: 'Closer-friendly track', points: biasBonus });
          } else if (profile.style === 'S') {
            const biasBonus = 2; // PHASE 5: Halved from 4
            totalScore += biasBonus;
            breakdown.push({ factor: 'Stalker on closing track', points: biasBonus });
          } else if (profile.style === 'E') {
            const biasPenalty = -4; // PHASE 5: Halved from -6
            totalScore += biasPenalty;
            breakdown.push({ factor: 'Speed on closing track', points: biasPenalty });
          }
        }
        // Fair-to-closing track (4)
        else if (paceAdvantageRating <= 4) {
          if (profile.style === 'S') {
            const biasBonus = 2; // PHASE 5: Halved from 3
            totalScore += biasBonus;
            breakdown.push({ factor: 'Fair track suits stalkers', points: biasBonus });
          }
        }
      }
      // Fallback to earlySpeedWinRate if paceAdvantageRating not available
      else {
        // Strong speed bias (55%+)
        if (biasRate >= 55 && (profile.style === 'E' || profile.style === 'P')) {
          const biasBonus = 3; // PHASE 5: Halved from 5
          totalScore += biasBonus;
          breakdown.push({ factor: 'Speed-favoring track bias', points: biasBonus });
        } else if (biasRate >= 55 && profile.style === 'C') {
          const biasPenalty = -3; // PHASE 5: Halved from -5
          totalScore += biasPenalty;
          breakdown.push({ factor: 'Closer on speed track', points: biasPenalty });
        }
        // Closing bias (45% or less)
        if (biasRate <= 45 && profile.style === 'C') {
          const biasBonus = 3; // PHASE 5: Halved from 5
          totalScore += biasBonus;
          breakdown.push({ factor: 'Closer-friendly track', points: biasBonus });
        } else if (biasRate <= 45 && profile.style === 'E') {
          const biasPenalty = -3; // PHASE 5: Halved from -5
          totalScore += biasPenalty;
          breakdown.push({ factor: 'Speed on closing track', points: biasPenalty });
        }
      }
    }
  }

  // 5. Stretch length factor for closers
  // Long stretches give closers more room to rally
  // PHASE 5: Halved all stretch length adjustments
  const stretchData = getStretchLengthFactor(raceHeader.trackCode, raceHeader.surface);
  if (stretchData.stretchLength > 0) {
    if (profile.style === 'C') {
      if (stretchData.factor >= 1.1) {
        // Long stretch benefits closers (halved)
        const stretchBonus = Math.round(2 * (stretchData.factor - 1) * 10); // 1-3 points (halved from 2-6)
        totalScore += stretchBonus;
        breakdown.push({ factor: stretchData.reasoning, points: stretchBonus });
      } else if (stretchData.factor <= 0.9) {
        // Short stretch hurts closers (halved)
        const stretchPenalty = Math.round(-2 * (1 - stretchData.factor) * 10); // -1 to -3 points (halved from -2 to -6)
        totalScore += stretchPenalty;
        breakdown.push({ factor: stretchData.reasoning, points: stretchPenalty });
      }
    } else if (profile.style === 'E' && stretchData.factor <= 0.9) {
      // Short stretch helps speed horses (halved)
      const stretchBonus = Math.round(2 * (1 - stretchData.factor) * 10); // 0-2 points (halved from 1-4)
      totalScore += stretchBonus;
      breakdown.push({ factor: 'Short stretch favors speed', points: stretchBonus });
    }
  }

  // 6. Post position advantage by pace scenario (halved)
  const post = horse.postPosition;
  if (paceScenario.scenario === 'soft' && profile.style === 'E' && post <= 3) {
    const postBonus = 3; // PHASE 5: Halved from 5
    totalScore += postBonus;
    breakdown.push({ factor: 'Inside speed in soft pace', points: postBonus });
  }
  if (paceScenario.scenario === 'speed_duel' && profile.style === 'E' && post >= 6) {
    const postPenalty = -2; // PHASE 5: Halved from -3
    totalScore += postPenalty;
    breakdown.push({ factor: 'Outside speed in hot pace', points: postPenalty });
  }

  // Cap at ±10 (PHASE 5: Reduced from ±20)
  const cappedScore = Math.max(-10, Math.min(10, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No pace adjustment';

  return {
    score: cappedScore,
    maxPossible: 10, // PHASE 5: Reduced from 20
    reasoning,
    breakdown,
  };
}

// ============================================================================
// SECTION B: FORM CYCLE & CONDITIONING (±15 POINTS)
// ============================================================================

/**
 * Analyze speed figure trajectory for form patterns
 */
function analyzeSpeedFigureTrajectory(pastPerformances: PastPerformance[]): {
  pattern: string;
  adjustment: number;
} {
  if (pastPerformances.length < 2) {
    return { pattern: 'insufficient_data', adjustment: 0 };
  }

  const figures: number[] = [];
  for (const pp of pastPerformances.slice(0, 4)) {
    const fig = pp.speedFigures.beyer ?? pp.speedFigures.timeformUS ?? pp.speedFigures.equibase;
    if (fig !== null) figures.push(fig);
  }

  if (figures.length < 2) return { pattern: 'no_figures', adjustment: 0 };

  // Calculate differences between consecutive races
  const diffs: number[] = [];
  for (let i = 0; i < figures.length - 1; i++) {
    const current = figures[i];
    const prev = figures[i + 1];
    if (current !== undefined && prev !== undefined) {
      diffs.push(current - prev);
    }
  }

  if (diffs.length === 0) return { pattern: 'insufficient_data', adjustment: 0 };

  const avgImprovement = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const lastDiff = diffs[0] ?? 0;

  // Consistent improvement (3+ points each race)
  if (diffs.every((d) => d >= 3)) {
    return { pattern: 'consistent_improvement', adjustment: 12 };
  }
  // Strong recent improvement (5+ points last race)
  if (lastDiff >= 5) {
    return { pattern: 'strong_recent_improvement', adjustment: 8 };
  }
  // Moderate improvement trend
  if (avgImprovement >= 2) {
    return { pattern: 'moderate_improvement', adjustment: 5 };
  }
  // Maintaining high level (within 2 points)
  if (Math.abs(avgImprovement) <= 2 && figures[0] !== undefined && figures[0] >= 80) {
    return { pattern: 'maintaining_high_level', adjustment: 3 };
  }
  // Slight decline
  if (avgImprovement >= -3 && avgImprovement < 0) {
    return { pattern: 'slight_decline', adjustment: -2 };
  }
  // Significant decline
  if (avgImprovement < -5) {
    return { pattern: 'significant_decline', adjustment: -8 };
  }
  // Erratic pattern (10+ point swings)
  if (diffs.some((d) => Math.abs(d) >= 10)) {
    return { pattern: 'erratic', adjustment: -5 };
  }

  return { pattern: 'neutral', adjustment: 0 };
}

/**
 * Calculate Section B: Form Cycle & Conditioning
 */
export function calculateFormOverlay(
  horse: HorseEntry,
  _raceHeader: RaceHeader
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  const pps = horse.pastPerformances;

  // 1. Speed figure trajectory
  const trajectory = analyzeSpeedFigureTrajectory(pps);
  if (trajectory.adjustment !== 0) {
    totalScore += trajectory.adjustment;
    const label = trajectory.pattern.replace(/_/g, ' ');
    breakdown.push({ factor: `Figure pattern: ${label}`, points: trajectory.adjustment });
  }

  // 2. Layoff impact analysis
  const daysSince = horse.daysSinceLastRace;
  if (daysSince !== null) {
    // Optimal layoff (21-56 days) with workouts
    if (daysSince >= 21 && daysSince <= 56) {
      const bulletWorks = horse.workouts.filter((w) => w.isBullet).length;
      if (bulletWorks >= 1) {
        const layoffBonus = 8;
        totalScore += layoffBonus;
        breakdown.push({ factor: 'Optimal layoff with bullet work', points: layoffBonus });
      } else if (horse.workouts.length >= 3) {
        const layoffBonus = 5;
        totalScore += layoffBonus;
        breakdown.push({ factor: 'Optimal layoff, moderate works', points: layoffBonus });
      }
    }
    // Short rest (7-20 days) - check last effort
    else if (daysSince >= 7 && daysSince <= 20) {
      const lastPP = pps[0];
      if (lastPP && lastPP.finishPosition <= 3) {
        const shortRestBonus = 5;
        totalScore += shortRestBonus;
        breakdown.push({ factor: 'Short rest after strong effort', points: shortRestBonus });
      } else if (lastPP && lastPP.finishPosition >= 6) {
        const shortRestPenalty = -3;
        totalScore += shortRestPenalty;
        breakdown.push({ factor: 'Short rest after poor effort', points: shortRestPenalty });
      }
    }
    // Extended layoff (57+ days)
    else if (daysSince >= 57) {
      const bulletWorks = horse.workouts.filter(
        (w) => w.isBullet && isRecentWorkout(w.date, 14)
      ).length;
      if (bulletWorks >= 1) {
        const layoffBonus = 3;
        totalScore += layoffBonus;
        breakdown.push({ factor: 'Layoff with recent bullet', points: layoffBonus });
      } else if (horse.workouts.length < 3) {
        const layoffPenalty = -8;
        totalScore += layoffPenalty;
        breakdown.push({ factor: 'Extended layoff, poor work pattern', points: layoffPenalty });
      }
    }
  }

  // 3. Workout pattern analysis
  const recentWorks = horse.workouts.slice(0, 4);
  const bulletCount = recentWorks.filter((w) => w.isBullet).length;

  if (bulletCount >= 2) {
    const workBonus = 10;
    totalScore += workBonus;
    breakdown.push({ factor: 'Multiple bullets in 30 days', points: workBonus });
  } else if (bulletCount === 1) {
    const workBonus = 8;
    totalScore += workBonus;
    breakdown.push({ factor: 'Bullet workout pattern', points: workBonus });
  }

  // Check for gate works (if noted)
  const gateWork = recentWorks.find((w) => w.fromGate);
  if (
    gateWork &&
    (horse.runningStyle === 'E' || (horse.earlySpeedRating !== null && horse.earlySpeedRating > 70))
  ) {
    const gateBonus = 3;
    totalScore += gateBonus;
    breakdown.push({ factor: 'Gate work for speed horse', points: gateBonus });
  }

  // Cap at ±15
  const cappedScore = Math.max(-15, Math.min(15, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No form adjustment';

  return {
    score: cappedScore,
    maxPossible: 15,
    reasoning,
    breakdown,
  };
}

/** Check if workout date is within N days */
function isRecentWorkout(dateStr: string, days: number): boolean {
  try {
    const workDate = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - workDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  } catch {
    return false;
  }
}

// ============================================================================
// SECTION C: TRIP ANALYSIS & TROUBLE (±10 POINTS)
// PHASE 5: Reduced from ±12
// ============================================================================

/** Trip trouble keywords and their adjustments */
const TROUBLE_KEYWORDS: Array<{ pattern: RegExp; points: number; category: string }> = [
  // Severe traffic/interference (+8 to +10)
  { pattern: /checked hard|pulled up sharply/i, points: 10, category: 'Severe check' },
  { pattern: /blocked|no room|shut off/i, points: 8, category: 'Blocked' },
  { pattern: /steadied repeatedly|bumped hard/i, points: 6, category: 'Repeatedly impeded' },
  { pattern: /clipped heels|stumbled badly/i, points: 8, category: 'Major interference' },

  // Wide trip (+4 to +6)
  { pattern: /5.?wide|6.?wide|7.?wide/i, points: 6, category: 'Very wide trip' },
  { pattern: /4.?wide|wide trip/i, points: 4, category: 'Wide trip' },
  { pattern: /carried wide|forced wide/i, points: 5, category: 'Carried wide' },

  // Pace-related excuses (+3 to +5)
  { pattern: /hustled early|pressured throughout/i, points: 5, category: 'Pace pressure' },
  { pattern: /dueled|contested pace/i, points: 4, category: 'Pace duel' },
  { pattern: /rushed up|used early/i, points: 3, category: 'Used early' },

  // Equipment/rider issues
  { pattern: /lost rider|equipment failure/i, points: 8, category: 'Equipment issue' },
  { pattern: /lugged in|lugged out|bearing in|bearing out/i, points: 3, category: 'Drifted' },
  { pattern: /reared at start|dwelt at break|poor break/i, points: 4, category: 'Poor start' },
  { pattern: /slow start|stumbled/i, points: 3, category: 'Bad break' },
];

/** Perfect trip indicators (negative adjustment = no excuse) */
const PERFECT_TRIP_KEYWORDS: Array<{ pattern: RegExp; points: number; category: string }> = [
  { pattern: /perfect trip|ideal trip|saved ground/i, points: -2, category: 'Perfect trip' },
  { pattern: /tracked winner|ideal position/i, points: -1, category: 'Ideal trip' },
];

/**
 * Calculate Section C: Trip Analysis & Trouble
 */
export function calculateTripOverlay(
  horse: HorseEntry,
  _raceHeader: RaceHeader
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  const pps = horse.pastPerformances.slice(0, 3); // Last 3 races

  for (let i = 0; i < pps.length; i++) {
    const pp = pps[i];
    if (!pp) continue;

    const tripComment = (pp.tripComment + ' ' + pp.comment).toLowerCase();
    const weight = i === 0 ? 1.0 : i === 1 ? 0.6 : 0.3; // Weight recent races higher
    let raceAdjustment = 0;
    const raceFactors: string[] = [];

    // Check for trouble
    for (const trouble of TROUBLE_KEYWORDS) {
      if (trouble.pattern.test(tripComment)) {
        const points = Math.round(trouble.points * weight);
        raceAdjustment += points;
        raceFactors.push(trouble.category);
      }
    }

    // Check for perfect trip (reduces excuse)
    for (const perfect of PERFECT_TRIP_KEYWORDS) {
      if (perfect.pattern.test(tripComment)) {
        const points = Math.round(perfect.points * weight);
        raceAdjustment += points;
        raceFactors.push(perfect.category);
      }
    }

    // Validate trouble against performance
    // If had trouble but still ran terribly, reduce credit
    if (raceAdjustment > 0 && pp.finishPosition > 8) {
      raceAdjustment = Math.round(raceAdjustment * 0.25); // 25% credit
    } else if (raceAdjustment > 0 && pp.finishPosition > 6) {
      raceAdjustment = Math.round(raceAdjustment * 0.5); // 50% credit
    }

    if (raceAdjustment !== 0 && raceFactors.length > 0) {
      totalScore += raceAdjustment;
      const raceLabel = i === 0 ? 'Last race' : i === 1 ? '2nd back' : '3rd back';
      breakdown.push({
        factor: `${raceLabel}: ${raceFactors.join(', ')}`,
        points: raceAdjustment,
      });
    }
  }

  // Check for repeated trouble patterns (extra credit)
  if (breakdown.length >= 2 && breakdown.every((b) => b.points > 0)) {
    const patternBonus = 2;
    totalScore += patternBonus;
    breakdown.push({ factor: 'Repeated trouble pattern', points: patternBonus });
  }

  // PHASE 5: Reduced cap from ±12 to ±10
  const cappedScore = Math.max(-10, Math.min(10, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No trip adjustment';

  return {
    score: cappedScore,
    maxPossible: 10, // PHASE 5: Reduced from 12
    reasoning,
    breakdown,
  };
}

// ============================================================================
// SECTION D: CLASS MOVEMENT & COMPETITION (±12 POINTS)
// PHASE 5: Reduced from ±15
// ============================================================================

const CLASS_HIERARCHY: Record<string, number> = {
  'maiden-claiming': 1,
  maiden: 2,
  claiming: 3,
  'starter-allowance': 4,
  allowance: 5,
  'allowance-optional-claiming': 6,
  handicap: 7,
  stakes: 8,
  'stakes-listed': 9,
  'stakes-graded-3': 10,
  'stakes-graded-2': 11,
  'stakes-graded-1': 12,
  unknown: 3,
};

/**
 * Calculate Section D: Class Movement & Competition
 */
export function calculateClassOverlay(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  const pps = horse.pastPerformances;
  const currentClass = raceHeader.classification;
  const currentLevel = CLASS_HIERARCHY[currentClass] ?? 3;

  // 1. Class relief scenarios
  if (pps.length > 0) {
    const lastPP = pps[0];
    if (lastPP) {
      const lastLevel = CLASS_HIERARCHY[lastPP.classification] ?? 3;
      const levelDrop = lastLevel - currentLevel;

      if (levelDrop >= 4) {
        // Dropping from stakes to allowance
        const dropBonus = 10;
        totalScore += dropBonus;
        breakdown.push({ factor: 'Major class drop (stakes to allowance)', points: dropBonus });
      } else if (levelDrop >= 2) {
        // Dropping from allowance to claiming or similar
        const dropBonus = 8;
        totalScore += dropBonus;
        breakdown.push({ factor: 'Significant class drop', points: dropBonus });
      } else if (levelDrop >= 1) {
        const dropBonus = 6;
        totalScore += dropBonus;
        breakdown.push({ factor: 'Class drop', points: dropBonus });
      } else if (levelDrop <= -2) {
        // Rising significantly
        const risePenalty = -5;
        totalScore += risePenalty;
        breakdown.push({ factor: 'Significant class rise', points: risePenalty });
      }

      // Class drop with valid excuse - extra bonus
      if (levelDrop >= 1) {
        const tripComment = (lastPP.tripComment + ' ' + lastPP.comment).toLowerCase();
        const hadTrouble = TROUBLE_KEYWORDS.some((t) => t.pattern.test(tripComment));
        if (hadTrouble) {
          const excuseBonus = 5;
          totalScore += excuseBonus;
          breakdown.push({ factor: 'Class drop with valid excuse', points: excuseBonus });
        }
      }
    }
  }

  // 2. Claiming activity - first start off claim
  const wasClaimed = pps.length > 0 && pps[0]?.wasClaimed;
  if (wasClaimed) {
    const claimBonus = 8;
    totalScore += claimBonus;
    breakdown.push({ factor: 'First start off claim', points: claimBonus });
  }

  // 3. Key Race Index (KRI) - simplified version
  // Check if other horses from last race have won since
  if (pps.length > 0 && pps[0]) {
    const lastRace = pps[0];
    // In a real implementation, we would track next-out winners
    // For now, we check if the horse was competitive against winners
    if (lastRace.finishPosition <= 3 && lastRace.winner !== horse.horseName) {
      // Horse placed behind a likely strong winner
      const kriBonus = 3;
      totalScore += kriBonus;
      breakdown.push({ factor: 'Competitive vs quality field', points: kriBonus });
    }
  }

  // 4. Field strength analysis
  const activeHorses = allHorses.filter((h) => !h.isScratched);
  const avgFieldFigure = calculateAverageFieldFigure(activeHorses);
  const horseFigure = getHorseBestFigure(horse);

  if (horseFigure !== null && avgFieldFigure !== null) {
    const figureDiff = horseFigure - avgFieldFigure;
    if (figureDiff >= 10) {
      const fieldBonus = 5;
      totalScore += fieldBonus;
      breakdown.push({ factor: 'Weak field for class', points: fieldBonus });
    } else if (figureDiff <= -10) {
      const fieldPenalty = -5;
      totalScore += fieldPenalty;
      breakdown.push({ factor: 'Strong field for class', points: fieldPenalty });
    }
  }

  // Cap at ±15
  // PHASE 5: Reduced cap from ±15 to ±12
  const cappedScore = Math.max(-12, Math.min(12, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No class adjustment';

  return {
    score: cappedScore,
    maxPossible: 12, // PHASE 5: Reduced from 15
    reasoning,
    breakdown,
  };
}

function calculateAverageFieldFigure(horses: HorseEntry[]): number | null {
  const figures: number[] = [];
  for (const horse of horses) {
    const fig = getHorseBestFigure(horse);
    if (fig !== null) figures.push(fig);
  }
  if (figures.length === 0) return null;
  return figures.reduce((a, b) => a + b, 0) / figures.length;
}

function getHorseBestFigure(horse: HorseEntry): number | null {
  if (horse.bestBeyer !== null) return horse.bestBeyer;
  const recentFigures: number[] = [];
  for (const pp of horse.pastPerformances.slice(0, 3)) {
    const fig = pp.speedFigures.beyer ?? pp.speedFigures.timeformUS;
    if (fig !== null) recentFigures.push(fig);
  }
  if (recentFigures.length === 0) return null;
  return Math.max(...recentFigures);
}

// ============================================================================
// SECTION E: CONNECTION MICRO-EDGES (±8 POINTS)
// PHASE 5: Reduced from ±10
// ============================================================================

/**
 * Calculate Section E: Connection Micro-Edges
 */
export function calculateConnectionOverlay(
  horse: HorseEntry,
  _raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  const pps = horse.pastPerformances;
  const currentJockey = horse.jockeyName.toLowerCase().trim();

  // 1. Jockey switch analysis
  if (pps.length > 0) {
    const lastJockey = pps[0]?.jockey?.toLowerCase().trim() ?? '';

    if (lastJockey && currentJockey !== lastJockey) {
      // Calculate jockey win rates from field data
      const currentJockeyWinRate = calculateJockeyWinRate(currentJockey, allHorses);
      const lastJockeyWinRate = calculateJockeyWinRate(lastJockey, allHorses);

      if (currentJockeyWinRate !== null && lastJockeyWinRate !== null) {
        const winRateDiff = currentJockeyWinRate - lastJockeyWinRate;

        if (winRateDiff >= 5) {
          const upgradeBonus = 5;
          totalScore += upgradeBonus;
          breakdown.push({
            factor: `Jockey upgrade (+${winRateDiff.toFixed(0)}% win rate)`,
            points: upgradeBonus,
          });
        } else if (winRateDiff <= -5) {
          const downgradePenalty = -5;
          totalScore += downgradePenalty;
          breakdown.push({
            factor: `Jockey downgrade (${winRateDiff.toFixed(0)}% win rate)`,
            points: downgradePenalty,
          });
        }
      }
    }
  }

  // 2. First start off claim bonus (already in Section D but add trainer angle here)
  const wasClaimed = pps.length > 0 && pps[0]?.wasClaimed;
  if (wasClaimed) {
    // Additional bonus for successful claiming trainer patterns
    // This is a simplified version
    const trainerClaimBonus = 3;
    totalScore += trainerClaimBonus;
    breakdown.push({ factor: 'New trainer angle off claim', points: trainerClaimBonus });
  }

  // 3. Trainer hot streak
  const trainerWins = countRecentTrainerWins(horse, allHorses);
  if (trainerWins >= 3) {
    const hotBonus = 4;
    totalScore += hotBonus;
    breakdown.push({ factor: 'Trainer in form (hot streak)', points: hotBonus });
  }

  // 4. Jockey/trainer combo history with this horse
  const jockeyRidesOnHorse = pps.filter((pp) => pp.jockey.toLowerCase().trim() === currentJockey);
  if (jockeyRidesOnHorse.length >= 2) {
    const wins = jockeyRidesOnHorse.filter((pp) => pp.finishPosition === 1).length;
    const winRate = (wins / jockeyRidesOnHorse.length) * 100;
    if (winRate >= 30 && jockeyRidesOnHorse.length >= 3) {
      const comboBonus = 3;
      totalScore += comboBonus;
      breakdown.push({ factor: 'Strong jockey/horse combo', points: comboBonus });
    }
  }

  // PHASE 5: Reduced cap from ±10 to ±8
  const cappedScore = Math.max(-8, Math.min(8, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No connection adjustment';

  return {
    score: cappedScore,
    maxPossible: 8, // PHASE 5: Reduced from 10
    reasoning,
    breakdown,
  };
}

function calculateJockeyWinRate(jockeyName: string, allHorses: HorseEntry[]): number | null {
  let wins = 0;
  let starts = 0;

  for (const horse of allHorses) {
    for (const pp of horse.pastPerformances) {
      if (pp.jockey.toLowerCase().trim() === jockeyName) {
        starts++;
        if (pp.finishPosition === 1) wins++;
      }
    }
  }

  if (starts < 5) return null; // Insufficient data
  return (wins / starts) * 100;
}

function countRecentTrainerWins(horse: HorseEntry, _allHorses: HorseEntry[]): number {
  // Simplified: count wins in this horse's recent PPs as proxy for trainer form
  return horse.pastPerformances.slice(0, 5).filter((pp) => pp.finishPosition === 1).length;
}

// ============================================================================
// SECTION F: DISTANCE & SURFACE OPTIMIZATION (±6 POINTS)
// PHASE 5: Reduced from ±8
// ============================================================================

/**
 * Calculate Section F: Distance & Surface Optimization
 * @param trackConditionOverride - User-selected track condition (overrides raceHeader)
 */
export function calculateDistanceSurfaceOverlay(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackConditionOverride?: TrackCondition
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  const pps = horse.pastPerformances;
  const currentDistance = raceHeader.distanceFurlongs;
  const currentSurface = raceHeader.surface;
  const isRoute = currentDistance >= 8;
  const isSprint = currentDistance < 8;

  // 1. Distance change analysis
  if (pps.length > 0) {
    const lastPP = pps[0];
    if (lastPP) {
      const lastDistance = lastPP.distanceFurlongs;
      const wasRoute = lastDistance >= 8;
      const wasSprint = lastDistance < 8;

      // Sprint to route
      if (wasSprint && isRoute) {
        // Check if horse has proven at route
        const routeWins = pps.filter(
          (pp) => pp.distanceFurlongs >= 8 && pp.finishPosition === 1
        ).length;
        if (routeWins > 0) {
          const bonus = 5;
          totalScore += bonus;
          breakdown.push({ factor: 'Sprint to route (proven router)', points: bonus });
        } else {
          // Check breeding for stamina (simplified)
          const penalty = -3;
          totalScore += penalty;
          breakdown.push({ factor: 'Sprint to route (untested)', points: penalty });
        }
      }

      // Route to sprint
      if (wasRoute && isSprint) {
        // Speed horses benefit from cutting back
        const profile = parseRunningStyle(horse);
        if (profile.style === 'E' || profile.style === 'P') {
          const bonus = 6;
          totalScore += bonus;
          breakdown.push({ factor: 'Route to sprint (speed horse)', points: bonus });
        }
      }

      // Returning to successful distance
      const distanceWins = pps.filter(
        (pp) => Math.abs(pp.distanceFurlongs - currentDistance) <= 0.5 && pp.finishPosition === 1
      ).length;
      if (distanceWins >= 2) {
        const bonus = 3;
        totalScore += bonus;
        breakdown.push({ factor: 'Returning to winning distance', points: bonus });
      }
    }
  }

  // 2. Surface change analysis
  if (pps.length > 0) {
    const lastPP = pps[0];
    if (lastPP && lastPP.surface !== currentSurface) {
      // Dirt to turf
      if (lastPP.surface === 'dirt' && currentSurface === 'turf') {
        const turfRaces = pps.filter((pp) => pp.surface === 'turf');
        const turfWins = turfRaces.filter((pp) => pp.finishPosition === 1).length;

        if (turfWins > 0) {
          const bonus = 4;
          totalScore += bonus;
          breakdown.push({ factor: 'Returning to turf (proven)', points: bonus });
        } else if (turfRaces.length === 0) {
          // First time turf - check breeding (simplified)
          const penalty = -4;
          totalScore += penalty;
          breakdown.push({ factor: 'First time turf', points: penalty });
        }
      }

      // Turf to dirt
      if (lastPP.surface === 'turf' && currentSurface === 'dirt') {
        const dirtRaces = pps.filter((pp) => pp.surface === 'dirt');
        const dirtWins = dirtRaces.filter((pp) => pp.finishPosition === 1).length;

        if (dirtWins > 0) {
          const bonus = 4;
          totalScore += bonus;
          breakdown.push({ factor: 'Returning to dirt (proven)', points: bonus });
        }
      }
    }
  }

  // 3. Wet track specialist (enhanced with drainage factor)
  // Use override if provided (user changed track condition), otherwise use race header
  const trackCondition = trackConditionOverride ?? raceHeader.trackCondition;
  const isWet = ['muddy', 'sloppy', 'heavy', 'yielding', 'soft', 'slow'].includes(trackCondition);

  if (isWet && pps.length > 0) {
    const wetRaces = pps.filter((pp) =>
      ['muddy', 'sloppy', 'heavy', 'yielding', 'soft'].includes(pp.trackCondition)
    );
    const wetWins = wetRaces.filter((pp) => pp.finishPosition === 1).length;

    // Get drainage factor - poor drainage amplifies wet track importance
    const drainageData = getDrainageFactor(raceHeader.trackCode, raceHeader.surface);
    const drainageFactor = drainageData.factor;

    if (wetWins >= 2) {
      // Apply drainage factor to bonus (poor drainage = bigger boost)
      const baseBonus = 6;
      const adjustedBonus = Math.round(baseBonus * drainageFactor);
      totalScore += adjustedBonus;
      breakdown.push({
        factor: drainageFactor > 1 ? 'Proven mudder (poor drainage boost)' : 'Proven mudder',
        points: adjustedBonus,
      });
    } else if (wetRaces.length > 0 && wetRaces.every((pp) => pp.finishPosition > 5)) {
      // Apply drainage factor to penalty too
      const basePenalty = -4;
      const adjustedPenalty = Math.round(basePenalty * drainageFactor);
      totalScore += adjustedPenalty;
      breakdown.push({
        factor: drainageFactor > 1 ? 'Struggles on wet (poor drainage)' : 'Struggles on wet track',
        points: adjustedPenalty,
      });
    } else if (wetRaces.length === 0 && drainageFactor > 1) {
      // No wet track experience on a poorly draining track = slight concern
      const penalty = -2;
      totalScore += penalty;
      breakdown.push({ factor: 'No wet track experience (poor drainage track)', points: penalty });
    }
  }

  // PHASE 5: Reduced cap from ±8 to ±6
  const cappedScore = Math.max(-6, Math.min(6, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No distance/surface adjustment';

  return {
    score: cappedScore,
    maxPossible: 6, // PHASE 5: Reduced from 8
    reasoning,
    breakdown,
  };
}

// ============================================================================
// SECTION G: HEAD-TO-HEAD & TACTICAL MATCHUPS (±6 POINTS)
// PHASE 5: Reduced from ±8
// ============================================================================

/**
 * Calculate Section G: Head-to-Head & Tactical Matchups
 */
export function calculateHeadToHeadOverlay(
  horse: HorseEntry,
  _raceHeader: RaceHeader,
  allHorses: HorseEntry[]
): OverlaySectionScore {
  const breakdown: Array<{ factor: string; points: number }> = [];
  let totalScore = 0;

  const activeHorses = allHorses.filter(
    (h) => !h.isScratched && h.programNumber !== horse.programNumber
  );
  const pps = horse.pastPerformances;

  // 1. Direct meeting analysis
  for (const rival of activeHorses) {
    const rivalName = rival.horseName.toLowerCase();

    // Check if horse has faced this rival recently
    for (const pp of pps.slice(0, 5)) {
      const hasMetRival = [pp.winner, pp.secondPlace, pp.thirdPlace].some(
        (name) =>
          name?.toLowerCase().includes(rivalName) || rivalName.includes(name?.toLowerCase() ?? '')
      );

      if (hasMetRival) {
        const rivalPP = rival.pastPerformances.find(
          (rpp) => rpp.date === pp.date && rpp.track === pp.track
        );

        if (rivalPP) {
          // Compare finishes
          if (pp.finishPosition < rivalPP.finishPosition) {
            // Beat rival
            const beatBonus = 4;
            totalScore += beatBonus;
            breakdown.push({
              factor: `Beat ${rival.horseName} in recent meeting`,
              points: beatBonus,
            });
            break; // Only count most recent meeting
          } else if (pp.finishPosition > rivalPP.finishPosition) {
            // Lost to rival
            const lossPenalty = -3;
            totalScore += lossPenalty;
            breakdown.push({
              factor: `Lost to ${rival.horseName} recently`,
              points: lossPenalty,
            });
            break;
          }
        }
      }
    }
  }

  // 2. Pace positioning advantage
  const profile = parseRunningStyle(horse);
  const paceScenario = analyzePaceScenario(allHorses.filter((h) => !h.isScratched));

  // Inside speed advantage
  if (profile.style === 'E' && horse.postPosition <= 3) {
    if (paceScenario.styleBreakdown.earlySpeed.length <= 2) {
      const positionBonus = 5;
      totalScore += positionBonus;
      breakdown.push({ factor: 'Inside speed position advantage', points: positionBonus });
    }
  }

  // Perfect stalking setup
  if (profile.style === 'P' || profile.style === 'S') {
    const speedCount = paceScenario.styleBreakdown.earlySpeed.length;
    if (speedCount >= 2 && speedCount <= 3) {
      const stalkBonus = 4;
      totalScore += stalkBonus;
      breakdown.push({ factor: 'Perfect stalking setup', points: stalkBonus });
    }
  }

  // PHASE 5: Reduced cap from ±8 to ±6
  const cappedScore = Math.max(-6, Math.min(6, totalScore));

  const reasoning =
    breakdown.length > 0
      ? breakdown.map((b) => `${b.factor}: ${b.points > 0 ? '+' : ''}${b.points}`).join('; ')
      : 'No head-to-head adjustment';

  return {
    score: cappedScore,
    maxPossible: 6, // PHASE 5: Reduced from 8
    reasoning,
    breakdown,
  };
}

// ============================================================================
// MAIN OVERLAY CALCULATION
// ============================================================================

/**
 * Get confidence level from overflow
 */
function getConfidenceLevelFromOverflow(overflow: number): OverlayResult['confidenceLevel'] {
  if (overflow >= 21) return 'supreme';
  if (overflow >= 11) return 'maximum';
  if (overflow >= 1) return 'high_plus';
  if (overflow >= -10) return 'normal';
  if (overflow >= -20) return 'caution';
  if (overflow >= -21) return 'strong_caution';
  return 'extreme_caution';
}

// PHASE 5: Hard cap constants for total overlay
const MAX_OVERLAY_BONUS = 40;
const MAX_OVERLAY_PENALTY = -40;

/**
 * Calculate complete overlay score for a horse
 *
 * PHASE 5 CHANGES:
 * - Reduced total overlay cap from ±50 to ±40
 * - Added baseScore parameter for proven horse protection in pace overlay
 *
 * @param horse - The horse to analyze
 * @param raceHeader - Race information
 * @param allHorses - All horses in the race
 * @param trackConditionOverride - User-selected track condition (overrides raceHeader)
 * @param baseScore - Horse's base score (for proven horse detection). Defaults to 0.
 * @returns Complete overlay result with section breakdowns
 */
export function calculateOverlayScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  allHorses: HorseEntry[],
  trackConditionOverride?: TrackCondition,
  baseScore: number = 0
): OverlayResult {
  // Calculate each section (pass baseScore to paceAndBias for proven horse protection)
  const paceAndBias = calculatePaceOverlay(horse, allHorses, raceHeader, baseScore);
  const formCycle = calculateFormOverlay(horse, raceHeader);
  const tripAnalysis = calculateTripOverlay(horse, raceHeader);
  const classMovement = calculateClassOverlay(horse, raceHeader, allHorses);
  const connectionEdges = calculateConnectionOverlay(horse, raceHeader, allHorses);
  const distanceSurface = calculateDistanceSurfaceOverlay(
    horse,
    raceHeader,
    trackConditionOverride
  );
  const headToHead = calculateHeadToHeadOverlay(horse, raceHeader, allHorses);

  // Sum all sections
  const rawScore =
    paceAndBias.score +
    formCycle.score +
    tripAnalysis.score +
    classMovement.score +
    connectionEdges.score +
    distanceSurface.score +
    headToHead.score;

  // PHASE 5: Apply ±40 cap (reduced from ±50)
  let cappedScore: number;
  let overflow: number;

  if (rawScore > MAX_OVERLAY_BONUS) {
    cappedScore = MAX_OVERLAY_BONUS;
    overflow = rawScore - MAX_OVERLAY_BONUS;
  } else if (rawScore < MAX_OVERLAY_PENALTY) {
    cappedScore = MAX_OVERLAY_PENALTY;
    overflow = rawScore - MAX_OVERLAY_PENALTY;
  } else {
    cappedScore = rawScore;
    overflow = 0;
  }

  const confidenceLevel = getConfidenceLevelFromOverflow(overflow);

  // Build combined reasoning
  const reasoningParts: string[] = [];
  if (paceAndBias.score !== 0)
    reasoningParts.push(`Pace: ${paceAndBias.score > 0 ? '+' : ''}${paceAndBias.score}`);
  if (formCycle.score !== 0)
    reasoningParts.push(`Form: ${formCycle.score > 0 ? '+' : ''}${formCycle.score}`);
  if (tripAnalysis.score !== 0)
    reasoningParts.push(`Trip: ${tripAnalysis.score > 0 ? '+' : ''}${tripAnalysis.score}`);
  if (classMovement.score !== 0)
    reasoningParts.push(`Class: ${classMovement.score > 0 ? '+' : ''}${classMovement.score}`);
  if (connectionEdges.score !== 0)
    reasoningParts.push(
      `Connections: ${connectionEdges.score > 0 ? '+' : ''}${connectionEdges.score}`
    );
  if (distanceSurface.score !== 0)
    reasoningParts.push(
      `Dist/Surf: ${distanceSurface.score > 0 ? '+' : ''}${distanceSurface.score}`
    );
  if (headToHead.score !== 0)
    reasoningParts.push(`H2H: ${headToHead.score > 0 ? '+' : ''}${headToHead.score}`);

  const reasoning =
    reasoningParts.length > 0 ? reasoningParts.join(' | ') : 'No overlay adjustments';

  return {
    rawScore,
    cappedScore,
    overflow,
    confidenceLevel,
    sections: {
      paceAndBias,
      formCycle,
      tripAnalysis,
      classMovement,
      connectionEdges,
      distanceSurface,
      headToHead,
    },
    reasoning,
  };
}

/**
 * Calculate overlay scores for all horses in a race
 */
export function calculateRaceOverlayScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader
): Map<number, OverlayResult> {
  const results = new Map<number, OverlayResult>();

  for (const horse of horses) {
    if (!horse.isScratched) {
      results.set(horse.programNumber, calculateOverlayScore(horse, raceHeader, horses));
    }
  }

  return results;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format overlay score for display
 */
export function formatOverlayScore(score: number): string {
  const sign = score > 0 ? '+' : '';
  return `${sign}${score}`;
}

/**
 * Get color for overlay score
 */
export function getOverlayScoreColor(score: number): string {
  if (score >= 30) return '#22c55e'; // Strong green
  if (score >= 15) return '#4ade80'; // Green
  if (score >= 5) return '#86efac'; // Light green
  if (score >= -5) return '#9ca3af'; // Gray (neutral)
  if (score >= -15) return '#fca5a5'; // Light red
  if (score >= -30) return '#f87171'; // Red
  return '#ef4444'; // Strong red
}

/**
 * Get confidence level label
 */
export function getConfidenceLevelLabel(level: OverlayResult['confidenceLevel']): string {
  switch (level) {
    case 'supreme':
      return 'Supreme Confidence';
    case 'maximum':
      return 'Maximum Confidence';
    case 'high_plus':
      return 'High+ Confidence';
    case 'normal':
      return 'Normal';
    case 'caution':
      return 'Caution';
    case 'strong_caution':
      return 'Strong Caution';
    case 'extreme_caution':
      return 'Extreme Caution';
  }
}
