/**
 * ScoringHelpModal Component Tests
 *
 * Tests that all category names, max values, and scoring constants
 * are accurately displayed in the help modal.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoringHelpModal } from '../../components/ScoringHelpModal';
import { SCORE_LIMITS, MAX_BASE_SCORE, MAX_OVERLAY, MAX_SCORE } from '../../lib/scoring';

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

// ============================================================================
// TESTS
// ============================================================================

describe('ScoringHelpModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  describe('Modal Visibility', () => {
    it('renders content when isOpen is true', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText('How to Read the Form')).toBeInTheDocument();
    });

    it('renders nothing when isOpen is false', () => {
      const { container } = render(<ScoringHelpModal isOpen={false} onClose={vi.fn()} />);
      expect(container.innerHTML).toBe('');
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<ScoringHelpModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByLabelText('Close help'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when Got it button is clicked', () => {
      const onClose = vi.fn();
      render(<ScoringHelpModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByText('Got it'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Navigation Tabs', () => {
    it('renders all 6 navigation tabs', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Summary Row')).toBeInTheDocument();
      expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Horse Profile')).toBeInTheDocument();
      expect(screen.getByText('Past Performances')).toBeInTheDocument();
      expect(screen.getByText('Glossary')).toBeInTheDocument();
    });

    it('shows Overview content by default', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText('Welcome to Furlong')).toBeInTheDocument();
    });
  });

  describe('Score Constants in Summary Row Tab', () => {
    it('displays MAX_BASE_SCORE (336) in SCORE description', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(MAX_BASE_SCORE).toBe(336);
      // Navigate to Summary Row tab
      fireEvent.click(screen.getByText('Summary Row'));
      expect(screen.getByText(/336 base points/)).toBeInTheDocument();
    });

    it('displays MAX_SCORE (376) in SCORE description', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(MAX_SCORE).toBe(376);
      fireEvent.click(screen.getByText('Summary Row'));
      expect(screen.getByText(/376 with overlay/)).toBeInTheDocument();
    });
  });

  describe('Score Breakdown Tab - Category Names and Max Values', () => {
    function renderAndNavigateToBreakdown() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Score Breakdown'));
    }

    it('displays overlay range in section description', () => {
      renderAndNavigateToBreakdown();
      expect(MAX_OVERLAY).toBe(40);
      expect(screen.getByText(new RegExp(`±${SCORE_LIMITS.overlayMax}`))).toBeInTheDocument();
    });

    it('displays Connections category with correct max', () => {
      renderAndNavigateToBreakdown();
      expect(screen.getByText('Connections')).toBeInTheDocument();
      expect(screen.getByText(`${SCORE_LIMITS.connections} pts max`)).toBeInTheDocument();
    });

    it('displays Post Position category with correct max', () => {
      renderAndNavigateToBreakdown();
      expect(screen.getByText('Post Position')).toBeInTheDocument();
      expect(screen.getByText(`${SCORE_LIMITS.postPosition} pts max`)).toBeInTheDocument();
    });

    it('displays Speed / Class category with correct max', () => {
      renderAndNavigateToBreakdown();
      expect(screen.getByText('Speed / Class')).toBeInTheDocument();
      expect(screen.getByText(`${SCORE_LIMITS.speedClass} pts max`)).toBeInTheDocument();
    });

    it('displays Form category with correct max', () => {
      renderAndNavigateToBreakdown();
      expect(screen.getByText('Form')).toBeInTheDocument();
      expect(screen.getByText(`${SCORE_LIMITS.form} pts max`)).toBeInTheDocument();
    });

    it('displays Equipment category with correct max', () => {
      renderAndNavigateToBreakdown();
      expect(screen.getByText('Equipment')).toBeInTheDocument();
      expect(screen.getByText(`${SCORE_LIMITS.equipment} pts max`)).toBeInTheDocument();
    });

    it('displays Pace category with correct max', () => {
      renderAndNavigateToBreakdown();
      expect(screen.getByText('Pace')).toBeInTheDocument();
      expect(screen.getByText(`${SCORE_LIMITS.pace} pts max`)).toBeInTheDocument();
    });
  });

  describe('Score Total Verification (pure logic)', () => {
    it('individual category max values sum to MAX_BASE_SCORE (336)', () => {
      const sumOfCategories =
        SCORE_LIMITS.connections +
        SCORE_LIMITS.postPosition +
        SCORE_LIMITS.speedClass +
        SCORE_LIMITS.form +
        SCORE_LIMITS.equipment +
        SCORE_LIMITS.pace +
        SCORE_LIMITS.distanceSurface +
        SCORE_LIMITS.trainerPatterns +
        SCORE_LIMITS.comboPatterns +
        SCORE_LIMITS.trackSpecialist +
        SCORE_LIMITS.trainerSurfaceDistance +
        SCORE_LIMITS.weight +
        SCORE_LIMITS.ageFactor +
        SCORE_LIMITS.siresSire;

      expect(sumOfCategories).toBe(MAX_BASE_SCORE);
    });

    it('MAX_SCORE equals MAX_BASE_SCORE + MAX_OVERLAY', () => {
      expect(MAX_SCORE).toBe(MAX_BASE_SCORE + MAX_OVERLAY);
    });

    it('MAX_BASE_SCORE is 336', () => {
      expect(MAX_BASE_SCORE).toBe(336);
    });

    it('MAX_OVERLAY is 40', () => {
      expect(MAX_OVERLAY).toBe(40);
    });

    it('MAX_SCORE is 376', () => {
      expect(MAX_SCORE).toBe(376);
    });
  });

  describe('Overview Section Content', () => {
    it('shows learning guide content', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText("What You'll Learn")).toBeInTheDocument();
      expect(screen.getByText('How to read the summary row for each horse')).toBeInTheDocument();
      expect(screen.getByText('What each scoring category measures')).toBeInTheDocument();
    });

    it('shows OVERLAY tip', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText(/OVERLAY/)).toBeInTheDocument();
    });
  });

  describe('Summary Row Tab Content', () => {
    it('shows all column explanations', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Summary Row'));

      expect(screen.getByText('PP (Post Position)')).toBeInTheDocument();
      expect(screen.getByText('HORSE')).toBeInTheDocument();
      expect(screen.getByText('ODDS')).toBeInTheDocument();
      expect(screen.getByText('SCORE')).toBeInTheDocument();
      expect(screen.getByText('EDGE %')).toBeInTheDocument();
      expect(screen.getByText('ODDS EDGE')).toBeInTheDocument();
    });
  });
});
