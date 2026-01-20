/**
 * Global Type Declarations for Isomorphic Code
 *
 * Provides type declarations that work in both browser (Vite) and
 * Node.js (serverless functions, tests) environments.
 */

/**
 * Node.js process global - may be undefined in browser environments
 * This allows code to use `typeof process !== 'undefined'` guards
 */
declare const process:
  | {
      env?: {
        NODE_ENV?: string;
        VITE_GEMINI_API_KEY?: string;
        GEMINI_API_KEY?: string;
        [key: string]: string | undefined;
      };
    }
  | undefined;
