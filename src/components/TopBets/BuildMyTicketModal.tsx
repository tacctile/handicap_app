/**
 * BuildMyTicketModal Component
 *
 * Modal that builds an optimized betting ticket from the available bet pool.
 * Takes budget, bet count, and risk mode as inputs.
 * Includes a "Surprise Me" button for random quality-floored tickets.
 * Uses createPortal for modal mounting (matching HorseExpandedView pattern).
 *
 * Features:
 * - Budget utilization bar with color-coded status
 * - Locked bet count indicators with unlock suggestions
 * - Tight single-row controls layout
 * - Composite quality scoring via ticket allocator
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScaledTopBet } from './TopBetsView';
import {
  allocateTicket,
  generateSurpriseTicket,
  type TicketAllocatorResult,
  type AllocatedBet,
  type RiskMode,
  type UtilizationStatus,
} from '../../lib/betting/ticketAllocator';
import './BuildMyTicketModal.css';

// ============================================================================
// TYPES
// ============================================================================

interface BuildMyTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  betPool: ScaledTopBet[];
  allScores: number[];
}

// ============================================================================
// HELPERS
// ============================================================================

interface VerdictResult {
  label: string;
  color: string;
}

/**
 * Translates a score into a plain-English verdict using percentile rank within the pool.
 * Percentile = (count of bets with score <= this score) / total bets.
 * Uses the full Top Bets pool for consistent ranking across both surfaces.
 */
function getModelVerdict(score: number, allScores: number[]): VerdictResult {
  const total = allScores.length;
  if (total === 0) return { label: 'Roll the dice', color: '#7f1d1d' };

  const countAtOrBelow = allScores.filter((s) => s <= score).length;
  const percentile = countAtOrBelow / total;

  if (percentile >= 0.92) return { label: 'Model loves this one', color: '#22c55e' };
  if (percentile >= 0.83) return { label: 'Numbers back this play', color: '#4ade80' };
  if (percentile >= 0.75) return { label: 'Strong case here', color: '#86efac' };
  if (percentile >= 0.67) return { label: 'Good coverage', color: '#bef264' };
  if (percentile >= 0.58) return { label: 'Reasonable shot', color: '#eab308' };
  if (percentile >= 0.5) return { label: 'Could go either way', color: '#facc15' };
  if (percentile >= 0.42) return { label: 'Worth a look', color: '#fb923c' };
  if (percentile >= 0.33) return { label: 'Solid spread', color: '#f97316' };
  if (percentile >= 0.25) return { label: 'Long shot territory', color: '#ef4444' };
  if (percentile >= 0.17) return { label: 'High risk, high reward', color: '#dc2626' };
  if (percentile >= 0.08) return { label: "Model isn't sold", color: '#b91c1c' };
  return { label: 'Roll the dice', color: '#7f1d1d' };
}

function formatBetTypeLabel(internalType: string): string {
  return internalType.replace(/_/g, ' ');
}

