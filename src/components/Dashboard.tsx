import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './Dashboard.css';
import { usePostTime } from '../hooks/usePostTime';
import { useValueDetection } from '../hooks/useValueDetection';
import { BetModeContainer } from './BetMode';
import { FileUpload } from './FileUpload';
import { HorseExpandedView } from './HorseExpandedView';
import { HorseSummaryBar } from './HorseSummaryBar';
import { HeaderTooltip } from './InfoTooltip';
import { ScoringHelpModal } from './ScoringHelpModal';
import { RaceVerdictHeader } from './RaceVerdictHeader';
import { ValueActionBar } from './ValueActionBar';
import {
  calculateRaceScores,
  MAX_SCORE,
  analyzeOverlayWithField,
  calculateBaseScoreRanks,
} from '../lib/scoring';
import { rankHorsesByBlended, type BlendedRankedHorse } from '../lib/scoring/blendedRank';
import { toOrdinal, calculateRankGradientColor } from '../lib/scoring/rankUtils';
import type { TrendScore } from '../lib/scoring/trendAnalysis';
import { TrendDetailModal } from './TrendDetailModal';
import { getTrackData } from '../data/tracks';
import type { ParsedDRFFile, ParsedRace, HorseEntry } from '../types/drf';
import type { useRaceState } from '../hooks/useRaceState';
import type { TrackCondition as RaceStateTrackCondition } from '../hooks/useRaceState';

interface DashboardProps {
  parsedData: ParsedDRFFile | null;
  selectedRaceIndex: number;
  onRaceSelect?: (index: number) => void;
  trackCondition: RaceStateTrackCondition;
  onTrackConditionChange: (condition: RaceStateTrackCondition) => void;
  raceState: ReturnType<typeof useRaceState>;
  isLoading?: boolean;
  onParsed?: (data: ParsedDRFFile) => void;
}

// Format currency helper
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Expand race classification abbreviations to readable text
const expandClassification = (classification: string): string => {
  const expansions: Record<string, string> = {
    maiden: 'MAIDEN',
    maiden_claiming: 'MAIDEN CLAIMING',
    maiden_special_weight: 'MAIDEN SPECIAL WEIGHT',
    claiming: 'CLAIMING',
    allowance: 'ALLOWANCE',
    allowance_optional_claiming: 'ALLOWANCE OPTIONAL CLAIMING',
    stakes: 'STAKES',
    graded_stakes: 'GRADED STAKES',
    listed: 'LISTED STAKES',
    handicap: 'HANDICAP',
    starter_allowance: 'STARTER ALLOWANCE',
    unknown: 'UNKNOWN',
    // Also handle abbreviated codes
    MSW: 'MAIDEN SPECIAL WEIGHT',
    MCL: 'MAIDEN CLAIMING',
    CLM: 'CLAIMING',
    ALW: 'ALLOWANCE',
    AOC: 'ALLOWANCE OPTIONAL CLAIMING',
    STK: 'STAKES',
    HCP: 'HANDICAP',
  };
  return (
    expansions[classification] ||
    expansions[classification.toUpperCase()] ||
    classification.toUpperCase()
  );
};

// Expand age restriction to readable text
const expandAge = (age: string): string => {
  if (!age) return '';
  const ageMap: Record<string, string> = {
    '2YO': '2-Year-Olds',
    '3YO': '3-Year-Olds',
    '4YO': '4-Year-Olds',
    '5YO': '5-Year-Olds',
    '3&UP': '3-Year-Olds & Up',
    '3+': '3-Year-Olds & Up',
    '4&UP': '4-Year-Olds & Up',
    '4+': '4-Year-Olds & Up',
    '5&UP': '5-Year-Olds & Up',
    '5+': '5-Year-Olds & Up',
  };
  return ageMap[age.toUpperCase()] || age;
};

// Expand sex restriction to readable text
const expandSex = (sex: string): string => {
  if (!sex) return '';
  const sexMap: Record<string, string> = {
    F: 'Fillies',
    M: 'Mares',
    'F&M': 'Fillies & Mares',
    C: 'Colts',
    G: 'Geldings',
    'C&G': 'Colts & Geldings',
    H: 'Horses',
  };
  return sexMap[sex.toUpperCase()] || sex;
};

// Get full track name with code and size
const getTrackDisplayName = (trackCode: string | undefined, trackSize: string): string => {
  if (!trackCode) return 'Unknown Track';
  const trackData = getTrackData(trackCode);
  if (trackData) {
    return `${trackData.name} (${trackCode} ${trackSize})`;
  }
  // Fallback to just code if no track data
  return `${trackCode} (${trackSize})`;
};

