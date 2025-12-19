/**
 * Track Intelligence Database
 * Contains track-specific data for handicapping calculations
 */

import type { TrackData } from './trackSchema'

/**
 * Santa Anita Park - Arcadia, California
 * One of the premier tracks in North America
 */
const santaAnita: TrackData = {
  code: 'SA',
  name: 'Santa Anita Park',
  location: 'Arcadia, California',
  state: 'CA',
  measurements: {
    dirt: {
      circumference: 1.0,
      stretchLength: 990,
      turnRadius: 280,
      trackWidth: 80,
      chutes: [6, 6.5]
    },
    turf: {
      circumference: 0.875,
      stretchLength: 990,
      turnRadius: 240,
      trackWidth: 75,
      chutes: [6.5]
    }
  },
  postPositionBias: {
    dirt: [
      {
        distance: 'sprint',
        minFurlongs: 5,
        maxFurlongs: 7,
        winPercentByPost: [8, 12, 14, 16, 15, 12, 10, 7, 4, 2],
        favoredPosts: [3, 4, 5],
        biasDescription: 'Middle posts (3-5) favored in sprints'
      },
      {
        distance: 'route',
        minFurlongs: 8,
        maxFurlongs: 12,
        winPercentByPost: [10, 13, 14, 15, 14, 12, 10, 7, 4, 1],
        favoredPosts: [3, 4, 5],
        biasDescription: 'Posts 3-5 slight advantage in routes'
      }
    ],
    turf: [
      {
        distance: 'sprint',
        minFurlongs: 5,
        maxFurlongs: 7,
        winPercentByPost: [14, 15, 14, 13, 12, 11, 10, 6, 3, 2],
        favoredPosts: [1, 2, 3],
        biasDescription: 'Inside posts favored on turf sprints'
      },
      {
        distance: 'route',
        minFurlongs: 8,
        maxFurlongs: 12,
        winPercentByPost: [12, 14, 14, 13, 12, 11, 10, 8, 4, 2],
        favoredPosts: [2, 3, 4],
        biasDescription: 'Posts 2-4 have edge in turf routes'
      }
    ]
  },
  speedBias: [
    {
      surface: 'dirt',
      earlySpeedWinRate: 58,
      paceAdvantageRating: 6,
      description: 'Moderate speed bias; stalkers can compete'
    },
    {
      surface: 'turf',
      earlySpeedWinRate: 42,
      paceAdvantageRating: 4,
      description: 'Fair turf course; closers have chances'
    }
  ],
  surfaces: [
    {
      baseType: 'dirt',
      composition: 'Sandy loam',
      playingStyle: 'fair',
      drainage: 'excellent'
    },
    {
      baseType: 'turf',
      composition: 'Bermuda/Rye blend',
      playingStyle: 'fair',
      drainage: 'good'
    }
  ],
  seasonalPatterns: [
    {
      season: 'winter',
      months: [12, 1, 2],
      typicalCondition: 'Fast to Good',
      speedAdjustment: -1,
      notes: 'Premium winter meet; slightly slower due to rain potential'
    },
    {
      season: 'spring',
      months: [3, 4, 5],
      typicalCondition: 'Fast',
      speedAdjustment: 0,
      notes: 'Ideal racing conditions'
    },
    {
      season: 'fall',
      months: [9, 10, 11],
      typicalCondition: 'Fast',
      speedAdjustment: 1,
      notes: 'Oak Tree meet; fast and dry conditions'
    }
  ],
  winningTimes: [
    { distance: '6f', furlongs: 6, surface: 'dirt', claimingAvg: 70.5, allowanceAvg: 69.2, stakesAvg: 68.0 },
    { distance: '1m', furlongs: 8, surface: 'dirt', claimingAvg: 96.8, allowanceAvg: 95.0, stakesAvg: 93.5 },
    { distance: '1m1/8', furlongs: 9, surface: 'dirt', claimingAvg: 110.5, allowanceAvg: 108.8, stakesAvg: 107.0 },
    { distance: '6f', furlongs: 6, surface: 'turf', claimingAvg: 69.0, allowanceAvg: 67.8, stakesAvg: 66.5 },
    { distance: '1m', furlongs: 8, surface: 'turf', claimingAvg: 95.5, allowanceAvg: 94.0, stakesAvg: 92.5 }
  ],
  lastUpdated: '2024-12-01',
  dataQuality: 'estimated'
}

/**
 * Gulfstream Park - Hallandale Beach, Florida
 * Premier winter racing destination
 */
