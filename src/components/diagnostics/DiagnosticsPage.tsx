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
// BET TYPE DATA — shared between chart & recommendations
// ============================================================================

type BetCategory = 'win' | 'exacta' | 'trifecta' | 'superfecta';

interface BetTypeInfo {
  key: string;
  name: string;
  category: BetCategory;
  ticketCost: number;
  tooltip: string;
  contextDescription: string;
  getRate: (r: DiagnosticsResults) => number;
}

const BET_TYPES: BetTypeInfo[] = [
  {
    key: 'topPickWin',
    name: 'Top Pick Win',
    category: 'win',
    ticketCost: 2,
    tooltip: 'Betting on our #1 ranked horse to win',
    contextDescription: 'Simple and effective — just pick the winner.',
    getRate: (r) => r.topPickWinRate,
  },
  {
    key: 'exactaBox2',
    name: 'Exacta Box 2',
    category: 'exacta',
    ticketCost: 2,
    tooltip: 'Our top 2 horses finish 1st and 2nd in any order',
    contextDescription: 'Affordable exotic — only needs your top two picks to connect.',
    getRate: (r) => r.exactaBox2Rate,
  },
  {
    key: 'exactaBox3',
    name: 'Exacta Box 3',
    category: 'exacta',
    ticketCost: 6,
    tooltip: 'Any 2 of our top 3 horses finish 1st and 2nd',
    contextDescription:
      'A good balance of cost and accuracy — one of the most popular exotic bets.',
    getRate: (r) => r.exactaBox3Rate,
  },
  {
    key: 'exactaBox4',
    name: 'Exacta Box 4',
    category: 'exacta',
    ticketCost: 12,
    tooltip: 'Any 2 of our top 4 horses finish 1st and 2nd',
    contextDescription: 'Wider net for the exacta — more combos, higher cost.',
    getRate: (r) => r.exactaBox4Rate,
  },
  {
    key: 'trifectaBox3',
    name: 'Trifecta Box 3',
    category: 'trifecta',
    ticketCost: 6,
    tooltip: 'Our top 3 horses finish 1st, 2nd, and 3rd in any order',
    contextDescription: 'Tight trifecta — all three picks must hit.',
    getRate: (r) => r.trifectaBox3Rate,
  },
  {
    key: 'trifectaBox4',
    name: 'Trifecta Box 4',
    category: 'trifecta',
    ticketCost: 24,
    tooltip: 'Any 3 of our top 4 horses finish 1st, 2nd, and 3rd',
    contextDescription: 'Decent hit rate but higher cost — use when the favorites are clear.',
    getRate: (r) => r.trifectaBox4Rate,
  },
  {
    key: 'trifectaBox5',
    name: 'Trifecta Box 5',
    category: 'trifecta',
    ticketCost: 60,
    tooltip: 'Any 3 of our top 5 horses finish 1st, 2nd, and 3rd',
    contextDescription: 'Expensive but covers more scenarios — best in wide-open fields.',
    getRate: (r) => r.trifectaBox5Rate,
  },
  {
    key: 'superfectaBox4',
    name: 'Superfecta Box 4',
    category: 'superfecta',
    ticketCost: 24,
    tooltip: 'Our top 4 horses finish 1st through 4th in any order',
    contextDescription: 'Tight superfecta — all four picks must fill the top four spots.',
    getRate: (r) => r.superfectaBox4Rate,
  },
  {
    key: 'superfectaBox5',
    name: 'Superfecta Box 5',
    category: 'superfecta',
    ticketCost: 120,
    tooltip: 'Any 4 of our top 5 horses finish 1st through 4th',
    contextDescription: 'High cost, high reward — for when you like five horses.',
    getRate: (r) => r.superfectaBox5Rate,
  },
  {
    key: 'superfectaBox6',
    name: 'Superfecta Box 6',
    category: 'superfecta',
    ticketCost: 360,
    tooltip: 'Any 4 of our top 6 horses finish 1st through 4th',
    contextDescription: 'Maximum coverage superfecta — very expensive per ticket.',
    getRate: (r) => r.superfectaBox6Rate,
  },
];

const CATEGORY_LABELS: Record<BetCategory, string> = {
  win: 'WIN BETS',
  exacta: 'EXACTA',
  trifecta: 'TRIFECTA',
  superfecta: 'SUPERFECTA',
};

