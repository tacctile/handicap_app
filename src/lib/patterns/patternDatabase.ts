/**
 * Pattern Database with Caching
 *
 * Builds and caches dynamic pattern databases from race data.
 * Uses IndexedDB for persistent caching to avoid recalculation.
 *
 * Features:
 * - Rate limiting to prevent performance issues
 * - IndexedDB caching with expiration
 * - On-the-fly pattern extraction
 * - Incremental updates as new races are analyzed
 */

import type { HorseEntry, RaceHeader, ParsedRace } from '../../types/drf';
import { logger } from '../../services/logging';
import { getRateLimiter } from '../rateLimit';
import {
  type TrainerProfile,
  type TrainerPatternResult,
  buildTrainerProfile,
  calculateTrainerPatternScore,
  normalizeTrainerName,
} from './trainerPatterns';
import {
  type JockeyProfile,
  type JockeyPatternResult,
  calculateJockeyPatternScore,
  normalizeJockeyName,
  extractJockeyPatternsFromHorses,
} from './jockeyPatterns';
import {
  type RacePartnershipDatabase,
  type SynergyResult,
  buildPartnershipDatabase,
  calculateSynergyBonus,
  getPartnershipStats,
} from './connectionSynergy';

// ============================================================================
// TYPES
// ============================================================================

export interface PatternDatabase {
  /** Trainer profiles by normalized name */
  trainerProfiles: Map<string, TrainerProfile>;
  /** Jockey profiles by normalized name */
  jockeyProfiles: Map<string, JockeyProfile>;
  /** Partnership database */
  partnerships: RacePartnershipDatabase;
  /** Build timestamp */
  builtAt: Date;
  /** Track code this database is for */
  trackCode: string;
  /** Number of horses processed */
  horsesProcessed: number;
  /** Number of past performances analyzed */
  ppsAnalyzed: number;
  /** Is database valid */
  isValid: boolean;
}

export interface PatternAnalysisResult {
  /** Trainer pattern result */
  trainer: TrainerPatternResult;
  /** Jockey pattern result */
  jockey: JockeyPatternResult;
  /** Synergy result */
  synergy: SynergyResult;
  /** Combined score (trainer + jockey + synergy, capped at 50) */
  combinedScore: number;
  /** All evidence strings */
  evidence: string[];
  /** Summary for display */
  summary: string;
}

export interface CachedPatternData {
  /** Cache key */
  key: string;
  /** Pattern database (serialized) */
  data: SerializedPatternDatabase;
  /** Cache timestamp */
  cachedAt: number;
  /** Expiration timestamp */
  expiresAt: number;
}

interface SerializedPatternDatabase {
  trainerProfiles: Array<[string, TrainerProfile]>;
  jockeyProfiles: Array<[string, JockeyProfile]>;
  partnerships: {
    partnerships: Array<[string, import('./connectionSynergy').PartnershipStats]>;
    byTrainer: Array<[string, string[]]>;
    byJockey: Array<[string, string[]]>;
  };
  builtAt: string;
  trackCode: string;
  horsesProcessed: number;
  ppsAnalyzed: number;
  isValid: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Cache expiration time: 24 hours */
const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Maximum score for combined connections */
const MAX_COMBINED_SCORE = 50;

/** Rate limit config for pattern analysis */
const PATTERN_ANALYSIS_RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60 * 1000,
  burstLimit: 20,
  message: 'Pattern analysis rate limited. Please wait.',
};

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

/** In-memory pattern database cache */
const patternDatabaseCache = new Map<string, PatternDatabase>();

// ============================================================================
// CACHE FUNCTIONS
// ============================================================================

/**
 * Generate a cache key for a race
 */
function generateCacheKey(trackCode: string, raceDate: string): string {
  return `patterns:${trackCode}:${raceDate}`;
}

/**
 * Serialize a pattern database for storage
 */
function serializeDatabase(db: PatternDatabase): SerializedPatternDatabase {
  return {
    trainerProfiles: Array.from(db.trainerProfiles.entries()),
    jockeyProfiles: Array.from(db.jockeyProfiles.entries()),
    partnerships: {
      partnerships: Array.from(db.partnerships.partnerships.entries()),
      byTrainer: Array.from(db.partnerships.byTrainer.entries()),
      byJockey: Array.from(db.partnerships.byJockey.entries()),
    },
    builtAt: db.builtAt.toISOString(),
    trackCode: db.trackCode,
    horsesProcessed: db.horsesProcessed,
    ppsAnalyzed: db.ppsAnalyzed,
    isValid: db.isValid,
  };
}

/**
 * Deserialize a pattern database from storage
 */
function deserializeDatabase(data: SerializedPatternDatabase): PatternDatabase {
  return {
    trainerProfiles: new Map(data.trainerProfiles),
    jockeyProfiles: new Map(data.jockeyProfiles),
    partnerships: {
      partnerships: new Map(data.partnerships.partnerships),
      byTrainer: new Map(data.partnerships.byTrainer),
      byJockey: new Map(data.partnerships.byJockey),
    },
    builtAt: new Date(data.builtAt),
    trackCode: data.trackCode,
    horsesProcessed: data.horsesProcessed,
    ppsAnalyzed: data.ppsAnalyzed,
    isValid: data.isValid,
  };
}

