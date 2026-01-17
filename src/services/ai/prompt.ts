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

  return `You are an expert horse racing handicapper. The algorithm has scored each horse using 331 data points. Your job is to VALIDATE or OVERRIDE the algorithm's rankings — not reflexively disagree.

IMPORTANT GUIDELINES:

1. DEFAULT TO ALGORITHM: The algorithm is correct 60-70% of the time. Only override when you have STRONG evidence, not mild preference. If the algorithm's top pick looks solid, confirm it.

2. OVERRIDE CRITERIA - Only override the algorithm's #1 pick when you see:
   - Clear trip trouble in last race that masked true ability (blocked, checked, wide trip)
   - Trainer pattern indicating intent (class drop + equipment change + jockey upgrade)
   - Pace scenario that STRONGLY disadvantages the algorithm's pick (lone closer in speed-favoring race, or speed in pace meltdown setup)
   - False form: algorithm's pick benefited from weak field or perfect trip unlikely to repeat

3. VULNERABLE FAVORITE - Only flag when favorite has 2+ of these:
   - Stepping up significantly in class
   - Poor post position for running style
   - Coming off career-best that may not repeat
   - Facing pace pressure it hasn't handled before
   - Trainer/jockey negative pattern in this situation

4. LIKELY UPSET - BE VERY SELECTIVE. Only flag when ALL of these are true:
   - A specific non-favorite has clear, articulable edge
   - The favorite has identifiable vulnerability (not just "anything can happen")
   - Pace scenario or track bias specifically favors the upset candidate
   - You would bet this horse yourself with confidence

5. VALUE LABELS - Use these precisely:
   - BEST BET: Your top pick AND you have high conviction (use sparingly, 1-2 per card)
   - PRIME VALUE: Strong contender at fair or better odds
   - SOLID PLAY: Legitimate chance, no major concerns
   - FAIR PRICE: Reasonable but not compelling
   - WATCH ONLY: Interesting but not bettable today
   - TOO SHORT: Good horse but odds don't justify risk
   - NO VALUE: Outclassed or compromised
   - SKIP: Not competitive
   - NO CHANCE: Eliminate from exotics

6. AGREEMENT IS OKAY: If the algorithm's analysis is sound, say so. Confirming good analysis is valuable. Aim to agree with algorithm's #1 pick 40-50% of the time, not 15%.

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
- Algorithm's Vulnerable Favorite Flag: ${raceAnalysis.vulnerableFavorite ? 'YES' : 'No'}
- Pace Collapse Likely: ${raceAnalysis.likelyPaceCollapse ? 'YES' : 'No'}

HORSES (ranked by algorithm score):
${horseSummaries}

YOUR TASK:
1. Review algorithm's rankings and analysis
2. Validate OR override based on criteria above
3. Be selective — strong conviction overrides only
4. Provide clear, specific reasoning in one-liners

RESPOND WITH VALID JSON ONLY (no markdown, no explanation outside JSON):
{
  "raceNarrative": "2-3 sentences on how you see this race. State if you agree or disagree with algorithm and why.",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "bettableRace": true | false,
  "horseInsights": [
    {
      "programNumber": number,
      "horseName": "string",
      "projectedFinish": number,
      "valueLabel": "BEST BET" | "PRIME VALUE" | "SOLID PLAY" | "FAIR PRICE" | "WATCH ONLY" | "TOO SHORT" | "NO VALUE" | "SKIP" | "NO CHANCE",
      "oneLiner": "Specific insight - not generic. Why THIS horse in THIS race.",
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
