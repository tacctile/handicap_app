/**
 * Racing distance, number, and currency formatting utilities
 *
 * Provides standardized formatting for racing distances matching
 * Equibase/DRF industry conventions, plus shared currency formatting.
 */

/**
 * Format a number as US currency.
 *
 * @param amount - Dollar amount to format
 * @param precision - Number of decimal places (default 0 for whole dollars)
 * @returns Formatted string (e.g., "$1,000", "$0.50")
 */
export function formatCurrency(amount: number, precision: number = 0): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

/**
 * Convert furlongs to standard racing distance format
 *
 * Racing industry standard:
 * - Under 8 furlongs: show as furlongs (6f, 6½f)
 * - 8 furlongs = 1 mile: show as "1m"
 * - Over 1 mile: show as miles with fractions (1⅛m, 1¼m)
 *
 * Common distances:
 * - Sprint: 4f, 4½f, 5f, 5½f, 6f, 6½f, 7f
 * - Route: 1m, 1¹⁄₁₆m, 1⅛m, 1³⁄₁₆m, 1¼m, 1³⁄₈m, 1½m, 1⅝m, 1¾m, 2m
 *
 * @param furlongs - Distance in furlongs (1 mile = 8 furlongs)
 * @returns Formatted distance string (e.g., "6f", "1⅛m")
 */
export const formatRacingDistance = (furlongs: number): string => {
  if (!furlongs || isNaN(furlongs) || furlongs <= 0) {
    return '—';
  }

  // Standard race distances in furlongs and their display format
  // Using proper Unicode fractions for professional display
  const standardDistances: Record<number, string> = {
    // Sprint distances (furlongs)
    2: '2f',
    2.5: '2½f',
    3: '3f',
    3.5: '3½f',
    4: '4f',
    4.5: '4½f',
    5: '5f',
    5.5: '5½f',
    6: '6f',
    6.5: '6½f',
    7: '7f',
    7.5: '7½f',
    // Route distances (miles) - 8 furlongs = 1 mile
    8: '1m',
    8.5: '1¹⁄₁₆m', // 1 and 1/16 mile (8.5 furlongs)
    9: '1⅛m', // 1 and 1/8 mile (9 furlongs)
    9.5: '1³⁄₁₆m', // 1 and 3/16 mile (9.5 furlongs)
    10: '1¼m', // 1 and 1/4 mile (10 furlongs)
    10.5: '1⁵⁄₁₆m', // 1 and 5/16 mile (10.5 furlongs)
    11: '1³⁄₈m', // 1 and 3/8 mile (11 furlongs)
    12: '1½m', // 1 and 1/2 mile (12 furlongs)
    13: '1⅝m', // 1 and 5/8 mile (13 furlongs)
    14: '1¾m', // 1 and 3/4 mile (14 furlongs)
    16: '2m', // 2 miles (16 furlongs)
    18: '2¼m', // 2 and 1/4 miles (18 furlongs)
    20: '2½m', // 2 and 1/2 miles (20 furlongs)
  };

  // Round to nearest standard distance (within 0.15 tolerance for parsing variance)
  for (const [standard, display] of Object.entries(standardDistances)) {
    if (Math.abs(furlongs - Number(standard)) < 0.15) {
      return display;
    }
  }

  // If not a standard distance, format manually
  if (furlongs < 8) {
    // Show as furlongs for sprint distances
    const whole = Math.floor(furlongs);
    const frac = furlongs - whole;
    let result: string;

    if (frac < 0.05) result = `${whole}f`;
    else if (Math.abs(frac - 0.125) < 0.05)
      result = `${whole}⅛f`; // 1/8
    else if (Math.abs(frac - 0.25) < 0.05)
      result = `${whole}¼f`; // 1/4
    else if (Math.abs(frac - 0.375) < 0.05)
      result = `${whole}⅜f`; // 3/8
    else if (Math.abs(frac - 0.5) < 0.05)
      result = `${whole}½f`; // 1/2
    else if (Math.abs(frac - 0.625) < 0.05)
      result = `${whole}⅝f`; // 5/8
    else if (Math.abs(frac - 0.75) < 0.05)
      result = `${whole}¾f`; // 3/4
    else if (Math.abs(frac - 0.875) < 0.05)
      result = `${whole}⅞f`; // 7/8
    else result = `${furlongs.toFixed(1)}f`; // For unusual fractions, show decimal

    return result;
  } else {
    // Show as miles for route distances (8+ furlongs)
    const miles = furlongs / 8;
    const whole = Math.floor(miles);
    const frac = miles - whole;
    let result: string;

    if (frac < 0.05) result = `${whole}m`;
    else if (Math.abs(frac - 0.0625) < 0.02)
      result = `${whole}¹⁄₁₆m`; // 1/16
    else if (Math.abs(frac - 0.125) < 0.02)
      result = `${whole}⅛m`; // 1/8
    else if (Math.abs(frac - 0.1875) < 0.02)
      result = `${whole}³⁄₁₆m`; // 3/16
    else if (Math.abs(frac - 0.25) < 0.02)
      result = `${whole}¼m`; // 1/4
    else if (Math.abs(frac - 0.3125) < 0.02)
      result = `${whole}⁵⁄₁₆m`; // 5/16
    else if (Math.abs(frac - 0.375) < 0.02)
      result = `${whole}³⁄₈m`; // 3/8
    else if (Math.abs(frac - 0.5) < 0.02)
      result = `${whole}½m`; // 1/2
    else if (Math.abs(frac - 0.625) < 0.02)
      result = `${whole}⅝m`; // 5/8
    else if (Math.abs(frac - 0.75) < 0.02)
      result = `${whole}¾m`; // 3/4
    else if (Math.abs(frac - 0.875) < 0.02)
      result = `${whole}⅞m`; // 7/8
    else result = `${miles.toFixed(2)}m`; // For unusual fractions, show decimal miles

    return result;
  }
};

