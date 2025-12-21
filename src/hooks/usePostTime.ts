import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Notification settings interface
export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  timings: number[]; // Minutes before post time to trigger notifications
}

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: false,
  timings: [15, 10, 5, 2], // Default: 15, 10, 5, 2 minutes
};

// Countdown state interface
export interface CountdownState {
  /** Total milliseconds remaining */
  totalMs: number;
  /** Hours remaining */
  hours: number;
  /** Minutes remaining */
  minutes: number;
  /** Seconds remaining */
  seconds: number;
  /** Formatted countdown string (HH:MM:SS or MM:SS) */
  formatted: string;
  /** Short format for compact displays (8:34) */
  shortFormatted: string;
  /** Is countdown expired (post time reached) */
  isExpired: boolean;
  /** Is post time within critical window (<5 minutes) */
  isCritical: boolean;
  /** Is post time within warning window (<10 minutes) */
  isWarning: boolean;
  /** Is post time imminent (<2 minutes) */
  isImminent: boolean;
  /** Progress percentage (0-100, for progress bars) */
  progress: number;
  /** Color class based on time remaining */
  colorClass: 'normal' | 'warning' | 'critical' | 'imminent' | 'expired';
}

// Notification trigger info
export interface NotificationTrigger {
  minutesMark: number;
  triggered: boolean;
  message: string;
  type: 'info' | 'warning';
}

// Hook return type
export interface UsePostTimeReturn {
  /** Current countdown state */
  countdown: CountdownState;
  /** Parsed post time as Date object */
  postTime: Date | null;
  /** Original post time string */
  postTimeString: string | null;
  /** Formatted post time for display (e.g., "2:30 PM") */
  postTimeFormatted: string;
  /** Is post time available and valid */
  isValid: boolean;
  /** Pending notifications that should be triggered */
  pendingNotifications: NotificationTrigger[];
  /** Clear a specific notification */
  clearNotification: (minutesMark: number) => void;
  /** Clear all pending notifications */
  clearAllNotifications: () => void;
  /** Update notification settings */
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  /** Current notification settings */
  notificationSettings: NotificationSettings;
}

// Local storage key for notification settings
const NOTIFICATION_SETTINGS_KEY = 'furlong_notification_settings';

// Parse post time string to Date object
function parsePostTime(postTimeStr: string | undefined, raceDateStr?: string): Date | null {
  if (!postTimeStr) return null;

  try {
    // Handle various post time formats from DRF
    // Common formats: "2:30 PM", "14:30", "2:30PM", "2:30 PM ET"

    // Clean up the string
    let timeStr = postTimeStr.trim();

    // Remove timezone suffixes like "ET", "PT", "EST", etc.
    timeStr = timeStr.replace(/\s*(ET|PT|EST|PST|EDT|PDT|CT|CST|CDT|MT|MST|MDT)\s*$/i, '').trim();

    // Try to parse as time
    let hours = 0;
    let minutes = 0;
    let isPM = false;
    let isAM = false;

    // Check for AM/PM
    if (/pm/i.test(timeStr)) {
      isPM = true;
      timeStr = timeStr.replace(/\s*pm/i, '').trim();
    } else if (/am/i.test(timeStr)) {
      isAM = true;
      timeStr = timeStr.replace(/\s*am/i, '').trim();
    }

    // Parse hours:minutes
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
      const hoursPart = timeParts[0];
      const minutesPart = timeParts[1];
      if (hoursPart && minutesPart) {
        hours = parseInt(hoursPart, 10);
        minutes = parseInt(minutesPart, 10);
      }
    } else {
      // Try to parse as single number (hours only)
      hours = parseInt(timeStr, 10);
    }

    // Validate
    if (isNaN(hours) || isNaN(minutes)) return null;

    // Convert to 24-hour format
    if (isPM && hours < 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    }

    // Create date object
    const now = new Date();
    let postDate: Date;

    if (raceDateStr) {
      // Parse race date if provided (format: YYYYMMDD or similar)
      const dateMatch = raceDateStr.match(/(\d{4})(\d{2})(\d{2})/);
      if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
        postDate = new Date(
          parseInt(dateMatch[1], 10),
          parseInt(dateMatch[2], 10) - 1,
          parseInt(dateMatch[3], 10),
          hours,
          minutes,
          0
        );
      } else {
        postDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
      }
    } else {
      // Use today's date
      postDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    }

    // If post time has already passed today, assume it's for tomorrow (for demo purposes)
    // In production, you'd use the actual race date from DRF
    if (postDate.getTime() < now.getTime() && !raceDateStr) {
      postDate.setDate(postDate.getDate() + 1);
    }

    return postDate;
  } catch {
    return null;
  }
}

