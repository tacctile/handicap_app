/* eslint-disable react-refresh/only-export-components */
/**
 * Parsing Progress Overlay Component
 *
 * Displays a beautiful loading overlay during DRF file parsing
 * with progress bar, current step, and estimated time remaining.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, memo } from 'react';
import type { ParsingStep, DRFWorkerProgressMessage } from '../types/drf';
import { Icon } from './shared/Icon';

// ============================================================================
// TYPES
// ============================================================================

interface ParsingProgressProps {
  /** Whether the parsing is in progress */
  isVisible: boolean;
  /** Current progress (0-100) */
  progress: number;
  /** Current parsing step */
  step: ParsingStep;
  /** Current step message */
  message: string;
  /** Additional details (e.g., current horse count) */
  details?: DRFWorkerProgressMessage['details'];
  /** Error message if parsing failed */
  error?: string | null;
  /** Callback when user dismisses error */
  onDismissError?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACCENT_COLOR = '#19abb5';
const ACCENT_GLOW = 'rgba(25, 171, 181, 0.4)';

/**
 * Step descriptions for display
 */
const STEP_DESCRIPTIONS: Record<ParsingStep, string> = {
  initializing: 'Initializing parser...',
  'detecting-format': 'Detecting file format...',
  'extracting-races': 'Extracting race data...',
  'parsing-horses': 'Parsing horse entries...',
  'loading-past-performances': 'Loading past performances...',
  'processing-workouts': 'Processing workout data...',
  'validating-data': 'Validating data integrity...',
  finalizing: 'Finalizing results...',
  complete: 'Parsing complete!',
};

/**
 * Step icons (using Material Icons)
 */
const STEP_ICONS: Record<ParsingStep, string> = {
  initializing: 'hourglass_empty',
  'detecting-format': 'search',
  'extracting-races': 'flag',
  'parsing-horses': 'pets',
  'loading-past-performances': 'history',
  'processing-workouts': 'fitness_center',
  'validating-data': 'verified',
  finalizing: 'check_circle',
  complete: 'done_all',
};

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

const ProgressBar = memo(function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden relative">
      {/* Background shimmer */}
      <motion.div
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(90deg, transparent, ${ACCENT_COLOR}40, transparent)`,
        }}
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Actual progress bar */}
      <motion.div
        className="h-full rounded-full relative"
        style={{
          background: `linear-gradient(90deg, ${ACCENT_COLOR}, #36d1da)`,
          boxShadow: `0 0 20px ${ACCENT_GLOW}`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: 0.3,
          ease: 'easeOut',
        }}
      >
        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        />
      </motion.div>
    </div>
  );
});

// ============================================================================
// SPINNING LOADER
// ============================================================================

const SpinningLoader = memo(function SpinningLoader() {
  return (
    <motion.div
      className="w-16 h-16 rounded-full border-4 border-white/10"
      style={{
        borderTopColor: ACCENT_COLOR,
        borderRightColor: ACCENT_COLOR,
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
});

// ============================================================================
// STEP INDICATOR
// ============================================================================

const StepIndicator = memo(function StepIndicator({
  step,
  message,
}: {
  step: ParsingStep;
  message: string;
}) {
  const icon = STEP_ICONS[step];
  const description = STEP_DESCRIPTIONS[step];

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={step}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: `${ACCENT_COLOR}20`,
          color: ACCENT_COLOR,
        }}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Icon name={icon} className="text-xl" />
      </motion.div>
      <div className="flex flex-col">
        <span className="text-white font-medium">{description}</span>
        <span className="text-white/60 text-sm">{message}</span>
      </div>
    </motion.div>
  );
});

// ============================================================================
// TIME REMAINING ESTIMATOR
// ============================================================================

function useTimeEstimate(progress: number): string | null {
  const startTimeRef = useRef<number>(0);
  const [estimate, setEstimate] = useState<string | null>(null);

  useEffect(() => {
    if (progress === 0) {
      startTimeRef.current = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Resetting state when progress resets
      setEstimate(null);
      return;
    }

    if (progress >= 100) {
      setEstimate(null);
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const estimatedTotal = (elapsed / progress) * 100;
    const remaining = estimatedTotal - elapsed;

    if (remaining < 1000) {
      setEstimate('Almost done...');
    } else if (remaining < 5000) {
      setEstimate('A few seconds remaining');
    } else if (remaining < 10000) {
      setEstimate(`~${Math.ceil(remaining / 1000)} seconds remaining`);
    } else if (remaining < 60000) {
      setEstimate(`~${Math.ceil(remaining / 1000)} seconds remaining`);
    } else {
      setEstimate(`~${Math.ceil(remaining / 60000)} minute(s) remaining`);
    }
  }, [progress]);

  return estimate;
}

// ============================================================================
// ERROR DISPLAY
// ============================================================================

const ErrorDisplay = memo(function ErrorDisplay({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss?: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <motion.div
        className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Icon name="error_outline" className="text-3xl text-red-400" />
      </motion.div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-white">Parsing Failed</h3>
        <p className="text-white/70 max-w-sm">{error}</p>
      </div>

      {onDismiss && (
        <motion.button
          className="mt-4 px-6 py-2 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: `${ACCENT_COLOR}20`,
            color: ACCENT_COLOR,
          }}
          whileHover={{ scale: 1.02, backgroundColor: `${ACCENT_COLOR}30` }}
          whileTap={{ scale: 0.98 }}
          onClick={onDismiss}
        >
          Try Again
        </motion.button>
      )}
    </motion.div>
  );
});

