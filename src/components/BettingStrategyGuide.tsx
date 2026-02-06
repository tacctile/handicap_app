/**
 * BettingStrategyGuide Component
 *
 * A comprehensive guide to betting strategies for horse racing.
 * Provides actionable advice on bet types, field size strategy,
 * value plays, and bankroll management.
 *
 * Matches the structure and styling of ScoringHelpModal.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './shared/Icon';

interface BettingStrategyGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BettingStrategyGuide({ isOpen, onClose }: BettingStrategyGuideProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sections = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'field-size', label: 'Field Size', icon: 'groups' },
    { id: 'bet-types', label: 'Bet Types', icon: 'casino' },
    { id: 'value-plays', label: 'Value Plays', icon: 'trending_up' },
    { id: 'bankroll', label: 'Bankroll', icon: 'account_balance_wallet' },
    { id: 'quick-reference', label: 'Quick Reference', icon: 'bolt' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="scoring-help-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="scoring-help-modal-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              ref={modalRef}
              className="scoring-help-modal"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              tabIndex={-1}
            >
              {/* Header */}
              <div className="scoring-help-header">
                <div className="scoring-help-title-group">
                  <Icon name="casino" className="scoring-help-icon" />
                  <h2 className="scoring-help-title">Betting Strategy Guide</h2>
                </div>
                <button className="scoring-help-close" onClick={onClose} aria-label="Close guide">
                  <Icon name="close" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="scoring-help-tabs">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    className={`scoring-help-tab ${activeSection === section.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon name={section.icon} className="scoring-help-tab-icon" />
                    <span>{section.label}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="scoring-help-content">
                {activeSection === 'overview' && <OverviewSection />}
                {activeSection === 'field-size' && <FieldSizeSection />}
                {activeSection === 'bet-types' && <BetTypesSection />}
                {activeSection === 'value-plays' && <ValuePlaysSection />}
                {activeSection === 'bankroll' && <BankrollSection />}
                {activeSection === 'quick-reference' && <QuickReferenceSection />}
              </div>

              {/* Footer */}
              <div className="scoring-help-footer">
                <button className="scoring-help-close-btn" onClick={onClose}>
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Overview Section
function OverviewSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="lightbulb" className="help-section-icon" />
        Welcome to the Strategy Guide
      </h3>
      <p className="help-text">
        This guide will help you make smarter betting decisions based on field size, confidence
        level, and bet type. We&apos;ve analyzed thousands of races to find what works.
      </p>

      <div className="help-card">
        <h4 className="help-card-title">What You&apos;ll Learn</h4>
        <ul className="help-list">
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>How field size affects your bet type choices</span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>When to use exotic bets vs. straight bets</span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>How to spot and capitalize on value plays</span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>Practical bankroll management strategies</span>
          </li>
        </ul>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Quick Tip:</strong> The number of horses in a race dramatically changes which bets
          are worth making. Smaller fields favor exotic bets. Larger fields favor straight bets.
        </p>
      </div>
    </div>
  );
}

// Field Size Section
function FieldSizeSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="groups" className="help-section-icon" />
        Field Size Strategy
      </h3>
      <p className="help-text">
        The number of horses in a race is one of the most important factors in choosing your bet
        type. Here&apos;s how to adjust your approach:
      </p>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_4" className="help-category-icon" />
            <span className="help-category-name">Small Fields (4-6 horses)</span>
            <span className="help-category-max">Best for Exotics</span>
          </div>
          <p className="help-category-desc">
            Fewer horses means easier predictions. This is your best opportunity for exotic bets
            like Exactas, Trifectas, and Superfectas. Boxing the top 3-4 horses becomes affordable
            and often profitable.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_one" className="help-category-icon" />
            <span className="help-category-name">Medium Fields (7-9 horses)</span>
            <span className="help-category-max">Balanced Approach</span>
          </div>
          <p className="help-category-desc">
            A balanced strategy works best here. Consider Win/Place bets on strong contenders, and
            Exacta boxes with your top 3 picks. Trifectas are still viable but require more
            selective boxing.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="filter_9_plus" className="help-category-icon" />
            <span className="help-category-name">Large Fields (10+ horses)</span>
            <span className="help-category-max">Stick to Straight Bets</span>
          </div>
          <p className="help-category-desc">
            More horses means more chaos. Exotic bets become expensive and unpredictable. Focus on
            Win, Place, and Show bets. If you must play exotics, key your top pick rather than
            boxing multiple horses.
          </p>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Why This Matters:</strong> Boxing 4 horses in a Superfecta costs $24 in a 5-horse
          field but hits more often. In a 12-horse field, the same box rarely connects - save your
          money for Win/Place bets instead.
        </p>
      </div>
    </div>
  );
}

// Bet Types Section
function BetTypesSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="casino" className="help-section-icon" />
        Bet Types Explained
      </h3>
      <p className="help-text">
        Understanding each bet type helps you choose the right one for the situation. Here&apos;s
        when to use each:
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">WIN</dt>
          <dd className="help-desc">
            Your horse must finish first. Use when you have a strong conviction about a single
            horse. Best for horses with a significant edge over the field. Higher risk, higher
            reward.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">PLACE</dt>
          <dd className="help-desc">
            Your horse must finish first or second. A safety net that provides a higher hit rate
            than Win bets. Use when your top pick faces one tough competitor. Payout is lower but
            more consistent.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">SHOW</dt>
          <dd className="help-desc">
            Your horse must finish in the top three. The most consistent bet type with the lowest
            payout. Use for bankroll building or when you like a horse but the field is competitive.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">EXACTA</dt>
          <dd className="help-desc">
            Pick the first and second place finishers in exact order. <strong>Always box</strong>{' '}
            your Exactas unless you have extreme confidence in the order. A 2-horse box costs $4 for
            a $2 bet and covers both orders.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">TRIFECTA</dt>
          <dd className="help-desc">
            Pick the first, second, and third place finishers in exact order. Box 3 horses ($12) or
            Box 4 horses ($48) for best results. Straight Trifectas rarely hit - always box or use
            key bets.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">SUPERFECTA</dt>
          <dd className="help-desc">
            Pick the top four finishers in exact order. Only play in small fields (4-6 horses) where
            it&apos;s manageable. Box 4 horses ($24) or Box 5 horses ($120). Skip entirely in fields
            of 10+ horses.
          </dd>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Key Insight:</strong> Straight exotic bets (exact order) rarely hit. Always box
          your exotics to cover all order combinations. The slightly higher cost is worth the
          dramatically higher hit rate.
        </p>
      </div>
    </div>
  );
}

// Value Plays Section
function ValuePlaysSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="trending_up" className="help-section-icon" />
        Spotting Value Plays
      </h3>
      <p className="help-text">
        Value betting is the key to long-term profitability. It&apos;s not about picking winners -
        it&apos;s about finding horses whose odds are better than they should be.
      </p>

      <div className="help-card">
        <h4 className="help-card-title">Value Badge Meanings</h4>
        <ul className="help-list">
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>OVERLAY</strong> — The odds are higher than our model suggests. This horse is
              underbet by the public. These are your best betting opportunities.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>BETTER THAN ODDS</strong> — Our model ranks this horse higher than the public
              odds suggest. Worth a closer look.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>FALSE FAVORITE</strong> — The public favorite is overbet relative to their
              actual chances. Consider betting against them or looking elsewhere.
            </span>
          </li>
        </ul>
      </div>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">How to Spot Value</dt>
          <dd className="help-desc">
            Compare the FAIR odds (our calculated fair price) to the actual ODDS. When actual odds
            are higher than fair odds, you&apos;re getting value. A positive EDGE % means the horse
            is an overlay.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">When to Bet Against the Favorite</dt>
          <dd className="help-desc">
            If our model shows the favorite as a FALSE FAVORITE (overbet), consider betting on our
            higher-ranked horses instead. Sometimes the second or third choice offers far better
            value than the chalk.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">The #2 Ranked Horse</dt>
          <dd className="help-desc">
            Our second-ranked horse often provides better value than the top pick. The public tends
            to over-bet clear leaders, creating overlays on the second choice. Don&apos;t overlook
            these opportunities.
          </dd>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Key Insight:</strong> Long-term profit comes from consistently betting overlays,
          not from picking the most winners. A horse at 5-1 who should be 3-1 is a poor value, even
          if they win.
        </p>
      </div>
    </div>
  );
}

// Bankroll Section
function BankrollSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="account_balance_wallet" className="help-section-icon" />
        Bankroll Management
      </h3>
      <p className="help-text">
        Proper bankroll management is what separates recreational bettors from serious handicappers.
        These strategies help you survive the inevitable losing streaks and maximize winning runs.
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">Set a Dedicated Bankroll</dt>
          <dd className="help-desc">
            Only bet money you can afford to lose completely. Your betting bankroll should be
            separate from your living expenses. Never chase losses with money you need for other
            things.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Flat Betting vs. Scaling</dt>
          <dd className="help-desc">
            <strong>Flat betting</strong> means wagering the same amount on every bet. This is the
            safest approach for most bettors. <strong>Scaling</strong> means betting more on higher
            confidence plays. Only scale if you&apos;re disciplined and have a proven edge.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Don&apos;t Chase Losses</dt>
          <dd className="help-desc">
            After a loss, resist the urge to bet bigger to &quot;get it back.&quot; This is how
            bankrolls get destroyed. Stick to your unit size regardless of recent results. Tomorrow
            is a new day.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Session and Loss Limits</dt>
          <dd className="help-desc">
            Set a maximum loss limit per day or session. If you hit it, stop betting. A common rule
            is to quit after losing three units in a session. Protecting your bankroll ensures
            you&apos;ll be able to bet tomorrow.
          </dd>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Suggested Allocation</h4>
        <ul className="help-list">
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>70% on WPS (Win/Place/Show)</strong> — Your bread and butter. Consistent,
              lower variance bets that build your bankroll.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>30% on Exotics</strong> — Your swing-for-the-fences money. Higher risk, higher
              reward. Only in favorable field sizes.
            </span>
          </li>
        </ul>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Key Insight:</strong> The goal isn&apos;t to win every bet - it&apos;s to be
          profitable over time. Even the best handicappers lose more bets than they win. Managing
          your money ensures you&apos;re still in the game when your edge pays off.
        </p>
      </div>
    </div>
  );
}

// Quick Reference Section
function QuickReferenceSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="bolt" className="help-section-icon" />
        Quick Reference Cheat Sheet
      </h3>
      <p className="help-text">
        Use this quick reference before placing bets. It summarizes the key strategies based on
        field size and confidence level.
      </p>

      <div className="help-card">
        <h4 className="help-card-title">Field Size → Best Bet Types</h4>
        <div
          className="guide-content-table-wrapper"
          style={{ margin: '12px 0', overflowX: 'auto' }}
        >
          <table className="guide-content-table">
            <thead>
              <tr>
                <th>Field Size</th>
                <th>Recommended Bets</th>
                <th>Avoid</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>4-6 horses</td>
                <td>Exacta Box, Trifecta Box, Superfecta Box</td>
                <td>Straight bets (low payouts)</td>
              </tr>
              <tr>
                <td>7-9 horses</td>
                <td>Win/Place, Exacta Box, Trifecta Key</td>
                <td>Large Superfecta boxes</td>
              </tr>
              <tr>
                <td>10+ horses</td>
                <td>Win, Place, Show</td>
                <td>All exotic bets</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Confidence Level → Suggested Approach</h4>
        <div
          className="guide-content-table-wrapper"
          style={{ margin: '12px 0', overflowX: 'auto' }}
        >
          <table className="guide-content-table">
            <thead>
              <tr>
                <th>Confidence</th>
                <th>What It Means</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>High</td>
                <td>Clear top contender, strong edge</td>
                <td>Bet Win, key in exotics</td>
              </tr>
              <tr>
                <td>Medium</td>
                <td>Multiple contenders, competitive</td>
                <td>Bet Place/Show, box exotics</td>
              </tr>
              <tr>
                <td>Low</td>
                <td>Wide-open race, uncertain</td>
                <td>Pass or small Show bet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">What to Avoid</h4>
        <ul className="help-list">
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Straight exotic bets (non-boxed) - hit rate is too low</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Superfectas in fields of 10+ horses - too many combinations</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Chasing losses with bigger bets - stick to your unit size</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Betting every race - pass on low confidence situations</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Ignoring value for favorites - always check the EDGE %</span>
          </li>
        </ul>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Remember:</strong> The best bet is sometimes no bet at all. Passing on weak races
          protects your bankroll for opportunities where you have a real edge.
        </p>
      </div>
    </div>
  );
}

export default BettingStrategyGuide;
