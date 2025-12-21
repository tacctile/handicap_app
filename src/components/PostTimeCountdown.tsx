import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CountdownState } from '../hooks/usePostTime';

// ============================================
// PostTimeCountdown - Main countdown component
// ============================================

interface PostTimeCountdownProps {
  /** Countdown state from usePostTime hook */
  countdown: CountdownState;
  /** Formatted post time (e.g., "2:30 PM") */
  postTimeFormatted: string;
  /** Is countdown valid (has post time data) */
  isValid: boolean;
  /** Race number for display */
  raceNumber?: number;
  /** Variant: 'compact' for top bar, 'full' for race card */
  variant?: 'compact' | 'full';
  /** Show detailed race time info on click */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
}

export const PostTimeCountdown = memo(function PostTimeCountdown({
  countdown,
  postTimeFormatted,
  isValid,
  raceNumber,
  variant = 'compact',
  onClick,
  className = '',
}: PostTimeCountdownProps) {
  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  if (!isValid) {
    return (
      <div className={`post-time-countdown ${variant} inactive ${className}`}>
        <span className="material-icons countdown-icon">schedule</span>
        <span className="countdown-text">--:--</span>
      </div>
    );
  }

  const shouldPulse = countdown.isCritical && !countdown.isExpired;

  return (
    <motion.div
      className={`post-time-countdown ${variant} ${countdown.colorClass} ${className}`}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      {/* Timer icon with pulse animation when critical */}
      <motion.span
        className={`material-icons countdown-icon ${shouldPulse ? 'pulsing' : ''}`}
        animate={shouldPulse ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      >
        {countdown.isExpired ? 'sports_score' : 'timer'}
      </motion.span>

      {variant === 'compact' ? (
        // Compact variant for top bar
        <div className="countdown-compact-content">
          {raceNumber && <span className="countdown-race">Race {raceNumber}</span>}
          <span className="countdown-separator">|</span>
          <span className="countdown-label">Post in</span>
          <span className="countdown-value">{countdown.shortFormatted}</span>
        </div>
      ) : (
        // Full variant for race card
        <div className="countdown-full-content">
          <div className="countdown-main">
            <span className="countdown-label">Post Time:</span>
            <span className="countdown-time">{postTimeFormatted}</span>
          </div>
          <div className="countdown-remaining">
            <span className="countdown-in">(in</span>
            <span className="countdown-value">{countdown.formatted}</span>
            <span className="countdown-in">)</span>
          </div>
        </div>
      )}
    </motion.div>
  );
});

// ============================================
// PostTimeProgressBar - Visual progress indicator
// ============================================

interface PostTimeProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Color class based on time remaining */
  colorClass: CountdownState['colorClass'];
  /** Show percentage label */
  showLabel?: boolean;
  /** Additional CSS class */
  className?: string;
}

export const PostTimeProgressBar = memo(function PostTimeProgressBar({
  progress,
  colorClass,
  showLabel = false,
  className = '',
}: PostTimeProgressBarProps) {
  return (
    <div className={`post-time-progress ${colorClass} ${className}`}>
      <div className="post-time-progress-track">
        <motion.div
          className="post-time-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>
      {showLabel && <span className="post-time-progress-label">{Math.round(progress)}%</span>}
    </div>
  );
});

// ============================================
// TopBarCountdown - Specialized for top bar integration
// ============================================

interface TopBarCountdownProps {
  countdown: CountdownState;
  raceNumber?: number;
  isValid: boolean;
  onClick?: () => void;
}

