import type { ReactNode } from 'react';
import { useMemo } from 'react';

/**
 * WorkspaceContainer - Main workspace layout with collapsible betting drawer
 *
 * Structure:
 * - CSS Grid: columns = [AnalysisPanel 1fr] [BettingDrawer auto]
 * - AnalysisPanel: where horse table and expanded details will live
 * - BettingDrawer: collapsible right panel (48px collapsed, 380px expanded)
 * - Animate width transition: 200ms ease-out
 */

interface WorkspaceContainerProps {
  /** Whether the betting drawer is open */
  drawerOpen: boolean;
  /** Callback when drawer toggle is clicked */
  onDrawerToggle: () => void;
  /** Content for the main analysis area */
  children: ReactNode;
  /** Content for the betting drawer */
  drawerContent: ReactNode;
  /** Optional className for custom styling */
  className?: string;
}

export function WorkspaceContainer({
  drawerOpen,
  onDrawerToggle: _onDrawerToggle,
  children,
  drawerContent,
  className = '',
}: WorkspaceContainerProps) {
  // Note: onDrawerToggle is passed through props interface for future use
  // when workspace-level drawer controls are needed
  void _onDrawerToggle;
  // Compute drawer width based on open state
  const drawerWidth = drawerOpen
    ? 'var(--drawer-expanded-width, 380px)'
    : 'var(--drawer-collapsed-width, 48px)';

  const containerStyles = useMemo(
    (): React.CSSProperties => ({
      display: 'grid',
      gridTemplateColumns: `1fr ${drawerWidth}`,
      gap: 'var(--gap-panel, 16px)',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      transition: 'grid-template-columns var(--drawer-transition, 200ms ease-out)',
    }),
    [drawerWidth]
  );

  return (
    <div className={`workspace-container ${className}`} style={containerStyles}>
      {/* Analysis Panel - main content area */}
      <div className="workspace-container__analysis" style={analysisPanelStyles}>
        {children}
      </div>

      {/* Betting Drawer - collapsible right panel */}
      <div
        className={`workspace-container__drawer ${drawerOpen ? 'open' : 'collapsed'}`}
        style={drawerWrapperStyles}
      >
        {drawerContent}
      </div>
    </div>
  );
}

// Styles using CSS custom properties
const analysisPanelStyles: React.CSSProperties = {
  minHeight: '300px',
  height: '100%',
  overflow: 'auto',
  backgroundColor: 'var(--color-cards, #0F0F10)',
  borderRadius: 'var(--radius-lg, 8px)',
  border: '1px solid var(--color-border-subtle, #2A2A2C)',
};

const drawerWrapperStyles: React.CSSProperties = {
  height: '100%',
  overflow: 'hidden',
  transition: 'width var(--drawer-transition, 200ms ease-out)',
};

export default WorkspaceContainer;
