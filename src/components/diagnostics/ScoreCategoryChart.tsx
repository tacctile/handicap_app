/**
 * ScoreCategoryChart — "Where Does the Algorithm Shine?"
 *
 * Horizontal paired bar chart comparing average scoring category values
 * for winners vs the rest of the field. Sorted by gap size descending.
 */

import { useMemo, useState, type ReactNode } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import type { PredictionRecord } from '../../services/diagnostics/types';

// Design token values for Recharts (CSS vars don't work in SVG)
const C = {
  success: '#10b981',
  textPrimary: '#eeeff1',
  textSecondary: '#b4b4b6',
  textTertiary: '#6e6e70',
  borderSubtle: '#2a2a2c',
  elevated: '#1a1a1c',
} as const;

// Category display config
const CATEGORY_CONFIG: Record<string, { label: string; tooltip: string }> = {
  speed: {
    label: 'Speed',
    tooltip: 'Raw speed figures — how fast the horse runs',
  },
  class: {
    label: 'Class',
    tooltip: 'Quality of competition the horse has faced',
  },
  form: {
    label: 'Form',
    tooltip: 'Recent race results and winning patterns',
  },
  pace: {
    label: 'Pace',
    tooltip: "How the race flow suits this horse's running style",
  },
  connections: {
    label: 'Connections',
    tooltip: 'Jockey and trainer quality and track record',
  },
};

// ============================================================================
// INLINE TOOLTIP (matching DiagnosticsPage pattern)
// ============================================================================

function CategoryTooltip({ text, children }: { text: string; children: ReactNode }) {
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
// CUSTOM TOOLTIP FOR THE CHART
// ============================================================================

interface TooltipPayloadEntry {
  value: number;
  name: string;
  color: string;
  dataKey: string;
  payload: Record<string, unknown>;
}

function ScoreCategoryTooltipContent({
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
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{String(d.label)}</div>
      <div>
        Winners avg <strong>{String(d.winnersAvg)}</strong> vs Field avg{' '}
        <strong>{String(d.fieldAvg)}</strong> (gap:{' '}
        <strong style={{ color: C.success }}>+{String(d.gap)}</strong>)
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ScoreCategoryChart({ predictions }: { predictions: PredictionRecord[] }) {
  const { chartData, topCategory } = useMemo(() => {
    // Check if category scores are available
    const withScores = predictions.filter((p) => p.categoryScores != null);
    if (withScores.length === 0) {
      return { chartData: [], topCategory: null };
    }

    const winners = withScores.filter((p) => p.actualFinish === 1);
    const nonWinners = withScores.filter((p) => p.actualFinish !== 1);

    if (winners.length === 0) {
      return { chartData: [], topCategory: null };
    }

    const categories = Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>;
    const data = categories.map((cat) => {
      const winnerAvg =
        winners.reduce(
          (sum, p) => sum + (p.categoryScores![cat as keyof typeof p.categoryScores] ?? 0),
          0
        ) / winners.length;
      const fieldAvg =
        nonWinners.length > 0
          ? nonWinners.reduce(
              (sum, p) => sum + (p.categoryScores![cat as keyof typeof p.categoryScores] ?? 0),
              0
            ) / nonWinners.length
          : 0;
      const gap = Math.round((winnerAvg - fieldAvg) * 10) / 10;
      return {
        category: cat,
        label: CATEGORY_CONFIG[cat]!.label,
        tooltip: CATEGORY_CONFIG[cat]!.tooltip,
        winnersAvg: Math.round(winnerAvg * 10) / 10,
        fieldAvg: Math.round(fieldAvg * 10) / 10,
        gap,
      };
    });

    // Sort by gap descending
    data.sort((a, b) => b.gap - a.gap);

    return {
      chartData: data,
      topCategory: data[0] ?? null,
    };
  }, [predictions]);

  if (chartData.length === 0) return null;

  const maxScore = Math.max(...chartData.flatMap((d) => [d.winnersAvg, d.fieldAvg]));
  const xMax = Math.ceil(maxScore / 10) * 10 + 10;

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Where Does the Algorithm Shine?</h3>
      <p className="diag-chart-description">
        Which parts of our scoring system are best at identifying winners. Bigger gaps between
        winners and the rest of the field mean that category is doing the heavy lifting.
      </p>

      {/* Category labels with tooltips */}
      <div className="diag-score-category-labels">
        {chartData.map((d) => (
          <CategoryTooltip key={d.category} text={d.tooltip}>
            <span className="diag-score-category-label">{d.label}</span>
          </CategoryTooltip>
        ))}
      </div>

      {/* Horizontal paired bar chart */}
      <div className="diag-chart-container">
        <ResponsiveContainer width="100%" height={chartData.length * 56 + 48}>
          <BarChart
            data={chartData}
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
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: C.textSecondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <RechartsTooltip
              content={<ScoreCategoryTooltipContent />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value: string) => (
                <span style={{ color: C.textSecondary, fontSize: 12 }}>{value}</span>
              )}
            />
            <Bar
              dataKey="fieldAvg"
              name="Field Average"
              fill="rgba(110, 110, 112, 0.5)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
            <Bar
              dataKey="winnersAvg"
              name="Winners"
              fill={C.success}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {topCategory && (
        <p className="diag-chart-insight">
          {topCategory.label} is our strongest predictor — winners score {topCategory.gap} points
          higher than the field average in this category.
        </p>
      )}
    </div>
  );
}