const gulfstream: TrackData = {
  code: 'GP',
  name: 'Gulfstream Park',
  location: 'Hallandale Beach, Florida',
  state: 'FL',
  measurements: {
    dirt: {
      circumference: 1.0,
      stretchLength: 988,
      turnRadius: 275,
      trackWidth: 80,
      chutes: [7]
    },
    turf: {
      circumference: 0.875,
      stretchLength: 988,
      turnRadius: 230,
      trackWidth: 70,
      chutes: []
    }
  },
  postPositionBias: {
    dirt: [
      {
        distance: 'sprint',
        minFurlongs: 5,
        maxFurlongs: 7,
        winPercentByPost: [6, 10, 13, 17, 18, 14, 10, 7, 3, 2],
        favoredPosts: [4, 5, 6],
        biasDescription: 'Posts 4-5 strongly favored in sprints'
      },
      {
        distance: 'route',
        minFurlongs: 8,
        maxFurlongs: 12,
        winPercentByPost: [9, 12, 14, 15, 14, 13, 10, 8, 3, 2],
        favoredPosts: [3, 4, 5],
        biasDescription: 'Middle posts have slight edge in routes'
      }
    ],
    turf: [
      {
        distance: 'sprint',
        minFurlongs: 5,
        maxFurlongs: 7,
        winPercentByPost: [15, 16, 14, 13, 12, 11, 9, 6, 3, 1],
        favoredPosts: [1, 2],
        biasDescription: 'Strong inside bias on turf sprints'
      },
      {
        distance: 'route',
        minFurlongs: 8,
        maxFurlongs: 12,
        winPercentByPost: [13, 14, 14, 13, 12, 11, 10, 8, 4, 1],
        favoredPosts: [1, 2, 3],
        biasDescription: 'Inside posts favored in turf routes'
      }
    ]
  },
  speedBias: [
    {
      surface: 'dirt',
      earlySpeedWinRate: 62,
      paceAdvantageRating: 7,
      description: 'Strong speed bias; leaders have clear advantage'
    },
    {
      surface: 'turf',
      earlySpeedWinRate: 48,
      paceAdvantageRating: 5,
      description: 'Moderate turf; pace scenarios matter'
    }
  ],
  surfaces: [
    {
      baseType: 'dirt',
      composition: 'Sandy base',
      playingStyle: 'speed-favoring',
      drainage: 'excellent'
    },
    {
      baseType: 'turf',
      composition: 'Bermuda',
      playingStyle: 'fair',
      drainage: 'good'
    }
  ],
  seasonalPatterns: [
    {
      season: 'winter',
      months: [12, 1, 2, 3],
      typicalCondition: 'Fast',
      speedAdjustment: 1,
      notes: 'Championship meet; premium conditions and competition'
    },
    {
      season: 'spring',
      months: [4, 5],
      typicalCondition: 'Fast to Good',
      speedAdjustment: 0,
      notes: 'End of main meet; quality remains high'
    },
    {
      season: 'summer',
      months: [6, 7, 8],
      typicalCondition: 'Fast/Sloppy',
      speedAdjustment: -1,
      notes: 'Afternoon thunderstorms affect cards frequently'
    }
  ],
  winningTimes: [
    { distance: '6f', furlongs: 6, surface: 'dirt', claimingAvg: 70.0, allowanceAvg: 68.8, stakesAvg: 67.5 },
    { distance: '1m', furlongs: 8, surface: 'dirt', claimingAvg: 96.2, allowanceAvg: 94.5, stakesAvg: 93.0 },
    { distance: '1m1/8', furlongs: 9, surface: 'dirt', claimingAvg: 110.0, allowanceAvg: 108.2, stakesAvg: 106.5 },
    { distance: '5f', furlongs: 5, surface: 'turf', claimingAvg: 57.0, allowanceAvg: 55.8, stakesAvg: 54.5 },
    { distance: '1m', furlongs: 8, surface: 'turf', claimingAvg: 95.0, allowanceAvg: 93.5, stakesAvg: 92.0 }
  ],
  lastUpdated: '2024-12-01',
  dataQuality: 'estimated'
}

/**
 * Churchill Downs - Louisville, Kentucky
 * Home of the Kentucky Derby
 */
