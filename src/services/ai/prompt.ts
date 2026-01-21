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
import {
  ALGORITHM_CONTEXT,
  PACE_CONTEXT,
  TRIP_TROUBLE_CONTEXT,
  FIELD_SPREAD_CONTEXT,
  VULNERABLE_FAVORITE_CONTEXT,
} from './algorithmContext';

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

/**
 * Build prompt for Trip Trouble Bot
 *
 * Analyzes trip comments and recent PPs to identify horses with masked ability.
 * Focus: Recent trip trouble that hides true form.
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string (400-600 tokens input, requests 50-150 tokens output)
 */
export function buildTripTroublePrompt(race: ParsedRace, scoringResult: RaceScoringResult): string {
  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Extract only trip-relevant data
  const tripData = rankedScores
    .map((score) => {
      const horse = race.horses.find((h) => h.programNumber === score.programNumber);
      if (!horse) return null;

      const recentTrips = horse.pastPerformances.slice(0, 3).map((pp) => ({
        date: pp.date,
        finish: `${pp.finishPosition}/${pp.fieldSize}`,
        comment: pp.tripComment || 'none',
      }));

      return {
        num: score.programNumber,
        name: score.horseName,
        trips: recentTrips,
      };
    })
    .filter(Boolean);

  return `${TRIP_TROUBLE_CONTEXT}

---

You are a trip trouble specialist analyzing race replays via trip comments.

YOUR ONE JOB: Identify horses whose recent races don't reflect true ability due to trip trouble.

WHAT TO LOOK FOR:
- Scan trip comments for: "blocked", "checked", "steadied", "bumped", "wide trip", "no room", "broke slow", "stumbled", "squeezed", "forced wide", "lost position"
- Flag horses with 2+ troubled trips in last 3 races as HIGH masked ability
- Flag horses with 1 troubled trip in last race as MEDIUM masked ability
- Ignore vague comments like "no excuses" or "raced well"
- A horse that finished 4th+ but had clear trouble is more interesting than a horse that finished 2nd with a clean trip

HORSES:
${tripData.map((h) => `#${h!.num} ${h!.name}: ${h!.trips.map((t) => `${t.date} ${t.finish} "${t.comment}"`).join(' | ')}`).join('\n')}

OUTPUT FORMAT - Return JSON only:
{
  "horsesWithTripTrouble": [
    { "programNumber": number, "horseName": "string", "issue": "specific trip problem", "maskedAbility": true|false }
  ]
}

Only include horses with clear trip trouble. Empty array if none found.`;
}

/**
 * Build prompt for Pace Scenario Bot
 *
 * Analyzes running styles, early speed figures, and post positions.
 * Focus: Pace dynamics and which styles benefit.
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string (400-600 tokens input, requests 50-150 tokens output)
 */
export function buildPaceScenarioPrompt(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): string {
  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Extract only pace-relevant data
  const paceData = rankedScores
    .map((score) => {
      const horse = race.horses.find((h) => h.programNumber === score.programNumber);
      if (!horse) return null;

      const lastPP = horse.pastPerformances[0];
      return {
        num: score.programNumber,
        name: score.horseName,
        post: horse.postPosition,
        style: horse.runningStyle || 'Unknown',
        earlySpeed: lastPP?.earlyPace1 ?? 'N/A',
      };
    })
    .filter(Boolean);

  const { paceScenario } = scoringResult.raceAnalysis;

  return `${PACE_CONTEXT}

---

You are a pace analyst determining which running styles win today.

YOUR ONE JOB: Determine which running styles are advantaged/disadvantaged by the likely pace scenario.

WHAT TO LOOK FOR:
- Count confirmed speed horses (E or E/P running style with early speed figures > 90)
- 0-1 speed horses = SLOW pace, advantages: E, E/P (lone speed scenario)
- 2 speed horses = MODERATE pace, advantages: E/P, S (stalkers sit the trip)
- 3+ speed horses = HOT pace, advantages: S, C (closers inherit the race)
- Post position matters: inside speed with outside speed = duel likely
- Flag lone speed exceptions explicitly - a single front runner with no pressure is a major advantage regardless of other factors

Algorithm's pace read: ${paceScenario.expectedPace}, Speed duel prob: ${Math.round(paceScenario.speedDuelProbability * 100)}%

HORSES:
${paceData.map((h) => `#${h!.num} ${h!.name} PP${h!.post} Style:${h!.style} EarlySpeed:${h!.earlySpeed}`).join('\n')}

OUTPUT FORMAT - Return JSON only:
{
  "advantagedStyles": ["E", "E/P", "S", "C"],
  "disadvantagedStyles": ["E", "E/P", "S", "C"],
  "paceProjection": "HOT" | "MODERATE" | "SLOW",
  "loneSpeedException": true|false,
  "speedDuelLikely": true|false
}`;
}

/**
 * Build prompt for Vulnerable Favorite Bot
 *
 * Analyzes the favorite's data against field context.
 * Focus: Is the chalk beatable today?
 *
 * @param race - Parsed race data
 * @param scoringResult - Algorithm scoring results
 * @returns Prompt string (400-600 tokens input, requests 50-150 tokens output)
 */
export function buildVulnerableFavoritePrompt(
  race: ParsedRace,
  scoringResult: RaceScoringResult
): string {
  const rankedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Find the favorite (lowest ML odds or #1 ranked if no ML)
  // Handle empty array case
  if (rankedScores.length === 0) {
    return `VULNERABLE FAVORITE ANALYSIS BOT

No horses available for analysis.

RESPOND WITH JSON ONLY:
{
  "isVulnerable": false,
  "reasons": [],
  "confidence": "LOW"
}`;
  }

  // We know rankedScores[0] exists because of the length check above
  const firstScore = rankedScores[0]!;
  const favorite = rankedScores.reduce((fav, curr) => {
    const favHorse = race.horses.find((h) => h.programNumber === fav.programNumber);
    const currHorse = race.horses.find((h) => h.programNumber === curr.programNumber);
    const favOdds = parseFloat(favHorse?.morningLineOdds?.replace('-', '.') || '99');
    const currOdds = parseFloat(currHorse?.morningLineOdds?.replace('-', '.') || '99');
    return currOdds < favOdds ? curr : fav;
  }, firstScore);

  const favHorse = race.horses.find((h) => h.programNumber === favorite.programNumber);
  const favPPs = favHorse?.pastPerformances.slice(0, 3) || [];

  // Field context
  const fieldSize = rankedScores.length;
  const topContenders = rankedScores.filter((s) => s.finalScore >= favorite.finalScore - 15).length;

  return `${VULNERABLE_FAVORITE_CONTEXT}

---

You are a favorite vulnerability analyst evaluating chalk horses.

YOUR ONE JOB: Evaluate ONLY whether the favorite can be beaten today - not who will beat them.

WHAT TO LOOK FOR - Check for vulnerability factors:
- Class rise: Moving up in class from last win
- Pace exposure: Front runner facing more speed than usual
- Form regression: Last race was peak effort (career best Beyer) that may not repeat
- Distance question: Trying new distance without pedigree support
- Connections cold: Trainer or jockey in losing streak
- Post position: Outside post for speed horse, inside post for closer

VULNERABILITY THRESHOLD:
- Require 2+ factors to flag as vulnerable
- Confidence HIGH = 3+ factors, MEDIUM = 2 factors, LOW = 1 factor (don't flag)

FAVORITE:
#${favorite.programNumber} ${favorite.horseName} (ML ${favHorse?.morningLineOdds || 'N/A'})
Algo Rank: ${favorite.rank}, Score: ${favorite.finalScore}
Style: ${favHorse?.runningStyle || 'Unknown'}, Post: ${favHorse?.postPosition}
Last 3: ${favPPs.map((pp) => `${pp.finishPosition}/${pp.fieldSize} Beyer:${pp.speedFigures.beyer ?? 'N/A'}`).join(', ')}
Positives: ${favorite.positiveFactors.slice(0, 3).join(', ') || 'None'}
Negatives: ${favorite.negativeFactors.slice(0, 3).join(', ') || 'None'}

FIELD CONTEXT:
${fieldSize} runners, ${topContenders} within 15 pts of favorite
Class: ${race.header.classification}

OUTPUT FORMAT - Return JSON only:
{
  "isVulnerable": true|false,
  "reasons": ["specific reason 1", "specific reason 2"],
  "confidence": "HIGH" | "MEDIUM" | "LOW"
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
