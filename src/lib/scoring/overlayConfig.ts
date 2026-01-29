/**
 * Unified Overlay Configuration Module
 *
 * Consolidates all configuration for the overlay analysis pipeline:
 * - Softmax probability conversion settings
 * - Market normalization settings
 * - Value detection thresholds
 * - Expected value thresholds
 * - Overlay adjustment point ranges
 *
 * This provides a single source of truth for all overlay-related constants
 * across probabilityConversion.ts, marketNormalization.ts, and overlayPipeline.ts.
 *
 * @module scoring/overlayConfig
 */

// ============================================================================
// MAIN CONFIGURATION
// ============================================================================

/**
 * Unified overlay configuration
 *
 * Contains all settings for the overlay analysis pipeline.
 * Modify these values during calibration to tune model behavior.
 */
export const OVERLAY_CONFIG = {
  // -------------------------------------------------------------------------
  // Softmax Settings
  // -------------------------------------------------------------------------
  softmax: {
    /** Temperature parameter for softmax (1.0 = standard)
     *  Lower values make the distribution more extreme (favorite gets higher %)
     *  Higher values flatten the distribution
     */
    temperature: 1.0,

    /** Minimum probability floor (0.5% = 0.005)
     *  Every horse has at least this chance
     */
    minProbability: 0.005,

    /** Maximum probability ceiling (95% = 0.95)
     *  No horse exceeds this probability
     */
    maxProbability: 0.95,

    /** Score scaling factor
     *  Divides scores to normalize for softmax (100 works well for 0-319 range)
     */
    scoreScale: 100,
  },

  // -------------------------------------------------------------------------
  // Calibration Settings (Platt Scaling)
  // -------------------------------------------------------------------------
  calibration: {
    /** Minimum races required before activating calibration (default: 500) */
    minRacesRequired: 500,

    /** Number of new races that trigger automatic recalibration (default: 50) */
    recalibrationThreshold: 50,

    /** Maximum days before forcing recalibration (default: 7) */
    maxRecalibrationAge: 7,

    /** Fitting algorithm configuration */
    fittingConfig: {
      /** Learning rate for gradient descent */
      learningRate: 0.01,
      /** Maximum iterations before stopping */
      maxIterations: 1000,
      /** Convergence threshold - stop when gradient magnitude is below this */
      convergenceThreshold: 1e-6,
      /** L2 regularization strength to prevent extreme parameters */
      regularization: 0.001,
    },

    /** Whether to apply calibration when ready (can be disabled for testing) */
    enabled: true,
  },

  // -------------------------------------------------------------------------
  // Market Settings
  // -------------------------------------------------------------------------
  market: {
    /** Default win pool takeout (~17% typical for US tracks) */
    defaultTakeout: 0.17,

    /** Minimum expected overround - below this, odds data may be suspect */
    minOverround: 1.1,

    /** Maximum expected overround - above this, odds data may be suspect */
    maxOverround: 1.35,

    /** Feature flag for using normalized overlay calculation */
    useNormalization: true,
  },

  // -------------------------------------------------------------------------
  // Value Thresholds (for normalized overlay percentage)
  // -------------------------------------------------------------------------
  value: {
    /** Strong overlay threshold: 15%+ true overlay - strong betting opportunity */
    strongOverlay: 15,

    /** Moderate overlay threshold: 8-14% true overlay - good value */
    moderateOverlay: 8,

    /** Slight overlay threshold: 3-7% true overlay - playable */
    slightOverlay: 3,

    /** Below this is considered underlay (avoid) */
    underlayThreshold: -3,
  },

  // -------------------------------------------------------------------------
  // Expected Value Thresholds
  // -------------------------------------------------------------------------
  ev: {
    /** 15%+ EV - strong positive expected value */
    strongPositive: 0.15,

    /** 8-15% EV - moderate positive expected value */
    moderatePositive: 0.08,

    /** 2-8% EV - slight positive expected value */
    slightPositive: 0.02,

    /** Threshold for considering it negative EV */
    negative: -0.02,
  },

  // -------------------------------------------------------------------------
  // Adjustment Point Ranges (for ±40 total overlay cap)
  // -------------------------------------------------------------------------
  adjustments: {
    /** Maximum positive points from value overlay adjustment */
    maxPositive: 25,

    /** Maximum negative points from underlay adjustment */
    maxNegative: -20,

    /** Total cap for all overlay adjustments (existing system uses ±40) */
    totalCap: 40,

    // Point ranges for different value classifications
    points: {
      /** Strong overlay (15%+) with positive EV */
      strongOverlay: { min: 15, max: 25 },

      /** Moderate overlay (8-15%) with positive EV */
      moderateOverlay: { min: 8, max: 15 },

      /** Slight overlay (3-8%) with positive EV */
      slightOverlay: { min: 3, max: 8 },

      /** Underlay with negative EV */
      underlay: { min: -20, max: -5 },
    },
  },

  // -------------------------------------------------------------------------
  // Probability Validation
  // -------------------------------------------------------------------------
  validation: {
    /** Tolerance for probability sum (should be ~1.0) */
    sumTolerance: 0.01,

    /** Minimum field size for valid analysis */
    minFieldSize: 2,

    /** Maximum field size we expect */
    maxFieldSize: 20,
  },
} as const;

