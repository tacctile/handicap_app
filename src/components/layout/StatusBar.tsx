import { memo } from 'react';

interface StatusBarProps {
  trackDbLoaded?: boolean;
  isCalculating?: boolean;
  isOffline?: boolean;
}

export const StatusBar = memo(function StatusBar({
  trackDbLoaded = true,
  isCalculating = false,
  isOffline = false,
}: StatusBarProps) {
  return (
    <div className="status-bar">
      {/* Left section - Track DB status */}
      <div className="status-bar-left">
        <div className="status-bar-item">
          <span className={`status-bar-dot ${trackDbLoaded ? 'active' : 'error'}`} />
          <span className="status-bar-label">
            {trackDbLoaded ? 'Track DB Loaded' : 'Track DB Offline'}
          </span>
        </div>
      </div>

      {/* Center section - Calculation status */}
      <div className="status-bar-center">
        {isCalculating && (
          <div className="status-bar-item">
            <span className="status-bar-dot warning" />
            <span className="status-bar-label">Calculating...</span>
          </div>
        )}
      </div>

      {/* Right section - Offline indicator */}
      <div className="status-bar-right">
        {isOffline && (
          <div className="status-bar-item">
            <span className="status-bar-dot warning" />
            <span className="status-bar-label">Offline Mode</span>
          </div>
        )}
        {!isOffline && (
          <div className="status-bar-item">
            <span className="status-bar-dot active" />
            <span className="status-bar-label">Online</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default StatusBar;
