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
