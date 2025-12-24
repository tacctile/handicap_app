/**
 * Comprehensive DRF (Daily Racing Form) Type Definitions
 *
 * These interfaces cover all critical data fields from DRF files including:
 * - Race header information
 * - Horse data (current race)
 * - Past performance history
 * - Workout data
 * - Breeding/pedigree information
 * - Equipment and medication
 */

// ============================================================================
// SURFACE & TRACK CONDITIONS
// ============================================================================

export type Surface = 'dirt' | 'turf' | 'synthetic' | 'all-weather';

// Dirt conditions: fast (best) → good → slow → muddy → sloppy → heavy (worst)
// Turf conditions: firm (best) → good → yielding → soft → heavy (worst)
export type TrackCondition =
  | 'fast' // Dirt: optimal, dry
  | 'good' // Both: slightly off
  | 'slow' // Dirt: drying out, between good and muddy
  | 'muddy' // Dirt: wet, holding moisture
  | 'sloppy' // Dirt: standing water
  | 'heavy' // Both: deep, very wet
  | 'firm' // Turf: optimal, dry
  | 'yielding' // Turf: soft but not soggy
  | 'soft'; // Turf: wetter than yielding

export type WorkoutType = 'breeze' | 'handily' | 'driving' | 'easy' | 'unknown';

// ============================================================================
// RACE CLASSIFICATION
// ============================================================================

export type RaceClassification =
  | 'maiden'
  | 'maiden-claiming'
  | 'claiming'
  | 'allowance'
  | 'allowance-optional-claiming'
  | 'starter-allowance'
  | 'stakes'
  | 'stakes-listed'
  | 'stakes-graded-3'
  | 'stakes-graded-2'
  | 'stakes-graded-1'
  | 'handicap'
  | 'unknown';

// ============================================================================
// EQUIPMENT & MEDICATION
// ============================================================================

export interface Equipment {
  /** Blinkers (B) */
  blinkers: boolean;
  /** Blinkers off (first time without) */
  blinkersOff: boolean;
  /** Front bandages */
  frontBandages: boolean;
  /** Rear bandages */
  rearBandages: boolean;
  /** Bar shoes */
  barShoes: boolean;
  /** Mud caulks */
  mudCaulks: boolean;
  /** Tongue tie */
  tongueTie: boolean;
  /** Nasal strip */
  nasalStrip: boolean;
  /** Shadow roll */
  shadowRoll: boolean;
  /** Cheek pieces */
  cheekPieces: boolean;
  /** First time equipment on (any) */
  firstTimeEquipment: string[];
  /** Equipment changes from last race */
  equipmentChanges: string[];
  /** Raw equipment string from DRF */
  raw: string;
}

export interface Medication {
  /** Lasix (L) - first time */
  lasixFirstTime: boolean;
  /** Lasix continuing */
  lasix: boolean;
  /** Lasix off (previously on) */
  lasixOff: boolean;
  /** Bute */
  bute: boolean;
  /** Other medications */
  other: string[];
  /** Raw medication string from DRF */
  raw: string;
}

// ============================================================================
// BREEDING / PEDIGREE
// ============================================================================

export interface Breeding {
  /** Sire (father) name */
  sire: string;
  /** Sire's sire (paternal grandsire) */
  sireOfSire: string;
  /** Dam (mother) name */
  dam: string;
  /** Dam's sire (maternal grandsire / broodmare sire) */
  damSire: string;
  /** Breeder name */
  breeder: string;
  /** State/country where bred */
  whereBred: string;
  /** Stud fee if available */
  studFee: number | null;
}

// ============================================================================
// RUNNING LINE / CALL POSITIONS
// ============================================================================

export interface RunningLine {
  /** Position at start/break */
  start: number | null;
  /** Position at 1/4 mile call */
  quarterMile: number | null;
  /** Lengths behind at 1/4 mile */
  quarterMileLengths: number | null;
  /** Position at 1/2 mile call */
  halfMile: number | null;
  /** Lengths behind at 1/2 mile */
  halfMileLengths: number | null;
  /** Position at 3/4 mile (6f) call */
  threeQuarters: number | null;
  /** Lengths behind at 3/4 mile */
  threeQuartersLengths: number | null;
  /** Position at stretch call */
  stretch: number | null;
  /** Lengths behind at stretch */
  stretchLengths: number | null;
  /** Final position */
  finish: number | null;
  /** Lengths behind at finish */
  finishLengths: number | null;
}

