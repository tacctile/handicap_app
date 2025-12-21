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
