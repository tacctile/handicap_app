/**
 * MultiRaceExplanations Component
 *
 * Modal dialog explaining multi-race betting concepts.
 * Provides educational content for different topics.
 */

import React from 'react';
import './MultiRace.css';

type ExplanationTopic =
  | 'what-are-multi-race-bets'
  | 'what-is-single'
  | 'what-is-spread'
  | 'pick-4-explained'
  | 'pick-3-explained'
  | 'daily-double-explained';

interface MultiRaceExplanationsProps {
  /** Topic to explain */
  topic: ExplanationTopic;
  /** Callback to close the modal */
  onClose: () => void;
}

const EXPLANATIONS: Record<ExplanationTopic, { title: string; icon: string; content: React.ReactNode }> = {
  'what-are-multi-race-bets': {
    title: 'What Are Multi-Race Bets?',
    icon: '🎯',
    content: (
      <>
        <p>
          <strong>Multi-race bets</strong> let you pick winners across multiple consecutive races
          on a single ticket. If all your picks win, you cash a big payout.
        </p>
        <p>
          <strong>Common types:</strong>
        </p>
        <p>
          • <strong>Daily Double:</strong> Pick winners of 2 races<br />
          • <strong>Pick 3:</strong> Pick winners of 3 races<br />
          • <strong>Pick 4:</strong> Pick winners of 4 races<br />
          • <strong>Pick 5/6:</strong> Pick winners of 5 or 6 races
        </p>
        <p>
          <strong>Why bet multi-race?</strong> The payouts can be HUGE — a Pick 4 with a couple
          longshots can pay $5,000+ on a $1 bet. That's why expert bettors love them.
        </p>
        <p>
          <strong>The catch:</strong> You need ALL your picks to win. That's hard!
          We help by identifying the best opportunities and building smart tickets.
        </p>
      </>
    ),
  },
  'what-is-single': {
    title: 'What Does "Single" Mean?',
    icon: '1️⃣',
    content: (
      <>
        <p>
          <strong>"Single"</strong> means using only <strong>ONE horse</strong> in that leg of the ticket.
        </p>
        <p>
          We single a horse when we're very confident they'll win — like a strong value play
          with a big edge over the odds.
        </p>
        <p>
          <strong>Benefits:</strong>
        </p>
        <p>
          • Keeps your ticket cost low<br />
          • Maximizes payout if you're right
        </p>
        <p>
          <strong>Risk:</strong> If that horse loses, your whole ticket is dead.
          That's why we only single when we have high confidence.
        </p>
      </>
    ),
  },
  'what-is-spread': {
    title: 'What Does "Spread" Mean?',
    icon: '📊',
    content: (
      <>
        <p>
          <strong>"Spread"</strong> means using <strong>MULTIPLE horses</strong> in that leg.
        </p>
        <p>
          We spread when a race is competitive and we're not confident in just one horse.
          Using 3 horses means if ANY of them wins, that leg is alive.
        </p>
        <p>
          <strong>Trade-off:</strong>
        </p>
        <p>
          • More horses = more combinations = higher cost<br />
          • But also more chances to cash!
        </p>
        <p>
          <strong>Example:</strong> A Pick 4 with legs of 1-2-3-4 horses = 1×2×3×4 = 24 combinations.
          At $1 each, that's a $24 ticket.
        </p>
      </>
    ),
  },
  'pick-4-explained': {
    title: "What's a Pick 4?",
    icon: '4️⃣',
    content: (
      <>
        <p>
          A <strong>Pick 4</strong> is betting on the winners of <strong>4 consecutive races</strong>.
        </p>
        <p>
          You pick who you think will win Race 1, Race 2, Race 3, and Race 4.
          If all 4 of your picks win, you cash the ticket.
        </p>
        <p>
          <strong>Typical payouts:</strong>
        </p>
        <p>
          • All favorites win: $100-300<br />
          • One longshot hits: $500-2,000<br />
          • Two longshots hit: $2,000-10,000+
        </p>
        <p>
          It's hard to hit, but the payouts can be HUGE. That's why we "spread" some legs
          (use multiple horses) to increase our chances.
        </p>
      </>
    ),
  },
  'pick-3-explained': {
    title: "What's a Pick 3?",
    icon: '3️⃣',
    content: (
      <>
        <p>
          A <strong>Pick 3</strong> is betting on the winners of <strong>3 consecutive races</strong>.
        </p>
        <p>
          Easier to hit than a Pick 4, but with smaller payouts. Great for building confidence
          with multi-race bets.
        </p>
        <p>
          <strong>Typical payouts:</strong>
        </p>
        <p>
          • All favorites win: $50-150<br />
          • One longshot hits: $200-800<br />
          • Two longshots hit: $1,000-5,000
        </p>
        <p>
          Pick 3s are usually available every race — you can bet the Pick 3 starting with
          Race 1, Race 2, Race 3, etc.
        </p>
      </>
    ),
  },
  'daily-double-explained': {
    title: "What's a Daily Double?",
    icon: '2️⃣',
    content: (
      <>
        <p>
          A <strong>Daily Double</strong> is the simplest multi-race bet — pick the winners of
          <strong> 2 consecutive races</strong>.
        </p>
        <p>
          It's called "Daily Double" because tracks traditionally offered one in the early races
          and one in the late races each day.
        </p>
        <p>
          <strong>Typical payouts:</strong>
        </p>
        <p>
          • Both favorites win: $20-50<br />
          • One longshot hits: $60-250<br />
          • Both longshots hit: $300-1,000+
        </p>
        <p>
          Daily Doubles are great for beginners learning multi-race bets because they're
          simpler and cheaper to play.
        </p>
      </>
    ),
  },
};

export const MultiRaceExplanations: React.FC<MultiRaceExplanationsProps> = ({
  topic,
  onClose,
}) => {
  const explanation = EXPLANATIONS[topic];

  if (!explanation) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="explanation-modal__overlay" onClick={handleOverlayClick}>
      <div className="explanation-modal">
        <div className="explanation-modal__header">
          <span className="explanation-modal__icon">{explanation.icon}</span>
          <h3 className="explanation-modal__title">{explanation.title}</h3>
        </div>

        <div className="explanation-modal__content">
          {explanation.content}
        </div>

        <button className="explanation-modal__close-btn" onClick={onClose}>
          Got It
        </button>
      </div>
    </div>
  );
};

export default MultiRaceExplanations;
