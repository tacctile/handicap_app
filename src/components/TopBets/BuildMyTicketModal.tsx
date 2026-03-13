/**
 * BuildMyTicketModal Component
 *
 * Modal that builds an optimized betting ticket from the available bet pool.
 * Takes budget, bet count, and risk mode as inputs.
 * Includes a "Surprise Me" button for random quality-floored tickets.
 * Uses createPortal for modal mounting (matching HorseExpandedView pattern).
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScaledTopBet } from './TopBetsView';
import {
  allocateTicket,
  generateSurpriseTicket,
  type TicketAllocatorResult,
  type RiskMode,
} from '../../lib/betting/ticketAllocator';
import './BuildMyTicketModal.css';

// ============================================================================
// TYPES
// ============================================================================

interface BuildMyTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  betPool: ScaledTopBet[];
  currentBaseAmount: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getConfidenceColor(probability: number): string {
  if (probability >= 67) return '#22c55e';
  if (probability >= 40) return '#eab308';
  return '#ef4444';
}

function formatBetTypeLabel(internalType: string): string {
  return internalType.replace(/_/g, ' ');
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BuildMyTicketModal: React.FC<BuildMyTicketModalProps> = ({
  isOpen,
  onClose,
  betPool,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Internal state
  const [budget, setBudget] = useState<number>(50);
  const [budgetInput, setBudgetInput] = useState<string>('50');
  const [betCount, setBetCount] = useState<number>(3);
  const [mode, setMode] = useState<RiskMode>('Moderate');
  const [surpriseTicket, setSurpriseTicket] = useState<TicketAllocatorResult | null>(null);

  // Build My Ticket — recalculates live
  const buildTicket = useMemo(
    () => allocateTicket({ betPool, budget, betCount, mode, surpriseMode: false }),
    [betPool, budget, betCount, mode]
  );

  // Surprise Me — only on button press
  const handleSurpriseMe = useCallback(() => {
    setSurpriseTicket(
      generateSurpriseTicket({ betPool, budget, betCount, mode, surpriseMode: true })
    );
  }, [betPool, budget, betCount, mode]);

  // Budget input handler
  const handleBudgetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setBudgetInput(value);
    const num = parseInt(value, 10);
    if (num >= 5 && num <= 500) {
      setBudget(num);
    }
  }, []);

  const handleBudgetBlur = useCallback(() => {
    const num = parseInt(budgetInput, 10);
    if (num >= 5 && num <= 500) {
      setBudget(num);
      setBudgetInput(num.toString());
    } else {
      setBudgetInput(budget.toString());
    }
  }, [budgetInput, budget]);

  // Escape key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="help-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="help-modal ticket-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <button className="help-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="help-modal__content">
          {/* Header */}
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#eeeff1',
              marginTop: 0,
              marginBottom: 16,
            }}
          >
            Build My Ticket
          </h2>

          {/* Controls Row */}
          <div className="ticket-controls">
            {/* Budget */}
            <div className="ticket-controls__group">
              <span className="ticket-controls__label">Race Budget</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#b4b4b6', fontSize: 14 }}>$</span>
                <input
                  type="text"
                  className="ticket-budget-input"
                  value={budgetInput}
                  onChange={handleBudgetChange}
                  onBlur={handleBudgetBlur}
                  maxLength={3}
                />
              </div>
            </div>

            {/* Bet Count */}
            <div className="ticket-controls__group">
              <span className="ticket-controls__label">Number of Bets</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`ticket-count-btn ${betCount === n ? 'active' : ''}`}
                    onClick={() => setBetCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Mode */}
            <div className="ticket-controls__group">
              <span className="ticket-controls__label">Risk Mode</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['Conservative', 'Moderate', 'Aggressive'] as RiskMode[]).map((m) => (
                  <button
                    key={m}
                    className={`ticket-mode-btn ${mode === m ? `active active--${m.toLowerCase()}` : ''}`}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="ticket-controls__group">
              <span className="ticket-controls__label">&nbsp;</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="ticket-action-btn"
                  onClick={() => {
                    /* decorative — live recalc */
                  }}
                >
                  Build My Ticket
                </button>
                <button
                  className="ticket-action-btn ticket-action-btn--surprise"
                  onClick={handleSurpriseMe}
                >
                  Surprise Me
                </button>
              </div>
            </div>
          </div>

          {/* Two Column Output */}
          <div className="ticket-columns">
            {/* Left: Optimized Ticket */}
            <TicketColumn
              title="Your Optimized Ticket"
              result={buildTicket}
              budget={budget}
              mode={mode}
            />

            {/* Right: Surprise Me */}
            {surpriseTicket ? (
              <TicketColumn
                title="Surprise Ticket"
                result={surpriseTicket}
                budget={budget}
                mode={mode}
              />
            ) : (
              <div className="ticket-column">
                <div className="ticket-column__header">
                  <span className="ticket-column__title">Surprise Ticket</span>
                </div>
                <div className="ticket-placeholder">
                  Press Surprise Me to generate a random ticket
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ============================================================================
// TICKET COLUMN SUB-COMPONENT
// ============================================================================

interface TicketColumnProps {
  title: string;
  result: TicketAllocatorResult;
  budget: number;
  mode: RiskMode;
}

const TicketColumn: React.FC<TicketColumnProps> = ({ title, result, budget, mode }) => {
  if (result.selectedBets.length === 0) {
    return (
      <div className="ticket-column">
        <div className="ticket-column__header">
          <span className="ticket-column__title">{title}</span>
        </div>
        <div className="ticket-placeholder">
          No {mode} bets available for this race. Try a different mode or increase your budget.
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-column">
      <div className="ticket-column__header">
        <span className="ticket-column__title">{title}</span>
        <span className="ticket-confidence-badge">
          Blended Confidence: {result.blendedConfidence}%
        </span>
      </div>
      <div className="ticket-total">
        Total: ${result.totalCost} of ${budget} budget
      </div>
      {result.selectedBets.map((bet, idx) => (
        <TicketBetCard key={`${bet.internalType}-${bet.horseNumbers.join('-')}-${idx}`} bet={bet} />
      ))}
    </div>
  );
};

// ============================================================================
// BET CARD SUB-COMPONENT
// ============================================================================

interface TicketBetCardProps {
  bet: ScaledTopBet & { allocationReason: string; budgetShare: number };
}

const TicketBetCard: React.FC<TicketBetCardProps> = ({ bet }) => {
  const confColor = getConfidenceColor(bet.probability);
  const horseNames = bet.horses.map((h) => h.name).join(' + ');

  return (
    <div className="ticket-bet-card" style={{ borderLeft: `3px solid ${confColor}` }}>
      {/* Bet type label */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#19abb5',
          textTransform: 'uppercase' as const,
          marginBottom: 4,
        }}
      >
        {formatBetTypeLabel(bet.internalType)}
      </div>

      {/* Horse names */}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#eeeff1', marginBottom: 6 }}>
        {horseNames}
      </div>

      {/* Cost and confidence row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#eeeff1' }}>Cost: ${bet.scaledCost}</span>
        <span style={{ fontSize: 13, color: confColor, fontWeight: 600 }}>
          {Math.round(bet.probability)}%
        </span>
      </div>

      {/* Allocation reason */}
      <div style={{ fontSize: 13, color: '#b4b4b6', marginBottom: 8 }}>{bet.allocationReason}</div>

      {/* Window script */}
      <div className="ticket-window-script">
        <div className="ticket-window-script__label">Say at the window:</div>
        <div>{bet.scaledWhatToSay}</div>
      </div>
    </div>
  );
};

export default BuildMyTicketModal;