// Format time for display
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Calculate countdown state from milliseconds
function calculateCountdownState(ms: number, totalDuration: number): CountdownState {
  if (ms <= 0) {
    return {
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'POST!',
      shortFormatted: 'POST!',
      isExpired: true,
      isCritical: true,
      isWarning: true,
      isImminent: true,
      progress: 100,
      colorClass: 'expired',
    };
  }

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  // Determine color class based on time remaining
  const totalMinutes = ms / (1000 * 60);
  let colorClass: CountdownState['colorClass'] = 'normal';
  if (totalMinutes <= 2) {
    colorClass = 'imminent';
  } else if (totalMinutes <= 5) {
    colorClass = 'critical';
  } else if (totalMinutes <= 10) {
    colorClass = 'warning';
  }

  // Format countdown strings
  let formatted: string;
  let shortFormatted: string;

  if (hours > 0) {
    formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    shortFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
  } else {
    formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    shortFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Calculate progress (0-100)
  const progress =
    totalDuration > 0 ? Math.min(100, ((totalDuration - ms) / totalDuration) * 100) : 0;

  return {
    totalMs: ms,
    hours,
    minutes,
    seconds,
    formatted,
    shortFormatted,
    isExpired: false,
    isCritical: totalMinutes <= 5,
    isWarning: totalMinutes <= 10,
    isImminent: totalMinutes <= 2,
    progress,
    colorClass,
  };
}

export function usePostTime(
  postTimeString?: string,
  raceDateString?: string,
  initialNotificationSettings?: Partial<NotificationSettings>
): UsePostTimeReturn {
  // Load notification settings from localStorage
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed, ...initialNotificationSettings };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...initialNotificationSettings };
  });

  // Parse post time
  const postTime = useMemo(() => {
    return parsePostTime(postTimeString, raceDateString);
  }, [postTimeString, raceDateString]);

  // Track initial duration for progress calculation
  const initialDuration = useRef<number>(0);

  // Track which notifications have been triggered
  const [triggeredNotifications, setTriggeredNotifications] = useState<Set<number>>(new Set());

  // Pending notifications to be shown
  const [pendingNotifications, setPendingNotifications] = useState<NotificationTrigger[]>([]);

  // Countdown state
  const [countdown, setCountdown] = useState<CountdownState>(() => {
    if (!postTime) {
      return calculateCountdownState(-1, 0);
    }
    const now = new Date();
    const ms = postTime.getTime() - now.getTime();
    const initial = ms > 0 ? ms : 0;
    return calculateCountdownState(ms, initial);
  });

  // Set initial duration in useEffect to avoid ref access during render
  useEffect(() => {
    if (postTime && initialDuration.current === 0) {
      const now = new Date();
      const ms = postTime.getTime() - now.getTime();
      if (ms > 0) {
        initialDuration.current = ms;
      }
    }
  }, [postTime]);

  // Save notification settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(notificationSettings));
    } catch {
      // Ignore storage errors
    }
  }, [notificationSettings]);

  // Update countdown every second
  useEffect(() => {
    if (!postTime) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(calculateCountdownState(-1, 0));
      return;
    }

    // Set initial duration
    const now = new Date();
    const initialMs = postTime.getTime() - now.getTime();
    if (initialMs > 0 && initialDuration.current === 0) {
      initialDuration.current = initialMs;
    }

    const updateCountdown = () => {
      const currentNow = new Date();
      const ms = postTime.getTime() - currentNow.getTime();
      setCountdown(calculateCountdownState(ms, initialDuration.current));

      // Check for notification triggers
      if (notificationSettings.enabled && ms > 0) {
        const totalMinutes = ms / (1000 * 60);

        notificationSettings.timings.forEach((minuteMark) => {
          // Trigger notification when we cross the threshold (within 30 seconds of the mark)
          if (
            totalMinutes <= minuteMark &&
            totalMinutes > minuteMark - 0.5 &&
            !triggeredNotifications.has(minuteMark)
          ) {
            setTriggeredNotifications((prev) => new Set([...prev, minuteMark]));

            const type: 'info' | 'warning' = minuteMark <= 5 ? 'warning' : 'info';
            const message =
              minuteMark <= 2
                ? `Race starts in ${minuteMark} minute${minuteMark === 1 ? '' : 's'}! Place your bets now!`
                : `${minuteMark} minutes until post time`;

            setPendingNotifications((prev) => [
              ...prev,
              { minutesMark: minuteMark, triggered: true, message, type },
            ]);
          }
        });
      }
    };

    // Initial update
    updateCountdown();

    // Update every second
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [
    postTime,
    notificationSettings.enabled,
    notificationSettings.timings,
    triggeredNotifications,
  ]);

  // Reset triggered notifications when post time changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- Intentionally resetting state when dependencies change */
    setTriggeredNotifications(new Set());
    setPendingNotifications([]);
    /* eslint-enable react-hooks/set-state-in-effect */
    initialDuration.current = 0;
  }, [postTimeString, raceDateString]);

  // Clear a specific notification
  const clearNotification = useCallback((minutesMark: number) => {
    setPendingNotifications((prev) => prev.filter((n) => n.minutesMark !== minutesMark));
  }, []);

  // Clear all pending notifications
  const clearAllNotifications = useCallback(() => {
    setPendingNotifications([]);
  }, []);

  // Update notification settings
  const updateNotificationSettings = useCallback((settings: Partial<NotificationSettings>) => {
    setNotificationSettings((prev) => ({ ...prev, ...settings }));
  }, []);

  // Format post time for display
  const postTimeFormatted = useMemo(() => {
    if (!postTime) return '--:--';
    return formatTime(postTime);
  }, [postTime]);

  return {
    countdown,
    postTime,
    postTimeString: postTimeString || null,
    postTimeFormatted,
    isValid: postTime !== null,
    pendingNotifications,
    clearNotification,
    clearAllNotifications,
    updateNotificationSettings,
    notificationSettings,
  };
}

export default usePostTime;
