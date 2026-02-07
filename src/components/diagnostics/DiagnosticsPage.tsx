/**
 * DiagnosticsPage
 *
 * DRF file health check and engine status page.
 * Validates the currently loaded DRF file's data integrity
 * and confirms the scoring engine is healthy.
 */

import { useState, useCallback } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import type { ParsedDRFFile } from '../../types/drf';
import type {
  EngineStatusCheck,
  RaceHealthRow,
  HorseHealthDetail,
  DataQualityGrade,
} from '../../services/diagnostics/types';
import './DiagnosticsPage.css';

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosticsPageProps {
  parsedData: ParsedDRFFile | null;
  onBack: () => void;
}

// ============================================================================
// GRADE COLOR
// ============================================================================

function gradeColor(grade: DataQualityGrade): string {
  switch (grade) {
    case 'A':
      return 'var(--color-success)';
    case 'B':
      return 'var(--color-primary)';
    case 'C':
      return 'var(--color-warning)';
    case 'D':
      return 'var(--color-error)';
    case 'F':
      return 'var(--color-error)';
  }
}

// ============================================================================
// ENGINE STATUS SECTION
// ============================================================================

function EngineStatusSection({
  checks,
  allOperational,
  issueCount,
}: {
  checks: EngineStatusCheck[];
  allOperational: boolean;
  issueCount: number;
}) {
  return (
    <div className="hc-card">
      <h2 className="hc-card-title">Scoring Engine Status</h2>
      <p className="hc-card-desc">
        These checks confirm the prediction engine is configured correctly and all subsystems are
        active.
      </p>
      <div className="hc-status-grid">
        {checks.map((check) => (
          <div key={check.label} className="hc-status-row">
            <span
              className="hc-status-icon"
              style={{ color: check.ok ? 'var(--color-success)' : 'var(--color-error)' }}
            >
              {check.ok ? '\u2713' : '\u2717'}
            </span>
            <span className="hc-status-label">{check.label}</span>
            <span className="hc-status-value">{check.value}</span>
          </div>
        ))}
      </div>
      <div
        className="hc-status-summary"
        style={{ color: allOperational ? 'var(--color-success)' : 'var(--color-error)' }}
      >
        {allOperational
          ? 'All systems operational'
          : `${issueCount} issue${issueCount !== 1 ? 's' : ''} detected`}
      </div>
    </div>
  );
}

// ============================================================================
// FILE SUMMARY CARD
// ============================================================================

