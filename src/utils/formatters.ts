/**
 * Racing distance and number formatting utilities
 *
 * Provides standardized formatting for racing distances matching
 * Equibase/DRF industry conventions.
 */

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
  if (!furlongs || isNaN(furlongs) || furlongs <= 0) return '—';

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

    if (frac < 0.1) return `${whole}f`;
    if (Math.abs(frac - 0.5) < 0.1) return `${whole}½f`;
    if (Math.abs(frac - 0.25) < 0.1) return `${whole}¼f`;
    if (Math.abs(frac - 0.75) < 0.1) return `${whole}¾f`;

    // For unusual fractions, show decimal
    return `${furlongs.toFixed(1)}f`;
  } else {
    // Show as miles for route distances (8+ furlongs)
    const miles = furlongs / 8;
    const whole = Math.floor(miles);
    const frac = miles - whole;

    if (frac < 0.05) return `${whole}m`;
    if (Math.abs(frac - 0.0625) < 0.02) return `${whole}¹⁄₁₆m`; // 1/16
    if (Math.abs(frac - 0.125) < 0.02) return `${whole}⅛m`; // 1/8
    if (Math.abs(frac - 0.1875) < 0.02) return `${whole}³⁄₁₆m`; // 3/16
    if (Math.abs(frac - 0.25) < 0.02) return `${whole}¼m`; // 1/4
    if (Math.abs(frac - 0.3125) < 0.02) return `${whole}⁵⁄₁₆m`; // 5/16
    if (Math.abs(frac - 0.375) < 0.02) return `${whole}³⁄₈m`; // 3/8
    if (Math.abs(frac - 0.5) < 0.02) return `${whole}½m`; // 1/2
    if (Math.abs(frac - 0.625) < 0.02) return `${whole}⅝m`; // 5/8
    if (Math.abs(frac - 0.75) < 0.02) return `${whole}¾m`; // 3/4
    if (Math.abs(frac - 0.875) < 0.02) return `${whole}⅞m`; // 7/8

    // For unusual fractions, show decimal miles
    return `${miles.toFixed(2)}m`;
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
