import { memo, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { ParsedRace } from '../types/drf'
import type { UseRaceStateReturn } from '../hooks/useRaceState'
import type { UseBankrollReturn } from '../hooks/useBankroll'
import { RaceTable } from './RaceTable'
import {
  getConfidenceColor,
  getConfidenceLabel,
  getConfidenceBgColor,
  getConfidenceBorderColor,
} from '../lib/confidence'

interface RaceDetailProps {
  race: ParsedRace
  confidence: number
  raceState: UseRaceStateReturn
  bankroll: UseBankrollReturn
  onBack: () => void
  onOpenBankrollSettings: () => void
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

// Confidence badge component
interface ConfidenceBadgeProps {
  confidence: number
}

const ConfidenceBadge = memo(function ConfidenceBadge({
  confidence,
}: ConfidenceBadgeProps) {
  const color = getConfidenceColor(confidence)
  const label = getConfidenceLabel(confidence)
  const bgColor = getConfidenceBgColor(confidence)
  const borderColor = getConfidenceBorderColor(confidence)

  return (
    <div
      className="confidence-badge confidence-badge-small"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: color,
      }}
    >
      <span className="confidence-value tabular-nums">{confidence}%</span>
      <span className="confidence-label">{label}</span>
    </div>
  )
})

export const RaceDetail = memo(function RaceDetail({
  race,
  confidence,
  raceState,
  bankroll,
  onBack,
  onOpenBankrollSettings,
}: RaceDetailProps) {
  const { header } = race

  // Handle Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onBack])

  // Format surface nicely
  const surfaceLabel = header.surface.charAt(0).toUpperCase() + header.surface.slice(1)

  return (
    <motion.div
      className="race-detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header with back navigation */}
      <div className="race-detail-header">
        <button
          type="button"
          className="race-detail-back-btn"
          onClick={onBack}
          aria-label="Back to race overview"
        >
          <Icon name="arrow_back" />
          <span>Overview</span>
        </button>
        <span className="race-detail-back-hint">(Esc)</span>

        <div className="race-detail-info">
          <h1 className="race-detail-title">
            Race {header.raceNumber}
          </h1>
          <span className="race-detail-subtitle">
            {header.distance} {surfaceLabel}
            {header.classification && ` • ${header.classification}`}
          </span>
        </div>

        <div className="race-detail-confidence">
          <ConfidenceBadge confidence={confidence} />
        </div>
      </div>

      {/* Race content */}
      <div className="race-detail-content">
        <RaceTable
          race={race}
          raceState={raceState}
          bankroll={bankroll}
          onOpenBankrollSettings={onOpenBankrollSettings}
        />
      </div>
    </motion.div>
  )
})

export default RaceDetail
