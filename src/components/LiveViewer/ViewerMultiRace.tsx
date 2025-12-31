/**
 * ViewerMultiRace Component
 *
 * Shows detailed multi-race bet information (read-only).
 */

import React, { useState, useCallback } from 'react';
import type { LiveSessionRace, LiveSessionMultiRace } from '../../lib/supabase';

interface ViewerMultiRaceProps {
  /** Multi-race bet data */
  multiRaceBet: LiveSessionMultiRace;
  /** All races (for reference) */
  races: LiveSessionRace[];
  /** Callback to go back to list */
  onBack: () => void;
}

const BET_TYPE_LABEL: Record<string, string> = {
  DAILY_DOUBLE: 'Daily Double',
  PICK_3: 'Pick 3',
  PICK_4: 'Pick 4',
  PICK_5: 'Pick 5',
  PICK_6: 'Pick 6',
};

const QUALITY_LABEL: Record<string, string> = {
  PRIME: 'Prime Opportunity',
  GOOD: 'Good Play',
  MARGINAL: 'Marginal',
};

const QUALITY_EMOJI: Record<string, string> = {
  PRIME: '⭐',
  GOOD: '✓',
  MARGINAL: '○',
};

export const ViewerMultiRace: React.FC<ViewerMultiRaceProps> = ({
  multiRaceBet,
  races,
  onBack,
}) => {
  const [copied, setCopied] = useState(false);

  // Copy "what to say" to clipboard
  const handleCopy = useCallback(async () => {
    if (!multiRaceBet.whatToSay) return;

    try {
      await navigator.clipboard.writeText(multiRaceBet.whatToSay);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [multiRaceBet.whatToSay]);

  // Parse legs data
  const legs = Array.isArray(multiRaceBet.legs)
    ? multiRaceBet.legs
    : (multiRaceBet.legs as { legs?: unknown[] })?.legs || [];

  return (
    <div className="viewer-multi-race">
      {/* Header */}
      <div className="viewer-multi-race__header">
        <button className="viewer-multi-race__back-btn" onClick={onBack}>
          <span className="material-icons">arrow_back</span>
          BACK
        </button>
        <h1 className="viewer-multi-race__title">
          {BET_TYPE_LABEL[multiRaceBet.betType] || multiRaceBet.betType}
        </h1>
      </div>

      {/* Quality badge */}
      <div
        className={`viewer-multi-race__quality viewer-multi-race__quality--${(multiRaceBet.quality || 'good').toLowerCase()}`}
      >
        <span className="viewer-multi-race__quality-emoji">
          {QUALITY_EMOJI[multiRaceBet.quality || 'GOOD'] || '✓'}
        </span>
        <span className="viewer-multi-race__quality-text">
          {QUALITY_LABEL[multiRaceBet.quality || 'GOOD'] || 'Good Play'}
        </span>
      </div>

      {/* Race range */}
      <div className="viewer-multi-race__range">
        Races {multiRaceBet.startingRace} through {multiRaceBet.endingRace}
      </div>

      {/* Cost and potential */}
      <div className="viewer-multi-race__stats">
        <div className="viewer-multi-race__stat">
          <span className="viewer-multi-race__stat-label">Cost:</span>
          <span className="viewer-multi-race__stat-value">
            ${multiRaceBet.totalCost?.toFixed(0) || '0'}
          </span>
        </div>
        <div className="viewer-multi-race__stat">
          <span className="viewer-multi-race__stat-label">Combinations:</span>
          <span className="viewer-multi-race__stat-value">
            {multiRaceBet.combinations || '—'}
          </span>
        </div>
        <div className="viewer-multi-race__stat viewer-multi-race__stat--potential">
          <span className="viewer-multi-race__stat-label">Potential Return:</span>
          <span className="viewer-multi-race__stat-value">
            ${multiRaceBet.potentialReturnMin || 0} - ${multiRaceBet.potentialReturnMax || 0}
          </span>
        </div>
      </div>

      {/* Legs */}
      <div className="viewer-multi-race__legs">
        <h2 className="viewer-multi-race__legs-title">TICKET STRUCTURE:</h2>

        {legs.map((leg: unknown, index: number) => {
          const legData = leg as Record<string, unknown>;
          const raceNum = Number(legData.raceNumber || multiRaceBet.startingRace + index);
          const horses = (legData.horses || legData.selections || []) as Array<{
            postPosition?: number;
            horseName?: string;
            name?: string;
            post?: number;
          }>;

          // Get race info
          const raceInfo = races.find((r) => r.raceNumber === raceNum);

          return (
            <div key={index} className="viewer-multi-race__leg">
              <div className="viewer-multi-race__leg-header">
                <span className="viewer-multi-race__leg-race">
                  RACE {raceNum}
                </span>
                {raceInfo?.verdict && (
                  <span
                    className={`viewer-multi-race__leg-verdict viewer-multi-race__leg-verdict--${raceInfo.verdict.toLowerCase()}`}
                  >
                    {raceInfo.verdict}
                  </span>
                )}
              </div>

              <div className="viewer-multi-race__leg-horses">
                {horses.map((horse, hIndex) => (
                  <span key={hIndex} className="viewer-multi-race__leg-horse">
                    #{horse.postPosition || horse.post}{' '}
                    {horse.horseName || horse.name}
                    {hIndex < horses.length - 1 && ', '}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* What to say */}
      {multiRaceBet.whatToSay && (
        <div className="viewer-multi-race__what-to-say">
          <div className="viewer-multi-race__what-to-say-label">
            WHAT TO SAY AT THE WINDOW:
          </div>
          <div className="viewer-multi-race__what-to-say-box">
            <span className="viewer-multi-race__what-to-say-text">
              "{multiRaceBet.whatToSay}"
            </span>
            <button
              className={`viewer-multi-race__copy-btn ${
                copied ? 'viewer-multi-race__copy-btn--copied' : ''
              }`}
              onClick={handleCopy}
            >
              <span className="material-icons">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerMultiRace;
