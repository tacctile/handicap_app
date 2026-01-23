/**
 * AI Service Type Definitions
 *
 * Single-bot architecture for race analysis.
 * The algorithm calculates scores — AI interprets those scores and produces
 * final rankings, value labels, and per-horse insights.
 */

// ============================================================================
// AI CONFIDENCE TIERS
// ============================================================================

/**
 * AI confidence tier for race-level analysis
 * - HIGH: Confidence score 80-100
 * - MEDIUM: Confidence score 60-79
 * - LOW: Confidence score 40-59
 * - MINIMAL: Confidence score 0-39 (no clear edge, but picks still shown)
 */
export type AIConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

// ============================================================================
// VALUE LABELS
// ============================================================================

/**
 * Value label that displays in UI
 * Indicates the betting value assessment for a horse
 */
export type ValueLabel =
  | 'BEST BET'
  | 'PRIME VALUE'
  | 'SOLID PLAY'
  | 'FAIR PRICE'
  | 'WATCH ONLY'
  | 'TOO SHORT'
  | 'NO VALUE'
  | 'SKIP'
  | 'NO CHANCE';

// ============================================================================
// HORSE INSIGHT
// ============================================================================

/**
 * Per-horse AI insight
 * Contains the AI's analysis and recommendations for a single horse
 */
export interface HorseInsight {
  /** Program number (saddle cloth) */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Projected finish position (1 = winner) */
  projectedFinish: number;
  /** Value assessment label */
  valueLabel: ValueLabel;
  /** One-liner insight, e.g., "Lone speed, should wire if clean break" */
  oneLiner: string;
  /** Primary positive factor */
  keyStrength: string | null;
  /** Primary concern */
  keyWeakness: string | null;
  /** Whether horse is a legitimate contender */
  isContender: boolean;
  /** Whether to avoid betting this horse */
  avoidFlag: boolean;
}

// ============================================================================
// RACE ANALYSIS
// ============================================================================

/**
 * Complete AI analysis for a race
 * Contains narrative, insights, and betting guidance
 */
export interface AIRaceAnalysis {
  /** Unique identifier for the race */
  raceId: string;
  /** Race number */
  raceNumber: number;
  /** When analysis was generated */
  timestamp: string;
  /** How long the AI took to process */
  processingTimeMs: number;

  // Overall race assessment
  /** 2-3 sentences summarizing the race */
  raceNarrative: string;
  /** Confidence in the analysis */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  /** Whether this race is worth betting */
  bettableRace: boolean;

  // Per-horse insights (ordered by projected finish)
  /** Array of insights for each horse */
  horseInsights: HorseInsight[];

  // Betting guidance
  /** Program number of top pick (null if no clear pick) */
  topPick: number | null;
  /** Program numbers of horses to avoid */
  avoidList: number[];

  // Flags
  /** Whether the favorite appears vulnerable */
  vulnerableFavorite: boolean;
  /** Whether an upset is likely */
  likelyUpset: boolean;
  /** Whether race is too unpredictable to bet confidently */
  chaoticRace: boolean;

  // Debug info (optional, only present in multi-bot mode)
  /** Bot status debug information for troubleshooting */
  botDebugInfo?: BotStatusDebugInfo;

  // Ticket construction (optional, only present in multi-bot mode)
  /** Ticket construction using three-template system */
  ticketConstruction?: TicketConstruction;

  // Legacy fields for backward compatibility
  /** @deprecated Use ticketConstruction instead */
  betConstruction?: BetConstructionGuidance;
  /** @deprecated Value play is no longer used - expansion horses removed */
  valuePlay?: number | null;
}

// ============================================================================
// SERVICE STATUS
// ============================================================================

/**
 * AI service status
 */
export type AIServiceStatus = 'ready' | 'processing' | 'offline' | 'error';

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error codes from AI service
 */
export type AIServiceErrorCode =
  | 'API_KEY_MISSING'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED';

/**
 * Error from AI service
 */
