import React from 'react';
import './PPLine.css';
import type { PastPerformance, RunningLine } from '../types/drf';

interface PPLineProps {
  pp: PastPerformance;
  index: number; // For alternating row colors
}

export const PPLine: React.FC<PPLineProps> = ({ pp, index }) => {
  // Format date: "01/25/24" or "Jan 25"
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${month}/${day}/${year}`;
    } catch {
      return dateStr.slice(0, 8) || '—';
    }
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

  // Format lengths as superscript-style: "½", "1½", "2", "hd", "nk", "ns"
  const formatLengths = (lengths: string | number): string => {
    if (!lengths) return '';
    const l = String(lengths).toLowerCase();
    if (l === 'head' || l === 'hd') return 'ʰᵈ';
    if (l === 'neck' || l === 'nk') return 'ⁿᵏ';
    if (l === 'nose' || l === 'ns') return 'ⁿˢ';
    // Numeric lengths - use superscript style
    return `${l}`.replace('.5', '½').replace('1/2', '½');
  };

  // Format running line: "3² 2¹ 2½ 2¹ 2¹½"
  const formatRunningLine = (rl: RunningLine | null | undefined): string => {
    if (!rl) return '—';

    const positions = [
      rl.start,
      rl.quarterMile,
      rl.halfMile,
      rl.threeQuarters,
      rl.stretch,
      rl.finish,
    ].filter((p) => p !== null && p !== undefined);

    if (positions.length === 0) return '—';

    // For now, just show positions. Lengths can be added with superscript later.
    // Note: start position has no lengths value
    const lengthsArray = [
      null, // start has no lengths
      rl.quarterMileLengths,
      rl.halfMileLengths,
      rl.threeQuartersLengths,
      rl.stretchLengths,
      rl.finishLengths,
    ];

    return positions
      .map((pos, i) => {
        const lengths = lengthsArray[i];

        if (lengths !== null && lengths !== undefined) {
          return `${pos}${formatLengths(lengths)}`;
        }
        return String(pos);
      })
      .join(' ');
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

  // Format comment: truncate if too long
  const formatComment = (tripComment?: string, comment?: string): string => {
    const text = tripComment || comment || '';
    return text.slice(0, 30) || '—';
  };

  const isEven = index % 2 === 0;

  return (
    <div className={`pp-line ${isEven ? 'pp-line--even' : 'pp-line--odd'}`}>
      <span className="pp-line__col pp-line__col--date">{formatDate(pp.date)}</span>
      <span className="pp-line__col pp-line__col--track">{pp.track || '—'}</span>
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
