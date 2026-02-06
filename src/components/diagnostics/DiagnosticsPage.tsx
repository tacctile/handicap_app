/**
 * DiagnosticsPage
 *
 * Hidden diagnostics dashboard with interactive charts, track filtering,
 * and prediction accuracy displays. Accessible by tapping the branding
 * title in the header.
 *
 * @component
 */

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { ErrorBoundary } from '../ErrorBoundary';
import type { UseDiagnosticsReturn } from '../../hooks/useDiagnostics';
import type { DiagnosticsResults, TrackSummary } from '../../services/diagnostics/types';
import './DiagnosticsPage.css';

// ============================================================================
// CONSTANTS — design token values for Recharts (CSS vars don't work in SVG)
// ============================================================================

const C = {
  primary: '#19abb5',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  textPrimary: '#eeeff1',
  textSecondary: '#b4b4b6',
  textTertiary: '#6e6e70',
  borderSubtle: '#2a2a2c',
  elevated: '#1a1a1c',
} as const;

const STAGGER = 0.1;

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosticsPageProps {
  diagnostics: UseDiagnosticsReturn;
  onBack: () => void;
}

interface FilteredMetrics {
  raceCount: number;
  horseCount: number;
  trackCount: number;
  topPickWinRate: number;
  topPickShowRate: number;
  topPickWins: number;
  topPickShows: number;
  topPickPlaceRate: number | null;
  topPickPlaces: number | null;
  dateRange: string;
}

type SortKey = 'trackCode' | 'raceCount' | 'horseCount' | 'topPickWinRate' | 'topPickITMRate';
type SortDir = 'asc' | 'desc';

// ============================================================================
// HELPERS
// ============================================================================

function getGrade(winRate: number): { grade: string; descriptor: string } {
  if (winRate >= 30) return { grade: 'A', descriptor: 'Excellent accuracy' };
  if (winRate >= 25) return { grade: 'B', descriptor: 'Strong accuracy' };
  if (winRate >= 20) return { grade: 'C', descriptor: 'Solid accuracy' };
  if (winRate >= 15) return { grade: 'D', descriptor: 'Below average' };
  return { grade: 'F', descriptor: 'Needs improvement' };
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
}

// ============================================================================
// TOOLTIP
// ============================================================================