export interface AIServiceError {
  /** Error code for programmatic handling */
  code: AIServiceErrorCode;
  /** Human-readable error message */
  message: string;
  /** When the error occurred */
  timestamp: string;
}

// ============================================================================
// MULTI-BOT ARCHITECTURE TYPES
// ============================================================================

/**
 * Trip Trouble Bot - Identifies horses with masked ability due to trip issues
 */
export interface TripTroubleAnalysis {
  /** Horses identified with trip trouble in recent races */
  horsesWithTripTrouble: Array<{
    /** Program number */
    programNumber: number;
    /** Horse name */
    horseName: string;
    /** Description of the trip issue (e.g., "blocked 5-wide on turn") */
    issue: string;
    /** Whether the issue likely masked true ability */
    maskedAbility: boolean;
  }>;
}

/**
 * Pace Scenario Bot - Analyzes pace dynamics and running style advantages
 */
export interface PaceScenarioAnalysis {
  /** Running styles that benefit from the pace scenario */
  advantagedStyles: string[];
  /** Running styles that are disadvantaged */
  disadvantagedStyles: string[];
  /** Overall pace projection for the race */
  paceProjection: 'HOT' | 'MODERATE' | 'SLOW';
  /** Whether there's a lone speed with no pressure */
  loneSpeedException: boolean;
  /** Whether a speed duel between 2+ horses is likely */
  speedDuelLikely: boolean;
}

/**
 * Vulnerable Favorite Bot - Evaluates whether the favorite can be beaten
 */
export interface VulnerableFavoriteAnalysis {
  /** Whether the favorite appears vulnerable */
  isVulnerable: boolean;
  /** Specific reasons for vulnerability */
  reasons: string[];
  /** Confidence level in the vulnerability assessment */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Horse classification from Field Spread Bot
 * Determines how each horse should be used in bet construction
 */
export type HorseClassification = 'A' | 'B' | 'C' | 'EXCLUDE';

/**
 * Per-horse classification data from Field Spread Bot
 */
export interface HorseClassificationData {
  /** Program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Classification tier */
  classification: HorseClassification;
  /** Whether horse should be used as a key in exotics */
  keyCandidate: boolean;
  /** Whether horse should only be used in spread positions (not to win) */
  spreadOnly: boolean;
  /** Reason for classification */
  reason: string;
}

/**
 * Field Spread Bot - Assesses competitive separation in the field
 */
export interface FieldSpreadAnalysis {
  /** Type of field composition */
  fieldType: 'TIGHT' | 'SEPARATED' | 'MIXED' | 'DOMINANT' | 'COMPETITIVE' | 'WIDE_OPEN';
  /** Number of legitimate contenders */
  topTierCount: number;
  /** Recommended spread for exotic betting */
  recommendedSpread: 'NARROW' | 'MEDIUM' | 'WIDE';
  /** Per-horse classifications (optional for backwards compatibility) */
  horseClassifications?: HorseClassificationData[];
}

/**
 * Combined raw results from all 4 multi-bot analyses
 */
export interface MultiBotRawResults {
  /** Trip trouble analysis (null if bot failed) */
  tripTrouble: TripTroubleAnalysis | null;
  /** Pace scenario analysis (null if bot failed) */
  paceScenario: PaceScenarioAnalysis | null;
  /** Vulnerable favorite analysis (null if bot failed) */
  vulnerableFavorite: VulnerableFavoriteAnalysis | null;
  /** Field spread analysis (null if bot failed) */
  fieldSpread: FieldSpreadAnalysis | null;
}

/**
 * Configuration for AI service mode
 */
export interface AIServiceConfig {
  /** Use multi-bot parallel architecture instead of single-bot */
  useMultiBot: boolean;
  /** Conservative mode - higher thresholds for overrides (default: true) */
  conservativeMode?: boolean;
}

// ============================================================================
// SIGNAL AGGREGATION TYPES (for smart combiner)
// ============================================================================

/**
 * Override reason tracking - logs which signals triggered rank changes
 */
export interface OverrideReason {
  /** Type of signal that triggered the override */
  signal: 'tripTrouble' | 'paceAdvantage' | 'vulnerableFavorite' | 'combined';
  /** Confidence level of the signal */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable description */
  description: string;
}

/**
 * Aggregated signals from all 4 bots for a single horse
 * Used by the combiner to make intelligent synthesis decisions
 */
export interface AggregatedSignals {
  /** Program number (saddle cloth) */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Original algorithm rank (1 = best) */
  algorithmRank: number;
  /** Original algorithm score */
  algorithmScore: number;

