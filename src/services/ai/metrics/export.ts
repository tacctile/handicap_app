/**
 * AI Metrics Export
 *
 * Functions for exporting metrics reports and raw decision records.
 */

import type { AIDecisionRecord, AIPerformanceMetrics, MetricsExportOptions } from './types';
import { getAllDecisionRecords, getFilteredRecords } from './storage';
import { calculatePerformanceMetrics, compareToBaseline } from './calculator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Algorithm baseline for comparison */
const ALGORITHM_BASELINE = {
  winRate: 16.2,
  top3Rate: 48.6,
  exactaBox4Rate: 33.3,
  trifectaBox5Rate: 37.8,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a number as percentage string
 */
function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format difference with + or - prefix
 */
function formatDiff(value: number, decimals: number = 1): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Safe division returning percentage
 */
function toPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export a markdown metrics report
 *
 * @param options - Export options for filtering
 * @returns Markdown string of the report
 */
export async function exportMetricsReport(options?: MetricsExportOptions): Promise<string> {
  // Get records based on options
  let records: AIDecisionRecord[];

  if (options?.trackCodes || options?.startDate || options?.endDate || options?.resultsOnly) {
    records = await getFilteredRecords({
      trackCode: options?.trackCodes?.[0],
      startDate: options?.startDate,
      endDate: options?.endDate,
      resultRecordedOnly: options?.resultsOnly,
    });
  } else {
    records = await getAllDecisionRecords();
  }

  // Calculate metrics
  const metrics = calculatePerformanceMetrics(records);
  const baseline = compareToBaseline(metrics);

  // Build report
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  // Header
  lines.push('# AI Performance Report');
  lines.push(`Generated: ${timestamp}`);
  lines.push(`Races Analyzed: ${metrics.totalRaces}`);
  lines.push(`Races with Results: ${metrics.racesWithResults}`);
  lines.push('');

  // Win Rate Comparison
  lines.push('## Win Rate Comparison');
  lines.push('| Metric | Algorithm | AI | Difference |');
  lines.push('|--------|-----------|-----|------------|');
  lines.push(
    `| Win Rate | ${formatPercent(ALGORITHM_BASELINE.winRate)} | ${formatPercent(metrics.aiWinRate)} | ${formatDiff(baseline.winRateDiff)} |`
  );
  lines.push(
    `| Top-3 Rate | ${formatPercent(ALGORITHM_BASELINE.top3Rate)} | ${formatPercent(metrics.aiTop3Rate)} | ${formatDiff(baseline.top3RateDiff)} |`
  );
  lines.push('');

  // Override Analysis
  lines.push('## Override Analysis');
  lines.push(`- Override Rate: ${formatPercent(metrics.overrideRate)}`);
  lines.push(
    `- Override Win Rate: ${formatPercent(metrics.overrideWinRate)} (AI correct when disagreeing)`
  );
  lines.push(
    `- Confirm Win Rate: ${formatPercent(metrics.confirmWinRate)} (AI correct when agreeing)`
  );
  lines.push('');

  // Exotic Performance
  const exactaBox2Rate = toPercent(metrics.exactaBox2Hits, metrics.racesWithResults);
  const exactaBox3Rate = toPercent(metrics.exactaBox3Hits, metrics.racesWithResults);
  const exactaBox4Rate = toPercent(metrics.exactaBox4Hits, metrics.racesWithResults);
  const trifectaBox3Rate = toPercent(metrics.trifectaBox3Hits, metrics.racesWithResults);
  const trifectaBox4Rate = toPercent(metrics.trifectaBox4Hits, metrics.racesWithResults);
  const trifectaBox5Rate = toPercent(metrics.trifectaBox5Hits, metrics.racesWithResults);

  lines.push('## Exotic Performance');
  lines.push('| Bet Type | Algorithm | AI |');
  lines.push('|----------|-----------|-----|');
  lines.push(`| Exacta Box 2 | N/A | ${formatPercent(exactaBox2Rate)} |`);
  lines.push(`| Exacta Box 3 | N/A | ${formatPercent(exactaBox3Rate)} |`);
  lines.push(
    `| Exacta Box 4 | ${formatPercent(ALGORITHM_BASELINE.exactaBox4Rate)} | ${formatPercent(exactaBox4Rate)} |`
  );
  lines.push(`| Trifecta Box 3 | N/A | ${formatPercent(trifectaBox3Rate)} |`);
  lines.push(`| Trifecta Box 4 | N/A | ${formatPercent(trifectaBox4Rate)} |`);
  lines.push(
    `| Trifecta Box 5 | ${formatPercent(ALGORITHM_BASELINE.trifectaBox5Rate)} | ${formatPercent(trifectaBox5Rate)} |`
  );
  lines.push('');

  // Value Play Performance
  lines.push('## Value Play Performance');
  lines.push(`- Value Plays Identified: ${metrics.valuePlaysIdentified}`);
  lines.push(`- Value Play Win Rate: ${formatPercent(metrics.valuePlayWinRate)}`);
  lines.push(`- Average Odds When Won: ${metrics.valuePlayAvgOdds.toFixed(1)}-1`);
  lines.push('');

  // Confidence Calibration
  lines.push('## Confidence Calibration');
  lines.push('| Confidence | Races | Win Rate |');
  lines.push('|------------|-------|----------|');
  lines.push(
    `| HIGH | ${metrics.highConfidenceRaces} | ${formatPercent(metrics.highConfidenceWinRate)} |`
  );
  lines.push(
    `| MEDIUM | ${metrics.mediumConfidenceRaces} | ${formatPercent(metrics.mediumConfidenceWinRate)} |`
  );
  lines.push(
    `| LOW | ${metrics.lowConfidenceRaces} | ${formatPercent(metrics.lowConfidenceWinRate)} |`
  );
  lines.push('');

  // Bot Effectiveness
  lines.push('## Bot Effectiveness');
  lines.push(`- Trip Trouble Boost Win Rate: ${formatPercent(metrics.tripTroubleBoostWinRate)}`);
  lines.push(`- Pace Advantage Win Rate: ${formatPercent(metrics.paceAdvantageWinRate)}`);
  lines.push(
    `- Vulnerable Favorite Fade Rate: ${formatPercent(metrics.vulnerableFavoriteFadeRate)}`
  );
  lines.push('');

  // Field Type Performance
  lines.push('## Field Type Performance');
  lines.push('| Field Type | Win Rate |');
  lines.push('|------------|----------|');
  lines.push(`| DOMINANT | ${formatPercent(metrics.dominantFieldWinRate)} |`);
  lines.push(`| COMPETITIVE | ${formatPercent(metrics.competitiveFieldWinRate)} |`);
  lines.push(`| WIDE_OPEN | ${formatPercent(metrics.wideOpenFieldWinRate)} |`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  if (baseline.isOutperforming) {
    lines.push('**AI is OUTPERFORMING the algorithm baseline.**');
  } else {
    lines.push('**AI is currently NOT outperforming the algorithm baseline.**');
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Export raw decision records as JSON
 *
 * @param options - Export options for filtering
 * @returns JSON string of decision records
 */
export async function exportDecisionRecords(options?: MetricsExportOptions): Promise<string> {
  let records: AIDecisionRecord[];

  if (options?.trackCodes || options?.startDate || options?.endDate || options?.resultsOnly) {
    records = await getFilteredRecords({
      trackCode: options?.trackCodes?.[0],
      startDate: options?.startDate,
      endDate: options?.endDate,
      resultRecordedOnly: options?.resultsOnly,
    });
  } else {
    records = await getAllDecisionRecords();
  }

  return JSON.stringify(records, null, 2);
}

/**
 * Export metrics as a structured object (for programmatic use)
 *
 * @param options - Export options for filtering
 * @returns Performance metrics object
 */
export async function exportMetricsData(options?: MetricsExportOptions): Promise<{
  metrics: AIPerformanceMetrics;
  baseline: ReturnType<typeof compareToBaseline>;
  recordCount: number;
  generatedAt: string;
}> {
  let records: AIDecisionRecord[];

  if (options?.trackCodes || options?.startDate || options?.endDate || options?.resultsOnly) {
    records = await getFilteredRecords({
      trackCode: options?.trackCodes?.[0],
      startDate: options?.startDate,
      endDate: options?.endDate,
      resultRecordedOnly: options?.resultsOnly,
    });
  } else {
    records = await getAllDecisionRecords();
  }

  const metrics = calculatePerformanceMetrics(records);
  const baseline = compareToBaseline(metrics);

  return {
    metrics,
    baseline,
    recordCount: records.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Export a CSV of decision records for spreadsheet analysis
 *
 * @param options - Export options for filtering
 * @returns CSV string
 */
export async function exportDecisionRecordsCSV(options?: MetricsExportOptions): Promise<string> {
  let records: AIDecisionRecord[];

  if (options?.trackCodes || options?.startDate || options?.endDate || options?.resultsOnly) {
    records = await getFilteredRecords({
      trackCode: options?.trackCodes?.[0],
      startDate: options?.startDate,
      endDate: options?.endDate,
      resultRecordedOnly: options?.resultsOnly,
    });
  } else {
    records = await getAllDecisionRecords();
  }

  // CSV headers
  const headers = [
    'raceId',
    'trackCode',
    'raceNumber',
    'raceDate',
    'fieldSize',
    'algorithmTopPick',
    'aiTopPick',
    'isOverride',
    'aiConfidence',
    'fieldType',
    'betType',
    'actualWinner',
    'algorithmWon',
    'aiWon',
    'resultRecorded',
  ];

  const lines: string[] = [headers.join(',')];

  for (const record of records) {
    const algorithmWon = record.actualWinner === record.algorithmTopPick ? 'true' : 'false';
    const aiWon = record.actualWinner === record.aiTopPick ? 'true' : 'false';

    const row = [
      record.raceId,
      record.trackCode,
      record.raceNumber.toString(),
      record.raceDate,
      record.fieldSize.toString(),
      record.algorithmTopPick.toString(),
      record.aiTopPick.toString(),
      record.isOverride.toString(),
      record.aiConfidence,
      record.fieldType,
      record.betType,
      record.actualWinner?.toString() ?? '',
      record.resultRecorded ? algorithmWon : '',
      record.resultRecorded ? aiWon : '',
      record.resultRecorded.toString(),
    ];

    lines.push(row.join(','));
  }

  return lines.join('\n');
}