// ============================================================================
// SPEED FIGURES
// ============================================================================

export interface SpeedFigures {
  /** Beyer Speed Figure */
  beyer: number | null;
  /** TimeformUS rating */
  timeformUS: number | null;
  /** Equibase Speed Figure */
  equibase: number | null;
  /** Track variant for the day */
  trackVariant: number | null;
  /** Daily track variant for dirt */
  dirtVariant: number | null;
  /** Daily track variant for turf */
  turfVariant: number | null;
}

// ============================================================================
// PAST PERFORMANCE (Last 10 races)
// ============================================================================

export interface PastPerformance {
  /** Race date (YYYYMMDD or similar) */
  date: string;
  /** Track code */
  track: string;
  /** Track name (full) */
  trackName: string;
  /** Race number */
  raceNumber: number;
  /** Distance in furlongs */
  distanceFurlongs: number;
  /** Formatted distance string */
  distance: string;
  /** Surface */
  surface: Surface;
  /** Track condition */
  trackCondition: TrackCondition;
  /** Race classification */
  classification: RaceClassification;
  /** Claiming price (if applicable) */
  claimingPrice: number | null;
  /** Purse amount */
  purse: number;
  /** Number of starters */
  fieldSize: number;
  /** Finish position */
  finishPosition: number;
  /** Lengths behind winner (0 if won) */
  lengthsBehind: number;
  /** Lengths ahead of next horse (if applicable) */
  lengthsAhead: number | null;
  /** Final time in seconds */
  finalTime: number | null;
  /** Final time formatted (e.g., "1:10.45") */
  finalTimeFormatted: string;
  /** Speed figures for this race */
  speedFigures: SpeedFigures;
  /** Running line at each call point */
  runningLine: RunningLine;
  /** Jockey name */
  jockey: string;
  /** Weight carried */
  weight: number;
  /** Apprentice allowance (lbs) */
  apprenticeAllowance: number;
  /** Equipment used */
  equipment: string;
  /** Medication */
  medication: string;
  /** Winner's name */
  winner: string;
  /** Second place horse */
  secondPlace: string;
  /** Third place horse */
  thirdPlace: string;
  /** Trip comment from chart caller */
  tripComment: string;
  /** Extended comment/notes */
  comment: string;
  /** Odds in this race */
  odds: number | null;
  /** Favorite indicator (1=favorite, etc.) */
  favoriteRank: number | null;
  /** Claimed in this race */
  wasClaimed: boolean;
  /** Claimed from (if applicable) */
  claimedFrom: string | null;
  /** Days since previous race */
  daysSinceLast: number | null;
  /** Early Pace 1 (EP1) figure - rating at first call (DRF Fields 816-825) */
  earlyPace1: number | null;
  /** Late Pace figure - closing ability rating (DRF Fields 846-855) */
  latePace: number | null;
}

// ============================================================================
// WORKOUT DATA
// ============================================================================

export interface Workout {
  /** Workout date */
  date: string;
  /** Track where worked */
  track: string;
  /** Distance in furlongs */
  distanceFurlongs: number;
  /** Formatted distance string */
  distance: string;
  /** Time in seconds */
  timeSeconds: number;
  /** Formatted time (e.g., ":47.20") */
  timeFormatted: string;
  /** Type of work (breeze, handily, etc.) */
  type: WorkoutType;
  /** Track condition during workout */
  trackCondition: TrackCondition;
  /** Surface worked on */
  surface: Surface;
  /** Rank among works that day (e.g., "2 of 35") */
  ranking: string;
  /** Number rank */
  rankNumber: number | null;
  /** Total works that day at track/distance */
  totalWorks: number | null;
  /** Bullet work indicator (fastest of day) */
  isBullet: boolean;
  /** From gate indicator */
  fromGate: boolean;
  /** Notes/comments */
  notes: string;
  /** Debug: raw field value before conversion (for troubleshooting) */
  _rawDistanceValue?: number;
  /** Debug: how the raw value was interpreted */
  _interpretedFormat?: string;
}

