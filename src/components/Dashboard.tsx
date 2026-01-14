import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './Dashboard.css';
import { useValueDetection } from '../hooks/useValueDetection';
import { useRaceBets } from '../hooks/useRaceBets';
import { BetModeContainer } from './BetMode';
import { TopBetsPanel } from './TopBets';
import { FileUpload } from './FileUpload';
import { HorseExpandedView } from './HorseExpandedView';
import { HorseSummaryBar } from './HorseSummaryBar';
import { ScoringHelpModal } from './ScoringHelpModal';
import { RaceVerdictHeader } from './RaceVerdictHeader';
import { RaceOverview } from './RaceOverview';
import {
  calculateRaceScores,
  MAX_SCORE,
  analyzeOverlayWithField,
  calculateBaseScoreRanks,
  calculateRaceConfidence,
  getTopHorses,
} from '../lib/scoring';
import { analyzeRaceDiamonds } from '../lib/diamonds';
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

// Build FULL race description - NO abbreviations, ALL data shown
// A 5-year-old should understand exactly what this race is about
const buildFullRaceInfo = (race: ParsedRace | undefined): string => {
  if (!race?.header) return '';

  const parts: string[] = [];
  const header = race.header;

  // 1. Surface - full word
  if (header.surface) {
    const surfaceDisplay: Record<string, string> = {
      dirt: 'Dirt',
      turf: 'Turf',
      synthetic: 'Synthetic',
      'all-weather': 'All-Weather',
    };
    parts.push(surfaceDisplay[header.surface] || header.surface);
  }

  // 2. Distance - FULL format, no abbreviations
  if (header.distance) {
    let distanceDisplay = header.distance;
    // Keep full words - don't abbreviate
    if (header.isAbout) {
      distanceDisplay = `About ${distanceDisplay}`;
    }
    parts.push(distanceDisplay);
  }

  // 3. Race type/classification - FULL names
  if (header.raceName) {
    // Stakes race with full grade
    let stakesDisplay = header.raceName;
    if (header.grade) {
      stakesDisplay = `Grade ${header.grade} ${stakesDisplay}`;
    } else if (header.isListed) {
      stakesDisplay = `Listed Stakes: ${stakesDisplay}`;
    }
    parts.push(stakesDisplay);
  } else if (header.raceType && header.raceType.trim()) {
    parts.push(header.raceType);
  } else if (header.classification) {
    const classDisplay: Record<string, string> = {
      maiden: 'Maiden',
      'maiden-claiming': 'Maiden Claiming',
      claiming: 'Claiming',
      allowance: 'Allowance',
      'allowance-optional-claiming': 'Allowance Optional Claiming',
      'starter-allowance': 'Starter Allowance',
      stakes: 'Stakes',
      'stakes-listed': 'Listed Stakes',
      'stakes-graded-3': 'Grade 3 Stakes',
      'stakes-graded-2': 'Grade 2 Stakes',
      'stakes-graded-1': 'Grade 1 Stakes',
      handicap: 'Handicap',
      unknown: 'Race',
    };
    parts.push(classDisplay[header.classification] || header.classification);
  }

  // 4. Claiming price - full dollar amounts
  if (header.claimingPriceMin || header.claimingPriceMax) {
    if (
      header.claimingPriceMin &&
      header.claimingPriceMax &&
      header.claimingPriceMin !== header.claimingPriceMax
    ) {
      parts.push(
        `Claiming Price ${formatCurrency(header.claimingPriceMin)} to ${formatCurrency(header.claimingPriceMax)}`
      );
    } else {
      const price = header.claimingPriceMax || header.claimingPriceMin || 0;
      parts.push(`Claiming Price ${formatCurrency(price)}`);
    }
  }

  // 5. Age restriction - FULL words
  if (header.ageRestriction && header.ageRestriction.trim()) {
    // Expand common abbreviations to full words
    let ageDisplay = header.ageRestriction;
    ageDisplay = ageDisplay
      .replace(/(\d+)\s*yo\b/gi, '$1 Year Olds')
      .replace(/(\d+)\s*&\s*up/gi, '$1 Years Old and Up')
      .replace(/(\d+)\s*\+/g, '$1 Years Old and Up')
      .replace(/3yo/gi, '3 Year Olds')
      .replace(/2yo/gi, '2 Year Olds')
      .replace(/4yo/gi, '4 Year Olds');
    parts.push(ageDisplay);
  }

  // 6. Sex restriction - FULL words
  if (header.sexRestriction && header.sexRestriction.trim()) {
    // Expand common abbreviations
    let sexDisplay = header.sexRestriction;
    sexDisplay = sexDisplay
      .replace(/\bF\s*&\s*M\b/gi, 'Fillies and Mares')
      .replace(/\bC\s*&\s*G\b/gi, 'Colts and Geldings')
      .replace(/\bF\b/g, 'Fillies')
      .replace(/\bM\b/g, 'Mares')
      .replace(/\bC\b/g, 'Colts')
      .replace(/\bG\b/g, 'Geldings');
    parts.push(sexDisplay);
  }

  // 7. State-bred restriction
  if (header.stateBred && header.stateBred.trim()) {
    parts.push(`${header.stateBred} Bred`);
  }

  // 8. Purse - full currency format
  if (header.purse) {
    parts.push(`Purse ${header.purseFormatted || formatCurrency(header.purse)}`);
  }

  // 9. Field size - full words
  const fieldSize = race.horses?.length || header.fieldSize || 0;
  if (fieldSize > 0) {
    parts.push(`${fieldSize} Horse${fieldSize !== 1 ? 's' : ''} Entered`);
  }

  // 10. Weight conditions if available
  if (header.weightConditions && header.weightConditions.trim()) {
    parts.push(header.weightConditions);
  }

  // 11. Turf course type
  if (header.turfCourseType && header.turfCourseType.trim()) {
    parts.push(`${header.turfCourseType} Turf Course`);
  }

  // 12. Temp rail position
  if (header.tempRail && header.tempRail.trim()) {
    parts.push(`Rail at ${header.tempRail}`);
  }

  // 13. Chute start
  if (header.chuteStart) {
    parts.push('Starting from Chute');
  }

  return parts.join(' · ');
};

