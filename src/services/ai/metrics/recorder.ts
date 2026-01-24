/**
 * AI Decision Recorder
 *
 * Records AI decisions from AIRaceAnalysis for metrics tracking.
 * Extracts data from AI analysis output and builds AIDecisionRecord.
 */

import type { AIRaceAnalysis, MultiBotRawResults } from '../types';
import type { RaceScoringResult } from '../../../types/scoring';
import type { ParsedRace } from '../../../types/drf';
import type { AIDecisionRecord } from './types';
import { saveDecisionRecord } from './storage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Race header information for recording
 */
export interface RaceHeader {
  trackCode: string;
  raceNumber: number;
  raceDate: string;
}

/**
 * Options for recording AI decisions
 */
export interface RecordOptions {
  /** Skip saving to storage (for testing) */
  skipSave?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract trip trouble horses from analysis
 */
function extractTripTroubleHorses(
  analysis: AIRaceAnalysis,
  rawResults?: MultiBotRawResults
): number[] {
  // First check raw bot results if available
  if (rawResults?.tripTrouble?.horsesWithTripTrouble) {
    return rawResults.tripTrouble.horsesWithTripTrouble
      .filter((h) => h.maskedAbility)
      .map((h) => h.programNumber);
  }

  // Fall back to parsing horse insights
  const tripTroubleHorses: number[] = [];

  for (const insight of analysis.horseInsights) {
    const oneLiner = insight.oneLiner.toLowerCase();
    const keyStrength = insight.keyStrength?.toLowerCase() || '';

    if (
      oneLiner.includes('trip trouble') ||
      oneLiner.includes('blocked') ||
      oneLiner.includes('masked') ||
      oneLiner.includes('hidden') ||
      keyStrength.includes('trip trouble') ||
      keyStrength.includes('hidden ability')
    ) {
      tripTroubleHorses.push(insight.programNumber);
    }
  }

  return tripTroubleHorses;
}

/**
 * Extract pace advantage horses from analysis
 */
function extractPaceAdvantageHorses(
  analysis: AIRaceAnalysis,
  _rawResults?: MultiBotRawResults
): number[] {
  const paceAdvantageHorses: number[] = [];

  // Parse from horse insights
  for (const insight of analysis.horseInsights) {
    const oneLiner = insight.oneLiner.toLowerCase();
    const keyStrength = insight.keyStrength?.toLowerCase() || '';

    if (
      oneLiner.includes('lone speed') ||
      oneLiner.includes('pace advantage') ||
      oneLiner.includes('pace scenario favorable') ||
      oneLiner.includes('pace favors') ||
      keyStrength.includes('pace advantage') ||
      keyStrength.includes('lone speed')
    ) {
      paceAdvantageHorses.push(insight.programNumber);
    }
  }

  return paceAdvantageHorses;
}

/**
 * Extract field type from analysis
 */
function extractFieldType(
  analysis: AIRaceAnalysis,
  rawResults?: MultiBotRawResults
): 'DOMINANT' | 'SEPARATED' | 'COMPETITIVE' | 'WIDE_OPEN' {
  // First check raw bot results if available
  if (rawResults?.fieldSpread?.fieldType) {
    const ft = rawResults.fieldSpread.fieldType;
    if (ft === 'DOMINANT' || ft === 'SEPARATED' || ft === 'COMPETITIVE' || ft === 'WIDE_OPEN') {
      return ft;
    }
    // Map TIGHT and MIXED to closest equivalents
    if (ft === 'TIGHT') return 'COMPETITIVE';
    if (ft === 'MIXED') return 'COMPETITIVE';
  }

  // Fall back to parsing narrative
  const narrative = analysis.raceNarrative.toLowerCase();

  if (narrative.includes('dominant') || narrative.includes('stands out')) {
    return 'DOMINANT';
  }
  if (narrative.includes('separated') || narrative.includes('clear separation')) {
    return 'SEPARATED';
  }
  if (narrative.includes('wide open') || narrative.includes('chaotic')) {
    return 'WIDE_OPEN';
  }

  // Default to COMPETITIVE
  return 'COMPETITIVE';
}

/**
 * Extract override reason from narrative
 */
function extractOverrideReason(analysis: AIRaceAnalysis): string | null {
  const narrative = analysis.raceNarrative;

  // Check for OVERRIDE: prefix
  if (narrative.includes('OVERRIDE:')) {
    const overrideMatch = narrative.match(/OVERRIDE:\s*([^.]+)/);
    if (overrideMatch) {
      return overrideMatch[1]?.trim() || null;
    }
  }

  return null;
}

/**
 * Extract bet type from analysis
 */
function extractBetType(
  analysis: AIRaceAnalysis,
  _rawResults?: MultiBotRawResults
): 'KEY' | 'BOX' | 'WHEEL' | 'PASS' {
  // Check if race is not bettable
  if (!analysis.bettableRace || analysis.chaoticRace) {
    return 'PASS';
  }

  // Parse narrative for bet type hints
  const narrative = analysis.raceNarrative.toLowerCase();

  if (narrative.includes('key') || narrative.includes('standout')) {
    return 'KEY';
  }
  if (narrative.includes('wheel')) {
    return 'WHEEL';
  }
  if (narrative.includes('box') || narrative.includes('spread')) {
    return 'BOX';
  }

  // Default based on confidence
  if (analysis.confidence === 'HIGH') {
    return 'KEY';
  }
  if (analysis.confidence === 'LOW') {
    return 'PASS';
  }

  return 'BOX';
}

/**
 * Build exacta/trifecta horse lists
 */
function buildExoticHorseLists(
  analysis: AIRaceAnalysis,
  betType: 'KEY' | 'BOX' | 'WHEEL' | 'PASS'
): { exactaHorses: number[]; trifectaHorses: number[] } {
  if (betType === 'PASS') {
    return { exactaHorses: [], trifectaHorses: [] };
  }

  // Get contenders sorted by projected finish
  const contenders = analysis.horseInsights
    .filter((h) => h.isContender && !h.avoidFlag)
    .sort((a, b) => a.projectedFinish - b.projectedFinish)
    .map((h) => h.programNumber);

  // For KEY, use top pick + contenders
  // For BOX, use top contenders
  // For WHEEL, use top pick + all contenders

  const exactaHorses = contenders.slice(0, 4);
  const trifectaHorses = contenders.slice(0, 5);

  return { exactaHorses, trifectaHorses };
}

// ============================================================================
// MAIN RECORDER FUNCTION
// ============================================================================

/**
 * Record an AI decision for metrics tracking
 *
 * @param analysis - The AIRaceAnalysis output
 * @param scoringResult - Original algorithm scoring results
 * @param race - Parsed race data
 * @param rawResults - Raw multi-bot results (optional)
 * @param options - Recording options
 * @returns The race ID of the recorded decision
 */
export async function recordAIDecision(
  analysis: AIRaceAnalysis,
  scoringResult: RaceScoringResult,
  race: ParsedRace,
  rawResults?: MultiBotRawResults,
  options?: RecordOptions
): Promise<string> {
  const startTime = Date.now();

  // Extract race header with fallbacks
  const header: RaceHeader = {
    trackCode: race.header.trackCode || 'UNK',
    raceNumber: race.header.raceNumber || 0,
    raceDate: race.header.raceDate || new Date().toISOString().split('T')[0] || 'unknown',
  };

  // Get algorithm scores sorted by rank
  const sortedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  // Extract algorithm data
  const algorithmTopPick = sortedScores[0]?.programNumber ?? 0;
  const algorithmTop3 = sortedScores.slice(0, 3).map((s) => s.programNumber);
  const algorithmScores = sortedScores.map((s) => ({
    programNumber: s.programNumber,
    score: s.finalScore,
    rank: s.rank,
  }));

  // Extract AI decisions
  const aiTopPick = analysis.topPick ?? algorithmTopPick;
  // Value play from ticketConstruction (replaces deprecated valuePlay field)
  const aiValuePlay = analysis.ticketConstruction?.valueHorse?.identified
    ? analysis.ticketConstruction.valueHorse.programNumber
    : null;

  // Get AI top 3 from horse insights sorted by projected finish
  const sortedInsights = [...analysis.horseInsights].sort(
    (a, b) => a.projectedFinish - b.projectedFinish
  );
  const aiTop3 = sortedInsights.slice(0, 3).map((h) => h.programNumber);
  const aiAvoidList = analysis.avoidList;
  const aiConfidence = analysis.confidence;

  // Determine override status
  const isOverride = aiTopPick !== algorithmTopPick;
  const overrideReason = isOverride ? extractOverrideReason(analysis) : null;

  // Extract bot signals
  const tripTroubleHorses = extractTripTroubleHorses(analysis, rawResults);
  const paceAdvantageHorses = extractPaceAdvantageHorses(analysis, rawResults);
  const vulnerableFavorite = analysis.vulnerableFavorite;
  const fieldType = extractFieldType(analysis, rawResults);

  // Extract bet structure
  const betType = extractBetType(analysis, rawResults);
  const { exactaHorses, trifectaHorses } = buildExoticHorseLists(analysis, betType);

  // Calculate field size (non-scratched horses)
  const fieldSize = race.horses.filter((h) => !h.isScratched).length;

  // Generate race ID
  const raceId = `${header.trackCode}-${header.raceDate}-R${header.raceNumber}`;

  // Build the decision record
  const record: AIDecisionRecord = {
    // Race identification
    raceId,
    trackCode: header.trackCode,
    raceNumber: header.raceNumber,
    raceDate: header.raceDate,
    fieldSize,

    // Algorithm baseline
    algorithmTopPick,
    algorithmTop3,
    algorithmScores,

    // AI decisions
    aiTopPick,
    aiValuePlay,
    aiTop3,
    aiAvoidList,
    aiConfidence,

    // Override tracking
    isOverride,
    overrideReason,

    // Bot signals summary
    tripTroubleHorses,
    paceAdvantageHorses,
    vulnerableFavorite,
    fieldType,

    // Bet structure
    betType,
    exactaHorses,
    trifectaHorses,

    // Processing metadata
    processingTimeMs: analysis.processingTimeMs || Date.now() - startTime,
    timestamp: new Date().toISOString(),

    // Outcomes (populated after race results)
    actualWinner: null,
    actualExacta: null,
    actualTrifecta: null,
    resultRecorded: false,
  };

  // Save to storage unless skipped
  if (!options?.skipSave) {
    await saveDecisionRecord(record);
  }

  return raceId;
}

/**
 * Build a decision record without saving (for testing)
 */
export function buildDecisionRecord(
  analysis: AIRaceAnalysis,
  scoringResult: RaceScoringResult,
  race: ParsedRace,
  rawResults?: MultiBotRawResults
): AIDecisionRecord {
  // Use a sync version that doesn't save
  const header: RaceHeader = {
    trackCode: race.header.trackCode || 'UNK',
    raceNumber: race.header.raceNumber || 0,
    raceDate: race.header.raceDate || new Date().toISOString().split('T')[0] || 'unknown',
  };

  const sortedScores = [...scoringResult.scores]
    .filter((s) => !s.isScratched)
    .sort((a, b) => a.rank - b.rank);

  const algorithmTopPick = sortedScores[0]?.programNumber ?? 0;
  const algorithmTop3 = sortedScores.slice(0, 3).map((s) => s.programNumber);
  const algorithmScores = sortedScores.map((s) => ({
    programNumber: s.programNumber,
    score: s.finalScore,
    rank: s.rank,
  }));

  const aiTopPick = analysis.topPick ?? algorithmTopPick;
  // Value play from ticketConstruction (replaces deprecated valuePlay field)
  const aiValuePlay = analysis.ticketConstruction?.valueHorse?.identified
    ? analysis.ticketConstruction.valueHorse.programNumber
    : null;
  const sortedInsights = [...analysis.horseInsights].sort(
    (a, b) => a.projectedFinish - b.projectedFinish
  );
  const aiTop3 = sortedInsights.slice(0, 3).map((h) => h.programNumber);

  const isOverride = aiTopPick !== algorithmTopPick;
  const betType = extractBetType(analysis, rawResults);
  const { exactaHorses, trifectaHorses } = buildExoticHorseLists(analysis, betType);

  const raceId = `${header.trackCode}-${header.raceDate}-R${header.raceNumber}`;

  return {
    raceId,
    trackCode: header.trackCode,
    raceNumber: header.raceNumber,
    raceDate: header.raceDate,
    fieldSize: race.horses.filter((h) => !h.isScratched).length,
    algorithmTopPick,
    algorithmTop3,
    algorithmScores,
    aiTopPick,
    aiValuePlay,
    aiTop3,
    aiAvoidList: analysis.avoidList,
    aiConfidence: analysis.confidence,
    isOverride,
    overrideReason: isOverride ? extractOverrideReason(analysis) : null,
    tripTroubleHorses: extractTripTroubleHorses(analysis, rawResults),
    paceAdvantageHorses: extractPaceAdvantageHorses(analysis, rawResults),
    vulnerableFavorite: analysis.vulnerableFavorite,
    fieldType: extractFieldType(analysis, rawResults),
    betType,
    exactaHorses,
    trifectaHorses,
    processingTimeMs: analysis.processingTimeMs || 0,
    timestamp: new Date().toISOString(),
    actualWinner: null,
    actualExacta: null,
    actualTrifecta: null,
    resultRecorded: false,
  };
}