export const TopBarCountdown = memo(function TopBarCountdown({
  countdown,
  raceNumber,
  isValid,
  onClick,
}: TopBarCountdownProps) {
  if (!isValid) {
    return null;
  }

  const shouldPulse = countdown.isCritical && !countdown.isExpired;

  return (
    <motion.button
      className={`topbar-countdown ${countdown.colorClass}`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      aria-label={`Post time countdown: ${countdown.formatted}`}
    >
      <motion.span
        className={`material-icons topbar-countdown-icon ${shouldPulse ? 'pulsing' : ''}`}
        animate={
          shouldPulse
            ? {
                scale: [1, 1.15, 1],
                opacity: [1, 0.7, 1],
              }
            : {}
        }
        transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {countdown.isExpired ? 'sports_score' : 'timer'}
      </motion.span>

      <div className="topbar-countdown-content">
        {raceNumber && (
          <>
            <span className="topbar-countdown-race">Race {raceNumber}</span>
            <span className="topbar-countdown-divider">|</span>
          </>
        )}
        <span className="topbar-countdown-label">Post in</span>
        <span className="topbar-countdown-value">{countdown.shortFormatted}</span>
      </div>
    </motion.button>
  );
});

// ============================================
// RaceCardCountdown - Specialized for race overview card
// ============================================

interface RaceCardCountdownProps {
  countdown: CountdownState;
  postTimeFormatted: string;
  isValid: boolean;
}

export const RaceCardCountdown = memo(function RaceCardCountdown({
  countdown,
  postTimeFormatted,
  isValid,
}: RaceCardCountdownProps) {
  if (!isValid) {
    return (
      <div className="race-card-countdown inactive">
        <div className="race-card-countdown-header">
          <span className="material-icons">schedule</span>
          <span className="race-card-countdown-label">Post Time</span>
        </div>
        <div className="race-card-countdown-time">--:--</div>
        <PostTimeProgressBar progress={0} colorClass="normal" />
      </div>
    );
  }

  const shouldPulse = countdown.isCritical && !countdown.isExpired;

  return (
    <div className={`race-card-countdown ${countdown.colorClass}`}>
      <div className="race-card-countdown-header">
        <motion.span
          className={`material-icons ${shouldPulse ? 'pulsing' : ''}`}
          animate={shouldPulse ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        >
          {countdown.isExpired ? 'sports_score' : 'timer'}
        </motion.span>
        <span className="race-card-countdown-label">Post Time</span>
      </div>

      <div className="race-card-countdown-display">
        <span className="race-card-countdown-time">{postTimeFormatted}</span>
        <span className="race-card-countdown-remaining">
          (in <strong>{countdown.formatted}</strong>)
        </span>
      </div>

      <PostTimeProgressBar progress={countdown.progress} colorClass={countdown.colorClass} />

      <AnimatePresence>
        {countdown.isImminent && !countdown.isExpired && (
          <motion.div
            className="race-card-countdown-urgent"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="material-icons">warning</span>
            <span>Betting closes soon!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// PostTimeDetailModal - Detailed time info modal
// ============================================

interface PostTimeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  countdown: CountdownState;
  postTimeFormatted: string;
  raceNumber?: number;
  trackName?: string;
}

export const PostTimeDetailModal = memo(function PostTimeDetailModal({
  isOpen,
  onClose,
  countdown,
  postTimeFormatted,
  raceNumber,
  trackName,
}: PostTimeDetailModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="post-time-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="post-time-modal"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="post-time-modal-header">
            <div className="post-time-modal-title">
              <span className="material-icons">schedule</span>
              <span>Race Time Details</span>
            </div>
            <button className="post-time-modal-close" onClick={onClose}>
              <span className="material-icons">close</span>
            </button>
          </div>

          <div className="post-time-modal-content">
            {trackName && (
              <div className="post-time-modal-track">
                <span className="material-icons">location_on</span>
                <span>{trackName}</span>
              </div>
            )}

            {raceNumber && (
              <div className="post-time-modal-race">
                <span className="label">Race</span>
                <span className="value">{raceNumber}</span>
              </div>
            )}

            <div className="post-time-modal-post">
              <span className="label">Post Time</span>
              <span className="value">{postTimeFormatted}</span>
            </div>

            <div className={`post-time-modal-countdown ${countdown.colorClass}`}>
              <span className="label">Time Until Post</span>
              <span className="value">{countdown.formatted}</span>
            </div>

            <PostTimeProgressBar
              progress={countdown.progress}
              colorClass={countdown.colorClass}
              showLabel
            />

            {countdown.isCritical && !countdown.isExpired && (
              <div className="post-time-modal-warning">
                <span className="material-icons">warning</span>
                <span>
                  {countdown.isImminent
                    ? 'Race starting soon! Finalize your bets now.'
                    : 'Less than 5 minutes until post time.'}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default PostTimeCountdown;