// ============================================================================
// HORSE ENTRY (Current Race)
// ============================================================================

export interface HorseEntry {
  /** Program number (saddle cloth) */
  programNumber: number;
  /** Entry indicator (A, B for coupled entries) */
  entryIndicator: string;
  /** Post position */
  postPosition: number;
  /** Horse name */
  horseName: string;
  /** Horse age in years */
  age: number;
  /** Sex (c=colt, f=filly, g=gelding, h=horse, m=mare, r=ridgling) */
  sex: string;
  /** Sex full name */
  sexFull: string;
  /** Color (b=bay, ch=chestnut, dk b=dark bay, gr=gray, ro=roan, etc.) */
  color: string;
  /** Breeding/pedigree information */
  breeding: Breeding;
  /** Owner name */
  owner: string;
  /** Owner silks description */
  silks: string;
  /** Trainer name */
  trainerName: string;
  /** Trainer stats string (legacy, for display) */
  trainerStats: string;
  /** Trainer starts at current meet (DRF Field 29) */
  trainerMeetStarts: number;
  /** Trainer wins at current meet (DRF Field 30) */
  trainerMeetWins: number;
  /** Trainer places at current meet (DRF Field 31) */
  trainerMeetPlaces: number;
  /** Trainer shows at current meet (DRF Field 32) */
  trainerMeetShows: number;
  /** Jockey name */
  jockeyName: string;
  /** Jockey stats string (legacy, for display) */
  jockeyStats: string;
  /** Jockey starts at current meet (DRF Field 35) */
  jockeyMeetStarts: number;
  /** Jockey wins at current meet (DRF Field 36) */
  jockeyMeetWins: number;
  /** Jockey places at current meet (DRF Field 37) */
  jockeyMeetPlaces: number;
  /** Jockey shows at current meet (DRF Field 38) */
  jockeyMeetShows: number;
  /** Weight carried */
  weight: number;
  /** Apprentice allowance claimed */
  apprenticeAllowance: number;
  /** Equipment details */
  equipment: Equipment;
  /** Medication details */
  medication: Medication;
  /** Morning line odds (string like "5-1") */
  morningLineOdds: string;
  /** Morning line odds as decimal */
  morningLineDecimal: number;
  /** Current odds (if available from tote) */
  currentOdds: string | null;
  /** Lifetime starts */
  lifetimeStarts: number;
  /** Lifetime wins */
  lifetimeWins: number;
  /** Lifetime places (2nd) */
  lifetimePlaces: number;
  /** Lifetime shows (3rd) */
  lifetimeShows: number;
  /** Lifetime earnings */
  lifetimeEarnings: number;
  /** Current year stats */
  currentYearStarts: number;
  currentYearWins: number;
  currentYearPlaces: number;
  currentYearShows: number;
  currentYearEarnings: number;
  /** Previous year stats */
  previousYearStarts: number;
  previousYearWins: number;
  previousYearPlaces: number;
  previousYearShows: number;
  previousYearEarnings: number;
  /** Stats on this track */
  trackStarts: number;
  trackWins: number;
  trackPlaces: number;
  trackShows: number;
  /** Stats on this surface */
  surfaceStarts: number;
  surfaceWins: number;
  /** Stats at this distance (current race distance) - Fields 93-96 */
  distanceStarts: number;
  distanceWins: number;
  distancePlaces: number;
  distanceShows: number;
  /** Turf stats - Fields 85-88 */
  turfStarts: number;
  turfWins: number;
  turfPlaces: number;
  turfShows: number;
  /** Wet track stats - Fields 89-92 */
  wetStarts: number;
  wetWins: number;
  wetPlaces: number;
  wetShows: number;
  /** Days since last race */
  daysSinceLastRace: number | null;
  /** Last race date */
  lastRaceDate: string | null;
  /** Average Beyer figure (last 3-4 races) */
  averageBeyer: number | null;
  /** Best Beyer figure (lifetime or last year) */
  bestBeyer: number | null;
  /** Last Beyer figure */
  lastBeyer: number | null;
  /** Average early speed rating */
  earlySpeedRating: number | null;
  /** Early pace call (E, E/P, P, S) */
  runningStyle: string;
  /** Pedigree rating for surface */
  pedigreeRating: string | null;
  /** Claiming price (if in for tag) */
  claimingPrice: number | null;
  /** Price horse was claimed for last */
  lastClaimPrice: number | null;
  /** Key trainer angle code */
  trainerAngle: string | null;
  /** Workout data (last 5) */
  workouts: Workout[];
  /** Past performances (last 10) */
  pastPerformances: PastPerformance[];
  /** Is scratched */
  isScratched: boolean;
  /** Scratch reason */
  scratchReason: string | null;
  /** Is coupled entry main */
  isCoupledMain: boolean;
  /** Coupled with program numbers */
  coupledWith: number[];
  /** Raw DRF line for debugging */
  rawLine: string;
}

