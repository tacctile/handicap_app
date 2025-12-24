import React, { useState, useMemo, useEffect } from 'react';
import './Dashboard.css';
import { usePostTime } from '../hooks/usePostTime';
import { useBankroll } from '../hooks/useBankroll';
import { BankrollSettings } from './BankrollSettings';
import { BettingRecommendations } from './BettingRecommendations';
import { FileUpload } from './FileUpload';
import { RaceTableSimple } from './RaceTableSimple';
import { ScoringHelpModal } from './ScoringHelpModal';
import { calculateRaceScores } from '../lib/scoring';
import { getTrackData } from '../data/tracks';
import type { ParsedDRFFile, ParsedRace } from '../types/drf';
import type { useRaceState } from '../hooks/useRaceState';
import type { TrackCondition as RaceStateTrackCondition } from '../hooks/useRaceState';

interface DashboardProps {
  parsedData: ParsedDRFFile | null;
  selectedRaceIndex: number;
  onRaceSelect?: (index: number) => void;
  trackCondition: RaceStateTrackCondition;
  onTrackConditionChange: (condition: RaceStateTrackCondition) => void;
  raceState: ReturnType<typeof useRaceState>;
  isLoading?: boolean;
  onParsed?: (data: ParsedDRFFile) => void;
}

// Format currency helper
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Expand race classification abbreviations to readable text
const expandClassification = (classification: string): string => {
  const expansions: Record<string, string> = {
    maiden: 'MAIDEN',
    maiden_claiming: 'MAIDEN CLAIMING',
    maiden_special_weight: 'MAIDEN SPECIAL WEIGHT',
    claiming: 'CLAIMING',
    allowance: 'ALLOWANCE',
    allowance_optional_claiming: 'ALLOWANCE OPTIONAL CLAIMING',
    stakes: 'STAKES',
    graded_stakes: 'GRADED STAKES',
    listed: 'LISTED STAKES',
    handicap: 'HANDICAP',
    starter_allowance: 'STARTER ALLOWANCE',
    unknown: 'UNKNOWN',
    // Also handle abbreviated codes
    MSW: 'MAIDEN SPECIAL WEIGHT',
    MCL: 'MAIDEN CLAIMING',
    CLM: 'CLAIMING',
    ALW: 'ALLOWANCE',
    AOC: 'ALLOWANCE OPTIONAL CLAIMING',
    STK: 'STAKES',
    HCP: 'HANDICAP',
  };
  return (
    expansions[classification] ||
    expansions[classification.toUpperCase()] ||
    classification.toUpperCase()
  );
};

// Expand age restriction to readable text
const expandAge = (age: string): string => {
  if (!age) return '';
  const ageMap: Record<string, string> = {
    '2YO': '2-Year-Olds',
    '3YO': '3-Year-Olds',
    '4YO': '4-Year-Olds',
    '5YO': '5-Year-Olds',
    '3&UP': '3-Year-Olds & Up',
    '3+': '3-Year-Olds & Up',
    '4&UP': '4-Year-Olds & Up',
    '4+': '4-Year-Olds & Up',
    '5&UP': '5-Year-Olds & Up',
    '5+': '5-Year-Olds & Up',
  };
  return ageMap[age.toUpperCase()] || age;
};

// Expand sex restriction to readable text
const expandSex = (sex: string): string => {
  if (!sex) return '';
  const sexMap: Record<string, string> = {
    F: 'Fillies',
    M: 'Mares',
    'F&M': 'Fillies & Mares',
    C: 'Colts',
    G: 'Geldings',
    'C&G': 'Colts & Geldings',
    H: 'Horses',
  };
  return sexMap[sex.toUpperCase()] || sex;
};

// Get full track name with code and size
const getTrackDisplayName = (trackCode: string | undefined, trackSize: string): string => {
  if (!trackCode) return 'Unknown Track';
  const trackData = getTrackData(trackCode);
  if (trackData) {
    return `${trackData.name} (${trackCode} ${trackSize})`;
  }
  // Fallback to just code if no track data
  return `${trackCode} (${trackSize})`;
};

