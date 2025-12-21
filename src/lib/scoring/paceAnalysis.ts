/**
 * Pace Scenario Detection System
 *
 * Comprehensive analysis of pace scenarios and running styles based on DRF past performances.
 *
 * Running Style Classification:
 * - E (Early Speed): Leads or contests early, position at first call ≤ 3
 * - P (Presser): Stalks pace, sits 3-5 lengths off early
 * - C (Closer): Mid-pack or worse early, makes late run
 * - S (Sustained Speed): Maintains position throughout
 *
 * Pace Pressure Index (PPI):
 * - Soft Pace: PPI < 20 (0-1 speed horses in 8+ horse field)
 * - Moderate Pace: PPI 20-35 (2-3 speed horses)
 * - Contested Pace: PPI 35-50 (3-4 speed horses)
 * - Speed Duel: PPI > 50 (4+ speed horses)
 */

import type { HorseEntry, PastPerformance } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

/** Core running style classification */
export type RunningStyleCode = 'E' | 'P' | 'C' | 'S' | 'U';

/** Detailed running style names */
export const RUNNING_STYLE_NAMES: Record<RunningStyleCode, string> = {
  E: 'Early Speed',
  P: 'Presser',
  C: 'Closer',
  S: 'Sustained Speed',
  U: 'Unknown',
};

/** Pace scenario classification */
export type PaceScenarioType = 'soft' | 'moderate' | 'contested' | 'speed_duel' | 'unknown';

/** Pace scenario display labels */
export const PACE_SCENARIO_LABELS: Record<PaceScenarioType, string> = {
  soft: 'Soft (Lone Speed)',
  moderate: 'Moderate',
  contested: 'Contested',
  speed_duel: 'Speed Duel',
  unknown: 'Unknown',
};

/** Pace scenario colors for UI */
export const PACE_SCENARIO_COLORS: Record<PaceScenarioType, string> = {
  soft: '#22c55e', // Green
  moderate: '#eab308', // Yellow
  contested: '#f97316', // Orange
  speed_duel: '#ef4444', // Red
  unknown: '#888888', // Gray
};

/** Running style evidence from past performance */
export interface RunningStyleEvidence {
  raceDate: string;
  track: string;
  firstCallPosition: number;
  fieldSize: number;
  finishPosition: number;
  styleInRace: RunningStyleCode;
  wasOnLead: boolean;
  lengthsBehindAtFirstCall: number | null;
}

/** Detailed running style profile */
export interface RunningStyleProfile {
  /** Primary running style */
  style: RunningStyleCode;
  /** Style display name */
  styleName: string;
  /** Confidence in style classification (0-100) */
  confidence: number;
  /** Evidence from past races */
  evidence: RunningStyleEvidence[];
  /** Summary statistics */
  stats: {
    totalRaces: number;
    timesOnLead: number;
    timesInTop3Early: number;
    avgFirstCallPosition: number;
    avgLengthsBehindEarly: number;
  };
  /** Description for display */
  description: string;
}

/** Pace scenario analysis for the entire field */
export interface PaceScenarioAnalysis {
  /** Pace scenario type */
  scenario: PaceScenarioType;
  /** Display label */
  label: string;
  /** Color for UI */
  color: string;
  /** Pace Pressure Index (0-100) */
  ppi: number;
  /** Breakdown of running styles */
  styleBreakdown: {
    earlySpeed: number[]; // Program numbers
    pressers: number[];
    closers: number[];
    sustained: number[];
    unknown: number[];
  };
  /** Field size (active horses only) */
  fieldSize: number;
  /** Expected pace description */
  expectedPace: string;
  /** Detailed scenario description */
  description: string;
}

/** Tactical advantage result */
export interface TacticalAdvantage {
  /** Points earned (0-25) */
  points: number;
  /** Advantage level */
  level: 'excellent' | 'good' | 'neutral' | 'poor' | 'terrible';
  /** Description of the tactical fit */
  fit: string;
  /** Reasoning for display */
  reasoning: string;
}