// Build readable race description as flowing sentences
const buildRaceDescription = (race: ParsedRace | undefined): { line1: string; line2: string } => {
  if (!race?.header) return { line1: '', line2: '' };

  // Line 1: Distance + Classification + "for [restrictions]"
  const line1Parts: string[] = [];

  // Distance
  if (race.header.distance) {
    line1Parts.push(race.header.distance);
  }

  // Classification
  if (race.header.classification && race.header.classification !== 'unknown') {
    line1Parts.push(expandClassification(race.header.classification));
  }

  // Build "for [sex] [age]" phrase
  const sexText = expandSex(race.header.sexRestriction);
  const ageText = expandAge(race.header.ageRestriction);
  if (sexText && ageText) {
    line1Parts.push(`for ${sexText} ${ageText}`);
  } else if (ageText) {
    line1Parts.push(`for ${ageText}`);
  } else if (sexText) {
    line1Parts.push(`for ${sexText}`);
  }

  // Line 2: Purse + Field size
  const line2Parts: string[] = [];

  // Purse
  if (race.header.purse) {
    line2Parts.push(`Purse ${race.header.purseFormatted || formatCurrency(race.header.purse)}`);
  }

  // Field size
  const fieldSize = race.horses?.length || race.header.fieldSize || 0;
  if (fieldSize > 0) {
    line2Parts.push(`${fieldSize} Runners`);
  }

  return {
    line1: line1Parts.join(' ') + (line1Parts.length > 0 ? '.' : ''),
    line2: line2Parts.join('. ') + (line2Parts.length > 0 ? '.' : ''),
  };
};

