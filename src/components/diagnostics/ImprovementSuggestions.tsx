/**
 * ImprovementSuggestions — "What Could Be Better?"
 *
 * Generates dynamic suggestion cards based on pattern analysis
 * of algorithm performance data. Cards sorted by severity.
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

  // (a) Tier 1 win rate < 25%
  if (tier1WinRate < 25) {
    suggestions.push({
      title: 'Tier 1 Accuracy Below Target',
      text: `Top-tier horses are winning ${Math.round(tier1WinRate * 10) / 10}% vs the 35% target. The scoring engine may need rebalancing between speed and form factors.`,
      borderColor: C.error,
      severity: 'error',
    });
  }

  // (b) Tier 3 win rate > Tier 2 win rate
  if (tier3WinRate > tier2WinRate && tier3WinRate > 0) {
    suggestions.push({
      title: 'Tier Inversion Detected',
      text: `Longshots (Tier 3) are outperforming mid-tier horses (Tier 2). The tier boundaries may need adjustment or the value detection is finding genuine overlays.`,
      borderColor: C.warning,
      severity: 'warning',
    });
  }

  // (c) Any track with 0% top pick win rate with >= 5 races
  for (const track of results.trackSummaries) {
    if (track.topPickWinRate === 0 && track.raceCount >= 5) {
      suggestions.push({
        title: `Struggling at ${track.trackName || track.trackCode}`,
        text: `Zero top-pick wins from ${track.raceCount} races at ${track.trackCode}. Track intelligence data may need review.`,
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
      text: `Top picks finish in the money ${topPickITM}% but only win ${topPickWin}%. The system finds contenders but struggles to identify the actual winner.`,
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
      title: 'Ranking Inversion at the Top',
      text: 'Our #2 ranked horses win more often than #1. The scoring may over-value a factor that produces false favorites.',
      borderColor: C.error,
      severity: 'error',
    });
  }

  // (f) Exacta box 3 hit rate > 30%
  if (results.exactaBox3Rate > 30) {
    suggestions.push({
      title: 'Strong Exacta Performance',
      text: `Top 3 horses produce the exacta ${results.exactaBox3Rate}% of the time. Consider making exacta box 3 a primary recommendation.`,
      borderColor: C.success,
      severity: 'success',
    });
  }

  // (g) Total races < 100
  if (results.validRaces < 100) {
    suggestions.push({
      title: 'More Data Needed',
      text: `With ${results.validRaces} races, patterns may shift. Aim for 200+ for reliable conclusions and 500+ for statistical significance.`,
      borderColor: C.primary,
      severity: 'info',
    });
  }

  // (h) All tier win rates within ±5% of expected (35/18/8)
  const tier1Diff = Math.abs(tier1WinRate - 35);
  const tier2Diff = Math.abs(tier2WinRate - 18);
  const tier3Diff = Math.abs(tier3WinRate - 8);
  if (tier1Diff <= 5 && tier2Diff <= 5 && tier3Diff <= 5) {
    suggestions.push({
      title: 'Algorithm Well-Calibrated',
      text: 'All tiers performing within 5% of targets. The scoring engine is working as designed.',
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
            text: 'Algorithm performing within expected parameters.',
            borderColor: C.success,
            severity: 'success' as SuggestionSeverity,
          },
        ];

  return (
    <div className="diag-chart-card">
      <h3 className="diag-chart-title">What Could Be Better?</h3>
      <p className="diag-chart-description">
        Based on the patterns in our data, here are areas where the system excels and where it could
        improve.
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
