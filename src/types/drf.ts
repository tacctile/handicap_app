export interface RaceHeader {
  trackCode: string
  raceNumber: number
  distance: string
  surface: 'dirt' | 'turf' | 'synthetic'
  raceDate: string
}

export interface HorseEntry {
  programNumber: number
  horseName: string
  trainerName: string
  jockeyName: string
  morningLineOdds: string
  postPosition: number
}

export interface ParsedRace {
  header: RaceHeader
  horses: HorseEntry[]
}

export interface ParsedDRFFile {
  filename: string
  races: ParsedRace[]
}

// Worker message types
export interface DRFWorkerRequest {
  type: 'parse'
  fileContent: string
  filename: string
}

export interface DRFWorkerResponse {
  type: 'success' | 'error'
  data?: ParsedDRFFile
  error?: string
}

// Legacy interfaces for backwards compatibility
export interface Race {
  track: string
  date: string
  distance: string
  surface: 'dirt' | 'turf' | 'synthetic'
  conditions: string
}

export interface Horse {
  programNumber: number
  name: string
  trainer: string
  jockey: string
  odds: number
}

export interface DRFFile {
  filename: string
  races: Race[]
  horses: Horse[]
}
