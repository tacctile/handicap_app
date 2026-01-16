/**
 * AI Service Implementation
 *
 * Provides AI services with support for multiple providers.
 * Includes Gemini 2.0 Flash-Lite integration for the 6-bot deliberation system.
 */

import type {
  AIProviderType,
  AIConfig,
  AIResponse,
  NarrativeContext,
  TripNoteContext,
  QueryContext,
  IAIProvider,
} from './types';

import { defaultAIConfig, createAIError } from './types';

// Re-export types for convenience
export * from './types';

// Re-export Gemini service
export * from './gemini';

// Re-export prompts
export * from './prompts';

// Re-export deliberation orchestrator
export * from './deliberation';

// ============================================================================
// MOCK AI SERVICE
// ============================================================================

/**
 * Mock AI service for development and testing
 * Returns placeholder responses to simulate AI behavior
 */
class MockAIService implements IAIProvider {
  private config: AIConfig;

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...defaultAIConfig, ...config };
  }

  /**
   * Simulate async delay for realistic testing
   */
  private async delay(): Promise<void> {
    const ms = this.config.mockDelayMs || 500;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate mock response with metadata
   */
  private createResponse(content: string, startTime: number): AIResponse {
    return {
      content,
      tokensUsed: Math.ceil(content.length / 4), // Rough token estimate
      provider: 'mock',
      model: 'mock-v1',
      durationMs: Date.now() - startTime,
    };
  }

  async generateNarrative(context: NarrativeContext): Promise<AIResponse> {
    const startTime = Date.now();
    await this.delay();

    const topHorse = context.horses.reduce((a, b) => (a.score > b.score ? a : b));
    const content =
      `[Mock Narrative] Race ${context.raceNumber} at ${context.trackName} - ` +
      `${context.distance} ${context.surface} ${context.raceClass}. ` +
      `Top pick: ${topHorse.name} (${topHorse.score} pts) with ${topHorse.jockey} up for ${topHorse.trainer}. ` +
      `Key factors: ${topHorse.keyFactors.join(', ') || 'No specific factors noted'}. ` +
      `This is a placeholder response from the mock AI service.`;

    return this.createResponse(content, startTime);
  }

  async interpretTripNotes(context: TripNoteContext): Promise<AIResponse> {
    const startTime = Date.now();
    await this.delay();

    const content =
      `[Mock Interpretation] Trip note for ${context.horseName}: "${context.tripNote}". ` +
      `This note suggests the horse experienced typical racing conditions. ` +
      `Full interpretation requires the actual AI service to be enabled. ` +
      `This is a placeholder response from the mock AI service.`;

    return this.createResponse(content, startTime);
  }

  async answerQuery(context: QueryContext): Promise<AIResponse> {
    const startTime = Date.now();
    await this.delay();

    const content =
      `[Mock Answer] Your question: "${context.query}". ` +
      `I'm currently running in mock mode, so I can't provide a real answer. ` +
      `When the AI service is fully configured, I'll be able to analyze race data ` +
      `and provide detailed insights. This is a placeholder response.`;

    return this.createResponse(content, startTime);
  }

  getProviderType(): AIProviderType {
    return 'mock';
  }

  isAvailable(): boolean {
    return true; // Mock is always available
  }
}

// ============================================================================
// PROVIDER STUBS
// ============================================================================

/**
 * Gemini AI service implementation using Gemini 2.0 Flash-Lite
 * Provides the IAIProvider interface backed by the Gemini API
 */
