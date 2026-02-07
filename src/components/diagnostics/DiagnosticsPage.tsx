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
} from 'recharts';
import { ErrorBoundary } from '../ErrorBoundary';
import type { UseDiagnosticsReturn } from '../../hooks/useDiagnostics';
import type {
  DiagnosticsResults,
  PredictionRecord,
  TrackSummary,
} from '../../services/diagnostics/types';
import { ScoreCategoryChart } from './ScoreCategoryChart';
import { ImprovementSuggestions } from './ImprovementSuggestions';
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

const STAGGER = 0.08;

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

// ============================================================================
// TOOLTIP (supplementary — core explanations are always visible)
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
// INTRO SECTION
// ============================================================================

function IntroSection({ raceCount }: { raceCount: number }) {
  return (
    <div className="diag-intro">
      <h3 className="diag-intro-title">What Is This Page?</h3>
      <p className="diag-intro-body">
        This page tests how well our prediction system works using real race data. We fed our system
        information about {raceCount} past races and asked it to rank every horse from best to
        worst. Then we compared our rankings against what actually happened. Every number below
        shows how accurate our predictions were.{' '}
        <span style={{ color: 'var(--color-success)' }}>Green means we&apos;re doing well.</span>{' '}
        <span style={{ color: 'var(--color-error)' }}>Red means there&apos;s room to improve.</span>
      </p>
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
// METRIC CARD (ENHANCED — description always visible)
// ============================================================================

function MetricCard({
  label,
  value,
  description,
  subtitle,
  tooltip,
}: {
  label: string;
  value: string;
  description: string;
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
      <div className="diag-metric-description">{description}</div>
      {subtitle && <div className="diag-metric-subtitle">{subtitle}</div>}
    </motion.div>
  );
}

// ============================================================================
// HELPERS — color interpolation for rank gradient
// ============================================================================

function interpolateColor(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ============================================================================
// RANK TOOLTIP
// ============================================================================

function RankTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload as Record<string, unknown>;
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
      }}
    >
      Rank {String(d.rank)}: Won {String(d.wins)} of {String(d.total)} races ({String(d.winRate)}%)
    </div>
  );
}

// ============================================================================
// PER-RANK WIN RATE CHART
// ============================================================================

