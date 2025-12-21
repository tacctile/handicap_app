/**
 * Track Intelligence Database
 * Contains track-specific data for handicapping calculations
 *
 * This module exports a centralized database of track intelligence data
 * for 40 major tracks in North American racing. Each track file contains
 * verified, researched data from authoritative sources including:
 * - Equibase track profiles and records
 * - Official track websites and specifications
 * - America's Best Racing handicapping analysis
 * - NYRA and other racing association statistics
 * - Racing publications (BloodHorse, Horse Racing Nation, TwinSpires)
 * - State racing commission data (Nebraska Racing Commission for FON, NJRC for MTH)
 * - Pennsylvania Horse Racing Commission (PRX, PEN)
 * - Maryland Racing Commission (LRL, PIM)
 * - Delaware Racing Commission (DEL)
 * - West Virginia Racing Commission (CT, MNR)
 * - Florida Division of Pari-Mutuel Wagering (TAM)
 * - Louisiana State Racing Commission (FG, DED, EVD)
 * - Kentucky Horse Racing Commission (TP, ELP)
 * - Texas Racing Commission (LS, HOU)
 * - Oklahoma Horse Racing Commission (RP)
 * - Minnesota Racing Commission (CBY)
 * - Iowa Racing and Gaming Commission (PRM)
 * - Indiana Horse Racing Commission (IND, HOO)
 * - California Horse Racing Board (GG, LRC)
 * - Washington Horse Racing Commission (EMD)
 * - Arizona Department of Gaming (TUP)
 * - New Mexico Racing Commission (SUN)
 * - Ohio State Racing Commission (BTP)
 * - Alcohol and Gaming Commission of Ontario (WO)
 * - British Columbia Racing Commission (HST)
 *
 * Track codes follow standard DRF/Equibase conventions:
 * - AQU = Aqueduct Racetrack
 * - BEL = Belmont Park
 * - BTP = Belterra Park Gaming & Entertainment Center
 * - CBY = Canterbury Park
 * - CD = Churchill Downs
 * - CT = Charles Town Races
 * - DED = Delta Downs Racetrack Casino & Hotel
 * - DEL = Delaware Park
 * - DMR = Del Mar Thoroughbred Club
 * - ELP = Ellis Park Race Course
 * - EMD = Emerald Downs
 * - EVD = Evangeline Downs Racetrack & Casino
 * - FG = Fair Grounds Race Course
 * - FL = Finger Lakes Gaming & Racetrack
 * - FON = Fonner Park
 * - GG = Golden Gate Fields
 * - GP = Gulfstream Park
 * - HOO = Hoosier Park Racing & Casino
 * - HOU = Sam Houston Race Park
 * - HST = Hastings Racecourse
 * - IND = Indiana Grand Racing & Casino
 * - KEE = Keeneland Race Course
 * - LRC = Los Alamitos Race Course
 * - LRL = Laurel Park
 * - LS = Lone Star Park
 * - MNR = Mountaineer Casino Racetrack & Resort
 * - MTH = Monmouth Park
 * - OP = Oaklawn Racing Casino Resort
 * - PEN = Penn National Race Course
 * - PIM = Pimlico Race Course
 * - PRM = Prairie Meadows Racetrack & Casino
 * - PRX = Parx Racing
 * - RP = Remington Park
 * - SA = Santa Anita Park
 * - SAR = Saratoga Race Course
 * - SUN = Sunland Park Racetrack & Casino
 * - TAM = Tampa Bay Downs
 * - TP = Turfway Park
 * - TUP = Turf Paradise
 * - WO = Woodbine Racetrack
 */

import type { TrackData, TrackBiasSummary } from './trackSchema';

