/**
 * Trend Detail Modal Component
 *
 * A full-featured modal showing detailed trend analysis for a horse.
 * Displays:
 * - Large interactive graph (400px × 200px)
 * - Finish position trend with optional Beyer overlay
 * - Rolling window values
 * - Trend flags and confidence indicators
 *
 * @module components/TrendDetailModal
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { HorseEntry, PastPerformance } from '../types/drf';
import type {
  TrendScore,
  TrendResult,
  TrendDirection,
  TrendConfidence,
} from '../lib/scoring/trendAnalysis';
import { TREND_COLORS } from './TrendSparkline';
import { Icon } from './shared/Icon';

// ============================================================================
// TYPES
// ============================================================================

export interface TrendDetailModalProps {
  /** Horse entry data */
  horse: HorseEntry;
  /** Trend analysis data */
  trendData: TrendScore;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DIRECTION_LABELS: Record<TrendDirection, string> = {
  IMPROVING: 'Improving',
  DECLINING: 'Declining',
  FLAT: 'Flat',
};

const DIRECTION_ICONS: Record<TrendDirection, string> = {
  IMPROVING: 'trending_up',
  DECLINING: 'trending_down',
  FLAT: 'trending_flat',
};

const CONFIDENCE_COLORS: Record<TrendConfidence, string> = {
  HIGH: 'var(--color-success)',
  MEDIUM: 'var(--color-warning)',
  LOW: 'var(--color-error)',
};

const METRIC_LABELS: Record<string, string> = {
  finishPosition: 'Finish Position',
  beyer: 'Beyer Speed Figure',
  beatenLengths: 'Beaten Lengths',
  firstCallPosition: 'Position at 1st Call',
  stretchCallPosition: 'Position at Stretch',
  groundGained: 'Ground Gained',
  classLevel: 'Class Level',
  odds: 'Odds',
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface TrendBadgeProps {
  direction: TrendDirection;
  strength: string;
}

function TrendBadge({ direction, strength }: TrendBadgeProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: `${TREND_COLORS[direction]}20`,
        color: TREND_COLORS[direction],
        fontWeight: 600,
        fontSize: '13px',
      }}
    >
      <Icon name={DIRECTION_ICONS[direction]} />
      <span>{DIRECTION_LABELS[direction]}</span>
      <span style={{ opacity: 0.8 }}>({strength})</span>
    </div>
  );
}

interface ConfidenceBadgeProps {
  confidence: TrendConfidence;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: `${CONFIDENCE_COLORS[confidence]}20`,
        color: CONFIDENCE_COLORS[confidence],
        fontWeight: 500,
        fontSize: '12px',
      }}
    >
      <Icon
        name={
          confidence === 'HIGH' ? 'verified' : confidence === 'MEDIUM' ? 'help_outline' : 'warning'
        }
      />
      <span>{confidence} Confidence</span>
    </div>
  );
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
  pastPerformances: PastPerformance[];
}

