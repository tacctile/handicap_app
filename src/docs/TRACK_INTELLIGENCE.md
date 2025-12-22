# TRACK INTELLIGENCE

## Track Data Schema & Integration Protocol

> **This document defines the Track Intelligence Database structure, required data points for each track, and how track-specific information integrates with the universal scoring engine. Every track file must conform to this schema to ensure consistent scoring across all racing venues.**

---

## TRACK INTELLIGENCE OVERVIEW

### Purpose

The Track Intelligence Database provides track-specific data that the universal scoring engine requires to calculate accurate scores. Without proper track data, the system falls back to neutral defaults which reduce scoring precision.

### Architecture

```
src/data/tracks/
├── index.ts              # Exports Map<string, TrackData>
├── trackSchema.ts        # TypeScript interfaces (this document's implementation)
├── trackIntelligence.ts  # Lookup service and fallback handling
└── [TRACK_CODE].ts       # Individual track files (CD.ts, SA.ts, GP.ts, etc.)
```

### Integration Flow

```
1. DRF File Parsed → Track Code Extracted (Field 1)
2. Track Code → Track Intelligence Lookup
3. Track Data Retrieved → Fed to Scoring Engine
4. Scoring Engine Applies Track-Specific Adjustments
5. If Track Unknown → Fallback Defaults Applied + Confidence Reduced
```

### Available Data Getter Functions (v1.1)

The following functions are available in `trackIntelligence.ts` for retrieving track-specific data:

| Function                                               | Parameters                                      | Returns                             | Usage                             |
| ------------------------------------------------------ | ----------------------------------------------- | ----------------------------------- | --------------------------------- |
| `getTrackData(trackCode)`                              | string                                          | TrackData \| undefined              | Full track data object            |
| `getPostPositionBias(trackCode, distance, surface)`    | string, string, surface                         | PostPositionBias \| undefined       | Post position win rates           |
| `getSpeedBias(trackCode, surface)`                     | string, surface                                 | SpeedBias \| undefined              | Speed/pace bias data              |
| `getTrackMeasurements(trackCode, surface)`             | string, surface                                 | TrackMeasurements \| undefined      | Stretch length, circumference     |
| `getSurfaceCharacteristics(trackCode, surface)`        | string, surface                                 | SurfaceCharacteristics \| undefined | Drainage, composition             |
| `getSeasonalPattern(trackCode, month?)`                | string, number?                                 | SeasonalPattern \| undefined        | Current season data               |
| `getSeasonalSpeedAdjustment(trackCode, month?)`        | string, number?                                 | number                              | Speed figure adjustment (±points) |
| `getStretchLengthFactor(trackCode, surface)`           | string, surface                                 | {factor, stretchLength, reasoning}  | Closer analysis factor            |
| `getDrainageFactor(trackCode, surface)`                | string, surface                                 | {factor, drainage, reasoning}       | Wet track amplifier               |
| `getParTime(trackCode, furlongs, surface, classLevel)` | string, number, surface, class                  | number \| undefined                 | Par time in seconds               |
| `calculateParTimeAdjustment(...)`                      | trackCode, furlongs, surface, class, actualTime | {adjustment, reasoning}             | Speed adjustment points           |
| `isTrackIntelligenceAvailable(trackCode)`              | string                                          | boolean                             | Check if track has data           |

**Surface parameter:** `'dirt' | 'turf' | 'synthetic' | 'all-weather'`
**Class level parameter:** `'claiming' | 'allowance' | 'stakes'`

---

## TRACK DATA SCHEMA

### Primary Interface: TrackData

