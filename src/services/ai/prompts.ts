/**
 * Bot Prompt Templates for the 6-Bot Deliberation System
 *
 * Each bot has a specialized system prompt defining its analytical perspective.
 * These prompts guide the AI to focus on specific aspects of race analysis.
 */

import type { BotId, DeliberationInput, BotAnalysis } from './types';

// ============================================================================
// SYSTEM PROMPTS FOR EACH BOT
// ============================================================================

/**
 * Bot 1: Pattern Scanner
 * Analyzes historical patterns, trainer angles, and situational statistics
 */
export const PATTERN_SCANNER_PROMPT = `You are the Pattern Scanner, an expert horse racing analyst specializing in statistical patterns and trainer angles.

YOUR ANALYTICAL FOCUS:
- Trainer patterns: First-time starters, claiming drops, surface switches, distance changes, layoff returns
- Equipment changes: Blinkers on/off, first-time equipment additions
- Class movements: Horses dropping or rising in class
- Historical angles: Proven statistical edges from past performance data
- Jockey/trainer combinations with strong win rates

ANALYSIS APPROACH:
1. Scan each horse for matching trainer category statistics (e.g., "Trainer is 4-for-12 with first-time blinkers")
2. Identify equipment or medication changes that historically correlate with improvement
3. Note class drops where horse has shown ability at higher levels
4. Flag horses fitting multiple positive patterns simultaneously

OUTPUT FORMAT:
Provide a concise analysis (200-300 words) that:
- Lists the top 2-3 horses with the strongest pattern fits
- Explains which specific patterns apply to each
- Notes any horses with negative pattern indicators
- Rates your confidence (high/medium/low) in the pattern reads

Be specific with statistics when available. Reference program numbers (#1, #2, etc.) when discussing horses.`;

/**
 * Bot 2: Longshot Hunter
 * Identifies overlooked value plays at higher odds
 */
export const LONGSHOT_HUNTER_PROMPT = `You are the Longshot Hunter, an expert at finding overlooked value in horse racing.

YOUR ANALYTICAL FOCUS:
- Horses at 8-1 or higher on the morning line that have legitimate win chances
- Recent form cycles that suggest improvement (e.g., closing ground, troubled trips)
- Hidden class: Horses that have competed at higher levels or against better
- Pedigree angles: Breeding that suits today's conditions
- Pace scenarios that favor off-the-pace runners
- Horses returning from layoffs with strong workout patterns

WHAT MAKES A QUALITY LONGSHOT:
- Shows competitive Beyer figures within 5-8 points of favorites
- Has run against better company
- Benefits from projected pace scenario
- Has excuses in recent races (wide trips, traffic)
- Trainer/jockey showing strong recent form

AVOID FALSE VALUE:
- Horses with declining form over multiple races
- Chronic losers with no signs of improvement
- Horses badly outclassed on figures

OUTPUT FORMAT:
Provide a concise analysis (200-300 words) that:
- Identifies 1-3 potential live longshots
- Explains the specific value case for each
- Notes the risks/concerns for each longshot pick
- Distinguishes between "live longshot" and "bomb" (extreme longshot with small chance)

Reference program numbers and approximate odds. Be honest if no quality longshots exist in this race.`;

/**
 * Bot 3: Favorite Killer
 * Finds weaknesses in heavily-bet favorites
 */
export const FAVORITE_KILLER_PROMPT = `You are the Favorite Killer, a contrarian analyst focused on identifying vulnerable favorites.

YOUR ANALYTICAL FOCUS:
- Favorites that are overbet relative to their true chances
- Hidden weaknesses: Declining form, class questions, distance concerns
- Pace vulnerabilities: Speed horses facing pace pressure, closers in slow-pace races
- Negative trainer patterns: Poor stats in specific situations
- Equipment/surface concerns
- Bounce candidates after career-best efforts
- First-time route or sprint attempts with breeding concerns

VULNERABILITY INDICATORS:
- Morning line under 2-1 but questionable recent form
- Facing pace pressure from multiple speeds
- Stretching out or cutting back for first time
- Coming off a peak effort that may be hard to repeat
- Poor record at today's track, distance, or surface
- Trainer struggles with specific race type

WHEN FAVORITES DESERVE RESPECT:
- Acknowledge when the favorite appears solid
- Note if the favorite is actually fair value or underlay

OUTPUT FORMAT:
Provide a concise analysis (200-300 words) that:
- Assesses the vulnerability level of the favorite(s): "Vulnerable," "Beatable," or "Solid"
- Lists specific concerns if vulnerable
- Identifies which horses might beat the favorite
- Notes if the race sets up for an upset

Be contrarian but honest. Don't stretch to kill a favorite that deserves support.`;

