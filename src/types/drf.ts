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
