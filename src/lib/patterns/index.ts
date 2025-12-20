/**
 * Dynamic Pattern Matching Module
 *
 * Provides evidence-based trainer/jockey pattern analysis
 * using actual race data from DRF past performances.
 *
 * Features:
 * - Trainer pattern extraction with track/surface/class specificity
 * - Jockey pattern extraction with running style analysis
 * - Trainer-jockey partnership synergy detection
 * - Cached pattern database with IndexedDB persistence
 *
 * Usage:
 * ```ts
 * import { analyzeRacePatterns, analyzeHorsePatterns } from '@/lib/patterns'
 *
 * // Analyze all horses in a race
 * const results = await analyzeRacePatterns(race)
 *
 * // Or analyze a specific horse
 * const database = await buildPatternDatabase(horses, raceHeader)
 * const analysis = analyzeHorsePatterns(horse, raceHeader, database, allHorses)
 *
 * console.log(analysis.combinedScore) // 0-50 pts
 * console.log(analysis.summary) // "T: 22% | J: 18% | Together: 26%"
 * ```
 */

// Trainer patterns
export {
  type TrainerPatternStats,
  type PatternContext,
  type TrainerProfile,
  type TrainerPatternResult,
  MIN_STARTS_FOR_CREDIBILITY,
  normalizeTrainerName,
  extractTrainerPatternsFromHorse,
  buildTrainerProfile,
  calculateTrainerPatternScore,
  getTrainerPatternDisplay,
} from './trainerPatterns'

// Jockey patterns
export {
  type RunningStyle,
  type JockeyPatternStats,
  type JockeyPatternContext,
  type JockeyProfile,
  type JockeyPatternResult,
  MIN_JOCKEY_STARTS_FOR_CREDIBILITY,
  normalizeJockeyName,
  determineRunningStyle,
  getRunningStyleLabel,
  extractJockeyPatternsFromHorses,
  buildJockeyProfile,
  calculateJockeyPatternScore,
  getJockeyPatternDisplay,
} from './jockeyPatterns'

// Connection synergy
export {
  type PartnershipStats,
  type SynergyResult,
  type RacePartnershipDatabase,
  buildPartnershipDatabase,
  getPartnershipStats,
  calculateSynergyBonus,
  getConnectionSynergy,
  getTrainerPartnerships,
  getJockeyPartnerships,
  getSynergyDisplay,
  hasSignificantPartnership,
} from './connectionSynergy'

// Pattern database
export {
  type PatternDatabase,
  type PatternAnalysisResult,
  buildPatternDatabase,
  analyzeHorsePatterns,
  analyzeRacePatterns,
  clearPatternCaches,
  getPatternCacheStats,
} from './patternDatabase'
