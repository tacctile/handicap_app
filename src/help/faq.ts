/**
 * FAQ Content
 *
 * Frequently asked questions about Furlong Pro Handicapping.
 */

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'what-is-drf',
    question: 'What is a DRF file and where do I get one?',
    answer:
      'A DRF (Daily Racing Form) file is a data file containing detailed past performance information for horses in upcoming races. You can purchase DRF files from the official Daily Racing Form website (drf.com). Each file contains comprehensive data including speed figures, past performances, trainer and jockey statistics, and more. Once purchased, download the file and upload it directly to Furlong to begin your analysis.',
  },
  {
    id: 'how-scoring-works',
    question: 'How does the scoring algorithm work?',
    answer:
      'Our scoring algorithm evaluates horses across 6 key categories: Elite Connections (trainer/jockey), Post Position & Track Bias, Speed Figures & Class, Form Cycle & Conditioning, Equipment & Medication, and Pace & Tactical scenarios. Each category contributes to a base score of 0-331 points. Race-day adjustments (DRF Overlay) can add or subtract up to 40 additional points, resulting in final scores from 0-371. The algorithm is deterministic—same inputs always produce the same outputs.',
  },
  {
    id: 'confidence-percentages',
    question: 'What do the confidence percentages mean?',
    answer:
      'Confidence percentages indicate how strongly the algorithm rates a horse relative to the field. High confidence (70%+) means multiple scoring factors align favorably. Medium confidence (50-69%) indicates solid but not dominant scoring. Lower confidence means the horse has fewer standout factors. Confidence also factors in score separation from the field—a horse with moderate score but large gap to competitors may still show higher confidence.',
  },
  {
    id: 'betting-tiers',
    question: 'What are the betting tiers (Chalk/Alt/Value)?',
    answer:
      'Tier 1 (Chalk) includes horses scoring 180+ points with 50-70% historical hit rates—these are your primary bets. Tier 2 (Alternatives) covers 160-179 points with 20-40% hit rates—good for secondary positions or exotic underlays. Tier 3 (Value) is 140-159 points with 5-20% hit rates—small stabs when odds are generous. Horses below 140 are marked "Pass" and not recommended for betting.',
  },
  {
    id: 'reading-recommendations',
    question: 'How do I read the betting recommendations?',
    answer:
      'Each race displays horses ranked by score with their assigned tier (1/2/3) and suggested bet types (Win, Place, Show, Exacta, etc.). The unit sizing is based on bankroll management principles and tier placement. Tier 1 horses get larger unit allocations, while Tier 3 horses receive minimal exposure. The confidence badge (High/Medium/Low) provides quick visual reference for betting priority.',
  },
  {
    id: 'offline-functionality',
    question: 'Does this work offline?',
    answer:
      "Yes! Furlong is built as an offline-first Progressive Web App (PWA). Once you've loaded the app, all scoring calculations, DRF parsing, and track intelligence lookups work without an internet connection. This is critical for use at the track where connectivity is unreliable. Only authentication, subscription validation, and AI features (when implemented) require online access.",
  },
  {
    id: 'updating-odds',
    question: 'How do I update odds during the race?',
    answer:
      'In the Race Detail view, you can manually update the morning line odds to reflect current tote board odds. Simply click on the odds field for any horse and enter the new value. The system will automatically recalculate value ratings and betting recommendations based on the updated odds. This is essential for finding overlays when public money shifts the odds.',
  },
  {
    id: 'supported-tracks',
    question: 'What tracks are supported?',
    answer:
      'Furlong includes detailed track intelligence for 40+ major North American tracks including Churchill Downs, Saratoga, Del Mar, Keeneland, Santa Anita, Belmont, Gulfstream, and more. Each track profile includes surface specifications, post position win rates, pace bias data, and track-specific pars. For tracks not in our database, the system applies neutral national averages with a reduced confidence flag.',
  },
  {
    id: 'score-interpretation',
    question: 'What do high and low scores mean?',
    answer:
      'Scores above 200 points indicate elite contenders with multiple strong factors aligned. Scores from 180-199 represent strong contenders worthy of betting consideration. 160-179 shows competitive horses that could hit the board. 140-159 means marginal contenders—possible upsets at the right price. Below 140 signals insufficient factors to justify a wager. Remember: scores are relative to the field in each specific race.',
  },
  {
    id: 'first-time-starters',
    question: 'How are first-time starters handled?',
    answer:
      "Horses with fewer than 8 starts trigger our 'Lightly Raced' protocol. The algorithm compensates for limited data by weighting breeding patterns, workout data, trainer debut statistics, and connection success rates more heavily. First-time starters receive breeding-based projections and are flagged for manual review. Their confidence percentages are adjusted to reflect the inherent uncertainty.",
  },
];