function CustomTooltip({ active, payload, label, pastPerformances }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const raceIndex = parseInt(label || '0', 10);
  const race = pastPerformances[raceIndex];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '10px',
        fontSize: '12px',
        color: 'var(--color-text-primary)',
        minWidth: '180px',
      }}
    >
      {race && (
        <>
          <div
            style={{
              fontWeight: 600,
              marginBottom: '6px',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '6px',
            }}
          >
            {race.date} - {race.track}
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Finish:</span>
              <span style={{ fontWeight: 500 }}>
                {race.finishPosition}
                {race.finishPosition === 1
                  ? 'st'
                  : race.finishPosition === 2
                    ? 'nd'
                    : race.finishPosition === 3
                      ? 'rd'
                      : 'th'}{' '}
                of {race.fieldSize}
              </span>
            </div>
            {race.speedFigures?.beyer && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Beyer:</span>
                <span style={{ fontWeight: 500 }}>{race.speedFigures.beyer}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Odds:</span>
              <span style={{ fontWeight: 500 }}>{race.odds ?? 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Class:</span>
              <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                {race.classification.replace(/-/g, ' ')}
              </span>
            </div>
            {race.lengthsBehind > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Beaten:</span>
                <span style={{ fontWeight: 500 }}>{race.lengthsBehind.toFixed(1)} lengths</span>
              </div>
            )}
          </div>
        </>
      )}
      <div
        style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--color-border)' }}
      >
        {payload.map((entry, index) => (
          <div
            key={index}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ color: entry.color }}>
              {entry.dataKey === 'finishPosition' ? 'Finish' : 'Beyer'}:
            </span>
            <span style={{ fontWeight: 500 }}>{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TrendDetailModal({ horse, trendData, isOpen, onClose }: TrendDetailModalProps) {
  const [showBeyer, setShowBeyer] = useState(false);
  const [showBeatenLengths, setShowBeatenLengths] = useState(false);

  // Build chart data from past performances
  const chartData = useMemo(() => {
    const races = horse.pastPerformances ?? [];
    // Reverse so oldest is first (left to right on chart)
    return [...races].reverse().map((race, index) => ({
      index,
      raceNumber: races.length - index,
      finishPosition: race.finishPosition,
      beyer: race.speedFigures?.beyer ?? null,
      beatenLengths: race.lengthsBehind,
      date: race.date,
      track: race.track,
    }));
  }, [horse.pastPerformances]);

  // Calculate Y-axis domains
  const finishDomain = useMemo(() => {
    const positions = chartData.map((d) => d.finishPosition).filter((p) => p > 0);
    if (positions.length === 0) return [1, 10];
    const max = Math.max(...positions);
    return [Math.max(1, max + 1), 1]; // Inverted: 1st at top
  }, [chartData]);

  const beyerDomain = useMemo(() => {
    const beyers = chartData.map((d) => d.beyer).filter((b): b is number => b !== null);
    if (beyers.length === 0) return [60, 100];
    const min = Math.min(...beyers);
    const max = Math.max(...beyers);
    return [Math.max(0, min - 5), max + 5];
  }, [chartData]);

  if (!isOpen) {
    return null;
  }

  const races = horse.pastPerformances ?? [];

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: 'var(--color-elevated)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Trend Analysis: {horse.horseName}
            </h2>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <TrendBadge direction={trendData.direction} strength={trendData.strengthCategory} />
              <ConfidenceBadge confidence={trendData.confidence} />
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close modal"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Chart Section */}
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setShowBeyer(!showBeyer)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: showBeyer ? 'var(--color-primary)' : 'var(--color-border)',
                color: showBeyer ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {showBeyer ? 'Hide' : 'Show'} Beyer
            </button>
            <button
              onClick={() => setShowBeatenLengths(!showBeatenLengths)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: showBeatenLengths ? 'var(--color-primary)' : 'var(--color-border)',
                color: showBeatenLengths
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {showBeatenLengths ? 'Hide' : 'Show'} Beaten Lengths
            </button>
          </div>

          <div style={{ height: '200px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="raceNumber"
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--color-border-prominent)' }}
                  tickFormatter={(value) => `Race ${value}`}
                />
                <YAxis
                  yAxisId="finish"
                  orientation="left"
                  domain={finishDomain}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--color-border-prominent)' }}
                  label={{
                    value: 'Finish',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--color-text-secondary)',
                    fontSize: 11,
                  }}
                  reversed
                />
                {showBeyer && (
                  <YAxis
                    yAxisId="beyer"
                    orientation="right"
                    domain={beyerDomain}
                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--color-border-prominent)' }}
                    label={{
                      value: 'Beyer',
                      angle: 90,
                      position: 'insideRight',
                      fill: 'var(--color-text-secondary)',
                      fontSize: 11,
                    }}
                  />
                )}
                <Tooltip content={<CustomTooltip pastPerformances={races} />} />
                <Legend />
                <ReferenceLine
                  yAxisId="finish"
                  y={1}
                  stroke="var(--color-success)"
                  strokeDasharray="3 3"
                  label={{ value: 'Win', fill: 'var(--color-success)', fontSize: 10 }}
                />
                <Line
                  yAxisId="finish"
                  type="monotone"
                  dataKey="finishPosition"
                  stroke={TREND_COLORS[trendData.direction]}
                  strokeWidth={2}
                  dot={{ fill: TREND_COLORS[trendData.direction], r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Finish Position"
                />
                {showBeyer && (
                  <Line
                    yAxisId="beyer"
                    type="monotone"
                    dataKey="beyer"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#60a5fa', r: 3 }}
                    name="Beyer Figure"
                    connectNulls
                  />
                )}
                {showBeatenLengths && (
                  <Line
                    yAxisId="finish"
                    type="monotone"
                    dataKey="beatenLengths"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={{ fill: '#a855f7', r: 2 }}
                    name="Beaten Lengths"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rolling Windows Section */}
        <div style={{ padding: '0 20px 20px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '12px',
            }}
          >
            Rolling Window Analysis
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '8px',
            }}
          >
            {trendData.finishWindows.window1 !== null && (
              <WindowCard
                label="Race 1"
                value={trendData.finishWindows.window1.toFixed(1)}
                subtext="Current form"
              />
            )}
            {trendData.finishWindows.window1_2 !== null && (
              <WindowCard
                label="Races 1-2"
                value={trendData.finishWindows.window1_2.toFixed(1)}
                subtext="Very recent"
              />
            )}
            {trendData.finishWindows.window1_3 !== null && (
              <WindowCard
                label="Races 1-3"
                value={trendData.finishWindows.window1_3.toFixed(1)}
                subtext="Short-term"
              />
            )}
            {trendData.finishWindows.window4_5 !== null && (
              <WindowCard
                label="Races 4-5"
                value={trendData.finishWindows.window4_5.toFixed(1)}
                subtext="Old baseline"
              />
            )}
            {trendData.finishWindows.window3_5 !== null && (
              <WindowCard
                label="Races 3-5"
                value={trendData.finishWindows.window3_5.toFixed(1)}
                subtext="Older trend"
              />
            )}
          </div>
        </div>

        {/* Metric Details */}
        <div style={{ padding: '0 20px 20px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '12px',
            }}
          >
            Metric Trends
          </h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            {trendData.details.map((detail) => (
              <MetricRow key={detail.metric} detail={detail} />
            ))}
          </div>
        </div>

        {/* Trend Flags */}
        <div style={{ padding: '0 20px 20px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '12px',
            }}
          >
            Trend Signals
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(trendData.flags).map(([key, value]) => (
              <FlagChip key={key} flag={key} active={value} />
            ))}
          </div>
        </div>

        {/* Summary */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-card)',
            borderRadius: '0 0 12px 12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Trend Score:{' '}
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {trendData.normalizedScore.toFixed(1)}/100
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Raw Score:{' '}
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {trendData.rawScore.toFixed(2)}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                Data Points:{' '}
              </span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {trendData.finishWindows.raceCount} races
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface WindowCardProps {
  label: string;
  value: string;
  subtext: string;
}

function WindowCard({ label, value, subtext }: WindowCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-elevated)',
        borderRadius: '6px',
        padding: '10px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>{subtext}</div>
    </div>
  );
}