```typescript
interface TrackData {
  // IDENTIFICATION
  code: string; // "CD", "SA", "GP", "PEN", etc.
  name: string; // "Churchill Downs"
  location: {
    city: string; // "Louisville"
    state: string; // "KY"
    country: string; // "USA"
    timezone: string; // "America/New_York"
  };

  // TRACK MEASUREMENTS
  measurements: TrackMeasurements;

  // SURFACE CHARACTERISTICS
  surfaces: {
    dirt: SurfaceCharacteristics;
    turf?: SurfaceCharacteristics;
    synthetic?: SurfaceCharacteristics;
  };

  // POST POSITION BIAS DATA
  postPositionBias: {
    sprint: PostPositionBiasMatrix;
    route: PostPositionBiasMatrix;
    turf?: PostPositionBiasMatrix;
  };

  // SPEED/RUNNING STYLE BIAS
  speedBias: SpeedBiasData;

  // PAR TIMES BY DISTANCE
  parTimes: ParTimeMatrix;

  // SEASONAL PATTERNS
  seasonalPatterns: SeasonalPattern[];

  // ELITE CONNECTIONS (Track-Specific)
  eliteTrainers: EliteConnection[];
  eliteJockeys: EliteConnection[];

  // TRACK RECORDS
  trackRecords: TrackRecord[];

  // METADATA
  lastUpdated: string; // ISO date
  dataConfidence: number; // 0-100 (data quality score)
}
```

---

## DETAILED SCHEMA DEFINITIONS

### TrackMeasurements

```typescript
interface TrackMeasurements {
  // MAIN TRACK (DIRT)
  mainTrack: {
    circumference: number; // feet (e.g., 5280 for 1 mile)
    width: {
      turns: number; // feet
      stretch: number; // feet
      backstretch: number; // feet
    };
    stretch: {
      length: number; // feet
      runFromLastTurn: number; // feet
    };
    turns: {
      banking: number; // degrees
      radius: number; // feet
    };
    chutes: {
      sixFurlongs?: number; // feet from finish
      sevenFurlongs?: number;
      mile?: number;
      mileAndSixteenth?: number;
      mileAndEighth?: number;
      mileAndQuarter?: number;
    };
    railDistance: number; // feet from inner rail
  };

  // TURF COURSE (if applicable)
  turfCourse?: {
    circumference: number;
    width: number;
    stretch: {
      length: number;
      runFromLastTurn: number;
    };
    configuration: string; // "inner", "outer", "hillside", etc.
  };

  // RUN-UP DISTANCES
  runUp: {
    sprint: number; // feet
    route: number; // feet
    turf?: number; // feet
  };
}
```

### SurfaceCharacteristics

```typescript
interface SurfaceCharacteristics {
  material: string; // "dirt", "turf", "tapeta", "polytrack"
  composition?: {
    primary: string; // "sand", "clay", "loam"
    secondary?: string;
    ratio?: string; // "60/40 sand/clay"
  };
  cushion: {
    depth: number; // inches
    maintenance: string; // "deep harrowed", "sealed", etc.
  };
  drainage: string; // "excellent", "good", "fair", "poor"
  speedRating: number; // 1-100 (100 = fastest)
  turfType?: string; // "bermuda", "bluegrass", etc.
}
```

### PostPositionBiasMatrix

```typescript
interface PostPositionBiasMatrix {
  // Win rates by post position (index 0 = post 1)
  winRates: number[]; // e.g., [0.118, 0.142, 0.157, 0.187, ...]

  // Average $2 win payoff by post
  averagePayoffs: number[]; // e.g., [4.20, 3.80, 3.60, 3.20, ...]

  // Scoring points by post (from Scoring Engine)
  scoringPoints: number[]; // e.g., [6, 12, 14, 20, 18, 10, 8, 2, ...]

  // Golden posts (highest value posts)
  goldenPosts: number[]; // e.g., [4, 5] (1-indexed)

  // Trouble posts (lowest value posts)
  troublePosts: number[]; // e.g., [8, 9, 10] (1-indexed)

  // Sample size for statistical validity
  sampleSize: number; // Number of races analyzed
  dateRange: {
    start: string; // ISO date
    end: string; // ISO date
  };
}
```

### SpeedBiasData

```typescript
interface SpeedBiasData {
  // Overall speed bias rating (0-100)
  // 50 = neutral, >50 = speed favoring, <50 = closer favoring
  overallRating: number;

  // By distance category
  sprint: {
    rating: number; // 0-100
    earlyLeaderWinRate: number; // % of winners leading at half-mile
    wireToWireRate: number; // % of wire-to-wire winners
    closerWinRate: number; // % of winners 5+ lengths back at half
  };

  route: {
    rating: number;
    earlyLeaderWinRate: number;
    wireToWireRate: number;
    closerWinRate: number;
  };

  turf?: {
    rating: number;
    earlyLeaderWinRate: number;
    wireToWireRate: number;
    closerWinRate: number;
  };

  // By track condition
  byCondition: {
    fast: number; // bias rating when fast
    good: number;
    muddy: number;
    sloppy: number;
    sealed: number; // often faster than fast
  };

  // Running style scoring adjustments
  styleAdjustments: {
    E: number; // Early speed adjustment
    EP: number; // Early presser adjustment
    P: number; // Presser adjustment
    S: number; // Stalker adjustment
    C: number; // Closer adjustment
  };
}
```

