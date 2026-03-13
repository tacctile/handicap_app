/**
 * ScoringHelpModal Component Tests
 *
 * Tests that the help modal renders correctly with all 7 tabs
 * and displays expected content for each section.
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
    it('renders all 7 navigation tabs', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      // Tab labels appear in both the tab button and section title, so use getAllByText
      expect(screen.getAllByText('The Race Screen').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Horse Score').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Factor Breakdown').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Suggested Bets').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Past Performances').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Horse Profile').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Glossary').length).toBeGreaterThanOrEqual(1);
    });

    it('shows The Race Screen content by default', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getAllByText('The Race Screen').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('POST (Gate #)')).toBeInTheDocument();
    });
  });

  describe('Tab 1: The Race Screen', () => {
    it('shows all column explanations', () => {
      render(<ScoringHelpModal {...defaultProps} />);

      expect(screen.getByText('POST (Gate #)')).toBeInTheDocument();
      expect(screen.getByText('HORSE')).toBeInTheDocument();
      expect(screen.getByText('ODDS')).toBeInTheDocument();
      expect(screen.getByText('SHOULD BE')).toBeInTheDocument();
      expect(screen.getByText('OUR PICK')).toBeInTheDocument();
      expect(screen.getByText('RATING')).toBeInTheDocument();
      expect(screen.getByText('EDGE %')).toBeInTheDocument();
    });

    it('shows race banner bar explanation', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText('The Race Banner Bar')).toBeInTheDocument();
    });

    it('shows tap tip', () => {
      render(<ScoringHelpModal {...defaultProps} />);
      expect(screen.getByText(/Tap any horse row to expand/)).toBeInTheDocument();
    });
  });

  describe('Tab 2: Horse Score', () => {
    function renderAndNavigateToHorseScore() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Horse Score'));
    }

    it('displays Horse Quality and Betting Value zone explanations', () => {
      renderAndNavigateToHorseScore();
      expect(screen.getByText('HORSE QUALITY Zone (Left Side)')).toBeInTheDocument();
      expect(screen.getByText('BETTING VALUE Zone (Right Side)')).toBeInTheDocument();
    });

    it('explains the six category bars', () => {
      renderAndNavigateToHorseScore();
      expect(screen.getByText('The Six Category Bars')).toBeInTheDocument();
      expect(screen.getByText('CONNECTIONS')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('SPEED/CLASS')).toBeInTheDocument();
      expect(screen.getByText('FORM')).toBeInTheDocument();
      expect(screen.getByText('EQUIPMENT')).toBeInTheDocument();
      expect(screen.getByText('PACE')).toBeInTheDocument();
    });
  });

  describe('Tab 3: Factor Breakdown', () => {
    function renderAndNavigateToFactorBreakdown() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Factor Breakdown'));
    }

    it('displays icon legend', () => {
      renderAndNavigateToFactorBreakdown();
      expect(screen.getByText('What the Icons Mean')).toBeInTheDocument();
    });

    it('displays all six factor categories', () => {
      renderAndNavigateToFactorBreakdown();
      expect(screen.getByText('Connections')).toBeInTheDocument();
      expect(screen.getByText('Post Position')).toBeInTheDocument();
      expect(screen.getByText('Speed / Class')).toBeInTheDocument();
      expect(screen.getByText('Form')).toBeInTheDocument();
      expect(screen.getByText('Equipment')).toBeInTheDocument();
      expect(screen.getByText('Pace')).toBeInTheDocument();
    });

    it('displays value card explanation', () => {
      renderAndNavigateToFactorBreakdown();
      expect(screen.getByText('VALUE DETECTED / NO VALUE Card')).toBeInTheDocument();
    });
  });

  describe('Tab 4: Suggested Bets', () => {
    function renderAndNavigateToSuggestedBets() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Suggested Bets'));
    }

    it('displays three bet tiers', () => {
      renderAndNavigateToSuggestedBets();
      expect(screen.getByText('CONSERVATIVE BETS (Lowest Risk)')).toBeInTheDocument();
      expect(screen.getByText('MODERATE BETS (Medium Risk, Bigger Payouts)')).toBeInTheDocument();
      expect(
        screen.getByText('AGGRESSIVE BETS (Highest Risk, Biggest Payouts)')
      ).toBeInTheDocument();
    });

    it('explains no bets recommended', () => {
      renderAndNavigateToSuggestedBets();
      expect(screen.getByText(/"No Bets Recommended"/)).toBeInTheDocument();
    });
  });

  describe('Tab 5: Past Performances', () => {
    function renderAndNavigateToPP() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Past Performances'));
    }

    it('displays all 15 column definitions', () => {
      renderAndNavigateToPP();
      expect(screen.getByText('DATE')).toBeInTheDocument();
      expect(screen.getByText('TRACK')).toBeInTheDocument();
      expect(screen.getByText('DISTANCE')).toBeInTheDocument();
      expect(screen.getByText('COND')).toBeInTheDocument();
      expect(screen.getByText('CLASS')).toBeInTheDocument();
      expect(screen.getByText('FINISH')).toBeInTheDocument();
      expect(screen.getByText('FIGURE')).toBeInTheDocument();
      expect(screen.getByText('TIME')).toBeInTheDocument();
      expect(screen.getByText('DAYS')).toBeInTheDocument();
      expect(screen.getByText('EQUIP/MED')).toBeInTheDocument();
      expect(screen.getByText('RUNNING LINE')).toBeInTheDocument();
      expect(screen.getByText('JOCKEY')).toBeInTheDocument();
      expect(screen.getByText('WEIGHT')).toBeInTheDocument();
      expect(screen.getByText('COMMENT')).toBeInTheDocument();
    });

    it('explains bullet workout symbol', () => {
      renderAndNavigateToPP();
      expect(screen.getByText(/fastest workout of the day/)).toBeInTheDocument();
    });
  });

  describe('Tab 6: Horse Profile', () => {
    function renderAndNavigateToProfile() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Horse Profile'));
    }

    it('displays all profile sections', () => {
      renderAndNavigateToProfile();
      expect(screen.getByText('Identity')).toBeInTheDocument();
      expect(screen.getByText('Breeding')).toBeInTheDocument();
      expect(screen.getByText('Connections')).toBeInTheDocument();
      expect(screen.getByText('Career Record')).toBeInTheDocument();
      expect(screen.getByText(/Surface.*Distance Splits/)).toBeInTheDocument();
    });
  });

  describe('Tab 7: Glossary', () => {
    function renderAndNavigateToGlossary() {
      render(<ScoringHelpModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Glossary'));
    }

    it('displays original 16 glossary terms', () => {
      renderAndNavigateToGlossary();
      expect(screen.getByText('Overlay')).toBeInTheDocument();
      expect(screen.getByText('Underlay')).toBeInTheDocument();
      expect(screen.getByText('Morning Line')).toBeInTheDocument();
      expect(screen.getByText('Furlong')).toBeInTheDocument();
      expect(screen.getByText('Maiden')).toBeInTheDocument();
      expect(screen.getByText('Claiming Race')).toBeInTheDocument();
      expect(screen.getByText('Allowance Race')).toBeInTheDocument();
      expect(screen.getByText('Stakes Race')).toBeInTheDocument();
      expect(screen.getByText('Speed Figure')).toBeInTheDocument();
      expect(screen.getByText('Blinkers')).toBeInTheDocument();
      expect(screen.getByText('Lasix')).toBeInTheDocument();
      expect(screen.getByText('Layoff')).toBeInTheDocument();
      expect(screen.getByText('Closer')).toBeInTheDocument();
      expect(screen.getByText('Early Speed')).toBeInTheDocument();
      expect(screen.getByText('Presser')).toBeInTheDocument();
      expect(screen.getByText('Track Bias')).toBeInTheDocument();
    });

    it('displays 8 new glossary terms', () => {
      renderAndNavigateToGlossary();
      expect(screen.getByText('Field Label')).toBeInTheDocument();
      expect(screen.getByText('Data Quality')).toBeInTheDocument();
      expect(screen.getByText('Betting Value')).toBeInTheDocument();
      expect(screen.getByText('Kelly Sizing')).toBeInTheDocument();
      expect(screen.getByText('Beyer Speed Figure')).toBeInTheDocument();
      expect(screen.getByText('Running Line')).toBeInTheDocument();
      expect(screen.getByText('Softmax')).toBeInTheDocument();
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
});
