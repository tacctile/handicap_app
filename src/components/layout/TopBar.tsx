import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PulsingGlow } from '../motion'

interface TopBarProps {
  currentRace?: {
    trackName?: string
    raceNumber?: number
    postTime?: string
  }
  onUploadClick: () => void
  onSettingsClick?: () => void
  onMenuClick: () => void
  hasData: boolean
}

export function TopBar({
  currentRace,
  onUploadClick,
  onSettingsClick,
  onMenuClick,
  hasData,
}: TopBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }, [])

  const raceInfo = currentRace?.trackName
    ? `${currentRace.trackName} - Race ${currentRace.raceNumber}`
    : 'No race loaded'

  return (
    <header className="topbar" role="banner">
      <div className="topbar-content">
        {/* Left section - Menu button (mobile) + Race info */}
        <div className="topbar-left">
          <button
            className="topbar-menu-btn"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <span className="material-icons">menu</span>
          </button>

          <div className="topbar-race-info">
            <div className={`topbar-race-status ${hasData ? 'active' : ''}`}>
              <span className="material-icons topbar-race-icon">
                {hasData ? 'sports_score' : 'schedule'}
              </span>
              <span className="topbar-race-text">{raceInfo}</span>
            </div>
          </div>
        </div>

        {/* Center section - System status (desktop only) */}
        <div className="topbar-center">
          <div className="topbar-system-status">
            <span className="topbar-status-dot active" />
            <span className="topbar-status-text">System Ready</span>
          </div>
        </div>

        {/* Right section - Actions + Clock */}
        <div className="topbar-right">
          {/* Upload button - Primary CTA */}
          {!hasData ? (
            <PulsingGlow className="topbar-upload-glow">
              <button
                className="topbar-upload-btn primary"
                onClick={onUploadClick}
                aria-label="Upload DRF file"
              >
                <span className="material-icons">upload_file</span>
                <span className="topbar-upload-text">Upload File</span>
              </button>
            </PulsingGlow>
          ) : (
            <button
              className="topbar-upload-btn secondary"
              onClick={onUploadClick}
              aria-label="Upload new DRF file"
            >
              <span className="material-icons">upload_file</span>
              <span className="topbar-upload-text">New File</span>
            </button>
          )}

          {/* Settings button */}
          <button
            className="topbar-icon-btn"
            onClick={onSettingsClick}
            aria-label="Settings"
          >
            <span className="material-icons">tune</span>
          </button>

          {/* Notifications */}
          <div className="topbar-notifications" ref={notificationRef}>
            <button
              className="topbar-icon-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <span className="material-icons">notifications_none</span>
              <span className="topbar-notification-badge">0</span>
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  className="topbar-notification-dropdown"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="notification-header">
                    <span>Notifications</span>
                    <span className="notification-count">0 new</span>
                  </div>
                  <div className="notification-empty">
                    <span className="material-icons">notifications_off</span>
                    <p>No new notifications</p>
                  </div>
                  <div className="notification-footer">
                    <span className="notification-coming-soon">More features coming soon</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Live clock */}
          <div className="topbar-clock" aria-live="polite" aria-label="Current time">
            <span className="material-icons topbar-clock-icon">schedule</span>
            <span className="topbar-clock-time">{formatTime(currentTime)}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopBar
