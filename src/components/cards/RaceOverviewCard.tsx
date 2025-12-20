import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Skeleton, SlideUp } from '../motion'

interface RaceOverviewCardProps {
  race?: {
    trackName?: string
    raceNumber?: number
    distance?: string
    surface?: string
    conditions?: string
    purse?: string
    postTime?: Date
  }
  weather?: {
    temp?: number
    condition?: 'sunny' | 'cloudy' | 'rainy' | 'overcast'
  }
  isLoading?: boolean
}

const weatherIcons: Record<string, string> = {
  sunny: 'wb_sunny',
  cloudy: 'cloud',
  rainy: 'water_drop',
  overcast: 'filter_drama',
}

export function RaceOverviewCard({ race, weather, isLoading }: RaceOverviewCardProps) {
  const [countdown, setCountdown] = useState<string>('--:--:--')
  const hasData = !!race?.trackName

  // Countdown timer
  useEffect(() => {
    if (!race?.postTime) {
      setCountdown('--:--:--')
      return
    }

    const updateCountdown = () => {
      const now = new Date()
      const diff = race.postTime!.getTime() - now.getTime()

      if (diff <= 0) {
        setCountdown('POST!')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [race?.postTime])

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

        {/* Divider */}
        <div className="race-overview-divider" />

        {/* Bottom section - Weather and Countdown */}
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

          {/* Post time countdown */}
          <div className={`race-overview-countdown ${hasData ? 'active' : ''}`}>
            <span className="countdown-label">Post Time</span>
            <div className="countdown-timer">
              <span className="material-icons countdown-icon">timer</span>
              <span className="countdown-value">{countdown}</span>
            </div>
          </div>
        </div>

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
