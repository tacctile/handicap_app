/**
 * Multi-Race Exotics Panel
 *
 * Expandable panel showing multi-race betting opportunities:
 * - Available bet types based on race count
 * - Quick optimization previews
 * - Carryover alerts
 * - Builder modal launch
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HorseEntry } from '../types/drf';
import type { HorseScore } from '../lib/scoring';
import {
  type MultiRaceBetType,
  type MultiRaceRaceData,
  type MultiRaceHorse,
  type OptimizedTicket,
  type CarryoverInfo,
  getBetConfig,
  getAvailableBetTypes,
  analyzeRaceCard,
  optimizeMultiRaceBet,
  classifyRaceStrength,
  findStandoutHorse,
  getCarryover,
  shouldAlertCarryover,
  formatCarryoverAmount,
  getCarryoverBadgeColor,
} from '../lib/multirace';
import { formatCurrency } from '../lib/recommendations';
import { MultiRaceBuilderModal, type MultiRaceTicketResult } from './MultiRaceBuilderModal';

// ============================================================================
// TYPES
// ============================================================================

interface RaceData {
  raceNumber: number;
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>;
  postTime?: string;
}

interface MultiRaceExoticsPanelProps {
  races: RaceData[];
  currentRaceNumber: number;
  trackCode?: string;
  budget: number;
  onAddToBetSlip: (ticket: MultiRaceTicketResult) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToMultiRaceData(raceData: RaceData): MultiRaceRaceData {
  const horses: MultiRaceHorse[] = raceData.horses
    .map((h, idx) => {
      let tier: 1 | 2 | 3 = 3;
      if (h.score.total >= 180) tier = 1;
      else if (h.score.total >= 160) tier = 2;

      const oddsMatch = h.horse.morningLineOdds.match(/(\d+(?:\.\d+)?)[/-](\d+(?:\.\d+)?)?/);
      const decimalOdds =
        oddsMatch && oddsMatch[1]
          ? parseFloat(oddsMatch[1]) / (oddsMatch[2] ? parseFloat(oddsMatch[2]) : 1)
          : 5;
      const winProbability = 1 / (decimalOdds + 1);

      const sorted = [...raceData.horses].sort((a, b) => b.score.total - a.score.total);
      const nextHorse = sorted[idx + 1];
      const scoreGapToNext = nextHorse !== undefined ? h.score.total - nextHorse.score.total : 0;

      return {
        programNumber: h.horse.programNumber,
        horseName: h.horse.horseName,
        score: h.score.total,
        morningLineOdds: h.horse.morningLineOdds,
        decimalOdds,
        winProbability,
        tier,
        isSingleCandidate: h.score.total >= 180 && scoreGapToNext >= 15,
        scoreGapToNext,
      };
    })
    .sort((a, b) => b.score - a.score);

  const strength = classifyRaceStrength(horses);
  const standout = findStandoutHorse(horses);

  return {
    raceNumber: raceData.raceNumber,
    postTime: raceData.postTime || '',
    fieldSize: horses.length,
    horses,
    strength,
    hasStandout: !!standout,
    standoutHorse: standout,
    isCancelled: false,
  };
}

// ============================================================================
// BET TYPE CARD
// ============================================================================

interface BetTypeCardProps {
  betType: MultiRaceBetType;
  startRace: number;
  endRace: number;
  isAvailable: boolean;
  optimization: {
    recommended: OptimizedTicket | null;
    isValid: boolean;
  } | null;
  carryover?: CarryoverInfo | null;
  onBuild: () => void;
}

function BetTypeCard({
  betType,
  startRace,
  endRace,
  isAvailable,
  optimization,
  carryover,
  onBuild,
}: BetTypeCardProps) {
  const config = getBetConfig(betType);

  return (
    <div className={`multirace-bet-card ${!isAvailable ? 'unavailable' : ''}`}>
      <div className="multirace-bet-card-header">
        <div className="multirace-bet-card-title">
          <span className="material-icons multirace-bet-card-icon">{config.icon}</span>
          <div>
            <span className="multirace-bet-card-name">{config.displayName}</span>
            <span className="multirace-bet-card-races">
              {isAvailable ? `Races ${startRace}-${endRace}` : 'Not enough races'}
            </span>
          </div>
        </div>
        {carryover && shouldAlertCarryover(carryover) && (
          <span
            className="multirace-carryover-badge"
            style={{
              backgroundColor: getCarryoverBadgeColor(carryover.valueClass).bg,
              color: getCarryoverBadgeColor(carryover.valueClass).text,
            }}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              {carryover.isMandatory ? 'priority_high' : 'trending_up'}
            </span>
            ${formatCarryoverAmount(carryover.carryoverAmount)}
          </span>
        )}
      </div>

      {isAvailable && optimization?.recommended && (
        <div className="multirace-bet-card-preview">
          <div className="multirace-bet-card-stat">
            <span className="multirace-bet-card-stat-label">Best Ticket</span>
            <span className="multirace-bet-card-stat-value">
              {optimization.recommended.cost.spreadNotation}
            </span>
          </div>
          <div className="multirace-bet-card-stat">
            <span className="multirace-bet-card-stat-label">Cost</span>
            <span className="multirace-bet-card-stat-value">
              {formatCurrency(optimization.recommended.cost.total)}
            </span>
          </div>
          <div className="multirace-bet-card-stat">
            <span className="multirace-bet-card-stat-label">Hit %</span>
            <span className="multirace-bet-card-stat-value">
              {(optimization.recommended.probability * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="multirace-bet-card-footer">
        <button className="multirace-bet-card-btn" onClick={onBuild} disabled={!isAvailable}>
          <span className="material-icons">build</span>
          Build Ticket
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MultiRaceExoticsPanel({
  races,
  currentRaceNumber,
  trackCode,
  budget,
  onAddToBetSlip,
}: MultiRaceExoticsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedBetType, setSelectedBetType] = useState<MultiRaceBetType>('daily_double');

  // Convert races to MultiRaceRaceData
  const multiRaceData = useMemo(() => races.map(convertToMultiRaceData), [races]);

  // Get available bet types
  const availableBetTypes = useMemo(() => {
    const remaining = races.length - currentRaceNumber + 1;
    return getAvailableBetTypes(remaining);
  }, [races.length, currentRaceNumber]);

  // Analyze race card
  const analysis = useMemo(
    () => analyzeRaceCard(multiRaceData.slice(currentRaceNumber - 1)),
    [multiRaceData, currentRaceNumber]
  );

  // Get carryovers
  const carryovers = useMemo(() => {
    const result: Record<string, CarryoverInfo | null> = {};
    if (trackCode) {
      result.pick_5 = getCarryover(trackCode, 'pick_5');
      result.pick_6 = getCarryover(trackCode, 'pick_6');
    }
    return result;
  }, [trackCode]);

  // Get optimizations for each bet type
  const optimizations = useMemo(() => {
    const result: Record<
      MultiRaceBetType,
      { recommended: OptimizedTicket | null; isValid: boolean } | null
    > = {
      daily_double: null,
      pick_3: null,
      pick_4: null,
      pick_5: null,
      pick_6: null,
    };

    const racesFromCurrent = multiRaceData.slice(currentRaceNumber - 1);

    for (const betType of availableBetTypes) {
      const config = getBetConfig(betType);
      if (racesFromCurrent.length >= config.racesRequired) {
        const optResult = optimizeMultiRaceBet({
          betType,
          races: racesFromCurrent.slice(0, config.racesRequired),
          budget,
          strategy: 'balanced',
        });
        result[betType] = {
          recommended: optResult.recommended,
          isValid: optResult.isValid,
        };
      }
    }

    return result;
  }, [multiRaceData, currentRaceNumber, availableBetTypes, budget]);

  // Handlers
  const handleOpenBuilder = useCallback((betType: MultiRaceBetType) => {
    setSelectedBetType(betType);
    setBuilderOpen(true);
  }, []);

  // Check if we have enough races for any multi-race bet
  if (races.length < 2 || availableBetTypes.length === 0) {
    return null;
  }

  // Check for any high-value carryovers
  const hasHighValueCarryover = Object.values(carryovers).some((c) => c && shouldAlertCarryover(c));

  return (
    <>
      <div className="multirace-exotics-section">
        <button className="multirace-exotics-toggle" onClick={() => setIsExpanded(!isExpanded)}>
          <span className="material-icons">casino</span>
          <span>Multi-Race Exotics</span>
          {hasHighValueCarryover && (
            <span className="multirace-carryover-indicator">
              <span className="material-icons" style={{ fontSize: 16 }}>
                trending_up
              </span>
              Carryover
            </span>
          )}
          {analysis.bestOpportunity && (
            <span className="multirace-opportunity-badge">
              {getBetConfig(analysis.bestOpportunity).shortName} opportunity
            </span>
          )}
          <span className={`material-icons chevron ${isExpanded ? 'open' : ''}`}>expand_more</span>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="multirace-exotics-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Analysis Summary */}
              {analysis.recommendation && (
                <div className="multirace-analysis-summary">
                  <span className="material-icons">insights</span>
                  <span>{analysis.recommendation}</span>
                </div>
              )}

              {/* Race Strength Summary */}
              <div className="multirace-strength-summary">
                {analysis.standoutRaces.length > 0 && (
                  <div className="multirace-strength-item standout">
                    <span className="material-icons">verified</span>
                    <span>{analysis.standoutRaces.length} standout race(s)</span>
                    <span className="multirace-strength-races">
                      R{analysis.standoutRaces.join(', R')}
                    </span>
                  </div>
                )}
                {analysis.competitiveRaces.length > 0 && (
                  <div className="multirace-strength-item competitive">
                    <span className="material-icons">multiple_stop</span>
                    <span>{analysis.competitiveRaces.length} competitive</span>
                  </div>
                )}
                {analysis.weakRaces.length > 0 && (
                  <div className="multirace-strength-item weak">
                    <span className="material-icons">help_outline</span>
                    <span>{analysis.weakRaces.length} weak</span>
                  </div>
                )}
              </div>

              {/* Bet Type Cards */}
              <div className="multirace-bet-cards">
                {(
                  ['daily_double', 'pick_3', 'pick_4', 'pick_5', 'pick_6'] as MultiRaceBetType[]
                ).map((betType) => {
                  const config = getBetConfig(betType);
                  const isAvailable = availableBetTypes.includes(betType);
                  const startRace = currentRaceNumber;
                  const endRace = currentRaceNumber + config.racesRequired - 1;

                  return (
                    <BetTypeCard
                      key={betType}
                      betType={betType}
                      startRace={startRace}
                      endRace={endRace}
                      isAvailable={isAvailable}
                      optimization={optimizations[betType]}
                      carryover={
                        betType === 'pick_5' || betType === 'pick_6' ? carryovers[betType] : null
                      }
                      onBuild={() => handleOpenBuilder(betType)}
                    />
                  );
                })}
              </div>

              {/* Strategy Hint */}
              <div className="multirace-strategy-hint">
                <span className="material-icons">lightbulb</span>
                <div>
                  <strong>Tip:</strong> Multi-race bets are high-variance. Use singles in standout
                  races, spread in competitive ones. Consider carryover days for better value.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Builder Modal */}
      <AnimatePresence>
        {builderOpen && (
          <MultiRaceBuilderModal
            isOpen={builderOpen}
            onClose={() => setBuilderOpen(false)}
            betType={selectedBetType}
            races={races.slice(currentRaceNumber - 1)}
            startingRace={currentRaceNumber}
            trackCode={trackCode}
            budget={budget}
            onAddToBetSlip={onAddToBetSlip}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default MultiRaceExoticsPanel;