  // Trip Trouble signals
  /** Trip trouble boost: 0 (none/MEDIUM), or +2 (HIGH only in conservative mode) */
  tripTroubleBoost: number;
  /** Description of hidden ability if masked (e.g., "+5-8 Beyer masked") */
  hiddenAbility: string | null;
  /** Whether trip trouble was flagged (even if no boost applied) */
  tripTroubleFlagged: boolean;

  // Pace Scenario signals
  /** Pace advantage: -1 (hurt), 0 (neutral/MODERATE), or +1 (STRONG only in conservative mode) */
  paceAdvantage: number;
  /** Reason for pace edge (e.g., "Lone speed on speed-favoring track") */
  paceEdgeReason: string | null;
  /** Whether pace advantage was flagged (even if no boost applied) */
  paceAdvantageFlagged: boolean;

  // Vulnerable Favorite signals (only applies to rank 1 / betting favorite)
  /** Whether this horse is flagged as vulnerable favorite */
  isVulnerable: boolean;
  /** List of vulnerability flags/reasons */
  vulnerabilityFlags: string[];

  // Field Spread signals
  /** Horse classification from field spread */
  classification: HorseClassification;
  /** Whether horse is a key candidate for exotics */
  keyCandidate: boolean;
  /** Whether horse should only be used in spread positions */
  spreadOnly: boolean;