function PerRankWinRateChart({
  predictions,
  results,
}: {
  predictions: PredictionRecord[];
  results: DiagnosticsResults;
}) {
  const data = useMemo(() => {
    const ranks: Array<{
      rank: string;
      winRate: number;
      wins: number;
      total: number;
      fill: string;
    }> = [];
    for (let r = 1; r <= 10; r++) {
      const atRank = predictions.filter((p) => p.algorithmRank === r);
      const wins = atRank.filter((p) => p.actualFinish === 1).length;
      const rate = atRank.length > 0 ? Math.round((wins / atRank.length) * 1000) / 10 : 0;
      ranks.push({
        rank: String(r),
        winRate: rate,
        wins,
        total: atRank.length,
        fill: interpolateColor(C.primary, C.textTertiary, (r - 1) / 9),
      });
    }
    return ranks;
  }, [predictions]);

  const avgFieldSize = results.validRaces > 0 ? results.totalHorses / results.validRaces : 10;
  const randomChance = Math.round((1 / avgFieldSize) * 1000) / 10;
  const rank1Rate = data[0]?.winRate ?? 0;
  const multiplier =
    rank1Rate > 0 && randomChance > 0 ? (rank1Rate / randomChance).toFixed(1) : '0';

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Accuracy by Ranking Position</h3>
      <p className="diag-chart-description">
        We rank every horse in a race from 1 (our best pick) to last. This chart shows how often a
        horse actually won based on where we ranked them. If our system works well, the bars should
        be tallest on the left and get shorter as you move right — meaning our top picks win more
        often than our lower picks.
      </p>
      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSubtle} vertical={false} />
            <XAxis
              dataKey="rank"
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={{ stroke: C.borderSubtle }}
              tickLine={false}
              label={{
                value: 'Our Ranking (1 = Best Pick)',
                position: 'insideBottom',
                offset: -4,
                fill: C.textSecondary,
                fontSize: 11,
              }}
            />
            <YAxis
              domain={[0, 50]}
              tick={{ fill: C.textTertiary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
              label={{
                value: 'Actual Win Rate',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: C.textSecondary,
                fontSize: 11,
              }}
            />
            <RechartsTooltip
              content={<RankTooltipContent />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <ReferenceLine
              y={randomChance}
              stroke={C.textTertiary}
              strokeDasharray="6 4"
              label={{
                value: 'Random Guess',
                position: 'right',
                fill: C.textTertiary,
                fontSize: 11,
              }}
            />
            <Bar dataKey="winRate" name="Win Rate" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="diag-chart-insight">
        Our #1 ranked horse wins {rank1Rate}% of the time. A random guess would win {randomChance}%
        of the time, so our system is {multiplier}x more accurate than guessing.
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
    itmDetail: `top 3 in ${tier.itmFinishes} of ${tier.horseCount}`,
  }));

  const tier1 = tiers.find((t) => t.tierName === 'tier1');
  const tier2 = tiers.find((t) => t.tierName === 'tier2');
  const tier3 = tiers.find((t) => t.tierName === 'tier3');
  const isCalibrated =
    (tier1?.winRate ?? 0) > (tier2?.winRate ?? 0) && (tier2?.winRate ?? 0) > (tier3?.winRate ?? 0);

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Performance by Confidence Level</h3>
      <p className="diag-chart-description">
        We group horses into three confidence levels based on their scores. Top Contenders are
        horses we are most confident about. Solid Alternatives are our next best picks. Longshots
        are horses with lower scores but potential for surprises. If our confidence levels are
        accurate, Top Contenders should win more often than the other groups.
      </p>

      {/* Tier explanations */}
      <div className="diag-tier-explanations">
        <div className="diag-tier-explanation">
          <strong>Top Contenders</strong> — horses we&apos;re most confident will perform well
        </div>
        <div className="diag-tier-explanation">
          <strong>Solid Alternatives</strong> — good horses that could compete but aren&apos;t our
          top choice
        </div>
        <div className="diag-tier-explanation">
          <strong>Longshots</strong> — lower-rated horses that could surprise everyone
        </div>
      </div>

      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSubtle} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: C.textTertiary, fontSize: 11 }}
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
              name="Win Rate — how often horses in this group actually won"
              fill={C.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey="itmRate"
              name="Top 3 Rate — how often they finished 1st, 2nd, or 3rd"
              fill={C.warning}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="diag-chart-insight">
        Top Contenders win {tier1?.winRate ?? 0}% and finish in the top 3 about{' '}
        {tier1?.itmRate ?? 0}% of the time — our confidence levels are{' '}
        {isCalibrated ? 'working well' : 'not yet fully calibrated'}.
      </p>
    </div>
  );
}

// ============================================================================
// CONFIDENCE CALIBRATION
// ============================================================================

const EXPECTED_WIN_RATES: Record<number, number> = { 1: 35, 2: 18, 3: 8 };

interface CalibrationRow {
  tier: number;
  tierLabel: string;
  expected: number;
  actual: number;
  diff: number;
  status: string;
  statusColor: string;
}

function getCalibrationStatus(actual: number, expected: number): { label: string; color: string } {
  const diff = actual - expected;
  if (Math.abs(diff) > 15)
    return {
      label: 'Needs Work — predictions are significantly off from reality',
      color: C.error,
    };
  if (Math.abs(diff) <= 5)
    return {
      label: 'On Track — predictions match reality',
      color: C.success,
    };
  if (diff > 5)
    return {
      label: 'Too Conservative — horses did better than we expected (this is actually good)',
      color: C.warning,
    };
  return {
    label: 'Too Optimistic — we predicted better results than what happened',
    color: C.warning,
  };
}