// ============================================================================
// DERIVED CONSTANTS (for backward compatibility)
// ============================================================================

/** Maximum positive adjustment points */
export const MAX_OVERLAY_ADJUSTMENT_POSITIVE = OVERLAY_CONFIG.adjustments.maxPositive;

/** Maximum negative adjustment points */
export const MAX_OVERLAY_ADJUSTMENT_NEGATIVE = OVERLAY_CONFIG.adjustments.maxNegative;

/** Total overlay cap */
export const TOTAL_OVERLAY_CAP = OVERLAY_CONFIG.adjustments.totalCap;

// ============================================================================
// VALUE CLASSIFICATION LABELS
// ============================================================================

/**
 * Human-readable labels for value classifications
 */
export const VALUE_CLASS_LABELS = {
  STRONG_VALUE: 'Strong Value',
  MODERATE_VALUE: 'Moderate Value',
  SLIGHT_VALUE: 'Slight Value',
  NEUTRAL: 'Fair Price',
  UNDERLAY: 'Underlay',
} as const;

/**
 * Colors for value classification display
 */
export const VALUE_CLASS_COLORS = {
  STRONG_VALUE: '#22c55e', // Bright green
  MODERATE_VALUE: '#4ade80', // Green
  SLIGHT_VALUE: '#86efac', // Light green
  NEUTRAL: '#9ca3af', // Gray
  UNDERLAY: '#ef4444', // Red
} as const;

/**
 * Icons for value classification display
 */
export const VALUE_CLASS_ICONS = {
  STRONG_VALUE: 'rocket_launch',
  MODERATE_VALUE: 'trending_up',
  SLIGHT_VALUE: 'thumb_up',
  NEUTRAL: 'horizontal_rule',
  UNDERLAY: 'do_not_disturb',
} as const;

// ============================================================================
// EV CLASSIFICATION LABELS
// ============================================================================

/**
 * Human-readable labels for EV classifications
 */
export const EV_CLASS_LABELS = {
  strongPositive: 'Strong +EV',
  moderatePositive: 'Moderate +EV',
  slightPositive: 'Slight +EV',
  neutral: 'Break Even',
  negative: 'Negative EV',
} as const;

/**
 * Colors for EV classification display
 */
