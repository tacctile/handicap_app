/**
 * Smoke test for AI integration
 * Run with: npx tsx src/scripts/testAISingleRace.ts
 *
 * Verifies the AI pipeline works end-to-end:
 * - Prompt builds correctly
 * - Gemini API responds
 * - Response parses into AIRaceAnalysis type
 * - No runtime errors
 */

// Load environment variables from .env.local for Node.js context
import 'dotenv/config';

import { getAIAnalysis, checkAIServiceStatus } from '../services/ai';
import { createDefaultTrainerCategoryStats } from '../types/drf';
import type { ParsedRace, RaceHeader, HorseEntry, PastPerformance } from '../types/drf';
import type { RaceScoringResult, HorseScoreForAI, RaceAnalysis } from '../types/scoring';

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-12-26',
    track: 'CD',
    trackName: 'Churchill Downs',
    raceNumber: 3,
    distanceFurlongs: 6,
    distance: '6f',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'maiden',
    claimingPrice: null,
    purse: 45000,
    fieldSize: 8,
    finishPosition: 2,
    lengthsBehind: 1.5,
    lengthsAhead: null,
    finalTime: 69.4,
    finalTimeFormatted: '1:09.4',
    speedFigures: {
      beyer: 82,
      timeformUS: null,
      equibase: null,
      trackVariant: null,
      dirtVariant: null,
      turfVariant: null,
    },
    runningLine: {
      start: 2,
      quarterMile: 2,
      quarterMileLengths: 1,
      halfMile: 2,
      halfMileLengths: 1.5,
      threeQuarters: null,
      threeQuartersLengths: null,
      stretch: 2,
      stretchLengths: 1,
      finish: 2,
      finishLengths: 1.5,
    },
    jockey: 'Test Jockey',
    weight: 120,
    apprenticeAllowance: 0,
    equipment: '',
    medication: 'L',
    winner: 'Other Horse',
    secondPlace: 'Test Horse',
    thirdPlace: 'Third Horse',
    tripComment: 'Tracked pace, stayed on',
    comment: '',
    odds: 3.5,
    favoriteRank: 2,
    wasClaimed: false,
    claimedFrom: null,
    daysSinceLast: 21,
    earlyPace1: null,
    latePace: null,
    quarterTime: null,
    halfMileTime: null,
    sixFurlongTime: null,
    mileTime: null,
    ...overrides,
  };
}

function createMockHorse(
  programNumber: number,
  name: string,
  runningStyle: string,
  lastBeyer: number,
  morningLineOdds: string
): HorseEntry {
  return {
    programNumber,
    entryIndicator: '',
    postPosition: programNumber,
    horseName: name,
    age: 3,
    sex: 'c',
    sexFull: 'Colt',
    color: 'Bay',
    breeding: {
      sire: 'Test Sire',
      sireOfSire: 'Grandsire',
      dam: 'Test Dam',
      damSire: 'Broodmare Sire',
      breeder: 'Test Breeder',
      whereBred: 'KY',
      studFee: null,
    },
    owner: 'Test Owner',
    silks: 'Red',
    trainerName: 'Test Trainer',
    trainerStats: '20% Win',
    trainerMeetStarts: 50,
    trainerMeetWins: 10,
    trainerMeetPlaces: 8,
    trainerMeetShows: 7,
    trainerCategoryStats: createDefaultTrainerCategoryStats(),
    jockeyName: 'Test Jockey',
    jockeyStats: '18% Win',
    jockeyMeetStarts: 100,
    jockeyMeetWins: 18,
    jockeyMeetPlaces: 15,
    jockeyMeetShows: 12,
    weight: 120,
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
    morningLineOdds,
    morningLineDecimal: parseFloat(morningLineOdds.split('-')[0]),
    currentOdds: null,
    lifetimeStarts: lastBeyer > 0 ? 5 : 0,
    lifetimeWins: lastBeyer > 80 ? 1 : 0,
    lifetimePlaces: 1,
    lifetimeShows: 1,
    lifetimeEarnings: 25000,
    currentYearStarts: 3,
    currentYearWins: 1,
    currentYearPlaces: 1,
    currentYearShows: 0,
    currentYearEarnings: 20000,
    previousYearStarts: 2,
    previousYearWins: 0,
    previousYearPlaces: 0,
    previousYearShows: 1,
    previousYearEarnings: 5000,
    trackStarts: 2,
    trackWins: 1,
    trackPlaces: 0,
    trackShows: 0,
    surfaceStarts: 4,
    surfaceWins: 1,
    distanceStarts: 3,
    distanceWins: 1,
    distancePlaces: 1,
    distanceShows: 0,
    turfStarts: 0,
    turfWins: 0,
    turfPlaces: 0,
    turfShows: 0,
    wetStarts: 1,
    wetWins: 0,
    wetPlaces: 0,
    wetShows: 1,
    daysSinceLastRace: lastBeyer > 0 ? 21 : null,
    lastRaceDate: lastBeyer > 0 ? '2024-12-26' : null,
    averageBeyer: lastBeyer > 0 ? lastBeyer - 2 : null,
    bestBeyer: lastBeyer > 0 ? lastBeyer + 3 : null,
    lastBeyer: lastBeyer > 0 ? lastBeyer : null,
    earlySpeedRating: runningStyle.includes('E') ? 85 : 60,
    runningStyle,
    pedigreeRating: null,
    claimingPrice: null,
    lastClaimPrice: null,
    trainerAngle: null,
    workouts: [
      {
        date: '2025-01-10',
        track: 'CD',
        distanceFurlongs: 5,
        distance: '5f',
        timeSeconds: 60.2,
        timeFormatted: '1:00.2',
        type: 'handily',
        trackCondition: 'fast',
        surface: 'dirt',
        ranking: '3/25',
        rankNumber: 3,
        totalWorks: 25,
        isBullet: false,
        fromGate: false,
        notes: '',
      },
    ],
    pastPerformances:
      lastBeyer > 0
        ? [
            createMockPastPerformance({
              speedFigures: {
                beyer: lastBeyer,
                timeformUS: null,
                equibase: null,
                trackVariant: null,
                dirtVariant: null,
                turfVariant: null,
              },
              tripComment: 'Tracked pace, stayed on',
            }),
          ]
        : [],
    isScratched: false,
    scratchReason: null,
    isCoupledMain: false,
    coupledWith: [],
    rawLine: '',
    salePrice: null,
    saleLocation: null,
  };
}