function ConfidenceCalibration({ predictions }: { predictions: PredictionRecord[] }) {
  const rows = useMemo((): CalibrationRow[] => {
    return [1, 2, 3].map((tier) => {
      const tierPreds = predictions.filter((p) => p.tier === tier);
      const wins = tierPreds.filter((p) => p.actualFinish === 1).length;
      const actual = tierPreds.length > 0 ? Math.round((wins / tierPreds.length) * 1000) / 10 : 0;
      const expected = EXPECTED_WIN_RATES[tier] ?? 0;
      const diff = Math.round((actual - expected) * 10) / 10;
      const status = getCalibrationStatus(actual, expected);
      const labels = ['', 'Top Contenders', 'Solid Alternatives', 'Longshots'];
      return {
        tier,
        tierLabel: labels[tier] ?? `Tier ${tier}`,
        expected,
        actual,
        diff,
        status: status.label,
        statusColor: status.color,
      };
    });
  }, [predictions]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.tierLabel,
        expected: r.expected,
        actual: r.actual,
      })),
    [rows]
  );

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Are Our Confidence Levels Accurate?</h3>
      <p className="diag-chart-description">
        This compares what we expect to happen versus what actually happened. &quot;Expected&quot;
        is what our math model predicts. &quot;Actual&quot; is what really happened in races. If
        they match closely, our system is well-calibrated — meaning when we say we&apos;re
        confident, we should be.
      </p>

      {/* Column explanation text */}
      <div className="diag-column-explanations">
        <span>
          <strong>Expected</strong> — what our model predicts should happen
        </span>
        <span>
          <strong>Actual</strong> — what really happened in the races we tested
        </span>
        <span>
          <strong>Difference</strong> — how far off we were (positive = better than expected,
          negative = worse)
        </span>
        <span>
          <strong>Status</strong> — a quick summary of whether we&apos;re on track
        </span>
      </div>

      {/* Calibration table */}
      <div className="diag-table-wrapper">
        <table className="diag-table diag-calibration-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Difference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tier}>
                <td className="diag-calibration-tier">{row.tierLabel}</td>
                <td className="diag-tabular">{row.expected}%</td>
                <td className="diag-tabular">{row.actual}%</td>
                <td
                  className="diag-tabular"
                  style={{
                    color: row.diff > 0 ? C.success : row.diff < 0 ? C.warning : C.textSecondary,
                  }}
                >
                  {row.diff > 0 ? '+' : ''}
                  {row.diff}%
                </td>
                <td>
                  <span style={{ color: row.statusColor, fontWeight: 600, fontSize: 12 }}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paired bar chart */}
      <div className="diag-chart-container" style={{ marginTop: 12 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSubtle} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: C.textTertiary, fontSize: 11 }}
              axisLine={{ stroke: C.borderSubtle }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 40]}
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
              dataKey="expected"
              name="Expected"
              fill="rgba(110, 110, 112, 0.5)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey="actual"
              name="Actual"
              fill={C.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="diag-chart-insight">
        When the &quot;Actual&quot; bars are taller than &quot;Expected,&quot; our system is being
        too conservative (good problem). When they&apos;re shorter, we&apos;re being too optimistic
        (needs work).
      </p>
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
    { key: 'trackCode', label: 'Venue' },
    { key: 'raceCount', label: 'Races Tested' },
    { key: 'horseCount', label: 'Horses Scored' },
    { key: 'topPickWinRate', label: 'Top Pick Win Rate' },
    { key: 'topPickITMRate', label: 'Top 3 Rate' },
  ];

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Results by Racing Venue</h3>
      <p className="diag-chart-description">
        How our predictions performed at each racing venue. Some tracks have characteristics that
        our system handles better than others.
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
              <th>Accuracy Grade</th>
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
          We perform best at {bestTrack.trackCode} ({bestTrack.topPickWinRate}% top pick win rate)
          and have the most room to improve at {worstTrack.trackCode} ({worstTrack.topPickWinRate}%
          top pick win rate).
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

  const filteredPredictions = useMemo((): PredictionRecord[] => {
    if (!results) return [];
    const preds = results.predictions ?? [];
    if (!selectedTrack) return preds;
    return preds.filter((p) => p.trackCode === selectedTrack);
  }, [results, selectedTrack]);

  if (!results) return null;
  if (results.totalRaces === 0) return <NoDataState />;
  if (!filteredMetrics) return null;

  const analysisTimeSec = (results.analysisTimeMs / 1000).toFixed(1);
  const analyzedDate = new Date(results.analyzedAt).toLocaleString();
  const isFiltered = selectedTrack !== null;
  const { grade } = getGrade(filteredMetrics.topPickWinRate);

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
          {/* How to read this page — intro */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <IntroSection raceCount={filteredMetrics.raceCount} />
          </motion.div>

          {/* Key metric cards */}
          <motion.div
            className="diag-metrics-grid"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 0 }}
          >
            <MetricCard
              label="Races Tested"
              value={filteredMetrics.raceCount.toString()}
              description="We tested our system against this many real races that already happened."
              subtitle={`${filteredMetrics.trackCount} venue${filteredMetrics.trackCount !== 1 ? 's' : ''}, ${filteredMetrics.horseCount.toLocaleString()} horses`}
            />
            <MetricCard
              label="Top Pick Accuracy"
              value={`${filteredMetrics.topPickWinRate}%`}
              description="When we ranked a horse #1, this is how often that horse actually won the race."
              subtitle={`${filteredMetrics.topPickWins} correct out of ${filteredMetrics.raceCount} races`}
            />
            <MetricCard
              label="Top 3 Accuracy"
              value={`${filteredMetrics.topPickShowRate}%`}
              description="How often our #1 ranked horse finished in the top 3 (1st, 2nd, or 3rd place)."
              subtitle={`${filteredMetrics.topPickShows} of ${filteredMetrics.raceCount} in the top 3`}
            />
            <MetricCard
              label="Overall Grade"
              value={grade}
              description="Our overall prediction accuracy grade. A = excellent, B = good, C = average, D = below average, F = poor."
            />
          </motion.div>

          {/* Desktop 2-column row: Per-rank chart LEFT, Tier performance RIGHT */}
          <div className="diag-two-col">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 1 }}
            >
              <PerRankWinRateChart predictions={filteredPredictions} results={results} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 2 }}
            >
              <TierPerformanceChart results={results} />
            </motion.div>
          </div>

          {/* Confidence Calibration (full width) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 3 }}
          >
            <ConfidenceCalibration predictions={filteredPredictions} />
          </motion.div>

          {/* Desktop 2-column row: Winners vs Field LEFT, Improvement Suggestions RIGHT */}
          <div className="diag-two-col">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 4 }}
            >
              <ScoreCategoryChart predictions={filteredPredictions} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 5 }}
            >
              <ImprovementSuggestions results={results} predictions={filteredPredictions} />
            </motion.div>
          </div>

          {/* Track Comparison Table — only when All Tracks */}
          {!isFiltered && results.trackSummaries.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 6 }}
            >
              <TrackComparisonTable results={results} />
            </motion.div>
          )}

          {/* Metadata footer */}
          <motion.div
            className="diag-metadata"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: STAGGER * 7 }}
          >
            <div className="diag-metadata-items">
              <span>Last tested: {analyzedDate}</span>
              <span>
                Test data: {results.totalTracks} venues, {results.validRaces} races,{' '}
                {results.totalHorses.toLocaleString()} horses
              </span>
              <span>Processing time: {analysisTimeSec} seconds</span>
              {results.unmatchedFiles.length > 0 && (
                <span className="diag-metadata-warn">
                  Skipped (no results available): {results.unmatchedFiles.join(', ')}
                </span>
              )}
            </div>
            <button className="diag-btn-secondary diag-btn-small" onClick={rerun}>
              <span className="material-icons">refresh</span>
              Re-run Tests
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
