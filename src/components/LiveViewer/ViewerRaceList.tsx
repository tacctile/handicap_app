/**
 * ViewerRaceList Component
 *
 * Shows the list of all races with their verdicts and value plays.
 */

import React from 'react';
import type { LiveSessionRace, LiveSessionMultiRace } from '../../lib/supabase';

interface ViewerRaceListProps {
  /** All races in the session */
  races: LiveSessionRace[];
  /** Multi-race bets */
  multiRaceBets: LiveSessionMultiRace[];
  /** Callback when user taps a race */
  onViewRace: (raceNumber: number) => void;
  /** Callback when user taps a multi-race bet */
  onViewMultiRace: (index: number) => void;
}

const VERDICT_EMOJI: Record<string, string> = {
  BET: '🟢',
  CAUTION: '🟡',
  PASS: '🔴',
};

const VERDICT_LABEL: Record<string, string> = {
  BET: 'BET',
  CAUTION: 'CAUTION',
  PASS: 'PASS',
};

const QUALITY_EMOJI: Record<string, string> = {
  PRIME: '⭐',
  GOOD: '✓',
  MARGINAL: '○',
};

const BET_TYPE_LABEL: Record<string, string> = {
  DAILY_DOUBLE: 'Daily Double',
  PICK_3: 'Pick 3',
  PICK_4: 'Pick 4',
  PICK_5: 'Pick 5',
  PICK_6: 'Pick 6',
};

export const ViewerRaceList: React.FC<ViewerRaceListProps> = ({
  races,
  multiRaceBets,
  onViewRace,
  onViewMultiRace,
}) => {
  return (
    <div className="viewer-race-list">
      {/* Race-by-race section */}
      <section className="viewer-race-list__section">
        <h2 className="viewer-race-list__section-title">RACE-BY-RACE:</h2>

        <div className="viewer-race-list__races">
          {races.map((race) => (
            <button
              key={race.raceNumber}
              className="viewer-race-list__race-row"
              onClick={() => onViewRace(race.raceNumber)}
            >
              <div className="viewer-race-list__race-number">
                R{race.raceNumber}
              </div>

              <div className="viewer-race-list__race-verdict">
                <span className="viewer-race-list__verdict-emoji">
                  {VERDICT_EMOJI[race.verdict || 'PASS'] || '🔴'}
                </span>
                <span className="viewer-race-list__verdict-label">
                  {VERDICT_LABEL[race.verdict || 'PASS'] || 'PASS'}
                </span>
              </div>

              <div className="viewer-race-list__race-value">
                {race.valuePlayName ? (
                  <>
                    <span className="viewer-race-list__value-horse">
                      #{race.valuePlayPost} {race.valuePlayName.substring(0, 12)}
                      {(race.valuePlayName?.length ?? 0) > 12 ? '...' : ''}
                    </span>
                    <span className="viewer-race-list__value-odds">
                      ({race.valuePlayOdds})
                    </span>
                  </>
                ) : (
                  <span className="viewer-race-list__no-value">No value play</span>
                )}
              </div>

              <div className="viewer-race-list__race-edge">
                {race.valuePlayEdge !== null ? (
                  <span
                    className={`viewer-race-list__edge-value ${
                      (race.valuePlayEdge ?? 0) >= 75
                        ? 'viewer-race-list__edge-value--high'
                        : ''
                    }`}
                  >
                    +{Math.round(race.valuePlayEdge ?? 0)}%
                  </span>
                ) : (
                  <span className="viewer-race-list__edge-dash">—</span>
                )}
              </div>

              <div className="viewer-race-list__race-arrow">
                <span className="material-icons">chevron_right</span>
              </div>
            </button>
          ))}

          {races.length === 0 && (
            <div className="viewer-race-list__empty">
              No race data available yet.
            </div>
          )}
        </div>
      </section>

      {/* Multi-race section */}
      {multiRaceBets.length > 0 && (
        <section className="viewer-race-list__section">
          <h2 className="viewer-race-list__section-title">🎯 MULTI-RACE PLAYS:</h2>

          <div className="viewer-race-list__multi-races">
            {multiRaceBets.map((bet, index) => (
              <button
                key={bet.id}
                className="viewer-race-list__multi-row"
                onClick={() => onViewMultiRace(index)}
              >
                <span className="viewer-race-list__multi-quality">
                  {QUALITY_EMOJI[bet.quality || 'GOOD'] || '✓'}
                </span>

                <div className="viewer-race-list__multi-info">
                  <span className="viewer-race-list__multi-type">
                    {BET_TYPE_LABEL[bet.betType] || bet.betType}
                  </span>
                  <span className="viewer-race-list__multi-races-range">
                    (R{bet.startingRace}-R{bet.endingRace})
                  </span>
                </div>

                <div className="viewer-race-list__multi-cost">
                  ${bet.totalCost?.toFixed(0) || '0'}
                </div>

                <div className="viewer-race-list__multi-potential">
                  ${bet.potentialReturnMin || 0}-${bet.potentialReturnMax || 0}
                </div>

                <div className="viewer-race-list__race-arrow">
                  <span className="material-icons">chevron_right</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Help tip */}
      <div className="viewer-race-list__tip">
        <span className="viewer-race-list__tip-icon">💡</span>
        <span className="viewer-race-list__tip-text">
          Tap any race to see detailed bet suggestions
        </span>
      </div>
    </div>
  );
};

export default ViewerRaceList;