/** Complete pace analysis result */
export interface PaceAnalysisResult {
  /** Horse's running style profile */
  profile: RunningStyleProfile;
  /** Field pace scenario */
  scenario: PaceScenarioAnalysis;
  /** Tactical advantage calculation */
  tactical: TacticalAdvantage;
  /** Total pace score (used by scoring system) */
  totalScore: number;
}

// ============================================================================
// RUNNING STYLE DETECTION
// ============================================================================

/**
 * Analyze a single past performance to determine running style in that race
 */
function analyzeRaceRunningStyle(pp: PastPerformance): RunningStyleEvidence {
  const firstCallPosition =
    pp.runningLine.quarterMile ?? pp.runningLine.halfMile ?? pp.runningLine.start ?? pp.fieldSize;

  const lengthsBehindAtFirstCall =
    pp.runningLine.quarterMileLengths ?? pp.runningLine.halfMileLengths ?? null;

  const wasOnLead = firstCallPosition === 1;
  const fieldSize = pp.fieldSize || 10;

  // Determine style based on relative position
  let styleInRace: RunningStyleCode;
  const relativePosition = firstCallPosition / fieldSize;

  if (firstCallPosition <= 2 || relativePosition <= 0.2) {
    styleInRace = 'E'; // Early Speed - on or near lead
  } else if (firstCallPosition <= 4 || relativePosition <= 0.4) {
    // Check if maintaining position = Sustained, else Presser
    const stretchPosition = pp.runningLine.stretch ?? pp.finishPosition;
    const positionDiff = Math.abs(firstCallPosition - stretchPosition);
    if (positionDiff <= 1) {
      styleInRace = 'S'; // Sustained - maintained position
    } else {
      styleInRace = 'P'; // Presser - stalking
    }
  } else if (relativePosition >= 0.6) {
    styleInRace = 'C'; // Closer - back of pack
  } else {
    // Mid-pack - determine by late move
    const finishPosition = pp.finishPosition;
    if (finishPosition < firstCallPosition - 2) {
      styleInRace = 'C'; // Made a closing run
    } else if (finishPosition <= firstCallPosition + 1) {
      styleInRace = 'S'; // Sustained position
    } else {
      styleInRace = 'P'; // Presser
    }
  }

  return {
    raceDate: pp.date,
    track: pp.track,
    firstCallPosition,
    fieldSize,
    finishPosition: pp.finishPosition,
    styleInRace,
    wasOnLead,
    lengthsBehindAtFirstCall,
  };
}

/**
 * Parse running style from past performances
 * Analyzes last 3 races to determine dominant running style
 */
