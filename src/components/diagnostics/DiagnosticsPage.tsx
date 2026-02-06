/**
 * DiagnosticsPage
 *
 * Hidden diagnostics dashboard that displays algorithm validation results.
 * Accessible only by tapping the branding title in the header.
 * Shows analysis progress while running, then displays summary statistics
 * comparing algorithm predictions against actual race outcomes.
 *
 * @component
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from '../ErrorBoundary';
import type { UseDiagnosticsReturn } from '../../hooks/useDiagnostics';
import type { TierPerformance, TrackSummary } from '../../services/diagnostics/types';
import './DiagnosticsPage.css';

// ============================================================================
// PROPS
// ============================================================================

interface DiagnosticsPageProps {
  /** Diagnostics hook return value */
  diagnostics: UseDiagnosticsReturn;
  /** Navigate back to the main app */
  onBack: () => void;
}

// ============================================================================
// TOOLTIP COMPONENT
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
      <span className="diag-tooltip-icon">?</span>
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
// METRIC CARD
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
// TIER TABLE
// ============================================================================

function TierTable({ tiers }: { tiers: TierPerformance[] }) {
  if (tiers.length === 0) return null;

  return (
    <motion.div
      className="diag-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
    >
      <h3 className="diag-card-title">
        <Tooltip text="How horses perform grouped by our confidence level">
          Performance by Tier
        </Tooltip>
      </h3>
      <div className="diag-table-wrapper">
        <table className="diag-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Horses</th>
              <th>
                <Tooltip text="How often a horse in this tier won the race">Win Rate</Tooltip>
              </th>
              <th>
                <Tooltip text="In The Money — finished 1st, 2nd, or 3rd">ITM Rate</Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.tierName}>
                <td>
                  <Tooltip text={tier.tooltip}>{tier.tierLabel}</Tooltip>
                </td>
                <td className="diag-tabular">{tier.horseCount.toLocaleString()}</td>
                <td className="diag-tabular">{tier.winRate}%</td>
                <td className="diag-tabular">{tier.itmRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ============================================================================
// TRACK CARDS
// ============================================================================

function TrackCards({ tracks }: { tracks: TrackSummary[] }) {
  if (tracks.length === 0) return null;

  return (
    <motion.div
      className="diag-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.15 }}
    >
      <h3 className="diag-card-title">
        <Tooltip text="Algorithm accuracy broken down by racetrack">Performance by Track</Tooltip>
      </h3>
      <div className="diag-track-grid">
        {tracks.map((track) => (
          <div key={track.trackCode} className="diag-track-card">
            <div className="diag-track-code">{track.trackCode}</div>
            <div className="diag-track-stats">
              <div className="diag-track-stat">
                <span className="diag-track-stat-label">Races</span>
                <span className="diag-track-stat-value diag-tabular">{track.raceCount}</span>
              </div>
              <div className="diag-track-stat">
                <span className="diag-track-stat-label">
                  <Tooltip text="How often our top-ranked horse actually won the race">
                    Win Rate
                  </Tooltip>
                </span>
                <span className="diag-track-stat-value diag-tabular">{track.topPickWinRate}%</span>
              </div>
              <div className="diag-track-stat">
                <span className="diag-track-stat-label">
                  <Tooltip text="How often our top-ranked horse finished 1st, 2nd, or 3rd">
                    ITM
                  </Tooltip>
                </span>
                <span className="diag-track-stat-value diag-tabular">{track.topPickITMRate}%</span>
              </div>
            </div>
            <div className="diag-track-date">{track.dateRange}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// COMPLETE STATE
// ============================================================================

function CompleteState({ diagnostics }: { diagnostics: UseDiagnosticsReturn }) {
  const { results, rerun } = diagnostics;
  if (!results) return null;

  if (results.totalRaces === 0) {
    return <NoDataState />;
  }

  const analysisTimeSec = (results.analysisTimeMs / 1000).toFixed(1);
  const analyzedDate = new Date(results.analyzedAt).toLocaleString();

  return (
    <div className="diag-results">
      {/* Top row — 4 key metrics */}
      <div className="diag-metrics-grid">
        <MetricCard
          label="Races Analyzed"
          value={results.validRaces.toString()}
          subtitle={`${results.totalHorses.toLocaleString()} horses scored`}
          tooltip="Total number of races where we had both predictions and actual results"
        />
        <MetricCard
          label="Top Pick Win Rate"
          value={`${results.topPickWinRate}%`}
          subtitle={`${results.topPickWins} of ${results.validRaces}`}
          tooltip="How often our #1 ranked horse actually won the race"
        />
        <MetricCard
          label="Top Pick In Money"
          value={`${results.topPickShowRate}%`}
          subtitle={`${results.topPickShows} of ${results.validRaces}`}
          tooltip="How often our #1 ranked horse finished 1st, 2nd, or 3rd"
        />
        <MetricCard
          label="Data Coverage"
          value={`${results.totalTracks} tracks`}
          subtitle={results.dateRange}
          tooltip="Number of different racetracks and date range covered in the dataset"
        />
      </div>

      {/* Tier performance */}
      <TierTable tiers={results.tierPerformance} />

      {/* Per-track summary */}
      <TrackCards tracks={results.trackSummaries} />

      {/* Metadata footer */}
      <motion.div
        className="diag-metadata"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
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
      {/* Header bar */}
      <header className="diag-header">
        <button className="diag-back-btn" onClick={onBack} aria-label="Back to app">
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="diag-page-title">Algorithm Diagnostics</h1>
      </header>

      {/* Content */}
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
