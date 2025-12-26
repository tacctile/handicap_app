/**
 * Trend Sparkline Component
 *
 * A compact sparkline visualization showing a horse's recent performance trend.
 * 60px × 20px, color-coded by trend direction.
 *
 * Colors:
 * - Green (#22c55e): Improving trend
 * - Red (#ef4444): Declining trend
 * - Yellow (#eab308): Flat/neutral trend
 *
 * @module components/TrendSparkline
 */

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import type { TrendDirection } from '../lib/scoring/trendAnalysis';

// ============================================================================
// TYPES
// ============================================================================

export interface TrendSparklineProps {
  /** Data points (finish positions or Beyers, most recent first) */
  data: number[];
  /** Trend direction for color coding */
  direction: TrendDirection;
  /** Click handler to open detail modal */
  onClick?: () => void;
  /** Width in pixels (default: 60) */
  width?: number;
  /** Height in pixels (default: 20) */
  height?: number;
  /** Whether this shows finish positions (lower is better) */
  invertYAxis?: boolean;
  /** Label for accessibility */
  ariaLabel?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TREND_COLORS: Record<TrendDirection, string> = {
  IMPROVING: '#22c55e', // Green
  DECLINING: '#ef4444', // Red
  FLAT: '#eab308', // Yellow
};

const BACKGROUND_COLORS: Record<TrendDirection, string> = {
  IMPROVING: 'rgba(34, 197, 94, 0.1)',
  DECLINING: 'rgba(239, 68, 68, 0.1)',
  FLAT: 'rgba(234, 179, 8, 0.1)',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TrendSparkline({
  data,
  direction,
  onClick,
  width = 60,
  height = 20,
  invertYAxis = true, // Default for finish positions (1st is best)
  ariaLabel,
}: TrendSparklineProps) {
  // Convert data to chart format (reverse so oldest is first for left-to-right reading)
  const chartData = [...data].reverse().map((value, index) => ({
    index,
    value,
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="trend-sparkline trend-sparkline--empty"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
          borderRadius: '2px',
          color: '#888',
          fontSize: '9px',
        }}
        title="Insufficient data"
      >
        —
      </div>
    );
  }

  const lineColor = TREND_COLORS[direction];
  const bgColor = BACKGROUND_COLORS[direction];

  // Calculate domain for Y axis
  const values = chartData.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(1, (maxValue - minValue) * 0.1);

  return (
    <div
      className="trend-sparkline"
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || `Trend: ${direction.toLowerCase()}`}
      title="Click to expand"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: bgColor,
        borderRadius: '2px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis
            hide
            domain={[Math.max(0, minValue - padding), maxValue + padding]}
            reversed={invertYAxis}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE (even smaller for inline use)
// ============================================================================

export interface MiniSparklineProps {
  /** Data points */
  data: number[];
  /** Trend direction */
  direction: TrendDirection;
  /** Width (default: 40) */
  width?: number;
  /** Height (default: 14) */
  height?: number;
}

export function MiniSparkline({
  data,
  direction,
  width = 40,
  height = 14,
}: MiniSparklineProps) {
  return (
    <TrendSparkline
      data={data}
      direction={direction}
      width={width}
      height={height}
      invertYAxis={true}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TREND_COLORS, BACKGROUND_COLORS };
export default TrendSparkline;
