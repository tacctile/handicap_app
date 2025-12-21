import { memo, useEffect, useState } from 'react';
import type { CalculationState } from '../hooks/useRaceState';
import { getConfidenceColor, getConfidenceLabel } from '../lib/confidence';

interface CalculationStatusProps {
  calculationState: CalculationState;
  horsesAnalyzed: number;
  activeHorses: number;
  confidenceLevel: number;
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Not calculated';
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(timestamp).toLocaleTimeString();
}

export const CalculationStatus = memo(function CalculationStatus({
  calculationState,
  horsesAnalyzed,
  activeHorses,
  confidenceLevel,
}: CalculationStatusProps) {
  const { isCalculating, lastCalculatedAt } = calculationState;
  const [displayTime, setDisplayTime] = useState(formatTimestamp(lastCalculatedAt));

  // Update display time every 10 seconds
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state and setting up interval
    setDisplayTime(formatTimestamp(lastCalculatedAt));
    const interval = setInterval(() => {
      setDisplayTime(formatTimestamp(lastCalculatedAt));
    }, 10000);
    return () => clearInterval(interval);
  }, [lastCalculatedAt]);

  const confidenceColor = getConfidenceColor(confidenceLevel);
  const confidenceLabel = getConfidenceLabel(confidenceLevel);

  return (
    <div className="calculation-status">
      <div className="calculation-status-inner">
        {/* Status indicator */}
        <div className="status-indicator">
          {isCalculating ? (
            <>
              <Icon name="refresh" className="status-icon spinning" />
              <span className="status-text">Recalculating...</span>
            </>
          ) : (
            <>
              <Icon name="check_circle" className="status-icon ready" />
              <span className="status-text">{displayTime}</span>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="status-stats">
          <div className="status-stat">
            <Icon name="pets" className="stat-icon-small" />
            <span className="stat-number">{activeHorses}</span>
            <span className="stat-label-small">/{horsesAnalyzed}</span>
          </div>

          <div className="status-divider" />

          <div className="status-stat confidence-stat">
            <Icon name="insights" className="stat-icon-small" />
            <span className="stat-number" style={{ color: confidenceColor }}>
              {confidenceLevel}%
            </span>
            <span className="stat-label-small">{confidenceLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
