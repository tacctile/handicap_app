import { useState, useCallback } from 'react'

interface HeaderProps {
  currentFileName?: string | null
  onMenuClick?: () => void
  onReset?: () => void
  hasChanges?: boolean
}

export function Header({
  currentFileName,
  onMenuClick,
  onReset,
  hasChanges = false
}: HeaderProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleResetClick = useCallback(() => {
    if (hasChanges) {
      setShowResetConfirm(true)
    } else {
      onReset?.()
    }
  }, [hasChanges, onReset])

  const handleConfirmReset = useCallback(() => {
    setShowResetConfirm(false)
    onReset?.()
  }, [onReset])

  const handleCancelReset = useCallback(() => {
    setShowResetConfirm(false)
  }, [])

  return (
    <>
      <header className="app-header-component">
        <div className="header-content">
          {/* Left section - Menu and branding */}
          <div className="header-left">
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="header-menu-button"
                aria-label="Open menu"
              >
                <span className="material-icons">menu</span>
              </button>
            )}
            <div className="header-branding">
              <h1 className="header-title">Horse Monster</h1>
              <span className="header-subtitle">Advanced Handicapping Analysis</span>
            </div>
          </div>

          {/* Center section - File info */}
          {currentFileName && (
            <div className="header-center">
              <div className="header-file-info">
                <span className="material-icons header-file-icon">description</span>
                <span className="header-file-name">{currentFileName}</span>
                {hasChanges && (
                  <span className="header-unsaved-indicator" title="Unsaved changes">
                    <span className="material-icons">edit</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Right section - Actions */}
          <div className="header-right">
            {currentFileName && onReset && (
              <button
                onClick={handleResetClick}
                className="header-action-button"
                aria-label="Reset"
                title="Reset all changes (Ctrl+R)"
              >
                <span className="material-icons">refresh</span>
              </button>
            )}
            <button
              className="header-action-button header-settings-button"
              aria-label="Settings"
              title="Settings (coming soon)"
            >
              <span className="material-icons">settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div className="reset-confirm-overlay" onClick={handleCancelReset}>
          <div className="reset-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="reset-confirm-icon">
              <span className="material-icons">warning</span>
            </div>
            <h3 className="reset-confirm-title">Reset All Changes?</h3>
            <p className="reset-confirm-message">
              This will clear all odds adjustments, scratches, and track condition changes.
              This action cannot be undone.
            </p>
            <div className="reset-confirm-actions">
              <button onClick={handleCancelReset} className="reset-confirm-cancel">
                Cancel
              </button>
              <button onClick={handleConfirmReset} className="reset-confirm-button">
                <span className="material-icons">refresh</span>
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