const churchillDowns: TrackData = {
  code: 'CD',
  name: 'Churchill Downs',
  location: 'Louisville, Kentucky',
  state: 'KY',
  measurements: {
    dirt: {
      circumference: 1.0,
      stretchLength: 1234,
      turnRadius: 295,
      trackWidth: 80,
      chutes: [6, 7]
    },
    turf: {
      circumference: 0.875,
      stretchLength: 1234,
      turnRadius: 250,
      trackWidth: 70,
      chutes: []
    }
  },
  postPositionBias: {
    dirt: [
      {
        distance: 'sprint',
        minFurlongs: 5,
        maxFurlongs: 7,
        winPercentByPost: [7, 11, 14, 16, 16, 13, 10, 7, 4, 2],
        favoredPosts: [4, 5],
        biasDescription: 'Posts 4-5 ideal in dirt sprints'
      },
      {
        distance: 'route',
        minFurlongs: 8,
        maxFurlongs: 12,
        winPercentByPost: [10, 12, 13, 14, 14, 12, 11, 8, 4, 2],
        favoredPosts: [4, 5],
        biasDescription: 'Long stretch helps all; middle still best'
      }
    ],
    turf: [
      {
        distance: 'sprint',
        minFurlongs: 5,
        maxFurlongs: 7,
        winPercentByPost: [13, 15, 14, 13, 12, 11, 10, 7, 3, 2],
        favoredPosts: [1, 2, 3],
        biasDescription: 'Inside posts have advantage on turf sprints'
      },
      {
        distance: 'route',
        minFurlongs: 8,
        maxFurlongs: 12,
        winPercentByPost: [11, 13, 14, 13, 13, 12, 10, 8, 4, 2],
        favoredPosts: [2, 3, 4],
        biasDescription: 'Slight inside edge in turf routes'
      }
    ]
  },
  speedBias: [
    {
      surface: 'dirt',
      earlySpeedWinRate: 52,
      paceAdvantageRating: 5,
      description: 'Long stretch allows closers; fair track'
    },
    {
      surface: 'turf',
      earlySpeedWinRate: 45,
      paceAdvantageRating: 4,
      description: 'Turf course plays fair; tactical races'
    }
  ],
  surfaces: [
    {
      baseType: 'dirt',
      composition: 'Sandy loam',
      playingStyle: 'fair',
      drainage: 'good'
    },
    {
      baseType: 'turf',
      composition: 'Kentucky Bluegrass',
      playingStyle: 'fair',
      drainage: 'good'
    }
  ],
  seasonalPatterns: [
    {
      season: 'spring',
      months: [4, 5, 6],
      typicalCondition: 'Fast to Good',
      speedAdjustment: 0,
      notes: 'Derby/Oaks meet; premium conditions but variable weather'
    },
    {
      season: 'summer',
      months: [7, 8],
      typicalCondition: 'Fast',
      speedAdjustment: 1,
      notes: 'Hot and dry; fast track'
    },
    {
      season: 'fall',
      months: [9, 10, 11],
      typicalCondition: 'Fast',
      speedAdjustment: 1,
      notes: 'Fall meet includes Stakes bonanza; excellent conditions'
    }
  ],
  winningTimes: [
    { distance: '6f', furlongs: 6, surface: 'dirt', claimingAvg: 70.2, allowanceAvg: 69.0, stakesAvg: 67.8 },
    { distance: '1m', furlongs: 8, surface: 'dirt', claimingAvg: 96.5, allowanceAvg: 94.8, stakesAvg: 93.2 },
    { distance: '1m1/4', furlongs: 10, surface: 'dirt', claimingAvg: 123.0, allowanceAvg: 121.0, stakesAvg: 119.0 },
    { distance: '5f', furlongs: 5, surface: 'turf', claimingAvg: 57.5, allowanceAvg: 56.2, stakesAvg: 55.0 },
    { distance: '1m', furlongs: 8, surface: 'turf', claimingAvg: 95.8, allowanceAvg: 94.2, stakesAvg: 92.8 }
  ],
  lastUpdated: '2024-12-01',
  dataQuality: 'estimated'
}

/**
 * Track database indexed by track code
 */
export const trackDatabase: Map<string, TrackData> = new Map([
  ['SA', santaAnita],
  ['GP', gulfstream],
  ['CD', churchillDowns]
])

/**
 * Get list of all available track codes
 */
export function getAvailableTrackCodes(): string[] {
  return Array.from(trackDatabase.keys())
}

/**
 * Check if a track exists in the database
 */
export function hasTrackData(trackCode: string): boolean {
  return trackDatabase.has(trackCode.toUpperCase())
}

// Re-export types
export type { TrackData, PostPositionBias, SpeedBias, TrackBiasSummary } from './trackSchema'
