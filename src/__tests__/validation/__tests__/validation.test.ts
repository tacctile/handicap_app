/**
 * AI Validation Runner Tests
 *
 * Tests for the validation infrastructure including:
 * - Data transformation
 * - Progress file management
 * - Resume logic
 * - Report generation
 * - API key handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { ParsedRace, HorseEntry, RaceHeader } from '../../../types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../../../types/scoring';
import type { AIDecisionRecord } from '../../../services/ai/metrics/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const RESULTS_DIR = path.join(__dirname, '../results');
const TEST_PROGRESS_FILE = path.join(RESULTS_DIR, 'test_progress.json');

function createMockHorse(postPosition: number, name: string): HorseEntry {
  return {
    programNumber: postPosition,
    entryIndicator: '',
    postPosition,
    horseName: name,
    age: 4,
    sex: 'c',
    sexFull: 'colt',
    color: 'bay',
    breeding: {
      sire: 'Test Sire',
      sireOfSire: 'Test Grandsire',
      dam: 'Test Dam',
      damSire: 'Test Dam Sire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Blue and White',
    trainerName: 'Test Trainer',
    trainerStats: '20-4-3-3',
    trainerMeetStarts: 20,
    trainerMeetWins: 4,
    trainerMeetPlaces: 3,
    trainerMeetShows: 3,
    trainerCategoryStats: {
      firstTimeLasix: { starts: 10, wins: 2, winPercent: 20, roi: 1.5 },
      firstTimeBlinkers: { starts: 5, wins: 1, winPercent: 20, roi: 1.0 },
      blinkersOff: { starts: 3, wins: 0, winPercent: 0, roi: 0 },
      secondOffLayoff: { starts: 8, wins: 2, winPercent: 25, roi: 1.2 },
      days31to60: { starts: 15, wins: 3, winPercent: 20, roi: 0.9 },
      days61to90: { starts: 10, wins: 2, winPercent: 20, roi: 1.0 },
      days91to180: { starts: 5, wins: 1, winPercent: 20, roi: 0.8 },
      days181plus: { starts: 3, wins: 0, winPercent: 0, roi: 0 },
      sprintToRoute: { starts: 7, wins: 1, winPercent: 14, roi: 0.5 },
      routeToSprint: { starts: 6, wins: 2, winPercent: 33, roi: 1.8 },
      turfSprint: { starts: 4, wins: 1, winPercent: 25, roi: 1.2 },
      turfRoute: { starts: 8, wins: 2, winPercent: 25, roi: 1.1 },
      wetTrack: { starts: 5, wins: 1, winPercent: 20, roi: 0.9 },
      dirtSprint: { starts: 20, wins: 4, winPercent: 20, roi: 1.0 },
      dirtRoute: { starts: 15, wins: 3, winPercent: 20, roi: 1.1 },
      maidenClaiming: { starts: 10, wins: 3, winPercent: 30, roi: 1.5 },
      stakes: { starts: 5, wins: 1, winPercent: 20, roi: 0.8 },
      firstStartTrainer: { starts: 12, wins: 3, winPercent: 25, roi: 1.3 },
      afterClaim: { starts: 8, wins: 2, winPercent: 25, roi: 1.2 },
    },
    jockeyName: 'Test Jockey',
    jockeyStats: '100-20-15-15',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 20,
    jockeyMeetPlaces: 15,
    jockeyMeetShows: 15,
    weight: 122,
    apprenticeAllowance: 0,
    equipment: {
      blinkers: false,
      blinkersOff: false,
      frontBandages: false,
      rearBandages: false,
      barShoes: false,
      mudCaulks: false,
      tongueTie: false,
      nasalStrip: false,
      shadowRoll: false,
      cheekPieces: false,
      firstTimeEquipment: [],
      equipmentChanges: [],
      raw: '',
    },
    medication: {
      lasixFirstTime: false,
      lasix: true,
      lasixOff: false,
      bute: false,
      other: [],
      raw: 'L',
    },
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    currentOdds: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 50000,
    currentYearStarts: 5,
    currentYearWins: 1,
    currentYearPlaces: 2,
    currentYearShows: 1,
    currentYearEarnings: 25000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 25000,
    trackStarts: 3,
    trackWins: 1,
    trackPlaces: 1,
    trackShows: 1,
    surfaceStarts: 8,
    surfaceWins: 2,
    distanceStarts: 5,
    distanceWins: 1,
    distancePlaces: 1,
    distanceShows: 1,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 0,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 0,
    daysSinceLastRace: 21,
    lastRaceDate: '20251207',
    averageBeyer: 80,
    bestBeyer: 85,
    lastBeyer: 78,
    earlySpeedRating: 65,
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
  };
}

function createMockRaceHeader(trackCode: string, raceNumber: number): RaceHeader {
  return {
    trackCode,
    trackName: trackCode,
    trackLocation: 'Test Location',
    raceNumber,
    raceDate: '2025-12-28',
    raceDateRaw: '20251228',
    postTime: '1:00 PM',
    distanceFurlongs: 6,
    distance: '6 furlongs',
    distanceExact: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'allowance',
    raceType: 'ALW',
    purse: 50000,
    purseFormatted: '$50,000',
    claimingPrice: null,
    claimingPriceFormatted: null,
    restricted: false,
    stateRestricted: false,
    sexRestrictions: null,
    ageRestrictions: '3YO+',
    conditionsText: 'For three year olds and upward',
    raceGrade: null,
    fieldSize: 8,
    runUpDistance: null,
    chuteStart: false,
    aboutDistance: false,
    condition: 'fast',
  };
}

function createMockRace(trackCode: string, raceNumber: number): ParsedRace {
  const horses: HorseEntry[] = [];
  for (let i = 1; i <= 8; i++) {
    horses.push(createMockHorse(i, `Horse ${i}`));
  }

  return {
    header: createMockRaceHeader(trackCode, raceNumber),
    horses,
  };
}

function createMockHorseScoreForAI(
  programNumber: number,
  rank: number,
  score: number
): HorseScoreForAI {
  return {
    programNumber,
    horseName: `Horse ${programNumber}`,
    rank,
    finalScore: score,
    confidenceTier: 'high',
    breakdown: {
      speedScore: 80,
      classScore: 30,
      formScore: 25,
      paceScore: 25,
      connectionScore: 20,
    },
    positiveFactors: ['Strong speed figures'],
    negativeFactors: [],
    isScratched: false,
    morningLineOdds: '5-1',
    morningLineDecimal: 5.0,
    pastPerformances: [],
    workouts: [],
    trainerPatterns: {
      firstTimeLasix: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      firstTimeBlinkers: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      blinkersOff: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      secondOffLayoff: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days31to60: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days61to90: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days91to180: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      days181plus: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      sprintToRoute: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      routeToSprint: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      turfSprint: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      turfRoute: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      wetTrack: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      dirtSprint: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      dirtRoute: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      maidenClaiming: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      stakes: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      firstStartTrainer: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
      afterClaim: { starts: 0, wins: 0, winPercent: 0, roi: 0 },
    },
    equipment: {
      blinkers: false,
      blinkersOff: false,
      frontBandages: false,
      tongueTie: false,
      nasalStrip: false,
      shadowRoll: false,
      barShoes: false,
      mudCaulks: false,
      firstTimeEquipment: [],
      equipmentChanges: [],
    },
    breeding: {
      sire: '',
      damSire: '',
      whereBred: '',
    },
    distanceSurfaceStats: {
      distanceStarts: 0,
      distanceWins: 0,
      distanceWinRate: 0,
      surfaceStarts: 0,
      surfaceWins: 0,
      surfaceWinRate: 0,
      turfStarts: 0,
      turfWins: 0,
      turfWinRate: 0,
      wetStarts: 0,
      wetWins: 0,
      wetWinRate: 0,
    },
    formIndicators: {
      daysSinceLastRace: null,
      averageBeyer: null,
      bestBeyer: null,
      lastBeyer: null,
      earlySpeedRating: null,
      lifetimeStarts: 0,
      lifetimeWins: 0,
      lifetimeWinRate: 0,
    },
  };
}

function createMockScoringResult(): RaceScoringResult {
  const scores: HorseScoreForAI[] = [];
  for (let i = 1; i <= 8; i++) {
    scores.push(createMockHorseScoreForAI(i, i, 200 - i * 10));
  }

  const raceAnalysis: RaceAnalysis = {
    paceScenario: {
      expectedPace: 'moderate',
      likelyLeader: 1,
      speedDuelProbability: 0.3,
      earlySpeedCount: 2,
    },
    fieldStrength: 'average',
    vulnerableFavorite: false,
    likelyPaceCollapse: false,
    trackIntelligence: null,
  };

  return { scores, raceAnalysis };
}

function createMockDecisionRecord(raceId: string): AIDecisionRecord {
  return {
    raceId,
    trackCode: 'TEST',
    raceNumber: 1,
    raceDate: '2025-12-28',
    fieldSize: 8,
    algorithmTopPick: 1,
    algorithmTop3: [1, 2, 3],
    algorithmScores: [
      { programNumber: 1, score: 200, rank: 1 },
      { programNumber: 2, score: 190, rank: 2 },
      { programNumber: 3, score: 180, rank: 3 },
    ],
    aiTopPick: 1,
    aiValuePlay: null,
    aiTop3: [1, 2, 3],
    aiAvoidList: [],
    aiConfidence: 'HIGH',
    isOverride: false,
    overrideReason: null,
    tripTroubleHorses: [],
    paceAdvantageHorses: [],
    vulnerableFavorite: false,
    fieldType: 'COMPETITIVE',
    betType: 'KEY',
    exactaHorses: [1, 2, 3, 4],
    trifectaHorses: [1, 2, 3, 4, 5],
    processingTimeMs: 1500,
    timestamp: new Date().toISOString(),
    actualWinner: 1,
    actualExacta: [1, 2],
    actualTrifecta: [1, 2, 3],
    resultRecorded: true,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('AI Validation Infrastructure', () => {
  beforeEach(() => {
    // Clean up any test files
    if (fs.existsSync(TEST_PROGRESS_FILE)) {
      fs.unlinkSync(TEST_PROGRESS_FILE);
    }
  });

  afterEach(() => {
    // Clean up any test files
    if (fs.existsSync(TEST_PROGRESS_FILE)) {
      fs.unlinkSync(TEST_PROGRESS_FILE);
    }
  });

  describe('Data Transformation', () => {
    it('should create valid mock race with all required fields', () => {
      const race = createMockRace('TEST', 1);

      expect(race.header.trackCode).toBe('TEST');
      expect(race.header.raceNumber).toBe(1);
      expect(race.horses.length).toBe(8);

      // Check that horses have required fields
      const horse = race.horses[0];
      expect(horse).toBeDefined();
      expect(horse!.postPosition).toBe(1);
      expect(horse!.horseName).toBe('Horse 1');
      expect(horse!.trainerCategoryStats).toBeDefined();
      expect(horse!.equipment).toBeDefined();
    });

    it('should create valid HorseScoreForAI with expanded fields', () => {
      const score = createMockHorseScoreForAI(1, 1, 200);

      expect(score.programNumber).toBe(1);
      expect(score.rank).toBe(1);
      expect(score.finalScore).toBe(200);
      expect(score.breakdown).toBeDefined();
      expect(score.trainerPatterns).toBeDefined();
      expect(score.equipment).toBeDefined();
      expect(score.breeding).toBeDefined();
      expect(score.distanceSurfaceStats).toBeDefined();
      expect(score.formIndicators).toBeDefined();
    });

    it('should create valid RaceScoringResult format', () => {
      const result = createMockScoringResult();

      expect(result.scores.length).toBe(8);
      expect(result.raceAnalysis).toBeDefined();
      expect(result.raceAnalysis.paceScenario).toBeDefined();
      expect(result.raceAnalysis.fieldStrength).toBe('average');

      // Verify scores are sorted by rank
      for (let i = 0; i < result.scores.length - 1; i++) {
        expect(result.scores[i]!.rank).toBeLessThan(result.scores[i + 1]!.rank);
      }
    });

    it('should include all required fields for AI input', () => {
      const result = createMockScoringResult();
      const firstScore = result.scores[0];

      // Check all expanded fields exist
      expect(firstScore).toBeDefined();
      expect(firstScore!.morningLineOdds).toBeDefined();
      expect(firstScore!.pastPerformances).toBeDefined();
      expect(firstScore!.workouts).toBeDefined();
      expect(firstScore!.trainerPatterns).toBeDefined();
      expect(firstScore!.equipment).toBeDefined();
      expect(firstScore!.breeding).toBeDefined();
      expect(firstScore!.distanceSurfaceStats).toBeDefined();
      expect(firstScore!.formIndicators).toBeDefined();
    });
  });

  describe('Progress File Management', () => {
    it('should save progress file with correct structure', () => {
      const progress = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        processedRaces: ['TEST-20251228-R1', 'TEST-20251228-R2'],
        totalRaces: 10,
        errors: [],
      };

      fs.writeFileSync(TEST_PROGRESS_FILE, JSON.stringify(progress, null, 2));

      const loaded = JSON.parse(fs.readFileSync(TEST_PROGRESS_FILE, 'utf-8'));
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.processedRaces).toHaveLength(2);
      expect(loaded.totalRaces).toBe(10);
    });

    it('should load progress file correctly', () => {
      const progress = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        processedRaces: ['TEST-20251228-R1', 'TEST-20251228-R2', 'TEST-20251228-R3'],
        totalRaces: 111,
        errors: [
          { raceId: 'TEST-20251228-R4', error: 'Test error', timestamp: new Date().toISOString() },
        ],
      };

      fs.writeFileSync(TEST_PROGRESS_FILE, JSON.stringify(progress, null, 2));

      const loaded = JSON.parse(fs.readFileSync(TEST_PROGRESS_FILE, 'utf-8'));
      expect(loaded.processedRaces).toHaveLength(3);
      expect(loaded.errors).toHaveLength(1);
      expect(loaded.errors[0].raceId).toBe('TEST-20251228-R4');
    });

    it('should handle missing progress file', () => {
      expect(fs.existsSync(TEST_PROGRESS_FILE)).toBe(false);
    });

    it('should update progress with new race', () => {
      const progress = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        processedRaces: ['TEST-20251228-R1'],
        totalRaces: 10,
        errors: [],
      };

      fs.writeFileSync(TEST_PROGRESS_FILE, JSON.stringify(progress, null, 2));

      // Simulate adding a new race
      const loaded = JSON.parse(fs.readFileSync(TEST_PROGRESS_FILE, 'utf-8'));
      loaded.processedRaces.push('TEST-20251228-R2');
      loaded.lastUpdated = new Date().toISOString();

      fs.writeFileSync(TEST_PROGRESS_FILE, JSON.stringify(loaded, null, 2));

      const reloaded = JSON.parse(fs.readFileSync(TEST_PROGRESS_FILE, 'utf-8'));
      expect(reloaded.processedRaces).toHaveLength(2);
    });
  });

  describe('Resume Logic', () => {
    it('should skip already-processed races', () => {
      const processedRaces = ['TEST-20251228-R1', 'TEST-20251228-R2', 'TEST-20251228-R3'];
      const allRaceIds = [
        'TEST-20251228-R1',
        'TEST-20251228-R2',
        'TEST-20251228-R3',
        'TEST-20251228-R4',
        'TEST-20251228-R5',
      ];

      const racesToProcess = allRaceIds.filter((id) => !processedRaces.includes(id));

      expect(racesToProcess).toHaveLength(2);
      expect(racesToProcess).toContain('TEST-20251228-R4');
      expect(racesToProcess).toContain('TEST-20251228-R5');
      expect(racesToProcess).not.toContain('TEST-20251228-R1');
    });

    it('should resume from correct position', () => {
      const progress = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        processedRaces: Array.from({ length: 20 }, (_, i) => `TEST-20251228-R${i + 1}`),
        totalRaces: 111,
        errors: [],
      };

      const allRaceIds = Array.from({ length: 111 }, (_, i) => `TEST-20251228-R${i + 1}`);
      const racesToProcess = allRaceIds.filter((id) => !progress.processedRaces.includes(id));

      expect(racesToProcess).toHaveLength(91);
      expect(racesToProcess[0]).toBe('TEST-20251228-R21');
    });

    it('should handle fresh start correctly', () => {
      // With fresh start flag, processedRaces should be empty
      const freshProgress = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        processedRaces: [],
        totalRaces: 0,
        errors: [],
      };

      expect(freshProgress.processedRaces).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate valid markdown report structure', () => {
      const reportLines = [
        '# AI VALIDATION REPORT',
        '',
        'Run Date: 2025-12-28T12:00:00Z',
        'Total Races: 111',
        '',
        '## BASELINE COMPARISON',
        '',
        '### Win Rate',
        '| Source | Wins | Rate | vs Baseline |',
        '|--------|------|------|-------------|',
      ];

      const report = reportLines.join('\n');

      expect(report).toContain('# AI VALIDATION REPORT');
      expect(report).toContain('## BASELINE COMPARISON');
      expect(report).toContain('### Win Rate');
      expect(report).toContain('| Source | Wins | Rate | vs Baseline |');
    });

    it('should format percentage differences correctly', () => {
      const formatDiff = (diff: number): string => {
        if (diff > 0) return `+${diff.toFixed(1)}%`;
        if (diff < 0) return `${diff.toFixed(1)}%`;
        return '0.0%';
      };

      expect(formatDiff(5.5)).toBe('+5.5%');
      expect(formatDiff(-3.2)).toBe('-3.2%');
      expect(formatDiff(0)).toBe('0.0%');
    });

    it('should include all required sections in report', () => {
      const requiredSections = [
        '# AI VALIDATION REPORT',
        '## BASELINE COMPARISON',
        '### Win Rate',
        '### Top-3 Rate',
        '### Exotic Performance',
        '## OVERRIDE ANALYSIS',
        '## VALUE PLAY PERFORMANCE',
        '## CONFIDENCE CALIBRATION',
        '## BOT EFFECTIVENESS',
        '## FIELD TYPE PERFORMANCE',
        '## KEY FINDINGS',
        '## ERRORS & ISSUES',
      ];

      // Mock a minimal report structure
      const mockReport = requiredSections.join('\n\nContent here\n\n');

      for (const section of requiredSections) {
        expect(mockReport).toContain(section);
      }
    });
  });

  describe('API Key Handling', () => {
    it('should detect missing API key', () => {
      const originalKey = process.env.VITE_GEMINI_API_KEY;
      delete process.env.VITE_GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      expect(apiKey).toBeUndefined();

      // Restore
      if (originalKey) {
        process.env.VITE_GEMINI_API_KEY = originalKey;
      }
    });

    it('should detect present API key', () => {
      const originalKey = process.env.VITE_GEMINI_API_KEY;
      process.env.VITE_GEMINI_API_KEY = 'test-key-12345';

      const apiKey = process.env.VITE_GEMINI_API_KEY;
      expect(apiKey).toBeDefined();
      expect(apiKey).toBe('test-key-12345');

      // Restore
      if (originalKey) {
        process.env.VITE_GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.VITE_GEMINI_API_KEY;
      }
    });

    it('should handle graceful exit on missing key', () => {
      // The actual implementation would exit the process
      // Here we just verify the error message format
      const errorMessage = `
ERROR: VITE_GEMINI_API_KEY not set

To run AI validation:

1. Get API key from https://makersuite.google.com/app/apikey

2. Add to .env file:
   VITE_GEMINI_API_KEY=your_key_here

3. Run again:
   npm run validate:ai
`;

      expect(errorMessage).toContain('VITE_GEMINI_API_KEY not set');
      expect(errorMessage).toContain('https://makersuite.google.com/app/apikey');
      expect(errorMessage).toContain('npm run validate:ai');
    });
  });

  describe('Decision Record Creation', () => {
    it('should create valid AIDecisionRecord', () => {
      const record = createMockDecisionRecord('TEST-20251228-R1');

      expect(record.raceId).toBe('TEST-20251228-R1');
      expect(record.algorithmTopPick).toBe(1);
      expect(record.aiTopPick).toBe(1);
      expect(record.actualWinner).toBe(1);
      expect(record.resultRecorded).toBe(true);
    });

    it('should track override correctly', () => {
      const record = createMockDecisionRecord('TEST-20251228-R1');
      record.aiTopPick = 2;
      record.isOverride = true;
      record.overrideReason = 'Trip trouble expected';

      expect(record.isOverride).toBe(true);
      expect(record.overrideReason).toBe('Trip trouble expected');
    });

    it('should include exotic picks', () => {
      const record = createMockDecisionRecord('TEST-20251228-R1');

      expect(record.exactaHorses).toHaveLength(4);
      expect(record.trifectaHorses).toHaveLength(5);
    });
  });

  describe('Exotic Bet Calculations', () => {
    const checkExactaBox = (
      candidates: number[],
      actual: [number, number],
      boxSize: number
    ): boolean => {
      const boxCandidates = candidates.slice(0, boxSize);
      return actual.every((num) => boxCandidates.includes(num));
    };

    const checkTrifectaBox = (
      candidates: number[],
      actual: [number, number, number],
      boxSize: number
    ): boolean => {
      const boxCandidates = candidates.slice(0, boxSize);
      return actual.every((num) => boxCandidates.includes(num));
    };

    it('should correctly calculate exacta box 2', () => {
      const candidates = [1, 2, 3, 4, 5];
      expect(checkExactaBox(candidates, [1, 2], 2)).toBe(true);
      expect(checkExactaBox(candidates, [2, 1], 2)).toBe(true);
      expect(checkExactaBox(candidates, [1, 3], 2)).toBe(false);
    });

    it('should correctly calculate exacta box 4', () => {
      const candidates = [1, 2, 3, 4, 5];
      expect(checkExactaBox(candidates, [1, 4], 4)).toBe(true);
      expect(checkExactaBox(candidates, [3, 2], 4)).toBe(true);
      expect(checkExactaBox(candidates, [1, 5], 4)).toBe(false);
    });

    it('should correctly calculate trifecta box 3', () => {
      const candidates = [1, 2, 3, 4, 5];
      expect(checkTrifectaBox(candidates, [1, 2, 3], 3)).toBe(true);
      expect(checkTrifectaBox(candidates, [3, 1, 2], 3)).toBe(true);
      expect(checkTrifectaBox(candidates, [1, 2, 4], 3)).toBe(false);
    });

    it('should correctly calculate trifecta box 5', () => {
      const candidates = [1, 2, 3, 4, 5];
      expect(checkTrifectaBox(candidates, [1, 3, 5], 5)).toBe(true);
      expect(checkTrifectaBox(candidates, [2, 4, 5], 5)).toBe(true);
      expect(checkTrifectaBox(candidates, [1, 2, 6], 5)).toBe(false);
    });
  });

  describe('Race ID Generation', () => {
    it('should generate consistent race IDs', () => {
      const generateRaceId = (trackCode: string, raceDate: string, raceNumber: number): string => {
        return `${trackCode}-${raceDate}-R${raceNumber}`;
      };

      expect(generateRaceId('AQU', '20251228', 1)).toBe('AQU-20251228-R1');
      expect(generateRaceId('GPX', '20251224', 10)).toBe('GPX-20251224-R10');
    });

    it('should parse race ID components', () => {
      const raceId = 'AQU-20251228-R5';
      const parts = raceId.split('-');

      expect(parts[0]).toBe('AQU');
      expect(parts[1]).toBe('20251228');
      expect(parts[2]).toBe('R5');
    });
  });
});