// Get the full race conditions text (the detailed eligibility conditions)
const getFullConditions = (race: ParsedRace | undefined): string => {
  if (!race?.header?.conditions) return '';
  return race.header.conditions;
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
  // View mode state: 'overview' (default after parse), 'analysis', 'betMode', or 'topBets'
  const [viewMode, setViewMode] = useState<'overview' | 'analysis' | 'betMode' | 'topBets'>(
    'analysis'
  );

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

  // State for horse list sort order and direction
  // Sortable columns: POST, RANK, ODDS, FAIR, EDGE
  // Non-sortable: HORSE (name), VALUE (badge)
  type SortColumn = 'POST' | 'RANK' | 'ODDS' | 'FAIR' | 'EDGE';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>('POST');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle column header click for sorting
  const handleColumnSort = useCallback(
    (column: SortColumn) => {
      if (column === sortColumn) {
        // Toggle direction if clicking same column
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        // Switch to new column with default ascending
        setSortColumn(column);
        setSortDirection('asc');
      }
    },
    [sortColumn]
  );

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

  // Handler for selecting a race from the overview and transitioning to analysis mode
  const handleRaceSelectFromOverview = useCallback(
    (raceIndex: number) => {
      onRaceSelect?.(raceIndex);
      setViewMode('analysis');
    },
    [onRaceSelect]
  );

  // Handler for going back to overview from analysis mode
  const handleBackToOverview = useCallback(() => {
    setViewMode('overview');
  }, []);

  // Track previous parsedData to detect when new data is loaded
  const prevParsedDataRef = useRef<ParsedDRFFile | null>(null);

  // Set viewMode to 'overview' when new DRF data is parsed
  useEffect(() => {
    if (parsedData && parsedData !== prevParsedDataRef.current) {
      // New data loaded - switch to overview mode
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing viewMode with new parsedData prop
      setViewMode('overview');
      prevParsedDataRef.current = parsedData;

      // Debug logging
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

  // Calculate scored horses for ALL races (for day planning mode)
  // Uses original odds (not live updates) for consistent planning
  const allScoredHorses = useMemo(() => {
    if (!parsedData) return [];

    return parsedData.races.map((race) => {
      return calculateRaceScores(
        race.horses,
        race.header,
        (_i, originalOdds) => originalOdds, // Use original odds for planning
        () => false, // No scratches for planning (user can adjust per-race)
        raceState.trackCondition
      );
    });
  }, [parsedData, raceState.trackCondition]);

  // Calculate RaceOverview data: confidences, top horses, diamonds, elite connections
  const raceOverviewData = useMemo(() => {
    if (!parsedData || allScoredHorses.length === 0) {
      return {
        raceConfidences: new Map<number, number>(),
        topHorsesByRace: new Map<number, (typeof allScoredHorses)[0]>(),
        diamondCountByRace: new Map<number, number>(),
        eliteConnectionsCountByRace: new Map<number, number>(),
      };
    }

    const raceConfidences = new Map<number, number>();
    const topHorsesByRace = new Map<number, (typeof allScoredHorses)[0]>();
    const diamondCountByRace = new Map<number, number>();
    const eliteConnectionsCountByRace = new Map<number, number>();

    parsedData.races.forEach((race, raceIndex) => {
      const scoredHorses = allScoredHorses[raceIndex] || [];

      // Calculate race confidence
      const confidence = calculateRaceConfidence(scoredHorses);
      raceConfidences.set(raceIndex, confidence);

      // Get top 3 horses for preview
      const topHorses = getTopHorses(scoredHorses, 3);
      topHorsesByRace.set(raceIndex, topHorses);

      // Count diamonds in this race
      const scoreMap = new Map<number, (typeof scoredHorses)[0]['score']>();
      scoredHorses.forEach((sh) => {
        scoreMap.set(sh.index, sh.score);
      });

      const diamondSummary = analyzeRaceDiamonds(
        race.horses,
        scoreMap,
        race.header,
        (_index, defaultOdds) => defaultOdds // Use morning line for overview
      );
      diamondCountByRace.set(raceIndex, diamondSummary.diamondCount);

      // Count horses with elite connections (30+ connection points)
      let eliteCount = 0;
      for (const sh of scoredHorses) {
        if (!sh.score.isScratched) {
          // Elite connections defined as 30+ points in connections category
          const connectionsTotal = sh.score.breakdown.connections.total;
          if (connectionsTotal >= 30) {
            eliteCount++;
          }
        }
      }
      eliteConnectionsCountByRace.set(raceIndex, eliteCount);
    });

    return {
      raceConfidences,
      topHorsesByRace,
      diamondCountByRace,
      eliteConnectionsCountByRace,
    };
  }, [parsedData, allScoredHorses]);

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

  // Sort horses based on current sort column and direction
  const sortedScoredHorses = useMemo(() => {
    if (!currentRaceScoredHorses.length) return currentRaceScoredHorses;

    const horses = [...currentRaceScoredHorses];
    const direction = sortDirection === 'asc' ? 1 : -1;

    // Helper to parse odds string to decimal
    const parseOdds = (oddsStr: string): number => {
      const parts = oddsStr.split('-');
      const num = parseFloat(parts[0] || '10');
      const den = parseFloat(parts[1] || '1');
      return num / den;
    };

    switch (sortColumn) {
      case 'POST':
        // Sort by post position (program number)
        return horses.sort((a, b) => (a.horse.programNumber - b.horse.programNumber) * direction);

      case 'RANK':
        // Sort by base score rank (lower rank = better)
        return horses.sort((a, b) => {
          const rankA = baseScoreRankMap.get(a.index)?.rank ?? 999;
          const rankB = baseScoreRankMap.get(b.index)?.rank ?? 999;
          return (rankA - rankB) * direction;
        });

      case 'ODDS':
        // Sort by odds (lower = favorites first in asc)
        return horses.sort((a, b) => {
          const oddsA = parseOdds(raceState.getOdds(a.index, a.horse.morningLineOdds));
          const oddsB = parseOdds(raceState.getOdds(b.index, b.horse.morningLineOdds));
          return (oddsA - oddsB) * direction;
        });

      case 'FAIR':
        // Sort by fair odds (lower = better horse)
        return horses.sort((a, b) => {
          // Need to calculate fair odds for each horse
          const scoreA = a.score.baseScore;
          const scoreB = b.score.baseScore;
          // Higher score = lower fair odds (better horse)
          // So we sort by score descending for ascending fair odds order
          return (scoreB - scoreA) * direction;
        });

      case 'EDGE':
        // Sort by edge percentage (higher = better value)
        return horses.sort((a, b) => {
          const playA = valueAnalysis.valuePlays.find((p) => p.horseIndex === a.index);
          const playB = valueAnalysis.valuePlays.find((p) => p.horseIndex === b.index);
          const edgeA = playA?.valueEdge ?? -999;
          const edgeB = playB?.valueEdge ?? -999;
          // For edge, descending is more natural (best first)
          // So we invert the direction
          return (edgeB - edgeA) * direction;
        });

      default:
        return horses;
    }
  }, [
    currentRaceScoredHorses,
    sortColumn,
    sortDirection,
    valueAnalysis.valuePlays,
    raceState,
    baseScoreRankMap,
  ]);

  // Get current race data
  const currentRace = parsedData?.races?.[selectedRaceIndex];

  // Get bet recommendations for the current race using the recommendation engine
  // This recalculates when scoredHorses change (including odds/scratch updates)
  const betRecommendations = useRaceBets(
    currentRaceScoredHorses,
    currentRace?.header,
    selectedRaceIndex + 1
  );

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

  // Get raceDate from the first race (all races in a file are same track/date)
  const raceDate = parsedData?.races?.[0]?.header?.raceDateRaw;
  const trackCode = parsedData?.races?.[0]?.header?.trackCode;

  // Format race date for display
  // Uses manual string formatting to avoid JavaScript Date timezone issues
  const formatRaceDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'Unknown Date';
    try {
      // DRF dates are YYYYMMDD format
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const monthNum = parseInt(dateStr.substring(4, 6), 10);
        const dayNum = parseInt(dateStr.substring(6, 8), 10);

        // Manual month lookup to avoid Date object timezone shifts
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const monthName = months[monthNum - 1];

        if (!monthName || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
          return dateStr;
        }

        return `${monthName} ${dayNum}, ${year}`;
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
            /* LOADED STATE - DRF file loaded - Single line layout */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
              </div>

              {/* Separator after logo */}
              <div className="app-topbar__separator"></div>

              {/* Track · Date · Race X of X */}
              <div className="app-topbar__identity">
                <span className="app-topbar__track-name">
                  {getTrackDisplayName(trackCode, getTrackSize(trackCode))}
                </span>
                <span className="app-topbar__middot">·</span>
                <span className="app-topbar__date">{formatRaceDate(raceDate)}</span>
                <span className="app-topbar__middot">·</span>
                <span className="app-topbar__race-label">
                  Race {selectedRaceIndex + 1} of {parsedData.races?.length || 0}
                </span>
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Race info - FULL details, no abbreviations */}
              <div className="app-topbar__race-info">
                <span className="app-topbar__race-info-text">{buildFullRaceInfo(currentRace)}</span>
              </div>

              {/* Full conditions text - if available */}
              {getFullConditions(currentRace) && (
                <>
                  <div className="app-topbar__separator"></div>
                  <div className="app-topbar__race-info app-topbar__race-info--conditions">
                    <span className="app-topbar__race-info-text app-topbar__race-info-text--conditions">
                      {getFullConditions(currentRace)}
                    </span>
                  </div>
                </>
              )}

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Post time - single value with ET */}
              <div className="app-topbar__post-time">
                <span className="app-topbar__post-time-value">
                  {(() => {
                    const postTimeValue = getPostTime(currentRace);
                    const formattedTime = formatPostTime(postTimeValue);
                    return formattedTime !== '--:--' ? `${formattedTime} ET` : 'TBD';
                  })()}
                </span>
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

        {/* Race Rail - Hidden in overview mode since RaceOverview serves that purpose */}
        {viewMode !== 'overview' && (
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
        )}

        {/* Main Content */}
        <main className="app-main">
          {viewMode === 'overview' && parsedData ? (
            /* OVERVIEW MODE - All races at a glance */
            <RaceOverview
              parsedData={parsedData}
              raceConfidences={raceOverviewData.raceConfidences}
              topHorsesByRace={raceOverviewData.topHorsesByRace}
              diamondCountByRace={raceOverviewData.diamondCountByRace}
              eliteConnectionsCountByRace={raceOverviewData.eliteConnectionsCountByRace}
              onRaceSelect={handleRaceSelectFromOverview}
            />
          ) : viewMode === 'topBets' ? (
            /* TOP BETS - Top 25 bet recommendations */
            <TopBetsPanel
              race={currentRace}
              raceNumber={selectedRaceIndex + 1}
              trackName={
                trackCode ? getTrackDisplayName(trackCode, getTrackSize(trackCode)) : undefined
              }
              scoredHorses={currentRaceScoredHorses}
              getOdds={(index, defaultOdds) => raceState.getOdds(index, defaultOdds)}
              isScratched={(index) => raceState.isScratched(index)}
              onClose={() => setViewMode('analysis')}
              allRaces={parsedData?.races}
              allScoredHorses={allScoredHorses}
              onNavigateToRace={onRaceSelect}
            />
          ) : viewMode === 'betMode' ? (
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
              allRaces={parsedData?.races}
              allScoredHorses={allScoredHorses}
              onNavigateToRace={onRaceSelect}
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

                  {/* Column Headers - Sortable: POST, RANK, ODDS, FAIR, EDGE | Non-sortable: HORSE, VALUE */}
                  <div className="horse-list-header">
                    {/* Column 0: RACES label - positioned above race rail */}
                    <div className="horse-list-header__cell horse-list-header__cell--races-label">
                      <span className="horse-list-header__races-text">RACES</span>
                    </div>

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

                    {/* Column 2: POST - Sortable */}
                    <div
                      className={`horse-list-header__cell horse-list-header__cell--pp horse-list-header__cell--sortable ${sortColumn === 'POST' ? 'horse-list-header__cell--active' : ''}`}
                      onClick={() => handleColumnSort('POST')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('POST')}
                    >
                      <span className="horse-list-header__label">
                        POST
                        <span
                          className={`horse-list-header__arrow ${sortColumn === 'POST' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                        >
                          {sortColumn === 'POST' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </span>
                    </div>

                    {/* Column 3: Horse Name - NOT sortable */}
                    <div className="horse-list-header__cell horse-list-header__cell--name">
                      <span className="horse-list-header__label">HORSE</span>
                    </div>

                    {/* Column 4: RANK - Sortable */}
                    <div
                      className={`horse-list-header__cell horse-list-header__cell--rank horse-list-header__cell--sortable ${sortColumn === 'RANK' ? 'horse-list-header__cell--active' : ''}`}
                      onClick={() => handleColumnSort('RANK')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('RANK')}
                    >
                      <span className="horse-list-header__label">
                        RANK
                        <span
                          className={`horse-list-header__arrow ${sortColumn === 'RANK' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                        >
                          {sortColumn === 'RANK' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </span>
                    </div>

                    {/* Column 5: ODDS - Sortable */}
                    <div
                      className={`horse-list-header__cell horse-list-header__cell--odds horse-list-header__cell--sortable ${sortColumn === 'ODDS' ? 'horse-list-header__cell--active' : ''}`}
                      onClick={() => handleColumnSort('ODDS')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('ODDS')}
                    >
                      <span className="horse-list-header__label">
                        ODDS
                        <span
                          className={`horse-list-header__arrow ${sortColumn === 'ODDS' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                        >
                          {sortColumn === 'ODDS' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </span>
                    </div>

                    {/* Column 6: FAIR - Sortable */}
                    <div
                      className={`horse-list-header__cell horse-list-header__cell--fair-odds horse-list-header__cell--sortable ${sortColumn === 'FAIR' ? 'horse-list-header__cell--active' : ''}`}
                      onClick={() => handleColumnSort('FAIR')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('FAIR')}
                    >
                      <span className="horse-list-header__label">
                        FAIR
                        <span
                          className={`horse-list-header__arrow ${sortColumn === 'FAIR' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                        >
                          {sortColumn === 'FAIR' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </span>
                    </div>

                    {/* Column 7: EDGE - Sortable */}
                    <div
                      className={`horse-list-header__cell horse-list-header__cell--edge horse-list-header__cell--sortable ${sortColumn === 'EDGE' ? 'horse-list-header__cell--active' : ''}`}
                      onClick={() => handleColumnSort('EDGE')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('EDGE')}
                    >
                      <span className="horse-list-header__label">
                        EDGE
                        <span
                          className={`horse-list-header__arrow ${sortColumn === 'EDGE' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                        >
                          {sortColumn === 'EDGE' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </span>
                    </div>

                    {/* Column 8: VALUE - NOT sortable */}
                    <div className="horse-list-header__cell horse-list-header__cell--value">
                      <span className="horse-list-header__label">VALUE</span>
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
                            // Bet recommendations from useRaceBets hook
                            betRecommendations={
                              betRecommendations.hasRecommendations
                                ? {
                                    conservative: betRecommendations.conservative,
                                    moderate: betRecommendations.moderate,
                                    aggressive: betRecommendations.aggressive,
                                    hasRecommendations: betRecommendations.hasRecommendations,
                                    summary: betRecommendations.summary,
                                  }
                                : undefined
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

          {/* ALL RACES button - Only shown in analysis mode */}
          {viewMode === 'analysis' && parsedData && (
            <>
              <div className="app-bottombar__cluster">
                <button
                  className="app-bottombar__item app-bottombar__item--all-races"
                  onClick={handleBackToOverview}
                  title="Return to Race Overview"
                >
                  <span className="material-icons">grid_view</span>
                  <span>ALL RACES</span>
                </button>
              </div>
              <div className="app-bottombar__separator"></div>
            </>
          )}

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

          {/* TOP BETS button - Shows Top 25 bets by EV */}
          <div className="app-bottombar__cluster">
            <button
              className={`app-bottombar__item app-bottombar__item--top-bets ${viewMode === 'topBets' ? 'app-bottombar__item--top-bets-active' : ''}`}
              onClick={() => setViewMode(viewMode === 'topBets' ? 'analysis' : 'topBets')}
              disabled={!parsedData || isLoading}
              title={
                viewMode === 'topBets'
                  ? 'Return to analysis view'
                  : 'View Top 25 bets ranked by expected value'
              }
            >
              <span className="app-bottombar__top-bets-icon">🏆</span>
              <span>{viewMode === 'topBets' ? 'ANALYSIS' : 'TOP BETS'}</span>
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
