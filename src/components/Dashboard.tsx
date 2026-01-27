import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './Dashboard.css';
import { useValueDetection } from '../hooks/useValueDetection';
import { useRaceBets } from '../hooks/useRaceBets';
import { useAIAnalysis } from '../hooks/useAIAnalysis';
import type { UseSessionPersistenceReturn } from '../hooks/useSessionPersistence';

// ============================================================================
// NAVIGATION INTEGRATION (Phase 0.2)
// ============================================================================
// This component currently manages its own viewMode state ('overview' | 'analysis' | 'topBets').
// A centralized navigation system has been added in:
//   - src/hooks/useAppNavigation.ts (core hook)
//   - src/contexts/NavigationContext.tsx (context provider)
//
// TODO (Phase 1): When rebuilding Dashboard, replace internal viewMode state
// with useNavigation() context:
//   - viewMode === 'overview'  →  navigation.currentView.screen === 'races'
//   - viewMode === 'analysis'  →  navigation.currentView.screen === 'race-detail'
//   - viewMode === 'topBets'   →  navigation.currentView.screen === 'top-bets'
//   - parsedData === null      →  navigation.currentView.screen === 'empty'
//
// The App.tsx already syncs race selection with navigation.goToRace() when
// onRaceSelect is called. Full integration will unify all navigation state.
// ============================================================================

