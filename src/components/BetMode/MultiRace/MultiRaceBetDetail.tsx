/**
 * MultiRaceBetDetail Component
 *
 * Displays a complete multi-race ticket with all legs,
 * cost breakdown, potential payouts, and "what to say" script.
 */

import React, { useState } from 'react';
import type { MultiRaceBet, MultiRaceOpportunity } from '../../../lib/betting/betTypes';
import { MULTI_RACE_BET_CONFIGS } from '../../../lib/betting/betTypes';
import { getCombinationMath } from '../../../lib/betting/multiRaceTickets';
import { getPayoutScenarios } from '../../../lib/betting/multiRacePayouts';
import { getQualityIcon } from '../../../lib/betting/multiRaceBets';
import { MultiRaceExplanations } from './MultiRaceExplanations';
import './MultiRace.css';

interface MultiRaceBetDetailProps {
  /** The multi-race bet to display */
  ticket: MultiRaceBet;
  /** The opportunity this ticket was built from */
  opportunity: MultiRaceOpportunity;
  /** Callback to go back */
  onBack: () => void;
  /** Callback to edit the ticket */
  onEdit: () => void;
  /** Callback to add the ticket to bets */
  onAddToBets: (ticket: MultiRaceBet) => void;
}

type HelpTopic = 'pick-4-explained' | 'pick-3-explained' | 'daily-double-explained' | 'what-is-single' | 'what-is-spread';

