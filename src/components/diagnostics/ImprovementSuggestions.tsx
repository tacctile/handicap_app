/**
 * ImprovementSuggestions — "Areas for Improvement"
 *
 * Generates dynamic suggestion cards based on pattern analysis
 * of algorithm performance data. Cards sorted by severity.
 * All text written for total novices — no jargon.
 */

import { useMemo } from 'react';
import type { DiagnosticsResults, PredictionRecord } from '../../services/diagnostics/types';

// Design token hex values for inline styles
const C = {
  primary: '#19abb5',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

// ============================================================================
// TYPES
// ============================================================================

type SuggestionSeverity = 'error' | 'warning' | 'success' | 'info';

interface Suggestion {
  title: string;
  text: string;
  borderColor: string;
  severity: SuggestionSeverity;
}

const SEVERITY_ORDER: Record<SuggestionSeverity, number> = {
  error: 0,
  warning: 1,
  success: 2,
  info: 3,
};

// ============================================================================
// SUGGESTION GENERATORS
// ============================================================================

function generateSuggestions(
  results: DiagnosticsResults,
  predictions: PredictionRecord[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Compute tier win rates
  const tierWinRates: Record<number, number> = {};
  for (const tier of [1, 2, 3]) {
    const tierPreds = predictions.filter((p) => p.tier === tier);
    const wins = tierPreds.filter((p) => p.actualFinish === 1).length;
    tierWinRates[tier] = tierPreds.length > 0 ? (wins / tierPreds.length) * 100 : 0;
  }

  const tier1WinRate = tierWinRates[1] ?? 0;
  const tier2WinRate = tierWinRates[2] ?? 0;
  const tier3WinRate = tierWinRates[3] ?? 0;

  // (a) Tier 1 win rate below target
  if (tier1WinRate < 25) {
    suggestions.push({
      title: 'Top Picks Below Target',
      text: `Our most confident picks are winning ${Math.round(tier1WinRate * 10) / 10}% of the time, but our target is 35%. This means we might be rating some horses too highly. As we add more race data, this number should improve.`,
      borderColor: C.error,
      severity: 'error',
    });
  }

  // (b) Tier 3 win rate > Tier 2 win rate
  if (tier3WinRate > tier2WinRate && tier3WinRate > 0) {
    suggestions.push({
      title: 'Confidence Levels Out of Order',
      text: `Surprisingly, our lower-rated horses are winning more than our middle-rated ones. This can happen with a small amount of test data, or it might mean we need to adjust how we separate the groups.`,
      borderColor: C.warning,
      severity: 'warning',
    });
  }

  // (c) Any track with 0% top pick win rate with >= 5 races
  for (const track of results.trackSummaries) {
    if (track.topPickWinRate === 0 && track.raceCount >= 5) {
      suggestions.push({
        title: `Struggling at ${track.trackName || track.trackCode}`,
        text: `Our top pick hasn't won any of the ${track.raceCount} races we tested at ${track.trackCode}. This track might have unique characteristics our system doesn't fully account for yet.`,
        borderColor: C.error,
        severity: 'error',
      });
    }
  }

  // (d) Top pick ITM > 45% but win rate < 15%
  const topPickITM = results.topPickShowRate;
  const topPickWin = results.topPickWinRate;
  if (topPickITM > 45 && topPickWin < 15) {
    suggestions.push({
      title: 'Close But Not Closing',
      text: `Our top picks finish in the top 3 about ${topPickITM}% of the time, which is good — but they only win ${topPickWin}%. This means we're good at finding competitive horses but need to get better at identifying the actual winner.`,
      borderColor: C.warning,
      severity: 'warning',
    });
  }

  // (e) Rank 1 win rate < Rank 2 win rate
  const rank1Preds = predictions.filter((p) => p.algorithmRank === 1);
  const rank2Preds = predictions.filter((p) => p.algorithmRank === 2);
  const rank1WinRate =
    rank1Preds.length > 0
      ? (rank1Preds.filter((p) => p.actualFinish === 1).length / rank1Preds.length) * 100
      : 0;
  const rank2WinRate =
    rank2Preds.length > 0
      ? (rank2Preds.filter((p) => p.actualFinish === 1).length / rank2Preds.length) * 100
      : 0;
  if (rank1WinRate < rank2WinRate && rank2WinRate > 0) {
    suggestions.push({
      title: 'Ranking Order Issue',
      text: 'Our #2 ranked horse actually wins more often than our #1 pick. This suggests our scoring might be slightly overvaluing one factor, causing the wrong horse to rank first.',
      borderColor: C.error,
      severity: 'error',
    });
  }

  // (f) Total races < 100
  if (results.validRaces < 100) {
    suggestions.push({
      title: 'More Data Needed',
      text: `We've only tested ${results.validRaces} races so far. The more races we test, the more reliable these numbers become. Aim for 200+ races for solid conclusions.`,
      borderColor: C.primary,
      severity: 'info',
    });
  }

  // (g) All tier win rates within ±5% of expected (35/18/8)
  const tier1Diff = Math.abs(tier1WinRate - 35);
  const tier2Diff = Math.abs(tier2WinRate - 18);
  const tier3Diff = Math.abs(tier3WinRate - 8);
  if (tier1Diff <= 5 && tier2Diff <= 5 && tier3Diff <= 5) {
    suggestions.push({
      title: 'System Well-Calibrated',
      text: 'All of our confidence levels are performing close to their targets. The prediction system is working as designed.',
      borderColor: C.success,
      severity: 'success',
    });
  }

  // Sort by severity
  suggestions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return suggestions;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ImprovementSuggestions({
  results,
  predictions,
}: {
  results: DiagnosticsResults;
  predictions: PredictionRecord[];
}) {
  const suggestions = useMemo(
    () => generateSuggestions(results, predictions),
    [results, predictions]
  );

  const cards =
    suggestions.length > 0
      ? suggestions
      : [
          {
            title: 'No Issues Detected',
            text: 'Our prediction system is performing within expected ranges across all metrics.',
            borderColor: C.success,
            severity: 'success' as SuggestionSeverity,
          },
        ];

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">Areas for Improvement</h3>
      <p className="diag-chart-description">
        Based on the patterns in our test data, here are areas where the system is doing well and
        where it could get better.
      </p>

      <div className="diag-suggestions-stack">
        {cards.map((card, i) => (
          <div
            key={i}
            className="diag-suggestion-card"
            style={{ borderLeftColor: card.borderColor }}
          >
            <div className="diag-suggestion-title">{card.title}</div>
            <div className="diag-suggestion-text">{card.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
