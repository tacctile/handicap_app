/**
 * ScoringHelpModal Component
 *
 * A comprehensive guide to understanding the Furlong handicapping display.
 * Organized as 7 tabs covering every section of the expanded horse view,
 * written for first-time horse bettors who have never read a Daily Racing Form.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './shared/Icon';

interface ScoringHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScoringHelpModal({ isOpen, onClose }: ScoringHelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('race-screen');
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
    { id: 'race-screen', label: 'The Race Screen' },
    { id: 'horse-score', label: 'Horse Score' },
    { id: 'factor-breakdown', label: 'Factor Breakdown' },
    { id: 'suggested-bets', label: 'Suggested Bets' },
    { id: 'past-performances', label: 'Past Performances' },
    { id: 'horse-profile', label: 'Horse Profile' },
    { id: 'glossary', label: 'Glossary' },
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
                  <Icon name="school" className="scoring-help-icon" />
                  <h2 className="scoring-help-title">How to Read the Form</h2>
                </div>
                <button className="scoring-help-close" onClick={onClose} aria-label="Close help">
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
                {activeSection === 'race-screen' && <RaceScreenSection />}
                {activeSection === 'horse-score' && <HorseScoreSection />}
                {activeSection === 'factor-breakdown' && <FactorBreakdownSection />}
                {activeSection === 'suggested-bets' && <SuggestedBetsSection />}
                {activeSection === 'past-performances' && <PastPerformancesSection />}
                {activeSection === 'horse-profile' && <HorseProfileSection />}
                {activeSection === 'glossary' && <GlossarySection />}
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
// Tab 1: The Race Screen
// ============================================================================
function RaceScreenSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="view_list" className="help-section-icon" />
        The Race Screen
      </h3>
      <p className="help-text">
        When you open a race, you see a list of horses. Each horse gets one row with key information
        at a glance. Here&apos;s what every column means, from left to right:
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">POST (Gate #)</dt>
          <dd className="help-desc">
            Which starting gate this horse leaves from. Lower numbers are on the inside rail.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">HORSE</dt>
          <dd className="help-desc">The horse&apos;s name and program number.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">ODDS</dt>
          <dd className="help-desc">
            What the track is currently paying if this horse wins. &quot;5-1&quot; means a $2 bet
            pays $10.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">SHOULD BE</dt>
          <dd className="help-desc">
            What our algorithm thinks the fair odds are based on the horse&apos;s score. If this is
            lower than ODDS, the horse may be underpriced by the public.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">OUR PICK</dt>
          <dd className="help-desc">
            Our algorithm&apos;s predicted finishing position for this horse. &quot;Picks 1st&quot;
            = we think this horse wins.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">RATING</dt>
          <dd className="help-desc">
            Our overall rating combining horse quality and betting value. Labels: TOP PICK / GREAT
            VALUE / IN THE MIX / TOSS UP.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">EDGE %</dt>
          <dd className="help-desc">
            The gap between what we think the horse is worth and what the public is paying. Positive
            = good value. Negative = overpriced.
          </dd>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Tip:</strong> Tap any horse row to expand it and see the full breakdown.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">The Race Banner Bar</h4>
        <ul className="help-list">
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>BETTABLE</strong> means our algorithm found enough value in this race to
              recommend betting on it.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>High Confidence</strong> means the data quality is strong and our analysis is
              reliable.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              <strong>&quot;Should be: X-1&quot;</strong> shows the fair odds for the top-ranked
              horse in the race.
            </span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>
              The <strong>top horse recommendation</strong> at the top of the race tells you which
              horse our algorithm likes best and why.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 2: Horse Score
// ============================================================================
function HorseScoreSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="analytics" className="help-section-icon" />
        Horse Score
      </h3>
      <p className="help-text">
        When you expand a horse, the first thing you see is the Furlong Score Analysis row. It has
        two zones: Horse Quality on the left and Betting Value on the right.
      </p>

      <div className="help-card">
        <h4 className="help-card-title">HORSE QUALITY Zone (Left Side)</h4>
        <div className="help-definitions">
          <div className="help-definition">
            <dt className="help-term">The Large Score Number (e.g. 166 out of 376)</dt>
            <dd className="help-desc">
              Think of it like a test score. Higher = better on paper. This number combines
              everything we know about the horse into one total.
            </dd>
          </div>

          <div className="help-definition">
            <dt className="help-term">The Teal Progress Bar</dt>
            <dd className="help-desc">
              How full the bar is shows how the horse scored vs. the maximum possible. A bar
              that&apos;s half full means the horse earned about half the possible points.
            </dd>
          </div>

          <div className="help-definition">
            <dt className="help-term">
              Field Label (Top Pick / Contender / In the Mix / Longshot / Long Odds)
            </dt>
            <dd className="help-desc">
              This is where this horse ranks compared to the other horses in today&apos;s race
              specifically. &quot;Top Pick&quot; means it scored highest in the field. &quot;Long
              Odds&quot; means it scored near the bottom.
            </dd>
          </div>

          <div className="help-definition">
            <dt className="help-term">Data Quality Dot (HIGH / MEDIUM / LOW)</dt>
            <dd className="help-desc">
              How much reliable information our system found for this horse. HIGH = full homework
              done. LOW = limited data, be cautious.
            </dd>
          </div>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">BETTING VALUE Zone (Right Side)</h4>
        <div className="help-definitions">
          <div className="help-definition">
            <dt className="help-term">VALUE / FAIR / NO VALUE Label</dt>
            <dd className="help-desc">
              The most important signal for betting decisions. VALUE = the public is undervaluing
              this horse, you&apos;re getting a good deal. FAIR = priced about right. NO VALUE = the
              public already knows, you&apos;d be overpaying.
            </dd>
          </div>

          <div className="help-definition">
            <dt className="help-term">The Sub-Label</dt>
            <dd className="help-desc">
              A plain-English translation of the label above it, like &quot;Public is undervaluing
              this horse&quot; or &quot;Price reflects the horse&apos;s ability.&quot;
            </dd>
          </div>

          <div className="help-definition">
            <dt className="help-term">Edge %</dt>
            <dd className="help-desc">
              The exact numerical gap between our fair price and the public price. A positive number
              means you&apos;re getting better odds than you should. A negative number means
              you&apos;d be overpaying.
            </dd>
          </div>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Tip:</strong> The six category bars to the right of the score break down exactly
          WHERE the horse earned its points. Tap the &apos;?&apos; button next to the score to see
          the full explanation.
        </p>
      </div>

      <h3 className="help-section-title">
        <Icon name="bar_chart" className="help-section-icon" />
        The Six Category Bars
      </h3>
      <p className="help-text">
        These bars give you a quick visual of where the horse is strong or weak. Each one is
        explained in detail in the Factor Breakdown tab.
      </p>
      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">CONNECTIONS</dt>
          <dd className="help-desc">Coach + driver quality (trainer + jockey).</dd>
        </div>
        <div className="help-definition">
          <dt className="help-term">POST</dt>
          <dd className="help-desc">Starting gate advantage at this track.</dd>
        </div>
        <div className="help-definition">
          <dt className="help-term">SPEED/CLASS</dt>
          <dd className="help-desc">Raw speed and level of competition.</dd>
        </div>
        <div className="help-definition">
          <dt className="help-term">FORM</dt>
          <dd className="help-desc">How the horse has been running lately.</dd>
        </div>
        <div className="help-definition">
          <dt className="help-term">EQUIPMENT</dt>
          <dd className="help-desc">Gear changes that might affect performance.</dd>
        </div>
        <div className="help-definition">
          <dt className="help-term">PACE</dt>
          <dd className="help-desc">
            Whether this horse&apos;s running style fits today&apos;s race.
          </dd>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 3: Factor Breakdown
// ============================================================================
function FactorBreakdownSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="search" className="help-section-icon" />
        Factor Breakdown
      </h3>
      <p className="help-text">
        The Factor Breakdown section is visible in the Analysis tab when a horse is expanded. It
        shows each scoring factor with an icon telling you if it helps or hurts the horse today.
      </p>

      <div className="help-card">
        <h4 className="help-card-title">What the Icons Mean</h4>
        <div className="help-definitions">
          <div className="help-definition">
            <dt className="help-term">{'\u2705'} Green Checkmark = Strength</dt>
            <dd className="help-desc">This factor is working in the horse&apos;s favor today.</dd>
          </div>
          <div className="help-definition">
            <dt className="help-term">{'\u2796'} Gray Dash = Average</dt>
            <dd className="help-desc">Neutral &mdash; not helping or hurting.</dd>
          </div>
          <div className="help-definition">
            <dt className="help-term">{'\u26A0\uFE0F'} Yellow Warning = Caution</dt>
            <dd className="help-desc">Something to watch, mildly against the horse.</dd>
          </div>
          <div className="help-definition">
            <dt className="help-term">{'\u274C'} Red X = Weakness</dt>
            <dd className="help-desc">This factor is working against the horse.</dd>
          </div>
        </div>
      </div>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="people" className="help-category-icon" />
            <span className="help-category-name">Connections</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> The trainer and jockey. The trainer is like a coach &mdash; they
            prepare the horse. The jockey is like a driver &mdash; they steer during the race. When
            both have been winning recently, it matters.
          </p>
          <p className="help-category-desc">
            <strong>Think of it like:</strong> A great coach AND a great point guard on the same
            team at the same time.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="grid_view" className="help-category-icon" />
            <span className="help-category-name">Post Position</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> The starting gate number. Some gates have historically won more
            at this specific track and distance than others.
          </p>
          <p className="help-category-desc">
            <strong>Think of it like:</strong> Lane assignments in a 400m track race &mdash; the
            inside lane runs less distance on turns but can get boxed in.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="speed" className="help-category-icon" />
            <span className="help-category-name">Speed / Class</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> How fast this horse has run (Beyer Speed Figure) and how tough
            the competition was. The single biggest factor.
          </p>
          <p className="help-category-desc">
            <strong>Think of it like:</strong> SAT scores AND which school you went to. Running fast
            in a low-level race is different from running fast against the best.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="fitness_center" className="help-category-icon" />
            <span className="help-category-name">Form</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> How the horse has been running in its last 3 races. Finishing in
            the top 3 = good form. Finishing last = cold streak.
          </p>
          <p className="help-category-desc">
            <strong>Think of it like:</strong> Checking a baseball player&apos;s last 10 games
            &mdash; are they hitting .400 or .100 right now?
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="build" className="help-category-icon" />
            <span className="help-category-name">Equipment</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Gear changes like blinkers (blinders that help a distracted horse
            focus) or special shoes. Small changes can make a big difference.
          </p>
          <p className="help-category-desc">
            <strong>Think of it like:</strong> A runner switching to racing spikes for the first
            time.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="timeline" className="help-category-icon" />
            <span className="help-category-name">Pace</span>
          </div>
          <p className="help-category-desc">
            <strong>What:</strong> Does this horse&apos;s running style (sprinter, stalker, closer)
            match the expected speed of today&apos;s race?
          </p>
          <p className="help-category-desc">
            <strong>Think of it like:</strong> A fast kid getting a head start in a slow race
            &mdash; or a sprinter stuck in a speed duel they can&apos;t win.
          </p>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">VALUE DETECTED / NO VALUE Card</h4>
        <p className="help-text">
          At the bottom of the Factor Breakdown, you&apos;ll see a value card. This shows whether
          the public odds are giving you a deal or making you overpay, regardless of how the horse
          scores on ability. A strong horse at bad odds is a bad bet. A decent horse at great odds
          can be a great bet.
        </p>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Tip:</strong> Tap the &apos;?&apos; next to any factor to get a full explanation
          specific to this horse&apos;s actual numbers.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 4: Suggested Bets
// ============================================================================
function SuggestedBetsSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="lightbulb" className="help-section-icon" />
        Suggested Bets
      </h3>
      <p className="help-text">
        The Suggested Bets section recommends specific wagers organized by risk level. Here&apos;s
        what each tier means:
      </p>

      <div className="help-card">
        <h4 className="help-card-title">CONSERVATIVE BETS (Lowest Risk)</h4>
        <div className="help-definitions">
          <div className="help-definition">
            <dt className="help-term">Win</dt>
            <dd className="help-desc">Bet this one horse to finish first.</dd>
          </div>
          <div className="help-definition">
            <dt className="help-term">Place</dt>
            <dd className="help-desc">
              Bet this horse to finish first OR second. Pays less than Win but more likely to cash.
            </dd>
          </div>
        </div>
        <p className="help-text">These are straight bets. One horse. Simple. Best for beginners.</p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">MODERATE BETS (Medium Risk, Bigger Payouts)</h4>
        <div className="help-definitions">
          <div className="help-definition">
            <dt className="help-term">Exacta Key</dt>
            <dd className="help-desc">
              Pick the horse you like most, then list several others who might finish second. You
              win if your key horse wins AND any of your listed horses finish second.
            </dd>
          </div>
          <div className="help-definition">
            <dt className="help-term">Trifecta Key</dt>
            <dd className="help-desc">
              Same idea &mdash; your key horse wins, and you cover several combinations for 2nd and
              3rd.
            </dd>
          </div>
        </div>
        <p className="help-text">
          These cost a little more but pay significantly more than straight bets.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">AGGRESSIVE BETS (Highest Risk, Biggest Payouts)</h4>
        <div className="help-definitions">
          <div className="help-definition">
            <dt className="help-term">Trifecta Box</dt>
            <dd className="help-desc">
              Pick 3&ndash;4 horses and cover every possible order they could finish in the top 3.
            </dd>
          </div>
          <div className="help-definition">
            <dt className="help-term">Value Bomb</dt>
            <dd className="help-desc">
              A longshot the algorithm thinks is being dramatically undervalued. High risk, high
              reward.
            </dd>
          </div>
        </div>
        <p className="help-text">
          These are for when you think there&apos;s an upset brewing or you want maximum upside.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">&quot;No Bets Recommended&quot;</h4>
        <p className="help-text">
          When a bet section shows &quot;No bets recommended,&quot; the algorithm didn&apos;t find
          enough value to justify a recommendation. This is useful information: it means pass or be
          very selective.
        </p>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Tip:</strong> The Suggested Bets section changes for every horse and every race
          based on the live odds. Always check it after odds move closer to post time.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 5: Past Performances
// ============================================================================
function PastPerformancesSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="history" className="help-section-icon" />
        Past Performances
      </h3>
      <p className="help-text">
        The Past Performances table shows the horse&apos;s recent race history. Each row is a
        previous race, with the most recent at the top. Here&apos;s what every column means:
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">DATE</dt>
          <dd className="help-desc">When the race was run.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">TRACK</dt>
          <dd className="help-desc">Which racetrack.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">DISTANCE</dt>
          <dd className="help-desc">How far the race was.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">COND</dt>
          <dd className="help-desc">Track condition (Fast, Muddy, Sloppy, Good, Firm, Soft).</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">CLASS</dt>
          <dd className="help-desc">
            Level of race (Maiden, Claiming, Allowance, Stakes &mdash; see Glossary).
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">FINISH</dt>
          <dd className="help-desc">Where this horse finished (1 = won, 2 = second, etc.).</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">ODDS</dt>
          <dd className="help-desc">What odds this horse went off at in that race.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">FIGURE</dt>
          <dd className="help-desc">
            The Beyer Speed Figure &mdash; how fast they ran. Higher = faster.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">TIME</dt>
          <dd className="help-desc">The final time of the race.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">DAYS</dt>
          <dd className="help-desc">
            Days since previous race &mdash; a long gap (60+ days) can be a question mark or a sign
            the trainer was patient for the right spot.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">EQUIP/MED</dt>
          <dd className="help-desc">Equipment or medication changes for that race.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">RUNNING LINE</dt>
          <dd className="help-desc">
            Where the horse was positioned at each call during the race (e.g. 3-2-1 = started 3rd,
            moved to 2nd, won).
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">JOCKEY</dt>
          <dd className="help-desc">Who rode the horse in that race.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">WEIGHT</dt>
          <dd className="help-desc">How much weight the horse carried.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">COMMENT</dt>
          <dd className="help-desc">
            Trainer/chart caller notes about the race &mdash; look for words like &quot;wide,&quot;
            &quot;blocked,&quot; &quot;stumbled start&quot; &mdash; these explain bad finishes that
            weren&apos;t the horse&apos;s fault.
          </dd>
        </div>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Workouts: The Bullet Symbol ({'\u25CF'})</h4>
        <p className="help-text">
          A bullet ({'\u25CF'}) next to a workout means it was the fastest workout of the day at
          that distance at that track. This is a highly positive sign &mdash; it means the horse
          outworked every other horse that morning.
        </p>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Reading Trips:</strong> A horse that finished 4th while racing wide may have run
          better than the finish suggests. Look for horses with excuses that are getting better odds
          today.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 6: Horse Profile
// ============================================================================
function HorseProfileSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="info" className="help-section-icon" />
        Horse Profile
      </h3>
      <p className="help-text">
        The Horse Profile tab shows background information about the horse. Here&apos;s what each
        section tells you:
      </p>

      <div className="help-card">
        <h4 className="help-card-title">Identity</h4>
        <p className="help-text">
          Basic facts &mdash; color, sex, age, weight carried today, equipment, medication (Lasix =
          bleeder medication, very common and legal).
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Breeding</h4>
        <p className="help-text">
          Sire (father), Dam (mother), Breeder. Matters most for first-time starters and young
          horses &mdash; some bloodlines excel at certain distances or surfaces.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Connections</h4>
        <p className="help-text">
          Owner, Trainer, Jockey. Knowing who trains and rides tells experienced bettors a lot about
          intentions and form.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Career Record</h4>
        <p className="help-text">
          Wins-Places-Shows out of total starts, for current year, previous year, and lifetime. A
          horse with 15 starts and 0 wins is very different from one with 3 starts and 1 win.
        </p>
      </div>

      <div className="help-card">
        <h4 className="help-card-title">Surface &amp; Distance Splits</h4>
        <p className="help-text">
          How the horse has performed on Dirt vs. Wet vs. Turf, and at today&apos;s distance. A
          horse with 8 wins on dirt and 0 on turf racing on turf today is a red flag.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 7: Glossary
// ============================================================================
function GlossarySection() {
  const terms = [
    {
      term: 'Overlay',
      def: "When odds are higher (better) than they should be based on the horse's actual chances. A good betting opportunity.",
    },
    {
      term: 'Underlay',
      def: 'When odds are lower (worse) than they should be. The public is overvaluing this horse.',
    },
    {
      term: 'Morning Line',
      def: 'Odds set by the track handicapper before betting opens. Used as a starting point.',
    },
    { term: 'Furlong', def: 'One-eighth of a mile (220 yards). Common race distance measurement.' },
    {
      term: 'Maiden',
      def: 'A horse that has never won a race. "Breaking maiden" means winning for the first time.',
    },
    {
      term: 'Claiming Race',
      def: 'A race where every horse is for sale at a set price. Lower claiming prices = lower class horses.',
    },
    {
      term: 'Allowance Race',
      def: "A step above claiming races. Horses aren't for sale. Conditions based on past earnings or wins.",
    },
    {
      term: 'Stakes Race',
      def: 'The highest level of racing. Includes graded stakes (G1, G2, G3) with the best horses.',
    },
    {
      term: 'Speed Figure',
      def: 'A numerical rating of how fast a horse ran. Allows comparison across different tracks and distances.',
    },
    {
      term: 'Blinkers',
      def: 'Eye covers that limit peripheral vision, helping the horse focus forward. "First-time blinkers" is often a positive change.',
    },
    {
      term: 'Lasix',
      def: 'A diuretic medication (Furosemide) used to prevent bleeding in the lungs during exercise. Very common.',
    },
    {
      term: 'Layoff',
      def: 'Time between races. A horse returning from a long layoff may be fresh or rusty.',
    },
    {
      term: 'Closer',
      def: 'A horse that runs from behind and makes a late move. Needs a pace to run at.',
    },
    {
      term: 'Early Speed',
      def: 'A horse that likes to be near the lead early in the race. Can control the pace.',
    },
    {
      term: 'Presser',
      def: 'A horse that stalks the pace, sitting just behind the leaders before making a move.',
    },
    {
      term: 'Track Bias',
      def: 'When a track surface favors certain running styles or post positions (e.g., "speed favoring" or "inside favoring").',
    },
    {
      term: 'Field Label',
      def: 'Whether a horse is our Top Pick, Contender, In the Mix, Longshot, or Long Odds relative to the other horses in today\u2019s race specifically.',
    },
    {
      term: 'Data Quality',
      def: 'How much reliable information our system found (HIGH / MEDIUM / LOW). LOW means treat the score with extra caution.',
    },
    {
      term: 'Edge %',
      def: 'The gap between our fair odds and the public\u2019s current odds. Positive = value. Negative = overpriced.',
    },
    {
      term: 'Betting Value',
      def: 'Whether the public odds give you a deal (VALUE), are fair (FAIR), or make you overpay (NO VALUE).',
    },
    {
      term: 'Kelly Sizing',
      def: 'A mathematical formula for how much to bet based on your edge and bankroll. Shown in the Top Bets screen.',
    },
    {
      term: 'Beyer Speed Figure',
      def: 'A standardized speed rating used at every US racetrack. Higher = faster. 77+ is elite. Under 50 is below average.',
    },
    {
      term: 'Running Line',
      def: 'The position a horse held at each stage of the race \u2014 shows whether they were chasing or leading throughout.',
    },
    {
      term: 'Softmax',
      def: 'A probability calculation that distributes win chances across all horses so they add up to 100%. Shown with a \u2713 symbol on Top Bets cards.',
    },
  ];

  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="menu_book" className="help-section-icon" />
        Glossary of Terms
      </h3>
      <p className="help-text">Common horse racing terms you&apos;ll encounter:</p>

      <dl className="help-glossary">
        {terms.map(({ term, def }) => (
          <div key={term} className="help-glossary-item">
            <dt className="help-glossary-term">{term}</dt>
            <dd className="help-glossary-def">{def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default ScoringHelpModal;
