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

  // Format distance: "6f", "8.5f", "1m", "1 1/16m"
  const formatDistance = (furlongs: number, distStr?: string): string => {
    if (distStr) {
      // Abbreviate common formats
      return distStr
        .replace('furlongs', 'f')
        .replace('furlong', 'f')
        .replace('miles', 'm')
        .replace('mile', 'm')
        .replace(' ', '')
        .slice(0, 6);
    }
    if (!furlongs) return '—';
    if (furlongs >= 8) {
      const miles = furlongs / 8;
      return miles % 1 === 0 ? `${miles}m` : `${miles.toFixed(2)}m`;
    }
    return `${furlongs}f`;
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

  // Format lengths with superscript-style characters
  const formatLengthsSuper = (lengths: unknown): string => {
    if (!lengths) return '';
    const l = String(lengths).toLowerCase().trim();
    if (!l || l === 'undefined' || l === 'null' || l === 'nan') return '';

    // Common length abbreviations
    if (l === 'head' || l === 'hd') return 'ʰᵈ';
    if (l === 'neck' || l === 'nk') return 'ⁿᵏ';
    if (l === 'nose' || l === 'ns') return 'ⁿˢ';

    // Handle numeric lengths
    return l.replace('.5', '½').replace('0.5', '½').replace('1/2', '½');
  };

  // Format running line properly
  const formatRunningLine = (rl: RunningLine | null | undefined | unknown): string => {
    if (!rl) return '—';

    // If it's a string, it might already be formatted
    if (typeof rl === 'string') {
      // Clean up and return if it looks valid
      const cleaned = rl.trim();
      if (cleaned && cleaned !== 'undefined' && cleaned !== 'null') {
        return cleaned.slice(0, 20);
      }
      return '—';
    }

    // If it's an object with position properties
    const rlObj = rl as RunningLine;
    const positions: (string | number)[] = [];

    // Start position (no lengths)
    if (rlObj.start !== null && rlObj.start !== undefined && !isNaN(Number(rlObj.start))) {
      positions.push(String(rlObj.start));
    }

    // Quarter mile
    if (
      rlObj.quarterMile !== null &&
      rlObj.quarterMile !== undefined &&
      !isNaN(Number(rlObj.quarterMile))
    ) {
      if (rlObj.quarterMileLengths !== null && rlObj.quarterMileLengths !== undefined) {
        positions.push(`${rlObj.quarterMile}${formatLengthsSuper(rlObj.quarterMileLengths)}`);
      } else {
        positions.push(String(rlObj.quarterMile));
      }
    }

    // Half mile
    if (rlObj.halfMile !== null && rlObj.halfMile !== undefined && !isNaN(Number(rlObj.halfMile))) {
      if (rlObj.halfMileLengths !== null && rlObj.halfMileLengths !== undefined) {
        positions.push(`${rlObj.halfMile}${formatLengthsSuper(rlObj.halfMileLengths)}`);
      } else {
        positions.push(String(rlObj.halfMile));
      }
    }

    // Three quarters
    if (
      rlObj.threeQuarters !== null &&
      rlObj.threeQuarters !== undefined &&
      !isNaN(Number(rlObj.threeQuarters))
    ) {
      if (rlObj.threeQuartersLengths !== null && rlObj.threeQuartersLengths !== undefined) {
        positions.push(`${rlObj.threeQuarters}${formatLengthsSuper(rlObj.threeQuartersLengths)}`);
      } else {
        positions.push(String(rlObj.threeQuarters));
      }
    }

    // Stretch
    if (rlObj.stretch !== null && rlObj.stretch !== undefined && !isNaN(Number(rlObj.stretch))) {
      if (rlObj.stretchLengths !== null && rlObj.stretchLengths !== undefined) {
        positions.push(`${rlObj.stretch}${formatLengthsSuper(rlObj.stretchLengths)}`);
      } else {
        positions.push(String(rlObj.stretch));
      }
    }

    // Finish
    if (rlObj.finish !== null && rlObj.finish !== undefined && !isNaN(Number(rlObj.finish))) {
      if (rlObj.finishLengths !== null && rlObj.finishLengths !== undefined) {
        positions.push(`${rlObj.finish}${formatLengthsSuper(rlObj.finishLengths)}`);
      } else {
        positions.push(String(rlObj.finish));
      }
    }

    if (positions.length === 0) return '—';
    return positions.join(' ').slice(0, 20);
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