/**
 * Format earnings with K/M abbreviations
 *
 * @param amount - Earnings amount in dollars
 * @returns Formatted string (e.g., "$125K", "$1.2M")
 */
export const formatEarnings = (amount: number): string => {
  if (!amount || amount === 0) return '$0';
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return '$' + Math.round(amount / 1000) + 'K';
  }
  return '$' + amount.toLocaleString();
};

/**
 * Format odds to standard racing notation
 *
 * @param odds - Decimal odds value
 * @param isFavorite - Whether to prefix with asterisk
 * @returns Formatted odds string
 */
export const formatOdds = (odds: number | null | undefined, isFavorite?: boolean): string => {
  if (odds === null || odds === undefined) return '—';
  const prefix = isFavorite ? '*' : '';
  if (odds < 1) {
    // Odds-on favorite (e.g., 0.5 = 1-2)
    return prefix + odds.toFixed(1);
  }
  if (odds < 10) {
    return prefix + odds.toFixed(1);
  }
  return prefix + Math.round(odds).toString();
};

/**
 * Parse various odds formats to decimal odds.
 * Handles: "5-1", "9/2", "EVEN", "+300", "-150", plain numbers.
 *
 * @param oddsStr - The odds string to parse
 * @returns Decimal odds (e.g., "5-1" returns 6.0, "EVEN" returns 2.0)
 */
export function parseOddsToDecimal(oddsStr: string): number {
  if (!oddsStr || typeof oddsStr !== 'string') {
    return 2.0;
  }

  const cleaned = oddsStr.trim().toUpperCase();

  // Handle "EVEN" odds
  if (cleaned === 'EVEN' || cleaned === 'EVN') {
    return 2.0;
  }

  // Handle moneyline format (+300 or -150)
  if (cleaned.startsWith('+')) {
    const ml = parseFloat(cleaned.substring(1));
    if (!isNaN(ml)) {
      return 1 + ml / 100;
    }
  }
  if (cleaned.startsWith('-')) {
    const ml = parseFloat(cleaned.substring(1));
    if (!isNaN(ml) && ml > 0) {
      return 1 + 100 / ml;
    }
  }

  // Handle "X-Y" format (e.g., "5-1", "4-5")
  const dashMatch = cleaned.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (dashMatch && dashMatch[1] && dashMatch[2]) {
    const num = parseFloat(dashMatch[1]);
    const denom = parseFloat(dashMatch[2]);
    if (!isNaN(num) && !isNaN(denom) && denom > 0) {
      return 1 + num / denom;
    }
  }

  // Handle "X/Y" format (e.g., "5/2")
  const slashMatch = cleaned.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (slashMatch && slashMatch[1] && slashMatch[2]) {
    const num = parseFloat(slashMatch[1]);
    const denom = parseFloat(slashMatch[2]);
    if (!isNaN(num) && !isNaN(denom) && denom > 0) {
      return 1 + num / denom;
    }
  }

  // Handle plain number
  const plainNum = parseFloat(cleaned);
  if (!isNaN(plainNum)) {
    // Numbers with a decimal point (e.g., "5.0", "2.5") are treated as decimal odds
    if (cleaned.includes('.')) {
      if (plainNum > 1) return plainNum;
      return 2.0; // Sub-1 decimals default to even money
    }
    // Integer numbers (e.g., "5", "10") are treated as X-1 format
    if (plainNum < 1.5) return 2.0; // Probably meant even money
    return 1 + plainNum; // Assume X-1 format (e.g., "5" = 5-1 = 6.0)
  }

  return 2.0; // Default to even money
}

