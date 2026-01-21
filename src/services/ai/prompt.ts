/**
 * AI Prompt Builder
 *
 * Builds prompts for the single-bot AI race analysis system.
 * The algorithm calculates scores; AI interprets them for insights.
 *
 * Algorithm context is injected from ALGORITHM_REFERENCE.md via algorithmContext.ts
 *
 * Token Budget: ~2000 input tokens, 2048 output tokens
 */

import type { ParsedRace } from '../../types/drf';
import type {
  RaceScoringResult,
  HorseScoreForAI,
  TrackIntelligenceForAI,
  TrainerCategoryStatForAI,
} from '../../types/scoring';
import { ALGORITHM_CONTEXT, FIELD_SPREAD_CONTEXT } from './algorithmContext';

// ============================================================================
// TRACK INTELLIGENCE FORMATTING
// ============================================================================

/**
 * Format track intelligence data for AI prompt
 *
 * @param trackIntel - Track intelligence data (null if unavailable)
 * @returns Formatted string for prompt
 */
export function formatTrackIntelligence(trackIntel: TrackIntelligenceForAI | null): string {
  if (!trackIntel) {
    return `TRACK INTELLIGENCE: NOT AVAILABLE - use caution on pace/position analysis`;
  }

  const lines: string[] = [];

  // Track header
  lines.push(
    `TRACK: ${trackIntel.trackName} (${trackIntel.trackCode}) - ${trackIntel.distance}f ${trackIntel.surface} ${trackIntel.isSprintOrRoute}`
  );

  // Post position bias
  const postBias = trackIntel.postPositionBias;
  const favoredPostsStr =
    postBias.favoredPosts.length > 0 ? postBias.favoredPosts.join(', ') : 'None';
  lines.push(
    `POST BIAS: ${postBias.biasDescription} | Favored Posts: ${favoredPostsStr} | Strength: ${postBias.biasStrength}`
  );

  // Speed bias
  const speedBias = trackIntel.speedBias;
  lines.push(
    `SPEED BIAS: ${speedBias.earlySpeedWinRate}% early speed wins | Rating: ${speedBias.paceAdvantageRating}/10 | Favors: ${speedBias.favoredStyle}`
  );

  // Track characteristics
  const chars = trackIntel.trackCharacteristics;
  lines.push(`TRACK PLAYS: ${chars.playingStyle} | Stretch: ${chars.stretchLength}ft`);

  // Seasonal context (if available)
  if (trackIntel.seasonalContext) {
    const seasonal = trackIntel.seasonalContext;
    const favoredStyle = seasonal.favoredStyle || 'None';
    lines.push(
      `SEASONAL: ${seasonal.currentSeason} - ${seasonal.typicalCondition} | Style Favors: ${favoredStyle} | Notes: ${seasonal.notes}`
    );
  }

  // Data quality
  lines.push(`Data Quality: ${trackIntel.dataQuality}`);

  return lines.join('\n');
}

// ============================================================================
// HORSE FORMATTING HELPERS
// ============================================================================

/**
 * Format trainer patterns for prompt (only categories with 5+ starts)
 *
 * @param patterns - Trainer patterns object
 * @returns Formatted string for prompt
 */
function formatTrainerPatterns(patterns: HorseScoreForAI['trainerPatterns']): string {
  const categoryNames: Record<keyof HorseScoreForAI['trainerPatterns'], string> = {
    firstTimeLasix: 'First Lasix',
    firstTimeBlinkers: 'First Blinkers',
    blinkersOff: 'Blinkers Off',
    secondOffLayoff: '2nd Off Layoff',
    days31to60: 'Days 31-60',
    days61to90: 'Days 61-90',
    days91to180: 'Days 91-180',
    days181plus: 'Days 181+',
    sprintToRoute: 'Sprint→Route',
    routeToSprint: 'Route→Sprint',
    turfSprint: 'Turf Sprint',
    turfRoute: 'Turf Route',
    wetTrack: 'Wet Track',
    dirtSprint: 'Dirt Sprint',
    dirtRoute: 'Dirt Route',
    maidenClaiming: 'Maiden Claiming',
    stakes: 'Stakes',
    firstStartTrainer: 'First Start (Trainer)',
    afterClaim: 'After Claim',
  };

  const relevantPatterns: string[] = [];

  for (const [key, name] of Object.entries(categoryNames)) {
    const stat = patterns[key as keyof typeof patterns] as TrainerCategoryStatForAI;
    if (stat && stat.starts >= 5) {
      const isExceptional = stat.winPercent > 25 || stat.roi > 200;
      const prefix = isExceptional ? '★' : '';
      relevantPatterns.push(
        `${prefix}${name}: ${stat.wins}/${stat.starts} (${stat.winPercent}%) ROI: ${stat.roi}%`
      );
    }
  }

  if (relevantPatterns.length === 0) {
    return 'Trainer Patterns: No significant patterns (< 5 starts in all categories)';
  }

  return `Trainer Patterns:\n  ${relevantPatterns.join('\n  ')}`;
}

/**
 * Format a single horse's data for the AI prompt
 * Includes all expanded data: PPs, workouts, trainer patterns, equipment, stats, breeding
 *
 * @param score - Horse score data from algorithm
 * @returns Formatted string for prompt
 */