// ============================================================================
// SUCCESS DISPLAY
// ============================================================================

const SuccessDisplay = memo(function SuccessDisplay({
  details,
}: {
  details?: DRFWorkerProgressMessage['details'];
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: `${ACCENT_COLOR}20`,
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
        >
          <Icon name="check_circle" className="text-3xl" style={{ color: ACCENT_COLOR }} />
        </motion.div>
      </motion.div>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-white">Parsing Complete!</h3>
        {details && (
          <p className="text-white/60 text-sm">
            {details.totalRaces && `${details.totalRaces} race${details.totalRaces > 1 ? 's' : ''}`}
            {details.totalHorses && ` • ${details.totalHorses} horses`}
          </p>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ParsingProgress = memo(function ParsingProgress({
  isVisible,
  progress,
  step,
  message,
  details,
  error,
  onDismissError,
}: ParsingProgressProps) {
  const timeEstimate = useTimeEstimate(progress);
  const isComplete = step === 'complete';
  const hasError = !!error;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8"
            style={{
              backgroundColor: '#0F0F10',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: `0 0 60px ${ACCENT_GLOW}, 0 25px 50px rgba(0,0,0,0.5)`,
            }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <AnimatePresence mode="wait">
              {hasError ? (
                <ErrorDisplay key="error" error={error} onDismiss={onDismissError} />
              ) : isComplete ? (
                <SuccessDisplay key="success" details={details} />
              ) : (
                <motion.div
                  key="loading"
                  className="flex flex-col items-center gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Spinning loader */}
                  <SpinningLoader />

                  {/* Step indicator */}
                  <StepIndicator step={step} message={message} />

                  {/* Progress bar */}
                  <div className="w-full flex flex-col gap-2">
                    <ProgressBar progress={progress} />

                    {/* Progress percentage and time estimate */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/70 font-medium">{Math.round(progress)}%</span>
                      {timeEstimate && (
                        <motion.span
                          className="text-white/50"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={timeEstimate}
                        >
                          {timeEstimate}
                        </motion.span>
                      )}
                    </div>
                  </div>

                  {/* Additional details */}
                  {details && (details.currentHorse || details.currentRace) && (
                    <motion.div
                      className="text-white/50 text-xs flex gap-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {details.currentRace && details.totalRaces && (
                        <span>
                          Race {details.currentRace} of {details.totalRaces}
                        </span>
                      )}
                      {details.currentHorse && details.totalHorses && (
                        <span>
                          Entry {details.currentHorse} of {details.totalHorses}
                        </span>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// HOOK FOR MANAGING PARSING STATE
// ============================================================================

export interface ParsingState {
  isVisible: boolean;
  progress: number;
  step: ParsingStep;
  message: string;
  details?: DRFWorkerProgressMessage['details'];
  error: string | null;
}

export function useParsingProgress() {
  const [state, setState] = useState<ParsingState>({
    isVisible: false,
    progress: 0,
    step: 'initializing',
    message: '',
    details: undefined,
    error: null,
  });

  const show = () => {
    setState({
      isVisible: true,
      progress: 0,
      step: 'initializing',
      message: 'Starting...',
      details: undefined,
      error: null,
    });
  };

  const updateProgress = (progressMessage: DRFWorkerProgressMessage) => {
    setState((prev) => ({
      ...prev,
      progress: progressMessage.progress,
      step: progressMessage.step,
      message: progressMessage.message,
      details: progressMessage.details,
    }));
  };

  const complete = (details?: DRFWorkerProgressMessage['details']) => {
    setState((prev) => ({
      ...prev,
      progress: 100,
      step: 'complete',
      message: 'Parsing complete!',
      details,
    }));

    // Auto-hide after a short delay
    setTimeout(() => {
      setState((prev) => ({ ...prev, isVisible: false }));
    }, 1500);
  };

  const setError = (error: string) => {
    setState((prev) => ({
      ...prev,
      error,
    }));
  };

  const hide = () => {
    setState((prev) => ({ ...prev, isVisible: false, error: null }));
  };

  const reset = () => {
    setState({
      isVisible: false,
      progress: 0,
      step: 'initializing',
      message: '',
      details: undefined,
      error: null,
    });
  };

  return {
    state,
    show,
    updateProgress,
    complete,
    setError,
    hide,
    reset,
  };
}

export default ParsingProgress;
