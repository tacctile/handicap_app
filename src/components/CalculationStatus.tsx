import { memo, useEffect, useState } from 'react'
import type { CalculationState } from '../hooks/useRaceState'

interface CalculationStatusProps {
  calculationState: CalculationState
  horsesAnalyzed: number
  activeHorses: number
  confidenceLevel: number
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Not calculated'
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 1000) return 'Just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return new Date(timestamp).toLocaleTimeString()
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 75) return '#36d1da'
  if (confidence >= 50) return '#19abb5'
  if (confidence >= 25) return '#f59e0b'
  return '#888888'
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'Very High'
  if (confidence >= 65) return 'High'
  if (confidence >= 50) return 'Moderate'
  if (confidence >= 35) return 'Low'
  return 'Very Low'
}

export const CalculationStatus = memo(function CalculationStatus({
  calculationState,
  horsesAnalyzed,
  activeHorses,
  confidenceLevel,
}: CalculationStatusProps) {
  const { isCalculating, lastCalculatedAt } = calculationState
  const [displayTime, setDisplayTime] = useState(formatTimestamp(lastCalculatedAt))

  // Update display time every 10 seconds
  useEffect(() => {
    setDisplayTime(formatTimestamp(lastCalculatedAt))
    const interval = setInterval(() => {
      setDisplayTime(formatTimestamp(lastCalculatedAt))
    }, 10000)
    return () => clearInterval(interval)
  }, [lastCalculatedAt])

  const confidenceColor = getConfidenceColor(confidenceLevel)
  const confidenceLabel = getConfidenceLabel(confidenceLevel)

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
  )
})