function createMockRaceHeader(): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    trackLocation: 'Louisville, KY',
    raceNumber: 1,
    raceDate: '2025-01-16',
    raceDateRaw: '20250116',
    postTime: '1:00 PM',
    distanceFurlongs: 6,
    distance: '6f',
    distanceExact: '6 furlongs',
    surface: 'dirt',
    trackCondition: 'fast',
    classification: 'maiden',
    raceType: 'MSW',
    purse: 50000,
    purseFormatted: '$50,000',
    ageRestriction: '3YO',
    sexRestriction: '',
    weightConditions: '',
    stateBred: null,
    claimingPriceMin: null,
    claimingPriceMax: null,
    allowedWeight: null,
    conditions: 'Maiden Special Weight',
    raceName: null,
    grade: null,
    isListed: false,
    isAbout: false,
    tempRail: null,
    turfCourseType: null,
    chuteStart: false,
    hasReplay: false,
    programNumber: 1,
    fieldSize: 6,
    probableFavorite: null,
  };
}

// ============================================================================
// MOCK SCORING RESULT FACTORY
// ============================================================================

function createMockHorseScore(
  programNumber: number,
  horseName: string,
  rank: number,
  finalScore: number,
  runningStyle: string,
  lastBeyer: number
): HorseScoreForAI {
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  if (lastBeyer > 85) positiveFactors.push('Top speed figure');
  if (runningStyle === 'E') positiveFactors.push('Early speed advantage');
  if (runningStyle === 'C') positiveFactors.push('Strong closing ability');
  if (lastBeyer === 0) negativeFactors.push('First time starter - no form');
  if (rank > 4) negativeFactors.push('Lower class level');

  return {
    programNumber,
    horseName,
    rank,
    finalScore,
    confidenceTier: rank <= 2 ? 'high' : rank <= 4 ? 'medium' : 'low',
    breakdown: {
      speedScore: lastBeyer > 0 ? Math.min(60, Math.round(lastBeyer * 0.7)) : 15,
      classScore: Math.max(20, 48 - rank * 5),
      formScore: lastBeyer > 0 ? 28 : 8,
      paceScore: runningStyle.includes('E') ? 32 : runningStyle === 'C' ? 28 : 24,
      connectionScore: 22,
    },
    positiveFactors,
    negativeFactors,
    isScratched: false,
  };
}

function createMockRaceAnalysis(): RaceAnalysis {
  return {
    paceScenario: {
      expectedPace: 'moderate',
      likelyLeader: 1,
      speedDuelProbability: 0.35,
      earlySpeedCount: 2,
    },
    fieldStrength: 'average',
    vulnerableFavorite: false,
    likelyPaceCollapse: false,
  };
}

