/**
 * MultiRaceOpportunities Component
 *
 * Displays a list of detected multi-race betting opportunities.
 * Shows in the DayOverview when there are opportunities available.
 */

import React, { useState } from 'react';
import type {
  MultiRaceOpportunity,
  MultiRaceBet,
  ExperienceLevel,
} from '../../../lib/betting/betTypes';
import { MULTI_RACE_BET_CONFIGS } from '../../../lib/betting/betTypes';
import {
  getQualityIcon,
  formatRaceRange,
} from '../../../lib/betting/multiRaceBets';
import { formatPayoutRange } from '../../../lib/betting/multiRacePayouts';
import { MultiRaceExplanations } from './MultiRaceExplanations';
import './MultiRace.css';

interface MultiRaceOpportunitiesProps {
  /** Detected opportunities */
  opportunities: MultiRaceOpportunity[];
  /** Pre-built tickets for each opportunity */
  tickets: MultiRaceBet[];
  /** User's experience level */
  experienceLevel: ExperienceLevel;
  /** Callback when user wants to view an opportunity */
  onViewOpportunity: (opportunity: MultiRaceOpportunity, ticket: MultiRaceBet) => void;
}

export const MultiRaceOpportunities: React.FC<MultiRaceOpportunitiesProps> = ({
  opportunities,
  tickets,
  experienceLevel,
  onViewOpportunity,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  // Don't show for beginners
  if (experienceLevel === 'beginner') {
    return null;
  }

  // No opportunities detected
  if (opportunities.length === 0) {
    return null;
  }

  const handleViewClick = (opp: MultiRaceOpportunity) => {
    const ticket = tickets.find(
      t => t.type === opp.type && t.startingRace === opp.races[0]
    );
    if (ticket) {
      onViewOpportunity(opp, ticket);
    }
  };

  return (
    <div className="multi-race-section">
      <div className="multi-race-section__header">
        <span className="multi-race-section__icon">🎯</span>
        <h3 className="multi-race-section__title">MULTI-RACE OPPORTUNITIES</h3>
        <span className="multi-race-section__count">{opportunities.length}</span>
      </div>

      <div className="multi-race-opportunities">
        {opportunities.map((opp, index) => {
          const ticket = tickets.find(
            t => t.type === opp.type && t.startingRace === opp.races[0]
          );
          if (!ticket) return null;

          const config = MULTI_RACE_BET_CONFIGS[opp.type];
          const qualityIcon = getQualityIcon(opp.quality);

          return (
            <button
              key={`${opp.type}-${opp.races[0]}-${index}`}
              className={`multi-race-card multi-race-card--${opp.quality.toLowerCase()}`}
              onClick={() => handleViewClick(opp)}
            >
              <div className="multi-race-card__header">
                <div className="multi-race-card__title-row">
                  <span className="multi-race-card__quality-icon">{qualityIcon}</span>
                  <span
                    className={`multi-race-card__quality-label multi-race-card__quality-label--${opp.quality.toLowerCase()}`}
                  >
                    {opp.quality}:
                  </span>
                  <span className="multi-race-card__type">{config.name}</span>
                  <span className="multi-race-card__races">({formatRaceRange(opp.races)})</span>
                </div>
                <span className="multi-race-card__view-btn">
                  VIEW →
                </span>
              </div>

              <div className="multi-race-card__content">
                <p className="multi-race-card__reason">
                  <strong>Why:</strong> {opp.reasoning}
                </p>
              </div>

              <div className="multi-race-card__stats">
                <div className="multi-race-card__stat">
                  <span className="multi-race-card__stat-label">Cost</span>
                  <span className="multi-race-card__stat-value">${ticket.totalCost}</span>
                </div>
                <div className="multi-race-card__stat">
                  <span className="multi-race-card__stat-label">Potential</span>
                  <span className="multi-race-card__stat-value multi-race-card__stat-value--highlight">
                    {formatPayoutRange(ticket.potentialReturn)}
                  </span>
                </div>
                {opp.valuePlaysInSequence > 0 && (
                  <div className="multi-race-card__stat">
                    <span className="multi-race-card__stat-label">Value Plays</span>
                    <span className="multi-race-card__stat-value">
                      {opp.valuePlaysInSequence} 🔥
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        className="multi-race-section__help"
        onClick={() => setShowHelp(true)}
      >
        <span>❓</span>
        <span>WHAT ARE MULTI-RACE BETS?</span>
        <span style={{ marginLeft: 'auto' }}>[tap to learn]</span>
      </button>

      {showHelp && (
        <MultiRaceExplanations
          topic="what-are-multi-race-bets"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};

export default MultiRaceOpportunities;
