/**
 * Value Tooltip Component
 *
 * Provides educational tooltips for key value betting terms.
 * Uses a 500ms delay to avoid annoying expert users.
 */

import React, { useState, useRef, useCallback } from 'react';
import './ValueTooltip.css';

// Tooltip content for each term
const TOOLTIP_CONTENT: Record<string, { title: string; content: string }> = {
  EDGE: {
    title: 'Edge (Value Edge)',
    content:
      'Edge is the difference between what our model thinks and what the public thinks. A +100% edge means our model sees this horse as twice as likely to hit the board as the public odds suggest. Positive edge = value bet.',
  },
  MORNING_LINE: {
    title: 'Morning Line Odds',
    content:
      "The morning line is the track handicapper's estimate of how the betting will go. It's set before betting opens. Compare it to our Fair Odds to find value.",
  },
  FAIR_ODDS: {
    title: 'Fair Odds',
    content:
      "Fair Odds are what we think this horse's odds SHOULD be based on our analysis. If Fair Odds are lower than the current odds, that's an overlay (value bet).",
  },
  OVERLAY: {
    title: 'Overlay',
    content:
      "An overlay means the public is offering better odds than the horse deserves. Example: Our model says 5-1, public says 15-1 — that's value. Bet these.",
  },
  UNDERLAY: {
    title: 'Underlay',
    content:
      'An underlay means the horse is over-bet by the public. Example: Our model says 8-1, public says 3-1 — no value. Skip these.',
  },
  VERDICT: {
    title: 'Race Verdict',
    content:
      'Our race verdict tells you if this race has a value betting opportunity. BET = clear value exists. CAUTION = marginal value, smaller bet. PASS = no value, skip it.',
  },
  PLACE: {
    title: 'PLACE Bet',
    content:
      'A PLACE bet wins if your horse finishes 1st or 2nd. Lower payout than WIN, but higher hit rate. Best for value plays ranked #2-3 in our model.',
  },
  SHOW: {
    title: 'SHOW Bet',
    content:
      'A SHOW bet wins if your horse finishes 1st, 2nd, or 3rd. Lowest payout, but safest. Best for value plays ranked #3-4 in our model.',
  },
  WIN: {
    title: 'WIN Bet',
    content:
      'A WIN bet only pays if your horse finishes 1st. Highest payout, but most risky. Best for value plays ranked #1-2 with 100%+ edge.',
  },
  VALUE_PLAY: {
    title: 'Value Play',
    content:
      "A value play is a horse the public undervalues. Our model ranks them as a contender (Top 4), but the odds are 6-1 or higher. That's where smart money goes.",
  },
  MODEL_RANK: {
    title: 'Model Rank',
    content:
      'Our model ranks horses 1-N based on 25+ factors: speed, class, form, pace, connections, and more. Rank #1 = highest probability of winning according to our analysis.',
  },
  TRIFECTA_KEY: {
    title: 'Trifecta Key',
    content:
      "A trifecta key bet uses one horse as the 'key' that must finish in a specific position (1st, 2nd, or 3rd), while other horses fill the remaining spots. Great for value plays at big odds.",
  },
};

interface ValueTooltipProps {
  /** The term to explain (e.g., "EDGE", "OVERLAY") */
  term: keyof typeof TOOLTIP_CONTENT;
  /** Optional className for styling */
  className?: string;
  /** Whether to show the icon only (no text) */
  iconOnly?: boolean;
}

export const ValueTooltip: React.FC<ValueTooltipProps> = ({
  term,
  className = '',
  iconOnly = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const showTooltip = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 500ms delay before showing
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX + rect.width / 2,
        });
      }
      setIsVisible(true);
    }, 500);
  }, []);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  const tooltipData = TOOLTIP_CONTENT[term];
  if (!tooltipData) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`value-tooltip-trigger ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-label={`Learn about ${tooltipData.title}`}
        aria-describedby={isVisible ? `tooltip-${term}` : undefined}
      >
        <span className="material-icons value-tooltip-icon">help_outline</span>
        {!iconOnly && <span className="value-tooltip-text">{term}</span>}
      </button>

      {isVisible && (
        <div
          id={`tooltip-${term}`}
          className="value-tooltip"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
          role="tooltip"
        >
          <div className="value-tooltip__title">{tooltipData.title}</div>
          <div className="value-tooltip__content">{tooltipData.content}</div>
        </div>
      )}
    </>
  );
};

/**
 * Inline tooltip that appears next to text (for column headers)
 */
interface InlineTooltipProps {
  /** The term to explain */
  term: keyof typeof TOOLTIP_CONTENT;
  /** Custom content to override the default */
  customContent?: string;
  /** Custom title to override the default */
  customTitle?: string;
}

export const InlineValueTooltip: React.FC<InlineTooltipProps> = ({
  term,
  customContent,
  customTitle,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const defaultData = TOOLTIP_CONTENT[term] || { title: term, content: '' };
  const title = customTitle || defaultData.title;
  const content = customContent || defaultData.content;

  const showTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 500);
  }, []);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  return (
    <span className="inline-tooltip-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="inline-tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-label={`Learn about ${title}`}
      >
        <span className="material-icons inline-tooltip-icon">help_outline</span>
      </button>

      {isVisible && (
        <div className="inline-tooltip" role="tooltip">
          <div className="inline-tooltip__title">{title}</div>
          <div className="inline-tooltip__content">{content}</div>
        </div>
      )}
    </span>
  );
};

export default ValueTooltip;