### ParTimeMatrix

```typescript
interface ParTimeMatrix {
  // Keyed by distance in furlongs (e.g., "6.0", "8.0", "8.5")
  [distance: string]: {
    surface: string; // "dirt", "turf"
    condition: string; // "fast", "good", etc.

    // Fractional pars
    fractions: {
      quarter?: number; // seconds (e.g., 22.4)
      half?: number; // seconds (e.g., 45.2)
      sixFurlongs?: number; // seconds
      mile?: number; // seconds
      final: number; // final time in seconds
    };

    // Par speed figure for class levels
    parFigures: {
      maiden: number; // e.g., 72
      claimingLow: number; // $5K-$10K claiming
      claimingMid: number; // $10K-$25K claiming
      claimingHigh: number; // $25K-$50K claiming
      allowance: number;
      stakes: number;
      graded: number;
    };
  };
}
```

### SeasonalPattern

```typescript
interface SeasonalPattern {
  months: number[]; // e.g., [1, 2] for Jan-Feb
  name: string; // "Winter Racing"

  // Adjustments during this period
  adjustments: {
    speedBias: number; // adjustment to base speed bias
    favoriteWinRate: number; // % (e.g., 38.4)
    averageFieldSize: number; // (e.g., 7.2)
    surfaceNotes: string; // "Often frozen or sealed"
  };

  // Weather impact multipliers
  weatherImpact: {
    temperatureEffect: number; // multiplier for temp adjustments
    precipitationEffect: number; // multiplier for rain adjustments
  };
}
```

### EliteConnection

```typescript
interface EliteConnection {
  name: string; // "Timothy C. Kreiser"
  type: 'trainer' | 'jockey';

  // Overall statistics
  stats: {
    starts: number;
    wins: number;
    winRate: number; // decimal (e.g., 0.234)
    roi: number; // return on investment per $2
  };

  // Track-specific statistics
  trackStats: {
    starts: number;
    wins: number;
    winRate: number;
    roi: number;
  };

  // Specialty patterns (for trainers)
  specialties?: {
    claimingWinRate?: number;
    maidenWinRate?: number;
    sprintWinRate?: number;
    routeWinRate?: number;
    firstTimeStarterRate?: number;
    layoffWinRate?: number; // 30-60 day layoff
    equipmentChangeRate?: number; // blinkers on, Lasix, etc.
    secondOffClaimRate?: number;
  };

  // Distance/surface preferences (for jockeys)
  preferences?: {
    sprintWinRate?: number;
    routeWinRate?: number;
    turfWinRate?: number;
    dirtWinRate?: number;
  };

  // Tier assignment for scoring
  tier: 1 | 2 | 3; // 1 = Elite, 2 = Strong, 3 = Solid
  basePoints: number; // Points awarded in Category 1
}
```

### TrackRecord

```typescript
interface TrackRecord {
  distance: string; // "6F", "1M", "1 1/16M"
  surface: string; // "dirt", "turf"
  time: number; // seconds
  horseName: string;
  date: string; // ISO date
  conditions: string; // "fast", "firm", etc.
}
```

---

## FALLBACK HANDLING

### Unknown Track Defaults

When a track code is not found in the database, apply these neutral defaults:

