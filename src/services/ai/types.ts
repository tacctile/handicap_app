/**
 * AI Service Type Definitions
 *
 * Provides type-safe abstractions for AI services.
 * Designed to work with Gemini, Claude, OpenAI, or mock implementations.
 */

// ============================================================================
// AI PROVIDERS
// ============================================================================

/**
 * Supported AI providers
 */
export type AIProviderType = 'mock' | 'gemini' | 'claude' | 'openai';

/**
 * Configuration for AI service
 */
export interface AIConfig {
  /** Which AI provider to use */
  provider: AIProviderType;
  /** API key for the provider (not used by mock) */
  apiKey?: string;
  /** Mock delay in ms (for mock provider) */
  mockDelayMs?: number;
  /** Default max tokens for requests */
  defaultMaxTokens?: number;
  /** Model name/version to use */
  model?: string;
}

/**
 * Default AI configuration
 */
export const defaultAIConfig: AIConfig = {
  provider: 'mock',
  mockDelayMs: 500,
  defaultMaxTokens: 1024,
};

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * AI request type containing prompt and configuration
 */
export interface AIRequest {
  /** The prompt to send to the AI */
  prompt: string;
  /** Additional context for the request */
  context?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for generation (0-1) */
  temperature?: number;
}

/**
 * AI response type with content and metadata
 */
export interface AIResponse {
  /** The generated content */
  content: string;
  /** Number of tokens used in the response */
  tokensUsed: number;
  /** Which provider generated this response */
  provider: AIProviderType;
  /** Model used for generation */
  model?: string;
  /** Time taken to generate in ms */
  durationMs?: number;
}

/**
 * Context for race narrative generation
 */
export interface NarrativeContext {
  /** Race number */
  raceNumber: number;
  /** Track name */
  trackName: string;
  /** Race distance */
  distance: string;
  /** Race surface */
  surface: string;
  /** Race class/type */
  raceClass: string;
  /** Horse data for the race */
  horses: Array<{
    name: string;
    score: number;
    tier: number;
    jockey: string;
    trainer: string;
    keyFactors: string[];
  }>;
}

/**
 * Context for trip note interpretation
 */
export interface TripNoteContext {
  /** The raw trip note text */
  tripNote: string;
  /** Horse name */
  horseName: string;
  /** Race date */
  raceDate?: string;
  /** Track name */
  trackName?: string;
}

/**
 * Context for natural language queries
 */
export interface QueryContext {
  /** The user's question */
  query: string;
  /** Race data to query against */
  raceData?: unknown;
  /** Additional context about the current view/state */
  viewContext?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * AI error codes
 */
export type AIErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'CONTENT_FILTERED'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Structured AI error
 */
export interface AIError {
  /** Error code for programmatic handling */
  code: AIErrorCode;
  /** Human-readable error message */
  message: string;
  /** Whether the request can be retried */
  retryable: boolean;
  /** Original error from the provider */
  originalError?: unknown;
}

/**
 * Create a typed AI error
 */
export function createAIError(
  code: AIErrorCode,
  message: string,
  retryable: boolean = false,
  originalError?: unknown
): AIError {
  return { code, message, retryable, originalError };
}

/**
 * Type guard for AIError
 */
export function isAIError(error: unknown): error is AIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  );
}

// ============================================================================
// SERVICE INTERFACE
// ============================================================================

/**
 * AI Provider interface
 * All AI providers must implement this interface
 */
export interface IAIProvider {
  /**
   * Generate a narrative summary for a race
   * @param context Race context including horses and their scores
   * @returns AI-generated narrative
   */
  generateNarrative(context: NarrativeContext): Promise<AIResponse>;

  /**
   * Interpret and explain trip notes
   * @param context Trip note context
   * @returns AI-generated interpretation
   */
  interpretTripNotes(context: TripNoteContext): Promise<AIResponse>;

  /**
   * Answer natural language queries about race data
   * @param context Query context with the question and relevant data
   * @returns AI-generated answer
   */
  answerQuery(context: QueryContext): Promise<AIResponse>;

  /**
   * Get the provider type
   */
  getProviderType(): AIProviderType;

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Result type for async AI operations
 */
export type AIResult<T> = { success: true; data: T } | { success: false; error: AIError };

/**
 * Wrap async AI operation in result type
 */
export async function wrapAIResult<T>(operation: () => Promise<T>): Promise<AIResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    if (isAIError(error)) {
      return { success: false, error };
    }
    return {
      success: false,
      error: createAIError('UNKNOWN_ERROR', 'An unexpected error occurred', false, error),
    };
  }
}

/**
 * Unsubscribe function returned by listeners (for future use)
 */
export type Unsubscribe = () => void;

// ============================================================================
// DELIBERATION SYSTEM TYPES
// ============================================================================

/**
 * Bot identifiers for the 6-bot deliberation system
 */
export type BotId =
  | 'pattern-scanner'
  | 'longshot-hunter'
  | 'favorite-killer'
  | 'trip-analyst'
  | 'synthesizer'
  | 'race-narrator';

/**
 * Bot display information
 */
export interface BotInfo {
  id: BotId;
  name: string;
  description: string;
  /** Order in execution sequence (1-4 parallel, 5 waits for 1-4, 6 waits for 5) */
  executionOrder: number;
  /** Bots this bot depends on */
  dependencies: BotId[];
}

/**
 * All bot metadata
 */