// Import individual track data files (alphabetical order)
import { aqueduct } from './aqueduct';
import { belmontPark } from './belmontPark';
import { belterraPark } from './belterraPark';
import { canterburyPark } from './canterburyPark';
import { charlesTownRaces } from './charlesTownRaces';
import { churchillDowns } from './churchillDowns';
import { delawarePark } from './delawarePark';
import { deltaDowns } from './deltaDowns';
import { delMar } from './delMar';
import { ellisPark } from './ellisPark';
import { emeraldDowns } from './emeraldDowns';
import { evangelineDowns } from './evangelineDowns';
import { fairGrounds } from './fairGrounds';
import { fingerLakes } from './fingerLakes';
import { fonnerPark } from './fonnerPark';
import { goldenGateFields } from './goldenGateFields';
import { gulfstreamPark } from './gulfstreamPark';
import { hastingsRacecourse } from './hastingsRacecourse';
import { hoosierPark } from './hoosierPark';
import { indianaGrand } from './indianaGrand';
import { keeneland } from './keeneland';
import { laurelPark } from './laurelPark';
import { loneStarPark } from './loneStarPark';
import { losAlamitos } from './losAlamitos';
import { monmouthPark } from './monmouthPark';
import { mountaineer } from './mountaineer';
import { oaklawnPark } from './oaklawnPark';
import { parxRacing } from './parxRacing';
import { pennNational } from './pennNational';
import { pimlico } from './pimlico';
import { prairieMeadows } from './prairieMeadows';
import { remingtonPark } from './remingtonPark';
import { samHoustonRacePark } from './samHoustonRacePark';
import { santaAnita } from './santaAnita';
import { saratoga } from './saratoga';
import { sunlandPark } from './sunlandPark';
import { tampaBayDowns } from './tampaBayDowns';
import { turfParadise } from './turfParadise';
import { turfwayPark } from './turfwayPark';
import { woodbine } from './woodbine';

/**
 * Track database indexed by standard track code
 * Keys use DRF/Equibase standard codes for consistency with DRF file parsing
 */
export const trackDatabase: Map<string, TrackData> = new Map([
  ['AQU', aqueduct],
  ['BEL', belmontPark],
  ['BTP', belterraPark],
  ['CBY', canterburyPark],
  ['CD', churchillDowns],
  ['CT', charlesTownRaces],
  ['DED', deltaDowns],
  ['DEL', delawarePark],
  ['DMR', delMar],
  ['ELP', ellisPark],
  ['EMD', emeraldDowns],
  ['EVD', evangelineDowns],
  ['FG', fairGrounds],
  ['FL', fingerLakes],
  ['FON', fonnerPark],
  ['GG', goldenGateFields],
  ['GP', gulfstreamPark],
  ['HOO', hoosierPark],
  ['HOU', samHoustonRacePark],
  ['HST', hastingsRacecourse],
  ['IND', indianaGrand],
  ['KEE', keeneland],
  ['LRC', losAlamitos],
  ['LRL', laurelPark],
  ['LS', loneStarPark],
  ['MNR', mountaineer],
  ['MTH', monmouthPark],
  ['OP', oaklawnPark],
  ['PEN', pennNational],
  ['PIM', pimlico],
  ['PRM', prairieMeadows],
  ['PRX', parxRacing],
  ['RP', remingtonPark],
  ['SA', santaAnita],
  ['SAR', saratoga],
  ['SUN', sunlandPark],
  ['TAM', tampaBayDowns],
  ['TP', turfwayPark],
  ['TUP', turfParadise],
  ['WO', woodbine],
]);

/**
 * Get list of all available track codes
 */
export function getAvailableTrackCodes(): string[] {
  return Array.from(trackDatabase.keys());
}

/**
 * Check if a track exists in the database
 * @param trackCode - Standard track code (e.g., "CD", "SAR")
 * @returns true if track data exists
 */
export function hasTrackData(trackCode: string): boolean {
  return trackDatabase.has(trackCode.toUpperCase());
}

/**
 * Get track data by code
 * @param trackCode - Standard track code (e.g., "CD", "SAR")
 * @returns TrackData or undefined if not found
 */
export function getTrackData(trackCode: string): TrackData | undefined {
  return trackDatabase.get(trackCode.toUpperCase());
}

/**
 * Get a simplified track bias summary for UI display
 * @param trackCode - Standard track code
 * @returns TrackBiasSummary for display purposes
 */
