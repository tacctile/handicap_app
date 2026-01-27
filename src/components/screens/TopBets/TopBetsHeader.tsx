import React, { useState, useCallback } from 'react';
import { Button } from '../../ui';

// ============================================================================
// TYPES
// ============================================================================

export interface TopBetsHeaderProps {
  /** Current bankroll amount */
  bankroll: number;
  /** Current base bet amount */
  baseBet: number;
  /** Handler for bankroll changes */
  onBankrollChange: (value: number) => void;
  /** Handler for base bet changes */
  onBaseBetChange: (value: number) => void;
  /** Sum of all Kelly-sized bets */
  totalInvestment: number;
  /** Expected profit from all bets */
  expectedReturn: number;
  /** Handler for back navigation */
  onBack: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_BET_OPTIONS = [1, 2, 5, 10];

// ============================================================================
// STYLES
// ============================================================================

const headerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  backgroundColor: 'var(--bg-card)',
  borderBottom: '1px solid var(--border-subtle)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
};

const topRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
};

const titleSectionStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--text-xl)',
  fontWeight: 'var(--font-bold)' as unknown as number,
  color: 'var(--text-primary)',
  margin: 0,
};

const controlsRowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
};

const controlGroupStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  fontWeight: 'var(--font-medium)' as unknown as number,
};

const bankrollInputStyles: React.CSSProperties = {
  width: '100px',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-base)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-sm)',
  fontVariantNumeric: 'tabular-nums',
};

const baseBetButtonsStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
};

const baseBetButtonStyles = (isActive: boolean): React.CSSProperties => ({
  padding: 'var(--space-2) var(--space-3)',
  minWidth: '44px',
  minHeight: '44px',
  backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
  border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-medium)' as unknown as number,
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
});

const summaryStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-base)',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-sm)',
  fontVariantNumeric: 'tabular-nums',
};

const summaryLabelStyles: React.CSSProperties = {
  color: 'var(--text-tertiary)',
};

const summaryValueStyles: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontWeight: 'var(--font-medium)' as unknown as number,
};

const expectedReturnStyles = (value: number): React.CSSProperties => ({
  color: value >= 0 ? 'var(--status-success)' : 'var(--status-error)',
  fontWeight: 'var(--font-medium)' as unknown as number,
});

const dotSeparatorStyles: React.CSSProperties = {
  color: 'var(--text-tertiary)',
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TopBetsHeader provides controls for bankroll, base bet sizing,
 * and displays summary statistics for all bets.
 */
export function TopBetsHeader({
  bankroll,
  baseBet,
  onBankrollChange,
  onBaseBetChange,
  totalInvestment,
  expectedReturn,
  onBack,
}: TopBetsHeaderProps): React.ReactElement {
  const [bankrollInput, setBankrollInput] = useState(bankroll.toString());
  const [showCustom, setShowCustom] = useState(false);
  const [customBet, setCustomBet] = useState('');

  // Handle bankroll input change
  const handleBankrollChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setBankrollInput(value);
  }, []);

  // Handle bankroll blur (commit changes)
  const handleBankrollBlur = useCallback(() => {
    const value = parseInt(bankrollInput, 10);
    if (value > 0) {
      onBankrollChange(value);
    } else {
      setBankrollInput(bankroll.toString());
    }
  }, [bankrollInput, bankroll, onBankrollChange]);

  // Handle bankroll enter key
  const handleBankrollKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleBankrollBlur();
        (e.target as HTMLInputElement).blur();
      }
    },
    [handleBankrollBlur]
  );

  // Handle base bet selection
  const handleBaseBetSelect = useCallback(
    (amount: number) => {
      setShowCustom(false);
      onBaseBetChange(amount);
    },
    [onBaseBetChange]
  );

  // Handle custom bet input
  const handleCustomBetChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '');
      setCustomBet(value);
      const numValue = parseInt(value, 10);
      if (numValue > 0) {
        onBaseBetChange(numValue);
      }
    },
    [onBaseBetChange]
  );

  // Format currency for display
  const formatCurrency = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

  // Format expected return with sign
  const formatExpected = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  };

  const isCustomActive = showCustom || !BASE_BET_OPTIONS.includes(baseBet);

  return (
    <header style={headerStyles}>
      {/* Top Row: Back Button and Title */}
      <div style={topRowStyles}>
        <div style={titleSectionStyles}>
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← All Races
          </Button>
          <h1 style={titleStyles}>Top Bets</h1>
        </div>

        {/* Summary Stats */}
        <div style={summaryStyles}>
          <span style={summaryLabelStyles}>Total:</span>
          <span style={summaryValueStyles}>{formatCurrency(totalInvestment)}</span>
          <span style={dotSeparatorStyles}>·</span>
          <span style={summaryLabelStyles}>Expected:</span>
          <span style={expectedReturnStyles(expectedReturn)}>{formatExpected(expectedReturn)}</span>
        </div>
      </div>

      {/* Controls Row: Bankroll and Base Bet */}
      <div style={controlsRowStyles}>
        {/* Bankroll Input */}
        <div style={controlGroupStyles}>
          <span style={labelStyles}>Bankroll:</span>
          <input
            type="text"
            style={bankrollInputStyles}
            value={bankrollInput}
            onChange={handleBankrollChange}
            onBlur={handleBankrollBlur}
            onKeyDown={handleBankrollKeyDown}
            inputMode="numeric"
          />
        </div>

        {/* Base Bet Selector */}
        <div style={controlGroupStyles}>
          <span style={labelStyles}>Base Bet:</span>
          <div style={baseBetButtonsStyles}>
            {BASE_BET_OPTIONS.map((amount) => (
              <button
                key={amount}
                style={baseBetButtonStyles(baseBet === amount && !isCustomActive)}
                onClick={() => handleBaseBetSelect(amount)}
              >
                ${amount}
              </button>
            ))}
            {showCustom || isCustomActive ? (
              <input
                type="text"
                style={{
                  ...baseBetButtonStyles(true),
                  width: '60px',
                  textAlign: 'center',
                }}
                value={customBet || (isCustomActive ? baseBet.toString() : '')}
                onChange={handleCustomBetChange}
                placeholder="$"
                inputMode="numeric"
                autoFocus
              />
            ) : (
              <button style={baseBetButtonStyles(false)} onClick={() => setShowCustom(true)}>
                Custom
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBetsHeader;
