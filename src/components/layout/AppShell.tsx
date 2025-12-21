import type { ReactNode } from 'react';

/**
 * AppShell - Master layout wrapper for the Bloomberg-style panel architecture
 *
 * Structure:
 * - Full viewport height (100vh), no page scroll
 * - CSS Grid layout: rows = [TopBar auto] [RaceTabs auto] [MainArea 1fr] [StatusBar auto]
 * - All children passed via props/slots
 */

interface AppShellProps {
  /** TopBar component slot */
  topBar: ReactNode;
  /** RaceTabs bar component slot */
  raceTabs: ReactNode;
  /** Main workspace area */
  children: ReactNode;
  /** StatusBar component slot */
  statusBar: ReactNode;
  /** Optional className for custom styling */
  className?: string;
}

export function AppShell({ topBar, raceTabs, children, statusBar, className = '' }: AppShellProps) {
  return (
    <div className={`app-shell ${className}`} style={appShellStyles}>
      <div className="app-shell__topbar" style={topBarSlotStyles}>
        {topBar}
      </div>
      <div className="app-shell__race-tabs" style={raceTabsSlotStyles}>
        {raceTabs}
      </div>
      <div className="app-shell__main" style={mainSlotStyles}>
        {children}
      </div>
      <div className="app-shell__status-bar" style={statusBarSlotStyles}>
        {statusBar}
      </div>
    </div>
  );
}

// Inline styles using CSS custom properties from tokens.css
const appShellStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  height: '100vh',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'var(--color-base, #0A0A0B)',
  gap: 'var(--gap-panel, 16px)',
};

const topBarSlotStyles: React.CSSProperties = {
  width: '100%',
};

const raceTabsSlotStyles: React.CSSProperties = {
  width: '100%',
};

const mainSlotStyles: React.CSSProperties = {
  width: '100%',
  overflow: 'hidden',
  minHeight: 0, // Important for nested flex/grid overflow handling
};

const statusBarSlotStyles: React.CSSProperties = {
  width: '100%',
};

export default AppShell;
