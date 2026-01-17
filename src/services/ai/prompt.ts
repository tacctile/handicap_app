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

  return `You are an expert horse racing handicapper analyzing a race. The algorithm has already scored each horse. Your job is to interpret these scores, apply judgment the algorithm cannot (trip trouble, trainer intent, false form), and produce final rankings with insights.

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
- Vulnerable Favorite: ${raceAnalysis.vulnerableFavorite ? 'YES' : 'No'}
- Pace Collapse Likely: ${raceAnalysis.likelyPaceCollapse ? 'YES' : 'No'}

HORSES (ranked by algorithm score):
${horseSummaries}

INSTRUCTIONS:
1. Review each horse's algorithm scores and factors
2. Apply your judgment — look for:
   - False favorites (high score but red flags)
   - Live longshots (lower score but overlooked positives)
   - Trip trouble in past performances that algorithm may underweight
   - Trainer patterns suggesting intent (class drops, equipment changes)
   - Pace scenarios that favor certain running styles
3. Produce final rankings that may differ from algorithm order

RESPOND WITH VALID JSON ONLY (no markdown, no explanation outside JSON):
{
  "raceNarrative": "2-3 sentence summary of how you see this race unfolding",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "bettableRace": true | false,
  "horseInsights": [
    {
      "programNumber": number,
      "horseName": "string",
      "projectedFinish": number (1 = winner),
      "valueLabel": "BEST BET" | "PRIME VALUE" | "SOLID PLAY" | "FAIR PRICE" | "WATCH ONLY" | "TOO SHORT" | "NO VALUE" | "SKIP" | "NO CHANCE",
      "oneLiner": "One sentence insight a bettor needs to know",
      "keyStrength": "Primary positive factor" | null,
      "keyWeakness": "Primary concern" | null,
      "isContender": true | false,
      "avoidFlag": true | false
    }
  ],
  "topPick": number (program number) | null,
  "valuePlay": number (program number, only if different from topPick) | null,
  "avoidList": [array of program numbers],
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