```typescript
const FALLBACK_DEFAULTS: Partial<TrackData> = {
  speedBias: {
    overallRating: 55, // Slight speed favor (national average)
    sprint: {
      rating: 58,
      earlyLeaderWinRate: 0.55,
      wireToWireRate: 0.3,
      closerWinRate: 0.12,
    },
    route: {
      rating: 52,
      earlyLeaderWinRate: 0.48,
      wireToWireRate: 0.22,
      closerWinRate: 0.18,
    },
    byCondition: {
      fast: 58,
      good: 55,
      muddy: 60,
      sloppy: 62,
      sealed: 65,
    },
    styleAdjustments: {
      E: 3,
      EP: 5,
      P: 3,
      S: 0,
      C: -3,
    },
  },

  postPositionBias: {
    sprint: {
      winRates: [0.1, 0.12, 0.14, 0.16, 0.15, 0.13, 0.11, 0.09],
      scoringPoints: [6, 10, 14, 18, 16, 12, 8, 4],
      goldenPosts: [4, 5],
      troublePosts: [8, 9, 10],
      sampleSize: 0,
      dateRange: { start: '', end: '' },
    },
    route: {
      winRates: [0.11, 0.13, 0.14, 0.15, 0.16, 0.13, 0.1, 0.08],
      scoringPoints: [8, 12, 15, 16, 18, 12, 8, 4],
      goldenPosts: [5],
      troublePosts: [9, 10, 11, 12],
      sampleSize: 0,
      dateRange: { start: '', end: '' },
    },
  },

  dataConfidence: 40, // Reduced confidence for unknown track
};
```

### Confidence Adjustments for Fallback

When using fallback data:

- Reduce overall confidence by 15%
- Flag analysis with "Unknown Track" warning
- Apply wider variance to probability calculations
- Note data limitations in output

---

## SCORING ENGINE INTEGRATION

### How Track Data Feeds Scoring

**Category 1: Elite Connections (50 pts max)**

```
Source: eliteTrainers[], eliteJockeys[]
Usage:
- Look up trainer/jockey in track's elite lists
- Apply tier-based points (Tier 1: 20pts, Tier 2: 15pts, Tier 3: 10pts)
- Apply specialty bonuses from trainer.specialties
- Apply partnership bonuses for trainer/jockey combinations
```

**Category 2: Post Position & Bias (45 pts max)**

```
Source: postPositionBias, speedBias
Usage:
- Look up post position in appropriate matrix (sprint/route/turf)
- Apply scoringPoints for that post
- Apply speedBias.styleAdjustments based on horse's running style
- Adjust for current track condition using byCondition ratings
```

**Category 3: Speed Figures & Class (50 pts max)**

```
Source: parTimes
Usage:
- Compare horse's speed figures to track par for class level
- Adjust class assessment based on track's typical figure distribution
- Use par times for pace analysis and time comparisons
```

**Category 6: Pace & Tactical (40 pts max)**

```
Source: speedBias, parTimes
Usage:
- Use earlyLeaderWinRate to weight pace scenario scoring
- Apply styleAdjustments to pace scenario bonuses/penalties
- Reference par fractions for pace pressure calculations
```

### Integration Code Pattern

```typescript
function integrateTrackData(
  trackCode: string,
  horseData: ParsedHorse,
  raceConditions: RaceConditions
): TrackAdjustments {
  // 1. Retrieve track data (or fallback)
  const track = getTrackIntelligence(trackCode);

  // 2. Get appropriate bias matrix
  const biasMatrix = raceConditions.isRoute
    ? track.postPositionBias.route
    : track.postPositionBias.sprint;

  // 3. Calculate post position points
  const postPoints = biasMatrix.scoringPoints[horseData.postPosition - 1] || 0;

  // 4. Calculate style adjustment
  const styleAdj = track.speedBias.styleAdjustments[horseData.runningStyle] || 0;

  // 5. Get condition-specific bias
  const conditionBias = track.speedBias.byCondition[raceConditions.trackCondition];

  // 6. Look up connections
  const trainerData = track.eliteTrainers.find((t) => t.name === horseData.trainer);
  const jockeyData = track.eliteJockeys.find((j) => j.name === horseData.jockey);

  return {
    postPositionPoints: postPoints,
    biasAlignmentPoints: calculateBiasAlignment(styleAdj, conditionBias),
    trainerPoints: trainerData?.basePoints || 0,
    trainerBonuses: calculateTrainerBonuses(trainerData, raceConditions),
    jockeyPoints: jockeyData?.basePoints || 0,
    dataConfidence: track.dataConfidence,
  };
}
```

---

