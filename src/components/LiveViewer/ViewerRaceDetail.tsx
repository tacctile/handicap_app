/**
 * ViewerRaceDetail Component
 *
 * Shows detailed bet information for a single race (read-only).
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { LiveSessionRace, LiveSessionHorse } from '../../lib/supabase';

interface ViewerRaceDetailProps {
  /** Race data */
  race: LiveSessionRace;
  /** Horses in this race */
  horses: LiveSessionHorse[];
  /** Track name */
  trackName: string;
  /** Callback to go back to list */
  onBack: () => void;
}

const VERDICT_EMOJI: Record<string, string> = {
  BET: '🟢',
  CAUTION: '🟡',
  PASS: '🔴',
};

export const ViewerRaceDetail: React.FC<ViewerRaceDetailProps> = ({
  race,
  horses,
  trackName: _trackName,
  onBack,
}) => {
  const [copiedBet, setCopiedBet] = useState<string | null>(null);

  // Get bet suggestions from race data
  const betSuggestions = useMemo(() => {
    if (!race.betSuggestions) return [];
    // betSuggestions is stored as JSON, parse if needed
    const suggestions = race.betSuggestions;
    if (Array.isArray(suggestions)) return suggestions;
    if (typeof suggestions === 'object' && 'bets' in suggestions) {
      return (suggestions as Record<string, unknown>).bets as unknown[];
    }
    return [];
  }, [race.betSuggestions]);

  // Calculate time since last update
  const updateTime = useMemo(() => {
    if (!race.updatedAt) return null;
    const updated = new Date(race.updatedAt);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - updated.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    return 'over an hour ago';
  }, [race.updatedAt]);

  // Copy text to clipboard
  const handleCopy = useCallback(async (text: string, betId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBet(betId);
      setTimeout(() => setCopiedBet(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Sort horses by post position
  const sortedHorses = useMemo(() => {
    return [...horses].sort((a, b) => a.postPosition - b.postPosition);
  }, [horses]);

  return (
    <div className="viewer-race-detail">
      {/* Header */}
      <div className="viewer-race-detail__header">
        <button className="viewer-race-detail__back-btn" onClick={onBack}>
          <span className="material-icons">arrow_back</span>
          BACK
        </button>
        <h1 className="viewer-race-detail__title">
          RACE {race.raceNumber} BETS
        </h1>
      </div>

      {/* Verdict banner */}
      <div
        className={`viewer-race-detail__verdict viewer-race-detail__verdict--${(race.verdict || 'pass').toLowerCase()}`}
      >
        <span className="viewer-race-detail__verdict-emoji">
          {VERDICT_EMOJI[race.verdict || 'PASS'] || '🔴'}
        </span>
        <span className="viewer-race-detail__verdict-text">
          {race.verdict || 'PASS'}
        </span>
        {race.confidence && (
          <span className="viewer-race-detail__confidence">
            {race.confidence} confidence
          </span>
        )}
      </div>

      {/* Value play section */}
      {race.valuePlayName && (
        <div className="viewer-race-detail__value-play">
          <div className="viewer-race-detail__value-play-header">
            VALUE PLAY:
          </div>
          <div className="viewer-race-detail__value-play-horse">
            #{race.valuePlayPost} {race.valuePlayName}
          </div>
          <div className="viewer-race-detail__value-play-info">
            <span className="viewer-race-detail__value-play-odds">
              Odds: {race.valuePlayOdds}
            </span>
            <span className="viewer-race-detail__value-play-edge">
              Edge: +{race.valuePlayEdge}%
            </span>
          </div>
        </div>
      )}

      {/* Budget allocation */}
      {race.allocatedBudget !== null && (
        <div className="viewer-race-detail__budget">
          <span className="viewer-race-detail__budget-label">Budget:</span>
          <span className="viewer-race-detail__budget-value">
            ${race.allocatedBudget}
          </span>
        </div>
      )}

      {/* Bet suggestions */}
      {betSuggestions.length > 0 && (
        <div className="viewer-race-detail__bets">
          <h2 className="viewer-race-detail__bets-title">BET SUGGESTIONS:</h2>

          {betSuggestions.map((bet: unknown, index: number) => {
            const betData = bet as Record<string, unknown>;
            const whatToSay = String(betData.whatToSay || betData.instruction || '');
            const betType = String(betData.type || betData.betType || 'Bet');
            const amount = Number(betData.amount || betData.cost || 0);
            const betId = `bet-${index}`;

            return (
              <div key={betId} className="viewer-race-detail__bet-card">
                <div className="viewer-race-detail__bet-header">
                  <span className="viewer-race-detail__bet-type">{betType}</span>
                  <span className="viewer-race-detail__bet-amount">${amount}</span>
                </div>

                {whatToSay && (
                  <div className="viewer-race-detail__what-to-say">
                    <div className="viewer-race-detail__what-to-say-label">
                      WHAT TO SAY AT THE WINDOW:
                    </div>
                    <div className="viewer-race-detail__what-to-say-box">
                      <span className="viewer-race-detail__what-to-say-text">
                        "{whatToSay}"
                      </span>
                      <button
                        className={`viewer-race-detail__copy-btn ${
                          copiedBet === betId ? 'viewer-race-detail__copy-btn--copied' : ''
                        }`}
                        onClick={() => handleCopy(whatToSay, betId)}
                      >
                        <span className="material-icons">
                          {copiedBet === betId ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Horse list (if available) */}
      {sortedHorses.length > 0 && (
        <div className="viewer-race-detail__horses">
          <h2 className="viewer-race-detail__horses-title">FIELD:</h2>

          <div className="viewer-race-detail__horse-list">
            {sortedHorses.map((horse) => (
              <div
                key={horse.postPosition}
                className={`viewer-race-detail__horse-row ${
                  horse.isScratched ? 'viewer-race-detail__horse-row--scratched' : ''
                } ${
                  horse.valueStatus === 'OVERLAY'
                    ? 'viewer-race-detail__horse-row--overlay'
                    : ''
                }`}
              >
                <div className="viewer-race-detail__horse-post">
                  #{horse.postPosition}
                </div>
                <div className="viewer-race-detail__horse-name">
                  {horse.horseName}
                  {horse.isScratched && (
                    <span className="viewer-race-detail__scratched-badge">
                      SCRATCHED
                    </span>
                  )}
                </div>
                <div className="viewer-race-detail__horse-odds">
                  {horse.liveOdds || horse.morningLine || '—'}
                </div>
                {horse.edge !== null && !horse.isScratched && (
                  <div
                    className={`viewer-race-detail__horse-edge ${
                      (horse.edge ?? 0) >= 50 ? 'viewer-race-detail__horse-edge--high' : ''
                    }`}
                  >
                    {(horse.edge ?? 0) > 0 ? '+' : ''}
                    {horse.edge}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update timestamp */}
      {updateTime && (
        <div className="viewer-race-detail__updated">
          Updated {updateTime}
        </div>
      )}
    </div>
  );
};

export default ViewerRaceDetail;