export const MultiRaceBetDetail: React.FC<MultiRaceBetDetailProps> = ({
  ticket,
  opportunity,
  onBack,
  onEdit,
  onAddToBets,
}) => {
  const [copied, setCopied] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  const config = MULTI_RACE_BET_CONFIGS[ticket.type];
  const qualityIcon = getQualityIcon(opportunity.quality);
  const payoutScenarios = getPayoutScenarios(ticket.type, ticket.legs);
  const combinationMath = getCombinationMath(ticket.legs);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.whatToSay);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy:', err);
    }
  };

  const getHelpTopic = (): HelpTopic => {
    switch (ticket.type) {
      case 'PICK_4':
      case 'PICK_5':
      case 'PICK_6':
        return 'pick-4-explained';
      case 'PICK_3':
        return 'pick-3-explained';
      case 'DAILY_DOUBLE':
        return 'daily-double-explained';
    }
  };

  return (
    <div className="multi-race-detail">
      {/* Header */}
      <div className="multi-race-detail__header">
        <div className="multi-race-detail__title-row">
          <span className="multi-race-detail__icon">{config.icon}</span>
          <h2 className="multi-race-detail__title">
            {config.name}: Races {ticket.startingRace}-{ticket.endingRace}
          </h2>
        </div>
        <button className="multi-race-detail__back-btn" onClick={onBack}>
          ← BACK
        </button>
      </div>

      {/* Quality badge */}
      <div className={`multi-race-detail__quality multi-race-detail__quality--${opportunity.quality.toLowerCase()}`}>
        <span className="multi-race-detail__quality-icon">{qualityIcon}</span>
        <span className={`multi-race-detail__quality-label multi-race-detail__quality-label--${opportunity.quality.toLowerCase()}`}>
          {opportunity.quality} OPPORTUNITY
        </span>
        <span className="multi-race-detail__quality-text">"{ticket.explanation}"</span>
      </div>

      {/* Ticket legs */}
      <h4 className="multi-race-detail__section-header">YOUR TICKET:</h4>
      <div className="multi-race-detail__legs">
        {ticket.legs.map((leg, idx) => (
          <div
            key={leg.raceNumber}
            className={`multi-race-leg ${leg.hasValuePlay ? 'multi-race-leg--has-value' : ''}`}
          >
            <div className="multi-race-leg__header">
              <div className="multi-race-leg__title">
                <span className="multi-race-leg__race-label">LEG {idx + 1} — RACE {leg.raceNumber}</span>
              </div>
              <span className={`multi-race-leg__strategy ${leg.strategy === 'SINGLE' ? 'multi-race-leg__strategy--single' : ''}`}>
                {leg.strategy}
              </span>
            </div>

            <div className="multi-race-leg__horses">
              {leg.horses.map((horseNum, hIdx) => {
                const isValuePlay = leg.valuePlayHorse === horseNum;
                return (
                  <div
                    key={horseNum}
                    className={`multi-race-leg__horse ${isValuePlay ? 'multi-race-leg__horse--value' : ''}`}
                  >
                    <span className="multi-race-leg__horse-number">#{horseNum}</span>
                    <span className="multi-race-leg__horse-name">{leg.horseNames[hIdx]}</span>
                    <span className="multi-race-leg__horse-odds">({leg.horseOdds[hIdx]})</span>
                    {isValuePlay && <span className="multi-race-leg__horse-fire">🔥</span>}
                  </div>
                );
              })}
            </div>

            <p className="multi-race-leg__reasoning">{leg.reasoning}</p>
          </div>
        ))}
      </div>

      {/* Ticket math */}
      <h4 className="multi-race-detail__section-header">TICKET MATH:</h4>
      <div className="multi-race-detail__math">
        <div className="multi-race-detail__math-row">
          <span className="multi-race-detail__math-label">Combinations</span>
          <span className="multi-race-detail__math-value">{combinationMath}</span>
        </div>
        <div className="multi-race-detail__math-row">
          <span className="multi-race-detail__math-label">Cost per combo</span>
          <span className="multi-race-detail__math-value">${ticket.costPerCombo}</span>
        </div>
        <div className="multi-race-detail__math-row">
          <span className="multi-race-detail__math-label">Total cost</span>
          <span className="multi-race-detail__math-value multi-race-detail__math-value--total">
            ${ticket.totalCost}
          </span>
        </div>
      </div>

      {/* Potential payouts */}
      <h4 className="multi-race-detail__section-header">POTENTIAL PAYOUT:</h4>
      <div className="multi-race-detail__payouts">
        <div className="multi-race-detail__payout-scenarios">
          {payoutScenarios.map((scenario, idx) => (
            <div key={idx} className="multi-race-detail__payout-row">
              <span className="multi-race-detail__payout-icon">{scenario.icon}</span>
              <span className="multi-race-detail__payout-scenario">{scenario.scenario}</span>
              <span className={`multi-race-detail__payout-value ${idx === payoutScenarios.length - 1 ? 'multi-race-detail__payout-value--highlight' : ''}`}>
                {scenario.estimate}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* What to say */}
      <h4 className="multi-race-detail__section-header">WHAT TO SAY AT THE WINDOW:</h4>
      <div className="multi-race-detail__script">
        <div className="multi-race-detail__script-box">
          <pre className="multi-race-detail__script-text">{ticket.whatToSay}</pre>
          <button
            className={`multi-race-detail__copy-btn ${copied ? 'multi-race-detail__copy-btn--copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '✓ COPIED' : '📋 COPY'}
          </button>
        </div>
      </div>

      {/* Help links */}
      <div className="multi-race-detail__help-links">
        <button
          className="multi-race-detail__help-link"
          onClick={() => setHelpTopic(getHelpTopic())}
        >
          <span>❓</span>
          <span>WHAT'S A {config.name.toUpperCase()}?</span>
          <span style={{ marginLeft: 'auto' }}>[tap to learn]</span>
        </button>
        <button
          className="multi-race-detail__help-link"
          onClick={() => setHelpTopic('what-is-single')}
        >
          <span>❓</span>
          <span>WHAT DOES "SINGLE" MEAN?</span>
          <span style={{ marginLeft: 'auto' }}>[tap to learn]</span>
        </button>
      </div>

      {/* Actions */}
      <div className="multi-race-detail__actions">
        <div className="multi-race-detail__cost">
          <span className="multi-race-detail__cost-label">COST</span>
          <span className="multi-race-detail__cost-value">${ticket.totalCost}</span>
        </div>
        <div className="multi-race-detail__action-btns">
          <button className="multi-race-detail__edit-btn" onClick={onEdit}>
            EDIT TICKET
          </button>
          <button className="multi-race-detail__add-btn" onClick={() => onAddToBets(ticket)}>
            ADD TO BETS
          </button>
        </div>
      </div>

      {/* Help modal */}
      {helpTopic && (
        <MultiRaceExplanations
          topic={helpTopic}
          onClose={() => setHelpTopic(null)}
        />
      )}
    </div>
  );
};

export default MultiRaceBetDetail;
