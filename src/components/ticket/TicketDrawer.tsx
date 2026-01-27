import React, { useMemo, useCallback, useState } from 'react';
import { Drawer } from '../ui/Drawer';
import { TicketSection, type TicketSectionProps } from './TicketSection';
import { TicketSummary } from './TicketSummary';
import type { TicketLineProps } from './TicketLine';
import type { TicketConstruction, BetRecommendation } from '../../services/ai/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer is closed */
  onClose: () => void;
  /** Race number */
  raceNumber: number;
  /** Track code */
  trackCode: string;
  /** Race distance (e.g., "6f") */
  distance?: string;
  /** Surface type (e.g., "Dirt") */
  surface?: string;
  /** Ticket construction data from AI analysis */
  ticketData: TicketConstruction | null;
  /** Bet recommendations from betting system */
  bets?: BetRecommendation[];
  /** User's bankroll amount */
  bankroll: number;
  /** Base bet amount */
  baseBet: number;
  /** Horse data for name lookups */
  horseNames?: Map<number, string>;
}

// ============================================================================
// STYLES
// ============================================================================

const headerInfoStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  backgroundColor: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  marginBottom: 'var(--space-4)',
};

const headerInfoIconStyles: React.CSSProperties = {
  fontSize: '18px',
  color: 'var(--text-tertiary)',
};

const headerInfoTextStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-mono)',
};

const dividerStyles: React.CSSProperties = {
  height: '1px',
  backgroundColor: 'var(--border-prominent)',
  margin: 'var(--space-4) 0',
};

const copyButtonContainerStyles: React.CSSProperties = {
  marginTop: 'var(--space-4)',
  paddingTop: 'var(--space-4)',
  borderTop: '1px solid var(--border-subtle)',
};

const copyButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  width: '100%',
  padding: 'var(--space-3)',
  backgroundColor: 'var(--primary)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)' as unknown as number,
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
};

const copyButtonHoverStyles: React.CSSProperties = {
  ...copyButtonStyles,
  backgroundColor: 'var(--primary-hover)',
};

const copiedMessageStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2)',
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  color: 'var(--status-success)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  marginTop: 'var(--space-2)',
};

const emptyStateStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-8)',
  textAlign: 'center',
  color: 'var(--text-tertiary)',
};

const emptyIconStyles: React.CSSProperties = {
  fontSize: '48px',
  marginBottom: 'var(--space-3)',
  opacity: 0.5,
};

const emptyTextStyles: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  marginBottom: 'var(--space-1)',
};

const emptySubtextStyles: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get horse name from program number
 */
function getHorseName(
  programNumber: number,
  horseNames?: Map<number, string>
): string {
  if (horseNames && horseNames.has(programNumber)) {
    return horseNames.get(programNumber) || `#${programNumber}`;
  }
  return `#${programNumber}`;
}

/**
 * Format program numbers as selection string
 */
function formatSelections(
  programNumbers: number[],
  horseNames?: Map<number, string>
): string {
  if (programNumbers.length === 0) return '';
  if (programNumbers.length === 1) {
    const num = programNumbers[0] as number;
    return `#${num} ${getHorseName(num, horseNames)}`;
  }
  return programNumbers.map((n) => `#${n}`).join('/');
}

/**
 * Calculate bet amount using Kelly sizing
 */
function calculateBetAmount(
  baseBet: number,
  multiplier: number,
  position: 'win' | 'place' | 'show' | 'exotic'
): number {
  // Apply position-based scaling
  const positionMultipliers: Record<string, number> = {
    win: 1.0,
    place: 0.7,
    show: 0.5,
    exotic: 1.0,
  };

  const positionMult = positionMultipliers[position] || 1.0;
  return Math.round(baseBet * multiplier * positionMult * 100) / 100;
}

/**
 * Map verdict to display format
 */