export const Dashboard: React.FC<DashboardProps> = ({
  parsedData,
  selectedRaceIndex,
  onRaceSelect,
  trackCondition,
  onTrackConditionChange,
  raceState,
  isLoading = false,
  onParsed,
}) => {
  // View mode state: 'analysis' (default) or 'betMode'
  const [viewMode, setViewMode] = useState<'analysis' | 'betMode'>('analysis');

  // State for expanded horse in horse list
  const [expandedHorseId, setExpandedHorseId] = useState<string | number | null>(null);

  // State for horses selected for comparison
  const [compareHorses, setCompareHorses] = useState<Set<number>>(new Set());

  // State for trend detail modal
  const [trendModalHorse, setTrendModalHorse] = useState<{
    horse: HorseEntry;
    trendScore: TrendScore;
  } | null>(null);

  // State for scoring help modal
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // State for horse list sort order
  type SortOption = 'POST' | 'BASE' | 'VALUE' | 'ODDS';
  const [sortBy, setSortBy] = useState<SortOption>('POST');

  // Ref for scrolling to value play horse
  const horseListRef = useRef<HTMLDivElement>(null);

  const toggleHorseExpand = (horseId: string | number) => {
    setExpandedHorseId((prev) => (prev === horseId ? null : horseId));
  };

  // Scroll to and highlight a specific horse row
  const scrollToHorse = useCallback((horseIndex: number) => {
    const horseRow = document.getElementById(`horse-row-${horseIndex}`);
    if (horseRow) {
      horseRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight animation
      horseRow.classList.add('horse-summary-bar--highlighted');
      setTimeout(() => {
        horseRow.classList.remove('horse-summary-bar--highlighted');
      }, 1500);
    }
  }, []);

  // Handler for toggling compare selection
  const handleCompareToggle = (programNumber: number, selected: boolean) => {
    setCompareHorses((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(programNumber);
      } else {
        next.delete(programNumber);
      }
      return next;
    });
  };

  // Debug: Log parsed data when it changes
  useEffect(() => {
    if (parsedData) {
      console.log('Parsed DRF data:', parsedData);
      console.log('Track:', parsedData.races?.[0]?.header?.trackCode);
      console.log('Date:', parsedData.races?.[0]?.header?.raceDateRaw);
      console.log('Races:', parsedData.races?.length);

      // Debug: Log all race post time fields to find missing data patterns
      parsedData.races?.forEach((race, index) => {
        const header = race.header as unknown as Record<string, unknown>;
        console.log(`Race ${index + 1} post time fields:`, {
          postTime: header?.postTime,
          post_time: header?.post_time,
          PostTime: header?.PostTime,
          racePostTime: header?.racePostTime,
          postTimeText: header?.postTimeText,
          time: header?.time,
          raceTime: header?.raceTime,
          allKeys: header ? Object.keys(header) : [],
        });
      });
    }
  }, [parsedData]);

  // Reset scratches, odds, expanded state, and compare selections when race changes
  useEffect(() => {
    raceState.resetAll();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on race selection change
    setExpandedHorseId(null);
    setCompareHorses(new Set());
  }, [selectedRaceIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate scored horses for current race (needed for betting recommendations)
  const currentRaceScoredHorses = useMemo(() => {
    if (!parsedData) return [];

    const race = parsedData.races[selectedRaceIndex];
    if (!race) return [];

    return calculateRaceScores(
      race.horses,
      race.header,
      (i, originalOdds) => raceState.getOdds(i, originalOdds),
      (i) => raceState.isScratched(i),
      raceState.trackCondition
    );
  }, [parsedData, selectedRaceIndex, raceState]);

  // Calculate ranks based on BASE SCORE (not total score with overlay)
  const baseScoreRankMap = useMemo(() => {
    return calculateBaseScoreRanks(currentRaceScoredHorses);
  }, [currentRaceScoredHorses]);

  // Value detection analysis for the current race
  const valueAnalysis = useValueDetection(
    currentRaceScoredHorses,
    (index, originalOdds) => raceState.getOdds(index, originalOdds),
    (index) => raceState.isScratched(index)
  );

  // Create a set of value play horse indices for quick lookup
  const valuePlayIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const play of valueAnalysis.valuePlays) {
      indices.add(play.horseIndex);
    }
    return indices;
  }, [valueAnalysis.valuePlays]);

  // Get the primary value play horse index
  const primaryValuePlayIndex = valueAnalysis.primaryValuePlay?.horseIndex ?? -1;

  // Sort horses based on current sort option
  const sortedScoredHorses = useMemo(() => {
    if (!currentRaceScoredHorses.length) return currentRaceScoredHorses;

    const horses = [...currentRaceScoredHorses];

    switch (sortBy) {
      case 'POST':
        // Sort by post position (program number)
        return horses.sort((a, b) => a.horse.programNumber - b.horse.programNumber);

      case 'BASE':
        // Sort by base score (highest first)
        return horses.sort((a, b) => b.score.baseScore - a.score.baseScore);

      case 'VALUE':
        // Sort by overlay/edge percentage (highest first, then underlays)
        return horses.sort((a, b) => {
          const playA = valueAnalysis.valuePlays.find((p) => p.horseIndex === a.index);
          const playB = valueAnalysis.valuePlays.find((p) => p.horseIndex === b.index);
          const edgeA = playA?.valueEdge ?? -999;
          const edgeB = playB?.valueEdge ?? -999;
          return edgeB - edgeA;
        });

      case 'ODDS':
        // Sort by odds (lowest/favorites first)
        return horses.sort((a, b) => {
          const parseOdds = (oddsStr: string): number => {
            const parts = oddsStr.split('-');
            const num = parseFloat(parts[0] || '10');
            const den = parseFloat(parts[1] || '1');
            return num / den;
          };
          const oddsA = parseOdds(raceState.getOdds(a.index, a.horse.morningLineOdds));
          const oddsB = parseOdds(raceState.getOdds(b.index, b.horse.morningLineOdds));
          return oddsA - oddsB;
        });

      default:
        return horses;
    }
  }, [currentRaceScoredHorses, sortBy, valueAnalysis.valuePlays, raceState]);

  // Get current race data
  const currentRace = parsedData?.races?.[selectedRaceIndex];

  // Calculate blended rankings (includes trend analysis)
  const blendedRankedHorses = useMemo(() => {
    if (!currentRace) return [];
    return rankHorsesByBlended(currentRaceScoredHorses, currentRace.header);
  }, [currentRaceScoredHorses, currentRace]);

  // Create a map for quick lookup of blended rank info by horse index
  const blendedRankMap = useMemo(() => {
    const map = new Map<number, BlendedRankedHorse>();
    for (const brh of blendedRankedHorses) {
      map.set(brh.index, brh);
    }
    return map;
  }, [blendedRankedHorses]);

  // Get field size for color calculations (active horses only)
  const activeFieldSize = useMemo(() => {
    return blendedRankedHorses.filter((h) => !h.horse.isScratched).length;
  }, [blendedRankedHorses]);
  const postTimeString = currentRace?.header?.postTime;
  const raceDateString = currentRace?.header?.raceDateRaw;

  // Get raceDate from the first race (all races in a file are same track/date)
  const raceDate = parsedData?.races?.[0]?.header?.raceDateRaw;
  const trackCode = parsedData?.races?.[0]?.header?.trackCode;

  // Use post time hook for countdown
  const { countdown } = usePostTime(postTimeString, raceDateString);

  // Format race date for display
  const formatRaceDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'Unknown Date';
    // Try to parse and format the date
    try {
      // DRF dates are typically YYYYMMDD format
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}`);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Get track size (placeholder - could be enhanced with track database)
  const getTrackSize = (code: string | undefined): string => {
    // Common track sizes - this could be moved to track intelligence data
    const trackSizes: Record<string, string> = {
      CD: '1mi',
      SAR: '1⅛mi',
      BEL: '1½mi',
      GP: '1mi',
      KEE: '1⅛mi',
      PEN: '1mi',
      AQU: '1mi',
      DMR: '1mi',
      SA: '1mi',
      TAM: '1mi',
      OP: '1mi',
      FG: '1mi',
    };
    return trackSizes[code || ''] || '1mi';
  };

  // Format countdown for display - handles past races
  const formatCountdownDisplay = (
    postTime: string | undefined,
    raceDate: string | undefined,
    _countdownMs: number
  ): { text: string; isPosted: boolean } => {
    if (!postTime) return { text: '--:--', isPosted: false };

    try {
      // Construct full datetime from race date and post time
      let raceDateTime: Date;
      const timeStr = String(postTime).trim();

      // Parse the race date (YYYYMMDD format)
      let targetDate = new Date();
      if (raceDate && /^\d{8}$/.test(raceDate)) {
        const year = parseInt(raceDate.substring(0, 4));
        const month = parseInt(raceDate.substring(4, 6)) - 1; // 0-indexed
        const day = parseInt(raceDate.substring(6, 8));
        targetDate = new Date(year, month, day);
      }

      // Handle HHMM format (e.g., "1326" for 1:26 PM)
      if (/^\d{3,4}$/.test(timeStr)) {
        const padded = timeStr.padStart(4, '0');
        const hours = parseInt(padded.substring(0, 2));
        const minutes = parseInt(padded.substring(2));
        raceDateTime = new Date(targetDate);
        raceDateTime.setHours(hours, minutes, 0, 0);
      } else if (timeStr.includes(':')) {
        // Handle "HH:MM" or "H:MM" format
        const parts = timeStr.replace(/\s*(AM|PM)/i, '').split(':');
        let hours = parseInt(parts[0] || '0');
        const minutes = parseInt(parts[1] || '0');

        // Check for AM/PM
        if (/PM/i.test(timeStr) && hours < 12) hours += 12;
        if (/AM/i.test(timeStr) && hours === 12) hours = 0;

        raceDateTime = new Date(targetDate);
        raceDateTime.setHours(hours, minutes, 0, 0);
      } else {
        return { text: '--:--', isPosted: false };
      }

      const now = new Date();
      const diffMs = raceDateTime.getTime() - now.getTime();

      // If race is in the past, show "POSTED"
      if (diffMs < 0) {
        return { text: 'POSTED', isPosted: true };
      }

      // Convert to seconds
      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;

      // If more than 60 minutes, show hours:minutes:seconds
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return {
          text: `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
          isPosted: false,
        };
      }

      // Show minutes:seconds
      return {
        text: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        isPosted: false,
      };
    } catch {
      return { text: '--:--', isPosted: false };
    }
  };

  // Get countdown urgency level
  const getCountdownUrgency = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds <= 0) return 'normal';
    if (seconds <= 300) return 'critical'; // 5 minutes
    if (seconds <= 600) return 'warning'; // 10 minutes
    return 'normal';
  };

  // Get post time from race header, checking all possible field names
  const getPostTime = (race: ParsedRace | undefined): string | number | undefined => {
    if (!race?.header) return undefined;

    const header = race.header as unknown as Record<string, unknown>;

    // Try all possible field names
    const timeValue =
      header.postTime ||
      header.post_time ||
      header.PostTime ||
      header.racePostTime ||
      header.postTimeText ||
      header.time ||
      header.raceTime;

    return timeValue as string | number | undefined;
  };

  // Format post time for display (e.g., "1:26 PM")
  const formatPostTime = (postTime: string | number | undefined): string => {
    if (!postTime) return '--:--';

    try {
      const timeStr = String(postTime).trim();

      // Handle numeric formats (military time like 1326 or 326 or 115)
      if (/^\d{3,4}$/.test(timeStr)) {
        const padded = timeStr.padStart(4, '0');
        const hours = parseInt(padded.substring(0, 2), 10);
        const minutes = parseInt(padded.substring(2), 10);

        // Validate hours and minutes
        if (hours > 23 || minutes > 59) {
          return '--:--';
        }

        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }

      // Handle "HH:MM" format (12 or 24 hour)
      const colonMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (colonMatch && colonMatch[1] && colonMatch[2]) {
        let hours = parseInt(colonMatch[1], 10);
        const minutes = parseInt(colonMatch[2], 10);
        let period = colonMatch[3]?.toUpperCase();

        // Validate minutes
        if (minutes > 59) {
          return '--:--';
        }

        // If no AM/PM specified, assume PM for typical race times (afternoon)
        if (!period) {
          // If hour is 1-11, assume PM (typical race time)
          // If hour is 12-23, convert from 24h format
          if (hours >= 13 && hours <= 23) {
            period = 'PM';
            hours = hours - 12;
          } else if (hours === 0) {
            period = 'AM';
            hours = 12;
          } else if (hours === 12) {
            period = 'PM';
          } else {
            // 1-11: assume PM for race times
            period = 'PM';
          }
        }

        return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }

      // If already has AM/PM, return as-is
      if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(timeStr)) {
        return timeStr;
      }

      return '--:--';
    } catch {
      return '--:--';
    }
  };

  // Determine race status based on post time
  const getRaceStatus = (
    race: ParsedRace,
    _index: number
  ): { status: 'final' | 'critical' | 'warning' | 'normal'; minutesToPost: number } => {
    const postTimeValue = getPostTime(race);
    if (!postTimeValue) {
      return { status: 'normal', minutesToPost: 999 };
    }

    try {
      // Get current time
      const now = new Date();

      // Convert to string for parsing
      const postTime = String(postTimeValue).trim();

      // Parse race post time - adjust based on actual DRF format
      let postTimeDate: Date;

      if (/^\d{3,4}$/.test(postTime) && !postTime.includes(':')) {
        // Military format "1326" or "326"
        const padded = postTime.padStart(4, '0');
        const hours = parseInt(padded.substring(0, 2));
        const minutes = parseInt(padded.substring(2));
        postTimeDate = new Date();
        postTimeDate.setHours(hours, minutes, 0, 0);
      } else {
        // Try parsing as-is
        postTimeDate = new Date(`${now.toDateString()} ${postTime}`);
      }

      const diffMs = postTimeDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      if (diffMinutes < -10) {
        // Race was more than 10 minutes ago - consider it final
        return { status: 'final', minutesToPost: diffMinutes };
      } else if (diffMinutes < 5) {
        // Less than 5 minutes to post
        return { status: 'critical', minutesToPost: diffMinutes };
      } else if (diffMinutes < 10) {
        // 5-10 minutes to post
        return { status: 'warning', minutesToPost: diffMinutes };
      } else {
        return { status: 'normal', minutesToPost: diffMinutes };
      }
    } catch {
      return { status: 'normal', minutesToPost: 999 };
    }
  };

  // Determine compactness based on number of races
  const getRailCompactClass = (raceCount: number): string => {
    if (raceCount > 14) return 'app-race-rail--very-compact';
    if (raceCount > 10) return 'app-race-rail--compact';
    return '';
  };

  // Handle file upload click - trigger the hidden FileUpload's input
  const handleFileUpload = () => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  // Get countdown display info
  const countdownDisplay = formatCountdownDisplay(
    postTimeString,
    raceDateString,
    countdown.totalMs
  );

  // Get countdown seconds from the countdown state (for urgency calculation)
  const countdownSeconds = countdown.totalMs > 0 ? Math.floor(countdown.totalMs / 1000) : 0;

  return (
    <div className="app-layout app-layout--full-width">
      {/* LEFT ZONE: Top bar, Race rail + Main content, Bottom bar */}
      <div className="app-left-zone">
        {/* Top Bar - Single row */}
        <header className="app-topbar">
          {!parsedData ? (
            /* EMPTY STATE - No DRF loaded */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
                <span className="app-topbar__logo-text">Furlong</span>
              </div>

              {/* Separator after logo */}
              <div className="app-topbar__separator"></div>

              <div className="app-topbar__empty">
                <button
                  className="app-topbar__upload-btn app-topbar__upload-btn--large"
                  onClick={handleFileUpload}
                  disabled={isLoading}
                >
                  <span className="material-icons">
                    {isLoading ? 'hourglass_empty' : 'upload_file'}
                  </span>
                  <span>{isLoading ? 'Parsing...' : 'Upload DRF File'}</span>
                </button>
              </div>
            </>
          ) : (
            /* LOADED STATE - DRF file loaded */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
                <span className="app-topbar__logo-text">Furlong</span>
              </div>

              {/* Separator after logo */}
              <div className="app-topbar__separator"></div>

              {/* Left section: Track, Date, Race - larger font */}
              <div className="app-topbar__identity">
                <span className="app-topbar__track">
                  {getTrackDisplayName(trackCode, getTrackSize(trackCode))}
                </span>
                <span className="app-topbar__dot">•</span>
                <span className="app-topbar__date">{formatRaceDate(raceDate)}</span>
                <span className="app-topbar__dot">•</span>
                <span className="app-topbar__race-label">
                  Race {selectedRaceIndex + 1} of {parsedData.races?.length || 0}
                </span>
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Center: Race info box - can be 1 or 2 lines */}
              <div className="app-topbar__race-info-box">
                {(() => {
                  const desc = buildRaceDescription(currentRace);
                  return (
                    <div className="app-topbar__race-info-text">
                      <span className="app-topbar__race-info-line">{desc.line1}</span>
                      {desc.line2 && (
                        <span className="app-topbar__race-info-line">{desc.line2}</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Post time countdown */}
              <div
                className={`app-topbar__countdown ${countdownDisplay.isPosted ? 'app-topbar__countdown--posted' : `app-topbar__countdown--${getCountdownUrgency(countdownSeconds)}`}`}
              >
                {countdownDisplay.isPosted ? (
                  <span className="app-topbar__countdown-time">{countdownDisplay.text}</span>
                ) : (
                  <>
                    <span>Post </span>
                    <span className="app-topbar__countdown-time">{countdownDisplay.text}</span>
                  </>
                )}
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Track condition dropdown */}
              <div className="app-topbar__condition">
                <select
                  className="app-topbar__condition-select"
                  value={trackCondition}
                  onChange={(e) =>
                    onTrackConditionChange(e.target.value as RaceStateTrackCondition)
                  }
                >
                  <option value="fast">Fast</option>
                  <option value="good">Good</option>
                  <option value="muddy">Muddy</option>
                  <option value="sloppy">Sloppy</option>
                  <option value="yielding">Yielding</option>
                  <option value="firm">Firm</option>
                </select>
              </div>
            </>
          )}
        </header>

        {/* Race Rail */}
        <aside
          className={`app-race-rail ${parsedData?.races ? getRailCompactClass(parsedData.races.length) : ''}`}
        >
          {parsedData?.races?.map((race, index) => {
            const raceStatus = getRaceStatus(race, index);
            const isActive = index === selectedRaceIndex;

            return (
              <button
                key={index}
                className={`app-race-rail__item ${isActive ? 'app-race-rail__item--active' : ''} app-race-rail__item--${raceStatus.status}`}
                onClick={() => onRaceSelect?.(index)}
              >
                <span className="app-race-rail__number">
                  R{race.header?.raceNumber || index + 1}
                </span>
                <span className="app-race-rail__time">
                  {raceStatus.status === 'final' ? 'FINAL' : formatPostTime(getPostTime(race))}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="app-main">
          {viewMode === 'betMode' ? (
            /* BET MODE - Full screen betting interface */
            <BetModeContainer
              race={currentRace}
              raceNumber={selectedRaceIndex + 1}
              trackName={
                trackCode ? getTrackDisplayName(trackCode, getTrackSize(trackCode)) : undefined
              }
              valueAnalysis={valueAnalysis}
              scoredHorses={currentRaceScoredHorses}
              getOdds={(index, defaultOdds) => raceState.getOdds(index, defaultOdds)}
              isScratched={(index) => raceState.isScratched(index)}
              onClose={() => setViewMode('analysis')}
            />
          ) : (
            /* ANALYSIS MODE - Horse list and analysis view */
            <div className="app-main__content">
              {!parsedData ? (
                <div className="app-main__placeholder">
                  <span
                    className="material-icons"
                    style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
                  >
                    upload_file
                  </span>
                  <h2>No Race Data</h2>
                  <p>Upload a DRF file to see horses and analysis</p>
                </div>
              ) : !currentRaceScoredHorses?.length ? (
                <div className="app-main__placeholder">
                  <span
                    className="material-icons"
                    style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
                  >
                    analytics
                  </span>
                  <h2>Select a Race</h2>
                  <p>Click a race on the left to see horses</p>
                </div>
              ) : (
                <div className="horse-list" ref={horseListRef}>
                  {/* Race Verdict Header - Shows BET/CAUTION/PASS verdict */}
                  <RaceVerdictHeader
                    valueAnalysis={valueAnalysis}
                    raceNumber={selectedRaceIndex + 1}
                    onValuePlayClick={scrollToHorse}
                  />

                  {/* Sort Controls */}
                  <div className="horse-list-sort">
                    <span className="horse-list-sort__label">Sort by:</span>
                    <div className="horse-list-sort__options">
                      {(['POST', 'BASE', 'VALUE', 'ODDS'] as const).map((option) => (
                        <button
                          key={option}
                          className={`horse-list-sort__btn ${sortBy === option ? 'horse-list-sort__btn--active' : ''}`}
                          onClick={() => setSortBy(option)}
                          title={
                            option === 'POST'
                              ? 'Sort by post position'
                              : option === 'BASE'
                                ? 'Sort by model rank (highest score first)'
                                : option === 'VALUE'
                                  ? 'Sort by edge % (best overlays first)'
                                  : 'Sort by odds (favorites first)'
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Column Headers - 9 columns: icons | POST | HORSE | RANK | ODDS | FAIR | EDGE | VALUE | expand */}
                  <div className="horse-list-header">
                    {/* Column 1: Help button */}
                    <div className="horse-list-header__cell horse-list-header__cell--icons">
                      <button
                        type="button"
                        className="help-trigger-btn"
                        onClick={() => setHelpModalOpen(true)}
                        aria-label="How to read the form"
                        title="How to Read the Form"
                      >
                        <span className="material-icons">help_outline</span>
                      </button>
                    </div>

                    {/* Column 2: POST - No subtext, vertically centered */}
                    <div className="horse-list-header__cell horse-list-header__cell--pp horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Post Position"
                        content="The starting gate number where the horse begins the race. Lower numbers start closer to the inside rail."
                      >
                        <span className="horse-list-header__label">POST</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 3: Horse Name - No subtext, vertically centered */}
                    <div className="horse-list-header__cell horse-list-header__cell--name horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Horse Name"
                        content="Click on a horse row to see detailed information including past races, trainer, jockey, and scoring breakdown."
                      >
                        <span className="horse-list-header__label">HORSE</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 4: RANK - Model ranking based on base score */}
                    <div className="horse-list-header__cell horse-list-header__cell--rank horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Model Rank"
                        content="Our model's ranking of this horse based on speed, class, form, pace, and connections. #1 is our top pick."
                      >
                        <span className="horse-list-header__label">RANK</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 5: ODDS - Market price */}
                    <div className="horse-list-header__cell horse-list-header__cell--odds horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Current Odds"
                        content="Current odds from morning line or your manual update. Click to edit with live odds."
                      >
                        <span className="horse-list-header__label">ODDS</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 6: FAIR - Calculated fair odds based on base score */}
                    <div className="horse-list-header__cell horse-list-header__cell--fair-odds horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Fair Odds"
                        content="What we think the odds SHOULD be based on our analysis. Lower fair odds = better horse."
                      >
                        <span className="horse-list-header__label">FAIR</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 7: EDGE - Value gap percentage */}
                    <div className="horse-list-header__cell horse-list-header__cell--edge horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Edge"
                        content="The value gap. Positive = public is offering better odds than deserved (bet these). Negative = horse is overbet (skip)."
                      >
                        <span className="horse-list-header__label">EDGE</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 8: VALUE - Overlay/Fair/Underlay badge */}
                    <div className="horse-list-header__cell horse-list-header__cell--value horse-list-header__cell--no-subtext">
                      <HeaderTooltip
                        title="Value Status"
                        content="Overlay = value bet. Underlay = no value. Fair = neutral."
                      >
                        <span className="horse-list-header__label">VALUE</span>
                      </HeaderTooltip>
                    </div>

                    {/* Column 9: Expand */}
                    <div className="horse-list-header__cell horse-list-header__cell--expand">
                      {/* Empty */}
                    </div>
                  </div>

                  {/* Collect all field base scores for proper overlay calculation */}
                  {(() => {
                    const allFieldBaseScores = sortedScoredHorses
                      .filter((h) => !h.score.isScratched)
                      .map((h) => h.score.baseScore);

                    return sortedScoredHorses.map((scoredHorse, index) => {
                      const horse = scoredHorse.horse;
                      const horseId = horse.programNumber || index;
                      const horseIndex = scoredHorse.index;
                      const currentOddsString = raceState.getOdds(
                        horseIndex,
                        horse.morningLineOdds
                      );

                      // Calculate overlay analysis using field-relative base scores
                      // Uses BASE score (not total) for proper fair odds calculation
                      const overlay = analyzeOverlayWithField(
                        scoredHorse.score.baseScore,
                        allFieldBaseScores,
                        currentOddsString
                      );

                      // Parse fair odds display (e.g., "3-1" to numerator/denominator)
                      // Handle special cases: "EVEN", "N/A", or em-dash fallback
                      let fairOddsNum = 2;
                      let fairOddsDen = 1;

                      if (overlay.fairOddsDisplay === 'EVEN') {
                        fairOddsNum = 1;
                        fairOddsDen = 1;
                      } else if (
                        overlay.fairOddsDisplay !== 'N/A' &&
                        overlay.fairOddsDisplay !== '—' &&
                        overlay.fairOddsDisplay.includes('-')
                      ) {
                        const fairOddsParts = overlay.fairOddsDisplay.split('-');
                        const parsedNum = parseInt(fairOddsParts[0] || '2', 10);
                        const parsedDen = parseInt(fairOddsParts[1] || '1', 10);
                        // Validate parsed values are not NaN
                        fairOddsNum = Number.isFinite(parsedNum) ? parsedNum : 2;
                        fairOddsDen = Number.isFinite(parsedDen) ? parsedDen : 1;
                      }

                      // Parse current odds to { numerator, denominator } format
                      const parseOdds = (
                        oddsStr: string
                      ): { numerator: number; denominator: number } => {
                        if (typeof oddsStr === 'string') {
                          const parts = oddsStr.split('-');
                          return {
                            numerator: parseInt(parts[0] || '2', 10) || 2,
                            denominator: parseInt(parts[1] || '1', 10) || 1,
                          };
                        }
                        return { numerator: 2, denominator: 1 };
                      };

                      const currentOdds = parseOdds(currentOddsString);
                      const isScratched = raceState.isScratched(horseIndex);
                      const pp = horse.programNumber || horseIndex + 1;

                      // Handle odds change - convert back to string format for raceState
                      const handleOddsChange = (odds: {
                        numerator: number;
                        denominator: number;
                      }) => {
                        raceState.updateOdds(horseIndex, `${odds.numerator}-${odds.denominator}`);
                      };

                      // Handle scratch toggle - also removes from compare if scratched
                      const handleScratchToggle = (scratched: boolean) => {
                        raceState.setScratch(horseIndex, scratched);
                        // Also remove from compare if scratched
                        if (scratched) {
                          setCompareHorses((prev) => {
                            const next = new Set(prev);
                            next.delete(pp);
                            return next;
                          });
                        }
                      };

                      // Get base score rank info for this horse
                      const rankInfo = baseScoreRankMap.get(horseIndex);

                      // Get blended rank info for this horse
                      const blendedInfo = blendedRankMap.get(horseIndex);
                      const trendRank = blendedInfo?.trendRank ?? 0;
                      const blendedRank = blendedInfo?.blendedResult?.blendedRank ?? 0;

                      // Calculate colors for trend and blended ranks
                      const trendRankColor =
                        trendRank > 0 && activeFieldSize > 0
                          ? calculateRankGradientColor(trendRank - 1, activeFieldSize)
                          : '#555555';
                      const blendedRankColor =
                        blendedRank > 0 && activeFieldSize > 0
                          ? calculateRankGradientColor(blendedRank - 1, activeFieldSize)
                          : '#555555';

                      // Find value play info for this horse
                      const valuePlay = valueAnalysis.valuePlays.find(
                        (vp) => vp.horseIndex === horseIndex
                      );

                      return (
                        <div key={horseId} className="horse-list__item">
                          <HorseSummaryBar
                            horse={horse}
                            rank={scoredHorse.rank}
                            isExpanded={expandedHorseId === horseId}
                            onToggleExpand={() => toggleHorseExpand(horseId)}
                            maxScore={MAX_SCORE}
                            score={scoredHorse.score.total}
                            fairOddsNum={fairOddsNum}
                            fairOddsDen={fairOddsDen}
                            fairOddsDisplay={overlay.fairOddsDisplay}
                            valuePercent={overlay.overlayPercent}
                            isScratched={isScratched}
                            onScratchToggle={handleScratchToggle}
                            currentOdds={currentOdds}
                            onOddsChange={handleOddsChange}
                            isCompareSelected={compareHorses.has(pp)}
                            onCompareToggle={(selected) => handleCompareToggle(pp, selected)}
                            // Base score rank info (projected finish order)
                            baseScoreRank={rankInfo?.rank}
                            baseScoreRankOrdinal={rankInfo?.ordinal}
                            baseScoreRankColor={rankInfo?.color}
                            // Trend rank info (form trajectory)
                            trendRank={trendRank}
                            trendRankOrdinal={trendRank > 0 ? toOrdinal(trendRank) : '—'}
                            trendRankColor={trendRankColor}
                            trendScore={blendedInfo?.trendScore}
                            onTrendClick={
                              blendedInfo?.trendScore
                                ? () =>
                                    setTrendModalHorse({
                                      horse,
                                      trendScore: blendedInfo.trendScore,
                                    })
                                : undefined
                            }
                            // Blended rank info (combined base + trend)
                            blendedRank={blendedRank}
                            blendedRankOrdinal={blendedRank > 0 ? toOrdinal(blendedRank) : '—'}
                            blendedRankColor={blendedRankColor}
                            blendedResult={blendedInfo?.blendedResult}
                            // Value play highlighting
                            isValuePlay={valuePlayIndices.has(horseIndex)}
                            isPrimaryValuePlay={horseIndex === primaryValuePlayIndex}
                            edgePercent={valuePlay?.valueEdge}
                            rowId={`horse-row-${horseIndex}`}
                          />
                          <HorseExpandedView
                            horse={horse}
                            isVisible={expandedHorseId === horseId && !isScratched}
                            valuePercent={overlay.overlayPercent}
                            score={scoredHorse.score}
                            // New value-focused props
                            currentOdds={currentOddsString}
                            fairOdds={overlay.fairOddsDisplay}
                            edgePercent={valuePlay?.valueEdge ?? overlay.overlayPercent}
                            modelRank={rankInfo?.rank ?? scoredHorse.rank}
                            totalHorses={activeFieldSize}
                            isOverlay={overlay.overlayPercent > 20}
                            isUnderlay={overlay.overlayPercent < -20}
                            isPrimaryValuePlay={horseIndex === primaryValuePlayIndex}
                            betTypeSuggestion={valuePlay?.betType || undefined}
                            // Race-level context for PASS race handling
                            raceVerdict={valueAnalysis.verdict}
                            isBestInPassRace={
                              valueAnalysis.verdict === 'PASS' &&
                              (rankInfo?.rank ?? scoredHorse.rank) === 1
                            }
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Value Action Bar - Fixed above bottom bar */}
        <ValueActionBar
          valueAnalysis={parsedData ? valueAnalysis : null}
          raceNumber={selectedRaceIndex + 1}
          onViewValuePlay={scrollToHorse}
          hasRaceData={!!parsedData && currentRaceScoredHorses.length > 0}
        />

        {/* Bottom Bar */}
        <footer className="app-bottombar">
          {/* Left cluster - Account */}
          <div className="app-bottombar__cluster">
            <button className="app-bottombar__item">
              <span className="material-icons">person</span>
              <span>Guest</span>
            </button>
          </div>

          {/* Separator between Account and Settings */}
          <div className="app-bottombar__separator"></div>

          {/* Settings cluster */}
          <div className="app-bottombar__cluster">
            <button className="app-bottombar__item">
              <span className="material-icons">settings</span>
              <span>Settings</span>
            </button>
          </div>

          {/* Separator after Settings */}
          <div className="app-bottombar__separator"></div>

          {/* BET MODE button - Primary action */}
          <div className="app-bottombar__cluster">
            <button
              className={`app-bottombar__item app-bottombar__item--bet-mode ${viewMode === 'betMode' ? 'app-bottombar__item--bet-mode-active' : ''}`}
              onClick={() => setViewMode(viewMode === 'betMode' ? 'analysis' : 'betMode')}
              disabled={!parsedData || isLoading}
              title={
                viewMode === 'betMode' ? 'Return to analysis view' : 'Enter bet mode to place bets'
              }
            >
              <span className="app-bottombar__bet-icon">🎯</span>
              <span>{viewMode === 'betMode' ? 'ANALYSIS' : 'BET MODE'}</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* Center spacer */}
          <div className="app-bottombar__spacer"></div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* Upload button */}
          <div className="app-bottombar__cluster">
            <button
              className="app-bottombar__item app-bottombar__item--upload"
              onClick={handleFileUpload}
              disabled={isLoading}
            >
              <span className="material-icons">
                {isLoading ? 'hourglass_empty' : 'upload_file'}
              </span>
              <span>{isLoading ? 'Parsing...' : 'Upload'}</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* Right cluster - Help */}
          <div className="app-bottombar__cluster">
            <button className="app-bottombar__item">
              <span className="material-icons">help_outline</span>
              <span>Help</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* Legal */}
          <div className="app-bottombar__cluster">
            <button className="app-bottombar__item">
              <span className="material-icons">gavel</span>
              <span>Legal</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* Icon-only cluster - Fullscreen, Multi-window */}
          <div className="app-bottombar__cluster">
            <button
              className="app-bottombar__item app-bottombar__item--icon-only"
              title="Fullscreen"
            >
              <span className="material-icons">fullscreen</span>
            </button>
            <button
              className="app-bottombar__item app-bottombar__item--icon-only"
              title="Multi-window"
            >
              <span className="material-icons">open_in_new</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Hidden file upload - FileUpload component handles parsing */}
      <div className="sr-only">
        <FileUpload onParsed={onParsed} />
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="app-loading-overlay">
          <div className="app-loading-spinner">
            <span className="material-icons spinning">sync</span>
            <span>Parsing DRF file...</span>
          </div>
        </div>
      )}

      {/* Scoring Help Modal */}
      <ScoringHelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />

      {/* Trend Detail Modal */}
      {trendModalHorse && (
        <TrendDetailModal
          isOpen={true}
          onClose={() => setTrendModalHorse(null)}
          horse={trendModalHorse.horse}
          trendData={trendModalHorse.trendScore}
        />
      )}
    </div>
  );
};

export default Dashboard;
