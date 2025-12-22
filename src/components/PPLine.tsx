import React from 'react';
import './PPLine.css';
import type { PastPerformance, RunningLine } from '../types/drf';
import { formatRacingDistance } from '../utils/formatters';

interface PPLineProps {
  pp: PastPerformance;
  index: number; // For alternating row colors
}

export const PPLine: React.FC<PPLineProps> = ({ pp, index }) => {
  // TEMPORARY DEBUG - Remove after diagnostic
  if (index === 0) {
    console.log('PP Object - All Fields:', Object.keys(pp));
    console.log('PP Object - Full Data:', JSON.stringify(pp, null, 2).slice(0, 2000));
    console.log('PP Target Fields:', {
      finalTime: pp.finalTime,
      finalTimeFormatted: pp.finalTimeFormatted,
      daysSinceLast: pp.daysSinceLast,
      equipment: pp.equipment,
      medication: pp.medication,
    });
  }
  // Format date using industry standard: "9Aug25" (day + 3-letter month + 2-digit year)
  const formatDate = (dateStr: string | number | undefined): string => {
    if (!dateStr) return '—';

    // Convert to string
    const str = String(dateStr).trim();

    // If empty or just whitespace
    if (!str || str === 'undefined' || str === 'null') return '—';

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Try parsing as ISO date or standard date
    try {
      // Handle YYYYMMDD format (e.g., "20240809")
      if (/^\d{8}$/.test(str)) {
        const year = str.slice(2, 4);
        const monthIdx = parseInt(str.slice(4, 6), 10) - 1;
        const day = parseInt(str.slice(6, 8), 10); // No leading zero
        const month = months[monthIdx] || '???';
        return `${day}${month}${year}`;
      }

      // Handle YYYY-MM-DD or MM/DD/YYYY
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const month = months[date.getMonth()];
        const day = date.getDate(); // No leading zero
        const year = String(date.getFullYear()).slice(-2);
        return `${day}${month}${year}`;
      }

      // If already formatted like "9Aug25", return as-is
      if (/^\d{1,2}[A-Za-z]{3}\d{2}/.test(str)) {
        return str.slice(0, 7);
      }

      // Fallback: return first 8 chars
      return str.slice(0, 8) || '—';
    } catch {
      return '—';
    }
  };

  // Safe track display
  const formatTrack = (track: unknown): string => {
    if (!track || track === 'undefined' || track === 'null' || track === 'NaN') return '—';
    const str = String(track).trim();
    if (!str || str.toLowerCase() === 'nan') return '—';
    return str.toUpperCase().slice(0, 3);
  };

  // Distance formatting now uses centralized formatRacingDistance from utils/formatters

  // Format track condition using industry standard abbreviations (Equibase/DRF)
  // ft=fast, gd=good, sy=sloppy, my=muddy, fm=firm, yl=yielding, sf=soft, hy=heavy, wf=wet fast
  const formatCondition = (condition: string): string => {
    if (!condition) return '—';
    const abbrevs: Record<string, string> = {
      fast: 'ft',
      good: 'gd',
      sloppy: 'sy',
      muddy: 'my',
      firm: 'fm',
      yielding: 'yl',
      soft: 'sf',
      heavy: 'hy',
      'wet fast': 'wf',
      slow: 'sl',
    };
    return abbrevs[condition.toLowerCase()] || condition.slice(0, 2).toLowerCase();
  };

  // Format class: "ALW65K", "MSW", "CLM25K", "G1"
  const formatClass = (ppData: PastPerformance): string => {
    const classification = ppData.classification || '';
    const purse = ppData.purse || 0;
    const claiming = ppData.claimingPrice;

    // Grade stakes
    if (classification.toLowerCase().includes('grade') || classification.match(/g[1-3]/i)) {
      return classification.toUpperCase().slice(0, 6);
    }

    // Claiming
    if (claiming) {
      return `CLM${Math.round(claiming / 1000)}K`;
    }

    // Allowance
    if (
      classification.toLowerCase().includes('allowance') ||
      classification.toLowerCase() === 'alw'
    ) {
      const purseK = purse >= 1000 ? Math.round(purse / 1000) + 'K' : purse;
      return `ALW${purseK}`;
    }

    // Maiden Special Weight
    if (classification.toLowerCase().includes('maiden special')) {
      return 'MSW';
    }

    // Maiden Claiming
    if (classification.toLowerCase().includes('maiden claim')) {
      return `MCL${claiming ? Math.round(claiming / 1000) + 'K' : ''}`;
    }

    // Stakes
    if (classification.toLowerCase().includes('stakes')) {
      return 'STK';
    }

    // Fallback
    return classification.slice(0, 7).toUpperCase() || '—';
  };

  // Format finish: "2/10" (position/field)
  const formatFinish = (position: number, fieldSize: number): string => {
    if (!position) return '—';
    return `${position}/${fieldSize || '?'}`;
  };

  // Format odds: "4.5", "12", "*1.2" (favorite)
  const formatOdds = (odds: number | null, favRank?: number | null): string => {
    if (odds === null || odds === undefined) return '—';
    const prefix = favRank === 1 ? '*' : '';
    return prefix + (odds < 10 ? odds.toFixed(1) : Math.round(odds).toString());
  };

  // Convert regular digits to Unicode superscript digits
  const toSuperscript = (str: string): string => {
    const superMap: Record<string, string> = {
      '0': '⁰',
      '1': '¹',
      '2': '²',
      '3': '³',
      '4': '⁴',
      '5': '⁵',
      '6': '⁶',
      '7': '⁷',
      '8': '⁸',
      '9': '⁹',
      '.': '·',
      '/': '⁄',
      '-': '⁻',
    };
    return str
      .split('')
      .map((c) => superMap[c] || c)
      .join('');
  };

  // Format lengths with superscript notation for running line display
  // e.g., 3.5 lengths behind becomes "³·⁵" or "3½"
  const formatLengthsSuper = (lengths: unknown): string => {
    if (lengths === null || lengths === undefined) return '';
    const num = Number(lengths);
    if (isNaN(num) || num === 0) return '';

    // For very large margins, don't clutter the display
    if (num > 20) return '';

    // Common text abbreviations (head, neck, nose)
    const l = String(lengths).toLowerCase().trim();
    if (l === 'head' || l === 'hd') return 'ʰᵈ';
    if (l === 'neck' || l === 'nk') return 'ⁿᵏ';
    if (l === 'nose' || l === 'ns') return 'ⁿˢ';

    // Format common fractions
    if (num === 0.5) return '½';
    if (num === 0.25) return '¼';
    if (num === 0.75) return '¾';

    // For small whole numbers with fractions, use superscript
    const whole = Math.floor(num);
    const frac = num - whole;

    if (frac === 0) {
      // Whole number only - use superscript
      return toSuperscript(String(whole));
    } else if (frac === 0.5) {
      return whole > 0 ? `${toSuperscript(String(whole))}½` : '½';
    } else if (frac === 0.25) {
      return whole > 0 ? `${toSuperscript(String(whole))}¼` : '¼';
    } else if (frac === 0.75) {
      return whole > 0 ? `${toSuperscript(String(whole))}¾` : '¾';
    } else {
      // Arbitrary decimal - use full superscript
      return toSuperscript(num.toFixed(1));
    }
  };

  // Format a single running line position with optional lengths margin
  const formatPositionWithMargin = (
    position: number | null | undefined,
    lengths: number | null | undefined
  ): string => {
    if (position === null || position === undefined || isNaN(Number(position))) return '';

    const pos = String(position);
    const len = formatLengthsSuper(lengths);

    // Show position with superscript lengths if available and reasonable
    if (len) {
      return `${pos}${len}`;
    }
    return pos;
  };

  // Format running line properly - shows call positions like "8 9 7 6 4"
  const formatRunningLine = (rl: RunningLine | null | undefined | unknown): string => {
    if (!rl) return '—';

    // If it's a string, it might already be formatted
    if (typeof rl === 'string') {
      const cleaned = rl.trim();
      if (cleaned && cleaned !== 'undefined' && cleaned !== 'null') {
        return cleaned.slice(0, 22);
      }
      return '—';
    }

    // If it's an object with position properties
    const rlObj = rl as RunningLine;
    const calls: string[] = [];

    // Start position (no lengths displayed)
    if (rlObj.start !== null && rlObj.start !== undefined && !isNaN(Number(rlObj.start))) {
      calls.push(String(rlObj.start));
    }

    // First call (quarter mile for sprints)
    const firstCall = formatPositionWithMargin(rlObj.quarterMile, rlObj.quarterMileLengths);
    if (firstCall) calls.push(firstCall);

    // Second call (half mile)
    const secondCall = formatPositionWithMargin(rlObj.halfMile, rlObj.halfMileLengths);
    if (secondCall) calls.push(secondCall);

    // Third call (three quarters - for routes)
    const thirdCall = formatPositionWithMargin(rlObj.threeQuarters, rlObj.threeQuartersLengths);
    if (thirdCall) calls.push(thirdCall);

    // Stretch call
    const stretchCall = formatPositionWithMargin(rlObj.stretch, rlObj.stretchLengths);
    if (stretchCall) calls.push(stretchCall);

    // Finish position
    const finishCall = formatPositionWithMargin(rlObj.finish, rlObj.finishLengths);
    if (finishCall) calls.push(finishCall);

    if (calls.length === 0) return '—';

    // Join with spaces for clear separation
    return calls.join(' ').slice(0, 22);
  };

  // Format jockey name: "Rosario J" or "Prat F"
  const formatJockey = (name: string): string => {
    if (!name) return '—';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '—';
    if (parts.length === 1) return (parts[0] || '').slice(0, 10);
    // Last name + first initial
    const lastName = parts[parts.length - 1] || '';
    const firstInitial = (parts[0] || '').charAt(0);
    return `${lastName} ${firstInitial}`.slice(0, 12);
  };

  // Format comment: show more characters
  const formatComment = (tripComment?: string, comment?: string): string => {
    const text = tripComment || comment || '';
    if (!text || text === 'undefined' || text === 'null') return '—';
    const cleaned = String(text).trim();
    return cleaned.slice(0, 50) || '—'; // Increased from 30
  };

  const isEven = index % 2 === 0;

  return (
    <div className={`pp-line ${isEven ? 'pp-line--even' : 'pp-line--odd'}`}>
      <span className="pp-line__col pp-line__col--date">{formatDate(pp.date)}</span>
      <span className="pp-line__col pp-line__col--track">{formatTrack(pp.track)}</span>
      <span className="pp-line__col pp-line__col--dist">
        {formatRacingDistance(pp.distanceFurlongs)}
      </span>
      <span className="pp-line__col pp-line__col--cond">{formatCondition(pp.trackCondition)}</span>
      <span className="pp-line__col pp-line__col--class">{formatClass(pp)}</span>
      <span
        className={`pp-line__col pp-line__col--finish ${pp.finishPosition === 1 ? 'pp-line__col--win' : ''}`}
      >
        {formatFinish(pp.finishPosition, pp.fieldSize)}
      </span>
      <span
        className={`pp-line__col pp-line__col--odds ${pp.favoriteRank === 1 ? 'pp-line__col--fav' : ''}`}
      >
        {formatOdds(pp.odds, pp.favoriteRank)}
      </span>
      <span className="pp-line__col pp-line__col--figure">{pp.speedFigures?.beyer ?? '—'}</span>
      <span className="pp-line__col pp-line__col--running">
        {formatRunningLine(pp.runningLine)}
      </span>
      <span className="pp-line__col pp-line__col--jockey">{formatJockey(pp.jockey)}</span>
      <span className="pp-line__col pp-line__col--weight">{pp.weight || '—'}</span>
      <span
        className="pp-line__col pp-line__col--comment"
        title={pp.tripComment || pp.comment || ''}
      >
        {formatComment(pp.tripComment, pp.comment)}
      </span>
    </div>
  );
};

export default PPLine;