// Build readable race description as flowing sentences
const buildRaceDescription = (race: ParsedRace | undefined): { line1: string; line2: string } => {
  if (!race?.header) return { line1: '', line2: '' };

  // Line 1: Distance + Classification + "for [restrictions]"
  const line1Parts: string[] = [];

  // Distance
  if (race.header.distance) {
    line1Parts.push(race.header.distance);
  }

  // Classification
  if (race.header.classification && race.header.classification !== 'unknown') {
    line1Parts.push(expandClassification(race.header.classification));
  }

  // Build "for [sex] [age]" phrase
  const sexText = expandSex(race.header.sexRestriction);
  const ageText = expandAge(race.header.ageRestriction);
  if (sexText && ageText) {
    line1Parts.push(`for ${sexText} ${ageText}`);
  } else if (ageText) {
    line1Parts.push(`for ${ageText}`);
  } else if (sexText) {
    line1Parts.push(`for ${sexText}`);
  }

  // Line 2: Purse + Field size
  const line2Parts: string[] = [];

  // Purse
  if (race.header.purse) {
    line2Parts.push(`Purse ${race.header.purseFormatted || formatCurrency(race.header.purse)}`);
  }

  // Field size
  const fieldSize = race.horses?.length || race.header.fieldSize || 0;
  if (fieldSize > 0) {
    line2Parts.push(`${fieldSize} Runners`);
  }

  return {
    line1: line1Parts.join(' ') + (line1Parts.length > 0 ? '.' : ''),
    line2: line2Parts.join('. ') + (line2Parts.length > 0 ? '.' : ''),
  };
};

