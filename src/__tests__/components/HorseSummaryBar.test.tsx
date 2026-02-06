/**
 * HorseSummaryBar Component Tests
 *
 * Tests score display, value tag rendering, scratched state,
 * and odds editing interaction.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HorseSummaryBar } from '../../components/HorseSummaryBar';
import type { HorseEntry } from '../../types/drf';

// ============================================================================
// MOCK SETUP
// ============================================================================

vi.mock('../../components/HorseSummaryBar.css', () => ({}));

vi.mock('../../lib/utils/oddsStepper', () => ({
  normalizeOddsFormat: (s: string) => s.replace(/[/:]/g, '-'),
}));

vi.mock('../../lib/value/valueTagMatrix', () => ({
  getValueTag: (rank: number, fieldSize: number, edgePercent: number) => {
    let plainLabel = 'Fair Price';
    let techLabel = 'FAIR ODDS';
    if (rank <= Math.ceil(fieldSize * 0.2) && edgePercent > 10) {
      plainLabel = 'Best Bet';
      techLabel = 'TOP OVERLAY';
    } else if (edgePercent < -20) {
      plainLabel = 'Overbet';
      techLabel = 'UNDERLAY';
    }
    return {
      tag: { plainLabel, techLabel, action: 'WATCH' },
      tier: 'MID',
      edgeBucket: 'NEUTRAL',
      valueScore: 50,
      color: 'transparent',
      textColor: '#ffffff',
    };
  },
  getScratchedValueTag: () => ({
    tag: { plainLabel: '', techLabel: '', action: 'SCRATCHED' },
    tier: 'BOTTOM',
    edgeBucket: 'SCRATCHED',
    valueScore: 0,
    color: 'transparent',
    textColor: '#ffffff',
  }),
}));

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockHorse(overrides: Partial<HorseEntry> = {}): HorseEntry {
  return {
    programNumber: 3,
    horseName: 'Lightning Bolt',
    morningLineOdds: '4-1',
    postPosition: 3,
    weight: 120,
    jockey: 'Smith J',
    trainer: 'Jones B',
    owner: 'Stable LLC',
    sex: 'G',
    age: 5,
    lifetimeStarts: 20,
    lifetimeWins: 5,
    lifetimeSeconds: 4,
    lifetimeThirds: 3,
    lifetimeEarnings: 200000,
    lastRaceDistance: '6f',
    lastRaceTrack: 'SAR',
    pastPerformances: [],
    ...overrides,
  } as HorseEntry;
}

const defaultProps = {
  rank: 1,
  isExpanded: false,
  onToggleExpand: vi.fn(),
  maxScore: 336,
  score: 250,
  fairOddsDisplay: '3-1',
  valuePercent: 15,
  isScratched: false,
  onScratchToggle: vi.fn(),
  currentOdds: { numerator: 4, denominator: 1 },
  onOddsChange: vi.fn(),
  baseScoreRank: 2,
  fieldSize: 10,
  edgePercent: 12,
};

// ============================================================================
// TESTS
// ============================================================================

describe('HorseSummaryBar', () => {
  describe('Basic Rendering', () => {
    it('renders horse name in uppercase', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} />);
      expect(screen.getByText('LIGHTNING BOLT')).toBeInTheDocument();
    });

    it('renders program number with # prefix', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} />);
      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('renders current odds display', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} />);
      expect(screen.getByText('4-1')).toBeInTheDocument();
    });

    it('renders fair odds display', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} />);
      expect(screen.getByText('3-1')).toBeInTheDocument();
    });

    it('renders projected finish rank', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} baseScoreRank={2} />);
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });

  describe('Value Tag Display', () => {
    it('renders value tag with plain and tech labels for high-value horse', () => {
      render(
        <HorseSummaryBar
          horse={createMockHorse()}
          {...defaultProps}
          baseScoreRank={1}
          fieldSize={10}
          edgePercent={15}
        />
      );

      expect(screen.getByText('Best Bet')).toBeInTheDocument();
      expect(screen.getByText('TOP OVERLAY')).toBeInTheDocument();
    });

    it('renders fair price tag for neutral value', () => {
      render(
        <HorseSummaryBar
          horse={createMockHorse()}
          {...defaultProps}
          baseScoreRank={5}
          fieldSize={10}
          edgePercent={0}
        />
      );

      expect(screen.getByText('Fair Price')).toBeInTheDocument();
      expect(screen.getByText('FAIR ODDS')).toBeInTheDocument();
    });

    it('does not render value tag labels when scratched', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={true} />);

      // Scratched value tag has empty labels
      expect(screen.queryByText('Best Bet')).not.toBeInTheDocument();
      expect(screen.queryByText('Fair Price')).not.toBeInTheDocument();
    });
  });

  describe('Edge Display', () => {
    it('shows formatted edge percentage', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} edgePercent={25} />);

      expect(screen.getByText('+25%')).toBeInTheDocument();
    });

    it('shows negative edge percentage', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} edgePercent={-15} />);

      expect(screen.getByText('-15%')).toBeInTheDocument();
    });

    it('shows neutral edge for small values', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} edgePercent={3} />);

      expect(screen.getByText('±5%')).toBeInTheDocument();
    });

    it('shows dash for edge when scratched', () => {
      const { container } = render(
        <HorseSummaryBar
          horse={createMockHorse()}
          {...defaultProps}
          isScratched={true}
          edgePercent={25}
        />
      );

      const edgeEl = container.querySelector('.horse-summary-bar__edge-value');
      expect(edgeEl?.textContent).toBe('—');
    });
  });

  describe('Scratched State', () => {
    it('applies scratched CSS class', () => {
      const { container } = render(
        <HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={true} />
      );

      const bar = container.querySelector('.horse-summary-bar');
      expect(bar?.classList.contains('horse-summary-bar--scratched')).toBe(true);
    });

    it('shows undo button when scratched', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={true} />);

      expect(screen.getByText('UNDO')).toBeInTheDocument();
    });

    it('shows SCR button when not scratched', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={false} />);

      expect(screen.getByText('SCR')).toBeInTheDocument();
    });

    it('calls onScratchToggle when scratch button clicked', () => {
      const onScratchToggle = vi.fn();
      render(
        <HorseSummaryBar
          horse={createMockHorse()}
          {...defaultProps}
          onScratchToggle={onScratchToggle}
          isScratched={false}
        />
      );

      fireEvent.click(screen.getByLabelText('Scratch horse from race'));
      expect(onScratchToggle).toHaveBeenCalledWith(true);
    });

    it('shows dash for projected finish when scratched', () => {
      const { container } = render(
        <HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={true} />
      );

      const rankEl = container.querySelector('.horse-summary-bar__rank-value');
      expect(rankEl?.textContent).toBe('—');
    });

    it('shows dash for fair odds when scratched', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={true} />);

      const fairOddsEl = screen.getByText('—', {
        selector: '.horse-summary-bar__fair-odds-value',
      });
      expect(fairOddsEl).toBeInTheDocument();
    });
  });

  describe('Row Interaction', () => {
    it('calls onToggleExpand when row is clicked', () => {
      const onToggleExpand = vi.fn();
      const { container } = render(
        <HorseSummaryBar
          horse={createMockHorse()}
          {...defaultProps}
          onToggleExpand={onToggleExpand}
        />
      );

      fireEvent.click(container.querySelector('.horse-summary-bar')!);
      expect(onToggleExpand).toHaveBeenCalled();
    });

    it('does not call onToggleExpand when scratched row is clicked', () => {
      const onToggleExpand = vi.fn();
      const { container } = render(
        <HorseSummaryBar
          horse={createMockHorse()}
          {...defaultProps}
          onToggleExpand={onToggleExpand}
          isScratched={true}
        />
      );

      fireEvent.click(container.querySelector('.horse-summary-bar')!);
      expect(onToggleExpand).not.toHaveBeenCalled();
    });

    it('applies expanded class when isExpanded is true', () => {
      const { container } = render(
        <HorseSummaryBar horse={createMockHorse()} {...defaultProps} isExpanded={true} />
      );

      const bar = container.querySelector('.horse-summary-bar');
      expect(bar?.classList.contains('horse-summary-bar--expanded')).toBe(true);
    });
  });

  describe('Odds Editing', () => {
    it('shows edit hint on odds display', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('switches to edit mode when odds are clicked', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} />);

      fireEvent.click(screen.getByTitle('Click to edit odds'));
      expect(screen.getByLabelText('Enter odds')).toBeInTheDocument();
    });

    it('does not allow odds editing when scratched', () => {
      render(<HorseSummaryBar horse={createMockHorse()} {...defaultProps} isScratched={true} />);

      const oddsBtn = screen.getByLabelText(/Current odds/);
      expect(oddsBtn).toBeDisabled();
    });
  });

  describe('Value Play Highlighting', () => {
    it('applies value-play class when isValuePlay is true', () => {
      const { container } = render(
        <HorseSummaryBar horse={createMockHorse()} {...defaultProps} isValuePlay={true} />
      );

      const bar = container.querySelector('.horse-summary-bar');
      expect(bar?.classList.contains('horse-summary-bar--value-play')).toBe(true);
    });

    it('applies primary-value-play class when isPrimaryValuePlay is true', () => {
      const { container } = render(
        <HorseSummaryBar horse={createMockHorse()} {...defaultProps} isPrimaryValuePlay={true} />
      );

      const bar = container.querySelector('.horse-summary-bar');
      expect(bar?.classList.contains('horse-summary-bar--primary-value-play')).toBe(true);
    });
  });
});