export function parseRunningStyle(horse: HorseEntry): RunningStyleProfile {
  const pastPerfs = horse.pastPerformances.slice(0, 10); // Up to last 10 for evidence

  if (pastPerfs.length === 0) {
    return {
      style: 'U',
      styleName: RUNNING_STYLE_NAMES['U'],
      confidence: 0,
      evidence: [],
      stats: {
        totalRaces: 0,
        timesOnLead: 0,
        timesInTop3Early: 0,
        avgFirstCallPosition: 0,
        avgLengthsBehindEarly: 0,
      },
      description: 'First-time starter or no past performances available',
    };
  }

  // Analyze each race
  const evidence = pastPerfs.map((pp) => analyzeRaceRunningStyle(pp));

  // Focus on last 3 races for dominant style
  const recentEvidence = evidence.slice(0, 3);

  // Count styles in recent races
  const styleCounts: Record<RunningStyleCode, number> = {
    E: 0,
    P: 0,
    C: 0,
    S: 0,
    U: 0,
  };

  for (const ev of recentEvidence) {
    styleCounts[ev.styleInRace]++;
  }

  // Determine dominant style
  let dominantStyle: RunningStyleCode = 'U';
  let maxCount = 0;

  for (const [style, count] of Object.entries(styleCounts) as [RunningStyleCode, number][]) {
    if (style !== 'U' && count > maxCount) {
      maxCount = count;
      dominantStyle = style;
    }
  }

  // If no clear dominant style, use most recent race
  if (maxCount === 0 && evidence.length > 0) {
    const firstEvidence = evidence[0];
    if (firstEvidence) {
      dominantStyle = firstEvidence.styleInRace;
    }
  }

  // Calculate stats
  const timesOnLead = evidence.filter((e) => e.wasOnLead).length;
  const timesInTop3Early = evidence.filter((e) => e.firstCallPosition <= 3).length;
  const avgFirstCallPosition =
    evidence.reduce((sum, e) => sum + e.firstCallPosition, 0) / evidence.length;
  const lengthsData = evidence.filter((e) => e.lengthsBehindAtFirstCall !== null);
  const avgLengthsBehindEarly =
    lengthsData.length > 0
      ? lengthsData.reduce((sum, e) => sum + (e.lengthsBehindAtFirstCall ?? 0), 0) /
        lengthsData.length
      : 0;

  // Calculate confidence
  const confidence = Math.min(
    100,
    Math.round(
      (recentEvidence.length / 3) * 50 + // More races = more confidence
        (maxCount / recentEvidence.length) * 50 // Consistency = more confidence
    )
  );

  // Generate description
  const description = generateStyleDescription(
    dominantStyle,
    timesOnLead,
    timesInTop3Early,
    evidence.length
  );

  return {
    style: dominantStyle,
    styleName: RUNNING_STYLE_NAMES[dominantStyle],
    confidence,
    evidence,
    stats: {
      totalRaces: evidence.length,
      timesOnLead,
      timesInTop3Early,
      avgFirstCallPosition: Math.round(avgFirstCallPosition * 10) / 10,
      avgLengthsBehindEarly: Math.round(avgLengthsBehindEarly * 10) / 10,
    },
    description,
  };
}

/**
 * Generate a human-readable description of running style
 */
function generateStyleDescription(
  style: RunningStyleCode,
  timesOnLead: number,
  timesInTop3Early: number,
  totalRaces: number
): string {
  if (totalRaces === 0) return 'No race history available';

  const leadPct = Math.round((timesOnLead / totalRaces) * 100);
  const top3Pct = Math.round((timesInTop3Early / totalRaces) * 100);

  switch (style) {
    case 'E':
      return `Early Speed - Led in ${timesOnLead} of ${totalRaces} starts (${leadPct}%)`;
    case 'P':
      return `Presser - In top 3 early in ${timesInTop3Early} of ${totalRaces} starts (${top3Pct}%)`;
    case 'C':
      return `Closer - Makes late run, typically mid-pack or worse early`;
    case 'S':
      return `Sustained Speed - Maintains position throughout the race`;
    default:
      return `Unknown running style - insufficient data`;
  }
}

// ============================================================================
// PACE PRESSURE INDEX (PPI) CALCULATION
// ============================================================================

/**
 * Calculate Pace Pressure Index for a race
 * PPI = (Early Speed Count / Field Size) × 100
 */
export function calculatePPI(earlySpeedCount: number, fieldSize: number): number {
  if (fieldSize === 0) return 0;
  return Math.round((earlySpeedCount / fieldSize) * 100);
}

/**
 * Determine pace scenario from PPI
 */
export function getPaceScenarioFromPPI(ppi: number): PaceScenarioType {
  if (ppi < 20) return 'soft';
  if (ppi <= 35) return 'moderate';
  if (ppi <= 50) return 'contested';
  return 'speed_duel';
}

/**
 * Analyze the pace scenario for an entire field
 */
