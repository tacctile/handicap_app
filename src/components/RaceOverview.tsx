import { memo, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ParsedRace, ParsedDRFFile, RaceClassification } from '../types/drf';
import type { ScoredHorse } from '../lib/scoring';
import { analyzeRaceValue, type RaceVerdict } from '../hooks/useValueDetection';

interface RaceOverviewProps {
  parsedData: ParsedDRFFile;
  raceConfidences: Map<number, number>;
  topHorsesByRace: Map<number, ScoredHorse[]>;
  diamondCountByRace?: Map<number, number>;
  eliteConnectionsCountByRace?: Map<number, number>;
  allScoredHorses?: ScoredHorse[][];
  onRaceSelect: (raceIndex: number) => void;
}

/**
 * Get verdict color for badge background
 */
function getVerdictBadgeStyle(verdict: RaceVerdict): { bg: string; text: string; border: string } {
  switch (verdict) {
    case 'BET':
      return {
        bg: '#10b981', // Green
        text: '#ffffff',
        border: '#10b981',
      };
    case 'CAUTION':
      return {
        bg: '#f59e0b', // Amber/Yellow
        text: '#000000',
        border: '#f59e0b',
      };
    case 'PASS':
      return {
        bg: '#6b7280', // Grey
        text: '#ffffff',
        border: '#6b7280',
      };
  }
}

/**
 * Format race classification for display
 * Returns empty string if unknown (to omit rather than show "UNKNOWN")
 */