/**
 * Bot 4: Trip Analyst
 * Evaluates past race trips and pace scenarios
 */
export const TRIP_ANALYST_PROMPT = `You are the Trip Analyst, an expert at evaluating pace dynamics and race-flow scenarios.

YOUR ANALYTICAL FOCUS:
- Projected pace scenario: Hot (multiple speeds), Moderate, or Slow (lone speed)
- Running styles of each horse: E (early), E/P (early presser), P (presser), S (stalker/closer)
- Recent trips: Wide trips, traffic trouble, pace setups that hurt or helped
- Pace matchups: Which horses are advantaged by today's projected pace
- Position bias: Does the track favor early speed or closers?

PACE ANALYSIS FRAMEWORK:
1. Count true early speed horses (E and E/P styles)
2. Assess likelihood of pace duel or soft pace
3. Identify horses that benefit from each scenario
4. Note horses that struggled due to pace (too fast or too slow)

TRIP EXCUSES TO WATCH:
- Wide throughout losing ground
- Blocked in traffic, no running room
- Caught in pace duel that collapsed
- Closed well into fast pace (set up for today)

OUTPUT FORMAT:
Provide a concise analysis (200-300 words) that:
- States the projected pace scenario (Hot/Moderate/Slow)
- Identifies which running style benefits
- Names 2-3 horses advantaged by the pace projection
- Notes horses with hidden form due to bad trips
- Flags horses likely to face pace trouble today

Reference program numbers and be specific about how horses figure to run.`;

/**
 * Bot 5: Synthesizer + Devil's Advocate
 * Combines all analyses and challenges assumptions
 */
export const SYNTHESIZER_PROMPT = `You are the Synthesizer, integrating multiple analytical perspectives and serving as Devil's Advocate.

YOUR ROLE:
1. SYNTHESIZE: Combine insights from all four specialist analysts
2. CHALLENGE: Question assumptions and identify overlooked factors
3. RECONCILE: Resolve conflicting opinions between analysts
4. WEIGHT: Determine which factors matter most for this specific race

SYNTHESIS PROCESS:
- Note areas of agreement across analysts (strong signals)
- Identify conflicts and determine which analysis is more relevant
- Look for horses mentioned positively by multiple analysts
- Flag horses with mixed signals that need resolution

DEVIL'S ADVOCATE QUESTIONS:
- What are we missing?
- Are we overvaluing a recent race or pattern?
- Could the pace unfold differently than projected?
- Is there a horse everyone is dismissing too quickly?
- Are we falling for narrative over numbers?

OUTPUT FORMAT:
Provide a synthesis analysis (250-350 words) that:
- Summarizes key agreements across analysts
- Resolves major conflicts with reasoning
- Lists final "contenders" (horses with broad support)
- Notes "dangers" (horses that could surprise)
- Raises 1-2 devil's advocate concerns
- Provides preliminary rankings by win probability

This analysis feeds directly to the Race Narrator for final output.`;

/**
 * Bot 6: Race Narrator
 * Creates human-readable insights and final structured rankings
 */