/**
 * Get color for edge percentage display.
 *
 * @param edge - Edge percentage value
 * @returns Hex color string
 */
export function getEdgeColor(edge: number): string {
  if (edge >= 75) return '#10b981'; // Bright green
  if (edge >= 50) return '#22c55e'; // Green
  if (edge >= 25) return '#84cc16'; // Yellow-green
  if (edge >= -25) return '#6B7280'; // Gray (fair)
  return '#ef4444'; // Red (underlay)
}

/**
 * Format edge percentage for display.
 *
 * @param edge - Edge percentage value
 * @param precision - Decimal places (default 0 for integer rounding)
 * @returns Formatted string (e.g., "+25%" or "+25.3%")
 */
export function formatEdge(edge: number, precision: number = 0): string {
  const formatted = precision === 0 ? Math.round(edge).toString() : edge.toFixed(precision);
  return edge >= 0 ? `+${formatted}%` : `${formatted}%`;
}

/**
 * Format EV percentage for display.
 *
 * @param evPercent - Expected value percentage
 * @returns Formatted string (e.g., "+12.5%")
 */
export function formatEVPercent(evPercent: number): string {
  if (!Number.isFinite(evPercent)) return '\u2014';
  const sign = evPercent >= 0 ? '+' : '';
  return `${sign}${evPercent.toFixed(1)}%`;
}

/**
 * Format overlay percentage for display.
 *
 * @param overlayPercent - Overlay percentage value
 * @param precision - Decimal places (default 0)
 * @returns Formatted string (e.g., "+150%")
 */
export function formatOverlayPercent(overlayPercent: number, precision: number = 0): string {
  if (!Number.isFinite(overlayPercent)) return '\u2014';
  const sign = overlayPercent >= 0 ? '+' : '';
  return `${sign}${overlayPercent.toFixed(precision)}%`;
}

/**
 * Format a number as a percentage string.
 *
 * @param value - The value to format
 * @param decimals - Decimal places (default 1)
 * @param showSign - Whether to show +/- sign prefix (default false)
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number,
  decimals: number = 1,
  showSign: boolean = false
): string {
  if (showSign) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  }
  return `${value.toFixed(decimals)}%`;
}

// Test function for verifying distance formatting (can be run in console)
export const testDistanceFormatting = (): void => {
  const testDistances = [
    { furlongs: 4, expected: '4f' },
    { furlongs: 4.5, expected: '4½f' },
    { furlongs: 5, expected: '5f' },
    { furlongs: 5.5, expected: '5½f' },
    { furlongs: 6, expected: '6f' },
    { furlongs: 6.5, expected: '6½f' },
    { furlongs: 7, expected: '7f' },
    { furlongs: 7.5, expected: '7½f' },
    { furlongs: 8, expected: '1m' },
    { furlongs: 8.5, expected: '1¹⁄₁₆m' },
    { furlongs: 9, expected: '1⅛m' },
    { furlongs: 9.5, expected: '1³⁄₁₆m' },
    { furlongs: 10, expected: '1¼m' },
    { furlongs: 11, expected: '1³⁄₈m' },
    { furlongs: 12, expected: '1½m' },
    { furlongs: 13, expected: '1⅝m' },
    { furlongs: 14, expected: '1¾m' },
    { furlongs: 16, expected: '2m' },
  ];

  console.log('=== Distance Formatting Test ===');
  let passed = 0;
  let failed = 0;

  testDistances.forEach(({ furlongs, expected }) => {
    const result = formatRacingDistance(furlongs);
    const status = result === expected ? '✓' : '✗';
    if (result === expected) {
      passed++;
    } else {
      failed++;
    }
    console.log(`${furlongs}f => ${result} (expected: ${expected}) ${status}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
};