type Verdict = 'Strong' | 'Promising' | 'Risky' | 'Avoid';

function getVerdict(rate: number, category: BetCategory): Verdict {
  switch (category) {
    case 'win':
      if (rate >= 20) return 'Strong';
      if (rate >= 15) return 'Promising';
      if (rate >= 10) return 'Risky';
      return 'Avoid';
    case 'exacta':
      if (rate >= 25) return 'Strong';
      if (rate >= 15) return 'Promising';
      if (rate >= 8) return 'Risky';
      return 'Avoid';
    case 'trifecta':
      if (rate >= 15) return 'Strong';
      if (rate >= 8) return 'Promising';
      if (rate >= 3) return 'Risky';
      return 'Avoid';
    case 'superfecta':
      if (rate >= 8) return 'Strong';
      if (rate >= 3) return 'Promising';
      if (rate >= 1) return 'Risky';
      return 'Avoid';
  }
}

function getVerdictClass(verdict: Verdict): string {
  switch (verdict) {
    case 'Strong':
      return 'diag-verdict-strong';
    case 'Promising':
      return 'diag-verdict-promising';
    case 'Risky':
      return 'diag-verdict-risky';
    case 'Avoid':
      return 'diag-verdict-avoid';
  }
}

function getBarColor(rate: number): string {
  if (rate >= 30) return C.success;
  if (rate >= 15) return C.primary;
  if (rate >= 5) return C.warning;
  return C.error;
}

function getEffectivenessScore(rate: number, ticketCost: number): number {
  return rate / Math.log2(ticketCost + 1);
}

interface BetTypeWithRate extends BetTypeInfo {
  rate: number;
  verdict: Verdict;
  effectivenessScore: number;
}

function getBetTypesWithRates(results: DiagnosticsResults): BetTypeWithRate[] {
  return BET_TYPES.map((bt) => {
    const rate = bt.getRate(results);
    return {
      ...bt,
      rate,
      verdict: getVerdict(rate, bt.category),
      effectivenessScore: getEffectivenessScore(rate, bt.ticketCost),
    };
  }).filter((bt) => bt.rate > 0);
}

// ============================================================================
// BET PERFORMANCE BREAKDOWN (Part 2)
// ============================================================================