  // Aggregated totals
  /** Sum of all adjustments (capped at ±3) */
  totalAdjustment: number;
  /** Algorithm rank after adjustments applied */
  adjustedRank: number;
  /** Number of bots that flagged this horse with a signal */
  signalCount: number;
  /** Whether bots disagree about this horse */
  conflictingSignals: boolean;
  /** Override reasons for tracking (why this horse's rank changed) */
  overrideReasons: OverrideReason[];
}

// ============================================================================
// BET RECOMMENDATION TYPES
// ============================================================================

/**
 * Type of bet structure recommendation
 */
export type BetStructureType = 'KEY' | 'BOX' | 'WHEEL' | 'PASS';

/**
 * Synthesized bet recommendation from all bot outputs
 */
export interface BetRecommendation {
  /** Type of bet structure */
  type: BetStructureType;
  /** Exacta construction suggestion (e.g., "#3 over #1,#5,#7" or "Box #1,#3,#5") */
  exacta: string;
  /** Trifecta construction suggestion (e.g., "#3 with #1,#5,#7") */
  trifecta: string;
  /** Program number of primary play (key horse / top pick) */
  primaryPlay: number;
  /** All program numbers to include in exotics */
  includeList: number[];
  /** Program numbers to leave off tickets */
  excludeList: number[];
  /** Confidence in this bet structure */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Reasoning for the recommendation */
  reasoning: string;
}

/**
 * Rank change tracking for narrative generation
 */
export interface RankChange {
  /** Program number */
  programNumber: number;
  /** Horse name */
  horseName: string;
  /** Original algorithm rank */
  fromRank: number;
  /** New adjusted rank */
  toRank: number;
  /** Reason for the change */
  reason: string;
  /** Direction of change */
  direction: 'UPGRADED' | 'DOWNGRADED' | 'UNCHANGED';
}

// ============================================================================
// BOT STATUS DEBUG TYPES
// ============================================================================

/**
 * Status summary for a single bot
 */
export interface BotStatusInfo {
  /** Bot name */
  name: string;
  /** Whether the bot returned data successfully */
  success: boolean;
  /** Summary of what the bot found */
  summary: string;
  /** Count of items flagged (for trip trouble) */
  count?: number;
}

/**
 * Debug info for all bots - included in AIRaceAnalysis for debugging
 */
export interface BotStatusDebugInfo {
  /** Trip Trouble Bot status */
  tripTrouble: BotStatusInfo;
  /** Pace Scenario Bot status */
  paceScenario: BotStatusInfo;
  /** Vulnerable Favorite Bot status */
  vulnerableFavorite: BotStatusInfo;
  /** Field Spread Bot status */
  fieldSpread: BotStatusInfo;
  /** Total number of bots that succeeded */
  successCount: number;
  /** Total number of bots */
  totalBots: number;
  /** Whether any rank overrides were triggered */
  hasOverride: boolean;
  /** Signal aggregation summary */
  signalSummary: string;
}

// ============================================================================
// TICKET CONSTRUCTION (Three-Template System)
// ============================================================================

/**
 * Template type for ticket construction
 * - A: Solid Favorite (favorite in win position)
 * - B: Vulnerable Favorite (favorite demoted to place only)
 * - C: Wide Open/Chaos (full box)
 */
export type TicketTemplate = 'A' | 'B' | 'C';

/**
 * Race type classification from Field Spread bot
 */
export type RaceType = 'CHALK' | 'COMPETITIVE' | 'WIDE_OPEN';

/**
 * Favorite status determination
 */
export type FavoriteStatus = 'SOLID' | 'VULNERABLE';

/**
 * Exacta ticket construction
 */
export interface ExactaConstruction {
  /** Horses that can win (first position) */
  winPosition: number[];
  /** Horses that can place (second position) */
  placePosition: number[];
  /** Total combinations */
  combinations: number;
  /** Estimated cost at $2 base */
  estimatedCost: number;
}

/**
 * Trifecta ticket construction
 */
export interface TrifectaConstruction {
  /** Horses in win position */
  winPosition: number[];
  /** Horses in place position */
  placePosition: number[];
  /** Horses in show position */
  showPosition: number[];
  /** Total combinations */
  combinations: number;
  /** Estimated cost at $1 base */
  estimatedCost: number;
}

/**
 * Ticket Construction - Three-template system
 *
 * Philosophy:
 * - Algorithm top 4 are SACRED — never demoted by AI
 * - Template selection based on favorite vulnerability and field type
 * - No more expansion horses — they weren't hitting the board
 * - Vulnerable favorites stay on tickets but demoted from win position
 */
export interface TicketConstruction {
  /** Template selection: A (solid), B (vulnerable), C (chaos) */
  template: TicketTemplate;
  /** Reason for template selection */
  templateReason: string;

  /** Algorithm's sacred top 4 (program numbers in rank order) */
  algorithmTop4: number[];

  /** Favorite status determination */
  favoriteStatus: FavoriteStatus;
  /** Vulnerability flags (empty if SOLID) */
  favoriteVulnerabilityFlags: string[];

  /** Exacta construction */
  exacta: ExactaConstruction;

  /** Trifecta construction */
  trifecta: TrifectaConstruction;

  /** Race classification from Field Spread bot */
  raceType: RaceType;

  /** Confidence score 0-100, used for sizing */
  confidenceScore: number;

  /** Sizing recommendations based on confidence and template */
  sizing: SizingRecommendation;