class GeminiAIService implements IAIProvider {
  private config: AIConfig;

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...defaultAIConfig, ...config, provider: 'gemini' };
  }

  private async callGeminiInternal(systemPrompt: string, userContent: string): Promise<AIResponse> {
    // Import dynamically to avoid circular dependencies
    const { callGemini, GEMINI_MODEL } = await import('./gemini');
    const startTime = Date.now();

    const response = await callGemini({
      systemPrompt,
      userContent,
      temperature: 0.7,
      maxOutputTokens: this.config.defaultMaxTokens,
    });

    return {
      content: response.text,
      tokensUsed: response.totalTokens,
      provider: 'gemini',
      model: GEMINI_MODEL,
      durationMs: Date.now() - startTime,
    };
  }

  async generateNarrative(context: NarrativeContext): Promise<AIResponse> {
    const systemPrompt = `You are an expert horse racing analyst. Generate a concise, insightful narrative summary for the race.`;

    const userContent = `Race ${context.raceNumber} at ${context.trackName}
Distance: ${context.distance} | Surface: ${context.surface} | Class: ${context.raceClass}

Horses:
${context.horses
  .map(
    (h) =>
      `- ${h.name}: Score ${h.score}, Tier ${h.tier}, Jockey: ${h.jockey}, Trainer: ${h.trainer}
   Key Factors: ${h.keyFactors.join(', ') || 'None'}`
  )
  .join('\n')}

Generate a 2-3 paragraph narrative covering the top contenders, pace scenario, and key angles.`;

    return this.callGeminiInternal(systemPrompt, userContent);
  }

  async interpretTripNotes(context: TripNoteContext): Promise<AIResponse> {
    const systemPrompt = `You are an expert at interpreting horse racing trip notes. Explain what the trip note means in plain language and assess its impact on the horse's chances.`;

    const userContent = `Horse: ${context.horseName}
${context.trackName ? `Track: ${context.trackName}` : ''}
${context.raceDate ? `Date: ${context.raceDate}` : ''}

Trip Note: "${context.tripNote}"

Explain what this trip note means and whether it suggests the horse had trouble or ran a clean race.`;

    return this.callGeminiInternal(systemPrompt, userContent);
  }

  async answerQuery(context: QueryContext): Promise<AIResponse> {
    const systemPrompt = `You are an expert horse racing analyst assistant. Answer questions about race data clearly and concisely.`;

    const userContent = `Question: ${context.query}
${context.viewContext ? `\nContext: ${context.viewContext}` : ''}
${context.raceData ? `\nRace Data: ${JSON.stringify(context.raceData, null, 2)}` : ''}

Provide a helpful, accurate answer.`;

    return this.callGeminiInternal(systemPrompt, userContent);
  }

  getProviderType(): AIProviderType {
    return 'gemini';
  }

  isAvailable(): boolean {
    // Import check function dynamically
    try {
      // Check synchronously by looking for the API key or being in browser
      if (typeof window !== 'undefined') return true;
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return true;
      // Server-side check
      if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
        const nodeProcess = globalThis.process as { env?: Record<string, string | undefined> };
        if (nodeProcess.env?.GEMINI_API_KEY) return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Claude AI service stub
 * Throws "not implemented" error until actual integration is added
 */
class ClaudeAIService implements IAIProvider {
  constructor(_config: Partial<AIConfig> = {}) {
    // Config would be used when implementing actual Claude integration
  }

  async generateNarrative(_context: NarrativeContext): Promise<AIResponse> {
    throw createAIError('NOT_IMPLEMENTED', 'Claude AI provider is not yet implemented', false);
  }

  async interpretTripNotes(_context: TripNoteContext): Promise<AIResponse> {
    throw createAIError('NOT_IMPLEMENTED', 'Claude AI provider is not yet implemented', false);
  }

  async answerQuery(_context: QueryContext): Promise<AIResponse> {
    throw createAIError('NOT_IMPLEMENTED', 'Claude AI provider is not yet implemented', false);
  }

  getProviderType(): AIProviderType {
    return 'claude';
  }

  isAvailable(): boolean {
    return false;
  }
}

/**
 * OpenAI service stub
 * Throws "not implemented" error until actual integration is added
 */
class OpenAIService implements IAIProvider {
  constructor(_config: Partial<AIConfig> = {}) {
    // Config would be used when implementing actual OpenAI integration
  }

  async generateNarrative(_context: NarrativeContext): Promise<AIResponse> {
    throw createAIError('NOT_IMPLEMENTED', 'OpenAI provider is not yet implemented', false);
  }

  async interpretTripNotes(_context: TripNoteContext): Promise<AIResponse> {
    throw createAIError('NOT_IMPLEMENTED', 'OpenAI provider is not yet implemented', false);
  }

  async answerQuery(_context: QueryContext): Promise<AIResponse> {
    throw createAIError('NOT_IMPLEMENTED', 'OpenAI provider is not yet implemented', false);
  }

  getProviderType(): AIProviderType {
    return 'openai';
  }

  isAvailable(): boolean {
    return false;
  }
}

// ============================================================================
// AI SERVICE FACTORY
// ============================================================================

/**
 * Get an AI provider instance based on the specified type
 * @param type The provider type to instantiate
 * @param config Optional configuration for the provider
 * @returns An AI provider instance
 */
export function getAIProvider(
  type: AIProviderType = 'mock',
  config: Partial<AIConfig> = {}
): IAIProvider {
  const finalConfig = { ...defaultAIConfig, ...config, provider: type };

  switch (type) {
    case 'gemini':
      return new GeminiAIService(finalConfig);

    case 'claude':
      console.warn('[AI] Claude provider not yet implemented, returning stub');
      return new ClaudeAIService(finalConfig);

    case 'openai':
      console.warn('[AI] OpenAI provider not yet implemented, returning stub');
      return new OpenAIService(finalConfig);

    case 'mock':
    default:
      return new MockAIService(finalConfig);
  }
}

/**
 * Create an AI service instance based on configuration
 * Alias for getAIProvider for consistency with other services
 */
export function createAIService(config: Partial<AIConfig> = {}): IAIProvider {
  const finalConfig = { ...defaultAIConfig, ...config };
  return getAIProvider(finalConfig.provider, finalConfig);
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let aiServiceInstance: IAIProvider | null = null;

/**
 * Get the singleton AI service instance
 * Creates one if it doesn't exist (defaults to mock)
 */
export function getAIService(config?: Partial<AIConfig>): IAIProvider {
  if (!aiServiceInstance) {
    aiServiceInstance = createAIService(config);
  }
  return aiServiceInstance;
}

/**
 * Reset the AI service instance (useful for testing)
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}

/**
 * Export the service classes for direct instantiation if needed
 */
export { MockAIService, GeminiAIService, ClaudeAIService, OpenAIService };

/**
 * Default export is the singleton getter
 */
export default getAIService;