function formatRaceClass(
  classification: RaceClassification | undefined,
  raceType: string | undefined,
  claimingPriceMin?: number | null,
  claimingPriceMax?: number | null
): string {
  // Try to use raceType first if it's meaningful
  if (raceType && raceType.trim() && raceType.trim().toUpperCase() !== 'UNKNOWN') {
    return raceType.trim();
  }

  // Fall back to classification
  if (!classification || classification === 'unknown') {
    return '';
  }

  // Format claiming price if available
  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${Math.round(price / 1000)}K`;
    }
    return `$${price}`;
  };

  const claimingPrice = claimingPriceMax || claimingPriceMin;

  switch (classification) {
    case 'maiden':
      return 'Maiden';
    case 'maiden-claiming':
      return claimingPrice ? `Maiden Clm ${formatPrice(claimingPrice)}` : 'Maiden Clm';
    case 'claiming':
      return claimingPrice ? `Clm ${formatPrice(claimingPrice)}` : 'Claiming';
    case 'allowance':
      return 'Allowance';
    case 'allowance-optional-claiming':
      return 'AOC';
    case 'starter-allowance':
      return 'Starter Alw';
    case 'stakes':
      return 'Stakes';
    case 'stakes-listed':
      return 'Listed Stakes';
    case 'stakes-graded-1':
      return 'Grade 1';
    case 'stakes-graded-2':
      return 'Grade 2';
    case 'stakes-graded-3':
      return 'Grade 3';
    case 'handicap':
      return 'Handicap';
    default:
      return '';
  }
}

/**
 * Format distance for compact display
 * Converts full distance to abbreviated form (e.g., "6 Furlongs" -> "6F")
 */
function formatDistanceCompact(distance: string | undefined): string {
  if (!distance) return '';

  const d = distance.toLowerCase();

  // Handle mile distances
  if (d.includes('mile')) {
    if (d.includes('1 1/16')) return '1 1/16mi';
    if (d.includes('1 1/8')) return '1⅛mi';
    if (d.includes('1 1/4')) return '1¼mi';
    if (d.includes('1 1/2')) return '1½mi';
    if (d.includes('1 3/16')) return '1 3/16mi';
    if (d.includes('1 3/8')) return '1⅜mi';
    if (d.includes('1 5/8')) return '1⅝mi';
    if (d.includes('1 3/4')) return '1¾mi';
    if (d.includes('2 ')) return '2mi';
    // Plain "1 mile" or "1 Mile"
    if (/^about\s*1\s*mile$/i.test(d.trim()) || /^1\s*mile$/i.test(d.trim())) {
      return '1mi';
    }
    return '1mi';
  }

  // Handle furlong distances
  const furlongMatch = d.match(/(\d+\.?\d*)\s*(f|furlong)/i);
  if (furlongMatch) {
    const furlongs = parseFloat(furlongMatch[1] || '6');
    if (furlongs === Math.floor(furlongs)) {
      return `${Math.floor(furlongs)}F`;
    }
    // Handle half furlongs
    const whole = Math.floor(furlongs);
    const frac = furlongs - whole;
    if (frac >= 0.4 && frac <= 0.6) {
      return `${whole}½F`;
    }
    return `${furlongs}F`;
  }

  // Return as-is if no pattern matched
  return distance;
}

/**
 * Format surface for display
 */
function formatSurface(surface: string | undefined): string {
  if (!surface) return '';
  const s = surface.toLowerCase();
  if (s === 'turf') return 'Turf';
  if (s === 'dirt') return 'Dirt';
  if (s === 'synthetic' || s === 'all-weather') return 'Synth';
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

/**
 * Format age/sex restrictions for display
 */
function formatAgeSex(ageRestriction?: string, sexRestriction?: string): string {
  const parts: string[] = [];

  if (ageRestriction && ageRestriction.trim()) {
    // Compact age formats
    let age = ageRestriction.trim();
    age = age
      .replace(/\s*year\s*old(s)?\s*/gi, 'yo')
      .replace(/\s*years\s*old\s*/gi, 'yo')
      .replace(/\s*&\s*up/gi, '+')
      .replace(/\s*and\s*up/gi, '+');
    parts.push(age);
  }

  if (sexRestriction && sexRestriction.trim()) {
    parts.push(sexRestriction.trim());
  }

  return parts.join(' ');
}

// Verdict badge component
interface VerdictBadgeProps {
  verdict: RaceVerdict;
}

const VerdictBadge = memo(function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const style = getVerdictBadgeStyle(verdict);

  return (
    <div
      className="race-card-verdict-badge"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {verdict}
    </div>
  );
});

// Race card component
interface RaceCardProps {
  race: ParsedRace;
  raceIndex: number;
  topHorses: ScoredHorse[];
  scratchedCount: number;
  verdict: RaceVerdict;
  onClick: () => void;
}

const RaceCard = memo(function RaceCard({
  race,
  raceIndex,
  topHorses,
  scratchedCount,
  verdict,
  onClick,
}: RaceCardProps) {
  const { header, horses } = race;
  const activeCount = horses.length - scratchedCount;

  // Format race conditions line
  const distanceCompact = formatDistanceCompact(header.distance);
  const surfaceLabel = formatSurface(header.surface);
  const classLabel = formatRaceClass(
    header.classification,
    header.raceType,
    header.claimingPriceMin,
    header.claimingPriceMax
  );
  const ageSexLabel = formatAgeSex(header.ageRestriction, header.sexRestriction);

  // Build conditions parts
  const conditionsParts: string[] = [];
  if (distanceCompact) conditionsParts.push(distanceCompact);
  if (surfaceLabel) conditionsParts.push(surfaceLabel);
  if (classLabel) conditionsParts.push(classLabel);
  if (ageSexLabel) conditionsParts.push(ageSexLabel);
  conditionsParts.push(`${activeCount} horses`);

  const conditionsLine = conditionsParts.join(' · ');

  // Get top 3 horses for projected finish - use full names, no truncation
  const projectedFinish = topHorses.slice(0, 3);

  return (
    <motion.button
      className="race-card race-card-redesigned"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: raceIndex * 0.05 }}
      aria-label={`Race ${header.raceNumber}: ${conditionsLine}. ${verdict} verdict. Click to view details.`}
    >
      {/* TOP SECTION: Race number + Verdict badge */}
      <div className="race-card-top-section">
        <div className="race-card-race-number">R{header.raceNumber}</div>
        <VerdictBadge verdict={verdict} />
      </div>

      {/* MIDDLE SECTION: Race Conditions (one line) */}
      <div className="race-card-conditions">{conditionsLine}</div>

      {/* BOTTOM SECTION: Projected Finish */}
      <div className="race-card-projected-finish">
        <div className="race-card-projected-header">FURLONG PROJECTIONS</div>
        <div className="race-card-projected-list">
          {projectedFinish.length > 0 ? (
            projectedFinish.map((horse, idx) => (
              <div key={horse.index} className="race-card-projected-horse">
                <span className="race-card-projected-position">
                  {idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd'}:
                </span>
                <span className="race-card-projected-name">{horse.horse.horseName}</span>
              </div>
            ))
          ) : (
            <div className="race-card-projected-none">No projections available</div>
          )}
        </div>
      </div>

      {/* Click hint - chevron */}
      <div className="race-card-chevron-new">
        <span className="material-icons">chevron_right</span>
      </div>
    </motion.button>
  );
});

export const RaceOverview = memo(function RaceOverview({
  parsedData,
  topHorsesByRace,
  allScoredHorses,
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

  // Calculate verdict for each race using the value detection logic
  const raceVerdicts = useMemo(() => {
    const verdicts = new Map<number, RaceVerdict>();

    parsedData.races.forEach((_, raceIndex) => {
      const scoredHorses = allScoredHorses?.[raceIndex] || [];

      if (scoredHorses.length === 0) {
        verdicts.set(raceIndex, 'PASS');
        return;
      }

      // Use the same value analysis logic as RaceVerdictHeader
      const analysis = analyzeRaceValue(
        scoredHorses,
        (_index, originalOdds) => originalOdds, // Use morning line for overview
        () => false // No scratches for overview
      );

      verdicts.set(raceIndex, analysis.verdict);
    });

    return verdicts;
  }, [parsedData.races, allScoredHorses]);

  return (
    <div className="race-overview race-overview-redesigned">
      {/* Keyboard hint */}
      <div className="race-overview-hint">
        <span className="material-icons race-overview-hint-icon">keyboard</span>
        <span>Press 1-{Math.min(9, parsedData.races.length)} for quick access</span>
      </div>

      {/* Race grid - full width, centered */}
      <div className="race-overview-grid race-overview-grid-redesigned">
        <AnimatePresence>
          {parsedData.races.map((race, index) => (
            <RaceCard
              key={index}
              race={race}
              raceIndex={index}
              topHorses={topHorsesByRace.get(index) || []}
              scratchedCount={0}
              verdict={raceVerdicts.get(index) || 'PASS'}
              onClick={() => onRaceSelect(index)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default RaceOverview;