export function analyzePaceScenario(horses: HorseEntry[]): PaceScenarioAnalysis {
  // Filter out scratched horses
  const activeHorses = horses.filter((h) => !h.isScratched);
  const fieldSize = activeHorses.length;

  if (fieldSize === 0) {
    return {
      scenario: 'unknown',
      label: PACE_SCENARIO_LABELS['unknown'],
      color: PACE_SCENARIO_COLORS['unknown'],
      ppi: 0,
      styleBreakdown: {
        earlySpeed: [],
        pressers: [],
        closers: [],
        sustained: [],
        unknown: [],
      },
      fieldSize: 0,
      expectedPace: 'Unknown',
      description: 'No active horses in field',
    };
  }

  // Analyze each horse's running style
  const styleBreakdown: PaceScenarioAnalysis['styleBreakdown'] = {
    earlySpeed: [],
    pressers: [],
    closers: [],
    sustained: [],
    unknown: [],
  };

  for (const horse of activeHorses) {
    const profile = parseRunningStyle(horse);
    const progNum = horse.programNumber;

    switch (profile.style) {
      case 'E':
        styleBreakdown.earlySpeed.push(progNum);
        break;
      case 'P':
        styleBreakdown.pressers.push(progNum);
        break;
      case 'C':
        styleBreakdown.closers.push(progNum);
        break;
      case 'S':
        styleBreakdown.sustained.push(progNum);
        break;
      default:
        styleBreakdown.unknown.push(progNum);
    }
  }

  // Calculate PPI
  const earlySpeedCount = styleBreakdown.earlySpeed.length;
  const ppi = calculatePPI(earlySpeedCount, fieldSize);

  // Determine scenario
  const scenario = getPaceScenarioFromPPI(ppi);
  const label = PACE_SCENARIO_LABELS[scenario];
  const color = PACE_SCENARIO_COLORS[scenario];

  // Generate expected pace and description
  const { expectedPace, description } = generatePaceDescription(
    scenario,
    earlySpeedCount,
    styleBreakdown.pressers.length,
    styleBreakdown.closers.length,
    fieldSize
  );

  return {
    scenario,
    label,
    color,
    ppi,
    styleBreakdown,
    fieldSize,
    expectedPace,
    description,
  };
}

/**
 * Generate pace description based on scenario
 */
function generatePaceDescription(
  scenario: PaceScenarioType,
  earlyCount: number,
  presserCount: number,
  _closerCount: number,
  fieldSize: number
): { expectedPace: string; description: string } {
  switch (scenario) {
    case 'soft':
      if (earlyCount === 0) {
        return {
          expectedPace: 'Very Slow',
          description: `No confirmed early speed - expect very slow pace. Closers may struggle.`,
        };
      }
      return {
        expectedPace: 'Slow',
        description: `Only ${earlyCount} speed horse(s) in ${fieldSize}-horse field. Lone speed could steal on easy lead.`,
      };

    case 'moderate':
      return {
        expectedPace: 'Honest',
        description: `${earlyCount} speed, ${presserCount} pressers - balanced pace expected. Tactical race likely.`,
      };

    case 'contested':
      return {
        expectedPace: 'Fast',
        description: `${earlyCount} speed horses likely to pressure each other. Good setup for closers.`,
      };

    case 'speed_duel':
      return {
        expectedPace: 'Very Fast',
        description: `${earlyCount} speed horses will battle early - pace suicide likely. Strong closer advantage.`,
      };

    default:
      return {
        expectedPace: 'Unknown',
        description: 'Unable to analyze pace scenario',
      };
  }
}

// ============================================================================
// TACTICAL ADVANTAGE CALCULATION
// ============================================================================

