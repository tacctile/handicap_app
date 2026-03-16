/**
 * TwinSpiresConnector
 *
 * Self-contained component for connecting to TwinSpires live odds.
 * Renders a URL input, connect/disconnect button, and status indicator.
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import type { TwinSpiresConnectionStatus } from '../services/twinspires/types';
import { extractTrackInfoFromUrl } from '../services/twinspires/mapper';

// ============================================================================
// STYLES (scoped with ts- prefix)
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flex: '1 1 auto',
  } as React.CSSProperties,
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '1 1 auto',
    minWidth: 0,
  } as React.CSSProperties,
  input: {
    flex: '1 1 auto',
    minWidth: 0,
    height: '32px',
    padding: '0 8px',
    backgroundColor: '#1A1A1C',
    border: '1px solid #2A2A2C',
    borderRadius: '4px',
    color: '#EEEFF1',
    fontSize: '12px',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  } as React.CSSProperties,
  inputError: {
    borderColor: '#ef4444',
  } as React.CSSProperties,
  button: {
    flexShrink: 0,
    height: '32px',
    padding: '0 12px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  connectButton: {
    backgroundColor: '#19abb5',
    color: '#ffffff',
  } as React.CSSProperties,
  disconnectButton: {
    backgroundColor: '#3A3A3C',
    color: '#EEEFF1',
  } as React.CSSProperties,
  statusWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
    fontSize: '11px',
    fontFamily: 'Inter, sans-serif',
    color: '#B4B4B6',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
  errorText: {
    color: '#ef4444',
    fontSize: '11px',
    marginTop: '2px',
  } as React.CSSProperties,
} as const;

// Pulsing animation for live dot — CSS keyframes injected once
const PULSE_KEYFRAMES_ID = 'ts-pulse-keyframes';
function ensurePulseKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_KEYFRAMES_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = PULSE_KEYFRAMES_ID;
  styleEl.textContent = `
    @keyframes ts-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(styleEl);
}

// ============================================================================
// STATUS DOT COLORS
// ============================================================================

function getStatusDotStyle(status: TwinSpiresConnectionStatus): React.CSSProperties {
  const base = { ...styles.dot };
  switch (status) {
    case 'polling':
      return { ...base, backgroundColor: '#10b981', animation: 'ts-pulse 2s ease-in-out infinite' };
    case 'connecting':
      return { ...base, backgroundColor: '#f59e0b' };
    case 'error':
      return { ...base, backgroundColor: '#ef4444' };
    case 'paused':
    case 'disconnected':
    default:
      return { ...base, backgroundColor: '#6E6E70' };
  }
}

// ============================================================================
// PROPS
// ============================================================================

interface TwinSpiresConnectorProps {
  status: TwinSpiresConnectionStatus;
  lastUpdated: number | null;
  error: string | null;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TwinSpiresConnector = memo(function TwinSpiresConnector({
  status,
  lastUpdated,
  error,
  onConnect,
  onDisconnect,
}: TwinSpiresConnectorProps) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inject pulse keyframes on mount
  useEffect(() => {
    ensurePulseKeyframes();
  }, []);

  // Update "X seconds ago" timer every second when polling
  useEffect(() => {
    if (status === 'polling' && lastUpdated !== null) {
      const tick = () => {
        setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: clearing stale timer display when polling stops
    setSecondsAgo(null);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, lastUpdated]);

  const handleConnect = useCallback(() => {
    setValidationError(null);
    if (!extractTrackInfoFromUrl(url)) {
      setValidationError('Invalid TwinSpires URL format');
      return;
    }
    onConnect(url);
  }, [url, onConnect]);

  const handleDisconnect = useCallback(() => {
    setValidationError(null);
    onDisconnect();
  }, [onDisconnect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConnect();
      }
    },
    [handleConnect]
  );

  const isActive = status === 'polling' || status === 'connecting';

  // Status label text
  let statusLabel = '';
  if (status === 'connecting') {
    statusLabel = 'Connecting...';
  } else if (status === 'polling') {
    statusLabel = secondsAgo !== null ? `Live \u2022 ${secondsAgo}s ago` : 'Live';
  } else if (status === 'error' && error) {
    statusLabel = error.length > 40 ? error.substring(0, 40) + '...' : error;
  } else if (status === 'paused') {
    statusLabel = 'Paused';
  }

  return (
    <div style={styles.container}>
      <div style={styles.inputWrapper}>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setValidationError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste TwinSpires race URL for this track..."
          disabled={isActive}
          style={{
            ...styles.input,
            ...(validationError ? styles.inputError : {}),
            ...(isActive ? { opacity: 0.5 } : {}),
          }}
          aria-label="TwinSpires race URL"
        />
        <button
          type="button"
          onClick={isActive ? handleDisconnect : handleConnect}
          style={{
            ...styles.button,
            ...(isActive ? styles.disconnectButton : styles.connectButton),
          }}
        >
          {isActive ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Status indicator — only show when not disconnected */}
      {status !== 'disconnected' && (
        <div style={styles.statusWrapper}>
          <div style={getStatusDotStyle(status)} />
          <span style={status === 'error' ? { color: '#ef4444' } : undefined}>{statusLabel}</span>
        </div>
      )}

      {/* Validation error */}
      {validationError && <span style={styles.errorText}>{validationError}</span>}
    </div>
  );
});

export default TwinSpiresConnector;
