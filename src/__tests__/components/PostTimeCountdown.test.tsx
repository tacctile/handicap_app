/**
 * PostTimeCountdown Component Tests
 *
 * Tests countdown display, critical pulsing state,
 * compact vs full variants, and expired state.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PostTimeCountdown,
  PostTimeProgressBar,
  TopBarCountdown,
  RaceCardCountdown,
} from '../../components/PostTimeCountdown';
import type { CountdownState } from '../../hooks/usePostTime';

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
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...filterMotionProps(props)}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...filterMotionProps(props)}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...filterMotionProps(props)}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  memo: (fn: any) => fn,
}));

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCountdownState(overrides: Partial<CountdownState> = {}): CountdownState {
  return {
    totalMs: 600000, // 10 minutes
    hours: 0,
    minutes: 10,
    seconds: 0,
    formatted: '10:00',
    shortFormatted: '10m',
    isExpired: false,
    isCritical: false,
    isWarning: false,
    isImminent: false,
    progress: 50,
    colorClass: 'normal',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('PostTimeCountdown', () => {
  describe('Invalid State', () => {
    it('renders --:-- when isValid is false', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState()}
          postTimeFormatted="2:30 PM"
          isValid={false}
        />
      );

      expect(screen.getByText('--:--')).toBeInTheDocument();
    });

    it('renders inactive class when isValid is false', () => {
      const { container } = render(
        <PostTimeCountdown
          countdown={createCountdownState()}
          postTimeFormatted="2:30 PM"
          isValid={false}
        />
      );

      expect(container.querySelector('.inactive')).toBeInTheDocument();
    });
  });

  describe('Compact Variant (default)', () => {
    it('renders short formatted time', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState({ shortFormatted: '10m' })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    it('renders "Post in" label', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState()}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(screen.getByText('Post in')).toBeInTheDocument();
    });

    it('renders race number when provided', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState()}
          postTimeFormatted="2:30 PM"
          isValid={true}
          raceNumber={5}
        />
      );

      expect(screen.getByText('Race 5')).toBeInTheDocument();
    });
  });

  describe('Full Variant', () => {
    it('renders post time and countdown', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState({ formatted: '10:00' })}
          postTimeFormatted="2:30 PM"
          isValid={true}
          variant="full"
        />
      );

      expect(screen.getByText('Post Time:')).toBeInTheDocument();
      expect(screen.getByText('2:30 PM')).toBeInTheDocument();
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });
  });

  describe('Critical State (pulsing)', () => {
    it('applies pulsing class when isCritical and not expired', () => {
      const { container } = render(
        <PostTimeCountdown
          countdown={createCountdownState({
            isCritical: true,
            isExpired: false,
            colorClass: 'critical',
          })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(container.querySelector('.pulsing')).toBeInTheDocument();
    });

    it('does not apply pulsing class when expired', () => {
      const { container } = render(
        <PostTimeCountdown
          countdown={createCountdownState({
            isCritical: true,
            isExpired: true,
            colorClass: 'expired',
          })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(container.querySelector('.pulsing')).not.toBeInTheDocument();
    });

    it('does not apply pulsing class in normal state', () => {
      const { container } = render(
        <PostTimeCountdown
          countdown={createCountdownState({
            isCritical: false,
            isExpired: false,
            colorClass: 'normal',
          })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(container.querySelector('.pulsing')).not.toBeInTheDocument();
    });
  });

  describe('Expired State', () => {
    it('renders sports_score icon when expired', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState({
            isExpired: true,
            colorClass: 'expired',
          })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(screen.getByText('sports_score')).toBeInTheDocument();
    });

    it('renders timer icon when not expired', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState({
            isExpired: false,
          })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(screen.getByText('timer')).toBeInTheDocument();
    });
  });

  describe('Color Class', () => {
    it('applies color class from countdown state', () => {
      const { container } = render(
        <PostTimeCountdown
          countdown={createCountdownState({ colorClass: 'warning' })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(container.querySelector('.warning')).toBeInTheDocument();
    });

    it('applies critical color class', () => {
      const { container } = render(
        <PostTimeCountdown
          countdown={createCountdownState({ colorClass: 'critical' })}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(container.querySelector('.critical')).toBeInTheDocument();
    });
  });

  describe('Click Interaction', () => {
    it('applies button role when onClick is provided', () => {
      const onClick = vi.fn();
      render(
        <PostTimeCountdown
          countdown={createCountdownState()}
          postTimeFormatted="2:30 PM"
          isValid={true}
          onClick={onClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('does not apply button role when no onClick', () => {
      render(
        <PostTimeCountdown
          countdown={createCountdownState()}
          postTimeFormatted="2:30 PM"
          isValid={true}
        />
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

describe('PostTimeProgressBar', () => {
  it('renders progress percentage in label when showLabel is true', () => {
    render(<PostTimeProgressBar progress={75} colorClass="warning" showLabel={true} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('does not render label when showLabel is false', () => {
    render(<PostTimeProgressBar progress={75} colorClass="warning" showLabel={false} />);

    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('applies correct color class', () => {
    const { container } = render(<PostTimeProgressBar progress={50} colorClass="critical" />);

    expect(container.querySelector('.critical')).toBeInTheDocument();
  });
});

describe('TopBarCountdown', () => {
  it('renders null when isValid is false', () => {
    const { container } = render(
      <TopBarCountdown countdown={createCountdownState()} isValid={false} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders countdown when valid', () => {
    render(
      <TopBarCountdown countdown={createCountdownState({ shortFormatted: '5m' })} isValid={true} />
    );

    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('Post in')).toBeInTheDocument();
  });

  it('renders race number when provided', () => {
    render(<TopBarCountdown countdown={createCountdownState()} raceNumber={3} isValid={true} />);

    expect(screen.getByText('Race 3')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(
      <TopBarCountdown countdown={createCountdownState({ formatted: '5:30' })} isValid={true} />
    );

    expect(screen.getByLabelText('Post time countdown: 5:30')).toBeInTheDocument();
  });
});

describe('RaceCardCountdown', () => {
  it('renders inactive state when isValid is false', () => {
    const { container } = render(
      <RaceCardCountdown
        countdown={createCountdownState()}
        postTimeFormatted="2:30 PM"
        isValid={false}
      />
    );

    expect(container.querySelector('.inactive')).toBeInTheDocument();
    expect(screen.getByText('--:--')).toBeInTheDocument();
  });

  it('renders post time and countdown when valid', () => {
    render(
      <RaceCardCountdown
        countdown={createCountdownState({ formatted: '8:30' })}
        postTimeFormatted="3:00 PM"
        isValid={true}
      />
    );

    expect(screen.getByText('3:00 PM')).toBeInTheDocument();
    expect(screen.getByText('8:30')).toBeInTheDocument();
  });

  it('shows betting closes warning when imminent', () => {
    render(
      <RaceCardCountdown
        countdown={createCountdownState({
          isImminent: true,
          isExpired: false,
          colorClass: 'imminent',
        })}
        postTimeFormatted="2:30 PM"
        isValid={true}
      />
    );

    expect(screen.getByText('Betting closes soon!')).toBeInTheDocument();
  });

  it('does not show warning when expired', () => {
    render(
      <RaceCardCountdown
        countdown={createCountdownState({
          isImminent: true,
          isExpired: true,
          colorClass: 'expired',
        })}
        postTimeFormatted="2:30 PM"
        isValid={true}
      />
    );

    expect(screen.queryByText('Betting closes soon!')).not.toBeInTheDocument();
  });
});
