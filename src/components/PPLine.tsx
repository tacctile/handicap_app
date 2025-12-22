import React from 'react';
import './PPLine.css';
import type { PastPerformance, RunningLine } from '../types/drf';

interface PPLineProps {
  pp: PastPerformance;
  index: number; // For alternating row colors
}

export const PPLine: React.FC<PPLineProps> = ({ pp, index }) => {
  // Format date: "01/25/24" or "Jan25"
  const formatDate = (dateStr: string | number | undefined): string => {
    if (!dateStr) return '—';

    // Convert to string
    const str = String(dateStr).trim();

    // If empty or just whitespace
    if (!str || str === 'undefined' || str === 'null') return '—';

    // Try parsing as ISO date or standard date
    try {
      // Handle YYYYMMDD format (e.g., "20240125")
      if (/^\d{8}$/.test(str)) {
        const year = str.slice(2, 4);
        const month = str.slice(4, 6);
        const day = str.slice(6, 8);
        return `${month}/${day}/${year}`;
      }

      // Handle YYYY-MM-DD or MM/DD/YYYY
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${month}/${day}/${year}`;
      }

      // If already formatted like "Nov20", return as-is
      if (/^[A-Za-z]{3}\d{2}/.test(str)) {
        return str.slice(0, 5);
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

  // Format distance: "6f", "6½f", "1m", "1⅛m" with proper unicode fractions
  const formatDistance = (furlongs: number, distStr?: string): string => {
    // If we have a string, clean it up with unicode fractions
    if (distStr && typeof distStr === 'string') {
      let cleaned = distStr.trim();

      // Replace common fraction patterns with unicode fractions
      cleaned = cleaned
        .replace('1/2', '½')
        .replace('1/4', '¼')
        .replace('3/4', '¾')
        .replace('1/8', '⅛')
        .replace('3/8', '⅜')
        .replace('5/8', '⅝')
        .replace('7/8', '⅞')
        .replace('1/16', '¹⁄₁₆')
        .replace(' furlongs', 'f')
        .replace(' furlong', 'f')
        .replace('furlongs', 'f')
        .replace('furlong', 'f')
        .replace(' miles', 'm')
        .replace(' mile', 'm')
        .replace('miles', 'm')
        .replace('mile', 'm')
        .replace(' m', 'm')
        .replace(' f', 'f');

      // Remove extra spaces
      cleaned = cleaned.replace(/\s+/g, '');

      return cleaned.slice(0, 8);
    }

    // Convert furlongs number to string with unicode fractions
    if (!furlongs || isNaN(furlongs)) return '—';

    // Common furlong values to miles with fractions
    if (furlongs === 6.125) return '6⅛m';
    if (furlongs === 6.25) return '6¼m';
    if (furlongs === 6.5) return '6½f';
    if (furlongs === 8) return '1m';
    if (furlongs === 8.5) return '1¹⁄₁₆m';
    if (furlongs === 9) return '1⅛m';
    if (furlongs === 10) return '1¼m';
    if (furlongs === 11) return '1⅜m';
    if (furlongs === 12) return '1½m';
    if (furlongs === 13) return '1⅝m';
    if (furlongs === 14) return '1¾m';

    // Under 8 furlongs - show as furlongs
    if (furlongs < 8) {
      if (furlongs % 1 === 0) return `${furlongs}f`;
      if (furlongs % 1 === 0.5) return `${Math.floor(furlongs)}½f`;
      if (furlongs % 1 === 0.25) return `${Math.floor(furlongs)}¼f`;
      if (furlongs % 1 === 0.75) return `${Math.floor(furlongs)}¾f`;
      return `${furlongs.toFixed(1)}f`;
    }

    // 8+ furlongs - show as miles
    const miles = furlongs / 8;
    if (miles % 1 === 0) return `${miles}m`;
    if (miles % 1 === 0.125) return `${Math.floor(miles)}⅛m`;
    if (miles % 1 === 0.25) return `${Math.floor(miles)}¼m`;
    if (miles % 1 === 0.375) return `${Math.floor(miles)}⅜m`;
    if (miles % 1 === 0.5) return `${Math.floor(miles)}½m`;
    if (miles % 1 === 0.625) return `${Math.floor(miles)}⅝m`;
    if (miles % 1 === 0.75) return `${Math.floor(miles)}¾m`;
    if (miles % 1 === 0.875) return `${Math.floor(miles)}⅞m`;

    return `${miles.toFixed(2)}m`;
  };

  // Format track condition: "fst", "gd", "sly", "my"
  const formatCondition = (condition: string): string => {
    if (!condition) return '—';
    const abbrevs: Record<string, string> = {
      fast: 'fst',
      good: 'gd',
      sloppy: 'sly',
      muddy: 'my',
      firm: 'fm',
      yielding: 'yl',
      soft: 'sf',
      'wet fast': 'wf',
      slow: 'sl',
    };
    return abbrevs[condition.toLowerCase()] || condition.slice(0, 3).toLowerCase();
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
        {formatDistance(pp.distanceFurlongs, pp.distance)}
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