export const Dashboard: React.FC<DashboardProps> = ({
  parsedData,
  selectedRaceIndex,
  onRaceSelect,
  trackCondition,
  onTrackConditionChange,
  raceState,
  isLoading = false,
  onParsed,
}) => {
  // Bankroll management hook
  const bankroll = useBankroll();

  // UI state for bankroll config slide-out
  const [bankrollConfigOpen, setBankrollConfigOpen] = useState(false);

  // UI state for betting panel collapse
  const [bettingPanelCollapsed, setBettingPanelCollapsed] = useState(false);

  // State for scoring help modal
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Debug: Log parsed data when it changes
  useEffect(() => {
    if (parsedData) {
      console.log('Parsed DRF data:', parsedData);
      console.log('Track:', parsedData.races?.[0]?.header?.trackCode);
      console.log('Date:', parsedData.races?.[0]?.header?.raceDateRaw);
      console.log('Races:', parsedData.races?.length);

      // Debug: Log all race post time fields to find missing data patterns
      parsedData.races?.forEach((race, index) => {
        const header = race.header as unknown as Record<string, unknown>;
        console.log(`Race ${index + 1} post time fields:`, {
          postTime: header?.postTime,
          post_time: header?.post_time,
          PostTime: header?.PostTime,
          racePostTime: header?.racePostTime,
          postTimeText: header?.postTimeText,
          time: header?.time,
          raceTime: header?.raceTime,
          allKeys: header ? Object.keys(header) : [],
        });
      });

      // Expand betting panel when new file is loaded
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional expand on new data load
      setBettingPanelCollapsed(false);
    }
  }, [parsedData]);

  // Reset scratches and odds when race changes
  useEffect(() => {
    raceState.resetAll();
  }, [selectedRaceIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate scored horses for current race (needed for betting recommendations)
  const currentRaceScoredHorses = useMemo(() => {
    if (!parsedData) return [];

    const race = parsedData.races[selectedRaceIndex];
    if (!race) return [];

    return calculateRaceScores(
      race.horses,
      race.header,
      (i, originalOdds) => raceState.getOdds(i, originalOdds),
      (i) => raceState.isScratched(i),
      raceState.trackCondition
    );
  }, [parsedData, selectedRaceIndex, raceState]);

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

  // Format countdown for display - handles past races
  const formatCountdownDisplay = (
    postTime: string | undefined,
    raceDate: string | undefined,
    _countdownMs: number
  ): { text: string; isPosted: boolean } => {
    if (!postTime) return { text: '--:--', isPosted: false };

    try {
      // Construct full datetime from race date and post time
      let raceDateTime: Date;
      const timeStr = String(postTime).trim();

      // Parse the race date (YYYYMMDD format)
      let targetDate = new Date();
      if (raceDate && /^\d{8}$/.test(raceDate)) {
        const year = parseInt(raceDate.substring(0, 4));
        const month = parseInt(raceDate.substring(4, 6)) - 1; // 0-indexed
        const day = parseInt(raceDate.substring(6, 8));
        targetDate = new Date(year, month, day);
      }

      // Handle HHMM format (e.g., "1326" for 1:26 PM)
      if (/^\d{3,4}$/.test(timeStr)) {
        const padded = timeStr.padStart(4, '0');
        const hours = parseInt(padded.substring(0, 2));
        const minutes = parseInt(padded.substring(2));
        raceDateTime = new Date(targetDate);
        raceDateTime.setHours(hours, minutes, 0, 0);
      } else if (timeStr.includes(':')) {
        // Handle "HH:MM" or "H:MM" format
        const parts = timeStr.replace(/\s*(AM|PM)/i, '').split(':');
        let hours = parseInt(parts[0] || '0');
        const minutes = parseInt(parts[1] || '0');

        // Check for AM/PM
        if (/PM/i.test(timeStr) && hours < 12) hours += 12;
        if (/AM/i.test(timeStr) && hours === 12) hours = 0;

        raceDateTime = new Date(targetDate);
        raceDateTime.setHours(hours, minutes, 0, 0);
      } else {
        return { text: '--:--', isPosted: false };
      }

      const now = new Date();
      const diffMs = raceDateTime.getTime() - now.getTime();

      // If race is in the past, show "POSTED"
      if (diffMs < 0) {
        return { text: 'POSTED', isPosted: true };
      }

      // Convert to seconds
      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;

      // If more than 60 minutes, show hours:minutes:seconds
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return {
          text: `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
          isPosted: false,
        };
      }

      // Show minutes:seconds
      return {
        text: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        isPosted: false,
      };
    } catch {
      return { text: '--:--', isPosted: false };
    }
  };

  // Get countdown urgency level
  const getCountdownUrgency = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds <= 0) return 'normal';
    if (seconds <= 300) return 'critical'; // 5 minutes
    if (seconds <= 600) return 'warning'; // 10 minutes
    return 'normal';
  };

  // Get post time from race header, checking all possible field names
  const getPostTime = (race: ParsedRace | undefined): string | number | undefined => {
    if (!race?.header) return undefined;

    const header = race.header as unknown as Record<string, unknown>;

    // Try all possible field names
    const timeValue =
      header.postTime ||
      header.post_time ||
      header.PostTime ||
      header.racePostTime ||
      header.postTimeText ||
      header.time ||
      header.raceTime;

    return timeValue as string | number | undefined;
  };

  // Format post time for display (e.g., "1:26 PM")
  const formatPostTime = (postTime: string | number | undefined): string => {
    if (!postTime) return '--:--';

    try {
      const timeStr = String(postTime).trim();

      // Handle numeric formats (military time like 1326 or 326 or 115)
      if (/^\d{3,4}$/.test(timeStr)) {
        const padded = timeStr.padStart(4, '0');
        const hours = parseInt(padded.substring(0, 2), 10);
        const minutes = parseInt(padded.substring(2), 10);

        // Validate hours and minutes
        if (hours > 23 || minutes > 59) {
          return '--:--';
        }

        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }

      // Handle "HH:MM" format (12 or 24 hour)
      const colonMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (colonMatch && colonMatch[1] && colonMatch[2]) {
        let hours = parseInt(colonMatch[1], 10);
        const minutes = parseInt(colonMatch[2], 10);
        let period = colonMatch[3]?.toUpperCase();

        // Validate minutes
        if (minutes > 59) {
          return '--:--';
        }

        // If no AM/PM specified, assume PM for typical race times (afternoon)
        if (!period) {
          // If hour is 1-11, assume PM (typical race time)
          // If hour is 12-23, convert from 24h format
          if (hours >= 13 && hours <= 23) {
            period = 'PM';
            hours = hours - 12;
          } else if (hours === 0) {
            period = 'AM';
            hours = 12;
          } else if (hours === 12) {
            period = 'PM';
          } else {
            // 1-11: assume PM for race times
            period = 'PM';
          }
        }

        return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }

      // If already has AM/PM, return as-is
      if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(timeStr)) {
        return timeStr;
      }

      return '--:--';
    } catch {
      return '--:--';
    }
  };

  // Determine race status based on post time
  const getRaceStatus = (
    race: ParsedRace,
    _index: number
  ): { status: 'final' | 'critical' | 'warning' | 'normal'; minutesToPost: number } => {
    const postTimeValue = getPostTime(race);
    if (!postTimeValue) {
      return { status: 'normal', minutesToPost: 999 };
    }

    try {
      // Get current time
      const now = new Date();

      // Convert to string for parsing
      const postTime = String(postTimeValue).trim();

      // Parse race post time - adjust based on actual DRF format
      let postTimeDate: Date;

      if (/^\d{3,4}$/.test(postTime) && !postTime.includes(':')) {
        // Military format "1326" or "326"
        const padded = postTime.padStart(4, '0');
        const hours = parseInt(padded.substring(0, 2));
        const minutes = parseInt(padded.substring(2));
        postTimeDate = new Date();
        postTimeDate.setHours(hours, minutes, 0, 0);
      } else {
        // Try parsing as-is
        postTimeDate = new Date(`${now.toDateString()} ${postTime}`);
      }

      const diffMs = postTimeDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);

      if (diffMinutes < -10) {
        // Race was more than 10 minutes ago - consider it final
        return { status: 'final', minutesToPost: diffMinutes };
      } else if (diffMinutes < 5) {
        // Less than 5 minutes to post
        return { status: 'critical', minutesToPost: diffMinutes };
      } else if (diffMinutes < 10) {
        // 5-10 minutes to post
        return { status: 'warning', minutesToPost: diffMinutes };
      } else {
        return { status: 'normal', minutesToPost: diffMinutes };
      }
    } catch {
      return { status: 'normal', minutesToPost: 999 };
    }
  };

  // Determine compactness based on number of races
  const getRailCompactClass = (raceCount: number): string => {
    if (raceCount > 14) return 'app-race-rail--very-compact';
    if (raceCount > 10) return 'app-race-rail--compact';
    return '';
  };

  // Handle file upload click - trigger the hidden FileUpload's input
  const handleFileUpload = () => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  // Get countdown display info
  const countdownDisplay = formatCountdownDisplay(
    postTimeString,
    raceDateString,
    countdown.totalMs
  );

  // Get countdown seconds from the countdown state (for urgency calculation)
  const countdownSeconds = countdown.totalMs > 0 ? Math.floor(countdown.totalMs / 1000) : 0;

  return (
    <div
      className={`app-layout ${bettingPanelCollapsed ? 'app-layout--betting-collapsed' : 'app-layout--betting-expanded'}`}
    >
      {/* LEFT ZONE: Top bar, Race rail + Main content, Bottom bar */}
      <div className="app-left-zone">
        {/* Top Bar - Single row */}
        <header className="app-topbar">
          {!parsedData ? (
            /* EMPTY STATE - No DRF loaded */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
                <span className="app-topbar__logo-text">Furlong</span>
              </div>

              {/* Separator after logo */}
              <div className="app-topbar__separator"></div>

              <div className="app-topbar__empty">
                <button
                  className="app-topbar__upload-btn app-topbar__upload-btn--large"
                  onClick={handleFileUpload}
                  disabled={isLoading}
                >
                  <span className="material-icons">
                    {isLoading ? 'hourglass_empty' : 'upload_file'}
                  </span>
                  <span>{isLoading ? 'Parsing...' : 'Upload DRF File'}</span>
                </button>
              </div>
            </>
          ) : (
            /* LOADED STATE - DRF file loaded */
            <>
              {/* Logo */}
              <div className="app-topbar__logo">
                <div className="app-topbar__logo-icon">
                  <span className="material-icons">casino</span>
                </div>
                <span className="app-topbar__logo-text">Furlong</span>
              </div>

              {/* Separator after logo */}
              <div className="app-topbar__separator"></div>

              {/* Left section: Track, Date, Race - larger font */}
              <div className="app-topbar__identity">
                <span className="app-topbar__track">
                  {getTrackDisplayName(trackCode, getTrackSize(trackCode))}
                </span>
                <span className="app-topbar__dot">•</span>
                <span className="app-topbar__date">{formatRaceDate(raceDate)}</span>
                <span className="app-topbar__dot">•</span>
                <span className="app-topbar__race-label">
                  Race {selectedRaceIndex + 1} of {parsedData.races?.length || 0}
                </span>
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Center: Race info box - can be 1 or 2 lines */}
              <div className="app-topbar__race-info-box">
                {(() => {
                  const desc = buildRaceDescription(currentRace);
                  return (
                    <div className="app-topbar__race-info-text">
                      <span className="app-topbar__race-info-line">{desc.line1}</span>
                      {desc.line2 && (
                        <span className="app-topbar__race-info-line">{desc.line2}</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Post time countdown */}
              <div
                className={`app-topbar__countdown ${countdownDisplay.isPosted ? 'app-topbar__countdown--posted' : `app-topbar__countdown--${getCountdownUrgency(countdownSeconds)}`}`}
              >
                {countdownDisplay.isPosted ? (
                  <span className="app-topbar__countdown-time">{countdownDisplay.text}</span>
                ) : (
                  <>
                    <span>Post </span>
                    <span className="app-topbar__countdown-time">{countdownDisplay.text}</span>
                  </>
                )}
              </div>

              {/* Separator */}
              <div className="app-topbar__separator"></div>

              {/* Track condition dropdown */}
              <div className="app-topbar__condition">
                <select
                  className="app-topbar__condition-select"
                  value={trackCondition}
                  onChange={(e) =>
                    onTrackConditionChange(e.target.value as RaceStateTrackCondition)
                  }
                >
                  <option value="fast">Fast</option>
                  <option value="good">Good</option>
                  <option value="muddy">Muddy</option>
                  <option value="sloppy">Sloppy</option>
                  <option value="yielding">Yielding</option>
                  <option value="firm">Firm</option>
                </select>
              </div>
            </>
          )}
        </header>

        {/* Race Rail */}
        <aside
          className={`app-race-rail ${parsedData?.races ? getRailCompactClass(parsedData.races.length) : ''}`}
        >
          {parsedData?.races?.map((race, index) => {
            const raceStatus = getRaceStatus(race, index);
            const isActive = index === selectedRaceIndex;

            return (
              <button
                key={index}
                className={`app-race-rail__item ${isActive ? 'app-race-rail__item--active' : ''} app-race-rail__item--${raceStatus.status}`}
                onClick={() => onRaceSelect?.(index)}
              >
                <span className="app-race-rail__number">
                  R{race.header?.raceNumber || index + 1}
                </span>
                <span className="app-race-rail__time">
                  {raceStatus.status === 'final' ? 'FINAL' : formatPostTime(getPostTime(race))}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="app-main">
          <div className="app-main__content">
            {!parsedData ? (
              <div className="app-main__placeholder">
                <span
                  className="material-icons"
                  style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
                >
                  upload_file
                </span>
                <h2>No Race Data</h2>
                <p>Upload a DRF file to see horses and analysis</p>
              </div>
            ) : !currentRaceScoredHorses?.length ? (
              <div className="app-main__placeholder">
                <span
                  className="material-icons"
                  style={{ fontSize: '48px', marginBottom: 'var(--gap-container)' }}
                >
                  analytics
                </span>
                <h2>Select a Race</h2>
                <p>Click a race on the left to see horses</p>
              </div>
            ) : currentRace ? (
              <RaceTableSimple race={currentRace} raceState={raceState} />
            ) : null}
          </div>
        </main>

        {/* Bottom Bar */}
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

          {/* Upload button */}
          <div className="app-bottombar__cluster">
            <button
              className="app-bottombar__item app-bottombar__item--upload"
              onClick={handleFileUpload}
              disabled={isLoading}
            >
              <span className="material-icons">
                {isLoading ? 'hourglass_empty' : 'upload_file'}
              </span>
              <span>{isLoading ? 'Parsing...' : 'Upload'}</span>
            </button>
          </div>

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
            <button
              className="app-bottombar__item app-bottombar__item--icon-only"
              title="Fullscreen"
            >
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

      {/* RIGHT ZONE: Betting Panel (full height) */}
      <aside
        className={`app-betting-panel ${bettingPanelCollapsed ? 'app-betting-panel--collapsed' : ''}`}
      >
        {bettingPanelCollapsed ? (
          /* COLLAPSED STATE */
          <div
            className="app-betting-panel__collapsed-content"
            onClick={() => setBettingPanelCollapsed(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setBettingPanelCollapsed(false);
              }
            }}
            aria-label="Expand betting panel"
          >
            <div className="app-betting-panel__collapsed-icon">$</div>
            <div className="app-betting-panel__collapsed-text">Expand</div>
          </div>
        ) : (
          /* EXPANDED STATE */
          <div className="app-betting-panel__expanded-content">
            {/* Collapse button in upper left */}
            <button
              className="app-betting-panel__collapse-btn"
              onClick={() => setBettingPanelCollapsed(true)}
              aria-label="Collapse betting panel"
            >
              <span className="material-icons">close</span>
            </button>

            {/* Existing betting panel content */}
            <div className="app-betting-panel__content-wrapper">
              {/* Bankroll Summary - Clickable to open config */}
              <button
                className="app-betting-panel__bankroll"
                onClick={() => setBankrollConfigOpen(true)}
              >
                <div className="app-betting-panel__bankroll-header">
                  <span className="material-icons">account_balance_wallet</span>
                  <span>Today's Bankroll</span>
                  <span className="material-icons app-betting-panel__bankroll-config">
                    settings
                  </span>
                </div>
                <div className="app-betting-panel__bankroll-stats">
                  <div className="app-betting-panel__stat">
                    <span className="app-betting-panel__stat-label">P&L</span>
                    <span
                      className={`app-betting-panel__stat-value ${bankroll.dailyPL >= 0 ? 'app-betting-panel__stat-value--positive' : 'app-betting-panel__stat-value--negative'}`}
                    >
                      {bankroll.dailyPL >= 0 ? '+' : ''}
                      {formatCurrency(bankroll.dailyPL)}
                    </span>
                  </div>
                  <div className="app-betting-panel__stat">
                    <span className="app-betting-panel__stat-label">Spent</span>
                    <span className="app-betting-panel__stat-value">
                      {formatCurrency(bankroll.getSpentToday?.() || 0)}
                    </span>
                  </div>
                  <div className="app-betting-panel__stat">
                    <span className="app-betting-panel__stat-label">Budget</span>
                    <span className="app-betting-panel__stat-value">
                      {formatCurrency(
                        bankroll.getDailyBudget?.() || bankroll.settings?.dailyBudgetValue || 0
                      )}
                    </span>
                  </div>
                </div>
                <div className="app-betting-panel__bankroll-mode">
                  <span>{bankroll.settings?.complexityMode || 'Simple'} Mode</span>
                  <span className="app-betting-panel__bankroll-race">
                    ${bankroll.getRaceBudget?.() || bankroll.settings?.perRaceBudget || 20}/race
                  </span>
                </div>
              </button>

              {/* Betting Recommendations */}
              <div className="app-betting-panel__recommendations">
                <div className="app-betting-panel__recommendations-header">
                  <span className="material-icons">tips_and_updates</span>
                  <span>Recommendations</span>
                  {parsedData && (
                    <span className="app-betting-panel__recommendations-race">
                      R{selectedRaceIndex + 1}
                    </span>
                  )}
                </div>
                <div className="app-betting-panel__recommendations-content">
                  {!parsedData ? (
                    <div className="app-betting-panel__empty">
                      <span className="material-icons">upload_file</span>
                      <p>Upload a DRF file to see betting recommendations</p>
                    </div>
                  ) : !currentRaceScoredHorses?.length ? (
                    <div className="app-betting-panel__empty">
                      <span className="material-icons">analytics</span>
                      <p>Select a race to see recommendations</p>
                    </div>
                  ) : (
                    <BettingRecommendations
                      horses={currentRaceScoredHorses}
                      bankroll={bankroll}
                      raceNumber={selectedRaceIndex + 1}
                      onOpenBankrollSettings={() => setBankrollConfigOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Bankroll Config Slide-out */}
      {bankrollConfigOpen && (
        <>
          {/* Overlay - covers race analysis, click to close */}
          <div className="app-config-overlay" onClick={() => setBankrollConfigOpen(false)} />
          {/* Config Panel */}
          <div className="app-config-panel">
            <div className="app-config-panel__header">
              <div className="app-config-panel__title">
                <span className="material-icons">account_balance_wallet</span>
                <span>Bankroll Settings</span>
              </div>
              <button
                className="app-config-panel__close"
                onClick={() => setBankrollConfigOpen(false)}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="app-config-panel__content">
              <BankrollSettings
                isOpen={true}
                onClose={() => setBankrollConfigOpen(false)}
                settings={bankroll.settings}
                onSave={bankroll.updateSettings}
                onReset={bankroll.resetToDefaults}
                dailyPL={bankroll.dailyPL}
                spentToday={bankroll.getSpentToday()}
                dailyBudget={bankroll.getDailyBudget()}
                embedded={true}
              />
            </div>
          </div>
        </>
      )}

      {/* Hidden file upload - FileUpload component handles parsing */}
      <div className="sr-only">
        <FileUpload onParsed={onParsed} />
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="app-loading-overlay">
          <div className="app-loading-spinner">
            <span className="material-icons spinning">sync</span>
            <span>Parsing DRF file...</span>
          </div>
        </div>
      )}

      {/* Scoring Help Modal */}
      <ScoringHelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
