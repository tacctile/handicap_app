/**
 * BettingStrategyGuide Component
 *
 * A comprehensive guide to betting strategies for horse racing.
 * Covers all 19 bet type variants shown on the Top Bets screen,
 * explains Kelly sizing and softmax probabilities, and provides
 * bankroll management guidance for first-time bettors.
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
  const [activeSection, setActiveSection] = useState<string>('how-to-use');
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
    { id: 'how-to-use', label: 'How to Use Top Bets' },
    { id: 'straight-bets', label: 'Straight Bets' },
    { id: 'exacta', label: 'Exacta' },
    { id: 'trifecta', label: 'Trifecta' },
    { id: 'superfecta', label: 'Superfecta' },
    { id: 'bankroll', label: 'Bankroll & Sizing' },
    { id: 'quick-reference', label: 'Quick Reference' },
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
                    {section.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="scoring-help-content">
                {activeSection === 'how-to-use' && <HowToUseSection />}
                {activeSection === 'straight-bets' && <StraightBetsSection />}
                {activeSection === 'exacta' && <ExactaSection />}
                {activeSection === 'trifecta' && <TrifectaSection />}
                {activeSection === 'superfecta' && <SuperfectaSection />}
                {activeSection === 'bankroll' && <BankrollSizingSection />}
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

// ============================================================================
// TAB 1: How to Use Top Bets
// ============================================================================

function HowToUseSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="lightbulb" className="help-section-icon" />
        How to Use Top Bets
      </h3>

      <div className="help-card">
        <h4 className="help-card-title">What Top Bets Shows You</h4>
        <p className="help-text">
          The Top Bets screen does the math for you. Based on today&apos;s race, it picks the best
          bets across six categories &mdash; Win, Place, Show, Exacta, Trifecta, and Superfecta
          &mdash; and shows you exactly what to say at the betting window.
        </p>
      </div>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">BASE AMOUNT ($1 / $2 / $5 / $10 / Custom)</dt>
          <dd className="help-desc">
            This scales every bet up or down. At $1 base, a 3-horse Exacta box costs $6. At $5 base,
            that same box costs $30. Start at $1 to learn, scale up when you&apos;re comfortable.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">BANKROLL Button</dt>
          <dd className="help-desc">
            Enter your total budget for the day here. The system uses this to calculate Kelly sizing
            &mdash; how much to bet on each race based on your edge and remaining budget.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">VALUE ONLY Toggle</dt>
          <dd className="help-desc">
            When turned on, only shows bets that include the horse our algorithm identified as
            undervalued by the public. Filters out bets that don&apos;t include your value play.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">
            SORT Options (Confidence / EV / Biggest Payout / Price Low / Price High)
          </dt>
          <dd className="help-desc">
            Confidence = most likely to cash based on our model. EV = best expected mathematical
            return. Biggest Payout = most money if it hits. Price Low→High = cheapest bets first.
            Price High→Low = most expensive bets first. Recommendation for beginners: sort by
            Confidence.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">COLUMN DROPDOWNS (Straight / Box / Wheel / Key)</dt>
          <dd className="help-desc">
            Each exotic bet column (Exacta, Trifecta, Superfecta) has a dropdown to switch between
            bet variants. See the Exacta, Trifecta, and Superfecta tabs for what each variant means.
          </dd>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">What Each Element on a Top Bets Card Means</h4>
        <ul className="help-list">
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>BEST badge</strong> &mdash; The top-ranked bet in that column. If you only
              make one bet of this type, make this one.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>&#9670; Value diamond</strong> &mdash; This bet includes the horse our
              algorithm flagged as undervalued. Extra signal that this is a good play.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>Horse numbers</strong> &mdash; The program numbers of the horses in this bet.
              Click/tap to see their names.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>COST</strong> &mdash; What this bet costs at your current base amount.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>KELLY</strong> &mdash; How much our model mathematically suggests betting
              based on your edge and bankroll. See the Bankroll tab for explanation.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>CONFIDENCE %</strong> &mdash; How confident our model is that this bet will
              cash. 70%+ is strong.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>&#10003; Softmax</strong> &mdash; This confidence percentage has been
              calibrated so all horses&apos; win chances add up to 100%. A more realistic
              probability than a raw model score.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>Window script</strong> &mdash; The exact words to say at the betting window.
              Read it out loud &mdash; the teller will know what to do.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>? icon</strong> &mdash; Tap for a one-sentence explanation of why this
              specific bet was recommended.
            </span>
          </li>
        </ul>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Quick Tip:</strong> Always check the window script before stepping up to the
          window. It tells the teller exactly what you want &mdash; race number, bet type, horses,
          and amount.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 2: Straight Bets
// ============================================================================

function StraightBetsSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="emoji_events" className="help-section-icon" />
        Straight Bets: Win, Place &amp; Show
      </h3>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_one" className="help-category-icon" />
            <span className="help-category-name">WIN</span>
            <span className="help-category-max">Highest Payout</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Your horse must finish first. Highest payout of the three.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you&apos;re very confident in one horse AND the odds
            are giving you value (check the EDGE % &mdash; positive is good).
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> You bet $5 Win on the #3 horse at 6-1 odds. It wins. You
            collect $35 ($30 profit + your $5 back).
          </p>
          <p className="help-category-desc">
            <strong>Beginner tip:</strong> Win bets are the simplest bet in racing. If you only make
            one bet all day, make it a Win on your top pick.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_two" className="help-category-icon" />
            <span className="help-category-name">PLACE</span>
            <span className="help-category-max">Two Chances</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Your horse must finish first OR second. Pays less than Win but
            you have two chances to cash.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you like a horse but the race looks competitive. A
            safety net on your top pick.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> Your horse finishes 2nd. You still collect &mdash; just less
            than if it won.
          </p>
          <p className="help-category-desc">
            <strong>Beginner tip:</strong> Place bets are great when you believe in a horse but
            aren&apos;t certain about the exact outcome.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_3" className="help-category-icon" />
            <span className="help-category-name">SHOW</span>
            <span className="help-category-max">Safest Bet</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Your horse must finish first, second, OR third. Lowest payout but
            three chances to cash.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> On a horse you trust with a large field where finishing
            top 3 is realistic. Also useful when including a longshot in an exotic and wanting
            insurance.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> 10-horse field, your horse finishes 3rd. Show bet cashes. Win
            and Place bets don&apos;t.
          </p>
          <p className="help-category-desc">
            <strong>Beginner tip:</strong> Show bets pay the least but are the safest. Don&apos;t
            expect to make money long-term on Show alone &mdash; use them to build confidence or as
            insurance.
          </p>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Understanding the KELLY Amount on WPS Cards</h4>
        <p className="help-text">
          Kelly is a formula that says: bet more when your edge is bigger, bet less when your edge
          is smaller. If Kelly shows $12, that&apos;s the mathematically optimal amount given your
          bankroll and edge. You don&apos;t have to follow it exactly &mdash; it&apos;s a guide, not
          a rule. Beginners: ignore Kelly until you&apos;re comfortable with the basics.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Understanding the &#10003; Softmax Indicator</h4>
        <p className="help-text">
          When you see a checkmark next to a confidence percentage, it means the probability has
          been adjusted so all horses in the race add up to 100%. This is more accurate than raw
          model scores. Treat it like a real probability &mdash; 65% softmax confidence means
          roughly 2-in-3 chance of cashing.
        </p>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Quick Tip:</strong> The Top Bets screen shows you the window script &mdash; the
          exact words to say at the window. For a Win bet on horse #4 at $10: &quot;Race 3, $10 Win,
          number 4.&quot; That&apos;s all you need.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 3: Exacta
// ============================================================================

function ExactaSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="casino" className="help-section-icon" />
        Exacta Bets
      </h3>
      <p className="help-text">
        An Exacta means picking the horse that finishes FIRST and the horse that finishes SECOND
        &mdash; in the exact order. It pays much more than a straight bet because it&apos;s harder.
        The Top Bets screen shows three ways to play an Exacta.
      </p>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_one" className="help-category-icon" />
            <span className="help-category-name">EXACTA STRAIGHT</span>
            <span className="help-category-max">Cheapest / Hardest</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> You pick exactly which horse finishes 1st and exactly which
            finishes 2nd. Cheapest option. Hardest to hit.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Straight Exacta = $1.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you&apos;re very confident about the top two horses
            AND their order. Low cost, high reward.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> &quot;$2 Exacta, 3 over 5&quot; = horse #3 wins, horse #5
            finishes second. That specific order only.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 4, $2 Exacta, 3 over 5.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_two" className="help-category-icon" />
            <span className="help-category-name">EXACTA BOX</span>
            <span className="help-category-max">Most Popular</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> You pick 2, 3, 4, or more horses and cover every possible order
            they could finish in the top 2. More coverage, more cost.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Box of 2 horses = $2. Box of 3 horses = $6. Box of 4 horses =
            $12.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you like 2-4 horses but aren&apos;t sure of the
            order. The most popular Exacta play.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> &quot;$1 Exacta Box, 3-5-7&quot; = any two of horses 3, 5, or
            7 finishing 1st and 2nd in any order wins.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 4, $1 Exacta Box, 3, 5, 7.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_3" className="help-category-icon" />
            <span className="help-category-name">EXACTA WHEEL</span>
            <span className="help-category-max">One Horse + Field</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Pick one horse to finish first (your &quot;key&quot;) and cover
            ALL other horses for second place. Or vice versa &mdash; cover all horses for first and
            one key horse for second.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Wheel in a 7-horse field = $6 (covers 6 possible opponents for
            second).
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you&apos;re very confident one horse wins but unsure
            who finishes second. The wheel has you covered no matter who runs second.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> &quot;$1 Exacta Wheel, 3 with all&quot; = horse #3 wins,
            anyone else finishes second.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 4, $1 Exacta, 3 with all.&quot;
          </p>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Quick Tip:</strong> Box bets cost more but are more forgiving. Straight bets cost
          less but require you to nail the exact order. Start with boxes while you&apos;re learning.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 4: Trifecta
// ============================================================================

function TrifectaSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="casino" className="help-section-icon" />
        Trifecta Bets
      </h3>
      <p className="help-text">
        A Trifecta means picking the horses that finish 1st, 2nd, AND 3rd &mdash; in the exact
        order. Harder to hit than an Exacta but pays significantly more. Four ways to play it.
      </p>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_one" className="help-category-icon" />
            <span className="help-category-name">TRIFECTA STRAIGHT</span>
            <span className="help-category-max">Cheapest / Hardest</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Pick exactly which horse finishes 1st, exactly 2nd, and exactly
            3rd. Cheapest. Hardest to hit.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Straight = $1.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you have very high conviction on the top three horses
            AND their exact order. Rare situation.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 5, $1 Trifecta, 3-5-7.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_two" className="help-category-icon" />
            <span className="help-category-name">TRIFECTA BOX</span>
            <span className="help-category-max">Most Flexible</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Pick 3, 4, 5, or more horses and cover every possible order in
            the top 3. Most flexible, most expensive.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Box of 3 = $6. Box of 4 = $24. Box of 5 = $60. Box of 6 =
            $120.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you like 3-4 horses and want them covered in any
            order. Popular in smaller fields.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> &quot;$1 Trifecta Box, 2-4-7&quot; = any order of those three
            horses in the top 3 wins.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 5, $1 Trifecta Box, 2, 4, 7.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_3" className="help-category-icon" />
            <span className="help-category-name">TRIFECTA KEY</span>
            <span className="help-category-max">Best Balance</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Pick one horse to win (your key) and multiple horses to fill 2nd
            and 3rd in any order. Best balance of cost and coverage.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Key with 3 horses for 2nd/3rd = $6. With 4 horses = $12.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you&apos;re very confident about the winner but open
            on who fills the minor spots. The most efficient Trifecta play.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> &quot;$1 Trifecta Key, 3 with 5-7-9 for 2nd and 3rd&quot; =
            horse #3 wins, any two of 5, 7, 9 complete the trifecta.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 5, $1 Trifecta Key, 3 with 5, 7, 9.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_4" className="help-category-icon" />
            <span className="help-category-name">TRIFECTA WHEEL</span>
            <span className="help-category-max">Maximum Coverage</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Your key horse wins, and all other horses cover 2nd and 3rd.
            Maximum coverage on the minor spots.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Wheel in a 7-horse field = $30 (covers all combinations with 6
            remaining horses).
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> When you&apos;re certain about the winner but have no idea
            about 2nd and 3rd.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 5, $1 Trifecta, 3 with all with all.&quot;
          </p>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Cost Warning:</strong> Trifecta boxes get expensive fast. A $1 box of 4 horses
          costs $24. A $1 box of 5 costs $60. Use the Key bet instead of boxing too many horses
          &mdash; it&apos;s usually cheaper for the same winner.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 5: Superfecta
// ============================================================================

function SuperfectaSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="casino" className="help-section-icon" />
        Superfecta Bets
      </h3>
      <p className="help-text">
        A Superfecta means picking the horses that finish 1st, 2nd, 3rd, AND 4th &mdash; in exact
        order. The hardest bet to hit in racing and the biggest payout. Even a $0.10 Superfecta box
        can pay thousands of dollars. Four ways to play it.
      </p>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_one" className="help-category-icon" />
            <span className="help-category-name">SUPERFECTA STRAIGHT</span>
            <span className="help-category-max">Cheapest / Rarest</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Exact order of the top 4 finishers. Cheapest. Almost never used
            because it&apos;s so difficult.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Straight = $1.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> Only if you have an extraordinarily strong opinion on the
            exact top 4 order.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 6, $1 Superfecta, 2-4-6-8.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_two" className="help-category-icon" />
            <span className="help-category-name">SUPERFECTA BOX</span>
            <span className="help-category-max">Use $0.10 Minimum</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Pick 4, 5, or 6 horses and cover every order in the top 4. Very
            expensive but high coverage.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Box of 4 = $24. $0.10 Box of 4 = $2.40. Box of 5 = $120 ($12
            at $0.10). Box of 6 = $360 ($36 at $0.10).
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> Use the $0.10 minimum to keep cost manageable. Popular in
            large fields with longshots in the mix.
          </p>
          <p className="help-category-desc">
            <strong>Beginner tip:</strong> Always ask for $0.10 Superfecta boxes. Same coverage, 90%
            less cost.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 6, 10-cent Superfecta Box, 2, 4, 6, 8.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_3" className="help-category-icon" />
            <span className="help-category-name">SUPERFECTA KEY</span>
            <span className="help-category-max">Best Efficiency</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> One horse wins, multiple horses fill 2nd, 3rd, and 4th in any
            order. Best efficiency.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $1 Key with 4 horses for 2nd-4th = $24. At $0.10 = $2.40.
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> Strong conviction on the winner, open on the rest.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 6, 10-cent Superfecta Key, 2 with 4, 6, 8,
            10.&quot;
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="looks_4" className="help-category-icon" />
            <span className="help-category-name">SUPERFECTA WHEEL</span>
            <span className="help-category-max">Full Coverage</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Your key horse wins, all other horses cover 2nd, 3rd, and 4th.
          </p>
          <p className="help-category-desc">
            <strong>Cost:</strong> $0.10 Wheel in an 8-horse field = $21 (covers 7x6x5
            combinations).
          </p>
          <p className="help-category-desc">
            <strong>When to use:</strong> Very confident about the winner, no opinion on the rest.
            Best in large fields.
          </p>
          <p className="help-category-desc">
            <strong>Window script:</strong> &quot;Race 6, 10-cent Superfecta, 2 with all with all
            with all.&quot;
          </p>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Quick Tip:</strong> Superfectas are where small bets meet big payouts. A 10-cent
          box of 4 horses costs $2.40 and can pay $500+ in the right race. Always play them at the
          $0.10 minimum.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 6: Bankroll & Sizing
// ============================================================================

function BankrollSizingSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="account_balance_wallet" className="help-section-icon" />
        Bankroll &amp; Sizing
      </h3>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="savings" className="help-category-icon" />
            <span className="help-category-name">Set Your Budget First</span>
          </div>
          <p className="help-category-desc">
            Before you look at a single race, decide how much you&apos;re willing to spend for the
            day. This is your bankroll. Enter it in the Bankroll button on the Top Bets screen. Once
            it&apos;s gone, it&apos;s gone &mdash; do not reach back into your wallet.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="pie_chart" className="help-category-icon" />
            <span className="help-category-name">The 70/30 Rule</span>
          </div>
          <p className="help-category-desc">
            A simple starting framework: Put 70% of your daily budget toward straight bets (Win,
            Place, Show). Put 30% toward exotic bets (Exacta, Trifecta, Superfecta). Straight bets
            cash more often. Exotics pay more when they hit.
          </p>
          <p className="help-category-desc">
            <strong>Example:</strong> $100 day &rarr; $70 for WPS bets, $30 for exotics.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="compare_arrows" className="help-category-icon" />
            <span className="help-category-name">Flat Betting vs Kelly Sizing</span>
          </div>
          <p className="help-category-desc">
            <strong>Flat betting:</strong> Bet the same amount on every race regardless of
            confidence. Simple, disciplined, easy to track.
          </p>
          <p className="help-category-desc">
            <strong>Kelly sizing:</strong> Bet more when your edge is bigger, less when it&apos;s
            smaller. The Kelly amount shown on Top Bets cards is this calculation. It maximizes
            long-term growth mathematically but can feel aggressive.
          </p>
          <p className="help-category-desc">
            Start with flat betting and graduate to Kelly when you&apos;re comfortable.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="block" className="help-category-icon" />
            <span className="help-category-name">Don&apos;t Chase Losses</span>
          </div>
          <p className="help-category-desc">
            If you lose the first 3 races, do not increase your bet sizes to try to get even. This
            is the fastest way to blow your budget. Stick to your plan. Good spots will come.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="flag" className="help-category-icon" />
            <span className="help-category-name">Session Limits</span>
          </div>
          <p className="help-category-desc">
            Consider setting a &quot;stop win&quot; too &mdash; not just a loss limit. If
            you&apos;re up 150% of your starting bankroll, consider pocketing some winnings and
            reducing bet size. Winning sessions can turn bad fast in the last race.
          </p>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">What Is Kelly Sizing?</h4>
        <p className="help-text">
          Kelly is a mathematical formula: bet a percentage of your bankroll equal to your edge
          divided by the odds. In plain English: bet more when you have a bigger advantage, bet less
          when you have a smaller one.
        </p>
        <p className="help-text">
          If the Top Bets card shows KELLY: $14 and your bankroll is $100, the formula is suggesting
          you put $14 on that bet. You don&apos;t have to follow it exactly &mdash; but it&apos;s
          based on real math, not gut feel.
        </p>
        <p className="help-text">
          Think of it like: A poker player going all-in when they have the best hand and folding
          when they don&apos;t. Size your bets to match your actual advantage.
        </p>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Important:</strong> Never bet money you can&apos;t afford to lose. Horse racing is
          entertainment first. The algorithm gives you an edge &mdash; it does not guarantee wins.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TAB 7: Quick Reference
// ============================================================================

function QuickReferenceSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="bolt" className="help-section-icon" />
        Quick Reference
      </h3>

      <div className="help-card">
        <h4 className="help-card-title">Field Size Guide</h4>
        <div
          className="guide-content-table-wrapper"
          style={{ margin: '12px 0', overflowX: 'auto' }}
        >
          <table className="guide-content-table">
            <thead>
              <tr>
                <th>Field Size</th>
                <th>Best Bet Types</th>
                <th>Exotics Complexity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Small (4-6)</td>
                <td>Win, Exacta Box (2-3)</td>
                <td>Low &mdash; fewer combinations</td>
              </tr>
              <tr>
                <td>Medium (7-9)</td>
                <td>Win/Place, Exacta Box</td>
                <td>Medium &mdash; Trifecta Key</td>
              </tr>
              <tr>
                <td>Large (10+)</td>
                <td>Place/Show, Trifecta Key</td>
                <td>High &mdash; use $0.10 Superfecta</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Confidence Level Guide</h4>
        <div
          className="guide-content-table-wrapper"
          style={{ margin: '12px 0', overflowX: 'auto' }}
        >
          <table className="guide-content-table">
            <thead>
              <tr>
                <th>Confidence %</th>
                <th>Suggested Play</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>80%+</td>
                <td>Win bet. Consider Exacta Key with second pick.</td>
              </tr>
              <tr>
                <td>65-79%</td>
                <td>Win or Place. Exacta Box top 3 picks.</td>
              </tr>
              <tr>
                <td>50-64%</td>
                <td>Place or Show. Trifecta Key if strong top pick.</td>
              </tr>
              <tr>
                <td>Below 50%</td>
                <td>Exotic only or pass. Don&apos;t straight-bet low confidence.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Bet Cost Reference (at $1 base)</h4>
        <div
          className="guide-content-table-wrapper"
          style={{ margin: '12px 0', overflowX: 'auto' }}
        >
          <table className="guide-content-table">
            <thead>
              <tr>
                <th>Bet</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Win / Place / Show</td>
                <td>$2 each</td>
              </tr>
              <tr>
                <td>Exacta Straight</td>
                <td>$2</td>
              </tr>
              <tr>
                <td>Exacta Box (2 horses)</td>
                <td>$4</td>
              </tr>
              <tr>
                <td>Exacta Box (3 horses)</td>
                <td>$12</td>
              </tr>
              <tr>
                <td>Trifecta Straight</td>
                <td>$2</td>
              </tr>
              <tr>
                <td>Trifecta Box (3)</td>
                <td>$12</td>
              </tr>
              <tr>
                <td>Trifecta Box (4)</td>
                <td>$48</td>
              </tr>
              <tr>
                <td>Trifecta Key (3 fillers)</td>
                <td>$12</td>
              </tr>
              <tr>
                <td>Superfecta Box (4) $0.10</td>
                <td>$2.40</td>
              </tr>
              <tr>
                <td>Superfecta Box (5) $0.10</td>
                <td>$12.00</td>
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
            <span>Betting every race &mdash; be selective, pick your spots</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Boxing too many horses in Trifectas and Superfectas (cost explodes)</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Chasing losses by increasing bet sizes mid-session</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>Ignoring the EDGE % &mdash; positive edge is what separates value from hope</span>
          </li>
          <li>
            <Icon name="close" className="help-list-icon" style={{ color: '#ef4444' }} />
            <span>
              Betting on a horse just because you like its name or the jockey&apos;s colors
            </span>
          </li>
        </ul>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Remember:</strong> The window script on every Top Bets card tells you exactly what
          to say. Read it before you walk up. The teller does this all day &mdash; they just need
          the race, amount, type, and horse numbers.
        </p>
      </div>
    </div>
  );
}

export default BettingStrategyGuide;
