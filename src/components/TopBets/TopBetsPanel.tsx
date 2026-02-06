/**
 * TopBetsPanel Component
 *
 * Main panel displaying the Top 25 bet recommendations.
 * Shows ranked bets with filtering, sorting, and copy functionality.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { logger } from '../../services/logging';
import { TopBetCard } from './TopBetCard';
import { useTopBets, type RiskTier } from '../../hooks/useTopBets';
import type { ScoredHorse } from '../../lib/scoring';
import type { ParsedRace } from '../../types/drf';
import './TopBets.css';

// ============================================================================
// TYPES
// ============================================================================

interface TopBetsPanelProps {
  /** Current race data */
  race: ParsedRace | undefined;
  /** Race number (1-indexed) */
  raceNumber: number;
  /** Track name for display */
  trackName?: string;
  /** Scored horses with rankings */
  scoredHorses: ScoredHorse[];
  /** Function to get current odds for a horse */
  getOdds: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched: (index: number) => boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** All races for navigation */
  allRaces?: ParsedRace[];
  /** All scored horses for each race */
  allScoredHorses?: ScoredHorse[][];
  /** Callback to navigate to a specific race */
  onNavigateToRace?: (raceIndex: number) => void;
}

type FilterType = 'all' | RiskTier;
type SortType = 'rank' | 'cost' | 'probability';

// ============================================================================
// COMPONENT
// ============================================================================