/**
 * Try to load pattern database from IndexedDB cache
 */
async function loadFromCache(key: string): Promise<PatternDatabase | null> {
  // First check in-memory cache
  const inMemory = patternDatabaseCache.get(key);
  if (inMemory) {
    return inMemory;
  }

  try {
    // Try to load from IndexedDB via storage service
    const { getCachedCalculation } = await import('../../services/storage');
    const cached = await getCachedCalculation<CachedPatternData>(key, 'pattern-database');

    if (cached && cached.expiresAt > Date.now()) {
      const db = deserializeDatabase(cached.data);
      // Store in memory for fast access
      patternDatabaseCache.set(key, db);
      return db;
    }
  } catch (error) {
    logger.logWarning('Failed to load pattern database from cache', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return null;
}

/**
 * Save pattern database to IndexedDB cache
 */
async function saveToCache(key: string, db: PatternDatabase): Promise<void> {
  // Always update in-memory cache
  patternDatabaseCache.set(key, db);

  try {
    const { saveCachedCalculation } = await import('../../services/storage');
    const cached: CachedPatternData = {
      key,
      data: serializeDatabase(db),
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_EXPIRATION_MS,
    };
    await saveCachedCalculation(key, 'pattern-database', cached);
  } catch (error) {
    logger.logWarning('Failed to save pattern database to cache', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Build a complete pattern database from all horses in a race
 * Uses caching to avoid repeated calculations
 */
export async function buildPatternDatabase(
  horses: HorseEntry[],
  raceHeader: RaceHeader
): Promise<PatternDatabase> {
  const cacheKey = generateCacheKey(raceHeader.trackCode, raceHeader.raceDateRaw);

  // Check rate limiting
  const rateLimiter = getRateLimiter();
  const limitResult = rateLimiter.check('pattern-analysis', PATTERN_ANALYSIS_RATE_LIMIT);

  if (!limitResult.allowed) {
    logger.logWarning('Pattern analysis rate limited', {
      retryAfter: limitResult.retryAfter,
    });
    // Return cached or empty database
    const cached = await loadFromCache(cacheKey);
    if (cached) return cached;

    return createEmptyDatabase(raceHeader.trackCode);
  }

  // Try to load from cache
  const cached = await loadFromCache(cacheKey);
  if (cached) {
    logger.logInfo('Loaded pattern database from cache', {
      trackCode: raceHeader.trackCode,
      horsesProcessed: cached.horsesProcessed,
    });
    return cached;
  }

  // Build fresh database
  logger.logInfo('Building pattern database', {
    trackCode: raceHeader.trackCode,
    horses: horses.length,
  });

  try {
    // Extract trainer profiles
    const trainerProfiles = new Map<string, TrainerProfile>();
    const uniqueTrainers = new Set(horses.map((h) => normalizeTrainerName(h.trainerName)));

    for (const trainerNorm of uniqueTrainers) {
      const matchingHorse = horses.find((h) => normalizeTrainerName(h.trainerName) === trainerNorm);
      const originalName = matchingHorse?.trainerName ?? trainerNorm;
      const profile = buildTrainerProfile(originalName, horses);
      trainerProfiles.set(trainerNorm, profile);
    }

    // Extract jockey profiles
    const jockeyProfiles = extractJockeyPatternsFromHorses(horses);

    // Build partnership database
    const partnerships = buildPartnershipDatabase(horses);

    // Count PPs analyzed
    let ppsAnalyzed = 0;
    for (const horse of horses) {
      ppsAnalyzed += horse.pastPerformances.length;
    }

    const db: PatternDatabase = {
      trainerProfiles,
      jockeyProfiles,
      partnerships,
      builtAt: new Date(),
      trackCode: raceHeader.trackCode,
      horsesProcessed: horses.length,
      ppsAnalyzed,
      isValid: true,
    };

    // Save to cache
    await saveToCache(cacheKey, db);

    logger.logInfo('Pattern database built successfully', {
      trackCode: raceHeader.trackCode,
      trainers: trainerProfiles.size,
      jockeys: jockeyProfiles.size,
      partnerships: partnerships.partnerships.size,
    });

    return db;
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error('Unknown error'), {
      component: 'PatternDatabase',
      trackCode: raceHeader.trackCode,
    });

    return createEmptyDatabase(raceHeader.trackCode);
  }
}

/**
 * Create an empty pattern database
 */
function createEmptyDatabase(trackCode: string): PatternDatabase {
  return {
    trainerProfiles: new Map(),
    jockeyProfiles: new Map(),
    partnerships: {
      partnerships: new Map(),
      byTrainer: new Map(),
      byJockey: new Map(),
    },
    builtAt: new Date(),
    trackCode,
    horsesProcessed: 0,
    ppsAnalyzed: 0,
    isValid: false,
  };
}

/**
 * Analyze patterns for a specific horse using a pre-built database
 */
export function analyzeHorsePatterns(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  database: PatternDatabase,
  allHorses: HorseEntry[]
): PatternAnalysisResult {
  try {
    // Get trainer pattern result
    const trainer = calculateTrainerPatternScore(horse, raceHeader, allHorses);

    // Get jockey pattern result
    const jockey = calculateJockeyPatternScore(horse, raceHeader, allHorses);

    // Get synergy result
    const partnershipStats = getPartnershipStats(
      horse.trainerName,
      horse.jockeyName,
      database.partnerships
    );
    const synergy = calculateSynergyBonus(partnershipStats);

    // Calculate combined score (capped at 50)
    const rawScore = trainer.score + jockey.score + synergy.bonus;
    const combinedScore = Math.min(rawScore, MAX_COMBINED_SCORE);

    // Collect all evidence
    const evidence: string[] = [...trainer.evidence, ...jockey.evidence, ...synergy.evidence];

    // Build summary
    const summaryParts: string[] = [];

    if (trainer.relevantPattern) {
      summaryParts.push(`T: ${trainer.relevantPattern.winRate.toFixed(0)}%`);
    }
    if (jockey.relevantPattern) {
      summaryParts.push(`J: ${jockey.relevantPattern.winRate.toFixed(0)}%`);
    }
    if (synergy.partnership && synergy.level !== 'none') {
      summaryParts.push(`Together: ${synergy.partnership.winRate.toFixed(0)}%`);
    }

    const summary = summaryParts.length > 0 ? summaryParts.join(' | ') : 'Limited data';

    return {
      trainer,
      jockey,
      synergy,
      combinedScore,
      evidence,
      summary,
    };
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error('Unknown error'), {
      component: 'PatternAnalysis',
      horseName: horse.horseName,
    });

    // Return default result on error
    return {
      trainer: {
        profile: {
          trainerName: normalizeTrainerName(horse.trainerName),
          overall: {
            trainerName: horse.trainerName,
            wins: 0,
            starts: 0,
            winRate: 0,
            places: 0,
            shows: 0,
            itmRate: 0,
            avgWinningBeyer: null,
            description: '',
            context: {},
          },
          byTrack: new Map(),
          byDistanceCategory: new Map(),
          bySurface: new Map(),
          byClass: new Map(),
          combinedPatterns: [],
          bestPattern: null,
          score: 10,
          tier: 'average',
          evidence: [],
        },
        relevantPattern: null,
        score: 10,
        reasoning: 'Pattern analysis unavailable',
        evidence: [],
      },
      jockey: {
        profile: {
          jockeyName: normalizeJockeyName(horse.jockeyName),
          overall: {
            jockeyName: horse.jockeyName,
            wins: 0,
            starts: 0,
            winRate: 0,
            places: 0,
            shows: 0,
            itmRate: 0,
            avgWinningBeyer: null,
            description: '',
            context: {},
          },
          byTrack: new Map(),
          byRunningStyle: new Map(),
          bySurface: new Map(),
          byDistanceCategory: new Map(),
          bestPattern: null,
          score: 7,
          tier: 'average',
          evidence: [],
        },
        relevantPattern: null,
        score: 7,
        reasoning: 'Pattern analysis unavailable',
        evidence: [],
      },
      synergy: {
        partnership: null,
        bonus: 0,
        level: 'none',
        description: 'Analysis unavailable',
        evidence: [],
        isHotCombo: false,
        recentForm: '',
      },
      combinedScore: 17, // Default: 10 + 7 + 0
      evidence: ['Pattern analysis unavailable'],
      summary: 'Limited data',
    };
  }
}

/**
 * Analyze patterns for all horses in a race
 */
export async function analyzeRacePatterns(
  race: ParsedRace
): Promise<Map<number, PatternAnalysisResult>> {
  const results = new Map<number, PatternAnalysisResult>();

  try {
    // Build the pattern database
    const database = await buildPatternDatabase(race.horses, race.header);

    // Analyze each horse
    for (let i = 0; i < race.horses.length; i++) {
      const horse = race.horses[i];
      if (!horse) continue;
      const analysis = analyzeHorsePatterns(horse, race.header, database, race.horses);
      results.set(i, analysis);
    }
  } catch (error) {
    logger.logError(error instanceof Error ? error : new Error('Unknown error'), {
      component: 'RacePatternAnalysis',
      raceNumber: race.header.raceNumber,
    });
  }

  return results;
}

/**
 * Clear all pattern caches
 */
export function clearPatternCaches(): void {
  patternDatabaseCache.clear();
  logger.logInfo('Pattern caches cleared');
}

/**
 * Get cache statistics
 */
export function getPatternCacheStats(): {
  inMemoryCount: number;
  keys: string[];
} {
  return {
    inMemoryCount: patternDatabaseCache.size,
    keys: Array.from(patternDatabaseCache.keys()),
  };
}
