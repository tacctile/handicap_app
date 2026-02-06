/**
 * Diagnostics Service
 *
 * Analyzes all DRF test data and race results, comparing algorithm
 * predictions against actual outcomes. Runs on app load, caches results
 * in IndexedDB, and feeds the hidden diagnostics dashboard.
 *
 * This is a browser-compatible port of scripts/validate-algorithm.ts.
 * Uses Vite's import.meta.glob to dynamically discover all data files.
 */

import { parseDRFFile } from '../../lib/drfParser';
import { calculateRaceScores } from '../../lib/scoring';
import { TIER_CONFIG } from '../../lib/betting/tierClassification';
import { logger } from '../logging';
import {
  generateContentHash,
  getCachedResults,
  setCachedResults,
  clearDiagnosticsCache,
} from './cache';
import type {
  DiagnosticsResults,
  RaceResult,
  FilePair,
  AnalysisProgress,
  TrackSummary,
  TierPerformance,
} from './types';
import type { ParsedRace } from '../../types/drf';
import type { ScoredHorse } from '../../lib/scoring';

// ============================================================================
// FILE DISCOVERY VIA VITE
// ============================================================================

/**
 * Lazy-load all DRF files as raw text using Vite's import.meta.glob.
 * Non-eager: files are loaded on-demand via dynamic import, preventing
 * the ~7MB of DRF data from bloating the main JS bundle.
 */
const drfModules = import.meta.glob<string>('/src/data/*.DRF', {
  query: '?raw',
  import: 'default',
});

/**
 * Lazy-load all results files as raw text.
 */
const resultsModules = import.meta.glob<string>('/src/data/*_results.txt', {
  query: '?raw',
  import: 'default',
});

// ============================================================================
// RESULTS FILE PARSING
// ============================================================================

/**
 * Parse a results file into structured race results.
 * Handles the format:
 *   RACE 1
 *   1st: 3 Bodegas
 *   2nd: 4 Morgana's Moment
 *   ...
 *   SCRATCHED: none
 */
function parseResultsFile(content: string): RaceResult[] {
  // Normalize unicode spaces
  const normalizedContent = content.replace(/\u202F/g, ' ');
  const lines = normalizedContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: RaceResult[] = [];
  let currentRace: RaceResult | null = null;

  for (const line of lines) {
    // Race header
    const raceMatch = line.match(/^RACE\s+(\d+)/i);
    if (raceMatch?.[1]) {
      if (currentRace) {
        results.push(currentRace);
      }
      currentRace = {
        raceNumber: parseInt(raceMatch[1], 10),
        positions: [],
        scratches: [],
      };
      continue;
    }

    if (!currentRace) continue;

    // Position lines (1st, 2nd, 3rd, 4th)
    const posMatch = line.match(/^(1st|2nd|3rd|4th):\s*(\d+)\s+(.+)$/i);
    if (posMatch?.[1] && posMatch[2] && posMatch[3]) {
      const positionMap: Record<string, number> = {
        '1st': 1,
        '2nd': 2,
        '3rd': 3,
        '4th': 4,
      };
      const post = parseInt(posMatch[2], 10);
      const name = posMatch[3].trim();
      if (post > 0) {
        currentRace.positions.push({
          position: positionMap[posMatch[1].toLowerCase()] ?? 0,
          post,
          horseName: name,
        });
      }
      continue;
    }

    // Scratches
    const scratchMatch = line.match(/^SCRATCHED:\s*(.+)$/i);
    if (scratchMatch?.[1]) {
      const scratchText = scratchMatch[1].trim().toLowerCase();
      if (scratchText !== 'none' && scratchText !== '(none)') {
        const scratchParts = scratchMatch[1].split(/[,;]/);
        for (const part of scratchParts) {
          const scratchHorseMatch = part.trim().match(/^(\d+)\s+(.+)$/);
          if (scratchHorseMatch?.[1] && scratchHorseMatch[2]) {
            currentRace.scratches.push({
              post: parseInt(scratchHorseMatch[1], 10),
              horseName: scratchHorseMatch[2].trim(),
            });
          }
        }
      }
    }
  }

  if (currentRace) {
    results.push(currentRace);
  }

  return results;
}

// ============================================================================
// FILE PAIRING
// ============================================================================

/**
 * Discover and pair DRF files with their matching results files.
 * sample.DRF is skipped (no results file).
 * Loads file content lazily via dynamic import to avoid bundling data in main chunk.
 */