// Note: BetModeContainer import removed - old BET MODE screen disconnected from navigation
// File kept at ./BetMode/BetModeContainer.tsx for potential future use
import { TopBetsView } from './TopBets';
import { FileUpload } from './FileUpload';
import { HorseExpandedView } from './HorseExpandedView';
import { HorseSummaryBar } from './HorseSummaryBar';
import { ScoringHelpModal } from './ScoringHelpModal';
import { BettingStrategyGuide } from './BettingStrategyGuide';
import { RaceVerdictHeader } from './RaceVerdictHeader';
import { RaceOverview } from './RaceOverview';
import { AIAnalysisPanel } from './AIAnalysisPanel';
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
  /** Session persistence for sort preferences */
  sessionPersistence?: UseSessionPersistenceReturn;
  /** Handler to reset current race state */
  onResetRace?: () => void;
  /** Handler to reset all races state */
  onResetAllRaces?: () => void;
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

  // 3. Race type/classification - FULL names only (no abbreviations like "Clm 10000n2l")
  if (header.raceName) {
    // Stakes race with full grade
    let stakesDisplay = header.raceName;
    if (header.grade) {
      stakesDisplay = `Grade ${header.grade} ${stakesDisplay}`;
    } else if (header.isListed) {
      stakesDisplay = `Listed Stakes: ${stakesDisplay}`;
    }
    parts.push(stakesDisplay);
  } else if (header.classification) {
    // Skip header.raceType (abbreviated) - use classification for full names
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
  sessionPersistence,
  onResetRace: _onResetRace,
  onResetAllRaces: _onResetAllRaces,
}) => {
  // View mode state: 'overview' (default after parse), 'analysis', or 'topBets'
  // Note: 'betMode' removed - old BET MODE screen is now disconnected
  const [viewMode, setViewMode] = useState<'overview' | 'analysis' | 'topBets'>('analysis');

  // State for expanded horse in horse list
  const [expandedHorseId, setExpandedHorseId] = useState<string | number | null>(null);

  // State for trend detail modal
  const [trendModalHorse, setTrendModalHorse] = useState<{
    horse: HorseEntry;
    trendScore: TrendScore;
  } | null>(null);

  // State for scoring help modal
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // State for betting strategy guide modal
  const [strategyGuideOpen, setStrategyGuideOpen] = useState(false);

  // State for horse list sort order and direction
  // Sortable columns: POST, RANK, ODDS, FAIR, VALUE, EDGE
  // Non-sortable: HORSE (name)
  type SortColumn = 'POST' | 'RANK' | 'ODDS' | 'FAIR' | 'VALUE' | 'EDGE';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>('POST');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle column header click for sorting
  const handleColumnSort = useCallback(
    (column: SortColumn) => {
      let newDirection: SortDirection = 'asc';
      if (column === sortColumn) {
        // Toggle direction if clicking same column
        newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      }

      setSortColumn(column);
      setSortDirection(newDirection);

      // Save to session persistence
      if (sessionPersistence) {
        sessionPersistence.updateRaceState(selectedRaceIndex, {
          sortColumn: column,
          sortDirection: newDirection,
        });
      }
    },
    [sortColumn, sortDirection, selectedRaceIndex, sessionPersistence]
  );

  // Load sort preferences from session when race changes
  useEffect(() => {
    if (!sessionPersistence?.session) return;

    const savedRaceState = sessionPersistence.getRaceState(selectedRaceIndex);
    if (savedRaceState) {
      // Validate and apply saved sort column
      const validColumns: SortColumn[] = ['POST', 'RANK', 'ODDS', 'FAIR', 'VALUE', 'EDGE'];
      const savedColumn = savedRaceState.sortColumn as SortColumn;
      if (validColumns.includes(savedColumn)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing sort state with persisted session on race change
        setSortColumn(savedColumn);
      } else {
        setSortColumn('POST');
      }

      setSortDirection(savedRaceState.sortDirection || 'asc');
    } else {
      // Reset to defaults for new races

      setSortColumn('POST');

      setSortDirection('asc');
    }
  }, [selectedRaceIndex, sessionPersistence]);

  // Ref for scrolling to value play horse
  const horseListRef = useRef<HTMLDivElement>(null);

  const toggleHorseExpand = useCallback((horseId: string | number, horseIndex?: number) => {
    setExpandedHorseId((prev) => {
      const isExpanding = prev !== horseId;

      // If expanding, smoothly scroll the row to the top after state update
      if (isExpanding && horseIndex !== undefined) {
        // Use setTimeout to ensure React has finished rendering
        setTimeout(() => {
          const horseRow = document.getElementById(`horse-row-${horseIndex}`);
          if (horseRow) {
            // Find the scroll container (.app-main__content)
            const scrollContainer = horseRow.closest('.app-main__content');
            if (scrollContainer) {
              // Calculate the target scroll position
              const containerRect = scrollContainer.getBoundingClientRect();
              const rowRect = horseRow.getBoundingClientRect();
              const currentScroll = scrollContainer.scrollTop;
              const targetScroll = currentScroll + (rowRect.top - containerRect.top);

              // Smooth scroll to bring the row to the top
              scrollContainer.scrollTo({
                top: targetScroll,
                behavior: 'smooth',
              });
            } else {
              // Fallback to scrollIntoView
              horseRow.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
          }
        }, 50); // Small delay to ensure DOM is ready
      }

      return prev === horseId ? null : horseId;
    });
  }, []);

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
    }
  }, [parsedData]);

  // Reset expanded state when race changes
  // Note: Race state (scratches, odds) is now managed by session persistence in App.tsx
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset on race selection change
    setExpandedHorseId(null);
  }, [selectedRaceIndex]);

  // Calculate scored horses for current race (needed for betting recommendations)
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
  }, [
    parsedData,
    selectedRaceIndex,
    raceState.updatedOdds,
    raceState.scratchedHorses,
    raceState.trackCondition,
    raceState.getOdds,
    raceState.isScratched,
    raceState.reactivityVersion, // Guarantees recalculation on any state change
  ]);

  // Calculate scored horses for ALL races (for day planning mode)
  // Now uses persisted per-race state (scratches, odds overrides, track condition)
  // so that Overview reflects current user changes across all races
  const allScoredHorses = useMemo(() => {
    if (!parsedData) return [];

    return parsedData.races.map((race, raceIndex) => {
      // Get persisted state for this race (if available)
      const persistedState = sessionPersistence?.getRaceState(raceIndex);

      // Build scratched set from persisted state
      const scratchedSet = new Set<number>(persistedState?.scratches || []);

      // Build odds override map from persisted state
      const oddsOverrides = persistedState?.oddsOverrides || {};

      // Use persisted track condition or default to 'fast'
      const trackConditionForRace = persistedState?.trackCondition || 'fast';

      return calculateRaceScores(
        race.horses,
        race.header,
        (i, originalOdds) => oddsOverrides[i] ?? originalOdds, // Use persisted odds or original
        (i) => scratchedSet.has(i), // Use persisted scratches
        trackConditionForRace
      );
    });
    // sessionPersistence contains all state including getRaceState and session.raceStates
  }, [parsedData, sessionPersistence]);

  // Calculate RaceOverview data: confidences, top horses, diamonds, elite connections, scratched counts
  const raceOverviewData = useMemo(() => {
    if (!parsedData || allScoredHorses.length === 0) {
      return {
        raceConfidences: new Map<number, number>(),
        topHorsesByRace: new Map<number, (typeof allScoredHorses)[0]>(),
        diamondCountByRace: new Map<number, number>(),
        eliteConnectionsCountByRace: new Map<number, number>(),
        scratchedCountByRace: new Map<number, number>(),
      };
    }

    const raceConfidences = new Map<number, number>();
    const topHorsesByRace = new Map<number, (typeof allScoredHorses)[0]>();
    const diamondCountByRace = new Map<number, number>();
    const eliteConnectionsCountByRace = new Map<number, number>();
    const scratchedCountByRace = new Map<number, number>();

    parsedData.races.forEach((race, raceIndex) => {
      const scoredHorses = allScoredHorses[raceIndex] || [];

      // Get persisted state for this race to get odds overrides
      const persistedState = sessionPersistence?.getRaceState(raceIndex);
      const oddsOverrides = persistedState?.oddsOverrides || {};

      // Count scratched horses (those with isScratched flag in scored data)
      let scratchedCount = 0;
      for (const sh of scoredHorses) {
        if (sh.score.isScratched) {
          scratchedCount++;
        }
      }
      scratchedCountByRace.set(raceIndex, scratchedCount);

      // Calculate race confidence
      const confidence = calculateRaceConfidence(scoredHorses);
      raceConfidences.set(raceIndex, confidence);

      // Get top 3 horses for preview (getTopHorses already filters scratched)
      const topHorses = getTopHorses(scoredHorses, 3);
      topHorsesByRace.set(raceIndex, topHorses);

      // Count diamonds in this race - use persisted odds
      const scoreMap = new Map<number, (typeof scoredHorses)[0]['score']>();
      scoredHorses.forEach((sh) => {
        scoreMap.set(sh.index, sh.score);
      });

      const diamondSummary = analyzeRaceDiamonds(
        race.horses,
        scoreMap,
        race.header,
        (index, defaultOdds) => oddsOverrides[index] ?? defaultOdds // Use persisted odds
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
      scratchedCountByRace,
    };
  }, [parsedData, allScoredHorses, sessionPersistence]);

  // Calculate ranks based on BASE SCORE (not total score with overlay)
  const baseScoreRankMap = useMemo(() => {
    return calculateBaseScoreRanks(currentRaceScoredHorses);
  }, [currentRaceScoredHorses]);

  // Value detection analysis for the current race
  // Pass stable callbacks directly to avoid unnecessary recalculations
  const valueAnalysis = useValueDetection(
    currentRaceScoredHorses,
    raceState.getOdds,
    raceState.isScratched
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
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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

      case 'VALUE':
        // Sort by edge percentage (same as EDGE - value labels are derived from edge %)
        // Ascending = lowest edge first, Descending = highest edge first
        return horses.sort((a, b) => {
          const playA = valueAnalysis.valuePlays.find((p) => p.horseIndex === a.index);
          const playB = valueAnalysis.valuePlays.find((p) => p.horseIndex === b.index);
          const edgeA = playA?.valueEdge ?? -999;
          const edgeB = playB?.valueEdge ?? -999;
          // For value, descending shows best value first
          return (edgeB - edgeA) * direction;
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
    raceState.getOdds,
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

  // AI Analysis - triggers automatically when race and scores are ready
  // Non-blocking: scoring results display immediately, AI loads in background
  const { aiAnalysis, aiLoading, aiError, retryAnalysis } = useAIAnalysis(
    currentRace,
    currentRaceScoredHorses
  );

  // Helper to get horse name by program number for AI panel display
  const getHorseNameByProgram = useCallback(
    (programNumber: number) => {
      const horse = currentRace?.horses?.find((h) => h.programNumber === programNumber);
      return horse?.horseName || `#${programNumber}`;
    },
    [currentRace?.horses]
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
          ) : viewMode === 'overview' ? (
            /* OVERVIEW MODE - Track-level info only */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
              </div>

              {/* Separator after logo */}
              <div className="app-topbar__separator"></div>

              {/* Track · Date · Total Races */}
              <div className="app-topbar__identity">
                <span className="app-topbar__track-name">
                  {getTrackDisplayName(trackCode, getTrackSize(trackCode))}
                </span>
                <span className="app-topbar__middot">·</span>
                <span className="app-topbar__date">{formatRaceDate(raceDate)}</span>
                <span className="app-topbar__middot">·</span>
                <span className="app-topbar__race-label">
                  {parsedData.races?.length || 0} Races
                </span>
              </div>
            </>
          ) : (
            /* LOADED STATE - DRF file loaded - Clean top bar with race details only */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
              </div>

              {/* Separator after logo */}
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

        {/* Race Verdict Header - Direct child of grid, spans full width */}
        {/* Only shown in analysis mode with scored horses */}
        {viewMode === 'analysis' && parsedData && currentRaceScoredHorses?.length > 0 && (
          <RaceVerdictHeader
            valueAnalysis={valueAnalysis}
            raceNumber={selectedRaceIndex + 1}
            onValuePlayClick={scrollToHorse}
          />
        )}

        {/* Column Headers - Direct child of grid, spans full width */}
        {/* Only shown in analysis mode with scored horses */}
        {viewMode === 'analysis' && parsedData && currentRaceScoredHorses?.length > 0 && (
          <div className="horse-list-header">
            {/* Column 0: RACES label - positioned above race rail */}
            <div className="horse-list-header__cell horse-list-header__cell--races-label">
              <span className="horse-list-header__races-text">RACES</span>
            </div>

            {/* Column 1: Empty placeholder - aligns with scratch button column on cards */}
            <div className="horse-list-header__cell horse-list-header__cell--icons"></div>

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

            {/* Column 4: ODDS - Sortable (left side - price data) */}
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

            {/* Column 5: FAIR - Sortable (left side - price data) */}
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

            {/* Column 6: PROJECTED FINISH - Sortable (right side - value analysis) */}
            <div
              className={`horse-list-header__cell horse-list-header__cell--rank horse-list-header__cell--sortable ${sortColumn === 'RANK' ? 'horse-list-header__cell--active' : ''}`}
              onClick={() => handleColumnSort('RANK')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('RANK')}
            >
              <span className="horse-list-header__label">
                PROJECTED FINISH
                <span
                  className={`horse-list-header__arrow ${sortColumn === 'RANK' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                >
                  {sortColumn === 'RANK' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                </span>
              </span>
            </div>

            {/* Column 7: VALUE - Plain-English value labels - Sortable (right side - value analysis) */}
            <div
              className={`horse-list-header__cell horse-list-header__cell--value-label horse-list-header__cell--sortable ${sortColumn === 'VALUE' ? 'horse-list-header__cell--active' : ''}`}
              onClick={() => handleColumnSort('VALUE')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleColumnSort('VALUE')}
            >
              <span className="horse-list-header__label">
                VALUE
                <span
                  className={`horse-list-header__arrow ${sortColumn === 'VALUE' ? 'horse-list-header__arrow--active' : 'horse-list-header__arrow--inactive'}`}
                >
                  {sortColumn === 'VALUE' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                </span>
              </span>
            </div>

            {/* Column 8: EDGE - Sortable (right side - value analysis, far right) */}
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
          </div>
        )}

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
              scratchedCountByRace={raceOverviewData.scratchedCountByRace}
              allScoredHorses={allScoredHorses}
              onRaceSelect={handleRaceSelectFromOverview}
            />
          ) : viewMode === 'topBets' && currentRace?.header ? (
            /* TOP BETS - Simple view of top 20 bet recommendations */
            <TopBetsView
              raceNumber={selectedRaceIndex + 1}
              trackName={
                trackCode ? getTrackDisplayName(trackCode, getTrackSize(trackCode)) : undefined
              }
              raceHeader={currentRace.header}
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
                <>
                  {/* AI Analysis Panel - displays above horse list */}
                  {/* Non-blocking: shows loading state while scoring results are already visible */}
                  <AIAnalysisPanel
                    aiAnalysis={aiAnalysis}
                    loading={aiLoading}
                    error={aiError}
                    onRetry={retryAnalysis}
                    getHorseName={getHorseNameByProgram}
                  />

                  <div className="horse-list" ref={horseListRef}>
                    {/* Horse rows only - verdict header and column header are now grid-level elements */}
                    {/* Collect all field base scores for proper overlay calculation */}
                    {(() => {
                      const allFieldBaseScores = sortedScoredHorses
                        .filter((h) => !h.score.isScratched)
                        .map((h) => h.score.baseScore);

                      // Find the favorite (horse with lowest odds in the field)
                      // Only consider non-scratched horses
                      const parseOddsToDecimal = (oddsStr: string): number => {
                        const parts = oddsStr.split('-');
                        const num = parseFloat(parts[0] || '10');
                        const den = parseFloat(parts[1] || '1');
                        return num / den;
                      };

                      let favoriteIndex = -1;
                      let lowestOdds = Infinity;
                      for (const sh of sortedScoredHorses) {
                        if (!raceState.isScratched(sh.index)) {
                          const oddsStr = raceState.getOdds(sh.index, sh.horse.morningLineOdds);
                          const oddsDecimal = parseOddsToDecimal(oddsStr);
                          if (oddsDecimal < lowestOdds) {
                            lowestOdds = oddsDecimal;
                            favoriteIndex = sh.index;
                          }
                        }
                      }

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

                        // Handle odds change - convert back to string format for raceState
                        const handleOddsChange = (odds: {
                          numerator: number;
                          denominator: number;
                        }) => {
                          raceState.updateOdds(horseIndex, `${odds.numerator}-${odds.denominator}`);
                        };

                        // Handle scratch toggle - triggers field recalculation
                        const handleScratchToggle = (scratched: boolean) => {
                          raceState.setScratch(horseIndex, scratched);
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
                              onToggleExpand={() => toggleHorseExpand(horseId, horseIndex)}
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
                              // Base score rank info (projected finish order)
                              baseScoreRank={rankInfo?.rank}
                              baseScoreRankOrdinal={rankInfo?.ordinal}
                              baseScoreRankColor={rankInfo?.color}
                              // Field size for value matrix calculations
                              fieldSize={activeFieldSize}
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
                              // Favorite detection for FALSE FAVORITE label
                              isFavorite={horseIndex === favoriteIndex}
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
                </>
              )}
            </div>
          )}
        </main>

        {/* Bottom Bar */}
        <footer className="app-bottombar">
          {/* Track Name · Date - Left side info */}
          {parsedData && (
            <>
              <div className="app-bottombar__track-info">
                <span className="app-bottombar__track-name">
                  {(() => {
                    const trackData = getTrackData(trackCode || '');
                    return trackData?.name || trackCode || 'Unknown Track';
                  })()}
                </span>
                <span className="app-bottombar__middot">·</span>
                <span className="app-bottombar__date">{formatRaceDate(raceDate)}</span>
              </div>
              <div className="app-bottombar__separator"></div>
            </>
          )}

          {/* ALL RACES button - Always visible, disabled on Overview */}
          <div className="app-bottombar__cluster">
            <button
              className={`app-bottombar__item app-bottombar__item--all-races ${viewMode === 'overview' ? 'app-bottombar__item--disabled' : ''}`}
              onClick={viewMode !== 'overview' ? handleBackToOverview : undefined}
              disabled={viewMode === 'overview'}
              title={
                viewMode === 'overview' ? 'Currently viewing all races' : 'Return to Race Overview'
              }
            >
              <span className="material-icons">grid_view</span>
              <span>ALL RACES</span>
            </button>
          </div>

          {/* Separator after ALL RACES */}
          <div className="app-bottombar__separator"></div>

          {/* ANALYZE RACE button - Goes to single race analysis view */}
          <div className="app-bottombar__cluster">
            <button
              className={`app-bottombar__item app-bottombar__item--analyze-race ${viewMode === 'analysis' ? 'app-bottombar__item--analyze-race-active' : ''}`}
              onClick={() => setViewMode('analysis')}
              disabled={!parsedData || isLoading || viewMode === 'overview'}
              title={
                viewMode === 'overview'
                  ? 'Select a race first'
                  : 'View race analysis with horse scores and odds'
              }
            >
              <span>ANALYZE RACE</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* TOP BETS button - Shows 6-column bet grid */}
          <div className="app-bottombar__cluster">
            <button
              className={`app-bottombar__item app-bottombar__item--top-bets ${viewMode === 'topBets' ? 'app-bottombar__item--top-bets-active' : ''}`}
              onClick={() => setViewMode('topBets')}
              disabled={!parsedData || isLoading || viewMode === 'overview'}
              title={
                viewMode === 'overview' ? 'Select a race first' : 'View top bets in 6-column grid'
              }
            >
              <span>TOP BETS</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* STRATEGY GUIDE button - Opens betting strategy guide modal */}
          <div className="app-bottombar__cluster">
            <button
              className="app-bottombar__item app-bottombar__item--strategy-guide"
              onClick={() => setStrategyGuideOpen(true)}
              title="Open betting strategy guide"
            >
              <span>STRATEGY GUIDE</span>
            </button>
          </div>

          {/* Separator */}
          <div className="app-bottombar__separator"></div>

          {/* FORM GUIDE button - Opens how to read the form modal */}
          <div className="app-bottombar__cluster">
            <button
              className="app-bottombar__item app-bottombar__item--form-guide"
              onClick={() => setHelpModalOpen(true)}
              title="How to Read the Form"
            >
              <span>FORM GUIDE</span>
            </button>
          </div>

          {/* Center spacer - pushes Upload to far right */}
          <div className="app-bottombar__spacer"></div>

          {/* Separator before Upload */}
          <div className="app-bottombar__separator"></div>

          {/* Upload button - Far right */}
          <div className="app-bottombar__cluster">
            <button
              className="app-bottombar__item app-bottombar__item--upload"
              onClick={handleFileUpload}
              disabled={isLoading}
            >
              <span className="material-icons">
                {isLoading ? 'hourglass_empty' : 'upload_file'}
              </span>
              <span>{isLoading ? 'Parsing...' : 'UPLOAD'}</span>
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

      {/* Betting Strategy Guide Modal */}
      <BettingStrategyGuide
        isOpen={strategyGuideOpen}
        onClose={() => setStrategyGuideOpen(false)}
      />

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