## TRACK FILE TEMPLATE

### Standard Track File Structure

Each track file should follow this template structure with all sections populated with real, researched data for that specific track.

**Required Sections:**

1. Identification (code, name, location)
2. Track Measurements (circumference, stretch, turns, chutes)
3. Surface Characteristics (material, composition, drainage)
4. Post Position Bias (sprint and route matrices with win rates and scoring points)
5. Speed Bias (overall rating, by distance, by condition, style adjustments)
6. Par Times (at least 2 common distances with fractions and par figures)
7. Seasonal Patterns (if applicable)
8. Elite Connections (top 5-10 trainers and jockeys with statistics)
9. Track Records (optional but recommended)
10. Metadata (lastUpdated date, dataConfidence score)

---

## DATA COLLECTION REQUIREMENTS

### Minimum Required Data

For a track to be considered "complete":

| Data Category                    | Required | Notes                         |
| -------------------------------- | -------- | ----------------------------- |
| Basic identification             | ✓        | Code, name, location          |
| Track measurements               | ✓        | Circumference, stretch length |
| Post position bias (sprint)      | ✓        | Win rates, scoring points     |
| Post position bias (route)       | ✓        | Win rates, scoring points     |
| Speed bias rating                | ✓        | Overall and by condition      |
| Par times (at least 2 distances) | ✓        | Common distances run          |
| Elite trainers (top 5)           | ✓        | With win rates                |
| Elite jockeys (top 5)            | ✓        | With win rates                |
| Data confidence score            | ✓        | 0-100 rating                  |

### Recommended Additional Data

| Data Category                | Importance | Notes                       |
| ---------------------------- | ---------- | --------------------------- |
| Turf post position bias      | High       | If track has turf course    |
| Seasonal patterns            | Medium     | For multi-meet tracks       |
| Track records                | Low        | Reference only              |
| Surface composition          | Low        | For weather analysis        |
| Detailed trainer specialties | Medium     | Improves Category 1 scoring |

### Data Quality Standards

| Confidence Score | Description                                    |
| ---------------- | ---------------------------------------------- |
| 90-100           | Comprehensive data, recent, large sample sizes |
| 75-89            | Good data, some gaps or smaller samples        |
| 60-74            | Adequate data, notable limitations             |
| 40-59            | Limited data, use with caution                 |
| Below 40         | Minimal data, fallback-level confidence        |

---

## TRACK LIST (TARGET)

### Priority 1: Major Tracks (Complete First)

| Code | Name            | Location             |
| ---- | --------------- | -------------------- |
| CD   | Churchill Downs | Louisville, KY       |
| SA   | Santa Anita     | Arcadia, CA          |
| GP   | Gulfstream Park | Hallandale Beach, FL |
| AQU  | Aqueduct        | Queens, NY           |
| BEL  | Belmont Park    | Elmont, NY           |
| SAR  | Saratoga        | Saratoga Springs, NY |
| KEE  | Keeneland       | Lexington, KY        |
| DMR  | Del Mar         | Del Mar, CA          |
| OP   | Oaklawn Park    | Hot Springs, AR      |
| TAM  | Tampa Bay Downs | Tampa, FL            |

### Priority 2: Regional Tracks

| Code | Name          | Location         |
| ---- | ------------- | ---------------- |
| PEN  | Penn National | Grantville, PA   |
| PRX  | Parx Racing   | Bensalem, PA     |
| LRL  | Laurel Park   | Laurel, MD       |
| PIM  | Pimlico       | Baltimore, MD    |
| MTH  | Monmouth Park | Oceanport, NJ    |
| CT   | Charles Town  | Charles Town, WV |
| IND  | Indiana Grand | Shelbyville, IN  |
| HAW  | Hawthorne     | Cicero, IL       |
| FG   | Fair Grounds  | New Orleans, LA  |
| WO   | Woodbine      | Toronto, ON      |

### Priority 3: Additional Tracks

All other active North American tracks.

---

_Document Version: 1.1_
_Last Updated: December 2025_
_Status: Complete Track Intelligence Schema Specification_
_Integration: Provides track-specific data to universal Scoring Engine_
_Changes in v1.1: Added new getter functions for drainage, stretch length, seasonal patterns, and par times_