function getUtilizationColor(status: UtilizationStatus): string {
  switch (status) {
    case 'excellent':
      return '#22c55e';
    case 'good':
      return '#eab308';
    case 'low':
      return '#ef4444';
    case 'critical':
      return '#ef4444';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BuildMyTicketModal: React.FC<BuildMyTicketModalProps> = ({
  isOpen,
  onClose,
  betPool,
  allScores,
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

  // Derive locked state for bet count buttons
  const availability = buildTicket.availability;

  // Find the unlock suggestion to display
  const unlockSuggestion = useMemo(() => {
    // Find the NEXT locked bet count above the currently selected count
    for (let n = betCount + 1; n <= 5; n++) {
      const entry = availability[n];
      if (entry && !entry.available && entry.suggestion) {
        return entry.suggestion;
      }
    }
    // If current selection is locked (user was on a higher count that became locked), show for current
    for (let n = betCount; n <= 5; n++) {
      const entry = availability[n];
      if (entry && !entry.available && entry.suggestion) {
        return entry.suggestion;
      }
    }
    return null;
  }, [availability, betCount]);

  const hasLockedButtons = useMemo(() => {
    for (let n = 1; n <= 5; n++) {
      const entry = availability[n];
      if (entry && !entry.available) return true;
    }
    return false;
  }, [availability]);

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

  // Bet count click handler — only change if available
  const handleBetCountClick = useCallback(
    (n: number) => {
      const entry = availability[n];
      if (entry && !entry.available) return; // locked — do nothing
      setBetCount(n);
    },
    [availability]
  );

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
          &times;
        </button>

        <div className="help-modal__content">
          {/* Header */}
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#eeeff1',
              marginTop: 0,
              marginBottom: 12,
            }}
          >
            Build My Ticket
          </h2>

          {/* Controls Row — single tight row */}
          <div className="ticket-controls">
            {/* Budget */}
            <div className="ticket-controls__group ticket-controls__group--inline">
              <span className="ticket-controls__label">Budget</span>
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
            <div className="ticket-controls__group ticket-controls__group--inline">
              <span className="ticket-controls__label">Bets</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const entry = availability[n];
                  const isLocked = entry ? !entry.available : false;
                  const isActive = betCount === n;
                  let className = 'ticket-count-btn';
                  if (isActive) className += ' active';
                  if (isLocked) className += ' ticket-bet-count-btn--locked';

                  return (
                    <button
                      key={n}
                      className={className}
                      onClick={() => handleBetCountClick(n)}
                      disabled={isLocked}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Risk Mode */}
            <div className="ticket-controls__group ticket-controls__group--inline">
              <span className="ticket-controls__label">Mode</span>
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

            {/* Action Buttons — inline with controls */}
            <div className="ticket-controls__group ticket-controls__group--inline ticket-controls__actions">
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

          {/* Budget Utilization Bar */}
          <UtilizationBar
            totalCost={buildTicket.totalCost}
            budget={budget}
            utilization={buildTicket.budgetUtilization}
            status={buildTicket.utilizationStatus}
          />

          {/* Unlock Suggestion */}
          {hasLockedButtons && unlockSuggestion && unlockSuggestion.additionalBudgetNeeded > 0 && (
            <div className="ticket-unlock-suggestion">
              {'💡'} Increase budget by ${unlockSuggestion.additionalBudgetNeeded} to unlock{' '}
              {unlockSuggestion.betCount} bets &mdash; would add a {unlockSuggestion.betDescription}
            </div>
          )}

          {/* Two Column Output */}
          <div className="ticket-columns">
            {/* Left: Optimized Ticket */}
            <TicketColumn
              title="Your Optimized Ticket"
              result={buildTicket}
              budget={budget}
              mode={mode}
              allScores={allScores}
            />

            {/* Right: Surprise Me */}
            {surpriseTicket ? (
              <TicketColumn
                title="Surprise Ticket"
                result={surpriseTicket}
                budget={budget}
                mode={mode}
                allScores={allScores}
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
// UTILIZATION BAR SUB-COMPONENT
// ============================================================================

interface UtilizationBarProps {
  totalCost: number;
  budget: number;
  utilization: number;
  status: UtilizationStatus;
}

const UtilizationBar: React.FC<UtilizationBarProps> = ({
  totalCost,
  budget,
  utilization,
  status,
}) => {
  const fillColor = getUtilizationColor(status);
  const fillWidth = Math.min(100, utilization);
  const isCritical = status === 'critical';

  return (
    <div className="ticket-utilization-bar">
      <span className="ticket-utilization-bar__label">BUDGET UTILIZATION</span>
      <span className="ticket-utilization-bar__text">
        ${totalCost} of ${budget} &middot; {utilization}%
      </span>
      <div className="ticket-utilization-bar__track">
        <div
          className={`ticket-utilization-bar__fill${isCritical ? ' ticket-utilization-bar__fill--critical' : ''}`}
          style={{ width: `${fillWidth}%`, background: fillColor }}
        />
      </div>
    </div>
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
  allScores: number[];
}

const TicketColumn: React.FC<TicketColumnProps> = ({ title, result, budget, mode, allScores }) => {
  const [showIssues, setShowIssues] = useState(false);
  const integrity = result.integrity;

  if (result.bets.length === 0) {
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
          Blended Strength: {getModelVerdict(result.blendedConfidence / 100, allScores).label}
        </span>
        {integrity.verified ? (
          <span className="ticket-integrity-badge ticket-integrity-badge--verified">
            &#10003; Ticket Verified
          </span>
        ) : (
          <span
            className="ticket-integrity-badge ticket-integrity-badge--warning"
            onClick={() => setShowIssues(!showIssues)}
            style={{ cursor: 'pointer' }}
          >
            &#9888; Check Manually
          </span>
        )}
      </div>
      {!integrity.verified && showIssues && (
        <div className="ticket-integrity-issues">
          {integrity.issues.map((issue, i) => (
            <div key={i} className="ticket-integrity-issues__item">
              {issue}
            </div>
          ))}
        </div>
      )}
      <div className="ticket-total">
        Total: ${result.totalCost} of ${budget} budget
      </div>
      {result.bets.map((bet, idx) => (
        <TicketBetCard
          key={`${bet.internalType}-${bet.horseNumbers.join('-')}-${idx}`}
          bet={bet}
          allScores={allScores}
        />
      ))}
    </div>
  );
};

// ============================================================================
// BET CARD SUB-COMPONENT
// ============================================================================

interface TicketBetCardProps {
  bet: AllocatedBet;
  allScores: number[];
}

const TicketBetCard: React.FC<TicketBetCardProps> = ({ bet, allScores }) => {
  const normalizedScore = Math.min(bet.probability, 99) / 100;
  const verdict = getModelVerdict(normalizedScore, allScores);
  const horseNames = bet.horses.map((h) => h.name).join(' + ');

  return (
    <div className="ticket-bet-card" style={{ borderLeft: `3px solid ${verdict.color}` }}>
      {/* Bet type label + verdict right-aligned */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#19abb5',
            textTransform: 'uppercase' as const,
          }}
        >
          {formatBetTypeLabel(bet.internalType)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: verdict.color }}>{verdict.label}</span>
      </div>

      {/* Horse names */}
      <div style={{ fontSize: 14, fontWeight: 600, color: '#eeeff1', marginBottom: 6 }}>
        {horseNames}
      </div>

      {/* Cost row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#eeeff1' }}>Cost: ${bet.computedCost}</span>
      </div>

      {/* Over budget badge */}
      {bet.isOverBudget && <div className="ticket-over-budget-badge">slightly over budget</div>}

      {/* Allocation reason */}
      <div style={{ fontSize: 13, color: '#b4b4b6', marginBottom: 8 }}>{bet.allocationReason}</div>

      {/* Window script */}
      <div className="ticket-window-script">
        <div className="ticket-window-script__label">Say at the window:</div>
        <div>{bet.scaledScript}</div>
      </div>
    </div>
  );
};

export default BuildMyTicketModal;