function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="diag-tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onTouchStart={() => setVisible((v) => !v)}
    >
      {children}
      <span className="diag-tooltip-icon">i</span>
      <AnimatePresence>
        {visible && (
          <motion.span
            className="diag-tooltip-popup"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ============================================================================
// CUSTOM RECHARTS TOOLTIP
// ============================================================================

interface TooltipPayloadEntry {
  value: number;
  name: string;
  color: string;
  dataKey: string;
  payload: Record<string, unknown>;
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.elevated,
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        color: C.textPrimary,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        maxWidth: 280,
      }}
    >
      {label && (
        <div style={{ color: C.textSecondary, marginBottom: 4, fontWeight: 500 }}>
          {String(label)}
        </div>
      )}
      {payload.map((entry, i) => {
        const detail = entry.payload?.detail;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: entry.color,
                flexShrink: 0,
              }}
            />
            {entry.name.trim() !== '' && (
              <span style={{ color: C.textSecondary }}>{entry.name}:</span>
            )}
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {entry.value}%
            </span>
            {detail != null && (
              <span style={{ color: C.textTertiary }}>— {String(detail) as string}</span>
            )}
          </div>
        );
      })}
      {payload[0]?.payload?.tooltip != null && (
        <div style={{ color: C.textTertiary, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
          {String(payload[0].payload.tooltip) as string}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TRACK FILTER
// ============================================================================

function TrackFilter({
  tracks,
  selected,
  onSelect,
}: {
  tracks: TrackSummary[];
  selected: string | null;
  onSelect: (track: string | null) => void;
}) {
  return (
    <div className="diag-filter-bar">
      <button
        className={`diag-filter-chip ${selected === null ? 'diag-filter-chip--active' : ''}`}
        onClick={() => onSelect(null)}
      >
        All Tracks
      </button>
      {tracks.map((track) => (
        <button
          key={track.trackCode}
          className={`diag-filter-chip ${selected === track.trackCode ? 'diag-filter-chip--active' : ''}`}
          onClick={() => onSelect(track.trackCode)}
        >
          {track.trackCode} ({track.raceCount})
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function LoadingState({ diagnostics }: { diagnostics: UseDiagnosticsReturn }) {
  const { progress } = diagnostics;
  const percent = progress?.percentComplete ?? 0;
  const currentFile = progress?.currentFile ?? '...';
  const filesProcessed = progress?.filesProcessed ?? 0;
  const totalFiles = progress?.totalFiles ?? 0;

  return (
    <div className="diag-loading">
      <h2 className="diag-loading-title">Analyzing race data...</h2>
      <div className="diag-progress-bar-track">
        <motion.div
          className="diag-progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <p className="diag-loading-detail">
        Processing <strong>{currentFile}</strong> — {filesProcessed} of {totalFiles} files
      </p>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="diag-error-card">
      <span className="material-icons diag-error-icon">error_outline</span>
      <h3 className="diag-error-title">Analysis Failed</h3>
      <p className="diag-error-message">
        Something went wrong while analyzing the race data. This could be caused by malformed data
        files or a browser compatibility issue.
      </p>
      <button className="diag-btn-secondary" onClick={onRetry}>
        <span className="material-icons">refresh</span>
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// NO DATA STATE
// ============================================================================

function NoDataState() {
  return (
    <div className="diag-error-card">
      <span className="material-icons diag-error-icon">folder_open</span>
      <h3 className="diag-error-title">No Data Files Found</h3>
      <p className="diag-error-message">
        No paired DRF and results files were found in <code>src/data/</code>. To use diagnostics,
        add DRF files (e.g., <code>AQU1228.DRF</code>) and their matching results files (e.g.,{' '}
        <code>AQU1228_results.txt</code>) to that directory.
      </p>
    </div>
  );
}

// ============================================================================
// METRIC CARD (ENHANCED)
// ============================================================================

function MetricCard({
  label,
  value,
  subtitle,
  tooltip,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tooltip?: string;
}) {
  const labelEl = tooltip ? <Tooltip text={tooltip}>{label}</Tooltip> : <span>{label}</span>;
  return (
    <motion.div
      className="diag-metric-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="diag-metric-label">{labelEl}</div>
      <div className="diag-metric-value">{value}</div>
      {subtitle && <div className="diag-metric-subtitle">{subtitle}</div>}
    </motion.div>
  );
}

// ============================================================================
// PREDICTION ACCURACY CHART
// ============================================================================

function PredictionAccuracyChart({
  metrics,
  results,
  isFiltered,
}: {
  metrics: FilteredMetrics;
  results: DiagnosticsResults;
  isFiltered: boolean;
}) {
  const avgFieldSize = results.validRaces > 0 ? results.totalHorses / results.validRaces : 10;
  const randomChance = Math.round((1 / avgFieldSize) * 1000) / 10;
  const multiplier =
    metrics.topPickWinRate > 0 && randomChance > 0
      ? (metrics.topPickWinRate / randomChance).toFixed(1)
      : '0';

  const data: Array<{ name: string; rate: number; detail: string; fill: string }> = [];

  data.push({
    name: 'Win',
    rate: metrics.topPickWinRate,
    detail: `won ${metrics.topPickWins} of ${metrics.raceCount}`,
    fill: C.primary,
  });

  if (metrics.topPickPlaceRate !== null && metrics.topPickPlaces !== null) {
    data.push({
      name: 'Place',
      rate: metrics.topPickPlaceRate,
      detail: `placed ${metrics.topPickPlaces} of ${metrics.raceCount}`,
      fill: C.success,
    });
  }

  data.push({
    name: 'Show',
    rate: metrics.topPickShowRate,
    detail: `showed ${metrics.topPickShows} of ${metrics.raceCount}`,
    fill: C.warning,
  });

  const maxVal = Math.max(...data.map((d) => d.rate));
  const yMax = Math.max(50, Math.ceil(maxVal / 10) * 10 + 10);

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">How Accurate Are Our Rankings?</h3>
      <p className="diag-chart-description">
        How our top-ranked horse performs across win, place, and show bets
        {isFiltered ? ' at this track' : ''}.
      </p>
      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSubtle} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={{ stroke: C.borderSubtle }}
              tickLine={false}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <RechartsTooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <ReferenceLine
              y={randomChance}
              stroke={C.textTertiary}
              strokeDasharray="6 4"
              label={{
                value: `Random ${randomChance}%`,
                position: 'right',
                fill: C.textTertiary,
                fontSize: 11,
              }}
            />
            <Bar dataKey="rate" name=" " radius={[4, 4, 0, 0]} maxBarSize={64}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="diag-chart-insight">
        Our top-ranked horse wins {metrics.topPickWinRate}% of races — {multiplier}x better than
        random chance ({randomChance}%).
      </p>
    </div>
  );
}

// ============================================================================
// TIER PERFORMANCE CHART
// ============================================================================

function TierPerformanceChart({ results }: { results: DiagnosticsResults }) {
  const tiers = results.tierPerformance;
  if (tiers.length === 0) return null;

  const data = tiers.map((tier) => ({
    name:
      tier.tierName === 'tier1'
        ? 'Top Contenders'
        : tier.tierName === 'tier2'
          ? 'Solid Alternatives'
          : 'Longshots',
    winRate: tier.winRate,
    itmRate: tier.itmRate,
    winDetail: `won ${tier.wins} of ${tier.horseCount}`,
    itmDetail: `ITM ${tier.itmFinishes} of ${tier.horseCount}`,
  }));

  const tier1 = tiers.find((t) => t.tierName === 'tier1');
  const tier2 = tiers.find((t) => t.tierName === 'tier2');
  const tier3 = tiers.find((t) => t.tierName === 'tier3');
  const isCalibrated =
    (tier1?.winRate ?? 0) > (tier2?.winRate ?? 0) && (tier2?.winRate ?? 0) > (tier3?.winRate ?? 0);

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Performance by Confidence Tier</h3>
      <p className="diag-chart-description">
        How horses in each confidence tier performed. Higher tiers should win more often.
      </p>
      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSubtle} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={{ stroke: C.borderSubtle }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 80]}
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <RechartsTooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value: string) => (
                <span style={{ color: C.textSecondary, fontSize: 12 }}>{value}</span>
              )}
            />
            <Bar
              dataKey="winRate"
              name="Win Rate"
              fill={C.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey="itmRate"
              name="ITM Rate"
              fill={C.warning}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="diag-chart-insight">
        Tier 1 horses win {tier1?.winRate ?? 0}% of the time and cash {tier1?.itmRate ?? 0}% — our
        confidence rankings are {isCalibrated ? 'working well' : 'need calibration'}.
      </p>
    </div>
  );
}

// ============================================================================
// EXOTIC BET ACCURACY CHART
// ============================================================================

function ExoticBetChart({ results }: { results: DiagnosticsResults }) {
  const data = useMemo(() => {
    const items = [
      {
        name: 'Exacta Box 2',
        rate: results.exactaBox2Rate,
        tooltip: 'Pick the top 2 finishers in any order using our top 2 ranked horses',
      },
      {
        name: 'Exacta Box 3',
        rate: results.exactaBox3Rate,
        tooltip: 'Pick the top 2 finishers in any order using our top 3 ranked horses',
      },
      {
        name: 'Exacta Box 4',
        rate: results.exactaBox4Rate,
        tooltip: 'Pick the top 2 finishers in any order using our top 4 ranked horses',
      },
      {
        name: 'Trifecta Box 3',
        rate: results.trifectaBox3Rate,
        tooltip: 'Pick the top 3 finishers in any order using our top 3 ranked horses',
      },
      {
        name: 'Trifecta Box 4',
        rate: results.trifectaBox4Rate,
        tooltip: 'Pick the top 3 finishers in any order using our top 4 ranked horses',
      },
      {
        name: 'Trifecta Box 5',
        rate: results.trifectaBox5Rate,
        tooltip: 'Pick the top 3 finishers in any order using our top 5 ranked horses',
      },
      {
        name: 'Superfecta Box 4',
        rate: results.superfectaBox4Rate,
        tooltip: 'Pick the top 4 finishers in any order using our top 4 ranked horses',
      },
      {
        name: 'Superfecta Box 5',
        rate: results.superfectaBox5Rate,
        tooltip: 'Pick the top 4 finishers in any order using our top 5 ranked horses',
      },
      {
        name: 'Superfecta Box 6',
        rate: results.superfectaBox6Rate,
        tooltip: 'Pick the top 4 finishers in any order using our top 6 ranked horses',
      },
    ];
    return items.filter((i) => i.rate > 0);
  }, [results]);

  if (data.length === 0) return null;

  const maxRate = Math.max(...data.map((d) => d.rate));
  const xMax = Math.min(60, Math.ceil(maxRate / 10) * 10 + 10);

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Exotic Bet Hit Rates</h3>
      <p className="diag-chart-description">
        How often our top-ranked horses filled exotic bet combinations. Higher box sizes cost more
        but hit more often.
      </p>
      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36 + 48)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 48, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSubtle} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, xMax]}
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={{ stroke: C.borderSubtle }}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: C.textSecondary, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={104}
            />
            <RechartsTooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="rate" name="Hit Rate" radius={[0, 4, 4, 0]} maxBarSize={24}>
              <LabelList
                dataKey="rate"
                position="right"
                fill={C.textSecondary}
                fontSize={11}
                formatter={(val: unknown) => `${String(val)}%`}
              />
              {data.map((entry, i) => {
                const t = maxRate > 0 ? entry.rate / maxRate : 0;
                return <Cell key={i} fill={lerpColor(C.primary, C.success, t)} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// TRACK COMPARISON TABLE
// ============================================================================

function TrackComparisonTable({ results }: { results: DiagnosticsResults }) {
  const [sortKey, setSortKey] = useState<SortKey>('topPickWinRate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey]
  );

  const sorted = useMemo(() => {
    return [...results.trackSummaries].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [results.trackSummaries, sortKey, sortDir]);

  const bestTrack = useMemo(() => {
    let best: TrackSummary | null = null;
    for (const t of results.trackSummaries) {
      if (!best || t.topPickWinRate > best.topPickWinRate) best = t;
    }
    return best;
  }, [results.trackSummaries]);

  const worstTrack = useMemo(() => {
    let worst: TrackSummary | null = null;
    for (const t of results.trackSummaries) {
      if (!worst || t.topPickWinRate < worst.topPickWinRate) worst = t;
    }
    return worst;
  }, [results.trackSummaries]);

  const columns: Array<{ key: SortKey; label: string }> = [
    { key: 'trackCode', label: 'Track' },
    { key: 'raceCount', label: 'Races' },
    { key: 'horseCount', label: 'Horses' },
    { key: 'topPickWinRate', label: 'Win%' },
    { key: 'topPickITMRate', label: 'ITM%' },
  ];

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Track-by-Track Breakdown</h3>
      <p className="diag-chart-description">
        Compare prediction accuracy across all tracks. Tap a column to sort.
      </p>
      <div className="diag-table-wrapper">
        <table className="diag-table diag-comparison-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="diag-sortable-th">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="diag-sort-icon">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((track) => {
              const isBest = track.trackCode === bestTrack?.trackCode;
              const isWorst =
                track.trackCode === worstTrack?.trackCode &&
                track.trackCode !== bestTrack?.trackCode;
              const { grade } = getGrade(track.topPickWinRate);
              return (
                <tr
                  key={track.trackCode}
                  className={isBest ? 'diag-row-best' : isWorst ? 'diag-row-worst' : ''}
                >
                  <td className="diag-track-name-cell">{track.trackCode}</td>
                  <td className="diag-tabular">{track.raceCount}</td>
                  <td className="diag-tabular">{track.horseCount.toLocaleString()}</td>
                  <td className="diag-tabular">{track.topPickWinRate}%</td>
                  <td className="diag-tabular">{track.topPickITMRate}%</td>
                  <td className="diag-tabular">{grade}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bestTrack && worstTrack && bestTrack.trackCode !== worstTrack.trackCode && (
        <p className="diag-chart-insight">
          Our system performs best at {bestTrack.trackCode} ({bestTrack.topPickWinRate}% win rate)
          and has the most room for improvement at {worstTrack.trackCode} (
          {worstTrack.topPickWinRate}% win rate).
        </p>
      )}
    </div>
  );
}

// ============================================================================
// COMPLETE STATE
// ============================================================================

function CompleteState({ diagnostics }: { diagnostics: UseDiagnosticsReturn }) {
  const { results, rerun } = diagnostics;
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);

  const filteredMetrics = useMemo((): FilteredMetrics | null => {
    if (!results) return null;
    if (!selectedTrack) {
      return {
        raceCount: results.validRaces,
        horseCount: results.totalHorses,
        trackCount: results.totalTracks,
        topPickWinRate: results.topPickWinRate,
        topPickShowRate: results.topPickShowRate,
        topPickWins: results.topPickWins,
        topPickShows: results.topPickShows,
        topPickPlaceRate: results.topPickPlaceRate,
        topPickPlaces: results.topPickPlaces,
        dateRange: results.dateRange,
      };
    }
    const track = results.trackSummaries.find((t) => t.trackCode === selectedTrack);
    if (!track) return null;
    return {
      raceCount: track.raceCount,
      horseCount: track.horseCount,
      trackCount: 1,
      topPickWinRate: track.topPickWinRate,
      topPickShowRate: track.topPickITMRate,
      topPickWins: track.topPickWins,
      topPickShows: track.topPickITM,
      topPickPlaceRate: null,
      topPickPlaces: null,
      dateRange: track.dateRange,
    };
  }, [results, selectedTrack]);

  if (!results) return null;
  if (results.totalRaces === 0) return <NoDataState />;
  if (!filteredMetrics) return null;

  const analysisTimeSec = (results.analysisTimeMs / 1000).toFixed(1);
  const analyzedDate = new Date(results.analyzedAt).toLocaleString();
  const isFiltered = selectedTrack !== null;
  const { grade, descriptor } = getGrade(filteredMetrics.topPickWinRate);

  return (
    <div className="diag-results">
      <TrackFilter
        tracks={results.trackSummaries}
        selected={selectedTrack}
        onSelect={setSelectedTrack}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTrack ?? 'all'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="diag-sections"
        >
          {/* Key metric cards */}
          <motion.div
            className="diag-metrics-grid"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 0 }}
          >
            <MetricCard
              label="Races Analyzed"
              value={filteredMetrics.raceCount.toString()}
              subtitle={`across ${filteredMetrics.trackCount} track${filteredMetrics.trackCount !== 1 ? 's' : ''}, ${filteredMetrics.horseCount.toLocaleString()} horses scored`}
              tooltip="Total number of races our system analyzed using real race data"
            />
            <MetricCard
              label="Top Pick Wins"
              value={`${filteredMetrics.topPickWinRate}%`}
              subtitle={`${filteredMetrics.topPickWins} of ${filteredMetrics.raceCount} races`}
              tooltip="How often the horse our system ranked #1 actually won the race"
            />
            <MetricCard
              label="Top Pick Cashes"
              value={`${filteredMetrics.topPickShowRate}%`}
              subtitle={`${filteredMetrics.topPickShows} of ${filteredMetrics.raceCount} in the money`}
              tooltip="How often our #1 pick finished in the top 3 — good enough to cash a show bet"
            />
            <MetricCard
              label="Prediction Score"
              value={grade}
              subtitle={descriptor}
              tooltip="Overall grade for how well our system predicted race outcomes. A = excellent, F = needs work"
            />
          </motion.div>

          {/* Prediction Accuracy Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 1 }}
          >
            <PredictionAccuracyChart
              metrics={filteredMetrics}
              results={results}
              isFiltered={isFiltered}
            />
          </motion.div>

          {/* Tier Performance Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 2 }}
          >
            <TierPerformanceChart results={results} />
          </motion.div>

          {/* Exotic Bet Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 3 }}
          >
            <ExoticBetChart results={results} />
          </motion.div>

          {/* Track Comparison Table — only when All Tracks */}
          {!isFiltered && results.trackSummaries.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 4 }}
            >
              <TrackComparisonTable results={results} />
            </motion.div>
          )}

          {/* Metadata footer */}
          <motion.div
            className="diag-metadata"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: STAGGER * 5 }}
          >
            <div className="diag-metadata-items">
              <span>Last analyzed: {analyzedDate}</span>
              <span>
                Data files: {results.totalFiles} tracks, {results.validRaces} races,{' '}
                {results.totalHorses.toLocaleString()} horses
              </span>
              <span>Analysis time: {analysisTimeSec}s</span>
              {results.unmatchedFiles.length > 0 && (
                <span className="diag-metadata-warn">
                  Skipped (no results): {results.unmatchedFiles.join(', ')}
                </span>
              )}
            </div>
            <button className="diag-btn-secondary diag-btn-small" onClick={rerun}>
              <span className="material-icons">refresh</span>
              Re-run Analysis
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function DiagnosticsPageInner({ diagnostics, onBack }: DiagnosticsPageProps) {
  const { status } = diagnostics;

  return (
    <div className="diag-page">
      <header className="diag-header">
        <button className="diag-back-btn" onClick={onBack} aria-label="Back to app">
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="diag-page-title">System Diagnostics</h1>
      </header>

      <main className="diag-content">
        <AnimatePresence mode="wait">
          {status === 'idle' || status === 'running' ? (
            <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <LoadingState diagnostics={diagnostics} />
            </motion.div>
          ) : status === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ErrorState onRetry={diagnostics.rerun} />
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CompleteState diagnostics={diagnostics} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/** DiagnosticsPage wrapped with ErrorBoundary */
export function DiagnosticsPage(props: DiagnosticsPageProps) {
  return (
    <ErrorBoundary componentName="DiagnosticsPage">
      <DiagnosticsPageInner {...props} />
    </ErrorBoundary>
  );
}