/**
 * Tactical advantage points based on pace scenario
 *
 * Soft Pace (lone speed):
 * - Early Speed: +25 pts (wire-to-wire advantage)
 * - Presser: +15 pts (perfect stalking position)
 * - Closer: +5 pts (pace too slow to set up)
 *
 * Moderate Pace (balanced):
 * - Early Speed: +12 pts
 * - Presser: +20 pts (ideal scenario)
 * - Closer: +15 pts
 *
 * Contested Pace (speed duel likely):
 * - Early Speed: +5 pts (will tire from battle)
 * - Presser: +25 pts (perfect setup)
 * - Closer: +20 pts (strong late run setup)
 *
 * Speed Duel (multiple speed):
 * - Early Speed: -5 pts (pace suicide) -> 0 minimum
 * - Presser: +15 pts
 * - Closer: +25 pts (maximize advantage)
 */
export function calculateTacticalAdvantage(
  style: RunningStyleCode,
  scenario: PaceScenarioType
): TacticalAdvantage {
  // Point matrix
  const advantageMatrix: Record<PaceScenarioType, Record<RunningStyleCode, number>> = {
    soft: { E: 25, P: 15, C: 5, S: 18, U: 10 },
    moderate: { E: 12, P: 20, C: 15, S: 15, U: 12 },
    contested: { E: 5, P: 25, C: 20, S: 12, U: 12 },
    speed_duel: { E: 0, P: 15, C: 25, S: 8, U: 10 },
    unknown: { E: 12, P: 12, C: 12, S: 12, U: 10 },
  };

  const points = Math.max(0, advantageMatrix[scenario][style]);

  // Determine advantage level
  let level: TacticalAdvantage['level'];
  if (points >= 23) level = 'excellent';
  else if (points >= 18) level = 'good';
  else if (points >= 12) level = 'neutral';
  else if (points >= 5) level = 'poor';
  else level = 'terrible';

  // Generate fit and reasoning
  const { fit, reasoning } = generateTacticalReasoning(style, scenario, points);

  return {
    points,
    level,
    fit,
    reasoning,
  };
}

/**
 * Generate tactical fit description
 */
function generateTacticalReasoning(
  style: RunningStyleCode,
  scenario: PaceScenarioType,
  points: number
): { fit: string; reasoning: string } {
  const styleName = RUNNING_STYLE_NAMES[style];

  // Specific scenario/style combinations
  if (style === 'E' && scenario === 'soft') {
    return {
      fit: 'Excellent fit - lone speed in soft pace',
      reasoning: `${styleName} should have clear lead with minimal pressure. Wire-to-wire opportunity.`,
    };
  }

  if (style === 'E' && scenario === 'speed_duel') {
    return {
      fit: 'Poor fit - speed in speed duel',
      reasoning: `${styleName} faces pace suicide - multiple speed horses will burn each other out.`,
    };
  }

  if (style === 'C' && scenario === 'speed_duel') {
    return {
      fit: 'Excellent fit - closer in speed duel',
      reasoning: `${styleName} benefits from fast early pace. Speed horses will tire, setting up strong close.`,
    };
  }

  if (style === 'C' && scenario === 'soft') {
    return {
      fit: 'Poor fit - closer in soft pace',
      reasoning: `${styleName} needs pace to close into. Slow early fractions will make it difficult to rally.`,
    };
  }

  if (style === 'P' && (scenario === 'contested' || scenario === 'moderate')) {
    return {
      fit: 'Excellent fit - presser in balanced pace',
      reasoning: `${styleName} can stalk the pace and pounce when speed tires. Ideal tactical position.`,
    };
  }

  if (style === 'S') {
    return {
      fit: points >= 15 ? 'Good fit' : 'Neutral fit',
      reasoning: `${styleName} maintains position throughout. Can adapt to most pace scenarios.`,
    };
  }

  // Default reasoning
  if (points >= 20) {
    return {
      fit: 'Good fit',
      reasoning: `${styleName} should benefit from the ${PACE_SCENARIO_LABELS[scenario]} pace scenario.`,
    };
  } else if (points >= 12) {
    return {
      fit: 'Neutral fit',
      reasoning: `${styleName} has no particular advantage or disadvantage in this pace scenario.`,
    };
  } else {
    return {
      fit: 'Poor fit',
      reasoning: `${styleName} may struggle in this ${PACE_SCENARIO_LABELS[scenario]} pace scenario.`,
    };
  }
}