async function discoverFilePairs(): Promise<{ pairs: FilePair[]; unmatchedFiles: string[] }> {
  const pairs: FilePair[] = [];
  const unmatchedFiles: string[] = [];

  // Build a map of trackCode -> results loader
  const resultsLoaders = new Map<string, () => Promise<string>>();
  for (const [path, loader] of Object.entries(resultsModules)) {
    const filename = path.split('/').pop() ?? '';
    const trackCode = filename.replace('_results.txt', '');
    resultsLoaders.set(trackCode, loader);
  }

  // Load and pair each DRF file with its results
  for (const [path, drfLoader] of Object.entries(drfModules)) {
    const filename = path.split('/').pop() ?? '';
    const trackCode = filename.replace('.DRF', '');

    // Skip sample.DRF — it has no results
    if (trackCode === 'sample') {
      unmatchedFiles.push(filename);
      continue;
    }

    const resultsLoader = resultsLoaders.get(trackCode);
    if (!resultsLoader) {
      unmatchedFiles.push(filename);
      continue;
    }

    // Load both files in parallel
    const [drfContent, resultsContent] = await Promise.all([drfLoader(), resultsLoader()]);

    pairs.push({
      trackCode,
      drfContent,
      resultsContent,
      drfFilename: filename,
    });
  }

  return { pairs, unmatchedFiles };
}

// ============================================================================
// RACE PROCESSING
// ============================================================================

/**
 * Process a single race: score horses, compare against actual results.
 */
