import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton, SlideUp } from '../motion'
import { RaceCardCountdown } from '../PostTimeCountdown'
import type { CountdownState } from '../../hooks/usePostTime'
import type { PaceScenarioAnalysis } from '../../lib/scoring'

interface RaceOverviewCardProps {
  race?: {
    trackName?: string
    raceNumber?: number
    distance?: string
    surface?: string
    conditions?: string
    purse?: string
    postTime?: string
  }
  weather?: {
    temp?: number
    condition?: 'sunny' | 'cloudy' | 'rainy' | 'overcast'
  }
  isLoading?: boolean
  countdown?: CountdownState
  postTimeFormatted?: string
  /** Pace scenario analysis for the race */
  paceScenario?: PaceScenarioAnalysis
}

const weatherIcons: Record<string, string> = {
  sunny: 'wb_sunny',
  cloudy: 'cloud',
  rainy: 'water_drop',
  overcast: 'filter_drama',
}

/**
 * Get pace scenario icon based on type
 */
function getPaceIcon(scenario: PaceScenarioAnalysis['scenario']): string {
  switch (scenario) {
    case 'soft': return 'trending_flat'
    case 'moderate': return 'trending_up'
    case 'contested': return 'local_fire_department'
    case 'speed_duel': return 'whatshot'
    default: return 'help_outline'
  }
}

/**
 * Format style breakdown for compact display
 */