interface MetricRowProps {
  detail: TrendResult;
}

function MetricRow({ detail }: MetricRowProps) {
  const isPositive = detail.direction === 'IMPROVING';
  const isNegative = detail.direction === 'DECLINING';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: 'var(--color-elevated)',
        borderRadius: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon name={DIRECTION_ICONS[detail.direction]} className="" />
        <span style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>
          {METRIC_LABELS[detail.metric] || detail.metric}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
          {detail.oldAvg.toFixed(1)} → {detail.recentAvg.toFixed(1)}
        </span>
        <span
          style={{
            color: isPositive
              ? 'var(--color-success)'
              : isNegative
                ? 'var(--color-error)'
                : 'var(--color-warning)',
            fontWeight: 600,
            fontSize: '13px',
            minWidth: '50px',
            textAlign: 'right',
          }}
        >
          {detail.strength >= 0 ? '+' : ''}
          {detail.strength.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

interface FlagChipProps {
  flag: string;
  active: boolean;
}

const FLAG_LABELS: Record<string, string> = {
  workoutPatternTrending: 'Workout Pattern',
  optimalLayoff: 'Optimal Layoff',
  classDropImproving: 'Class Drop + Form',
  jockeyUpgrade: 'Jockey Upgrade',
  trainerHotStreak: 'Trainer Hot',
  equipmentChange: 'Equipment Change',
  layoffWithBullet: 'Layoff + Bullet',
  backToWinningDistance: 'Winning Distance',
  preferredSurface: 'Preferred Surface',
};

function FlagChip({ flag, active }: FlagChipProps) {
  return (
    <div
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: active ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-elevated)',
        color: active ? 'var(--color-success)' : 'var(--color-text-tertiary)',
        fontSize: '11px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <Icon name={active ? 'check_circle' : 'radio_button_unchecked'} className="" />
      <span>{FLAG_LABELS[flag] || flag}</span>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TrendDetailModal;