// ============================================================================
// COMPLETE PACE ANALYSIS
// ============================================================================

/**
 * Perform complete pace analysis for a horse within a race context
 */
export function analyzePaceForHorse(
  horse: HorseEntry,
  allHorses: HorseEntry[],
  preCalculatedScenario?: PaceScenarioAnalysis
): PaceAnalysisResult {
  // Get horse's running style profile
  const profile = parseRunningStyle(horse);

  // Get field pace scenario (use pre-calculated if available)
  const scenario = preCalculatedScenario ?? analyzePaceScenario(allHorses);

  // Calculate tactical advantage
  const tactical = calculateTacticalAdvantage(profile.style, scenario.scenario);

  // Calculate total pace score
  // Base score from tactical advantage (0-25)
  // Additional points from confidence (0-5)
  // Additional points from evidence quality (0-10)
  const confidenceBonus = Math.round((profile.confidence / 100) * 5);
  const evidenceBonus = Math.min(10, Math.round((profile.stats.totalRaces / 5) * 10));

  const totalScore = Math.min(40, tactical.points + confidenceBonus + evidenceBonus);

  return {
    profile,
    scenario,
    tactical,
    totalScore,
  };
}

/**
 * Analyze pace for all horses in a race efficiently
 * Pre-calculates scenario once for performance
 */
export function analyzeRacePace(horses: HorseEntry[]): Map<number, PaceAnalysisResult> {
  // Pre-calculate scenario once
  const scenario = analyzePaceScenario(horses);

  const results = new Map<number, PaceAnalysisResult>();

  for (const horse of horses) {
    results.set(horse.programNumber, analyzePaceForHorse(horse, horses, scenario));
  }

  return results;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format running style breakdown for display
 * Returns: "E: #3, #7 | P: #2, #5, #8 | C: #1, #4, #6"
 */
export function formatStyleBreakdown(breakdown: PaceScenarioAnalysis['styleBreakdown']): string {
  const parts: string[] = [];

  if (breakdown.earlySpeed.length > 0) {
    parts.push(`E: ${breakdown.earlySpeed.map((n) => `#${n}`).join(', ')}`);
  }
  if (breakdown.pressers.length > 0) {
    parts.push(`P: ${breakdown.pressers.map((n) => `#${n}`).join(', ')}`);
  }
  if (breakdown.closers.length > 0) {
    parts.push(`C: ${breakdown.closers.map((n) => `#${n}`).join(', ')}`);
  }
  if (breakdown.sustained.length > 0) {
    parts.push(`S: ${breakdown.sustained.map((n) => `#${n}`).join(', ')}`);
  }

  return parts.join(' | ') || 'No style data available';
}

/**
 * Get compact pace scenario summary for card display
 */
export function getPaceScenarioSummary(scenario: PaceScenarioAnalysis): {
  label: string;
  color: string;
  ppi: number;
  shortDescription: string;
} {
  return {
    label: scenario.label,
    color: scenario.color,
    ppi: scenario.ppi,
    shortDescription: scenario.expectedPace,
  };
}

/**
 * Get running style badge display info
 */
export function getRunningStyleBadge(profile: RunningStyleProfile): {
  code: RunningStyleCode;
  name: string;
  color: string;
  confidence: number;
} {
  // Color based on style
  const styleColors: Record<RunningStyleCode, string> = {
    E: '#ef4444', // Red for early speed
    P: '#f97316', // Orange for presser
    C: '#3b82f6', // Blue for closer
    S: '#8b5cf6', // Purple for sustained
    U: '#888888', // Gray for unknown
  };

  return {
    code: profile.style,
    name: profile.styleName,
    color: styleColors[profile.style],
    confidence: profile.confidence,
  };
}