// ============================================================================
// RACE HEADER
// ============================================================================

export interface RaceHeader {
  /** Track code (3 letter abbreviation) */
  trackCode: string;
  /** Track full name */
  trackName: string;
  /** Track full address/location */
  trackLocation: string;
  /** Race number */
  raceNumber: number;
  /** Race date (formatted) */
  raceDate: string;
  /** Race date raw (YYYYMMDD) */
  raceDateRaw: string;
  /** Post time */
  postTime: string;
  /** Distance in furlongs */
  distanceFurlongs: number;
  /** Distance formatted (e.g., "6 furlongs", "1 1/16 miles") */
  distance: string;
  /** Exact distance (to 1/16 mile) */
  distanceExact: string;
  /** Surface */
  surface: Surface;
  /** Track condition */
  trackCondition: TrackCondition;
  /** Race classification */
  classification: RaceClassification;
  /** Race type description */
  raceType: string;
  /** Purse amount */
  purse: number;
  /** Purse formatted */
  purseFormatted: string;
  /** Age restrictions (e.g., "3YO", "3&UP") */
  ageRestriction: string;
  /** Sex restrictions (e.g., "F&M", "C&G") */
  sexRestriction: string;
  /** Weight conditions description */
  weightConditions: string;
  /** State-bred restriction */
  stateBred: string | null;
  /** Claiming price range (if claiming race) */
  claimingPriceMin: number | null;
  claimingPriceMax: number | null;
  /** Allowed weight for age */
  allowedWeight: number | null;
  /** Conditions text */
  conditions: string;
  /** Race name (for stakes races) */
  raceName: string | null;
  /** Grade (for graded stakes) */
  grade: number | null;
  /** Is listed stakes */
  isListed: boolean;
  /** Distance about (approximate distance indicator) */
  isAbout: boolean;
  /** Temp rail position */
  tempRail: string | null;
  /** Turf course description */
  turfCourseType: string | null;
  /** Chute start indicator */
  chuteStart: boolean;
  /** Video replay available */
  hasReplay: boolean;
  /** Race card/program number for tracking */
  programNumber: number;
  /** Number of entries */
  fieldSize: number;
  /** Probable favorite (program number) */
  probableFavorite: number | null;
}

// ============================================================================
// PARSED STRUCTURES
// ============================================================================

export interface ParsedRace {
  /** Race header information */
  header: RaceHeader;
  /** All horse entries */
  horses: HorseEntry[];
  /** Validation warnings for this race */
  warnings: string[];
  /** Parse errors for this race */
  errors: string[];
}

