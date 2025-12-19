import { useState, useEffect } from 'react'

interface LoadingStateProps {
  message?: string
  estimatedTime?: number // in seconds
  progress?: number // 0-100
}

export function LoadingState({
  message = 'Parsing race data...',
  estimatedTime,
  progress
}: LoadingStateProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="loading-state-container">
      <div className="loading-state-card">
        {/* Circular progress indicator */}
        <div className="loading-spinner-wrapper">
          <svg className="loading-spinner" viewBox="0 0 50 50">
            {/* Background circle */}
            <circle
              className="loading-spinner-track"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
            />
            {/* Animated circle */}
            <circle
              className="loading-spinner-indicator"
              cx="25"
              cy="25"
              r="20"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              style={progress !== undefined ? {
                strokeDasharray: `${progress * 1.26} 126`,
                animation: 'none',
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
              } : undefined}
            />
          </svg>
          {progress !== undefined && (
            <span className="loading-progress-text">{Math.round(progress)}%</span>
          )}
        </div>

        {/* Message */}
        <p className="loading-message">{message}</p>

        {/* Time info */}
        <div className="loading-time-info">
          {estimatedTime && estimatedTime > 5 && (
            <span className="loading-estimated">
              Estimated: ~{formatTime(estimatedTime)}
            </span>
          )}
          {elapsedTime > 2 && (
            <span className="loading-elapsed">
              Elapsed: {formatTime(elapsedTime)}
            </span>
          )}
        </div>

        {/* Loading dots animation */}
        <div className="loading-dots">
          <span className="loading-dot"></span>
          <span className="loading-dot"></span>
          <span className="loading-dot"></span>
        </div>
      </div>
    </div>
  )
}

// Inline loading indicator for smaller areas
interface InlineLoadingProps {
  size?: 'small' | 'medium' | 'large'
  text?: string
}

export function InlineLoading({ size = 'medium', text }: InlineLoadingProps) {
  const sizeClasses = {
    small: 'inline-loading-small',
    medium: 'inline-loading-medium',
    large: 'inline-loading-large',
  }

  return (
    <div className={`inline-loading ${sizeClasses[size]}`}>
      <svg className="inline-loading-spinner" viewBox="0 0 24 24">
        <circle
          className="inline-loading-track"
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="2"
        />
        <circle
          className="inline-loading-indicator"
          cx="12"
          cy="12"
          r="10"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {text && <span className="inline-loading-text">{text}</span>}
    </div>
  )
}

// Skeleton loading placeholder
interface SkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = ''
}: SkeletonProps) {
  const baseClass = 'skeleton'
  const variantClass = `skeleton-${variant}`

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClass} ${variantClass} ${className}`}
      style={style}
    />
  )
}
