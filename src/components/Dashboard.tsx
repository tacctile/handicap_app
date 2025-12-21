import React from 'react';
import './Dashboard.css';
import { usePostTime } from '../hooks/usePostTime';
import type { ParsedDRFFile } from '../types/drf';
import type { TrackCondition as RaceStateTrackCondition } from '../hooks/useRaceState';

interface DashboardProps {
  parsedData: ParsedDRFFile | null;
  selectedRaceIndex: number;
  trackCondition: RaceStateTrackCondition;
  onTrackConditionChange: (condition: RaceStateTrackCondition) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  parsedData,
  selectedRaceIndex,
  trackCondition,
  onTrackConditionChange,
}) => {
  // Get current race data
  const currentRace = parsedData?.races?.[selectedRaceIndex];
  const postTimeString = currentRace?.header?.postTime;
  const raceDateString = currentRace?.header?.raceDateRaw;

  // Get raceDate from the first race (all races in a file are same track/date)
  const raceDate = parsedData?.races?.[0]?.header?.raceDateRaw;
  const trackCode = parsedData?.races?.[0]?.header?.trackCode;

  // Use post time hook for countdown
  const { countdown } = usePostTime(postTimeString, raceDateString);

  // Format race date for display
  const formatRaceDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'Unknown Date';
    // Try to parse and format the date
    try {
      // DRF dates are typically YYYYMMDD format
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}`);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Get track size (placeholder - could be enhanced with track database)
  const getTrackSize = (code: string | undefined): string => {
    // Common track sizes - this could be moved to track intelligence data
    const trackSizes: Record<string, string> = {
      CD: '1mi',
      SAR: '1⅛mi',
      BEL: '1½mi',
      GP: '1mi',
      KEE: '1⅛mi',
      PEN: '1mi',
      AQU: '1mi',
      DMR: '1mi',
      SA: '1mi',
      TAM: '1mi',
      OP: '1mi',
      FG: '1mi',
    };
    return trackSizes[code || ''] || '1mi';
  };

  // Format countdown for display
  const formatCountdown = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get countdown urgency level
  const getCountdownUrgency = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds <= 0) return 'normal';
    if (seconds <= 300) return 'critical'; // 5 minutes
    if (seconds <= 600) return 'warning'; // 10 minutes
    return 'normal';
  };

  // Handle file upload click
  const handleFileUpload = () => {
    // Trigger the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  // Get countdown seconds from the countdown state
  const countdownSeconds = countdown.totalMs > 0 ? Math.floor(countdown.totalMs / 1000) : 0;

  return (
    <div className="app-shell">
      {/* TOP BAR - Full width, always visible */}
      <header className="app-topbar">
        {/* Logo - always visible */}
        <div className="app-topbar__logo">
          <div className="app-topbar__logo-icon">
            <span className="material-icons">casino</span>
          </div>
          <span className="app-topbar__logo-text">Furlong</span>
        </div>

        {/* Separator after logo */}
        <div className="app-topbar__separator"></div>

        {!parsedData ? (
          /* EMPTY STATE - No DRF loaded */
          <div className="app-topbar__empty">
            <button
              className="app-topbar__upload-btn app-topbar__upload-btn--large"
              onClick={handleFileUpload}
            >
              <span className="material-icons">upload_file</span>
              <span>Upload DRF File</span>
            </button>
          </div>
        ) : (
          /* LOADED STATE - DRF file loaded */
          <>
            {/* Track info */}
            <div className="app-topbar__info">
              <span className="app-topbar__track">
                {trackCode || 'UNK'} ({getTrackSize(trackCode)})
              </span>
              <span className="app-topbar__dot">•</span>
              <span className="app-topbar__date">{formatRaceDate(raceDate)}</span>
              <span className="app-topbar__dot">•</span>
              <span className="app-topbar__races">{parsedData.races?.length || 0} races</span>
            </div>

            {/* Separator */}
            <div className="app-topbar__separator"></div>

            {/* Post time countdown */}
            <div
              className={`app-topbar__countdown app-topbar__countdown--${getCountdownUrgency(countdownSeconds)}`}
            >
              <span>R{selectedRaceIndex + 1} posts in </span>
              <span className="app-topbar__countdown-time">
                {formatCountdown(countdownSeconds)}
              </span>
            </div>

            {/* Separator */}
            <div className="app-topbar__separator"></div>

            {/* Track condition dropdown */}
            <div className="app-topbar__condition">
              <select
                className="app-topbar__condition-select"
                value={trackCondition}
                onChange={(e) => onTrackConditionChange(e.target.value as RaceStateTrackCondition)}
              >
                <option value="fast">Fast</option>
                <option value="good">Good</option>
                <option value="muddy">Muddy</option>
                <option value="sloppy">Sloppy</option>
                <option value="yielding">Yielding</option>
                <option value="firm">Firm</option>
              </select>
            </div>

            {/* Separator */}
            <div className="app-topbar__separator"></div>

            {/* Small upload button */}
            <button
              className="app-topbar__upload-btn app-topbar__upload-btn--small"
              onClick={handleFileUpload}
            >
              <span className="material-icons">upload_file</span>
              <span>Upload</span>
            </button>
          </>
        )}
      </header>

      {/* BODY - Main + Betting Panel */}
      <div className="app-body">
        {/* MAIN CONTENT - 2/3 width */}
        <main className="app-main">
          <div className="app-main__content">
            {/* Placeholder for race tabs + horse table */}
            <div className="app-main__placeholder">
              <span
                className="material-icons"
                style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
              >
                analytics
              </span>
              <h2>Race Analysis</h2>
              <p>Race tabs and horse table will appear here</p>
            </div>
          </div>
        </main>

        {/* BETTING PANEL - 1/3 width, always visible */}
        <aside className="app-betting-panel">
          <div className="app-betting-panel__content">
            {/* Bankroll summary section */}
            <div className="app-betting-panel__section">
              <h3 className="app-betting-panel__section-title">Bankroll</h3>
              <div className="app-betting-panel__placeholder">
                Bankroll summary will appear here
              </div>
            </div>

            {/* Betting recommendations section */}
            <div className="app-betting-panel__section">
              <h3 className="app-betting-panel__section-title">Recommendations</h3>
              <div className="app-betting-panel__placeholder">
                Betting recommendations will appear here
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* BOTTOM BAR */}
      <footer className="app-bottombar">
        {/* Left cluster - Account */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">person</span>
            <span>Guest</span>
          </button>
        </div>

        {/* Separator between Account and Settings */}
        <div className="app-bottombar__separator"></div>

        {/* Settings cluster */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">settings</span>
            <span>Settings</span>
          </button>
        </div>

        {/* Separator after Settings */}
        <div className="app-bottombar__separator"></div>

        {/* Center spacer */}
        <div className="app-bottombar__spacer"></div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Right cluster - Help */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">help_outline</span>
            <span>Help</span>
          </button>
        </div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Legal */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item">
            <span className="material-icons">gavel</span>
            <span>Legal</span>
          </button>
        </div>

        {/* Separator */}
        <div className="app-bottombar__separator"></div>

        {/* Icon-only cluster - Fullscreen, Multi-window */}
        <div className="app-bottombar__cluster">
          <button className="app-bottombar__item app-bottombar__item--icon-only" title="Fullscreen">
            <span className="material-icons">fullscreen</span>
          </button>
          <button
            className="app-bottombar__item app-bottombar__item--icon-only"
            title="Multi-window"
          >
            <span className="material-icons">open_in_new</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