export function formatHorseForPrompt(score: HorseScoreForAI): string {
  const lines: string[] = [];

  // -------------------------------------------------------------------------
  // HEADER: Core identification and scoring
  // -------------------------------------------------------------------------
  lines.push(`#${score.programNumber} ${score.horseName} (ML ${score.morningLineOdds})`);
  lines.push(
    `Algorithm Rank: ${score.rank} | Score: ${score.finalScore}/368 | Tier: ${score.confidenceTier}`
  );
  lines.push(
    `Breakdown: Speed ${score.breakdown.speedScore}/60, Class ${score.breakdown.classScore}/48, Form ${score.breakdown.formScore}/36, Pace ${score.breakdown.paceScore}/36, Connections ${score.breakdown.connectionScore}/30`
  );

  // -------------------------------------------------------------------------
  // FORM INDICATORS
  // -------------------------------------------------------------------------
  const form = score.formIndicators;
  const daysOff = form.daysSinceLastRace !== null ? form.daysSinceLastRace : 'First start';
  const lastBeyer = form.lastBeyer !== null ? form.lastBeyer : 'N/A';
  const bestBeyer = form.bestBeyer !== null ? form.bestBeyer : 'N/A';
  const avgBeyer = form.averageBeyer !== null ? form.averageBeyer : 'N/A';
  const earlySpeedRating = form.earlySpeedRating !== null ? form.earlySpeedRating : 'N/A';
  const lifetimeWinRate = (form.lifetimeWinRate * 100).toFixed(0);

  lines.push(
    `Form: Days Off: ${daysOff} | Beyers: Last ${lastBeyer} / Best ${bestBeyer} / Avg ${avgBeyer}`
  );
  lines.push(
    `Early Speed Rating: ${earlySpeedRating} | Career: ${form.lifetimeWins}/${form.lifetimeStarts} (${lifetimeWinRate}%)`
  );

  // -------------------------------------------------------------------------
  // DISTANCE/SURFACE STATS
  // -------------------------------------------------------------------------
  const stats = score.distanceSurfaceStats;
  const distWinRate = (stats.distanceWinRate * 100).toFixed(0);
  const surfWinRate = (stats.surfaceWinRate * 100).toFixed(0);
  const turfWinRate = (stats.turfWinRate * 100).toFixed(0);
  const wetWinRate = (stats.wetWinRate * 100).toFixed(0);

  const distExp =
    stats.distanceStarts === 0
      ? '[NO EXPERIENCE]'
      : `${stats.distanceWins}/${stats.distanceStarts} (${distWinRate}%)`;
  const surfExp =
    stats.surfaceStarts === 0
      ? '[NO EXPERIENCE]'
      : `${stats.surfaceWins}/${stats.surfaceStarts} (${surfWinRate}%)`;
  const turfExp =
    stats.turfStarts === 0
      ? '[NO EXPERIENCE]'
      : `${stats.turfWins}/${stats.turfStarts} (${turfWinRate}%)`;
  const wetExp =
    stats.wetStarts === 0
      ? '[NO EXPERIENCE]'
      : `${stats.wetWins}/${stats.wetStarts} (${wetWinRate}%)`;

  lines.push(`Distance: ${distExp} | Surface: ${surfExp}`);
  lines.push(`Turf: ${turfExp} | Wet: ${wetExp}`);

  // -------------------------------------------------------------------------
  // PAST PERFORMANCES (Last 3 races)
  // -------------------------------------------------------------------------
  if (score.pastPerformances.length > 0) {
    lines.push('Past Performances:');
    score.pastPerformances.slice(0, 3).forEach((pp, idx) => {
      const beyer = pp.beyer !== null ? pp.beyer : 'N/A';
      const ep1 = pp.earlyPace1 !== null ? pp.earlyPace1 : 'N/A';
      const lp = pp.latePace !== null ? pp.latePace : 'N/A';
      const odds = pp.odds !== null ? pp.odds.toFixed(1) : 'N/A';
      const favRank = pp.favoriteRank !== null ? pp.favoriteRank : 'N/A';

      const start = pp.runningLine.start !== null ? pp.runningLine.start : '?';
      const stretch = pp.runningLine.stretch !== null ? pp.runningLine.stretch : '?';
      const finish = pp.runningLine.finish !== null ? pp.runningLine.finish : '?';

      lines.push(
        `  PP${idx + 1}: ${pp.date} ${pp.track} ${pp.distance}f ${pp.surface} - Finish: ${pp.finishPosition}/${pp.fieldSize} (${pp.lengthsBehind}L behind)`
      );
      lines.push(`       Beyer: ${beyer} | EP1: ${ep1} | LP: ${lp}`);
      if (pp.tripComment) {
        lines.push(`       Trip: ${pp.tripComment}`);
      }
      lines.push(`       Odds: ${odds} (Fav Rank: ${favRank})`);
      lines.push(`       Position Flow: ${start} -> ${stretch} -> ${finish}`);
    });
  } else {
    lines.push('Past Performances: No race history');
  }

  // -------------------------------------------------------------------------
  // WORKOUTS (Last 3 works)
  // -------------------------------------------------------------------------
  if (score.workouts.length > 0) {
    lines.push('Workouts:');
    score.workouts.slice(0, 3).forEach((work) => {
      const bulletPrefix = work.isBullet ? '[BULLET] ' : '';
      const rank =
        work.rankNumber !== null && work.totalWorks !== null
          ? ` Rank: ${work.rankNumber}/${work.totalWorks}`
          : '';
      lines.push(
        `  ${bulletPrefix}${work.date} ${work.track} ${work.distanceFurlongs}f in ${work.timeSeconds.toFixed(2)}s (${work.type})${rank}`
      );
    });
  }

  // -------------------------------------------------------------------------
  // EQUIPMENT
  // -------------------------------------------------------------------------
  const equip = score.equipment;
  const activeEquip: string[] = [];
  if (equip.blinkers) activeEquip.push('Blinkers');
  if (equip.frontBandages) activeEquip.push('Front Bandages');
  if (equip.tongueTie) activeEquip.push('Tongue Tie');
  if (equip.nasalStrip) activeEquip.push('Nasal Strip');
  if (equip.shadowRoll) activeEquip.push('Shadow Roll');
  if (equip.barShoes) activeEquip.push('Bar Shoes');
  if (equip.mudCaulks) activeEquip.push('Mud Caulks');

  if (
    activeEquip.length > 0 ||
    equip.firstTimeEquipment.length > 0 ||
    equip.equipmentChanges.length > 0
  ) {
    const equipStr = activeEquip.length > 0 ? activeEquip.join(', ') : 'None';
    lines.push(`Equipment: ${equipStr}`);

    if (equip.firstTimeEquipment.length > 0) {
      lines.push(`  [FIRST TIME: ${equip.firstTimeEquipment.join(', ')}]`);
    }
    if (equip.equipmentChanges.length > 0) {
      lines.push(`  Changes: ${equip.equipmentChanges.join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // TRAINER PATTERNS
  // -------------------------------------------------------------------------
  lines.push(formatTrainerPatterns(score.trainerPatterns));

  // -------------------------------------------------------------------------
  // BREEDING (only for lightly raced horses < 5 starts)
  // -------------------------------------------------------------------------
  if (form.lifetimeStarts < 5 && score.breeding.sire) {
    lines.push(
      `Breeding: ${score.breeding.sire} x ${score.breeding.damSire} (${score.breeding.whereBred})`
    );
  }

  // -------------------------------------------------------------------------
  // ALGORITHM FLAGS
  // -------------------------------------------------------------------------
  lines.push(
    `Algorithm Positives: ${score.positiveFactors.length > 0 ? score.positiveFactors.join(', ') : 'None flagged'}`
  );
  lines.push(
    `Algorithm Negatives: ${score.negativeFactors.length > 0 ? score.negativeFactors.join(', ') : 'None flagged'}`
  );

  return lines.join('\n');
}

// ============================================================================
// MAIN PROMPT BUILDER
// ============================================================================

/**
 * Build the main race analysis prompt for Gemini
 *
 * Token Budget: ~2000 input tokens, 2048 output tokens
 *
 * @param race - Parsed race data from DRF file
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string for AI analysis
 */
export function buildRaceAnalysisPrompt(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): string {
  const { header } = race;
  const { scores, raceAnalysis } = scoringResult;

  // Sort scores by algorithm rank
  const rankedScores = [...scores].filter((s) => !s.isScratched).sort((a, b) => a.rank - b.rank);

  // Format track intelligence
  const trackIntelSection = formatTrackIntelligence(raceAnalysis.trackIntelligence);

  // Format each horse with expanded data
  const horseSummaries = rankedScores.map((s) => formatHorseForPrompt(s)).join('\n\n');

  return `${ALGORITHM_CONTEXT}

---

You are an expert horse racing handicapper working alongside an algorithm. The algorithm scored each horse using 328 data points across 15 categories (see reference above). You add the human element — reading between the lines, catching what pure math misses.

YOUR ROLE: Find VALUE, not just winners. A horse the algorithm ranks 4th at 8-1 who should be 4-1 is more valuable than confirming the obvious favorite.

VALUE HUNTING FRAMEWORK:

1. ANALYZE THE FAVORITE CRITICALLY
   Does the top-ranked horse deserve to be favored?
   - Check: Trip comments from last 3 races - did they have clean trips or got lucky?
   - Check: Are they facing tougher competition today (class rise)?
   - Check: Does track bias work AGAINST their running style?
   A vulnerable favorite creates value everywhere else in the field.

2. HUNT FOR MASKED ABILITY (Trip Trouble)
   Scan trip comments for: "blocked", "checked", "steadied", "bumped", "wide", "no room", "broke slow"
   - A horse with a 75 Beyer who got blocked likely has 82+ ability
   - ESPECIALLY valuable if horse is ranked 3rd-6th with troubled trips

3. IDENTIFY PACE ADVANTAGES
   Cross-reference running styles with track speed bias:
   - If track favors early speed (>55% E win rate) and only ONE horse is E style = LONE SPEED EDGE
   - If track favors closers (<45% E win rate) and pace looks HOT = CLOSER VALUE
   - Algorithm pace score is static - you see the MATCHUP

4. SPOT TRAINER INTENT PATTERNS
   Look for trainer category stats marked with ★ (>25% win or >200% ROI):
   - First-time Lasix with trainer >25% in category = LIVE
   - First-time blinkers with trainer >25% in category = LIVE
   - Class drop + equipment change + jockey upgrade = ALL SYSTEMS GO
   - After claim with trainer >20% in category = NEW BARN BOUNCE

5. EVALUATE FITNESS SIGNALS
   - Bullet workout within 7 days + shortening up in distance = READY
   - 3+ works since last race with improving times = FITNESS PEAK
   - No works in 14+ days after layoff = FITNESS CONCERN

6. ASSESS DISTANCE/SURFACE EXPERIENCE
   - First time at today's distance with 0 starts = UNKNOWN (could be + or -)
   - Proven at distance (3+ starts, 30%+ win rate) = CONFIDENCE BOOST
   - First time on turf/wet with no breeding indicators = CAUTION

7. MAKE YOUR CALL
   - OVERRIDE the algorithm when you identify specific value angle (aim for 30-35% of races)
   - CONFIRM when top pick has clear superiority AND fair odds
   - Always identify a VALUE PLAY different from top pick when possible

VALUE LABELS:
- BEST BET: Your highest conviction play. Use sparingly (10-15% of top picks).
- PRIME VALUE: Strong edge at fair or better odds.
- SOLID PLAY: Legitimate contender, no red flags.
- FAIR PRICE: Has a chance, odds are about right.
- WATCH ONLY: Interesting but pass today.
- TOO SHORT: Good horse, bad price.
- NO VALUE: Outclassed or compromised.
- SKIP: Not competitive.
- NO CHANCE: Eliminate entirely.

ONE-LINER GUIDANCE - Be SPECIFIC and ACTIONABLE:
✗ BAD: "Nice horse, should run well"
✓ GOOD: "Lone speed, figures to wire field if breaks clean"
✓ GOOD: "Blocked last 2, hidden 85+ Beyer, gets rail draw today"
✓ GOOD: "First blinkers for 28% trainer, drops in class, bullet work"

VALUE PLAY GUIDANCE:
- valuePlay should be a horse ranked 3rd-6th with a specific live angle
- valuePlay should NOT be the topPick
- If no clear value angle exists, valuePlay can be null

RACE INFORMATION:
- Track: ${header.trackName} (${header.trackCode})
- Race ${header.raceNumber}: ${header.distance} on ${header.surface}, ${header.trackCondition}
- Class: ${header.classification}, Purse: ${header.purseFormatted}
- Field Size: ${rankedScores.length} horses

${trackIntelSection}

ALGORITHM ANALYSIS:
- Pace Scenario: ${raceAnalysis.paceScenario.expectedPace} pace expected
- Likely Leader: #${raceAnalysis.paceScenario.likelyLeader || 'None clear'}
- Speed Duel Probability: ${Math.round(raceAnalysis.paceScenario.speedDuelProbability * 100)}%
- Field Strength: ${raceAnalysis.fieldStrength}
- Vulnerable Favorite (algo): ${raceAnalysis.vulnerableFavorite ? 'YES' : 'No'}
- Pace Collapse Likely: ${raceAnalysis.likelyPaceCollapse ? 'YES' : 'No'}

HORSES (algorithm ranking):
${horseSummaries}

RESPOND WITH VALID JSON ONLY:
{
  "raceNarrative": "2-3 sentences. State CONFIRM or OVERRIDE and the specific reason why.",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "bettableRace": true | false,
  "horseInsights": [
    {
      "programNumber": number,
      "horseName": "string",
      "projectedFinish": number,
      "valueLabel": "BEST BET" | "PRIME VALUE" | "SOLID PLAY" | "FAIR PRICE" | "WATCH ONLY" | "TOO SHORT" | "NO VALUE" | "SKIP" | "NO CHANCE",
      "oneLiner": "Specific insight for this horse in this race",
      "keyStrength": "Primary edge" | null,
      "keyWeakness": "Primary concern" | null,
      "isContender": true | false,
      "avoidFlag": true | false
    }
  ],
  "topPick": number | null,
  "valuePlay": number | null,
  "avoidList": [numbers],
  "vulnerableFavorite": true | false,
  "likelyUpset": true | false,
  "chaoticRace": true | false
}`;
}

// ============================================================================
// MULTI-BOT SPECIALIZED PROMPT BUILDERS
// ============================================================================

// ============================================================================
// TRIP TROUBLE HELPER FUNCTIONS
// ============================================================================

/**
 * Trouble keywords that indicate racing interference/issues
 */
const TROUBLE_KEYWORDS = {
  traffic: ['blocked', 'boxed', 'no room', 'tight', 'shuffled'],
  contact: ['bumped', 'checked', 'steadied', 'impeded'],
  path: ['wide', '5-wide', '6-wide', 'parked out'],
  start: ['broke slow', 'broke poorly', 'stumbled', 'dwelt'],
  late: ['no late room', "couldn't get out", 'blocked stretch'],
};

/**
 * All trouble keywords flattened for matching
 */
const ALL_TROUBLE_KEYWORDS = Object.values(TROUBLE_KEYWORDS).flat();

/**
 * Check if a trip comment contains any trouble keywords
 *
 * @param comment - Trip comment to analyze
 * @returns Whether the comment indicates trouble
 */
export function hasTroubleKeyword(comment: string): boolean {
  if (!comment) return false;
  const lowerComment = comment.toLowerCase();
  return ALL_TROUBLE_KEYWORDS.some((keyword) => lowerComment.includes(keyword.toLowerCase()));
}

/**
 * Count races with trouble keywords in past performances
 *
 * @param pastPerformances - Array of past performances (max 3)
 * @returns Count of troubled races
 */
export function countTroubledRaces(pastPerformances: HorseScoreForAI['pastPerformances']): number {
  return pastPerformances.slice(0, 3).filter((pp) => hasTroubleKeyword(pp.tripComment)).length;
}

/**
 * Analyze position flow to detect if horse lost or gained position
 *
 * @param runningLine - Position flow data (start, stretch, finish)
 * @param hasTrouble - Whether the race had trouble
 * @returns Object with flags for LOST_POSITION and RALLIED_THROUGH_TROUBLE
 */
export function analyzePositionFlow(
  runningLine: { start: number | null; stretch: number | null; finish: number | null },
  hasTrouble: boolean
): { lostPosition: boolean; ralliedThroughTrouble: boolean } {
  const { start, finish } = runningLine;

  // Need valid data to analyze
  if (start === null || finish === null) {
    return { lostPosition: false, ralliedThroughTrouble: false };
  }

  // Lost position: started better than finished (lower number = better position)
  const lostPosition = finish > start;

  // Rallied through trouble: gained ground (improved position) despite trouble
  const ralliedThroughTrouble = hasTrouble && finish < start;

  return { lostPosition, ralliedThroughTrouble };
}

/**
 * Analyze Beyer trajectory to detect suppressed figures
 *
 * @param pastPerformances - Array of past performances (max 3)
 * @returns Object with trajectory string and suppressed flag
 */
export function analyzeBeyerTrajectory(pastPerformances: HorseScoreForAI['pastPerformances']): {
  trajectory: string;
  isSuppressed: boolean;
} {
  const pps = pastPerformances.slice(0, 3);

  if (pps.length === 0) {
    return { trajectory: 'N/A', isSuppressed: false };
  }

  // Get Beyer figures (most recent first in array)
  const beyers = pps.map((pp) => (pp.beyer !== null ? pp.beyer : null));

  // Build trajectory string
  const trajectoryParts = beyers.map((b) => (b !== null ? String(b) : 'N/A'));
  const trajectory = trajectoryParts.join(' -> ');

  // Check if most recent is lowest and had trouble
  const validBeyers = beyers.filter((b): b is number => b !== null);
  if (validBeyers.length < 2) {
    return { trajectory, isSuppressed: false };
  }

  const mostRecent = beyers[0];
  if (mostRecent === null || mostRecent === undefined) {
    return { trajectory, isSuppressed: false };
  }

  // Most recent is lowest among valid Beyers
  const isLowest = validBeyers.every((b) => mostRecent <= b);

  // Most recent race had trouble
  const mostRecentHadTrouble = pps[0] ? hasTroubleKeyword(pps[0].tripComment) : false;

  const isSuppressed = isLowest && mostRecentHadTrouble;

  return { trajectory, isSuppressed };
}

/**
 * Format a single horse's data for the Trip Trouble bot
 * Emphasizes trip-relevant data for identifying masked ability
 *
 * @param score - Horse score data from algorithm
 * @returns Formatted string for prompt
 */
export function formatHorseForTripTrouble(score: HorseScoreForAI): string {
  const lines: string[] = [];

  // Header
  lines.push(
    `#${score.programNumber} ${score.horseName} (Rank: ${score.rank}, Score: ${score.finalScore})`
  );

  // Past Performances with trip-relevant data
  const pps = score.pastPerformances.slice(0, 3);

  if (pps.length === 0) {
    lines.push('No past performances available');
    return lines.join('\n');
  }

  // Track trouble indicators
  let troubledRaceCount = 0;
  const positionFlags: string[] = [];

  pps.forEach((pp, idx) => {
    const raceNum = idx + 1;

    // Race details
    lines.push(
      `Race ${raceNum}: ${pp.track} ${pp.distance}f ${pp.surface} - Finish: ${pp.finishPosition}/${pp.fieldSize}`
    );

    // TRIP comment (prominent, uppercase label)
    const tripComment = pp.tripComment || 'No comment recorded';
    lines.push(`TRIP: ${tripComment}`);

    // Check for trouble in this race
    const hasTrouble = hasTroubleKeyword(pp.tripComment);
    if (hasTrouble) {
      troubledRaceCount++;
    }

    // Pace figures
    const beyer = pp.beyer !== null ? pp.beyer : 'N/A';
    const ep1 = pp.earlyPace1 !== null ? pp.earlyPace1 : 'N/A';
    const lp = pp.latePace !== null ? pp.latePace : 'N/A';
    lines.push(`Beyer: ${beyer} | EP1: ${ep1} | LP: ${lp}`);

    // Position flow (only if we have the data)
    const start = pp.runningLine.start;
    const stretch = pp.runningLine.stretch;
    const finish = pp.runningLine.finish;

    if (start !== null || stretch !== null || finish !== null) {
      const startStr = start !== null ? start : '?';
      const stretchStr = stretch !== null ? stretch : '?';
      const finishStr = finish !== null ? finish : '?';
      lines.push(
        `Position Flow: Started ${startStr} -> Stretch ${stretchStr} -> Finish ${finishStr}`
      );

      // Analyze position flow for flags
      const flowAnalysis = analyzePositionFlow(pp.runningLine, hasTrouble);
      if (flowAnalysis.lostPosition) {
        positionFlags.push(`Race ${raceNum}: LOST POSITION`);
      }
      if (flowAnalysis.ralliedThroughTrouble) {
        positionFlags.push(`Race ${raceNum}: RALLIED THROUGH TROUBLE`);
      }
    }

    // Odds info
    const odds = pp.odds !== null ? pp.odds.toFixed(1) : 'N/A';
    const favRank = pp.favoriteRank !== null ? pp.favoriteRank : 'N/A';
    lines.push(`Lengths Behind: ${pp.lengthsBehind}L | Odds: ${odds} (Fav: ${favRank})`);
  });

  // Trouble indicators summary
  lines.push(`Troubled Races: ${troubledRaceCount}/3`);

  // Position flow flags
  if (positionFlags.length > 0) {
    positionFlags.forEach((flag) => lines.push(flag));
  }

  // Beyer trajectory
  const beyerAnalysis = analyzeBeyerTrajectory(pps);
  lines.push(`Beyer Trend: ${beyerAnalysis.trajectory}`);
  if (beyerAnalysis.isSuppressed) {
    lines.push('FIGURE SUPPRESSED');
  }

  return lines.join('\n');
}

/**
 * Build prompt for Trip Trouble Bot
 *
 * Analyzes trip comments and recent PPs to identify horses with masked ability.
 * Focus: Recent trip trouble that hides true form.
 *
 * Token Budget: 400-600 input tokens, 150-200 output tokens
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string for AI analysis
 */
export function buildTripTroublePrompt(race: ParsedRace, scoringResult: RaceScoringResult): string {
  const { header } = race;

  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Token optimization: Only include horses ranked 2nd-8th
  // Skip heavy favorite (rank 1) - not looking for trip trouble on chalk
  // Skip longshots ranked 9+ - too thin to matter
  const eligibleHorses = rankedScores.filter((s) => s.rank >= 2 && s.rank <= 8);

  // Skip horses with fewer than 2 past performances (not enough data)
  const horsesWithData = eligibleHorses.filter((s) => s.pastPerformances.length >= 2);

  // Format each horse using the trip trouble helper
  const horseSummaries = horsesWithData.map((s) => formatHorseForTripTrouble(s)).join('\n\n');

  // Race context
  const fieldSize = rankedScores.length;
  const paceScenario = scoringResult.raceAnalysis.paceScenario.expectedPace;

  return `You are a horse racing trip analysis specialist. Identify horses with masked ability. Return JSON only.

---

TRIP TROUBLE ANALYSIS

Your job: Find horses whose LAST 3 RACES hide true ability due to racing trouble.

TROUBLE KEYWORDS TO SCAN:

Traffic: "blocked", "boxed", "no room", "tight", "shuffled"
Contact: "bumped", "checked", "steadied", "impeded"
Path: "wide", "5-wide", "6-wide", "parked out"
Start: "broke slow", "broke poorly", "stumbled", "dwelt"
Late: "no late room", "couldn't get out", "blocked stretch"

FIGURE ADJUSTMENT LOGIC:

1 troubled race with clear trouble = +3-5 Beyer hidden
2 troubled races = +5-8 Beyer hidden
Wide trip (4+ wide) = +2-3 Beyer hidden
Blocked in stretch with late pace figure still strong = HIGH confidence masked ability

WHAT MAKES A HORSE "LIVE":

Multiple troubled trips AND still hitting the board
Position flow shows horse closing despite trouble
EP1 or LP figures strong despite poor finish position
Beyer dropped but trouble explains it (not declining form)

WHAT TO IGNORE:

Generic comments like "no mishap" or "clear trip"
Trouble that horse caused (lugged in, bore out)
Trouble in races 4+ back (too old)

CONFIDENCE LEVELS:

HIGH: 2+ races with clear traffic trouble, strong underlying pace figures
MEDIUM: 1 race with definite trouble, other races clean
LOW: Possible trouble but comments ambiguous

---

RACE CONTEXT:
Track: ${header.trackName} (${header.trackCode})
Distance: ${header.distanceFurlongs}f ${header.surface}
Field Size: ${fieldSize} horses
Expected Pace: ${paceScenario}

HORSES (Ranked 2nd-8th with 2+ PPs):
${horseSummaries || 'No eligible horses for trip trouble analysis'}

---

OUTPUT FORMAT - Return JSON only:
{
  "troubledHorses": [
    {
      "programNumber": number,
      "horseName": "string",
      "troubledRaceCount": number,
      "hiddenAbilityEstimate": "string",
      "keyTroubleRace": "string",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "string"
}

Only include horses with clear trip trouble. Empty troubledHorses array if none found.`;
}

// ============================================================================
// PACE SCENARIO HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate average of an array of numbers, ignoring nulls
 *
 * @param values - Array of numbers or nulls
 * @returns Average value or null if no valid values
 */
export function calculatePaceAverage(values: (number | null)[]): number | null {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  return Math.round(validValues.reduce((sum, v) => sum + v, 0) / validValues.length);
}

/**
 * Classify speed profile based on EP1 vs LP ratio
 *
 * @param avgEP1 - Average early pace 1 figure
 * @param avgLP - Average late pace figure
 * @returns Speed profile classification
 */
export function classifySpeedProfile(
  avgEP1: number | null,
  avgLP: number | null
): 'Early Burner' | 'Presser' | 'Mid-Pack' | 'Closer' | 'Unknown' {
  if (avgEP1 === null || avgLP === null) return 'Unknown';

  const diff = avgEP1 - avgLP;

  if (diff >= 5) return 'Early Burner'; // Strong early, weaker late
  if (diff >= 0) return 'Presser'; // Balanced or slight early
  if (diff >= -5) return 'Mid-Pack'; // Slight late pace
  return 'Closer'; // Strong late pace
}

/**
 * Analyze pace tendencies from past performances
 *
 * @param pastPerformances - Array of past performances (last 3)
 * @returns Object with pace tendency flags
 */
export function analyzePaceTendencies(pastPerformances: HorseScoreForAI['pastPerformances']): {
  confirmedEarlySpeed: boolean;
  confirmedCloser: boolean;
  strongLateKick: boolean;
  fadesLate: boolean;
} {
  const pps = pastPerformances.slice(0, 3);

  if (pps.length < 2) {
    return {
      confirmedEarlySpeed: false,
      confirmedCloser: false,
      strongLateKick: false,
      fadesLate: false,
    };
  }

  // Count races where horse started in positions 1-2
  const startedFast = pps.filter(
    (pp) => pp.runningLine.start !== null && pp.runningLine.start <= 2
  ).length;

  // Count races where horse started 6+ and finished 1-3
  const closedWell = pps.filter(
    (pp) => pp.runningLine.start !== null && pp.runningLine.start >= 6 && pp.finishPosition <= 3
  ).length;

  // Count races where position improved 3+ spots from start to finish
  const gainedGround = pps.filter((pp) => {
    if (pp.runningLine.start === null || pp.runningLine.finish === null) return false;
    return pp.runningLine.start - pp.runningLine.finish >= 3;
  }).length;

  // Count races where position dropped 3+ spots from start to finish
  const lostGround = pps.filter((pp) => {
    if (pp.runningLine.start === null || pp.runningLine.finish === null) return false;
    return pp.runningLine.finish - pp.runningLine.start >= 3;
  }).length;

  return {
    confirmedEarlySpeed: startedFast >= 2, // Started 1-2 in 2+ of last 3
    confirmedCloser: closedWell >= 2, // Started 6+ and finished 1-3 in 2+ races
    strongLateKick: gainedGround >= 2, // Improved 3+ spots consistently
    fadesLate: lostGround >= 2, // Dropped 3+ spots consistently
  };
}

/**
 * Format a single horse's data for the Pace Scenario bot
 * Emphasizes pace-relevant data for identifying pace advantages
 *
 * @param score - Horse score data from algorithm
 * @param horse - Horse entry from race data
 * @returns Formatted string for prompt
 */
export function formatHorseForPaceScenario(
  score: HorseScoreForAI,
  horse: { postPosition: number; runningStyle: string | null } | undefined
): string {
  const lines: string[] = [];
  const runningStyle =
    horse?.runningStyle || score.formIndicators.earlySpeedRating
      ? score.formIndicators.earlySpeedRating && score.formIndicators.earlySpeedRating >= 90
        ? 'E/P'
        : 'S'
      : 'Unknown';
  const postPosition = horse?.postPosition ?? 'N/A';

  // Header
  lines.push(
    `#${score.programNumber} ${score.horseName} | Style: ${horse?.runningStyle || runningStyle} | Rank: ${score.rank}`
  );

  // Get last 3 past performances
  const pps = score.pastPerformances.slice(0, 3);

  // Calculate averages
  const ep1Values = pps.map((pp) => pp.earlyPace1);
  const lpValues = pps.map((pp) => pp.latePace);
  const avgEP1 = calculatePaceAverage(ep1Values);
  const avgLP = calculatePaceAverage(lpValues);

  // Pace profile section
  const earlySpeedRating = score.formIndicators.earlySpeedRating;
  lines.push(`Early Speed Rating: ${earlySpeedRating !== null ? earlySpeedRating : 'N/A'}`);

  if (avgEP1 !== null || avgLP !== null) {
    lines.push(
      `Avg EP1: ${avgEP1 !== null ? avgEP1 : 'N/A'} | Avg LP: ${avgLP !== null ? avgLP : 'N/A'}`
    );
    const speedProfile = classifySpeedProfile(avgEP1, avgLP);
    lines.push(`SPEED PROFILE: ${speedProfile}`);
  } else {
    lines.push('Pace figures: UNAVAILABLE');
  }

  // Past performances with pace data
  if (pps.length > 0) {
    pps.forEach((pp) => {
      const ep1Str = pp.earlyPace1 !== null ? pp.earlyPace1 : 'N/A';
      const lpStr = pp.latePace !== null ? pp.latePace : 'N/A';
      lines.push(`${pp.track} ${pp.distance}f: EP1 ${ep1Str} / LP ${lpStr}`);

      // Position flow
      const start = pp.runningLine.start !== null ? pp.runningLine.start : '?';
      const stretch = pp.runningLine.stretch !== null ? pp.runningLine.stretch : '?';
      const finish = pp.runningLine.finish !== null ? pp.runningLine.finish : '?';
      lines.push(`Start: ${start} -> Stretch: ${stretch} -> Finish: ${finish}`);
      lines.push(`Final Position: ${pp.finishPosition}/${pp.fieldSize}`);
    });
  }

  // Pace tendency flags
  const tendencies = analyzePaceTendencies(pps);
  const tendencyFlags: string[] = [];

  if (tendencies.confirmedEarlySpeed) tendencyFlags.push('CONFIRMED EARLY SPEED');
  if (tendencies.confirmedCloser) tendencyFlags.push('CONFIRMED CLOSER');
  if (tendencies.strongLateKick) tendencyFlags.push('STRONG LATE KICK');
  if (tendencies.fadesLate) tendencyFlags.push('FADES LATE');

  if (tendencyFlags.length > 0) {
    tendencyFlags.forEach((flag) => lines.push(flag));
  }

  // Post position
  lines.push(`Post: ${postPosition}`);

  return lines.join('\n');
}

/**
 * Format abbreviated horse data for Pace Scenario (for horses ranked 7+)
 * Token-optimized format showing only essential pace info
 *
 * @param score - Horse score data from algorithm
 * @param horse - Horse entry from race data
 * @returns Abbreviated formatted string
 */
export function formatHorseForPaceScenarioAbbreviated(
  score: HorseScoreForAI,
  horse: { postPosition: number; runningStyle: string | null } | undefined
): string {
  const pps = score.pastPerformances.slice(0, 3);
  const ep1Values = pps.map((pp) => pp.earlyPace1);
  const avgEP1 = calculatePaceAverage(ep1Values);
  const runningStyle = horse?.runningStyle || 'Unknown';

  return `#${score.programNumber} ${score.horseName} | Style: ${runningStyle} | EP1 Avg: ${avgEP1 !== null ? avgEP1 : 'N/A'}`;
}

/**
 * Build prompt for Pace Scenario Bot
 *
 * Analyzes running styles, early speed figures, track bias, and post positions.
 * Focus: Pace dynamics and which horses benefit from today's specific matchup.
 *
 * Token Budget: 500-700 input tokens, 200-250 output tokens
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string for AI analysis
 */
export function buildPaceScenarioPrompt(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): string {
  const { header } = race;
  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  const { paceScenario, trackIntelligence } = scoringResult.raceAnalysis;

  // Format track intelligence section
  const trackIntelSection = formatTrackIntelligence(trackIntelligence);

  // Format horses - full format for ranks 1-6, abbreviated for 7+
  const horseSummaries = rankedScores
    .map((score) => {
      const horse = race.horses.find((h) => h.programNumber === score.programNumber);
      const horseData = horse
        ? { postPosition: horse.postPosition, runningStyle: horse.runningStyle }
        : undefined;

      if (score.rank <= 6) {
        return formatHorseForPaceScenario(score, horseData);
      } else {
        return formatHorseForPaceScenarioAbbreviated(score, horseData);
      }
    })
    .join('\n\n');

  // Count early speed horses
  const earlySpeedCount = paceScenario.earlySpeedCount;

  return `You are a horse racing pace analyst. Identify pace scenario advantages. Return JSON only.

---

PACE SCENARIO ANALYSIS

Your job: Determine how today's pace will unfold and who benefits.

TRACK BIAS CONTEXT:
${trackIntelSection}

USE TRACK BIAS TO INFORM ANALYSIS:
- If speed bias >55%: Early speed horses have structural edge
- If speed bias <45%: Closers have structural edge
- If stretch >1100ft: Closers get more room to rally
- If stretch <990ft: Speed holds better, closers need perfect trip
- Seasonal patterns may shift bias (check SEASONAL section)

PACE SCENARIO CLASSIFICATION:
- LONE_SPEED - One E-style horse, no pressure = HUGE EDGE (win rate 35-40%)
- SPEED_DUEL - 2+ E-style horses, both with EP1 >90 = CLOSER ADVANTAGE
- MODERATE - 1-2 pressers, honest pace = FAIR FOR ALL
- SLOW - All closers/stalkers, slow pace = FIRST MOVE WINS

HOW TO IDENTIFY:
- Count horses with "CONFIRMED EARLY SPEED" flag
- Cross-reference with Early Speed Rating and EP1 averages
- EP1 >92 = wants the lead
- EP1 85-92 = can press
- EP1 <85 = closer/stalker

PACE COLLAPSE WARNING:
- 3+ confirmed speed horses = likely pace collapse
- EP1 spread <5 points among top 3 = they'll fight for lead
- Historical: pace collapses favor horses 4+ lengths off pace at half

GOLDEN SCENARIOS:
- Lone speed + speed-favoring track = BEST BET territory
- Speed duel + deep closer + long stretch = CLOSER VALUE
- No speed + confirmed presser = CONTROLS PACE

POST POSITION INTEGRATION:
- Check favoredPosts from track intelligence
- Inside speed has advantage if no other speed inside
- Outside closer needs racing room, longer stretch helps

---

RACE CONTEXT:
Track: ${header.trackName} (${header.trackCode})
Distance: ${header.distanceFurlongs}f ${header.surface}
Field Size: ${rankedScores.length} horses
Algorithm Early Speed Count: ${earlySpeedCount}
Algorithm Speed Duel Probability: ${Math.round(paceScenario.speedDuelProbability * 100)}%

HORSES:
${horseSummaries}

---

OUTPUT FORMAT - Return JSON only:
{
  "paceProjection": "LONE_SPEED" | "SPEED_DUEL" | "MODERATE" | "SLOW",
  "earlySpeedHorses": [number],
  "likelyLeader": number | null,
  "speedDuelLikely": boolean,
  "paceCollapseRisk": "HIGH" | "MEDIUM" | "LOW",
  "beneficiaries": [
    {
      "programNumber": number,
      "horseName": "string",
      "advantage": "string",
      "edgeStrength": "STRONG" | "MODERATE" | "SLIGHT"
    }
  ],
  "loneSpeedException": boolean,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "string"
}`;
}

// ============================================================================
// VULNERABLE FAVORITE HELPER FUNCTIONS
// ============================================================================

/**
 * Keywords indicating a "perfect trip" that may have flattered performance
 */
const FLATTERING_TRIP_KEYWORDS = [
  'perfect trip',
  'rail trip',
  'saved ground',
  'ideal trip',
  'dream trip',
  'golden trip',
  'textbook trip',
  'no traffic',
  'clear sailing',
  'easy lead',
  'uncontested lead',
  'all alone',
  'wire to wire',
];

/**
 * Check if a trip comment indicates a flattered performance
 *
 * @param comment - Trip comment to analyze
 * @returns Whether the comment suggests a flattering trip
 */
export function hasFlatteningTripKeyword(comment: string): boolean {
  if (!comment) return false;
  const lowerComment = comment.toLowerCase();
  return FLATTERING_TRIP_KEYWORDS.some((keyword) => lowerComment.includes(keyword.toLowerCase()));
}

/**
 * Check if Beyer figures are declining (each lower than previous)
 *
 * @param beyers - Array of Beyer figures (most recent first)
 * @returns Whether figures are declining
 */
export function isDecliningBeyers(beyers: (number | null)[]): boolean {
  const validBeyers = beyers.filter((b): b is number => b !== null);
  if (validBeyers.length < 2) return false;

  // Check if each Beyer is lower than the previous (older) one
  // Array is most recent first, so validBeyers[0] is most recent
  for (let i = 0; i < validBeyers.length - 1; i++) {
    const current = validBeyers[i];
    const previous = validBeyers[i + 1];
    if (current === undefined || previous === undefined) return false;
    if (current >= previous) return false;
  }
  return true;
}

/**
 * Check if running style mismatches track bias
 *
 * @param runningStyle - Horse's running style (E, E/P, P, S)
 * @param trackFavoredStyle - Track's favored style
 * @returns Whether there's a mismatch
 */
export function hasStyleMismatch(
  runningStyle: string | null,
  trackFavoredStyle: string | null
): boolean {
  if (!runningStyle || !trackFavoredStyle || trackFavoredStyle === 'neutral') return false;

  const isCloser = runningStyle === 'S' || runningStyle === 'PS';
  const isSpeed = runningStyle === 'E' || runningStyle === 'E/P';

  const trackFavorsSpeed = trackFavoredStyle === 'E' || trackFavoredStyle === 'E/P';
  const trackFavorsClosers = trackFavoredStyle === 'S' || trackFavoredStyle === 'P';

  // Mismatch if closer on speed-favoring track or speed on closer-favoring track
  if (isCloser && trackFavorsSpeed) return true;
  if (isSpeed && trackFavorsClosers) return true;

  return false;
}

/**
 * Format the favorite's data for vulnerability analysis
 * Emphasizes weaknesses and vulnerability flags
 *
 * @param favorite - The favorite horse's score data
 * @param horse - Optional horse entry from race data for running style
 * @param trackIntel - Track intelligence data (null if unavailable)
 * @param raceClassification - Today's race classification
 * @returns Formatted string with vulnerability flags
 */
export function formatFavoriteForAnalysis(
  favorite: HorseScoreForAI,
  horse: { postPosition: number; runningStyle: string | null } | undefined,
  trackIntel: TrackIntelligenceForAI | null,
  raceClassification: string
): string {
  const lines: string[] = [];
  const flags: string[] = [];

  // -------------------------------------------------------------------------
  // HEADER
  // -------------------------------------------------------------------------
  lines.push(`FAVORITE ANALYSIS: #${favorite.programNumber} ${favorite.horseName}`);
  lines.push(
    `Algorithm Rank: ${favorite.rank} | Score: ${favorite.finalScore}/368 | Tier: ${favorite.confidenceTier}`
  );
  lines.push(`Morning Line: ${favorite.morningLineOdds}`);

  const pps = favorite.pastPerformances.slice(0, 3);

  // Check for limited form data
  if (pps.length < 2) {
    lines.push('');
    lines.push('LIMITED FORM DATA - cannot fully assess');
    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // RECENT FORM DEEP DIVE
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('--- RECENT FORM ---');

  // Last 3 results
  const resultsStr = pps.map((pp) => `${pp.finishPosition}/${pp.fieldSize}`).join(', ');
  lines.push(`Last 3 Results: ${resultsStr}`);

  // Beyer trend
  const beyers = pps.map((pp) => pp.beyer);
  const beyerStr = beyers.map((b) => (b !== null ? String(b) : 'N/A')).join(' -> ');
  lines.push(`Beyer Trend: ${beyerStr}`);

  // Check for declining figures
  if (isDecliningBeyers(beyers)) {
    flags.push('DECLINING FIGURES');
    lines.push('⚠️ DECLINING FIGURES');
  }

  // Days since last race / layoff risk
  const daysSinceLastRace = favorite.formIndicators.daysSinceLastRace;
  lines.push(`Days Since Last Race: ${daysSinceLastRace !== null ? daysSinceLastRace : 'N/A'}`);
  if (daysSinceLastRace !== null && daysSinceLastRace > 60) {
    flags.push('LAYOFF RISK');
    lines.push('⚠️ LAYOFF RISK');
  }

  // -------------------------------------------------------------------------
  // TRIP QUALITY ASSESSMENT
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('--- TRIP QUALITY ---');

  // List all 3 trip comments
  pps.forEach((pp, idx) => {
    const comment = pp.tripComment || 'No comment';
    lines.push(`Race ${idx + 1}: "${comment}"`);
  });

  // Check for flattering trips (look at winning races)
  const winningWithFlattering = pps.filter(
    (pp) => pp.finishPosition === 1 && hasFlatteningTripKeyword(pp.tripComment)
  );
  if (winningWithFlattering.length > 0) {
    flags.push('FLATTERED BY TRIP');
    lines.push('⚠️ FLATTERED BY TRIP');
  }

  // Check if closer won when pace was likely hot (won as closer from far back)
  const isCloser = horse?.runningStyle === 'S' || horse?.runningStyle === 'PS';
  const wonFromFarBack = pps.find(
    (pp) =>
      pp.finishPosition === 1 &&
      pp.runningLine.start !== null &&
      pp.runningLine.start >= 5 &&
      pp.runningLine.finish === 1
  );
  if (isCloser && wonFromFarBack) {
    flags.push('BENEFITED FROM PACE COLLAPSE');
    lines.push('⚠️ BENEFITED FROM PACE COLLAPSE');
  }

  // -------------------------------------------------------------------------
  // CLASS ANALYSIS
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('--- CLASS ANALYSIS ---');
  lines.push(`Today's Class: ${raceClassification}`);

  // List last 3 class levels from PPs (we use track conditions as proxy if no class field)
  const classLevels = pps.map((pp) => pp.trackCondition || 'Unknown');
  lines.push(`Last 3 Conditions: ${classLevels.join(', ')}`);

  // Check for class rise - if today's class appears higher (simple heuristic)
  const todayLower = raceClassification.toLowerCase();
  const isStakesOrGraded =
    todayLower.includes('stakes') ||
    todayLower.includes('grade') ||
    todayLower.includes('g1') ||
    todayLower.includes('g2') ||
    todayLower.includes('g3');
  const lastWasLower = pps.some(
    (pp) =>
      pp.finishPosition <= 3 &&
      !pp.trackCondition?.toLowerCase().includes('stakes') &&
      !pp.trackCondition?.toLowerCase().includes('grade')
  );
  if (isStakesOrGraded && lastWasLower) {
    flags.push('CLASS RISE');
    lines.push('⚠️ CLASS RISE');
  }

  // Check if beaten at this level recently (lost at same or lower class)
  const beatenRecently = pps.filter((pp) => pp.finishPosition > 3);
  if (beatenRecently.length >= 2) {
    flags.push('BEATEN AT THIS LEVEL');
    lines.push('⚠️ BEATEN AT THIS LEVEL');
  }

  // -------------------------------------------------------------------------
  // TRACK/DISTANCE/SURFACE FIT
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('--- TRACK/DISTANCE/SURFACE FIT ---');

  const stats = favorite.distanceSurfaceStats;
  const distWinRate = (stats.distanceWinRate * 100).toFixed(0);
  const surfWinRate = (stats.surfaceWinRate * 100).toFixed(0);

  lines.push(`Distance Record: ${stats.distanceWins}/${stats.distanceStarts} (${distWinRate}%)`);
  lines.push(`Surface Record: ${stats.surfaceWins}/${stats.surfaceStarts} (${surfWinRate}%)`);

  // Unproven at distance flag
  if (stats.distanceStarts < 2) {
    flags.push('UNPROVEN AT DISTANCE');
    lines.push('⚠️ UNPROVEN AT DISTANCE');
  }

  // Poor surface record flag
  if (stats.surfaceStarts >= 3 && stats.surfaceWinRate < 0.15) {
    flags.push('POOR SURFACE RECORD');
    lines.push('⚠️ POOR SURFACE RECORD');
  }

  // -------------------------------------------------------------------------
  // PACE FIT VS TRACK
  // -------------------------------------------------------------------------
  if (trackIntel) {
    lines.push('');
    lines.push('--- PACE FIT VS TRACK ---');

    const runningStyle = horse?.runningStyle || 'Unknown';
    lines.push(`Running Style: ${runningStyle}`);
    lines.push(`Track Favors: ${trackIntel.speedBias.favoredStyle}`);

    if (hasStyleMismatch(horse?.runningStyle || null, trackIntel.speedBias.favoredStyle)) {
      flags.push('STYLE MISMATCH');
      lines.push('⚠️ STYLE MISMATCH');
    }
  }

  // -------------------------------------------------------------------------
  // CONNECTIONS CHECK
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push('--- CONNECTIONS CHECK ---');

  // Check trainer patterns for concerning stats
  const trainerPatterns = favorite.trainerPatterns;
  const concerningPatterns: string[] = [];

  const patternCategories: [keyof typeof trainerPatterns, string][] = [
    ['days31to60', 'Days 31-60'],
    ['days61to90', 'Days 61-90'],
    ['days91to180', 'Days 91-180'],
    ['days181plus', 'Days 181+'],
    ['dirtSprint', 'Dirt Sprint'],
    ['dirtRoute', 'Dirt Route'],
    ['turfSprint', 'Turf Sprint'],
    ['turfRoute', 'Turf Route'],
    ['wetTrack', 'Wet Track'],
  ];

  for (const [key, name] of patternCategories) {
    const stat = trainerPatterns[key];
    if (stat && stat.starts >= 10 && stat.winPercent < 10) {
      concerningPatterns.push(`${name}: ${stat.wins}/${stat.starts} (${stat.winPercent}%)`);
    }
  }

  if (concerningPatterns.length > 0) {
    lines.push('Trainer Relevant Patterns:');
    concerningPatterns.forEach((p) => lines.push(`  ${p}`));
    flags.push('POOR TRAINER PATTERN');
    lines.push('⚠️ POOR TRAINER PATTERN');
  } else {
    lines.push('Trainer Patterns: No concerning patterns');
  }

  // -------------------------------------------------------------------------
  // VULNERABILITY FLAGS SUMMARY
  // -------------------------------------------------------------------------
  lines.push('');
  lines.push(`VULNERABILITY FLAGS: ${flags.length > 0 ? flags.join(', ') : 'None'}`);

  return lines.join('\n');
}

/**
 * Format challengers (ranks 2-4) in abbreviated format
 *
 * @param challengers - Array of challenger scores (should be ranks 2-4)
 * @param favorite - The favorite to compare against
 * @returns Formatted string for challengers
 */
export function formatChallengers(
  challengers: HorseScoreForAI[],
  favorite: HorseScoreForAI
): string {
  if (challengers.length === 0) {
    return 'CHALLENGERS: None available';
  }

  const lines: string[] = [];
  lines.push('CHALLENGERS (Ranks 2-4):');

  challengers.slice(0, 3).forEach((challenger) => {
    lines.push('');
    lines.push(
      `#${challenger.programNumber} ${challenger.horseName} (Rank ${challenger.rank}, Score ${challenger.finalScore})`
    );

    // Key strength - first positive factor or inferred from data
    const keyStrength =
      challenger.positiveFactors.length > 0
        ? challenger.positiveFactors[0]
        : challenger.finalScore >= favorite.finalScore - 5
          ? 'Close to favorite in algorithm score'
          : 'Competitive at this class';
    lines.push(`Key Strength: ${keyStrength}`);

    // Key angle - why they could beat favorite
    let keyAngle = 'Could upset if favorite regresses';

    // Check for specific angles
    const pps = challenger.pastPerformances.slice(0, 3);
    const troubledTrips = pps.filter((pp) => hasTroubleKeyword(pp.tripComment));
    if (troubledTrips.length >= 2) {
      keyAngle = 'Hidden form due to troubled trips';
    } else if (challenger.formIndicators.lastBeyer && favorite.formIndicators.lastBeyer) {
      if (challenger.formIndicators.lastBeyer >= favorite.formIndicators.lastBeyer) {
        keyAngle = 'Matching or better recent Beyer figure';
      }
    }

    lines.push(`Key Angle: ${keyAngle}`);
  });

  return lines.join('\n');
}

/**
 * Build prompt for Vulnerable Favorite Bot
 *
 * Analyzes the algorithm's top pick to identify if it's a false favorite worth betting against.
 * Focus: Finding when the top-ranked horse is a false favorite based on trip dependency,
 * declining form, class issues, or style mismatches.
 *
 * Token Budget: ~500-650 input tokens, 200-250 output tokens
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string for AI analysis
 */
export function buildVulnerableFavoritePrompt(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): string {
  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Handle empty array case
  if (rankedScores.length === 0) {
    return `You are a horse racing contrarian analyst. Identify vulnerable favorites. Return JSON only.

No horses available for analysis.

RESPOND WITH JSON ONLY:
{
  "favoriteAnalysis": {
    "programNumber": 0,
    "horseName": "N/A",
    "isVulnerable": false,
    "vulnerabilityFlags": [],
    "solidFoundation": [],
    "overallAssessment": "No horses available for analysis"
  },
  "confidence": "LOW",
  "recommendedAction": "NEUTRAL",
  "beneficiaries": [],
  "reasoning": "No horses available for analysis"
}`;
  }

  // Find the favorite (algorithm rank 1 - the top-ranked horse)
  const favorite = rankedScores[0]!;

  // Get challengers (ranks 2-4)
  const challengers = rankedScores.slice(1, 4);

  // Get horse data for running style
  const favHorse = race.horses.find((h) => h.programNumber === favorite.programNumber);
  const horseData = favHorse
    ? { postPosition: favHorse.postPosition, runningStyle: favHorse.runningStyle }
    : undefined;

  // Get track intelligence
  const trackIntel = scoringResult.raceAnalysis.trackIntelligence;

  // Format favorite analysis
  const favoriteSection = formatFavoriteForAnalysis(
    favorite,
    horseData,
    trackIntel,
    race.header.classification
  );

  // Format challengers
  const challengersSection = formatChallengers(challengers, favorite);

  // Format track intelligence
  const trackIntelSection = formatTrackIntelligence(trackIntel);

  return `You are a horse racing contrarian analyst. Identify vulnerable favorites. Return JSON only.

---

VULNERABLE FAVORITE ANALYSIS

Your job: Determine if the algorithm's top pick is a FALSE FAVORITE worth betting against.

A favorite is VULNERABLE when their ranking is based on:
- Inflated figures from perfect trips they won't repeat
- Winning at lower class than today
- Form that's declining, not improving
- Style that doesn't fit today's track bias
- Layoff with questionable fitness indicators

VULNERABILITY CHECKLIST:
□ TRIP DEPENDENCY - Won with "perfect trip", "rail trip", "no traffic" - unlikely to repeat
□ PACE DEPENDENCY - Won as closer when pace collapsed - need same setup
□ CLASS INFLATION - Beat weaker, now facing better
□ DECLINING FIGURES - Beyers trending down, not up
□ FITNESS DOUBT - Long layoff, no bullet works, last race dull
□ TRACK/STYLE MISMATCH - Running style doesn't suit track bias
□ FALSE FAVORITE SYNDROME - Short odds based on name/connections, not current form

WHAT MAKES A FAVORITE "SOLID" (NOT vulnerable):
- Won with figures, not just trips
- Proven at today's class or higher
- Improving or consistent Beyer pattern
- Style matches track bias
- Distance/surface proven
- Sharp recent work pattern

CONFIDENCE LEVELS:
- HIGH: 3+ vulnerability flags, clear reason to oppose
- MEDIUM: 1-2 flags, some concern but could still win
- LOW: Minor concerns only, favorite is likely solid

IF VULNERABLE - WHO BENEFITS?
- Identify which challengers gain most from favorite's weakness
- A vulnerable closer-favorite on speed-favoring track = speed horses benefit
- A vulnerable class-riser = proven class horses benefit

---

${trackIntelSection}

---

${favoriteSection}

---

${challengersSection}

---

OUTPUT FORMAT - Return JSON only:
{
  "favoriteAnalysis": {
    "programNumber": number,
    "horseName": "string",
    "isVulnerable": boolean,
    "vulnerabilityFlags": ["TRIP DEPENDENCY", "CLASS RISE", etc.],
    "solidFoundation": ["What IS working for them"],
    "overallAssessment": "1 sentence summary"
  },
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "recommendedAction": "FADE" | "RESPECT" | "NEUTRAL",
  "beneficiaries": [program numbers who benefit if favorite fails],
  "reasoning": "2-3 sentences on vulnerability case"
}`;
}

/**
 * Build prompt for Field Spread Bot
 *
 * Analyzes scores and ranking gaps to assess field separation.
 * Focus: How tight is this field? How many real contenders?
 *
 * @param _race - Parsed race data (unused, kept for API consistency)
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string (400-600 tokens input, requests 50-150 tokens output)
 */
export function buildFieldSpreadPrompt(
  _race: ParsedRace,
  scoringResult: RaceScoringResult
): string {
  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Calculate score gaps
  const scoreData = rankedScores.map((score, idx) => {
    const prevScore = idx > 0 ? rankedScores[idx - 1] : null;
    const gap = prevScore ? prevScore.finalScore - score.finalScore : 0;
    return {
      rank: score.rank,
      num: score.programNumber,
      name: score.horseName,
      score: score.finalScore,
      tier: score.confidenceTier,
      gapFromAbove: gap,
    };
  });

  const topScore = rankedScores[0]?.finalScore || 0;
  const bottomScore = rankedScores[rankedScores.length - 1]?.finalScore || 0;
  const spread = topScore - bottomScore;

  return `${FIELD_SPREAD_CONTEXT}

---

You are a field separation analyst guiding bet spread strategy.

YOUR ONE JOB: Assess how separated the contenders are to guide bet spread width.

WHAT TO LOOK FOR - Analyze algorithm score gaps:
- SEPARATED field (go NARROW with picks):
  * Top horse has 15+ point lead over #2
  * Clear top 2 with 10+ point gap to #3
  * One dominant horse stands out
- TIGHT field (go WIDE with picks):
  * Top 4 horses within 10 points of each other
  * No clear separation in top tier
  * Multiple horses with similar profiles
- MIXED field (go MEDIUM with picks):
  * Clear top 2-3, then a gap, then bunched middle tier

TOP TIER COUNT: How many horses are legitimate win contenders (within 12 points of top score)

RANKINGS:
${scoreData.map((h) => `${h.rank}. #${h.num} ${h.name} Score:${h.score} Tier:${h.tier} Gap:${h.gapFromAbove > 0 ? '-' + h.gapFromAbove : '—'}`).join('\n')}

SPREAD: Top ${topScore} to Bottom ${bottomScore} = ${spread} pt range

OUTPUT FORMAT - Return JSON only:
{
  "fieldType": "TIGHT" | "SEPARATED" | "MIXED",
  "topTierCount": number,
  "recommendedSpread": "NARROW" | "MEDIUM" | "WIDE"
}`;
}
