/**
 * StatusBar - Thin bar at bottom of viewport showing system status
 *
 * Features:
 * - Height: 32px fixed
 * - Contains: Track DB status, calculation status, offline indicator
 * - Flex layout, items centered vertically, space-between
 */

interface StatusBarProps {
  /** Whether track database is loaded */
  trackDbLoaded?: boolean;
  /** Current calculation status */
  calculationStatus?: 'idle' | 'calculating' | 'complete' | 'error';
  /** Whether the app is offline */
  isOffline?: boolean;
  /** Optional className for custom styling */
  className?: string;
}

export function StatusBar({
  trackDbLoaded = true,
  calculationStatus = 'idle',
  isOffline = false,
  className = '',
}: StatusBarProps) {
  // Get calculation status text and color
  const getCalculationStatusDisplay = () => {
    switch (calculationStatus) {
      case 'calculating':
        return { text: 'Calculating...', icon: 'sync', color: 'var(--color-primary, #19abb5)' };
      case 'complete':
        return { text: 'Calculations Complete', icon: 'check_circle', color: '#10b981' };
      case 'error':
        return { text: 'Calculation Error', icon: 'error', color: '#ef4444' };
      default:
        return {
          text: 'Ready',
          icon: 'radio_button_checked',
          color: 'var(--color-text-tertiary, #6E6E70)',
        };
    }
  };

  const calcStatus = getCalculationStatusDisplay();

  return (
    <footer className={`status-bar ${className}`} style={containerStyles}>
      {/* Left section - Track DB and calculation status */}
      <div className="status-bar__left" style={sectionStyles}>
        {/* Track DB status */}
        <div className="status-bar__item" style={itemStyles}>
          <span
            className="status-bar__dot"
            style={{
              ...dotStyles,
              backgroundColor: trackDbLoaded ? '#10b981' : '#ef4444',
            }}
          />
          <span className="status-bar__text" style={textStyles}>
            {trackDbLoaded ? 'Track DB Loaded' : 'Track DB Offline'}
          </span>
        </div>

        {/* Divider */}
        <span className="status-bar__divider" style={dividerStyles}>
          |
        </span>

        {/* Calculation status */}
        <div className="status-bar__item" style={itemStyles}>
          <span
            className="material-icons status-bar__icon"
            style={{
              ...iconStyles,
              color: calcStatus.color,
              animation: calculationStatus === 'calculating' ? 'spin 1s linear infinite' : 'none',
            }}
          >
            {calcStatus.icon}
          </span>
          <span className="status-bar__text" style={textStyles}>
            {calcStatus.text}
          </span>
        </div>
      </div>

      {/* Right section - Offline indicator and version */}
      <div className="status-bar__right" style={sectionStyles}>
        {/* Offline indicator */}
        {isOffline && (
          <div className="status-bar__item status-bar__item--offline" style={itemStyles}>
            <span
              className="material-icons status-bar__icon"
              style={{ ...iconStyles, color: '#f59e0b' }}
            >
              cloud_off
            </span>
            <span className="status-bar__text" style={{ ...textStyles, color: '#f59e0b' }}>
              Offline Mode
            </span>
          </div>
        )}

        {/* Connection status */}
        {!isOffline && (
          <div className="status-bar__item" style={itemStyles}>
            <span className="material-icons status-bar__icon" style={iconStyles}>
              wifi
            </span>
            <span className="status-bar__text" style={textStyles}>
              Connected
            </span>
          </div>
        )}
      </div>

      {/* Inline keyframes for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </footer>
  );
}

// Styles using CSS custom properties
const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '32px',
  width: '100%',
  padding: '0 var(--space-4, 16px)',
  backgroundColor: 'var(--color-elevated, #1A1A1C)',
  borderTop: '1px solid var(--color-border-subtle, #2A2A2C)',
};

const sectionStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--gap-element, 8px)',
};

const itemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--gap-tight, 4px)',
};

const dotStyles: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  flexShrink: 0,
};

const iconStyles: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--color-text-tertiary, #6E6E70)',
};

const textStyles: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--color-text-tertiary, #6E6E70)',
};

const dividerStyles: React.CSSProperties = {
  color: 'var(--color-border-subtle, #2A2A2C)',
  fontSize: '12px',
  margin: '0 var(--gap-tight, 4px)',
};

export default StatusBar;