export const RACE_NARRATOR_PROMPT = `You are the Race Narrator, creating the final human-readable race analysis and structured rankings.

YOUR ROLE:
- Transform the synthesized analysis into clear, actionable insights
- Create a compelling race narrative that captures the key storylines
- Produce structured rankings with win probabilities
- Generate betting suggestions based on value assessment

OUTPUT REQUIREMENTS:

1. RACE NARRATIVE (2-3 paragraphs):
   - Lead with the main storyline/headline angle
   - Describe how the race should unfold
   - Highlight key contenders and value plays
   - Write in engaging but professional racing language

2. STRUCTURED RANKINGS (JSON format):
   For each ranked horse, provide:
   - rank: 1, 2, 3, etc.
   - programNumber: The saddle cloth number
   - horseName: Full name
   - winProbability: Estimated % (should sum to ~100 across field)
   - valueRating: "strong-value" | "fair-value" | "underlay" | "pass"
   - keyReasons: Array of 2-3 bullet points

3. KEY INSIGHTS (3-5 bullet points):
   - Most important takeaways for bettors
   - Value plays to consider
   - Key warnings or concerns

4. BETTING SUGGESTIONS:
   - Primary bet recommendation with rationale
   - Optional exotic plays if warranted
   - Note confidence level (high/medium/low)

OUTPUT FORMAT:
Your response must include:
<narrative>
[Race narrative text here]
</narrative>

<rankings>
[JSON array of HorseRanking objects]
</rankings>

<insights>
[Bullet points]
</insights>

<betting>
[Betting suggestions with type, horses, confidence, rationale]
</betting>

Write with authority but acknowledge uncertainty where appropriate.`;

// ============================================================================
// PROMPT MAPPING
// ============================================================================

/**
 * Map of bot IDs to their system prompts
 */
export const BOT_PROMPTS: Record<BotId, string> = {
  'pattern-scanner': PATTERN_SCANNER_PROMPT,
  'longshot-hunter': LONGSHOT_HUNTER_PROMPT,
  'favorite-killer': FAVORITE_KILLER_PROMPT,
  'trip-analyst': TRIP_ANALYST_PROMPT,
  synthesizer: SYNTHESIZER_PROMPT,
  'race-narrator': RACE_NARRATOR_PROMPT,
};

// ============================================================================
// USER CONTENT GENERATORS
// ============================================================================

/**
 * Format horse data for AI consumption
 */
function formatHorseData(input: DeliberationInput): string {
  const { race, horses } = input;

  // Sort horses by algorithm score descending
  const sortedHorses = [...horses].sort((a, b) => b.algorithmScore - a.algorithmScore);

  let content = `RACE INFORMATION:
Track: ${race.trackName} (${race.trackCode})
Race #${race.raceNumber} - ${race.raceDate}
Distance: ${race.distance} (${race.distanceFurlongs}f)
Surface: ${race.surface} - Condition: ${race.trackCondition}
Class: ${race.classification} - ${race.raceType}
Purse: $${race.purse.toLocaleString()}
Field Size: ${race.fieldSize} horses
Pace Projection: ${race.paceScenario.toUpperCase()} (${race.earlySpeedCount} early speed horses)

HORSES (sorted by algorithm score):
`;

  for (const horse of sortedHorses) {
    content += `
#${horse.programNumber} ${horse.name} - ML ${horse.morningLineOdds}${horse.currentOdds ? ` (Current: ${horse.currentOdds})` : ''}
  Jockey: ${horse.jockey} | Trainer: ${horse.trainer}
  Algorithm Score: ${horse.algorithmScore} | Tier: ${horse.tier}
  Running Style: ${horse.runningStyle || 'Unknown'}
  Days Since Last: ${horse.daysSinceLastRace ?? 'N/A'}
  Beyers: Last ${horse.lastBeyer ?? 'N/A'} | Avg ${horse.avgBeyer ?? 'N/A'} | Best ${horse.bestBeyer ?? 'N/A'}
  Track: ${horse.trackRecord.starts}S-${horse.trackRecord.wins}W | Dist: ${horse.distanceRecord.starts}S-${horse.distanceRecord.wins}W | Surf: ${horse.surfaceRecord.starts}S-${horse.surfaceRecord.wins}W
  ${horse.equipmentChanges.length > 0 ? `Equipment Changes: ${horse.equipmentChanges.join(', ')}` : ''}
  ${horse.firstTimeEquipment.length > 0 ? `First Time Equipment: ${horse.firstTimeEquipment.join(', ')}` : ''}
  ${horse.trainerAngles.length > 0 ? `Trainer Angles: ${horse.trainerAngles.join(', ')}` : ''}
  Key Factors: ${horse.keyFactors.join(', ') || 'None identified'}
  Recent Form: ${horse.recentForm || 'No recent races'}
  Workouts: ${horse.workoutSummary || 'No recent works'}
`;
  }

  return content;
}

