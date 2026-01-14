/**
 * HorseSelector Component
 *
 * Allows users to select horses for their custom bet.
 * Features:
 * - One dropdown per horse slot based on bet type
 * - Shows projected finish and edge percentage
 * - Auto-fills with top horses on mount
 * - Prevents duplicate selections
 * - Add/remove horses for box bets
 */

import React, { useRef, useState, useEffect } from 'react';
import type { ScoredHorse } from '../../lib/scoring';
import type { BetTypeConfig } from '../../lib/betting/betTypes';
import './HorseSelector.css';

// ============================================================================
// TYPES
// ============================================================================

interface HorseSelectorProps {
  /** Available horses to select from */
  scoredHorses: ScoredHorse[];
  /** Currently selected horse post positions */
  selectedHorses: number[];
  /** Callback when selections change */
  onSelectionChange: (horses: number[]) => void;
  /** Current bet type configuration */
  betTypeConfig: BetTypeConfig;
  /** Function to get current odds for a horse */
  getOdds: (index: number, defaultOdds: string) => string;
  /** Function to check if horse is scratched */
  isScratched: (index: number) => boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

interface HorseOption {
  /** Horse index in the scoredHorses array */
  index: number;
  /** Post/program number */
  programNumber: number;
  /** Horse name */
  name: string;
  /** Projected finish position (rank) */
  projectedFinish: number;
  /** Edge percentage (positive = overlay) */
  edge: number;
  /** Current odds string */
  odds: string;
  /** Whether this horse is scratched */
  isScratched: boolean;
  /** Base score for sorting */
  baseScore: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate edge percentage from score and odds
 */
function calculateEdge(baseScore: number, oddsStr: string): number {
  // Parse odds (e.g., "15-1" -> 15)
  const parts = oddsStr.split('-');
  const odds = parseFloat(parts[0] || '10') / parseFloat(parts[1] || '1');

  // Calculate implied probability from odds
  const impliedProb = 100 / (odds + 1);

  // Calculate model probability from score (normalized to 328 max)
  // Higher score = higher probability
  const normalizedScore = Math.min(baseScore / 328, 1);
  const modelProb = normalizedScore * 60 + 5; // 5-65% range

  // Edge = (modelProb - impliedProb) / impliedProb * 100
  if (impliedProb <= 0) return 0;
  return Math.round((modelProb - impliedProb) / impliedProb * 100);
}

/**
 * Get position suffix (1st, 2nd, 3rd, etc.)
 */
function getPositionSuffix(pos: number): string {
  if (pos === 1) return 'st';
  if (pos === 2) return 'nd';
  if (pos === 3) return 'rd';
  return 'th';
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface HorseDropdownProps {
  /** Slot index (0, 1, 2, etc.) */
  slotIndex: number;
  /** Label for this slot */
  label: string;
  /** All available options */
  options: HorseOption[];
  /** Currently selected program number */
  selectedProgram: number | null;
  /** Callback when selection changes */
  onSelect: (programNumber: number) => void;
  /** Program numbers to exclude (already selected in other slots) */
  excludePrograms: number[];
  /** Whether this dropdown is disabled */
  disabled?: boolean;
}

const HorseDropdown: React.FC<HorseDropdownProps> = ({
  slotIndex: _slotIndex,
  label,
  options,
  selectedProgram,
  onSelect,
  excludePrograms,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find the selected horse option
  const selectedHorse = options.find((h) => h.programNumber === selectedProgram);

  // Filter out excluded and scratched horses for the dropdown menu
  const availableOptions = options.filter(
    (h) => !h.isScratched && (!excludePrograms.includes(h.programNumber) || h.programNumber === selectedProgram)
  );

  const handleSelect = (programNumber: number) => {
    onSelect(programNumber);
    setIsOpen(false);
  };

  return (
    <div className="horse-dropdown" ref={dropdownRef}>
      <div className="horse-dropdown__label">{label}</div>
      <button
        className={`horse-dropdown__trigger ${isOpen ? 'horse-dropdown__trigger--open' : ''} ${selectedHorse ? '' : 'horse-dropdown__trigger--empty'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {selectedHorse ? (
          <>
            <span className="horse-dropdown__pp">#{selectedHorse.programNumber}</span>
            <span className="horse-dropdown__name">{selectedHorse.name}</span>
            <span className="horse-dropdown__meta">
              <span className="horse-dropdown__proj">
                Proj: {selectedHorse.projectedFinish}{getPositionSuffix(selectedHorse.projectedFinish)}
              </span>
              <span
                className={`horse-dropdown__edge ${selectedHorse.edge >= 50 ? 'horse-dropdown__edge--hot' : selectedHorse.edge >= 0 ? 'horse-dropdown__edge--positive' : 'horse-dropdown__edge--negative'}`}
              >
                {selectedHorse.edge >= 50 && '🔥 '}
                {selectedHorse.edge >= 0 ? '+' : ''}{selectedHorse.edge}%
              </span>
            </span>
            <span className="material-icons horse-dropdown__chevron">
              {isOpen ? 'expand_less' : 'expand_more'}
            </span>
          </>
        ) : (
          <>
            <span className="horse-dropdown__placeholder">Select horse...</span>
            <span className="material-icons horse-dropdown__chevron">expand_more</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="horse-dropdown__menu">
          {availableOptions.length === 0 ? (
            <div className="horse-dropdown__empty">No horses available</div>
          ) : (
            availableOptions.map((horse) => (
              <button
                key={horse.programNumber}
                className={`horse-dropdown__option ${horse.programNumber === selectedProgram ? 'horse-dropdown__option--selected' : ''} ${horse.projectedFinish >= 5 ? 'horse-dropdown__option--longshot' : ''}`}
                onClick={() => handleSelect(horse.programNumber)}
              >
                <span className="horse-dropdown__option-pp">#{horse.programNumber}</span>
                <span className="horse-dropdown__option-name">{horse.name}</span>
                <span className="horse-dropdown__option-proj">
                  {horse.projectedFinish >= 5 && <span className="horse-dropdown__warning">⚠️</span>}
                  {horse.projectedFinish}{getPositionSuffix(horse.projectedFinish)}
                </span>
                <span
                  className={`horse-dropdown__option-edge ${horse.edge >= 50 ? 'horse-dropdown__option-edge--hot' : horse.edge >= 0 ? 'horse-dropdown__option-edge--positive' : 'horse-dropdown__option-edge--negative'}`}
                >
                  {horse.edge >= 50 && '🔥'}
                  {horse.edge >= 0 ? '+' : ''}{horse.edge}%
                </span>
                {horse.programNumber === selectedProgram && (
                  <span className="material-icons horse-dropdown__option-check">check</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const HorseSelector: React.FC<HorseSelectorProps> = ({
  scoredHorses,
  selectedHorses,
  onSelectionChange,
  betTypeConfig,
  getOdds,
  isScratched,
  disabled = false,
}) => {
  // Build horse options from scored horses
  const horseOptions: HorseOption[] = scoredHorses.map((sh) => {
    const odds = getOdds(sh.index, sh.horse.morningLineOdds);
    return {
      index: sh.index,
      programNumber: sh.horse.programNumber,
      name: sh.horse.horseName,
      projectedFinish: sh.rank,
      edge: calculateEdge(sh.score.baseScore, odds),
      odds,
      isScratched: isScratched(sh.index) || sh.score.isScratched,
      baseScore: sh.score.baseScore,
    };
  }).sort((a, b) => a.projectedFinish - b.projectedFinish);

  // Get slot labels based on bet type
  const getSlotLabel = (index: number): string => {
    if (betTypeConfig.isBox) {
      return `Horse ${index + 1}:`;
    }
    switch (betTypeConfig.type) {
      case 'WIN':
      case 'PLACE':
      case 'SHOW':
        return 'Horse:';
      case 'EXACTA':
        return index === 0 ? '1st:' : '2nd:';
      case 'QUINELLA':
        return index === 0 ? 'Horse A:' : 'Horse B:';
      case 'TRIFECTA':
        return index === 0 ? '1st:' : index === 1 ? '2nd:' : '3rd:';
      default:
        return `Horse ${index + 1}:`;
    }
  };

  // Handle selection change for a specific slot
  const handleSlotChange = (slotIndex: number, programNumber: number) => {
    const newSelections = [...selectedHorses];
    newSelections[slotIndex] = programNumber;
    onSelectionChange(newSelections);
  };

  // Handle adding a horse (for box bets)
  const handleAddHorse = () => {
    if (selectedHorses.length >= betTypeConfig.maxHorses) return;

    // Find next best available horse
    const usedPrograms = new Set(selectedHorses);
    const nextHorse = horseOptions.find(
      (h) => !h.isScratched && !usedPrograms.has(h.programNumber)
    );

    if (nextHorse) {
      onSelectionChange([...selectedHorses, nextHorse.programNumber]);
    }
  };

  // Handle removing a horse (for box bets)
  const handleRemoveHorse = () => {
    if (selectedHorses.length <= betTypeConfig.minHorses) return;
    onSelectionChange(selectedHorses.slice(0, -1));
  };

  // Determine if we can add/remove horses
  const canAdd = betTypeConfig.isBox && selectedHorses.length < betTypeConfig.maxHorses;
  const canRemove = betTypeConfig.isBox && selectedHorses.length > betTypeConfig.minHorses;

  // Calculate number of combinations for display
  const calculateCombinations = (): number => {
    const n = selectedHorses.length;
    switch (betTypeConfig.type) {
      case 'WIN':
      case 'PLACE':
      case 'SHOW':
        return 1;
      case 'EXACTA':
        return 1;
      case 'EXACTA_BOX':
        return n * (n - 1);
      case 'QUINELLA':
        return 1;
      case 'TRIFECTA':
        return 1;
      case 'TRIFECTA_BOX':
        return n * (n - 1) * (n - 2);
      case 'SUPERFECTA_BOX':
        return n * (n - 1) * (n - 2) * (n - 3);
      default:
        return 1;
    }
  };

  const combinations = calculateCombinations();

  return (
    <div className="horse-selector">
      <div className="horse-selector__header">
        <span className="horse-selector__title">YOUR SELECTIONS</span>
        {betTypeConfig.isBox && combinations > 1 && (
          <span className="horse-selector__combos">
            {combinations} combination{combinations !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="horse-selector__slots">
        {selectedHorses.map((programNumber, index) => (
          <HorseDropdown
            key={`slot-${index}`}
            slotIndex={index}
            label={getSlotLabel(index)}
            options={horseOptions}
            selectedProgram={programNumber}
            onSelect={(pp) => handleSlotChange(index, pp)}
            excludePrograms={selectedHorses.filter((_, i) => i !== index)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Add/Remove buttons for box bets */}
      {betTypeConfig.isBox && (
        <div className="horse-selector__actions">
          {canAdd && (
            <button
              className="horse-selector__action horse-selector__action--add"
              onClick={handleAddHorse}
              disabled={disabled}
            >
              <span className="material-icons">add</span>
              <span>Add Horse</span>
            </button>
          )}
          {canRemove && (
            <button
              className="horse-selector__action horse-selector__action--remove"
              onClick={handleRemoveHorse}
              disabled={disabled}
            >
              <span className="material-icons">remove</span>
              <span>Remove</span>
            </button>
          )}
        </div>
      )}

      {/* Warning if longshot selected */}
      {selectedHorses.some((pp) => {
        const horse = horseOptions.find((h) => h.programNumber === pp);
        return horse && horse.projectedFinish >= 5;
      }) && (
        <div className="horse-selector__warning-banner">
          <span className="material-icons">warning</span>
          <span>One or more selections projected to finish 5th or worse</span>
        </div>
      )}
    </div>
  );
};

export default HorseSelector;
