import type { HorseEntry, ParsedRace, ParsedDRFFile } from '../types/drf'

/**
 * DRF files are fixed-width text format from Daily Racing Form.
 * Each line represents either race header info or horse entry data.
 *
 * Typical DRF structure:
 * - Lines are comma-delimited or fixed-width
 * - First field typically contains track code (3 chars)
 * - Race data followed by horse entries
 */

// Column positions for DRF fixed-width format (approximate - may need adjustment)
const COLUMNS = {
  TRACK_CODE: { start: 0, end: 3 },
  RACE_DATE: { start: 3, end: 11 },
  RACE_NUMBER: { start: 11, end: 13 },
  DISTANCE: { start: 13, end: 18 },
  SURFACE: { start: 18, end: 19 },
  // Horse entry columns
  PROGRAM_NUMBER: { start: 0, end: 3 },
  HORSE_NAME: { start: 3, end: 28 },
  JOCKEY_NAME: { start: 28, end: 53 },
  TRAINER_NAME: { start: 53, end: 78 },
  MORNING_LINE: { start: 78, end: 85 },
  POST_POSITION: { start: 85, end: 88 },
}

function parseSurface(code: string): 'dirt' | 'turf' | 'synthetic' {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'T' || normalized === 'TURF') return 'turf'
  if (normalized === 'S' || normalized === 'SYN' || normalized === 'A') return 'synthetic'
  return 'dirt' // D or default
}

function parseDistance(raw: string): string {
  const trimmed = raw.trim()
  // Convert numeric furlongs to readable format
  const furlongs = parseFloat(trimmed)
  if (!isNaN(furlongs)) {
    if (furlongs >= 8) {
      const miles = furlongs / 8
      return `${miles.toFixed(miles % 1 === 0 ? 0 : 2)} mile${miles !== 1 ? 's' : ''}`
    }
    return `${furlongs}f`
  }
  return trimmed || 'Unknown'
}

function extractField(line: string, start: number, end: number): string {
  return line.substring(start, Math.min(end, line.length)).trim()
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())

  return fields
}

function parseHorseEntry(fields: string[], lineIndex: number): HorseEntry {
  // DRF files typically have many fields per horse
  // Common field positions (may vary by DRF version):
  // 0: Track code
  // 1: Date
  // 2: Race number
  // 3: Post position
  // 4: Entry indicator
  // 5: Horse name
  // 6-7: Jockey name (last, first)
  // 8-9: Trainer name (last, first)
  // Plus many more fields for past performances

  const postPosition = parseInt(fields[3] || String(lineIndex + 1), 10) || lineIndex + 1
  const programNumber = parseInt(fields[4] || fields[3] || String(lineIndex + 1), 10) || lineIndex + 1
  const horseName = fields[5] || fields[4] || `Horse ${lineIndex + 1}`

  // Jockey name - often split into last, first
  const jockeyLast = fields[6] || ''
  const jockeyFirst = fields[7] || ''
  const jockeyName = jockeyFirst ? `${jockeyFirst} ${jockeyLast}`.trim() : jockeyLast

  // Trainer name - often split into last, first
  const trainerLast = fields[8] || ''
  const trainerFirst = fields[9] || ''
  const trainerName = trainerFirst ? `${trainerFirst} ${trainerLast}`.trim() : trainerLast

  // Morning line odds - typically found later in the line
  // Look for a field that looks like odds (e.g., "5-1", "3-2", "8")
  let morningLineOdds = '0-0'
  for (let i = 10; i < Math.min(fields.length, 30); i++) {
    const field = fields[i]
    if (field && /^\d+(-\d+)?$/.test(field)) {
      morningLineOdds = field.includes('-') ? field : `${field}-1`
      break
    }
  }

  return {
    programNumber,
    horseName,
    jockeyName: jockeyName || 'Unknown',
    trainerName: trainerName || 'Unknown',
    morningLineOdds,
    postPosition,
  }
}

/**
 * Parse a DRF file content string into structured data.
 * Handles both comma-delimited and fixed-width formats.
 */
export function parseDRFFile(content: string, filename: string): ParsedDRFFile {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)

  if (lines.length === 0) {
    return { filename, races: [] }
  }

  // Detect format: CSV (has commas) or fixed-width
  const isCSV = lines[0].includes(',')

  const racesMap = new Map<string, ParsedRace>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isCSV) {
      const fields = parseCSVLine(line)
      if (fields.length < 5) continue

      // Extract race key from track code, date, and race number
      const trackCode = fields[0]?.substring(0, 3) || 'UNK'
      const raceDate = fields[1] || ''
      const raceNumber = parseInt(fields[2] || '0', 10)
      const raceKey = `${trackCode}-${raceDate}-${raceNumber}`

      if (!racesMap.has(raceKey)) {
        racesMap.set(raceKey, {
          header: {
            trackCode,
            raceDate,
            raceNumber: raceNumber || 1,
            distance: parseDistance(fields[3] || ''),
            surface: parseSurface(fields[4] || 'D'),
          },
          horses: [],
        })
      }

      // Parse horse entry if we have enough fields
      if (fields.length >= 6) {
        const race = racesMap.get(raceKey)!
        const horseEntry = parseHorseEntry(fields, race.horses.length)
        race.horses.push(horseEntry)
      }
    } else {
      // Fixed-width format parsing
      if (line.length < 20) continue

      const trackCode = extractField(line, COLUMNS.TRACK_CODE.start, COLUMNS.TRACK_CODE.end)
      const raceDate = extractField(line, COLUMNS.RACE_DATE.start, COLUMNS.RACE_DATE.end)
      const raceNumber = parseInt(extractField(line, COLUMNS.RACE_NUMBER.start, COLUMNS.RACE_NUMBER.end), 10) || 1
      const raceKey = `${trackCode}-${raceDate}-${raceNumber}`

      if (!racesMap.has(raceKey)) {
        racesMap.set(raceKey, {
          header: {
            trackCode,
            raceDate,
            raceNumber,
            distance: parseDistance(extractField(line, COLUMNS.DISTANCE.start, COLUMNS.DISTANCE.end)),
            surface: parseSurface(extractField(line, COLUMNS.SURFACE.start, COLUMNS.SURFACE.end)),
          },
          horses: [],
        })
      }

      // For fixed-width, each line is typically a horse entry
      const race = racesMap.get(raceKey)!
      const horseEntry: HorseEntry = {
        programNumber: parseInt(extractField(line, COLUMNS.PROGRAM_NUMBER.start, COLUMNS.PROGRAM_NUMBER.end), 10) || race.horses.length + 1,
        horseName: extractField(line, COLUMNS.HORSE_NAME.start, COLUMNS.HORSE_NAME.end) || `Horse ${race.horses.length + 1}`,
        jockeyName: extractField(line, COLUMNS.JOCKEY_NAME.start, COLUMNS.JOCKEY_NAME.end) || 'Unknown',
        trainerName: extractField(line, COLUMNS.TRAINER_NAME.start, COLUMNS.TRAINER_NAME.end) || 'Unknown',
        morningLineOdds: extractField(line, COLUMNS.MORNING_LINE.start, COLUMNS.MORNING_LINE.end) || '0-0',
        postPosition: parseInt(extractField(line, COLUMNS.POST_POSITION.start, COLUMNS.POST_POSITION.end), 10) || race.horses.length + 1,
      }
      race.horses.push(horseEntry)
    }
  }

  // Convert map to array and sort by race number
  const races = Array.from(racesMap.values()).sort((a, b) => a.header.raceNumber - b.header.raceNumber)

  return { filename, races }
}
