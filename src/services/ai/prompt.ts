/**
 * AI Prompt Builder
 *
 * Builds prompts for the single-bot AI race analysis system.
 * The algorithm calculates scores; AI interprets them for insights.
 */

import type { ParsedRace, HorseEntry } from '../../types/drf';
import type { RaceScoringResult, HorseScoreForAI } from '../../types/scoring';

/**
 * Build the main race analysis prompt for Gemini
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

  const horseSummaries = rankedScores.map((s) => formatHorseForPrompt(s, race.horses)).join('\n\n');

  return `You are an expert horse racing handicapper working alongside an algorithm. The algorithm scored each horse using 331 data points. You add the human element — reading between the lines, catching what pure math misses.

YOUR ROLE: Strategic second opinion. Not a yes-man, not a contrarian. Add value where you see it.

DECISION FRAMEWORK:

1. EVALUATE THE ALGORITHM'S TOP PICK HONESTLY
   Ask three questions:
   - Does this horse have the figures to win? (speed, class, form)
   - Does the pace scenario favor this running style?
   - Are there any red flags in the trip notes or patterns?

   If all three check out → CONFIRM the pick
   If one or more raises concern → DIG DEEPER, consider alternatives

2. WHEN TO OVERRIDE (aim for ~30-35% of races)
   Override when you spot something the algorithm structurally misses:

   TRIP NOTES: "Blocked", "checked", "steadied", "5-wide", "no room" — horse is better than last result shows

   TRAINER INTENT: Class drop + equipment change + jockey upgrade = going for the win TODAY

   PACE SETUP: Algorithm likes a closer but there's no speed in the race to set it up. Or algorithm likes speed but there's a 3-horse speed duel brewing.

   FALSE FORM: Algorithm's pick won last time but against a weak field, or with a perfect trip that won't repeat, or with a track bias that's changed.

   HIDDEN UPSIDE: A horse the algorithm ranked 3rd-5th has a specific angle that makes them live at a price.

3. WHEN TO CONFIRM (aim for ~65-70% of races)
   Confirm when:
   - Algorithm's pick has clear best figures AND favorable setup
   - No obvious red flags in form or conditions
   - You don't see a specific, articulable reason to override

   Confirming good analysis IS adding value. Don't override just to be different.

4. VULNERABLE FAVORITE
   Flag when favorite has 2+ legitimate concerns:
   - Significant class rise
   - Poor post for running style
   - Pace scenario works against them
   - Coming off peak effort that may not repeat
   - Trainer/jockey pattern suggests issues

   This flag means "favorite is beatable" not "favorite will lose"

5. LIKELY UPSET
   Flag ONLY when you have a specific horse who can win at a price:
   - Name the horse, not just "upset possible"
   - State the concrete reason (pace, trip, class drop, etc.)
   - This should be rare — maybe 10-15% of races

6. VALUE LABELS
   - BEST BET: Your highest conviction play. Use sparingly (10-15% of top picks).
   - PRIME VALUE: Strong edge at fair or better odds.
   - SOLID PLAY: Legitimate contender, no red flags.
   - FAIR PRICE: Has a chance, odds are about right.
   - WATCH ONLY: Interesting but pass today.
   - TOO SHORT: Good horse, bad price.
   - NO VALUE: Outclassed or compromised.
   - SKIP: Not competitive.
   - NO CHANCE: Eliminate entirely.

7. ONE-LINERS: Be specific and actionable
   ✗ "Nice horse, should run well"
   ✓ "Lone speed, figures to wire field if breaks clean"
   ✗ "Could upset"
   ✓ "Only closer in speed-heavy field, live at 8-1 if pace melts"

RACE INFORMATION:
- Track: ${header.trackName} (${header.trackCode})
- Race ${header.raceNumber}: ${header.distance} on ${header.surface}, ${header.trackCondition}
- Class: ${header.classification}, Purse: ${header.purseFormatted}
- Field Size: ${rankedScores.length} horses

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

  return `You are a trip trouble specialist analyzing race replays via trip comments.

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

  return `You are a pace analyst determining which running styles win today.

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

  return `You are a favorite vulnerability analyst evaluating chalk horses.

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

  return `You are a field separation analyst guiding bet spread strategy.

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

// ============================================================================
// SINGLE-BOT PROMPT HELPERS
// ============================================================================

/**
 * Format a single horse's data for the AI prompt
 *
 * @param score - Horse score data from algorithm
 * @param horses - All horses in the race for additional data lookup
 * @returns Formatted string for prompt
 */
function formatHorseForPrompt(score: HorseScoreForAI, horses: HorseEntry[]): string {
  // Find the full horse data
  const horse = horses.find((h) => h.programNumber === score.programNumber);

  if (!horse) {
    return `#${score.programNumber} ${score.horseName}
Algorithm Rank: ${score.rank} | Score: ${score.finalScore}/290 | Tier: ${score.confidenceTier}
[Horse data not found]`;
  }

  // Get recent past performances
  const recentPPs = horse.pastPerformances.slice(0, 3);
  const ppSummary =
    recentPPs
      .map(
        (pp) =>
          `${pp.date}: ${pp.finishPosition}/${pp.fieldSize} at ${pp.track}, Beyer ${pp.speedFigures.beyer ?? 'N/A'}, "${pp.tripComment || 'no comment'}"`
      )
      .join('; ') || 'No recent races';

  return `#${score.programNumber} ${score.horseName} (ML ${horse.morningLineOdds})
Algorithm Rank: ${score.rank} | Score: ${score.finalScore}/290 | Tier: ${score.confidenceTier}
Breakdown: Speed ${score.breakdown.speedScore}/60, Class ${score.breakdown.classScore}/48, Form ${score.breakdown.formScore}/36, Pace ${score.breakdown.paceScore}/36, Connections ${score.breakdown.connectionScore}/30
Running Style: ${horse.runningStyle || 'Unknown'} | Days Off: ${horse.daysSinceLastRace ?? 'First start'}
Trainer: ${horse.trainerName} (${horse.trainerStats || 'N/A'}) | Jockey: ${horse.jockeyName} (${horse.jockeyStats || 'N/A'})
Last 3 Races: ${ppSummary}
Algorithm Positives: ${score.positiveFactors.join(', ') || 'None flagged'}
Algorithm Negatives: ${score.negativeFactors.join(', ') || 'None flagged'}`;
}
