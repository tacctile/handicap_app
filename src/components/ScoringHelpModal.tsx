/**
 * ScoringHelpModal Component
 *
 * A comprehensive guide to understanding the Furlong handicapping display.
 * Organized top-to-bottom matching the actual UI layout, like learning
 * to read a racing form for the first time.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScoringHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon component for consistency
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export function ScoringHelpModal({ isOpen, onClose }: ScoringHelpModalProps) {
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
    { id: 'summary-row', label: 'Summary Row', icon: 'table_rows' },
    { id: 'score-breakdown', label: 'Score Breakdown', icon: 'analytics' },
    { id: 'horse-profile', label: 'Horse Profile', icon: 'info' },
    { id: 'past-performances', label: 'Past Performances', icon: 'history' },
    { id: 'glossary', label: 'Glossary', icon: 'menu_book' },
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
                    <Icon name={section.icon} className="scoring-help-tab-icon" />
                    <span>{section.label}</span>
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="scoring-help-content">
                {activeSection === 'overview' && <OverviewSection />}
                {activeSection === 'summary-row' && <SummaryRowSection />}
                {activeSection === 'score-breakdown' && <ScoreBreakdownSection />}
                {activeSection === 'horse-profile' && <HorseProfileSection />}
                {activeSection === 'past-performances' && <PastPerformancesSection />}
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

// Overview Section
function OverviewSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="lightbulb" className="help-section-icon" />
        Welcome to Furlong
      </h3>
      <p className="help-text">
        This guide will help you understand everything you see on the screen. Whether you&apos;re
        new to horse racing or a seasoned handicapper, this tool gives you data-driven insights to
        make smarter betting decisions.
      </p>

      <div className="help-card">
        <h4 className="help-card-title">What You&apos;ll Learn</h4>
        <ul className="help-list">
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>How to read the summary row for each horse</span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>What each scoring category measures</span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>How to interpret past performances</span>
          </li>
          <li>
            <Icon name="arrow_right" className="help-list-icon" />
            <span>Key terms and abbreviations</span>
          </li>
        </ul>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Quick Tip:</strong> Look for green &quot;OVERLAY&quot; badges - these indicate
          horses where the odds may be better than they should be based on our analysis.
        </p>
      </div>
    </div>
  );
}

// Summary Row Section
function SummaryRowSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="table_rows" className="help-section-icon" />
        The Summary Row
      </h3>
      <p className="help-text">
        Each horse has a summary row showing key information at a glance. Here&apos;s what each
        column means, from left to right:
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">PP (Post Position)</dt>
          <dd className="help-desc">
            The starting gate number. Horse #1 starts closest to the inside rail. Some tracks favor
            certain post positions - inside posts often have an advantage on tight turns.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">HORSE</dt>
          <dd className="help-desc">
            The horse&apos;s registered racing name. Click anywhere on the row to expand and see
            detailed information about past races, breeding, and more.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">ODDS</dt>
          <dd className="help-desc">
            The morning line odds set by the track. These show the expected payout ratio. For
            example, 5-1 means a $2 bet returns $12 ($10 profit + $2 original bet). You can click to
            adjust these to match live tote board odds.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">SCORE</dt>
          <dd className="help-desc">
            Our overall Furlong Score out of 328 points. This combines six different factors:
            connections, post position, speed, form, equipment, and pace. Higher is better.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">WIN CONF (Win Confidence)</dt>
          <dd className="help-desc">
            The estimated probability this horse wins, shown as a percentage. This is calculated
            from the Furlong Score relative to other horses in the race. A 20% win confidence means
            we estimate this horse wins about 1 in 5 times.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">FAIR</dt>
          <dd className="help-desc">
            The &quot;fair&quot; odds based on our win confidence calculation. If a horse has 20%
            win confidence, fair odds would be 4-1. Compare this to actual odds to find value.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">EDGE %</dt>
          <dd className="help-desc">
            The percentage difference between actual odds and fair odds. Positive (green) means
            potential value - you&apos;re getting better odds than our analysis suggests. Negative
            (red) means the public may be overvaluing this horse.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">ODDS EDGE</dt>
          <dd className="help-desc">
            A quick label: <strong>OVERLAY</strong> (green) means the odds are better than they
            should be. <strong>UNDERLAY</strong> (red) means the horse is overbet.
            <strong>FAIR</strong> (yellow) means odds match our estimate.
          </dd>
        </div>
      </div>
    </div>
  );
}

// Score Breakdown Section
function ScoreBreakdownSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="analytics" className="help-section-icon" />
        Score Breakdown
      </h3>
      <p className="help-text">
        The Furlong Score is built from six categories. Each measures a different aspect of a
        horse&apos;s chances. Click on any category to expand and see the details.
      </p>

      <div className="help-categories">
        <div className="help-category">
          <div className="help-category-header">
            <Icon name="people" className="help-category-icon" />
            <span className="help-category-name">Connections</span>
            <span className="help-category-max">55 pts max</span>
          </div>
          <p className="help-category-desc">
            Rates the trainer and jockey. Some trainers excel in specific situations (first-time
            starters, turf races, etc.). Certain trainer-jockey combinations have strong historical
            win rates together.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="grid_view" className="help-category-icon" />
            <span className="help-category-name">Post Position</span>
            <span className="help-category-max">45 pts max</span>
          </div>
          <p className="help-category-desc">
            Evaluates whether the starting gate helps or hurts. Different tracks have different
            biases - some favor inside posts, others favor outside. We analyze historical data to
            identify these patterns.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="speed" className="help-category-icon" />
            <span className="help-category-name">Speed / Class</span>
            <span className="help-category-max">50 pts max</span>
          </div>
          <p className="help-category-desc">
            Measures raw ability through speed figures (how fast the horse has run) and class level
            (quality of competition). A horse moving down in class may have an advantage against
            weaker competition.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="fitness_center" className="help-category-icon" />
            <span className="help-category-name">Form</span>
            <span className="help-category-max">30 pts max</span>
          </div>
          <p className="help-category-desc">
            Assesses current condition. Recent race results, days since last race, and consistency
            all factor in. Horses in good form tend to repeat. Long layoffs can be positive (rest)
            or negative (rust).
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="build" className="help-category-icon" />
            <span className="help-category-name">Equipment</span>
            <span className="help-category-max">25 pts max</span>
          </div>
          <p className="help-category-desc">
            Tracks equipment changes like blinkers (eye covers to improve focus) or different shoes.
            First-time blinkers or equipment changes can signal a trainer is trying something new to
            improve performance.
          </p>
        </div>

        <div className="help-category">
          <div className="help-category-header">
            <Icon name="timeline" className="help-category-icon" />
            <span className="help-category-name">Pace</span>
            <span className="help-category-max">40 pts max</span>
          </div>
          <p className="help-category-desc">
            Analyzes running style and race shape. Some horses like to lead (early speed), others
            close from behind (closers). This score shows how well the horse&apos;s style fits the
            expected pace scenario of this race.
          </p>
        </div>
      </div>

      <div className="help-tip">
        <Icon name="tips_and_updates" className="help-tip-icon" />
        <p>
          <strong>Score Colors:</strong> Teal/cyan scores indicate strong performance in that
          category. Gray scores show average or below average. Look for horses strong in multiple
          categories.
        </p>
      </div>
    </div>
  );
}

// Horse Profile Section
function HorseProfileSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="info" className="help-section-icon" />
        Horse Profile
      </h3>
      <p className="help-text">
        When you expand a horse row, you&apos;ll see detailed profile information. Here&apos;s what
        it means:
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">Identity</dt>
          <dd className="help-desc">
            Basic info: color, sex, age. &quot;Chestnut Gelding, 4&quot; means a reddish-brown
            castrated male horse that is 4 years old. Age matters - 3-year-olds often improve
            rapidly.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Weight</dt>
          <dd className="help-desc">
            The weight the horse carries, including jockey and equipment. Higher weight (typically
            assigned to better horses) can be a disadvantage. 5 pounds roughly equals one length
            over a mile.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Equipment</dt>
          <dd className="help-desc">
            Current equipment: Blinkers (B) focus attention, Front Bandages (F) provide support, Bar
            Shoes help with hoof issues. Equipment changes are tracked in scoring.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Medication</dt>
          <dd className="help-desc">
            L = Lasix (diuretic for bleeding), B = Bute (anti-inflammatory). Most horses run on
            Lasix. First-time Lasix can sometimes improve performance.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Sire / Dam</dt>
          <dd className="help-desc">
            The horse&apos;s father (Sire) and mother (Dam). Breeding can indicate surface and
            distance preferences. Some sires are known for producing turf horses or sprinters.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Connections</dt>
          <dd className="help-desc">
            Owner, Trainer, and Jockey. The trainer conditions the horse daily. The jockey rides in
            the race. Strong trainer-jockey combinations can be a positive sign.
          </dd>
        </div>
      </div>
    </div>
  );
}

// Past Performances Section
function PastPerformancesSection() {
  return (
    <div className="help-section">
      <h3 className="help-section-title">
        <Icon name="history" className="help-section-icon" />
        Past Performances
      </h3>
      <p className="help-text">
        The past performances table shows the horse&apos;s recent race history. Each row is a
        previous race, with the most recent at the top.
      </p>

      <div className="help-definitions">
        <div className="help-definition">
          <dt className="help-term">Date</dt>
          <dd className="help-desc">When the race occurred. Recent races are most relevant.</dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Track</dt>
          <dd className="help-desc">
            Three-letter code for the racetrack (e.g., SAR = Saratoga, BEL = Belmont).
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Distance</dt>
          <dd className="help-desc">
            Race length in furlongs (f) or miles (m). One furlong = 1/8 mile. 6f is a sprint, 1m+ is
            a route.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Class</dt>
          <dd className="help-desc">
            Race type and level. MSW = Maiden Special Weight (first-time winners). CLM = Claiming
            (horses for sale). ALW = Allowance. STK = Stakes (highest quality).
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Finish</dt>
          <dd className="help-desc">
            Final position / number of horses. &quot;3/12&quot; means finished 3rd out of 12 horses.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Figure</dt>
          <dd className="help-desc">
            Speed figure rating for that race. Higher is faster. Compare to today&apos;s field to
            gauge relative ability. 80+ is solid, 90+ is very good.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Running Line</dt>
          <dd className="help-desc">
            Position at each point of call. &quot;4 3 2 1&quot; means started 4th, moved to 3rd,
            then 2nd, finished 1st. Shows how the horse ran the race.
          </dd>
        </div>

        <div className="help-definition">
          <dt className="help-term">Comment</dt>
          <dd className="help-desc">
            Brief note about the trip. &quot;Wide&quot; = lost ground on turns. &quot;Blocked&quot;
            = couldn&apos;t find running room. &quot;Tired&quot; = faded late. Good trips vs.
            troubled trips matter.
          </dd>
        </div>
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

// Glossary Section
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