export const BOT_INFO: Record<BotId, BotInfo> = {
  'pattern-scanner': {
    id: 'pattern-scanner',
    name: 'Pattern Scanner',
    description: 'Analyzes historical patterns, trainer angles, and situational statistics',
    executionOrder: 1,
    dependencies: [],
  },
  'longshot-hunter': {
    id: 'longshot-hunter',
    name: 'Longshot Hunter',
    description: 'Identifies overlooked value plays at higher odds',
    executionOrder: 1,
    dependencies: [],
  },
  'favorite-killer': {
    id: 'favorite-killer',
    name: 'Favorite Killer',
    description: 'Finds weaknesses in heavily-bet favorites',
    executionOrder: 1,
    dependencies: [],
  },
  'trip-analyst': {
    id: 'trip-analyst',
    name: 'Trip Analyst',
    description: 'Evaluates past race trips and pace scenarios',
    executionOrder: 1,
    dependencies: [],
  },
  synthesizer: {
    id: 'synthesizer',
    name: 'Synthesizer + Devil\'s Advocate',
    description: 'Combines all analyses and challenges assumptions',
    executionOrder: 2,
    dependencies: ['pattern-scanner', 'longshot-hunter', 'favorite-killer', 'trip-analyst'],
  },
  'race-narrator': {
    id: 'race-narrator',
    name: 'Race Narrator',
    description: 'Creates human-readable insights and final rankings',
    executionOrder: 3,
    dependencies: ['synthesizer'],
  },
};

/**
 * Horse data passed to the deliberation system
 */
export interface DeliberationHorse {
  programNumber: number;
  name: string;
  morningLineOdds: string;
  currentOdds?: string | null;
  jockey: string;
  trainer: string;
  /** Algorithm composite score */
  algorithmScore: number;
  /** Tier classification (1-5) */
  tier: number;
  /** Running style (E, E/P, P, S, etc.) */
  runningStyle: string;
  /** Days since last race */
  daysSinceLastRace: number | null;
  /** Last Beyer speed figure */
  lastBeyer: number | null;
  /** Average Beyer (last 3 races) */
  avgBeyer: number | null;
  /** Best lifetime Beyer */
  bestBeyer: number | null;
  /** Key factors from algorithm scoring */
  keyFactors: string[];
  /** Equipment changes */
  equipmentChanges: string[];
  /** First time equipment */
  firstTimeEquipment: string[];
  /** Track record stats */
  trackRecord: { starts: number; wins: number };
  /** Distance record stats */
  distanceRecord: { starts: number; wins: number };
  /** Surface record stats */
  surfaceRecord: { starts: number; wins: number };
  /** Trainer category stats relevant to this race */
  trainerAngles: string[];
  /** Recent workouts summary */
  workoutSummary: string;
  /** Past performances summary (last 3) */
  recentForm: string;
}

/**
 * Race context for deliberation
 */
export interface DeliberationRaceContext {
  trackCode: string;
  trackName: string;
  raceNumber: number;
  raceDate: string;
  distance: string;
  distanceFurlongs: number;
  surface: string;
  trackCondition: string;
  raceType: string;
  classification: string;
  purse: number;
  fieldSize: number;
  /** Projected pace scenario */
  paceScenario: 'hot' | 'moderate' | 'slow' | 'unknown';
  /** Number of early speed horses */
  earlySpeedCount: number;
}

/**
 * Input to the deliberation system
 */
export interface DeliberationInput {
  race: DeliberationRaceContext;
  horses: DeliberationHorse[];
  /** Current timestamp for reference */
  timestamp: string;
}

/**
 * Single bot's analysis output
 */
export interface BotAnalysis {
  botId: BotId;
  botName: string;
  /** Raw analysis text from the bot */
  analysis: string;
  /** Horses mentioned positively */
  topPicks: number[]; // program numbers
  /** Horses mentioned negatively */
  concerns: number[]; // program numbers
  /** Confidence level (0-100) */
  confidence: number;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Whether this analysis completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Horse ranking from the final narrator
 */
export interface HorseRanking {
  rank: number;
  programNumber: number;
  horseName: string;
  /** Win probability estimate (0-100) */
  winProbability: number;
  /** Value assessment */
  valueRating: 'strong-value' | 'fair-value' | 'underlay' | 'pass';
  /** Key reasons for this ranking */
  keyReasons: string[];
}

/**
 * Betting suggestion from deliberation
 */
export interface BettingSuggestion {
  type: 'win' | 'place' | 'show' | 'exacta' | 'trifecta' | 'superfecta' | 'daily-double';
  horses: number[]; // program numbers
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
}

/**
 * Final deliberation output
 */
export interface DeliberationOutput {
  /** All individual bot analyses */
  botAnalyses: BotAnalysis[];
  /** Final horse rankings */
  rankings: HorseRanking[];
  /** Human-readable race narrative */
  narrative: string;
  /** Suggested bets */
  bettingSuggestions: BettingSuggestion[];
  /** Key insights summary (3-5 bullets) */
  keyInsights: string[];
  /** Overall confidence in analysis */
  overallConfidence: number;
  /** Total processing time */
  totalProcessingTimeMs: number;
  /** Timestamp of completion */
  completedAt: string;
  /** Whether full deliberation completed */
  success: boolean;
  /** Partial results if some bots failed */
  partialResults: boolean;
  /** Errors encountered */
  errors: string[];
}

/**
 * Gemini API request structure
 */
export interface GeminiRequest {
  systemPrompt: string;
  userContent: string;
  /** Temperature (0-2, default 1) */
  temperature?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
}

/**
 * Gemini API response structure
 */
export interface GeminiResponse {
  text: string;
  /** Tokens used in prompt */
  promptTokens: number;
  /** Tokens in response */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Model used */
  model: string;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Gemini API error
 */
export interface GeminiError {
  code: 'API_KEY_MISSING' | 'API_KEY_INVALID' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'API_ERROR' | 'PARSE_ERROR';
  message: string;
  retryable: boolean;
  statusCode?: number;
}
