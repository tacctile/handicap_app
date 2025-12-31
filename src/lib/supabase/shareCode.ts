/**
 * Share Code Generation Utilities
 *
 * Generates short, readable share codes for live sessions.
 * Uses a character set that avoids ambiguous characters (0/O, 1/l, etc.)
 */

// Character set excluding ambiguous characters
const SHARE_CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const SHARE_CODE_LENGTH = 6;

/**
 * Generate a short, readable share code
 * Format: 6 lowercase alphanumeric characters
 * Example: "abc123", "xyz789"
 */
export function generateShareCode(): string {
  let code = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * SHARE_CODE_CHARS.length);
    code += SHARE_CODE_CHARS[randomIndex];
  }
  return code;
}

/**
 * Validate share code format
 * Must be exactly 6 lowercase alphanumeric characters
 */
export function isValidShareCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }
  return /^[a-z0-9]{6}$/.test(code);
}

/**
 * Normalize share code (lowercase, trim)
 */
export function normalizeShareCode(code: string): string {
  return code.toLowerCase().trim();
}

/**
 * Generate the full share URL for a given code
 */
export function getShareUrl(shareCode: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/live/${shareCode}`;
}

/**
 * Extract share code from a URL
 * Supports both full URLs and just the path
 */
export function extractShareCodeFromUrl(url: string): string | null {
  // Match /live/xxxxxx pattern
  const match = url.match(/\/live\/([a-z0-9]{6})(?:[/?#]|$)/i);
  if (match && match[1]) {
    return normalizeShareCode(match[1]);
  }
  return null;
}