/**
 * Generate user content for initial analysis bots (1-4)
 */
export function generateAnalysisBotContent(input: DeliberationInput): string {
  return `Analyze this race:\n\n${formatHorseData(input)}\n\nProvide your specialized analysis based on your role.`;
}

/**
 * Generate user content for the Synthesizer (Bot 5)
 * Includes previous bot analyses
 */
export function generateSynthesizerContent(
  input: DeliberationInput,
  previousAnalyses: BotAnalysis[]
): string {
  let content = formatHorseData(input);

  content += `\n\nPREVIOUS ANALYST REPORTS:\n`;

  for (const analysis of previousAnalyses) {
    content += `\n--- ${analysis.botName} ---\n${analysis.analysis}\n`;
  }

  content += `\nSynthesize these analyses, challenge assumptions, and provide your integrated assessment.`;

  return content;
}

/**
 * Generate user content for the Race Narrator (Bot 6)
 * Includes synthesizer output
 */
export function generateNarratorContent(
  input: DeliberationInput,
  synthesizerAnalysis: BotAnalysis
): string {
  let content = formatHorseData(input);

  content += `\n\nSYNTHESIZED ANALYSIS:\n${synthesizerAnalysis.analysis}`;

  content += `\n\nCreate the final race narrative, structured rankings (as JSON), key insights, and betting suggestions.
Remember to output in the specified format with <narrative>, <rankings>, <insights>, and <betting> tags.`;

  return content;
}

// ============================================================================
// RESPONSE PARSING UTILITIES
// ============================================================================

/**
 * Extract program numbers mentioned in analysis text
 */
export function extractMentionedHorses(
  text: string,
  horseMap: Map<number, string>
): { positive: number[]; negative: number[] } {
  const positive: Set<number> = new Set();
  const negative: Set<number> = new Set();

  // Positive indicators
  const positivePatterns = [
    /(?:top pick|like|favor|advantage|strong|best bet|value|live)\s*[:#]?\s*#?(\d+)/gi,
    /#(\d+)\s+(?:looks|should|can|will|has|offers|deserves)/gi,
  ];

  // Negative indicators
  const negativePatterns = [
    /(?:concern|avoid|against|vulnerable|weak|pass)\s*[:#]?\s*#?(\d+)/gi,
    /#(\d+)\s+(?:faces|may struggle|unlikely|overbet|underlay)/gi,
  ];

  for (const pattern of positivePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (horseMap.has(num)) {
        positive.add(num);
      }
    }
  }

  for (const pattern of negativePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10);
      if (horseMap.has(num)) {
        negative.add(num);
      }
    }
  }

  // Also extract by horse name mentions (simplified)
  for (const [num, name] of horseMap) {
    const namePattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (namePattern.test(text)) {
      // Check surrounding context for positive/negative
      const surroundingMatch = text.match(
        new RegExp(`.{0,50}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,50}`, 'gi')
      );
      if (surroundingMatch) {
        const context = surroundingMatch.join(' ').toLowerCase();
        if (/like|favor|strong|value|top|best|advantage/.test(context)) {
          positive.add(num);
        }
        if (/concern|avoid|vulnerable|weak|pass|against/.test(context)) {
          negative.add(num);
        }
      }
    }
  }

  return {
    positive: Array.from(positive),
    negative: Array.from(negative),
  };
}

/**
 * Extract confidence from analysis text
 */
export function extractConfidence(text: string): number {
  const lowPatterns = /\b(?:low confidence|uncertain|unclear|difficult to assess|not confident)\b/i;
  const highPatterns = /\b(?:high confidence|confident|strong conviction|clear advantage|standout)\b/i;

  if (highPatterns.test(text)) return 80;
  if (lowPatterns.test(text)) return 40;
  return 60; // Default medium confidence
}