function createMockScoringResult(horses: HorseEntry[]): RaceScoringResult {
  // Sort by a simple scoring heuristic: lastBeyer + style bonus
  const horseData = horses.map((h, i) => ({
    horse: h,
    score:
      (h.lastBeyer || 50) +
      (h.runningStyle?.includes('E') ? 10 : 0) +
      (h.morningLineDecimal < 5 ? 5 : 0),
  }));

  horseData.sort((a, b) => b.score - a.score);

  const scores: HorseScoreForAI[] = horseData.map((item, index) => {
    const h = item.horse;
    // Generate a reasonable final score based on position
    const baseScore = 200 - index * 15;
    return createMockHorseScore(
      h.programNumber,
      h.horseName,
      index + 1,
      baseScore,
      h.runningStyle || 'P',
      h.lastBeyer || 0
    );
  });

  return {
    scores,
    raceAnalysis: createMockRaceAnalysis(),
  };
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function runTest() {
  console.log('='.repeat(60));
  console.log('AI INTEGRATION SMOKE TEST');
  console.log('='.repeat(60));

  // Step 1: Check service status
  console.log('\n[1] Checking AI service status...');
  const status = checkAIServiceStatus();
  console.log(`    Status: ${status}`);

  if (status === 'offline') {
    console.log('\n❌ AI service is offline. Check:');
    console.log('   - VITE_GEMINI_API_KEY is set in .env.local');
    console.log('   - You have internet connectivity');
    console.log('\n   To set up:');
    console.log('   1. Create .env.local file in project root');
    console.log('   2. Add: VITE_GEMINI_API_KEY=your_api_key_here');
    process.exit(1);
  }

  // Step 2: Create mock race data
  console.log('\n[2] Creating mock race data...');
  const mockRace: ParsedRace = {
    header: createMockRaceHeader(),
    horses: [
      createMockHorse(1, 'Speed Demon', 'E', 88, '3-1'),
      createMockHorse(2, 'Closing Fast', 'C', 85, '5-1'),
      createMockHorse(3, 'Class Dropper', 'P', 82, '2-1'),
      createMockHorse(4, 'First Timer', 'U', 0, '10-1'),
      createMockHorse(5, 'Mud Lover', 'E/P', 78, '8-1'),
      createMockHorse(6, 'Longshot Lou', 'S', 72, '20-1'),
    ],
    warnings: [],
    errors: [],
  };
  console.log(`    Created race with ${mockRace.horses.length} horses`);

  // Step 3: Create mock scoring result
  console.log('\n[3] Creating mock scoring result...');
  const scoringResult = createMockScoringResult(mockRace.horses);
  console.log(`    Scored ${scoringResult.scores.length} horses`);
  console.log('    Top 3 by algorithm:');
  scoringResult.scores
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .forEach((s) =>
      console.log(`      #${s.programNumber} ${s.horseName}: ${s.finalScore} pts (Rank ${s.rank})`)
    );

  // Step 4: Call AI analysis
  console.log('\n[4] Calling AI analysis (this may take 5-10 seconds)...');
  const startTime = Date.now();

  try {
    const aiAnalysis = await getAIAnalysis(mockRace, scoringResult);
    const elapsed = Date.now() - startTime;

    console.log(`    ✓ AI responded in ${elapsed}ms`);
    console.log('\n[5] AI Analysis Results:');
    console.log('-'.repeat(60));
    console.log(`    Race Narrative: ${aiAnalysis.raceNarrative}`);
    console.log(`    Confidence: ${aiAnalysis.confidence}`);
    console.log(`    Bettable: ${aiAnalysis.bettableRace}`);
    console.log(`    Top Pick: ${aiAnalysis.topPick ? '#' + aiAnalysis.topPick : 'None'}`);
    console.log(`    Value Play: ${aiAnalysis.valuePlay ? '#' + aiAnalysis.valuePlay : 'None'}`);
    console.log(`    Vulnerable Favorite: ${aiAnalysis.vulnerableFavorite}`);
    console.log(`    Likely Upset: ${aiAnalysis.likelyUpset}`);
    console.log(`    Chaotic Race: ${aiAnalysis.chaoticRace}`);

    console.log('\n    Horse Insights:');
    aiAnalysis.horseInsights
      .sort((a, b) => a.projectedFinish - b.projectedFinish)
      .forEach((h) => {
        console.log(`      ${h.projectedFinish}. #${h.programNumber} ${h.horseName}`);
        console.log(`         Label: ${h.valueLabel}`);
        console.log(`         Insight: ${h.oneLiner}`);
      });

    console.log('\n' + '='.repeat(60));
    console.log('✅ SMOKE TEST PASSED');
    console.log('='.repeat(60));
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`\n❌ AI call failed after ${elapsed}ms:`);
    console.log(error);
    process.exit(1);
  }
}

runTest();