function formatCompactBreakdown(breakdown: PaceScenarioAnalysis['styleBreakdown']): string {
  const parts: string[] = []

  if (breakdown.earlySpeed.length > 0) {
    parts.push(`E: ${breakdown.earlySpeed.map(n => `#${n}`).join(', ')}`)
  }
  if (breakdown.pressers.length > 0) {
    parts.push(`P: ${breakdown.pressers.map(n => `#${n}`).join(', ')}`)
  }
  if (breakdown.closers.length > 0) {
    parts.push(`C: ${breakdown.closers.map(n => `#${n}`).join(', ')}`)
  }
  if (breakdown.sustained.length > 0) {
    parts.push(`S: ${breakdown.sustained.map(n => `#${n}`).join(', ')}`)
  }

  return parts.join(' | ') || 'No data'
}

export function RaceOverviewCard({
  race,
  weather,
  isLoading,
  countdown,
  postTimeFormatted,
  paceScenario,
}: RaceOverviewCardProps) {
  const hasData = !!race?.trackName
  const hasCountdown = countdown && (countdown.totalMs >= 0 || countdown.isExpired)
  const hasPaceData = !!paceScenario && paceScenario.fieldSize > 0

  const getWeatherIcon = useCallback(() => {
    return weatherIcons[weather?.condition || 'sunny']
  }, [weather?.condition])

  if (isLoading) {
    return (
      <div className="race-overview-card loading">
        <div className="race-overview-header">
          <Skeleton width="60%" height="24px" />
          <Skeleton width="80px" height="32px" />
        </div>
        <div className="race-overview-details">
          <Skeleton width="100%" height="16px" className="mb-2" />
          <Skeleton width="80%" height="16px" className="mb-2" />
          <Skeleton width="60%" height="16px" />
        </div>
      </div>
    )
  }

  return (
    <SlideUp>
      <motion.div
        className={`race-overview-card ${hasData ? 'has-data' : 'empty'}`}
        whileHover={hasData ? { y: -2 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* Card header */}
        <div className="race-overview-header">
          <div className="race-overview-title">
            <span className="material-icons race-overview-icon">emoji_events</span>
            <h3 className="race-overview-track">
              {hasData ? race!.trackName : 'Track Name'}
            </h3>
          </div>
          {hasData && race?.raceNumber && (
            <div className="race-overview-number">
              Race {race.raceNumber}
            </div>
          )}
        </div>

        {/* Post Time Countdown Section */}
        {hasData && (
          <div className="race-overview-countdown-section">
            <RaceCardCountdown
              countdown={countdown || {
                totalMs: -1,
                hours: 0,
                minutes: 0,
                seconds: 0,
                formatted: '--:--:--',
                shortFormatted: '--:--',
                isExpired: false,
                isCritical: false,
                isWarning: false,
                isImminent: false,
                progress: 0,
                colorClass: 'normal',
              }}
              postTimeFormatted={postTimeFormatted || '--:--'}
              isValid={!!hasCountdown}
            />
          </div>
        )}

        {/* Divider */}
        <div className="race-overview-divider" />

        {/* Race details grid */}
        <div className="race-overview-grid">
          <div className="race-overview-item">
            <span className="race-overview-item-icon material-icons">straighten</span>
            <div className="race-overview-item-content">
              <span className="race-overview-item-label">Distance</span>
              <span className="race-overview-item-value">
                {hasData && race?.distance ? race.distance : '—'}
              </span>
            </div>
          </div>

          <div className="race-overview-item">
            <span className="race-overview-item-icon material-icons">terrain</span>
            <div className="race-overview-item-content">
              <span className="race-overview-item-label">Surface</span>
              <span className="race-overview-item-value">
                {hasData && race?.surface ? race.surface : '—'}
              </span>
            </div>
          </div>

          <div className="race-overview-item">
            <span className="race-overview-item-icon material-icons">water_drop</span>
            <div className="race-overview-item-content">
              <span className="race-overview-item-label">Conditions</span>
              <span className="race-overview-item-value">
                {hasData && race?.conditions ? race.conditions : '—'}
              </span>
            </div>
          </div>

          <div className="race-overview-item">
            <span className="race-overview-item-icon material-icons">payments</span>
            <div className="race-overview-item-content">
              <span className="race-overview-item-label">Purse</span>
              <span className="race-overview-item-value purse">
                {hasData && race?.purse ? race.purse : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Pace Scenario Section */}
        {hasData && hasPaceData && paceScenario && (
          <>
            <div className="race-overview-divider" />
            <div className="race-overview-pace-section">
              <div className="race-overview-pace-header">
                <span
                  className="material-icons pace-scenario-icon"
                  style={{ color: paceScenario.color }}
                >
                  {getPaceIcon(paceScenario.scenario)}
                </span>
                <div className="pace-scenario-info">
                  <span className="pace-scenario-label">Pace Scenario</span>
                  <span
                    className="pace-scenario-value"
                    style={{
                      color: paceScenario.color,
                      fontWeight: 600,
                    }}
                  >
                    {paceScenario.label}
                  </span>
                </div>
                <div
                  className="pace-ppi-badge"
                  style={{
                    backgroundColor: `${paceScenario.color}20`,
                    color: paceScenario.color,
                    borderColor: `${paceScenario.color}40`,
                  }}
                >
                  <span className="ppi-value">PPI: {paceScenario.ppi}</span>
                </div>
              </div>

              {/* Style Breakdown */}
              <div className="race-overview-style-breakdown">
                <span className="style-breakdown-label">Running Styles:</span>
                <span className="style-breakdown-value">
                  {formatCompactBreakdown(paceScenario.styleBreakdown)}
                </span>
              </div>

              {/* Expected Pace */}
              <div className="race-overview-expected-pace">
                <span className="material-icons expected-pace-icon">speed</span>
                <span className="expected-pace-text">
                  Expected: <strong>{paceScenario.expectedPace}</strong> pace
                </span>
              </div>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="race-overview-divider" />

        {/* Bottom section - Weather */}
        <div className="race-overview-footer">
          {/* Weather widget */}
          <div className="race-overview-weather">
            <motion.span
              className={`material-icons weather-icon ${weather?.condition || 'inactive'}`}
              animate={
                weather?.condition === 'sunny'
                  ? { rotate: [0, 10, -10, 0] }
                  : weather?.condition === 'rainy'
                    ? { y: [0, 2, 0] }
                    : {}
              }
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {getWeatherIcon()}
            </motion.span>
            <span className="weather-temp">
              {weather?.temp ? `${weather.temp}°F` : '—°F'}
            </span>
          </div>

          {/* Quick countdown badge for reference */}
          {hasData && hasCountdown && (
            <div className={`race-overview-countdown-badge ${countdown?.colorClass || 'normal'}`}>
              <span className="material-icons">timer</span>
              <span>{countdown?.shortFormatted || '--:--'}</span>
            </div>
          )}
        </div>

        {/* Urgent warning overlay */}
        <AnimatePresence>
          {hasData && countdown?.isImminent && !countdown.isExpired && (
            <motion.div
              className="race-overview-urgent-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="urgent-pulse"
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state overlay */}
        {!hasData && (
          <div className="race-overview-empty-overlay">
            <span className="empty-overlay-text">Upload file to view race details</span>
          </div>
        )}
      </motion.div>
    </SlideUp>
  )
}

export default RaceOverviewCard