export const TopBetsPanel: React.FC<TopBetsPanelProps> = ({
  race,
  raceNumber,
  trackName = 'Track',
  scoredHorses,
  getOdds,
  isScratched,
  onClose,
  allRaces = [],
  allScoredHorses = [],
  onNavigateToRace,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('rank');
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [copyAllSuccess, setCopyAllSuccess] = useState(false);
  const [viewedRaceNumber, setViewedRaceNumber] = useState(raceNumber);

  // Get data for viewed race
  const viewedRaceIndex = viewedRaceNumber - 1;
  const viewedRace = allRaces[viewedRaceIndex] || race;
  const viewedScoredHorses = allScoredHorses[viewedRaceIndex] || scoredHorses;

  // ============================================================================
  // HOOK - Generate Top Bets
  // ============================================================================

  const {
    topBets,
    hasBets,
    totalCombinationsAnalyzed,
    raceContext,
    performance,
    summary,
    error,
    byRiskTier,
  } = useTopBets({
    scoredHorses: viewedScoredHorses,
    raceHeader: viewedRace?.header,
    raceNumber: viewedRaceNumber,
    getOdds,
    isScratched,
  });

  // ============================================================================
  // FILTERED AND SORTED BETS
  // ============================================================================

  const filteredBets = useMemo(() => {
    let bets = [...topBets];

    // Apply filter
    if (filter !== 'all') {
      bets = bets.filter((b) => b.riskTier === filter);
    }

    // Apply sort
    switch (sortBy) {
      case 'cost':
        bets.sort((a, b) => a.cost - b.cost);
        break;
      case 'probability':
        bets.sort((a, b) => b.probability - a.probability);
        break;
      case 'rank':
      default:
        // Already sorted by rank (EV)
        break;
    }

    return bets;
  }, [topBets, filter, sortBy]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleToggleExpand = useCallback((rank: number) => {
    setExpandedCardId((prev) => (prev === rank ? null : rank));
  }, []);

  const handleCopyAll = useCallback(async () => {
    try {
      const allBets = filteredBets.map((bet) => bet.whatToSay).join('\n');
      await navigator.clipboard.writeText(allBets);
      setCopyAllSuccess(true);
      setTimeout(() => setCopyAllSuccess(false), 2000);
    } catch (_error) {
      logger.logWarning('Failed to copy to clipboard', { component: 'TopBetsPanel' });
    }
  }, [filteredBets]);

  const handleRaceSelect = useCallback(
    (raceNum: number) => {
      setViewedRaceNumber(raceNum);
      setExpandedCardId(null);
      if (onNavigateToRace) {
        onNavigateToRace(raceNum - 1);
      }
    },
    [onNavigateToRace]
  );

  const handlePrevRace = useCallback(() => {
    if (viewedRaceNumber > 1) {
      handleRaceSelect(viewedRaceNumber - 1);
    }
  }, [viewedRaceNumber, handleRaceSelect]);

  const handleNextRace = useCallback(() => {
    if (viewedRaceNumber < allRaces.length) {
      handleRaceSelect(viewedRaceNumber + 1);
    }
  }, [viewedRaceNumber, allRaces.length, handleRaceSelect]);

  // ============================================================================
  // CALCULATE SUMMARY COSTS
  // ============================================================================

  const totalCostAllFiltered = filteredBets.reduce((sum, b) => sum + b.cost, 0);
  const conservativeCost = byRiskTier.conservative.reduce((sum, b) => sum + b.cost, 0);
  const moderateCost = byRiskTier.moderate.reduce((sum, b) => sum + b.cost, 0);
  const aggressiveCost = byRiskTier.aggressive.reduce((sum, b) => sum + b.cost, 0);

  // ============================================================================
  // FORMAT HELPERS
  // ============================================================================

  const formatDate = (race: ParsedRace | undefined) => {
    if (!race?.header?.raceDateRaw) return '';
    const dateStr = race.header.raceDateRaw;
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${month}/${day}/${year}`;
    }
    return dateStr;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="top-bets-panel">
      {/* Header */}
      <div className="top-bets-panel__header">
        <div className="top-bets-panel__header-main">
          <div className="top-bets-panel__title">
            <span className="top-bets-panel__title-icon">&#127942;</span>
            <span className="top-bets-panel__title-text">TOP BETS</span>
            <span className="top-bets-panel__title-race">— RACE {viewedRaceNumber}</span>
          </div>
          <button className="top-bets-panel__close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="top-bets-panel__header-info">
          <span>{trackName}</span>
          <span className="top-bets-panel__header-sep">|</span>
          <span>{formatDate(viewedRace)}</span>
          <span className="top-bets-panel__header-sep">|</span>
          <span>{raceContext.surface}</span>
        </div>
        <div className="top-bets-panel__header-stats">
          <span className="top-bets-panel__stat">
            <span className="top-bets-panel__stat-icon">&#128202;</span>
            {totalCombinationsAnalyzed.toLocaleString()} combinations analyzed
          </span>
          <span className="top-bets-panel__stat">
            <span className="top-bets-panel__stat-icon">&#127919;</span>
            Top 25 bets ranked by expected value
          </span>
          <span className="top-bets-panel__stat top-bets-panel__stat--time">
            Generated in {performance.generationTimeMs.toFixed(0)}ms
          </span>
        </div>
      </div>

      {/* Race Summary */}
      {hasBets && (
        <div className="top-bets-panel__summary">
          <div className="top-bets-panel__summary-title">RACE ANALYSIS COMPLETE</div>
          <div className="top-bets-panel__summary-grid">
            <div className="top-bets-panel__summary-item">
              <span className="top-bets-panel__summary-label">Horses:</span>
              <span className="top-bets-panel__summary-value">{raceContext.fieldSize}</span>
            </div>
            <div className="top-bets-panel__summary-item">
              <span className="top-bets-panel__summary-label">Combinations:</span>
              <span className="top-bets-panel__summary-value">
                {totalCombinationsAnalyzed.toLocaleString()}
              </span>
            </div>
            <div className="top-bets-panel__summary-item">
              <span className="top-bets-panel__summary-label">Best EV:</span>
              <span className="top-bets-panel__summary-value top-bets-panel__summary-value--positive">
                +${summary.bestBetEV.toFixed(2)}
              </span>
            </div>
            <div className="top-bets-panel__summary-item">
              <span className="top-bets-panel__summary-label">Avg EV:</span>
              <span
                className={`top-bets-panel__summary-value ${summary.avgExpectedValue >= 0 ? 'top-bets-panel__summary-value--positive' : ''}`}
              >
                {summary.avgExpectedValue >= 0 ? '+' : ''}${summary.avgExpectedValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Race Navigation */}
      {allRaces.length > 1 && (
        <div className="top-bets-panel__nav">
          <button
            className="top-bets-panel__nav-btn"
            onClick={handlePrevRace}
            disabled={viewedRaceNumber <= 1}
          >
            <span className="material-icons">chevron_left</span>
            Prev Race
          </button>
          <div className="top-bets-panel__nav-pills">
            {allRaces.map((_, index) => (
              <button
                key={index}
                className={`top-bets-panel__nav-pill ${index + 1 === viewedRaceNumber ? 'top-bets-panel__nav-pill--active' : ''}`}
                onClick={() => handleRaceSelect(index + 1)}
              >
                R{index + 1}
              </button>
            ))}
          </div>
          <button
            className="top-bets-panel__nav-btn"
            onClick={handleNextRace}
            disabled={viewedRaceNumber >= allRaces.length}
          >
            Next Race
            <span className="material-icons">chevron_right</span>
          </button>
        </div>
      )}

      {/* Filters and Sort */}
      <div className="top-bets-panel__controls">
        <div className="top-bets-panel__filters">
          <button
            className={`top-bets-panel__filter ${filter === 'all' ? 'top-bets-panel__filter--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({topBets.length})
          </button>
          <button
            className={`top-bets-panel__filter top-bets-panel__filter--conservative ${filter === 'Conservative' ? 'top-bets-panel__filter--active' : ''}`}
            onClick={() => setFilter('Conservative')}
          >
            Conservative ({summary.conservativeCount})
          </button>
          <button
            className={`top-bets-panel__filter top-bets-panel__filter--moderate ${filter === 'Moderate' ? 'top-bets-panel__filter--active' : ''}`}
            onClick={() => setFilter('Moderate')}
          >
            Moderate ({summary.moderateCount})
          </button>
          <button
            className={`top-bets-panel__filter top-bets-panel__filter--aggressive ${filter === 'Aggressive' ? 'top-bets-panel__filter--active' : ''}`}
            onClick={() => setFilter('Aggressive')}
          >
            Aggressive ({summary.aggressiveCount})
          </button>
        </div>
        <div className="top-bets-panel__sort">
          <label className="top-bets-panel__sort-label">Sort by:</label>
          <select
            className="top-bets-panel__sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
          >
            <option value="rank">Rank (EV)</option>
            <option value="cost">Cost (Low to High)</option>
            <option value="probability">Probability (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Bet Cards List */}
      <div className="top-bets-panel__list">
        {error ? (
          <div className="top-bets-panel__error">
            <span className="material-icons">error_outline</span>
            <p>{error}</p>
          </div>
        ) : !hasBets ? (
          <div className="top-bets-panel__empty">
            <span className="top-bets-panel__empty-icon">&#128269;</span>
            <p className="top-bets-panel__empty-title">No bets available</p>
            <p className="top-bets-panel__empty-text">
              Not enough data to generate bet recommendations for this race.
            </p>
          </div>
        ) : filteredBets.length === 0 ? (
          <div className="top-bets-panel__empty">
            <span className="top-bets-panel__empty-icon">&#128270;</span>
            <p className="top-bets-panel__empty-title">No {filter} bets</p>
            <p className="top-bets-panel__empty-text">
              Try selecting a different filter to see available bets.
            </p>
          </div>
        ) : (
          filteredBets.map((bet) => (
            <TopBetCard
              key={bet.rank}
              bet={bet}
              isExpanded={expandedCardId === bet.rank}
              onToggleExpand={() => handleToggleExpand(bet.rank)}
            />
          ))
        )}
      </div>

      {/* Footer Summary */}
      {hasBets && (
        <div className="top-bets-panel__footer">
          <div className="top-bets-panel__footer-title">BETTING SUMMARY</div>
          <div className="top-bets-panel__footer-grid">
            <div className="top-bets-panel__footer-item">
              <span className="top-bets-panel__footer-label">
                If betting all {filteredBets.length}:
              </span>
              <span className="top-bets-panel__footer-value">${totalCostAllFiltered}</span>
            </div>
            <div className="top-bets-panel__footer-item top-bets-panel__footer-item--conservative">
              <span className="top-bets-panel__footer-label">
                Conservative ({byRiskTier.conservative.length}):
              </span>
              <span className="top-bets-panel__footer-value">${conservativeCost}</span>
            </div>
            <div className="top-bets-panel__footer-item top-bets-panel__footer-item--moderate">
              <span className="top-bets-panel__footer-label">
                Moderate ({byRiskTier.moderate.length}):
              </span>
              <span className="top-bets-panel__footer-value">${moderateCost}</span>
            </div>
            <div className="top-bets-panel__footer-item top-bets-panel__footer-item--aggressive">
              <span className="top-bets-panel__footer-label">
                Aggressive ({byRiskTier.aggressive.length}):
              </span>
              <span className="top-bets-panel__footer-value">${aggressiveCost}</span>
            </div>
          </div>
          <button
            className={`top-bets-panel__copy-all ${copyAllSuccess ? 'top-bets-panel__copy-all--success' : ''}`}
            onClick={handleCopyAll}
          >
            {copyAllSuccess ? (
              <>
                <span className="material-icons">check</span>
                Copied to Clipboard!
              </>
            ) : (
              <>
                <span className="material-icons">content_copy</span>
                COPY ALL TO NOTES
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default TopBetsPanel;
