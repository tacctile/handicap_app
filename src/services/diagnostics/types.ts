/**
 * Diagnostics Service Types
 *
 * Types for the DRF file health check and engine status dashboard.
 */

// ============================================================================
// ENGINE STATUS
// ============================================================================

export interface EngineStatusCheck {
  label: string;
  value: string;
  ok: boolean;
}

export interface EngineStatus {
  checks: EngineStatusCheck[];
  allOperational: boolean;
  issueCount: number;
}

// ============================================================================
// DATA QUALITY
// ============================================================================

export type DataQualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface HorseWarning {
  message: string;
}

export interface HorseHealthDetail {
  postPosition: number;
  programNumber: number;
  horseName: string;
  morningLineOdds: string;
  jockeyName: string;
  jockeyWinPct: number;
  trainerName: string;
  trainerWinPct: number;
  speedFigures: (number | null)[];
  pastPerformanceCount: number;
  runningStyle: string;
  daysSinceLastRace: number | null;
  completenessPercent: number;
  warnings: HorseWarning[];
}

export interface RaceHealthRow {
  raceNumber: number;
  distance: string;
  surface: string;
  raceType: string;
  purse: string;
  fieldSize: number;
  scratchCount: number;
  grade: DataQualityGrade;
  issueCount: number;
  horses: HorseHealthDetail[];
}

export interface FileSummary {
  filename: string;
  trackName: string;
  trackCode: string;
  raceDate: string;
  raceCount: number;
  totalHorses: number;
  surfaceTypes: string[];
  distanceRange: string;
  parseTimeMs: number;
}

export interface TrackIntelligenceStatus {
  hasData: boolean;
  trackCode: string;
  trackName: string;
  hasPostPositionBias: boolean;
  hasSpeedBias: boolean;
  hasSeasonalPatterns: boolean;
}

export interface DRFHealthCheck {
  summary: FileSummary;
  races: RaceHealthRow[];
  trackIntelligence: TrackIntelligenceStatus;
}

// ============================================================================
// LEGACY TYPES (kept for backward compatibility with diagnostics service)
// ============================================================================

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

export interface AnalysisProgress {
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  percentComplete: number;
}

export interface DiagnosticsResults {
  totalFiles: number;
  totalRaces: number;
  totalHorses: number;
  totalTracks: number;
  dateRange: string;
  topPickWinRate: number;
  topPickPlaceRate: number;
  topPickShowRate: number;
  topPickWins: number;
  topPickPlaces: number;
  topPickShows: number;
  validRaces: number;
  tierPerformance: TierPerformance[];
  trackSummaries: TrackSummary[];
  exactaBox2Rate: number;
  exactaBox3Rate: number;
  exactaBox4Rate: number;
  trifectaBox3Rate: number;
  trifectaBox4Rate: number;
  trifectaBox5Rate: number;
  superfectaBox4Rate: number;
  superfectaBox5Rate: number;
  superfectaBox6Rate: number;
  predictions: PredictionRecord[];
  analyzedAt: string;
  analysisTimeMs: number;
  unmatchedFiles: string[];
}

export interface PredictionRecord {
  algorithmRank: number;
  actualFinish: number;
  trackCode: string;
  tier: number;
  categoryScores?: {
    speed: number;
    class: number;
    form: number;
    pace: number;
    connections: number;
  };
}

export interface TierPerformance {
  tierName: string;
  tierLabel: string;
  horseCount: number;
  winRate: number;
  itmRate: number;
  wins: number;
  itmFinishes: number;
  tooltip: string;
}

export interface TrackSummary {
  trackCode: string;
  trackName: string;
  raceCount: number;
  horseCount: number;
  topPickWinRate: number;
  topPickITMRate: number;
  dateRange: string;
  topPickWins: number;
  topPickITM: number;
}

export interface FinishPosition {
  position: number;
  post: number;
  horseName: string;
}

export interface RaceResult {
  raceNumber: number;
  positions: FinishPosition[];
  scratches: { post: number; horseName: string }[];
}

export interface PredictionAccuracy {
  horseName: string;
  postPosition: number;
  algorithmRank: number;
  algorithmScore: number;
  actualFinish: number;
  wasTopPick: boolean;
  topPickWon: boolean;
  topPickPlaced: boolean;
  topPickShowed: boolean;
}

export interface FilePair {
  trackCode: string;
  drfContent: string;
  resultsContent: string;
  drfFilename: string;
}

export interface CacheMetadata {
  contentHash: string;
  timestamp: number;
  version: string;
}
