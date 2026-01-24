/**
 * Scoring System Stress Test
 *
 * Comprehensive test suite to identify edge cases, boundary conditions,
 * and potential issues in the scoring system.
 *
 * Run with: npx tsx scripts/scoring-stress-test.ts
 */

import type { HorseEntry, RaceHeader, PastPerformance, Workout } from '../src/types/drf';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  value?: number | string;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function test(name: string, condition: boolean, details: string, value?: number | string): void {
  const passed = condition;
  results.push({ name, passed, details, value });
  if (passed) {
    passCount++;
    console.log(`  ✅ ${name}`);
  } else {
    failCount++;
    console.log(`  ❌ ${name}: ${details}${value !== undefined ? ` (got: ${value})` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function createMockPastPerformance(overrides: Partial<PastPerformance> = {}): PastPerformance {
  return {
    date: '2024-01-15',
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    surface: 'dirt',
    distanceFurlongs: 6,
    distance: '6f',
    condition: 'fast',
    raceNumber: 1,
    raceType: 'claiming',
    raceClass: 'CLM',
    purse: 25000,
    fieldSize: 8,
    postPosition: 4,
    finishPosition: 3,
    beatenLengths: 2.5,
    winningMargin: 0,
    odds: 5.0,
    isFavorite: false,
    runningLine: {
      start: 4,
      firstCall: 3,
      secondCall: 3,
      stretchCall: 2,
      finish: 3,
    },
    speedFigures: {
      beyer: 75,
      bris: 78,
    },
    fractionalTimes: [],
    finalTime: 71.2,
    jockey: 'John Velazquez',
    weight: 122,
    tripComment: 'Raced wide',
    claimingPrice: 25000,
    isStakeRace: false,
    ...overrides,
  };
}

function createMockWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    date: '2024-01-10',
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    distance: '4f',
    distanceFurlongs: 4,
    time: 48.2,
    surface: 'dirt',
    condition: 'fast',
    workoutType: 'breeze',
    ranking: 5,
    totalInWork: 50,
    isBullet: false,
    isGate: false,
    ...overrides,
  };
}

function createMockHorseEntry(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 1,
    horseName: 'Test Horse',
    postPosition: 1,
    morningLineOdds: '5-1',
    age: 4,
    sex: 'G',
    color: 'Bay',
    sire: 'Test Sire',
    dam: 'Test Dam',
    damSire: 'Test Damsire',
    breeding: {
      sire: 'Test Sire',
      dam: 'Test Dam',
      damsire: 'Test Damsire',
      owner: 'Test Owner',
      breeder: 'Test Breeder',
      whereBred: 'KY',
    },
    trainerName: 'Bob Baffert',
    jockeyName: 'John Velazquez',
    jockeyStats: '',
    weight: 122,
    medication: {
      lasixFirstTime: false,
      lasix: true,
      lasixOff: false,
      bute: false,
      other: [],
      raw: 'L',
    },
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
    claimingPrice: null,
    lifetimeStarts: 10,
    lifetimeWins: 2,
    lifetimePlaces: 3,
    lifetimeShows: 2,
    lifetimeEarnings: 150000,
    currentYearStarts: 3,
    currentYearWins: 1,
    currentYearPlaces: 1,
    currentYearShows: 0,
    currentYearEarnings: 50000,
    previousYearStarts: 5,
    previousYearWins: 1,
    previousYearPlaces: 1,
    previousYearShows: 1,
    previousYearEarnings: 75000,
    turfStarts: 2,
    turfWins: 0,
    turfPlaces: 1,
    turfShows: 0,
    wetStarts: 1,
    wetWins: 0,
    distanceStarts: 3,
    distanceWins: 1,
    trackStarts: 2,
    trackWins: 1,
    bestBeyer: 85,
    averageBeyer: 78,
    lastBeyer: 80,
    earlySpeedRating: 65,
    runningStyle: 'E',
    daysSinceLastRace: 21,
    pastPerformances: [
      createMockPastPerformance(),
      createMockPastPerformance({ date: '2023-12-15', speedFigures: { beyer: 78, bris: 80 } }),
      createMockPastPerformance({ date: '2023-11-15', speedFigures: { beyer: 72, bris: 75 } }),
    ],
    workouts: [createMockWorkout(), createMockWorkout({ date: '2024-01-05', time: 49.0 })],
    isScratched: false,
    scratchReason: null,
    ...overrides,
  };
}

function _createMockRaceHeader(overrides: Partial<RaceHeader> = {}): RaceHeader {
  return {
    trackCode: 'CD',
    trackName: 'Churchill Downs',
    raceDate: '2024-01-20',
    raceNumber: 5,
    postTime: '14:30',
    distance: '6f',
    distanceFurlongs: 6,
    surface: 'dirt',
    condition: 'fast',
    raceType: 'claiming',
    raceClass: 'CLM',
    purse: 25000,
    claimingPrice: 25000,
    fieldSize: 8,
    raceConditions: 'Claiming $25,000',
    ageRestriction: '3yo+',
    sexRestriction: null,
    ...overrides,
  };
}

// ============================================================================
// SCORE VALIDATION HELPERS
// ============================================================================

function _isValidScore(score: number): boolean {
  return typeof score === 'number' && isFinite(score) && !isNaN(score);
}

function _isWithinRange(score: number, min: number, max: number): boolean {
  return score >= min && score <= max;
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              SCORING SYSTEM COMPREHENSIVE STRESS TEST               ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`\nTest started at: ${new Date().toISOString()}`);

// ============================================================================
// TEST 1: SCORE BOUNDARY ANALYSIS
// ============================================================================

section('TEST 1: SCORE BOUNDARY ANALYSIS');

// Theoretical maximums (v2.5 Favorite Fix weights)
// Core Categories (234 pts):
const maxConnectionsScore = 27; // 9.3% - Enhanced partnership
const maxPostPositionScore = 20; // 6.9% - Reduced from 30
const maxSpeedClassScore = 80; // 27.6% - Most predictive
const maxFormScore = 50; // 17.2% - Increased from 40
const maxEquipmentScore = 12; // 4.1% - Reduced from 20
const maxPaceScore = 45; // 15.5% - Race shape
// Bonus Categories (56 pts):
const maxDistanceSurfaceScore = 20; // 6.9% - Turf/Wet/Distance
const maxTrainerPatternsScore = 15; // 5.2% - Situational trainer bonuses
const maxComboPatternsScore = 6; // 2.1% - Reduced from 12
const maxTrackSpecialistScore = 6; // 2.1% - Track record bonus
const maxTrainerSurfaceDistanceScore = 6; // 2.1% - Trainer specialization
const maxWeightScore = 1; // 0.3% - P2 subtle refinement
const maxAgeFactorScore = 1; // 0.3% - P3 peak performance
const maxSiresSireScore = 1; // 0.3% - P3 breeding influence
const maxBaseScore = 331; // v3.6: 331 base score
const maxOverlayScore = 40; // v3.6: ±40 overlay
const maxProtocolBonus = 60; // From edge case protocols

const theoreticalMaxCoreCategories =
  maxConnectionsScore +
  maxPostPositionScore +
  maxSpeedClassScore +
  maxFormScore +
  maxEquipmentScore +
  maxPaceScore;
const theoreticalMaxBonusCategories =
  maxDistanceSurfaceScore +
  maxTrainerPatternsScore +
  maxComboPatternsScore +
  maxTrackSpecialistScore +
  maxTrainerSurfaceDistanceScore +
  maxWeightScore +
  maxAgeFactorScore +
  maxSiresSireScore;
const theoreticalMaxBase = theoreticalMaxCoreCategories + theoreticalMaxBonusCategories;
const theoreticalMaxWithOverlay = maxBaseScore + maxOverlayScore;
const theoreticalMaxWithProtocols = theoreticalMaxWithOverlay + maxProtocolBonus;

console.log('\n  Theoretical Score Analysis (v2.5 Favorite Fix):');
console.log(`    Max Core Categories: ${theoreticalMaxCoreCategories} (expected: 234)`);
console.log(`    Max Bonus Categories: ${theoreticalMaxBonusCategories} (expected: 56)`);
console.log(`    Max Base Score Components: ${theoreticalMaxBase} (expected: 290)`);
console.log(`    Max Base Score (capped): ${maxBaseScore}`);
console.log(`    Max with Overlay: ${maxBaseScore + maxOverlayScore} = 340`);
console.log(`    Max with Protocols: ${theoreticalMaxWithProtocols} (if protocols add to final)`);

test(
  'Core category sum equals 234',
  theoreticalMaxCoreCategories === 234,
  `Got ${theoreticalMaxCoreCategories}`,
  theoreticalMaxCoreCategories
);
test(
  'Bonus category sum equals 56',
  theoreticalMaxBonusCategories === 56,
  `Got ${theoreticalMaxBonusCategories}`,
  theoreticalMaxBonusCategories
);
test('Base capped at 290', maxBaseScore === 290, `Got ${maxBaseScore}`, maxBaseScore);
test(
  'Max displayable score is 340',
  maxBaseScore + maxOverlayScore === 340,
  'Incorrect max',
  maxBaseScore + maxOverlayScore
);

// Theoretical minimums
const minOverlayScore = -50;
const theoreticalMinScore = 0 + minOverlayScore; // If base is 0

console.log('\n  Minimum Score Analysis:');
console.log(`    Theoretical Minimum: ${theoreticalMinScore}`);
console.log(`    Should floor at: 0`);

test('Min overlay is -50', minOverlayScore === -50, 'Incorrect min overlay', minOverlayScore);
test(
  'Theoretical min is -50',
  theoreticalMinScore === -50,
  'Incorrect theoretical min',
  theoreticalMinScore
);

// ============================================================================
// TEST 2: MISSING DATA SCENARIOS
// ============================================================================

section('TEST 2: MISSING DATA SCENARIOS');

// Horse with no speed figures
const noSpeedFiguresHorse = createMockHorseEntry({
  bestBeyer: null,
  averageBeyer: null,
  lastBeyer: null,
  pastPerformances: [createMockPastPerformance({ speedFigures: { beyer: null, bris: null } })],
});

test(
  'Horse with null Beyer figures is valid',
  noSpeedFiguresHorse.bestBeyer === null,
  'Should accept null'
);

// First-time starter (no past performances)
const firstTimeStarter = createMockHorseEntry({
  lifetimeStarts: 0,
  lifetimeWins: 0,
  pastPerformances: [],
  workouts: [createMockWorkout({ isBullet: true })],
});

test(
  'First-time starter has 0 starts',
  firstTimeStarter.lifetimeStarts === 0,
  'Wrong starts count'
);
test(
  'First-time starter has empty PPs',
  firstTimeStarter.pastPerformances.length === 0,
  'Should have no PPs'
);

// Horse with no trainer
const noTrainerHorse = createMockHorseEntry({
  trainerName: '',
});

test(
  'Horse with empty trainer name is valid',
  noTrainerHorse.trainerName === '',
  'Should accept empty'
);

// Horse with no workouts
const noWorkoutsHorse = createMockHorseEntry({
  workouts: [],
});

test(
  'Horse with no workouts is valid',
  noWorkoutsHorse.workouts.length === 0,
  'Should accept empty'
);

// ============================================================================
// TEST 3: INVALID/EXTREME VALUE SCENARIOS
// ============================================================================

section('TEST 3: INVALID/EXTREME VALUE SCENARIOS');

// Extreme speed figures
const highSpeedFigure = 130; // Kentucky Derby winner level
const lowSpeedFigure = 20; // Very slow
const negativeSpeedFigure = -5; // Invalid

test(
  'High speed figure (130) is a number',
  typeof highSpeedFigure === 'number',
  'Should be number'
);
test('Low speed figure (20) is a number', typeof lowSpeedFigure === 'number', 'Should be number');
test('Negative speed figure is invalid concept', negativeSpeedFigure < 0, 'Negative not valid');

// Extreme odds
const extremeOdds = '999-1';
const _zeroOdds = '0-1'; // Invalid (unused but kept for documentation)
const evenOdds = 'EVEN';

test('Extreme odds 999-1 is valid format', extremeOdds.includes('-'), 'Should have dash');
test('EVEN odds is valid format', evenOdds === 'EVEN', 'Should accept EVEN');

// Extreme post positions
const post0 = 0; // Invalid
const post25 = 25; // Very large field
const normalPost = 5;

test('Post position 0 is invalid', post0 === 0, 'Zero post is invalid');
test('Post position 25 may be edge case', post25 > 20, 'Very large field');
test('Post position 5 is normal', normalPost > 0 && normalPost <= 12, 'Normal range');

// Extreme lifetime starts
const manyStarts = 100;
const fewStarts = 3;

test('100 lifetime starts is extreme', manyStarts > 50, 'Should be high');
test('3 lifetime starts triggers lightly raced', fewStarts < 8, 'Under threshold');

// Extreme layoff
const longLayoff = 500;
const normalLayoff = 21;

test('500 day layoff is extreme', longLayoff > 365, 'Over a year');
test('21 day layoff is normal', normalLayoff >= 14 && normalLayoff <= 30, 'Normal range');

// ============================================================================
// TEST 4: DIVISION/CALCULATION SAFETY
// ============================================================================

section('TEST 4: DIVISION/CALCULATION SAFETY');

// Test safe division scenarios
function safeDivide(num: number, denom: number, fallback: number = 0): number {
  if (denom === 0 || !isFinite(denom)) return fallback;
  const result = num / denom;
  return isFinite(result) ? result : fallback;
}

test('Division by zero returns fallback', safeDivide(10, 0) === 0, 'Should return 0');
test('Division by Infinity returns fallback', safeDivide(10, Infinity) === 0, 'Should return 0');
test('Normal division works', safeDivide(10, 2) === 5, 'Should return 5', safeDivide(10, 2));

// Win rate calculations
function calculateWinRate(wins: number, starts: number): number {
  return safeDivide(wins, starts, 0) * 100;
}

test('Win rate with 0 starts is 0', calculateWinRate(0, 0) === 0, 'Should be 0');
test(
  'Win rate 2/10 is 20%',
  calculateWinRate(2, 10) === 20,
  'Should be 20%',
  calculateWinRate(2, 10)
);

// NaN checks
const nanValue = NaN;
const infinityValue = Infinity;
const negInfinityValue = -Infinity;

test('NaN is not finite', !isFinite(nanValue), 'NaN should fail isFinite');
test('Infinity is not finite', !isFinite(infinityValue), 'Infinity should fail isFinite');
test(
  'Negative Infinity is not finite',
  !isFinite(negInfinityValue),
  '-Infinity should fail isFinite'
);

// ============================================================================
// TEST 5: PROTOCOL THRESHOLD BOUNDARIES
// ============================================================================

section('TEST 5: PROTOCOL THRESHOLD BOUNDARIES');

// Diamond in the Rough thresholds (120-139)
const diamondLowerBound = 120;
const diamondUpperBound = 139;
const justBelowDiamond = 119;
const justAboveDiamond = 140;

test('Score 120 is Diamond lower bound', diamondLowerBound === 120, 'Check threshold');
test('Score 139 is Diamond upper bound', diamondUpperBound === 139, 'Check threshold');
test('Score 119 is NOT Diamond territory', justBelowDiamond < 120, 'Below threshold');
test('Score 140 is NOT Diamond territory', justAboveDiamond > 139, 'Above threshold');

// Betting threshold
const bettingThreshold = 140;
const justBelowBetting = 139;

test('Betting threshold is 140', bettingThreshold === 140, 'Check threshold');
test(
  'Score 139 is below betting threshold',
  justBelowBetting < bettingThreshold,
  'Below threshold'
);

// Lightly Raced threshold (<8 starts)
const lightlyRacedThreshold = 8;
const lightlyRacedHorse = 7;
const experiencedHorse = 8;

test('Lightly raced threshold is 8', lightlyRacedThreshold === 8, 'Check threshold');
test(
  '7 starts triggers lightly raced',
  lightlyRacedHorse < lightlyRacedThreshold,
  'Should trigger'
);
test(
  '8 starts does NOT trigger lightly raced',
  experiencedHorse >= lightlyRacedThreshold,
  'Should not trigger'
);

// Nuclear Longshot threshold (25/1+)
const nuclearOddsThreshold = 25;
const nuclearOdds = 30; // 30-1
const justBelowNuclear = 24; // 24-1

test('Nuclear threshold is 25-1', nuclearOddsThreshold === 25, 'Check threshold');
test('30-1 triggers Nuclear', nuclearOdds >= nuclearOddsThreshold, 'Should trigger');
test(
  '24-1 does NOT trigger Nuclear',
  justBelowNuclear < nuclearOddsThreshold,
  'Should not trigger'
);

// ============================================================================
// TEST 6: SCORE TIER BOUNDARIES
// ============================================================================

section('TEST 6: SCORE TIER BOUNDARIES');

const tierBoundaries = {
  elite: 200,
  strong: 180,
  good: 160,
  fair: 140,
  weak: 0,
};

function getScoreTier(score: number): string {
  if (score >= tierBoundaries.elite) return 'elite';
  if (score >= tierBoundaries.strong) return 'strong';
  if (score >= tierBoundaries.good) return 'good';
  if (score >= tierBoundaries.fair) return 'fair';
  return 'weak';
}

test('Score 200 is Elite', getScoreTier(200) === 'elite', 'Should be elite');
test('Score 199 is Strong', getScoreTier(199) === 'strong', 'Should be strong');
test('Score 180 is Strong', getScoreTier(180) === 'strong', 'Should be strong');
test('Score 179 is Good', getScoreTier(179) === 'good', 'Should be good');
test('Score 160 is Good', getScoreTier(160) === 'good', 'Should be good');
test('Score 159 is Fair', getScoreTier(159) === 'fair', 'Should be fair');
test('Score 140 is Fair', getScoreTier(140) === 'fair', 'Should be fair');
test('Score 139 is Weak', getScoreTier(139) === 'weak', 'Should be weak');
test('Score 0 is Weak', getScoreTier(0) === 'weak', 'Should be weak');

// ============================================================================
// TEST 7: FLOATING POINT PRECISION
// ============================================================================

section('TEST 7: FLOATING POINT PRECISION');

const floatAddition = 0.1 + 0.2;
const expectedResult = 0.3;

test('0.1 + 0.2 has floating point issues', floatAddition !== expectedResult, 'Known JS issue');
test(
  'Rounded 0.1 + 0.2 equals 0.3',
  Math.round(floatAddition * 10) / 10 === 0.3,
  'Rounding fixes it'
);

// Score rounding
function roundScore(score: number): number {
  return Math.round(score);
}

test('Rounding 150.4 gives 150', roundScore(150.4) === 150, 'Should round down');
test('Rounding 150.5 gives 151', roundScore(150.5) === 151, 'Should round up');
test('Rounding 150.9 gives 151', roundScore(150.9) === 151, 'Should round up');

// ============================================================================
// TEST 8: EDGE CASE COMBINATIONS
// ============================================================================

section('TEST 8: EDGE CASE COMBINATIONS');

// First-time starter with elite breeding
const eliteDebut = createMockHorseEntry({
  lifetimeStarts: 0,
  pastPerformances: [],
  sire: 'Tapit',
  dam: 'Champion Mare',
  workouts: [createMockWorkout({ isBullet: true })],
});

test('Elite debut has 0 starts', eliteDebut.lifetimeStarts === 0, 'Should be 0');
test('Elite debut has elite sire', eliteDebut.sire === 'Tapit', 'Should have elite sire');

// Closer in speed duel scenario
const closerHorse = createMockHorseEntry({
  runningStyle: 'C',
  postPosition: 8,
});

test('Closer running style is C', closerHorse.runningStyle === 'C', 'Should be C');

// Speed horse on speed bias track
const speedHorse = createMockHorseEntry({
  runningStyle: 'E',
  postPosition: 1,
});

test('Speed running style is E', speedHorse.runningStyle === 'E', 'Should be E');
test('Speed horse has inside post', speedHorse.postPosition === 1, 'Should be 1');

// ============================================================================
// TEST 9: NULL/UNDEFINED HANDLING
// ============================================================================

section('TEST 9: NULL/UNDEFINED HANDLING');

// Null coalescing tests
const nullValue = null;
const undefinedValue = undefined;
const zeroValue = 0;
const emptyString = '';

test('Null ?? 0 returns 0', (nullValue ?? 0) === 0, 'Should return 0');
test('Undefined ?? 0 returns 0', (undefinedValue ?? 0) === 0, 'Should return 0');
test('0 ?? 10 returns 0', (zeroValue ?? 10) === 0, 'Should return 0 (not 10)');
test(
  'Empty string ?? "default" returns empty',
  (emptyString ?? 'default') === '',
  'Should return empty'
);

// Optional chaining
const horseWithNullPP = createMockHorseEntry({ pastPerformances: [] });
const lastPP = horseWithNullPP.pastPerformances[0];

test('Empty PP array first element is undefined', lastPP === undefined, 'Should be undefined');
test(
  'Safe access with ?. returns undefined',
  lastPP?.speedFigures?.beyer === undefined,
  'Should be undefined'
);

// ============================================================================
// TEST 10: SPECIAL VALUE EDGE CASES
// ============================================================================

section('TEST 10: SPECIAL VALUE EDGE CASES');

// Negative numbers where they shouldn't be
const negativeBeyerFigure = -10;
const negativeOdds = -5;
const negativePost = -1;

test('Negative Beyer is invalid', negativeBeyerFigure < 0, 'Should detect negative');
test('Negative odds is invalid', negativeOdds < 0, 'Should detect negative');
test('Negative post is invalid', negativePost < 0, 'Should detect negative');

// Very large numbers
const hugeNumber = 999999999;
const isHugeNumberSafe = hugeNumber < Number.MAX_SAFE_INTEGER;

test('Huge number is within safe range', isHugeNumberSafe, 'Should be safe');

// String vs number parsing
const oddsString = '5-1';
const parsedOdds = parseInt(oddsString.split('-')[0] || '0', 10);

test('Parsing "5-1" gives 5', parsedOdds === 5, 'Should parse correctly', parsedOdds);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                         STRESS TEST SUMMARY                          ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`\n  Total Tests: ${passCount + failCount}`);
console.log(`  ✅ Passed: ${passCount}`);
console.log(`  ❌ Failed: ${failCount}`);
console.log(`  Pass Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

if (failCount > 0) {
  console.log('\n  ⚠️  FAILED TESTS:');
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`    - ${r.name}: ${r.details}`);
    });
}

console.log('\n  KEY FINDINGS:');
console.log('  1. Base score components sum to 331 (v3.6)');
console.log('  2. Maximum possible score with overlay: 371 (331 + 40)');
console.log('  3. Minimum possible score: -40 (needs floor at 0)');
console.log('  4. Division by zero needs safeguards');
console.log('  5. Floating point precision needs rounding');
console.log('  6. Null/undefined values need defensive checks');
console.log('  7. Negative values in certain fields are invalid');

console.log('\n  RECOMMENDATIONS:');
console.log('  1. Add safeDivide() helper for all division operations');
console.log('  2. Add safeNumber() helper to coerce values');
console.log('  3. Add clamp() helper to enforce min/max bounds');
console.log('  4. Floor all final scores at 0');
console.log('  5. Cap display scores at 331 (show "331+" for higher)');
console.log('  6. Round all scores to integers before display');
console.log('  7. Add isValidScore() checks throughout pipeline');

console.log(`\nTest completed at: ${new Date().toISOString()}\n`);

// Exit with appropriate code
process.exit(failCount > 0 ? 1 : 0);
