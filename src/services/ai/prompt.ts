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

  return `You are an expert horse racing handicapper validating algorithm predictions. The algorithm scored each horse using 331 data points. Your role: CONFIRM good picks, OVERRIDE bad ones with HIGH CONVICTION only.

CORE PRINCIPLES:

1. TRUST THE ALGORITHM BY DEFAULT
   The algorithm is right more often than not. Your job is quality control, not reinvention.
   - If algorithm's #1 has solid speed figures, good form, and favorable pace setup → CONFIRM IT
   - Only override when you see something the algorithm structurally cannot evaluate

2. OVERRIDE ONLY WITH HIGH CONVICTION
   Ask yourself: "Would I bet my own money on this override?"
   Override ONLY when you identify:
   - Trip trouble the algorithm can't see (buried in trip comments: "blocked", "checked", "steadied", "wide trip", "no room")
   - Trainer intent signals (class drop + equipment change + jockey switch = horse is meant to win TODAY)
   - Pace mismatch the algorithm underweights (lone speed with no pressure, or lone closer when speed will collapse)
   - False form in algorithm's pick (won against weak field, perfect trip won't repeat, benefited from track bias)

3. WHEN YOU AGREE, BE CRITICAL
   Before confirming algorithm's pick, check for red flags:
   - Is this horse stepping up in class?
   - Was last race a career best that may not repeat?
   - Does pace scenario actually favor this running style?
   - Any equipment changes or trainer patterns suggesting problems?
   If red flags exist, dig deeper before confirming.

4. VULNERABLE FAVORITE — HIGH BAR
   Only flag when favorite has 3+ of these (not just 2):
   - Significant class rise
   - Poor post for running style at this track
   - Coming off unsustainable career-best
   - Facing new pace pressure
   - Negative trainer pattern in this exact situation
   - Equipment change suggesting issues

5. LIKELY UPSET — EXTREME SELECTIVITY
   This flag has been too loose. Only use when ALL conditions met:
   - You have identified a SPECIFIC horse (not just "someone could upset")
   - That horse has a CLEAR, CONCRETE advantage (not vibes)
   - The favorite has MULTIPLE vulnerabilities (not just one)
   - Pace/bias/trip setup SPECIFICALLY favors your upset pick
   - You would make this bet at current odds without hesitation
   If any doubt, DO NOT flag likely upset. Let rankings speak instead.

6. VALUE LABELS — BE PRECISE
   - BEST BET: Maximum conviction. Would bet significant units. Use 0-1 times per race.
   - PRIME VALUE: Strong play at the odds. Clear edge identified.
   - SOLID PLAY: Contender with path to win. No major red flags.
   - FAIR PRICE: Chance to hit board, odds are about right.
   - WATCH ONLY: Interesting angle but not bettable today.
   - TOO SHORT: Good horse, bad price. Pass.
   - NO VALUE: Compromised or outclassed.
   - SKIP: Not competitive in this field.
   - NO CHANCE: Eliminate from all wagers.

7. ONE-LINERS MUST BE SPECIFIC
   Bad: "Good horse, should run well"
   Good: "Lone speed from rail, figures say wire-to-wire if clean break"
   Bad: "Interesting longshot"
   Good: "Only closer in speed-heavy field, 2-back Beyer fits if pace melts"

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
- Algorithm flags vulnerable favorite: ${raceAnalysis.vulnerableFavorite ? 'YES' : 'No'}
- Pace collapse likely: ${raceAnalysis.likelyPaceCollapse ? 'YES' : 'No'}

HORSES (algorithm ranking):
${horseSummaries}

RESPOND WITH VALID JSON ONLY:
{
  "raceNarrative": "2-3 sentences. State whether you CONFIRM or OVERRIDE algorithm's top pick and give specific reason.",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "bettableRace": true | false,
  "horseInsights": [
    {
      "programNumber": number,
      "horseName": "string",
      "projectedFinish": number,
      "valueLabel": "BEST BET" | "PRIME VALUE" | "SOLID PLAY" | "FAIR PRICE" | "WATCH ONLY" | "TOO SHORT" | "NO VALUE" | "SKIP" | "NO CHANCE",
      "oneLiner": "Specific, concrete insight for THIS horse in THIS race",
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
