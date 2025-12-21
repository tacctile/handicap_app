import { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ParsedRace } from '../types/drf';
import type { UseRaceStateReturn } from '../hooks/useRaceState';
import type { UseBankrollReturn } from '../hooks/useBankroll';
import { RaceTable } from './RaceTable';
import {
  getConfidenceColor,
  getConfidenceLabel,
  getConfidenceBgColor,
  getConfidenceBorderColor,
} from '../lib/confidence';
import { getDiamondColor, getDiamondBgColor } from '../lib/diamonds';
import { useAnalytics } from '../hooks/useAnalytics';

interface RaceDetailProps {
  race: ParsedRace;
  confidence: number;
  raceState: UseRaceStateReturn;
  bankroll: UseBankrollReturn;
  diamondCount?: number;
  onBack: () => void;
  onOpenBankrollSettings: () => void;
}

// Diamond alert banner component
const DiamondAlertBanner = memo(function DiamondAlertBanner({ count }: { count: number }) {
  if (count === 0) return null;

  const diamondColor = getDiamondColor();
  const diamondBg = getDiamondBgColor(0.15);

  return (
    <motion.div
      className="diamond-alert-banner"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '10px 16px',
        backgroundColor: diamondBg,
        borderBottom: `2px solid ${diamondColor}`,
        color: diamondColor,
        fontWeight: 700,
        fontSize: '0.9rem',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>💎</span>
      <span>
        {count} Hidden Gem{count > 1 ? 's' : ''} in this race!
      </span>
      <span
        style={{
          backgroundColor: diamondColor,
          color: '#1a1a1a',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 800,
          letterSpacing: '0.5px',
        }}
      >
        RARE VALUE
      </span>
      <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>↓ Scroll to see details</span>
    </motion.div>
  );
});

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

// Confidence badge component
interface ConfidenceBadgeProps {
  confidence: number;
}

const ConfidenceBadge = memo(function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const color = getConfidenceColor(confidence);
  const label = getConfidenceLabel(confidence);
  const bgColor = getConfidenceBgColor(confidence);
  const borderColor = getConfidenceBorderColor(confidence);

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
  );
});

export const RaceDetail = memo(function RaceDetail({
  race,
  confidence,
  raceState,
  bankroll,
  diamondCount = 0,
  onBack,
  onOpenBankrollSettings,
}: RaceDetailProps) {
  const { header } = race;
  const { trackEvent } = useAnalytics();
  const lastTrackedRace = useRef<number | null>(null);

  // Track race_analyzed when user views this race detail
  useEffect(() => {
    // Only track if this is a new race (not a re-render of the same race)
    if (lastTrackedRace.current !== header.raceNumber) {
      trackEvent('race_analyzed', {
        race_number: header.raceNumber,
        horse_count: race.horses.length,
        surface: header.surface,
        distance: header.distance,
        confidence,
      });
      lastTrackedRace.current = header.raceNumber;
    }
  }, [
    header.raceNumber,
    race.horses.length,
    header.surface,
    header.distance,
    confidence,
    trackEvent,
  ]);

  // Handle Escape key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Format surface nicely
  const surfaceLabel = header.surface.charAt(0).toUpperCase() + header.surface.slice(1);

  return (
    <motion.div
      className="race-detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Diamond alert banner */}
      <AnimatePresence>
        {diamondCount > 0 && <DiamondAlertBanner count={diamondCount} />}
      </AnimatePresence>

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
          <h1 className="race-detail-title">Race {header.raceNumber}</h1>
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
  );
});

export default RaceDetail;