export interface ParsedDRFFile {
  /** Original filename */
  filename: string;
  /** All parsed races */
  races: ParsedRace[];
  /** File format detected */
  format: 'csv' | 'fixed-width' | 'unknown';
  /** File version/schema if detected */
  version: string | null;
  /** Parse timestamp */
  parsedAt: string;
  /** Overall file validation status */
  isValid: boolean;
  /** Global warnings */
  warnings: string[];
  /** Global errors */
  errors: string[];
  /** Parsing statistics */
  stats: {
    totalRaces: number;
    totalHorses: number;
    totalPastPerformances: number;
    totalWorkouts: number;
    parseTimeMs: number;
    linesProcessed: number;
    linesSkipped: number;
  };
}

// ============================================================================
// WORKER MESSAGE TYPES
// ============================================================================

export interface DRFWorkerRequest {
  type: 'parse';
  fileContent: string;
  filename: string;
}

export interface DRFWorkerProgressMessage {
  type: 'progress';
  progress: number; // 0-100
  step: ParsingStep;
  message: string;
  details?: {
    currentRace?: number;
    totalRaces?: number;
    currentHorse?: number;
    totalHorses?: number;
  };
}

export interface DRFWorkerSuccessResponse {
  type: 'success';
  data: ParsedDRFFile;
}

export interface DRFWorkerErrorResponse {
  type: 'error';
  error: string;
  errorCode: ParsingErrorCode;
  details?: {
    line?: number;
    field?: string;
    value?: string;
    suggestion?: string;
  };
}

export type DRFWorkerResponse =
  | DRFWorkerProgressMessage
  | DRFWorkerSuccessResponse
  | DRFWorkerErrorResponse;

// ============================================================================
// PARSING TYPES
// ============================================================================

export type ParsingStep =
  | 'initializing'
  | 'detecting-format'
  | 'extracting-races'
  | 'parsing-horses'
  | 'loading-past-performances'
  | 'processing-workouts'
  | 'validating-data'
  | 'finalizing'
  | 'complete';

export type ParsingErrorCode =
  | 'INVALID_FILE'
  | 'EMPTY_FILE'
  | 'CORRUPTED_DATA'
  | 'UNSUPPORTED_FORMAT'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_VALUE'
  | 'PARSE_EXCEPTION'
  | 'UNKNOWN_ERROR';

export interface ParsingError {
  code: ParsingErrorCode;
  message: string;
  line?: number;
  field?: string;
  value?: string;
  suggestion?: string;
  recoverable: boolean;
}

export interface ParsingWarning {
  type: 'missing' | 'invalid' | 'incomplete' | 'approximated';
  field: string;
  message: string;
  horseIndex?: number;
  raceIndex?: number;
  suggestion?: string;
}

// ============================================================================
// LEGACY INTERFACES (Backwards Compatibility)
// ============================================================================

/** @deprecated Use RaceHeader instead */
export interface Race {
  track: string;
  date: string;
  distance: string;
  surface: 'dirt' | 'turf' | 'synthetic';
  conditions: string;
}

/** @deprecated Use HorseEntry instead */
export interface Horse {
  programNumber: number;
  name: string;
  trainer: string;
  jockey: string;
  odds: number;
}

/** @deprecated Use ParsedDRFFile instead */
export interface DRFFile {
  filename: string;
  races: Race[];
  horses: Horse[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Subset of horse entry for quick display */
export interface HorseQuickView {
  programNumber: number;
  horseName: string;
  jockeyName: string;
  trainerName: string;
  morningLineOdds: string;
  postPosition: number;
  lastBeyer: number | null;
  averageBeyer: number | null;
}

/** Race summary for list views */
export interface RaceSummary {
  raceNumber: number;
  distance: string;
  surface: Surface;
  classification: RaceClassification;
  purse: number;
  fieldSize: number;
  postTime: string;
}

/** Conversion from new types to legacy types */
export function toLegacyHorse(entry: HorseEntry): Horse {
  return {
    programNumber: entry.programNumber,
    name: entry.horseName,
    trainer: entry.trainerName,
    jockey: entry.jockeyName,
    odds: entry.morningLineDecimal,
  };
}

export function toLegacyRace(header: RaceHeader): Race {
  return {
    track: header.trackCode,
    date: header.raceDate,
    distance: header.distance,
    surface: header.surface === 'all-weather' ? 'synthetic' : header.surface,
    conditions: header.conditions,
  };
}