function BetPerformanceBreakdown({ results }: { results: DiagnosticsResults }) {
  const betTypes = useMemo(() => getBetTypesWithRates(results), [results]);

  if (betTypes.length === 0) return null;

  // Group by category for chart rendering
  const categories: BetCategory[] = ['win', 'exacta', 'trifecta', 'superfecta'];
  const grouped = categories
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      bets: betTypes.filter((bt) => bt.category === cat),
    }))
    .filter((g) => g.bets.length > 0);

  // Build flat chart data with category separators
  const chartData: Array<{
    name: string;
    rate: number;
    tooltip: string;
    fill: string;
    isCategory?: boolean;
  }> = [];
  for (const group of grouped) {
    for (const bet of group.bets) {
      chartData.push({
        name: bet.name,
        rate: bet.rate,
        tooltip: bet.tooltip,
        fill: getBarColor(bet.rate),
      });
    }
  }

  const maxRate = Math.max(...chartData.map((d) => d.rate));
  const xMax = Math.min(80, Math.ceil(maxRate / 10) * 10 + 10);

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Bet Performance Breakdown</h3>
      <p className="diag-chart-description">
        How each bet type performs based on our rankings. Hit rate shows how often the bet would
        have cashed. Higher is better.
      </p>

      {/* Horizontal bar chart */}
      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 40 + 48)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 56, bottom: 0, left: 0 }}
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
              width={120}
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
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="diag-table-wrapper" style={{ marginTop: 16 }}>
        <table className="diag-table">
          <thead>
            <tr>
              <th>Bet Type</th>
              <th>Hit Rate</th>
              <th>Hits / Attempts</th>
              <th>Ticket Cost</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => (
              <>
                <tr key={`cat-${group.category}`}>
                  <td colSpan={5} className="diag-bet-category">
                    {group.label}
                  </td>
                </tr>
                {group.bets.map((bet) => {
                  const attempts = bet.category === 'win' ? results.validRaces : results.validRaces;
                  const hits = Math.round((bet.rate / 100) * attempts);
                  return (
                    <tr key={bet.key}>
                      <td>
                        <Tooltip text={bet.tooltip}>{bet.name}</Tooltip>
                      </td>
                      <td className="diag-tabular">{bet.rate}%</td>
                      <td className="diag-tabular">
                        {hits} / {attempts}
                      </td>
                      <td className="diag-tabular">${bet.ticketCost}</td>
                      <td className={getVerdictClass(bet.verdict)}>{bet.verdict}</td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// RECOMMENDED BETS (Part 3)
// ============================================================================

function RecommendedBets({ results }: { results: DiagnosticsResults }) {
  const betTypes = useMemo(() => getBetTypesWithRates(results), [results]);

  if (betTypes.length < 3) return null;

  // Sort by effectiveness score descending, take top 3
  const ranked = [...betTypes].sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  const top3 = ranked.slice(0, 3);

  const podiumLabels = ['#1 Best Bet', '#2 Runner Up', '#3 Also Good'] as const;
  const podiumClasses = [
    'diag-podium-card--first',
    'diag-podium-card--second',
    'diag-podium-card--third',
  ] as const;

  const totalRaces = results.validRaces;
  const totalTracks = results.totalTracks;

  let sampleClass = '';
  let sampleMessage = '';
  if (totalRaces < 50) {
    sampleClass = 'diag-sample-notice--small';
    sampleMessage = 'Small sample — treat these as early indicators, not guarantees.';
  } else if (totalRaces >= 200) {
    sampleClass = 'diag-sample-notice--solid';
    sampleMessage = 'Solid sample size — these trends are statistically meaningful.';
  } else {
    sampleMessage = 'Growing sample — trends are forming but more data will sharpen the picture.';
  }

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">What Should You Bet?</h3>
      <p className="diag-chart-description">
        Based on our system&apos;s track record with this data, here are the bet types that give you
        the best edge.
      </p>

      {/* Podium */}
      <div className="diag-podium">
        {top3.map((bet, i) => (
          <div key={bet.key} className={`diag-podium-card ${podiumClasses[i]}`}>
            <div className="diag-podium-rank">{podiumLabels[i]}</div>
            <div className="diag-podium-name">{bet.name}</div>
            <div className="diag-podium-stats">
              <div>
                <div className="diag-podium-stat-label">Hit Rate</div>
                <div className="diag-podium-stat-value">{bet.rate}%</div>
              </div>
              <div>
                <div className="diag-podium-stat-label">Cost</div>
                <div className="diag-podium-stat-value">${bet.ticketCost}</div>
              </div>
              <div>
                <div className="diag-podium-stat-label">Verdict</div>
                <div className={getVerdictClass(bet.verdict)}>{bet.verdict}</div>
              </div>
            </div>
            <p className="diag-podium-description">
              This bet hits {bet.rate}% of the time and costs ${bet.ticketCost} per ticket.{' '}
              {bet.contextDescription}
            </p>
          </div>
        ))}
      </div>

      {/* Sample size notice */}
      <div className={`diag-sample-notice ${sampleClass}`} style={{ marginTop: 16 }}>
        <p className="diag-sample-notice-text">
          These recommendations are based on {totalRaces} races across {totalTracks} track
          {totalTracks !== 1 ? 's' : ''}. As more data is added, these insights become more
          reliable.
        </p>
        <p
          className={`diag-sample-notice-text ${totalRaces < 50 ? 'diag-sample-notice-text--warn' : totalRaces >= 200 ? 'diag-sample-notice-text--success' : ''}`}
        >
          {sampleMessage}
        </p>
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

          {/* Bet Performance Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 3 }}
          >
            <BetPerformanceBreakdown results={results} />
          </motion.div>

          {/* What Should You Bet? — Recommended bets */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: STAGGER * 4 }}
          >
            <RecommendedBets results={results} />
          </motion.div>

          {/* Track Comparison Table — only when All Tracks */}
          {!isFiltered && results.trackSummaries.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: STAGGER * 5 }}
            >
              <TrackComparisonTable results={results} />
            </motion.div>
          )}

          {/* Metadata footer */}
          <motion.div
            className="diag-metadata"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: STAGGER * 6 }}
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
