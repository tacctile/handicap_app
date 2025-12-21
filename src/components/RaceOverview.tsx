import { memo, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ParsedRace, ParsedDRFFile } from '../types/drf';
import type { ScoredHorse } from '../lib/scoring';
import {
  getConfidenceColor,
  getConfidenceLabel,
  getConfidenceBgColor,
  getConfidenceBorderColor,
} from '../lib/confidence';
import { SCORE_THRESHOLDS } from '../lib/scoring';
import { getDiamondColor, getDiamondBgColor } from '../lib/diamonds';

interface RaceOverviewProps {
  parsedData: ParsedDRFFile;
  raceConfidences: Map<number, number>;
  topHorsesByRace: Map<number, ScoredHorse[]>;
  diamondCountByRace?: Map<number, number>;
  eliteConnectionsCountByRace?: Map<number, number>;
  onRaceSelect: (raceIndex: number) => void;
}

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
  size?: 'small' | 'normal';
}

const ConfidenceBadge = memo(function ConfidenceBadge({
  confidence,
  size = 'normal',
}: ConfidenceBadgeProps) {
  const color = getConfidenceColor(confidence);
  const label = getConfidenceLabel(confidence);
  const bgColor = getConfidenceBgColor(confidence);
  const borderColor = getConfidenceBorderColor(confidence);

  return (
    <div
      className={`confidence-badge ${size === 'small' ? 'confidence-badge-small' : ''}`}
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

// Diamond badge component
interface DiamondBadgeProps {
  count: number;
}

const DiamondBadge = memo(function DiamondBadge({ count }: DiamondBadgeProps) {
  if (count === 0) return null;

  return (
    <div
      className="diamond-badge"
      style={{
        backgroundColor: getDiamondBgColor(0.2),
        borderColor: getDiamondColor(),
        color: getDiamondColor(),
      }}
      title={`${count} Hidden Gem${count > 1 ? 's' : ''} in this race`}
    >
      <span className="diamond-badge-icon">💎</span>
      {count > 1 && <span className="diamond-badge-count">{count}</span>}
    </div>
  );
});

// Elite Connections badge component
interface EliteConnectionsBadgeProps {
  count: number;
}

const EliteConnectionsBadge = memo(function EliteConnectionsBadge({
  count,
}: EliteConnectionsBadgeProps) {
  if (count === 0) return null;

  return (
    <div
      className="elite-connections-badge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: '#22c55e20',
        borderColor: '#22c55e',
        color: '#22c55e',
        padding: '2px 8px',
        borderRadius: '12px',
        border: '1px solid',
        fontSize: '0.7rem',
        fontWeight: 600,
      }}
      title={`${count} horse${count > 1 ? 's' : ''} with elite connections (30+ pts)`}
    >
      <span style={{ fontSize: '0.9rem' }}>🤝</span>
      {count > 1 && <span>{count}</span>}
    </div>
  );
});

// Race card component
interface RaceCardProps {
  race: ParsedRace;
  raceIndex: number;
  confidence: number;
  topHorses: ScoredHorse[];
  scratchedCount: number;
  diamondCount: number;
  eliteConnectionsCount: number;
  onClick: () => void;
}

const RaceCard = memo(function RaceCard({
  race,
  raceIndex,
  confidence,
  topHorses,
  scratchedCount,
  diamondCount,
  eliteConnectionsCount,
  onClick,
}: RaceCardProps) {
  const { header, horses } = race;
  const activeCount = horses.length - scratchedCount;

  // Check if there's a Tier 1 pick (180+ points)
  const hasTier1Pick = topHorses.some((h) => h.score.total >= SCORE_THRESHOLDS.strong);

  // Check for diamonds
  const hasDiamonds = diamondCount > 0;

  // Check for elite connections
  const hasEliteConnections = eliteConnectionsCount > 0;

  // Format surface nicely
  const surfaceLabel = header.surface.charAt(0).toUpperCase() + header.surface.slice(1);

  // Get race class/type abbreviation
  const classLabel = header.classification || header.raceType || '';

  return (
    <motion.button
      className={`race-card ${hasTier1Pick ? 'race-card-has-tier1' : ''} ${hasDiamonds ? 'race-card-has-diamonds' : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: raceIndex * 0.05 }}
      aria-label={`Race ${header.raceNumber}: ${header.distance} ${surfaceLabel}. ${confidence}% confidence. Click to view details.`}
    >
      {/* Race number badge */}
      <div className="race-card-number">
        <span>R{header.raceNumber}</span>
      </div>

      {/* Main content */}
      <div className="race-card-content">
        {/* Race info row */}
        <div className="race-card-info">
          <div className="race-card-distance">
            <Icon name="route" className="race-card-icon" />
            <span>{header.distance}</span>
          </div>
          <div className="race-card-surface">
            <Icon name="terrain" className="race-card-icon" />
            <span>{surfaceLabel}</span>
          </div>
        </div>

        {/* Class and purse */}
        <div className="race-card-details">
          {classLabel && <span className="race-card-class">{classLabel}</span>}
          {header.purseFormatted && (
            <span className="race-card-purse">{header.purseFormatted}</span>
          )}
        </div>

        {/* Horse count */}
        <div className="race-card-horses">
          <Icon name="pets" className="race-card-icon" />
          <span className="tabular-nums">
            {activeCount}
            {scratchedCount > 0 && <span className="race-card-scratched">/{horses.length}</span>}
          </span>
          <span className="race-card-horses-label">horses</span>
        </div>

        {/* Top pick preview (if available) */}
        {topHorses.length > 0 && topHorses[0].score.total >= SCORE_THRESHOLDS.fair && (
          <div className="race-card-top-pick">
            <Icon name="star" className="race-card-star" />
            <span className="race-card-top-name">
              {topHorses[0].horse.horseName.slice(0, 12)}
              {topHorses[0].horse.horseName.length > 12 ? '...' : ''}
            </span>
            <span className="race-card-top-score tabular-nums">{topHorses[0].score.total}</span>
          </div>
        )}
      </div>

      {/* Confidence badge */}
      <div className="race-card-confidence">
        <ConfidenceBadge confidence={confidence} />
      </div>

      {/* Diamond indicator */}
      {hasDiamonds && (
        <div className="race-card-diamond-indicator">
          <DiamondBadge count={diamondCount} />
        </div>
      )}

      {/* Elite Connections indicator */}
      {hasEliteConnections && (
        <div
          className="race-card-elite-connections-indicator"
          style={{
            position: 'absolute',
            bottom: hasDiamonds ? '36px' : '8px',
            right: '8px',
          }}
        >
          <EliteConnectionsBadge count={eliteConnectionsCount} />
        </div>
      )}

      {/* Tier 1 indicator */}
      {hasTier1Pick && (
        <div className="race-card-tier1-indicator" title="Tier 1 pick available">
          <Icon name="trending_up" />
        </div>
      )}

      {/* Click hint */}
      <div className="race-card-chevron">
        <Icon name="chevron_right" />
      </div>
    </motion.button>
  );
});

export const RaceOverview = memo(function RaceOverview({
  parsedData,
  raceConfidences,
  topHorsesByRace,
  diamondCountByRace,
  eliteConnectionsCountByRace,
  onRaceSelect,
}: RaceOverviewProps) {
  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Number keys 1-9 for quick race selection
      const num = parseInt(e.key);
      if (num >= 1 && num <= parsedData.races.length) {
        onRaceSelect(num - 1);
      }
    },
    [parsedData.races.length, onRaceSelect]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Summary stats
  const stats = useMemo(() => {
    let totalHorses = 0;
    let tier1Races = 0;
    let totalDiamonds = 0;
    let totalEliteConnections = 0;

    parsedData.races.forEach((race, index) => {
      totalHorses += race.horses.length;
      const topHorses = topHorsesByRace.get(index) || [];
      if (topHorses.some((h) => h.score.total >= SCORE_THRESHOLDS.strong)) {
        tier1Races++;
      }
      totalDiamonds += diamondCountByRace?.get(index) || 0;
      totalEliteConnections += eliteConnectionsCountByRace?.get(index) || 0;
    });

    return { totalHorses, tier1Races, totalDiamonds, totalEliteConnections };
  }, [parsedData.races, topHorsesByRace, diamondCountByRace, eliteConnectionsCountByRace]);

  return (
    <div className="race-overview">
      {/* Header */}
      <div className="race-overview-header">
        <div className="race-overview-title">
          <Icon name="view_module" className="race-overview-icon" />
          <h2>Race Overview</h2>
        </div>
        <div className="race-overview-stats">
          <span className="race-overview-stat">
            <span className="tabular-nums">{parsedData.races.length}</span> races
          </span>
          <span className="race-overview-stat-divider">•</span>
          <span className="race-overview-stat">
            <span className="tabular-nums">{stats.totalHorses}</span> horses
          </span>
          {stats.tier1Races > 0 && (
            <>
              <span className="race-overview-stat-divider">•</span>
              <span className="race-overview-stat race-overview-stat-tier1">
                <Icon name="trending_up" className="race-overview-tier1-icon" />
                <span className="tabular-nums">{stats.tier1Races}</span> Tier 1
              </span>
            </>
          )}
          {stats.totalDiamonds > 0 && (
            <>
              <span className="race-overview-stat-divider">•</span>
              <span
                className="race-overview-stat race-overview-stat-diamonds"
                style={{ color: getDiamondColor() }}
              >
                <span className="race-overview-diamond-icon">💎</span>
                <span className="tabular-nums">{stats.totalDiamonds}</span> Hidden Gem
                {stats.totalDiamonds > 1 ? 's' : ''}
              </span>
            </>
          )}
          {stats.totalEliteConnections > 0 && (
            <>
              <span className="race-overview-stat-divider">•</span>
              <span
                className="race-overview-stat race-overview-stat-connections"
                style={{ color: '#22c55e' }}
              >
                <span style={{ marginRight: '4px' }}>🤝</span>
                <span className="tabular-nums">{stats.totalEliteConnections}</span> Elite Connection
                {stats.totalEliteConnections > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="race-overview-hint">
        <Icon name="keyboard" className="race-overview-hint-icon" />
        <span>Press 1-{Math.min(9, parsedData.races.length)} for quick access</span>
      </div>

      {/* Race grid */}
      <div className="race-overview-grid">
        <AnimatePresence>
          {parsedData.races.map((race, index) => (
            <RaceCard
              key={index}
              race={race}
              raceIndex={index}
              confidence={raceConfidences.get(index) || 0}
              topHorses={topHorsesByRace.get(index) || []}
              scratchedCount={0}
              diamondCount={diamondCountByRace?.get(index) || 0}
              eliteConnectionsCount={eliteConnectionsCountByRace?.get(index) || 0}
              onClick={() => onRaceSelect(index)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default RaceOverview;
