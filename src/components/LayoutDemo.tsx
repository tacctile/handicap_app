import { useState, useCallback } from 'react';
import { AppShell } from './layout/AppShell';
import { RaceTabsBar, type RaceMetadata } from './layout/RaceTabsBar';
import { WorkspaceContainer } from './layout/WorkspaceContainer';
import { BettingDrawer } from './layout/BettingDrawer';
import { StatusBar } from './layout/StatusBar';

/**
 * LayoutDemo - Demonstration page for the new Bloomberg-style panel architecture
 *
 * Assembles all new layout components with placeholder content in each zone.
 * This is for visual verification of the layout scaffold before integrating
 * existing components.
 */

// Mock race data for demonstration
const mockRaces: RaceMetadata[] = [
  {
    raceNumber: 1,
    surface: 'dirt',
    distance: '6f',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Maiden Special Weight',
  },
  {
    raceNumber: 2,
    surface: 'turf',
    distance: '1m',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Allowance',
  },
  {
    raceNumber: 3,
    surface: 'dirt',
    distance: '7f',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Claiming $25,000',
  },
  {
    raceNumber: 4,
    surface: 'turf',
    distance: '1 1/16m',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Stakes',
  },
  {
    raceNumber: 5,
    surface: 'dirt',
    distance: '6f',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Maiden Claiming',
  },
  {
    raceNumber: 6,
    surface: 'synthetic',
    distance: '1m',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Allowance Optional',
  },
  {
    raceNumber: 7,
    surface: 'turf',
    distance: '1 1/8m',
    trackCode: 'CD',
    raceDate: 'Dec 21, 2025',
    raceType: 'Grade 3 Stakes',
  },
];

// Styles for demo placeholders - defined outside component to avoid recreation
const topBarPlaceholderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '56px',
  padding: '0 16px',
  backgroundColor: 'var(--color-cards, #0F0F10)',
  borderBottom: '1px solid var(--color-border-subtle, #2A2A2C)',
};

const topBarLeftStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const topBarCenterStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const topBarRightStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const exitButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  backgroundColor: 'var(--color-elevated, #1A1A1C)',
  border: '1px solid var(--color-border-subtle, #2A2A2C)',
  borderRadius: 'var(--radius-md, 6px)',
  color: 'var(--color-text-primary, #EEEFF1)',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background-color 150ms ease-out',
};

const placeholderLabelStyles: React.CSSProperties = {
  color: 'var(--color-text-tertiary, #6E6E70)',
  fontSize: '12px',
  fontStyle: 'italic',
};

const demoTitleStyles: React.CSSProperties = {
  color: 'var(--color-primary, #19abb5)',
  fontSize: '14px',
  fontWeight: 600,
  padding: '4px 12px',
  backgroundColor: 'rgba(25, 171, 181, 0.1)',
  borderRadius: 'var(--radius-sm, 4px)',
};

const clockStyles: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-text-secondary, #B4B4B6)',
  fontSize: '14px',
};

const analysisPlaceholderStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: '400px',
  padding: '32px',
  textAlign: 'center',
};

const analysisTitleStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: 'var(--color-text-primary, #EEEFF1)',
};

const analysisHeadingStyles: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '24px',
  fontWeight: 600,
  color: 'var(--color-text-primary, #EEEFF1)',
};

const analysisSubtextStyles: React.CSSProperties = {
  margin: '0 0 24px 0',
  fontSize: '14px',
  color: 'var(--color-text-tertiary, #6E6E70)',
  maxWidth: '400px',
};

const raceInfoStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 24px',
  backgroundColor: 'var(--color-elevated, #1A1A1C)',
  borderRadius: 'var(--radius-md, 6px)',
  fontSize: '14px',
  color: 'var(--color-text-secondary, #B4B4B6)',
};

interface LayoutDemoProps {
  /** Callback to exit the demo and return to main app */
  onExit?: () => void;
}

export function LayoutDemo({ onExit }: LayoutDemoProps) {
  // Race selection state
  const [activeRaceIndex, setActiveRaceIndex] = useState(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Handle race tab selection
  const handleRaceSelect = useCallback((index: number) => {
    setActiveRaceIndex(index);
  }, []);

  // Handle drawer toggle
  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  // Get active race data safely
  const activeRace = mockRaces[activeRaceIndex];

  return (
    <AppShell
      topBar={
        <div style={topBarPlaceholderStyles}>
          <div style={topBarLeftStyles}>
            {onExit && (
              <button style={exitButtonStyles} onClick={onExit}>
                <span className="material-icons" style={{ fontSize: '20px' }}>
                  arrow_back
                </span>
                <span>Exit Demo</span>
              </button>
            )}
            <span style={placeholderLabelStyles}>[TopBar - existing component will go here]</span>
          </div>
          <div style={topBarCenterStyles}>
            <span style={demoTitleStyles}>Layout Demo Mode</span>
          </div>
          <div style={topBarRightStyles}>
            <span
              className="material-icons"
              style={{ color: 'var(--color-text-tertiary, #6E6E70)' }}
            >
              schedule
            </span>
            <span style={clockStyles}>12:00:00 PM</span>
          </div>
        </div>
      }
      raceTabs={
        <RaceTabsBar
          races={mockRaces}
          activeRaceIndex={activeRaceIndex}
          onRaceSelect={handleRaceSelect}
        />
      }
      statusBar={<StatusBar trackDbLoaded={true} calculationStatus="complete" isOffline={false} />}
    >
      <WorkspaceContainer
        drawerOpen={drawerOpen}
        onDrawerToggle={handleDrawerToggle}
        drawerContent={<BettingDrawer isOpen={drawerOpen} onToggle={handleDrawerToggle} />}
      >
        <div style={analysisPlaceholderStyles}>
          <div style={analysisTitleStyles}>
            <span
              className="material-icons"
              style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}
            >
              table_chart
            </span>
            <h2 style={analysisHeadingStyles}>Analysis Panel</h2>
            <p style={analysisSubtextStyles}>
              [Horse Table + DRF Expansion - existing components will integrate here]
            </p>
            {activeRace && (
              <div style={raceInfoStyles}>
                <span>Currently viewing: Race {activeRace.raceNumber}</span>
                <span> | </span>
                <span>{activeRace.distance}</span>
                <span> | </span>
                <span style={{ textTransform: 'capitalize' }}>{activeRace.surface}</span>
              </div>
            )}
          </div>
        </div>
      </WorkspaceContainer>
    </AppShell>
  );
}

export default LayoutDemo;