export const EV_CLASS_COLORS = {
  strongPositive: '#22c55e', // Bright green
  moderatePositive: '#4ade80', // Green
  slightPositive: '#86efac', // Light green
  neutral: '#9ca3af', // Gray
  negative: '#ef4444', // Red
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Type for the overlay configuration
 */
export type OverlayConfigType = typeof OVERLAY_CONFIG;

/**
 * Pipeline value classification types (distinct from overlayAnalysis.ValueClassification)
 */
export type PipelineValueClass =
  | 'STRONG_VALUE'
  | 'MODERATE_VALUE'
  | 'SLIGHT_VALUE'
  | 'NEUTRAL'
  | 'UNDERLAY';

/**
 * EV classification types
 */
export type EVClassification =
  | 'strongPositive'
  | 'moderatePositive'
  | 'slightPositive'
  | 'neutral'
  | 'negative';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get a copy of the current configuration
 */
export function getOverlayConfig(): typeof OVERLAY_CONFIG {
  return { ...OVERLAY_CONFIG };
}

/**
 * Create a modified configuration with custom overrides
 *
 * @param overrides - Partial configuration to merge
 * @returns New configuration object
 *
 * @example
 * const customConfig = createOverlayConfig({
 *   softmax: { temperature: 0.8 },
 *   value: { strongOverlay: 20 }
 * });
 */
export function createOverlayConfig(
  overrides: Partial<{
    softmax?: Partial<(typeof OVERLAY_CONFIG)['softmax']>;
    calibration?: Partial<(typeof OVERLAY_CONFIG)['calibration']>;
    market?: Partial<(typeof OVERLAY_CONFIG)['market']>;
    value?: Partial<(typeof OVERLAY_CONFIG)['value']>;
    ev?: Partial<(typeof OVERLAY_CONFIG)['ev']>;
    adjustments?: Partial<(typeof OVERLAY_CONFIG)['adjustments']>;
    validation?: Partial<(typeof OVERLAY_CONFIG)['validation']>;
  }>
): typeof OVERLAY_CONFIG {
  return {
    softmax: { ...OVERLAY_CONFIG.softmax, ...overrides.softmax },
    calibration: {
      ...OVERLAY_CONFIG.calibration,
      ...overrides.calibration,
      fittingConfig: {
        ...OVERLAY_CONFIG.calibration.fittingConfig,
        ...(overrides.calibration?.fittingConfig as
          | Partial<(typeof OVERLAY_CONFIG)['calibration']['fittingConfig']>
          | undefined),
      },
    },
    market: { ...OVERLAY_CONFIG.market, ...overrides.market },
    value: { ...OVERLAY_CONFIG.value, ...overrides.value },
    ev: { ...OVERLAY_CONFIG.ev, ...overrides.ev },
    adjustments: {
      ...OVERLAY_CONFIG.adjustments,
      ...overrides.adjustments,
      points: {
        ...OVERLAY_CONFIG.adjustments.points,
        ...(overrides.adjustments?.points as
          | Partial<(typeof OVERLAY_CONFIG)['adjustments']['points']>
          | undefined),
      },
    },
    validation: { ...OVERLAY_CONFIG.validation, ...overrides.validation },
  };
}

/**
 * Validate that configuration values are sensible
 *
 * @returns Array of warning messages (empty if all valid)
 */
export function validateOverlayConfig(): string[] {
  const warnings: string[] = [];
  const config = OVERLAY_CONFIG;

  // Softmax validation
  if (config.softmax.temperature <= 0) {
    warnings.push('Softmax temperature must be positive');
  }
  if (config.softmax.minProbability >= config.softmax.maxProbability) {
    warnings.push('Softmax minProbability must be less than maxProbability');
  }

  // Market validation
  if (config.market.defaultTakeout < 0 || config.market.defaultTakeout > 0.5) {
    warnings.push('Market takeout should be between 0 and 0.5 (50%)');
  }
  if (config.market.minOverround >= config.market.maxOverround) {
    warnings.push('Market minOverround must be less than maxOverround');
  }

  // Value threshold validation
  if (config.value.strongOverlay <= config.value.moderateOverlay) {
    warnings.push('Value strongOverlay should be greater than moderateOverlay');
  }
  if (config.value.moderateOverlay <= config.value.slightOverlay) {
    warnings.push('Value moderateOverlay should be greater than slightOverlay');
  }

  // EV validation
  if (config.ev.strongPositive <= config.ev.moderatePositive) {
    warnings.push('EV strongPositive should be greater than moderatePositive');
  }

  // Adjustment validation
  if (config.adjustments.maxPositive <= 0) {
    warnings.push('Adjustment maxPositive should be positive');
  }
  if (config.adjustments.maxNegative >= 0) {
    warnings.push('Adjustment maxNegative should be negative');
  }

  // Calibration validation
  if (config.calibration.minRacesRequired < 100) {
    warnings.push(
      'Calibration minRacesRequired should be at least 100 for statistical significance'
    );
  }
  if (config.calibration.recalibrationThreshold < 10) {
    warnings.push('Calibration recalibrationThreshold should be at least 10');
  }
  if (
    config.calibration.fittingConfig.learningRate <= 0 ||
    config.calibration.fittingConfig.learningRate > 1
  ) {
    warnings.push('Calibration learningRate should be between 0 and 1');
  }
  if (config.calibration.fittingConfig.maxIterations < 100) {
    warnings.push('Calibration maxIterations should be at least 100');
  }

  return warnings;
}
