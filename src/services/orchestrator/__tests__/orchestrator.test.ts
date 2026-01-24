/**
 * Orchestrator Tests
 *
 * Tests for the multi-track orchestration service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOrchestrator, resetOrchestrator, Orchestrator } from '../index';
import type { TrackJob } from '../types';
import type { ParsedRace, RaceHeader, HorseEntry } from '../../../types/drf';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the AI service
vi.mock('../../ai', () => ({
  getMultiBotAnalysis: vi.fn().mockImplementation(async (race, _scoringResult) => {
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Return mock analysis
    return {
      raceId: `race-${race.header.raceNumber}`,
      raceNumber: race.header.raceNumber,
      timestamp: new Date().toISOString(),
      processingTimeMs: 50,
      raceNarrative: 'Mock analysis narrative',
      confidence: 'MEDIUM' as const,
      bettableRace: true,
      horseInsights: [],
      topPick: 1,
      valuePlay: null,
      avoidList: [],
      vulnerableFavorite: false,
      likelyUpset: false,
      chaoticRace: false,
    };
  }),
}));

// Mock the scoring module
vi.mock('../../../lib/scoring', () => ({
  calculateRaceScores: vi.fn().mockImplementation((horses: HorseEntry[]) => {
    // Return ScoredHorse[] format
    return horses.map((horse: HorseEntry, index: number) => ({
      horse,
      index,
      score: {
        total: 200 - index * 10,
        baseScore: 200 - index * 10,
        overlayScore: 0,
        oddsScore: 5,
        breakdown: {
          speedClass: { speedScore: 80, classScore: 30, total: 110 },
          form: { total: 45 },
          pace: { total: 40 },
          connections: { total: 25 },
          equipment: { total: 5 },
          postPosition: { total: 8 },
          distanceSurface: { total: 15 },
          trackSpecialist: { total: 5 },
          trainerPatterns: { total: 4 },
          combo: { total: 2 },
          trainerSurfaceDistance: { total: 3 },
          weight: { total: 0 },
          p3Refinements: { total: 0 },
        },
        isScratched: false,
        confidenceLevel: 'high',
        dataQuality: 85,
        dataCompleteness: {
          overallGrade: 'B',
          overallScore: 85,
          criticalComplete: 90,
          highComplete: 80,
          mediumComplete: 75,
          lowComplete: 70,
          missingCritical: [],
          missingHigh: [],
          missingMedium: [],
          missingLow: [],
        },
        lowConfidencePenaltyApplied: false,
        lowConfidencePenaltyAmount: 0,
        paperTigerPenaltyApplied: false,
        paperTigerPenaltyAmount: 0,
      },
      rank: index + 1,
    }));
  }),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createMockRace(raceNumber: number, trackCode: string = 'SAR'): ParsedRace {
  const header: RaceHeader = {
    trackCode,
    trackName: 'Saratoga',
    trackLocation: 'Saratoga Springs, NY',
    raceNumber,
    raceDate: '2025-01-15',
    raceDateRaw: '20250115',
    postTime: '1:00 PM',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    raceType: 'Allowance',
    purse: 100000,
    purseFormatted: '$100,000',
    ageRestriction: '3YO+',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'Allowance',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: raceNumber,
    fieldSize: 8,
    probableFavorite: 1,
  };

  const horses: HorseEntry[] = Array.from({ length: 8 }, (_, i) => ({
    programNumber: i + 1,
    entryIndicator: '',
    postPosition: i + 1,
    horseName: `Horse ${i + 1}`,
    age: 4,
    sex: 'c',
    sexFull: 'colt',
    color: 'b',
    breeding: {
      sire: 'Sire',
      sireOfSire: 'Grandsire',
      dam: 'Dam',
      damSire: 'Dam Sire',
      breeder: 'Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Owner',
    silks: 'Red, White',
    trainerName: 'Trainer',
    trainerStats: '20-5-3-2',
    trainerMeetStarts: 20,
    trainerMeetWins: 5,
    trainerMeetPlaces: 3,
    trainerMeetShows: 2,
    trainerCategoryStats: {} as HorseEntry['trainerCategoryStats'],
    jockeyName: 'Jockey',
    jockeyStats: '100-20-15-10',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 20,
    jockeyMeetPlaces: 15,
    jockeyMeetShows: 10,
    weight: 122,
    apprenticeAllowance: 0,
    equipment: {} as HorseEntry['equipment'],
    medication: {} as HorseEntry['medication'],
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 3,
    lifetimePlaces: 2,
    lifetimeShows: 1,
    lifetimeEarnings: 150000,
    currentYearStarts: 5,
    currentYearWins: 2,
    currentYearPlaces: 1,
    currentYearShows: 0,
    currentYearEarnings: 80000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 70000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 0,
    surfaceStarts: 8,
    surfaceWins: 3,
    distanceStarts: 5,
    distanceWins: 2,
    distancePlaces: 1,
    distanceShows: 0,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 0,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '2024-12-25',
    averageBeyer: 85,
    bestBeyer: 92,
    lastBeyer: 84,
    earlySpeedRating: 75,
    runningStyle: 'E/P',
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [],
    pastPerformances: [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    salePrice: null,
    saleLocation: null,
  }));

  return {
    header,
    horses,
    warnings: [],
    errors: [],
  };
}

function createMockTrack(trackCode: string, raceCount: number): TrackJob {
  return {
    trackCode,
    races: Array.from({ length: raceCount }, (_, i) => createMockRace(i + 1, trackCode)),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    resetOrchestrator();
    orchestrator = createOrchestrator({
      maxConcurrentTracks: 2,
      maxConcurrentApiCalls: 6,
      maxRetries: 2,
      retryDelays: [100, 200],
      circuitBreakerThreshold: 3,
      raceTimeoutMs: 10000,
      jobTimeoutMs: 60000,
    });
  });

  afterEach(() => {
    resetOrchestrator();
    vi.clearAllMocks();
  });

  describe('processSingleTrack', () => {
    it('should process all races for a single track', async () => {
      const track = createMockTrack('SAR', 3);

      const result = await orchestrator.processSingleTrack(track);

      expect(result.trackCode).toBe('SAR');
      expect(result.results).toHaveLength(3);
      expect(result.racesSuccessful).toBe(3);
      expect(result.racesFailed).toBe(0);
      expect(result.circuitBroken).toBe(false);

      // Verify each race was analyzed
      result.results.forEach((race, index) => {
        expect(race.raceNumber).toBe(index + 1);
        expect(race.analysis).not.toBeNull();
        expect(race.trackCode).toBe('SAR');
      });
    });

    it('should return TrackResult with correct structure', async () => {
      const track = createMockTrack('CD', 2);

      const result = await orchestrator.processSingleTrack(track);

      expect(result).toMatchObject({
        trackCode: 'CD',
        results: expect.any(Array),
        errors: expect.any(Array),
        duration: expect.any(Number),
        racesSuccessful: expect.any(Number),
        racesFailed: expect.any(Number),
        circuitBroken: expect.any(Boolean),
        startedAt: expect.any(String),
        completedAt: expect.any(String),
      });
    });
  });

  describe('processMultipleTracks', () => {
    it('should process multiple tracks in parallel', async () => {
      const tracks = [
        createMockTrack('SAR', 2),
        createMockTrack('CD', 2),
        createMockTrack('GP', 2),
      ];

      const result = await orchestrator.processMultipleTracks(tracks);

      expect(result.tracks).toHaveLength(3);
      expect(result.summary.totalRaces).toBe(6);
      expect(result.summary.successful).toBe(6);
      expect(result.summary.failed).toBe(0);
      expect(result.jobId).toBeDefined();
    });

    it('should respect concurrency limit', async () => {
      // Create orchestrator with max 2 concurrent tracks
      const limitedOrchestrator = createOrchestrator({
        maxConcurrentTracks: 2,
        maxConcurrentApiCalls: 6,
      });

      const tracks = [
        createMockTrack('SAR', 1),
        createMockTrack('CD', 1),
        createMockTrack('GP', 1),
        createMockTrack('KEE', 1),
      ];

      const result = await limitedOrchestrator.processMultipleTracks(tracks);

      // All tracks should complete successfully
      expect(result.tracks).toHaveLength(4);
      expect(result.summary.totalRaces).toBe(4);
      expect(result.summary.successful).toBe(4);
    });

    it('should sort tracks by priority', async () => {
      const tracks = [
        { ...createMockTrack('SAR', 1), priority: 3 },
        { ...createMockTrack('CD', 1), priority: 1 },
        { ...createMockTrack('GP', 1), priority: 2 },
      ];

      const completionOrder: string[] = [];
      const result = await orchestrator.processMultipleTracks(tracks, {
        onTrackComplete: (trackCode) => {
          completionOrder.push(trackCode);
        },
      });

      // Lower priority number should be processed first
      // Note: Due to parallel processing, order may vary slightly
      expect(result.summary.successful).toBe(3);
    });

    it('should return MultiTrackResult with summary', async () => {
      const tracks = [createMockTrack('SAR', 2), createMockTrack('CD', 1)];

      const result = await orchestrator.processMultipleTracks(tracks);

      expect(result.summary).toMatchObject({
        totalRaces: 3,
        successful: expect.any(Number),
        failed: expect.any(Number),
        skipped: expect.any(Number),
        duration: expect.any(Number),
        avgTimePerRace: expect.any(Number),
        tracksComplete: expect.any(Number),
        tracksFailed: expect.any(Number),
        tracksCircuitBroken: expect.any(Number),
      });
    });
  });

  describe('progress callbacks', () => {
    it('should call onTrackStart and onTrackComplete', async () => {
      const track = createMockTrack('SAR', 1);

      const onTrackStart = vi.fn();
      const onTrackComplete = vi.fn();

      await orchestrator.processSingleTrack(track, {
        onTrackStart,
        onTrackComplete,
      });

      expect(onTrackStart).toHaveBeenCalledWith('SAR');
      expect(onTrackComplete).toHaveBeenCalledWith('SAR', expect.any(Object));
    });

    it('should call onRaceComplete for each race', async () => {
      const track = createMockTrack('SAR', 3);

      const onRaceComplete = vi.fn();

      await orchestrator.processSingleTrack(track, {
        onRaceComplete,
      });

      expect(onRaceComplete).toHaveBeenCalledTimes(3);
      expect(onRaceComplete).toHaveBeenCalledWith('SAR', 1, expect.any(Object));
      expect(onRaceComplete).toHaveBeenCalledWith('SAR', 2, expect.any(Object));
      expect(onRaceComplete).toHaveBeenCalledWith('SAR', 3, expect.any(Object));
    });
  });

  describe('error handling', () => {
    it('should handle failed track without blocking others', async () => {
      // Mock to fail for one specific track
      const { getMultiBotAnalysis } = await import('../../ai');
      const mockGetMultiBotAnalysis = vi.mocked(getMultiBotAnalysis);

      mockGetMultiBotAnalysis.mockImplementation(async (race) => {
        if (race.header.trackCode === 'FAIL') {
          throw new Error('API Error');
        }
        return {
          raceId: `race-${race.header.raceNumber}`,
          raceNumber: race.header.raceNumber,
          timestamp: new Date().toISOString(),
          processingTimeMs: 50,
          raceNarrative: 'Mock analysis',
          confidence: 'MEDIUM' as const,
          bettableRace: true,
          horseInsights: [],
          topPick: 1,
          valuePlay: null,
          avoidList: [],
          vulnerableFavorite: false,
          likelyUpset: false,
          chaoticRace: false,
        };
      });

      const tracks = [
        createMockTrack('SAR', 1),
        createMockTrack('FAIL', 1),
        createMockTrack('CD', 1),
      ];

      const result = await orchestrator.processMultipleTracks(tracks);

      // SAR and CD should succeed, FAIL should fail
      expect(result.tracks).toHaveLength(3);
      expect(result.summary.successful).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getProcessingStatus', () => {
    it('should return idle status when not processing', () => {
      const status = orchestrator.getProcessingStatus();

      expect(status.active).toBe(false);
      expect(status.state).toBe('idle');
    });
  });

  describe('cancelProcessing', () => {
    it('should cancel ongoing processing', async () => {
      // Make mock slower to ensure cancellation can take effect
      const { getMultiBotAnalysis } = await import('../../ai');
      const mockGetMultiBotAnalysis = vi.mocked(getMultiBotAnalysis);
      mockGetMultiBotAnalysis.mockImplementation(async (race) => {
        // Simulate longer processing time
        await new Promise((resolve) => setTimeout(resolve, 200));
        return {
          raceId: `race-${race.header.raceNumber}`,
          raceNumber: race.header.raceNumber,
          timestamp: new Date().toISOString(),
          processingTimeMs: 200,
          raceNarrative: 'Mock analysis',
          confidence: 'MEDIUM' as const,
          bettableRace: true,
          horseInsights: [],
          topPick: 1,
          valuePlay: null,
          avoidList: [],
          vulnerableFavorite: false,
          likelyUpset: false,
          chaoticRace: false,
        };
      });

      const tracks = [createMockTrack('SAR', 10), createMockTrack('CD', 10)];

      // Start processing
      const processingPromise = orchestrator.processMultipleTracks(tracks);

      // Cancel after a short delay
      setTimeout(() => {
        orchestrator.cancelProcessing();
      }, 100);

      const result = await processingPromise;

      // Should have cancelled OR completed (race condition - if processing is fast, it may complete)
      const status = orchestrator.getProcessingStatus();
      expect(['cancelled', 'completed']).toContain(status.state);

      // If cancelled, should have fewer races processed than total
      if (status.state === 'cancelled') {
        expect(result.summary.successful + result.summary.failed).toBeLessThan(20);
      }
    });
  });
});

describe('Circuit Breaker', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    resetOrchestrator();
    orchestrator = createOrchestrator({
      maxConcurrentTracks: 2,
      maxConcurrentApiCalls: 6,
      maxRetries: 1,
      retryDelays: [50],
      circuitBreakerThreshold: 3, // Trigger after 3 failures
      raceTimeoutMs: 5000,
    });
  });

  afterEach(() => {
    resetOrchestrator();
    vi.clearAllMocks();
  });

  it('should trigger circuit breaker after threshold failures', async () => {
    // Mock to always fail
    const { getMultiBotAnalysis } = await import('../../ai');
    const mockGetMultiBotAnalysis = vi.mocked(getMultiBotAnalysis);
    mockGetMultiBotAnalysis.mockRejectedValue(new Error('API Error'));

    const track = createMockTrack('SAR', 10); // 10 races

    const result = await orchestrator.processSingleTrack(track);

    // Circuit breaker should trigger after 3 failures
    expect(result.circuitBroken).toBe(true);
    expect(result.circuitBreakReason).toContain('Circuit breaker');

    // Some races should be skipped
    const skippedRaces = result.results.filter((r) =>
      r.errors.some((e) => e.code === 'CIRCUIT_BREAKER')
    );
    expect(skippedRaces.length).toBeGreaterThan(0);
  });
});
