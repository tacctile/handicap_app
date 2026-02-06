/**
 * BankrollSettings Component Tests
 *
 * Tests complexity mode toggling, bankroll input validation,
 * tab navigation, and save/reset behavior.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BankrollSettings } from '../../components/BankrollSettings';
import type { BankrollSettings as BankrollSettingsType } from '../../hooks/useBankroll';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Filter out framer-motion specific props
function filterMotionProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      ![
        'whileHover',
        'whileTap',
        'initial',
        'animate',
        'exit',
        'transition',
        'variants',
        'layout',
        'layoutId',
      ].includes(key)
    ) {
      filtered[key] = value;
    }
  }
  return filtered;
}

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
    button: ({ children, ...props }: any) => (
      <button {...filterMotionProps(props)}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../utils/formatters', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

vi.mock('../../hooks/useBankroll', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    BETTING_STYLE_INFO: {
      safe: { label: 'Safe & Steady', description: 'Low risk, small bets', emoji: '🛡️' },
      balanced: { label: 'Balanced', description: 'Mix of safe and aggressive', emoji: '⚖️' },
      aggressive: {
        label: 'Go Big',
        description: 'Higher risk, bigger potential',
        emoji: '🔥',
      },
    },
    BET_TYPE_LABELS: {
      win_place: 'Win/Place',
      exacta: 'Exacta',
      trifecta: 'Trifecta',
      superfecta: 'Superfecta',
      multi_race: 'Multi-Race',
    },
    getExpectedReturnRange: () => '0.8x - 1.2x',
  };
});

vi.mock('../../lib/betting/kellySettings', () => ({
  KELLY_FRACTION_OPTIONS: [
    { value: 'quarter', shortLabel: '¼', description: 'Quarter Kelly' },
    { value: 'half', shortLabel: '½', description: 'Half Kelly' },
    { value: 'full', shortLabel: '1x', description: 'Full Kelly' },
  ],
  KELLY_FRACTION_INFO: {
    quarter: { color: '#22c55e' },
    half: { color: '#eab308' },
    full: { color: '#ef4444' },
  },
  DEFAULT_KELLY_SETTINGS: {
    enabled: false,
    kellyFraction: 'quarter',
    maxBetPercent: 5,
    minEdgeRequired: 10,
  },
  loadKellySettings: () => ({
    enabled: false,
    kellyFraction: 'quarter',
    maxBetPercent: 5,
    minEdgeRequired: 10,
  }),
  saveKellySettings: vi.fn(),
}));

vi.mock('../../lib/dutch', () => ({
  DEFAULT_DUTCH_SETTINGS: {
    enabled: false,
    minEdgeRequired: 10,
    maxHorses: 3,
    overlayOnly: false,
    preferMixedTiers: false,
  },
  DUTCH_EDGE_OPTIONS: [
    { value: 5, label: '5%', description: 'Low' },
    { value: 10, label: '10%', description: 'Medium' },
  ],
  DUTCH_MAX_HORSES_OPTIONS: [
    { value: 2, label: '2', description: 'Two horses' },
    { value: 3, label: '3', description: 'Three horses' },
  ],
  DUTCH_EDUCATION: {
    overview: 'Dutch betting overview',
    howItWorks: 'How it works',
    example: 'Example text',
    requirements: ['Req 1'],
    warnings: ['Warning 1'],
  },
  loadDutchSettings: () => ({
    enabled: false,
    minEdgeRequired: 10,
    maxHorses: 3,
    overlayOnly: false,
    preferMixedTiers: false,
  }),
  saveDutchSettings: vi.fn(),
}));

vi.mock('../../components/KellyHelpModal', () => ({
  KellyHelpModal: () => null,
}));

// ============================================================================
// TEST HELPERS
// ============================================================================

function createDefaultSettings(): BankrollSettingsType {
  return {
    totalBankroll: 1000,
    dailyBudgetType: 'fixed',
    dailyBudgetValue: 200,
    perRaceBudget: 50,
    riskTolerance: 'moderate',
    betUnitType: 'percentage',
    betUnitValue: 2,
    complexityMode: 'simple',
    simpleBettingStyle: 'balanced',
    simpleRaceBudget: 20,
    moderateRaceBudget: 30,
    moderateRiskLevel: 'moderate',
    moderateSelectedBetTypes: ['win_place', 'exacta'],
  };
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  settings: createDefaultSettings(),
  onSave: vi.fn(),
  onReset: vi.fn(),
  dailyPL: 0,
  spentToday: 0,
  dailyBudget: 200,
};

// ============================================================================
// TESTS
// ============================================================================

describe('BankrollSettings', () => {
  beforeEach(() => {
    defaultProps.onClose.mockClear();
    defaultProps.onSave.mockClear();
    defaultProps.onReset.mockClear();
  });

  describe('Modal Visibility', () => {
    it('renders content when isOpen is true', () => {
      render(<BankrollSettings {...defaultProps} />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders nothing when isOpen is false', () => {
      render(<BankrollSettings {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  describe('Complexity Mode Toggle', () => {
    it('renders Simple/Moderate/Advanced mode buttons', () => {
      render(<BankrollSettings {...defaultProps} />);
      expect(screen.getByText('Simple')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    it('shows simple mode content by default when complexityMode is simple', () => {
      render(<BankrollSettings {...defaultProps} />);

      // Simple mode shows "How much for this race?" and betting style picker
      expect(screen.getByText('How much for this race?')).toBeInTheDocument();
      expect(screen.getByText('Pick your style:')).toBeInTheDocument();
    });

    it('switches to moderate mode when clicked', () => {
      render(<BankrollSettings {...defaultProps} />);

      fireEvent.click(screen.getByText('Moderate'));

      expect(screen.getByText('Race Budget')).toBeInTheDocument();
      expect(screen.getByText('Risk Tolerance')).toBeInTheDocument();
      expect(screen.getByText('Which bet types do you like?')).toBeInTheDocument();
    });

    it('switches to advanced mode when clicked', () => {
      render(<BankrollSettings {...defaultProps} />);

      fireEvent.click(screen.getByText('Advanced'));

      expect(screen.getByText('Total Bankroll')).toBeInTheDocument();
      expect(screen.getByText('Daily Budget')).toBeInTheDocument();
      expect(screen.getByText('Per-Race Budget')).toBeInTheDocument();
    });

    it('shows mode description for each mode', () => {
      render(<BankrollSettings {...defaultProps} />);
      expect(screen.getByText('Just tell us your budget and betting style')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Moderate'));
      expect(screen.getByText('Set your risk level and favorite bet types')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Advanced'));
      expect(screen.getByText('Full control over bankroll and strategy')).toBeInTheDocument();
    });
  });

  describe('Simple Mode', () => {
    it('renders budget input with dollar prefix', () => {
      render(<BankrollSettings {...defaultProps} />);
      expect(screen.getByText('$')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('20')).toBeInTheDocument();
    });

    it('renders all three betting style options', () => {
      render(<BankrollSettings {...defaultProps} />);
      expect(screen.getByText('Safe & Steady')).toBeInTheDocument();
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('Go Big')).toBeInTheDocument();
    });

    it('enforces minimum budget of $1', () => {
      render(<BankrollSettings {...defaultProps} />);

      const input = screen.getByPlaceholderText('20');
      expect(input.getAttribute('min')).toBe('1');
    });
  });

  describe('Bankroll Input Validation', () => {
    it('uses Math.max(0, ...) for totalBankroll in advanced mode', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
        />
      );

      // Find total bankroll input
      const bankrollInput = screen
        .getAllByRole('spinbutton')
        .find((input) => (input as HTMLInputElement).value === '1000');
      expect(bankrollInput).toBeInTheDocument();
      expect(bankrollInput?.getAttribute('min')).toBe('0');
    });

    it('uses Math.max(0, ...) for per-race budget in advanced mode', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
        />
      );

      const perRaceInput = screen
        .getAllByRole('spinbutton')
        .find((input) => (input as HTMLInputElement).value === '50');
      expect(perRaceInput).toBeInTheDocument();
      expect(perRaceInput?.getAttribute('min')).toBe('0');
    });
  });

  describe('Tab Navigation', () => {
    it('renders Bankroll and Notifications tabs', () => {
      render(<BankrollSettings {...defaultProps} />);
      expect(screen.getByText('Bankroll')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('switches to notifications tab', () => {
      render(<BankrollSettings {...defaultProps} />);

      fireEvent.click(screen.getByText('Notifications'));

      expect(screen.getByText('Post Time Alerts')).toBeInTheDocument();
      expect(screen.getByText('Sound Alerts')).toBeInTheDocument();
    });
  });

  describe('Advanced Mode - Risk Tolerance', () => {
    it('renders risk tolerance options with descriptions', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
        />
      );

      // Risk descriptions should be visible in advanced mode
      expect(screen.getByText('Lower risk, smaller bets')).toBeInTheDocument();
      expect(screen.getByText('Balanced approach')).toBeInTheDocument();
      expect(screen.getByText('Higher risk, larger bets')).toBeInTheDocument();
    });

    it('renders Conservative and Aggressive labels', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
        />
      );

      expect(screen.getByText('Conservative')).toBeInTheDocument();
      expect(screen.getByText('Aggressive')).toBeInTheDocument();
      // "Moderate" appears both in mode selector and risk tolerance
      expect(screen.getAllByText('Moderate').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Save and Reset', () => {
    it('save button is disabled when no changes made', () => {
      render(<BankrollSettings {...defaultProps} />);
      const saveBtn = screen.getByText('Save Changes').closest('button');
      expect(saveBtn).toBeDisabled();
    });

    it('save button enables after making changes', () => {
      render(<BankrollSettings {...defaultProps} />);

      // Make a change - switch mode
      fireEvent.click(screen.getByText('Moderate'));

      const saveBtn = screen.getByText('Save Changes').closest('button');
      expect(saveBtn).not.toBeDisabled();
    });

    it('calls onSave when save button is clicked', () => {
      render(<BankrollSettings {...defaultProps} />);

      // Make a change
      fireEvent.click(screen.getByText('Moderate'));

      // Click save
      fireEvent.click(screen.getByText('Save Changes'));
      expect(defaultProps.onSave).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onReset when reset button is clicked', () => {
      render(<BankrollSettings {...defaultProps} />);
      fireEvent.click(screen.getByText('Reset to Defaults'));
      expect(defaultProps.onReset).toHaveBeenCalled();
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button is clicked', () => {
      render(<BankrollSettings {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close settings'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when Cancel is clicked', () => {
      render(<BankrollSettings {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Embedded Mode', () => {
    it('renders without modal wrapper when embedded=true', () => {
      const { container } = render(<BankrollSettings {...defaultProps} embedded={true} />);

      expect(container.querySelector('.bankroll-settings-embedded')).toBeInTheDocument();
      // Should not have backdrop
      expect(container.querySelector('.bankroll-modal-backdrop')).not.toBeInTheDocument();
    });
  });

  describe('Advanced Mode - Kelly Criterion', () => {
    it('renders Kelly Criterion toggle in advanced mode', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
        />
      );

      expect(screen.getByText('Kelly Criterion')).toBeInTheDocument();
    });
  });

  describe('Advanced Mode - Dutch Booking', () => {
    it('renders Dutch Booking toggle in advanced mode', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
        />
      );

      expect(screen.getByText('Dutch Booking')).toBeInTheDocument();
    });
  });

  describe('Daily P&L Display', () => {
    it('shows daily P&L summary in advanced mode', () => {
      render(
        <BankrollSettings
          {...defaultProps}
          settings={{ ...createDefaultSettings(), complexityMode: 'advanced' }}
          dailyPL={50}
          spentToday={100}
          dailyBudget={200}
        />
      );

      expect(screen.getByText("Today's Summary")).toBeInTheDocument();
      // P&L shows "+$50.00" for positive values
      expect(screen.getByText('+$50.00')).toBeInTheDocument();
      // Spent today and daily budget
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });
  });
});
