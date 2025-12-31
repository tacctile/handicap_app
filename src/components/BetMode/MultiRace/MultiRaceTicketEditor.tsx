/**
 * MultiRaceTicketEditor Component
 *
 * Allows users to customize their multi-race ticket by
 * selecting/deselecting horses in each leg.
 */

import React, { useState, useMemo } from 'react';
import type { MultiRaceBet, MultiRaceLeg } from '../../../lib/betting/betTypes';
import { MULTI_RACE_BET_CONFIGS } from '../../../lib/betting/betTypes';
import type { RaceAnalysisData } from '../../../lib/betting/multiRaceBets';
import './MultiRace.css';

interface MultiRaceTicketEditorProps {
  /** The ticket to edit */
  ticket: MultiRaceBet;
  /** Race data for each leg */
  raceData: RaceAnalysisData[];
  /** Maximum budget for this ticket */
  maxBudget?: number;
  /** Callback to save changes */
  onSave: (updatedTicket: MultiRaceBet) => void;
  /** Callback to cancel */
  onCancel: () => void;
}

interface LegSelection {
  raceNumber: number;
  selectedHorses: number[];
}

export const MultiRaceTicketEditor: React.FC<MultiRaceTicketEditorProps> = ({
  ticket,
  raceData,
  maxBudget,
  onSave,
  onCancel,
}) => {
  // Initialize selections from current ticket
  const [selections, setSelections] = useState<LegSelection[]>(() =>
    ticket.legs.map(leg => ({
      raceNumber: leg.raceNumber,
      selectedHorses: [...leg.horses],
    }))
  );

  const config = MULTI_RACE_BET_CONFIGS[ticket.type];

  // Calculate live combinations and cost
  const { combinations, totalCost, combinationMath } = useMemo(() => {
    const combos = selections.reduce((total, leg) => total * Math.max(1, leg.selectedHorses.length), 1);
    const cost = combos * ticket.costPerCombo;
    const math = selections.map(s => s.selectedHorses.length || 1).join(' x ') + ` = ${combos}`;
    return { combinations: combos, totalCost: cost, combinationMath: math };
  }, [selections, ticket.costPerCombo]);

  const isOverBudget = maxBudget !== undefined && totalCost > maxBudget;
  const hasEmptyLeg = selections.some(s => s.selectedHorses.length === 0);

  // Toggle horse selection
  const toggleHorse = (raceNumber: number, horseNumber: number) => {
    setSelections(prev =>
      prev.map(leg => {
        if (leg.raceNumber !== raceNumber) return leg;

        const isSelected = leg.selectedHorses.includes(horseNumber);
        if (isSelected) {
          return {
            ...leg,
            selectedHorses: leg.selectedHorses.filter(h => h !== horseNumber),
          };
        } else {
          return {
            ...leg,
            selectedHorses: [...leg.selectedHorses, horseNumber].sort((a, b) => a - b),
          };
        }
      })
    );
  };

  // Select all horses in a leg
  const selectAll = (raceNumber: number) => {
    const race = raceData.find(r => r.raceNumber === raceNumber);
    if (!race) return;

    const allHorses = race.scoredHorses
      .filter(h => !h.score.isScratched)
      .map(h => h.horse.programNumber)
      .sort((a, b) => a - b);

    setSelections(prev =>
      prev.map(leg =>
        leg.raceNumber === raceNumber
          ? { ...leg, selectedHorses: allHorses }
          : leg
      )
    );
  };

  // Clear all horses in a leg
  const clearLeg = (raceNumber: number) => {
    setSelections(prev =>
      prev.map(leg =>
        leg.raceNumber === raceNumber
          ? { ...leg, selectedHorses: [] }
          : leg
      )
    );
  };

  // Build updated ticket
  const handleSave = () => {
    const updatedLegs: MultiRaceLeg[] = selections.map(sel => {
      const race = raceData.find(r => r.raceNumber === sel.raceNumber);
      const originalLeg = ticket.legs.find(l => l.raceNumber === sel.raceNumber);

      const selectedHorses = race?.scoredHorses
        .filter(h => sel.selectedHorses.includes(h.horse.programNumber))
        .sort((a, b) => a.horse.programNumber - b.horse.programNumber) || [];

      return {
        raceNumber: sel.raceNumber,
        horses: selectedHorses.map(h => h.horse.programNumber),
        horseNames: selectedHorses.map(h => h.horse.horseName),
        horseOdds: selectedHorses.map(h => h.horse.morningLineOdds),
        strategy: selectedHorses.length === 1 ? 'SINGLE' : 'SPREAD',
        reasoning: selectedHorses.length === 1
          ? 'User selected single'
          : `User selected ${selectedHorses.length} horses`,
        hasValuePlay: originalLeg?.hasValuePlay && sel.selectedHorses.includes(originalLeg.valuePlayHorse || 0),
        valuePlayHorse: originalLeg?.valuePlayHorse,
      } as MultiRaceLeg;
    });

    // Generate new "what to say" script
    const startRace = updatedLegs[0]?.raceNumber ?? 1;
    const endRace = updatedLegs[updatedLegs.length - 1]?.raceNumber ?? 1;
    const costStr = ticket.costPerCombo % 1 === 0 ? `$${ticket.costPerCombo}` : `${ticket.costPerCombo * 100} cent`;

    const lines: string[] = [];
    lines.push(`"${costStr} ${config.name}, races ${startRace} through ${endRace}:`);
    updatedLegs.forEach((leg, idx) => {
      const horseNumbers = leg.horses.join(', ');
      const plural = leg.horses.length > 1 ? 's' : '';
      lines.push(` Leg ${idx + 1}: number${plural} ${horseNumbers}`);
    });
    lines[lines.length - 1] += '"';
    const whatToSay = lines.join('\n');

    const updatedTicket: MultiRaceBet = {
      ...ticket,
      legs: updatedLegs,
      combinations,
      totalCost,
      whatToSay,
    };

    onSave(updatedTicket);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="ticket-editor__overlay" onClick={handleOverlayClick}>
      <div className="ticket-editor">
        <div className="ticket-editor__header">
          <span className="ticket-editor__icon">✏️</span>
          <h3 className="ticket-editor__title">CUSTOMIZE {config.name.toUpperCase()} TICKET</h3>
        </div>

        <div className="ticket-editor__legs">
          {selections.map((sel, legIdx) => {
            const race = raceData.find(r => r.raceNumber === sel.raceNumber);
            if (!race) return null;

            const topHorses = race.scoredHorses
              .filter(h => !h.score.isScratched && h.rank <= 6)
              .sort((a, b) => a.rank - b.rank);

            const originalLeg = ticket.legs.find(l => l.raceNumber === sel.raceNumber);
            const valuePlayHorse = originalLeg?.valuePlayHorse;

            return (
              <div key={sel.raceNumber} className="ticket-editor__leg">
                <div className="ticket-editor__leg-header">
                  <span className="ticket-editor__leg-title">LEG {legIdx + 1} — RACE {sel.raceNumber}</span>
                  <span className="ticket-editor__leg-count">
                    Selected: {sel.selectedHorses.length}
                  </span>
                </div>

                <div className="ticket-editor__horses">
                  {topHorses.map(horse => {
                    const isSelected = sel.selectedHorses.includes(horse.horse.programNumber);
                    const isValuePlay = valuePlayHorse === horse.horse.programNumber;

                    return (
                      <button
                        key={horse.horse.programNumber}
                        className={`ticket-editor__horse ${isSelected ? 'ticket-editor__horse--selected' : ''}`}
                        onClick={() => toggleHorse(sel.raceNumber, horse.horse.programNumber)}
                      >
                        <div className="ticket-editor__horse-checkbox">
                          {isSelected && <span className="material-icons">check</span>}
                        </div>
                        <div className="ticket-editor__horse-info">
                          <span className="ticket-editor__horse-number">#{horse.horse.programNumber}</span>
                          <span className="ticket-editor__horse-name">{horse.horse.horseName}</span>
                          <span className="ticket-editor__horse-odds">({horse.horse.morningLineOdds})</span>
                          {isValuePlay && (
                            <span className="ticket-editor__horse-value">🔥 VALUE</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="ticket-editor__leg-actions">
                  <button
                    className="ticket-editor__leg-action"
                    onClick={() => selectAll(sel.raceNumber)}
                  >
                    SELECT ALL
                  </button>
                  <button
                    className="ticket-editor__leg-action"
                    onClick={() => clearLeg(sel.raceNumber)}
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live calculation */}
        <div className="ticket-editor__calculation">
          <div className="ticket-editor__calc-row">
            <span className="ticket-editor__calc-label">Combinations:</span>
            <span className="ticket-editor__calc-value">{combinationMath}</span>
          </div>
          <div className="ticket-editor__calc-row">
            <span className="ticket-editor__calc-label">Cost:</span>
            <span className="ticket-editor__calc-value ticket-editor__calc-value--highlight">
              {combinations} x ${ticket.costPerCombo} = ${totalCost}
            </span>
          </div>
        </div>

        {/* Budget warning */}
        {isOverBudget && (
          <div className="ticket-editor__warning">
            <span className="ticket-editor__warning-icon">⚠️</span>
            <span className="ticket-editor__warning-text">
              This ticket costs ${totalCost}. Consider reducing some legs to stay within your
              ${maxBudget} multi-race budget.
            </span>
          </div>
        )}

        {/* Empty leg warning */}
        {hasEmptyLeg && (
          <div className="ticket-editor__warning">
            <span className="ticket-editor__warning-icon">⚠️</span>
            <span className="ticket-editor__warning-text">
              Each leg must have at least one horse selected.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="ticket-editor__actions">
          <button className="ticket-editor__cancel-btn" onClick={onCancel}>
            CANCEL
          </button>
          <button
            className="ticket-editor__save-btn"
            onClick={handleSave}
            disabled={hasEmptyLeg}
          >
            SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiRaceTicketEditor;
