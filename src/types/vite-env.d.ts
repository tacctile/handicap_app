/**
 * Vite Environment Variable Type Declarations
 *
 * Provides type safety for import.meta.env variables.
 * This file is used by both the frontend (via tsconfig.app.json with "vite/client")
 * and the API serverless functions (via api/tsconfig.json).
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gemini API key for AI race analysis */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Current mode (development, production, test) */
  readonly MODE: string;
  /** Base URL for the app */
  readonly BASE_URL: string;
  /** Whether running in production */
  readonly PROD: boolean;
  /** Whether running in development */
  readonly DEV: boolean;
  /** Whether running in SSR mode */
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
