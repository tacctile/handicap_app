import type { ReactNode } from 'react';

/**
 * BettingDrawer - Collapsible right panel for betting-related content
 *
 * Features:
 * - When collapsed: shows only vertical toggle button with chevron icon
 * - When expanded: header with title "Betting" and collapse button, then scrollable content
 * - Internal structure (all placeholders for now):
 *   - Bankroll Summary section (fixed at top, does not scroll)
 *   - Recommendations section (scrollable)
 *   - Charts section (scrollable, below recs)
 */

interface BettingDrawerProps {
  /** Whether the drawer is open (expanded) */
  isOpen: boolean;
  /** Callback when toggle button is clicked */
  onToggle: () => void;
  /** Optional children to override default placeholder content */
  children?: ReactNode;
  /** Optional className for custom styling */
  className?: string;
}

export function BettingDrawer({ isOpen, onToggle, children, className = '' }: BettingDrawerProps) {
  return (
    <div
      className={`betting-drawer ${isOpen ? 'open' : 'collapsed'} ${className}`}
      style={containerStyles}
    >
      {/* Collapsed state - just toggle button */}
      {!isOpen && (
        <button
          className="betting-drawer__toggle betting-drawer__toggle--collapsed"
          style={collapsedToggleStyles}
          onClick={onToggle}
          aria-label="Expand betting drawer"
          aria-expanded={false}
        >
          <span className="material-icons" style={toggleIconStyles}>
            chevron_left
          </span>
        </button>
      )}

      {/* Expanded state - full drawer content */}
      {isOpen && (
        <div className="betting-drawer__content" style={contentStyles}>
          {/* Header */}
          <div className="betting-drawer__header" style={headerStyles}>
            <h2 className="betting-drawer__title" style={titleStyles}>
              Betting
            </h2>
            <button
              className="betting-drawer__toggle betting-drawer__toggle--expanded"
              style={expandedToggleStyles}
              onClick={onToggle}
              aria-label="Collapse betting drawer"
              aria-expanded={true}
            >
              <span className="material-icons" style={toggleIconStyles}>
                chevron_right
              </span>
            </button>
          </div>

          {/* Body - custom content or default placeholders */}
          {children ? (
            <div className="betting-drawer__body" style={bodyStyles}>
              {children}
            </div>
          ) : (
            <div className="betting-drawer__body" style={bodyStyles}>
              {/* Bankroll Summary - fixed at top */}
              <div
                className="betting-drawer__section betting-drawer__section--bankroll"
                style={bankrollSectionStyles}
              >
                <div className="betting-drawer__section-header" style={sectionHeaderStyles}>
                  <span className="material-icons" style={sectionIconStyles}>
                    account_balance
                  </span>
                  <span style={sectionTitleStyles}>Bankroll Summary</span>
                </div>
                <div className="betting-drawer__placeholder" style={placeholderStyles}>
                  [Bankroll Summary - existing BankrollSummaryCard will go here]
                </div>
              </div>

              {/* Scrollable content area */}
              <div className="betting-drawer__scrollable" style={scrollableStyles}>
                {/* Recommendations section */}
                <div
                  className="betting-drawer__section betting-drawer__section--recs"
                  style={sectionStyles}
                >
                  <div className="betting-drawer__section-header" style={sectionHeaderStyles}>
                    <span className="material-icons" style={sectionIconStyles}>
                      recommend
                    </span>
                    <span style={sectionTitleStyles}>Recommendations</span>
                  </div>
                  <div className="betting-drawer__placeholder" style={placeholderStyles}>
                    [Betting Recommendations - existing component will go here]
                  </div>
                </div>

                {/* Charts section */}
                <div
                  className="betting-drawer__section betting-drawer__section--charts"
                  style={sectionStyles}
                >
                  <div className="betting-drawer__section-header" style={sectionHeaderStyles}>
                    <span className="material-icons" style={sectionIconStyles}>
                      bar_chart
                    </span>
                    <span style={sectionTitleStyles}>Charts & Visualizations</span>
                  </div>
                  <div className="betting-drawer__placeholder" style={placeholderStyles}>
                    [Charts & Visualizations - future feature]
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Styles using CSS custom properties
const containerStyles: React.CSSProperties = {
  height: '100%',
  backgroundColor: 'var(--color-cards, #0F0F10)',
  borderRadius: 'var(--radius-lg, 8px)',
  borderLeft: '1px solid var(--color-border-subtle, #2A2A2C)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const collapsedToggleStyles: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary, #B4B4B6)',
  transition: 'color 150ms ease-out',
};

const expandedToggleStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  color: 'var(--color-text-secondary, #B4B4B6)',
  transition: 'background-color 150ms ease-out, color 150ms ease-out',
};

const toggleIconStyles: React.CSSProperties = {
  fontSize: '24px',
};

const contentStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderBottom: '1px solid var(--color-border-subtle, #2A2A2C)',
  flexShrink: 0,
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #EEEFF1)',
};

const bodyStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
};

const bankrollSectionStyles: React.CSSProperties = {
  padding: 'var(--space-4, 16px)',
  borderBottom: '1px solid var(--color-border-subtle, #2A2A2C)',
  flexShrink: 0,
};

const scrollableStyles: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: 'var(--space-4, 16px)',
};

const sectionStyles: React.CSSProperties = {
  marginBottom: 'var(--space-4, 16px)',
};

const sectionHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--gap-element, 8px)',
  marginBottom: 'var(--space-2, 8px)',
};

const sectionIconStyles: React.CSSProperties = {
  fontSize: '18px',
  color: 'var(--color-primary, #19abb5)',
};

const sectionTitleStyles: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #B4B4B6)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const placeholderStyles: React.CSSProperties = {
  padding: 'var(--space-4, 16px)',
  backgroundColor: 'var(--color-elevated, #1A1A1C)',
  borderRadius: 'var(--radius-md, 6px)',
  border: '1px dashed var(--color-border-subtle, #2A2A2C)',
  color: 'var(--color-text-tertiary, #6E6E70)',
  fontSize: '12px',
  textAlign: 'center',
};

export default BettingDrawer;
