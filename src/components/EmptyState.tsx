import { useCallback } from 'react'

interface EmptyStateProps {
  onFileSelect?: () => void
}

export function EmptyState({ onFileSelect }: EmptyStateProps) {
  const handleClick = useCallback(() => {
    onFileSelect?.()
  }, [onFileSelect])

  return (
    <div className="empty-state-container">
      <div className="empty-state-card">
        {/* Large upload icon */}
        <div className="empty-state-icon-wrapper">
          <span className="material-icons empty-state-icon">upload_file</span>
        </div>

        {/* Main message */}
        <h2 className="empty-state-title">
          Drop your .drf file here to get started
        </h2>
        <p className="empty-state-subtitle">
          or click the button below to browse
        </p>

        {/* Upload button */}
        <button onClick={handleClick} className="empty-state-button">
          <span className="material-icons">folder_open</span>
          Select DRF File
        </button>

        {/* File format info */}
        <div className="empty-state-info">
          <div className="empty-state-info-header">
            <span className="material-icons">info</span>
            <span>Sample File Format</span>
          </div>
          <p className="empty-state-info-text">
            DRF (Daily Racing Form) files contain past performance data for horse racing analysis.
            These files include details like horse names, trainers, jockeys, odds, and historical race data.
          </p>
        </div>

        {/* Tips section */}
        <div className="empty-state-tips">
          <div className="empty-state-tips-header">
            <span className="material-icons">lightbulb</span>
            <span>Tips</span>
          </div>
          <ul className="empty-state-tips-list">
            <li>
              <span className="material-icons">check_circle</span>
              Supports all major US tracks
            </li>
            <li>
              <span className="material-icons">check_circle</span>
              Automatic parsing of race cards
            </li>
            <li>
              <span className="material-icons">check_circle</span>
              Advanced handicapping analysis
            </li>
            <li>
              <span className="material-icons">check_circle</span>
              Real-time odds adjustments
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