function FileSummaryCard({
  summary,
}: {
  summary: {
    filename: string;
    trackName: string;
    raceDate: string;
    raceCount: number;
    totalHorses: number;
    surfaceTypes: string[];
    distanceRange: string;
    parseTimeMs: number;
  };
}) {
  return (
    <div className="hc-card">
      <h2 className="hc-card-title">File Summary</h2>
      <div className="hc-summary-grid">
        <div className="hc-summary-item">
          <span className="hc-summary-label">File Name</span>
          <span className="hc-summary-value">{summary.filename}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Track</span>
          <span className="hc-summary-value">{summary.trackName}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Race Date</span>
          <span className="hc-summary-value">{summary.raceDate}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Races</span>
          <span className="hc-summary-value">{summary.raceCount}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Total Horses</span>
          <span className="hc-summary-value">{summary.totalHorses}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Surfaces</span>
          <span className="hc-summary-value">{summary.surfaceTypes.join(', ')}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Distance Range</span>
          <span className="hc-summary-value">{summary.distanceRange}</span>
        </div>
        <div className="hc-summary-item">
          <span className="hc-summary-label">Parse Time</span>
          <span className="hc-summary-value">{summary.parseTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PER-HORSE DETAIL (expandable)
// ============================================================================

function HorseDetail({ horse }: { horse: HorseHealthDetail }) {
  const figures =
    horse.speedFigures.length > 0
      ? horse.speedFigures.map((f) => (f !== null ? String(f) : '—')).join(', ')
      : null;

  const ppLabel =
    horse.pastPerformanceCount === 0
      ? 'First time starter'
      : `${horse.pastPerformanceCount} past race${horse.pastPerformanceCount !== 1 ? 's' : ''}`;

  const layoffLabel =
    horse.daysSinceLastRace === null ? 'First start' : `${horse.daysSinceLastRace} days`;

  return (
    <div className="hc-horse-detail">
      <div className="hc-horse-header">
        <span className="hc-horse-post">#{horse.postPosition}</span>
        <span className="hc-horse-program">({horse.programNumber})</span>
        <span className="hc-horse-name">{horse.horseName}</span>
        <span className="hc-horse-ml">ML: {horse.morningLineOdds}</span>
        <span className="hc-horse-completeness">{horse.completenessPercent}%</span>
      </div>
      <div className="hc-horse-stats">
        <div className="hc-horse-stat">
          <span className="hc-horse-stat-label">Jockey</span>
          <span className="hc-horse-stat-value">
            {horse.jockeyName} ({horse.jockeyWinPct}%)
          </span>
        </div>
        <div className="hc-horse-stat">
          <span className="hc-horse-stat-label">Trainer</span>
          <span className="hc-horse-stat-value">
            {horse.trainerName} ({horse.trainerWinPct}%)
          </span>
        </div>
        <div className="hc-horse-stat">
          <span className="hc-horse-stat-label">Speed Figs (last 3)</span>
          <span
            className="hc-horse-stat-value"
            style={!figures ? { color: 'var(--color-warning)' } : undefined}
          >
            {figures ?? 'No figures'}
          </span>
        </div>
        <div className="hc-horse-stat">
          <span className="hc-horse-stat-label">Past Performances</span>
          <span
            className="hc-horse-stat-value"
            style={horse.pastPerformanceCount === 0 ? { color: 'var(--color-warning)' } : undefined}
          >
            {ppLabel}
          </span>
        </div>
        <div className="hc-horse-stat">
          <span className="hc-horse-stat-label">Running Style</span>
          <span
            className="hc-horse-stat-value"
            style={horse.runningStyle === 'Unknown' ? { color: 'var(--color-warning)' } : undefined}
          >
            {horse.runningStyle}
          </span>
        </div>
        <div className="hc-horse-stat">
          <span className="hc-horse-stat-label">Days Since Last Race</span>
          <span className="hc-horse-stat-value">{layoffLabel}</span>
        </div>
      </div>
      {horse.warnings.length > 0 && (
        <div className="hc-horse-warnings">
          {horse.warnings.map((w, i) => (
            <span key={i} className="hc-horse-warning">
              {w.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PER-RACE ROW (with expandable horse details)
// ============================================================================

function RaceRow({ race }: { race: RaceHealthRow }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((e) => !e), []);

  return (
    <>
      <tr
        className="hc-race-row"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') toggle();
        }}
      >
        <td className="hc-race-num">{race.raceNumber}</td>
        <td>{race.distance}</td>
        <td className="hc-race-type">{race.raceType}</td>
        <td className="hc-tabular">{race.purse}</td>
        <td className="hc-tabular">{race.fieldSize}</td>
        <td className="hc-tabular">{race.scratchCount > 0 ? race.scratchCount : 'None'}</td>
        <td style={{ color: gradeColor(race.grade), fontWeight: 700 }}>{race.grade}</td>
        <td
          className="hc-tabular"
          style={race.issueCount > 0 ? { color: 'var(--color-warning)' } : undefined}
        >
          {race.issueCount > 0 ? race.issueCount : 'Clean'}
        </td>
        <td className="hc-expand-cell">
          <span className={`hc-expand-arrow ${expanded ? 'hc-expand-arrow--open' : ''}`}>
            {'\u25B8'}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="hc-horse-expand-row">
          <td colSpan={9}>
            <div className="hc-horses-list">
              {race.horses.map((horse) => (
                <HorseDetail key={horse.postPosition} horse={horse} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================================
// RACE HEALTH TABLE
// ============================================================================

function RaceHealthTable({ races }: { races: RaceHealthRow[] }) {
  return (
    <div className="hc-card hc-race-table-card">
      <h2 className="hc-card-title">Per-Race Health</h2>
      <p className="hc-card-desc">
        One row per race. Tap a row to see per-horse details. Data quality grades are based on
        completeness of critical fields (speed figures, past performances) and high-priority fields
        (jockey/trainer stats, morning line odds).
      </p>
      <div className="hc-table-wrapper">
        <table className="hc-table">
          <thead>
            <tr>
              <th>
                <div className="hc-th-label">Race</div>
                <div className="hc-th-sub">Number</div>
              </th>
              <th>
                <div className="hc-th-label">Distance</div>
                <div className="hc-th-sub">Furlongs + surface</div>
              </th>
              <th>
                <div className="hc-th-label">Type</div>
                <div className="hc-th-sub">Race classification</div>
              </th>
              <th>
                <div className="hc-th-label">Purse</div>
                <div className="hc-th-sub">Total prize money</div>
              </th>
              <th>
                <div className="hc-th-label">Field</div>
                <div className="hc-th-sub">Active horses</div>
              </th>
              <th>
                <div className="hc-th-label">SCR</div>
                <div className="hc-th-sub">Scratches</div>
              </th>
              <th>
                <div className="hc-th-label">Grade</div>
                <div className="hc-th-sub">Data quality</div>
              </th>
              <th>
                <div className="hc-th-label">Issues</div>
                <div className="hc-th-sub">Warnings found</div>
              </th>
              <th>
                <div className="hc-th-label"></div>
                <div className="hc-th-sub"></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {races.map((race) => (
              <RaceRow key={race.raceNumber} race={race} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// TRACK INTELLIGENCE STATUS
// ============================================================================

function TrackIntelligenceCard({
  status,
}: {
  status: {
    hasData: boolean;
    trackCode: string;
    trackName: string;
    hasPostPositionBias: boolean;
    hasSpeedBias: boolean;
    hasSeasonalPatterns: boolean;
  };
}) {
  if (!status.hasData) {
    return (
      <div className="hc-card hc-track-intel-card">
        <h2 className="hc-card-title">Track Intelligence</h2>
        <p className="hc-track-intel-warning">
          No track-specific intelligence available for {status.trackName} ({status.trackCode}).
          Using default settings.
        </p>
      </div>
    );
  }

  return (
    <div className="hc-card hc-track-intel-card">
      <h2 className="hc-card-title">Track Intelligence</h2>
      <p className="hc-card-desc">
        Track-specific data loaded for {status.trackName} ({status.trackCode}).
      </p>
      <div className="hc-status-grid">
        <div className="hc-status-row">
          <span
            className="hc-status-icon"
            style={{
              color: status.hasPostPositionBias
                ? 'var(--color-success)'
                : 'var(--color-text-tertiary)',
            }}
          >
            {status.hasPostPositionBias ? '\u2713' : '\u2014'}
          </span>
          <span className="hc-status-label">Post Position Bias</span>
          <span className="hc-status-value">
            {status.hasPostPositionBias ? 'Sprint + Route data' : 'Not available'}
          </span>
        </div>
        <div className="hc-status-row">
          <span
            className="hc-status-icon"
            style={{
              color: status.hasSpeedBias ? 'var(--color-success)' : 'var(--color-text-tertiary)',
            }}
          >
            {status.hasSpeedBias ? '\u2713' : '\u2014'}
          </span>
          <span className="hc-status-label">Speed Bias</span>
          <span className="hc-status-value">
            {status.hasSpeedBias ? 'Available' : 'Not available'}
          </span>
        </div>
        <div className="hc-status-row">
          <span
            className="hc-status-icon"
            style={{
              color: status.hasSeasonalPatterns
                ? 'var(--color-success)'
                : 'var(--color-text-tertiary)',
            }}
          >
            {status.hasSeasonalPatterns ? '\u2713' : '\u2014'}
          </span>
          <span className="hc-status-label">Seasonal Patterns</span>
          <span className="hc-status-value">
            {status.hasSeasonalPatterns ? 'Available' : 'Not available'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NO FILE LOADED STATE
// ============================================================================

function NoFileState() {
  return (
    <div className="hc-no-file">
      <p className="hc-no-file-text">
        No race card loaded. Upload a DRF file on the main screen to see a complete health check of
        your data here.
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function DiagnosticsPageInner({ parsedData, onBack }: DiagnosticsPageProps) {
  const { engineStatus, healthCheck } = useDiagnostics(parsedData);

  return (
    <div className="hc-page">
      <header className="hc-header">
        <button className="hc-back-btn" onClick={onBack} aria-label="Back to app">
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="hc-page-title">System Diagnostics</h1>
      </header>

      <main className="hc-content">
        {/* Top section: Engine Status + File Summary side by side on desktop */}
        <div className="hc-top-row">
          <EngineStatusSection
            checks={engineStatus.checks}
            allOperational={engineStatus.allOperational}
            issueCount={engineStatus.issueCount}
          />
          {healthCheck ? <FileSummaryCard summary={healthCheck.summary} /> : <NoFileState />}
        </div>

        {/* DRF Health Check sections — only when file loaded */}
        {healthCheck && (
          <div className="hc-sections">
            <div className="hc-section-header">
              <h2 className="hc-section-title">Loaded Race Card</h2>
              <p className="hc-section-desc">
                A complete readout of the race data file currently loaded for handicapping. Review
                this to confirm all data was parsed correctly.
              </p>
            </div>

            <RaceHealthTable races={healthCheck.races} />

            <TrackIntelligenceCard status={healthCheck.trackIntelligence} />
          </div>
        )}
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