function mapVerdict(action: 'BET' | 'PASS'): 'BET' | 'PASS' | 'CAUTION' {
  return action === 'BET' ? 'BET' : 'PASS';
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TicketDrawer component displays the constructed betting ticket for a race.
 * Shows AI-recommended bets with Kelly-sized amounts and total investment.
 */
export function TicketDrawer({
  isOpen,
  onClose,
  raceNumber,
  trackCode,
  distance,
  surface,
  ticketData,
  bets,
  bankroll,
  baseBet,
  horseNames,
}: TicketDrawerProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build ticket sections from ticketData
  const { straightBets, exoticBets, totalStraight, totalExotic } = useMemo(() => {
    if (!ticketData) {
      return {
        straightBets: [] as TicketLineProps[],
        exoticBets: [] as TicketLineProps[],
        totalStraight: 0,
        totalExotic: 0,
      };
    }

    const straight: TicketLineProps[] = [];
    const exotic: TicketLineProps[] = [];
    let straightTotal = 0;
    let exoticTotal = 0;

    const multiplier = ticketData.sizing?.multiplier || 1.0;

    // Build straight bets from algorithm top 4 based on template
    const top4 = ticketData.algorithmTop4 || [];

    if (ticketData.template !== 'PASS' && top4.length > 0) {
      // WIN bet on top pick (unless template B demotes favorite)
      if (ticketData.template === 'A' || ticketData.template === 'C') {
        // Template A/C: Top pick to win
        if (top4[0] !== undefined) {
          const winAmount = calculateBetAmount(baseBet, multiplier, 'win');
          straight.push({
            betType: 'WIN',
            selections: formatSelections([top4[0]], horseNames),
            amount: winAmount,
          });
          straightTotal += winAmount;
        }
      } else if (ticketData.template === 'B') {
        // Template B: Vulnerable favorite - place only on favorite
        if (top4[0] !== undefined) {
          const placeAmount = calculateBetAmount(baseBet, multiplier * 0.5, 'place');
          straight.push({
            betType: 'PLACE',
            selections: formatSelections([top4[0]], horseNames),
            amount: placeAmount,
          });
          straightTotal += placeAmount;
        }

        // WIN bet on value horse (second pick)
        if (top4[1] !== undefined) {
          const winAmount = calculateBetAmount(baseBet, multiplier, 'win');
          straight.push({
            betType: 'WIN',
            selections: formatSelections([top4[1]], horseNames),
            amount: winAmount,
          });
          straightTotal += winAmount;
        }
      }

      // PLACE bet on second pick (if not already covered)
      if (ticketData.template !== 'B' && top4[1] !== undefined) {
        const placeAmount = calculateBetAmount(baseBet, multiplier, 'place');
        straight.push({
          betType: 'PLACE',
          selections: formatSelections([top4[1]], horseNames),
          amount: placeAmount,
        });
        straightTotal += placeAmount;
      }
    }

    // Build exotic bets from exacta/trifecta constructions
    if (ticketData.exacta && ticketData.template !== 'PASS') {
      const exactaWin = ticketData.exacta.winPosition || [];
      const exactaPlace = ticketData.exacta.placePosition || [];

      if (exactaWin.length > 0 && exactaPlace.length > 0) {
        const exactaUnit = ticketData.sizing?.suggestedExactaUnit || 2;
        const isBox = exactaWin.length === exactaPlace.length &&
                      exactaWin.every(h => exactaPlace.includes(h));

        if (isBox) {
          exotic.push({
            betType: 'EXACTA BOX',
            selections: formatSelections(exactaWin, horseNames),
            amount: ticketData.exacta.estimatedCost || exactaUnit * ticketData.exacta.combinations,
          });
        } else {
          exotic.push({
            betType: 'EXACTA',
            selections: `${formatSelections(exactaWin, horseNames)} / ${formatSelections(exactaPlace, horseNames)}`,
            amount: ticketData.exacta.estimatedCost || exactaUnit * ticketData.exacta.combinations,
          });
        }
        exoticTotal += ticketData.exacta.estimatedCost || 0;
      }
    }

    if (ticketData.trifecta && ticketData.template !== 'PASS') {
      const triWin = ticketData.trifecta.winPosition || [];
      const triPlace = ticketData.trifecta.placePosition || [];
      const triShow = ticketData.trifecta.showPosition || [];

      if (triWin.length > 0 && triPlace.length > 0 && triShow.length > 0) {
        const trifectaUnit = ticketData.sizing?.suggestedTrifectaUnit || 1;
        const allSame = triWin.length === triPlace.length &&
                        triPlace.length === triShow.length &&
                        triWin.every(h => triPlace.includes(h) && triShow.includes(h));

        if (allSame) {
          exotic.push({
            betType: 'TRIFECTA BOX',
            selections: formatSelections(triWin, horseNames),
            amount: ticketData.trifecta.estimatedCost || trifectaUnit * ticketData.trifecta.combinations,
          });
        } else {
          exotic.push({
            betType: 'TRIFECTA KEY',
            selections: `${formatSelections(triWin, horseNames)} / ${formatSelections(triPlace, horseNames)} / ${formatSelections(triShow, horseNames)}`,
            amount: ticketData.trifecta.estimatedCost || trifectaUnit * ticketData.trifecta.combinations,
          });
        }
        exoticTotal += ticketData.trifecta.estimatedCost || 0;
      }
    }

    return {
      straightBets: straight,
      exoticBets: exotic,
      totalStraight: straightTotal,
      totalExotic: exoticTotal,
    };
  }, [ticketData, baseBet, horseNames]);

  // Calculate total investment
  const totalInvestment = useMemo(() => {
    if (ticketData?.sizing?.totalInvestment) {
      return ticketData.sizing.totalInvestment;
    }
    return totalStraight + totalExotic;
  }, [ticketData, totalStraight, totalExotic]);

  // Copy ticket to clipboard
  const handleCopyToClipboard = useCallback(() => {
    if (!ticketData) return;

    const lines: string[] = [];
    lines.push(`=== RACE ${raceNumber} TICKET ===`);
    lines.push(`${trackCode} · R${raceNumber}${distance ? ` · ${distance}` : ''}${surface ? ` ${surface}` : ''}`);
    lines.push('');

    if (straightBets.length > 0) {
      lines.push('STRAIGHT BETS:');
      straightBets.forEach((bet) => {
        lines.push(`  ${bet.betType}: ${bet.selections} - $${bet.amount.toFixed(2)}`);
      });
      lines.push(`  Subtotal: $${totalStraight.toFixed(2)}`);
      lines.push('');
    }

    if (exoticBets.length > 0) {
      lines.push('EXOTIC BETS:');
      exoticBets.forEach((bet) => {
        lines.push(`  ${bet.betType}: ${bet.selections} - $${bet.amount.toFixed(2)}`);
      });
      lines.push(`  Subtotal: $${totalExotic.toFixed(2)}`);
      lines.push('');
    }

    lines.push('---');
    lines.push(`TOTAL INVESTMENT: $${totalInvestment.toFixed(2)}`);
    lines.push(`Template: ${ticketData.template} | Confidence: ${ticketData.confidenceScore}%`);
    lines.push(`Verdict: ${ticketData.verdict?.action || 'N/A'}`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [ticketData, raceNumber, trackCode, distance, surface, straightBets, exoticBets, totalStraight, totalExotic, totalInvestment]);

  // Drawer title
  const drawerTitle = `Race ${raceNumber} Ticket`;

  // Empty state when no ticket data
  if (!ticketData) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={drawerTitle} width="md">
        <div style={emptyStateStyles}>
          <span className="material-icons" style={emptyIconStyles}>
            receipt_long
          </span>
          <div style={emptyTextStyles}>No ticket data available</div>
          <div style={emptySubtextStyles}>
            AI analysis is required to generate a ticket
          </div>
        </div>
      </Drawer>
    );
  }

  // Pass verdict - show minimal ticket
  if (ticketData.template === 'PASS') {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={drawerTitle} width="md">
        {/* Header Info */}
        <div style={headerInfoStyles}>
          <span className="material-icons" style={headerInfoIconStyles}>
            location_on
          </span>
          <span style={headerInfoTextStyles}>
            {trackCode} · R{raceNumber}
            {distance ? ` · ${distance}` : ''}
            {surface ? ` ${surface}` : ''}
          </span>
        </div>

        {/* Pass State */}
        <div style={emptyStateStyles}>
          <span className="material-icons" style={{ ...emptyIconStyles, color: 'var(--status-warning)' }}>
            do_not_disturb
          </span>
          <div style={emptyTextStyles}>PASS RECOMMENDED</div>
          <div style={emptySubtextStyles}>
            {ticketData.verdict?.summary || 'No value identified in this race'}
          </div>
        </div>

        {/* Summary */}
        <TicketSummary
          totalInvestment={0}
          templateUsed="PASS"
          verdict="PASS"
          confidence={ticketData.confidenceScore || 0}
        />
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={drawerTitle} width="md">
      {/* Header Info */}
      <div style={headerInfoStyles}>
        <span className="material-icons" style={headerInfoIconStyles}>
          location_on
        </span>
        <span style={headerInfoTextStyles}>
          {trackCode} · R{raceNumber}
          {distance ? ` · ${distance}` : ''}
          {surface ? ` ${surface}` : ''}
        </span>
      </div>

      {/* Straight Bets Section */}
      {straightBets.length > 0 && (
        <TicketSection
          title="Straight Bets"
          lines={straightBets}
          subtotal={totalStraight}
        />
      )}

      {/* Exotic Bets Section */}
      {exoticBets.length > 0 && (
        <TicketSection
          title="Exotic Bets"
          lines={exoticBets}
          subtotal={totalExotic}
        />
      )}

      {/* Divider */}
      <div style={dividerStyles} />

      {/* Summary */}
      <TicketSummary
        totalInvestment={totalInvestment}
        templateUsed={ticketData.template}
        verdict={mapVerdict(ticketData.verdict?.action || 'PASS')}
        confidence={ticketData.confidenceScore || 0}
      />

      {/* Copy to Clipboard Button */}
      <div style={copyButtonContainerStyles}>
        <button
          style={isHovered ? copyButtonHoverStyles : copyButtonStyles}
          onClick={handleCopyToClipboard}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>
            content_copy
          </span>
          Copy to Clipboard
        </button>

        {copied && (
          <div style={copiedMessageStyles}>
            <span className="material-icons" style={{ fontSize: '16px' }}>
              check_circle
            </span>
            Copied to clipboard!
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default TicketDrawer;
