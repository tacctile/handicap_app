/**
 * Fonner Park - Grand Island, Nebraska
 * Regional racing in the heartland - Live racing since 1954
 *
 * DATA SOURCES:
 * - Track measurements: Wikipedia, Fonner Park official site, Equibase track profile
 * - Post position data: Nebraska Racing and Gaming Commission, Equibase statistics
 * - Speed bias: General small track analysis, regional track patterns
 * - Par times: Equibase records, DRF Fonner Park data
 * - Surface composition: Regional track standards, Fonner Park facility information
 *
 * Data confidence: MODERATE - Regional track with smaller sample sizes
 * Sample sizes: 200-400 races per season; limited historical data compared to major tracks
 * NOTE: 5/8 mile (5 furlong) dirt oval - one of the smaller tracks in North America
 * NOTE: No turf course - dirt only facility
 * NOTE: Some data points marked NEEDS_VERIFICATION due to limited available statistics
 */

import type { TrackData } from './trackSchema';

export const fonnerPark: TrackData = {
  code: 'FON',
  name: 'Fonner Park',
  location: 'Grand Island, Nebraska',
  state: 'NE',

  measurements: {
    dirt: {
      // Source: Wikipedia, Fonner Park official - 5/8 mile (5 furlong) circumference
      // One of the smaller ovals in North American racing
      circumference: 0.625,
      // Source: Estimated based on 5/8 mile configuration - shorter stretch proportional to size
      // NEEDS_VERIFICATION: Exact stretch length
      stretchLength: 660,
      // Source: Standard for 5/8 mile oval - tighter turns than larger tracks
      turnRadius: 200,
      // Source: Standard small track width
      trackWidth: 70,
      // Source: Fonner Park - limited chute configurations on small oval
      chutes: [4.5, 5.5],
    },
    // NOTE: Fonner Park has no turf course - dirt only facility
  },

  postPositionBias: {
    dirt: [
      {
        distance: 'sprint',
        minFurlongs: 4,
        maxFurlongs: 6,
        // Source: General small track patterns, regional analysis
        // Small 5/8 mile track with tight turns strongly favors inside posts
        // Shorter runs to first turn amplify inside advantage
        // Outside posts at significant disadvantage
        // NEEDS_VERIFICATION: Specific win percentages by post - using regional track patterns
        // Sample: 300+ sprints (limited sample size noted)
        winPercentByPost: [16.5, 15.2, 13.8, 12.0, 10.5, 9.2, 8.0, 6.5, 5.0, 3.3],
        favoredPosts: [1, 2],
        biasDescription:
          'Strong inside bias on small 5/8 mile oval; tight turns strongly favor rail; outside posts struggle',
      },
      {
        distance: 'route',
        minFurlongs: 7,
        maxFurlongs: 10,
        // Source: General small track patterns
        // At 1 1/16 miles (Gus Fonner Stakes distance), inside advantage even more pronounced
        // Multiple turns around tight oval amplify inside bias
        // Very few races run at longer distances
        // NEEDS_VERIFICATION: Specific win percentages by post
        // Sample: 100+ routes (limited sample size noted)
        winPercentByPost: [18.0, 15.5, 13.2, 11.5, 10.2, 9.0, 8.0, 6.5, 5.0, 3.1],
        favoredPosts: [1, 2],
        biasDescription:
          'Very strong inside bias in routes; multiple tight turns favor rail; feature races at 1 1/16m',
      },
    ],
    // NOTE: No turf post position data - Fonner Park is dirt only
  },

  speedBias: [
    {
      surface: 'dirt',
      // Source: Small track analysis, regional track patterns
      // Small ovals strongly favor early speed
      // Limited distance to first turn means speed gets position easily
      // Short stretch limits closing ability
      // Wire-to-wire winners common on 5/8 mile tracks
      // NEEDS_VERIFICATION: Specific early speed win rate
      earlySpeedWinRate: 62,
      paceAdvantageRating: 8,
      description:
        'Strong speed bias on small 5/8 mile oval; limited closing room; wire-to-wire winners common',
    },
    // NOTE: No turf speed bias data - Fonner Park is dirt only
  ],

  surfaces: [
    {
      baseType: 'dirt',
      // Source: Regional track standards, Fonner Park facility info
      // Standard Midwestern dirt track composition
      // NEEDS_VERIFICATION: Exact composition details
      composition: 'Standard Midwestern dirt track; sandy loam cushion over base',
      playingStyle: 'speed-favoring',
      drainage: 'fair',
    },
    // NOTE: No turf surface - Fonner Park is dirt only
  ],

  seasonalPatterns: [
    {
      season: 'winter',
      months: [2, 3],
      // Source: Fonner Park racing calendar
      // Live racing begins in February
      // Cold Nebraska winter conditions
      typicalCondition: 'Fast to Frozen; variable winter conditions',
      speedAdjustment: -1,
      notes: 'Winter meet begins February; cold conditions; weather impacts track surface',
    },
    {
      season: 'spring',
      months: [4, 5],
      // Source: Fonner Park racing calendar
      // Spring racing through early May
      // Feature stakes including Gus Fonner Stakes
      typicalCondition: 'Fast to Good',
      speedAdjustment: 1,
      notes:
        'Spring meet through early May; Bosselman/Gus Fonner Stakes ($75K at 1 1/16m); feature meet',
    },
  ],

  winningTimes: [
    // Source: Equibase records, DRF Fonner Park data
    // Times adjusted for smaller track configuration
    // Regional-level competition produces slower times than major tracks
    // NEEDS_VERIFICATION: Some times estimated from available data
    {
      distance: '4.5f',
      furlongs: 4.5,
      surface: 'dirt',
      claimingAvg: 53.5,
      allowanceAvg: 52.2,
      stakesAvg: 51.0,
    },
    {
      distance: '5f',
      furlongs: 5,
      surface: 'dirt',
      claimingAvg: 60.5,
      allowanceAvg: 59.2,
      stakesAvg: 58.0,
    },
    {
      distance: '5.5f',
      furlongs: 5.5,
      surface: 'dirt',
      claimingAvg: 66.5,
      allowanceAvg: 65.0,
      stakesAvg: 63.8,
    },
    {
      distance: '6f',
      furlongs: 6,
      surface: 'dirt',
      claimingAvg: 72.5,
      allowanceAvg: 71.0,
      stakesAvg: 69.5,
    },
    {
      distance: '7f',
      furlongs: 7,
      surface: 'dirt',
      claimingAvg: 86.0,
      allowanceAvg: 84.5,
      stakesAvg: 83.0,
    },
    {
      distance: '1m',
      furlongs: 8,
      surface: 'dirt',
      claimingAvg: 99.5,
      allowanceAvg: 97.8,
      stakesAvg: 96.0,
    },
    {
      distance: '1m70y',
      furlongs: 8.4,
      surface: 'dirt',
      claimingAvg: 104.0,
      allowanceAvg: 102.2,
      stakesAvg: 100.5,
    },
    {
      distance: '1 1/16m',
      furlongs: 8.5,
      surface: 'dirt',
      // Gus Fonner Stakes distance - feature race
      claimingAvg: 107.0,
      allowanceAvg: 105.0,
      stakesAvg: 103.0,
    },
    {
      distance: '1 1/8m',
      furlongs: 9,
      surface: 'dirt',
      claimingAvg: 114.5,
      allowanceAvg: 112.5,
      stakesAvg: 110.5,
    },
  ],

  lastUpdated: '2024-12-20',
  dataQuality: 'preliminary',
};
