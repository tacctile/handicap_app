/**
 * ShareControls Component
 *
 * Admin controls for managing live session sharing.
 * Allows starting/stopping sharing and copying the share link.
 */

import React, { useState, useCallback } from 'react';
import type { DaySession } from '../../../lib/betting/daySession';
import type { LiveSession } from '../../../lib/supabase';
import './ShareControls.css';

interface ShareControlsProps {
  /** The current day session */
  daySession: DaySession;
  /** Track code for the session */
  trackCode?: string;
  /** Whether sharing is available (Supabase configured) */
  isAvailable: boolean;
  /** Whether currently sharing */
  isSharing: boolean;
  /** Current live session (if sharing) */
  liveSession: LiveSession | null;
  /** Share URL */
  shareUrl: string | null;
  /** Whether operations are loading */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Callback to start sharing */
  onStartSharing: () => Promise<void>;
  /** Callback to stop sharing */
  onStopSharing: () => Promise<void>;
}

export const ShareControls: React.FC<ShareControlsProps> = ({
  isAvailable,
  isSharing,
  liveSession,
  shareUrl,
  isLoading,
  error,
  onStartSharing,
  onStopSharing,
}) => {
  const [copied, setCopied] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareUrl]);

  // Share via native share API (mobile)
  const handleNativeShare = useCallback(async () => {
    if (!shareUrl || !liveSession) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Furlong Picks',
          text: `Check out my picks for ${liveSession.trackName}!`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback to copy
      handleCopyLink();
    }
    setShowShareOptions(false);
  }, [shareUrl, liveSession, handleCopyLink]);

  // Share via SMS
  const handleShareSMS = useCallback(() => {
    if (!shareUrl || !liveSession) return;
    const text = encodeURIComponent(
      `Check out my picks for ${liveSession.trackName}! ${shareUrl}`
    );
    window.open(`sms:?body=${text}`, '_blank');
    setShowShareOptions(false);
  }, [shareUrl, liveSession]);

  // Share via email
  const handleShareEmail = useCallback(() => {
    if (!shareUrl || !liveSession) return;
    const subject = encodeURIComponent(`My Picks for ${liveSession.trackName}`);
    const body = encodeURIComponent(
      `Check out my picks for today!\n\n${shareUrl}\n\nUpdates in real-time as I adjust odds and mark scratches.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShowShareOptions(false);
  }, [shareUrl, liveSession]);

  // If Supabase is not configured, show disabled state
  if (!isAvailable) {
    return (
      <div className="share-controls share-controls--unavailable">
        <div className="share-controls__header">
          <span className="share-controls__icon">📡</span>
          <span className="share-controls__title">LIVE SHARING</span>
        </div>
        <div className="share-controls__unavailable-message">
          Live sharing requires Supabase configuration.
          <br />
          <span className="share-controls__unavailable-hint">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.
          </span>
        </div>
      </div>
    );
  }

  // Not sharing yet
  if (!isSharing) {
    return (
      <div className="share-controls share-controls--inactive">
        <div className="share-controls__header">
          <span className="share-controls__icon">📡</span>
          <span className="share-controls__title">SHARE WITH FRIENDS</span>
        </div>

        <p className="share-controls__description">
          Let your friends see your picks in real-time on their phones.
          When you update odds or mark scratches, their screens update instantly.
        </p>

        {error && (
          <div className="share-controls__error">
            <span className="material-icons">error</span>
            {error}
          </div>
        )}

        <button
          className="share-controls__start-btn"
          onClick={onStartSharing}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="share-controls__spinner"></span>
              <span>Starting...</span>
            </>
          ) : (
            <>
              <span className="share-controls__status-dot share-controls__status-dot--inactive"></span>
              <span>START SHARING</span>
              <span className="material-icons">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Currently sharing
  const expiresAt = liveSession ? new Date(liveSession.expiresAt) : null;
  const expiresFormatted = expiresAt
    ? expiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Unknown';

  return (
    <div className="share-controls share-controls--active">
      <div className="share-controls__header">
        <div className="share-controls__header-left">
          <span className="share-controls__icon">📡</span>
          <span className="share-controls__title">LIVE SHARING</span>
        </div>
        <button
          className="share-controls__stop-btn"
          onClick={onStopSharing}
          disabled={isLoading}
        >
          {isLoading ? 'Stopping...' : 'STOP'}
        </button>
      </div>

      <div className="share-controls__status">
        <span className="share-controls__status-dot share-controls__status-dot--active"></span>
        <span className="share-controls__status-text">SHARING ACTIVE</span>
        {liveSession && liveSession.viewerCount > 0 && (
          <span className="share-controls__viewer-count">
            {liveSession.viewerCount} viewer{liveSession.viewerCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className="share-controls__description">
        Share this link with your friends:
      </p>

      <div className="share-controls__link-container">
        <input
          type="text"
          className="share-controls__link-input"
          value={shareUrl || ''}
          readOnly
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          className={`share-controls__copy-btn ${copied ? 'share-controls__copy-btn--copied' : ''}`}
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <span className="material-icons">check</span>
              <span>COPIED</span>
            </>
          ) : (
            <>
              <span className="material-icons">content_copy</span>
              <span>COPY</span>
            </>
          )}
        </button>
      </div>

      <div className="share-controls__share-options">
        <button
          className="share-controls__share-btn"
          onClick={() => setShowShareOptions(!showShareOptions)}
        >
          <span className="material-icons">share</span>
          <span>SHARE</span>
        </button>

        {showShareOptions && (
          <div className="share-controls__share-menu">
            {'share' in navigator && (
              <button onClick={handleNativeShare}>
                <span className="material-icons">share</span>
                Share...
              </button>
            )}
            <button onClick={handleShareSMS}>
              <span className="material-icons">sms</span>
              Text Message
            </button>
            <button onClick={handleShareEmail}>
              <span className="material-icons">email</span>
              Email
            </button>
            <button onClick={handleCopyLink}>
              <span className="material-icons">content_copy</span>
              Copy Link
            </button>
          </div>
        )}
      </div>

      <p className="share-controls__hint">
        When you update odds or mark scratches, your friends see it instantly.
      </p>

      <div className="share-controls__expires">
        Expires: {expiresFormatted} today
      </div>

      {error && (
        <div className="share-controls__error">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}
    </div>
  );
};

export default ShareControls;