export function getTrackBiasSummary(trackCode: string): TrackBiasSummary | null {
  const track = trackDatabase.get(trackCode.toUpperCase());
  if (!track) {
    return null;
  }

  // Get the primary dirt speed bias
  const dirtBias = track.speedBias.find((b) => b.surface === 'dirt');

  return {
    trackCode: track.code,
    trackName: track.name,
    speedBiasPercent: dirtBias?.earlySpeedWinRate ?? 50,
    speedBiasDescription: dirtBias?.description ?? 'No bias data available',
    favoredPostsDescription:
      track.postPositionBias.dirt[0]?.biasDescription ?? 'No post position data',
    isDataAvailable: true,
  };
}

/**
 * Get fallback track data for unknown tracks
 * Returns neutral defaults with reduced confidence
 */
export function getFallbackTrackData(trackCode: string): TrackData {
  return {
    code: trackCode.toUpperCase(),
    name: `Unknown Track (${trackCode.toUpperCase()})`,
    location: 'Unknown',
    state: 'XX',
    measurements: {
      dirt: {
        circumference: 1.0,
        stretchLength: 1000,
        turnRadius: 280,
        trackWidth: 80,
        chutes: [6, 7],
      },
    },
    postPositionBias: {
      dirt: [
        {
          distance: 'sprint',
          minFurlongs: 5,
          maxFurlongs: 7,
          winPercentByPost: [10, 12, 14, 16, 15, 13, 11, 9],
          favoredPosts: [4, 5],
          biasDescription: 'Using national average defaults - middle posts typically favored',
        },
        {
          distance: 'route',
          minFurlongs: 8,
          maxFurlongs: 12,
          winPercentByPost: [11, 13, 14, 15, 16, 13, 10, 8],
          favoredPosts: [5],
          biasDescription:
            'Using national average defaults - middle posts typically favored in routes',
        },
      ],
    },
    speedBias: [
      {
        surface: 'dirt',
        earlySpeedWinRate: 55,
        paceAdvantageRating: 5,
        description: 'National average defaults - slight speed advantage typical',
      },
    ],
    surfaces: [
      {
        baseType: 'dirt',
        composition: 'Unknown - using typical dirt track assumptions',
        playingStyle: 'fair',
        drainage: 'good',
      },
    ],
    seasonalPatterns: [],
    winningTimes: [
      {
        distance: '6f',
        furlongs: 6,
        surface: 'dirt',
        claimingAvg: 70.5,
        allowanceAvg: 69.0,
        stakesAvg: 67.5,
      },
      {
        distance: '1m',
        furlongs: 8,
        surface: 'dirt',
        claimingAvg: 96.5,
        allowanceAvg: 95.0,
        stakesAvg: 93.5,
      },
    ],
    lastUpdated: new Date().toISOString().split('T')[0],
    dataQuality: 'estimated',
  };
}

// Re-export types for convenience
export type {
  TrackData,
  PostPositionBias,
  SpeedBias,
  TrackMeasurements,
  SurfaceCharacteristics,
  SeasonalPattern,
  WinningTimeByDistance,
  TrackBiasSummary,
} from './trackSchema';

// Export individual track data for direct access if needed (alphabetical order)
export {
  aqueduct,
  belmontPark,
  belterraPark,
  canterburyPark,
  charlesTownRaces,
  churchillDowns,
  delawarePark,
  deltaDowns,
  delMar,
  ellisPark,
  emeraldDowns,
  evangelineDowns,
  fairGrounds,
  fingerLakes,
  fonnerPark,
  goldenGateFields,
  gulfstreamPark,
  hastingsRacecourse,
  hoosierPark,
  indianaGrand,
  keeneland,
  laurelPark,
  loneStarPark,
  losAlamitos,
  monmouthPark,
  mountaineer,
  oaklawnPark,
  parxRacing,
  pennNational,
  pimlico,
  prairieMeadows,
  remingtonPark,
  samHoustonRacePark,
  santaAnita,
  saratoga,
  sunlandPark,
  tampaBayDowns,
  turfParadise,
  turfwayPark,
  woodbine,
};