  /** Race verdict - BET or PASS with summary */
  verdict: RaceVerdict;
}

// ============================================================================
// SIZING RECOMMENDATIONS
// ============================================================================

/**
 * Sizing recommendation type
 * Based on confidence score and template selection
 */
export type SizingRecommendationType = 'PASS' | 'HALF' | 'STANDARD' | 'STRONG' | 'MAX';

/**
 * Sizing recommendation for bet sizing
 *
 * Philosophy:
 * - High confidence + solid favorite = bet aggressively (MAX)
 * - High confidence + vulnerable favorite = bet strong (STRONG)
 * - Moderate confidence = standard or half sizing
 * - Low confidence = half or pass
 * - Template C (wide open) = always capped at HALF
 */
export interface SizingRecommendation {
  /** Multiplier for bet sizing: 0, 0.5, 1.0, 1.5, or 2.0 */
  multiplier: number;
  /** Recommendation level */
  recommendation: SizingRecommendationType;
  /** Reasoning for the sizing recommendation */
  reasoning: string;
  /** Suggested exacta unit ($2 base × multiplier) */
  suggestedExactaUnit: number;
  /** Suggested trifecta unit ($1 base × multiplier) */
  suggestedTrifectaUnit: number;
  /** Total investment at suggested units */
  totalInvestment: number;
}

// ============================================================================
// RACE VERDICT
// ============================================================================

/**
 * Race verdict - final decision on whether to bet this race
 */
export interface RaceVerdict {
  /** Action to take: BET or PASS */
  action: 'BET' | 'PASS';
  /** One-line summary for UI display */
  summary: string;
}

// ============================================================================
// DEPRECATED: BET CONSTRUCTION GUIDANCE (Expansion/Contraction Model)
// ============================================================================

/**
 * @deprecated Use TicketConstruction instead. This interface is kept for backward compatibility.
 * Exacta ticket strategy (legacy)
 */
export interface ExactaStrategy {
  /** Type of exacta construction */
  type: 'KEY' | 'BOX' | 'PART_WHEEL';
  /** Key horse program number (only if type = KEY or PART_WHEEL) */
  keyHorse: number | null;
  /** Horses to include in box or wheel */
  includeHorses: number[];
  /** Vulnerable favorite to exclude from top positions */
  excludeFromTop: number | null;
}

/**
 * @deprecated Use TicketConstruction instead. This interface is kept for backward compatibility.
 * Trifecta ticket strategy (legacy)
 */
export interface TrifectaStrategy {
  /** Type of trifecta construction */
  type: 'KEY' | 'BOX' | 'PART_WHEEL';
  /** Key horse program number (only if type = KEY) */
  keyHorse: number | null;
  /** A horses - win contenders */
  aHorses: number[];
  /** B horses - place/show contenders */
  bHorses: number[];
  /** Vulnerable favorite to exclude from top positions */
  excludeFromTop: number | null;
}

/**
 * @deprecated Use TicketConstruction instead. This interface is kept for backward compatibility.
 * The expansion/contraction model has been replaced by the three-template system.
 *
 * Bet Construction Guidance - Legacy expansion/contraction model
 *
 * Philosophy:
 * - Algorithm top 4 are SACRED — never demoted by AI
 * - AI signals EXPAND boxes (add sleepers) or CONTRACT them (fade vulnerable favorites)
 * - No more rank shuffling — preserves exotic ticket construction
 */
export interface BetConstructionGuidance {
  // Core ticket construction
  /** Program numbers of algorithm's top 4 (never modified by AI) */
  algorithmTop4: number[];
  /** @deprecated Expansion horses are no longer used - always empty array */
  expansionHorses?: number[];
  /** Vulnerable favorite to EXCLUDE from key spots (algorithm rank 1 only) */
  contractionTarget: number | null;

  // Ticket recommendations
  /** Exacta construction strategy */
  exactaStrategy: ExactaStrategy;
  /** Trifecta construction strategy */
  trifectaStrategy: TrifectaStrategy;

  // Flags
  /** Race classification for betting approach */
  raceClassification: 'BETTABLE' | 'SPREAD_WIDE' | 'PASS';
  /** Whether a vulnerable favorite was detected (HIGH confidence) */
  vulnerableFavoriteDetected: boolean;
  /** @deprecated Sleeper identification is no longer used - always false */
  sleeperIdentified?: boolean;

  // Debug
  /** Summary of signals that influenced construction */
  signalSummary: string;
}