function processRace(
  race: ParsedRace,
  raceResult: RaceResult,
  scratchedPosts: Set<number>
): {
  scoredHorses: ScoredHorse[];
  actualFirst: number;
  actualSecond: number;
  actualThird: number;
  actualFourth: number;
  algorithmTop: number[];
} | null {
  const positions = raceResult.positions;
  const p0 = positions[0];
  const p1 = positions[1];
  const p2 = positions[2];
  const p3 = positions[3];
  if (!p0 || !p1 || !p2 || !p3) {
    return null; // Need at least 4 finishers
  }

  const actualFirst = p0.post;
  const actualSecond = p1.post;
  const actualThird = p2.post;
  const actualFourth = p3.post;

  // Score using the actual scoring engine
  const scoredHorses = calculateRaceScores(
    race.horses,
    race.header,
    (_idx: number, origOdds: string) => origOdds,
    (idx: number) => scratchedPosts.has(race.horses[idx]?.postPosition ?? 0),
    'fast'
  );

  // Get non-scratched horses sorted by rank
  const activeHorses = scoredHorses
    .filter((sh) => !sh.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  if (activeHorses.length < 4) {
    return null;
  }

  const algorithmTop = activeHorses.slice(0, 6).map((sh) => sh.horse.postPosition);

  return {
    scoredHorses,
    actualFirst,
    actualSecond,
    actualThird,
    actualFourth,
    algorithmTop,
  };
}

// ============================================================================
// BOX HIT CHECKERS
// ============================================================================

function checkExactaBoxHit(
  algorithmTop: number[],
  first: number,
  second: number,
  boxSize: number
): boolean {
  const box = algorithmTop.slice(0, boxSize);
  return box.includes(first) && box.includes(second);
}

function checkTrifectaBoxHit(
  algorithmTop: number[],
  first: number,
  second: number,
  third: number,
  boxSize: number
): boolean {
  const box = algorithmTop.slice(0, boxSize);
  return box.includes(first) && box.includes(second) && box.includes(third);
}

function checkSuperfectaBoxHit(
  algorithmTop: number[],
  first: number,
  second: number,
  third: number,
  fourth: number,
  boxSize: number
): boolean {
  const box = algorithmTop.slice(0, boxSize);
  return box.includes(first) && box.includes(second) && box.includes(third) && box.includes(fourth);
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

function formatDateFromRaw(dateStr: string | undefined): string {
  if (!dateStr || dateStr.length !== 8) return '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthNum = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);
  const year = dateStr.substring(0, 4);
  const monthName = months[monthNum - 1] ?? 'Unknown';
  return `${monthName} ${day}, ${year}`;
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Run the full diagnostics analysis across all data files.
 *
 * @param onProgress - Optional callback for progress updates
 * @param ignoreCache - If true, skip cache and force fresh analysis
 * @returns Complete diagnostics results
 */
export async function runDiagnostics(
  onProgress?: (progress: AnalysisProgress) => void,
  ignoreCache: boolean = false
): Promise<DiagnosticsResults> {
  const startTime = performance.now();

  // Generate content hash from known file paths BEFORE loading content
  // This allows cache check to happen without loading any data
  const drfPaths = Object.keys(drfModules);
  const resultsPaths = Object.keys(resultsModules);
  const drfFilenames = drfPaths.map((p) => p.split('/').pop() ?? '');
  const resultsFilenames = resultsPaths.map((p) => p.split('/').pop() ?? '');
  const contentHash = generateContentHash(drfFilenames, resultsFilenames);

  // Check cache before expensive file loading (unless forced)
  if (!ignoreCache) {
    const cached = await getCachedResults(contentHash);
    if (cached) {
      logger.logInfo('Diagnostics: using cached results', {
        component: 'Diagnostics',
        analyzedAt: cached.results.analyzedAt,
      });
      return cached.results;
    }
  }

  // Cache miss — load and pair files
  const { pairs, unmatchedFiles } = await discoverFilePairs();

  logger.logInfo('Diagnostics: discovered files', {
    component: 'Diagnostics',
    pairs: pairs.length,
    unmatched: unmatchedFiles,
  });

  if (pairs.length === 0) {
    return createEmptyResults(unmatchedFiles);
  }

  // Counters
  let totalRaces = 0;
  let validRaces = 0;
  let totalHorses = 0;
  let wins = 0;
  let places = 0;
  let shows = 0;

  // Exotic counters
  let exactaBox2Hits = 0;
  let exactaBox3Hits = 0;
  let exactaBox4Hits = 0;
  let trifectaBox3Hits = 0;
  let trifectaBox4Hits = 0;
  let trifectaBox5Hits = 0;
  let superfectaRaces = 0;
  let superfectaBox4Hits = 0;
  let superfectaBox5Hits = 0;
  let superfectaBox6Hits = 0;

  // Tier tracking
  const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
  const tierWins = { tier1: 0, tier2: 0, tier3: 0 };
  const tierITM = { tier1: 0, tier2: 0, tier3: 0 };

  // Track summary tracking
  const trackMap = new Map<
    string,
    {
      races: number;
      horses: number;
      topPickWins: number;
      topPickITM: number;
      dates: Set<string>;
    }
  >();

  const allDates: string[] = [];

  // Process each file pair
  for (let fileIdx = 0; fileIdx < pairs.length; fileIdx++) {
    const pair = pairs[fileIdx]!;

    onProgress?.({
      currentFile: pair.trackCode,
      filesProcessed: fileIdx,
      totalFiles: pairs.length,
      percentComplete: Math.round((fileIdx / pairs.length) * 100),
    });

    // Yield to main thread between files to keep UI responsive
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    try {
      const parsed = parseDRFFile(pair.drfContent, pair.drfFilename);
      const results = parseResultsFile(pair.resultsContent);
      const resultsByRace = new Map(results.map((r) => [r.raceNumber, r]));

      // Extract track code from parsed data
      const trackCode = parsed.races[0]?.header?.trackCode ?? pair.trackCode.replace(/\d+$/, '');
      const raceDate = parsed.races[0]?.header?.raceDateRaw ?? '';

      if (raceDate) {
        allDates.push(raceDate);
      }

      // Initialize track summary
      if (!trackMap.has(trackCode)) {
        trackMap.set(trackCode, {
          races: 0,
          horses: 0,
          topPickWins: 0,
          topPickITM: 0,
          dates: new Set(),
        });
      }
      const trackInfo = trackMap.get(trackCode)!;
      if (raceDate) trackInfo.dates.add(raceDate);

      for (const race of parsed.races) {
        totalRaces++;
        totalHorses += race.horses.length;
        trackInfo.horses += race.horses.length;

        const raceResult = resultsByRace.get(race.header.raceNumber);
        if (!raceResult) continue;

        const scratchedPosts = new Set(raceResult.scratches.map((s) => s.post));
        const metrics = processRace(race, raceResult, scratchedPosts);
        if (!metrics) continue;

        validRaces++;
        trackInfo.races++;

        const { scoredHorses, actualFirst, actualSecond, actualThird, actualFourth, algorithmTop } =
          metrics;
        const topPick = algorithmTop[0] ?? -1;

        // Win/Place/Show
        if (topPick === actualFirst) {
          wins++;
          trackInfo.topPickWins++;
        }
        if (topPick === actualFirst || topPick === actualSecond) {
          places++;
        }
        if (topPick === actualFirst || topPick === actualSecond || topPick === actualThird) {
          shows++;
          trackInfo.topPickITM++;
        }

        // Tier tracking
        const activeHorses = scoredHorses.filter((sh) => !sh.score.isScratched);
        for (const sh of activeHorses) {
          const baseScore = sh.score.baseScore;
          const actualPost = sh.horse.postPosition;
          const finishedTop3 =
            actualPost === actualFirst || actualPost === actualSecond || actualPost === actualThird;
          const finishedFirst = actualPost === actualFirst;

          if (baseScore >= TIER_CONFIG.tier1.minScore) {
            tierCounts.tier1++;
            if (finishedFirst) tierWins.tier1++;
            if (finishedTop3) tierITM.tier1++;
          } else if (baseScore >= TIER_CONFIG.tier2.minScore) {
            tierCounts.tier2++;
            if (finishedFirst) tierWins.tier2++;
            if (finishedTop3) tierITM.tier2++;
          } else if (baseScore >= TIER_CONFIG.tier3.minScore) {
            tierCounts.tier3++;
            if (finishedFirst) tierWins.tier3++;
            if (finishedTop3) tierITM.tier3++;
          }
        }

        // Exacta boxes
        if (checkExactaBoxHit(algorithmTop, actualFirst, actualSecond, 2)) exactaBox2Hits++;
        if (checkExactaBoxHit(algorithmTop, actualFirst, actualSecond, 3)) exactaBox3Hits++;
        if (checkExactaBoxHit(algorithmTop, actualFirst, actualSecond, 4)) exactaBox4Hits++;

        // Trifecta boxes
        if (checkTrifectaBoxHit(algorithmTop, actualFirst, actualSecond, actualThird, 3))
          trifectaBox3Hits++;
        if (checkTrifectaBoxHit(algorithmTop, actualFirst, actualSecond, actualThird, 4))
          trifectaBox4Hits++;
        if (checkTrifectaBoxHit(algorithmTop, actualFirst, actualSecond, actualThird, 5))
          trifectaBox5Hits++;

        // Superfecta boxes
        if (actualFourth > 0 && algorithmTop.length >= 6) {
          superfectaRaces++;
          if (
            checkSuperfectaBoxHit(
              algorithmTop,
              actualFirst,
              actualSecond,
              actualThird,
              actualFourth,
              4
            )
          )
            superfectaBox4Hits++;
          if (
            checkSuperfectaBoxHit(
              algorithmTop,
              actualFirst,
              actualSecond,
              actualThird,
              actualFourth,
              5
            )
          )
            superfectaBox5Hits++;
          if (
            checkSuperfectaBoxHit(
              algorithmTop,
              actualFirst,
              actualSecond,
              actualThird,
              actualFourth,
              6
            )
          )
            superfectaBox6Hits++;
        }
      }
    } catch (error) {
      logger.logWarning(`Diagnostics: error processing ${pair.trackCode}`, {
        component: 'Diagnostics',
        error,
      });
    }
  }

  // Final progress
  onProgress?.({
    currentFile: 'Complete',
    filesProcessed: pairs.length,
    totalFiles: pairs.length,
    percentComplete: 100,
  });

  const toRate = (hits: number, total: number): number =>
    total > 0 ? Math.round((hits / total) * 1000) / 10 : 0;

  // Build date range
  const sortedDates = [...allDates].sort();
  const dateRange =
    sortedDates.length > 0
      ? `${formatDateFromRaw(sortedDates[0])} — ${formatDateFromRaw(sortedDates[sortedDates.length - 1])}`
      : 'No dates';

  // Build track summaries
  const trackSummaries: TrackSummary[] = [];
  for (const [code, info] of trackMap.entries()) {
    const sortedTrackDates = [...info.dates].sort();
    const trackDateRange =
      sortedTrackDates.length > 1
        ? `${formatDateFromRaw(sortedTrackDates[0])} — ${formatDateFromRaw(sortedTrackDates[sortedTrackDates.length - 1])}`
        : formatDateFromRaw(sortedTrackDates[0]);

    trackSummaries.push({
      trackCode: code,
      trackName: code,
      raceCount: info.races,
      horseCount: info.horses,
      topPickWinRate: toRate(info.topPickWins, info.races),
      topPickITMRate: toRate(info.topPickITM, info.races),
      dateRange: trackDateRange,
      topPickWins: info.topPickWins,
      topPickITM: info.topPickITM,
    });
  }

  // Sort track summaries by race count descending
  trackSummaries.sort((a, b) => b.raceCount - a.raceCount);

  // Build tier performance
  const tierPerformance: TierPerformance[] = [
    {
      tierName: 'tier1',
      tierLabel: 'Tier 1 — Cover Chalk',
      horseCount: tierCounts.tier1,
      winRate: toRate(tierWins.tier1, tierCounts.tier1),
      itmRate: toRate(tierITM.tier1, tierCounts.tier1),
      wins: tierWins.tier1,
      itmFinishes: tierITM.tier1,
      tooltip: 'Horses our system is most confident in — the top contenders',
    },
    {
      tierName: 'tier2',
      tierLabel: 'Tier 2 — Logical Alternatives',
      horseCount: tierCounts.tier2,
      winRate: toRate(tierWins.tier2, tierCounts.tier2),
      itmRate: toRate(tierITM.tier2, tierCounts.tier2),
      wins: tierWins.tier2,
      itmFinishes: tierITM.tier2,
      tooltip: 'Solid alternatives — not the favorite but still competitive',
    },
    {
      tierName: 'tier3',
      tierLabel: 'Tier 3 — Value Bombs',
      horseCount: tierCounts.tier3,
      winRate: toRate(tierWins.tier3, tierCounts.tier3),
      itmRate: toRate(tierITM.tier3, tierCounts.tier3),
      wins: tierWins.tier3,
      itmFinishes: tierITM.tier3,
      tooltip: 'Longshots — lower chance but higher potential payoff',
    },
  ];

  const analysisTimeMs = Math.round(performance.now() - startTime);

  const results: DiagnosticsResults = {
    totalFiles: pairs.length,
    totalRaces,
    totalHorses,
    totalTracks: trackMap.size,
    dateRange,

    topPickWinRate: toRate(wins, validRaces),
    topPickPlaceRate: toRate(places, validRaces),
    topPickShowRate: toRate(shows, validRaces),
    topPickWins: wins,
    topPickPlaces: places,
    topPickShows: shows,
    validRaces,

    tierPerformance,
    trackSummaries,

    exactaBox2Rate: toRate(exactaBox2Hits, validRaces),
    exactaBox3Rate: toRate(exactaBox3Hits, validRaces),
    exactaBox4Rate: toRate(exactaBox4Hits, validRaces),
    trifectaBox3Rate: toRate(trifectaBox3Hits, validRaces),
    trifectaBox4Rate: toRate(trifectaBox4Hits, validRaces),
    trifectaBox5Rate: toRate(trifectaBox5Hits, validRaces),
    superfectaBox4Rate: toRate(superfectaBox4Hits, superfectaRaces),
    superfectaBox5Rate: toRate(superfectaBox5Hits, superfectaRaces),
    superfectaBox6Rate: toRate(superfectaBox6Hits, superfectaRaces),

    analyzedAt: new Date().toISOString(),
    analysisTimeMs,
    unmatchedFiles,
  };

  // Cache the results
  await setCachedResults(results, contentHash);

  logger.logInfo('Diagnostics analysis complete', {
    component: 'Diagnostics',
    totalRaces: validRaces,
    topPickWinRate: results.topPickWinRate,
    timeMs: analysisTimeMs,
  });

  return results;
}

/**
 * Create empty results when no data files are found.
 */
function createEmptyResults(unmatchedFiles: string[]): DiagnosticsResults {
  return {
    totalFiles: 0,
    totalRaces: 0,
    totalHorses: 0,
    totalTracks: 0,
    dateRange: '',
    topPickWinRate: 0,
    topPickPlaceRate: 0,
    topPickShowRate: 0,
    topPickWins: 0,
    topPickPlaces: 0,
    topPickShows: 0,
    validRaces: 0,
    tierPerformance: [],
    trackSummaries: [],
    exactaBox2Rate: 0,
    exactaBox3Rate: 0,
    exactaBox4Rate: 0,
    trifectaBox3Rate: 0,
    trifectaBox4Rate: 0,
    trifectaBox5Rate: 0,
    superfectaBox4Rate: 0,
    superfectaBox5Rate: 0,
    superfectaBox6Rate: 0,
    analyzedAt: new Date().toISOString(),
    analysisTimeMs: 0,
    unmatchedFiles,
  };
}

// Re-export cache clear for rerun functionality
export { clearDiagnosticsCache };
